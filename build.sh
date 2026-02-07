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
JS_TMP="${BUILD_DIR}/game.build.tmp.js"
TAR_FILE="${BUILD_DIR}/game.tar"
SIZE_LIMIT=15360
ARCHIVE_FILE=""

for cmd in cat cp tar wc; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "Error: required command '$cmd' is not available"
        exit 1
    fi
done

HAS_BROTLI=0
HAS_ZSTD=0
HAS_GZIP=0
HAS_BUN=0
command -v brotli >/dev/null 2>&1 && HAS_BROTLI=1
command -v zstd >/dev/null 2>&1 && HAS_ZSTD=1
command -v gzip >/dev/null 2>&1 && HAS_GZIP=1
command -v bun >/dev/null 2>&1 && HAS_BUN=1

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
rm -f "$INDEX_OUT" "$JS_TMP" "$TAR_FILE" \
    "${BUILD_DIR}/style.css" "${BUILD_DIR}/game.js" \
    "${BUILD_DIR}/game.tar.br" "${BUILD_DIR}/game.tar.zst" "${BUILD_DIR}/game.tar.gz"

if command -v npx >/dev/null 2>&1; then
    npx --yes terser "$JS_SRC" --compress passes=5,drop_console=true,unsafe_math=true,unsafe=true,pure_getters=true,keep_fargs=false,unsafe_comps=true,unsafe_Function=true,unsafe_methods=true,unsafe_proto=true,unsafe_regexp=true,unsafe_undefined=true --mangle toplevel=true --output "$JS_TMP"
elif [ "$HAS_BUN" -eq 1 ]; then
    bun build "$JS_SRC" --minify --target=browser --outfile "$JS_TMP" >/dev/null
else
    cp "$JS_SRC" "$JS_TMP"
fi

{
    printf '<body style=margin:0;overflow:hidden;background:#000><canvas id=c></canvas><script>'
    cat "$JS_TMP"
    printf '</script>'
} > "$INDEX_OUT"

rm -f "$JS_TMP"

LC_ALL=C tar -C "$BUILD_DIR" -cf "$TAR_FILE" index.html

echo ""
echo "Compressing with available formats..."

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

echo ""
echo "Compression results:"
echo "-------------------"

BEST_SIZE=999999999
for CANDIDATE in "${BUILD_DIR}/game.tar.br" "${BUILD_DIR}/game.tar.zst" "${BUILD_DIR}/game.tar.gz"; do
    if [ -f "$CANDIDATE" ]; then
        CANDIDATE_SIZE=$(wc -c < "$CANDIDATE" | tr -d ' ')
        FORMAT=$(basename "$CANDIDATE" | sed 's/game\.tar\.//')
        printf "  %-8s %6d bytes\n" "$FORMAT" "$CANDIDATE_SIZE"
        if [ "$CANDIDATE_SIZE" -lt "$BEST_SIZE" ]; then
            BEST_SIZE="$CANDIDATE_SIZE"
            ARCHIVE_FILE="$CANDIDATE"
        fi
    fi
done

CHOSEN_FORMAT=$(basename "$ARCHIVE_FILE" | sed 's/game\.tar\.//')
echo "-------------------"
echo "Selected: $CHOSEN_FORMAT (smallest)"

for CANDIDATE in "${BUILD_DIR}/game.tar.br" "${BUILD_DIR}/game.tar.zst" "${BUILD_DIR}/game.tar.gz"; do
    if [ -f "$CANDIDATE" ] && [ "$CANDIDATE" != "$ARCHIVE_FILE" ]; then
        rm -f "$CANDIDATE"
    fi
done

SIZE=$(wc -c < "$ARCHIVE_FILE" | tr -d ' ')
echo ""
echo "Final archive: $(basename "$ARCHIVE_FILE")"
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
