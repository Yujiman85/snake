export function initChaseAnimation() {
  const sc = document.getElementById('sceneCanvas');
  const sctx = sc.getContext('2d');
  const W = sc.width, H = sc.height;
  const SEG = 10;
  const SNAKE_LEN = 6;
  const FOOD_R = 5;
  const MID_Y = H / 2;

  let phase, timer, snakeX, foodX, foodLegs, snakeSpeed, foodSpeed;

  function resetScene() {
    phase = 'approach';
    timer = 0;
    snakeX = -SNAKE_LEN * (SEG + 2);
    foodX = W * 0.6;
    foodLegs = 0;
    snakeSpeed = 1.2;
    foodSpeed = 0;
  }
  resetScene();

  function drawSceneSnake(x, y) {
    for (let i = SNAKE_LEN - 1; i >= 0; i--) {
      const sx = x - i * (SEG + 2);
      const alpha = Math.max(0.4, 1 - i * 0.1);
      if (i === 0) {
        sctx.fillStyle = '#22d3ee';
        sctx.shadowColor = '#22d3ee';
        sctx.shadowBlur = 8;
      } else {
        sctx.fillStyle = `rgba(34, 211, 238, ${alpha})`;
        sctx.shadowBlur = 0;
      }
      const r = 3, sz = SEG;
      const bx = sx - sz / 2, by = y - sz / 2;
      sctx.beginPath();
      sctx.moveTo(bx + r, by);
      sctx.lineTo(bx + sz - r, by);
      sctx.quadraticCurveTo(bx + sz, by, bx + sz, by + r);
      sctx.lineTo(bx + sz, by + sz - r);
      sctx.quadraticCurveTo(bx + sz, by + sz, bx + sz - r, by + sz);
      sctx.lineTo(bx + r, by + sz);
      sctx.quadraticCurveTo(bx, by + sz, bx, by + sz - r);
      sctx.lineTo(bx, by + r);
      sctx.quadraticCurveTo(bx, by, bx + r, by);
      sctx.fill();

      if (i === 0) {
        sctx.shadowBlur = 0;
        sctx.fillStyle = '#fff';
        sctx.beginPath(); sctx.arc(sx + 1, y - 2, 1.5, 0, Math.PI * 2); sctx.fill();
        sctx.beginPath(); sctx.arc(sx + 1, y + 2, 1.5, 0, Math.PI * 2); sctx.fill();
        sctx.fillStyle = '#111';
        sctx.beginPath(); sctx.arc(sx + 2, y - 2, 0.8, 0, Math.PI * 2); sctx.fill();
        sctx.beginPath(); sctx.arc(sx + 2, y + 2, 0.8, 0, Math.PI * 2); sctx.fill();
      }
    }
    sctx.shadowBlur = 0;
  }

  function drawFood(x, y, isRunning) {
    const pulse = 0.8 + 0.2 * Math.sin(Date.now() / 200);
    sctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
    sctx.shadowColor = '#ef4444';
    sctx.shadowBlur = isRunning ? 6 : 10;
    sctx.beginPath();
    sctx.arc(x, y, FOOD_R, 0, Math.PI * 2);
    sctx.fill();
    sctx.shadowBlur = 0;

    if (isRunning) {
      foodLegs += 0.3;
      const legSwing = Math.sin(foodLegs * 8) * 4;
      sctx.strokeStyle = '#ef4444';
      sctx.lineWidth = 1.5;
      sctx.lineCap = 'round';
      sctx.beginPath(); sctx.moveTo(x - 2, y + FOOD_R - 1); sctx.lineTo(x - 2 + legSwing, y + FOOD_R + 6); sctx.stroke();
      sctx.beginPath(); sctx.moveTo(x + 2, y + FOOD_R - 1); sctx.lineTo(x + 2 - legSwing, y + FOOD_R + 6); sctx.stroke();
      sctx.fillStyle = '#fff';
      sctx.beginPath(); sctx.arc(x - 2, y - 1, 2, 0, Math.PI * 2); sctx.fill();
      sctx.beginPath(); sctx.arc(x + 2, y - 1, 2, 0, Math.PI * 2); sctx.fill();
      sctx.fillStyle = '#111';
      sctx.beginPath(); sctx.arc(x - 2, y - 1, 1, 0, Math.PI * 2); sctx.fill();
      sctx.beginPath(); sctx.arc(x + 2, y - 1, 1, 0, Math.PI * 2); sctx.fill();
      sctx.beginPath(); sctx.arc(x, y + 2, 1.2, 0, Math.PI * 2); sctx.fill();
    }
  }

  let animId = null;
  let stopped = false;

  function animateScene() {
    if (stopped) return;
    // Skip rendering when canvas is not visible (e.g., during gameplay)
    if (sc.offsetParent === null) {
      animId = requestAnimationFrame(animateScene);
      return;
    }
    sctx.clearRect(0, 0, W, H);
    switch (phase) {
      case 'approach':
        snakeX += snakeSpeed;
        if (snakeX >= foodX - 30) { phase = 'pause'; timer = 0; }
        drawSceneSnake(snakeX, MID_Y);
        drawFood(foodX, MID_Y, false);
        break;
      case 'pause':
        timer++;
        const wiggle = Math.sin(timer * 0.3) * 0.5;
        drawSceneSnake(snakeX, MID_Y + wiggle);
        drawFood(foodX, MID_Y, false);
        if (timer > 50) { phase = 'chase'; foodSpeed = 1.8; snakeSpeed = 2.2; }
        break;
      case 'chase':
        foodX += foodSpeed;
        snakeX += snakeSpeed;
        foodSpeed = Math.min(foodSpeed + 0.01, 2.8);
        snakeSpeed = Math.min(snakeSpeed + 0.008, 3.0);
        drawSceneSnake(snakeX, MID_Y);
        drawFood(foodX, MID_Y, true);
        if (snakeX - SNAKE_LEN * (SEG + 2) > W) { phase = 'wait'; timer = 0; }
        break;
      case 'wait':
        timer++;
        if (timer > 60) resetScene();
        break;
    }
    animId = requestAnimationFrame(animateScene);
  }
  animId = requestAnimationFrame(animateScene);

  return function stop() {
    stopped = true;
    if (animId) cancelAnimationFrame(animId);
  };
}
