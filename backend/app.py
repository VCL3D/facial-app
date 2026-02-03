#!/usr/bin/env python3
"""
Flask backend for Facial Data Collection app
Handles session creation, chunked video uploads, and metadata storage
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import json
import uuid
from datetime import datetime
from pathlib import Path
import shutil
import base64
import io
import numpy as np
from PIL import Image
import tritonclient.http as httpclient
import logging  # #claude
from logging.handlers import RotatingFileHandler  # #claude
import gc  # #claude: Explicit garbage collection to prevent memory leaks
import cv2  # #claude: OpenCV for face detection
from face_preprocessing import preprocess_with_face_detection  # #claude: New face detection pipeline

# Serve frontend static files from ../frontend directory
app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)  # Enable CORS for frontend communication

# #claude: Limit request size to prevent memory exhaustion (100MB max)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100 MB

# Logging configuration - log all requests and errors to file  # #claude
LOG_DIR = Path(__file__).parent.parent / 'logs'  # #claude
LOG_DIR.mkdir(exist_ok=True)  # #claude
LOG_FILE = LOG_DIR / 'backend.log'  # #claude

# Configure root logger  # #claude
logging.basicConfig(  # #claude
    level=logging.INFO,  # #claude
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',  # #claude
    handlers=[  # #claude
        RotatingFileHandler(LOG_FILE, maxBytes=10*1024*1024, backupCount=5),  # 10MB per file, 5 backups  # #claude
        logging.StreamHandler()  # Also print to console  # #claude
    ]  # #claude
)  # #claude

logger = logging.getLogger(__name__)  # #claude
logger.info("="*60)  # #claude
logger.info("Flask backend starting...")  # #claude
logger.info(f"Log file: {LOG_FILE}")  # #claude
logger.info("="*60)  # #claude

# Configuration
BASE_DATA_DIR = Path(__file__).parent.parent / 'data' / 'facial_recordings'
BASE_DATA_DIR.mkdir(parents=True, exist_ok=True)

# #claude: Separate directory for camera test videos
CAMERA_TEST_DIR = Path(__file__).parent.parent / 'data' / 'camera_tests'
CAMERA_TEST_DIR.mkdir(parents=True, exist_ok=True)

# Triton Inference Server configuration
TRITON_URL = os.environ.get('TRITON_URL', 'localhost:8003')
TRITON_MODEL_NAME = 'efficient_fiqa'
TRITON_MODEL_VERSION = '1'

# ImageNet normalization stats (used by Efficient-FIQA)
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

# Face detection configuration (YuNet)  # #claude
FACE_DETECTOR_MODEL_PATH = Path(__file__).parent.parent / 'ai-models' / 'yunet' / 'face_detection_yunet_2023mar.onnx'  # #claude
FACE_DETECTION_CONF_THRESHOLD = 0.6  # Minimum confidence for face detection  # #claude
FACE_DETECTION_NMS_THRESHOLD = 0.3   # Non-maximum suppression threshold  # #claude
MIN_FACE_SIZE_RATIO = 0.12           # Minimum face size (12% of frame width)  # #claude
CROP_MARGIN_RATIO = 0.20             # 20% margin around face bbox  # #claude
MULTI_FACE_AMBIGUITY_RATIO = 0.35    # If 2nd face > 35% of largest, reject as ambiguous  # #claude
MAX_PADDING_RATIO = 0.10             # Max acceptable padding (10% of crop area)  # #claude

# Initialize face detector (lazy loading in function)  # #claude
_face_detector = None  # #claude

def get_face_detector():  # #claude
    """Get or initialize the YuNet face detector (singleton pattern)"""  # #claude
    global _face_detector  # #claude
    if _face_detector is None:  # #claude
        if not FACE_DETECTOR_MODEL_PATH.exists():  # #claude
            raise FileNotFoundError(f"Face detector model not found: {FACE_DETECTOR_MODEL_PATH}")  # #claude
        _face_detector = cv2.FaceDetectorYN.create(  # #claude
            str(FACE_DETECTOR_MODEL_PATH),  # #claude
            "",  # config (empty for ONNX)  # #claude
            (320, 320),  # default input size (will be updated per frame)  # #claude
            FACE_DETECTION_CONF_THRESHOLD,  # #claude
            FACE_DETECTION_NMS_THRESHOLD  # #claude
        )  # #claude
        logger.info(f"✅ Face detector initialized: {FACE_DETECTOR_MODEL_PATH.name}")  # #claude
    return _face_detector  # #claude

# ============================================================================
# Face Detection Helper Functions  # #claude
# ============================================================================

def detect_faces(img_bgr):  # #claude
    """  # #claude
    Detect faces in an image using YuNet  # #claude

    Args:  # #claude
        img_bgr: numpy array in BGR format (OpenCV format)  # #claude

    Returns:  # #claude
        list of dicts with keys: bbox (x, y, w, h), confidence, landmarks (5 points)  # #claude
        Empty list if no faces detected  # #claude
    """  # #claude
    detector = get_face_detector()  # #claude
    height, width = img_bgr.shape[:2]  # #claude

    # Update detector input size to match frame  # #claude
    detector.setInputSize((width, height))  # #claude

    # Detect faces  # #claude
    _, faces = detector.detect(img_bgr)  # #claude

    if faces is None:  # #claude
        return []  # #claude

    # Parse results  # #claude
    detected_faces = []  # #claude
    for face in faces:  # #claude
        # YuNet output: [x, y, w, h, x_re, y_re, x_le, y_le, x_nt, y_nt, x_rcm, y_rcm, x_lcm, y_lcm, conf]  # #claude
        # First 4: bbox, next 10: 5 landmarks (right_eye, left_eye, nose_tip, right_mouth, left_mouth), last: confidence  # #claude
        x, y, w, h = face[:4].astype(int)  # #claude
        confidence = float(face[14])  # #claude
        landmarks = face[4:14].reshape(5, 2).astype(int)  # 5 keypoints (x, y)  # #claude

        detected_faces.append({  # #claude
            'bbox': (x, y, w, h),  # #claude
            'confidence': confidence,  # #claude
            'landmarks': landmarks,  # #claude
            'area': w * h  # #claude
        })  # #claude

    # Sort by area (largest first)  # #claude
    detected_faces.sort(key=lambda f: f['area'], reverse=True)  # #claude
    return detected_faces  # #claude

def select_best_face(faces, img_shape):  # #claude
    """  # #claude
    Select the best face for quality assessment  # #claude

    Prioritizes: center position, size, confidence  # #claude

    Returns:  # #claude
        Selected face dict or None  # #claude
    """  # #claude
    if not faces:  # #claude
        return None  # #claude

    height, width = img_shape[:2]  # #claude
    frame_center_x, frame_center_y = width / 2, height / 2  # #claude

    # Calculate score for each face  # #claude
    for face in faces:  # #claude
        x, y, w, h = face['bbox']  # #claude
        center_x = x + w / 2  # #claude
        center_y = y + h / 2  # #claude

        # Distance from frame center (normalized)  # #claude
        dist_from_center = np.sqrt((center_x - frame_center_x)**2 + (center_y - frame_center_y)**2)  # #claude
        max_dist = np.sqrt(width**2 + height**2) / 2  # #claude
        center_weight = 1.0 - (dist_from_center / max_dist)  # #claude

        # Area normalized  # #claude
        area_norm = face['area'] / (width * height)  # #claude

        # Combined score  # #claude
        face['selection_score'] = area_norm * center_weight * face['confidence']  # #claude

    # Return face with highest score  # #claude
    return max(faces, key=lambda f: f['selection_score'])  # #claude

def is_ambiguous_multi_face(faces):  # #claude
    """Check if multiple faces are present and ambiguous (hard to pick one)"""  # #claude
    if len(faces) < 2:  # #claude
        return False  # #claude

    largest_area = faces[0]['area']  # #claude
    second_area = faces[1]['area']  # #claude

    # If 2nd face is >= 35% of largest, consider ambiguous  # #claude
    return second_area >= (MULTI_FACE_AMBIGUITY_RATIO * largest_area)  # #claude

def square_crop_with_margin(img_bgr, bbox, margin_ratio=CROP_MARGIN_RATIO):  # #claude
    """  # #claude
    Create a square crop around face bbox with margin  # #claude

    Args:  # #claude
        img_bgr: numpy array (BGR)  # #claude
        bbox: (x, y, w, h)  # #claude
        margin_ratio: fraction of bbox size to add as margin  # #claude

    Returns:  # #claude
        dict with keys:  # #claude
            - crop: numpy array (BGR, square)  # #claude
            - padding_ratio: fraction of crop that was padded (0 = no padding, 1 = all padding)  # #claude
    """  # #claude
    x, y, w, h = bbox  # #claude
    height, width = img_bgr.shape[:2]  # #claude

    # Make square: use the larger dimension  # #claude
    size = max(w, h)  # #claude

    # Add margin  # #claude
    margin = int(size * margin_ratio)  # #claude
    size_with_margin = size + 2 * margin  # #claude

    # Center the square on the face  # #claude
    center_x = x + w // 2  # #claude
    center_y = y + h // 2  # #claude

    # Calculate crop boundaries  # #claude
    x1 = center_x - size_with_margin // 2  # #claude
    y1 = center_y - size_with_margin // 2  # #claude
    x2 = x1 + size_with_margin  # #claude
    y2 = y1 + size_with_margin  # #claude

    # Calculate how much padding is needed  # #claude
    pad_left = max(0, -x1)  # #claude
    pad_top = max(0, -y1)  # #claude
    pad_right = max(0, x2 - width)  # #claude
    pad_bottom = max(0, y2 - height)  # #claude

    total_padding = pad_left + pad_top + pad_right + pad_bottom  # #claude
    padding_ratio = total_padding / (4 * size_with_margin)  # Normalized  # #claude

    # Clamp coordinates to image bounds  # #claude
    x1_clamped = max(0, x1)  # #claude
    y1_clamped = max(0, y1)  # #claude
    x2_clamped = min(width, x2)  # #claude
    y2_clamped = min(height, y2)  # #claude

    # Extract crop  # #claude
    crop = img_bgr[y1_clamped:y2_clamped, x1_clamped:x2_clamped]  # #claude

    # Add padding if necessary (reflection padding looks more natural)  # #claude
    if total_padding > 0:  # #claude
        crop = cv2.copyMakeBorder(  # #claude
            crop,  # #claude
            pad_top, pad_bottom, pad_left, pad_right,  # #claude
            cv2.BORDER_REFLECT_101  # #claude
        )  # #claude

    return {  # #claude
        'crop': crop,  # #claude
        'padding_ratio': padding_ratio  # #claude
    }  # #claude

# ============================================================================
# Helper Functions
# ============================================================================

def get_session_dir(session_id, video_type='recording'):
    """Get the directory path for a session

    Args:
        session_id: Unique session identifier
        video_type: 'recording' or 'encoder_test' (determines which base dir to use)
    """
    # #claude: Use camera_tests folder for encoder tests
    base_dir = CAMERA_TEST_DIR if video_type == 'encoder_test' else BASE_DATA_DIR
    return base_dir / session_id

def get_chunks_dir(session_id, video_id, video_type='recording'):
    """Get the directory for temporary chunks"""
    return get_session_dir(session_id, video_type) / f"{video_id}_chunks"

def preprocess_image_for_quality_check(image_data):
    """
    Preprocess image for Efficient-FIQA model

    Args:
        image_data: Base64-encoded image string or PIL Image

    Returns:
        numpy.ndarray: Preprocessed image tensor (1, 3, 352, 352)
    """
    image = None  # #claude: Track for cleanup
    try:
        # Decode base64 if needed
        if isinstance(image_data, str):
            # Remove data URL prefix if present (data:image/png;base64,...)
            if 'base64,' in image_data:
                image_data = image_data.split('base64,')[1]
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
        else:
            image = image_data

        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')

        # Resize to 352x352 (Efficient-FIQA input size)
        image = image.resize((352, 352), Image.BILINEAR)

        # Convert to numpy array and normalize to [0, 1]
        img_array = np.array(image, dtype=np.float32) / 255.0

        # Apply ImageNet normalization
        img_array = (img_array - IMAGENET_MEAN) / IMAGENET_STD

        # Convert from HWC to CHW format (channels first)
        img_array = np.transpose(img_array, (2, 0, 1))

        # Add batch dimension
        img_array = np.expand_dims(img_array, axis=0)

        return img_array

    finally:
        # #claude: CRITICAL - Close PIL image to free memory
        if image is not None:
            try:
                image.close()
            except:
                pass

# ============================================================================
# API Endpoints
# ============================================================================

@app.route('/api/session/create', methods=['POST'])
def create_session():
    """
    Create a new recording session

    Request body (optional):
        {
            "participant_id": "optional_participant_identifier",
            "participant_name": "John Doe"
        }

    Response:
        {
            "session_id": "uuid-generated-session-id",
            "created_at": "2026-01-27T15:30:00",
            "status": "created"
        }
    """
    try:
        data = request.get_json() or {}
        session_id = str(uuid.uuid4())
        participant_id = data.get('participant_id', 'anonymous')  # #claude
        participant_name = data.get('participant_name', 'Anonymous')  # #claude v48
        video_type = data.get('video_type', 'recording')  # #claude: Support camera test sessions

        logger.info(f"🆕 Creating session: {session_id} (participant: {participant_name}, type: {video_type})")  # #claude v48

        # Create session directory
        session_dir = get_session_dir(session_id, video_type)  # #claude: Pass video_type
        session_dir.mkdir(parents=True, exist_ok=True)

        # Create session metadata file
        session_metadata = {
            'session_id': session_id,
            'participant_id': data.get('participant_id'),
            'participant_name': participant_name,  # #claude v48
            'created_at': datetime.now().isoformat(),
            'status': 'created',
            'videos': []
        }

        with open(session_dir / 'session.json', 'w') as f:
            json.dump(session_metadata, f, indent=2)

        logger.info(f"✅ Session created: {session_id} at {session_dir}")  # #claude

        return jsonify({
            'session_id': session_id,
            'created_at': session_metadata['created_at'],
            'status': 'created'
        }), 201

    except Exception as e:
        logger.exception(f"❌ Failed to create session")  # #claude - logs full traceback
        return jsonify({'error': str(e)}), 500

@app.route('/api/upload/chunk', methods=['POST'])
def upload_chunk():
    """
    Upload a single chunk of a video

    Form data:
        - session_id: Session identifier
        - video_id: Video identifier (unique per video)
        - chunk_index: Current chunk index (0-based)
        - total_chunks: Total number of chunks
        - chunk: File data

    Response:
        {
            "status": "chunk_received",
            "chunk_index": 0,
            "total_chunks": 10
        }

        OR if last chunk:
        {
            "status": "video_complete",
            "video_id": "...",
            "file_path": "..."
        }
    """
    try:
        session_id = request.form.get('session_id')
        video_id = request.form.get('video_id')
        chunk_index = int(request.form.get('chunk_index'))
        total_chunks = int(request.form.get('total_chunks'))
        chunk_file = request.files.get('chunk')
        video_type = request.form.get('video_type', 'recording')  # #claude: Default to 'recording' for backwards compatibility
        file_extension = request.form.get('file_extension', 'webm')  # #claude: Support custom file extensions (e.g., 'json' for summary files)

        # Log chunk receipt  # #claude
        chunk_size = chunk_file.content_length if chunk_file else 0  # #claude
        logger.info(f"📥 Chunk received: session={session_id} video={video_id} type={video_type} chunk={chunk_index}/{total_chunks} size={chunk_size/1024:.1f}KB")  # #claude

        if not all([session_id, video_id, chunk_file]):
            logger.error(f"❌ Missing required fields: session_id={session_id}, video_id={video_id}, chunk_file={chunk_file is not None}")  # #claude
            return jsonify({'error': 'Missing required fields'}), 400

        # Verify session exists
        session_dir = get_session_dir(session_id, video_type)  # #claude: Pass video_type
        if not session_dir.exists():
            logger.error(f"❌ Session not found: {session_id}")  # #claude
            return jsonify({'error': 'Session not found'}), 404

        # Create chunks directory
        chunks_dir = get_chunks_dir(session_id, video_id, video_type)  # #claude: Pass video_type
        chunks_dir.mkdir(parents=True, exist_ok=True)

        # Save chunk
        chunk_path = chunks_dir / f"chunk_{chunk_index:04d}"
        chunk_file.save(str(chunk_path))
        saved_size = chunk_path.stat().st_size  # #claude
        logger.info(f"✅ Chunk saved: {chunk_path.name} ({saved_size/1024:.1f}KB)")  # #claude

        # Check if all chunks received
        received_chunks = len(list(chunks_dir.glob('chunk_*')))
        logger.info(f"📊 Progress: {received_chunks}/{total_chunks} chunks received for {video_id}")  # #claude

        if received_chunks == total_chunks:
            # Reassemble video
            logger.info(f"🔧 Starting video reassembly: {video_id}")  # #claude
            video_path = session_dir / f"{video_id}.{file_extension}"  # #claude: Use custom extension if provided

            with open(video_path, 'wb') as outfile:
                for i in range(total_chunks):
                    chunk_path = chunks_dir / f"chunk_{i:04d}"
                    if not chunk_path.exists():  # #claude
                        logger.error(f"❌ Missing chunk during reassembly: chunk_{i:04d}")  # #claude
                        return jsonify({'error': f'Missing chunk {i}'}), 500  # #claude
                    with open(chunk_path, 'rb') as chunk:
                        outfile.write(chunk.read())

            final_size = video_path.stat().st_size  # #claude
            logger.info(f"✅ File reassembled: {video_id}.{file_extension} ({final_size/1024/1024:.2f}MB)")  # #claude

            # Clean up chunks
            shutil.rmtree(chunks_dir)
            logger.info(f"🗑️ Cleaned up chunk directory for {video_id}")  # #claude

            # #claude: Use correct base dir for relative path
            base_dir = CAMERA_TEST_DIR if video_type == 'encoder_test' else BASE_DATA_DIR
            return jsonify({
                'status': 'video_complete',
                'video_id': video_id,
                'file_path': str(video_path.relative_to(base_dir))
            }), 200
        else:
            return jsonify({
                'status': 'chunk_received',
                'chunk_index': chunk_index,
                'total_chunks': total_chunks,
                'received': received_chunks
            }), 200

    except Exception as e:
        logger.exception(f"❌ Upload chunk failed: session={request.form.get('session_id')} video={request.form.get('video_id')} chunk={request.form.get('chunk_index')}")  # #claude - logs full traceback
        return jsonify({'error': str(e)}), 500

@app.route('/api/upload/metadata', methods=['POST'])
def upload_metadata():
    """
    Store metadata for a video

    Request body:
        {
            "session_id": "...",
            "video_id": "...",
            "prompt_id": "facial_expressions",
            "duration": 45.2,
            "file_size": 15728640,
            "codec": "vp9",
            "resolution": "1280x960",
            "frame_rate": 30,
            "camera_model": "HD Webcam",
            "browser": "Chrome 144.0",
            "timestamp": "2026-01-27T15:30:00"
        }

    Response:
        {
            "status": "metadata_saved",
            "video_id": "..."
        }
    """
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        video_id = data.get('video_id')
        file_size = data.get('file_size', 0)  # #claude

        logger.info(f"📋 Metadata upload: session={session_id} video={video_id} size={file_size/1024/1024:.2f}MB")  # #claude

        if not session_id or not video_id:
            logger.error(f"❌ Missing session_id or video_id in metadata upload")  # #claude
            return jsonify({'error': 'Missing session_id or video_id'}), 400

        session_dir = get_session_dir(session_id)
        if not session_dir.exists():
            logger.error(f"❌ Session not found: {session_id}")  # #claude
            return jsonify({'error': 'Session not found'}), 404

        # Save video metadata
        metadata_path = session_dir / f"{video_id}.metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(data, f, indent=2)
        logger.info(f"✅ Metadata saved: {metadata_path.name}")  # #claude

        # Update session metadata
        session_file = session_dir / 'session.json'
        with open(session_file, 'r') as f:
            session_data = json.load(f)

        session_data['videos'].append({
            'video_id': video_id,
            'prompt_id': data.get('prompt_id'),
            'uploaded_at': datetime.now().isoformat()
        })

        with open(session_file, 'w') as f:
            json.dump(session_data, f, indent=2)

        video_count = len(session_data['videos'])  # #claude
        logger.info(f"📊 Session progress: {video_count} videos uploaded for session {session_id}")  # #claude

        return jsonify({
            'status': 'metadata_saved',
            'video_id': video_id
        }), 200

    except Exception as e:
        logger.exception(f"❌ Metadata upload failed: session={session_id} video={video_id}")  # #claude - logs full traceback
        return jsonify({'error': str(e)}), 500

@app.route('/api/session/<session_id>', methods=['GET'])
def get_session(session_id):
    """
    Get session information

    Response:
        {
            "session_id": "...",
            "created_at": "...",
            "status": "...",
            "videos": [...]
        }
    """
    try:
        session_dir = get_session_dir(session_id)
        session_file = session_dir / 'session.json'

        if not session_file.exists():
            return jsonify({'error': 'Session not found'}), 404

        with open(session_file, 'r') as f:
            session_data = json.load(f)

        return jsonify(session_data), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/quality/check', methods=['POST'])
def check_quality():
    """
    Check face image quality using AI model (Efficient-FIQA)

    Request body:
        {
            "image": "base64-encoded image data (data:image/png;base64,...)"
        }

    Response:
        {
            "quality_score": 0.85,  # 0-1, higher = better
            "quality_level": "good",  # poor, acceptable, good
            "threshold_met": true,   # True if >= 0.5
            "inference_time_ms": 4.2
        }
    """
    try:
        import time
        start_time = time.time()

        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({'error': 'Missing image data'}), 400

        # Check if image data is empty/placeholder (encoder test sends empty frames)  # #claude
        image_data = data['image']  # #claude
        if not image_data or image_data in ['data:,', '']:  # #claude
            logger.debug("Quality check skipped: empty image data (likely encoder test)")  # #claude
            return jsonify({  # #claude
                'status': 'NO_FRAME',  # #claude
                'quality_score': None,  # #claude
                'quality_level': None,  # #claude
                'threshold_met': False,  # #claude
                'face_confidence': 0.0,  # #claude
                'message': 'No frame data provided',  # #claude
                'inference_time_ms': 0  # #claude
            }), 200  # #claude

        # Preprocess image with face detection  # #claude
        preprocess_result = preprocess_with_face_detection(  # #claude
            image_data,  # #claude
            get_face_detector(),  # #claude
            min_face_ratio=MIN_FACE_SIZE_RATIO,  # #claude
            max_padding_ratio=MAX_PADDING_RATIO,  # #claude
            multi_face_ambiguity_ratio=MULTI_FACE_AMBIGUITY_RATIO  # #claude
        )  # #claude

        # Handle edge cases (no face, multiple faces, etc.)  # #claude
        if preprocess_result['status'] != 'OK':  # #claude
            logger.info(f"Quality check skipped: {preprocess_result['status']} - {preprocess_result['message']}")  # #claude
            inference_time = (time.time() - start_time) * 1000  # #claude
            return jsonify({  # #claude
                'status': preprocess_result['status'],  # #claude
                'quality_score': None,  # #claude
                'quality_level': None,  # #claude
                'threshold_met': False,  # #claude
                'face_confidence': preprocess_result['face_confidence'],  # #claude
                'face_bbox': preprocess_result.get('face_bbox'),  # #claude
                'message': preprocess_result['message'],  # #claude
                'inference_time_ms': round(inference_time, 2)  # #claude
            }), 200  # #claude

        img_tensor = preprocess_result['tensor']  # #claude
        face_confidence = preprocess_result['face_confidence']  # #claude
        face_bbox = preprocess_result['face_bbox']  # #claude

        # Create Triton client - #claude: Use context manager to ensure cleanup
        triton_client = None
        try:
            triton_client = httpclient.InferenceServerClient(
                url=TRITON_URL,
                verbose=False
            )

            # Check if Triton is ready
            if not triton_client.is_server_ready():
                return jsonify({'error': 'Triton server not ready'}), 503

            # Check if model is ready
            if not triton_client.is_model_ready(TRITON_MODEL_NAME, TRITON_MODEL_VERSION):
                return jsonify({'error': f'Model {TRITON_MODEL_NAME} not ready'}), 503

            # Prepare input tensor
            input_tensor = httpclient.InferInput('input', img_tensor.shape, 'FP32')
            input_tensor.set_data_from_numpy(img_tensor)

            # Prepare output
            output = httpclient.InferRequestedOutput('output')

            # Run inference
            response = triton_client.infer(
                model_name=TRITON_MODEL_NAME,
                model_version=TRITON_MODEL_VERSION,
                inputs=[input_tensor],
                outputs=[output]
            )

            # Get quality score
            quality_score = float(response.as_numpy('output')[0][0])

            # Determine quality level
            if quality_score >= 0.7:
                quality_level = 'good'
            elif quality_score >= 0.5:
                quality_level = 'acceptable'
            else:
                quality_level = 'poor'

            inference_time = (time.time() - start_time) * 1000  # Convert to ms

            return jsonify({  # #claude
                'status': 'OK',  # #claude
                'quality_score': round(quality_score, 4),
                'quality_level': quality_level,
                'threshold_met': quality_score >= 0.5,
                'face_confidence': round(face_confidence, 4),  # #claude
                'face_bbox': face_bbox,  # #claude
                'message': 'Face quality assessed successfully',  # #claude
                'inference_time_ms': round(inference_time, 2)
            }), 200

        except Exception as e:
            logger.error(f"Triton inference error: {e}")
            return jsonify({'error': f'Inference failed: {str(e)}'}), 500

        finally:
            # #claude: CRITICAL - Always close the client to prevent connection leak
            if triton_client is not None:
                try:
                    triton_client.close()
                    logger.debug("Triton client closed")
                except:
                    pass  # Ignore close errors

            # #claude: Force garbage collection after quality check to free memory
            del img_tensor
            gc.collect()

    except Exception as e:
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'facial-data-collection-backend',
        'version': '1.0.0'
    }), 200

@app.route('/api/admin/stats', methods=['GET'])  # #claude v48
def get_admin_stats():  # #claude v48
    """  # #claude v48
    Get statistics for all sessions (admin/developer view)  # #claude v48

    Response:  # #claude v48
        {  # #claude v48
            "total_sessions": 10,  # #claude v48
            "total_videos": 78,  # #claude v48
            "total_size_mb": 3450.5,  # #claude v48
            "sessions": [  # #claude v48
                {  # #claude v48
                    "session_id": "...",  # #claude v48
                    "participant_name": "John Doe",  # #claude v48
                    "created_at": "2026-02-02T10:30:00",  # #claude v48
                    "video_count": 3,  # #claude v48
                    "total_size_mb": 105.2,  # #claude v48
                    "status": "complete"  # #claude v48
                }  # #claude v48
            ]  # #claude v48
        }  # #claude v48
    """  # #claude v48
    try:  # #claude v48
        sessions_list = []  # #claude v48
        total_videos = 0  # #claude v48
        total_size_bytes = 0  # #claude v48

        # Iterate through all session directories  # #claude v48
        for session_dir in BASE_DATA_DIR.iterdir():  # #claude v48
            if not session_dir.is_dir():  # #claude v48
                continue  # #claude v48

            session_file = session_dir / 'session.json'  # #claude v48
            if not session_file.exists():  # #claude v48
                continue  # #claude v48

            try:  # #claude v48
                with open(session_file, 'r') as f:  # #claude v48
                    session_data = json.load(f)  # #claude v48

                # Count videos and calculate size  # #claude v48
                video_count = len(session_data.get('videos', []))  # #claude v48
                session_size = 0  # #claude v48

                for video_file in session_dir.glob('*.webm'):  # #claude v48
                    session_size += video_file.stat().st_size  # #claude v48

                sessions_list.append({  # #claude v48
                    'session_id': session_data.get('session_id'),  # #claude v48
                    'participant_name': session_data.get('participant_name', 'Anonymous'),  # #claude v48
                    'created_at': session_data.get('created_at'),  # #claude v48
                    'video_count': video_count,  # #claude v48
                    'total_size_mb': round(session_size / (1024 * 1024), 2),  # #claude v48
                    'status': 'complete' if video_count > 0 else 'in_progress'  # #claude v48
                })  # #claude v48

                total_videos += video_count  # #claude v48
                total_size_bytes += session_size  # #claude v48

            except Exception as e:  # #claude v48
                logger.warning(f"⚠️ Failed to read session {session_dir.name}: {e}")  # #claude v48
                continue  # #claude v48

        # Sort by created_at (newest first)  # #claude v48
        sessions_list.sort(key=lambda x: x['created_at'], reverse=True)  # #claude v48

        return jsonify({  # #claude v48
            'total_sessions': len(sessions_list),  # #claude v48
            'total_videos': total_videos,  # #claude v48
            'total_size_mb': round(total_size_bytes / (1024 * 1024), 2),  # #claude v48
            'sessions': sessions_list  # #claude v48
        }), 200  # #claude v48

    except Exception as e:  # #claude v48
        logger.exception("❌ Failed to get admin stats")  # #claude v48
        return jsonify({'error': str(e)}), 500  # #claude v48

@app.route('/api/log/client', methods=['POST'])  # #claude
def log_client():  # #claude
    """  # #claude v51
    Accept client-side logs from browser for server-side logging  # #claude

    Request body:  # #claude v51
        {  # #claude
            "session_id": "session-uuid",  # #claude v51
            "level": "info|warn|error",  # #claude
            "message": "log message",  # #claude
            "context": {...}  # #claude
        }  # #claude
    """  # #claude
    try:  # #claude
        data = request.get_json()  # #claude
        session_id = data.get('session_id')  # #claude v51
        level = data.get('level', 'info').upper()  # #claude
        message = data.get('message', '')  # #claude
        context = data.get('context', {})  # #claude

        # Format log message with client identifier  # #claude
        client_ip = request.headers.get('X-Real-IP', request.remote_addr)  # #claude
        timestamp = datetime.now().isoformat()  # #claude v51
        log_message = f"[CLIENT {client_ip}] {message}"  # #claude

        # Log to main backend log  # #claude
        if level == 'ERROR':  # #claude
            logger.error(f"🌐 {log_message}")  # #claude
            if context:  # #claude
                logger.error(f"   Context: {context}")  # #claude
        elif level == 'WARN':  # #claude
            logger.warning(f"🌐 {log_message}")  # #claude
            if context:  # #claude
                logger.warning(f"   Context: {context}")  # #claude
        else:  # #claude
            logger.info(f"🌐 {log_message}")  # #claude
            if context:  # #claude
                logger.info(f"   Context: {context}")  # #claude

        # #claude v51: Also store in session-specific log file if session_id provided
        if session_id:  # #claude v51
            # Try camera_tests directory first (for encoder test sessions), then facial_recordings
            session_dir = get_session_dir(session_id, 'encoder_test')  # #claude v51
            video_type = 'encoder_test'  # #claude v74: Track which type we're using

            if not session_dir.exists():
                session_dir = get_session_dir(session_id, 'recording')  # #claude v51
                video_type = 'recording'  # #claude v74

            # #claude v74: Create directory if it doesn't exist (handles race conditions)
            # Client might send logs before session creation completes
            if not session_dir.exists():
                logger.info(f"📋 Creating session dir for logs: {session_dir} (type: {video_type})")
                session_dir.mkdir(parents=True, exist_ok=True)

            log_file = session_dir / 'client.log'  # #claude v51
            log_entry = {  # #claude v51
                'timestamp': timestamp,  # #claude v51
                'level': level,  # #claude v51
                'message': message,  # #claude v51
                'context': context,  # #claude v51
                'client_ip': client_ip  # #claude v51
            }  # #claude v51

            # Append to log file (one JSON object per line)  # #claude v51
            try:  # #claude v51: Add error handling
                with open(log_file, 'a') as f:  # #claude v51
                    f.write(json.dumps(log_entry) + '\n')  # #claude v51
            except Exception as e:  # #claude v51
                logger.error(f"❌ Failed to write client.log to {log_file}: {e}")  # #claude v51
        else:  # #claude v51
            logger.warning(f"⚠️ No session_id in client log request")  # #claude v51

        return jsonify({'status': 'logged'}), 200  # #claude

    except Exception as e:  # #claude
        logger.exception("❌ Failed to process client log")  # #claude
        return jsonify({'error': str(e)}), 500  # #claude

@app.route('/api/log/client/<session_id>', methods=['GET'])  # #claude v51
def get_client_logs(session_id):  # #claude v51
    """  # #claude v51
    Retrieve client-side logs for a specific session  # #claude v51

    Response:  # #claude v51
        {  # #claude v51
            "session_id": "...",  # #claude v51
            "log_count": 42,  # #claude v51
            "logs": [  # #claude v51
                {  # #claude v51
                    "timestamp": "2026-02-02T10:30:00",  # #claude v51
                    "level": "INFO",  # #claude v51
                    "message": "Recording started",  # #claude v51
                    "context": {...}  # #claude v51
                }  # #claude v51
            ]  # #claude v51
        }  # #claude v51
    """  # #claude v51
    try:  # #claude v51
        session_dir = get_session_dir(session_id)  # #claude v51
        log_file = session_dir / 'client.log'  # #claude v51

        if not log_file.exists():  # #claude v51
            return jsonify({  # #claude v51
                'session_id': session_id,  # #claude v51
                'log_count': 0,  # #claude v51
                'logs': []  # #claude v51
            }), 200  # #claude v51

        # Read and parse log file (one JSON object per line)  # #claude v51
        logs = []  # #claude v51
        with open(log_file, 'r') as f:  # #claude v51
            for line in f:  # #claude v51
                line = line.strip()  # #claude v51
                if line:  # #claude v51
                    try:  # #claude v51
                        logs.append(json.loads(line))  # #claude v51
                    except json.JSONDecodeError:  # #claude v51
                        logger.warning(f"⚠️ Failed to parse log line: {line[:50]}")  # #claude v51

        return jsonify({  # #claude v51
            'session_id': session_id,  # #claude v51
            'log_count': len(logs),  # #claude v51
            'logs': logs  # #claude v51
        }), 200  # #claude v51

    except Exception as e:  # #claude v51
        logger.exception(f"❌ Failed to get logs for session {session_id}")  # #claude v51
        return jsonify({'error': str(e)}), 500  # #claude v51

# ============================================================================
# Data Management Routes
# ============================================================================

@app.route('/api/data/clear-all', methods=['POST'])
def clear_all_data():
    """
    Delete ALL recordings and camera tests from the server

    WARNING: This is destructive and cannot be undone!

    Response:
        {
            "status": "success",
            "deleted": {
                "recordings": 123,
                "camera_tests": 45
            }
        }
    """
    try:
        deleted_recordings = 0
        deleted_camera_tests = 0

        # Delete all facial recordings
        if BASE_DATA_DIR.exists():
            for session_dir in BASE_DATA_DIR.iterdir():
                if session_dir.is_dir():
                    shutil.rmtree(session_dir)
                    deleted_recordings += 1
            logger.info(f"🗑️ Deleted {deleted_recordings} recording sessions from {BASE_DATA_DIR}")

        # Delete all camera tests
        if CAMERA_TEST_DIR.exists():
            for session_dir in CAMERA_TEST_DIR.iterdir():
                if session_dir.is_dir():
                    shutil.rmtree(session_dir)
                    deleted_camera_tests += 1
            logger.info(f"🗑️ Deleted {deleted_camera_tests} camera test sessions from {CAMERA_TEST_DIR}")

        return jsonify({
            'status': 'success',
            'deleted': {
                'recordings': deleted_recordings,
                'camera_tests': deleted_camera_tests
            }
        }), 200

    except Exception as e:
        logger.exception("❌ Failed to clear all data")
        return jsonify({'error': str(e)}), 500

# ============================================================================
# Frontend Routes
# ============================================================================

@app.route('/')
def index():
    """Serve the main frontend page"""
    return send_from_directory(app.static_folder, 'test-camera.html')

@app.route('/<path:path>')
def serve_static(path):
    """Serve other static files (CSS, JS, images)"""
    return send_from_directory(app.static_folder, path)

# ============================================================================
# Main
# ============================================================================

if __name__ == '__main__':
    print("=" * 60)
    print("Facial Data Collection + AI Quality - Combined Backend")
    print("=" * 60)
    print(f"Recording data: {BASE_DATA_DIR.absolute()}")
    print(f"Camera tests:   {CAMERA_TEST_DIR.absolute()}")  # #claude
    print(f"Backend (internal): http://localhost:5001") # #claude
    print(f"Triton: localhost:8003 (internal)") # #claude
    print(f"Facial app: https://facestudy.detector-project.eu:8000") # #claude
    print(f"AI app: https://195.251.117.230:8000") # #claude
    print(f"Note: Nginx handles SSL and routes both domains to this Flask app") # #claude
    print("=" * 60)

    # No SSL - nginx handles it # #claude
    # Single Flask app serves both facial and AI endpoints on port 5001 # #claude
    app.run(host='127.0.0.1', port=5001, debug=False, ssl_context=None) # #claude
