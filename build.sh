#!/usr/bin/env bash
set -euo pipefail

# Build script: packages split source files for applovin_script.sh.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="${SCRIPT_DIR}/src"
BUILD_DIR="${SCRIPT_DIR}/build"
INDEX_SRC="${SRC_DIR}/index.html"
CSS_SRC="${SRC_DIR}/style.css"
JS_SRC="${SRC_DIR}/game.js"
INDEX_OUT="${BUILD_DIR}/index.html"
CSS_OUT="${BUILD_DIR}/style.css"
JS_OUT="${BUILD_DIR}/game.js"
TAR_FILE="${BUILD_DIR}/game.tar"
ARCHIVE_FILE="${BUILD_DIR}/game.tar.zst"
SIZE_LIMIT=15360

for cmd in cp tar zstd wc; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "Error: required command '$cmd' is not available"
        exit 1
    fi
done

for file in "$INDEX_SRC" "$CSS_SRC" "$JS_SRC"; do
    if [ ! -f "$file" ]; then
        echo "Error: required source file missing: $file"
        exit 1
    fi
done

echo "Building..."

mkdir -p "$BUILD_DIR"
rm -f "$INDEX_OUT" "$CSS_OUT" "$JS_OUT" "$TAR_FILE" "$ARCHIVE_FILE"

cp "$INDEX_SRC" "$INDEX_OUT"
cp "$CSS_SRC" "$CSS_OUT"
cp "$JS_SRC" "$JS_OUT"

LC_ALL=C tar -C "$BUILD_DIR" -cf "$TAR_FILE" index.html style.css game.js
zstd -19 --rm "$TAR_FILE" -o "$ARCHIVE_FILE" -f

SIZE=$(wc -c < "$ARCHIVE_FILE" | tr -d ' ')
echo ""
echo "Archive: $ARCHIVE_FILE"
echo "Size: $SIZE bytes (limit: $SIZE_LIMIT)"
if [ "$SIZE" -gt "$SIZE_LIMIT" ]; then
    echo "WARNING: Over 15KB limit by $((SIZE - SIZE_LIMIT)) bytes!"
else
    echo "OK: $((SIZE_LIMIT - SIZE)) bytes remaining"
fi

if [ "${1:-}" = "--serve" ]; then
    echo ""
    echo "Extracting and serving..."
    cd "$SCRIPT_DIR"
    LC_ALL=C bash applovin_script.sh "$ARCHIVE_FILE"
fi
