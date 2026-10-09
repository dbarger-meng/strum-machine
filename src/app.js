// UI, scheduling and import flow.

import { AudioEngine } from './audio.js?v=4';
import { FLAT_MAJOR_TONICS, keyMajorTonic, mod12, parseChord, pcName, transposeChord, detectChords } from './music.js?v=4';
import {
  CELLS, barLength, buildEvents, chordsToChart, defaultCells, formatChart, parseChart, presetsFor, resampleCells,
} from './song.js?v=4';
import { parseAny } from './parsers.js?v=4';
import {
  CHORD_TYPES, MAX_CHORDS_PER_BAR, applyDrop, barsFromChart, chartFromBars, chartKey, chordName, keyUsesFlats,
  paletteFor, removeBar,
} from './chart-edit.js?v=4';

const $ = (id) => document.getElementById(id);
const el = new Proxy({}, { get: (t, k) => t[k] || (t[k] = $(k)) });
const engine = new AudioEngine();

const DEFAULT_CHART = '| G | G | C | G |\n| G | C | D | G |';
const state = {
  tempo: 110,
  ts: '4/4',
  sub: 2,
  cells: defaultCells(4, 2),
  chart: DEFAULT_CHART,
  transpose: 0,
  swing: 0,
  human: 25,
  bassRuns: 'some',
  inst: 'fiddle',
  tool: 'C',
  melody: null, // { notes, totalBeats, title }
  loop: true,
  countIn: false,
  metro: false,
  melodyOn: true,
  strumOn: true,
  vol: { guitar: 80, bass: 90, melody: 60 },
  paletteKey: 7,
  paletteType: 'key', // 'key' (each chord as it falls in the key) or a chord type for every chip
  placing: null, // chord name picked by tapping a chip, placed by tapping bars
};
let track = { events: [], loopLen: 0, barLen: 4, totalBars: 0, chordBars: [] };
let lastImport = null;

const parseTimeSig = (s) => { const [num, den] = s.split('/').map(Number); return { num, den }; };
const timeSig = () => parseTimeSig(state.ts);
const barLen = () => barLength(timeSig());

// ---------- persistence ----------
const STORE = 'strumstudio.session';
const PATTERNS = 'strumstudio.patterns';
const FOLDS = 'strumstudio.open';
const INSTALL_HINT = 'strumstudio.installHint';
const PERSIST = ['tempo', 'ts', 'sub', 'cells', 'chart', 'transpose', 'swing', 'human', 'bassRuns', 'inst', 'loop', 'countIn', 'metro', 'vol', 'paletteKey', 'paletteType'];
let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE, JSON.stringify(Object.fromEntries(PERSIST.map((k) => [k, state[k]])))); } catch (e) { /* storage unavailable */ }
  }, 300);
}
function restore(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const k of PERSIST) if (k in obj) state[k] = obj[k];
  if (!Number.isInteger(state.paletteKey) || state.paletteKey < 0 || state.paletteKey > 11) state.paletteKey = chartKey(barsFromChart(state.chart));
  if (state.paletteType !== 'key' && !CHORD_TYPES.some((t) => t.id === state.paletteType)) state.paletteType = 'key';
  const n = Math.round(barLen() * state.sub);
  if (!Array.isArray(state.cells) || state.cells.length !== n || state.cells.some((c) => !(c in CELLS))) state.cells = defaultCells(barLen(), state.sub);
}
function loadInitial() {
  try {
    if (location.hash.length > 1) {
      restore(JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(1))))));
      return;
    }
  } catch (e) { /* ignore a bad share link */ }
  try { restore(JSON.parse(localStorage.getItem(STORE))); } catch (e) { /* first visit */ }
}

// ---------- controls ----------
function fillStaticSelects() {
  el.transpose.innerHTML = '';
  for (let n = -6; n <= 6; n++) el.transpose.add(new Option(n === 0 ? 'Original key' : `${n > 0 ? '+' : ''}${n} semitones`, n));
  el.capo.innerHTML = '';
  for (let n = 0; n <= 7; n++) el.capo.add(new Option(n === 0 ? 'No capo' : `Capo ${n}`, n));
  el.paletteKey.innerHTML = '';
  el.otherRoot.innerHTML = '';
  for (let pc = 0; pc < 12; pc++) {
    el.paletteKey.add(new Option(`Key of ${pcName(pc, keyUsesFlats(pc))}`, pc));
    el.otherRoot.add(new Option(pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10 ? `${pcName(pc)} / ${pcName(pc, true)}` : pcName(pc), pc));
  }
  el.otherType.innerHTML = '';
  for (const t of CHORD_TYPES) el.otherType.add(new Option(t.name, t.id));
}

