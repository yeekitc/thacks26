## Quick Start

### Build and serve:
```bash
./build.sh
```

This will:
1. Compress `game.html` into `build/game.tar.zst`
2. Extract it to `build/extracted/`
3. Start an HTTP server on port 8000

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