import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INTERVALS, INTERVAL_SETS, intervalBySemis, nameOf, spellAbove, spellUpper, spellPair, placesOf, isNearby, findQuestion, nameQuestion,
} from '../src/intervals.js';
import { positionsFor } from '../src/fretboard.js';

const seeded = () => { let r = 7; return () => ((r = (r * 9301 + 49297) % 233280) / 233280); };

test('intervals are named and spelled correctly', () => {
  assert.equal(INTERVALS.length, 12);
  assert.equal(intervalBySemis(7).name, 'Perfect 5th');
  assert.equal(spellAbove('C', 7), 'G');
  assert.equal(spellAbove('D', 4), 'F♯');
  assert.equal(spellAbove('Eb', 3), 'G♭');
  assert.equal(spellAbove('A', 10), 'G');
  assert.equal(spellAbove('F', 6), 'C♭'); // the flat five of F
  assert.equal(spellAbove('G', 12), 'G');
  assert.equal(nameOf(61), 'Db');
  assert.deepEqual(INTERVAL_SETS.common.semis, [3, 4, 5, 7, 9, 10, 12]);
});

test('the 5th above A on the low E string is in the usual places', () => {
  const positions = positionsFor({ maxFret: 12 });
  const targets = placesOf(45 + 7, positions); // A2 (low E 5th fret) up a 5th = E3
  assert.deepEqual(targets.map((p) => [p.string, p.fret]), [[0, 12], [1, 7], [2, 2]]);
  assert.ok(isNearby({ string: 0, fret: 5 }, { string: 1, fret: 7 }));
  assert.ok(!isNearby({ string: 0, fret: 5 }, { string: 0, fret: 12 }));
});

test('find questions always have an answer on the neck', () => {
  const positions = positionsFor({ maxFret: 12 });
  const rand = seeded();
  let prev = null;
  for (let i = 0; i < 300; i++) {
    const q = findQuestion({ positions, semisSet: INTERVAL_SETS.all.semis, prev, rand });
    assert.ok(q.targets.length >= 1);
    assert.ok(q.targets.every((t) => t.midi === q.start.midi + q.interval.semis));
    prev = q;
  }
});

test('name questions give a lower and higher note the right distance apart, nearby', () => {
  const positions = positionsFor({ maxFret: 12 });
  const rand = seeded();
  for (let i = 0; i < 300; i++) {
    const q = nameQuestion({ positions, semisSet: INTERVAL_SETS.common.semis, rand });
    assert.equal(q.high.midi - q.low.midi, q.interval.semis);
    assert.ok(INTERVAL_SETS.common.semis.includes(q.interval.semis));
    assert.ok(isNearby(q.low, q.high));
  }
  assert.equal(nameQuestion({ positions: positionsFor({ strings: [0], maxFret: 2 }), semisSet: [12] }), null);
});

test('pairs of notes are spelled so both read cleanly', () => {
  assert.deepEqual(spellPair(61, 3), ['C♯', 'E']); // not D♭ up to F♭
  assert.deepEqual(spellPair(63, 4), ['E♭', 'G']);
  assert.deepEqual(spellPair(65, 6), ['F', 'B']); // tritone as a sharp four, not C♭
  assert.deepEqual(spellPair(59, 6), ['B', 'F']); // tritone as a flat five
  assert.deepEqual(spellPair(66, 5), ['F♯', 'B']);
  assert.equal(spellUpper('A', 4), 'C♯');
  assert.equal(spellUpper('F', 6), 'B');
  for (let m = 40; m < 52; m++) {
    for (const i of INTERVALS) assert.doesNotMatch(spellPair(m, i.semis).join(' '), /𝄪|𝄫|F♭|C♭|E♯|B♯/, `${m} + ${i.semis}`);
  }
});