function syncControls() {
  el.tempo.value = el.tempoNum.value = state.tempo;
  el.transpose.value = state.transpose;
  if (![...el.timeSig.options].some((o) => o.value === state.ts)) el.timeSig.add(new Option(state.ts, state.ts));
  el.timeSig.value = state.ts;
  el.sub.value = state.sub;
  el.swing.value = state.swing;
  el.human.value = state.human;
  el.bassRuns.value = state.bassRuns;
  el.inst.value = state.inst;
  el.loop.checked = state.loop;
  el.countIn.checked = state.countIn;
  el.metro.checked = state.metro;
  el.melodyOn.checked = state.melodyOn;
  el.strumOn.checked = state.strumOn;
  el.paletteKey.value = state.paletteKey;
  el.otherRoot.value = state.paletteKey;
  el.vGuitar.value = state.vol.guitar;
  el.vBass.value = state.vol.bass;
  el.vMelody.value = state.vol.melody;
  applyVolumes();
}

function applyVolumes() {
  engine.setVolume('guitar', state.vol.guitar / 100);
  engine.setVolume('bass', state.vol.bass / 100);
  engine.setVolume('melody', state.vol.melody / 100);
}

// ---------- pattern editor ----------
function stepLabel(i) {
  const pos = i / state.sub;
  if (Math.abs(pos - Math.round(pos)) < 1e-9) return { text: String(Math.round(pos) + 1), beat: true };
  const frac = pos - Math.floor(pos);
  if (Math.abs(frac - 0.5) < 1e-9) return { text: '&', beat: false };
  return { text: frac < 0.5 ? 'e' : 'a', beat: false };
}

function renderPalette() {
  el.palette.innerHTML = '';
  const colors = { R: 'var(--bass)', F: 'var(--fifth)', C: 'var(--chuck)', D: 'var(--down)', U: 'var(--up)', X: 'var(--chop)', '.': '#9aa093' };
  for (const [key, info] of Object.entries(CELLS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tool';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(state.tool === key));
    b.dataset.tool = key;
    b.title = `${info.help} (key: ${info.key})`;
    b.innerHTML = `<span class="chip" style="background:${colors[key]};${key === 'U' ? 'color:var(--ink)' : ''}">${info.glyph}</span>${info.name}`;
    b.addEventListener('click', () => setTool(key));
    el.palette.appendChild(b);
  }
  el.toolHelp.textContent = `${CELLS[state.tool].name}: ${CELLS[state.tool].help}. Click or drag across the grid to paint. Right-click clears a cell.`;
}

function setTool(key) {
  state.tool = key;
  renderPalette();
}

let painting = false;
function paint(i, toggle) {
  const next = toggle && state.cells[i] === state.tool ? '.' : state.tool;
  if (state.cells[i] === next) return;
  state.cells[i] = next;
  changed({ grid: true });
}

function renderGrid() {
  const n = state.cells.length;
  el.grid.className = `grid sub${state.sub}`;
  el.grid.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
  el.grid.innerHTML = '';
  state.cells.forEach((c, i) => {
    const lab = stepLabel(i);
    const slot = document.createElement('div');
    slot.className = 'slot';
    const l = document.createElement('span');
    l.className = 'label' + (lab.beat ? ' beat' : '');
    l.textContent = lab.text;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cell ' + (c === '.' ? 't-rest' : 't-' + c);
    b.dataset.i = i;
    b.textContent = CELLS[c].glyph;
    b.setAttribute('aria-label', `Step ${lab.text}: ${CELLS[c].name}`);
    b.addEventListener('pointerdown', (e) => { if (e.button === 0) { painting = true; paint(i, true); } });
    b.addEventListener('pointerenter', (e) => { if (painting && e.buttons === 1) paint(i, false); });
    b.addEventListener('click', (e) => { if (e.detail === 0) paint(i, true); });
    b.addEventListener('contextmenu', (e) => { e.preventDefault(); state.cells[i] = '.'; changed({ grid: true }); });
    slot.append(l, b);
    el.grid.appendChild(slot);
  });
}
window.addEventListener('pointerup', () => { painting = false; });

function renderPresetSelect() {
  const presets = presetsFor(barLen());
  el.preset.innerHTML = '';
  let matched = false;
  for (const p of presets) {
    const o = new Option(p.name, p.id);
    if (resampleCells(p.cells, 2, state.sub).join('') === state.cells.join('')) { o.selected = true; matched = true; }
    el.preset.add(o);
  }
  if (!matched) {
    el.preset.add(new Option('Custom pattern', 'custom'), 0);
    el.preset.value = 'custom';
  }
  el.patternSummary.textContent = `${el.preset.selectedOptions[0].text}, ${state.ts}`;
}

function renderSaved() {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(PATTERNS)) || []; } catch (e) { /* none */ }
  el.saved.innerHTML = '';
  el.saved.add(new Option(list.length ? 'Saved patterns' : 'No saved patterns yet', ''));
  list.forEach((p, i) => el.saved.add(new Option(`${p.name} (${p.ts})`, i)));
}

