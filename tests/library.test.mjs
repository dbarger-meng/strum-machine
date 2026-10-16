import test from 'node:test';
import assert from 'node:assert/strict';
import { LIBRARY, KINDS } from '../src/library.js';
import { parseChart, presetsFor, barLength } from '../src/song.js';
import { parseChord } from '../src/music.js';

test('every library song has a valid, playable setup', () => {
  assert.ok(LIBRARY.length >= 15);
  assert.equal(new Set(LIBRARY.map((s) => s.id)).size, LIBRARY.length, 'ids are unique');
  assert.equal(new Set(LIBRARY.map((s) => s.title)).size, LIBRARY.length, 'titles are unique');
  for (const s of LIBRARY) {
    const { bars, bad } = parseChart(s.chart);
    assert.deepEqual(bad, [], `${s.title}: every chord is recognised`);
    assert.ok(bars.length >= 8, `${s.title}: has a full chart`);
    assert.ok(KINDS.includes(s.kind), `${s.title}: kind`);
    assert.ok(['4/4', '3/4', '2/4', '6/8'].includes(s.ts), `${s.title}: time signature`);
    assert.ok(s.tempo >= 50 && s.tempo <= 220, `${s.title}: tempo in range`);
    const [num, den] = s.ts.split('/').map(Number);
    assert.ok(presetsFor(barLength({ num, den })).some((p) => p.id === s.preset), `${s.title}: preset exists`);
    const key = parseChord(s.key);
    assert.ok(key, `${s.title}: key`);
    assert.equal(parseChord(bars[0].names[0]).pc, key.pc, `${s.title}: starts on its home chord`);
    assert.equal(parseChord(bars.at(-1).names.at(-1)).pc, key.pc, `${s.title}: ends on its home chord`);
  }
});

test('fiddle tunes are written out AABB', () => {
  for (const s of LIBRARY.filter((x) => x.kind === 'Fiddle tunes' && x.chart.includes('# B part'))) {
    const [a, b] = s.chart.split('# B part');
    const half = (t) => parseChart(t).bars.map((x) => x.names.join(' '));
    const A = half(a);
    const B = half(b);
    assert.deepEqual(A.slice(0, A.length / 2), A.slice(A.length / 2), `${s.title}: A part repeats`);
    assert.deepEqual(B.slice(0, B.length / 2), B.slice(B.length / 2), `${s.title}: B part repeats`);
  }
});
