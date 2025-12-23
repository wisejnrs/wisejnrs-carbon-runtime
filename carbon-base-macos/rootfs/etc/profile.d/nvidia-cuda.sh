#!/bin/bash
# NVIDIA GPU and CUDA environment variables
# This ensures GPU is available in all sessions (xRDP, SSH, VNC)

export NVIDIA_VISIBLE_DEVICES=${NVIDIA_VISIBLE_DEVICES:-all}
export NVIDIA_DRIVER_CAPABILITIES=${NVIDIA_DRIVER_CAPABILITIES:-all}
export CUDA_DEVICE_ORDER=${CUDA_DEVICE_ORDER:-PCI_BUS_ID}

# Add NVIDIA and CUDA to PATH
if [ -d "/usr/local/nvidia/bin" ]; then
    export PATH="/usr/local/nvidia/bin:$PATH"
fi
if [ -d "/usr/local/cuda/bin" ]; then
    export PATH="/usr/local/cuda/bin:$PATH"
fi

# Add NVIDIA libraries to LD_LIBRARY_PATH
if [ -d "/usr/local/nvidia/lib64" ]; then
    export LD_LIBRARY_PATH="/usr/local/nvidia/lib:/usr/local/nvidia/lib64${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi
