export const W = 270;
export const H = 480;
export const BIRD_X = 86;
export const BIRD_R = 11;
export const SEA_Y = 404;
export const START_Y = 188;
export const GRAVITY = 1780;
export const FLAP_V = -530;
export const MAX_FALL = 640;
export const PX_PER_M = 18;

export type FlyerId = "condor" | "penguin" | "leonardo";
export type WingId = "balsa" | "gull" | "carnival" | "deckchair";
export type Phase = "title" | "hangar" | "ready" | "play" | "dead";
export type Difficulty = "easy" | "medium" | "hard";
export type GateSide = "both" | "down" | "up";
export type GateKind = "pier" | "groyne" | "moored" | "festival";

export type Course = {
  baseSpeed: number;
  maxSpeed: number;
  accel: number;
  gap: number;
  gapShrink: number;
  minGap: number;
  spacing: number;
  spacingShrink: number;
  minSpacing: number;
  firstGate: number;
};

export const COURSES: Record<Difficulty, Course> = {
  easy: {
    baseSpeed: 74,
    maxSpeed: 112,
    accel: 0.22,
    gap: 170,
    gapShrink: 0.02,
    minGap: 150,
    spacing: 340,
    spacingShrink: 0.04,
    minSpacing: 280,
    firstGate: 480,
  },
  medium: {
    baseSpeed: 112,
    maxSpeed: 190,
    accel: 0.5,
    gap: 156,
    gapShrink: 0.06,
    minGap: 124,
    spacing: 232,
    spacingShrink: 0.09,
    minSpacing: 172,
    firstGate: 320,
  },
  hard: {
    baseSpeed: 148,
    maxSpeed: 248,
    accel: 0.95,
    gap: 128,
    gapShrink: 0.12,
    minGap: 96,
    spacing: 188,
    spacingShrink: 0.14,
    minSpacing: 132,
    firstGate: 240,
  },
};

export type Gate = {
  x: number;
  w: number;
  gapY: number;
  gapH: number;
  lip: number;
  side: GateSide;
  kind: GateKind;
  passed: boolean;
};

export type Speck = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  color: string;
};

export type Gull = { x: number; y: number; v: number; phase: number };

export type Run = {
  phase: Phase;
  scroll: number;
  y: number;
  vy: number;
  angle: number;
  wingT: number;
  metres: number;
  gates: Gate[];
  nextX: number;
  lastGapY: number;
  specks: Speck[];
  gulls: Gull[];
  shake: number;
  deathT: number;
  time: number;
  acc: number;
  splashed: boolean;
  passChime: boolean;
  mark46: boolean;
  mark100: boolean;
  mark206: boolean;
  mark: "46" | "100" | "206" | null;
  difficulty: Difficulty;
  paused: boolean;
};

const STEP = 1 / 60;

export function createRun(): Run {
  const specks: Speck[] = [];
  for (let i = 0; i < 48; i++) {
    specks.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, r: 1, color: "#f4efe4" });
  }
  const gulls: Gull[] = [
    { x: 40, y: 70, v: 18, phase: 0.2 },
    { x: 150, y: 110, v: 26, phase: 1.4 },
    { x: 230, y: 54, v: 16, phase: 2.2 },
    { x: 90, y: 140, v: 22, phase: 3.1 },
  ];
  const run = {
    phase: "hangar" as Phase,
    scroll: 0,
    y: START_Y,
    vy: 0,
    angle: 0,
    wingT: 0,
    metres: 0,
    gates: [],
    nextX: COURSES.medium.firstGate,
    lastGapY: 200,
    specks,
    gulls,
    shake: 0,
    deathT: 0,
    time: 0,
    acc: 0,
    splashed: false,
    passChime: false,
    mark46: false,
    mark100: false,
    mark206: false,
    mark: null,
    difficulty: "medium" as Difficulty,
    paused: false,
  };
  return run;
}

export function resetRun(run: Run, phase: Phase) {
  run.phase = phase;
  run.scroll = 0;
  run.y = START_Y;
  run.vy = 0;
  run.angle = 0;
  run.wingT = 0;
  run.metres = 0;
  run.gates.length = 0;
  run.nextX = COURSES[run.difficulty].firstGate;
  run.lastGapY = 210;
  run.shake = 0;
  run.deathT = 0;
  run.acc = 0;
  run.splashed = false;
  run.passChime = false;
  run.mark46 = false;
  run.mark100 = false;
  run.mark206 = false;
  run.mark = null;
  run.paused = false;
  for (const s of run.specks) s.life = 0;
}

