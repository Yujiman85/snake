import { fetchAllLeaderboards, renderLeaderboard, isTopTen, submitScore } from './leaderboard.js';
import { initChaseAnimation } from './animation.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highEl = document.getElementById('high');
const finalScoreEl = document.getElementById('finalScore');
const gameOverEl = document.getElementById('gameOver');
const startScreenEl = document.getElementById('startScreen');
const highScoreEntryEl = document.getElementById('highScoreEntry');
const playerNameEl = document.getElementById('playerName');
const submitScoreBtn = document.getElementById('submitScore');

const GRID = 20;
const TILE = canvas.width / GRID;
const SPEED_INITIAL = 120;
const SPEED_MIN = 60;

let snake, dir, nextDir, foods, score, highScore, gameLoop, running;
let snake2, dir2, nextDir2;
let expertMode = false;
let particles = [];
let eatFlash = 0;
let pendingScore = 0;
let obstacles = [];
let stageFlash = 0;
let obstaclesActive = false;
let cutscene = null; // { phase, timer }
let obstacleClusterCount = 0;

// Smooth movement interpolation
let prevSnake = [], prevSnake2 = [];
let lastTickTime = 0;
let currentTickInterval = SPEED_INITIAL;
let animFrameId = null;

// Pause state
let paused = false;
const pauseBtn = document.getElementById('pauseBtn');

// Difficulty toggle
const diffNormalBtn = document.getElementById('diffNormal');
const diffExpertBtn = document.getElementById('diffExpert');
const controlsNormal = document.getElementById('controlsNormal');
const controlsExpert = document.getElementById('controlsExpert');
const startTitle = startScreenEl.querySelector('h2');
const startBtn = document.getElementById('startBtn');

let titleAnim = null;

function animateTitle(from, to) {
  if (titleAnim) cancelAnimationFrame(titleAnim);
  // Find shared prefix
  let shared = 0;
  while (shared < from.length && shared < to.length && from[shared] === to[shared]) shared++;
  const eraseCount = from.length - shared;
  const typeCount = to.length - shared;
  let step = 0;
  const msPerStep = 60;
  let last = 0;

  function tick(ts) {
    if (ts - last < msPerStep) { titleAnim = requestAnimationFrame(tick); return; }
    last = ts;
    step++;
    if (step <= eraseCount) {
      startTitle.textContent = from.slice(0, from.length - step);
    } else {
      const typed = step - eraseCount;
      startTitle.textContent = to.slice(0, shared + typed);
    }
    if (step < eraseCount + typeCount) {
      titleAnim = requestAnimationFrame(tick);
    } else {
      titleAnim = null;
    }
  }
  titleAnim = requestAnimationFrame(tick);
}

function setDifficulty(mode) {
  const wasExpert = expertMode;
  expertMode = mode === 'expert';
  diffNormalBtn.classList.toggle('active', !expertMode);
  diffExpertBtn.classList.toggle('active', expertMode);
  controlsNormal.style.display = expertMode ? 'none' : 'flex';
  controlsExpert.style.display = expertMode ? 'flex' : 'none';

  // Color and title transitions
  scoreEl.classList.toggle('expert', expertMode);
  if (expertMode && !wasExpert) {
    startTitle.style.color = '#f472b6';
    startBtn.style.background = '#f472b6';
    animateTitle('Snake', 'Simulsnake!');
  } else if (!expertMode && wasExpert) {
    startTitle.style.color = '#22d3ee';
    startBtn.style.background = '#22d3ee';
    animateTitle('Simulsnake!', 'Snake');
  }
}

diffNormalBtn.addEventListener('click', () => setDifficulty('normal'));
diffExpertBtn.addEventListener('click', () => setDifficulty('expert'));

