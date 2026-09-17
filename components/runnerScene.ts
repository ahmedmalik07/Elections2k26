import { isPickup, zones } from "@/lib/runner.mjs";

export type Kind =
  | "vote"
  | "chai"
  | "wings"
  | "magnet"
  | "double"
  | "collab"
  | "quiz"
  | "deadline"
  | "bar"
  | "bus";
export type Item = {
  lane: number;
  z: number;
  kind: Kind;
  label?: string;
  hit?: boolean;
};
export type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
};
export type Floater = {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
};
export type Phase = "ready" | "running" | "paused" | "over";
export type Run = {
  phase: Phase;
  lane: number;
  visualLane: number;
  jump: number;
  slide: number;
  fly: number;
  magnet: number;
  double: number;
  shield: boolean;
  grace: number;
  shake: number;
  flash: number;
  distance: number;
  time: number;
  spawn: number;
  collabTimer: number;
  collabsSpawned: number;
  items: Item[];
  sparks: Spark[];
  floaters: Floater[];
  votes: number;
  points: number;
  chain: number;
  chainTimer: number;
  maxChain: number;
  chai: number;
  flights: number;
  slides: number;
  collabs: number;
  milestone: number;
  zone: number;
};

export const C = {
  ink: "#1d2a5c",
  red: "#e4312b",
  yellow: "#ffc20e",
  green: "#1faa59",
  pakGreen: "#01411c",
  blue: "#2f6bff",
  pink: "#e6007e",
  orange: "#ff7a1a",
  purple: "#7b3fe4",
  cream: "#fff3d6",
};
const FLAGS = [C.red, C.yellow, C.green, C.blue, C.pink, C.orange];
const GDG = ["#4285f4", "#ea4335", "#fbbc04", "#34a853"];

type Look = {
  sky: [string, string, string];
  ground: [string, string];
  road: string;
  night?: boolean;
};
const LOOKS: Record<string, Look> = {
  e9: {
    sky: ["#2fa8ec", "#8fd8fb", "#ffe6ad"],
    ground: ["#5cc46b", "#4db55f"],
    road: "#4a4468",
  },
  library: {
    sky: ["#6f8cf0", "#b3c4ff", "#ffe2c4"],
    ground: ["#5cbf7a", "#4cae6a"],
    road: "#4a4468",
  },
  cafe: {
    sky: ["#ff9f5a", "#ffc98a", "#fff0c2"],
    ground: ["#6cc070", "#5daf60"],
    road: "#51466a",
  },
  fmc: {
    sky: ["#43bcd6", "#a6e6f2", "#f0fffb"],
    ground: ["#5ec79a", "#4fb88b"],
    road: "#474a6a",
  },
  kamra: {
    sky: ["#2a8cf0", "#9ed4ff", "#e9f6ff"],
    ground: ["#a9c66a", "#9bb85d"],
    road: "#5a5d70",
  },
  multan: {
    sky: ["#ff7a2e", "#ffb45e", "#ffe29a"],
    ground: ["#c9b56a", "#bba65c"],
    road: "#5b4a5e",
  },
  hack: {
    sky: ["#140f3a", "#3a2270", "#6b3a8c"],
    ground: ["#2f5b45", "#284f3c"],
    road: "#2c2745",
    night: true,
  },
};

type Scene = {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  s: Run;
  now: number;
  face: HTMLImageElement;
  rollNumber: string;
};

