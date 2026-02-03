#!/usr/bin/env python3
"""
Stress test for AI quality endpoint
Simulates multiple concurrent users making quality check requests
"""

import asyncio
import aiohttp
import time
import base64
import io
import sys
from PIL import Image
import numpy as np
from datetime import datetime
import statistics

# Configuration
BACKEND_URL = 'https://localhost:8000'
ENDPOINT = '/api/quality/check'

def create_test_image(seed=None):
    """
    Create a realistic test face image (352x352)
    Uses gradient pattern to simulate face-like features
    """
    if seed is not None:
        np.random.seed(seed)

    # Create 352x352 image with gradient (similar to a face)
    img = Image.new('RGB', (352, 352))
    pixels = img.load()

    # Create radial gradient (simulates lighting on face)
    center_x, center_y = 176, 176
    max_distance = 176

    for y in range(352):
        for x in range(352):
            # Distance from center
            dx = x - center_x
            dy = y - center_y
            distance = np.sqrt(dx*dx + dy*dy)

            # Radial gradient (brighter in center, darker at edges)
            brightness = max(0, 1 - (distance / max_distance))

            # Add some color variation
            r = int(brightness * 200 + np.random.randint(-20, 20))
            g = int(brightness * 180 + np.random.randint(-20, 20))
            b = int(brightness * 160 + np.random.randint(-20, 20))

            # Clamp values
            r = max(0, min(255, r))
            g = max(0, min(255, g))
            b = max(0, min(255, b))

            pixels[x, y] = (r, g, b)

    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG', quality=85)
    img_bytes = buffer.getvalue()
    img_str = base64.b64encode(img_bytes).decode()
    data_url = f'data:image/jpeg;base64,{img_str}'

    return data_url, len(img_bytes)

async def send_quality_check(session, user_id, image_data, semaphore):
    """Send a single quality check request"""
    async with semaphore:
        start_time = time.time()

        try:
            async with session.post(
                f'{BACKEND_URL}{ENDPOINT}',
                json={'image': image_data},
                ssl=False  # Disable SSL verification for self-signed cert
            ) as response:
                elapsed = (time.time() - start_time) * 1000  # Convert to ms

                if response.status == 200:
                    result = await response.json()
                    return {
                        'user_id': user_id,
                        'status': 'success',
                        'elapsed_ms': elapsed,
                        'quality_score': result.get('quality_score', 0),
                        'inference_time_ms': result.get('inference_time_ms', 0)
                    }
                else:
                    return {
                        'user_id': user_id,
                        'status': 'error',
                        'elapsed_ms': elapsed,
                        'error': f'HTTP {response.status}'
                    }

        except Exception as e:
            elapsed = (time.time() - start_time) * 1000
            return {
                'user_id': user_id,
                'status': 'error',
                'elapsed_ms': elapsed,
                'error': str(e)
            }

