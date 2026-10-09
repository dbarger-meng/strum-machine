import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import {
  parseChord, transposeChord, chordVoicing, voicingMidi, bassNotes, scaleStep, detectKey, detectChords,
} from '../src/music.js';
import {
  parseChart, buildEvents, formatChart, chordsToChart, defaultCells, resampleCells, presetsFor,
} from '../src/song.js';
import { parseTab, parseABC, parseMIDI, parseMusicXML, parseMXL, parseAny, expandMeasures } from '../src/parsers.js';

// ---------- music ----------
test('parseChord handles qualities, accidentals and slash bass', () => {
  assert.deepEqual(pick(parseChord('G')), { pc: 7, quality: 'maj', bassPc: null });
  assert.deepEqual(pick(parseChord('Bbm7')), { pc: 10, quality: 'min', bassPc: null });
  assert.deepEqual(pick(parseChord('D7')), { pc: 2, quality: 'dom7', bassPc: null });
  assert.deepEqual(pick(parseChord('Gmaj7')), { pc: 7, quality: 'maj', bassPc: null });
  assert.deepEqual(pick(parseChord('G/B')), { pc: 7, quality: 'maj', bassPc: 11 });
  assert.deepEqual(pick(parseChord('Bdim')), { pc: 11, quality: 'dim', bassPc: null });
  assert.deepEqual(pick(parseChord('F#°')), { pc: 6, quality: 'dim', bassPc: null });
  assert.equal(parseChord('hello'), null);
  assert.equal(parseChord('H'), null);
});
const pick = (c) => ({ pc: c.pc, quality: c.quality, bassPc: c.bassPc });

test('transposeChord keeps suffix and respects flats', () => {
  assert.equal(transposeChord('G', 2), 'A');
  assert.equal(transposeChord('Em7', 3), 'Gm7');
  assert.equal(transposeChord('D/F#', 4), 'F#/A#');
  assert.equal(transposeChord('D/F#', 4, true), 'Gb/Bb');
  assert.equal(transposeChord('C', -2, true), 'Bb');
});

test('voicings: open chords and barre fallbacks sound the right notes', () => {
  assert.deepEqual(chordVoicing(parseChord('G')), [3, 2, 0, 0, 0, 3]);
  const names = (chord) => voicingMidi(chordVoicing(parseChord(chord))).filter((x) => x !== null).map((m) => m % 12);
  // F major: F A C
  assert.deepEqual([...new Set(names('F'))].sort((a, b) => a - b), [0, 5, 9]);
  // Bb major: Bb D F
  assert.deepEqual([...new Set(names('Bb'))].sort((a, b) => a - b), [2, 5, 10]);
  // F#m: F# A C#
  assert.deepEqual([...new Set(names('F#m'))].sort((a, b) => a - b), [1, 6, 9]);
  // Bdim: B D F, and Adim from the open A string: A C Eb
  assert.deepEqual([...new Set(names('Bdim'))].sort((a, b) => a - b), [2, 5, 11]);
  assert.deepEqual([...new Set(names('Adim'))].sort((a, b) => a - b), [0, 3, 9]);
});

test('bass notes are root and a fifth in the guitar bass range', () => {
  assert.deepEqual(bassNotes(parseChord('G')), { root: 43, fifth: 50 });
  assert.deepEqual(bassNotes(parseChord('C')), { root: 48, fifth: 43 });
  assert.deepEqual(bassNotes(parseChord('D')), { root: 50, fifth: 45 });
  assert.deepEqual(bassNotes(parseChord('E')), { root: 40, fifth: 47 });
  assert.deepEqual(bassNotes(parseChord('A')), { root: 45, fifth: 40 });
  assert.deepEqual(bassNotes(parseChord('Bdim')), { root: 47, fifth: 41 });
});

test('scaleStep walks diatonically', () => {
  assert.equal(scaleStep(48, -1, 7), 47); // C down one step in G major is B
  assert.equal(scaleStep(48, -2, 7), 45); // then A
  assert.equal(scaleStep(50, 1, 7), 52); // D up one step is E
});

test('detectKey and detectChords find G-C-D from a simple melody', () => {
  const n = (midi, start, dur = 1) => ({ midi, start, dur });
  const notes = [
    n(67, 0), n(71, 1), n(74, 2), n(79, 3), // G chord tones
    n(72, 4), n(76, 5), n(79, 6), n(72, 7), // C chord tones
    n(74, 8), n(78, 9), n(81, 10), n(74, 11), // D chord tones
    n(67, 12, 4), // back home
  ];
  const key = detectKey(notes);
  assert.equal(key.majorTonic, 7);
  const chords = detectChords(notes, { barLen: 4, totalBeats: 16, key });
  assert.deepEqual(chords, [['G'], ['C'], ['D'], ['G']]);
});

