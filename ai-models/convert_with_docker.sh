#!/bin/bash
#
# Convert Efficient-FIQA Student Model to TensorRT using Docker
#
# This script uses NVIDIA's PyTorch container which has all dependencies
# (PyTorch, ONNX, TensorRT) pre-installed.
#

set -e

echo "======================================================================"
echo "  Efficient-FIQA: PyTorch → ONNX → TensorRT Conversion"
echo "======================================================================"

# Configuration
CHECKPOINT="Efficient-FIQA/ckpts/EdgeNeXt_XXS_checkpoint.pt"
ONNX_FILE="efficient_fiqa_student.onnx"
ENGINE_FILE="triton_models/efficient_fiqa/1/model.plan"
WORKSPACE_DIR="$(pwd)"

echo ""
echo "📁 Working directory: $WORKSPACE_DIR"
echo "📦 Checkpoint: $CHECKPOINT"
echo "🔄 ONNX output: $ONNX_FILE"
echo "🚀 TensorRT engine: $ENGINE_FILE"
echo ""

# Step 1: Export PyTorch to ONNX inside Docker
echo "======================================================================"
echo "Step 1/2: Exporting PyTorch model to ONNX"
echo "======================================================================"

docker run --rm --gpus all \
    -v "$WORKSPACE_DIR":/workspace \
    -w /workspace \
    nvcr.io/nvidia/pytorch:24.01-py3 \
    bash -c "
set -e
echo '📦 Installing timm...'
pip install -q timm==1.0.19

echo '📦 Loading PyTorch model...'
python3 <<'PYTHON_EOF'
import os
import sys
import torch

# Add model path
sys.path.insert(0, 'Efficient-FIQA')
from models.FIQA_model import FIQA_EdgeNeXt_XXS

# Load model
print('Loading checkpoint...')
model = FIQA_EdgeNeXt_XXS(is_pretrained=False)
state_dict = torch.load('$CHECKPOINT', map_location='cpu')
model.load_state_dict(state_dict)
model.eval()

print(f'✅ Model loaded: {sum(p.numel() for p in model.parameters()) / 1e6:.2f}M parameters')

# Test inference
dummy_input = torch.randn(1, 3, 352, 352)
with torch.no_grad():
    output = model(dummy_input)
print(f'✅ Test inference: {output.item():.4f}')

# Export to ONNX
print('Exporting to ONNX...')
torch.onnx.export(
    model,
    dummy_input,
    '$ONNX_FILE',
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

print(f'✅ ONNX export complete: $ONNX_FILE')
import os
print(f'   Size: {os.path.getsize(\"$ONNX_FILE\") / 1024 / 1024:.2f} MB')
PYTHON_EOF
"

if [ ! -f "$ONNX_FILE" ]; then
    echo "❌ Error: ONNX export failed"
    exit 1
fi

echo ""
echo "✅ Step 1 complete: ONNX file created"
echo ""

# Step 2: Convert ONNX to TensorRT
echo "======================================================================"
echo "Step 2/2: Converting ONNX to TensorRT Engine"
echo "======================================================================"

# Create output directory
mkdir -p "$(dirname $ENGINE_FILE)"

docker run --rm --gpus all \
    -v "$WORKSPACE_DIR":/workspace \
    -w /workspace \
    nvcr.io/nvidia/tensorrt:24.01-py3 \
    trtexec \
        --onnx="$ONNX_FILE" \
        --saveEngine="$ENGINE_FILE" \
        --fp16 \
        --workspace=4096 \
        --minShapes=input:1x3x352x352 \
        --optShapes=input:8x3x352x352 \
        --maxShapes=input:16x3x352x352 \
        --verbose \
        --dumpLayerInfo \
        --exportLayerInfo=tensorrt_layer_info.json

if [ ! -f "$ENGINE_FILE" ]; then
    echo "❌ Error: TensorRT conversion failed"
    exit 1
fi

echo ""
echo "======================================================================"
echo "✅ Conversion Complete!"
echo "======================================================================"
echo ""
echo "📊 Output files:"
echo "   - ONNX model: $ONNX_FILE ($(du -h $ONNX_FILE | cut -f1))"
echo "   - TensorRT engine: $ENGINE_FILE ($(du -h $ENGINE_FILE | cut -f1))"
echo ""
echo "📝 Next steps:"
echo "   1. Create Triton config: triton_models/efficient_fiqa/config.pbtxt"
echo "   2. Start Triton server: docker-compose up -d triton"
echo "   3. Test inference: curl http://localhost:8000/v2/models/efficient_fiqa"
echo ""