// ---------- chart ----------
function parsedChart() { return parseChart(state.chart); }
const chartBars = () => barsFromChart(state.chart);

function flatsFor(bars) {
  const first = bars.find((b) => b.names.length);
  const c = first && parseChord(first.names[0]);
  return c ? FLAT_MAJOR_TONICS.has(mod12(keyMajorTonic(c) + state.transpose)) : false;
}

function setChartBars(bars) {
  state.chart = chartFromBars(bars);
  changed();
}

function chipEl(name, roman, drag) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip-chord';
  b.dataset.drag = drag;
  b.dataset.name = name;
  b.setAttribute('aria-pressed', String(state.placing === name));
  b.title = `Drag ${name} into a bar, or tap it and then tap bars`;
  b.innerHTML = `<span class="chip-name"></span>${roman ? '<span class="chip-roman"></span>' : ''}`;
  b.querySelector('.chip-name').textContent = name;
  if (roman) b.querySelector('.chip-roman').textContent = roman;
  return b;
}

function renderChordPalette() {
  el.chordPalette.innerHTML = '';
  for (const b of el.chordType.querySelectorAll('[data-type]')) b.setAttribute('aria-checked', String(b.dataset.type === state.paletteType));
  for (const c of paletteFor(state.paletteKey, state.paletteType)) el.chordPalette.appendChild(chipEl(c.name, c.roman, 'palette'));
  const root = +el.otherRoot.value;
  const name = chordName(root, el.otherType.value, keyUsesFlats(state.paletteKey) || keyUsesFlats(root));
  el.otherChip.innerHTML = '';
  el.otherChip.appendChild(chipEl(name, '', 'palette'));
  el.chartView.classList.toggle('placing', !!state.placing);
  el.chartHint.textContent = state.placing
    ? `Tap bars to put ${state.placing} in them. Tap ${state.placing} again or press Escape to stop.`
    : 'Drag a chord onto a bar to set it, or onto the + to share the bar. Drag a chord in the chart to move it, or to the bin below to remove it.';
}

function renderChart() {
  const { bars, bad } = parsedChart();
  el.chartWarn.textContent = bad.length ? `Not recognized as chords: ${[...new Set(bad)].join(', ')}` : '';
  const flats = flatsFor(bars);
  el.chartView.innerHTML = '';
  bars.forEach((b, i) => {
    const d = document.createElement('div');
    d.className = 'bar';
    d.dataset.bar = i;
    d.dataset.drop = 'bar';
    const num = document.createElement('span');
    num.className = 'bar-num';
    num.textContent = i + 1;
    d.appendChild(num);
    const chords = document.createElement('div');
    chords.className = 'bar-chords';
    b.names.forEach((name, j) => {
      const p = document.createElement('button');
      p.type = 'button';
      p.className = 'pill';
      p.dataset.drag = 'chord';
      p.dataset.drop = 'chord';
      p.dataset.bar = i;
      p.dataset.idx = j;
      p.textContent = name;
      const sounds = transposeChord(name, state.transpose, flats);
      if (state.transpose) {
        const s = document.createElement('small');
        s.textContent = sounds;
        p.appendChild(s);
      }
      p.setAttribute('aria-label', `Bar ${i + 1}, ${name}${state.transpose ? `, sounds as ${sounds}` : ''}. Delete removes it.`);
      chords.appendChild(p);
    });
    if (b.names.length < MAX_CHORDS_PER_BAR) {
      const sp = document.createElement('button');
      sp.type = 'button';
      sp.className = 'split';
      sp.dataset.drop = 'split';
      sp.dataset.bar = i;
      sp.textContent = '+';
      sp.setAttribute('aria-label', `Add a chord to bar ${i + 1}`);
      chords.appendChild(sp);
    }
    d.appendChild(chords);
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'bar-del';
    del.dataset.del = i;
    del.textContent = '×';
    del.title = `Remove bar ${i + 1}`;
    del.setAttribute('aria-label', `Remove bar ${i + 1}`);
    d.appendChild(del);
    el.chartView.appendChild(d);
  });
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'bar add-bar';
  add.dataset.drop = 'new';
  add.textContent = bars.length ? '+ Add bar' : 'Drag a chord here to start';
  el.chartView.appendChild(add);
  const n = track.totalBars || bars.length;
  el.keyInfo.textContent = bars.length ? `${bars.length} bar${bars.length === 1 ? '' : 's'}, ${n === bars.length ? 'one pass' : `${n} bars with the melody`}` : '';
  renderChordPalette();
}

function targetOf(node) {
  const t = node && node.closest('[data-drop]');
  if (!t) return null;
  const kind = t.dataset.drop;
  if (kind === 'trash' || kind === 'new') return { kind, node: t };
  return { kind, bar: +t.dataset.bar, idx: +t.dataset.idx, node: t };
}

