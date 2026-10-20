// Rhythm dictation logic: random bars built from beat-sized rhythm cells, the player's answer,
// checking it, and grouping notes into beams for notation.
// Durations are in quarter notes. A note is { dur, tuplet } (tuplet: true for triplet eighths).

const EPS = 1e-6;
const T = 1 / 3;

export const METERS = {
  '4/4': { label: '4/4', barLen: 4, beatLen: 1, num: 4, den: 4 },
  '6/8': { label: '6/8', barLen: 3, beatLen: 1.5, num: 6, den: 8 },
};

/** The note values for each meter, in the order the answer buttons show them. */
export const VALUES = {
  '4/4': [
    { id: 'whole', name: 'Whole', dur: 4 },
    { id: 'half', name: 'Half', dur: 2 },
    { id: 'quarter', name: 'Quarter', dur: 1 },
    { id: 'eighth', name: 'Eighth', dur: 0.5 },
    { id: 'sixteenth', name: '16th', dur: 0.25 },
    { id: 'triplet', name: 'Triplet', dur: 1, tuplet: true },
  ],
  '6/8': [
    { id: 'dottedHalf', name: 'Dotted half', dur: 3 },
    { id: 'dottedQuarter', name: 'Dotted quarter', dur: 1.5 },
    { id: 'quarter', name: 'Quarter', dur: 1 },
    { id: 'eighth', name: 'Eighth', dur: 0.5 },
    { id: 'sixteenth', name: '16th', dur: 0.25 },
  ],
};

// Rhythm cells that fill one beat, and the note values each one needs.
const CELLS = {
  '4/4': [
    [[1], ['quarter']],
    [[0.5, 0.5], ['eighth']],
    [[0.25, 0.25, 0.25, 0.25], ['sixteenth']],
    [[0.5, 0.25, 0.25], ['eighth', 'sixteenth']],
    [[0.25, 0.25, 0.5], ['eighth', 'sixteenth']],
    [[T, T, T], ['triplet']],
  ],
  '6/8': [
    [[1.5], ['dottedQuarter']],
    [[0.5, 0.5, 0.5], ['eighth']],
    [[1, 0.5], ['quarter', 'eighth']],
    [[0.5, 1], ['eighth', 'quarter']],
    [[0.25, 0.25, 0.25, 0.25, 0.25, 0.25], ['sixteenth']],
    [[0.25, 0.25, 0.5, 0.5], ['sixteenth', 'eighth']],
    [[0.5, 0.25, 0.25, 0.5], ['sixteenth', 'eighth']],
    [[0.5, 0.5, 0.25, 0.25], ['sixteenth', 'eighth']],
  ],
};

const note = (dur) => ({ dur, tuplet: Math.abs(dur - T) < EPS });
const pick = (list, rand) => list[Math.floor(rand() * list.length)];
export const sum = (bar) => bar.reduce((t, n) => t + n.dur, 0);

const allowedCells = (meter, allowed) => CELLS[meter].filter(([, needs]) => needs.every((v) => allowed.includes(v)));

/** Whether the chosen note values can fill a bar of this meter. */
export function canFill(meter, allowed) {
  if (allowedCells(meter, allowed).length) return true;
  return meter === '4/4' ? allowed.includes('whole') || allowed.includes('half') : allowed.includes('dottedHalf');
}

/** One random bar using only the allowed note values. */
export function randomBar(meter, allowed, rand = Math.random) {
  const cells = allowedCells(meter, allowed).map(([durs]) => durs);
  const has = (v) => allowed.includes(v);
  const beats = (n) => {
    const out = [];
    for (let i = 0; i < n; i++) out.push(...pick(cells, rand).map(note));
    return out;
  };
  if (meter === '4/4') {
    if (has('whole') && (!cells.length && !has('half') ? true : rand() < 0.12)) return [note(4)];
    const out = [];
    for (let h = 0; h < 2; h++) {
      if (has('half') && (!cells.length || rand() < 0.3)) out.push(note(2));
      else if (cells.length) out.push(...beats(2));
      else out.push(note(2));
    }
    return out;
  }
  if (has('dottedHalf') && (!cells.length || rand() < 0.15)) return [note(3)];
  return cells.length ? beats(2) : [note(3)];
}

/** A dictation: `bars` random bars, with a melody walking around a major pentatonic scale. */
export function randomDictation(meter, allowed, { bars = 4, rand = Math.random } = {}) {
  const scale = [55, 57, 59, 62, 64, 67, 69, 71, 74]; // G major pentatonic, G3 to D5
  let i = 3 + Math.floor(rand() * 3);
  return Array.from({ length: bars }, () => randomBar(meter, allowed, rand).map((n) => {
    i = Math.max(0, Math.min(scale.length - 1, i + pick([-2, -1, -1, 0, 1, 1, 2], rand)));
    return { ...n, midi: scale[i] };
  }));
}

// ---------- the player's answer ----------
export const remaining = (bar, meter) => METERS[meter].barLen - sum(bar);

/**
 * Add a note value to a bar of the answer. Returns the new bar, or a string saying why it does
 * not fit ('full' or 'triplet-beat': a triplet must start on a beat).
 */
export function addValue(bar, valueId, meter) {
  const v = VALUES[meter].find((x) => x.id === valueId);
  if (!v || v.dur > remaining(bar, meter) + EPS) return 'full';
  if (v.tuplet) {
    const at = sum(bar);
    if (Math.abs(at - Math.round(at)) > EPS) return 'triplet-beat';
    return [...bar, note(T), note(T), note(T)];
  }
  return [...bar, note(v.dur)];
}

/** Remove the last thing added (a whole triplet group counts as one). */
export function undoLast(bar) {
  if (!bar.length) return bar;
  return bar[bar.length - 1].tuplet ? bar.slice(0, -3) : bar.slice(0, -1);
}

/** Same rhythm: the same notes at the same times. */
export function sameRhythm(a, b) {
  return a.length === b.length && a.every((n, i) => Math.abs(n.dur - b[i].dur) < EPS);
}

// ---------- notation ----------
/** Groups of note indices to beam together: notes shorter than a quarter inside one beat. */
export function beamGroups(bar, meter) {
  const { beatLen } = METERS[meter];
  const groups = [];
  let at = 0;
  let current = null;
  bar.forEach((n, i) => {
    const beat = Math.floor((at + EPS) / beatLen);
    const endBeat = Math.floor((at + n.dur - EPS) / beatLen);
    const beamable = n.dur < 1 - EPS && beat === endBeat;
    if (beamable && current && current.beat === beat) current.notes.push(i);
    else if (beamable) groups.push((current = { beat, notes: [i] }));
    else current = null;
    at += n.dur;
  });
  return groups.map((g) => g.notes);
}

/** How a note is drawn: head shape, stem, dot, and the number of beams or flags. */
export function noteShape(n) {
  const d = n.dur;
  const dotted = [3, 1.5, 0.75].some((x) => Math.abs(d - x) < EPS);
  const base = dotted ? (d * 2) / 3 : n.tuplet ? 0.5 : d;
  return {
    head: base >= 4 - EPS ? 'noteheadWhole' : base >= 2 - EPS ? 'noteheadHalf' : 'noteheadBlack',
    stem: base < 4 - EPS,
    dotted,
    beams: base <= 0.25 + EPS ? 2 : base <= 0.5 + EPS ? 1 : 0,
  };
}
