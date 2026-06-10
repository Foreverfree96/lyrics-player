// Web Audio API — synthesize vocal tones for musical notes
// Formant-filtered sawtooth creates a warm "ah" singing tone at the correct pitch

import { ref } from "vue";

const NOTE_FREQUENCIES = {
  "C2": 65.41, "C#2": 69.30, "Db2": 69.30, "D2": 73.42, "D#2": 77.78, "Eb2": 77.78,
  "E2": 82.41, "F2": 87.31, "F#2": 92.50, "Gb2": 92.50, "G2": 98.00, "G#2": 103.83,
  "Ab2": 103.83, "A2": 110.00, "A#2": 116.54, "Bb2": 116.54, "B2": 123.47,
  "C3": 130.81, "C#3": 138.59, "Db3": 138.59, "D3": 146.83, "D#3": 155.56, "Eb3": 155.56,
  "E3": 164.81, "F3": 174.61, "F#3": 185.00, "Gb3": 185.00, "G3": 196.00, "G#3": 207.65,
  "Ab3": 207.65, "A3": 220.00, "A#3": 233.08, "Bb3": 233.08, "B3": 246.94,
  "C4": 261.63, "C#4": 277.18, "Db4": 277.18, "D4": 293.66, "D#4": 311.13, "Eb4": 311.13,
  "E4": 329.63, "F4": 349.23, "F#4": 369.99, "Gb4": 369.99, "G4": 392.00, "G#4": 415.30,
  "Ab4": 415.30, "A4": 440.00, "A#4": 466.16, "Bb4": 466.16, "B4": 493.88,
  "C5": 523.25, "C#5": 554.37, "Db5": 554.37, "D5": 587.33, "D#5": 622.25, "Eb5": 622.25,
  "E5": 659.25, "F5": 698.46, "F#5": 739.99, "Gb5": 739.99, "G5": 783.99, "G#5": 830.61,
  "Ab5": 830.61, "A5": 880.00, "A#5": 932.33, "Bb5": 932.33, "B5": 987.77,
  "C6": 1046.50,
};

const NOTE_NAMES = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"];

// Chromatic scale for transposition (sharps only for simplicity)
const CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_TO_SHARP = { "Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#" };
const SHARP_TO_FLAT = { "C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb" };