async def run_stress_test(num_users, requests_per_user=1):
    """
    Run stress test with specified number of concurrent users

    Args:
        num_users: Number of concurrent users to simulate
        requests_per_user: Number of requests each user sends
    """
    print("=" * 80)
    print(f"STRESS TEST - {num_users} Concurrent Users")
    print("=" * 80)

    # Create test images (one per user to simulate different faces)
    print(f"📸 Creating {num_users} test images...")
    test_images = []
    total_bytes = 0

    for i in range(num_users):
        image_data, size = create_test_image(seed=i)
        test_images.append(image_data)
        total_bytes += size

    print(f"✅ Created {num_users} images ({total_bytes / 1024 / 1024:.2f} MB total)")

    # Create semaphore to limit concurrent connections
    # Allow up to num_users concurrent requests
    semaphore = asyncio.Semaphore(num_users)

    # Create all tasks
    tasks = []
    connector = aiohttp.TCPConnector(limit=num_users)

    async with aiohttp.ClientSession(connector=connector) as session:
        print(f"\n🚀 Sending {num_users * requests_per_user} requests...")
        start_time = time.time()

        for user_id in range(num_users):
            for _ in range(requests_per_user):
                image_data = test_images[user_id % len(test_images)]
                task = send_quality_check(session, user_id, image_data, semaphore)
                tasks.append(task)

        # Execute all tasks concurrently
        results = await asyncio.gather(*tasks)

        total_elapsed = time.time() - start_time

    # Analyze results
    print("\n" + "=" * 80)
    print("RESULTS")
    print("=" * 80)

    successful = [r for r in results if r['status'] == 'success']
    failed = [r for r in results if r['status'] == 'error']

    print(f"\n📊 Summary:")
    print(f"   Total Requests: {len(results)}")
    print(f"   Successful: {len(successful)} ({len(successful)/len(results)*100:.1f}%)")
    print(f"   Failed: {len(failed)} ({len(failed)/len(results)*100:.1f}%)")
    print(f"   Total Time: {total_elapsed:.2f}s")
    print(f"   Throughput: {len(results)/total_elapsed:.1f} requests/second")

    if successful:
        # Response time statistics
        response_times = [r['elapsed_ms'] for r in successful]
        inference_times = [r['inference_time_ms'] for r in successful]
        quality_scores = [r['quality_score'] for r in successful]

        print(f"\n⏱️  Response Times (E2E):")
        print(f"   Min: {min(response_times):.2f}ms")
        print(f"   Max: {max(response_times):.2f}ms")
        print(f"   Mean: {statistics.mean(response_times):.2f}ms")
        print(f"   Median: {statistics.median(response_times):.2f}ms")
        if len(response_times) > 1:
            print(f"   Std Dev: {statistics.stdev(response_times):.2f}ms")

        print(f"\n🤖 AI Inference Times (GPU only):")
        print(f"   Min: {min(inference_times):.2f}ms")
        print(f"   Max: {max(inference_times):.2f}ms")
        print(f"   Mean: {statistics.mean(inference_times):.2f}ms")
        print(f"   Median: {statistics.median(inference_times):.2f}ms")
        if len(inference_times) > 1:
            print(f"   Std Dev: {statistics.stdev(inference_times):.2f}ms")

        print(f"\n📈 Quality Scores:")
        print(f"   Min: {min(quality_scores):.4f}")
        print(f"   Max: {max(quality_scores):.4f}")
        print(f"   Mean: {statistics.mean(quality_scores):.4f}")

    if failed:
        print(f"\n❌ Failed Requests:")
        error_counts = {}
        for r in failed:
            error = r.get('error', 'Unknown')
            error_counts[error] = error_counts.get(error, 0) + 1

        for error, count in sorted(error_counts.items(), key=lambda x: x[1], reverse=True):
            print(f"   {error}: {count}")

    print("\n" + "=" * 80)

async def run_progressive_test():
    """
    Run progressive stress test: 10, 25, 50, 100 users
    """
    test_levels = [10, 25, 50, 100]

    print("\n" + "=" * 80)
    print("PROGRESSIVE STRESS TEST")
    print("=" * 80)
    print(f"Testing with: {', '.join(map(str, test_levels))} concurrent users")
    print("=" * 80)

    for num_users in test_levels:
        await run_stress_test(num_users, requests_per_user=1)
        print("\n⏸️  Waiting 5 seconds before next test...")
        await asyncio.sleep(5)

    print("\n" + "=" * 80)
    print("✅ ALL TESTS COMPLETE")
    print("=" * 80)

def main():
    """Main entry point"""
    if len(sys.argv) > 1:
        try:
            num_users = int(sys.argv[1])
            print(f"Running stress test with {num_users} concurrent users...")
            asyncio.run(run_stress_test(num_users))
        except ValueError:
            print("Usage: python3 stress_test.py [num_users]")
            print("Example: python3 stress_test.py 100")
            sys.exit(1)
    else:
        print("Running progressive stress test (10, 25, 50, 100 users)...")
        asyncio.run(run_progressive_test())

if __name__ == '__main__':
    main()
