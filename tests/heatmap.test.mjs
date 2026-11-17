import test from 'node:test';
import assert from 'node:assert/strict';
import { recordQuestion, heatValue, heatBin, worstPlaces, MAX_FIND_MS, HEAT_COLOURS } from '../src/heatmap.js';

test('each finished question adds to every place that was an answer', () => {
  let heat = {};
  heat = recordQuestion(heat, [{ key: '1:3', ms: 2000, missed: false }, { key: '0:8', ms: 3000, missed: true }]);
  heat = recordQuestion(heat, [{ key: '1:3', ms: 1000, missed: false }, { key: '0:8', ms: null, missed: false }]); // Show me
  assert.deepEqual(heat['1:3'], { asked: 2, misses: 0, found: 2, ms: 3000 });
  assert.deepEqual(heat['0:8'], { asked: 2, misses: 2, found: 1, ms: 3000 });
  assert.equal(heatValue(heat['1:3'], 'misses'), 0);
  assert.equal(heatValue(heat['1:3'], 'time'), 1.5);
  assert.equal(heatValue(heat['0:8'], 'misses'), 2);
  assert.equal(heatValue(heat['0:8'], 'time'), 3);
  assert.equal(heatValue(undefined, 'misses'), null);
  assert.equal(heatValue({ asked: 1, misses: 1, found: 0, ms: 0 }, 'time'), null); // never found by tapping
});

test('long looks are capped and the input is not changed', () => {
  const before = {};
  const heat = recordQuestion(before, [{ key: '2:5', ms: 120000, missed: false }]);
  assert.equal(heat['2:5'].ms, MAX_FIND_MS);
  assert.deepEqual(before, {});
});

test('values are spread over the four colours, smallest to largest', () => {
  assert.equal(HEAT_COLOURS.length, 4);
  assert.deepEqual([0, 1, 2, 3, 4].map((v) => heatBin(v, 0, 4)), [0, 1, 2, 3, 3]);
  assert.equal(heatBin(1.2, 1.2, 1.2), 3); // one value only: show it at full strength
  assert.equal(heatBin(0, 0, 0), 0);
});

test('worst places come first, and places never missed are not listed under misses', () => {
  const heat = {
    '0:3': { asked: 4, misses: 3, found: 2, ms: 9000 },
    '1:5': { asked: 5, misses: 1, found: 5, ms: 5000 },
    '2:7': { asked: 2, misses: 0, found: 2, ms: 9000 },
  };
  assert.deepEqual(worstPlaces(heat, 'misses').map((x) => x.key), ['0:3', '1:5']);
  assert.deepEqual(worstPlaces(heat, 'time').map((x) => x.key), ['0:3', '2:7', '1:5']);
});
