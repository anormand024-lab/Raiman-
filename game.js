// ============================================================
//  LUMINO — Platformer Engine  (fixed)
//  HTML5 Canvas · Keyboard + Touch Virtual Pad
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

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
let gameRunning = false, raf = null;

// ── Input ────────────────────────────────────────────────────
const keys = { left: false, right: false, jump: false, attack: false };
let jumpPressed = false;

document.addEventListener('keydown', e => {
  if (['ArrowLeft','a','A'].includes(e.key))  { keys.left  = true; e.preventDefault(); }
  if (['ArrowRight','d','D'].includes(e.key)) { keys.right = true; e.preventDefault(); }
  if (['ArrowUp','z','Z','w','W',' '].includes(e.key)) {
    if (!keys.jump) jumpPressed = true;
    keys.jump = true;
    e.preventDefault();
  }
  if (['x','X'].includes(e.key)) { keys.attack = true; e.preventDefault(); }
});
document.addEventListener('keyup', e => {
  if (['ArrowLeft','a','A'].includes(e.key))  keys.left   = false;
  if (['ArrowRight','d','D'].includes(e.key)) keys.right  = false;
  if (['ArrowUp','z','Z','w','W',' '].includes(e.key)) keys.jump = false;
  if (['x','X'].includes(e.key)) keys.attack = false;
});

// ── Virtual Pad ───────────────────────────────────────────────
function setupPad() {
  const vpad = document.getElementById('virtual-pad');
  vpad.innerHTML = '';

  const leftGroup  = document.createElement('div');
  leftGroup.style.cssText = 'display:flex;gap:10px;align-items:center;';
  const rightGroup = document.createElement('div');
  rightGroup.style.cssText = 'display:flex;gap:10px;align-items:center;';

  function makeBtn(label, cls) {
    const b = document.createElement('div');
    b.className = 'pad-btn ' + cls;
    b.textContent = label;
    return b;
  }

  const bL = makeBtn('◀','pad-dir');
  const bR = makeBtn('▶','pad-dir');
  const bJ = makeBtn('↑','pad-action');
  const bA = makeBtn('👊','pad-action');

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

  bind(bL,'left',false); bind(bR,'right',false);
  bind(bJ,'jump',true);  bind(bA,'attack',false);
}

// ── Canvas resize ─────────────────────────────────────────────
function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', () => { resizeCanvas(); if (gameRunning) buildLevel(); });
resizeCanvas();

// ── Palette ───────────────────────────────────────────────────
const COL = {
  sky:        '#7ecbff',
  sky2:       '#c8ecff',
  ground:     '#5ecf3e', groundDark:'#3faa1e',
  brick:      '#e8a030', brickDark: '#c07010',
  dirt:       '#b97a3a', dirtDark:  '#8a5520',
  coin:       '#ffe066', coinShine: '#fff8a0',
  gem:        '#ff4fa3',
  spike:      '#e03030',
  portal:     '#b47aff', portalGlow:'#e0c8ff',
  enemy:      '#e03c3c', enemyDark: '#c02020',
  player:     '#ff7c2a', playerSkin:'#ffd1a8',
};

// ── TILE size ─────────────────────────────────────────────────
const TILE = 40;

// ── Level helpers ─────────────────────────────────────────────
function plat(x, y, cols, type='ground') {
  return { x, y, w: cols * TILE, h: TILE, type };
}
function coinRow(x, y, n) {
  return Array.from({length:n}, (_,i) => ({ x: x + i*48, y, collected:false }));
}
function spikeRow(x, y, n) {
  return Array.from({length:n}, (_,i) => ({ x: x + i*TILE, y }));
}
function mkEnemy(x, y, xMin, xMax) {
  return { x, y, w:36, h:32, vx:1.5, xMin, xMax, alive:true, hitTimer:0 };
}

