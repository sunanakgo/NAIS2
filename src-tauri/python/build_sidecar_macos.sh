#!/bin/bash
# Build script for NAIS2 Tagger Server Sidecar (macOS)
# Run this from the python directory

echo "===================================="
echo "NAIS2 Tagger Server - macOS Build"
echo "===================================="
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python3 is not installed"
    exit 1
fi

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    TARGET="aarch64-apple-darwin"
    echo "Detected: Apple Silicon (M1/M2/M3)"
else
    TARGET="x86_64-apple-darwin"
    echo "Detected: Intel Mac"
fi

echo ""
echo "[1/3] Installing/updating dependencies..."
pip3 install pyinstaller fastapi uvicorn pillow numpy onnxruntime pandas huggingface_hub rembg tqdm --quiet

# Check if pyinstaller is available
if ! command -v pyinstaller &> /dev/null; then
    echo "ERROR: PyInstaller installation failed"
    exit 1
fi

echo ""
echo "[2/3] Building binary with PyInstaller..."
echo "This may take several minutes..."
echo ""

pyinstaller --onefile --name "tagger-server-${TARGET}" tagger_server.py --clean --noconfirm

if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Build failed!"
    exit 1
fi

echo ""
echo "[3/3] Moving binary to binaries folder..."

# Create binaries folder if not exists
mkdir -p ../binaries

# Move the built binary
mv -f "dist/tagger-server-${TARGET}" "../binaries/"

# Make it executable
chmod +x "../binaries/tagger-server-${TARGET}"

echo ""
echo "===================================="
echo "Build complete!"
echo "Output: src-tauri/binaries/tagger-server-${TARGET}"
echo "===================================="
echo ""
echo "Next step: Run 'npm run tauri build' to create the app bundle"
