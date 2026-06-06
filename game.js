// ============================================================
//  LUMINO — Platformer Engine
//  HTML5 Canvas · Keyboard + Touch Virtual Pad
// ============================================================

const canvas  = document.getElementById('gameCanvas');
const ctx     = canvas.getContext('2d');

// ── Screens ──────────────────────────────────────────────────
const S = {
  title : document.getElementById('screen-title'),
  game  : document.getElementById('screen-game'),
  death : document.getElementById('screen-death'),
  win   : document.getElementById('screen-win'),
};
function showScreen(name) {
  Object.values(S).forEach(s => s.classList.remove('active'));
  S[name].classList.add('active');
}

// ── State globals ─────────────────────────────────────────────
let score = 0, lives = 3, currentLevel = 0;
let gameRunning = false, raf;

// ── Input (keyboard + virtual pad) ───────────────────────────
const keys = { left: false, right: false, jump: false, attack: false };
let jumpPressed = false; // edge detection for jump

document.addEventListener('keydown', e => {
  if (['ArrowLeft','a','A'].includes(e.key))  keys.left  = true;
  if (['ArrowRight','d','D'].includes(e.key)) keys.right = true;
  if (['ArrowUp','z','Z','w','W',' '].includes(e.key)) {
    if (!keys.jump) jumpPressed = true;
    keys.jump = true;
  }
  if (['x','X','ArrowDown'].includes(e.key))  keys.attack = true;
  e.preventDefault();
});
document.addEventListener('keyup', e => {
  if (['ArrowLeft','a','A'].includes(e.key))  keys.left  = false;
  if (['ArrowRight','d','D'].includes(e.key)) keys.right = false;
  if (['ArrowUp','z','Z','w','W',' '].includes(e.key)) { keys.jump = false; }
  if (['x','X','ArrowDown'].includes(e.key))  keys.attack = false;
});

// Virtual pad
function setupPad() {
  const padLeft   = document.getElementById('pad-left');
  const padRight  = document.getElementById('pad-right');
  const padJump   = document.getElementById('pad-jump');
  const padAttack = document.getElementById('pad-attack');

  // Re-lay out pad with two groups
  const vpad = document.getElementById('virtual-pad');
  vpad.innerHTML = '';

  const leftGroup = document.createElement('div');
  leftGroup.className = 'left-group';
  leftGroup.style.cssText = 'display:flex;gap:10px;align-items:center;';

  const rightGroup = document.createElement('div');
  rightGroup.className = 'right-group';
  rightGroup.style.cssText = 'display:flex;gap:10px;align-items:center;';

  function makeBtn(id, label, cls) {
    const b = document.createElement('div');
    b.id = id; b.className = 'pad-btn ' + cls;
    b.textContent = label; b.style.cssText = '';
    return b;
  }

  const bL = makeBtn('pad-left',   '◀', 'pad-dir');
  const bR = makeBtn('pad-right',  '▶', 'pad-dir');
  const bJ = makeBtn('pad-jump',   '↑', 'pad-action');
  const bA = makeBtn('pad-attack', '👊','pad-action');

  leftGroup.append(bL, bR);
  rightGroup.append(bA, bJ);
  vpad.append(leftGroup, rightGroup);

  function bind(btn, key, isJump) {
    ['touchstart','mousedown'].forEach(ev =>
      btn.addEventListener(ev, e => {
        e.preventDefault();
        keys[key] = true;
        if (isJump) jumpPressed = true;
        btn.classList.add('pressed');
      }, { passive: false })
    );
    ['touchend','touchcancel','mouseup','mouseleave'].forEach(ev =>
      btn.addEventListener(ev, e => {
        e.preventDefault();
        keys[key] = false;
        btn.classList.remove('pressed');
      }, { passive: false })
    );
  }

  bind(bL, 'left',   false);
  bind(bR, 'right',  false);
  bind(bJ, 'jump',   true);
  bind(bA, 'attack', false);
}

// ── Resize canvas ─────────────────────────────────────────────
function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', () => { resizeCanvas(); if (gameRunning) buildLevel(); });
resizeCanvas();

// ── Colour palette ────────────────────────────────────────────
const COL = {
  sky:       ['#7ecbff','#a8e6ff'],
  ground:    '#5ecf3e',
  groundDark:'#3faa1e',
  dirt:      '#b97a3a',
  dirtDark:  '#8a5520',
  brick:     '#e8a030',
  brickDark: '#c07010',
  coin:      '#ffe066',
  coinShine: '#fff8a0',
  gem:       '#ff4fa3',
  spike:     '#e03030',
  portal:    '#b47aff',
  portalGlow:'#e0c8ff',
  enemy1:    '#e03c3c',
  enemy2:    '#c02020',
  player:    '#ff7c2a',
  playerSkin:'#ffd1a8',
};

