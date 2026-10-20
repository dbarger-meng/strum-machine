// Interval trainer logic: interval names and spelling, and the two question types
// ("find the 5th above this note" and "name the interval between these two notes").
// Positions are { string, fret, midi } with strings indexing OPEN_STRINGS (0 = low E).

import { ROOTS, spellFrom, pretty } from './shapes.js?v=19';

// Semitones, full name, scale-degree label, letter steps (for spelling the upper note).
export const INTERVALS = [
  { semis: 1, name: 'Minor 2nd', short: '♭2', steps: 1 },
  { semis: 2, name: 'Major 2nd', short: '2', steps: 1 },
  { semis: 3, name: 'Minor 3rd', short: '♭3', steps: 2 },
  { semis: 4, name: 'Major 3rd', short: '3', steps: 2 },
  { semis: 5, name: 'Perfect 4th', short: '4', steps: 3 },
  { semis: 6, name: 'Tritone', short: '♭5', steps: 4 },
  { semis: 7, name: 'Perfect 5th', short: '5', steps: 4 },
  { semis: 8, name: 'Minor 6th', short: '♭6', steps: 5 },
  { semis: 9, name: 'Major 6th', short: '6', steps: 5 },
  { semis: 10, name: 'Minor 7th', short: '♭7', steps: 6 },
  { semis: 11, name: 'Major 7th', short: '7', steps: 6 },
  { semis: 12, name: 'Octave', short: '8', steps: 7 },
];

export const INTERVAL_SETS = {
  common: { label: 'Common: ♭3, 3, 4, 5, 6, ♭7, octave', semis: [3, 4, 5, 7, 9, 10, 12] },
  all: { label: 'All, minor 2nd to octave', semis: INTERVALS.map((i) => i.semis) },
};

export const intervalBySemis = (semis) => INTERVALS.find((i) => i.semis === semis);

/** The usual name of a note's pitch class (C, D♭, D ... B) as a plain string like 'Db'. */
export const nameOf = (midi) => ROOTS[((midi % 12) + 12) % 12].name;

/** Spell the note `semis` above a note named `fromName` (so the 3rd above D is F♯, not G♭). */
export const spellAbove = (fromName, semis) => spellFrom(fromName, semis, intervalBySemis(semis).steps);

// Spellings that are correct but read badly, which a clean alternative should replace.
const AWKWARD = /𝄪|𝄫|F♭|C♭|E♯|B♯/;
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** The upper note of an interval from `fromName`; the tritone is a ♭5 or a ♯4, whichever reads cleanly. */
export function spellUpper(fromName, semis) {
  const options = (semis === 6 ? [4, 3] : [intervalBySemis(semis).steps]).map((steps) => spellFrom(fromName, semis, steps));
  return options.find((n) => !AWKWARD.test(n)) || options[0];
}

/** Names for two notes `semis` apart, choosing C♯ or D♭ for the lower note so both read cleanly. */
export function spellPair(lowMidi, semis) {
  const pc = ((lowMidi % 12) + 12) % 12;
  const names = [...new Set([ROOTS[pc].name, SHARP_NAMES[pc], FLAT_NAMES[pc]])];
  for (const name of names) {
    const upper = spellUpper(name, semis);
    if (!AWKWARD.test(upper)) return [pretty(name), upper];
  }
  return [pretty(names[0]), spellUpper(names[0], semis)];
}

/** Every position for an exact pitch. */
export const placesOf = (midi, positions) => positions.filter((p) => p.midi === midi);

/** Close enough to see under one hand: within `strings` strings and `frets` frets. */
export const isNearby = (a, b, { strings = 3, frets = 4 } = {}) => Math.abs(a.string - b.string) <= strings && Math.abs(a.fret - b.fret) <= frets;

const pick = (list, rand) => list[Math.floor(rand() * list.length)];

/**
 * "Find the interval": a start position and an interval whose upper note exists on the
 * neck. Returns { start, interval, targetMidi, targets } or null.
 */
export function findQuestion({ positions, semisSet, prev = null, rand = Math.random }) {
  for (let tries = 0; tries < 200; tries++) {
    const start = pick(positions, rand);
    const interval = intervalBySemis(pick(semisSet, rand));
    const targetMidi = start.midi + interval.semis;
    const targets = placesOf(targetMidi, positions);
    if (!targets.length) continue;
    if (prev && prev.start.midi === start.midi && prev.interval.semis === interval.semis && tries < 100) continue;
    return { start, interval, targetMidi, targets };
  }
  return null;
}

/**
 * "Name the interval": two positions, the lower note first. With `nearby`, the two notes sit
 * within a hand's reach. Returns { low, high, interval } or null.
 */
export function nameQuestion({ positions, semisSet, nearby = true, prev = null, rand = Math.random }) {
  for (let tries = 0; tries < 300; tries++) {
    const low = pick(positions, rand);
    const interval = intervalBySemis(pick(semisSet, rand));
    let highs = placesOf(low.midi + interval.semis, positions);
    if (nearby) highs = highs.filter((h) => isNearby(low, h));
    if (!highs.length) continue;
    const high = pick(highs, rand);
    if (prev && prev.low.midi === low.midi && prev.interval.semis === interval.semis && tries < 150) continue;
    return { low, high, interval };
  }
  return null;
}
