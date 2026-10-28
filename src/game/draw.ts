import {
  BIRD_R,
  BIRD_X,
  H,
  PX_PER_M,
  SEA_Y,
  W,
  type FlyerId,
  type GateKind,
  type Run,
  type WingId,
} from "@/game/run";

export type Art = {
  condor: HTMLImageElement;
  penguin: HTMLImageElement;
  leonardo: HTMLImageElement;
  balsa: HTMLImageElement;
  gull: HTMLImageElement;
  carnival: HTMLImageElement;
  deckchair: HTMLImageElement;
  column: HTMLImageElement;
  groyne: HTMLImageElement;
  boat: HTMLImageElement;
  balloons: HTMLImageElement;
  ramp: HTMLImageElement;
  panorama: HTMLImageElement;
  sky: HTMLImageElement;
  sea: HTMLImageElement;
};

const SKY = "#8ecae6";
const WATER = "#14607a";
const INK = "#1c2836";
const CREAM = "#f4efe4";
const BUOY = "#e85d4c";

function fit(img: HTMLImageElement, maxW: number, maxH: number) {
  const s = Math.min(maxW / img.width, maxH / img.height);
  return { w: img.width * s, h: img.height * s };
}

function blitStrip(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  y: number,
  h: number,
  scroll: number,
  parallax: number,
) {
  const iw = Math.max(8, h * (img.width / img.height));
  let shift = -((scroll * parallax) % iw);
  if (shift > 0) shift -= iw;
  for (let x = shift; x < W + iw; x += iw) {
    ctx.drawImage(img, x, y, iw, h);
  }
}

function drawCapped(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  capAt: "top" | "bottom",
  capFrac: number,
) {
  if (h < 6 || w < 2) return;
  const sw = img.width;
  const sh = img.height;
  const capSrc = Math.max(1, sh * capFrac);
  const shaftY = sh * 0.46;
  const shaftHsrc = Math.max(1, sh * 0.12);
  const capH = Math.min(Math.max(12, h * 0.26), w * 1.1);
  const shaftH = Math.max(0, h - capH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 1, y, w + 2, h);
  ctx.clip();
  if (capAt === "bottom") {
    ctx.translate(x, y + h);
    ctx.scale(1, -1);
  } else {
    ctx.translate(x, y);
  }
  if (shaftH > 1) ctx.drawImage(img, 0, shaftY, sw, shaftHsrc, 0, capH, w, shaftH);
  ctx.drawImage(img, 0, 0, sw, capSrc, 0, 0, w, capH);
  ctx.restore();
}