// ── LEVEL DATA ────────────────────────────────────────────────
// Each level: platforms, coins, gems, enemies, spikes, portal
// All in a "world" coordinate system (pixels); camera scrolls

const TILE = 40;

function makePlatform(x, y, w, type='ground') {
  return { x, y, w: w * TILE, h: TILE, type };
}

const LEVELS = [
  // ── Niveau 1 ─────────────────────────────────────────────
  () => {
    const W = 3200, H = canvas.height;
    const gY = H - TILE;
    const plats = [
      makePlatform(0,     gY,  80, 'ground'), // sol principal
      makePlatform(500,   gY - 120, 4,  'ground'),
      makePlatform(800,   gY - 80,  5,  'brick'),
      makePlatform(1100,  gY - 160, 4,  'ground'),
      makePlatform(1400,  gY - 80,  6,  'brick'),
      makePlatform(1700,  gY - 200, 4,  'ground'),
      makePlatform(2000,  gY - 120, 5,  'brick'),
      makePlatform(2300,  gY - 80,  5,  'ground'),
      makePlatform(2600,  gY - 180, 4,  'brick'),
      makePlatform(2900,  gY - 100, 8,  'ground'),
    ];
    const coins = [
      ...row(550,  gY - 180, 3),
      ...row(820,  gY - 140, 4),
      ...row(1120, gY - 220, 3),
      ...row(1430, gY - 140, 5),
      ...row(1720, gY - 260, 3),
      ...row(2020, gY - 180, 4),
      ...row(2620, gY - 240, 3),
    ];
    const gems = [
      { x: 680, y: gY - 100 },
      { x: 1280, y: gY - 200 },
      { x: 2150, y: gY - 160 },
      { x: 2750, y: gY - 220 },
    ];
    const enemies = [
      enemy(900,  gY - TILE - 32, 820,  1000),
      enemy(1500, gY - TILE - 32, 1400, 1600),
      enemy(2050, gY - TILE - 32, 2000, 2200),
      enemy(2350, gY - TILE - 32, 2300, 2550),
    ];
    const spikes = [
      ...spikeRow(660, gY - TILE, 2),
      ...spikeRow(1250, gY - TILE, 2),
      ...spikeRow(1900, gY - TILE, 3),
    ];
    const portal = { x: 3060, y: gY - 110 };
    return { W, H, plats, coins, gems, enemies, spikes, portal, bgColors: ['#7ecbff','#c8ecff'] };
  },

  // ── Niveau 2 ─────────────────────────────────────────────
  () => {
    const W = 3600, H = canvas.height;
    const gY = H - TILE;
    const plats = [
      makePlatform(0,    gY,       80, 'ground'),
      makePlatform(450,  gY-100,   4,  'brick'),
      makePlatform(700,  gY-200,   4,  'brick'),
      makePlatform(950,  gY-100,   4,  'ground'),
      makePlatform(1200, gY-220,   5,  'brick'),
      makePlatform(1550, gY-160,   4,  'ground'),
      makePlatform(1800, gY-280,   4,  'brick'),
      makePlatform(2100, gY-120,   5,  'ground'),
      makePlatform(2450, gY-240,   4,  'brick'),
      makePlatform(2750, gY-160,   5,  'ground'),
      makePlatform(3100, gY-280,   5,  'brick'),
      makePlatform(3400, gY-100,   8,  'ground'),
    ];
    const coins = [
      ...row(470,  gY-160, 3),
      ...row(720,  gY-260, 3),
      ...row(970,  gY-160, 4),
      ...row(1230, gY-280, 4),
      ...row(1820, gY-340, 3),
      ...row(2470, gY-300, 3),
      ...row(3120, gY-340, 4),
    ];
    const gems = [
      { x:830,  y:gY-260 },
      { x:1380, y:gY-280 },
      { x:2250, y:gY-180 },
      { x:3250, y:gY-340 },
    ];
    const enemies = [
      enemy(500,  gY - TILE - 32, 450,  650),
      enemy(1000, gY - TILE - 32, 950,  1150),
      enemy(1600, gY - TILE - 32, 1550, 1780),
      enemy(2150, gY - TILE - 32, 2100, 2420),
      enemy(2800, gY - TILE - 32, 2750, 3070),
      enemy(3120, gY - TILE - 32, 3100, 3380),
    ];
    const spikes = [
      ...spikeRow(620,  gY-TILE, 2),
      ...spikeRow(1450, gY-TILE, 3),
      ...spikeRow(2050, gY-TILE, 3),
      ...spikeRow(2650, gY-TILE, 2),
    ];
    const portal = { x: 3500, y: gY - 110 };
    return { W, H, plats, coins, gems, enemies, spikes, portal, bgColors: ['#e08850','#ffd8a0'] };
  },

  // ── Niveau 3 ─────────────────────────────────────────────
  () => {
    const W = 4000, H = canvas.height;
    const gY = H - TILE;
    const plats = [
      makePlatform(0,    gY,       80, 'ground'),
      makePlatform(400,  gY-140,   3,  'brick'),
      makePlatform(650,  gY-280,   3,  'brick'),
      makePlatform(900,  gY-140,   3,  'ground'),
      makePlatform(1150, gY-300,   4,  'brick'),
      makePlatform(1500, gY-160,   3,  'ground'),
      makePlatform(1750, gY-320,   3,  'brick'),
      makePlatform(2050, gY-160,   4,  'ground'),
      makePlatform(2350, gY-300,   3,  'brick'),
      makePlatform(2650, gY-160,   3,  'ground'),
      makePlatform(2900, gY-340,   4,  'brick'),
      makePlatform(3250, gY-200,   4,  'ground'),
      makePlatform(3550, gY-360,   4,  'brick'),
      makePlatform(3750, gY-160,   8,  'ground'),
    ];
    const coins = [
      ...row(420,  gY-200, 2),
      ...row(670,  gY-340, 2),
      ...row(1170, gY-360, 3),
      ...row(1770, gY-380, 2),
      ...row(2370, gY-360, 2),
      ...row(2920, gY-400, 3),
      ...row(3570, gY-420, 3),
    ];
    const gems = [
      {x:780, y:gY-320},
      {x:1650,y:gY-220},
      {x:2200,y:gY-220},
      {x:3070,y:gY-400},
      {x:3660,y:gY-420},
    ];
    const enemies = [
      enemy(430,  gY-TILE-32, 400,  600),
      enemy(930,  gY-TILE-32, 900,  1120),
      enemy(1530, gY-TILE-32, 1500, 1720),
      enemy(2080, gY-TILE-32, 2050, 2320),
      enemy(2680, gY-TILE-32, 2650, 2870),
      enemy(3280, gY-TILE-32, 3250, 3520),
      enemy(3780, gY-TILE-32, 3750, 3980),
    ];
    const spikes = [
      ...spikeRow(580,  gY-TILE, 3),
      ...spikeRow(1080, gY-TILE, 3),
      ...spikeRow(1680, gY-TILE, 3),
      ...spikeRow(2480, gY-TILE, 4),
      ...spikeRow(3080, gY-TILE, 3),
    ];
    const portal = { x: 3870, y: gY - 110 };
    return { W, H, plats, coins, gems, enemies, spikes, portal, bgColors: ['#6040a8','#b090ff'] };
  },
];

