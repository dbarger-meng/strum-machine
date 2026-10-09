import test from 'node:test';
import assert from 'node:assert/strict';
import {
  paletteFor, chordName, barsFromChart, chartFromBars, chartKey, applyDrop, removeBar, MAX_CHORDS_PER_BAR,
} from '../src/chart-edit.js';

const names = (tonic) => paletteFor(tonic).map((c) => c.name);

test('palette lists the common chords of a key with sensible spelling', () => {
  assert.deepEqual(names(7), ['G', 'C', 'D', 'D7', 'Em', 'Am', 'Bm', 'A', 'B', 'E', 'F']);
  assert.deepEqual(names(5).slice(0, 6), ['F', 'Bb', 'C', 'C7', 'Dm', 'Gm']);
  assert.equal(names(0).at(-1), 'Bb'); // flat seven is spelled flat even in sharp keys
  assert.equal(paletteFor(7)[0].roman, 'I');
  assert.equal(chordName(10, 'm7', true), 'Bbm7');
});

test('chart text and bars round-trip, and the key comes from the first chord', () => {
  const bars = barsFromChart('| G | C D | % |');
  assert.deepEqual(bars, [['G'], ['C', 'D'], ['D']]);
  assert.deepEqual(barsFromChart(chartFromBars(bars)), bars);
  assert.equal(chartFromBars([]), '');
  assert.equal(chartKey([['Em'], ['C']]), 7);
  assert.equal(chartKey([['A'], ['D']]), 9);
  assert.equal(chartKey([]), 7);
});

test('dropping a palette chord replaces, splits or adds bars', () => {
  const bars = [['G'], ['C', 'D']];
  const pal = { kind: 'palette', name: 'Em' };
  assert.deepEqual(applyDrop(bars, pal, { kind: 'chord', bar: 1, idx: 1 }), [['G'], ['C', 'Em']]);
  assert.deepEqual(applyDrop(bars, pal, { kind: 'bar', bar: 1 }), [['G'], ['Em']]);
  assert.deepEqual(applyDrop(bars, pal, { kind: 'split', bar: 0 }), [['G', 'Em'], ['C', 'D']]);
  assert.deepEqual(applyDrop(bars, pal, { kind: 'new' }), [['G'], ['C', 'D'], ['Em']]);
  assert.deepEqual(applyDrop(bars, pal, { kind: 'trash' }), bars);
  assert.deepEqual(bars, [['G'], ['C', 'D']], 'input is not changed');
  const full = [new Array(MAX_CHORDS_PER_BAR).fill('G')];
  assert.deepEqual(applyDrop(full, pal, { kind: 'split', bar: 0 }), full);
});

test('dragging a chord in the chart moves it, copies it, or removes it', () => {
  const bars = [['G'], ['C', 'D'], ['G']];
  const d = { kind: 'chord', bar: 1, idx: 1 };
  assert.deepEqual(applyDrop(bars, d, { kind: 'chord', bar: 0, idx: 0 }), [['D'], ['C'], ['G']]);
  assert.deepEqual(applyDrop(bars, { ...d, copy: true }, { kind: 'chord', bar: 0, idx: 0 }), [['D'], ['C', 'D'], ['G']]);
  assert.deepEqual(applyDrop(bars, d, { kind: 'trash' }), [['G'], ['C'], ['G']]);
  assert.deepEqual(applyDrop(bars, d, d), bars);
  // moving the only chord out of a bar removes that bar
  assert.deepEqual(applyDrop(bars, { kind: 'chord', bar: 0, idx: 0 }, { kind: 'split', bar: 2 }), [['C', 'D'], ['G', 'G']]);
  assert.deepEqual(applyDrop(bars, { kind: 'chord', bar: 0, idx: 0 }, { kind: 'new' }), [['C', 'D'], ['G'], ['G']]);
  assert.deepEqual(removeBar(bars, 1), [['G'], ['G']]);
});