function drawBuoyMarker(ctx: CanvasRenderingContext2D, x: number) {
  ctx.save();
  ctx.translate(x, SEA_Y - 6);
  ctx.fillStyle = INK;
  ctx.fillRect(-1, -18, 2, 18);
  ctx.fillStyle = BUOY;
  ctx.beginPath();
  ctx.arc(0, -24, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = CREAM;
  ctx.fillRect(-7, -25.5, 14, 3);
  ctx.fillRect(-1.5, -31, 3, 14);
  ctx.restore();
}

function postImage(art: Art, kind: GateKind, which: "top" | "bot") {
  if (kind === "pier") return { img: art.column, frac: 0.22 };
  if (kind === "festival" && which === "top") return { img: art.column, frac: 0.22 };
  return { img: art.groyne, frac: 0.16 };
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  run: Run,
  art: Art | null,
  flyer: FlyerId,
  wings: WingId,
  reduceMotion: boolean,
) {
  const dprScale = Math.min(canvas.width / W, canvas.height / H);
  const ox = (canvas.width - W * dprScale) / 2;
  const oy = (canvas.height - H * dprScale) / 2;
  const sh = reduceMotion ? 0 : run.shake;
  const shx = sh > 0.2 ? (Math.random() - 0.5) * sh * dprScale : 0;
  const shy = sh > 0.2 ? (Math.random() - 0.5) * sh * dprScale : 0;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dprScale, 0, 0, dprScale, ox + shx, oy + shy);
  ctx.imageSmoothingEnabled = true;

  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, W, H);

  if (art) {
    blitStrip(ctx, art.sky, 0, 230, run.scroll, 0.12);
    const ph = 360;
    const pw = ph * (art.panorama.width / art.panorama.height);
    const py = SEA_Y - ph * 0.78;
    ctx.drawImage(art.panorama, -run.scroll * 0.4, py, pw, ph);
    blitStrip(ctx, art.sea, SEA_Y - 16, H - SEA_Y + 16, run.scroll, 1.05);
  } else {
    ctx.fillStyle = WATER;
    ctx.fillRect(0, SEA_Y, W, H - SEA_Y);
  }

  ctx.fillStyle = "rgba(215, 239, 232, 0.85)";
  const foam = -((run.scroll * 1.4) % 18);
  for (let x = foam; x < W; x += 18) {
    ctx.fillRect(x, SEA_Y - 2, 10, 2);
  }

  for (const g of run.gulls) {
    const lift = Math.sin(g.phase) * 2.2;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(g.x - 7, g.y + lift);
    ctx.lineTo(g.x, g.y - 3 - lift);
    ctx.lineTo(g.x + 7, g.y + lift);
    ctx.stroke();
  }

  if (art) {
    for (const gate of run.gates) {
      const sx = gate.x - run.scroll;
      if (sx > W + 20 || sx + gate.w < -20) continue;
      const gapTop = gate.side === "down" ? gate.lip : gate.gapY - gate.gapH / 2;
      const gapBot = gate.side === "up" ? gate.lip : gate.gapY + gate.gapH / 2;
      const top = postImage(art, gate.kind, "top");
      const bot = postImage(art, gate.kind, "bot");
      if (gate.side !== "up") {
        const topH = gapTop + 8;
        drawCapped(ctx, top.img, sx, -8, gate.w, topH, "bottom", top.frac);
        if (gate.kind === "festival" && topH > 70) {
          const box = fit(art.balloons, 58, 72);
          ctx.drawImage(art.balloons, sx + gate.w / 2 - box.w / 2, gapTop - box.h, box.w, box.h);
        }
      }
      if (gate.side !== "down") {
        const botH = SEA_Y + 30 - gapBot;
        drawCapped(ctx, bot.img, sx, gapBot, gate.w, botH, "top", bot.frac);
        if (gate.kind === "moored" && botH > 78) {
          const box = fit(art.boat, 86, 52);
          ctx.drawImage(art.boat, sx + gate.w / 2 - box.w / 2, SEA_Y - box.h + 6, box.w, box.h);
        }
      }
    }

    const marks = [46, 100, 206];
    for (const m of marks) {
      const sx = m * PX_PER_M - run.scroll;
      if (sx > -20 && sx < W + 20) drawBuoyMarker(ctx, sx);
    }

    const rampW = 168;
    const rampH = rampW * (art.ramp.height / art.ramp.width);
    const rampX = -6 - run.scroll;
    if (rampX < W && rampX + rampW > -10) {
      ctx.drawImage(art.ramp, rampX, 196, rampW, rampH);
    }

    const body = art[flyer];
    const wing = art[wings];
    const kick = -(run.wingT / 0.16) * 0.7;
    const wb = fit(wing, 70, 34);
    ctx.save();
    ctx.translate(BIRD_X - 4, run.y - 4);
    ctx.rotate(run.angle * 0.4 + kick - 0.28);
    ctx.scale(-1, 1);
    ctx.drawImage(wing, -2, -wb.h * 0.4, wb.w, wb.h);
    ctx.restore();

    const bb = fit(body, 52, 62);
    ctx.save();
    ctx.translate(BIRD_X, run.y);
    ctx.rotate(run.angle);
    ctx.drawImage(body, -bb.w * 0.42, -bb.h * 0.48, bb.w, bb.h);
    ctx.restore();
  } else {
    ctx.fillStyle = BUOY;
    ctx.beginPath();
    ctx.arc(BIRD_X, run.y, BIRD_R + 4, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const p of run.specks) {
    if (p.life <= 0) continue;
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.r, p.r);
  }
  ctx.globalAlpha = 1;

  if (run.phase === "dead" && run.deathT < 0.12) {
    ctx.fillStyle = `rgba(244, 239, 228, ${0.35 * (1 - run.deathT / 0.12)})`;
    ctx.fillRect(0, 0, W, H);
  }
}
