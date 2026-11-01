const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const homeEl = document.querySelector("#home");
const modeEl = document.querySelector("#mode");
const levelEl = document.querySelector("#level");
const carrotsEl = document.querySelector("#carrots");
const gemsEl = document.querySelector("#gems");
const keysEl = document.querySelector("#keys");
const timerEl = document.querySelector("#timer");
const bestEl = document.querySelector("#best");
const fallsEl = document.querySelector("#falls");
const pinkHelpEl = document.querySelector("#pinkHelp");

const W = canvas.width;
const H = canvas.height;
const keys = new Set();

const GRAVITY = 2450;
const MOVE = 1180;
const FRICTION = 0.86;
const AIR_FRICTION = 0.9;
const JUMP = 770;
const MAX_VX = 520;
const MAX_VY = 1350;
const BUTTON_HOLD_TIME = 5;
const LEVEL_COUNT = 20;
const BEST_KEY = "bunny-burrow-duo-best";

const palette = {
  skyTop: "#8bc7d9",
  skyBottom: "#f5d7a4",
  earth: "#5a4031",
  earthDark: "#39291f",
  grass: "#6bc56e",
  carrot: "#ff9f43",
  door: "#2a1c17",
  doorGlow: "#ffd166",
  blue: "#78c8ff",
  blueDark: "#3d81b5",
  pink: "#ff9cc9",
  pinkDark: "#c05b8c",
  acid: "#9cff5f",
};

const state = {
  mode: "home",
  level: 0,
  carrots: 0,
  gems: 0,
  keys: 0,
  elapsed: 0,
  falls: 0,
  paused: false,
  won: false,
  message: "",
  shake: 0,
};

const playerTemplates = [
  {
    id: "blue",
    name: "蓝兔",
    color: palette.blue,
    dark: palette.blueDark,
    left: "a",
    right: "d",
    jump: "w",
    drop: "s",
    dash: "q",
  },
  {
    id: "pink",
    name: "粉兔",
    color: palette.pink,
    dark: palette.pinkDark,
    left: "ArrowLeft",
    right: "ArrowRight",
    jump: "ArrowUp",
    drop: "ArrowDown",
    dash: "/",
  },
];

const levelNames = [
  "草坡练习场",
  "双人按钮洞",
  "风车矿坑",
  "机关石桥",
  "弹簧谷",
  "钥匙折返",
  "巡逻鼠道",
  "升降草台",
  "窄桥试炼",
  "双钥匙坡",
  "断崖钟摆",
  "按钮迷阵",
  "高速矿车",
  "三段跳台",
  "双色池峡谷",
  "暗门回环",
  "尖刺雨棚",
  "双兔升降机",
  "终点前夜",
  "兔王洞口",
];

function platformRoute(n) {
  const hard = n - 1;
  const widthLoss = Math.min(46, hard * 3);
  const wave = hard % 4;
  return [
    { x: 150, y: 500 - wave * 8, w: 168 - widthLoss * 0.4, h: 26 },
    { x: 330, y: 452 - (hard % 3) * 10, w: 152 - widthLoss * 0.35, h: 26 },
    { x: 515, y: 398 - wave * 8, w: 144 - widthLoss * 0.3, h: 26 },
    { x: 706, y: 346 - (hard % 2) * 16, w: 138 - widthLoss * 0.25, h: 26 },
    { x: 915, y: 306 - wave * 6, w: 178 - widthLoss * 0.45, h: 26 },
  ].map((p) => ({ ...p, w: Math.max(92, Math.round(p.w)) }));
}

