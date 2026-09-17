export type Result = {
  mode?: string;
  hits?: number;
  pairs?: number;
  mistakes?: number;
  score: number;
  woken: number;
  pops: number;
  maxCombo: number;
  powerupsUsed: number;
  durationMs: number;
  earlyEnd: boolean;
  cards: string[];
};
type Student = { x: number; y: number; awake: boolean; variant: number };
type Cloud = {
  x: number;
  y: number;
  target: number;
  hp: number;
  label: string;
  sitting: number;
};
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
};
const colors = ["#E4312B", "#FFC20E", "#1FA85B", "#F2338C", "#2356D8"];
const labels = [
  "8AM class",
  "Build failed",
  "Same 5 log",
  "Merge conflict",
  "WiFi gayab",
  "Null pointer",
  "Deadline kal hai",
  "Group project ghost",
  "404 motivation",
  "Canteen queue",
  "Assignment #7",
  "Monday",
];
export class CampusGame {
  ctx: CanvasRenderingContext2D;
  students: Student[] = [];
  clouds: Cloud[] = [];
  particles: Particle[] = [];
  t = 0;
  spawn = 0;
  lastPop = -10;
  combo = 0;
  asleepTime = 0;
  slowUntil = 0;
  doubleUntil = 0;
  gatherUntil = 0;
  nextPower = 8;
  power: { x: number; y: number; type: string; until: number } | null = null;
  result: Result = {
    score: 0,
    woken: 0,
    pops: 0,
    maxCombo: 0,
    powerupsUsed: 0,
    durationMs: 0,
    earlyEnd: false,
    cards: [],
  };
  raf = 0;
  last = 0;
  acc = 0;
  paused = false;
  ended = false;
  muted = true;
  audio: AudioContext | null = null;
  reduced = false;
  colored = false;
  shake = 0;
  message = "";
  messageUntil = 0;
  fps = 60;
  debug = false;
  constructor(
    public canvas: HTMLCanvasElement,
    public attract: boolean,
    public onUpdate: (g: CampusGame) => void,
    public onEnd: (r: Result) => void,
    public onColor?: () => void,
    public easy = false,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.debug = new URLSearchParams(location.search).has("debug");
    for (let i = 0; i < 12; i++)
      this.students.push({
        x: 55 + (i % 4) * 83 + (Math.floor(i / 4) % 2 ? 12 : 0),
        y: 305 + Math.floor(i / 4) * 83,
        awake: attract ? false : i >= (easy ? 2 : 4),
        variant: i % 6,
      });
    this.resize();
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.visibility);
    canvas.addEventListener("pointerdown", this.tap);
    this.raf = requestAnimationFrame(this.frame);
  }
  resize = () => {
    const d = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = 360 * d;
    this.canvas.height = 600 * d;
  };
  visibility = () => {
    this.paused = document.hidden;
    this.last = 0;
    this.acc = 0;
  };
  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.visibility);
    this.canvas.removeEventListener("pointerdown", this.tap);
    void this.audio?.close();
  }
  frame = (now: number) => {
    if (!this.last) this.last = now;
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.fps = dt ? Math.round(1 / dt) : 60;
    if (!this.paused && !this.ended) {
      this.acc += dt;
      while (this.acc >= 1 / 60) {
        this.step(1 / 60);
        this.acc -= 1 / 60;
      }
    }
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };
  get elapsed() {
    return Math.max(0, this.t - 3.6);
  }
  get vibe() {
    return this.students.filter((s) => s.awake).length / 12;
  }
  get interval() {
    if (this.easy) return this.elapsed < 30 ? 1.8 : 1.25;
    return this.elapsed < 15 ? 1.2 : this.elapsed < 35 ? 0.85 : 0.55;
  }
  spawnCloud() {
    if (this.clouds.length >= 8) return;
    const awake = this.students
      .map((s, i) => (s.awake ? i : -1))
      .filter((i) => i >= 0);
    const target = awake.length
      ? awake[Math.floor(Math.random() * awake.length)]
      : Math.floor(Math.random() * 12);
    const heavy = !this.easy && this.elapsed > 15 && Math.random() < 0.23;
    this.clouds.push({
      x: Math.random() < 0.5 ? -40 : 400,
      y: 240 + Math.random() * 260,
      target,
      hp: heavy ? 2 : 1,
      label: heavy
        ? ["Finals week", "Lab report", "Viva"][Math.floor(Math.random() * 3)]
        : labels[Math.floor(Math.random() * labels.length)],
      sitting: 0,
    });
  }
  step(dt: number) {
    if (this.ended) return;
    this.t += dt;
    if (!this.attract && this.t < 3.6) return;
    this.spawn -= dt;
    if (this.spawn <= 0) {
      this.spawnCloud();
      this.spawn = this.attract ? 2.5 : this.interval;
    }
    for (const c of this.clouds) {
      const s = this.students[c.target];
      const dx = s.x - c.x,
        dy = s.y - 28 - c.y,
        d = Math.hypot(dx, dy);
      const speed =
        (this.attract
          ? 12
          : this.elapsed < 15
            ? 35
            : this.elapsed < 35
              ? 49
              : 66) *
        (this.elapsed < this.slowUntil ? 0.3 : 1) *
        (this.easy ? 0.6 : 1);
      if (d > 3) {
        c.x += (dx / d) * speed * dt;
        c.y += (dy / d) * speed * dt;
      } else {
        c.sitting += dt;
        if (c.sitting > 1.5) {
          s.awake = false;
          if (!this.attract) c.sitting = 9;
        }
      }
    }
    this.clouds = this.clouds.filter((c) => c.sitting < 8);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 150 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    this.shake = Math.max(0, this.shake - dt);
    if (!this.attract) {
      if (this.elapsed >= this.nextPower) {
        this.power = {
          x: 65 + Math.random() * 230,
          y: 330 + Math.random() * 150,
          type: ["chair", "trophy", "chai", "mic"][
            Math.floor(this.nextPower / 8 - 1) % 4
          ],
          until: this.elapsed + 3,
        };
        this.nextPower += 8;
      }
      if (this.power && this.elapsed > this.power.until) this.power = null;
      this.asleepTime = this.vibe === 0 ? this.asleepTime + dt : 0;
      if (this.elapsed >= 45 || (!this.easy && this.asleepTime >= 3)) {
        this.ended = true;
        this.result.durationMs = Math.round(this.elapsed * 1000);
        this.result.earlyEnd = !this.easy && this.asleepTime >= 3;
        this.onEnd({ ...this.result, cards: [...this.result.cards] });
      }
    }
    this.onUpdate(this);
  }
  points(n: number) {
    this.result.score += n * (this.elapsed < this.doubleUntil ? 2 : 1);
  }
  burst(x: number, y: number) {
    for (let i = 0; i < (this.reduced ? 6 : 22); i++) {
      const a = Math.random() * Math.PI * 2,
        s = 40 + Math.random() * 130;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.5 + Math.random() * 0.3,
        color: colors[i % 5],
      });
    }
  }
  pop(c: Cloud) {
    this.clouds = this.clouds.filter((a) => a !== c);
    this.combo =
      this.elapsed - this.lastPop < 0.8 ? Math.min(5, this.combo + 1) : 1;
    this.lastPop = this.elapsed;
    this.result.maxCombo = Math.max(this.result.maxCombo, this.combo);
    this.result.pops++;
    this.points(10 * this.combo);
    for (const s of this.students)
      if (!s.awake && Math.hypot(s.x - c.x, s.y - c.y) < 88) {
        s.awake = true;
        this.result.woken++;
        this.points(15 * this.combo);
      }
    this.burst(c.x, c.y);
    if (this.combo >= 4 && !this.reduced) this.shake = 0.16;
    if (!this.attract) {
      navigator.vibrate?.(15);
      this.sound();
    } else if (!this.colored) {
      this.colored = true;
      this.students.forEach((s) => (s.awake = true));
      this.onColor?.();
    }
  }
  sound() {
    if (this.muted) return;
    try {
      this.audio ??= new AudioContext();
      void this.audio.resume();
      const o = this.audio.createOscillator(),
        g = this.audio.createGain();
      o.connect(g);
      g.connect(this.audio.destination);
      o.frequency.setValueAtTime(
        300 + this.combo * 110,
        this.audio.currentTime,
      );
      o.frequency.exponentialRampToValueAtTime(
        90,
        this.audio.currentTime + 0.12,
      );
      g.gain.setValueAtTime(0.08, this.audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.audio.currentTime + 0.15);
      o.start();
      o.stop(this.audio.currentTime + 0.16);
    } catch {}
  }
  tap = (e: PointerEvent) => {
    e.preventDefault();
    if (this.ended || (!this.attract && this.t < 3.6)) return;
    const r = this.canvas.getBoundingClientRect(),
      x = ((e.clientX - r.left) * 360) / r.width,
      y = ((e.clientY - r.top) * 600) / r.height;
    if (this.power && Math.hypot(x - this.power.x, y - this.power.y) < 34) {
      const p = this.power;
      this.result.powerupsUsed++;
      if (!this.result.cards.includes(p.type)) this.result.cards.push(p.type);
      this.message = {
        chair: "Baithaq!",
        trophy: "Hackathon mode",
        chai: "Chai break",
        mic: "Event on hai",
      }[p.type]!;
      this.messageUntil = this.elapsed + 2;
      if (p.type === "chair") {
        this.gatherUntil = this.elapsed + 2;
        this.points(100);
        for (const s of this.students)
          if (!s.awake && Math.hypot(s.x - p.x, s.y - p.y) < 150) {
            s.awake = true;
            this.result.woken++;
            this.points(15);
          }
      }
      if (p.type === "trophy") for (const c of [...this.clouds]) this.pop(c);
      if (p.type === "chai") this.slowUntil = this.elapsed + 5;
      if (p.type === "mic") this.doubleUntil = this.elapsed + 6;
      this.burst(p.x, p.y);
      this.power = null;
      return;
    }
    const c = [...this.clouds]
      .reverse()
      .find((c) => Math.abs(x - c.x) < 58 && Math.abs(y - c.y) < 32);
    if (c) {
      c.hp--;
      if (c.hp <= 0) this.pop(c);
      else this.burst(c.x, c.y);
    } else this.combo = 0;
  };
  draw() {
    const c = this.ctx,
      d = this.canvas.width / 360;
    c.setTransform(d, 0, 0, d, 0, 0);
    c.clearRect(0, 0, 360, 600);
    c.save();
    if (this.shake)
      c.translate(Math.random() * 5 - 2.5, Math.random() * 5 - 2.5);
    c.save();
    const active = this.attract ? this.colored : true;
    c.filter = `saturate(${this.attract ? (this.colored ? 1 : 0) : this.result.pops ? this.vibe : 0})`;
    c.fillStyle = active ? "#E8EDDC" : "#D3D5D3";
    c.fillRect(0, 0, 360, 600);
    // Campus architecture and a courtyard, kept deliberately handmade.
    c.strokeStyle = "#1D2A5C";
    c.lineWidth = 2;
    c.fillStyle = active ? "#F4EAD2" : "#C7CACD";
    c.fillRect(22, 98, 316, 157);
    c.strokeRect(22, 98, 316, 157);
    c.fillStyle = active ? "#E4AB70" : "#ABB0B1";
    c.fillRect(13, 89, 334, 15);
    c.strokeRect(13, 89, 334, 15);
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 9; col++) {
        c.fillStyle = active ? "#567B83" : "#939EA2";
        c.fillRect(38 + col * 33, 115 + row * 35, 17, 23);
        c.strokeRect(38 + col * 33, 115 + row * 35, 17, 23);
      }
    c.fillStyle = "#1D2A5C";
    c.fillRect(151, 207, 57, 49);
    c.fillStyle = "#F9F4E8";
    c.fillRect(87, 71, 185, 25);
    c.strokeRect(87, 71, 185, 25);
    this.text("AIR UNIVERSITY", 180, 88, 12);
    c.fillStyle = active ? "#E1D5BB" : "#BEC2C0";
    c.beginPath();
    c.moveTo(163, 256);
    c.lineTo(205, 256);
    c.lineTo(350, 600);
    c.lineTo(18, 600);
    c.closePath();
    c.fill();
    for (const [x, y] of [
      [20, 310],
      [340, 285],
    ]) {
      c.fillStyle = "#947458";
      c.fillRect(x - 4, y - 65, 8, 76);
      c.fillStyle = active ? "#488D5C" : "#929C92";
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.arc(x + (i - 1) * 15, y - 80 + (i % 2) * 16, 26, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
    }
    c.fillStyle = active ? "#E4312B" : "#94989B";
    c.fillRect(257, 524, 90, 15);
    c.strokeRect(257, 524, 90, 15);
    c.fillStyle = "#F8EFDB";
    c.fillRect(262, 539, 80, 45);
    c.strokeRect(262, 539, 80, 45);
    this.text("CHAI / CANTEEN", 302, 565, 9);
    for (const [x, y] of [
      [27, 415],
      [226, 362],
    ]) {
      c.fillStyle = active ? "#C58953" : "#969B9F";
      c.fillRect(x, y, 62, 10);
      c.strokeRect(x, y, 62, 10);
      c.fillRect(x + 5, y + 13, 4, 15);
      c.fillRect(x + 52, y + 13, 4, 15);
    }
    c.restore();
    c.strokeStyle = "#1D2A5C";
    c.lineWidth = 2;
    this.students.forEach((s, i) => {
      let x = s.x,
        y = s.y;
      if (this.elapsed < this.gatherUntil && s.awake) {
        x = 180 + Math.cos((i / 12) * Math.PI * 2) * 65;
        y = 395 + Math.sin((i / 12) * Math.PI * 2) * 65;
      } else if (s.awake && !this.reduced) y += Math.sin(this.t * 3 + i) * 2;
      this.student(x, y, s.awake, i, s.variant);
    });
    for (const cloud of this.clouds) this.cloud(cloud);
    for (const p of this.particles) {
      c.globalAlpha = Math.max(0, p.life);
      c.fillStyle = p.color;
      c.fillRect(p.x, p.y, 6, 6);
    }
    c.globalAlpha = 1;
    if (this.power) {
      c.fillStyle = "#FFC20E";
      c.beginPath();
      c.arc(this.power.x, this.power.y, 28, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      drawIcon(c, this.power.type, this.power.x, this.power.y);
    }
    if (this.vibe > 0.8 && !this.attract) {
      for (let i = 0; i < 360; i += 20) {
        c.fillStyle = colors[(i / 20) % 5];
        c.beginPath();
        c.arc(i, 596, 9, Math.PI, 0);
        c.fill();
      }
    }
    if (!this.attract) {
      if (this.t < 3.6) {
        this.text(
          this.t < 3 ? String(3 - Math.floor(this.t)) : "Jaago!",
          180,
          350,
          62,
        );
      } else if (!this.result.pops && this.clouds.length) {
        const p = this.clouds[0];
        this.text("Tap the bore.", 180, 555, 18);
        c.strokeStyle = "#1D2A5C";
        c.beginPath();
        c.arc(
          p.x,
          p.y,
          40 + (this.reduced ? 0 : Math.sin(this.t * 4) * 3),
          0,
          Math.PI * 2,
        );
        c.stroke();
        c.fillStyle = "#fffdf6";
        c.beginPath();
        c.roundRect(p.x + 14, p.y + 18, 9, 28, 4);
        c.roundRect(p.x + 12, p.y + 35, 25, 22, 7);
        c.fill();
        c.stroke();
      }
      if (this.combo > 1 && this.elapsed - this.lastPop < 0.8)
        this.text(`×${this.combo}`, 180, 280, 45);
      if (this.elapsed < this.messageUntil)
        this.text(this.message, 180, 190, 24);
      if (this.slowUntil > this.elapsed) this.text("Chai break", 70, 580, 12);
      if (this.doubleUntil > this.elapsed) this.text("2× points", 280, 580, 12);
    }
    if (this.debug)
      this.text(
        `${this.fps} fps | ${this.interval}s | pops ${this.result.pops} | woke ${this.result.woken}`,
        180,
        588,
        10,
      );
    c.restore();
  }
  text(t: string, x: number, y: number, size: number) {
    this.ctx.fillStyle = "#1D2A5C";
    this.ctx.font =
      size >= 24
        ? `${size}px Bungee, sans-serif`
        : `700 ${size}px Rubik, sans-serif`;
    this.ctx.textAlign = "center";
    this.ctx.fillText(t, x, y);
  }
  cloud(a: Cloud) {
    const c = this.ctx;
    c.save();
    c.translate(a.x, a.y);
    c.fillStyle = a.hp === 2 ? "#969BA5" : "#F1F0E9";
    c.strokeStyle = "#1D2A5C";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-48, 12);
    c.bezierCurveTo(-65, -6, -42, -28, -25, -20);
    c.bezierCurveTo(-21, -43, 13, -43, 22, -22);
    c.bezierCurveTo(44, -35, 67, -8, 48, 12);
    c.closePath();
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(-13, -18);
    c.lineTo(-5, -15);
    c.moveTo(5, -15);
    c.lineTo(13, -18);
    c.stroke();
    this.text(a.label, 0, 3, a.label.length > 15 ? 8 : 10);
    if (a.hp === 2) this.text("2 taps", 0, 23, 8);
    c.restore();
  }
  student(x: number, y: number, awake: boolean, i: number, v: number) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.strokeStyle = "#1D2A5C";
    c.lineWidth = 2;
    c.fillStyle = "rgba(29,42,92,.10)";
    c.beginPath();
    c.ellipse(0, 21, 18, 5, 0, 0, 7);
    c.fill();
    c.fillStyle = awake ? colors[i % 5] : "#8E9398";
    c.beginPath();
    c.roundRect(-12, -3, 24, 26, 9);
    c.fill();
    c.stroke();
    c.fillStyle = awake ? "#E9B889" : "#BFC2C3";
    c.beginPath();
    c.arc(0, -13, 12, 0, 7);
    c.fill();
    c.stroke();
    if (v === 1) {
      c.fillStyle = awake ? "#F2338C" : "#969AA2";
      c.beginPath();
      c.arc(0, -15, 15, Math.PI, 0);
      c.lineTo(17, 5);
      c.lineTo(9, 5);
      c.lineTo(9, -13);
      c.closePath();
      c.fill();
      c.stroke();
    }
    if (v === 0 || v === 2) {
      c.fillStyle = v === 2 ? "#2356D8" : "#1D2A5C";
      c.fillRect(-13, -25, 26, 8);
      if (v === 2) c.fillRect(6, -19, 13, 3);
    }
    if (v === 3) {
      c.strokeRect(-10, -17, 8, 6);
      c.strokeRect(2, -17, 8, 6);
    }
    if (v === 4) {
      c.beginPath();
      c.arc(0, -13, 16, Math.PI, 0);
      c.stroke();
      c.fillStyle = "#1D2A5C";
      c.fillRect(-17, -15, 5, 10);
      c.fillRect(12, -15, 5, 10);
    }
    if (v === 5) {
      c.fillStyle = "#FFC20E";
      c.fillRect(9, 2, 8, 17);
      c.strokeRect(9, 2, 8, 17);
    }
    c.fillStyle = "#1D2A5C";
    c.fillRect(-5, -14, 2, 2);
    c.fillRect(4, -14, 2, 2);
    c.beginPath();
    c.moveTo(-5, 24);
    c.lineTo(-5, 29);
    c.moveTo(5, 24);
    c.lineTo(5, 29);
    c.stroke();
    if (!awake) this.text("zzz", 16, -33, 10);
    c.restore();
  }
}
export function drawIcon(
  c: CanvasRenderingContext2D,
  type: string,
  x: number,
  y: number,
) {
  c.save();
  c.translate(x, y);
  c.strokeStyle = "#1D2A5C";
  c.lineWidth = 3;
  c.lineCap = "round";
  c.beginPath();
  if (type === "chair") {
    c.rect(-10, -14, 18, 16);
    c.moveTo(-10, 2);
    c.lineTo(12, 2);
    c.moveTo(-9, 2);
    c.lineTo(-9, 15);
    c.moveTo(10, 2);
    c.lineTo(10, 15);
  }
  if (type === "trophy") {
    c.moveTo(-10, -13);
    c.lineTo(10, -13);
    c.lineTo(7, 0);
    c.quadraticCurveTo(0, 10, -7, 0);
    c.closePath();
    c.moveTo(0, 6);
    c.lineTo(0, 14);
    c.moveTo(-8, 15);
    c.lineTo(8, 15);
    c.moveTo(-10, -10);
    c.bezierCurveTo(-22, -13, -18, 1, -8, 1);
    c.moveTo(10, -10);
    c.bezierCurveTo(22, -13, 18, 1, 8, 1);
  }
  if (type === "chai") {
    c.rect(-12, -5, 20, 17);
    c.moveTo(8, -3);
    c.bezierCurveTo(23, -5, 21, 10, 8, 8);
    c.moveTo(-7, -12);
    c.lineTo(-4, -18);
    c.moveTo(1, -12);
    c.lineTo(4, -18);
  }
  if (type === "mic") {
    c.roundRect(-7, -17, 14, 22, 7);
    c.moveTo(-12, -2);
    c.bezierCurveTo(-12, 15, 12, 15, 12, -2);
    c.moveTo(0, 10);
    c.lineTo(0, 18);
    c.moveTo(-7, 18);
    c.lineTo(7, 18);
  }
  c.stroke();
  c.restore();
}