function row(x, y, n) {
  return Array.from({length: n}, (_,i) => ({ x: x + i*50, y }));
}
function spikeRow(x, y, n) {
  return Array.from({length: n}, (_,i) => ({ x: x + i*TILE, y }));
}
function enemy(x, y, xMin, xMax) {
  return { x, y, w: 36, h: 32, vx: 1.5, xMin, xMax, alive: true, hitTimer: 0 };
}

// ── Game state ────────────────────────────────────────────────
let level = null;
let camera = { x: 0 };

let player = null;

function createPlayer() {
  const H = canvas.height;
  return {
    x: 80, y: H - TILE - 64,
    w: 36, h: 52,
    vx: 0, vy: 0,
    onGround: false,
    facingRight: true,
    attacking: false,
    attackTimer: 0,
    hitTimer: 0,       // invincibility frames
    alive: true,
    // animation
    frame: 0,
    frameTimer: 0,
    state: 'idle',     // idle / run / jump / fall / attack / hurt
  };
}

// ── Coin / gem animation list ──────────────────────────────────
let particles = [];

function spawnParticle(x, y, col) {
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const speed = 2 + Math.random() * 3;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      col,
      r: 4 + Math.random() * 4,
    });
  }
}

// ── Build / start level ───────────────────────────────────────
function buildLevel() {
  level = LEVELS[currentLevel % LEVELS.length]();
  // Reset coin/gem collected state
  level.coins.forEach(c => c.collected = false);
  level.gems.forEach(g => g.collected = false);
  level.enemies.forEach(e => e.alive = true);
  camera.x = 0;
  particles = [];
}

