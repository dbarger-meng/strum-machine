import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STRINGS, positionsFor, spell, staffStep, ledgerLines, nextQuestion, isCorrect, answersFor, noteLabel, isNatural, judgeTap, hasInlay,
} from '../src/fretboard.js';
import { GLYPHS } from '../src/notation-glyphs.js';

test('strings run high to low and positions cover the chosen frets', () => {
  assert.deepEqual(STRINGS.map((s) => s.name), ['e', 'B', 'G', 'D', 'A', 'E']);
  const ps = positionsFor({ strings: [1], maxFret: 3 });
  assert.deepEqual(ps.map((p) => p.midi), [45, 46, 47, 48]);
  assert.equal(positionsFor().length, 6 * 13);
});

test('notes are written an octave above they sound, in the usual guitar places', () => {
  // A string, 3rd fret sounds C3 and is written as middle C (C4), one ledger line below the staff.
  const c = spell(48 + 12);
  assert.deepEqual(c, { letter: 'C', accidental: '', octave: 4 });
  assert.equal(staffStep(c), -2);
  assert.deepEqual(ledgerLines(-2), [-2]);
  // Low E open is written E3, three ledger lines below; high e 12th fret is E6, above the staff.
  assert.equal(staffStep(spell(40 + 12)), -7);
  assert.deepEqual(ledgerLines(-7), [-2, -4, -6]);
  assert.equal(staffStep(spell(76 + 12)), 14);
  assert.deepEqual(ledgerLines(14), [10, 12, 14]);
  // Open G string is written on the second line from the bottom (G4).
  assert.equal(staffStep(spell(55 + 12)), 2);
  assert.deepEqual(ledgerLines(4), []);
});

test('sharps and flats are spelled either way, keeping the right octave', () => {
  assert.deepEqual(spell(61), { letter: 'C', accidental: '#', octave: 4 });
  assert.deepEqual(spell(61, true), { letter: 'D', accidental: 'b', octave: 4 });
  assert.equal(noteLabel(spell(70, true)), 'B♭4');
  assert.equal(staffStep(spell(61)), staffStep(spell(60)));
  assert.equal(staffStep(spell(61, true)), staffStep(spell(62)));
  assert.ok(isNatural(64) && !isNatural(66));
});

test('questions use the chosen notes and answers are checked by pitch', () => {
  const positions = positionsFor({ strings: [0, 1, 2, 3, 4, 5], maxFret: 12 });
  let r = 0;
  const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  let prev = null;
  for (let i = 0; i < 200; i++) {
    const q = nextQuestion({ positions, naturalsOnly: true, prev, rand });
    assert.ok(isNatural(q.midi));
    assert.notEqual(q.midi, prev && prev.midi);
    assert.ok(answersFor(q, positions).length >= 1);
    prev = q;
  }
  const q = { midi: 48 };
  assert.ok(isCorrect(q, { string: 1, fret: 3 }));
  assert.ok(isCorrect(q, { string: 0, fret: 8 }));
  assert.ok(!isCorrect(q, { string: 2, fret: 10 })); // C4: right letter, wrong octave
  assert.ok(isCorrect(q, { string: 2, fret: 10 }, true));
  assert.deepEqual(answersFor(q, positions).map((p) => [p.string, p.fret]), [[0, 8], [1, 3]]); // low E 8th, A 3rd
  assert.equal(nextQuestion({ positions: positionsFor({ strings: [0], minFret: 2, maxFret: 2 }), naturalsOnly: true }), null); // only F#
});

test('notation glyphs are present', () => {
  for (const k of ['gClef', 'noteheadWhole', 'accidentalSharp', 'accidentalFlat']) assert.ok(GLYPHS[k].d.length > 100, k);
});

test('every place a note is played must be found', () => {
  const positions = positionsFor({ maxFret: 12 });
  const q = { midi: 57 }; // A3: written A4, played in three places within frets 0-12
  const targets = answersFor(q, positions);
  assert.deepEqual(targets.map((p) => [p.string, p.fret]), [[1, 12], [2, 7], [3, 2]]);
  const found = new Set();
  assert.equal(judgeTap(q, targets, found, { string: 3, fret: 2 }), 'found');
  assert.equal(judgeTap(q, targets, found, { string: 3, fret: 2 }), 'again');
  assert.equal(judgeTap(q, targets, found, { string: 3, fret: 3 }), 'wrong');
  assert.equal(judgeTap(q, targets, found, { string: 2, fret: 7 }), 'found');
  assert.equal(judgeTap(q, targets, found, { string: 1, fret: 12 }), 'done');
  // a note with only one place is done in one tap
  const low = { midi: 40 };
  assert.equal(judgeTap(low, answersFor(low, positions), new Set(), { string: 0, fret: 0 }), 'done');
});

test('inlay dots sit in the middle of the neck, doubled at the 12th fret', () => {
  const at = (fret) => [0, 1, 2, 3, 4, 5].filter((s) => hasInlay(s, fret));
  for (const fret of [3, 5, 7, 9, 15]) assert.deepEqual(at(fret), [3], `fret ${fret}`); // G string's lower edge
  assert.deepEqual(at(12), [2, 4]); // between D and A, and between B and G
  for (const fret of [0, 1, 2, 4, 6, 8, 10, 11, 13, 14]) assert.deepEqual(at(fret), []);
});
