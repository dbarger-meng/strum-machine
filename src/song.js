// Song model: chord chart parsing, strum patterns, and turning it all into a timed event list.

import {
  parseChord, transposeChord, chordVoicing, voicingMidi, bassNotes, scaleStep, keyMajorTonic,
} from './music.js?v=4';

export const barLength = (ts) => (ts.num * 4) / ts.den; // length of a bar in quarter-note beats

// ---------- strum cells ----------
export const CELLS = {
  R: { glyph: 'R', name: 'Root bass', key: 'r', help: 'Bass note on the chord root (the "boom")' },
  F: { glyph: '5', name: 'Fifth bass', key: 'f', help: 'Alternate bass note on the fifth of the chord' },
  C: { glyph: 'ch', name: 'Chuck', key: 'c', help: 'Short down-strum on the top four strings' },
  D: { glyph: '↓', name: 'Down strum', key: 'd', help: 'Full down-strum, all strings' },
  U: { glyph: '↑', name: 'Up strum', key: 'u', help: 'Quick up-strum on the top strings' },
  X: { glyph: '×', name: 'Chop', key: 'x', help: 'Muted percussive chop' },
  '.': { glyph: '·', name: 'Rest', key: '.', help: 'Let the last note ring or stay silent' },
};

export const PRESETS = {
  4: [
    { id: 'boom-chuck', name: 'Boom-chuck', cells: 'R.C.F.C.' },
    { id: 'boom-chuck-a', name: 'Boom-chuck-a (with up-strums)', cells: 'R.CUF.CU' },
    { id: 'boom-strum', name: 'Boom-strum (full strums)', cells: 'R.D.F.D.' },
    { id: 'down-up', name: 'Bluegrass down-up', cells: 'R.DU.UDU' },
    { id: 'root-chuck', name: 'Root only boom-chuck', cells: 'R.C.R.C.' },
    { id: 'chop', name: 'Mandolin-style chop (backbeat)', cells: '..X...X.' },
    { id: 'bass-chop', name: 'Bass and chop', cells: 'R.X.F.X.' },
  ],
  3: [
    { id: 'waltz', name: 'Waltz boom-chuck-chuck', cells: 'R.C.C.' },
    { id: 'waltz-5', name: 'Waltz with up-strum', cells: 'R.CUC.' },
    { id: 'waltz-strum', name: 'Waltz strum', cells: 'R.D.D.' },
  ],
  2: [
    { id: 'polka', name: 'Boom-chuck (2/4)', cells: 'R.C.' },
    { id: 'polka-a', name: 'Boom-chuck-a (2/4)', cells: 'R.CU' },
  ],
};

export function genericCells(barLen, sub = 2) {
  const n = Math.max(2, Math.round(barLen * sub));
  const cells = new Array(n).fill('.');
  for (let k = 0; k < barLen; k++) {
    const idx = k * sub;
    if (idx >= n) break;
    cells[idx] = k === 0 ? 'R' : k % 2 === 1 ? 'C' : 'F';
  }
  return cells;
}

export function presetsFor(barLen) {
  if (PRESETS[barLen]) return PRESETS[barLen].map((p) => ({ ...p, cells: [...p.cells] }));
  return [{ id: 'generic', name: 'Boom-chuck', cells: genericCells(barLen, 2) }];
}

export function resampleCells(cells, from, to) {
  if (from === to) return [...cells];
  if (to > from) {
    const f = to / from;
    const out = new Array(cells.length * f).fill('.');
    cells.forEach((c, i) => { out[i * f] = c; });
    return out;
  }
  const f = from / to;
  const out = [];
  for (let i = 0; i < cells.length; i += f) {
    const group = cells.slice(i, i + f);
    out.push(group.find((c) => c !== '.') || '.');
  }
  return out;
}

export function defaultCells(barLen, sub = 2) {
  return resampleCells(presetsFor(barLen)[0].cells, 2, sub);
}

// ---------- chord chart ----------
/**
 * "| G | G C | D |" or one bar per word ("G C D G"). "%" or "-" repeats the previous chord.
 * Returns { bars: [{names:[...]}], bad: [unrecognised tokens] }.
 */
export function parseChart(text) {
  const bars = [];
  const bad = [];
  let prev = null;
  const pushBar = (tokens) => {
    const names = [];
    for (const tok of tokens) {
      if (tok === '%' || tok === '-' || tok === '.') {
        if (prev) names.push(prev);
      } else if (parseChord(tok)) {
        names.push(tok);
      } else {
        bad.push(tok);
      }
    }
    if (!names.length && prev && tokens.length === 0) names.push(prev);
    if (names.length) {
      bars.push({ names });
      prev = names[names.length - 1];
    }
  };
  for (const raw of String(text).replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    if (!line.includes('|')) {
      for (const tok of line.split(/\s+/)) pushBar([tok]);
      continue;
    }
    const parts = line.split('|').map((s) => s.trim());
    parts.forEach((part, i) => {
      if (part === '' && (i === 0 || i === parts.length - 1)) return;
      pushBar(part ? part.split(/[\s,]+/) : []);
    });
  }
  return { bars, bad };
}

export function formatChart(barNames, perLine = 4) {
  const lines = [];
  for (let i = 0; i < barNames.length; i += perLine) {
    lines.push('| ' + barNames.slice(i, i + perLine).map((n) => n.join(' ')).join(' | ') + ' |');
  }
  return lines.join('\n');
}

