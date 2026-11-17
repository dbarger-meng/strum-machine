// Practice heatmap for the fretboard trainer: per-position counts of misses and the time taken
// to find each place, and how they are binned into colours.

// Stored per position key "string:fret": { asked, misses, found, ms }.
//   asked:  questions where this place was one of the answers (finished questions only).
//   misses: of those, how often it was not found cleanly: a wrong tap came before finding it,
//           or it was revealed with Show me.
//   found:  how often it was found by tapping; ms is the total time those finds took.

export const MAX_FIND_MS = 30000; // longer looks are capped, so time away from the phone does not skew the average

// One blue, light to dark (checked with the dataviz validator against the fretboard wood).
export const HEAT_COLOURS = ['#5598e7', '#2a78d6', '#1c5cab', '#0d366b'];
export const HEAT_INK = ['#1b2b44', '#ffffff', '#ffffff', '#ffffff'];

/**
 * Add one finished question. places: [{ key, ms }] for every answer place, where ms is the time
 * it took to find (null when it was not found by tapping) and missed says a wrong tap came first.
 */
export function recordQuestion(heat, places) {
  const out = { ...heat };
  for (const { key, ms, missed } of places) {
    const h = { asked: 0, misses: 0, found: 0, ms: 0, ...out[key] };
    h.asked++;
    if (missed || ms === null) h.misses++;
    if (ms !== null) { h.found++; h.ms += Math.min(ms, MAX_FIND_MS); }
    out[key] = h;
  }
  return out;
}

/** The value shown for a place: misses, or the average seconds to find it (null when unknown). */
export function heatValue(h, metric) {
  if (!h || !h.asked) return null;
  if (metric === 'misses') return h.misses;
  return h.found ? h.ms / h.found / 1000 : null;
}

/** Which of the four colours a value gets, from the smallest to the largest shown (0 to 3). */
export function heatBin(value, lo, hi) {
  if (hi - lo < 1e-9) return value > 0 ? HEAT_COLOURS.length - 1 : 0;
  const t = (value - lo) / (hi - lo);
  return Math.min(HEAT_COLOURS.length - 1, Math.floor(t * HEAT_COLOURS.length));
}

/** The places that need the most work, worst first: most misses, or slowest to find. */
export function worstPlaces(heat, metric, count = 5) {
  return Object.entries(heat)
    .map(([key, h]) => ({ key, h, value: heatValue(h, metric) }))
    .filter((x) => x.value !== null && (metric !== 'misses' || x.value > 0))
    .sort((a, b) => b.value - a.value || b.h.asked - a.h.asked)
    .slice(0, count);
}