function sourceOf(node) {
  return node.dataset.drag === 'chord'
    ? { kind: 'chord', bar: +node.dataset.bar, idx: +node.dataset.idx }
    : { kind: 'palette', name: node.dataset.name };
}

function setPlacing(name) {
  state.placing = name;
  renderChordPalette();
}

// Pointer-based drag so it works the same with a mouse, a pen or a finger.
let drag = null;
let swallowClick = false;
function dragMove(e) {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.ghost) {
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
    drag.ghost = document.createElement('div');
    drag.ghost.className = 'drag-ghost';
    drag.ghost.textContent = drag.src.dataset.name || drag.src.firstChild.textContent;
    document.body.appendChild(drag.ghost);
    document.body.classList.add('dragging');
    if (drag.source.kind === 'chord') document.body.classList.add('dragging-chord');
    drag.src.classList.add('lifted');
  }
  e.preventDefault();
  drag.cx = e.clientX;
  drag.cy = e.clientY;
  drag.ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  updateOver();
  if (!drag.raf) drag.raf = requestAnimationFrame(autoScroll);
}
function updateOver() {
  const t = targetOf(document.elementFromPoint(drag.cx, drag.cy));
  const node = t && (t.kind !== 'trash' || drag.source.kind === 'chord') ? t.node : null;
  if (node !== drag.over) {
    if (drag.over) drag.over.classList.remove('drop-over');
    if (node) node.classList.add('drop-over');
    drag.over = node;
  }
}
// Scroll the page while a chord is held near the top or bottom edge, so far bars and the bin can be reached.
function autoScroll() {
  if (!drag || !drag.ghost) return;
  const top = Math.max(0, document.querySelector('.transport').getBoundingClientRect().bottom) + 50;
  const bottom = window.innerHeight - 50;
  const dy = drag.cy < top ? -Math.min(16, top - drag.cy) : drag.cy > bottom ? Math.min(16, drag.cy - bottom) : 0;
  if (dy) {
    window.scrollBy(0, dy);
    updateOver();
  }
  drag.raf = requestAnimationFrame(autoScroll);
}
function dragEnd(e, cancelled) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  if (!d.ghost) return;
  swallowClick = true;
  setTimeout(() => { swallowClick = false; }, 0);
  cancelAnimationFrame(d.raf);
  d.ghost.remove();
  d.src.classList.remove('lifted');
  if (d.over) d.over.classList.remove('drop-over');
  document.body.classList.remove('dragging', 'dragging-chord');
  if (cancelled || !d.over) return;
  const t = targetOf(d.over);
  setChartBars(applyDrop(chartBars(), { ...d.source, copy: e.altKey || e.ctrlKey || e.metaKey }, t));
}

function wireChart() {
  document.addEventListener('pointerdown', (e) => {
    const src = e.target.closest('[data-drag]');
    if (!src || e.button !== 0 || drag) return;
    drag = { src, source: sourceOf(src), x: e.clientX, y: e.clientY, id: e.pointerId, ghost: null, over: null, raf: 0, cx: e.clientX, cy: e.clientY };
  });
  window.addEventListener('pointermove', dragMove, { passive: false });
  window.addEventListener('pointerup', (e) => dragEnd(e, false));
  window.addEventListener('pointercancel', (e) => dragEnd(e, true));

  // Tap to pick a chord, then tap bars to place it.
  el.chordPalette.addEventListener('click', onChipClick);
  el.otherChip.addEventListener('click', onChipClick);
  function onChipClick(e) {
    const chip = e.target.closest('[data-drag="palette"]');
    if (!chip || swallowClick) return;
    setPlacing(state.placing === chip.dataset.name ? null : chip.dataset.name);
  }
  el.chartView.addEventListener('click', (e) => {
    if (swallowClick) return;
    const del = e.target.closest('[data-del]');
    if (del) { setChartBars(removeBar(chartBars(), +del.dataset.del)); return; }
    const t = targetOf(e.target);
    if (!t) return;
    if (state.placing) {
      setChartBars(applyDrop(chartBars(), { kind: 'palette', name: state.placing }, t));
    } else if (t.kind === 'new') {
      const bars = chartBars();
      const last = bars[bars.length - 1];
      setChartBars([...bars, [last ? last[last.length - 1] : paletteFor(state.paletteKey)[0].name]]);
    }
  });
  el.chartView.addEventListener('keydown', (e) => {
    const p = e.target.closest('.pill');
    if (!p || (e.key !== 'Delete' && e.key !== 'Backspace')) return;
    e.preventDefault();
    setChartBars(applyDrop(chartBars(), sourceOf(p), { kind: 'trash' }));
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.placing) setPlacing(null); });

  el.paletteKey.addEventListener('change', () => {
    state.paletteKey = +el.paletteKey.value;
    el.otherRoot.value = state.paletteKey;
    if (state.placing) state.placing = null;
    renderChordPalette();
    persist();
  });
  el.chordType.addEventListener('click', (e) => {
    const b = e.target.closest('[data-type]');
    if (!b) return;
    state.paletteType = b.dataset.type;
    state.placing = null;
    renderChordPalette();
    persist();
  });
  el.otherRoot.addEventListener('change', renderChordPalette);
  el.otherType.addEventListener('change', renderChordPalette);
  el.clearChart.addEventListener('click', () => {
    if (!chartBars().length || !window.confirm('Remove every bar from the chord chart?')) return;
    setChartBars([]);
  });
}

