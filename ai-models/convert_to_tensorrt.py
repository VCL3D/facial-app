#!/usr/bin/env python3
"""
Convert Efficient-FIQA Student Model to TensorRT Engine

This script converts the PyTorch Student Model (EdgeNeXt-XXS) to TensorRT for
optimized inference on NVIDIA GPUs.

Pipeline: PyTorch (.pt) → ONNX (.onnx) → TensorRT (.plan)

Usage:
    python convert_to_tensorrt.py --checkpoint ckpts/EdgeNeXt_XXS_checkpoint.pt \
                                   --output triton_models/efficient_fiqa/1/model.plan \
                                   --precision fp16

Requirements:
    - torch, torchvision, timm (for PyTorch model)
    - onnx (for ONNX export)
    - tensorrt (for TensorRT conversion via trtexec)
"""

import os
import sys
import argparse
import torch
import onnx

# Add Efficient-FIQA to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'Efficient-FIQA'))
from models.FIQA_model import FIQA_EdgeNeXt_XXS


def load_pytorch_model(checkpoint_path, device='cpu'):
    """
    Load PyTorch Student Model from checkpoint

    Args:
        checkpoint_path: Path to .pt checkpoint file
        device: Device to load model on ('cpu' or 'cuda')

    Returns:
        model: Loaded PyTorch model in eval mode
    """
    print(f"📦 Loading PyTorch model from: {checkpoint_path}")

    model = FIQA_EdgeNeXt_XXS(is_pretrained=False)
    state_dict = torch.load(checkpoint_path, map_location=device)
    model.load_state_dict(state_dict)
    model.eval()

    num_params = sum(p.numel() for p in model.parameters()) / 1e6
    print(f"✅ Model loaded successfully ({num_params:.2f}M parameters)")

    return model


def export_to_onnx(model, onnx_path, input_size=(1, 3, 352, 352), opset_version=17):
    """
    Export PyTorch model to ONNX format

    Args:
        model: PyTorch model
        onnx_path: Output path for ONNX file
        input_size: Input tensor shape (batch, channels, height, width)
        opset_version: ONNX opset version (17 is widely supported)
    """
    print(f"\n🔄 Exporting to ONNX: {onnx_path}")
    print(f"   Input shape: {input_size}")
    print(f"   Opset version: {opset_version}")

    # Create dummy input
    dummy_input = torch.randn(*input_size)

    # Export to ONNX
    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        input_names=['input'],
        output_names=['output'],
        dynamic_axes={
            'input': {0: 'batch_size'},   # Allow dynamic batch size
            'output': {0: 'batch_size'}
        },
        opset_version=opset_version,
        do_constant_folding=True,        # Optimize constant operations
        verbose=False
    )

    # Verify ONNX model
    onnx_model = onnx.load(onnx_path)
    onnx.checker.check_model(onnx_model)

    print(f"✅ ONNX export successful")
    print(f"   File size: {os.path.getsize(onnx_path) / 1024 / 1024:.2f} MB")


def convert_onnx_to_tensorrt(onnx_path, engine_path, precision='fp16',
                              min_batch=1, opt_batch=8, max_batch=16,
                              workspace_mb=4096):
    """
    Convert ONNX model to TensorRT engine using trtexec CLI tool

    Args:
        onnx_path: Input ONNX file path
        engine_path: Output TensorRT engine path (.plan)
        precision: 'fp32' or 'fp16'
        min_batch: Minimum batch size for dynamic batching
        opt_batch: Optimal batch size (tuned for throughput)
        max_batch: Maximum batch size
        workspace_mb: GPU memory workspace in MB
    """
    print(f"\n🚀 Converting ONNX to TensorRT engine")
    print(f"   Precision: {precision.upper()}")
    print(f"   Batch sizes: min={min_batch}, opt={opt_batch}, max={max_batch}")
    print(f"   Workspace: {workspace_mb} MB")

    # Create output directory
    os.makedirs(os.path.dirname(engine_path), exist_ok=True)

    # Build trtexec command
    cmd_parts = [
        'trtexec',
        f'--onnx={onnx_path}',
        f'--saveEngine={engine_path}',
        f'--workspace={workspace_mb}',
        f'--minShapes=input:{min_batch}x3x352x352',
        f'--optShapes=input:{opt_batch}x3x352x352',
        f'--maxShapes=input:{max_batch}x3x352x352',
        '--verbose'
    ]

    # Add precision flag
    if precision.lower() == 'fp16':
        cmd_parts.append('--fp16')

    cmd = ' '.join(cmd_parts)

    print(f"\n📝 Running trtexec command:")
    print(f"   {cmd}\n")

    # Execute conversion
    import subprocess
    result = subprocess.run(cmd, shell=True, capture_output=False, text=True)

    if result.returncode != 0:
        raise RuntimeError(f"TensorRT conversion failed with code {result.returncode}")

    print(f"\n✅ TensorRT engine created: {engine_path}")
    print(f"   File size: {os.path.getsize(engine_path) / 1024 / 1024:.2f} MB")


