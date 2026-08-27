#!/usr/bin/env python3
"""
Test 1: Neural Network GPU Training with MPS
Trains a simple neural network on Apple Silicon GPU via Metal
Replicates: https://www.wisejnrs.net/blog/carbon-development-suite-ai-playground
"""

import torch
import torch.nn as nn
import torch.optim as optim
import time

print("=" * 60)
print("Test 1: PyTorch MPS GPU Training")
print("=" * 60)

# Check MPS availability
if torch.backends.mps.is_available():
    device = torch.device("mps")
    print(f"✅ Using MPS (Metal GPU)")
else:
    device = torch.device("cpu")
    print(f"⚠️  MPS not available, using CPU")

print(f"Device: {device}")
print(f"PyTorch version: {torch.__version__}")
print()

# Simple neural network
class SimpleNet(nn.Module):
    def __init__(self):
        super(SimpleNet, self).__init__()
        self.fc1 = nn.Linear(784, 256)
        self.fc2 = nn.Linear(256, 128)
        self.fc3 = nn.Linear(128, 10)
        self.relu = nn.ReLU()

    def forward(self, x):
        x = self.relu(self.fc1(x))
        x = self.relu(self.fc2(x))
        x = self.fc3(x)
        return x

# Create model and move to device
model = SimpleNet().to(device)
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=0.001)

print(f"Model architecture:")
print(model)
print()

# Generate dummy data
batch_size = 256
num_batches = 100

print(f"Training configuration:")
print(f"  Batch size: {batch_size}")
print(f"  Number of batches: {num_batches}")
print(f"  Total samples per epoch: {batch_size * num_batches:,}")
print()

# Training loop with timing
print("Starting training...")
start_time = time.time()

for epoch in range(5):
    epoch_start = time.time()
    epoch_loss = 0.0

    for batch in range(num_batches):
        # Generate random data
        inputs = torch.randn(batch_size, 784, device=device)
        labels = torch.randint(0, 10, (batch_size,), device=device)

        # Forward pass
        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, labels)

        # Backward pass
        loss.backward()
        optimizer.step()

        epoch_loss += loss.item()

    epoch_time = time.time() - epoch_start
    avg_loss = epoch_loss / num_batches

    print(f"Epoch {epoch + 1}/5 - Loss: {avg_loss:.4f} - Time: {epoch_time:.2f}s")

total_time = time.time() - start_time
total_samples = batch_size * num_batches * 5
samples_per_sec = total_samples / total_time

print()
print("=" * 60)
print("Training Complete!")
print(f"Total time: {total_time:.2f}s")
print(f"Total samples: {total_samples:,}")
print(f"Throughput: {samples_per_sec:.0f} samples/sec")
print()

# Verify GPU was used
if device.type == "mps":
    print("✅ SUCCESS: Neural network trained on Apple Silicon GPU (MPS)")
    print("   Expected speedup: 4-6x faster than CPU")
    print("   Monitor GPU usage in Activity Monitor → Window → GPU History")
else:
    print("⚠️  Training completed on CPU (MPS not available)")

print("=" * 60)