function makeLevel(n, mode = "duo") {
  const hard = n - 1;
  const solo = mode === "solo";
  const soloBoost = solo ? 2 : 0;
  const route = platformRoute(n);
  if (solo) {
    for (const p of route) {
      p.w = Math.max(78, p.w - 18 - Math.floor(hard * 0.7));
      p.y -= hard % 2 ? 12 : 0;
    }
  }
  const last = route[route.length - 1];
  const platforms = [{ x: 0, y: 568, w: 1152, h: 80 }, ...route];
  const spikes = [];
  const buttons = [];
  const springs = [];
  const movers = [];
  const hazards = [];
  const pools = [];
  const barriers = [];
  const chambers = [];
  const carrots = route.slice(0, Math.min(5, 3 + Math.floor(hard / 4))).map((p, i) => ({
    x: p.x + p.w / 2 + (i % 2 ? 18 : -12),
    y: p.y - 42,
  }));
  const gems = route.slice(0, Math.min(6, 2 + Math.floor((hard + soloBoost) / 3))).map((p, i) => ({
    x: p.x + 24 + (i % 2) * Math.max(32, p.w - 52),
    y: p.y - 76,
    type: solo ? "blue" : i % 2 ? "pink" : "blue",
  }));
  const keyCount = n + soloBoost < 5 ? 1 : n + soloBoost < 10 ? 2 : n + soloBoost < 16 ? 3 : 4;
  const keys = [];

  function addVault({ id, button, gate, key, color = "blue" }) {
    const roomX = Math.min(gate.x, key.x - 34);
    const roomRight = Math.max(gate.x + gate.w, key.x + 58);
    buttons.push({ ...button, id, color });
    barriers.push({ ...gate, opensWith: id, color });
    chambers.push({ x: roomX, y: gate.y, w: roomRight - roomX, h: gate.h, color, opensWith: id });
    keys.push(key);
  }

  function addGroundSpring(candidates) {
    const blocked = [...spikes, ...pools, ...buttons, ...barriers, ...springs];
    for (const x of candidates) {
      const spring = { x, y: 535, w: 52, h: 18 };
      const padded = { x: spring.x - 10, y: spring.y - 10, w: spring.w + 20, h: spring.h + 20 };
      if (!blocked.some((item) => rectsOverlap(padded, item))) {
        springs.push(spring);
        return;
      }
    }
  }

  spikes.push({ x: 430 + (hard % 3) * 28, y: 540, w: 118 + hard * 5, h: 28 });
  if (n + soloBoost >= 4) spikes.push({ x: 760 - (hard % 2) * 34, y: 540, w: 112 + hard * 4, h: 28 });
  if (n + soloBoost >= 9) spikes.push({ x: 210, y: 540, w: 90 + hard * 3, h: 28 });
  if (n + soloBoost >= 15) spikes.push({ x: 940, y: 540, w: 90, h: 28 });

  if (n + soloBoost >= 3) {
    pools.push({ x: 300, y: 548, w: 102 + hard * 3, h: 20, type: solo ? "pink" : "blue" });
  }
  if (n + soloBoost >= 5) {
    pools.push({ x: 690, y: 548, w: 96 + hard * 3, h: 20, type: "pink" });
  }
  if (n + soloBoost >= 10) {
    pools.push({ x: 500, y: 548, w: 86 + hard * 2, h: 20, type: "acid" });
  }
  if (n + soloBoost >= 16) {
    pools.push({ x: 910, y: 548, w: 86, h: 20, type: hard % 2 ? "blue" : "pink" });
  }

  if (n + soloBoost >= 4) {
    platforms.push({ x: 612, y: 486 - (hard % 2) * 30, w: 92, h: 24, gate: solo ? "single" : "both" });
    buttons.push({ x: 100, y: 546, w: 58, h: 18, id: "left" });
    if (!solo) buttons.push({ x: route[3].x + 18, y: route[3].y - 22, w: 58, h: 18, id: "right" });
  }

  if (!solo && n >= 2) {
    addVault({
      id: "burrowA",
      color: "blue",
      button: { x: route[0].x + 38, y: route[0].y - 22, w: 62, h: 18 },
      gate: { x: 610, y: 250, w: 30, h: 318 },
      key: { x: 696, y: 520 },
    });
  }

  if (!solo && n >= 6) {
    addVault({
      id: "burrowB",
      color: "pink",
      button: { x: route[1].x + 34, y: route[1].y - 22, w: 62, h: 18 },
      gate: { x: 835, y: 220, w: 30, h: 348 },
      key: { x: 928, y: 520 },
    });
  }

  if (!solo && n >= 12) {
    addVault({
      id: "burrowC",
      color: hard % 2 ? "pink" : "blue",
      button: { x: last.x + 18, y: last.y - 22, w: 62, h: 18 },
      gate: { x: 1050, y: 220, w: 28, h: 348 },
      key: { x: 1110, y: 520 },
    });
  }

  if (n + soloBoost >= 6) {
    movers.push({
      x: 460,
      y: 360 - (hard % 3) * 18,
      w: 118,
      h: 24,
      minX: 440,
      maxX: 760,
      speed: 86 + hard * 5,
      dir: hard % 2 ? -1 : 1,
      active: n + soloBoost >= 12 ? "lift" : null,
    });
    if (n + soloBoost >= 12) buttons.push({ x: route[2].x + 22, y: route[2].y - 22, w: 58, h: 18, id: "lift" });
  }

  if (n + soloBoost >= 7) {
    hazards.push({
      x: 450,
      y: 518,
      r: 18,
      minX: 320,
      maxX: 720,
      speed: 105 + hard * 6 + (solo ? 20 : 0),
      dir: 1,
      axis: "x",
    });
  }
  if (n + soloBoost >= 11) {
    hazards.push({
      x: 820,
      y: 360,
      r: 16,
      minY: 262,
      maxY: 515,
      speed: 100 + hard * 5 + (solo ? 20 : 0),
      dir: hard % 2 ? -1 : 1,
      axis: "y",
    });
  }
  if (n + soloBoost >= 17) {
    hazards.push({
      x: 250,
      y: 518,
      r: 16,
      minX: 120,
      maxX: 360,
      speed: 155,
      dir: -1,
      axis: "x",
    });
  }

  addGroundSpring([34, 260, 370, 1010, 650, 735, 880]);
  if (n >= 5) addGroundSpring([650, 1010, 370, 260, 735, 34]);
  if (n >= 14) addGroundSpring([1010, 880, 735, 650, 370, 260]);

  for (let i = keys.length; i < keyCount; i += 1) {
    const p = route[Math.min(route.length - 1, i + 1 + (hard % 2))];
    keys.push({ x: p.x + p.w / 2, y: p.y - 42 });
  }

  return {
    name: levelNames[n - 1],
    spawn: [
      { x: 74, y: 470 },
      { x: 128, y: 470 },
    ],
    door: { x: last.x + last.w - 78, y: last.y - 112, w: 82, h: 112 },
    doors: solo
      ? [{ x: last.x + last.w - 70, y: last.y - 102, w: 58, h: 102, type: "blue" }]
      : [
          { x: last.x + last.w - 122, y: last.y - 102, w: 56, h: 102, type: "blue" },
          { x: last.x + last.w - 60, y: last.y - 102, w: 56, h: 102, type: "pink" },
        ],
    platforms,
    carrots,
    gems,
    keys,
    spikes,
    pools,
    buttons,
    barriers,
    chambers,
    springs,
    movers,
    hazards,
  };
}