// ── Level definitions ─────────────────────────────────────────
const LEVELS = [
  // Level 1 — Prairie
  () => {
    const H = canvas.height, gY = H - TILE;
    return {
      W: 3200, H,
      bgColors: ['#7ecbff','#c8ecff'],
      plats: [
        plat(0,     gY,     80, 'ground'),
        plat(500,   gY-120,  4, 'ground'),
        plat(800,   gY-80,   5, 'brick'),
        plat(1100,  gY-160,  4, 'ground'),
        plat(1400,  gY-80,   6, 'brick'),
        plat(1700,  gY-200,  4, 'ground'),
        plat(2000,  gY-120,  5, 'brick'),
        plat(2300,  gY-80,   5, 'ground'),
        plat(2600,  gY-180,  4, 'brick'),
        plat(2900,  gY-100,  8, 'ground'),
      ],
      coins: [
        ...coinRow(540,  gY-175, 3),
        ...coinRow(820,  gY-135, 4),
        ...coinRow(1120, gY-215, 3),
        ...coinRow(1430, gY-135, 5),
        ...coinRow(1720, gY-255, 3),
        ...coinRow(2020, gY-175, 4),
        ...coinRow(2620, gY-235, 3),
      ],
      gems: [
        {x:680,  y:gY-110, collected:false},
        {x:1280, y:gY-210, collected:false},
        {x:2150, y:gY-170, collected:false},
        {x:2750, y:gY-230, collected:false},
      ],
      enemies: [
        mkEnemy(900,  gY-TILE-32, 820,  1000),
        mkEnemy(1500, gY-TILE-32, 1400, 1600),
        mkEnemy(2050, gY-TILE-32, 2000, 2200),
        mkEnemy(2350, gY-TILE-32, 2300, 2540),
      ],
      spikes: [
        ...spikeRow(660,  gY-TILE, 2),
        ...spikeRow(1250, gY-TILE, 2),
        ...spikeRow(1900, gY-TILE, 3),
      ],
      portal: {x:3060, y:gY-110},
    };
  },
  // Level 2 — Désert
  () => {
    const H = canvas.height, gY = H - TILE;
    return {
      W: 3600, H,
      bgColors: ['#e08850','#ffd8a0'],
      plats: [
        plat(0,    gY,      80,'ground'),
        plat(450,  gY-100,   4,'brick'),
        plat(700,  gY-200,   4,'brick'),
        plat(950,  gY-100,   4,'ground'),
        plat(1200, gY-220,   5,'brick'),
        plat(1550, gY-160,   4,'ground'),
        plat(1800, gY-280,   4,'brick'),
        plat(2100, gY-120,   5,'ground'),
        plat(2450, gY-240,   4,'brick'),
        plat(2750, gY-160,   5,'ground'),
        plat(3100, gY-280,   5,'brick'),
        plat(3400, gY-100,   8,'ground'),
      ],
      coins: [
        ...coinRow(470,  gY-155, 3),
        ...coinRow(720,  gY-255, 3),
        ...coinRow(970,  gY-155, 4),
        ...coinRow(1230, gY-275, 4),
        ...coinRow(1820, gY-335, 3),
        ...coinRow(2470, gY-295, 3),
        ...coinRow(3120, gY-335, 4),
      ],
      gems: [
        {x:830,  y:gY-260, collected:false},
        {x:1380, y:gY-280, collected:false},
        {x:2250, y:gY-180, collected:false},
        {x:3250, y:gY-340, collected:false},
      ],
      enemies: [
        mkEnemy(500,  gY-TILE-32, 450,  650),
        mkEnemy(1000, gY-TILE-32, 950,  1150),
        mkEnemy(1600, gY-TILE-32, 1550, 1780),
        mkEnemy(2150, gY-TILE-32, 2100, 2420),
        mkEnemy(2800, gY-TILE-32, 2750, 3070),
        mkEnemy(3120, gY-TILE-32, 3100, 3380),
      ],
      spikes: [
        ...spikeRow(620,  gY-TILE, 2),
        ...spikeRow(1450, gY-TILE, 3),
        ...spikeRow(2050, gY-TILE, 3),
        ...spikeRow(2650, gY-TILE, 2),
      ],
      portal: {x:3500, y:gY-110},
    };
  },
  // Level 3 — Forêt mystique
  () => {
    const H = canvas.height, gY = H - TILE;
    return {
      W: 4000, H,
      bgColors: ['#6040a8','#b090ff'],
      plats: [
        plat(0,    gY,      80,'ground'),
        plat(400,  gY-140,   3,'brick'),
        plat(650,  gY-280,   3,'brick'),
        plat(900,  gY-140,   3,'ground'),
        plat(1150, gY-300,   4,'brick'),
        plat(1500, gY-160,   3,'ground'),
        plat(1750, gY-320,   3,'brick'),
        plat(2050, gY-160,   4,'ground'),
        plat(2350, gY-300,   3,'brick'),
        plat(2650, gY-160,   3,'ground'),
        plat(2900, gY-340,   4,'brick'),
        plat(3250, gY-200,   4,'ground'),
        plat(3550, gY-360,   4,'brick'),
        plat(3750, gY-160,   8,'ground'),
      ],
      coins: [
        ...coinRow(420,  gY-195, 2),
        ...coinRow(670,  gY-335, 2),
        ...coinRow(1170, gY-355, 3),
        ...coinRow(1770, gY-375, 2),
        ...coinRow(2370, gY-355, 2),
        ...coinRow(2920, gY-395, 3),
        ...coinRow(3570, gY-415, 3),
      ],
      gems: [
        {x:780,  y:gY-320, collected:false},
        {x:1650, y:gY-220, collected:false},
        {x:2200, y:gY-220, collected:false},
        {x:3070, y:gY-400, collected:false},
        {x:3660, y:gY-420, collected:false},
      ],
      enemies: [
        mkEnemy(430,  gY-TILE-32, 400,  600),
        mkEnemy(930,  gY-TILE-32, 900,  1120),
        mkEnemy(1530, gY-TILE-32, 1500, 1720),
        mkEnemy(2080, gY-TILE-32, 2050, 2320),
        mkEnemy(2680, gY-TILE-32, 2650, 2870),
        mkEnemy(3280, gY-TILE-32, 3250, 3520),
        mkEnemy(3780, gY-TILE-32, 3750, 3980),
      ],
      spikes: [
        ...spikeRow(580,  gY-TILE, 3),
        ...spikeRow(1080, gY-TILE, 3),
        ...spikeRow(1680, gY-TILE, 3),
        ...spikeRow(2480, gY-TILE, 4),
        ...spikeRow(3080, gY-TILE, 3),
      ],
      portal: {x:3870, y:gY-110},
    };
  },
];

