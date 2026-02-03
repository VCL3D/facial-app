# Install NVIDIA Container Toolkit for Docker GPU Access

The TensorRT conversion requires Docker to have GPU access. You need to install nvidia-container-toolkit.

## Installation Steps

Run these commands in your terminal:

```bash
# 1. Add NVIDIA Container Toolkit repository
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

# 2. Update package list
sudo apt-get update

# 3. Install nvidia-container-toolkit
sudo apt-get install -y nvidia-container-toolkit

# 4. Configure Docker to use nvidia runtime
sudo nvidia-ctk runtime configure --runtime=docker

# 5. Restart Docker daemon
sudo systemctl restart docker

# 6. Test GPU access in Docker
docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi
```

## Expected Output

If installation is successful, the last command should display your GPU information (RTX 3060) inside the Docker container.

## After Installation

Once installed, run the conversion script again:

```bash
cd /home/akanlis/Desktop/facial-app/ai-models
./convert_with_docker.sh
```

This will convert the ONNX model to an optimized TensorRT engine for your RTX 3060.
