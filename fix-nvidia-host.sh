#!/bin/bash
# Fix NVIDIA driver/library version mismatch on host
# This script should be run on the HOST, not in the container

echo "🔧 NVIDIA Driver Fix for Host System"
echo "====================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root (sudo)"
  exit 1
fi

echo "Current NVIDIA status:"
nvidia-smi 2>&1 | head -3

echo ""
echo "The error 'Driver/library version mismatch' usually means:"
echo "  • NVIDIA kernel module version != nvidia-smi library version"
echo "  • Often happens after driver update without reboot"
echo ""
echo "Solutions (try in order):"
echo ""
echo "1️⃣  RESTART NVIDIA SERVICES (quickest):"
echo "    sudo systemctl restart nvidia-persistenced"
echo "    sudo rmmod nvidia_uvm nvidia_drm nvidia_modeset nvidia"
echo "    sudo modprobe nvidia nvidia_modeset nvidia_drm nvidia_uvm"
echo ""
echo "2️⃣  REBOOT THE HOST (most reliable):"
echo "    sudo reboot"
echo ""
echo "3️⃣  REINSTALL NVIDIA DRIVERS (if above don't work):"
echo "    sudo apt-get install --reinstall nvidia-driver-570"
echo ""

# Try to restart NVIDIA services
echo "Attempting automatic fix..."
echo "Restarting NVIDIA services..."

systemctl restart nvidia-persistenced 2>/dev/null || echo "  (nvidia-persistenced not active)"

echo "Unloading NVIDIA kernel modules..."
rmmod nvidia_uvm 2>/dev/null || true
rmmod nvidia_drm 2>/dev/null || true
rmmod nvidia_modeset 2>/dev/null || true
rmmod nvidia 2>/dev/null || true

sleep 2

echo "Reloading NVIDIA kernel modules..."
modprobe nvidia || echo "Failed to load nvidia module"
modprobe nvidia_modeset || echo "Failed to load nvidia_modeset"
modprobe nvidia_drm || echo "Failed to load nvidia_drm"
modprobe nvidia_uvm || echo "Failed to load nvidia_uvm"

echo ""
echo "Testing nvidia-smi..."
nvidia-smi 2>&1 | head -5

echo ""
echo "If still showing errors, you MUST reboot the host:"
echo "  sudo reboot"