let levels = Array.from({ length: LEVEL_COUNT }, (_, i) => makeLevel(i + 1, "duo"));

let players = [];
let level = null;
let solids = [];
let carrots = [];
let gemItems = [];
let keyItems = [];
let particles = [];
let buttonTimers = new Map();

function cloneRect(rect) {
  return { ...rect };
}

function loadLevel(index) {
  if (index === 0) {
    state.elapsed = 0;
    state.falls = 0;
  }
  state.level = index;
  state.carrots = 0;
  state.gems = 0;
  state.keys = 0;
  state.won = false;
  state.message = levels[index].name;
  state.shake = 0;
  buttonTimers = new Map();
  level = JSON.parse(JSON.stringify(levels[index]));
  carrots = level.carrots.map((c) => ({ ...c, got: false, bob: Math.random() * 10 }));
  gemItems = (level.gems || []).map((g) => ({ ...g, got: false, spin: Math.random() * 10 }));
  keyItems = (level.keys || []).map((k) => ({ ...k, got: false, spin: Math.random() * 10 }));
  const templates = state.mode === "solo" ? [playerTemplates[0]] : playerTemplates;
  players = templates.map((template, i) => ({
    ...template,
    x: level.spawn[i].x,
    y: level.spawn[i].y,
    w: 34,
    h: 44,
    vx: 0,
    vy: 0,
    face: 1,
    grounded: false,
    entered: false,
    squish: 0,
    dashCooldown: 0,
    dashFlash: 0,
  }));
  updateHud();
}

function updateHud() {
  modeEl.textContent = state.mode === "solo" ? "单人" : state.mode === "duo" ? "双人" : "首页";
  levelEl.textContent = `${state.level + 1}/${levels.length}`;
  carrotsEl.textContent = `${state.carrots}/${carrots.length}`;
  gemsEl.textContent = `${state.gems}/${gemItems.length}`;
  keysEl.textContent = `${state.keys}/${keyItems.length}`;
  timerEl.textContent = state.elapsed.toFixed(1);
  const best = Number(localStorage.getItem(`${BEST_KEY}-${state.mode}`) || 0);
  bestEl.textContent = best > 0 ? `${best.toFixed(1)}s` : "--";
  fallsEl.textContent = String(state.falls);
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function physicalPressedButtons() {
  const pressed = new Set();
  for (const button of level.buttons) {
    const plate = { x: button.x, y: button.y - 8, w: button.w, h: button.h + 14 };
    if (players.some((p) => rectsOverlap(p, plate))) pressed.add(button.id);
  }
  return pressed;
}

function activeButtons() {
  const active = physicalPressedButtons();
  for (const [id, remaining] of buttonTimers) {
    if (remaining > 0) active.add(id);
  }
  return active;
}

function updateButtonTimers(dt) {
  const pressed = physicalPressedButtons();
  for (const button of level.buttons) {
    if (pressed.has(button.id)) {
      buttonTimers.set(button.id, BUTTON_HOLD_TIME);
      continue;
    }
    const remaining = Math.max(0, (buttonTimers.get(button.id) || 0) - dt);
    const doorwayOccupied = (level.barriers || []).some((barrier) => barrier.opensWith === button.id && players.some((p) => rectsOverlap(p, barrier)));
    buttonTimers.set(button.id, doorwayOccupied ? Math.max(remaining, 0.2) : remaining);
  }
  return activeButtons();
}

function buildSolids(buttons) {
  const bothPressed = buttons.has("left") && buttons.has("right");
  solids = level.platforms
    .filter((p) => !p.gate || (p.gate === "both" && bothPressed) || (p.gate === "single" && buttons.size > 0))
    .map(cloneRect);

  for (const mover of level.movers) {
    if (!mover.active || buttons.has(mover.active)) solids.push(mover);
  }
}

function playerSolids(player, buttons) {
  const playerSolids = solids.map(cloneRect);
  for (const barrier of level.barriers || []) {
    if (!buttons.has(barrier.opensWith)) playerSolids.push(barrier);
  }
  return playerSolids;
}

function resolvePlayer(player, dt, buttons) {
  const currentSolids = playerSolids(player, buttons);
  player.grounded = false;
  player.x += player.vx * dt;
  for (const solid of currentSolids) {
    if (!rectsOverlap(player, solid)) continue;
    if (player.vx > 0) player.x = solid.x - player.w;
    if (player.vx < 0) player.x = solid.x + solid.w;
    player.vx = 0;
  }

  player.y += player.vy * dt;
  for (const solid of currentSolids) {
    if (!rectsOverlap(player, solid)) continue;
    if (player.vy > 0) {
      player.y = solid.y - player.h;
      player.grounded = true;
      player.squish = Math.min(1, Math.abs(player.vy) / 850);
    }
    if (player.vy < 0) player.y = solid.y + solid.h;
    player.vy = 0;
  }

  if (player.x < 0) {
    player.x = 0;
    player.vx = 0;
  }
  if (player.x + player.w > W) {
    player.x = W - player.w;
    player.vx = 0;
  }
}

function respawnPlayer(player) {
  const spawn = level.spawn[player.id === "blue" ? 0 : 1];
  player.x = spawn.x;
  player.y = spawn.y;
  player.vx = 0;
  player.vy = 0;
  player.entered = false;
  state.falls += 1;
  state.shake = 10;
  burst(player.x + player.w / 2, player.y + player.h / 2, player.color, 16);
  updateHud();
}

function playerCanTouchPool(player, pool) {
  if (pool.type === "acid") return false;
  return player.id === pool.type;
}

function playerDoorZone(player) {
  const door = (level.doors || [level.door]).find((d) => d.type === player.id) || level.door;
  return { x: door.x + 8, y: door.y + 12, w: door.w - 16, h: door.h };
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x,
      y,
      vx: Math.cos((Math.PI * 2 * i) / count) * Math.random() * 260,
      vy: Math.sin((Math.PI * 2 * i) / count) * Math.random() * 260,
      life: 0.65,
      color,
    });
  }
}

