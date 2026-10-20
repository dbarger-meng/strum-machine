// Fretboard trainer logic: which note each string and fret gives, how that note is written on a
// treble staff, and checking an answer. Guitar music is written an octave above how it sounds,
// so written middle C (C4) is the C on the A string, 3rd fret.

import { OPEN_STRINGS } from './music.js?v=17';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_SPELL = [['C', ''], ['C', '#'], ['D', ''], ['D', '#'], ['E', ''], ['F', ''], ['F', '#'], ['G', ''], ['G', '#'], ['A', ''], ['A', '#'], ['B', '']];
const FLAT_SPELL = [['C', ''], ['D', 'b'], ['D', ''], ['E', 'b'], ['E', ''], ['F', ''], ['G', 'b'], ['G', ''], ['A', 'b'], ['A', ''], ['B', 'b'], ['B', '']];

/** Strings from high to low, the way tab and most fretboard diagrams show them. */
export const STRINGS = OPEN_STRINGS.map((open, i) => ({ index: i, open, name: ['E', 'A', 'D', 'G', 'B', 'e'][i] })).reverse();

export const isNatural = (midi) => [0, 2, 4, 5, 7, 9, 11].includes(((midi % 12) + 12) % 12);

/** Every playable position on the chosen strings (indices into OPEN_STRINGS) and frets. */
export function positionsFor({ strings = [0, 1, 2, 3, 4, 5], minFret = 0, maxFret = 12 } = {}) {
  const out = [];
  for (const s of strings) for (let fret = minFret; fret <= maxFret; fret++) out.push({ string: s, fret, midi: OPEN_STRINGS[s] + fret });
  return out;
}

/** How a written pitch is spelled: letter, accidental ('', '#' or 'b') and octave (C4 = middle C). */
export function spell(writtenMidi, flat = false) {
  const pc = ((writtenMidi % 12) + 12) % 12;
  const [letter, accidental] = (flat ? FLAT_SPELL : SHARP_SPELL)[pc];
  const octave = Math.floor((writtenMidi - NATURAL_PC[letter] - (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0)) / 12) - 1;
  return { letter, accidental, octave };
}

/** Staff position in half-spaces above the bottom line (E4): lines are the even numbers 0 to 8. */
export const staffStep = ({ letter, octave }) => LETTERS.indexOf(letter) + 7 * octave - (2 + 7 * 4);

/** Ledger lines a note needs (their staff steps). */
export function ledgerLines(step) {
  const out = [];
  for (let s = -2; s >= step; s -= 2) out.push(s);
  for (let s = 10; s <= step; s += 2) out.push(s);
  return out;
}

export const noteLabel = ({ letter, accidental, octave }) => `${letter}${accidental === '#' ? '♯' : accidental === 'b' ? '♭' : ''}${octave}`;

/**
 * Pick the next note to find. Returns { midi (sounding), written: spelling, step }.
 * `rand` is injectable for tests. Avoids repeating the previous pitch when there is a choice.
 */
export function nextQuestion({ positions, naturalsOnly = true, prev = null, rand = Math.random }) {
  let pool = [...new Set(positions.map((p) => p.midi))];
  if (naturalsOnly) pool = pool.filter(isNatural);
  if (pool.length > 1 && prev) pool = pool.filter((m) => m !== prev.midi);
  if (!pool.length) return null;
  const midi = pool[Math.floor(rand() * pool.length)];
  const written = spell(midi + 12, !isNatural(midi) && rand() < 0.5);
  return { midi, written, step: staffStep(written) };
}

const samePitch = (a, b, anyOctave) => (anyOctave ? ((a - b) % 12 + 12) % 12 === 0 : a === b);

export const isCorrect = (question, position, anyOctave = false) => samePitch(OPEN_STRINGS[position.string] + position.fret, question.midi, anyOctave);

/** Every shown position that answers the question. */
export const answersFor = (question, positions, anyOctave = false) => positions.filter((p) => samePitch(p.midi, question.midi, anyOctave));

export const positionKey = (p) => `${p.string}:${p.fret}`;

/**
 * Judge one tap when every place the note is played must be found.
 * targets: answersFor(...); found: Set of positionKey()s already found (updated in place).
 * Returns 'wrong', 'again' (a place already found), 'found' (a new place, more to go) or 'done'.
 */
export function judgeTap(question, targets, found, position, anyOctave = false) {
  if (!isCorrect(question, position, anyOctave)) return 'wrong';
  const key = positionKey(position);
  if (found.has(key)) return 'again';
  found.add(key);
  return targets.every((t) => found.has(positionKey(t))) ? 'done' : 'found';
}
