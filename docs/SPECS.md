# Buggy Downhill - Game Specification

## Overview
A 2D side-view downhill infinite runner inspired by Alto's Adventure, themed around the Carnegie Mellon **Buggy** tradition. The player rides a push-cart (buggy) downhill through Schenley Park, collecting pushers for speed and dodging obstacles. The goal is to travel as far as possible.

## Technical Constraints (AppLovin Prize)
- **Compressed bundle < 15 KB** (15,360 bytes) using zstd, brotli, or gzip
- **Self-contained**: no runtime network requests
- **Mobile browser game**: must work on modern Android and iPhone
- **Playable without instructions**: judges have 2-3 minutes, no verbal explanation allowed
- Must be runnable via `applovin_script.sh` (extracts archive, serves via `python3 -m http.server`)
- Output is an `index.html` file (the script serves the extracted directory root)

## Core Concept
- **Perspective**: 2D side-view, scrolling left-to-right
- **Setting**: Downhill course through Schenley Park (hills, curves, ramps)
- **Theme**: CMU Buggy tradition - small push-carts racing downhill with human pushers
- **Tone**: Fun, arcade-y, colorful

## Controls (Touch / Mobile)
Three buttons on screen:
1. **Call Pusher** (bottom-left): Summons your collected pusher to push you, giving a speed boost for several seconds. Pusher disappears after pushing.
2. **Slow Down / Brake** (bottom-right): Reduces speed. Useful for controlling trajectory while airborne, adjusting landing angle.
3. **Action** (above Slow Down button, right side): Context-sensitive:
   - Near a bystander NPC on the track: **Collect** them as your available pusher
   - Near a pothole: **Swerve** to dodge it (avoids speed penalty)

## Terrain / World Generation
- **Procedurally generated** infinite downhill terrain
- Terrain is a series of connected line segments, generally sloping downward (left to right)
- Terrain features:
  - **Smooth hills**: gentle slopes, the baseline
  - **Steep sections**: faster acceleration
  - **Ramps / jumps**: launch the buggy into the air
  - **Broken bridges**: gaps in the terrain with a small ramp on the approach side. Requires enough speed to clear. If you don't have enough speed, your run ends (soft-stop, not a crash animation — just can't make it)
  - **Flat sections**: speed bleeds off here, need pushers

## Physics
- **Gravity** pulls buggy downward
- **Speed** determined by:
  - Slope angle (steeper = faster, flat/uphill = slower)
  - Pusher boosts (temporary speed injection)
  - Brake input (slows down)
  - Pothole hits (speed penalty if not dodged)
- **Airborne**: buggy follows projectile trajectory when off terrain
- **Landing**: must land at a "natural" angle relative to the terrain surface
  - Landing angle too steep (nose-diving) → **crash / game over**
  - Landing too hard from extreme height → **crash / game over**
  - Brake while airborne lets you adjust angle/trajectory

## Entities

### Buggy (Player)
- Small cart, roughly rectangular with wheels
- Has velocity (horizontal + vertical when airborne)
- Tracks: speed, distance traveled, current pusher (0 or 1)
- Visual: simple cart shape with wheels

### Pushers (Bystander NPCs)
- Appear standing on the side of the track at intervals
- Player must press **Action** when near them to collect
- Once collected, player can press **Call Pusher** to activate
- Only **one pusher at a time** can be held
- When activated: pusher appears behind buggy, pushes for a few seconds, then disappears
- Visual: simple stick-figure or person shape

### Potholes
- Appear on the road surface
- If buggy rolls over one without pressing Action: **speed penalty**
- If player presses Action near one: buggy swerves, no penalty
- Visual: dark circle/oval on the road

### Broken Bridges (Gaps)
- Gaps in the terrain, preceded by a small ramp
- Must have sufficient speed to clear
- Soft-stop if not enough speed: run ends gracefully
- Visual: visible gap in the terrain line

## Game Flow
1. **Title Screen**: "Buggy Downhill" + tap to start
2. **Gameplay**: infinite scrolling, score = distance traveled
3. **Game Over**: triggered by:
   - Speed reaches zero (ran out of momentum)
   - Crash from bad landing (nose-dive or too-hard impact)
   - Failed to clear a broken bridge gap
4. **Game Over Screen**: show distance/score, tap to retry

## HUD
- **Distance/Score**: top of screen
- **Speed indicator**: visual bar or number
- **Pusher status**: icon showing if you have a pusher available
- **Control buttons**: semi-transparent touch areas at bottom of screen

## Systems Breakdown (for parallel development)

### 1. Terrain Generation System
- Procedural terrain as connected segments
- Spawns obstacles (potholes, gaps) and NPCs (pushers)
- Camera follows buggy, terrain scrolls

### 2. Physics System
- Buggy movement along terrain surface
- Gravity when airborne
- Speed calculation (slope, friction, boosts, brakes)
- Landing detection and crash evaluation

### 3. Input / Controls System
- Touch button rendering and hit detection
- Three-button layout
- Action context detection (near pusher? near pothole?)

### 4. Entity System
- Pusher NPC spawning, collection, activation, animation
- Pothole spawning and interaction
- Broken bridge gaps

### 5. Game State System
- Title screen → gameplay → game over → retry loop
- Score tracking (distance)
- Speed tracking and game-over conditions

### 6. Rendering System
- Canvas 2D drawing
- Parallax background (sky, distant hills)
- Terrain rendering
- Entity rendering (buggy, pushers, potholes)
- HUD overlay
- Simple particle effects (dust, push boost)

### 7. Audio System (stretch goal / bonus prize eligible)
- Simple oscillator-based sound effects
- Rolling sound, push boost, swerve, crash
- Could target "Best Audio Design" bonus prize
