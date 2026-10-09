import test from 'node:test';
import assert from 'node:assert/strict';
import {
  paletteFor, chordName, barsFromChart, chartFromBars, chartKey, applyDrop, removeBar, MAX_CHORDS_PER_BAR,
} from '../src/chart-edit.js';

const names = (tonic, type) => paletteFor(tonic, type).map((c) => c.name);

test('palette runs I to VII in order, in key or all one chord type', () => {
  assert.deepEqual(names(7), ['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F', 'F#dim']);
  assert.deepEqual(paletteFor(7).map((c) => c.roman), ['I', 'ii', 'iii', 'IV', 'V', 'vi', '♭VII', 'vii°']);
  assert.deepEqual(names(7, ''), ['G', 'A', 'B', 'C', 'D', 'E', 'F', 'F#']);
  assert.deepEqual(names(7, '7'), ['G7', 'A7', 'B7', 'C7', 'D7', 'E7', 'F7', 'F#7']);
  assert.deepEqual(paletteFor(7, 'dim').map((c) => c.roman).slice(0, 2), ['i°', 'ii°']);
  assert.deepEqual(names(5).slice(0, 4), ['F', 'Gm', 'Am', 'Bb']);
  assert.equal(names(0)[6], 'Bb'); // flat seven is spelled flat even in sharp keys
  assert.equal(chordName(10, 'dim', true), 'Bbdim');
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