// ---------- folds ----------
function wireFolds() {
  let open = {};
  try { open = JSON.parse(localStorage.getItem(FOLDS)) || {}; } catch (e) { /* none */ }
  for (const id of ['patternFold', 'tuneFold']) {
    el[id].open = !!open[id];
    el[id].addEventListener('toggle', () => {
      open[id] = el[id].open;
      try { localStorage.setItem(FOLDS, JSON.stringify(open)); } catch (e) { /* storage unavailable */ }
    });
  }
}

// ---------- melody roll ----------
const PX_PER_BEAT = 34;
function drawRoll(playBeat) {
  if (!state.melody) return;
  const canvas = el.roll;
  const ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return;
  const L = Math.max(track.loopLen, state.melody.totalBeats, barLen());
  const w = Math.max(el.rollWrap.clientWidth || 600, Math.ceil(L * PX_PER_BEAT) + 2);
  const h = 150;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const notes = state.melody.notes;
  const lo = Math.min(...notes.map((n) => n.midi)) - 1;
  const hi = Math.max(...notes.map((n) => n.midi)) + 1;
  const rowH = Math.min(12, (h - 20) / (hi - lo + 1));
  const bl = barLen();
  ctx.font = '11px system-ui, sans-serif';
  for (let b = 0; b * bl <= L + 1e-6; b++) {
    const x = b * bl * PX_PER_BEAT;
    ctx.fillStyle = '#d5d8cf';
    ctx.fillRect(x, 0, 1, h);
    ctx.fillStyle = '#55627a';
    ctx.fillText(String(b + 1), x + 4, 12);
  }
  ctx.fillStyle = '#1b2b44';
  for (const n of notes) {
    const y = 18 + (hi - n.midi) * rowH;
    ctx.fillRect(n.start * PX_PER_BEAT, y, Math.max(2, n.dur * PX_PER_BEAT - 1), Math.max(3, rowH - 1));
  }
  if (playBeat !== null && playBeat !== undefined && playBeat >= 0) {
    const x = playBeat * PX_PER_BEAT;
    ctx.fillStyle = '#a8761a';
    ctx.fillRect(x - 1, 0, 2, h);
    const wrap = el.rollWrap;
    if (x < wrap.scrollLeft + 20 || x > wrap.scrollLeft + wrap.clientWidth - 40) wrap.scrollLeft = Math.max(0, x - 40);
  }
}

// ---------- rebuild ----------
function rebuild() {
  const { bars } = parsedChart();
  track = buildEvents({
    bars, timeSig: timeSig(), pattern: { cells: state.cells }, transpose: state.transpose,
    flats: flatsFor(bars), bassRuns: state.bassRuns, swing: state.swing / 100, melody: state.melody,
  });
  renderChart();
  drawRoll();
}

function changed({ grid = false, patternList = false, full = false } = {}) {
  if (grid || full) renderGrid();
  if (grid || patternList || full) renderPresetSelect();
  rebuild();
  persist();
}

// ---------- playback ----------
const play = { on: false, timer: null, anchorTime: 0, anchorBeat: 0, scheduledTo: 0, raf: 0 };
const spb = () => 60 / state.tempo;
const beatAt = (t) => play.anchorBeat + (t - play.anchorTime) / spb();
const timeOf = (b) => play.anchorTime + (b - play.anchorBeat) * spb();

function eventsInRange(b0, b1) {
  const out = [];
  const L = track.loopLen;
  const bl = track.barLen;
  for (let b = Math.ceil(b0 - 1e-9); b < b1 - 1e-9; b++) {
    if (b < 0 || (state.metro && (state.loop || b < L))) {
      out.push({ beat: b, kind: 'click', accent: Math.abs(mod(b, bl)) < 1e-6 });
    }
  }
  if (b1 > 0 && L > 0) {
    for (let k = Math.floor(Math.max(b0, 0) / L); k * L < b1; k++) {
      if (!state.loop && k > 0) break;
      for (const ev of track.events) {
        const b = ev.beat + k * L;
        if (b >= b1) break;
        if (b >= b0) out.push({ ...ev, beat: b });
      }
    }
  }
  return out;
}
const mod = (n, m) => ((n % m) + m) % m;

