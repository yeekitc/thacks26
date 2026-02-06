#!/usr/bin/env bash
set -euo pipefail

# Build script: compresses game.html and serves it

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"
SOURCE_FILE="${SCRIPT_DIR}/game.html"
ARCHIVE_NAME="game.tar"
COMPRESSED_NAME="game.tar.zst"
OUT_DIR="${BUILD_DIR}/extracted"

# Create build directory if it doesn't exist
mkdir -p "$BUILD_DIR"

# Check if source file exists
if [ ! -f "$SOURCE_FILE" ]; then
    echo "Error: $SOURCE_FILE not found!"
    exit 1
fi

echo "Building compressed archive..."
cd "$SCRIPT_DIR"

# Create compressed archive
tar -cf "$BUILD_DIR/$ARCHIVE_NAME" game.html
zstd -19 "$BUILD_DIR/$ARCHIVE_NAME" -o "$BUILD_DIR/$COMPRESSED_NAME"

# Remove intermediate tar file
rm "$BUILD_DIR/$ARCHIVE_NAME"

# Check game size
echo ""
echo "Build complete! Archive size:"
ls -lh "$BUILD_DIR/$COMPRESSED_NAME"

# Extract the archive
echo ""
echo "Extracting archive..."
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

zstd -d "$BUILD_DIR/$COMPRESSED_NAME" -o "$BUILD_DIR/$ARCHIVE_NAME"
tar -xf "$BUILD_DIR/$ARCHIVE_NAME" -C "$OUT_DIR"
rm "$BUILD_DIR/$ARCHIVE_NAME"

echo "Extraction successful!"
echo ""
echo "Starting HTTP server on port 8000..."
echo "Open http://localhost:8000 in your browser"
echo ""
echo "For mobile access, find your computer's IP with:"
echo "  ifconfig | grep 'inet '"
echo "Then access: http://YOUR_IP:8000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

cd "$OUT_DIR"
python3 -m http.server 8000
