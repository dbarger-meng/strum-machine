// Fretboard trainer page: draw a note on a treble staff, let the player tap it on the neck.

import { AudioEngine } from './audio.js?v=35';
import { GLYPHS } from './notation-glyphs.js?v=35';
import {
  STRINGS, positionsFor, spell, ledgerLines, nextQuestion, answersFor, noteLabel, judgeTap, positionKey, hasInlay,
} from './fretboard.js?v=35';

import { renderNeck } from './neck.js?v=35';
import {
  recordQuestion, heatValue, heatBin, worstPlaces, HEAT_COLOURS, HEAT_INK,
} from './heatmap.js?v=35';

const $ = (id) => document.getElementById(id);
const STORE = 'strumstudio.fretboard';
const SVG = 'http://www.w3.org/2000/svg';
const engine = new AudioEngine();

const settings = { maxFret: 12, strings: [0, 1, 2, 3, 4, 5], accidentals: false, anyOctave: false, showName: false, sound: true };
const stats = { right: 0, total: 0, streak: 0, best: 0 };
let question = null;
let missed = false;
let targets = []; // every place the current note is played on the chosen strings and frets
let found = new Set();
let locked = false;
let advanceTimer = null;
let heat = {}; // practice heatmap, by position key: see heatmap.js
let heatMetric = 'misses';
let shownAt = 0; // when the current note appeared
let lastFindAt = 0; // when the last place was found (or the note appeared)
let finds = {}; // this question: position key -> { ms, missed } for places found by tapping

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE));
    if (saved && saved.settings) Object.assign(settings, saved.settings);
    if (saved && Number.isInteger(saved.best)) stats.best = saved.best;
    if (saved && saved.heat && typeof saved.heat === 'object') heat = saved.heat;
    if (saved && ['misses', 'time'].includes(saved.heatMetric)) heatMetric = saved.heatMetric;
  } catch (e) { /* first visit */ }
  if (![4, 7, 12, 15].includes(settings.maxFret)) settings.maxFret = 12;
  settings.strings = (Array.isArray(settings.strings) ? settings.strings : []).filter((s) => s >= 0 && s <= 5);
  if (!settings.strings.length) settings.strings = [0, 1, 2, 3, 4, 5];
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify({ settings, best: stats.best, heat, heatMetric })); } catch (e) { /* storage unavailable */ }
}

const positions = () => positionsFor({ strings: settings.strings, maxFret: settings.maxFret });

// ---------- staff ----------
const HALF = 6; // pixels per staff step (half a space)
const SCALE = (2 * HALF) / 250; // glyph units to pixels: one staff space is 250 units
const yOf = (step) => 10 + (17 - step) * HALF;

function svgEl(name, attrs) {
  const n = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}
const glyph = (name, x, y) => svgEl('path', { d: GLYPHS[name].d, transform: `translate(${x} ${y}) scale(${SCALE} ${-SCALE})`, class: 'glyph' });

function drawStaff() {
  const svg = $('staff');
  svg.innerHTML = '';
  for (let s = 0; s <= 8; s += 2) svg.appendChild(svgEl('line', { x1: 4, x2: 216, y1: yOf(s), y2: yOf(s), class: 'staff-line' }));
  svg.appendChild(glyph('gClef', 10, yOf(2)));
  if (!question) return;
  const { written, step } = question;
  const headW = GLYPHS.noteheadWhole.advance * SCALE;
  const x = 132 - headW / 2;
  for (const l of ledgerLines(step)) {
    svg.appendChild(svgEl('line', { x1: x - 6, x2: x + headW + 6, y1: yOf(l), y2: yOf(l), class: 'staff-line' }));
  }
  svg.appendChild(glyph('noteheadWhole', x, yOf(step)));
  if (written.accidental) {
    const name = written.accidental === '#' ? 'accidentalSharp' : 'accidentalFlat';
    svg.appendChild(glyph(name, x - GLYPHS[name].advance * SCALE - 5, yOf(step)));
  }
  const label = noteLabel(written);
  svg.setAttribute('aria-label', `Treble staff showing ${label.replace('♯', ' sharp').replace('♭', ' flat')}`);
  $('noteName').textContent = label;
  $('noteName').hidden = !settings.showName;
}

