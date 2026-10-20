// Triad and scale shapes on the guitar neck, with key-correct note spelling.
// Strings are indices into OPEN_STRINGS (0 = low E ... 5 = high e).

import { OPEN_STRINGS } from './music.js?v=14';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const mod12 = (n) => ((n % 12) + 12) % 12;

/** Roots offered in the menus, spelled the way players usually name the key. */
export const ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
  .map((name, pc) => ({ name, pc }));

const ACC = { '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' };
export const pretty = (name) => name.replace('#', '♯').replace(/b$/, '♭');

/** Spell the note `semis` above `rootName`, `steps` letters above it (a third is 2 steps, a fifth 4). */
export function spellFrom(rootName, semis, steps) {
  const li = LETTERS.indexOf(rootName[0]);
  const rootAcc = rootName.includes('#') ? 1 : rootName.length > 1 && rootName.endsWith('b') ? -1 : 0;
  const rootPc = mod12(LETTER_PC[li] + rootAcc);
  const letter = (li + steps) % 7;
  let acc = mod12(rootPc + semis) - LETTER_PC[letter];
  if (acc > 6) acc -= 12;
  if (acc < -6) acc += 12;
  return LETTERS[letter] + ACC[acc];
}

// ---------- triads ----------
export const TRIADS = {
  major: { label: 'Major', suffix: '', semis: [0, 4, 7], tones: ['R', '3', '5'] },
  minor: { label: 'Minor', suffix: 'm', semis: [0, 3, 7], tones: ['R', '♭3', '5'] },
  dim: { label: 'Diminished', suffix: 'dim', semis: [0, 3, 6], tones: ['R', '♭3', '♭5'] },
  aug: { label: 'Augmented', suffix: 'aug', semis: [0, 4, 8], tones: ['R', '3', '♯5'] },
};

export const STRING_SETS = [
  { id: 'eBG', label: 'e B G', strings: [3, 4, 5] },
  { id: 'BGD', label: 'B G D', strings: [2, 3, 4] },
  { id: 'GDA', label: 'G D A', strings: [1, 2, 3] },
  { id: 'DAE', label: 'D A E', strings: [0, 1, 2] },
];

export const INVERSIONS = ['Root position', '1st inversion', '2nd inversion'];

/**
 * Every close-voiced triad on three adjacent strings, one chord tone per string, spanning at
 * most `maxSpan` frets. Returns shapes sorted up the neck:
 * { notes: [{ string, fret, midi, tone }] (low string first), inversion, low, high }.
 * `tone` is 0 for the root, 1 for the third, 2 for the fifth.
 */
export function triadShapes(rootPc, quality, strings, { maxFret = 15, maxSpan = 4 } = {}) {
  const pcs = TRIADS[quality].semis.map((s) => mod12(rootPc + s));
  const toneOf = (midi) => pcs.indexOf(mod12(midi));
  const options = strings.map((s) => {
    const out = [];
    for (let fret = 0; fret <= maxFret; fret++) {
      const midi = OPEN_STRINGS[s] + fret;
      if (toneOf(midi) >= 0) out.push({ string: s, fret, midi, tone: toneOf(midi) });
    }
    return out;
  });
  const shapes = [];
  for (const a of options[0]) for (const b of options[1]) for (const c of options[2]) {
    const notes = [a, b, c];
    if (new Set(notes.map((n) => n.tone)).size !== 3) continue;
    const fretted = notes.filter((n) => n.fret > 0).map((n) => n.fret);
    const low = Math.min(...notes.map((n) => n.fret));
    const high = Math.max(...notes.map((n) => n.fret));
    if (fretted.length && Math.max(...fretted) - Math.min(...fretted) > maxSpan) continue;
    if (high - low > maxSpan + 1) continue;
    shapes.push({ notes, inversion: a.tone, low, high });
  }
  return shapes.sort((x, y) => x.low - y.low || x.high - y.high);
}