// ── Game state ────────────────────────────────────────────────
let level  = null;
let player = null;
let camera = { x:0 };
let particles = [];

function createPlayer() {
  return {
    x: 80, y: canvas.height - TILE - 60,
    w: 32, h: 52,
    vx:0, vy:0,
    onGround: false,
    facingRight: true,
    attacking: false,
    attackTimer: 0,
    hitTimer: 0,
    frame: 0, frameTimer: 0,
    state: 'idle',
  };
}

function buildLevel() {
  level = LEVELS[currentLevel % LEVELS.length]();
  camera.x = 0;
  particles = [];
}

// ── Physics constants ─────────────────────────────────────────
const GRAVITY   = 0.55;
const JUMP_FORCE= -13;
const MOVE_SPD  = 4.5;
const MAX_FALL  = 18;

// ── Helpers ───────────────────────────────────────────────────
function overlap(ax,ay,aw,ah, bx,by,bw,bh) {
  return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
}

// ── Particle ──────────────────────────────────────────────────
function burst(x, y, col) {
  for (let i=0; i<8; i++) {
    const a = (i/8)*Math.PI*2, s = 2+Math.random()*3;
    particles.push({ x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:1, col, r:4+Math.random()*4 });
  }
}

// ── Update ────────────────────────────────────────────────────
function update() {
  if (!gameRunning) return;
  const p = player;

  // Input → velocity
  if (keys.left)        { p.vx = -MOVE_SPD; p.facingRight = false; }
  else if (keys.right)  { p.vx =  MOVE_SPD; p.facingRight = true;  }
  else                  { p.vx *= 0.75; }

  if (jumpPressed && p.onGround) { p.vy = JUMP_FORCE; p.onGround = false; }
  jumpPressed = false;

  if (keys.attack && p.attackTimer <= 0) { p.attacking = true; p.attackTimer = 18; }
  if (p.attackTimer > 0) { p.attackTimer--; if (p.attackTimer <= 0) p.attacking = false; }

  // Gravity
  p.vy = Math.min(p.vy + GRAVITY, MAX_FALL);

  // Move X then resolve
  p.x += p.vx;
  p.x = Math.max(0, Math.min(p.x, level.W - p.w));
  resolveX(p);

  // Move Y then resolve
  p.y += p.vy;
  p.onGround = false;
  resolveY(p);

  // Enemies
  level.enemies.forEach(e => {
    if (!e.alive) return;
    e.x += e.vx;
    if (e.x <= e.xMin || e.x+e.w >= e.xMax) e.vx *= -1;
    if (e.hitTimer > 0) e.hitTimer--;
  });

  // Attack vs enemies (first 6 frames of attackTimer)
  if (p.attacking && p.attackTimer > 12) {
    const fx = p.facingRight ? p.x + p.w : p.x - 56;
    level.enemies.forEach(e => {
      if (!e.alive) return;
      if (overlap(fx, p.y, 56, p.h, e.x, e.y, e.w, e.h)) {
        e.alive = false;
        burst(e.x+e.w/2, e.y+e.h/2, COL.enemy);
        score += 100;
        updateHUD();
      }
    });
  }

  // Player vs enemies
  if (p.hitTimer <= 0) {
    level.enemies.forEach(e => {
      if (!e.alive) return;
      if (overlap(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)) hurtPlayer();
    });
  }
  if (p.hitTimer > 0) p.hitTimer--;

  // Player vs spikes
  if (p.hitTimer <= 0) {
    level.spikes.forEach(s => {
      if (overlap(p.x+4, p.y+p.h-20, p.w-8, 20, s.x+4, s.y-TILE+4, TILE-8, TILE)) hurtPlayer();
    });
  }

  // Coins
  level.coins.forEach(c => {
    if (c.collected) return;
    if (overlap(p.x, p.y, p.w, p.h, c.x-12, c.y-12, 24, 24)) {
      c.collected = true; score += 10; burst(c.x, c.y, COL.coin); updateHUD();
    }
  });

  // Gems
  level.gems.forEach(g => {
    if (g.collected) return;
    if (overlap(p.x, p.y, p.w, p.h, g.x-14, g.y-14, 28, 28)) {
      g.collected = true; score += 200; burst(g.x, g.y, COL.gem); updateHUD();
    }
  });

  // Portal
  const port = level.portal;
  if (overlap(p.x, p.y, p.w, p.h, port.x, port.y, 50, 80)) { winLevel(); return; }

  // Fall out
  if (p.y > level.H + 200) { hurtPlayer(); return; }

  // Camera (smooth follow)
  const targetX = p.x - canvas.width * 0.35;
  camera.x += (targetX - camera.x) * 0.1;
  camera.x = Math.max(0, Math.min(camera.x, level.W - canvas.width));

  // Particles
  particles = particles.filter(pt => pt.life > 0);
  particles.forEach(pt => { pt.x+=pt.vx; pt.y+=pt.vy; pt.vy+=0.15; pt.life-=0.04; });

  // Anim state
  if (p.hitTimer > 30)       p.state = 'hurt';
  else if (p.attacking)      p.state = 'attack';
  else if (!p.onGround)      p.state = p.vy < 0 ? 'jump' : 'fall';
  else if (Math.abs(p.vx)>0.5) p.state = 'run';
  else                       p.state = 'idle';

  p.frameTimer++;
  if (p.frameTimer >= (p.state==='run'?6:12)) { p.frame=(p.frame+1)%4; p.frameTimer=0; }
}

