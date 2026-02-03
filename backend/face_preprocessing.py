#!/usr/bin/env python3
"""
Face detection and preprocessing for FIQA
Replaces the old direct-resize approach with proper face detection + cropping
"""

import base64
import numpy as np
import cv2
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Configuration (imported from app.py)
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def preprocess_with_face_detection(
    image_data,
    face_detector,
    min_face_ratio=0.12,
    max_padding_ratio=0.10,
    multi_face_ambiguity_ratio=0.35
):
    """
    NEW preprocessing pipeline with face detection for Efficient-FIQA

    Args:
        image_data: Base64-encoded image string
        face_detector: YuNet detector instance
        min_face_ratio: Minimum face size as fraction of frame width
        max_padding_ratio: Maximum acceptable padding ratio
        multi_face_ambiguity_ratio: Threshold for ambiguous multiple faces

    Returns:
        dict with keys:
            - status: "OK" | "NO_FACE" | "MULTIPLE_FACES" | "PARTIAL_FACE" | "FACE_TOO_SMALL"
            - tensor: numpy array (1, 3, 352, 352) if status="OK", else None
            - face_confidence: float (0-1), detector confidence
            - face_bbox: (x, y, w, h) if face found
            - message: human-readable status message
    """
    try:
        # 1. Decode base64 image
        if 'base64,' in image_data:
            image_data = image_data.split('base64,')[1]

        try:
            image_bytes = base64.b64decode(image_data)
        except Exception as e:
            logger.error(f"Base64 decode failed: {e}")
            return {
                'status': 'ERROR',
                'tensor': None,
                'face_confidence': 0.0,
                'message': f'Base64 decode failed: {str(e)}'
            }

        img_array = np.frombuffer(image_bytes, dtype=np.uint8)
        img_bgr = cv2.imdecode(img_array, cv2.IMREAD_COLOR)  # OpenCV uses BGR

        if img_bgr is None:
            logger.error(f"cv2.imdecode failed - image_bytes length: {len(image_bytes)}, first 50 chars of base64: {image_data[:50] if len(image_data) > 50 else image_data}")
            return {
                'status': 'ERROR',
                'tensor': None,
                'face_confidence': 0.0,
                'message': 'Failed to decode image - cv2.imdecode returned None'
            }

        height, width = img_bgr.shape[:2]

        # 2. Detect faces
        face_detector.setInputSize((width, height))
        _, faces = face_detector.detect(img_bgr)

        # 3. Edge case: No face detected
        if faces is None or len(faces) == 0:
            logger.debug("No face detected in frame")
            return {
                'status': 'NO_FACE',
                'tensor': None,
                'face_confidence': 0.0,
                'message': 'No face detected in frame'
            }

        # Parse face results
        detected_faces = []
        for face in faces:
            x, y, w, h = face[:4].astype(int)
            confidence = float(face[14])
            area = w * h
            detected_faces.append({
                'bbox': (x, y, w, h),
                'confidence': confidence,
                'area': area
            })

        # Sort by area (largest first)
        detected_faces.sort(key=lambda f: f['area'], reverse=True)

        # 4. Edge case: Multiple ambiguous faces
        if len(detected_faces) >= 2:
            largest_area = detected_faces[0]['area']
            second_area = detected_faces[1]['area']
            if second_area >= (multi_face_ambiguity_ratio * largest_area):
                logger.debug(f"Multiple ambiguous faces detected: {len(detected_faces)} faces")
                return {
                    'status': 'MULTIPLE_FACES',
                    'tensor': None,
                    'face_confidence': detected_faces[0]['confidence'],
                    'message': f'Multiple faces detected ({len(detected_faces)}), unable to select one'
                }

        # 5. Select best face (largest, most centered)
        best_face = _select_best_face(detected_faces, (width, height))
        x, y, w, h = best_face['bbox']

        # 6. Edge case: Face too small
        if w < width * min_face_ratio:
            logger.debug(f"Face too small: {w}px ({w/width*100:.1f}% of frame width)")
            return {
                'status': 'FACE_TOO_SMALL',
                'tensor': None,
                'face_confidence': best_face['confidence'],
                'face_bbox': (x, y, w, h),
                'message': f'Face too small ({w}px, need >{int(width*min_face_ratio)}px)'
            }

        # 7. Crop face with margin
        crop_result = _square_crop_with_margin(img_bgr, best_face['bbox'], margin_ratio=0.20)
        face_crop = crop_result['crop']
        padding_ratio = crop_result['padding_ratio']

        # 8. Edge case: Too much padding (face at boundary)
        if padding_ratio > max_padding_ratio:
            logger.debug(f"Face too close to boundary: {padding_ratio*100:.1f}% padding")
            return {
                'status': 'PARTIAL_FACE',
                'tensor': None,
                'face_confidence': best_face['confidence'],
                'face_bbox': (x, y, w, h),
                'message': f'Face partially out of frame ({padding_ratio*100:.0f}% padding)'
            }

        # 9. Resize to FIQA input size (352x352)
        face_resized = cv2.resize(face_crop, (352, 352), interpolation=cv2.INTER_LINEAR)

        # 10. Convert BGR to RGB
        face_rgb = cv2.cvtColor(face_resized, cv2.COLOR_BGR2RGB)

        # 11. Normalize to [0, 1]
        face_normalized = face_rgb.astype(np.float32) / 255.0

        # 12. Apply ImageNet normalization
        face_normalized = (face_normalized - IMAGENET_MEAN) / IMAGENET_STD

        # 13. Convert from HWC to CHW format (channels first)
        face_tensor = np.transpose(face_normalized, (2, 0, 1))

        # 14. Add batch dimension
        face_tensor = np.expand_dims(face_tensor, axis=0)

        logger.debug(f"✅ Face preprocessed: conf={best_face['confidence']:.2f}, bbox={best_face['bbox']}, padding={padding_ratio:.2%}")

        return {
            'status': 'OK',
            'tensor': face_tensor,
            'face_confidence': best_face['confidence'],
            'face_bbox': (x, y, w, h),
            'message': 'Face detected and preprocessed successfully'
        }

    except Exception as e:
        logger.exception("Error in face preprocessing pipeline")
        return {
            'status': 'ERROR',
            'tensor': None,
            'face_confidence': 0.0,
            'message': f'Preprocessing error: {str(e)}'
        }


