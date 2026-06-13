'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // N - tuerca (anillo con hueco)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca (anillo, hueco central)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');

const startOverlay = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-btn');
const startHighscoresEl = document.getElementById('start-highscores');
const startBestComboEl = document.getElementById('start-best-combo');
const startMaxLinesEl = document.getElementById('start-max-lines');
const resetRecordsBtn = document.getElementById('reset-records-btn');

const newRecordForm = document.getElementById('new-record-form');
const playerNameInput = document.getElementById('player-name');
const saveScoreBtn = document.getElementById('save-score-btn');
const gameoverRecordsPanel = document.getElementById('gameover-records-panel');
const gameoverHighscoresEl = document.getElementById('gameover-highscores');
const goBestComboEl = document.getElementById('go-best-combo');
const goMaxLinesEl = document.getElementById('go-max-lines');
const resetRecordsBtnGo = document.getElementById('reset-records-btn-go');

const THEME_KEY = 'tetris-theme';
const HS_KEY = 'tetris-highscores';
const STATS_KEY = 'tetris-stats';

let board, current, next, score, lines, level, combo, maxCombo, pendingEntry, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let gridColor = '#22222e';

function refreshThemeColors() {
  gridColor = getComputedStyle(document.body).getPropertyValue('--grid-line').trim();
}

function setTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  themeToggle.checked = theme === 'light';
  localStorage.setItem(THEME_KEY, theme);
  refreshThemeColors();
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  setTheme(saved === 'light' ? 'light' : 'dark');
}

function loadHighScores() {
  try {
    const data = JSON.parse(localStorage.getItem(HS_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveHighScores(list) {
  localStorage.setItem(HS_KEY, JSON.stringify(list));
}

function loadStats() {
  try {
    const data = JSON.parse(localStorage.getItem(STATS_KEY)) || {};
    return { bestCombo: data.bestCombo || 0, maxLines: data.maxLines || 0 };
  } catch {
    return { bestCombo: 0, maxLines: 0 };
  }
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function qualifiesForTop(value) {
  const scores = loadHighScores();
  if (scores.length < 5) return true;
  return value > scores[scores.length - 1].score;
}

function renderHighScores(listEl, pending) {
  let list = loadHighScores();
  if (pending && !list.some(e => e.id === pending.id)) list = list.concat([pending]);
  list.sort((a, b) => b.score - a.score);
  list = list.slice(0, 5);

  listEl.innerHTML = '';
  if (list.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Sin récords todavía';
    listEl.appendChild(li);
    return;
  }
  list.forEach((entry, i) => {
    const li = document.createElement('li');
    if (pending && entry.id === pending.id) li.classList.add('highlight');
    const rank = document.createElement('span');
    rank.className = 'rank';
    rank.textContent = `${i + 1}.`;
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = entry.name || '???';
    const sc = document.createElement('span');
    sc.className = 'hs-score';
    sc.textContent = entry.score.toLocaleString();
    li.append(rank, name, sc);
    listEl.appendChild(li);
  });
}

function renderStats(comboEl, maxLinesEl, stats) {
  comboEl.textContent = stats.bestCombo;
  maxLinesEl.textContent = stats.maxLines;
}

function refreshRecordsUI() {
  const stats = loadStats();
  renderHighScores(startHighscoresEl, null);
  renderStats(startBestComboEl, startMaxLinesEl, stats);
  if (gameOver) {
    renderHighScores(gameoverHighscoresEl, pendingEntry);
    renderStats(goBestComboEl, goMaxLinesEl, stats);
  }
}

function resetRecords() {
  if (!confirm('¿Borrar todos los récords guardados?')) return;
  localStorage.removeItem(HS_KEY);
  localStorage.removeItem(STATS_KEY);
  pendingEntry = null;
  newRecordForm.classList.add('hidden');
  refreshRecordsUI();
}

function saveScore() {
  if (!pendingEntry) return;
  const name = playerNameInput.value.trim().slice(0, 12) || 'Jugador';
  pendingEntry.name = name;
  const scores = loadHighScores();
  scores.push(pendingEntry);
  scores.sort((a, b) => b.score - a.score);
  saveHighScores(scores.slice(0, 5));
  newRecordForm.classList.add('hidden');
  renderHighScores(gameoverHighscoresEl, pendingEntry);
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  const cleared = clearLines();
  if (cleared > 0) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
  } else {
    combo = 0;
  }
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;

  const stats = loadStats();
  stats.maxLines = Math.max(stats.maxLines, lines);
  stats.bestCombo = Math.max(stats.bestCombo, maxCombo);
  saveStats(stats);

  pendingEntry = qualifiesForTop(score)
    ? { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, score, lines, level, name: '' }
    : null;

  if (pendingEntry) {
    newRecordForm.classList.remove('hidden');
    playerNameInput.value = '';
  } else {
    newRecordForm.classList.add('hidden');
  }

  gameoverRecordsPanel.classList.remove('hidden');
  renderHighScores(gameoverHighscoresEl, pendingEntry);
  renderStats(goBestComboEl, goMaxLinesEl, stats);

  overlay.classList.remove('hidden');
  if (pendingEntry) playerNameInput.focus();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    newRecordForm.classList.add('hidden');
    gameoverRecordsPanel.classList.add('hidden');
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  maxCombo = 0;
  pendingEntry = null;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  newRecordForm.classList.add('hidden');
  gameoverRecordsPanel.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (!startOverlay.classList.contains('hidden')) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

themeToggle.addEventListener('change', () => {
  setTheme(themeToggle.checked ? 'light' : 'dark');
  draw();
});

startBtn.addEventListener('click', () => {
  startOverlay.classList.add('hidden');
  init();
});

resetRecordsBtn.addEventListener('click', resetRecords);
resetRecordsBtnGo.addEventListener('click', resetRecords);

saveScoreBtn.addEventListener('click', saveScore);
playerNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveScore();
  }
});

initTheme();
refreshRecordsUI();
