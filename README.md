# Buggy On - TartanHacks 2026
By Anthony Bustamante, Yee Kit Chan, and Evelynn Chen

A fast-paced downhill racing game where you control a buggy through procedurally generated terrain, collecting pushers, dodging potholes, and jumping over collapsed bridge gaps. Inspired by [Buggy](https://www.cmu.edu/buggy/), one of CMU's longest held traditions.

## Objective

Travel as far as possible down Flagstaff Hill. Your score is measured in meters traveled. The game ends when you crash, fall into a gap, lose momentum, or fail to recover from a bad landing.

## Gameplay Overview

### The Challenge
All 446 Pittsburgh bridges have collapsed, leaving dangerous gaps in your path. You must maintain speed and momentum to jump these gaps while navigating treacherous terrain filled with potholes and obstacles.

### Core Mechanics

**Pushers** - Collectible NPCs that provide speed boosts
- You can hold up to **3 pushers** at once
- Collect them by pressing **ACTION** when nearby
- Use **CALL PUSHER** to activate a powerful boost
- **Save pushers for big bridge gaps** - they're essential for clearing wide chasms

**Potholes** - Hazards that slow you down
- Swerve around them using **ACTION** when nearby
- Hitting a pothole reduces your speed significantly
- Successfully swerving gives you a brief speed boost

**Bridge Gaps** - The main obstacle
- Procedurally generated gaps of varying widths
- Requires sufficient speed and proper landing angle
- Bad landings or hitting cliff walls will end your run

## Controls

### Touch/Mobile
- **CALL PUSHER** (right button) - Activates a boost when you have pushers in reserve
- **ACTION** (left button) - Collects nearby pushers or swerves around potholes
- Tap anywhere on title/end screens to continue

## Features

- **Procedurally Generated Terrain** - Every run is unique with dynamic slopes, gaps, and obstacles
- **Physics-Based Movement** - Realistic buggy physics with air control, landing mechanics, and momentum
- **Boost System** - Strategic use of pushers for speed boosts and gap clearing
- **Leaderboard** - Compete with others (requires WiFi connection)
- **Death Markers** - See where other players crashed (when online)
- **Dynamic Music** - Procedurally generated soundtrack that adapts to gameplay
- **Particle Effects** - Visual feedback for boosts, crashes, and interactions
- **Tutorial System** - Interactive tutorial teaches all game mechanics

## How to Play

1. **Start** - Tap to begin after the tutorial
2. **Collect Pushers** - Use ACTION near standing pushers to add them to your reserve (max 3)
3. **Dodge Potholes** - Use ACTION near potholes to swerve around them
4. **Call Pushers** - When you need extra speed (especially for gaps), tap CALL PUSHER
5. **Jump Gaps** - Build up speed before bridge gaps and maintain proper landing angle
6. **Survive** - Keep your speed up, avoid crashes, and travel as far as possible

## Tips for Success

- **Save pushers for bridge gaps** - They're your lifeline for clearing wide chasms
- **Maintain speed** - Don't let your buggy slow down too much or you'll stall
- **Watch the terrain** - Downhill slopes help, but watch for sudden drops
- **Time your boosts** - Use pushers strategically, not just when available
- **Swerve potholes** - They significantly slow you down if hit

---

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