// ---------- scales ----------
export const SCALES = {
  majorPent: { label: 'Major pentatonic', semis: [0, 2, 4, 7, 9], steps: [0, 1, 2, 4, 5], degrees: ['1', '2', '3', '5', '6'] },
  minorPent: { label: 'Minor pentatonic', semis: [0, 3, 5, 7, 10], steps: [0, 2, 3, 4, 6], degrees: ['1', '♭3', '4', '5', '♭7'] },
  blues: { label: 'Blues', semis: [0, 3, 5, 6, 7, 10], steps: [0, 2, 3, 4, 4, 6], degrees: ['1', '♭3', '4', '♭5', '5', '♭7'], base: 'minorPent' },
  major: { label: 'Major', semis: [0, 2, 4, 5, 7, 9, 11], steps: [0, 1, 2, 3, 4, 5, 6], degrees: ['1', '2', '3', '4', '5', '6', '7'] },
  minor: { label: 'Natural minor', semis: [0, 2, 3, 5, 7, 8, 10], steps: [0, 1, 2, 3, 4, 5, 6], degrees: ['1', '2', '♭3', '4', '5', '♭6', '♭7'] },
  mixolydian: { label: 'Mixolydian', semis: [0, 2, 4, 5, 7, 9, 10], steps: [0, 1, 2, 3, 4, 5, 6], degrees: ['1', '2', '3', '4', '5', '6', '♭7'] },
  dorian: { label: 'Dorian', semis: [0, 2, 3, 5, 7, 9, 10], steps: [0, 1, 2, 3, 4, 5, 6], degrees: ['1', '2', '♭3', '4', '5', '6', '♭7'] },
};

/** Note names of a scale, spelled for its key. */
export const scaleNames = (rootName, scale) => SCALES[scale].semis.map((s, i) => spellFrom(rootName, s, SCALES[scale].steps[i]));

/** Every scale note on the neck: [{ string, fret, midi, degree }] (degree indexes the scale). */
export function scaleNotes(rootPc, scale, { maxFret = 15 } = {}) {
  const pcs = SCALES[scale].semis.map((s) => mod12(rootPc + s));
  const out = [];
  for (let s = 0; s < 6; s++) {
    for (let fret = 0; fret <= maxFret; fret++) {
      const midi = OPEN_STRINGS[s] + fret;
      const degree = pcs.indexOf(mod12(midi));
      if (degree >= 0) out.push({ string: s, fret, midi, degree });
    }
  }
  return out;
}

/**
 * Playing positions: start on each scale note on the low E string and climb the scale, two
 * notes per string for pentatonics (the five boxes) and three per string for seven-note scales.
 * The blues scale is the minor pentatonic box plus the flat five wherever it falls inside the
 * box's fret window.
 * Returns positions sorted up the neck: { notes: [...], low, high }.
 */
export function scalePositions(rootPc, scale, { maxFret = 15 } = {}) {
  const base = SCALES[scale].base || scale;
  const def = SCALES[base];
  const perString = def.semis.length === 5 ? 2 : 3;
  const pcs = def.semis.map((s) => mod12(rootPc + s));
  const positions = [];
  for (let p = 0; p < pcs.length; p++) {
    const f0 = mod12(pcs[p] - OPEN_STRINGS[0]);
    for (const start of [f0, f0 + 12]) {
      const notes = [];
      let midi = OPEN_STRINGS[0] + start;
      let ok = true;
      for (let s = 0; s < 6 && ok; s++) {
        for (let k = 0; k < perString; k++) {
          const fret = midi - OPEN_STRINGS[s];
          if (fret < 0 || fret > maxFret) { ok = false; break; }
          notes.push({ string: s, fret, midi, degree: pcs.indexOf(mod12(midi)) });
          do midi++; while (!pcs.includes(mod12(midi)));
        }
      }
      if (!ok) continue;
      positions.push({ notes, low: Math.min(...notes.map((n) => n.fret)), high: Math.max(...notes.map((n) => n.fret)) });
      break;
    }
  }
  if (base !== scale) {
    // Blues: map the box onto the blues scale's degrees and add the flat fives inside the box.
    const blues = SCALES[scale].semis.map((s) => mod12(rootPc + s));
    for (const pos of positions) {
      for (const n of pos.notes) n.degree = blues.indexOf(mod12(n.midi));
      for (let s = 0; s < 6; s++) {
        for (let fret = pos.low; fret <= pos.high; fret++) {
          const midi = OPEN_STRINGS[s] + fret;
          if (fret >= 0 && fret <= maxFret && mod12(midi) === mod12(rootPc + 6) && !pos.notes.some((n) => n.string === s && n.fret === fret)) {
            pos.notes.push({ string: s, fret, midi, degree: blues.indexOf(mod12(midi)) });
          }
        }
      }
      pos.notes.sort((a, b) => a.midi - b.midi || a.string - b.string);
    }
  }
  return positions.sort((a, b) => a.low - b.low);
}