def _select_best_face(faces, img_shape):
    """
    Select the best face for quality assessment
    Prioritizes: center position, size, confidence
    """
    if not faces:
        return None

    height, width = img_shape
    frame_center_x, frame_center_y = width / 2, height / 2

    # Calculate score for each face
    for face in faces:
        x, y, w, h = face['bbox']
        center_x = x + w / 2
        center_y = y + h / 2

        # Distance from frame center (normalized)
        dist_from_center = np.sqrt((center_x - frame_center_x)**2 + (center_y - frame_center_y)**2)
        max_dist = np.sqrt(width**2 + height**2) / 2
        center_weight = 1.0 - (dist_from_center / max_dist)

        # Area normalized
        area_norm = face['area'] / (width * height)

        # Combined score
        face['selection_score'] = area_norm * center_weight * face['confidence']

    # Return face with highest score
    return max(faces, key=lambda f: f['selection_score'])


def _square_crop_with_margin(img_bgr, bbox, margin_ratio=0.20):
    """
    Create a square crop around face bbox with margin

    Args:
        img_bgr: numpy array (BGR)
        bbox: (x, y, w, h)
        margin_ratio: fraction of bbox size to add as margin

    Returns:
        dict with keys:
            - crop: numpy array (BGR, square)
            - padding_ratio: fraction of crop that was padded
    """
    x, y, w, h = bbox
    height, width = img_bgr.shape[:2]

    # Make square: use the larger dimension
    size = max(w, h)

    # Add margin
    margin = int(size * margin_ratio)
    size_with_margin = size + 2 * margin

    # Center the square on the face
    center_x = x + w // 2
    center_y = y + h // 2

    # Calculate crop boundaries
    x1 = center_x - size_with_margin // 2
    y1 = center_y - size_with_margin // 2
    x2 = x1 + size_with_margin
    y2 = y1 + size_with_margin

    # Calculate how much padding is needed
    pad_left = max(0, -x1)
    pad_top = max(0, -y1)
    pad_right = max(0, x2 - width)
    pad_bottom = max(0, y2 - height)

    total_padding = pad_left + pad_top + pad_right + pad_bottom
    padding_ratio = total_padding / (4 * size_with_margin)

    # Clamp coordinates to image bounds
    x1_clamped = max(0, x1)
    y1_clamped = max(0, y1)
    x2_clamped = min(width, x2)
    y2_clamped = min(height, y2)

    # Extract crop
    crop = img_bgr[y1_clamped:y2_clamped, x1_clamped:x2_clamped]

    # Add padding if necessary (reflection padding looks more natural)
    if total_padding > 0:
        crop = cv2.copyMakeBorder(
            crop,
            pad_top, pad_bottom, pad_left, pad_right,
            cv2.BORDER_REFLECT_101
        )

    return {
        'crop': crop,
        'padding_ratio': padding_ratio
    }