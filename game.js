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
const skinSelect = document.getElementById('skin-select');

const pauseOverlay = document.getElementById('pause-overlay');
const pauseMenuMain = document.getElementById('pause-menu-main');
const pauseMenuControls = document.getElementById('pause-menu-controls');
const resumeBtn = document.getElementById('resume-btn');
const restartPauseBtn = document.getElementById('restart-pause-btn');
const showControlsBtn = document.getElementById('show-controls-btn');
const backBtn = document.getElementById('back-btn');
const startLevelSelect = document.getElementById('start-level-select');

const SKIN_KEY = 'tetris-skin';
const SKIN_VARS = ['--board-bg', '--board-border', '--board-shadow', '--grid-line'];

const SKINS = {
  retro: {
    colors: COLORS,
    vars: null,
    draw: drawBlockRetro,
  },
  neon: {
    colors: [null, '#00f0ff', '#faff00', '#ff00c8', '#00ff6a', '#ff2d55', '#3d8bff', '#ff9100', '#ffffff'],
    vars: {
      '--board-bg': '#000000',
      '--board-border': '#00f0ff',
      '--board-shadow': 'rgba(0, 240, 255, 0.45)',
      '--grid-line': '#0a1a1f',
    },
    draw: drawBlockNeon,
  },
  pastel: {
    colors: [null, '#a8dadc', '#ffe5a8', '#d8b4e2', '#b8e8c4', '#ffb3ba', '#bcd4f0', '#ffd9a0', '#dcdde6'],
    vars: {
      '--board-bg': '#fdf6f0',
      '--board-border': '#e9d8f5',
      '--board-shadow': 'rgba(0, 0, 0, 0.08)',
      '--grid-line': '#f3ecf7',
    },
    draw: drawBlockPastel,
  },
  pixel: {
    colors: [null, '#00d8d8', '#d8d800', '#9800d8', '#00b800', '#d80000', '#0040d8', '#d87800', '#a0a0a0'],
    vars: {
      '--board-bg': '#181818',
      '--board-border': '#4a4a4a',
      '--board-shadow': 'rgba(0, 0, 0, 0.6)',
      '--grid-line': '#2c2c2c',
    },
    draw: drawBlockPixel,
  },
};

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
let startLevel = 1;
let currentSkin = 'retro';

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

function applySkinVars(skinKey) {
  SKIN_VARS.forEach(v => document.body.style.removeProperty(v));
  const vars = SKINS[skinKey].vars;
  if (vars) for (const key in vars) document.body.style.setProperty(key, vars[key]);
  refreshThemeColors();
}

function setSkin(skinKey) {
  currentSkin = SKINS[skinKey] ? skinKey : 'retro';
  applySkinVars(currentSkin);
  skinSelect.value = currentSkin;
  localStorage.setItem(SKIN_KEY, currentSkin);
  draw();
  drawNext();
}

function initSkin() {
  const saved = localStorage.getItem(SKIN_KEY);
  currentSkin = SKINS[saved] ? saved : 'retro';
  applySkinVars(currentSkin);
  skinSelect.value = currentSkin;
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
    level = startLevel + Math.floor(lines / 10);
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
  const skin = SKINS[currentSkin] || SKINS.retro;
  const color = skin.colors[colorIndex];
  skin.draw(context, x, y, color, size, alpha);
}

function drawBlockRetro(context, x, y, color, size, alpha) {
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawBlockNeon(context, x, y, color, size, alpha) {
  const px = x * size + 2;
  const py = y * size + 2;
  const s = size - 4;
  context.save();
  context.globalAlpha = alpha ?? 1;
  context.shadowColor = color;
  context.shadowBlur = size * 0.7;
  context.fillStyle = color;
  context.fillRect(px, py, s, s);
  context.shadowBlur = 0;
  context.strokeStyle = 'rgba(255,255,255,0.6)';
  context.lineWidth = 1;
  context.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
  context.restore();
}

function roundedRectPath(context, x, y, w, h, r) {
  if (context.roundRect) {
    context.roundRect(x, y, w, h, r);
    return;
  }
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawBlockPastel(context, x, y, color, size, alpha) {
  const px = x * size + 1.5;
  const py = y * size + 1.5;
  const s = size - 3;
  const r = Math.min(6, s / 3);
  context.save();
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.beginPath();
  roundedRectPath(context, px, py, s, s, r);
  context.fill();
  context.fillStyle = 'rgba(255,255,255,0.45)';
  context.beginPath();
  context.arc(px + s * 0.32, py + s * 0.32, s * 0.16, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawBlockPixel(context, x, y, color, size, alpha) {
  const px = x * size + 1;
  const py = y * size + 1;
  const s = size - 2;
  const sub = s / 4;
  context.save();
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(px, py, s, s);
  context.fillStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if ((i + j) % 2 === 0) context.fillRect(px + i * sub, py + j * sub, sub, sub);
    }
  }
  context.strokeStyle = 'rgba(0,0,0,0.35)';
  context.lineWidth = 1;
  context.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
  context.restore();
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

function openPauseMenu() {
  pauseMenuControls.classList.add('hidden');
  pauseMenuMain.classList.remove('hidden');
  pauseOverlay.classList.remove('hidden');
  resumeBtn.focus();
}

function closePauseMenu() {
  pauseOverlay.classList.add('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    closePauseMenu();
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    openPauseMenu();
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
  level = startLevel;
  combo = 0;
  maxCombo = 0;
  pendingEntry = null;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  closePauseMenu();
  newRecordForm.classList.add('hidden');
  gameoverRecordsPanel.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyX'];

document.addEventListener('keydown', e => {
  if (!startOverlay.classList.contains('hidden')) return;
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    return;
  }
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

resumeBtn.addEventListener('click', togglePause);

restartPauseBtn.addEventListener('click', () => {
  closePauseMenu();
  init();
});

showControlsBtn.addEventListener('click', () => {
  pauseMenuMain.classList.add('hidden');
  pauseMenuControls.classList.remove('hidden');
  backBtn.focus();
});

backBtn.addEventListener('click', () => {
  pauseMenuControls.classList.add('hidden');
  pauseMenuMain.classList.remove('hidden');
  resumeBtn.focus();
});

startLevelSelect.addEventListener('change', () => {
  startLevel = parseInt(startLevelSelect.value, 10);
});

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

skinSelect.addEventListener('change', () => setSkin(skinSelect.value));

initTheme();
initSkin();
refreshRecordsUI();
