# Snake Game

A modern take on the classic Snake game built with vanilla HTML, CSS, and JavaScript. Features a dark neon theme, smooth movement, online leaderboard, progressive difficulty, and two game modes.

## Play

[Play Snake](https://yujiman85.github.io/snake/)

## Game Modes

### Normal Mode
- Single snake controlled by WASD or arrow keys
- Available on desktop and mobile

### Expert Mode: Simulsnake! (Desktop only)
- Two snakes on the same board simultaneously
- Cyan snake: WASD | Pink snake: Arrow keys
- Game ends if either snake dies

## Controls

| Key | Action |
|-----|--------|
| W / Arrow Up | Move up |
| A / Arrow Left | Move left |
| S / Arrow Down | Move down |
| D / Arrow Right | Move right |
| Space | Start / Restart |

On mobile: swipe or on-screen d-pad.

## Features

### Gameplay
- 20x20 grid on a 550x550 canvas
- Smooth interpolated movement
- Progressive speed increase as your score grows
- Multiple food spawns at higher scores:
  - 0-9: 1 food
  - 10-19: 2 food
  - 20-29: 3 food
  - 30-39: 4 food
  - 40-49: 5 food
  - 50+: 6 food
- At score 50, the stage flashes white and blue obstacle walls appear with a 3-2-1 countdown
- Every 20 points after 50, additional obstacle clusters are added
- Obstacle patterns: horizontal/vertical walls, L-shapes, T-shapes, 2x2 blocks

### Visuals
- Dark theme with subtle grid lines
- Snake head glow with directional eyes
- Cyan (normal) and hot pink (expert) color theming
- Yellow flash and particle burst effect when eating food
- Pulsing red food dots
- Blue shimmering obstacle blocks
- Animated start screen with a snake chasing scared food (with legs!)
- Animated title transition between "Snake" and "Simulsnake!"

### Leaderboard
- Online top 10 leaderboard powered by Firebase Realtime Database
- Separate leaderboards for Normal and Expert modes
- Tabbed display with color-coded scores
- Player name entry (7 character max) when achieving a top 10 score
- Remembers your last used name
- Local "Your Best" score tracked separately via localStorage

### Audio
- Background music: "We Don't Stop" by Locomule (from [opengameart.org](https://opengameart.org))
- Mute/unmute toggle button in the score bar

### Mobile Support
- Responsive layout that scales to viewport width
- Touch controls: swipe or on-screen d-pad (user selectable)
- Expert mode disabled on mobile

## Tech Stack

- Vanilla JavaScript (ES modules)
- HTML5 Canvas
- CSS3
- Firebase Realtime Database (leaderboard)