// ---------- song ----------
test('parseChart: bars, split bars, repeats, bad tokens', () => {
  const { bars, bad } = parseChart('| G | C D | % |\nEm Am\n| Zz |');
  assert.deepEqual(bars.map((b) => b.names), [['G'], ['C', 'D'], ['D'], ['Em'], ['Am']]);
  assert.deepEqual(bad, ['Zz']);
});

test('formatChart and chordsToChart round-trip', () => {
  assert.equal(formatChart([['G'], ['C', 'D'], ['G'], ['G'], ['D']]), '| G | C D | G | G |\n| D |');
  const text = chordsToChart([{ start: 0, name: 'G' }, { start: 6, name: 'D' }], 8, 4);
  assert.equal(text, '| G | G D |');
});

test('presets and resampling', () => {
  assert.equal(defaultCells(4, 2).join(''), 'R.C.F.C.');
  assert.equal(defaultCells(3, 2).join(''), 'R.C.C.');
  assert.equal(defaultCells(4, 4).join(''), 'R...C...F...C...');
  assert.equal(resampleCells(defaultCells(4, 4), 4, 2).join(''), 'R.C.F.C.');
  assert.equal(presetsFor(4.5)[0].cells.length, 9);
});

test('boom-chuck on G then C produces bass, chuck and fifth events', () => {
  const { bars } = parseChart('| G | C |');
  const out = buildEvents({
    bars, timeSig: { num: 4, den: 4 }, pattern: { cells: defaultCells(4, 2) }, bassRuns: 'off',
  });
  assert.equal(out.loopLen, 8);
  const bar0 = out.events.filter((e) => e.beat < 4);
  assert.deepEqual(bar0.map((e) => [e.beat, e.kind]), [[0, 'bass'], [1, 'strum'], [2, 'bass'], [3, 'strum']]);
  assert.deepEqual(bar0[0].notes, [43]); // G root
  assert.deepEqual(bar0[2].notes, [50]); // G fifth (D)
  assert.deepEqual(bar0[1].notes, [50, 55, 59, 67]); // chuck = D G B G (top four strings of an open G)
});

test('bass run replaces the last beat when the chord changes', () => {
  const { bars } = parseChart('| G | C |');
  const out = buildEvents({
    bars, timeSig: { num: 4, den: 4 }, pattern: { cells: defaultCells(4, 2) }, bassRuns: 'all',
  });
  const last = out.events.filter((e) => e.beat >= 3 && e.beat < 4);
  assert.deepEqual(last.map((e) => e.notes[0]), [45, 47]); // A, B walking up to C
  assert.deepEqual(last.map((e) => e.beat), [3, 3.5]);
});

test('swing delays the off-beat eighths and waltz uses three beats', () => {
  const { bars } = parseChart('| G |');
  const sw = buildEvents({
    bars, timeSig: { num: 4, den: 4 }, pattern: { cells: 'DDDDDDDD'.split('') }, bassRuns: 'off', swing: 1,
  });
  assert.ok(Math.abs(sw.events[1].beat - (0.5 + 1 / 6)) < 1e-9);
  const waltz = buildEvents({ bars, timeSig: { num: 3, den: 4 }, pattern: { cells: defaultCells(3, 2) }, bassRuns: 'off' });
  assert.equal(waltz.loopLen, 3);
});

test('melody events are transposed and extend the loop', () => {
  const { bars } = parseChart('| G |');
  const out = buildEvents({
    bars, timeSig: { num: 4, den: 4 }, pattern: { cells: defaultCells(4, 2) }, transpose: 2, bassRuns: 'off',
    melody: { notes: [{ midi: 67, start: 0, dur: 1 }, { midi: 69, start: 5, dur: 1 }] },
  });
  const mel = out.events.filter((e) => e.kind === 'melody');
  assert.deepEqual(mel.map((e) => e.midi), [69, 71]);
  assert.equal(out.loopLen, 8);
});

// ---------- tab ----------
const TAB = `
G           C
e|-3-----0-|-0-------|
B|---1-----|-----1---|
G|-----0---|---------|
D|-------2-|---------|
A|---------|---------|
E|---------|---------|
`;

