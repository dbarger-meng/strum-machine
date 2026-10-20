// Scale shapes page: a scale across the whole neck or one playing position at a time.

import { AudioEngine } from './audio.js?v=19';
import { renderNeck, playNotes } from './neck.js?v=19';
import {
  ROOTS, SCALES, scaleNames, scaleNotes, scalePositions, pretty,
} from './shapes.js?v=19';

const $ = (id) => document.getElementById(id);
const STORE = 'strumstudio.scales';
const engine = new AudioEngine();
const state = { key: 'G', scale: 'majorPent', view: 'all', labels: 'notes' };
let playing = null;

const HELP = {
  majorPent: 'The sound of a lot of bluegrass breaks. Five positions; each has two notes on every string.',
  minorPent: 'The bluesy five-note scale. These are the five standard boxes, two notes on every string.',
  blues: 'The minor pentatonic boxes plus the flat five, the blue note (shown in blue).',
  major: 'Seven positions, three notes on every string.',
  minor: 'Seven positions, three notes on every string.',
  mixolydian: 'A major scale with a flat seven: the sound of fiddle tunes like Old Joe Clark. Three notes per string.',
  dorian: 'A minor scale with a natural six, common in modal tunes like Shady Grove. Three notes per string.',
};

function load() {
  try { Object.assign(state, JSON.parse(localStorage.getItem(STORE)) || {}); } catch (e) { /* first visit */ }
  if (!ROOTS.some((r) => r.name === state.key)) state.key = 'G';
  if (!SCALES[state.scale]) state.scale = 'majorPent';
  if (!['notes', 'degrees'].includes(state.labels)) state.labels = 'notes';
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
}

function stopPlaying() {
  clearTimeout(playing);
  playing = null;
  engine.stopAll();
  $('playScale').textContent = 'Play it';
}

function render() {
  const root = ROOTS.find((r) => r.name === state.key);
  const def = SCALES[state.scale];
  const names = scaleNames(root.name, state.scale);
  const positions = scalePositions(root.pc, state.scale);
  if (state.view !== 'all' && !(+state.view < positions.length)) state.view = 'all';

  $('key').value = state.key;
  $('scale').value = state.scale;
  const view = $('view');
  view.innerHTML = '';
  view.add(new Option('Whole neck', 'all'));
  positions.forEach((p, i) => view.add(new Option(`Position ${i + 1} (frets ${p.low} to ${p.high})`, String(i))));
  view.value = state.view;
  const labelsEl = $('labels');
  labelsEl.innerHTML = '';
  for (const [v, t] of [['notes', 'Notes'], ['degrees', '1 2 3']]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(v === state.labels));
    b.textContent = t;
    b.addEventListener('click', () => { state.labels = v; save(); render(); });
    labelsEl.appendChild(b);
  }

  $('scaleInfo').textContent = `${pretty(root.name)} ${def.label.toLowerCase()}: ${names.join(' ')}`;
  $('scaleHelp').textContent = HELP[state.scale];
  const blue = state.scale === 'blues' ? 3 : -1;
  $('blueLegend').hidden = blue < 0;
  const cls = (n) => (n.degree === 0 ? 'root' : n.degree === blue ? 't1' : 'other');
  const label = (n) => (state.labels === 'notes' ? names[n.degree] : def.degrees[n.degree]);
  const pos = state.view === 'all' ? null : positions[+state.view];
  const inPos = (n) => pos && pos.notes.some((p) => p.string === n.string && p.fret === n.fret);
  const marks = scaleNotes(root.pc, state.scale).map((n) => ({ ...n, label: label(n), cls: `${cls(n)}${pos && !inPos(n) ? ' faint' : ''}` }));
  renderNeck($('neck'), { maxFret: 15, marks });
}

function playScale() {
  if (playing) { stopPlaying(); return; }
  const root = ROOTS.find((r) => r.name === state.key);
  let midis;
  if (state.view === 'all') {
    // Two octaves up from the lowest root on the low E string, and back down.
    const pcs = SCALES[state.scale].semis.map((s) => (root.pc + s) % 12);
    let m = 40;
    while (m % 12 !== root.pc) m++;
    const up = [];
    for (let x = m; x <= m + 24; x++) if (pcs.includes(x % 12)) up.push(x);
    midis = [...up, ...up.slice(0, -1).reverse()];
  } else {
    const up = scalePositions(root.pc, state.scale)[+state.view].notes.map((n) => n.midi);
    midis = [...up, ...up.slice(0, -1).reverse()];
  }
  const end = playNotes(engine, midis, { gap: 0.24, dur: 0.5 });
  $('playScale').textContent = 'Stop';
  playing = setTimeout(stopPlaying, (end - engine.ctx.currentTime) * 1000);
}

function init() {
  load();
  for (const r of ROOTS) $('key').add(new Option(pretty(r.name), r.name));
  for (const [k, v] of Object.entries(SCALES)) $('scale').add(new Option(v.label, k));
  $('key').addEventListener('change', () => { stopPlaying(); state.key = $('key').value; save(); render(); });
  $('scale').addEventListener('change', () => { stopPlaying(); state.scale = $('scale').value; state.view = 'all'; save(); render(); });
  $('view').addEventListener('change', () => { stopPlaying(); state.view = $('view').value; save(); render(); });
  $('playScale').addEventListener('click', playScale);
  render();
  engine.preload();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
}

init();