// ---------- fretboard ----------
function drawFretboard() {
  const fb = $('fretboard');
  fb.innerHTML = '';
  fb.style.setProperty('--frets', settings.maxFret);
  STRINGS.forEach((st, row) => {
    const name = document.createElement('span');
    name.className = 'fb-name';
    name.textContent = st.name;
    fb.appendChild(name);
    for (let fret = 0; fret <= settings.maxFret; fret++) {
      const b = document.createElement('button');
      b.type = 'button';
      const on = settings.strings.includes(st.index);
      b.className = `fb-pos${fret === 0 ? ' open' : ''}${on ? '' : ' off'}${hasInlay(st.index, fret) ? ' inlay' : ''}`;
      b.disabled = !on;
      b.style.setProperty('--gauge', `${1 + row * 0.5}px`);
      b.dataset.s = st.index;
      b.dataset.f = fret;
      b.setAttribute('aria-label', `${st.name} string, ${fret === 0 ? 'open' : `fret ${fret}`}`);
      b.appendChild(document.createElement('span'));
      fb.appendChild(b);
    }
  });
  fb.appendChild(document.createElement('span'));
  for (let fret = 0; fret <= settings.maxFret; fret++) {
    const n = document.createElement('span');
    n.className = 'fb-num';
    n.textContent = fret;
    fb.appendChild(n);
  }
}

function cell(s, f) { return $('fretboard').querySelector(`.fb-pos[data-s="${s}"][data-f="${f}"]`); }
function clearMarks() { $('fretboard').querySelectorAll('.fb-pos').forEach((c) => c.classList.remove('hit', 'miss', 'answer')); }

// ---------- quiz ----------
function renderScore() {
  const pct = stats.total ? Math.round((100 * stats.right) / stats.total) : 0;
  $('score').textContent = `${stats.right} of ${stats.total} first try${stats.total ? ` (${pct}%)` : ''} · streak ${stats.streak} · best ${stats.best}`;
}

function newQuestion() {
  clearTimeout(advanceTimer);
  question = nextQuestion({ positions: positions(), naturalsOnly: !settings.accidentals, prev: question });
  targets = question ? answersFor(question, positions(), settings.anyOctave) : [];
  found = new Set();
  missed = false;
  locked = false;
  finds = {};
  shownAt = lastFindAt = performance.now();
  clearMarks();
  drawStaff();
  $('feedback').className = 'feedback';
  $('feedback').textContent = !question ? 'No notes to find with these settings. Pick more strings or frets.'
    : targets.length > 1 ? `Tap ${allOf(targets.length)} places this note is played.` : 'Tap the fretboard where this note is played.';
}

const progress = () => `${found.size} of ${targets.length} found`;
const allOf = (n) => (n === 2 ? 'both' : `all ${n}`);

function play(midi) {
  if (!settings.sound) return;
  const ctx = engine.ensure();
  engine.playPluck(midi, ctx.currentTime + 0.01, { vel: 0.9, dur: 1.4, release: 0.25, bright: 0.85 });
}

function finish(gotIt) {
  heat = recordQuestion(heat, targets.map((p) => {
    const f = finds[positionKey(p)];
    return { key: positionKey(p), ms: f ? f.ms : null, missed: f ? f.missed : true };
  }));
  renderHeat();
  stats.total++;
  if (gotIt) {
    stats.right++;
    stats.streak++;
    stats.best = Math.max(stats.best, stats.streak);
  } else stats.streak = 0;
  save();
  renderScore();
  locked = true;
}

function tap(s, f) {
  if (!question || locked) return;
  const midi = STRINGS.find((x) => x.index === s).open + f;
  play(midi);
  const c = cell(s, f);
  const flat = question.written.accidental === 'b';
  const name = noteLabel(question.written);
  const result = judgeTap(question, targets, found, { string: s, fret: f }, settings.anyOctave);
  if (result === 'again') return;
  if (result === 'wrong') {
    c.classList.add('miss');
    if (!missed) { missed = true; stats.streak = 0; renderScore(); }
    $('feedback').className = 'feedback bad';
    $('feedback').textContent = `That's ${noteLabel(spell(midi + 12, flat))}. Try again${targets.length > 1 ? ` (${progress()})` : ''}.`;
    return;
  }
  const now = performance.now();
  finds[positionKey({ string: s, fret: f })] = { ms: now - lastFindAt, missed };
  lastFindAt = now;
  c.classList.remove('miss');
  c.classList.add('hit');
  $('feedback').className = 'feedback good';
  if (result === 'found') {
    const left = targets.length - found.size;
    $('feedback').textContent = `Yes, that's ${name}. ${left} more to find (${progress()}).`;
    return;
  }
  const all = targets.length > 1 ? `${allOf(targets.length)} places for ${name}` : name;
  $('feedback').textContent = missed ? `That's ${all}.` : `Yes! ${all[0].toUpperCase()}${all.slice(1)}.`;
  finish(!missed);
  advanceTimer = setTimeout(newQuestion, 1100);
}

