// Synthesised game audio: effects, a tempo-following beat and spoken brainrot
// callouts. No audio files, so nothing to license or download.

const ZONE_LINES: Record<string, string> = {
  e9: "Air University. Let's go!",
  library: "Shhhh. Library mode.",
  cafe: "Chai pe charcha!",
  fmc: "Doctor sahab, emergency!",
  kamra: "Bombardiro Crocodilo!",
  multan: "Tralalero tralala!",
  hack: "Sigma hackathon grindset.",
};

export function createRunnerAudio() {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let muted = false;
  let brainrot = true;
  let musicTimer: ReturnType<typeof setInterval> | undefined;
  let nextStep = 0;
  let step = 0;
  let lastSpeech = 0;

  const ready = () => {
    if (muted || typeof window === "undefined") return null;
    try {
      if (!ctx) {
        ctx = new AudioContext();
        master = ctx.createGain();
        master.gain.value = 0.9;
        master.connect(ctx.destination);
        noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === "suspended") void ctx.resume();
      return ctx;
    } catch {
      return null;
    }
  };
  const tone = (
    freq: number,
    duration: number,
    type: OscillatorType = "square",
    volume = 0.05,
    slideTo?: number,
    at = 0,
  ) => {
    const a = ready();
    if (!a || !master) return;
    const start = Math.max(a.currentTime, at || a.currentTime);
    const osc = a.createOscillator(),
      gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo)
      osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  };
  const noise = (
    duration: number,
    volume: number,
    filter: BiquadFilterType,
    from: number,
    to = from,
    at = 0,
  ) => {
    const a = ready();
    if (!a || !master || !noiseBuffer) return;
    const start = Math.max(a.currentTime, at || a.currentTime);
    const src = a.createBufferSource(),
      f = a.createBiquadFilter(),
      gain = a.createGain();
    src.buffer = noiseBuffer;
    f.type = filter;
    f.frequency.setValueAtTime(from, start);
    f.frequency.exponentialRampToValueAtTime(to, start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(f).connect(gain).connect(master);
    src.start(start);
    src.stop(start + duration + 0.02);
  };
  const say = (text: string, pitch = 1, rate = 1, force = false) => {
    if (muted || !brainrot || typeof speechSynthesis === "undefined") return;
    const now = Date.now();
    if (!force && now - lastSpeech < 1800) return;
    lastSpeech = now;
    try {
      speechSynthesis.cancel();
      const line = new SpeechSynthesisUtterance(text);
      line.pitch = pitch;
      line.rate = rate;
      line.volume = 1;
      speechSynthesis.speak(line);
    } catch {}
  };
  const vineBoom = (at = 0) => {
    tone(110, 0.9, "sine", 0.35, 38, at);
    tone(55, 0.9, "triangle", 0.25, 30, at);
    noise(0.25, 0.25, "lowpass", 900, 80, at);
  };

  // A four-bar beat in a minor pentatonic. Tempo follows run speed.
  const BASS = [45, 45, 48, 50, 45, 45, 52, 50];
  const LEAD = [69, 72, 74, 76, 79, 76, 74, 72];
  const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
  const startMusic = (speed: () => number) => {
    const a = ready();
    if (!a || musicTimer) return;
    nextStep = a.currentTime + 0.05;
    musicTimer = setInterval(() => {
      if (!ctx || muted) return;
      const bpm = 112 + Math.min(1, Math.max(0, (speed() - 22) / 22)) * 36;
      const sixteenth = 60 / bpm / 4;
      while (nextStep < ctx.currentTime + 0.12) {
        const s = step % 16,
          bar = Math.floor(step / 16) % 8;
        if (s % 4 === 0) tone(150, 0.14, "sine", 0.22, 45, nextStep);
        if (s === 4 || s === 12)
          noise(0.12, 0.08, "highpass", 1800, 1200, nextStep);
        if (s % 2 === 0) noise(0.03, 0.025, "highpass", 7000, 6000, nextStep);
        if (s === 0 || s === 6 || s === 10)
          tone(
            midi(BASS[bar]),
            sixteenth * 2.5,
            "sawtooth",
            0.035,
            undefined,
            nextStep,
          );
        if (s % 4 === 2 && bar % 2 === 1)
          tone(
            midi(LEAD[(step >> 2) % LEAD.length]),
            sixteenth * 1.6,
            "square",
            0.018,
            undefined,
            nextStep,
          );
        nextStep += sixteenth;
        step++;
      }
    }, 40);
  };
  const stopMusic = () => {
    clearInterval(musicTimer);
    musicTimer = undefined;
  };

  return {
    get muted() {
      return muted;
    },
    set muted(value: boolean) {
      muted = value;
      if (value) {
        stopMusic();
        try {
          speechSynthesis.cancel();
        } catch {}
      }
    },
    get brainrot() {
      return brainrot;
    },
    set brainrot(value: boolean) {
      brainrot = value;
    },
    unlock() {
      tone(1, 0.01, "sine", 0.0001);
      try {
        if (!muted && brainrot)
          speechSynthesis.speak(new SpeechSynthesisUtterance(" "));
      } catch {}
    },
    startMusic,
    stopMusic,
    vote(level: number) {
      const base = 880 * Math.pow(1.06, level * 2);
      tone(base, 0.06, "square", 0.04);
      tone(
        base * 1.5,
        0.12,
        "triangle",
        0.05,
        undefined,
        (ctx?.currentTime || 0) + 0.05,
      );
    },
    levelUp(level: number) {
      [0, 4, 7, 12].forEach((n, i) =>
        tone(
          523 * Math.pow(2, (n + level) / 12),
          0.12,
          "square",
          0.04,
          undefined,
          (ctx?.currentTime || 0) + i * 0.06,
        ),
      );
      if (level === 5) say("Sigma! Times five!", 0.6, 0.9, true);
    },
    jump() {
      noise(0.22, 0.08, "bandpass", 500, 2500);
      tone(320, 0.18, "triangle", 0.05, 700);
    },
    slide() {
      noise(0.3, 0.1, "lowpass", 3000, 300);
    },
    power(kind: string) {
      [0, 4, 7, 12, 16].forEach((n, i) =>
        tone(
          660 * Math.pow(2, n / 12),
          0.1,
          "square",
          0.04,
          undefined,
          (ctx?.currentTime || 0) + i * 0.05,
        ),
      );
      if (kind === "wings") say("Bombardiro Crocodilo!", 0.8, 1.05, true);
      else if (kind === "chai") say("Chai time!", 1.2, 1.1);
      else if (kind === "magnet") say("Rizz magnet activated", 1, 1.1);
      else if (kind === "double") say("Double or nothing", 1, 1.1);
    },
    collab(label: string) {
      tone(660, 0.12, "triangle", 0.07);
      tone(
        990,
        0.25,
        "triangle",
        0.07,
        undefined,
        (ctx?.currentTime || 0) + 0.1,
      );
      say(`W collab with ${label}`, 1.1, 1.1);
    },
    shield() {
      tone(200, 0.3, "sawtooth", 0.08, 90);
      noise(0.2, 0.1, "lowpass", 1200, 200);
      say("Not today!", 1.3, 1.2, true);
    },
    crash() {
      vineBoom();
      say("Bruh.", 0.5, 0.8, true);
    },
    zone(id: string) {
      const a = ready();
      const t = a?.currentTime || 0;
      // Tung tung tung: three wood-block knocks before the jingle.
      for (let i = 0; i < 3; i++) {
        tone(740, 0.07, "square", 0.06, 500, t + i * 0.16);
        noise(0.05, 0.08, "bandpass", 1800, 1500, t + i * 0.16);
      }
      [523, 659, 784, 1047].forEach((f, i) =>
        tone(f, 0.16, "triangle", 0.05, undefined, t + 0.5 + i * 0.1),
      );
      say(ZONE_LINES[id] || "Tung tung tung sahur!", 0.9, 1);
    },
    achievement() {
      [784, 988, 1319, 1568].forEach((f, i) =>
        tone(
          f,
          0.14,
          "square",
          0.045,
          undefined,
          (ctx?.currentTime || 0) + i * 0.08,
        ),
      );
      say("Let him cook!", 1, 1.05);
    },
    ahmed(text: string) {
      if (/vote ahmed/i.test(text)) say("Vote Ahmed Malik!", 1, 1, true);
    },
    newBest() {
      tone(988, 0.1, "square", 0.05);
      tone(1319, 0.3, "square", 0.05, undefined, (ctx?.currentTime || 0) + 0.1);
      say("New best! W!", 1.1, 1.05, true);
    },
  };
}
