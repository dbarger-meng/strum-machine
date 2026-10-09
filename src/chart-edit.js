// Chord chart editing: the chord palette for a key, and drag-and-drop edits on a list of bars.
// A chart is an array of bars, each an array of chord names, e.g. [['G'], ['C', 'D']].

import { FLAT_MAJOR_TONICS, mod12, parseChord, pcName } from './music.js?v=1';
import { parseChart, formatChart } from './song.js?v=1';

export const MAX_CHORDS_PER_BAR = 4;

export const CHORD_TYPES = [
  { id: '', name: 'Major' },
  { id: 'm', name: 'Minor' },
  { id: '7', name: 'Seventh' },
  { id: 'm7', name: 'Minor seventh' },
];

// Degree (semitones above the tonic), suffix, Roman numeral. The first six are the diatonic
// chords; the rest are common in bluegrass (V7, the major II and VI, and the flat seven).
const PALETTE = [
  [0, '', 'I'], [5, '', 'IV'], [7, '', 'V'], [7, '7', 'V7'], [9, 'm', 'vi'], [2, 'm', 'ii'],
  [4, 'm', 'iii'], [2, '', 'II'], [4, '', 'III'], [9, '', 'VI'], [10, '', '♭VII'],
];

export const keyUsesFlats = (tonic) => FLAT_MAJOR_TONICS.has(mod12(tonic));

/** Chips for the palette in a major key: [{ name, roman }]. */
export function paletteFor(tonic) {
  const flats = keyUsesFlats(tonic);
  return PALETTE.map(([deg, suffix, roman]) => ({
    name: pcName(tonic + deg, flats || roman === '♭VII') + suffix,
    roman,
  }));
}

export const chordName = (rootPc, type, flats = false) => pcName(rootPc, flats) + type;

export const barsFromChart = (text) => parseChart(text).bars.map((b) => [...b.names]);
export const chartFromBars = (bars) => formatChart(bars.filter((b) => b.length));

/** The major key a chart is in, taken from its first chord (G when there is none). */
export function chartKey(bars) {
  const first = bars.find((b) => b.length);
  const c = first && parseChord(first[0]);
  if (!c) return 7;
  return c.quality === 'min' ? mod12(c.pc + 3) : c.pc;
}

/**
 * Apply one drop and return a new list of bars.
 * source: { kind: 'palette', name } | { kind: 'chord', bar, idx, copy? }
 * target: { kind: 'chord', bar, idx }  replace that chord
 *         { kind: 'bar', bar }         make the whole bar this chord
 *         { kind: 'split', bar }       add the chord to the end of the bar
 *         { kind: 'new' }              add a new bar at the end
 *         { kind: 'trash' }            remove the dragged chord
 * A chord moved out of a bar leaves it; a bar left with no chords is removed.
 */
export function applyDrop(bars, source, target) {
  const out = bars.map((b) => [...b]);
  let name = source.name;
  if (source.kind === 'chord') {
    const from = out[source.bar];
    if (!from || from[source.idx] === undefined) return out;
    name = from[source.idx];
    if (target.kind === 'chord' && target.bar === source.bar && target.idx === source.idx) return out;
    if (!source.copy) from[source.idx] = null;
  }
  if (!name && target.kind !== 'trash') return bars.map((b) => [...b]);
  switch (target.kind) {
    case 'chord':
      if (out[target.bar] && target.idx < out[target.bar].length) out[target.bar][target.idx] = name;
      break;
    case 'bar':
      if (out[target.bar]) out[target.bar] = [name];
      break;
    case 'split': {
      const bar = out[target.bar];
      if (bar && bar.filter((c) => c !== null).length < MAX_CHORDS_PER_BAR) bar.push(name);
      else return bars.map((b) => [...b]);
      break;
    }
    case 'new':
      out.push([name]);
      break;
    case 'trash':
      if (source.kind !== 'chord') return bars.map((b) => [...b]);
      break;
    default:
      return bars.map((b) => [...b]);
  }
  return out.map((b) => b.filter((c) => c !== null)).filter((b) => b.length);
}

export const removeBar = (bars, i) => bars.filter((_, k) => k !== i).map((b) => [...b]);
