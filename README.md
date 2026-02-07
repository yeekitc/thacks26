## Quick Start

### Build artifact:
```bash
./build.sh
```

This will:
1. Read source files from `src/`:
   - `src/style.css`
   - `src/game.js`
2. Use a compact HTML shell for packaging (equivalent to `src/index.html`)
3. Build a single self-contained `build/index.html` (inline CSS + JS)
4. Minify JS during build if `bun` is installed (fallback: raw JS)
5. Compress into the smallest supported artifact format:
   - `build/game.tar.br` (preferred when `brotli` is installed)
   - or `build/game.tar.zst`
   - or `build/game.tar.gz`

### Build and serve with canonical script:
```bash
./build.sh --serve
```

This will:
1. Build the smallest artifact (`build/game.tar.br`, `.zst`, or `.gz`)
2. Run `applovin_script.sh` to extract and serve on port 8000

### Dev source of truth
- Edit files in `src/` during development.
- `build.sh` packages directly from `src/`.

### Access the game:
- **Local browser**: http://localhost:8000
- **Mobile device**: 
  1. Find your computer's IP: `ifconfig | grep "inet "` OR `ipconfig getifaddr en0 || ipconfig getifaddr en1 || ifconfig | awk '/inet / && $2 != "127.0.0.1" {print $2; exit}'`
  2. Open http://YOUR_IP:8000 on your phone browser

### Stop the server:
```bash
lsof -ti:8000 | xargs kill -9
```

**Note**: All generated files (archives, extracted content) are stored in the `build/` directory and are ignored by git.