function update(dt) {
  if (state.mode === "home") return;
  if (state.paused) return;
  if (state.won) {
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 580 * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
    return;
  }
  state.elapsed += dt;
  const buttons = updateButtonTimers(dt);

  for (const mover of level.movers) {
    if (mover.active && !buttons.has(mover.active)) continue;
    mover.x += mover.speed * mover.dir * dt;
    if (mover.x < mover.minX || mover.x > mover.maxX) {
      mover.x = Math.max(mover.minX, Math.min(mover.maxX, mover.x));
      mover.dir *= -1;
    }
  }

  for (const hazard of level.hazards) {
    if (hazard.axis === "y") {
      hazard.y += hazard.speed * hazard.dir * dt;
      if (hazard.y < hazard.minY || hazard.y > hazard.maxY) {
        hazard.y = Math.max(hazard.minY, Math.min(hazard.maxY, hazard.y));
        hazard.dir *= -1;
      }
    } else {
      hazard.x += hazard.speed * hazard.dir * dt;
      if (hazard.x < hazard.minX || hazard.x > hazard.maxX) {
        hazard.x = Math.max(hazard.minX, Math.min(hazard.maxX, hazard.x));
        hazard.dir *= -1;
      }
    }
  }

  buildSolids(buttons);

  for (const player of players) {
    const left = keys.has(player.left);
    const right = keys.has(player.right);
    const jump = keys.has(player.jump);
    const drop = keys.has(player.drop);
    const dash = keys.has(player.dash);
    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.dashFlash = Math.max(0, player.dashFlash - dt);

    if (!player.entered) {
      player.vx += dir * MOVE * dt;
      player.vx = Math.max(-MAX_VX, Math.min(MAX_VX, player.vx));
      if (dir) player.face = dir;
      if (jump && player.grounded) {
        player.vy = -JUMP;
        player.grounded = false;
        player.squish = 0;
        burst(player.x + player.w / 2, player.y + player.h, "rgba(255,255,255,0.6)", 8);
      }
      if (drop) player.vy += 620 * dt;
      if (dash && player.dashCooldown <= 0) {
        const dashDir = dir || player.face || 1;
        player.vx = dashDir * 900;
        player.vy *= 0.45;
        player.dashCooldown = 1.2;
        player.dashFlash = 0.2;
        state.shake = Math.max(state.shake, 3);
        burst(player.x + player.w / 2, player.y + player.h / 2, player.color, 16);
      }
    } else {
      player.vx *= 0.7;
    }

    player.vy += GRAVITY * dt;
    player.vy = Math.min(MAX_VY, player.vy);
    player.vx *= player.grounded ? FRICTION : AIR_FRICTION;
    player.squish = Math.max(0, player.squish - dt * 5);
    resolvePlayer(player, dt, buttons);

    for (const spring of level.springs) {
      const trigger = { x: spring.x, y: spring.y - 12, w: spring.w, h: spring.h + 12 };
      if (rectsOverlap(player, trigger) && player.vy >= 0) {
        player.vy = -1020;
        player.grounded = false;
        burst(spring.x + spring.w / 2, spring.y, "#a8ffb8", 14);
      }
    }

    const hitHazard = level.hazards.some((hazard) => {
      const cx = player.x + player.w / 2;
      const cy = player.y + player.h / 2;
      const closestX = Math.max(player.x, Math.min(hazard.x, player.x + player.w));
      const closestY = Math.max(player.y, Math.min(hazard.y, player.y + player.h));
      return Math.hypot(hazard.x - closestX, hazard.y - closestY) < hazard.r || Math.hypot(hazard.x - cx, hazard.y - cy) < hazard.r + 8;
    });
    const badPool = level.pools.some((pool) => rectsOverlap(player, pool) && !playerCanTouchPool(player, pool));

    if (player.y > H + 80 || level.spikes.some((spike) => rectsOverlap(player, spike)) || hitHazard || badPool) {
      respawnPlayer(player);
    }

    const doorZone = playerDoorZone(player);
    player.entered = state.keys >= keyItems.length && rectsOverlap(player, doorZone);
  }

  for (const player of players) {
    player.x = Math.max(0, Math.min(W - player.w, player.x));
    player.vx = Math.max(-MAX_VX * 1.35, Math.min(MAX_VX * 1.35, player.vx));
    player.vy = Math.max(-MAX_VY, Math.min(MAX_VY, player.vy));
  }

  for (const carrot of carrots) {
    carrot.bob += dt * 6;
    if (carrot.got) continue;
    const hitbox = { x: carrot.x - 11, y: carrot.y - 22, w: 22, h: 34 };
    if (players.some((p) => rectsOverlap(p, hitbox))) {
      carrot.got = true;
      state.carrots += 1;
      burst(carrot.x, carrot.y, palette.carrot, 18);
      updateHud();
    }
  }

  for (const gem of gemItems) {
    gem.spin += dt * 4.6;
    if (gem.got) continue;
    const hitbox = { x: gem.x - 13, y: gem.y - 18, w: 26, h: 30 };
    const collector = players.find((p) => p.id === gem.type && rectsOverlap(p, hitbox));
    if (collector) {
      gem.got = true;
      state.gems += 1;
      burst(gem.x, gem.y, gem.type === "blue" ? palette.blue : palette.pink, 20);
      updateHud();
    }
  }

  for (const keyItem of keyItems) {
    keyItem.spin += dt * 4;
    if (keyItem.got) continue;
    const hitbox = { x: keyItem.x - 15, y: keyItem.y - 22, w: 30, h: 38 };
    if (players.some((p) => rectsOverlap(p, hitbox))) {
      keyItem.got = true;
      state.keys += 1;
      burst(keyItem.x, keyItem.y, "#ffd166", 22);
      updateHud();
    }
  }

  if (players.every((p) => p.entered)) {
    if (state.level < levels.length - 1) {
      loadLevel(state.level + 1);
    } else {
      state.won = true;
      state.message = "兔洞通关";
      const bestKey = `${BEST_KEY}-${state.mode}`;
      const best = Number(localStorage.getItem(bestKey) || 0);
      if (!best || state.elapsed < best) {
        localStorage.setItem(bestKey, String(state.elapsed));
      }
      updateHud();
      burst(level.door.x + 42, level.door.y + 48, "#ffd166", 44);
    }
  }

  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 580 * dt;
    p.life -= dt;
  }
  particles = particles.filter((p) => p.life > 0);
  state.shake = Math.max(0, state.shake - dt * 32);
  updateHud();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, palette.skyTop);
  sky.addColorStop(0.62, palette.skyBottom);
  sky.addColorStop(1, "#c38762");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.42)";
  for (let i = 0; i < 6; i += 1) {
    const x = 80 + i * 215;
    const y = 70 + (i % 3) * 34;
    cloud(x, y, 1 + (i % 2) * 0.22);
  }

  ctx.fillStyle = "rgba(68, 105, 75, 0.45)";
  hill(-110, 500, 520, 190);
  hill(340, 510, 520, 180);
  hill(760, 500, 520, 190);
}