// Background music: "We Don't Stop" by Locomule (from opengameart.org)
const bgMusic = new Audio('We Dont Stop.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.4;

highScore = parseInt(localStorage.getItem('snakeHigh') || '0');
highEl.textContent = highScore;

playerNameEl.value = localStorage.getItem('snakePlayerName') || '';

function init() {
  snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  if (expertMode) {
    snake2 = [{ x: 10, y: 14 }, { x: 11, y: 14 }, { x: 12, y: 14 }];
    dir2 = { x: -1, y: 0 };
    nextDir2 = { x: -1, y: 0 };
  } else {
    snake2 = null;
    dir2 = null;
    nextDir2 = null;
  }
  score = 0;
  scoreEl.textContent = 0;
  scoreEl.classList.toggle('expert', expertMode);
  particles = [];
  eatFlash = 0;
  pendingScore = 0;
  obstacles = [];
  stageFlash = 0;
  obstaclesActive = false;
  cutscene = null;
  obstacleClusterCount = 0;
  highScoreEntryEl.style.display = 'none';
  gameOverEl.classList.remove('active');
  startScreenEl.classList.remove('active');
  paused = false;
  pauseBtn.style.display = 'inline-block';
  pauseBtn.textContent = '\u23F8';
  foods = [];
  spawnAllFood();
  running = true;
  clearInterval(gameLoop);
  currentTickInterval = SPEED_INITIAL;
  gameLoop = setInterval(update, SPEED_INITIAL);
  lastTickTime = performance.now();
  prevSnake = snake.map(s => ({ ...s }));
  prevSnake2 = snake2 ? snake2.map(s => ({ ...s })) : [];
  if (!animFrameId) animFrameId = requestAnimationFrame(renderLoop);
  bgMusic.currentTime = 0;
  bgMusic.play().catch(() => {});
}

function getFoodCount() {
  if (score >= 50) return 6;
  if (score >= 40) return 5;
  if (score >= 30) return 4;
  if (score >= 20) return 3;
  if (score >= 10) return 2;
  return 1;
}

function spawnOneFood() {
  let pos;
  do {
    pos = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
  } while (
    snake.some(s => s.x === pos.x && s.y === pos.y) ||
    (snake2 && snake2.some(s => s.x === pos.x && s.y === pos.y)) ||
    foods.some(f => f.x === pos.x && f.y === pos.y) ||
    obstacles.some(o => o.x === pos.x && o.y === pos.y)
  );
  foods.push(pos);
}

function spawnAllFood() {
  const target = getFoodCount();
  while (foods.length < target) {
    spawnOneFood();
  }
}

// Wall-like obstacle patterns (relative positions)
const OBSTACLE_PATTERNS = [
  // Horizontal wall (4 blocks)
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
  // Vertical wall (4 blocks)
  [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }],
  // L-shape
  [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
  // T-shape
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }],
  // 2x2 block
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  // Horizontal wall (3 blocks)
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
  // Vertical wall (3 blocks)
  [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }],
];

function isOccupied(x, y) {
  if (x < 0 || x >= GRID || y < 0 || y >= GRID) return true;
  if (snake.some(s => s.x === x && s.y === y)) return true;
  if (snake2 && snake2.some(s => s.x === x && s.y === y)) return true;
  if (foods.some(f => f.x === x && f.y === y)) return true;
  if (obstacles.some(o => o.x === x && o.y === y)) return true;
  return false;
}

function getObstacleCount() {
  if (score < 50) return 0;
  return 2 + Math.floor((score - 50) / 20);
}

function spawnObstacles() {
  // Only spawn the new ones (difference between target and existing clusters)
  const target = getObstacleCount();
  const existingClusters = obstacleClusterCount || 0;
  const count = target - existingClusters;
  obstacleClusterCount = target;
  if (count <= 0) return;
  const headZone = 5;

  for (let c = 0; c < count; c++) {
    const pattern = OBSTACLE_PATTERNS[Math.floor(Math.random() * OBSTACLE_PATTERNS.length)];
    let placed = false;

    for (let attempt = 0; attempt < 50; attempt++) {
      const ox = 2 + Math.floor(Math.random() * (GRID - 6));
      const oy = 2 + Math.floor(Math.random() * (GRID - 6));

      const blocks = pattern.map(p => ({ x: ox + p.x, y: oy + p.y }));

      // Check all blocks are valid
      const valid = blocks.every(b => {
        if (b.x < 1 || b.x >= GRID - 1 || b.y < 1 || b.y >= GRID - 1) return false;
        if (isOccupied(b.x, b.y)) return false;
        // Safe zone around snake head(s)
        const hd = Math.abs(b.x - snake[0].x) + Math.abs(b.y - snake[0].y);
        if (hd < headZone) return false;
        if (snake2) {
          const hd2 = Math.abs(b.x - snake2[0].x) + Math.abs(b.y - snake2[0].y);
          if (hd2 < headZone) return false;
        }
        return true;
      });

      if (valid) {
        blocks.forEach(b => obstacles.push(b));
        placed = true;
        break;
      }
    }
  }
}