function showMe() {
  if (!question || locked) return;
  const left = targets.filter((p) => !found.has(positionKey(p)));
  for (const p of left) cell(p.string, p.fret).classList.add('answer');
  play(question.midi);
  $('feedback').className = 'feedback';
  $('feedback').textContent = targets.length > 1
    ? `${noteLabel(question.written)} is in ${targets.length} places${found.size ? `; you found ${found.size}` : ''}. Next note in a moment.`
    : `${noteLabel(question.written)} is here. Next note in a moment.`;
  finish(false);
  advanceTimer = setTimeout(newQuestion, 2200);
}

// ---------- practice heatmap ----------
const placeName = (key) => {
  const [s, f] = key.split(':').map(Number);
  const st = STRINGS.find((x) => x.index === s);
  return { st, fret: f, where: `${st.name} string, ${f === 0 ? 'open' : `fret ${f}`}`, note: noteLabel(spell(st.open + f + 12)) };
};
const seconds = (v) => `${v < 10 ? v.toFixed(1) : Math.round(v)}s`;

function renderHeat() {
  const fold = $('heatFold');
  for (const b of $('heatMetric').querySelectorAll('[data-metric]')) b.setAttribute('aria-checked', String(b.dataset.metric === heatMetric));
  const entries = Object.entries(heat).map(([key, h]) => ({ key, h, value: heatValue(h, heatMetric) })).filter((x) => x.value !== null);
  const practised = Object.values(heat).filter((h) => h.asked).length;
  $('heatSummary').textContent = practised ? `${practised} spot${practised === 1 ? '' : 's'} practised` : 'Starts filling in as you play';
  if (!fold.open) return;
  const misses = heatMetric === 'misses';
  $('heatHelp').textContent = misses
    ? 'How many times you missed each spot: a wrong tap before finding it, or Show me. Darker means more misses.'
    : 'Your average time to find each spot, in seconds, from when the note appeared (or from your last find). Darker means slower.';
  const shown = misses ? entries.filter((x) => x.value > 0) : entries;
  const lo = shown.length ? Math.min(...shown.map((x) => x.value)) : 0;
  const hi = shown.length ? Math.max(...shown.map((x) => x.value)) : 0;
  const marks = entries.map(({ key, h, value }) => {
    const { where, note } = placeName(key);
    const [string, fret] = key.split(':').map(Number);
    const avg = h.found ? ` Average time to find: ${seconds(h.ms / h.found / 1000)}.` : '';
    const title = `${where} (${note}): asked ${h.asked} time${h.asked === 1 ? '' : 's'}, missed ${h.misses}.${avg}`;
    if (misses && value === 0) return { string, fret, label: '0', cls: 'heat-zero', title };
    const bin = heatBin(value, lo, hi);
    // Dots are small on phones, so times show as a bare number; the legend and list say seconds.
    return { string, fret, label: misses ? String(value) : seconds(value).replace('s', ''), cls: 'heat', bg: HEAT_COLOURS[bin], fg: HEAT_INK[bin], title };
  });
  renderNeck($('heatNeck'), { maxFret: Math.max(settings.maxFret, ...entries.map((x) => +x.key.split(':')[1])), marks });

  const legend = $('heatLegend');
  legend.innerHTML = '';
  if (shown.length) {
    const fmt = misses ? (v) => String(Math.round(v)) : seconds;
    const lowLabel = document.createElement('span');
    lowLabel.textContent = `${misses ? 'Fewest' : 'Fastest'} (${fmt(lo)})`;
    legend.appendChild(lowLabel);
    for (const c of HEAT_COLOURS) {
      const sw = document.createElement('i');
      sw.style.background = c;
      legend.appendChild(sw);
    }
    const highLabel = document.createElement('span');
    highLabel.textContent = `${misses ? 'Most' : 'Slowest'} (${fmt(hi)})`;
    legend.appendChild(highLabel);
    if (misses && entries.some((x) => x.value === 0)) {
      const zero = document.createElement('span');
      zero.className = 'heat-zero-key';
      zero.textContent = 'Outlined: never missed';
      legend.appendChild(zero);
    }
  }

  const list = $('heatWorst');
  list.innerHTML = '';
  const worst = worstPlaces(heat, heatMetric);
  for (const { key, h, value } of worst) {
    const { where, note } = placeName(key);
    const li = document.createElement('li');
    li.textContent = misses
      ? `${where} (${note}): missed ${value} of ${h.asked} time${h.asked === 1 ? '' : 's'}`
      : `${where} (${note}): ${seconds(value)} on average, ${h.found} find${h.found === 1 ? '' : 's'}`;
    list.appendChild(li);
  }
  if (!worst.length) {
    const li = document.createElement('li');
    li.className = 'hint';
    li.textContent = entries.length ? 'Nothing missed yet.' : 'Play a few notes and your weak spots will show here.';
    list.appendChild(li);
  }
}