function cloud(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.arc(0, 14, 26, 0, Math.PI * 2);
  ctx.arc(30, 2, 34, 0, Math.PI * 2);
  ctx.arc(70, 16, 24, 0, Math.PI * 2);
  ctx.rect(-6, 14, 96, 28);
  ctx.fill();
  ctx.restore();
}

function hill(x, y, w, h) {
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h, w / 2, h, 0, Math.PI, Math.PI * 2);
  ctx.fill();
}

function drawPlatform(rect) {
  ctx.fillStyle = palette.earthDark;
  roundRect(rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fill();
  ctx.fillStyle = palette.earth;
  roundRect(rect.x, rect.y, rect.w, Math.min(rect.h, 22), 8);
  ctx.fill();
  ctx.fillStyle = palette.grass;
  roundRect(rect.x - 1, rect.y - 7, rect.w + 2, 12, 8);
  ctx.fill();
}

function drawSpike(spike) {
  const count = Math.max(3, Math.floor(spike.w / 24));
  ctx.fillStyle = "#e8e0d3";
  for (let i = 0; i < count; i += 1) {
    const x = spike.x + (spike.w / count) * i;
    const w = spike.w / count;
    ctx.beginPath();
    ctx.moveTo(x, spike.y + spike.h);
    ctx.lineTo(x + w / 2, spike.y);
    ctx.lineTo(x + w, spike.y + spike.h);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCarrot(carrot) {
  if (carrot.got) return;
  const y = carrot.y + Math.sin(carrot.bob) * 5;
  ctx.save();
  ctx.translate(carrot.x, y);
  ctx.rotate(Math.sin(carrot.bob * 0.8) * 0.18);
  ctx.fillStyle = "#5eba61";
  ctx.fillRect(-3, -27, 6, 15);
  ctx.fillRect(-12, -23, 8, 5);
  ctx.fillRect(4, -23, 10, 5);
  ctx.fillStyle = palette.carrot;
  ctx.beginPath();
  ctx.moveTo(-11, -15);
  ctx.quadraticCurveTo(0, -25, 11, -15);
  ctx.lineTo(4, 13);
  ctx.quadraticCurveTo(0, 20, -4, 13);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawKey(keyItem) {
  if (keyItem.got) return;
  const y = keyItem.y + Math.sin(keyItem.spin) * 5;
  ctx.save();
  ctx.translate(keyItem.x, y);
  ctx.rotate(Math.sin(keyItem.spin * 0.7) * 0.18);
  ctx.strokeStyle = "#ffd166";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(-7, 0, 9, 0, Math.PI * 2);
  ctx.moveTo(2, 0);
  ctx.lineTo(22, 0);
  ctx.moveTo(14, 0);
  ctx.lineTo(14, 8);
  ctx.moveTo(21, 0);
  ctx.lineTo(21, 7);
  ctx.stroke();
  ctx.restore();
}

function drawGem(gem) {
  if (gem.got) return;
  const y = gem.y + Math.sin(gem.spin) * 5;
  const color = gem.type === "blue" ? palette.blue : palette.pink;
  ctx.save();
  ctx.translate(gem.x, y);
  ctx.rotate(gem.spin * 0.22);
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(13, -4);
  ctx.lineTo(8, 14);
  ctx.lineTo(-8, 14);
  ctx.lineTo(-13, -4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPool(pool) {
  const color = pool.type === "blue" ? palette.blue : pool.type === "pink" ? palette.pink : palette.acid;
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.72;
  roundRect(pool.x, pool.y, pool.w, pool.h, 10);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(pool.x + 8, pool.y + 7);
  ctx.lineTo(pool.x + pool.w - 8, pool.y + 7);
  ctx.stroke();
  ctx.restore();
}

function buttonTimeLeft(id) {
  return Math.max(0, buttonTimers.get(id) || 0);
}

function drawButton(button, pressed) {
  const base = button.color === "pink" ? palette.pink : button.color === "blue" ? palette.blue : "#ad6b47";
  const left = buttonTimeLeft(button.id);
  ctx.fillStyle = pressed ? "#7fe58a" : base;
  roundRect(button.x, button.y + (pressed ? 8 : 0), button.w, button.h - (pressed ? 8 : 0), 7);
  ctx.fill();
  ctx.strokeStyle = pressed ? "rgba(255,255,255,0.76)" : "rgba(0,0,0,0.24)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(button.x + 7, button.y + button.h, button.w - 14, 5);
  if (left > 0) {
    ctx.fillStyle = "rgba(17,22,24,0.72)";
    roundRect(button.x + button.w / 2 - 18, button.y - 25, 36, 18, 8);
    ctx.fill();
    ctx.fillStyle = left < 1.5 ? "#ffda7b" : "#f5f1e8";
    ctx.font = "800 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(left.toFixed(1), button.x + button.w / 2, button.y - 12);
  }
}

function drawChamber(chamber, open) {
  const color = chamber.color === "pink" ? palette.pink : palette.blue;
  ctx.save();
  ctx.globalAlpha = open ? 0.2 : 0.34;
  ctx.fillStyle = color;
  roundRect(chamber.x, chamber.y, chamber.w, chamber.h, 12);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = open ? "rgba(245,241,232,0.34)" : color;
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 9]);
  roundRect(chamber.x, chamber.y, chamber.w, chamber.h, 12);
  ctx.stroke();
  ctx.restore();
}

function drawBarrier(barrier, open) {
  const color = barrier.color === "pink" ? palette.pink : palette.blue;
  const left = buttonTimeLeft(barrier.opensWith);
  ctx.save();
  ctx.globalAlpha = open ? 0.2 : 0.86;
  ctx.fillStyle = open ? "rgba(245,241,232,0.28)" : "#3a2825";
  roundRect(barrier.x, barrier.y, barrier.w, barrier.h, 6);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  for (let x = barrier.x + 7; x < barrier.x + barrier.w; x += 10) {
    ctx.beginPath();
    ctx.moveTo(x, barrier.y + 8);
    ctx.lineTo(x, barrier.y + barrier.h - 8);
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.globalAlpha = open ? 0.38 : 1;
  roundRect(barrier.x - 5, barrier.y - 8, barrier.w + 10, 12, 5);
  ctx.fill();
  roundRect(barrier.x - 5, barrier.y + barrier.h - 4, barrier.w + 10, 12, 5);
  ctx.fill();
  ctx.globalAlpha = open ? 0.2 : 0.92;
  ctx.fillStyle = "#201816";
  ctx.font = "800 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.save();
  ctx.translate(barrier.x + barrier.w / 2, barrier.y + barrier.h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(open ? `${left.toFixed(1)}s` : "CLOSED", 0, 4);
  ctx.restore();
  ctx.restore();
}

function drawSpring(spring) {
  ctx.strokeStyle = "#ddf8d7";
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i <= 8; i += 1) {
    const x = spring.x + 7 + i * ((spring.w - 14) / 8);
    const y = spring.y + (i % 2 ? 1 : spring.h - 2);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = "#7fe58a";
  roundRect(spring.x, spring.y - 5, spring.w, 8, 4);
  ctx.fill();
}

function drawHazard(hazard) {
  ctx.save();
  ctx.translate(hazard.x, hazard.y);
  ctx.rotate((performance.now() / 260) * hazard.dir);
  ctx.fillStyle = "#55322f";
  ctx.beginPath();
  ctx.arc(0, 0, hazard.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#f3dfc5";
  ctx.lineWidth = 5;
  for (let i = 0; i < 8; i += 1) {
    const a = (Math.PI * 2 * i) / 8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (hazard.r - 2), Math.sin(a) * (hazard.r - 2));
    ctx.lineTo(Math.cos(a) * (hazard.r + 10), Math.sin(a) * (hazard.r + 10));
    ctx.stroke();
  }
  ctx.restore();
}

function drawHazardRail(hazard) {
  ctx.save();
  ctx.strokeStyle = "rgba(85, 50, 47, 0.35)";
  ctx.lineWidth = 5;
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  if (hazard.axis === "y") {
    ctx.moveTo(hazard.x, hazard.minY);
    ctx.lineTo(hazard.x, hazard.maxY);
  } else {
    ctx.moveTo(hazard.minX, hazard.y);
    ctx.lineTo(hazard.maxX, hazard.y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawDoor() {
  const doors = level.doors || [level.door];
  if (doors.length > 1) drawDuoDoorLink(doors);
  for (const d of doors) drawElementDoor(d);
}

function drawElementDoor(d) {
  const unlocked = state.keys >= keyItems.length;
  const glow = d.type === "blue" ? palette.blue : d.type === "pink" ? palette.pink : palette.doorGlow;
  const entrant = players.find((p) => p.id === d.type);
  const entered = Boolean(entrant?.entered);
  ctx.fillStyle = palette.door;
  ctx.beginPath();
  ctx.moveTo(d.x, d.y + d.h);
  ctx.lineTo(d.x, d.y + 34);
  ctx.quadraticCurveTo(d.x + d.w / 2, d.y - 20, d.x + d.w, d.y + 34);
  ctx.lineTo(d.x + d.w, d.y + d.h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = entered ? "#7fe58a" : unlocked ? glow : "#8c6b43";
  ctx.lineWidth = entered ? 6 : 4;
  ctx.stroke();
  ctx.fillStyle = entered
    ? "rgba(127, 229, 138, 0.2)"
    : unlocked
      ? d.type === "pink"
        ? "rgba(255, 156, 201, 0.18)"
        : "rgba(120, 200, 255, 0.18)"
      : "rgba(0, 0, 0, 0.22)";
  roundRect(d.x + 15, d.y + 38, d.w - 30, d.h - 48, 20);
  ctx.fill();
  if (entered) {
    ctx.fillStyle = "#7fe58a";
    ctx.font = "800 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("OK", d.x + d.w / 2, d.y + 74);
  } else if (!unlocked) {
    ctx.fillStyle = "#ffd166";
    ctx.font = "700 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("LOCK", d.x + d.w / 2, d.y + 74);
  } else {
    ctx.fillStyle = glow;
    ctx.font = "800 20px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(d.type === "pink" ? "P" : "B", d.x + d.w / 2, d.y + 72);
  }
}

function drawDuoDoorLink(doors) {
  const unlocked = state.keys >= keyItems.length;
  const allEntered = players.length > 1 && players.every((p) => p.entered);
  const left = Math.min(...doors.map((d) => d.x));
  const right = Math.max(...doors.map((d) => d.x + d.w));
  const top = Math.min(...doors.map((d) => d.y));
  const cx = (left + right) / 2;
  const y = top - 30;
  ctx.save();
  ctx.strokeStyle = allEntered ? "#7fe58a" : unlocked ? "#ffd166" : "rgba(140,107,67,0.8)";
  ctx.lineWidth = 4;
  ctx.setLineDash(allEntered ? [] : [8, 8]);
  ctx.beginPath();
  ctx.moveTo(left + 18, y);
  ctx.quadraticCurveTo(cx, y - 24, right - 18, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = allEntered ? "#7fe58a" : unlocked ? "#ffd166" : "#8c6b43";
  roundRect(cx - 34, y - 16, 68, 24, 8);
  ctx.fill();
  ctx.fillStyle = "#201816";
  ctx.font = "800 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(allEntered ? "同步" : unlocked ? "双人门" : "锁定", cx, y + 1);
  if (unlocked && players.some((p) => p.entered) && !allEntered) {
    ctx.fillStyle = "rgba(245,241,232,0.88)";
    ctx.font = "700 14px system-ui, sans-serif";
    ctx.fillText("等待队友", cx, y - 24);
  }
  ctx.restore();
}

function drawPlayer(player) {
  if (player.entered) {
    ctx.globalAlpha = 0.38;
  }
  const squishY = 1 - player.squish * 0.12;
  const squishX = 1 + player.squish * 0.14;
  const cx = player.x + player.w / 2;
  const cy = player.y + player.h / 2;
  ctx.save();
  ctx.translate(cx, cy + player.squish * 4);
  ctx.scale(squishX, squishY);

  if (player.dashFlash > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    ctx.beginPath();
    ctx.ellipse(-player.face * 24, 4, 18, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = player.dark;
  ctx.beginPath();
  ctx.ellipse(-8, -31, 7, 21, -0.25, 0, Math.PI * 2);
  ctx.ellipse(8, -31, 7, 21, 0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.ellipse(0, 4, 18, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -11, 17, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#12171a";
  ctx.beginPath();
  ctx.arc(player.face > 0 ? 6 : -6, -14, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.beginPath();
  ctx.ellipse(-player.face * 11, 3, 7, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;

  const ready = 1 - player.dashCooldown / 1.2;
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  roundRect(player.x - 2, player.y - 12, player.w + 4, 5, 4);
  ctx.fill();
  ctx.fillStyle = player.color;
  roundRect(player.x - 2, player.y - 12, (player.w + 4) * Math.max(0, Math.min(1, ready)), 5, 4);
  ctx.fill();
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / 0.65);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 5, 5);
  }
  ctx.globalAlpha = 1;
}

function roundRect(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
}

function drawOverlay(text, subtext) {
  ctx.fillStyle = "rgba(17, 22, 24, 0.58)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#f5f1e8";
  ctx.font = "800 56px system-ui, sans-serif";
  ctx.fillText(text, W / 2, H / 2 - 26);
  ctx.fillStyle = "rgba(245,241,232,0.78)";
  ctx.font = "22px system-ui, sans-serif";
  ctx.fillText(subtext, W / 2, H / 2 + 22);
}

function draw() {
  if (state.mode === "home") return;
  ctx.save();
  if (state.shake > 0) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }
  drawBackground();

  drawDoor();
  buildSolids(activeButtons());
  for (const platform of solids) drawPlatform(platform);
  for (const spike of level.spikes) drawSpike(spike);
  for (const pool of level.pools) drawPool(pool);
  for (const hazard of level.hazards) drawHazardRail(hazard);
  for (const spring of level.springs) drawSpring(spring);

  const buttons = activeButtons();
  for (const chamber of level.chambers || []) drawChamber(chamber, buttons.has(chamber.opensWith));
  for (const barrier of level.barriers || []) drawBarrier(barrier, buttons.has(barrier.opensWith));
  for (const button of level.buttons) drawButton(button, buttons.has(button.id));
  for (const carrot of carrots) drawCarrot(carrot);
  for (const gem of gemItems) drawGem(gem);
  for (const keyItem of keyItems) drawKey(keyItem);
  for (const player of players) drawPlayer(player);
  for (const hazard of level.hazards) drawHazard(hazard);
  drawParticles();
  ctx.restore();

  if (state.paused) drawOverlay("暂停", "按 P 继续");
  if (state.won) drawOverlay("通关成功", `用时 ${state.elapsed.toFixed(1)} 秒，重试 ${state.falls} 次`);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.032, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys.add(key);
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
  if (key === "r") loadLevel(state.level);
  if (key === "p") state.paused = !state.paused;
  if (key === "n") loadLevel(Math.min(levels.length - 1, state.level + 1));
  if (key === "b") loadLevel(Math.max(0, state.level - 1));
  if (key === "h") showHome();
});

window.addEventListener("keyup", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys.delete(key);
});

for (const button of document.querySelectorAll("[data-key]")) {
  const key = button.getAttribute("data-key");
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    keys.add(key);
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener("pointerup", () => keys.delete(key));
  button.addEventListener("pointercancel", () => keys.delete(key));
  button.addEventListener("pointerleave", () => keys.delete(key));
}

function startMode(mode) {
  state.mode = mode;
  state.paused = false;
  state.won = false;
  levels = Array.from({ length: LEVEL_COUNT }, (_, i) => makeLevel(i + 1, mode));
  homeEl.classList.add("is-hidden");
  canvas.classList.remove("is-hidden");
  pinkHelpEl.style.display = mode === "solo" ? "none" : "";
  loadLevel(0);
}

function showHome() {
  state.mode = "home";
  state.paused = false;
  state.won = false;
  homeEl.classList.remove("is-hidden");
  canvas.classList.add("is-hidden");
  pinkHelpEl.style.display = "";
  updateHud();
}

for (const button of document.querySelectorAll("[data-mode]")) {
  button.addEventListener("click", () => startMode(button.getAttribute("data-mode")));
}

showHome();
requestAnimationFrame(loop);
