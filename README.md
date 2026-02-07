## Quick Start

### Build artifact:
```bash
./build.sh
```

This will:
1. Copy split source files from `src/`:
   - `src/index.html`
   - `src/style.css`
   - `src/game.js`
2. Write package payload files to `build/`
3. Compress into `build/game.tar.zst`

### Build and serve with canonical script:
```bash
./build.sh --serve
```

This will:
1. Build `build/game.tar.zst`
2. Run `applovin_script.sh` to extract and serve on port 8000

### Dev source of truth
- Edit files in `src/` during development.
- `build.sh` packages directly from `src/`.

### Access the game:
- **Local browser**: http://localhost:8000
- **Mobile device**: 
  1. Find your computer's IP: `ifconfig | grep "inet "`
  2. Open http://YOUR_IP:8000 on your phone browser

### Stop the server:
```bash
lsof -ti:8000 | xargs kill -9
```

**Note**: All generated files (archives, extracted content) are stored in the `build/` directory and are ignored by git.
