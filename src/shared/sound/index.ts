export type Cue = "move" | "capture" | "castle" | "promotion" | "check" | "start" | "finish";
export interface SoundSettings { enabled: boolean; volume: number }

const storageKey = "chessboard.sound";
let settings: SoundSettings = { enabled: true, volume: 60 };
let context: AudioContext | undefined;
const buffers = new Map<Cue, AudioBuffer>();

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
    if (context.state === "suspended") void context.resume().catch(() => {});
  } catch { /* Gameplay remains available without an audio device. */ }
}

// Delay, resonance frequency and decay of each strike in the original synthesized set.
const strikes: Record<Cue, [number, number, number][]> = {
  move: [[0, 780, .023]], capture: [[0, 470, .035]],
  castle: [[0, 740, .024], [.10, 590, .025]],
  promotion: [[0, 730, .022], [.09, 1100, .05]],
  check: [[0, 1180, .065]], start: [[0, 530, .055], [.10, 790, .065]],
  finish: [[0, 790, .06], [.13, 530, .09]],
};

function sample(audio: AudioContext, cue: Cue) {
  const cached = buffers.get(cue);
  if (cached) return cached;
  const recipe = strikes[cue];
  const last = recipe[recipe.length - 1];
  const buffer = audio.createBuffer(1, Math.ceil((last[0] + 7 * last[2]) * audio.sampleRate), audio.sampleRate);
  const samples = buffer.getChannelData(0);
  for (const [delay, frequency, decay] of recipe) {
    const offset = Math.round(delay * audio.sampleRate);
    for (let i = offset; i < samples.length; i++) {
      const t = (i - offset) / audio.sampleRate;
      const angle = 2 * Math.PI * frequency * t;
      samples[i] += .48 * Math.min(1, t * 1200) * Math.exp(-t / decay) *
        (Math.sin(angle) + .38 * Math.sin(angle * 2.71) + .18 * Math.sin(angle * 4.37));
    }
  }
  buffers.set(cue, buffer);
  return buffer;
}

export function playSound(cue: Cue) {
  const { enabled, volume } = readSound();
  if (!enabled || !volume || context?.state !== "running") return;
  const source = context.createBufferSource();
  const gain = context.createGain();
  gain.gain.value = volume / 100;
  source.buffer = sample(context, cue);
  source.connect(gain).connect(context.destination);
  source.onended = () => { source.disconnect(); gain.disconnect(); };
  source.start();
}