function scheduleEvent(ev) {
  const ctx = engine.ctx;
  const h = state.human / 100;
  const t = Math.max(ctx.currentTime, timeOf(ev.beat) + (Math.random() - 0.5) * 2 * h * 0.012);
  const vel = (ev.vel || 0.7) * (1 + (Math.random() - 0.5) * h * 0.3);
  const sec = (ev.dur || 0.5) * spb();
  switch (ev.kind) {
    case 'click': engine.click(t, ev.accent); break;
    case 'strum': if (state.strumOn) engine.strum(ev.notes, t, { dir: ev.dir, vel, dur: sec, spread: ev.spread }); break;
    case 'bass': if (state.strumOn) engine.bass(ev.notes[0], t, { vel, dur: sec }); break;
    case 'chop': if (state.strumOn) engine.chop(ev.notes, t, { vel }); break;
    case 'melody': if (state.melodyOn) engine.melody(ev.midi, t, sec * 0.97, vel, state.inst); break;
    default: break;
  }
}

function tick() {
  const horizon = beatAt(engine.ctx.currentTime + 0.3);
  if (horizon <= play.scheduledTo) return;
  for (const ev of eventsInRange(play.scheduledTo, horizon)) scheduleEvent(ev);
  play.scheduledTo = horizon;
}

function startPlay() {
  if (!track.loopLen) {
    showMsg('Add some chords to the chart or load a tune first.', true);
    return;
  }
  const ctx = engine.ensure();
  applyVolumes();
  const count = state.countIn ? Math.ceil(track.barLen) : 0;
  play.anchorBeat = -count;
  play.anchorTime = ctx.currentTime + 0.08;
  play.scheduledTo = -count;
  play.on = true;
  play.timer = setInterval(tick, 25);
  tick();
  el.play.textContent = 'Stop';
  el.play.setAttribute('aria-pressed', 'true');
  play.raf = requestAnimationFrame(frame);
}

function stopPlay() {
  clearInterval(play.timer);
  cancelAnimationFrame(play.raf);
  play.on = false;
  if (engine.ctx) engine.stopAll();
  el.play.textContent = 'Play';
  el.play.setAttribute('aria-pressed', 'false');
  markNow(null, null);
  drawRoll();
}

function markNow(step, bar) {
  el.grid.querySelectorAll('.cell.now').forEach((c) => c.classList.remove('now'));
  el.chartView.querySelectorAll('.bar.now').forEach((c) => c.classList.remove('now'));
  if (step !== null) { const c = el.grid.querySelector(`.cell[data-i="${step}"]`); if (c) c.classList.add('now'); }
  if (bar !== null) { const b = el.chartView.querySelector(`.bar[data-bar="${bar}"]`); if (b) b.classList.add('now'); }
}

let lastMark = '';
function frame() {
  if (!play.on) return;
  const beat = beatAt(engine.ctx.currentTime);
  const L = track.loopLen;
  if (!state.loop && beat > L + 0.5) { stopPlay(); return; }
  if (beat >= 0) {
    const pos = state.loop ? mod(beat, L) : Math.min(beat, L - 1e-6);
    const bl = track.barLen;
    const bar = Math.floor(pos / bl);
    const step = Math.min(state.cells.length - 1, Math.floor((mod(pos, bl) / bl) * state.cells.length));
    const key = `${bar}:${step}`;
    if (key !== lastMark) { lastMark = key; markNow(step, bar); }
    drawRoll(pos);
  }
  play.raf = requestAnimationFrame(frame);
}

function setTempo(v) {
  const t = Math.max(50, Math.min(220, Math.round(v) || 110));
  if (play.on) {
    play.anchorBeat = beatAt(engine.ctx.currentTime);
    play.anchorTime = engine.ctx.currentTime;
  }
  state.tempo = t;
  el.tempo.value = el.tempoNum.value = t;
  persist();
}

// ---------- import ----------
function showMsg(text, isError = false) {
  el.importMsg.textContent = text;
  el.importMsg.classList.toggle('error', isError);
}

const keyLabel = (k) => (k.mode === 'minor' ? `${pcName(k.majorTonic + 9)} minor` : `${pcName(k.majorTonic)} major`);

async function runImport(input, { part } = {}) {
  lastImport = input;
  try {
    const mode = el.tabMode.value;
    const r = await parseAny(input, {
      timeSig: timeSig(), tabMode: mode === 'bar' ? 'bar' : 'fixed', tabStep: mode === 'bar' ? 0.5 : Number(mode),
      capo: Number(el.capo.value), topVoice: el.topVoice.checked, part,
    });
    applyImport(r);
  } catch (e) {
    showMsg(e.message || 'Could not read that file.', true);
  }
}

function setTimeSig(ts) {
  const str = `${ts.num}/${ts.den}`;
  if (str === state.ts) return;
  if (![...el.timeSig.options].some((o) => o.value === str)) el.timeSig.add(new Option(str, str));
  el.timeSig.value = str;
  state.ts = str;
  state.cells = defaultCells(barLen(), state.sub);
}

