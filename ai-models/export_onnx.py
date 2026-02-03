#!/usr/bin/env python3
"""
Export Efficient-FIQA Student Model to ONNX format

This script only handles PyTorch → ONNX conversion.
The ONNX → TensorRT conversion will be done using Docker with trtexec.
"""

import os
import sys
import torch

# Add Efficient-FIQA to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'Efficient-FIQA'))
from models.FIQA_model import FIQA_EdgeNeXt_XXS


def main():
    checkpoint_path = 'Efficient-FIQA/ckpts/EdgeNeXt_XXS_checkpoint.pt'
    onnx_path = 'efficient_fiqa_student.onnx'

    print("=" * 70)
    print("  Exporting Efficient-FIQA Student Model to ONNX")
    print("=" * 70)

    # Load PyTorch model
    print(f"\n📦 Loading PyTorch model from: {checkpoint_path}")
    model = FIQA_EdgeNeXt_XXS(is_pretrained=False)
    state_dict = torch.load(checkpoint_path, map_location='cpu')
    model.load_state_dict(state_dict)
    model.eval()

    num_params = sum(p.numel() for p in model.parameters()) / 1e6
    print(f"✅ Model loaded successfully ({num_params:.2f}M parameters)")

    # Create dummy input
    dummy_input = torch.randn(1, 3, 352, 352)

    # Test inference
    print(f"\n🧪 Testing PyTorch inference...")
    with torch.no_grad():
        output = model(dummy_input)
    print(f"✅ Test output: {output.item():.4f}")

    # Export to ONNX
    print(f"\n🔄 Exporting to ONNX: {onnx_path}")
    print(f"   Input shape: [batch_size, 3, 352, 352]")
    print(f"   Output shape: [batch_size, 1]")
    print(f"   Dynamic axes: batch_size (1-16)")

    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        input_names=['input'],
        output_names=['output'],
        dynamic_axes={
            'input': {0: 'batch_size'},
            'output': {0: 'batch_size'}
        },
        opset_version=17,
        do_constant_folding=True,
        verbose=False,
        export_params=True
    )

    print(f"✅ ONNX export successful!")
    print(f"   File: {onnx_path}")
    print(f"   Size: {os.path.getsize(onnx_path) / 1024 / 1024:.2f} MB")

    print("\n" + "=" * 70)
    print("✅ ONNX export complete!")
    print("=" * 70)
    print(f"\nNext step: Convert ONNX to TensorRT using Docker")
    print(f"  docker run --rm --gpus all \\")
    print(f"    -v $(pwd):/workspace \\")
    print(f"    nvcr.io/nvidia/tensorrt:24.01-py3 \\")
    print(f"    trtexec --onnx=/workspace/{onnx_path} \\")
    print(f"            --saveEngine=/workspace/model.plan \\")
    print(f"            --fp16 \\")
    print(f"            --minShapes=input:1x3x352x352 \\")
    print(f"            --optShapes=input:8x3x352x352 \\")
    print(f"            --maxShapes=input:16x3x352x352")


if __name__ == '__main__':
    main()
