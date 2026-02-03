#!/usr/bin/env python3
"""
Test script for face detection and preprocessing pipeline
"""

import cv2
import numpy as np
from pathlib import Path
import base64

# Import the face detection functions
from face_preprocessing import preprocess_with_face_detection

def test_with_demo_image():
    """Test with the demo image from Efficient-FIQA"""

    # Load demo image
    demo_image_path = Path(__file__).parent.parent / 'ai-models' / 'Efficient-FIQA' / 'demo_images' / 'z06399.png'

    if not demo_image_path.exists():
        print(f"❌ Demo image not found: {demo_image_path}")
        return

    # Read and encode to base64
    with open(demo_image_path, 'rb') as f:
        img_bytes = f.read()
    img_base64 = base64.b64encode(img_bytes).decode('utf-8')
    img_data = f"data:image/png;base64,{img_base64}"

    print(f"Testing with demo image: {demo_image_path.name}")
    print(f"Image size: {len(img_bytes)} bytes")

    # Initialize detector
    detector_path = Path(__file__).parent.parent / 'ai-models' / 'yunet' / 'face_detection_yunet_2023mar.onnx'
    if not detector_path.exists():
        print(f"❌ Detector not found: {detector_path}")
        return

    detector = cv2.FaceDetectorYN.create(
        str(detector_path),
        "",
        (320, 320),
        0.6,
        0.3
    )
    print(f"✅ Detector initialized: {detector_path.name}")

    # Run preprocessing
    print("\n🔍 Running face detection and preprocessing...")
    result = preprocess_with_face_detection(img_data, detector)

    # Display results
    print(f"\n📊 Results:")
    print(f"  Status: {result['status']}")
    print(f"  Message: {result['message']}")
    print(f"  Face Confidence: {result['face_confidence']:.4f}")

    if result['status'] == 'OK':
        print(f"  Face BBox: {result['face_bbox']}")
        print(f"  Tensor Shape: {result['tensor'].shape}")
        print(f"  Tensor Min: {result['tensor'].min():.4f}")
        print(f"  Tensor Max: {result['tensor'].max():.4f}")
        print(f"  Tensor Mean: {result['tensor'].mean():.4f}")
        print(f"\n✅ SUCCESS: Face detected and preprocessed correctly!")
    else:
        print(f"\n⚠️  Edge case handled: {result['status']}")

    return result

def test_with_no_face():
    """Test with an image that has no face (solid color)"""

    print("\n" + "="*60)
    print("Test 2: Image with NO face (should return NO_FACE)")
    print("="*60)

    # Create a blank image
    blank_img = np.zeros((480, 640, 3), dtype=np.uint8)
    blank_img[:] = (100, 150, 200)  # Solid color

    # Encode to base64
    _, buffer = cv2.imencode('.png', blank_img)
    img_base64 = base64.b64encode(buffer).decode('utf-8')
    img_data = f"data:image/png;base64,{img_base64}"

    # Initialize detector
    detector_path = Path(__file__).parent.parent / 'ai-models' / 'yunet' / 'face_detection_yunet_2023mar.onnx'
    detector = cv2.FaceDetectorYN.create(str(detector_path), "", (320, 320), 0.6, 0.3)

    # Run preprocessing
    result = preprocess_with_face_detection(img_data, detector)

    print(f"Status: {result['status']}")
    print(f"Message: {result['message']}")

    if result['status'] == 'NO_FACE':
        print("✅ Correctly detected NO_FACE")
    else:
        print(f"❌ Expected NO_FACE, got {result['status']}")

    return result

if __name__ == '__main__':
    print("="*60)
    print("Face Detection & Preprocessing Pipeline Test")
    print("="*60)

    # Test 1: Real face
    print("\nTest 1: Demo image with face (should return OK)")
    print("="*60)
    result1 = test_with_demo_image()

    # Test 2: No face
    result2 = test_with_no_face()

    print("\n" + "="*60)
    print("Tests Complete")
    print("="*60)