function speedFor(run: Run) {
  const course = COURSES[run.difficulty];
  const metres = run.scroll / PX_PER_M;
  return Math.min(course.maxSpeed, course.baseSpeed + metres * course.accel);
}

function gapFor(run: Run) {
  const course = COURSES[run.difficulty];
  const metres = run.scroll / PX_PER_M;
  return Math.max(course.minGap, course.gap - metres * course.gapShrink);
}

function spacingFor(run: Run) {
  const course = COURSES[run.difficulty];
  const metres = run.scroll / PX_PER_M;
  return Math.max(course.minSpacing, course.spacing - metres * course.spacingShrink);
}

function spawnSpeck(run: Run, x: number, y: number, kind: "flap" | "splash") {
  const p = run.specks.find((s) => s.life <= 0);
  if (!p) return;
  p.max = kind === "splash" ? 0.45 + Math.random() * 0.35 : 0.22 + Math.random() * 0.12;
  p.life = p.max;
  p.x = x + (Math.random() - 0.5) * 8;
  p.y = y;
  p.r = kind === "splash" ? 1.4 + Math.random() * 2.2 : 1.1 + Math.random();
  if (kind === "flap") {
    p.vx = -70 - Math.random() * 90;
    p.vy = (Math.random() - 0.5) * 80;
    p.color = Math.random() > 0.5 ? "#f4efe4" : "#e2b340";
  } else {
    const a = Math.random() * Math.PI;
    const s = 50 + Math.random() * 160;
    p.vx = Math.cos(a) * s;
    p.vy = -Math.abs(Math.sin(a) * s) - 30;
    p.color = Math.random() > 0.4 ? "#d7efe8" : "#8ecae6";
  }
}

export function flap(run: Run) {
  if (run.paused || run.phase === "hangar" || run.phase === "title") return;
  if (run.phase === "dead") resetRun(run, "ready");
  if (run.phase === "ready") run.phase = "play";
  if (run.phase !== "play") return;
  run.vy = FLAP_V;
  run.wingT = 0.16;
  run.angle = -0.55;
  spawnSpeck(run, BIRD_X - 8, run.y + 4, "flap");
  spawnSpeck(run, BIRD_X - 12, run.y + 2, "flap");
  spawnSpeck(run, BIRD_X - 6, run.y - 2, "flap");
}

function die(run: Run) {
  if (run.phase !== "play") return;
  run.phase = "dead";
  run.deathT = 0;
  run.shake = 7;
  run.vy = Math.max(run.vy, 40);
}