function transposeNote(noteStr, semitones) {
  if (!noteStr) return noteStr;
  const match = noteStr.trim().match(/^([A-Ga-g][#b]?)(\d)?$/);
  if (!match) return noteStr;
  let name = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  const octave = parseInt(match[2] || "4");
  const useFlats = !!FLAT_TO_SHARP[name];
  const sharp = FLAT_TO_SHARP[name] || name;
  let idx = CHROMATIC.indexOf(sharp);
  if (idx < 0) return noteStr;
  idx += semitones;
  const octaveShift = Math.floor(idx / 12);
  idx = ((idx % 12) + 12) % 12;
  const newNote = useFlats && SHARP_TO_FLAT[CHROMATIC[idx]] ? SHARP_TO_FLAT[CHROMATIC[idx]] : CHROMATIC[idx];
  return newNote + (octave + octaveShift);
}

function transposeChord(chord, semitones) {
  if (!chord) return chord;
  const match = chord.match(/^([A-Ga-g][#b]?)(.*)/);
  if (!match) return chord;
  let root = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  const quality = match[2]; // m, 7, maj7, dim, etc.
  const useFlats = !!FLAT_TO_SHARP[root];
  const sharp = FLAT_TO_SHARP[root] || root;
  let idx = CHROMATIC.indexOf(sharp);
  if (idx < 0) return chord;
  idx = (((idx + semitones) % 12) + 12) % 12;
  const newRoot = useFlats && SHARP_TO_FLAT[CHROMATIC[idx]] ? SHARP_TO_FLAT[CHROMATIC[idx]] : CHROMATIC[idx];
  return newRoot + quality;
}

function transposeKey(keyStr, semitones) {
  if (!keyStr) return keyStr;
  const match = keyStr.match(/^([A-Ga-g][#b]?)\s*(.*)/);
  if (!match) return keyStr;
  const root = transposeChord(match[1], semitones);
  return root + (match[2] ? " " + match[2] : "");
}

// Human vocal formant frequencies for "ah" vowel
const FORMANTS = [
  { freq: 800,  gain: 0.06, q: 8  },
  { freq: 1200, gain: 0.03, q: 10 },
  { freq: 2500, gain: 0.015, q: 12 },
  { freq: 3500, gain: 0.008, q: 14 },
];

let audioCtx = null;
let masterVolume = null;

const volume = ref(0.8); // 0–1

function getContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterVolume = audioCtx.createGain();
    masterVolume.gain.value = volume.value;
    masterVolume.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  masterVolume.gain.value = volume.value;
  return audioCtx;
}

function getDest() {
  getContext();
  return masterVolume;
}

function setVolume(v) {
  volume.value = Math.max(0, Math.min(1, v));
  if (masterVolume) masterVolume.gain.value = volume.value;
}

function getFrequency(note) {
  if (!note) return null;
  const clean = note.trim();
  if (NOTE_FREQUENCIES[clean]) return NOTE_FREQUENCIES[clean];
  if (NOTE_NAMES.includes(clean)) return NOTE_FREQUENCIES[clean + "4"];
  const match = clean.match(/^([A-Ga-g][#b]?)(\d)?$/);
  if (match) {
    const name = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    const octave = match[2] || "4";
    return NOTE_FREQUENCIES[name + octave] || null;
  }
  return null;
}

// Shared state
const isSinging = ref(false);
const isPaused = ref(false);
const currentLineIdx = ref(-1);
let cancelSinging = false;
let pauseResolve = null; // resolve function to resume from pause
let jumpTarget = -1; // line index to jump to
let currentLines = []; // reference to lines array for jumping

export function useNoteTone() {

  // ── Simple piano tone (click a note badge) ──────────────────────────────
  const playNote = (note, duration = 0.8) => {
    const freq = getFrequency(note);
    if (!freq) return;

    const ctx = getContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;

    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = freq * 2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.02);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.1);
    gain.gain.setValueAtTime(0.25, now + duration * 0.6);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.1, now + 0.02);
    gain2.gain.linearRampToValueAtTime(0, now + duration * 0.7);

    osc.connect(gain).connect(getDest());
    osc2.connect(gain2).connect(getDest());

    osc.start(now);
    osc2.start(now);
    osc.stop(now + duration + 0.05);
    osc2.stop(now + duration + 0.05);
  };

  const playChord = (notes, duration = 1.2) => {
    if (!Array.isArray(notes)) return;
    const ctx = getContext();
    const now = ctx.currentTime;

    notes.forEach((note) => {
      const freq = getFrequency(note);
      if (!freq) return;

      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      const vol = 0.18 / Math.max(notes.length, 1);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.02);
      gain.gain.setValueAtTime(vol, now + duration * 0.6);
      gain.gain.linearRampToValueAtTime(0, now + duration);

      osc.connect(gain).connect(getDest());
      osc.start(now);
      osc.stop(now + duration + 0.05);
    });
  };

  const playArpeggio = (notes, noteLength = 0.4) => {
    if (!Array.isArray(notes)) return;
    notes.forEach((note, i) => {
      setTimeout(() => playNote(note, noteLength), i * (noteLength * 500));
    });
  };

  // ── Rich vocal tone (formant synthesis) ─────────────────────────────────
  // Plays a warm "ah" hum at the given note — this is the tone to sing at
  const playVocalTone = (note, duration = 2.0) => {
    const freq = getFrequency(note);
    if (!freq) return;

    const ctx = getContext();
    const now = ctx.currentTime;

    // Fundamental — sawtooth for rich harmonics
    const fundamental = ctx.createOscillator();
    fundamental.type = "sawtooth";
    fundamental.frequency.value = freq;

    // Vibrato
    const vibrato = ctx.createOscillator();
    vibrato.type = "sine";
    vibrato.frequency.value = 5.5;
    const vibratoGain = ctx.createGain();
    vibratoGain.gain.value = freq * 0.008;
    vibrato.connect(vibratoGain);
    vibratoGain.connect(fundamental.frequency);

    const tail = 0.5; // extra fade tail duration
    const totalDur = duration + tail;

    // Master gain — extended fade with smooth tail
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.07, now + 0.15);
    masterGain.gain.setValueAtTime(0.07, now + duration * 0.6);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + totalDur);

    // Formant filters
    FORMANTS.forEach(({ freq: fFreq, gain: fGain, q }) => {
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = fFreq;
      filter.Q.value = q;

      const fGainNode = ctx.createGain();
      fGainNode.gain.setValueAtTime(0, now);
      fGainNode.gain.linearRampToValueAtTime(fGain, now + 0.15);
      fGainNode.gain.setValueAtTime(fGain, now + duration * 0.6);
      fGainNode.gain.exponentialRampToValueAtTime(0.0001, now + totalDur);

      fundamental.connect(filter);
      filter.connect(fGainNode);
      fGainNode.connect(getDest());
    });

    fundamental.connect(masterGain);
    masterGain.connect(getDest());

    // Breath noise — also with extended tail
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * totalDur));
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) noiseData[i] = (Math.random() * 2 - 1) * 0.3;

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 2000;
    noiseFilter.Q.value = 1;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.008, now + 0.2);
    noiseGain.gain.setValueAtTime(0.008, now + duration * 0.6);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + totalDur);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(getDest());

    fundamental.start(now);
    vibrato.start(now);
    noise.start(now);
    fundamental.stop(now + totalDur + 0.1);
    vibrato.stop(now + totalDur + 0.1);
    noise.stop(now + totalDur + 0.1);
  };

  const getLineDuration = (text) => {
    if (!text) return 1.5;
    const words = text.split(/\s+/).length;
    return Math.max(1.5, Math.min(4.5, words * 0.35));
  };

  // ── Sing a single line — plays the vocal tone for the note ──────────────
  const singLine = (text, note) => {
    if (!text || !note) return Promise.resolve();
    const duration = getLineDuration(text);
    playVocalTone(note, duration);
    return new Promise(r => setTimeout(r, duration * 1000));
  };

  // ── Sing all lines with pause/resume support ────────────────────────────
  // lines: array of { text, note }
  // onLineStart(idx): callback to highlight the current line
  const singAllLines = async (lines, onLineStart) => {
    if (isSinging.value && !isPaused.value) {
      stopSinging();
      return;
    }

    // Resume from pause
    if (isPaused.value && pauseResolve) {
      isPaused.value = false;
      pauseResolve();
      return;
    }

    isSinging.value = true;
    isPaused.value = false;
    cancelSinging = false;
    jumpTarget = -1;
    currentLines = lines;
    currentLineIdx.value = -1;

    for (let i = 0; i < lines.length; i++) {
      if (cancelSinging) break;

      // Check for jump request
      if (jumpTarget >= 0) {
        i = jumpTarget;
        jumpTarget = -1;
        if (i >= lines.length) break;
      }

      // Check for pause
      if (isPaused.value) {
        await new Promise(r => { pauseResolve = r; });
        pauseResolve = null;
        if (cancelSinging) break;
        // Re-check jump after resume
        if (jumpTarget >= 0) {
          i = jumpTarget;
          jumpTarget = -1;
          if (i >= lines.length) break;
        }
      }

      const { text, note } = lines[i];
      if (!text) continue;

      currentLineIdx.value = i;
      if (onLineStart) onLineStart(i);

      await singLine(text, note || "C4");

      // Brief pause between lines
      if (!cancelSinging && !isPaused.value) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    isSinging.value = false;
    isPaused.value = false;
    currentLineIdx.value = -1;
    currentLines = [];
  };

  const pauseSinging = () => {
    if (isSinging.value && !isPaused.value) {
      isPaused.value = true;
    }
  };

  const resumeSinging = () => {
    if (isSinging.value && isPaused.value && pauseResolve) {
      isPaused.value = false;
      pauseResolve();
    }
  };

  const jumpToLine = (idx) => {
    if (!isSinging.value || idx < 0) return;
    jumpTarget = idx;
    // If paused, resume so the jump takes effect
    if (isPaused.value && pauseResolve) {
      isPaused.value = false;
      pauseResolve();
    }
  };

  const stopSinging = () => {
    cancelSinging = true;
    isPaused.value = false;
    if (pauseResolve) { pauseResolve(); pauseResolve = null; }
    isSinging.value = false;
    currentLineIdx.value = -1;
  };

  return {
    playNote, playChord, playArpeggio, getFrequency,
    singLine, singAllLines, pauseSinging, resumeSinging, stopSinging, jumpToLine, playVocalTone,
    transposeNote, transposeChord, transposeKey, getLineDuration,
    isSinging, isPaused, currentLineIdx, volume, setVolume,
  };
}
