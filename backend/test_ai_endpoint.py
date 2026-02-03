#!/usr/bin/env python3
"""
Test script for AI quality endpoint
Creates a simple test image and sends it to the backend
"""

import base64
import requests
from PIL import Image
import io
import sys

# Create a test image (352x352 with gradient)
print("📸 Creating test image (352x352)...")
img = Image.new('RGB', (352, 352))
pixels = img.load()

# Create a gradient pattern
for y in range(352):
    for x in range(352):
        r = int((x / 352) * 255)
        g = int((y / 352) * 255)
        b = 128
        pixels[x, y] = (r, g, b)

# Convert to base64
buffer = io.BytesIO()
img.save(buffer, format='JPEG', quality=95)
img_str = base64.b64encode(buffer.getvalue()).decode()
data_url = f'data:image/jpeg;base64,{img_str}'

print(f"✅ Test image created ({len(img_str)} bytes)")

# Test endpoint
print("\n🔄 Sending request to backend...")
try:
    response = requests.post(
        'http://localhost:5001/api/quality/check',
        json={'image': data_url},
        timeout=30
    )

    print(f"📊 Response Status: {response.status_code}")

    if response.status_code == 200:
        result = response.json()
        print("\n✅ Success! AI Quality Check Results:")
        print(f"   Quality Score: {result['quality_score']}")
        print(f"   Quality Level: {result['quality_level']}")
        print(f"   Threshold Met: {result['threshold_met']}")
        print(f"   Inference Time: {result['inference_time_ms']}ms")

        # Verify performance
        if result['inference_time_ms'] < 50:
            print(f"\n🚀 Performance: EXCELLENT (< 50ms)")
        elif result['inference_time_ms'] < 100:
            print(f"\n✓ Performance: GOOD (< 100ms)")
        else:
            print(f"\n⚠️  Performance: Acceptable but could be better")

        sys.exit(0)
    else:
        print(f"\n❌ Error: HTTP {response.status_code}")
        print(f"Response: {response.text}")
        sys.exit(1)

except requests.exceptions.ConnectionError:
    print("\n❌ Error: Could not connect to backend")
    print("Make sure Flask server is running on http://localhost:5001")
    sys.exit(1)
except Exception as e:
    print(f"\n❌ Error: {e}")
    sys.exit(1)