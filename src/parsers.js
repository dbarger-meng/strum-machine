// Importers: ASCII guitar tab, ABC, MusicXML (.xml/.musicxml/.mxl) and MIDI.
// Every parser returns { format, title, notes:[{midi,start,dur}], chords:[{start,name}],
//   timeSig:{num,den}, tempo, key, totalBeats, parts, warnings } with times in quarter-note beats.

import { parseChord, detectKey, mod12 } from './music.js';

const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const keyOf = (midi, start) => `${midi}@${Math.round(start * 1e4)}`;

// ---------- shared helpers ----------
export function mergeTies(notes) {
  notes.sort((a, b) => a.start - b.start || a.midi - b.midi);
  const byKey = new Map(notes.map((n) => [keyOf(n.midi, n.start), n]));
  const dead = new Set();
  for (const n of notes) {
    if (dead.has(n)) continue;
    let cur = n;
    while (cur.tieNext) {
      const nx = byKey.get(keyOf(cur.midi, cur.start + cur.dur));
      if (!nx || nx === cur || dead.has(nx)) break;
      cur.dur += nx.dur;
      cur.tieNext = nx.tieNext;
      dead.add(nx);
    }
  }
  return notes.filter((n) => !dead.has(n)).map(({ midi, start, dur }) => ({ midi, start, dur }));
}

/** Keep only the highest note at each onset. */
export function topVoice(notes) {
  const best = new Map();
  for (const n of notes) {
    const k = Math.round(n.start * 1e4);
    const cur = best.get(k);
    if (!cur || n.midi > cur.midi) best.set(k, n);
  }
  return [...best.values()].sort((a, b) => a.start - b.start);
}

/** Unroll repeats and first/second endings. measures: {len, repeatStart, repeatEnd, endings} */
export function expandMeasures(ms) {
  const out = [];
  let i = 0;
  let start = 0;
  let pass = 1;
  let guard = 0;
  while (i < ms.length && guard++ < 20000) {
    const m = ms[i];
    if (m.repeatStart && i !== start) { start = i; pass = 1; }
    if (m.endings && !m.endings.includes(pass)) { i++; continue; }
    out.push(m);
    if (m.repeatEnd) {
      if (pass === 1) { pass = 2; i = start; continue; }
      pass = 1;
      start = i + 1;
    }
    i++;
  }
  return out;
}

export function layoutMeasures(measures) {
  const order = expandMeasures(measures);
  let t = 0;
  const notes = [];
  const chords = [];
  for (const m of order) {
    for (const n of m.notes) notes.push({ midi: n.midi, start: t + n.off, dur: n.dur, tieNext: !!n.tieNext });
    for (const c of m.chords) chords.push({ start: t + c.off, name: c.name });
    t += m.len;
  }
  return { notes: mergeTies(notes), chords, totalBeats: t };
}

function finish(r) {
  r.warnings = r.warnings || [];
  r.parts = r.parts || [];
  if (!r.notes.length) throw new Error('No notes were found in that file.');
  const end = r.notes.reduce((m, n) => Math.max(m, n.start + n.dur), 0);
  r.totalBeats = Math.max(r.totalBeats || 0, end);
  r.key = r.key || detectKey(r.notes);
  return r;
}

// ---------- ASCII guitar tab ----------
const DEFAULT_TUNING = [64, 59, 55, 50, 45, 40]; // top line first