function applyImport(r) {
  if (r.format !== 'tab') setTimeSig(r.timeSig);
  if (r.tempo) setTempo(r.tempo);
  state.melody = { notes: r.notes, totalBeats: r.totalBeats, title: r.title };
  state.transpose = 0;
  el.transpose.value = 0;
  const bl = barLen();
  let how;
  if (r.chords && r.chords.length) {
    state.chart = chordsToChart(r.chords, r.totalBeats, bl);
    how = 'The chords came from the file.';
  } else {
    state.chart = formatChart(detectChords(r.notes, { barLen: bl, totalBeats: r.totalBeats, key: r.key }));
    how = 'The chords are a guess from the melody. Edit the chart if something sounds off.';
  }
  state.paletteKey = r.key.majorTonic;
  el.paletteKey.value = state.paletteKey;
  el.otherRoot.value = state.paletteKey;
  el.tuneSummary.textContent = r.title ? `Playing "${r.title}"` : 'Melody loaded';

  if (r.parts && r.parts.length > 1) {
    el.part.innerHTML = '';
    r.parts.forEach((p) => el.part.add(new Option(`${p.name} (${p.noteCount} notes)`, p.index)));
    el.part.value = r.part;
    el.partField.hidden = false;
  } else el.partField.hidden = true;

  el.melodyPanel.hidden = false;
  const bars = Math.ceil(r.totalBeats / bl - 1e-6);
  showMsg(`Loaded ${r.title ? `"${r.title}": ` : ''}${r.notes.length} notes over ${bars} bars, in ${keyLabel(r.key)}. ${how}${r.warnings.length ? ' ' + r.warnings.join(' ') : ''}`);
  changed({ full: true });
}