function activateObstacles() {
  // Pause the game loop
  clearInterval(gameLoop);
  running = false;

  if (score === 50) {
    // First time: full flash + countdown
    cutscene = { phase: 'flash', timer: 0 };
  } else {
    // Subsequent: just spawn and quick countdown
    obstaclesActive = true;
    spawnObstacles();
    foods = [];
    spawnAllFood();
    cutscene = { phase: 'countdown', timer: 0, count: 3 };
  }
  runCutscene();
}

function runCutscene() {
  if (!cutscene) return;

  const { phase, timer } = cutscene;

  // Draw the current game state as background
  drawGameState();

  if (phase === 'flash') {
    // Pulsating white flash for ~60 frames (~1 second)
    const intensity = 0.5 + 0.4 * Math.sin(timer * 0.3);
    ctx.fillStyle = `rgba(255, 255, 255, ${intensity})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    cutscene.timer++;
    if (cutscene.timer > 60) {
      // Spawn new obstacles so they're visible during countdown
      obstaclesActive = true;
      spawnObstacles();
      foods = [];
      spawnAllFood();
      cutscene = { phase: 'countdown', timer: 0, count: 3 };
    }
    requestAnimationFrame(runCutscene);

  } else if (phase === 'countdown') {
    // Draw countdown number
    const count = cutscene.count;
    const progress = cutscene.timer / 40; // each number lasts 40 frames
    const scale = 1 + (1 - progress) * 0.5;
    const alpha = Math.max(0, 1 - progress * 0.5);

    // Dim overlay
    ctx.fillStyle = 'rgba(10, 10, 20, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(scale, scale);
    ctx.font = 'bold 72px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(34, 211, 238, ${alpha})`;
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 30 * alpha;
    ctx.fillText(count, 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();

    cutscene.timer++;
    if (cutscene.timer > 40) {
      cutscene.count--;
      cutscene.timer = 0;
      if (cutscene.count <= 0) {
        // End cutscene, resume game
        cutscene = null;
        running = true;
        currentTickInterval = SPEED_MIN;
        lastTickTime = performance.now();
        prevSnake = snake.map(s => ({ ...s }));
        if (snake2) prevSnake2 = snake2.map(s => ({ ...s }));
        gameLoop = setInterval(update, SPEED_MIN);
        return;
      }
    }
    requestAnimationFrame(runCutscene);
  }
}

function drawGameState() {
  // Redraw the game without the cutscene overlay (reuse draw logic)
  ctx.fillStyle = '#111122';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(255,255,255,0.02)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= GRID; i++) {
    ctx.beginPath();
    ctx.moveTo(i * TILE, 0);
    ctx.lineTo(i * TILE, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * TILE);
    ctx.lineTo(canvas.width, i * TILE);
    ctx.stroke();
  }

  drawSnake(snake, dir, '#22d3ee', '34, 211, 238');
  if (snake2) drawSnake(snake2, dir2, '#f472b6', '244, 114, 182');
  ctx.shadowBlur = 0;

  const pulse = 0.8 + 0.2 * Math.sin(Date.now() / 200);
  foods.forEach(f => {
    ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(f.x * TILE + TILE / 2, f.y * TILE + TILE / 2, TILE / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.shadowBlur = 0;

  if (obstaclesActive) {
    obstacles.forEach(o => {
      const shimmer = 0.7 + 0.15 * Math.sin(Date.now() / 300 + o.x * 0.5 + o.y * 0.7);
      ctx.fillStyle = `rgba(59, 130, 246, ${shimmer})`;
      ctx.shadowColor = '#3b82f6';
      ctx.shadowBlur = 6;
      roundRect(o.x * TILE + 1, o.y * TILE + 1, TILE - 2, TILE - 2, 4);
    });
    ctx.shadowBlur = 0;
  }
}

function moveSnake(s, d, nd, otherSnake) {
  d.x = nd.x;
  d.y = nd.y;
  const head = { x: s[0].x + d.x, y: s[0].y + d.y };

  // Wall collision
  if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) return null;
  // Self collision
  if (s.some(seg => seg.x === head.x && seg.y === head.y)) return null;
  // Other snake collision
  if (otherSnake && otherSnake.some(seg => seg.x === head.x && seg.y === head.y)) return null;
  // Obstacle collision
  if (obstacles.some(o => o.x === head.x && o.y === head.y)) return null;

  s.unshift(head);

  const eatenIndex = foods.findIndex(f => f.x === head.x && f.y === head.y);
  if (eatenIndex !== -1) {
    foods.splice(eatenIndex, 1);
    score++;
    scoreEl.textContent = score;
    eatFlash = 8;
    spawnParticles(head.x * TILE + TILE / 2, head.y * TILE + TILE / 2);
    return 'ate';
  } else {
    s.pop();
    return 'moved';
  }
}

function update() {
  if (!running) return;

  const prevScore = score;

  // Save previous positions for interpolation
  prevSnake = snake.map(s => ({ ...s }));
  if (snake2) prevSnake2 = snake2.map(s => ({ ...s }));

  // Move snake 1
  const result1 = moveSnake(snake, dir, nextDir, snake2);
  if (!result1) return endGame();

  // Move snake 2 in expert mode
  if (snake2) {
    const result2 = moveSnake(snake2, dir2, nextDir2, snake);
    if (!result2) return endGame();
  }

  lastTickTime = performance.now();
  if (eatFlash > 0) eatFlash--;

  const ate = score > prevScore;

  // Handle post-move (food respawn, speed, obstacles)
  if (ate && score >= 50 && score % 20 === 0) {
    activateObstacles();
  } else if (ate) {
    spawnAllFood();
    if (score < 50) {
      clearInterval(gameLoop);
      currentTickInterval = Math.max(SPEED_MIN, SPEED_INITIAL - score * 2.5);
      gameLoop = setInterval(update, currentTickInterval);
    }
  }
}

function lerpSnake(prev, curr, t) {
  return curr.map((seg, i) => {
    if (i >= prev.length) return seg; // new segment (just grew)
    return {
      x: prev[i].x + (seg.x - prev[i].x) * t,
      y: prev[i].y + (seg.y - prev[i].y) * t
    };
  });
}

function renderLoop() {
  animFrameId = requestAnimationFrame(renderLoop);
  if (cutscene) return; // cutscene handles its own drawing

  const now = performance.now();
  let t = Math.min(1, (now - lastTickTime) / currentTickInterval);
  if (!running || paused) t = 1; // snap to final position when stopped/paused

  const interpSnake = lerpSnake(prevSnake, snake, t);
  const interpSnake2 = snake2 ? lerpSnake(prevSnake2, snake2, t) : null;

  // Draw background
  ctx.fillStyle = '#111122';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(255,255,255,0.02)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= GRID; i++) {
    ctx.beginPath();
    ctx.moveTo(i * TILE, 0);
    ctx.lineTo(i * TILE, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * TILE);
    ctx.lineTo(canvas.width, i * TILE);
    ctx.stroke();
  }

  updateParticles();

  drawSnakeInterp(interpSnake, dir, '#22d3ee', '34, 211, 238');
  if (interpSnake2) drawSnakeInterp(interpSnake2, dir2, '#f472b6', '244, 114, 182');
  ctx.shadowBlur = 0;

  const pulse = 0.8 + 0.2 * Math.sin(Date.now() / 200);
  foods.forEach(f => {
    ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(f.x * TILE + TILE / 2, f.y * TILE + TILE / 2, TILE / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.shadowBlur = 0;

  if (obstaclesActive) {
    obstacles.forEach(o => {
      const shimmer = 0.7 + 0.15 * Math.sin(Date.now() / 300 + o.x * 0.5 + o.y * 0.7);
      ctx.fillStyle = `rgba(59, 130, 246, ${shimmer})`;
      ctx.shadowColor = '#3b82f6';
      ctx.shadowBlur = 6;
      roundRect(o.x * TILE + 1, o.y * TILE + 1, TILE - 2, TILE - 2, 4);
    });
    ctx.shadowBlur = 0;
  }

  drawParticles();

  // Pause overlay
  if (paused) {
    ctx.fillStyle = 'rgba(10, 10, 20, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.font = 'bold 64px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#22d3ee';
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 20;
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

function drawSnakeInterp(s, d, color, colorRgb) {
  s.forEach((seg, i) => {
    const brightness = Math.max(0.4, 1 - i * 0.03);
    if (i === 0) {
      if (eatFlash > 0) {
        ctx.fillStyle = '#fde047';
        ctx.shadowColor = '#fde047';
        ctx.shadowBlur = 20 + eatFlash * 2;
      } else {
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
      }
    } else {
      ctx.fillStyle = `rgba(${colorRgb}, ${brightness})`;
      ctx.shadowBlur = 0;
    }
    roundRect(seg.x * TILE + 1, seg.y * TILE + 1, TILE - 2, TILE - 2, 4);

    if (i === 0) {
      ctx.shadowBlur = 0;
      const cx = seg.x * TILE + TILE / 2;
      const cy = seg.y * TILE + TILE / 2;
      const dx = d.x, dy = d.y;
      const eye1x = cx + dx * 3 - dy * 3;
      const eye1y = cy + dy * 3 - dx * 3;
      const eye2x = cx + dx * 3 + dy * 3;
      const eye2y = cy + dy * 3 + dx * 3;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(eye1x, eye1y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(eye2x, eye2y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(eye1x + dx * 1, eye1y + dy * 1, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(eye2x + dx * 1, eye2y + dy * 1, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function draw() {
  ctx.fillStyle = '#111122';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(255,255,255,0.02)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= GRID; i++) {
    ctx.beginPath();
    ctx.moveTo(i * TILE, 0);
    ctx.lineTo(i * TILE, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * TILE);
    ctx.lineTo(canvas.width, i * TILE);
    ctx.stroke();
  }

  updateParticles();
  if (eatFlash > 0) eatFlash--;

  drawSnake(snake, dir, '#22d3ee', '34, 211, 238');
  if (snake2) drawSnake(snake2, dir2, '#f472b6', '244, 114, 182');
  ctx.shadowBlur = 0;

  const pulse = 0.8 + 0.2 * Math.sin(Date.now() / 200);
  foods.forEach(f => {
    ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(f.x * TILE + TILE / 2, f.y * TILE + TILE / 2, TILE / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.shadowBlur = 0;

  // Obstacles
  if (obstaclesActive) {
    obstacles.forEach(o => {
      const shimmer = 0.7 + 0.15 * Math.sin(Date.now() / 300 + o.x * 0.5 + o.y * 0.7);
      ctx.fillStyle = `rgba(59, 130, 246, ${shimmer})`;
      ctx.shadowColor = '#3b82f6';
      ctx.shadowBlur = 6;
      roundRect(o.x * TILE + 1, o.y * TILE + 1, TILE - 2, TILE - 2, 4);
    });
    ctx.shadowBlur = 0;
  }

  drawParticles();
}

function spawnParticles(cx, cy) {
  for (let i = 0; i < 12; i++) {
    const angle = (Math.PI * 2 / 12) * i + Math.random() * 0.5;
    const speed = 1.5 + Math.random() * 2.5;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.03 + Math.random() * 0.02,
      size: 2 + Math.random() * 3,
      color: Math.random() > 0.5 ? '74,222,128' : '250,204,21'
    });
  }
  particles.push({
    x: cx, y: cy, vx: 0, vy: 0,
    life: 1, decay: 0.05,
    ring: true, radius: 4
  });
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= p.decay;
    if (p.ring) {
      p.radius += 2.5;
    } else {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.95;
      p.vy *= 0.95;
    }
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  particles.forEach(p => {
    if (p.ring) {
      ctx.strokeStyle = `rgba(34, 211, 238, ${p.life * 0.6})`;
      ctx.lineWidth = 2 * p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(${p.color}, ${p.life})`;
      ctx.shadowColor = `rgba(${p.color}, ${p.life})`;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  });
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.fill();
}

async function endGame() {
  running = false;
  paused = false;
  clearInterval(gameLoop);
  pauseBtn.style.display = 'none';
  bgMusic.pause();
  if (score > highScore) {
    highScore = score;
    highEl.textContent = highScore;
    localStorage.setItem('snakeHigh', String(highScore));
  }
  finalScoreEl.textContent = score;
  pendingScore = score;

  const mode = expertMode ? 'expert' : 'normal';
  if (isTopTen(score, mode)) {
    highScoreEntryEl.style.display = 'block';
    submitScoreBtn.disabled = false;
    setTimeout(() => playerNameEl.focus(), 100);
  } else {
    highScoreEntryEl.style.display = 'none';
  }

  renderLeaderboard('gameOverLeaderboard', mode);
  gameOverEl.classList.add('active');
}

// Submit score handler
submitScoreBtn.addEventListener('click', async () => {
  const name = playerNameEl.value.trim();
  if (!name || pendingScore <= 0) return;
  submitScoreBtn.disabled = true;
  submitScoreBtn.textContent = '...';
  const mode = expertMode ? 'expert' : 'normal';
  await submitScore(name, pendingScore, mode);
  localStorage.setItem('snakePlayerName', name);
  pendingScore = 0;
  highScoreEntryEl.style.display = 'none';
  submitScoreBtn.textContent = 'Submit';
  renderLeaderboard('gameOverLeaderboard', mode);
});

// Allow Enter to submit name
playerNameEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    submitScoreBtn.click();
  }
  e.stopPropagation();
});

// Input
document.addEventListener('keydown', (e) => {
  if (!running || paused) return;
  const key = e.key.toLowerCase();

  if (expertMode) {
    // WASD controls snake 1
    switch (key) {
      case 'w': if (dir.y !== 1)  nextDir = { x: 0, y: -1 }; break;
      case 's': if (dir.y !== -1) nextDir = { x: 0, y: 1 };  break;
      case 'a': if (dir.x !== 1)  nextDir = { x: -1, y: 0 }; break;
      case 'd': if (dir.x !== -1) nextDir = { x: 1, y: 0 };  break;
    }
    // Arrow keys control snake 2
    switch (key) {
      case 'arrowup':    if (dir2.y !== 1)  nextDir2 = { x: 0, y: -1 }; break;
      case 'arrowdown':  if (dir2.y !== -1) nextDir2 = { x: 0, y: 1 };  break;
      case 'arrowleft':  if (dir2.x !== 1)  nextDir2 = { x: -1, y: 0 }; break;
      case 'arrowright': if (dir2.x !== -1) nextDir2 = { x: 1, y: 0 };  break;
    }
  } else {
    // Normal mode: both control snake 1
    switch (key) {
      case 'arrowup':    case 'w': if (dir.y !== 1)  nextDir = { x: 0, y: -1 }; break;
      case 'arrowdown':  case 's': if (dir.y !== -1) nextDir = { x: 0, y: 1 };  break;
      case 'arrowleft':  case 'a': if (dir.x !== 1)  nextDir = { x: -1, y: 0 }; break;
      case 'arrowright': case 'd': if (dir.x !== -1) nextDir = { x: 1, y: 0 };  break;
    }
  }

  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
    e.preventDefault();
  }
});

document.getElementById('restartBtn').addEventListener('click', init);
document.getElementById('menuBtn').addEventListener('click', () => {
  gameOverEl.classList.remove('active');
  startScreenEl.classList.add('active');
  renderLeaderboard('startLeaderboard', expertMode ? 'expert' : 'normal');
});
document.getElementById('startBtn').addEventListener('click', init);

// Mute toggle
const muteBtn = document.getElementById('muteBtn');
let musicMuted = false;

muteBtn.addEventListener('click', () => {
  musicMuted = !musicMuted;
  bgMusic.muted = musicMuted;
  muteBtn.textContent = musicMuted ? '\u{1F507}' : '\u{1F50A}';
});

function togglePause() {
  if (!running && !paused) return;
  if (cutscene) return;

  paused = !paused;
  if (paused) {
    clearInterval(gameLoop);
    pauseBtn.textContent = '\u25B6';
  } else {
    lastTickTime = performance.now();
    prevSnake = snake.map(s => ({ ...s }));
    if (snake2) prevSnake2 = snake2.map(s => ({ ...s }));
    gameLoop = setInterval(update, currentTickInterval);
    pauseBtn.textContent = '\u23F8';
  }
}

pauseBtn.addEventListener('click', togglePause);

// Spacebar to start/restart/pause
document.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    e.preventDefault();
    if (document.activeElement === playerNameEl) return;
    if (running || paused) {
      togglePause();
    } else if (!cutscene) {
      init();
    }
  }
});

// Mobile control type toggle
let mobileControlType = 'swipe';
const dpadEl = document.getElementById('dpad');
const ctrlSwipeBtn = document.getElementById('ctrlSwipe');
const ctrlTapBtn = document.getElementById('ctrlTap');
const ctrlDpadBtn = document.getElementById('ctrlDpad');

function setMobileControl(type) {
  mobileControlType = type;
  ctrlSwipeBtn.classList.toggle('active', type === 'swipe');
  ctrlTapBtn.classList.toggle('active', type === 'tap');
  ctrlDpadBtn.classList.toggle('active', type === 'dpad');
  dpadEl.classList.toggle('active', type === 'dpad');
}

ctrlSwipeBtn.addEventListener('click', () => setMobileControl('swipe'));
ctrlTapBtn.addEventListener('click', () => setMobileControl('tap'));
ctrlDpadBtn.addEventListener('click', () => setMobileControl('dpad'));

// D-pad input
dpadEl.querySelectorAll('.dpad-btn[data-dir]').forEach(btn => {
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!running || paused) return;
    switch (btn.dataset.dir) {
      case 'up':    if (dir.y !== 1)  nextDir = { x: 0, y: -1 }; break;
      case 'down':  if (dir.y !== -1) nextDir = { x: 0, y: 1 };  break;
      case 'left':  if (dir.x !== 1)  nextDir = { x: -1, y: 0 }; break;
      case 'right': if (dir.x !== -1) nextDir = { x: 1, y: 0 };  break;
    }
  }, { passive: false });
});

// Touch/swipe controls for mobile
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (!running || paused) return;

  if (mobileControlType === 'swipe') {
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const minSwipe = 20;

    if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0 && dir.x !== -1) nextDir = { x: 1, y: 0 };
      else if (dx < 0 && dir.x !== 1) nextDir = { x: -1, y: 0 };
    } else {
      if (dy > 0 && dir.y !== -1) nextDir = { x: 0, y: 1 };
      else if (dy < 0 && dir.y !== 1) nextDir = { x: 0, y: -1 };
    }
  } else if (mobileControlType === 'tap') {
    const touch = e.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    // Convert tap to grid coordinates
    const tapX = (touch.clientX - rect.left) / rect.width * GRID;
    const tapY = (touch.clientY - rect.top) / rect.height * GRID;
    const head = snake[0];
    const dx = tapX - head.x;
    const dy = tapY - head.y;

    // Turn toward the tap along the axis with the greater difference
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0 && dir.x !== -1) nextDir = { x: 1, y: 0 };
      else if (dx < 0 && dir.x !== 1) nextDir = { x: -1, y: 0 };
    } else {
      if (dy > 0 && dir.y !== -1) nextDir = { x: 0, y: 1 };
      else if (dy < 0 && dir.y !== 1) nextDir = { x: 0, y: -1 };
    }
  }
}, { passive: false });

// Show start screen & load leaderboard
startScreenEl.classList.add('active');
ctx.fillStyle = '#111122';
ctx.fillRect(0, 0, canvas.width, canvas.height);

fetchAllLeaderboards().then(() => {
  renderLeaderboard('startLeaderboard');
  renderLeaderboard('gameOverLeaderboard');
});

// Start the chase animation
initChaseAnimation();