function startGame() {
  score = 0;
  lives = 3;
  currentLevel = 0;
  updateHUD();
  buildLevel();
  player = createPlayer();
  gameRunning = true;
  showScreen('game');
  if (raf) cancelAnimationFrame(raf);
  loop();
}

function nextLevel() {
  currentLevel++;
  if (currentLevel >= LEVELS.length) {
    // Victory final — restart from level 1 as "infinite"
    currentLevel = 0;
  }
  buildLevel();
  player = createPlayer();
  gameRunning = true;
  updateHUD();
  loop();
}

// ── Physics constants ──────────────────────────────────────────
const GRAVITY      = 0.55;
const JUMP_FORCE   = -13;
const MOVE_SPEED   = 4.5;
const MAX_FALL     = 18;
const ATTACK_RANGE = 60; // px

// ── Update ────────────────────────────────────────────────────
function update() {
  if (!gameRunning) return;
  const p = player;

  // ── Player movement ────────────────────────────────────
  if (keys.left)  { p.vx = -MOVE_SPEED; p.facingRight = false; }
  else if (keys.right) { p.vx = MOVE_SPEED; p.facingRight = true; }
  else p.vx *= 0.75;

  // Jump (edge-detected)
  if (jumpPressed && p.onGround) {
    p.vy = JUMP_FORCE;
    p.onGround = false;
  }
  jumpPressed = false;

  // Attack
  if (keys.attack && p.attackTimer <= 0) {
    p.attacking = true;
    p.attackTimer = 18;
  }
  if (p.attackTimer > 0) {
    p.attackTimer--;
    if (p.attackTimer <= 0) p.attacking = false;
  }

  // Gravity
  p.vy += GRAVITY;
  if (p.vy > MAX_FALL) p.vy = MAX_FALL;

  // Move X
  p.x += p.vx;
  p.x = Math.max(0, Math.min(p.x, level.W - p.w));

  // Move Y + platform collisions
  p.y += p.vy;
  p.onGround = false;
  collidePlatforms(p);

  // ── Enemy update ────────────────────────────────────────
  level.enemies.forEach(e => {
    if (!e.alive) return;
    e.x += e.vx;
    if (e.x <= e.xMin || e.x + e.w >= e.xMax) e.vx *= -1;
    if (e.hitTimer > 0) e.hitTimer--;
  });

  // ── Attack vs enemies ───────────────────────────────────
  if (p.attacking && p.attackTimer > 12) { // active first 6 frames
    level.enemies.forEach(e => {
      if (!e.alive) return;
      const ex = p.facingRight ? p.x + p.w : p.x - ATTACK_RANGE;
      if (rectsOverlap(ex, p.y, ATTACK_RANGE, p.h, e.x, e.y, e.w, e.h)) {
        e.alive = false;
        spawnParticle(e.x + e.w/2, e.y + e.h/2, COL.enemy1);
        score += 100;
      }
    });
  }

  // ── Player vs enemies (hurt) ────────────────────────────
  if (p.hitTimer <= 0) {
    level.enemies.forEach(e => {
      if (!e.alive) return;
      if (rectsOverlap(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)) {
        hurtPlayer();
      }
    });
  }
  if (p.hitTimer > 0) p.hitTimer--;

  // ── Player vs spikes ────────────────────────────────────
  if (p.hitTimer <= 0) {
    level.spikes.forEach(s => {
      const sx = s.x, sy = s.y - TILE + 10; // spike tip area
      if (rectsOverlap(p.x, p.y, p.w, p.h, sx, sy, TILE, TILE * 0.8)) {
        hurtPlayer();
      }
    });
  }

  // ── Collect coins ───────────────────────────────────────
  level.coins.forEach(c => {
    if (c.collected) return;
    const cs = 20;
    if (rectsOverlap(p.x, p.y, p.w, p.h, c.x - cs/2, c.y - cs/2, cs, cs)) {
      c.collected = true;
      score += 10;
      spawnParticle(c.x, c.y, COL.coin);
      updateHUD();
    }
  });

  // ── Collect gems ────────────────────────────────────────
  level.gems.forEach(g => {
    if (g.collected) return;
    const gs = 26;
    if (rectsOverlap(p.x, p.y, p.w, p.h, g.x - gs/2, g.y - gs/2, gs, gs)) {
      g.collected = true;
      score += 200;
      spawnParticle(g.x, g.y, COL.gem);
      updateHUD();
    }
  });

  // ── Portal / level end ───────────────────────────────────
  const port = level.portal;
  if (rectsOverlap(p.x, p.y, p.w, p.h, port.x, port.y, 50, 80)) {
    winLevel();
    return;
  }

  // ── Fall out of world ────────────────────────────────────
  if (p.y > level.H + 100) {
    hurtPlayer(true);
    return;
  }

  // ── Camera ──────────────────────────────────────────────
  const targetCam = p.x - canvas.width * 0.35;
  camera.x += (targetCam - camera.x) * 0.1;
  camera.x = Math.max(0, Math.min(camera.x, level.W - canvas.width));

  // ── Particles ───────────────────────────────────────────
  particles = particles.filter(pt => pt.life > 0);
  particles.forEach(pt => {
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.vy += 0.15;
    pt.life -= 0.04;
  });

  // ── Animation state ─────────────────────────────────────
  if (p.hitTimer > 30) p.state = 'hurt';
  else if (p.attacking)  p.state = 'attack';
  else if (!p.onGround)  p.state = p.vy < 0 ? 'jump' : 'fall';
  else if (Math.abs(p.vx) > 0.5) p.state = 'run';
  else p.state = 'idle';

  p.frameTimer++;
  const fps = p.state === 'run' ? 6 : 12;
  if (p.frameTimer >= fps) { p.frame = (p.frame + 1) % 4; p.frameTimer = 0; }
}