test('parseTab fits each bar to the time signature and reads chord names above', () => {
  const r = parseTab(TAB, { timeSig: { num: 4, den: 4 } });
  const byStart = r.notes.filter((n) => n.start < 4).sort((a, b) => a.start - b.start || b.midi - a.midi);
  assert.deepEqual(byStart.map((n) => [n.midi, n.start]), [[67, 0], [60, 1], [55, 2], [64, 3], [52, 3]]);
  assert.equal(r.totalBeats, 8);
  assert.deepEqual(r.chords.map((c) => c.name), ['G', 'C']);
  assert.equal(r.chords[0].start, 0);
  assert.equal(r.chords[1].start, 4);
});

test('parseTab handles two-digit frets, drop-D labels, capo and fixed timing', () => {
  const tab = [
    'e|-12---|', 'B|------|', 'G|------|', 'D|------|', 'A|------|', 'D|-0----|',
  ].join('\n');
  const r = parseTab(tab, { mode: 'fixed', step: 0.5, capo: 2 });
  const hi = r.notes.find((n) => n.midi > 70);
  assert.equal(hi.midi, 64 + 12 + 2);
  const low = r.notes.find((n) => n.midi < 50);
  assert.equal(low.midi, 38 + 2); // drop D string
});

test('parseTab rejects text without tab', () => {
  assert.throws(() => parseTab('hello world'), /No guitar tab/);
});

// ---------- ABC ----------
test('parseABC: repeats, endings, chords, accidentals', () => {
  const r = parseABC(['X:1', 'T:Test', 'M:4/4', 'L:1/8', 'K:G', '|:"G"G2 A2 B2 c2 |1 d8 :|2 g8 |]'].join('\n'));
  assert.equal(r.title, 'Test');
  assert.equal(r.notes.length, 10);
  assert.equal(r.totalBeats, 16);
  assert.deepEqual(r.notes.map((n) => n.start), [0, 1, 2, 3, 4, 8, 9, 10, 11, 12]);
  assert.deepEqual(r.notes.map((n) => n.midi), [67, 69, 71, 72, 74, 67, 69, 71, 72, 79]);
  assert.deepEqual(r.chords.map((c) => c.start), [0, 8]);
});

test('parseABC: key signature, bar-long accidentals, ties and pickup bars', () => {
  const r = parseABC('X:1\nM:4/4\nL:1/4\nK:D\nA | F F =F ^G | A8- | A2\n');
  // pickup A padded to the end of the first bar
  assert.equal(r.notes[0].start, 3);
  const f = r.notes.filter((n) => [66, 65].includes(n.midi));
  assert.deepEqual(f.map((n) => n.midi), [66, 66, 65]); // F# F# then natural
  const tied = r.notes.find((n) => n.midi === 69 && n.dur > 4);
  assert.ok(tied, 'tied A notes merged into one long note');
});

test('parseABC: broken rhythm, triplets and Mixolydian key signature', () => {
  const r = parseABC('X:1\nM:4/4\nL:1/8\nK:DMix\nA>B (3cde f4|\n');
  assert.deepEqual(r.notes.slice(0, 2).map((n) => n.dur), [0.75, 0.25]);
  const trip = r.notes.slice(2, 5);
  trip.forEach((n) => assert.ok(Math.abs(n.dur - 1 / 3) < 1e-9));
  assert.equal(r.notes[2].midi, 72); // c is natural in D Mixolydian (no C# in the key signature)
  assert.equal(r.notes[3].midi, 74);
  assert.equal(r.notes[4].midi, 76);
});

test('expandMeasures plays endings in order', () => {
  const m = (id, extra = {}) => ({ id, len: 4, notes: [], chords: [], repeatStart: false, repeatEnd: false, endings: null, ...extra });
  const out = expandMeasures([m('a', { repeatStart: true }), m('b', { endings: [1], repeatEnd: true }), m('c', { endings: [2] }), m('d')]);
  assert.deepEqual(out.map((x) => x.id), ['a', 'b', 'a', 'c', 'd']);
});

// ---------- MIDI ----------
function vlq(n) {
  const bytes = [n & 0x7f];
  while ((n >>= 7)) bytes.unshift((n & 0x7f) | 0x80);
  return bytes;
}
function midiFile(ppq, events) {
  const body = [];
  for (const [delta, ...data] of events) body.push(...vlq(delta), ...data);
  body.push(0, 0xff, 0x2f, 0);
  const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, ppq >> 8, ppq & 255];
  const len = body.length;
  const trk = [0x4d, 0x54, 0x72, 0x6b, len >>> 24, (len >> 16) & 255, (len >> 8) & 255, len & 255, ...body];
  return new Uint8Array([...header, ...trk]).buffer;
}

