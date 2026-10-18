import test from 'node:test';
import assert from 'node:assert/strict';
import {
  spellFrom, triadShapes, STRING_SETS, scaleNames, scaleNotes, scalePositions, ROOTS,
} from '../src/shapes.js';

const frets = (shape) => shape.notes.map((n) => n.fret);
const set = (id) => STRING_SETS.find((x) => x.id === id).strings;

test('notes are spelled for the key', () => {
  assert.equal(spellFrom('D', 4, 2), 'F♯');
  assert.equal(spellFrom('Bb', 3, 2), 'D♭');
  assert.equal(spellFrom('B', 6, 4), 'F');
  assert.equal(spellFrom('F#', 8, 4), 'C𝄪');
  assert.deepEqual(scaleNames('F', 'major'), ['F', 'G', 'A', 'B♭', 'C', 'D', 'E']);
  assert.deepEqual(scaleNames('A', 'blues'), ['A', 'C', 'D', 'E♭', 'E', 'G']);
  assert.deepEqual(scaleNames('E', 'majorPent'), ['E', 'F♯', 'G♯', 'B', 'C♯']);
  assert.equal(ROOTS.length, 12);
});

test('G major triads on the top three strings are the three familiar shapes', () => {
  const shapes = triadShapes(7, 'major', set('eBG'));
  assert.deepEqual(shapes.map(frets), [[4, 3, 3], [7, 8, 7], [12, 12, 10]]);
  assert.deepEqual(shapes.map((s) => s.inversion), [1, 2, 0]); // B in the bass, then D, then G
});

test('triads always hold one root, one third and one fifth', () => {
  for (const q of ['major', 'minor', 'dim', 'aug']) {
    for (const { strings } of STRING_SETS) {
      for (let root = 0; root < 12; root++) {
        const shapes = triadShapes(root, q, strings);
        assert.ok(shapes.length >= 3, `${root} ${q} on ${strings}`);
        for (const s of shapes) assert.deepEqual(s.notes.map((n) => n.tone).sort(), [0, 1, 2]);
      }
    }
  }
  // A minor on D-A-E: root position at the 5th fret (A, E, A? no: A C E across E A D strings)
  assert.ok(triadShapes(9, 'minor', set('DAE')).some((s) => frets(s).join() === '5,3,2'));
});

test('minor pentatonic positions are the five standard boxes', () => {
  const pos = scalePositions(9, 'minorPent'); // A minor pentatonic
  assert.equal(pos.length, 5);
  assert.deepEqual(pos[0].notes.map((n) => `${n.string}:${n.fret}`), ['0:0', '0:3', '1:0', '1:3', '2:0', '2:2', '3:0', '3:2', '4:1', '4:3', '5:0', '5:3']);
  const box1 = pos.find((p) => p.low === 5);
  assert.deepEqual(box1.notes.map((n) => n.fret), [5, 8, 5, 7, 5, 7, 5, 7, 5, 8, 5, 8]);
});

test('blues box adds the flat five inside the box', () => {
  const box1 = scalePositions(9, 'blues').find((p) => p.low === 5);
  const blue = box1.notes.filter((n) => n.degree === 3).map((n) => `${n.string}:${n.fret}`);
  assert.deepEqual(blue, ['1:6', '3:8']);
});

test('seven-note scales use three notes per string and cover the scale', () => {
  const pos = scalePositions(7, 'major'); // G major
  assert.equal(pos.length, 7);
  for (const p of pos) {
    assert.equal(p.notes.length, 18);
    assert.ok(p.notes.every((n) => n.degree >= 0 && n.fret >= 0 && n.fret <= 15));
    assert.ok(p.high - p.low <= 6, `span ${p.low}-${p.high}`);
  }
  const all = scaleNotes(7, 'major');
  assert.ok(all.every((n) => n.degree >= 0));
  assert.equal(all.filter((n) => n.string === 0 && n.fret <= 12).length, 8); // G A B C D E F# G... on low E 0-12
});