// ---------- settings ----------
function renderSettings() {
  $('fretRange').value = settings.maxFret;
  $('accidentals').checked = settings.accidentals;
  $('anyOctave').checked = settings.anyOctave;
  $('showName').checked = settings.showName;
  $('sound').checked = settings.sound;
  const pick = $('stringPick');
  pick.innerHTML = '';
  for (const st of STRINGS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.s = st.index;
    b.textContent = st.name;
    b.setAttribute('aria-pressed', String(settings.strings.includes(st.index)));
    b.setAttribute('aria-label', `${st.name} string`);
    pick.appendChild(b);
  }
  const strings = settings.strings.length === 6 ? 'all strings' : `${settings.strings.length} string${settings.strings.length === 1 ? '' : 's'}`;
  $('settingsSummary').textContent = `Frets 0 to ${settings.maxFret}, ${strings}${settings.accidentals ? ', sharps and flats' : ''}`;
}

function changedSettings() {
  save();
  renderSettings();
  drawFretboard();
  newQuestion();
}

function wire() {
  $('fretboard').addEventListener('click', (e) => {
    const b = e.target.closest('.fb-pos');
    if (b) tap(+b.dataset.s, +b.dataset.f);
  });
  $('showMe').addEventListener('click', showMe);
  $('skip').addEventListener('click', newQuestion);
  $('fretRange').addEventListener('change', () => { settings.maxFret = +$('fretRange').value; changedSettings(); });
  $('stringPick').addEventListener('click', (e) => {
    const b = e.target.closest('[data-s]');
    if (!b) return;
    const s = +b.dataset.s;
    const on = settings.strings.includes(s);
    if (on && settings.strings.length === 1) return; // keep at least one string
    settings.strings = on ? settings.strings.filter((x) => x !== s) : [...settings.strings, s].sort();
    changedSettings();
  });
  for (const id of ['accidentals', 'anyOctave']) $(id).addEventListener('change', () => { settings[id] = $(id).checked; changedSettings(); });
  $('showName').addEventListener('change', () => { settings.showName = $('showName').checked; save(); renderSettings(); $('noteName').hidden = !settings.showName; });
  $('sound').addEventListener('change', () => { settings.sound = $('sound').checked; save(); renderSettings(); });
  $('resetScore').addEventListener('click', () => {
    Object.assign(stats, { right: 0, total: 0, streak: 0, best: 0 });
    save();
    renderScore();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && locked) newQuestion();
  });
  $('heatFold').addEventListener('toggle', renderHeat);
  $('heatMetric').addEventListener('click', (e) => {
    const b = e.target.closest('[data-metric]');
    if (!b) return;
    heatMetric = b.dataset.metric;
    save();
    renderHeat();
  });
  $('clearHeat').addEventListener('click', () => {
    if (!Object.keys(heat).length || !window.confirm('Clear the practice heatmap?')) return;
    heat = {};
    save();
    renderHeat();
  });
}

function init() {
  load();
  renderSettings();
  drawFretboard();
  wire();
  newQuestion();
  renderScore();
  renderHeat();
  engine.preload();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
}

init();
