export type Cue = "move" | "capture" | "castle" | "promotion" | "check" | "start" | "finish" | "notice";
export interface SoundSettings { enabled: boolean; volume: number }

const storageKey = "chessboard.sound";
let settings: SoundSettings = { enabled: true, volume: 60 };
let context: AudioContext | undefined;
const buffers = new Map<Cue, AudioBuffer>();

let moveRecording: Promise<AudioBuffer> | undefined;

function loadMove(audio: AudioContext) {
  if (!moveRecording) {
    moveRecording = fetch("/sounds/alabaster-move.wav").then(async response => {
      if (!response.ok) throw Error("Move recording unavailable");
      return audio.decodeAudioData(await response.arrayBuffer());
    }).catch(error => {
      moveRecording = undefined;
      throw error;
    });
  }
  return moveRecording;
}

export function readSound(): SoundSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (typeof saved?.enabled === "boolean" && Number.isInteger(saved.volume) && saved.volume >= 0 && saved.volume <= 100)
      settings = saved;
  } catch { /* Keep in-memory settings when storage is unavailable. */ }
  return settings;
}

export function saveSound(next: SoundSettings) {
  settings = next;
  try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Session-only settings. */ }
}

export function unlockSound() {
  if (!readSound().enabled || typeof AudioContext === "undefined") return;
  try {
    context ??= new AudioContext();
    void loadMove(context).catch(() => {});
    if (context.state === "suspended") void context.resume().catch(() => {});
  } catch { /* Gameplay remains available without an audio device. */ }
}

// Board impacts combine a brief contact noise with rapidly fading wood resonances.
function woodenTap(samples: Float32Array, rate: number, delay: number, heavy: boolean, level = 1) {
  const offset = Math.round(delay * rate);
  const length = Math.min(Math.ceil(rate * .14), samples.length - offset);
  const pitch = heavy ? 490 : 685;
  let seed = heavy ? 3407 : 1789;
  let previousNoise = 0;
  for (let i = 0; i < length; i++) {
    const time = i / rate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    const angle = 2 * Math.PI * pitch * time;
    const contact = (noise - previousNoise) * .23 * Math.exp(-time / .0028);
    previousNoise = noise;
    const body = .52 * Math.sin(angle) * Math.exp(-time / (heavy ? .021 : .014))
      + .28 * Math.sin(2.42 * angle) * Math.exp(-time / .009)
      + .17 * Math.sin(4.13 * angle) * Math.exp(-time / .004);
    samples[offset + i] += .68 * level * Math.min(1, time / .0007) * (contact + body);
  }
}

const signals = {
  notice: [[0, 950, .035], [.08, 1260, .045]],
  start: [[0, 530, .055], [.10, 790, .065]],
  finish: [[0, 790, .06], [.13, 530, .09]],
};

function sample(audio: AudioContext, cue: Exclude<Cue, "move">) {
  const cached = buffers.get(cue);
  if (cached) return cached;
  const rate = audio.sampleRate;
  let buffer: AudioBuffer;
  if (cue === "notice" || cue === "start" || cue === "finish") {
    const recipe = signals[cue];
    const [delay, , decay] = recipe[recipe.length - 1];
    buffer = audio.createBuffer(1, Math.ceil((delay + 7 * decay) * rate), rate);
    const samples = buffer.getChannelData(0);
    for (const [start, frequency, fade] of recipe) {
      const offset = Math.round(start * rate);
      for (let i = offset; i < samples.length; i++) {
        const t = (i - offset) / rate;
        const angle = 2 * Math.PI * frequency * t;
        samples[i] += .48 * Math.min(1, t * 1200) * Math.exp(-t / fade) *
          (Math.sin(angle) + .38 * Math.sin(angle * 2.71) + .18 * Math.sin(angle * 4.37));
      }
    }
  } else {
    const secondTap = cue === "castle" ? .095 : cue === "promotion" ? .135 : cue === "check" ? .065 : 0;
    buffer = audio.createBuffer(1, Math.ceil((secondTap + .14) * rate), rate);
    const samples = buffer.getChannelData(0);
    woodenTap(samples, rate, 0, cue === "capture" || cue === "promotion");
    if (secondTap) woodenTap(samples, rate, secondTap, cue === "castle", cue === "check" ? .55 : .8);
  }
  buffers.set(cue, buffer);
  return buffer;
}

export async function playSound(cue: Cue) {
  if (!context || !readSound().enabled || !readSound().volume) return;
  let buffer: AudioBuffer;
  try {
    if (context.state === "suspended") await context.resume();
    buffer = cue === "move" ? await loadMove(context) : sample(context, cue);
  } catch { return; }

  const { enabled, volume } = readSound();
  if (!enabled || !volume || context?.state !== "running") return;
  const source = context.createBufferSource();
  const gain = context.createGain();
  gain.gain.value = volume / 100;
  source.buffer = buffer;
  source.connect(gain).connect(context.destination);
  source.onended = () => { source.disconnect(); gain.disconnect(); };
  source.start();
}
