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
SIZE_LIMIT=15360
ARCHIVE_FILE=""

for cmd in cp tar wc; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "Error: required command '$cmd' is not available"
        exit 1
    fi
done

HAS_BROTLI=0
HAS_ZSTD=0
HAS_GZIP=0
command -v brotli >/dev/null 2>&1 && HAS_BROTLI=1
command -v zstd >/dev/null 2>&1 && HAS_ZSTD=1
command -v gzip >/dev/null 2>&1 && HAS_GZIP=1

if [ "$HAS_BROTLI" -eq 0 ] && [ "$HAS_ZSTD" -eq 0 ] && [ "$HAS_GZIP" -eq 0 ]; then
    echo "Error: no supported compressor found (need one of: brotli, zstd, gzip)"
    exit 1
fi

for file in "$INDEX_SRC" "$CSS_SRC" "$JS_SRC"; do
    if [ ! -f "$file" ]; then
        echo "Error: required source file missing: $file"
        exit 1
    fi
done

echo "Building..."

mkdir -p "$BUILD_DIR"
rm -f "$INDEX_OUT" "$CSS_OUT" "$JS_OUT" "$TAR_FILE" \
    "${BUILD_DIR}/game.tar.br" "${BUILD_DIR}/game.tar.zst" "${BUILD_DIR}/game.tar.gz"

cp "$INDEX_SRC" "$INDEX_OUT"
cp "$CSS_SRC" "$CSS_OUT"
cp "$JS_SRC" "$JS_OUT"

LC_ALL=C tar -C "$BUILD_DIR" -cf "$TAR_FILE" index.html style.css game.js

if [ "$HAS_BROTLI" -eq 1 ]; then
    brotli -f -q 11 "$TAR_FILE" -o "${BUILD_DIR}/game.tar.br"
fi
if [ "$HAS_ZSTD" -eq 1 ]; then
    zstd -19 -f "$TAR_FILE" -o "${BUILD_DIR}/game.tar.zst" >/dev/null
fi
if [ "$HAS_GZIP" -eq 1 ]; then
    gzip -9 -c "$TAR_FILE" > "${BUILD_DIR}/game.tar.gz"
fi
rm -f "$TAR_FILE"

BEST_SIZE=999999999
for CANDIDATE in "${BUILD_DIR}/game.tar.br" "${BUILD_DIR}/game.tar.zst" "${BUILD_DIR}/game.tar.gz"; do
    if [ -f "$CANDIDATE" ]; then
        CANDIDATE_SIZE=$(wc -c < "$CANDIDATE" | tr -d ' ')
        if [ "$CANDIDATE_SIZE" -lt "$BEST_SIZE" ]; then
            BEST_SIZE="$CANDIDATE_SIZE"
            ARCHIVE_FILE="$CANDIDATE"
        fi
    fi
done

for CANDIDATE in "${BUILD_DIR}/game.tar.br" "${BUILD_DIR}/game.tar.zst" "${BUILD_DIR}/game.tar.gz"; do
    if [ -f "$CANDIDATE" ] && [ "$CANDIDATE" != "$ARCHIVE_FILE" ]; then
        rm -f "$CANDIDATE"
    fi
done

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
