import test from 'node:test';
import assert from 'node:assert/strict';
import {
  METERS, VALUES, canFill, randomBar, randomDictation, addValue, undoLast, remaining, sameRhythm, beamGroups, noteShape, sum,
} from '../src/rhythm.js';

const seeded = (s = 11) => () => ((s = (s * 9301 + 49297) % 233280) / 233280);
const ids = (meter) => VALUES[meter].map((v) => v.id);
const durs = (bar) => bar.map((n) => +n.dur.toFixed(3));

test('random bars always fill the bar exactly, in both meters', () => {
  const rand = seeded();
  for (const meter of ['4/4', '6/8']) {
    for (let i = 0; i < 400; i++) {
      const bar = randomBar(meter, ids(meter), rand);
      assert.ok(Math.abs(sum(bar) - METERS[meter].barLen) < 1e-9, `${meter}: ${durs(bar)}`);
    }
  }
});

test('only the chosen note values are used', () => {
  const rand = seeded(5);
  for (let i = 0; i < 300; i++) {
    const bar = randomBar('4/4', ['quarter', 'eighth'], rand);
    assert.ok(bar.every((n) => n.dur === 1 || n.dur === 0.5), durs(bar).join());
  }
  for (let i = 0; i < 100; i++) assert.deepEqual(durs(randomBar('4/4', ['whole'], rand)), [4]);
  for (let i = 0; i < 100; i++) assert.ok(durs(randomBar('4/4', ['half'], rand)).every((d) => d === 2));
  for (let i = 0; i < 200; i++) {
    const bar = randomBar('6/8', ['dottedQuarter', 'eighth'], rand);
    assert.ok(bar.every((n) => n.dur === 1.5 || n.dur === 0.5));
  }
  assert.ok(canFill('6/8', ['dottedHalf']) && !canFill('6/8', ['quarter']) && canFill('4/4', ['half']));
});

test('triplets come in groups of three that start on a beat', () => {
  const rand = seeded(3);
  for (let i = 0; i < 300; i++) {
    const bar = randomBar('4/4', ['quarter', 'triplet'], rand);
    let at = 0;
    let run = 0; // triplet notes so far in the current run
    for (const n of bar) {
      if (n.tuplet) {
        if (run % 3 === 0) assert.ok(Math.abs(at - Math.round(at)) < 1e-9, `group starts on a beat, not ${at}`);
        run++;
      } else {
        assert.equal(run % 3, 0, 'groups are complete');
        run = 0;
      }
      at += n.dur;
    }
    assert.equal(run % 3, 0);
  }
});

test('dictations have four bars of pitched notes', () => {
  const d = randomDictation('6/8', ids('6/8'), { rand: seeded(9) });
  assert.equal(d.length, 4);
  assert.ok(d.flat().every((n) => n.midi >= 55 && n.midi <= 74));
});

test('the answer fills bars, rejects overflows and off-beat triplets, and undoes', () => {
  let bar = [];
  bar = addValue(bar, 'eighth', '4/4');
  assert.equal(addValue(bar, 'triplet', '4/4'), 'triplet-beat');
  bar = addValue(bar, 'eighth', '4/4');
  bar = addValue(bar, 'triplet', '4/4');
  assert.equal(bar.length, 5);
  assert.equal(remaining(bar, '4/4'), 2);
  assert.equal(addValue(bar, 'whole', '4/4'), 'full');
  bar = addValue(bar, 'half', '4/4');
  assert.equal(remaining(bar, '4/4'), 0);
  assert.equal(undoLast(bar).length, 5);
  assert.equal(undoLast(undoLast(bar)).length, 2); // the triplet goes as one
  assert.ok(sameRhythm(addValue([], 'dottedHalf', '6/8'), [{ dur: 3 }]));
  assert.ok(!sameRhythm([{ dur: 1 }, { dur: 0.5 }], [{ dur: 0.5 }, { dur: 1 }]));
});

test('notes are beamed by beat and drawn with the right shapes', () => {
  const bar = (list) => list.map((dur) => ({ dur, tuplet: Math.abs(dur - 1 / 3) < 1e-9 }));
  assert.deepEqual(beamGroups(bar([0.5, 0.5, 0.25, 0.25, 0.5, 1, 1 / 3, 1 / 3, 1 / 3]), '4/4'), [[0, 1], [2, 3, 4], [6, 7, 8]]);
  assert.deepEqual(beamGroups(bar([0.5, 0.5, 0.5, 1, 0.5]), '6/8'), [[0, 1, 2], [4]]);
  assert.deepEqual(beamGroups(bar([0.5, 1, 0.5, 2]), '4/4'), [[0], [2]]); // a quarter across the beat breaks beams
  assert.deepEqual(noteShape({ dur: 4 }), { head: 'noteheadWhole', stem: false, dotted: false, beams: 0 });
  assert.deepEqual(noteShape({ dur: 3 }), { head: 'noteheadHalf', stem: true, dotted: true, beams: 0 });
  assert.deepEqual(noteShape({ dur: 1.5 }), { head: 'noteheadBlack', stem: true, dotted: true, beams: 0 });
  assert.equal(noteShape({ dur: 0.25 }).beams, 2);
  assert.equal(noteShape({ dur: 1 / 3, tuplet: true }).beams, 1);
});
