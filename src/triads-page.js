// Triad shapes page: every close-voiced triad on a set of three strings, up the neck.

import { AudioEngine } from './audio.js?v=20';
import { renderNeck, playNotes } from './neck.js?v=20';
import {
  ROOTS, TRIADS, STRING_SETS, INVERSIONS, triadShapes, spellFrom, pretty,
} from './shapes.js?v=20';

const $ = (id) => document.getElementById(id);
const STORE = 'strumstudio.triads';
const engine = new AudioEngine();
const TONE_CLASS = ['root', 't1', 't2'];
const STEPS = [0, 2, 4];
const state = { root: 'G', quality: 'major', set: 'eBG', labels: 'notes', picked: null };

function load() {
  try { Object.assign(state, JSON.parse(localStorage.getItem(STORE)) || {}); } catch (e) { /* first visit */ }
  if (!ROOTS.some((r) => r.name === state.root)) state.root = 'G';
  if (!TRIADS[state.quality]) state.quality = 'major';
  if (!STRING_SETS.some((s) => s.id === state.set)) state.set = 'eBG';
  if (!['notes', 'tones'].includes(state.labels)) state.labels = 'notes';
  state.picked = null;
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify({ root: state.root, quality: state.quality, set: state.set, labels: state.labels })); } catch (e) { /* storage unavailable */ }
}

// Correct spellings like F♭ or C𝄪 puzzle players, so say which note they are.
const PLAIN = { 'F♭': 'E', 'C♭': 'B', 'E♯': 'F', 'B♯': 'C', 'C𝄪': 'D', 'D𝄪': 'E', 'F𝄪': 'G', 'G𝄪': 'A', 'A𝄪': 'B', 'B𝄫': 'A', 'E𝄫': 'D' };
const sameAs = (names) => {
  const odd = names.filter((n) => PLAIN[n]);
  return odd.length ? ` (${odd.map((n) => `${n} is the same note as ${PLAIN[n]}`).join(', ')})` : '';
};

function segmented(el, items, current, onPick) {
  el.innerHTML = '';
  for (const [value, text] of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(value === current));
    b.textContent = text;
    b.addEventListener('click', () => onPick(value));
    el.appendChild(b);
  }
}

function render() {
  const root = ROOTS.find((r) => r.name === state.root);
  const tri = TRIADS[state.quality];
  const names = tri.semis.map((s, i) => spellFrom(root.name, s, STEPS[i]));
  const strings = STRING_SETS.find((s) => s.id === state.set).strings;
  const shapes = triadShapes(root.pc, state.quality, strings);
  const label = (n) => (state.labels === 'notes' ? names[n.tone] : tri.tones[n.tone]);

  $('root').value = state.root;
  segmented($('quality'), Object.entries(TRIADS).map(([k, v]) => [k, v.label]), state.quality, (v) => { state.quality = v; state.picked = null; save(); render(); });
  segmented($('stringSet'), STRING_SETS.map((s) => [s.id, s.label]), state.set, (v) => { state.set = v; state.picked = null; save(); render(); });
  segmented($('labels'), [['notes', 'Notes'], ['tones', 'R 3 5']], state.labels, (v) => { state.labels = v; save(); render(); });
  $('triadInfo').textContent = `${pretty(root.name)} ${tri.label.toLowerCase()}: ${names.join(' ')}${sameAs(names)}`;

  const picked = state.picked !== null ? shapes[state.picked] : null;
  const marks = [];
  for (const s of shapes) {
    for (const n of s.notes) {
      const key = `${n.string}:${n.fret}`;
      if (marks.some((m) => `${m.string}:${m.fret}` === key)) continue;
      const inPicked = picked && picked.notes.some((p) => p.string === n.string && p.fret === n.fret);
      marks.push({ ...n, label: label(n), cls: `${TONE_CLASS[n.tone]}${picked && !inPicked ? ' faint' : ''}` });
    }
  }
  renderNeck($('neck'), { maxFret: 15, marks });

  const list = $('shapeList');
  list.innerHTML = '';
  shapes.forEach((s, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'shape-row';
    if (i === state.picked) b.setAttribute('aria-pressed', 'true');
    const where = s.low === s.high ? `fret ${s.low}` : `frets ${s.low} to ${s.high}`;
    b.innerHTML = '<span class="shape-name"></span><span class="shape-meta"></span>';
    b.querySelector('.shape-name').textContent = INVERSIONS[s.inversion];
    b.querySelector('.shape-meta').textContent = `${where} · ${s.notes.map((n) => names[n.tone]).join(' ')} (low to high)`;
    b.addEventListener('click', () => {
      state.picked = state.picked === i ? null : i;
      render();
      if (state.picked !== null) playNotes(engine, s.notes.map((n) => n.midi), { gap: 0.035, dur: 1.6 });
    });
    li.appendChild(b);
    list.appendChild(li);
  });
}

function init() {
  load();
  for (const r of ROOTS) $('root').add(new Option(pretty(r.name), r.name));
  $('root').addEventListener('change', () => { state.root = $('root').value; state.picked = null; save(); render(); });
  render();
  engine.preload();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
}

init();