// ── Collision resolution (separated X / Y) ────────────────────
function resolveX(p) {
  level.plats.forEach(pl => {
    if (!overlap(p.x, p.y, p.w, p.h, pl.x, pl.y, pl.w, pl.h)) return;
    // Push horizontally
    const overlapL = (p.x + p.w) - pl.x;       // entering from left
    const overlapR = (pl.x + pl.w) - p.x;       // entering from right
    if (overlapL < overlapR) { p.x = pl.x - p.w; }
    else                     { p.x = pl.x + pl.w; }
    p.vx = 0;
  });
}

function resolveY(p) {
  level.plats.forEach(pl => {
    if (!overlap(p.x, p.y, p.w, p.h, pl.x, pl.y, pl.w, pl.h)) return;
    const overlapTop = (p.y + p.h) - pl.y;      // falling onto top
    const overlapBot = (pl.y + pl.h) - p.y;     // hitting from below
    if (overlapTop < overlapBot) {
      // Land on top
      p.y = pl.y - p.h;
      p.vy = 0;
      p.onGround = true;
    } else {
      // Hit ceiling
      p.y = pl.y + pl.h;
      p.vy = Math.max(p.vy, 0);
    }
  });
}

// ── Player damage ─────────────────────────────────────────────
function hurtPlayer() {
  if (player.hitTimer > 0) return;
  lives--;
  updateHUD();
  if (lives <= 0) {
    gameRunning = false;
    document.getElementById('death-score').textContent = 'Score: ' + score;
    setTimeout(() => showScreen('death'), 300);
    return;
  }
  player.x = 80;
  player.y = canvas.height - TILE - 60;
  player.vx = 0; player.vy = 0;
  player.hitTimer = 90;
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
  document.getElementById('lives-count').textContent  = lives;
  document.getElementById('score-count').textContent  = score;
  document.getElementById('level-num').textContent    = currentLevel + 1;
}