test('parseMIDI reads notes, tempo and time signature', () => {
  const buf = midiFile(480, [
    [0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20], // 500000 us = 120 bpm
    [0, 0xff, 0x58, 4, 3, 2, 24, 8], // 3/4
    [0, 0x90, 67, 90],
    [480, 0x80, 67, 0],
    [0, 0x90, 71, 90],
    [240, 0x90, 74, 90], // note on while 71 still sounding
    [240, 0x80, 71, 0],
    [240, 0x80, 74, 0],
  ]);
  const r = parseMIDI(buf);
  assert.equal(r.tempo, 120);
  assert.deepEqual(r.timeSig, { num: 3, den: 4 });
  assert.deepEqual(r.notes.map((n) => [n.midi, n.start, n.dur]), [[67, 0, 1], [71, 1, 1], [74, 1.5, 1]]);
});

test('parseAny detects MIDI by header and rejects junk', async () => {
  const r = await parseAny(midiFile(96, [[0, 0x90, 60, 80], [96, 0x80, 60, 0]]));
  assert.equal(r.format, 'midi');
  await assert.rejects(() => parseAny('just some words, no music'), /No guitar tab/);
});

// ---------- MusicXML ----------
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work><work-title>Test &amp; Tune</work-title></work>
  <part-list><score-part id="P1"><part-name>Fiddle</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions><key><fifths>1</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>96</per-minute></metronome></direction-type></direction>
      <barline location="left"><repeat direction="forward"/></barline>
      <harmony><root><root-step>G</root-step></root><kind>major</kind></harmony>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration></note>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>2</duration></note>
      <note><rest/><duration>2</duration></note>
      <note><pitch><step>F</step><alter>1</alter><octave>5</octave></pitch><duration>2</duration><tie type="start"/></note>
    </measure>
    <measure number="2">
      <harmony><root><root-step>D</root-step></root><kind>dominant</kind></harmony>
      <note><pitch><step>F</step><alter>1</alter><octave>5</octave></pitch><duration>8</duration><tie type="stop"/></note>
      <barline location="right"><repeat direction="backward"/></barline>
    </measure>
  </part>
</score-partwise>`;

test('parseMusicXML reads pitches, ties, harmony, tempo and repeats', () => {
  const r = parseMusicXML(XML);
  assert.equal(r.title, 'Test & Tune');
  assert.equal(r.tempo, 96);
  assert.equal(r.key.majorTonic, 7);
  assert.deepEqual(r.chords.map((c) => c.name), ['G', 'D7', 'G', 'D7']);
  assert.deepEqual(r.notes.map((n) => [n.midi, n.start, n.dur]), [
    [67, 0, 1], [71, 1, 1], [78, 3, 5], [67, 8, 1], [71, 9, 1], [78, 11, 5],
  ]);
  assert.equal(r.totalBeats, 16);
});

test('parseMXL unpacks a compressed score', async () => {
  const zip = makeZip({
    'META-INF/container.xml': '<container><rootfiles><rootfile full-path="score.xml"/></rootfiles></container>',
    'score.xml': XML,
  });
  const r = await parseMXL(zip);
  assert.equal(r.notes.length, 6);
  assert.equal(r.title, 'Test & Tune');
});

function makeZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name);
    const raw = Buffer.from(content);
    const comp = zlib.deflateRawSync(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, comp);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + comp.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  const all = Buffer.concat([...locals, centralBuf, eocd]);
  return all.buffer.slice(all.byteOffset, all.byteOffset + all.length);
}

test('every guitar sample file is listed, and notes use the nearest one', async () => {
  const { GUITAR_SAMPLES, nearestSample } = await import('../src/audio.js');
  const { readdirSync } = await import('node:fs');
  assert.deepEqual(GUITAR_SAMPLES.map((n) => `${n}.mp3`).sort(), readdirSync('samples/guitar').sort());
  const samples = [40, 43, 46, 49].map((midi) => ({ midi }));
  assert.equal(nearestSample(samples, 41).sample.midi, 40);
  assert.equal(nearestSample(samples, 45).sample.midi, 46);
  assert.ok(Math.abs(nearestSample(samples, 38).rate - Math.pow(2, -2 / 12)) < 1e-9);
});