function isTabLine(line) {
  const t = line.trim();
  if (t.length < 5) return false;
  if (!/^[A-Ga-g]?[#b]?\s*[|:]?[-0-9|hpbrs/\\~^()xX*.<>=\sv]*$/.test(t)) return false;
  return (t.match(/-/g) || []).length >= 3;
}

export function parseTab(text, opts = {}) {
  const timeSig = opts.timeSig || { num: 4, den: 4 };
  const beatsPerBar = (timeSig.num * 4) / timeSig.den;
  const mode = opts.mode || 'bar'; // 'bar' fits each bar to the time signature; 'fixed' uses opts.step beats per column
  const step = opts.step || 0.5;
  const capo = opts.capo || 0;
  const lines = text.replace(/\r/g, '').split('\n');
  const warnings = [];

  const systems = [];
  let i = 0;
  while (i < lines.length) {
    if (!isTabLine(lines[i])) { i++; continue; }
    let j = i;
    while (j < lines.length && isTabLine(lines[j])) j++;
    const run = j - i;
    for (let c = 0; c + 6 <= run; c += 6) {
      systems.push({ at: i + c, lines: lines.slice(i + c, i + c + 6), above: c === 0 ? lines[i - 1] : undefined });
    }
    if (run % 6) warnings.push(`Skipped ${run % 6} tab line(s) that did not form a full six-string staff.`);
    i = j;
  }
  if (!systems.length) throw new Error('No guitar tab found. A tab needs six lines, one per string, like e|---0---2---|');

  const notes = [];
  const chords = [];
  let barStart = 0;

  for (const sys of systems) {
    const prefixes = [];
    const labels = [];
    const contents = sys.lines.map((l) => {
      const m = /^\s*([A-Ga-g][#b]?)?\s*[|:]?/.exec(l);
      prefixes.push(m[0].length);
      labels.push(m[1] || null);
      return l.slice(m[0].length);
    });
    const tuning = DEFAULT_TUNING.map((d, s) => {
      if (!labels[s]) return d + capo;
      const pc = mod12(LETTER[labels[s][0].toUpperCase()] + (labels[s][1] === '#' ? 1 : labels[s][1] === 'b' ? -1 : 0));
      for (let delta = 0; delta <= 6; delta++) {
        if (mod12(d + delta) === pc) return d + delta + capo;
        if (mod12(d - delta) === pc) return d - delta + capo;
      }
      return d + capo;
    });
    const W = Math.max(...contents.map((c) => c.length));
    const at = (s, x) => contents[s][x] || '-';
    const isBar = (x) => { let c = 0; for (let s = 0; s < 6; s++) if (at(s, x) === '|') c++; return c >= 5; };

    const segments = [];
    let segStart = 0;
    for (let x = 0; x <= W; x++) {
      if (x === W || isBar(x)) {
        if (x > segStart) {
          let any = false;
          for (let s = 0; s < 6 && !any; s++) for (let y = segStart; y < x; y++) if (/[-\d]/.test(at(s, y))) { any = true; break; }
          if (any) segments.push([segStart, x]);
        }
        segStart = x + 1;
      }
    }

    const segInfo = [];
    for (const [a, b] of segments) {
      const onsets = [];
      for (let s = 0; s < 6; s++) {
        for (let x = a; x < b; x++) {
          if (!/\d/.test(at(s, x))) continue;
          let numStr = at(s, x);
          if (x + 1 < b && /\d/.test(at(s, x + 1))) numStr += at(s, x + 1);
          onsets.push({ col: x, s, fret: parseInt(numStr, 10) });
          x += numStr.length - 1;
        }
      }
      let pad = 0;
      if (mode === 'bar' && onsets.length && Math.min(...onsets.map((o) => o.col)) > a) pad = 1;
      const width = b - a;
      const len = mode === 'bar' ? beatsPerBar : width * step;
      const timeOf = (col) => {
        let t = mode === 'bar' ? ((col - a - pad) / Math.max(1, width - pad)) * beatsPerBar : (col - a) * step;
        const snap = Math.round(t * 4) / 4;
        if (Math.abs(t - snap) <= 0.1) t = snap;
        return Math.max(0, t);
      };
      segInfo.push({ a, b, start: barStart, len, timeOf });
      const times = [...new Set(onsets.map((o) => timeOf(o.col)))].sort((p, q) => p - q);
      for (const o of onsets) {
        const t = timeOf(o.col);
        const nextT = times.find((x) => x > t + 1e-6);
        const dur = Math.min(2, Math.max(0.125, (nextT === undefined ? len : nextT) - t));
        const midi = tuning[o.s] + o.fret;
        if (o.fret <= 30) notes.push({ midi, start: barStart + t, dur });
      }
      barStart += len;
    }

    if (sys.above && sys.above.trim()) {
      const toks = [...sys.above.matchAll(/\S+/g)];
      if (toks.length && toks.every((m) => parseChord(m[0]))) {
        for (const m of toks) {
          const col = m.index - prefixes[0];
          const seg = segInfo.find((g) => col >= g.a && col <= g.b) || (col < (segInfo[0] ? segInfo[0].a : 0) ? segInfo[0] : null);
          if (seg) chords.push({ start: seg.start + seg.timeOf(Math.max(col, seg.a)), name: m[0] });
        }
      }
    }
  }

  return finish({
    format: 'tab', title: 'Guitar tab', notes: notes.sort((p, q) => p.start - q.start), chords,
    timeSig, tempo: null, key: null, totalBeats: barStart, warnings,
  });
}

// ---------- ABC ----------
const MAJOR_FIFTHS = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7 };
const MODE_FIFTHS = { major: 0, ionian: 0, mixolydian: -1, dorian: -2, minor: -3, aeolian: -3, phrygian: -4, lydian: 1, locrian: -5 };
const SHARP_ORDER = 'FCGDAEB';
const FLAT_ORDER = 'BEADGCF';

function abcKey(str) {
  const m = /^\s*([A-G][#b]?)\s*([A-Za-z]*)/.exec(str);
  if (!m) return { fifths: 0, majorTonic: 0 };
  const word = m[2].toLowerCase();
  let mode = 'major';
  if (word.startsWith('mix')) mode = 'mixolydian';
  else if (word.startsWith('dor')) mode = 'dorian';
  else if (word.startsWith('lyd')) mode = 'lydian';
  else if (word.startsWith('phr')) mode = 'phrygian';
  else if (word.startsWith('loc')) mode = 'locrian';
  else if (word.startsWith('aeo')) mode = 'aeolian';
  else if (word.startsWith('maj') || word.startsWith('ion')) mode = 'major';
  else if (word.startsWith('m')) mode = 'minor';
  let base = MAJOR_FIFTHS[m[1]];
  if (base === undefined) {
    const pc = mod12(LETTER[m[1][0]] + (m[1][1] === '#' ? 1 : -1));
    base = (pc * 7) % 12;
    if (base > 6) base -= 12;
  }
  const fifths = base + MODE_FIFTHS[mode];
  return { fifths, majorTonic: mod12(fifths * 7), mode };
}

function keyAccidentals(fifths) {
  const acc = {};
  if (fifths > 0) for (let i = 0; i < fifths && i < 7; i++) acc[SHARP_ORDER[i]] = 1;
  if (fifths < 0) for (let i = 0; i < -fifths && i < 7; i++) acc[FLAT_ORDER[i]] = -1;
  return acc;
}

function abcFactor(str) {
  const m = /^(\d*)(\/*)(\d*)/.exec(str);
  const a = m[1] ? +m[1] : 1;
  if (!m[2]) return a;
  if (m[3]) return a / +m[3];
  return a / Math.pow(2, m[2].length);
}

export function parseABC(text) {
  const all = text.replace(/\r/g, '').split('\n');
  let startIdx = all.findIndex((l) => /^X:/.test(l));
  if (startIdx < 0) startIdx = 0;
  const tune = [];
  let started = false;
  for (let i = startIdx; i < all.length; i++) {
    if (!all[i].trim() && started && tune.length) break;
    tune.push(all[i]);
    if (/^K:/.test(all[i])) started = true;
  }

  let title = '';
  let meter = { num: 4, den: 4 };
  let unit = null; // in quarter-note beats
  let tempo = null;
  let key = { fifths: 0, majorTonic: 0 };
  let acc = {};
  const barLen = () => (meter.num * 4) / meter.den;
  const defaultUnit = () => (meter.num / meter.den < 0.75 ? 0.25 : 0.5);

  const applyField = (letter, val) => {
    if (letter === 'T' && !title) title = val.trim();
    else if (letter === 'M') {
      const v = val.trim();
      if (v === 'C') meter = { num: 4, den: 4 };
      else if (v === 'C|') meter = { num: 2, den: 2 };
      else { const m = /(\d+)\s*\/\s*(\d+)/.exec(v); if (m) meter = { num: +m[1], den: +m[2] }; }
    } else if (letter === 'L') {
      const m = /(\d+)\s*\/\s*(\d+)/.exec(val);
      if (m) unit = (4 * +m[1]) / +m[2];
    } else if (letter === 'Q') {
      const m = /(?:(\d+)\s*\/\s*(\d+)\s*=\s*)?(\d+)/.exec(val);
      if (m) tempo = m[1] ? +m[3] * (+m[1] / +m[2]) * 4 : +m[3];
    } else if (letter === 'K') {
      key = abcKey(val);
      acc = keyAccidentals(key.fifths);
    }
  };

  let bodyStart = tune.length;
  for (let i = 0; i < tune.length; i++) {
    const m = /^([A-Za-z]):\s*(.*)$/.exec(tune[i]);
    if (!m) continue;
    applyField(m[1], m[2]);
    if (m[1] === 'K') { bodyStart = i + 1; break; }
  }
  if (unit === null) unit = defaultUnit();

  const measures = [];
  let cur = { notes: [], chords: [], len: 0, repeatStart: false, repeatEnd: false, endings: null };
  let cursor = 0;
  let barAcc = {};
  let currentEnding = null;
  let lastEv = null;
  let lastNote = null;
  let broken = 1;
  let tupLeft = 0;
  let tupMult = 1;

  const finalizeMeasure = () => {
    if (!cur.notes.length && cursor <= 1e-9) return false;
    if (!measures.length && cursor < barLen() - 1e-3) {
      const pad = barLen() - cursor;
      cur.notes.forEach((n) => { n.off += pad; });
      cur.chords.forEach((c) => { c.off += pad; });
    }
    cur.len = barLen();
    cur.endings = currentEnding;
    measures.push(cur);
    cur = { notes: [], chords: [], len: 0, repeatStart: false, repeatEnd: false, endings: null };
    cursor = 0;
    barAcc = {};
    lastNote = null;
    return true;
  };

  const parseEnding = (str) => {
    const out = [];
    for (const part of str.split(',')) {
      const r = /^(\d+)-(\d+)$/.exec(part);
      if (r) for (let k = +r[1]; k <= +r[2]; k++) out.push(k);
      else if (/^\d+$/.test(part)) out.push(+part);
    }
    return out;
  };

  const notePitch = (accStr, letter, marks) => {
    const upper = letter.toUpperCase();
    let midi = (letter === upper ? 60 : 72) + LETTER[upper];
    for (const ch of marks) midi += ch === "'" ? 12 : -12;
    const k = letter + marks;
    let a;
    if (accStr) {
      a = accStr === '^' ? 1 : accStr === '^^' ? 2 : accStr === '_' ? -1 : accStr === '__' ? -2 : 0;
      barAcc[k] = a;
    } else if (k in barAcc) a = barAcc[k];
    else a = acc[upper] || 0;
    return midi + a;
  };

  const NOTE_RE = /^(\^\^|__|\^|_|=)?([A-Ga-g])([',]*)(\d*\/*\d*)/;

  for (let li = bodyStart; li < tune.length; li++) {
    const s = tune[li];
    if (/^[A-Za-z]:/.test(s)) {
      const m = /^([A-Za-z]):\s*(.*)$/.exec(s);
      if ('KML'.includes(m[1])) applyField(m[1], m[2]);
      continue;
    }
    if (/^%/.test(s)) continue;
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === ' ' || c === '\t' || c === '\\') { i++; continue; }
      if (c === '%') break;
      if (c === '"') {
        const j = s.indexOf('"', i + 1);
        if (j < 0) break;
        const txt = s.slice(i + 1, j).trim();
        if (/^[A-G]/.test(txt) && parseChord(txt)) cur.chords.push({ off: cursor, name: txt });
        i = j + 1;
        continue;
      }
      if (c === '!') { const j = s.indexOf('!', i + 1); i = j < 0 ? s.length : j + 1; continue; }
      if (c === '{') { const j = s.indexOf('}', i); i = j < 0 ? s.length : j + 1; continue; }
      if (c === '(') {
        const m = /^\((\d)(?::(\d)?(?::(\d)?)?)?/.exec(s.slice(i));
        if (m) {
          const p = +m[1];
          const q = m[2] ? +m[2] : [3, 2, 3, 2, 2, 2, 3, 2][p - 2] || 2; // (2 (3 (4 ... (9 per the ABC spec
          tupLeft = m[3] ? +m[3] : p;
          tupMult = q / p;
          i += m[0].length;
        } else i++;
        continue;
      }
      if (c === '-') { if (lastNote) lastNote.tieNext = true; i++; continue; }
      if (c === '>' || c === '<') {
        let k = 0;
        while (s[i] === c) { k++; i++; }
        if (lastEv) {
          const small = Math.pow(2, -k);
          const prevF = c === '>' ? 2 - small : small;
          cursor -= lastEv.dur;
          lastEv.dur *= prevF;
          cursor += lastEv.dur;
          broken = c === '>' ? small : 2 - small;
        }
        continue;
      }
      if (c === '[') {
        const rest = s.slice(i);
        let m = /^\[(\d+(?:[,-]\d+)*)/.exec(rest);
        if (m && !/^\[\d+[A-Ga-g]/.test(rest)) { currentEnding = parseEnding(m[1]); i += m[0].length; continue; }
        if (/^\[[A-Za-z]:/.test(rest)) {
          const j = s.indexOf(']', i);
          const f = s.slice(i + 1, j < 0 ? s.length : j);
          applyField(f[0], f.slice(2));
          i = j < 0 ? s.length : j + 1;
          continue;
        }
        if (s[i + 1] !== '|') {
          // chord of notes [CEG]2
          const j = s.indexOf(']', i);
          if (j < 0) break;
          const inner = s.slice(i + 1, j);
          let k = 0;
          const group = [];
          let firstFactor = null;
          while (k < inner.length) {
            if (inner[k] === ' ') { k++; continue; }
            const nm = NOTE_RE.exec(inner.slice(k));
            if (!nm) { k++; continue; }
            group.push(notePitch(nm[1], nm[2], nm[3]));
            if (firstFactor === null) firstFactor = abcFactor(nm[4]);
            k += nm[0].length;
          }
          i = j + 1;
          const om = /^(\d*\/*\d*)/.exec(s.slice(i));
          i += om[0].length;
          const dur = unit * (firstFactor || 1) * abcFactor(om[1]) * broken * (tupLeft > 0 ? tupMult : 1);
          broken = 1;
          if (tupLeft > 0) tupLeft--;
          for (const midi of group) cur.notes.push({ midi, off: cursor, dur });
          lastEv = { dur };
          lastNote = null;
          cursor += dur;
          continue;
        }
      }
      if (c === '|' || c === ':' || c === ']' || (c === '[' && s[i + 1] === '|')) {
        const m = /^(?:\[\||[|:\]])[|:\]]*/.exec(s.slice(i));
        const tok = m[0];
        i += tok.length;
        const repeatEnd = tok.startsWith(':');
        const repeatStart = tok.length > 1 && tok.endsWith(':');
        finalizeMeasure();
        if (repeatEnd && measures.length) measures[measures.length - 1].repeatEnd = true;
        if (repeatStart) { cur.repeatStart = true; currentEnding = null; }
        const em = /^(\d+(?:[,-]\d+)*)/.exec(s.slice(i));
        if (em) { currentEnding = parseEnding(em[1]); i += em[0].length; }
        continue;
      }
      if (c === 'z' || c === 'x') {
        const m = /^[zx](\d*\/*\d*)/.exec(s.slice(i));
        const dur = unit * abcFactor(m[1]) * broken * (tupLeft > 0 ? tupMult : 1);
        broken = 1;
        if (tupLeft > 0) tupLeft--;
        cursor += dur;
        lastEv = { dur };
        lastNote = null;
        i += m[0].length;
        continue;
      }
      if (c === 'Z') {
        const m = /^Z(\d*)/.exec(s.slice(i));
        i += m[0].length;
        finalizeMeasure();
        for (let k = 0; k < (+m[1] || 1); k++) measures.push({ notes: [], chords: [], len: barLen(), repeatStart: false, repeatEnd: false, endings: currentEnding });
        continue;
      }
      const nm = NOTE_RE.exec(s.slice(i));
      if (nm) {
        const midi = notePitch(nm[1], nm[2], nm[3]);
        const dur = unit * abcFactor(nm[4]) * broken * (tupLeft > 0 ? tupMult : 1);
        broken = 1;
        if (tupLeft > 0) tupLeft--;
        const note = { midi, off: cursor, dur, tieNext: false };
        cur.notes.push(note);
        lastNote = note;
        lastEv = note;
        cursor += dur;
        i += nm[0].length;
        continue;
      }
      i++; // decorations (~ . u v H T L M O P S ) and anything unknown
    }
  }
  finalizeMeasure();

  const laid = layoutMeasures(measures);
  return finish({
    format: 'abc', title, notes: laid.notes, chords: laid.chords, timeSig: meter, tempo,
    key: { majorTonic: key.majorTonic, mode: key.mode }, totalBeats: laid.totalBeats, warnings: [],
  });
}

// ---------- tiny XML parser (for MusicXML) ----------
function parseXML(src) {
  const root = { name: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  const decode = (s) => s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (m, e) => {
    if (e === 'lt') return '<';
    if (e === 'gt') return '>';
    if (e === 'amp') return '&';
    if (e === 'quot') return '"';
    if (e === 'apos') return "'";
    return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  });
  const n = src.length;
  let i = 0;
  const bad = () => { throw new Error('That file is not valid MusicXML.'); };
  while (i < n) {
    if (src[i] !== '<') {
      const j = src.indexOf('<', i);
      const end = j < 0 ? n : j;
      const t = src.slice(i, end);
      if (t.trim()) top().text += decode(t);
      i = end;
      continue;
    }
    if (src.startsWith('<!--', i)) { const j = src.indexOf('-->', i); if (j < 0) bad(); i = j + 3; continue; }
    if (src.startsWith('<![CDATA[', i)) { const j = src.indexOf(']]>', i); if (j < 0) bad(); top().text += src.slice(i + 9, j); i = j + 3; continue; }
    if (src.startsWith('<?', i)) { const j = src.indexOf('?>', i); if (j < 0) bad(); i = j + 2; continue; }
    if (src.startsWith('<!', i)) {
      let depth = 0;
      let j = i;
      while (j < n) {
        const ch = src[j];
        if (ch === '[') depth++;
        else if (ch === ']') depth--;
        else if (ch === '>' && depth <= 0) break;
        j++;
      }
      i = j + 1;
      continue;
    }
    if (src[i + 1] === '/') {
      const j = src.indexOf('>', i);
      if (j < 0) bad();
      if (stack.length > 1) stack.pop();
      i = j + 1;
      continue;
    }
    let j = i + 1;
    let quote = null;
    while (j < n) {
      const ch = src[j];
      if (quote) { if (ch === quote) quote = null; } else if (ch === '"' || ch === "'") quote = ch; else if (ch === '>') break;
      j++;
    }
    if (j >= n) bad();
    let raw = src.slice(i + 1, j);
    const selfClose = raw.endsWith('/');
    if (selfClose) raw = raw.slice(0, -1);
    const name = /^[^\s]+/.exec(raw)[0];
    const attrs = {};
    for (const m of raw.slice(name.length).matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[m[1]] = decode(m[2] ?? m[3]);
    const node = { name, attrs, children: [], text: '' };
    top().children.push(node);
    if (!selfClose) stack.push(node);
    i = j + 1;
  }
  return root;
}

const child = (node, name) => (node ? node.children.find((c) => c.name === name) : undefined);
const kids = (node, name) => (node ? node.children.filter((c) => c.name === name) : []);
const txt = (node) => (node ? node.text.trim() : '');
const num = (node, fallback = 0) => { const v = parseFloat(txt(node)); return Number.isFinite(v) ? v : fallback; };

const KIND = {
  major: '', minor: 'm', dominant: '7', 'major-seventh': 'maj7', 'minor-seventh': 'm7', diminished: 'dim',
  augmented: 'aug', 'suspended-fourth': 'sus4', 'suspended-second': 'sus2', 'major-sixth': '6', 'minor-sixth': 'm6',
  'dominant-ninth': '9', 'half-diminished': 'm7b5', 'diminished-seventh': 'dim7', power: '5', none: '', 'dominant-seventh': '7',
};

function xmlPitchName(step, alter) {
  const a = Math.round(alter || 0);
  return step + (a > 0 ? '#'.repeat(a) : a < 0 ? 'b'.repeat(-a) : '');
}

function readPart(part) {
  let divisions = 1;
  let meter = { num: 4, den: 4 };
  let fifths = 0;
  let mode = 'major';
  let tempo = null;
  let currentEnding = null;
  const measures = [];
  const barLen = () => (meter.num * 4) / meter.den;

  kids(part, 'measure').forEach((mn, mi) => {
    const m = { len: 0, notes: [], chords: [], repeatStart: false, repeatEnd: false, endings: null };
    let cursor = 0;
    let lastStart = 0;
    let maxEnd = 0;
    let stopEnding = false;
    for (const el of mn.children) {
      if (el.name === 'attributes') {
        const d = child(el, 'divisions');
        if (d) divisions = num(d, divisions) || 1;
        const t = child(el, 'time');
        if (t && child(t, 'beats')) meter = { num: num(child(t, 'beats'), 4), den: num(child(t, 'beat-type'), 4) };
        const k = child(el, 'key');
        if (k && child(k, 'fifths')) { fifths = num(child(k, 'fifths'), 0); mode = txt(child(k, 'mode')) || 'major'; }
      } else if (el.name === 'note') {
        if (child(el, 'grace')) continue;
        const dur = num(child(el, 'duration'), 0);
        const isChord = !!child(el, 'chord');
        const start = isChord ? lastStart : cursor;
        if (!isChord) { lastStart = cursor; cursor += dur; }
        const p = child(el, 'pitch');
        if (p && !child(el, 'rest')) {
          const step = txt(child(p, 'step'));
          const midi = (num(child(p, 'octave'), 4) + 1) * 12 + LETTER[step] + Math.round(num(child(p, 'alter'), 0));
          const tieNext = kids(el, 'tie').some((t) => t.attrs.type === 'start');
          m.notes.push({ midi, off: start / divisions, dur: dur / divisions, tieNext });
        }
        maxEnd = Math.max(maxEnd, cursor);
      } else if (el.name === 'backup') cursor -= num(child(el, 'duration'), 0);
      else if (el.name === 'forward') { cursor += num(child(el, 'duration'), 0); maxEnd = Math.max(maxEnd, cursor); }
      else if (el.name === 'harmony') {
        const root = child(el, 'root');
        if (!root) continue;
        let name = xmlPitchName(txt(child(root, 'root-step')), num(child(root, 'root-alter'), 0));
        const kindEl = child(el, 'kind');
        const kind = txt(kindEl);
        name += kind in KIND ? KIND[kind] : (kindEl && kindEl.attrs.text) || '';
        const bass = child(el, 'bass');
        if (bass) name += '/' + xmlPitchName(txt(child(bass, 'bass-step')), num(child(bass, 'bass-alter'), 0));
        m.chords.push({ off: (cursor + num(child(el, 'offset'), 0)) / divisions, name });
      } else if (el.name === 'direction') {
        const snd = child(el, 'sound');
        if (snd && snd.attrs.tempo && tempo === null) tempo = parseFloat(snd.attrs.tempo);
        const dt = child(el, 'direction-type');
        const metro = child(dt, 'metronome');
        if (metro && child(metro, 'per-minute') && tempo === null) tempo = num(child(metro, 'per-minute'), null);
      } else if (el.name === 'barline') {
        const rep = child(el, 'repeat');
        const end = child(el, 'ending');
        if (rep && rep.attrs.direction === 'forward') m.repeatStart = true;
        if (rep && rep.attrs.direction === 'backward') m.repeatEnd = true;
        if (end) {
          if (end.attrs.type === 'start') {
            currentEnding = (end.attrs.number || '1').split(/[,\s]+/).map(Number).filter(Number.isFinite);
          } else stopEnding = true;
        }
      }
    }
    m.len = barLen();
    if (mi === 0 && maxEnd / divisions < m.len - 1e-3 && maxEnd > 0) {
      const pad = m.len - maxEnd / divisions;
      m.notes.forEach((n) => { n.off += pad; });
      m.chords.forEach((c) => { c.off += pad; });
    }
    m.endings = currentEnding;
    if (stopEnding) currentEnding = null;
    measures.push(m);
  });

  const majorFifths = fifths;
  return { measures, meter, tempo, key: { majorTonic: mod12(majorFifths * 7), mode: /min/i.test(mode) ? 'minor' : 'major' } };
}

export function parseMusicXML(src, opts = {}) {
  const doc = parseXML(src);
  const score = child(doc, 'score-partwise');
  if (!score) {
    if (child(doc, 'score-timewise')) throw new Error('Time-wise MusicXML is not supported. Re-export as "partwise".');
    throw new Error('That file is not MusicXML.');
  }
  const names = {};
  for (const sp of kids(child(score, 'part-list'), 'score-part')) names[sp.attrs.id] = txt(child(sp, 'part-name'));
  const partNodes = kids(score, 'part');
  const read = partNodes.map((p) => {
    const r = readPart(p);
    const laid = layoutMeasures(r.measures);
    return { id: p.attrs.id, r, laid };
  });
  const parts = read.map((p, index) => ({ index, name: names[p.id] || `Part ${index + 1}`, noteCount: p.laid.notes.length }));
  let pick = opts.part;
  if (pick === undefined || !read[pick]) pick = Math.max(0, parts.findIndex((p) => p.noteCount > 0));
  const chosen = read[pick];
  let chords = chosen.laid.chords;
  if (!chords.length) {
    const withChords = read.find((p) => p.laid.chords.length);
    if (withChords) chords = withChords.laid.chords;
  }
  return finish({
    format: 'musicxml', title: txt(child(child(score, 'work'), 'work-title')) || txt(child(score, 'movement-title')),
    notes: chosen.laid.notes, chords, timeSig: chosen.r.meter, tempo: chosen.r.tempo, key: chosen.r.key,
    totalBeats: chosen.laid.totalBeats, parts, part: pick, warnings: [],
  });
}

// ---------- compressed MusicXML (.mxl) ----------
async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (e) { /* fall through to Node's zlib */ }
  }
  const zlib = await import('node:zlib');
  return new Uint8Array(zlib.inflateRawSync(bytes));
}

export async function parseMXL(buf, opts = {}) {
  const d = new Uint8Array(buf);
  const v = new DataView(d.buffer, d.byteOffset, d.byteLength);
  let eocd = -1;
  for (let i = d.length - 22; i >= 0 && i > d.length - 70000; i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('That .mxl file is not a valid zip archive.');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const entries = {};
  for (let k = 0; k < count; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true);
    const nlen = v.getUint16(p + 28, true);
    const elen = v.getUint16(p + 30, true);
    const clen = v.getUint16(p + 32, true);
    const off = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(d.subarray(p + 46, p + 46 + nlen));
    entries[name] = { method, csize, off };
    p += 46 + nlen + elen + clen;
  }
  const read = async (name) => {
    const e = entries[name];
    if (!e) return null;
    const nlen = v.getUint16(e.off + 26, true);
    const elen = v.getUint16(e.off + 28, true);
    const start = e.off + 30 + nlen + elen;
    const data = d.subarray(start, start + e.csize);
    const out = e.method === 0 ? data : await inflateRaw(data);
    return new TextDecoder('utf-8').decode(out);
  };
  let target = null;
  const container = await read('META-INF/container.xml');
  if (container) {
    const m = /full-path="([^"]+)"/.exec(container);
    if (m) target = m[1];
  }
  if (!target) target = Object.keys(entries).find((n) => /\.(xml|musicxml)$/i.test(n) && !n.startsWith('META-INF'));
  const xml = target && (await read(target));
  if (!xml) throw new Error('No score was found inside that .mxl file.');
  return parseMusicXML(xml, opts);
}

// ---------- MIDI ----------
export function parseMIDI(buf, opts = {}) {
  const d = new Uint8Array(buf);
  let p = 0;
  const u32 = () => { const x = ((d[p] << 24) | (d[p + 1] << 16) | (d[p + 2] << 8) | d[p + 3]) >>> 0; p += 4; return x; };
  const u16 = () => { const x = (d[p] << 8) | d[p + 1]; p += 2; return x; };
  const id = () => { const s = String.fromCharCode(d[p], d[p + 1], d[p + 2], d[p + 3]); p += 4; return s; };
  const vlq = () => { let x = 0; let b; do { b = d[p++]; x = (x << 7) | (b & 0x7f); } while (b & 0x80 && p < d.length); return x; };

  if (id() !== 'MThd') throw new Error('That is not a MIDI file.');
  const hlen = u32();
  const hstart = p;
  u16(); // format
  const ntrk = u16();
  const division = u16();
  p = hstart + hlen;
  if (division & 0x8000) throw new Error('MIDI files with SMPTE timing are not supported.');
  const ppq = division;

  const tracks = [];
  let tempo = null;
  let meter = null;
  let key = null;
  for (let t = 0; t < ntrk && p < d.length; t++) {
    const cid = id();
    const len = u32();
    const end = Math.min(d.length, p + len);
    if (cid !== 'MTrk') { p = end; t--; continue; }
    let tick = 0;
    let running = 0;
    let name = '';
    const open = new Map();
    const notes = [];
    while (p < end) {
      tick += vlq();
      let status = d[p];
      if (status < 0x80) status = running;
      else { p++; if (status < 0xf0) running = status; }
      if (status === 0xff) {
        const type = d[p++];
        const l = vlq();
        const data = d.subarray(p, p + l);
        p += l;
        if (type === 0x51 && l === 3 && tempo === null) tempo = 60000000 / ((data[0] << 16) | (data[1] << 8) | data[2]);
        else if (type === 0x58 && l >= 2 && !meter) meter = { num: data[0], den: Math.pow(2, data[1]) };
        else if (type === 0x59 && l >= 2 && !key) {
          const sf = (data[0] << 24) >> 24;
          key = { majorTonic: mod12(sf * 7), mode: data[1] ? 'minor' : 'major' };
        } else if (type === 0x03 && !name) name = new TextDecoder().decode(data);
      } else if (status === 0xf0 || status === 0xf7) {
        p += vlq();
      } else {
        const type = status & 0xf0;
        const ch = status & 0x0f;
        const a = d[p++];
        const b = type === 0xc0 || type === 0xd0 ? 0 : d[p++];
        if (ch === 9) continue; // drums
        const k = `${ch}:${a}`;
        if (type === 0x90 && b > 0) {
          if (!open.has(k)) open.set(k, []);
          open.get(k).push(tick);
        } else if (type === 0x80 || (type === 0x90 && b === 0)) {
          const st = open.get(k);
          if (st && st.length) notes.push({ midi: a, startTick: st.shift(), endTick: tick });
        }
      }
    }
    for (const [k, st] of open) for (const s of st) notes.push({ midi: +k.split(':')[1], startTick: s, endTick: tick });
    p = end;
    if (notes.length) tracks.push({ name, notes });
  }
  if (!tracks.length) throw new Error('No notes were found in that MIDI file.');

  const parts = tracks.map((t, index) => ({ index, name: t.name || `Track ${index + 1}`, noteCount: t.notes.length }));
  let pick = opts.part;
  if (pick === undefined || !tracks[pick]) {
    const max = Math.max(...tracks.map((t) => t.notes.length));
    const candidates = tracks.map((t, i) => ({ i, t })).filter((x) => x.t.notes.length >= max * 0.3);
    const mean = (t) => t.notes.reduce((s, n) => s + n.midi, 0) / t.notes.length;
    pick = candidates.sort((a, b) => mean(b.t) - mean(a.t))[0].i;
  }
  const Q = 24; // quantise to 1/24 of a beat
  const notes = tracks[pick].notes.map((n) => {
    const start = Math.round((n.startTick / ppq) * Q) / Q;
    const dur = Math.max(1 / Q, Math.round(((n.endTick - n.startTick) / ppq) * Q) / Q);
    return { midi: n.midi, start, dur };
  });
  return finish({
    format: 'midi', title: tracks[pick].name || '', notes, chords: [], timeSig: meter || { num: 4, den: 4 },
    tempo: tempo ? Math.round(tempo) : null, key, parts, part: pick, warnings: [],
  });
}

// ---------- entry point ----------
/**
 * input: string (tab/ABC/MusicXML text) or ArrayBuffer (MIDI/MXL).
 * opts: { timeSig, tabMode, tabStep, capo, part, topVoice }
 */
export async function parseAny(input, opts = {}) {
  let result;
  if (typeof input !== 'string') {
    const u8 = new Uint8Array(input);
    const head = String.fromCharCode(...u8.subarray(0, 4));
    if (head === 'MThd') result = parseMIDI(input, opts);
    else if (u8[0] === 0x50 && u8[1] === 0x4b) result = await parseMXL(input, opts);
    else input = new TextDecoder().decode(u8);
  }
  if (!result) {
    const t = input.replace(/^\uFEFF/, '');
    if (/<score-(partwise|timewise)/.test(t)) result = parseMusicXML(t, opts);
    else if (/^\s*K:/m.test(t) && (/^\s*X:/m.test(t) || /^\s*[MLTQ]:/m.test(t))) result = parseABC(t);
    else result = parseTab(t, { timeSig: opts.timeSig, mode: opts.tabMode, step: opts.tabStep, capo: opts.capo });
  }
  if (opts.topVoice !== false) result.notes = topVoice(result.notes);
  return result;
}