// ── Platform collision ────────────────────────────────────────
function collidePlatforms(p) {
  level.plats.forEach(pl => {
    if (!rectsOverlap(p.x, p.y, p.w, p.h, pl.x, pl.y, pl.w, pl.h)) return;

    const overlapX = Math.min(p.x + p.w, pl.x + pl.w) - Math.max(p.x, pl.x);
    const overlapY = Math.min(p.y + p.h, pl.y + pl.h) - Math.max(p.y, pl.y);

    if (overlapX < overlapY) {
      // Horizontal push
      if (p.x < pl.x) p.x = pl.x - p.w;
      else             p.x = pl.x + pl.w;
      p.vx = 0;
    } else {
      if (p.vy >= 0 && p.y + p.h - p.vy <= pl.y + 2) {
        // Landing on top
        p.y = pl.y - p.h;
        p.vy = 0;
        p.onGround = true;
      } else if (p.vy < 0) {
        // Hitting ceiling
        p.y = pl.y + pl.h;
        p.vy = 0;
      }
    }
  });
}

function rectsOverlap(ax,ay,aw,ah, bx,by,bw,bh) {
  return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
}

// ── Player damage ─────────────────────────────────────────────
function hurtPlayer(fallDeath=false) {
  if (player.hitTimer > 0) return;
  lives--;
  updateHUD();
  if (lives <= 0) {
    gameRunning = false;
    document.getElementById('death-score').textContent = 'Score: ' + score;
    setTimeout(() => showScreen('death'), 300);
    return;
  }
  // Respawn with invincibility
  player.x = 80;
  player.y = canvas.height - TILE - 64;
  player.vx = 0; player.vy = 0;
  player.hitTimer = 90; // 1.5s invincibility
  camera.x = 0;
}

function winLevel() {
  gameRunning = false;
  score += 500;
  updateHUD();
  document.getElementById('win-score').textContent = 'Score: ' + score;
  setTimeout(() => showScreen('win'), 400);
}

function updateHUD() {
  document.getElementById('lives-count').textContent = lives;
  document.getElementById('score-count').textContent = score;
  document.getElementById('level-num').textContent = currentLevel + 1;
}