function circleHits(cx: number, cy: number, r: number, x: number, y: number, w: number, h: number) {
  const nx = Math.max(x, Math.min(cx, x + w));
  const ny = Math.max(y, Math.min(cy, y + h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

function pickSide(difficulty: Difficulty): GateSide {
  if (difficulty === "hard") return "both";
  if (difficulty === "easy") return Math.random() < 0.5 ? "down" : "up";
  const roll = Math.random();
  if (roll < 0.3) return "down";
  if (roll < 0.6) return "up";
  return "both";
}

function spawnGate(run: Run, x: number) {
  const metres = run.scroll / PX_PER_M;
  const gapH = gapFor(run);
  const side = pickSide(run.difficulty);
  let gapY = run.lastGapY;
  let lip = 0;
  if (side === "both") {
    const half = gapH / 2;
    const minC = 36 + half;
    const maxC = SEA_Y - 36 - half;
    gapY = minC + Math.random() * Math.max(1, maxC - minC);
    const reach = run.difficulty === "hard" ? 170 : 120;
    gapY = Math.max(run.lastGapY - reach, Math.min(run.lastGapY + reach, gapY));
    gapY = Math.max(minC, Math.min(maxC, gapY));
    run.lastGapY = gapY;
  } else if (side === "down") {
    const deep = run.difficulty === "easy" ? 96 + Math.random() * 72 : 140 + Math.random() * 110;
    lip = deep;
    run.lastGapY = Math.min(SEA_Y - 80, lip + 90);
  } else {
    const rise = run.difficulty === "easy" ? 96 + Math.random() * 72 : 140 + Math.random() * 110;
    lip = SEA_Y - rise;
    run.lastGapY = Math.max(80, lip - 70);
  }
  let kind: GateKind = "pier";
  if (metres > 28) {
    const roll = Math.random();
    kind = roll < 0.32 ? "pier" : roll < 0.58 ? "groyne" : roll < 0.8 ? "moored" : "festival";
  } else if (Math.random() > 0.55) {
    kind = "groyne";
  }
  run.gates.push({
    x,
    w: run.difficulty === "hard" ? 54 : 48,
    gapY,
    gapH,
    lip,
    side,
    kind,
    passed: false,
  });
}

function tick(run: Run, dt: number) {
  run.time += dt;
  run.wingT = Math.max(0, run.wingT - dt);

  for (const g of run.gulls) {
    g.x -= g.v * dt;
    g.phase += dt * 7;
    if (g.x < -24) {
      g.x = W + 10 + Math.random() * 40;
      g.y = 40 + Math.random() * 120;
    }
  }

  for (const p of run.specks) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.vy += 820 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  if (run.phase === "title" || run.phase === "hangar" || run.phase === "ready") {
    run.y = START_Y + Math.sin(run.time * 2.3) * 5;
    run.angle = Math.sin(run.time * 1.5) * 0.05;
    return;
  }

  if (run.phase === "dead") {
    run.deathT += dt;
    run.shake *= Math.pow(0.88, dt * 60);
    if (run.y < SEA_Y + 16) {
      run.vy = Math.min(MAX_FALL, run.vy + GRAVITY * dt);
      run.y += run.vy * dt;
      run.angle += dt * 1.6;
    }
    if (!run.splashed && run.y > SEA_Y - BIRD_R) {
      run.splashed = true;
      for (let i = 0; i < 14; i++) spawnSpeck(run, BIRD_X, SEA_Y, "splash");
    }
    return;
  }

  const speed = speedFor(run);
  run.vy = Math.min(MAX_FALL, run.vy + GRAVITY * dt);
  run.y += run.vy * dt;
  const target = Math.max(-0.5, Math.min(1.15, run.vy / 680));
  run.angle += (target - run.angle) * Math.min(1, dt * 9);
  run.scroll += speed * dt;
  run.metres = run.scroll / PX_PER_M;

  if (!run.mark46 && run.metres >= 46) {
    run.mark46 = true;
    run.mark = "46";
  } else if (!run.mark100 && run.metres >= 100) {
    run.mark100 = true;
    run.mark = "100";
  } else if (!run.mark206 && run.metres >= 206) {
    run.mark206 = true;
    run.mark = "206";
  }

  const viewRight = run.scroll + W + 30;
  while (run.nextX < viewRight) {
    spawnGate(run, run.nextX);
    run.nextX += spacingFor(run);
  }

  const birdWorld = run.scroll + BIRD_X;
  for (let i = run.gates.length - 1; i >= 0; i--) {
    const g = run.gates[i];
    if (!g) continue;
    if (!g.passed && g.x + g.w < birdWorld - 6) {
      g.passed = true;
      run.passChime = true;
    }
    if (g.x + g.w < run.scroll - 40) run.gates.splice(i, 1);
  }

  if (run.y < 16 + BIRD_R || run.y > SEA_Y - BIRD_R) {
    die(run);
    return;
  }

  for (const g of run.gates) {
    const sx = g.x - run.scroll;
    const topEdge = g.side === "down" ? g.lip : g.gapY - g.gapH / 2;
    const botEdge = g.side === "up" ? g.lip : g.gapY + g.gapH / 2;
    const inset = 10;
    const rx = sx + inset;
    const rw = g.w - inset * 2;
    const hitTop = g.side !== "up" && circleHits(BIRD_X, run.y, BIRD_R, rx, -20, rw, topEdge + 20);
    const hitBot = g.side !== "down" && circleHits(BIRD_X, run.y, BIRD_R, rx, botEdge, rw, SEA_Y - botEdge + 40);
    if (hitTop || hitBot) {
      die(run);
      return;
    }
  }
}

export function step(run: Run, dt: number) {
  if (run.paused) {
    run.acc = 0;
    return;
  }
  run.acc += Math.min(dt, 0.05);
  let n = 0;
  while (run.acc >= STEP && n < 5) {
    tick(run, STEP);
    run.acc -= STEP;
    n++;
  }
}

export function epitaph(metres: number): { title: string; line: string } {
  const m = Math.floor(metres);
  if (m >= 206) {
    return {
      title: "Past the pier record",
      line: "206 metres was as far as anyone stayed up off this ramp.",
    };
  }
  if (m >= 100) {
    return {
      title: "Purse distance",
      line: "A hundred metres. That was the line they paid the prize for.",
    };
  }
  if (m >= 46) {
    return {
      title: "Fifty-yard line",
      line: "Past the old fifty yards. The early purses started here.",
    };
  }
  if (m >= 12) {
    return {
      title: "Off the pier",
      line: "You cleared the ramp. The Channel kept the rest.",
    };
  }
  return {
    title: "Splash",
    line: "The ramp at Bognor is still there. Tap a little sooner.",
  };
}