export function drawScene({ ctx, w, h, s, now, face, rollNumber }: Scene) {
  const zone = zones[s.zone % zones.length];
  const look = LOOKS[zone.id];
  const horizon = h * 0.3,
    roadTop = w * 0.075,
    roadBottom = w * 0.49;
  const point = (lane: number, z: number) => {
    const p = z * z;
    return {
      x: w / 2 + lane * (roadTop + (roadBottom - roadTop) * p) * 0.66,
      y: horizon + (h - horizon) * p,
      scale: 0.15 + p * 1.3,
    };
  };
  const box = (
    x: number,
    y: number,
    bw: number,
    bh: number,
    r: number,
    fill: string,
  ) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, Math.max(0, Math.min(r, bw / 2, bh / 2)));
    ctx.fill();
  };
  const circle = (x: number, y: number, r: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    ctx.fill();
  };
  const label = (
    text: string,
    x: number,
    y: number,
    size: number,
    fill: string,
    maxWidth?: number,
    weight = 800,
  ) => {
    ctx.fillStyle = fill;
    ctx.font = `${weight} ${size}px Rubik, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y, maxWidth);
  };
  const ridge = (amp: (x: number) => number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, horizon + 2);
    for (let x = 0; x <= w + 8; x += 8)
      ctx.lineTo(x, horizon - amp((x / w) * 400));
    ctx.lineTo(w, horizon + 2);
    ctx.closePath();
    ctx.fill();
  };

  ctx.save();
  if (s.shake > 0)
    ctx.translate(
      (Math.random() - 0.5) * s.shake * 18,
      (Math.random() - 0.5) * s.shake * 18,
    );

  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, look.sky[0]);
  sky.addColorStop(0.7, look.sky[1]);
  sky.addColorStop(1, look.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(-20, -20, w + 40, horizon + 22);
  if (look.night) {
    for (let i = 0; i < 40; i++) {
      const x = (((i * 97) % 400) / 400) * w,
        y = (((i * 53) % 100) / 100) * horizon * 0.8;
      circle(
        x,
        y,
        (i % 3) * 0.5 + 0.6,
        `rgba(255,255,255,${0.4 + 0.4 * Math.sin(now / 400 + i)})`,
      );
    }
    circle(w * 0.8, h * 0.08, w * 0.045, "#fff6d8");
    circle(w * 0.815, h * 0.07, w * 0.04, look.sky[0]);
  } else {
    const sunColor = zone.id === "multan" ? "#fff2b0" : "#ffe98a";
    circle(
      w * 0.82,
      h * 0.09,
      w * (zone.id === "multan" ? 0.1 : 0.075),
      sunColor,
    );
    circle(
      w * 0.82,
      h * 0.09,
      w * (zone.id === "multan" ? 0.075 : 0.055),
      C.yellow,
    );
    for (let i = 0; i < 4; i++) {
      const x = ((i * 0.31 + now / 90000) % 1.3) * w - w * 0.15,
        y = h * (0.05 + (i % 2) * 0.06),
        r = w * 0.03;
      circle(x, y, r, "#ffffffdd");
      circle(x + r, y - r * 0.5, r * 1.2, "#ffffffdd");
      circle(x + r * 2.2, y, r, "#ffffffdd");
    }
  }
  // PAF jets: every 16 s, and in formation over Kamra.
  const period = zone.id === "kamra" ? 7000 : 16000,
    pass = (now / period) % 1;
  if (pass < 0.35) {
    const count = zone.id === "kamra" ? 3 : 1;
    for (let j = 0; j < count; j++) {
      const t = pass / 0.35,
        js = w / 400,
        jx = -60 + t * (w + 160) - j * 26 * js,
        jy = h * 0.2 - t * h * 0.1 + j * 12 * js;
      ctx.strokeStyle = "#ffffffcc";
      ctx.lineWidth = 3 * js;
      ctx.beginPath();
      ctx.moveTo(jx - 120 * js, jy + 30 * js);
      ctx.lineTo(jx - 12 * js, jy + 3 * js);
      ctx.stroke();
      ctx.fillStyle = look.night ? "#c7cbe0" : "#5b6b86";
      ctx.beginPath();
      ctx.moveTo(jx + 16 * js, jy - 4 * js);
      ctx.lineTo(jx - 12 * js, jy + 2 * js);
      ctx.lineTo(jx - 16 * js, jy - 6 * js);
      ctx.lineTo(jx - 8 * js, jy - 3 * js);
      ctx.lineTo(jx - 2 * js, jy - 12 * js);
      ctx.lineTo(jx + 3 * js, jy - 4 * js);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawBackdrop();

  // Ground bands for speed.
  ctx.fillStyle = look.ground[0];
  ctx.fillRect(-20, horizon, w + 40, h - horizon + 20);
  for (let i = 0; i < 14; i += 2) {
    const z0 = (i / 14 + s.distance / 160) % 1,
      z1 = Math.min(z0 + 1 / 14, 1);
    const y0 = point(0, z0).y,
      y1 = point(0, z1).y;
    ctx.fillStyle = look.ground[1];
    ctx.fillRect(-20, y0, w + 40, y1 - y0);
  }
  // Road, kerbs, lane dashes.
  ctx.beginPath();
  ctx.moveTo(w / 2 - roadTop, horizon);
  ctx.lineTo(w / 2 + roadTop, horizon);
  ctx.lineTo(w / 2 + roadBottom, h + 20);
  ctx.lineTo(w / 2 - roadBottom, h + 20);
  ctx.closePath();
  ctx.fillStyle = look.road;
  ctx.fill();
  for (let i = 0; i < 24; i++) {
    const z0 = (i / 24 + s.distance / 180) % 1,
      z1 = Math.min(z0 + 1 / 24, 1);
    ctx.fillStyle =
      i % 2 ? "#23202f" : zone.id === "kamra" ? "#ffffff" : C.yellow;
    for (const side of [-1, 1]) {
      const a = point(side * 1.5, z0),
        b = point(side * 1.5, z1),
        c = point(side * 1.64, z1),
        d = point(side * 1.64, z0);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
    }
  }
  for (let i = 0; i < 16; i++) {
    const z = (i / 16 + s.distance / 180) % 1;
    for (const lane of [-0.5, 0.5]) {
      const a = point(lane, z),
        b = point(lane, Math.min(z + 0.02, 1));
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = look.night ? "#9fe8ffaa" : "#ffffffcc";
      ctx.lineWidth = 1 + z * 4;
      ctx.stroke();
    }
  }

  // Everything standing on the ground is depth-sorted.
  type Prop = { z: number; draw: () => void };
  const props: Prop[] = [];
  for (let i = 0; i < 8; i++) {
    const z = (i / 8 + s.distance / 220) % 1;
    for (const side of [-1, 1])
      props.push({
        z,
        draw: () => roadside(point(side * 2.05, z), i + (side > 0 ? 1 : 0)),
      });
  }
  const signs = [
    zone.sub.toUpperCase(),
    "AHMED FOR VP",
    "VOTE 21-22 SEP",
    "ROLL NO. " + rollNumber,
    "GDGOC AU",
    zone.name.toUpperCase(),
  ];
  for (let i = 0; i < 3; i++) {
    const phase = i / 3 + s.distance / 420,
      z = phase % 1,
      text =
        signs[
          (((i - Math.floor(phase)) % signs.length) + signs.length) %
            signs.length
        ],
      side = i % 2 ? 1 : -1;
    props.push({
      z,
      draw: () => {
        const p = point(side * 2.7, z);
        if (p.scale < 0.2) return;
        const sw = 84 * p.scale,
          sh = 22 * p.scale;
        box(
          p.x - 1.5 * p.scale,
          p.y - 60 * p.scale,
          3 * p.scale,
          60 * p.scale,
          1,
          "#8a8f9e",
        );
        box(p.x - sw / 2, p.y - 70 * p.scale, sw, sh, 3 * p.scale, "#0b7a3e");
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = Math.max(1, 1.5 * p.scale);
        ctx.beginPath();
        ctx.roundRect(
          p.x - sw / 2 + 2 * p.scale,
          p.y - 68 * p.scale,
          sw - 4 * p.scale,
          sh - 4 * p.scale,
          2 * p.scale,
        );
        ctx.stroke();
        label(
          text,
          p.x,
          p.y - 59 * p.scale,
          8 * p.scale,
          "#ffffff",
          sw - 8 * p.scale,
        );
      },
    });
  }
  for (let i = 0; i < 2; i++) {
    const z = (i / 2 + s.distance / 300) % 1;
    props.push({ z, draw: () => bunting(z) });
  }
  for (let i = 0; i < 2; i++) {
    const z = (i / 2 + 0.25 + s.distance / 520) % 1,
      side = i % 2 ? -1 : 1;
    props.push({ z, draw: () => billboard(point(side * 1.95, z), side) });
  }
  for (const item of s.items) {
    if (
      item.z < 0 ||
      (item.hit && isPickup(item.kind) && item.kind !== "collab")
    )
      continue;
    props.push({ z: item.z, draw: () => drawItem(item) });
  }
  props.sort((a, b) => a.z - b.z);
  props.forEach((prop) => prop.z < 0.88 && prop.draw());
  drawPlayer();
  props.forEach((prop) => prop.z >= 0.88 && prop.draw());

  for (const p of s.sparks) {
    ctx.globalAlpha = Math.min(1, p.life / 0.3);
    box(p.x - 3, p.y - 3, 6, 6, 1, p.color);
  }
  for (const f of s.floaters) {
    ctx.globalAlpha = Math.min(1, f.life / 0.4);
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.ink;
    ctx.font = `900 ${Math.max(14, w * 0.04)}px Rubik, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  if (s.fly > 0 || runnerFast(s)) {
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      const side = i % 2 ? 1 : -1,
        t = (now / 300 + i * 0.37) % 1,
        x = w / 2 + side * w * (0.3 + ((i * 13) % 20) / 100),
        y = horizon + (h - horizon) * t;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + side * w * 0.05 * t, y + h * 0.08 * t);
      ctx.stroke();
    }
  }
  if (s.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.7, s.flash)})`;
    ctx.fillRect(-20, -20, w + 40, h + 40);
  }
  ctx.restore();

  function runnerFast(r: Run) {
    return r.phase === "running" && r.time > 90;
  }

  function drawBackdrop() {
    const id = zone.id;
    if (id === "e9" || id === "library" || id === "fmc" || id === "cafe") {
      ridge(
        (x) =>
          h *
          (0.17 + 0.05 * Math.sin(x * 0.011) + 0.025 * Math.sin(x * 0.033 + 1)),
        id === "cafe" ? "#9fb98f" : "#86bfa6",
      );
      ridge(
        (x) =>
          h *
          (0.08 + 0.03 * Math.sin(x * 0.019 + 2) + 0.012 * Math.sin(x * 0.06)),
        id === "cafe" ? "#5f9a5a" : "#3a9a62",
      );
    }
    if (id === "multan") {
      ridge((x) => h * (0.03 + 0.01 * Math.sin(x * 0.03)), "#d9a35c");
    }
    if (id === "hack") {
      ridge((x) => h * (0.12 + 0.04 * Math.sin(x * 0.012)), "#2a1c55");
    }
    if (id === "e9") {
      faisalMosque(w * 0.24);
      campusBlocks();
      flag(w * 0.53);
    } else if (id === "library") {
      const bw = w * 0.52,
        bh = h * 0.12,
        bx = w * 0.08,
        by = horizon - bh;
      box(bx, by, bw, bh + 3, 2, "#b5533c");
      ctx.fillStyle = C.cream;
      ctx.beginPath();
      ctx.moveTo(bx - 6, by);
      ctx.lineTo(bx + bw / 2, by - h * 0.045);
      ctx.lineTo(bx + bw + 6, by);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 7; i++)
        box(
          bx + bw * (0.06 + i * 0.14),
          by + bh * 0.28,
          bw * 0.04,
          bh * 0.72,
          1,
          C.cream,
        );
      box(bx + bw * 0.3, by + 3, bw * 0.4, bh * 0.22, 2, C.ink);
      label(
        "LIBRARY",
        bx + bw / 2,
        by + 3 + bh * 0.11,
        bh * 0.16,
        "#ffffff",
        bw * 0.38,
      );
      campusBlocks();
    } else if (id === "cafe") {
      const names = ["CHAI", "FRIES", "SHAWARMA", "PARATHA", "CAFE"];
      for (let i = 0; i < 5; i++) {
        const sx = w * (0.02 + i * 0.2),
          sw = w * 0.17,
          sh = h * 0.065,
          sy = horizon - sh;
        box(sx, sy, sw, sh + 3, 2, i % 2 ? "#fff3d6" : "#ffe1b3");
        for (let k = 0; k < 5; k++)
          box(
            sx - 2 + (k * (sw + 4)) / 5,
            sy - h * 0.03,
            (sw + 4) / 5,
            h * 0.03,
            0,
            FLAGS[(i + k) % FLAGS.length],
          );
        label(
          names[i],
          sx + sw / 2,
          sy + sh * 0.45,
          sh * 0.26,
          C.ink,
          sw * 0.9,
        );
      }
      ctx.strokeStyle = "#3b2f45";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, horizon - h * 0.13);
      ctx.quadraticCurveTo(w / 2, horizon - h * 0.08, w, horizon - h * 0.13);
      ctx.stroke();
      for (let i = 0; i < 18; i++) {
        const t = i / 17,
          x = t * w,
          y = horizon - h * 0.13 + Math.sin(t * Math.PI) * h * 0.025;
        circle(x, y + 3, 2.5, FLAGS[i % FLAGS.length]);
      }
    } else if (id === "fmc") {
      const bw = w * 0.46,
        bh = h * 0.13,
        bx = w * 0.46,
        by = horizon - bh;
      box(bx, by, bw, bh + 3, 3, "#ffffff");
      for (let r = 0; r < 3; r++)
        box(
          bx + 6,
          by + bh * (0.2 + r * 0.27),
          bw - 12,
          bh * 0.1,
          1,
          "#7fd6d0",
        );
      box(bx - w * 0.12, by + bh * 0.35, w * 0.13, bh * 0.65 + 3, 2, "#e8f7f6");
      circle(bx + bw * 0.14, by - h * 0.02, h * 0.028, "#12a39a");
      box(
        bx + bw * 0.14 - h * 0.006,
        by - h * 0.038,
        h * 0.012,
        h * 0.036,
        1,
        "#ffffff",
      );
      box(
        bx + bw * 0.14 - h * 0.018,
        by - h * 0.026,
        h * 0.036,
        h * 0.012,
        1,
        "#ffffff",
      );
      label(
        "FMC",
        bx + bw * 0.55,
        by - h * 0.02,
        h * 0.035,
        "#0d7f78",
        bw * 0.6,
        900,
      );
      faisalMosque(w * 0.2);
    } else if (id === "kamra") {
      for (let i = 0; i < 3; i++) {
        const cx = w * (0.14 + i * 0.26),
          r = w * 0.11;
        ctx.fillStyle = "#9aa3b5";
        ctx.beginPath();
        ctx.arc(cx, horizon + 2, r, Math.PI, 0);
        ctx.fill();
        box(cx - r * 0.55, horizon - r * 0.55, r * 1.1, r * 0.57, 1, "#3e4658");
      }
      box(w * 0.86, horizon - h * 0.16, w * 0.035, h * 0.16, 1, "#dfe3ec");
      box(w * 0.835, horizon - h * 0.19, w * 0.085, h * 0.04, 3, "#3e4658");
      box(w * 0.845, horizon - h * 0.183, w * 0.065, h * 0.02, 2, "#9fe0ff");
      label(
        "KAMRA",
        w * 0.14 + w * 0.26,
        horizon - w * 0.13,
        h * 0.03,
        C.ink,
        w * 0.2,
        900,
      );
    } else if (id === "multan") {
      const cx = w * 0.3,
        bw = w * 0.2,
        bh = h * 0.07;
      box(cx - bw / 2, horizon - bh, bw, bh + 3, 2, "#b5653a");
      box(cx - bw / 2, horizon - bh * 0.62, bw, bh * 0.16, 0, "#2f7fd1");
      box(
        cx - bw * 0.32,
        horizon - bh * 1.45,
        bw * 0.64,
        bh * 0.5,
        2,
        "#c27244",
      );
      ctx.fillStyle = "#e9f2ff";
      ctx.beginPath();
      ctx.arc(cx, horizon - bh * 1.45, bw * 0.3, Math.PI, 0);
      ctx.fill();
      box(cx - 1.5, horizon - bh * 1.45 - bw * 0.42, 3, bw * 0.14, 1, C.yellow);
      for (const dx of [-0.5, 0.5])
        box(cx + dx * bw - 3, horizon - bh * 1.3, 6, bh * 1.3, 2, "#a45a32");
      campusBlocks();
    } else if (id === "hack") {
      const bw = w * 0.6,
        bh = h * 0.12,
        bx = w * 0.2,
        by = horizon - bh;
      box(bx, by, bw, bh + 3, 3, "#1b1640");
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 10; c++)
          if ((r * 7 + c * 3 + Math.floor(now / 700)) % 4)
            box(
              bx + bw * (0.04 + c * 0.095),
              by + bh * (0.38 + r * 0.2),
              bw * 0.05,
              bh * 0.1,
              1,
              GDG[(r + c) % 4],
            );
      box(bx + bw * 0.18, by - h * 0.04, bw * 0.64, h * 0.045, 4, "#0e0b26");
      ctx.shadowColor = "#ff5ad8";
      ctx.shadowBlur = 12;
      label(
        "HACKATHON",
        bx + bw / 2,
        by - h * 0.018,
        h * 0.03,
        "#ff9af0",
        bw * 0.6,
        900,
      );
      ctx.shadowBlur = 0;
    }
  }

  function faisalMosque(mx: number) {
    const my = horizon,
      mw = w * 0.13,
      mh = h * 0.07;
    ctx.fillStyle = "#fbf8ff";
    ctx.beginPath();
    ctx.moveTo(mx - mw / 2, my);
    ctx.lineTo(mx, my - mh);
    ctx.lineTo(mx + mw / 2, my);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#d8d0ee";
    ctx.beginPath();
    ctx.moveTo(mx, my - mh);
    ctx.lineTo(mx + mw / 2, my);
    ctx.lineTo(mx, my);
    ctx.closePath();
    ctx.fill();
    for (const side of [-1, 1]) {
      const x = mx + side * mw * 0.78;
      box(x - 1.5, my - mh * 1.7, 3, mh * 1.7, 1, "#fbf8ff");
      ctx.fillStyle = "#fbf8ff";
      ctx.beginPath();
      ctx.moveTo(x - 2, my - mh * 1.7);
      ctx.lineTo(x, my - mh * 2.05);
      ctx.lineTo(x + 2, my - mh * 1.7);
      ctx.fill();
    }
  }
  function campusBlocks() {
    const blocks: [string, number][] = [
      ["#e2694a", 0.05],
      [C.cream, 0.075],
      ["#f39a3d", 0.06],
      [C.cream, 0.085],
      ["#e2694a", 0.055],
    ];
    blocks.forEach(([fill, bh], i) => {
      const bx = w * (0.56 + i * 0.09),
        bw = w * 0.1,
        top = horizon - h * bh;
      box(bx, top, bw, h * bh + 2, 2, fill);
      ctx.fillStyle = fill === C.cream ? "#2f6bff99" : "#fff3d6aa";
      for (let r = 0; r < 2; r++)
        for (let k = 0; k < 3; k++)
          ctx.fillRect(
            bx + bw * (0.15 + k * 0.28),
            top + h * (0.012 + r * 0.02),
            bw * 0.14,
            h * 0.01,
          );
    });
  }
  function flag(fx: number) {
    const fy = horizon - h * 0.12;
    ctx.fillStyle = "#8a8f9e";
    ctx.fillRect(fx, fy, 2, h * 0.12);
    box(fx + 2, fy, w * 0.055, h * 0.032, 1, C.pakGreen);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(fx + 2, fy, w * 0.014, h * 0.032);
    circle(fx + 2 + w * 0.034, fy + h * 0.016, h * 0.009, "#ffffff");
    circle(fx + 2 + w * 0.037, fy + h * 0.014, h * 0.008, C.pakGreen);
  }

  function roadside(p: { x: number; y: number; scale: number }, i: number) {
    const k = p.scale;
    const id = zone.id;
    const tree = (leaf: string, fruit?: string) => {
      box(p.x - 2 * k, p.y - 55 * k, 5 * k, 55 * k, 1, "#7a4b2a");
      circle(p.x, p.y - 62 * k, 20 * k, leaf);
      circle(p.x - 11 * k, p.y - 52 * k, 13 * k, leaf);
      circle(p.x + 11 * k, p.y - 52 * k, 13 * k, leaf);
      if (fruit)
        for (let f = 0; f < 5; f++)
          circle(
            p.x + Math.cos(f * 1.7) * 13 * k,
            p.y - 58 * k + Math.sin(f * 2.3) * 9 * k,
            3 * k,
            fruit,
          );
    };
    if (id === "library") {
      box(p.x - 14 * k, p.y - 70 * k, 28 * k, 70 * k, 2 * k, "#7a4b2a");
      for (let r = 0; r < 4; r++)
        for (let b = 0; b < 4; b++)
          box(
            p.x - 11 * k + b * 5.6 * k,
            p.y - (66 - r * 17) * k,
            4.5 * k,
            13 * k,
            1,
            FLAGS[(r + b + i) % FLAGS.length],
          );
    } else if (id === "cafe" && i % 2) {
      box(p.x - 16 * k, p.y - 26 * k, 32 * k, 26 * k, 2 * k, "#a0522d");
      for (let s2 = 0; s2 < 4; s2++)
        box(
          p.x - 18 * k + s2 * 9 * k,
          p.y - 40 * k,
          9 * k,
          9 * k,
          0,
          s2 % 2 ? "#ffffff" : C.red,
        );
      box(p.x - 1 * k, p.y - 40 * k, 2 * k, 14 * k, 0, "#6b6f80");
      label("CHAI", p.x, p.y - 15 * k, 7 * k, "#ffffff", 30 * k);
    } else if (id === "fmc") {
      box(p.x - 1.5 * k, p.y - 14 * k, 3 * k, 14 * k, 1, "#7a4b2a");
      ctx.fillStyle = i % 2 ? "#1f7a4d" : "#2a9460";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 44 * k, 10 * k, 32 * k, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === "kamra") {
      box(p.x - 1.5 * k, p.y - 22 * k, 3 * k, 22 * k, 1, "#6b6f80");
      circle(p.x, p.y - 24 * k, 5 * k, i % 2 ? "#ffd23f" : "#ff5a36");
      circle(p.x, p.y - 24 * k, 9 * k, i % 2 ? "#ffd23f44" : "#ff5a3644");
    } else if (id === "multan") {
      tree(i % 2 ? "#2e8b3e" : "#3aa04a", "#ffb000");
    } else if (id === "hack") {
      box(p.x - 1.5 * k, p.y - 70 * k, 3 * k, 70 * k, 1, "#8a8fb0");
      const glow = GDG[i % 4];
      circle(p.x, p.y - 72 * k, 16 * k, glow + "33");
      circle(p.x, p.y - 72 * k, 6 * k, glow);
    } else {
      tree(i % 4 === 0 ? "#ff8fbf" : i % 2 ? "#2e9e5b" : "#3fb86a");
    }
  }

  function bunting(z: number) {
    if (z < 0.08) return;
    const l = point(-1.75, z),
      r = point(1.75, z),
      top = 150 * l.scale;
    ctx.fillStyle = "#6b6f80";
    ctx.fillRect(l.x - 1.5 * l.scale, l.y - top, 3 * l.scale, top);
    ctx.fillRect(r.x - 1.5 * r.scale, r.y - top, 3 * r.scale, top);
    const n = 11,
      sag = 18 * l.scale;
    for (let k = 0; k < n; k++) {
      const t0 = k / n,
        t1 = (k + 1) / n,
        x0 = l.x + (r.x - l.x) * t0,
        x1 = l.x + (r.x - l.x) * t1,
        y0 = l.y - top + Math.sin(t0 * Math.PI) * sag,
        y1 = l.y - top + Math.sin(t1 * Math.PI) * sag;
      ctx.fillStyle = FLAGS[k % FLAGS.length];
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo((x0 + x1) / 2, (y0 + y1) / 2 + 14 * l.scale);
      ctx.closePath();
      ctx.fill();
    }
    if (l.scale < 0.3 || z > 0.8) return;
    const pw = 104 * l.scale,
      ph = 20 * l.scale,
      panelY = l.y - top + sag + 4 * l.scale;
    box((l.x + r.x) / 2 - pw / 2, panelY, pw, ph, 3 * l.scale, C.red);
    label(
      "VOTE AHMED MALIK",
      (l.x + r.x) / 2,
      panelY + ph / 2,
      9 * l.scale,
      "#ffffff",
      pw - 6,
    );
  }

  function billboard(p: { x: number; y: number; scale: number }, side: number) {
    if (p.scale < 0.22) return;
    const k = p.scale * 1.2,
      bw = 132 * k,
      bh = 62 * k,
      bx = side > 0 ? p.x : p.x - bw,
      by = p.y - 50 * k - bh;
    ctx.fillStyle = "#6b6f80";
    ctx.fillRect(bx + bw * 0.2, by + bh, 3 * k, 50 * k);
    ctx.fillRect(bx + bw * 0.78, by + bh, 3 * k, 50 * k);
    box(bx - 3 * k, by - 3 * k, bw + 6 * k, bh + 6 * k, 4 * k, C.ink);
    box(bx, by, bw, bh, 3 * k, C.yellow);
    const ps = bh - 8 * k;
    if (face.complete && face.naturalWidth) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(bx + 4 * k, by + 4 * k, ps, ps, 3 * k);
      ctx.clip();
      ctx.drawImage(face, bx + 4 * k, by + 4 * k, ps, ps);
      ctx.restore();
    } else box(bx + 4 * k, by + 4 * k, ps, ps, 3 * k, C.pink);
    const tx = bx + ps + 10 * k,
      tw = bw - ps - 14 * k;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = C.ink;
    ctx.font = `900 ${11.5 * k}px Rubik, Arial, sans-serif`;
    ctx.fillText("AHMED", tx, by + 15 * k, tw);
    ctx.fillText("MALIK", tx, by + 27 * k, tw);
    ctx.font = `700 ${6.3 * k}px Rubik, Arial, sans-serif`;
    ctx.fillText("VP · GDGOC AIR UNI", tx, by + 36 * k, tw);
    ctx.fillStyle = C.red;
    ctx.fillText("ROLL NO. " + rollNumber, tx, by + 44 * k, tw);
    box(tx - 1 * k, by + 48 * k, tw + 2 * k, 10 * k, 2 * k, C.green);
    label("VOTE 21-22 SEP", tx + tw / 2, by + 53 * k, 6.3 * k, "#ffffff", tw);
  }

  function drawItem(item: Item) {
    const p = point(item.lane, item.z),
      u = Math.min(w * 0.115, 56) * p.scale,
      bob = Math.sin(now / 220 + item.lane) * u * 0.08;
    if (item.kind === "vote") {
      const y = p.y - u * 0.75 + bob;
      circle(p.x, y, u * 0.48, s.magnet > 0 ? "#4285f455" : "#ffc20e55");
      ctx.save();
      ctx.translate(p.x, y);
      ctx.rotate(-0.14);
      box(-u * 0.27, -u * 0.34, u * 0.54, u * 0.68, u * 0.06, "#ffffff");
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = Math.max(1, u * 0.05);
      ctx.strokeRect(-u * 0.27, -u * 0.34, u * 0.54, u * 0.68);
      ctx.strokeStyle = C.green;
      ctx.lineWidth = Math.max(1.5, u * 0.1);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-u * 0.14, 0);
      ctx.lineTo(-u * 0.03, u * 0.12);
      ctx.lineTo(u * 0.16, -u * 0.14);
      ctx.stroke();
      ctx.restore();
    } else if (item.kind === "chai") {
      const y = p.y - u * 0.7 + bob;
      circle(p.x, y, u * 0.55, "#ff7a1a44");
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1, u * 0.06);
      ctx.beginPath();
      ctx.arc(p.x + u * 0.22, y + u * 0.02, u * 0.12, -1.2, 1.2);
      ctx.stroke();
      ctx.fillStyle = C.orange;
      ctx.beginPath();
      ctx.moveTo(p.x - u * 0.26, y - u * 0.16);
      ctx.lineTo(p.x + u * 0.26, y - u * 0.16);
      ctx.lineTo(p.x + u * 0.19, y + u * 0.24);
      ctx.lineTo(p.x - u * 0.19, y + u * 0.24);
      ctx.closePath();
      ctx.fill();
      box(p.x - u * 0.29, y - u * 0.2, u * 0.58, u * 0.08, u * 0.03, C.cream);
      ctx.strokeStyle = "#ffffffcc";
      for (const dx of [-0.1, 0.08]) {
        ctx.beginPath();
        ctx.moveTo(p.x + u * dx, y - u * 0.28);
        ctx.quadraticCurveTo(
          p.x + u * (dx + 0.08),
          y - u * 0.4,
          p.x + u * dx,
          y - u * 0.52,
        );
        ctx.stroke();
      }
    } else if (item.kind === "wings") {
      const y = p.y - u * 0.8 + bob,
        flap = Math.sin(now / 90) * 0.25;
      circle(p.x, y, u * 0.6, "#1faa5944");
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(p.x + side * u * 0.08, y);
        ctx.rotate(side * flap);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(
          side * u * 0.5,
          -u * 0.45,
          side * u * 0.55,
          u * 0.05,
        );
        ctx.quadraticCurveTo(side * u * 0.3, u * 0.12, 0, u * 0.1);
        ctx.fill();
        ctx.strokeStyle = C.green;
        ctx.lineWidth = Math.max(1, u * 0.05);
        ctx.stroke();
        ctx.restore();
      }
      label("F", p.x, y + u * 0.05, u * 0.3, C.ink, undefined, 900);
    } else if (item.kind === "magnet") {
      const y = p.y - u * 0.8 + bob;
      circle(p.x, y, u * 0.55, "#4285f433");
      GDG.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(p.x, y);
        ctx.arc(
          p.x,
          y,
          u * 0.36,
          (i * Math.PI) / 2 + now / 400,
          ((i + 1) * Math.PI) / 2 + now / 400,
        );
        ctx.fill();
      });
      circle(p.x, y, u * 0.22, "#ffffff");
      label("GDG", p.x, y, u * 0.16, C.ink, u * 0.4, 900);
    } else if (item.kind === "double") {
      const y = p.y - u * 0.8 + bob;
      circle(p.x, y, u * 0.55, "#ffc20e55");
      box(p.x - u * 0.28, y - u * 0.35, u * 0.56, u * 0.36, u * 0.12, C.yellow);
      box(p.x - u * 0.06, y, u * 0.12, u * 0.18, 1, C.yellow);
      box(p.x - u * 0.2, y + u * 0.16, u * 0.4, u * 0.1, 2, "#b8860b");
      label("x2", p.x, y - u * 0.17, u * 0.24, C.ink, undefined, 900);
    } else if (item.kind === "collab") {
      const pulse = 0.5 + Math.sin(now / 160) * 0.5;
      circle(p.x, p.y - u * 1.1, u * (0.9 + pulse * 0.15), "#34a85322");
      for (const side of [-1, 1])
        GDG.forEach((color, i) =>
          box(
            p.x + side * u * 0.62 - u * 0.06,
            p.y - u * 2.1 + i * u * 0.525,
            u * 0.12,
            u * 0.53,
            1,
            color,
          ),
        );
      box(p.x - u * 0.8, p.y - u * 2.3, u * 1.6, u * 0.46, u * 0.08, "#ffffff");
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = Math.max(1, u * 0.05);
      ctx.strokeRect(p.x - u * 0.8, p.y - u * 2.3, u * 1.6, u * 0.46);
      label(
        `${item.label} × AU`,
        p.x,
        p.y - u * 2.07,
        u * 0.22,
        C.ink,
        u * 1.5,
        900,
      );
      label(
        "COLLAB +300",
        p.x,
        p.y - u * 1.6,
        u * 0.16,
        "#ffffff",
        u * 1.2,
        900,
      );
    } else if (item.kind === "quiz") {
      box(p.x - u * 0.5, p.y - u * 0.7, u * 0.07, u * 0.7, 1, C.ink);
      box(p.x + u * 0.43, p.y - u * 0.7, u * 0.07, u * 0.7, 1, C.ink);
      box(p.x - u * 0.58, p.y - u * 0.78, u * 1.16, u * 0.46, u * 0.08, C.pink);
      box(
        p.x - u * 0.58,
        p.y - u * 0.78,
        u * 1.16,
        u * 0.09,
        u * 0.04,
        C.yellow,
      );
      label(zone.hurdle, p.x, p.y - u * 0.52, u * 0.24, "#ffffff", u * 1.05);
    } else if (item.kind === "bar") {
      box(p.x - u * 0.58, p.y - u * 1.85, u * 0.1, u * 1.85, 1, C.orange);
      box(p.x + u * 0.48, p.y - u * 1.85, u * 0.1, u * 1.85, 1, C.orange);
      box(
        p.x - u * 0.62,
        p.y - u * 1.85,
        u * 1.24,
        u * 0.6,
        u * 0.08,
        C.purple,
      );
      box(p.x - u * 0.62, p.y - u * 1.3, u * 1.24, u * 0.06, 0, C.yellow);
      label(zone.bar, p.x, p.y - u * 1.62, u * 0.2, "#ffffff", u * 1.1);
      label("↓ SLIDE ↓", p.x, p.y - u * 1.4, u * 0.13, C.yellow, u * 1.1);
    } else if (item.kind === "deadline") {
      box(p.x - u * 0.55, p.y - u * 1.65, u * 1.1, u * 1.65, u * 0.08, C.blue);
      ctx.fillStyle = "#1f4fd6";
      for (let k = 0; k < 3; k++)
        ctx.fillRect(
          p.x - u * 0.55,
          p.y - u * (0.32 + k * 0.3),
          u * 1.1,
          u * 0.06,
        );
      circle(p.x, p.y - u * 1.3, u * 0.22, "#ffffff");
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = Math.max(1, u * 0.05);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - u * 1.42);
      ctx.lineTo(p.x, p.y - u * 1.3);
      ctx.lineTo(p.x + u * 0.1, p.y - u * 1.25);
      ctx.stroke();
      label(zone.wall, p.x, p.y - u * 0.92, u * 0.19, C.yellow, u);
    } else if (item.kind === "bus") {
      if (item.z < 0.35) {
        const warn = point(item.lane, 0.35);
        if (Math.floor(now / 150) % 2) {
          ctx.fillStyle = C.red;
          ctx.beginPath();
          ctx.moveTo(warn.x, warn.y - 44);
          ctx.lineTo(warn.x + 14, warn.y - 20);
          ctx.lineTo(warn.x - 14, warn.y - 20);
          ctx.closePath();
          ctx.fill();
          label("!", warn.x, warn.y - 28, 14, "#ffffff", undefined, 900);
        }
      }
      box(
        p.x - u * 0.62,
        p.y - u * 1.55,
        u * 1.24,
        u * 1.5,
        u * 0.14,
        "#ffffff",
      );
      box(p.x - u * 0.62, p.y - u * 0.62, u * 1.24, u * 0.22, 0, C.blue);
      box(
        p.x - u * 0.52,
        p.y - u * 1.42,
        u * 1.04,
        u * 0.55,
        u * 0.08,
        "#23304f",
      );
      box(
        p.x - u * 0.62,
        p.y - u * 1.72,
        u * 1.24,
        u * 0.2,
        u * 0.06,
        C.yellow,
      );
      label("AU SHUTTLE", p.x, p.y - u * 1.62, u * 0.14, C.ink, u * 1.1, 900);
      circle(p.x - u * 0.4, p.y - u * 0.25, u * 0.09, "#fff6a8");
      circle(p.x + u * 0.4, p.y - u * 0.25, u * 0.09, "#fff6a8");
      box(p.x - u * 0.55, p.y - u * 0.08, u * 0.22, u * 0.12, 2, "#222");
      box(p.x + u * 0.33, p.y - u * 0.08, u * 0.22, u * 0.12, 2, "#222");
    }
  }

  function drawPlayer() {
    const player = point(s.visualLane, 0.88),
      u = Math.min(w * 0.08, 36);
    const flyLift =
      s.fly > 0 ? Math.min(1, (5 - s.fly) * 3, s.fly * 1.5) * h * 0.22 : 0;
    const air =
      Math.sin((Math.max(0, s.jump) / 0.8) * Math.PI) * h * 0.17 + flyLift;
    ctx.fillStyle = "#0003";
    ctx.beginPath();
    ctx.ellipse(
      player.x,
      player.y + 5,
      u * 0.9 * (1 - air / h),
      u * 0.24,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    const moving = s.phase === "running" && !s.jump && !s.fly;
    const bob = moving
        ? Math.sin(s.time * 22) * 3
        : s.fly > 0
          ? Math.sin(now / 200) * 5
          : 0,
      base = player.y - air + bob,
      stride = moving && !s.slide ? Math.sin(s.time * 18) * u * 0.22 : 0;
    if (s.grace > 0 && Math.floor(now / 80) % 2) return;
    const x = player.x;
    ctx.save();
    if (s.slide > 0) {
      ctx.translate(x, base);
      ctx.scale(1.15, 0.5);
      ctx.translate(-x, -base);
    }
    if (s.fly > 0) {
      const flap = Math.sin(now / 70) * 0.35;
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(x + side * u * 0.5, base - u * 1.5);
        ctx.rotate(side * (0.3 + flap));
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(side * u * 1.4, -u * 1.1, side * u * 1.6, u * 0.2);
        ctx.quadraticCurveTo(side * u * 0.8, u * 0.4, 0, u * 0.35);
        ctx.fill();
        ctx.strokeStyle = C.green;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
    }
    box(
      x - u * 0.46,
      base - u * 0.62 + stride,
      u * 0.36,
      u * 0.66,
      5,
      "#2b3a78",
    );
    box(
      x + u * 0.1,
      base - u * 0.62 - stride,
      u * 0.36,
      u * 0.66,
      5,
      "#2b3a78",
    );
    box(
      x - u * 0.5,
      base - u * 0.06 + stride,
      u * 0.42,
      u * 0.18,
      4,
      "#ffffff",
    );
    box(
      x + u * 0.08,
      base - u * 0.06 - stride,
      u * 0.42,
      u * 0.18,
      4,
      "#ffffff",
    );
    box(x - u * 0.95, base - u * 1.78, u * 0.3, u * 0.9, u * 0.14, "#b87a4e");
    box(x + u * 0.65, base - u * 1.78, u * 0.3, u * 0.9, u * 0.14, "#b87a4e");
    box(x - u * 0.78, base - u * 1.86, u * 1.56, u * 1.42, u * 0.3, "#0f8a3f");
    box(x - u * 0.78, base - u * 0.62, u * 1.56, u * 0.16, 3, C.yellow);
    label("AHMED", x, base - u * 1.56, u * 0.34, C.yellow, u * 1.4, 900);
    label(rollNumber, x, base - u * 1.08, u * 0.36, "#ffffff", u * 1.4, 900);
    box(x - u * 0.2, base - u * 2.06, u * 0.4, u * 0.25, 4, "#b87a4e");
    box(x - u * 0.47, base - u * 2.68, u * 0.94, u * 0.76, u * 0.36, "#141414");
    box(x - u * 0.52, base - u * 2.28, u * 0.1, u * 0.2, 2, "#b87a4e");
    box(x + u * 0.42, base - u * 2.28, u * 0.1, u * 0.2, 2, "#b87a4e");
    ctx.strokeStyle = "#141414";
    ctx.lineWidth = Math.max(1, u * 0.06);
    ctx.beginPath();
    ctx.moveTo(x - u * 0.5, base - u * 2.3);
    ctx.lineTo(x + u * 0.5, base - u * 2.3);
    ctx.stroke();
    ctx.restore();
    const top = base - u * (s.slide > 0 ? 1.4 : 2.7);
    if (s.shield) {
      ctx.strokeStyle = `rgba(255,122,26,${0.55 + Math.sin(now / 120) * 0.25})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(
        x,
        (base + top) / 2,
        u * 1.25,
        (base - top) * 0.62,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    if (s.magnet > 0) {
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -now / 30;
      ctx.strokeStyle = "#4285f4";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(
        x,
        (base + top) / 2,
        u * 1.5,
        (base - top) * 0.72,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (s.phase !== "running" || s.time < 3) {
      const text = `AHMED MALIK · ${rollNumber}`;
      ctx.font = `800 ${Math.max(10, u * 0.36)}px Rubik, Arial, sans-serif`;
      const lw = ctx.measureText(text).width + 16;
      box(x - lw / 2, top - u * 0.85, lw, u * 0.62, 999, C.ink);
      label(text, x, top - u * 0.54, Math.max(10, u * 0.36), "#ffffff");
    }
  }
}