// ── Draw ──────────────────────────────────────────────────────
function draw() {
  const W = canvas.width, H = canvas.height;
  const cx = Math.floor(camera.x);

  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, level.bgColors[0]);
  grad.addColorStop(1, level.bgColors[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Clouds (parallax 0.3)
  drawClouds(cx, H);

  ctx.save();
  ctx.translate(-cx, 0);

  // Platforms
  level.plats.forEach(pl => drawPlatform(pl));

  // Spikes
  level.spikes.forEach(s => drawSpike(s.x, s.y));

  // Coins
  level.coins.forEach(c => {
    if (c.collected) return;
    drawCoin(c.x, c.y);
  });

  // Gems
  level.gems.forEach(g => {
    if (g.collected) return;
    drawGem(g.x, g.y);
  });

  // Portal
  drawPortal(level.portal.x, level.portal.y);

  // Enemies
  level.enemies.forEach(e => { if (e.alive) drawEnemy(e); });

  // Player
  drawPlayer(player);

  ctx.restore();

  // Particles (screen space)
  particles.forEach(pt => {
    ctx.globalAlpha = pt.life;
    ctx.fillStyle = pt.col;
    ctx.beginPath();
    ctx.arc(pt.x - cx, pt.y, pt.r * pt.life, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// ── Clouds ────────────────────────────────────────────────────
const cloudData = [
  { x: 200,  y: 60,  w: 140, h: 48 },
  { x: 600,  y: 90,  w: 110, h: 38 },
  { x: 1100, y: 50,  w: 160, h: 55 },
  { x: 1700, y: 80,  w: 120, h: 42 },
  { x: 2300, y: 55,  w: 150, h: 50 },
  { x: 2800, y: 100, w: 100, h: 35 },
  { x: 3300, y: 70,  w: 130, h: 44 },
];
function drawClouds(cx, H) {
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  cloudData.forEach(c => {
    const px = c.x - cx * 0.25;
    ctx.beginPath();
    ctx.ellipse(px, c.y, c.w/2, c.h/2, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(px - c.w*0.2, c.y + c.h*0.1, c.w*0.35, c.h*0.6, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(px + c.w*0.25, c.y + c.h*0.05, c.w*0.3, c.h*0.55, 0, 0, Math.PI*2);
    ctx.fill();
  });
}

// ── Platform ──────────────────────────────────────────────────
function drawPlatform(pl) {
  const isGround = pl.type === 'ground';
  const topCol  = isGround ? COL.ground    : COL.brick;
  const sideCol = isGround ? COL.groundDark: COL.brickDark;
  const dirt    = isGround ? COL.dirt      : COL.dirtDark;

  // Side / body
  ctx.fillStyle = dirt;
  ctx.fillRect(pl.x, pl.y + 12, pl.w, pl.h - 12);

  // Top grass / brick
  ctx.fillStyle = topCol;
  ctx.fillRect(pl.x, pl.y, pl.w, 14);

  // Dark edge
  ctx.fillStyle = sideCol;
  ctx.fillRect(pl.x, pl.y + 12, pl.w, 4);

  if (!isGround) {
    // Brick lines
    ctx.strokeStyle = COL.brickDark;
    ctx.lineWidth = 2;
    for (let bx = pl.x; bx < pl.x + pl.w; bx += TILE) {
      ctx.strokeRect(bx, pl.y, TILE, pl.h);
    }
  } else {
    // Grass tufts
    ctx.fillStyle = '#78e040';
    for (let gx = pl.x + 6; gx < pl.x + pl.w - 6; gx += 18) {
      ctx.fillRect(gx,     pl.y - 4, 4, 8);
      ctx.fillRect(gx + 5, pl.y - 6, 4, 8);
      ctx.fillRect(gx +10, pl.y - 3, 4, 7);
    }
  }
}

// ── Spike ────────────────────────────────────────────────────
function drawSpike(x, y) {
  ctx.fillStyle = COL.spike;
  const mx = x + TILE/2;
  ctx.beginPath();
  ctx.moveTo(x + 4,    y + TILE*0.7);
  ctx.lineTo(mx,       y);
  ctx.lineTo(x + TILE*0.7, y + TILE*0.7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff6060';
  ctx.beginPath();
  ctx.moveTo(x + 4,    y + TILE*0.7);
  ctx.lineTo(mx - 3,   y + 8);
  ctx.lineTo(mx,       y);
  ctx.closePath();
  ctx.fill();
}

// ── Coin ─────────────────────────────────────────────────────
let coinAnim = 0;
function drawCoin(x, y) {
  const bob = Math.sin(Date.now() / 300 + x * 0.1) * 3;
  const cy = y + bob;
  ctx.fillStyle = COL.coin;
  ctx.beginPath();
  ctx.arc(x, cy, 11, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = COL.coinShine;
  ctx.beginPath();
  ctx.arc(x - 3, cy - 3, 4, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#c8a000';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('$', x + 1, cy + 4);
}

// ── Gem ──────────────────────────────────────────────────────
function drawGem(x, y) {
  const bob = Math.sin(Date.now() / 400 + x * 0.08) * 4;
  const gy = y + bob;
  ctx.fillStyle = COL.gem;
  ctx.save();
  ctx.translate(x, gy);
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.lineTo(10, 0);
  ctx.lineTo(0, 13);
  ctx.lineTo(-10, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.lineTo(10, 0);
  ctx.lineTo(2, -6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ── Portal ───────────────────────────────────────────────────
function drawPortal(x, y) {
  const t = Date.now() / 600;
  const pulsR = 28 + Math.sin(t) * 4;

  // Glow
  const grd = ctx.createRadialGradient(x+25, y+40, 5, x+25, y+40, 60);
  grd.addColorStop(0, COL.portalGlow);
  grd.addColorStop(1, 'transparent');
  ctx.fillStyle = grd;
  ctx.fillRect(x-35, y-20, 120, 120);

  // Arch
  ctx.fillStyle = COL.portal;
  ctx.beginPath();
  ctx.ellipse(x + 25, y + 40, 28, 42, 0, Math.PI, 0);
  ctx.fillRect(x - 3, y + 40, 56, 40);
  ctx.fill();

  // Inner glow
  ctx.fillStyle = COL.portalGlow;
  ctx.beginPath();
  ctx.ellipse(x + 25, y + 40, 18, 28 + Math.sin(t)*4, 0, Math.PI, 0);
  ctx.fillRect(x + 7, y + 40, 36, 20);
  ctx.fill();

  // Stars around portal
  for (let i = 0; i < 5; i++) {
    const ang = t + i * Math.PI * 2 / 5;
    const sx = x + 25 + Math.cos(ang) * 38;
    const sy = y + 20 + Math.sin(ang) * 22;
    ctx.fillStyle = `hsla(${280 + i*20}, 100%, 80%, ${0.5 + 0.5*Math.sin(t+i)})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, Math.PI*2);
    ctx.fill();
  }
}

// ── Enemy ────────────────────────────────────────────────────
function drawEnemy(e) {
  const flash = (e.hitTimer > 0 && (Math.floor(Date.now()/100)%2 === 0));
  if (flash) return;

  // Body
  ctx.fillStyle = COL.enemy1;
  ctx.beginPath();
  ctx.ellipse(e.x + e.w/2, e.y + e.h/2 + 4, e.w/2, e.h/2 - 2, 0, 0, Math.PI*2);
  ctx.fill();

  // Head
  ctx.fillStyle = COL.enemy1;
  ctx.beginPath();
  ctx.arc(e.x + e.w/2, e.y + 8, 14, 0, Math.PI*2);
  ctx.fill();

  // Eyes (angry)
  ctx.fillStyle = 'white';
  ctx.beginPath(); ctx.arc(e.x + e.w/2 - 5, e.y + 6, 5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(e.x + e.w/2 + 5, e.y + 6, 5, 0, Math.PI*2); ctx.fill();

  ctx.fillStyle = '#1a0000';
  ctx.beginPath(); ctx.arc(e.x + e.w/2 - 4, e.y + 6, 2.5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(e.x + e.w/2 + 5, e.y + 6, 2.5, 0, Math.PI*2); ctx.fill();

  // Angry brows
  ctx.strokeStyle = '#1a0000'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(e.x + e.w/2 - 8, e.y + 1);
  ctx.lineTo(e.x + e.w/2 - 2, e.y + 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(e.x + e.w/2 + 8, e.y + 1);
  ctx.lineTo(e.x + e.w/2 + 2, e.y + 4);
  ctx.stroke();

  // Feet
  ctx.fillStyle = COL.enemy2;
  ctx.fillRect(e.x + 3,      e.y + e.h - 8, 12, 8);
  ctx.fillRect(e.x + e.w - 14, e.y + e.h - 8, 12, 8);
}

// ── Player ───────────────────────────────────────────────────
function drawPlayer(p) {
  if (!p.alive) return;
  // Blink when hurt
  if (p.hitTimer > 0 && Math.floor(p.hitTimer / 5) % 2 === 0) return;

  const cx = p.x + p.w / 2;
  const cy = p.y;
  const dir = p.facingRight ? 1 : -1;

  ctx.save();
  ctx.scale(dir, 1);
  const ox = dir === 1 ? -cx : cx; // mirror origin
  ctx.translate(ox * (dir === 1 ? 0 : -2), 0);

  // Squash/stretch
  let sx = 1, sy = 1;
  if (p.state === 'jump')   { sx = 0.85; sy = 1.15; }
  if (p.state === 'fall')   { sx = 1.1;  sy = 0.9;  }
  if (p.state === 'run') {
    const bob = Math.sin(p.frame * Math.PI / 2) * 0.06;
    sy = 1 + bob;
  }

  ctx.save();
  ctx.translate(dir * cx, cy + p.h / 2);
  ctx.scale(sx, sy);
  ctx.translate(0, -p.h / 2);

  const bx = dir * (cx - p.w/2) - (dir*cx);
  const by = 0;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(dir*(cx), by + p.h + 2, 18*sx, 5, 0, 0, Math.PI*2);
  ctx.fill();

  // Body
  ctx.fillStyle = COL.player;
  ctx.fillRect(dir*cx - 14, by + 24, 28, 26);

  // Legs
  const legOff = p.state === 'run' ? (p.frame % 2 === 0 ? 4 : -4) : 0;
  ctx.fillStyle = '#e05010';
  ctx.fillRect(dir*cx - 12, by + 46, 10, 12 + legOff);
  ctx.fillRect(dir*cx + 2,  by + 46, 10, 12 - legOff);

  // Feet
  ctx.fillStyle = '#c03008';
  ctx.fillRect(dir*cx - 14, by + 54 + legOff,  12, 6);
  ctx.fillRect(dir*cx + 2,  by + 54 - legOff,  12, 6);

  // Arms
  const armSwing = p.state === 'run' ? Math.sin(p.frame * Math.PI / 2) * 8 : 0;
  const armY = p.attacking ? by + 20 : by + 26 + armSwing;
  const armLen = p.attacking ? 22 : 14;
  ctx.fillStyle = COL.playerSkin;
  ctx.fillRect(dir*cx - 20, armY, 8, armLen);
  ctx.fillRect(dir*cx + 12, by + 26 - armSwing, 8, armLen);

  // Fist when attacking
  if (p.attacking) {
    ctx.fillStyle = COL.playerSkin;
    ctx.beginPath();
    ctx.arc(dir*cx - 16, armY + armLen + 6, 8, 0, Math.PI*2);
    ctx.fill();
    // Attack arc
    ctx.strokeStyle = 'rgba(255,255,100,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(dir*cx - 16, armY + armLen + 6, 20, -0.8, 0.8);
    ctx.stroke();
  }

  // Head
  ctx.fillStyle = COL.playerSkin;
  ctx.beginPath();
  ctx.arc(dir*cx, by + 14, 18, 0, Math.PI*2);
  ctx.fill();

  // Hair
  ctx.fillStyle = '#aa3300';
  ctx.beginPath();
  ctx.arc(dir*cx, by + 4, 16, Math.PI, 0);
  ctx.fill();
  // Hair tuft
  ctx.fillRect(dir*cx - 5, by - 8, 7, 10);
  ctx.beginPath();
  ctx.arc(dir*cx - 1, by - 8, 5, 0, Math.PI*2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = 'white';
  ctx.beginPath(); ctx.arc(dir*cx + 6, by + 14, 6, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#1a0a00';
  ctx.beginPath(); ctx.arc(dir*cx + 7, by + 15, 3, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'white';
  ctx.beginPath(); ctx.arc(dir*cx + 8, by + 13, 1.5, 0, Math.PI*2); ctx.fill();

  // Mouth
  if (p.state === 'hurt') {
    ctx.strokeStyle = '#c04020'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(dir*cx + 4, by + 22, 4, 0, Math.PI, true);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#c04020';
    ctx.beginPath();
    ctx.arc(dir*cx + 4, by + 20, 3, 0, Math.PI);
    ctx.fill();
  }

  ctx.restore();
  ctx.restore();
}

// ── Game loop ─────────────────────────────────────────────────
let lastTime = 0;
function loop(ts = 0) {
  if (!gameRunning) return;
  update();
  draw();
  raf = requestAnimationFrame(loop);
}

// ── Button wiring ─────────────────────────────────────────────
document.getElementById('btn-play').addEventListener('click', startGame);
document.getElementById('btn-retry').addEventListener('click', () => {
  showScreen('game');
  lives = 3;
  score = 0;
  buildLevel();
  player = createPlayer();
  gameRunning = true;
  updateHUD();
  loop();
});
document.getElementById('btn-menu').addEventListener('click',  () => { gameRunning = false; showScreen('title'); });
document.getElementById('btn-menu2').addEventListener('click', () => { gameRunning = false; showScreen('title'); });
document.getElementById('btn-next').addEventListener('click',  () => { showScreen('game'); nextLevel(); });

// ── Init ──────────────────────────────────────────────────────
setupPad();
showScreen('title');