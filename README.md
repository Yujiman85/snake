# Snake Game

A modern take on the classic Snake game built with vanilla HTML, CSS, and JavaScript. Features a dark theme, visual effects, online leaderboard, and progressive difficulty.

## Play

Requires a local server (ES modules don't work via `file://`):

```bash
cd snake && python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Controls

| Key | Action |
|-----|--------|
| W / Arrow Up | Move up |
| A / Arrow Left | Move left |
| S / Arrow Down | Move down |
| D / Arrow Right | Move right |
| Space | Start / Restart |

## Features

### Gameplay
- Classic snake movement on a 20x20 grid (500x500 canvas)
- Progressive speed increase as your score grows
- Multiple food spawns at higher scores:
  - 0-9: 1 food
  - 10-19: 2 food
  - 20-29: 3 food
  - 30-39: 4 food
  - 40-49: 5 food
  - 50+: 6 food
- At score 100, the stage flashes white and blue obstacle walls appear with a 3-2-1 countdown
- Every 20 points after 100, additional obstacle clusters are added

### Visuals
- Dark theme with subtle grid lines
- Snake head glows green with directional eyes
- Yellow flash and particle burst effect when eating food
- Pulsing red food dots
- Blue shimmering obstacle blocks
- Animated start screen with a snake chasing scared food (with legs!)

### Leaderboard
- Online top 10 leaderboard powered by Firebase Realtime Database
- Player name entry (7 character max) when achieving a top 10 score
- Remembers your last used name
- Auto-scrolling leaderboard display
- Local "Your Best" score tracked separately via localStorage

### Audio
- Background music: "We Don't Stop" by Locomule (from [opengameart.org](https://opengameart.org))
- Mute/unmute toggle button in the score bar
- Music plays during gameplay, pauses on game over

## Project Structure

```
snake/
  index.html       - HTML structure
  style.css        - All styling
  game.js          - Game logic, rendering, input, particles, obstacles
  leaderboard.js   - Firebase integration, score submission, leaderboard display
  animation.js     - Start screen chase animation
  We Dont Stop.mp3 - Background music
  README.md        - This file
```

## Tech Stack

- Vanilla JavaScript (ES modules)
- HTML5 Canvas
- CSS3
- Firebase Realtime Database (leaderboard)