/** Convert timed chord events (from an import) into chart text. */
export function chordsToChart(chordEvents, totalBeats, barLen, perLine = 4) {
  const nBars = Math.max(1, Math.ceil(totalBeats / barLen - 1e-6));
  const sorted = [...chordEvents].sort((a, b) => a.start - b.start);
  const bars = [];
  let prev = null;
  for (let b = 0; b < nBars; b++) {
    const lo = b * barLen - 1e-6;
    const hi = (b + 1) * barLen - 1e-6;
    const names = [];
    for (const c of sorted) {
      if (c.start >= lo && c.start < hi && names[names.length - 1] !== c.name) {
        if (!names.length && prev && c.start - lo > 0.01 + 1e-6 && prev !== c.name) names.push(prev);
        names.push(c.name);
      }
    }
    if (!names.length && prev) names.push(prev);
    if (!names.length) names.push('C');
    bars.push(names);
    prev = names[names.length - 1];
  }
  return formatChart(bars, perLine);
}

// ---------- events ----------
function runNotes(curRoot, tgtRoot, tonic) {
  return tgtRoot > curRoot
    ? [scaleStep(tgtRoot, -2, tonic), scaleStep(tgtRoot, -1, tonic)]
    : [scaleStep(tgtRoot, 2, tonic), scaleStep(tgtRoot, 1, tonic)];
}

/**
 * Build the list of sound events for one pass through the song.
 * Event: { beat, kind: 'bass'|'strum'|'chop'|'melody', notes?, midi?, dur, vel, ... }
 */
export function buildEvents({
  bars, timeSig, pattern, transpose = 0, flats = false, bassRuns = 'some', swing = 0, melody = null,
}) {
  const barLen = barLength(timeSig);
  const cells = pattern.cells;
  const n = cells.length;
  const stepLen = barLen / n;
  const chordBars = bars.map((b) => b.names.map((nm) => parseChord(transposeChord(nm, transpose, flats))).filter(Boolean));
  const first = chordBars.find((b) => b.length);
  const tonic = first ? keyMajorTonic(first[0]) : 0;
  const hasBass = cells.includes('R') || cells.includes('F');
  const events = [];

  for (let b = 0; b < chordBars.length; b++) {
    const chs = chordBars[b];
    if (!chs.length) continue;
    const next = chordBars[(b + 1) % chordBars.length][0];
    const last = chs[chs.length - 1];
    const lastBass = bassNotes(last).root;
    const nextBass = next ? bassNotes(next).root : lastBass;
    const doRun = hasBass && bassRuns !== 'off' && n >= 4 && nextBass !== lastBass && (bassRuns === 'all' || b % 2 === 1);
    const run = doRun ? runNotes(lastBass, nextBass, tonic) : null;

    for (let i = 0; i < n; i++) {
      const off = i * stepLen;
      const ch = chs[Math.min(chs.length - 1, Math.floor((off / barLen) * chs.length + 1e-9))];
      let beat = b * barLen + off;
      if (Math.abs((off % 1) - 0.5) < 1e-6) beat += swing / 6;

      if (run && i >= n - 2) {
        events.push({ beat, kind: 'bass', notes: [run[i - (n - 2)]], dur: stepLen * 0.95, vel: 0.9 });
        continue;
      }
      const cell = cells[i];
      if (cell === '.') continue;
      const bn = bassNotes(ch);
      const v = voicingMidi(chordVoicing(ch));
      const upTo = (from, to) => v.slice(from, to).filter((x) => x !== null);
      switch (cell) {
        case 'R': events.push({ beat, kind: 'bass', notes: [bn.root], dur: 1, vel: 0.95 }); break;
        case 'F': events.push({ beat, kind: 'bass', notes: [bn.fifth], dur: 1, vel: 0.9 }); break;
        case 'C': events.push({ beat, kind: 'strum', notes: upTo(2, 6), dir: 'down', vel: 0.62, dur: 0.3, spread: 0.008 }); break;
        case 'D': events.push({ beat, kind: 'strum', notes: upTo(0, 6), dir: 'down', vel: 0.75, dur: 0.8, spread: 0.011 }); break;
        case 'U': events.push({ beat, kind: 'strum', notes: upTo(3, 6).reverse(), dir: 'up', vel: 0.45, dur: 0.4, spread: 0.007 }); break;
        case 'X': events.push({ beat, kind: 'chop', notes: upTo(2, 5), vel: 0.7, dur: 0.1 }); break;
        default: break;
      }
    }
  }

  let melodyEnd = 0;
  if (melody && melody.notes) {
    for (const m of melody.notes) {
      events.push({ beat: m.start, kind: 'melody', midi: m.midi + transpose, dur: m.dur, vel: 0.85 });
      melodyEnd = Math.max(melodyEnd, m.start + m.dur);
    }
  }
  events.sort((a, b) => a.beat - b.beat);
  const chartLen = chordBars.length * barLen;
  const melodyLen = Math.ceil(melodyEnd / barLen - 1e-6) * barLen;
  const loopLen = Math.max(chartLen, melodyLen);
  return { events, loopLen, barLen, totalBars: Math.round(loopLen / barLen), chordBars };
}
