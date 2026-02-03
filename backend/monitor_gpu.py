#!/usr/bin/env python3
"""
Real-time GPU monitoring for Triton AI inference
Tracks GPU utilization, memory usage, temperature, and Triton metrics
"""

import subprocess
import time
import requests
from datetime import datetime
import sys

def get_gpu_stats():
    """Get current GPU statistics using nvidia-smi"""
    try:
        result = subprocess.run([
            'nvidia-smi',
            '--query-gpu=utilization.gpu,utilization.memory,memory.used,memory.total,temperature.gpu,power.draw',
            '--format=csv,noheader,nounits'
        ], capture_output=True, text=True, check=True)

        gpu_util, mem_util, mem_used, mem_total, temp, power = result.stdout.strip().split(', ')

        return {
            'gpu_util': int(gpu_util),
            'mem_util': int(mem_util),
            'mem_used': int(mem_used),
            'mem_total': int(mem_total),
            'temperature': int(temp),
            'power_draw': float(power)
        }
    except Exception as e:
        print(f"Error getting GPU stats: {e}")
        return None

def get_triton_metrics():
    """Get Triton inference server metrics"""
    try:
        response = requests.get('http://localhost:8002/metrics', timeout=2)
        if response.status_code == 200:
            metrics = {}
            for line in response.text.split('\n'):
                if 'nv_inference_request_success' in line and not line.startswith('#'):
                    parts = line.split()
                    if len(parts) >= 2:
                        metrics['total_requests'] = int(float(parts[-1]))
                elif 'nv_inference_request_failure' in line and not line.startswith('#'):
                    parts = line.split()
                    if len(parts) >= 2:
                        metrics['failed_requests'] = int(float(parts[-1]))
                elif 'nv_inference_queue_duration_us' in line and 'sum' in line and not line.startswith('#'):
                    parts = line.split()
                    if len(parts) >= 2:
                        metrics['total_queue_time_us'] = int(float(parts[-1]))
                elif 'nv_inference_compute_infer_duration_us' in line and 'sum' in line and not line.startswith('#'):
                    parts = line.split()
                    if len(parts) >= 2:
                        metrics['total_compute_time_us'] = int(float(parts[-1]))
            return metrics
        return None
    except Exception as e:
        return None

def print_header():
    """Print monitoring header"""
    print("=" * 100)
    print("GPU MONITORING - Facial App AI Quality System")
    print("=" * 100)
    print(f"{'Time':<12} {'GPU%':<6} {'Mem%':<6} {'MemUsed':<10} {'Temp':<6} {'Power':<8} {'Requests':<10} {'QueueMs':<10} {'InferMs':<10}")
    print("-" * 100)

def print_stats(gpu_stats, triton_metrics, prev_triton=None):
    """Print current statistics"""
    timestamp = datetime.now().strftime("%H:%M:%S")

    if gpu_stats:
        gpu_str = f"{gpu_stats['gpu_util']}%"
        mem_str = f"{gpu_stats['mem_util']}%"
        mem_used_str = f"{gpu_stats['mem_used']}MB"
        temp_str = f"{gpu_stats['temperature']}°C"
        power_str = f"{gpu_stats['power_draw']:.1f}W"
    else:
        gpu_str = mem_str = mem_used_str = temp_str = power_str = "N/A"

    if triton_metrics and prev_triton:
        # Calculate delta
        req_delta = triton_metrics.get('total_requests', 0) - prev_triton.get('total_requests', 0)

        if req_delta > 0 and 'total_queue_time_us' in triton_metrics and 'total_queue_time_us' in prev_triton:
            queue_delta = triton_metrics['total_queue_time_us'] - prev_triton['total_queue_time_us']
            compute_delta = triton_metrics['total_compute_time_us'] - prev_triton['total_compute_time_us']

            avg_queue_ms = (queue_delta / req_delta) / 1000
            avg_infer_ms = (compute_delta / req_delta) / 1000

            req_str = f"+{req_delta}"
            queue_str = f"{avg_queue_ms:.2f}ms"
            infer_str = f"{avg_infer_ms:.2f}ms"
        else:
            req_str = "0"
            queue_str = "-"
            infer_str = "-"
    else:
        req_str = queue_str = infer_str = "-"

    print(f"{timestamp:<12} {gpu_str:<6} {mem_str:<6} {mem_used_str:<10} {temp_str:<6} {power_str:<8} {req_str:<10} {queue_str:<10} {infer_str:<10}")

def main():
    """Main monitoring loop"""
    print_header()

    prev_triton = None

    try:
        while True:
            gpu_stats = get_gpu_stats()
            triton_metrics = get_triton_metrics()

            print_stats(gpu_stats, triton_metrics, prev_triton)

            prev_triton = triton_metrics.copy() if triton_metrics else None

            time.sleep(1)  # Update every second

    except KeyboardInterrupt:
        print("\n" + "=" * 100)
        print("Monitoring stopped by user")
        print("=" * 100)
        sys.exit(0)

if __name__ == '__main__':
    main()
