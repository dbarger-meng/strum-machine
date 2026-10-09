// Music theory helpers: chords, guitar voicings, bass notes, scales, key and chord detection.

export const NOTE_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTE_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const OPEN_STRINGS = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4 (low to high)
export const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
export const FLAT_MAJOR_TONICS = new Set([5, 10, 3, 8, 1]); // F Bb Eb Ab Db

export const mod12 = (n) => ((n % 12) + 12) % 12;
export const pcName = (pc, flats = false) => (flats ? NOTE_FLAT : NOTE_SHARP)[mod12(pc)];
export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

const accVal = (a) => (a === '#' || a === '♯' ? 1 : a === 'b' || a === '♭' ? -1 : 0);

export function parseChord(name) {
  if (typeof name !== 'string') return null;
  const m = /^([A-Ga-g])([#b♯♭]?)([^/]*)(?:\/([A-Ga-g])([#b♯♭]?))?$/.exec(name.trim());
  if (!m) return null;
  const pc = mod12(LETTER[m[1].toUpperCase()] + accVal(m[2]));
  const suffix = m[3];
  let quality = 'maj';
  if (/^(maj|ma|M|Δ)/.test(suffix)) quality = 'maj';
  else if (/^(dim|°)/.test(suffix)) quality = 'min';
  else if (/^(m|min|-)/.test(suffix)) quality = 'min';
  else if (/^(7|9|11|13)/.test(suffix)) quality = 'dom7';
  const bassPc = m[4] ? mod12(LETTER[m[4].toUpperCase()] + accVal(m[5])) : null;
  return { name: name.trim(), pc, quality, bassPc, suffix };
}

export function transposeChord(name, semis, flats = false) {
  const m = /^([A-Ga-g][#b♯♭]?)([^/]*)(?:\/([A-Ga-g][#b♯♭]?))?$/.exec(name.trim());
  if (!m) return name;
  const rootPc = (s) => mod12(LETTER[s[0].toUpperCase()] + accVal(s[1]));
  let out = pcName(rootPc(m[1]) + semis, flats) + m[2];
  if (m[3]) out += '/' + pcName(rootPc(m[3]) + semis, flats);
  return out;
}

// ---- guitar voicings (frets low E to high e, null = muted) ----
const OPEN_VOICINGS = {
  '7:maj': [3, 2, 0, 0, 0, 3], // G
  '0:maj': [null, 3, 2, 0, 1, 0], // C
  '2:maj': [null, null, 0, 2, 3, 2], // D
  '9:maj': [null, 0, 2, 2, 2, 0], // A
  '4:maj': [0, 2, 2, 1, 0, 0], // E
  '9:min': [null, 0, 2, 2, 1, 0], // Am
  '4:min': [0, 2, 2, 0, 0, 0], // Em
  '2:min': [null, null, 0, 2, 3, 1], // Dm
  '7:dom7': [3, 2, 0, 0, 0, 1], // G7
  '0:dom7': [null, 3, 2, 3, 1, 0], // C7
  '2:dom7': [null, null, 0, 2, 1, 2], // D7
  '9:dom7': [null, 0, 2, 0, 2, 0], // A7
  '4:dom7': [0, 2, 0, 1, 0, 0], // E7
  '11:dom7': [null, 2, 1, 2, 0, 2], // B7
  '11:min': [null, 2, 4, 4, 3, 2], // Bm
};
const SHAPE_E = { maj: [0, 2, 2, 1, 0, 0], min: [0, 2, 2, 0, 0, 0], dom7: [0, 2, 0, 1, 0, 0] };
const SHAPE_A = { maj: [null, 0, 2, 2, 2, 0], min: [null, 0, 2, 2, 1, 0], dom7: [null, 0, 2, 0, 2, 0] };

export function chordVoicing(chord) {
  const open = OPEN_VOICINGS[`${chord.pc}:${chord.quality}`];
  if (open) return open.slice();
  const fE = mod12(chord.pc - 4);
  const fA = mod12(chord.pc - 9);
  const useE = fE <= fA;
  const shape = (useE ? SHAPE_E : SHAPE_A)[chord.quality];
  const f = useE ? fE : fA;
  return shape.map((x) => (x === null ? null : x + f));
}

/** MIDI note per string (low to high), null when muted. */
export function voicingMidi(voicing) {
  return voicing.map((f, i) => (f === null ? null : OPEN_STRINGS[i] + f));
}

/** Bass notes in the E2–E3 range: the root and the fifth (below the root if it fits). */
export function bassNotes(chord) {
  const pc = chord.bassPc ?? chord.pc;
  let root = 40;
  while (root % 12 !== pc) root++;
  const fifth = root - 5 >= 40 ? root - 5 : root + 7;
  return { root, fifth };
}

// ---- scales ----
export const inMajorScale = (midi, tonic) => MAJOR_SCALE.includes(mod12(midi - tonic));

/** Move k diatonic steps from midi within the major scale of `tonic`. */
export function scaleStep(midi, k, tonic) {
  const dir = k > 0 ? 1 : -1;
  let n = Math.abs(k);
  let cur = midi;
  while (n > 0) {
    cur += dir;
    if (inMajorScale(cur, tonic)) n--;
  }
  return cur;
}

/** Tonic of the relative major, taking the first chord as "home". */
export const keyMajorTonic = (chord) => (chord.quality === 'min' ? mod12(chord.pc + 3) : chord.pc);

// ---- key & chord detection for imported melodies ----
export function detectKey(notes) {
  const dur = new Array(12).fill(0);
  for (const n of notes) dur[mod12(n.midi)] += Math.min(n.dur, 2);
  let best = null;
  for (let t = 0; t < 12; t++) {
    for (const mode of ['major', 'minor']) {
      const scale = mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
      let score = 0;
      for (const s of scale) score += dur[mod12(t + s)];
      score += 0.5 * dur[t] + 0.25 * dur[mod12(t + scale[2])] + 0.25 * dur[mod12(t + 7)];
      if (!best || score > best.score) best = { tonic: t, mode, score };
    }
  }
  const majorTonic = best.mode === 'major' ? best.tonic : mod12(best.tonic + 3);
  return { tonic: best.tonic, mode: best.mode, majorTonic };
}

const DIATONIC = { 0: 'maj', 2: 'min', 4: 'min', 5: 'maj', 7: 'maj', 9: 'min' };

function chordPrior(root, quality, majorTonic) {
  const rel = mod12(root - majorTonic);
  if (DIATONIC[rel] === quality) return rel === 0 || rel === 5 || rel === 7 ? 0.25 : 0.1;
  if (quality === 'maj' && [10, 2, 4, 9].includes(rel)) return -0.05; // bVII, II, III, VI are common in bluegrass
  return -0.2;
}

function scoreSegment(root, quality, segNotes, prior) {
  const third = mod12(root + (quality === 'maj' ? 4 : 3));
  const fifth = mod12(root + 7);
  let good = 0;
  let bad = 0;
  let total = 0;
  for (const n of segNotes) {
    total += n.w;
    if (n.pc === root) good += n.w;
    else if (n.pc === third) good += n.w * 0.9;
    else if (n.pc === fifth) good += n.w * 0.8;
    else bad += n.w * 0.6;
  }
  if (total === 0) return null;
  return (good - bad) / total + prior;
}

function bestChordFor(segNotes, key, prev) {
  let best = null;
  for (let root = 0; root < 12; root++) {
    for (const quality of ['maj', 'min']) {
      let s = scoreSegment(root, quality, segNotes, chordPrior(root, quality, key.majorTonic));
      if (s === null) return null;
      if (prev && prev.root === root && prev.quality === quality) s += 0.08;
      if (!best || s > best.score) best = { root, quality, score: s };
    }
  }
  return best;
}

function segmentNotes(notes, lo, hi) {
  const out = [];
  for (const n of notes) {
    const a = Math.max(n.start, lo);
    const b = Math.min(n.start + n.dur, hi);
    if (b - a <= 1e-6) continue;
    let w = Math.min(b - a, 1.5);
    if (n.start >= lo - 1e-6 && Math.abs(n.start - Math.round(n.start)) < 1e-6) w *= 1.5;
    out.push({ pc: mod12(n.midi), w });
  }
  return out;
}

/**
 * Guess one or two chords per bar for a melody. Returns an array (one entry per bar)
 * of arrays of chord names, e.g. [['G'], ['C', 'D'], ...].
 */
export function detectChords(notes, { barLen, totalBeats, key }) {
  const k = key || detectKey(notes);
  const flats = FLAT_MAJOR_TONICS.has(k.majorTonic);
  const nBars = Math.max(1, Math.ceil(totalBeats / barLen - 1e-6));
  const nameOf = (c) => pcName(c.root, flats) + (c.quality === 'min' ? 'm' : '');
  const out = [];
  let prev = { root: k.majorTonic, quality: 'maj' };
  for (let b = 0; b < nBars; b++) {
    const lo = b * barLen;
    const hi = lo + barLen;
    const whole = bestChordFor(segmentNotes(notes, lo, hi), k, prev);
    if (!whole) {
      out.push([nameOf(prev)]);
      continue;
    }
    if (b === nBars - 1 && whole.root === k.majorTonic && whole.quality === 'maj') whole.score += 0.3;
    let chosen = [whole];
    if (barLen >= 2) {
      const mid = lo + barLen / 2;
      const a = bestChordFor(segmentNotes(notes, lo, mid), k, prev);
      const c = a && bestChordFor(segmentNotes(notes, mid, hi), k, a);
      if (a && c && (a.root !== c.root || a.quality !== c.quality) && (a.score + c.score) / 2 > whole.score + 0.12) {
        chosen = [a, c];
      }
    }
    out.push(chosen.map(nameOf));
    prev = chosen[chosen.length - 1];
  }
  return out;
}