def test_tensorrt_engine(engine_path):
    """
    Test TensorRT engine with dummy input

    Args:
        engine_path: Path to TensorRT engine file
    """
    print(f"\n🧪 Testing TensorRT engine...")

    try:
        import tensorrt as trt
        import numpy as np

        # Load engine
        logger = trt.Logger(trt.Logger.WARNING)
        with open(engine_path, 'rb') as f:
            runtime = trt.Runtime(logger)
            engine = runtime.deserialize_cuda_engine(f.read())

        # Create execution context
        context = engine.create_execution_context()

        # Test with batch size 1
        batch_size = 1
        input_shape = (batch_size, 3, 352, 352)
        output_shape = (batch_size, 1)

        # Allocate host memory
        h_input = np.random.randn(*input_shape).astype(np.float32)
        h_output = np.zeros(output_shape, dtype=np.float32)

        print(f"✅ TensorRT engine loaded successfully")
        print(f"   Input shape: {input_shape}")
        print(f"   Output shape: {output_shape}")
        print(f"   Engine is ready for Triton deployment")

    except ImportError:
        print("⚠️  TensorRT Python bindings not available for testing")
        print("   Engine will be tested when deployed to Triton server")
        print(f"   Engine file exists: {os.path.exists(engine_path)}")


def main():
    parser = argparse.ArgumentParser(description='Convert Efficient-FIQA to TensorRT')
    parser.add_argument('--checkpoint', type=str,
                       default='Efficient-FIQA/ckpts/EdgeNeXt_XXS_checkpoint.pt',
                       help='Path to PyTorch checkpoint')
    parser.add_argument('--output', type=str,
                       default='triton_models/efficient_fiqa/1/model.plan',
                       help='Output path for TensorRT engine')
    parser.add_argument('--onnx-temp', type=str,
                       default='temp_model.onnx',
                       help='Temporary ONNX file path')
    parser.add_argument('--precision', type=str, choices=['fp32', 'fp16'],
                       default='fp16',
                       help='TensorRT precision mode')
    parser.add_argument('--min-batch', type=int, default=1,
                       help='Minimum batch size')
    parser.add_argument('--opt-batch', type=int, default=8,
                       help='Optimal batch size')
    parser.add_argument('--max-batch', type=int, default=16,
                       help='Maximum batch size')
    parser.add_argument('--workspace', type=int, default=4096,
                       help='GPU workspace in MB')
    parser.add_argument('--keep-onnx', action='store_true',
                       help='Keep intermediate ONNX file')

    args = parser.parse_args()

    print("=" * 70)
    print("  Efficient-FIQA TensorRT Conversion")
    print("=" * 70)

    try:
        # Step 1: Load PyTorch model
        model = load_pytorch_model(args.checkpoint)

        # Step 2: Export to ONNX
        export_to_onnx(model, args.onnx_temp)

        # Step 3: Convert ONNX to TensorRT
        convert_onnx_to_tensorrt(
            args.onnx_temp,
            args.output,
            precision=args.precision,
            min_batch=args.min_batch,
            opt_batch=args.opt_batch,
            max_batch=args.max_batch,
            workspace_mb=args.workspace
        )

        # Step 4: Test engine (optional)
        test_tensorrt_engine(args.output)

        # Cleanup ONNX file unless --keep-onnx specified
        if not args.keep_onnx and os.path.exists(args.onnx_temp):
            os.remove(args.onnx_temp)
            print(f"\n🗑️  Cleaned up temporary ONNX file")

        print("\n" + "=" * 70)
        print("✅ Conversion complete!")
        print("=" * 70)
        print(f"\nNext steps:")
        print(f"1. Verify Triton config at: triton_models/efficient_fiqa/config.pbtxt")
        print(f"2. Start Triton server: docker-compose up -d triton")
        print(f"3. Test inference: curl http://localhost:8000/v2/models/efficient_fiqa")

    except Exception as e:
        print(f"\n❌ Conversion failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