async function handleFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (['pdf', 'png', 'jpg', 'jpeg'].includes(ext)) {
    showMsg('Scanned sheet music (PDF or photo) needs music recognition, which this page cannot do. Open it in a program like MuseScore or Audiveris, export MusicXML or MIDI, and load that file here.', true);
    return;
  }
  try {
    if (['mid', 'midi', 'mxl'].includes(ext)) {
      await runImport(await file.arrayBuffer());
    } else {
      const text = await file.text();
      el.importText.value = text;
      await runImport(text);
    }
  } catch (e) {
    showMsg(e.message || 'Could not read that file.', true);
  }
}
// ---------- wiring ----------
function wire() {
  el.play.addEventListener('click', () => (play.on ? stopPlay() : startPlay()));
  document.addEventListener('keydown', (e) => {
    const tag = e.target.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === ' ' && tag !== 'BUTTON') { e.preventDefault(); el.play.click(); return; }
    const k = e.key.length === 1 ? e.key.toLowerCase() : '';
    const hit = Object.entries(CELLS).find(([, info]) => info.key === k);
    if (hit) setTool(hit[0]);
  });

  el.tempo.addEventListener('input', () => setTempo(+el.tempo.value));
  el.tempoNum.addEventListener('change', () => setTempo(+el.tempoNum.value));
  el.transpose.addEventListener('change', () => { state.transpose = +el.transpose.value; changed(); });
  el.timeSig.addEventListener('change', () => {
    state.ts = el.timeSig.value;
    state.cells = defaultCells(barLen(), state.sub);
    changed({ full: true });
  });
  el.loop.addEventListener('change', () => { state.loop = el.loop.checked; persist(); });
  el.countIn.addEventListener('change', () => { state.countIn = el.countIn.checked; persist(); });
  el.metro.addEventListener('change', () => { state.metro = el.metro.checked; persist(); });

  el.preset.addEventListener('change', () => {
    const p = presetsFor(barLen()).find((x) => x.id === el.preset.value);
    if (!p) return;
    state.cells = resampleCells(p.cells, 2, state.sub);
    changed({ full: true });
  });
  el.sub.addEventListener('change', () => {
    const next = +el.sub.value;
    state.cells = resampleCells(state.cells, state.sub, next);
    state.sub = next;
    changed({ full: true });
  });
  el.bassRuns.addEventListener('change', () => { state.bassRuns = el.bassRuns.value; changed(); });
  el.swing.addEventListener('input', () => { state.swing = +el.swing.value; changed(); });
  el.human.addEventListener('input', () => { state.human = +el.human.value; persist(); });

  el.clearPattern.addEventListener('click', () => { state.cells = state.cells.map(() => '.'); changed({ full: true }); });
  el.savePattern.addEventListener('click', () => {
    const name = (window.prompt('Name this pattern') || '').trim();
    if (!name) return;
    let list = [];
    try { list = JSON.parse(localStorage.getItem(PATTERNS)) || []; } catch (e) { /* none */ }
    list.push({ name, ts: state.ts, sub: state.sub, cells: [...state.cells] });
    try { localStorage.setItem(PATTERNS, JSON.stringify(list)); } catch (e) { /* storage unavailable */ }
    renderSaved();
  });
  el.saved.addEventListener('change', () => {
    if (el.saved.value === '') return;
    let list = [];
    try { list = JSON.parse(localStorage.getItem(PATTERNS)) || []; } catch (e) { /* none */ }
    const p = list[+el.saved.value];
    if (!p) return;
    state.ts = p.ts;
    if (![...el.timeSig.options].some((o) => o.value === p.ts)) el.timeSig.add(new Option(p.ts, p.ts));
    el.timeSig.value = p.ts;
    state.sub = p.sub;
    el.sub.value = p.sub;
    state.cells = [...p.cells];
    changed({ full: true });
  });
  el.deleteSaved.addEventListener('click', () => {
    if (el.saved.value === '') return;
    let list = [];
    try { list = JSON.parse(localStorage.getItem(PATTERNS)) || []; } catch (e) { /* none */ }
    list.splice(+el.saved.value, 1);
    try { localStorage.setItem(PATTERNS, JSON.stringify(list)); } catch (e) { /* storage unavailable */ }
    renderSaved();
  });
  el.share.addEventListener('click', async () => {
    const data = Object.fromEntries(PERSIST.map((k) => [k, state[k]]));
    const url = `${location.origin}${location.pathname}#${btoa(unescape(encodeURIComponent(JSON.stringify(data))))}`;
    try { await navigator.clipboard.writeText(url); el.share.textContent = 'Link copied'; } catch (e) { window.prompt('Copy this link', url); }
    setTimeout(() => { el.share.textContent = 'Copy share link'; }, 1800);
  });

  el.file.addEventListener('change', () => { if (el.file.files[0]) handleFile(el.file.files[0]); el.file.value = ''; });
  el.drop.addEventListener('dragover', (e) => { e.preventDefault(); el.drop.classList.add('over'); });
  el.drop.addEventListener('dragleave', () => el.drop.classList.remove('over'));
  el.drop.addEventListener('drop', (e) => {
    e.preventDefault();
    el.drop.classList.remove('over');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  el.importBtn.addEventListener('click', () => {
    if (!el.importText.value.trim()) { showMsg('Paste some tab or ABC text first, or choose a file.', true); return; }
    runImport(el.importText.value);
  });
  el.part.addEventListener('change', () => { if (lastImport) runImport(lastImport, { part: +el.part.value }); });
  el.topVoice.addEventListener('change', () => { if (lastImport) runImport(lastImport, { part: el.partField.hidden ? undefined : +el.part.value }); });

  el.melodyOn.addEventListener('change', () => { state.melodyOn = el.melodyOn.checked; });
  el.strumOn.addEventListener('change', () => { state.strumOn = el.strumOn.checked; });
  el.inst.addEventListener('change', () => { state.inst = el.inst.value; persist(); });
  el.detectChords.addEventListener('click', () => {
    if (!state.melody) return;
    if (!window.confirm('Replace the chord chart with chords guessed from the melody?')) return;
    const names = detectChords(state.melody.notes, { barLen: barLen(), totalBeats: state.melody.totalBeats });
    state.chart = formatChart(names);
    changed();
  });
  el.clearMelody.addEventListener('click', () => {
    state.melody = null;
    el.melodyPanel.hidden = true;
    el.tuneSummary.textContent = 'Tab, ABC, MusicXML or MIDI';
    showMsg('');
    changed();
  });

  for (const [id, key] of [['vGuitar', 'guitar'], ['vBass', 'bass'], ['vMelody', 'melody']]) {
    el[id].addEventListener('input', () => { state.vol[key] = +el[id].value; applyVolumes(); persist(); });
  }
}

// ---------- install as an app ----------
function wireInstall() {
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    el.installBtn.hidden = false;
  });
  el.installBtn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch (e) { /* closed */ }
    deferred = null;
    el.installBtn.hidden = true;
  });
  window.addEventListener('appinstalled', () => { el.installBtn.hidden = true; });

  // iPhone and iPad Safari have no install prompt, so show a one-line tip instead.
  const standalone = navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let dismissed = false;
  try { dismissed = localStorage.getItem(INSTALL_HINT) === '1'; } catch (e) { /* storage unavailable */ }
  if (ios && !standalone && !dismissed) el.iosHint.hidden = false;
  el.iosHintClose.addEventListener('click', () => {
    el.iosHint.hidden = true;
    try { localStorage.setItem(INSTALL_HINT, '1'); } catch (e) { /* storage unavailable */ }
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

function init() {
  fillStaticSelects();
  loadInitial();
  syncControls();
  renderPalette();
  renderSaved();
  wire();
  wireChart();
  wireFolds();
  wireInstall();
  engine.preload();
  changed({ full: true });
  window.addEventListener('resize', () => drawRoll());
}

init();