// ── Draw ──────────────────────────────────────────────────────
function draw() {
  const W = canvas.width, H = canvas.height;
  const cx = Math.round(camera.x);

  // Sky
  const grad = ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0, level.bgColors[0]);
  grad.addColorStop(1, level.bgColors[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,W,H);

  // Clouds (parallax)
  drawClouds(cx);

  ctx.save();
  ctx.translate(-cx, 0);

  level.plats.forEach(drawPlatform);
  level.spikes.forEach(s => drawSpike(s.x, s.y));
  level.coins.forEach(c  => { if (!c.collected) drawCoin(c.x, c.y); });
  level.gems.forEach(g   => { if (!g.collected) drawGem(g.x, g.y); });
  drawPortal(level.portal.x, level.portal.y);
  level.enemies.forEach(e => { if (e.alive) drawEnemy(e); });
  drawPlayer(player);

  ctx.restore();

  // Particles (world-space → screen-space)
  particles.forEach(pt => {
    ctx.globalAlpha = Math.max(0, pt.life);
    ctx.fillStyle = pt.col;
    ctx.beginPath();
    ctx.arc(pt.x - cx, pt.y, pt.r * pt.life, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// ── Clouds ────────────────────────────────────────────────────
const CLOUDS = [
  {x:200,y:60,w:140,h:48},{x:600,y:90,w:110,h:38},{x:1100,y:50,w:160,h:55},
  {x:1700,y:80,w:120,h:42},{x:2300,y:55,w:150,h:50},{x:2800,y:100,w:100,h:35},
  {x:3300,y:70,w:130,h:44},
];
function drawClouds(cx) {
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  CLOUDS.forEach(c => {
    const px = c.x - cx * 0.25;
    ctx.beginPath(); ctx.ellipse(px, c.y, c.w/2, c.h/2, 0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(px-c.w*0.2, c.y+c.h*0.1, c.w*0.35, c.h*0.6, 0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(px+c.w*0.25, c.y+c.h*0.05, c.w*0.3, c.h*0.55, 0,0,Math.PI*2); ctx.fill();
  });
}

// ── Platform ─────────────────────────────────────────────────
function drawPlatform(pl) {
  const isG = pl.type === 'ground';
  ctx.fillStyle = isG ? COL.dirt : COL.dirtDark;
  ctx.fillRect(pl.x, pl.y+12, pl.w, pl.h-12);
  ctx.fillStyle = isG ? COL.ground : COL.brick;
  ctx.fillRect(pl.x, pl.y, pl.w, 14);
  ctx.fillStyle = isG ? COL.groundDark : COL.brickDark;
  ctx.fillRect(pl.x, pl.y+12, pl.w, 4);
  if (!isG) {
    ctx.strokeStyle = COL.brickDark; ctx.lineWidth = 2;
    for (let bx=pl.x; bx<pl.x+pl.w; bx+=TILE) ctx.strokeRect(bx, pl.y, TILE, pl.h);
  } else {
    ctx.fillStyle = '#78e040';
    for (let gx=pl.x+6; gx<pl.x+pl.w-6; gx+=18) {
      ctx.fillRect(gx,    pl.y-4, 4, 8);
      ctx.fillRect(gx+5,  pl.y-6, 4, 8);
      ctx.fillRect(gx+10, pl.y-3, 4, 7);
    }
  }
}

// ── Spike ────────────────────────────────────────────────────
function drawSpike(x, y) {
  ctx.fillStyle = COL.spike;
  const mx = x+TILE/2;
  ctx.beginPath();
  ctx.moveTo(x+4, y); ctx.lineTo(mx, y-TILE*0.7); ctx.lineTo(x+TILE-4, y);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ff6060';
  ctx.beginPath();
  ctx.moveTo(x+4, y); ctx.lineTo(mx-3, y-TILE*0.4); ctx.lineTo(mx, y-TILE*0.7);
  ctx.closePath(); ctx.fill();
}

// ── Coin ─────────────────────────────────────────────────────
function drawCoin(x, y) {
  const bob = Math.sin(Date.now()/300 + x*0.1)*3;
  ctx.fillStyle = COL.coin;
  ctx.beginPath(); ctx.arc(x, y+bob, 11, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = COL.coinShine;
  ctx.beginPath(); ctx.arc(x-3, y+bob-3, 4, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#c8a000';
  ctx.font = 'bold 11px sans-serif'; ctx.textAlign='center';
  ctx.fillText('$', x+1, y+bob+4);
}

// ── Gem ──────────────────────────────────────────────────────
function drawGem(x, y) {
  const bob = Math.sin(Date.now()/400 + x*0.08)*4;
  ctx.save(); ctx.translate(x, y+bob);
  ctx.fillStyle = COL.gem;
  ctx.beginPath(); ctx.moveTo(0,-13); ctx.lineTo(10,0); ctx.lineTo(0,13); ctx.lineTo(-10,0); ctx.closePath(); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.moveTo(0,-13); ctx.lineTo(10,0); ctx.lineTo(2,-6); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ── Portal ───────────────────────────────────────────────────
function drawPortal(x, y) {
  const t = Date.now()/600;
  const grd = ctx.createRadialGradient(x+25,y+40,5, x+25,y+40,60);
  grd.addColorStop(0, COL.portalGlow); grd.addColorStop(1,'transparent');
  ctx.fillStyle=grd; ctx.fillRect(x-35,y-20,120,120);
  ctx.fillStyle=COL.portal;
  ctx.beginPath(); ctx.ellipse(x+25,y+40,28,42,0,Math.PI,0);
  ctx.fill(); ctx.fillRect(x-3,y+40,56,40); 
  ctx.fillStyle=COL.portalGlow;
  ctx.beginPath(); ctx.ellipse(x+25,y+40,18,28+Math.sin(t)*4,0,Math.PI,0);
  ctx.fill(); ctx.fillRect(x+7,y+40,36,20);
  for (let i=0;i<5;i++) {
    const ang=t+i*Math.PI*2/5;
    ctx.fillStyle=`hsla(${280+i*20},100%,80%,${0.5+0.5*Math.sin(t+i)})`;
    ctx.beginPath(); ctx.arc(x+25+Math.cos(ang)*38, y+20+Math.sin(ang)*22, 3,0,Math.PI*2); ctx.fill();
  }
}

// ── Enemy ────────────────────────────────────────────────────
function drawEnemy(e) {
  ctx.fillStyle = COL.enemy;
  ctx.beginPath(); ctx.ellipse(e.x+e.w/2, e.y+e.h/2+4, e.w/2, e.h/2-2, 0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(e.x+e.w/2, e.y+8, 14,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='white';
  ctx.beginPath(); ctx.arc(e.x+e.w/2-5,e.y+6,5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(e.x+e.w/2+5,e.y+6,5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#1a0000';
  ctx.beginPath(); ctx.arc(e.x+e.w/2-4,e.y+6,2.5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(e.x+e.w/2+5,e.y+6,2.5,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#1a0000'; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.moveTo(e.x+e.w/2-8,e.y+1); ctx.lineTo(e.x+e.w/2-2,e.y+4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(e.x+e.w/2+8,e.y+1); ctx.lineTo(e.x+e.w/2+2,e.y+4); ctx.stroke();
  ctx.fillStyle=COL.enemyDark;
  ctx.fillRect(e.x+3,      e.y+e.h-8, 12,8);
  ctx.fillRect(e.x+e.w-14, e.y+e.h-8, 12,8);
}

// ── Player — dessin simple et correct ────────────────────────
// Toutes les coordonnées sont relatives à (p.x, p.y).
// Le miroir se fait en une seule opération ctx.scale(-1,1) autour du centre.
function drawPlayer(p) {
  if (p.hitTimer > 0 && Math.floor(p.hitTimer/5)%2 === 0) return;

  const px = p.x;         // coin haut-gauche (world)
  const py = p.y;
  const pw = p.w;
  const ph = p.h;
  const cx = px + pw/2;   // centre horizontal

  ctx.save();

  // Miroir horizontal si on regarde à gauche
  if (!p.facingRight) {
    ctx.translate(2*cx, 0);
    ctx.scale(-1, 1);
  }

  // Squash/stretch autour du centre bas
  let sy = 1;
  if (p.state==='jump') sy = 1.12;
  if (p.state==='fall') sy = 0.90;
  if (sy !== 1) {
    ctx.translate(cx, py+ph);
    ctx.scale(1, sy);
    ctx.translate(-cx, -(py+ph));
  }

  // ── Ombre
  ctx.fillStyle='rgba(0,0,0,0.15)';
  ctx.beginPath(); ctx.ellipse(cx, py+ph+3, 16,5,0,0,Math.PI*2); ctx.fill();

  // ── Jambes
  const legAnim = p.state==='run' ? (p.frame%2===0?5:-5) : 0;
  ctx.fillStyle='#e05010';
  ctx.fillRect(px+4,     py+ph-18, 10, 18+legAnim);
  ctx.fillRect(px+pw-14, py+ph-18, 10, 18-legAnim);
  // Pieds
  ctx.fillStyle='#c03008';
  ctx.fillRect(px+2,     py+ph+legAnim-2,  13, 7);
  ctx.fillRect(px+pw-15, py+ph-legAnim-2,  13, 7);

  // ── Corps
  ctx.fillStyle=COL.player;
  ctx.fillRect(px+3, py+18, pw-6, ph-30);

  // ── Bras gauche (avant, côté attaque)
  const armSwing = p.state==='run' ? Math.sin(p.frame*Math.PI/2)*6 : 0;
  ctx.fillStyle=COL.playerSkin;
  if (p.attacking) {
    ctx.fillRect(px-14, py+20, 10, 20);  // bras tendu
    ctx.beginPath(); ctx.arc(px-10, py+40, 9, 0, Math.PI*2); ctx.fill(); // poing
    ctx.strokeStyle='rgba(255,240,60,0.75)'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(px-10, py+40, 18, -0.8, 0.8); ctx.stroke();
  } else {
    ctx.fillRect(px-8, py+20+armSwing, 9, 16);
  }
  // Bras droit (arrière)
  ctx.fillStyle=COL.playerSkin;
  ctx.fillRect(px+pw-1, py+20-armSwing, 9, 16);

  // ── Tête
  ctx.fillStyle=COL.playerSkin;
  ctx.beginPath(); ctx.arc(cx, py+12, 17, 0, Math.PI*2); ctx.fill();

  // Cheveux
  ctx.fillStyle='#aa3300';
  ctx.beginPath(); ctx.arc(cx, py+4, 15, Math.PI, 0); ctx.fill();
  ctx.fillRect(cx-4, py-10, 8, 12);
  ctx.beginPath(); ctx.arc(cx, py-10, 6, 0, Math.PI*2); ctx.fill();

  // Oeil (toujours côté droit du sprite, car on a déjà mirrored)
  ctx.fillStyle='white';
  ctx.beginPath(); ctx.arc(cx+6, py+13, 5.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#1a0a00';
  ctx.beginPath(); ctx.arc(cx+7, py+14, 2.8,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='white';
  ctx.beginPath(); ctx.arc(cx+8, py+12, 1.2,0,Math.PI*2); ctx.fill();

  // Bouche
  if (p.state==='hurt') {
    ctx.strokeStyle='#c04020'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(cx+3, py+21, 3.5, 0, Math.PI, true); ctx.stroke();
  } else {
    ctx.fillStyle='#c04020';
    ctx.beginPath(); ctx.arc(cx+3, py+19, 3, 0, Math.PI); ctx.fill();
  }

  ctx.restore();
}

// ── Game loop ─────────────────────────────────────────────────
function loop() {
  if (!gameRunning) return;
  update();
  draw();
  raf = requestAnimationFrame(loop);
}

// ── Start / restart helpers ───────────────────────────────────
function startGame() {
  if (raf) { cancelAnimationFrame(raf); raf=null; }
  score=0; lives=3; currentLevel=0;
  updateHUD();
  buildLevel();
  player = createPlayer();
  gameRunning = true;
  showScreen('game');
  loop();
}

function restartFromDeath() {
  if (raf) { cancelAnimationFrame(raf); raf=null; }
  score=0; lives=3;
  buildLevel();
  player = createPlayer();
  gameRunning = true;
  updateHUD();
  showScreen('game');
  loop();
}

function goNextLevel() {
  if (raf) { cancelAnimationFrame(raf); raf=null; }
  currentLevel++;
  buildLevel();
  player = createPlayer();
  gameRunning = true;
  updateHUD();
  showScreen('game');
  loop();
}

function goMenu() {
  gameRunning = false;
  if (raf) { cancelAnimationFrame(raf); raf=null; }
  showScreen('title');
}

// ── Button wiring ─────────────────────────────────────────────
document.getElementById('btn-play').addEventListener('click', startGame);
document.getElementById('btn-retry').addEventListener('click', restartFromDeath);
document.getElementById('btn-menu').addEventListener('click',  goMenu);
document.getElementById('btn-menu2').addEventListener('click', goMenu);
document.getElementById('btn-next').addEventListener('click',  goNextLevel);

// ── Init ──────────────────────────────────────────────────────
setupPad();
showScreen('title');