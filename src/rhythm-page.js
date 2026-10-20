// Rhythm dictation page: play four bars, let the player write the rhythm, then check it.

import { AudioEngine } from './audio.js?v=19';
import { drawBar } from './rhythm-notation.js?v=19';
import {
  METERS, VALUES, canFill, randomDictation, addValue, undoLast, remaining, sameRhythm,
} from './rhythm.js?v=19';

const $ = (id) => document.getElementById(id);
const STORE = 'strumstudio.rhythm';
const SVG = 'http://www.w3.org/2000/svg';
const engine = new AudioEngine();
const DEFAULT_USE = { '4/4': VALUES['4/4'].map((v) => v.id), '6/8': VALUES['6/8'].map((v) => v.id) };
const DEFAULT_TEMPO = { '4/4': 72, '6/8': 52 };

const settings = { meter: '4/4', tempo: { ...DEFAULT_TEMPO }, use: JSON.parse(JSON.stringify(DEFAULT_USE)), click: false, countIn: true };
const stats = { bars: 0, barsRight: 0, perfect: 0, tries: 0 };
let dictation = [];
let answer = [[], [], [], []];
let selected = 0;
let checked = false;
let timers = [];
let playing = false;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE)) || {};
    if (saved.settings) Object.assign(settings, saved.settings);
    if (saved.stats) Object.assign(stats, saved.stats);
  } catch (e) { /* first visit */ }
  if (!METERS[settings.meter]) settings.meter = '4/4';
  for (const m of Object.keys(METERS)) {
    const ok = VALUES[m].map((v) => v.id);
    settings.use[m] = (settings.use[m] || []).filter((id) => ok.includes(id));
    if (!canFill(m, settings.use[m])) settings.use[m] = [...DEFAULT_USE[m]];
    if (!(settings.tempo[m] >= 40 && settings.tempo[m] <= 140)) settings.tempo[m] = DEFAULT_TEMPO[m];
  }
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify({ settings, stats })); } catch (e) { /* storage unavailable */ }
}

const meter = () => settings.meter;
const secondsPerQuarter = () => (60 / settings.tempo[meter()]) / METERS[meter()].beatLen;

// ---------- drawing ----------
function renderBars() {
  const box = $('bars');
  box.innerHTML = '';
  answer.forEach((bar, i) => {
    const wrap = document.createElement('div');
    const right = checked && sameRhythm(bar, dictation[i]);
    wrap.className = `rhythm-bar${i === selected && !checked ? ' selected' : ''}${checked ? (right ? ' right' : ' wrong') : ''}`;
    wrap.dataset.i = i;
    const head = document.createElement('div');
    head.className = 'rhythm-bar-head';
    const label = document.createElement('span');
    const left = remaining(bar, meter());
    label.textContent = `Bar ${i + 1}${checked ? (right ? ' · right' : ' · not quite') : left > 1e-6 ? '' : ' · full'}`;
    const playBar = document.createElement('button');
    playBar.type = 'button';
    playBar.className = 'quiet bar-play';
    playBar.textContent = '▶ Bar';
    playBar.setAttribute('aria-label', `Play bar ${i + 1}`);
    playBar.addEventListener('click', (e) => { e.stopPropagation(); play([i]); });
    head.append(label, playBar);
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'rhythm-svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Your bar ${i + 1}`);
    drawBar(svg, bar, meter(), { timeSig: i === 0 });
    wrap.append(head, svg);
    if (checked && !right) {
      const cap = document.createElement('span');
      cap.className = 'answer-cap';
      cap.textContent = 'The rhythm was:';
      const ans = document.createElementNS(SVG, 'svg');
      ans.setAttribute('class', 'rhythm-svg answer');
      ans.setAttribute('role', 'img');
      ans.setAttribute('aria-label', `Correct rhythm for bar ${i + 1}`);
      drawBar(ans, dictation[i], meter(), { timeSig: i === 0 });
      wrap.append(cap, ans);
    }
    wrap.addEventListener('click', () => { if (!checked) { selected = i; renderBars(); } });
    box.appendChild(wrap);
  });
}

function renderValues() {
  const box = $('values');
  box.innerHTML = '';
  for (const v of VALUES[meter()]) {
    if (!settings.use[meter()].includes(v.id)) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'value-btn';
    b.dataset.id = v.id;
    const icon = document.createElementNS(SVG, 'svg');
    icon.setAttribute('class', 'value-icon');
    icon.setAttribute('aria-hidden', 'true');
    const sample = v.tuplet ? [1 / 3, 1 / 3, 1 / 3] : [v.dur];
    drawBar(icon, sample.map((dur) => ({ dur, tuplet: !!v.tuplet })), meter() === '6/8' && v.dur > 1.5 ? '6/8' : '4/4');
    icon.setAttribute('viewBox', v.tuplet ? '0 18 86 86' : '0 18 60 86');
    const name = document.createElement('span');
    name.textContent = v.name;
    b.append(icon, name);
    b.addEventListener('click', () => enter(v.id));
    box.appendChild(b);
  }
}

function renderScore() {
  const pct = stats.bars ? Math.round((100 * stats.barsRight) / stats.bars) : 0;
  $('score').textContent = `${stats.barsRight} of ${stats.bars} bars right${stats.bars ? ` (${pct}%)` : ''} · ${stats.perfect} perfect of ${stats.tries}`;
}

function renderSettings() {
  const m = $('meter');
  m.innerHTML = '';
  for (const key of Object.keys(METERS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(key === meter()));
    b.textContent = key;
    b.addEventListener('click', () => { if (key !== meter()) { settings.meter = key; save(); renderSettings(); newRhythm(); } });
    m.appendChild(b);
  }
  $('tempo').value = settings.tempo[meter()];
  $('tempoLabel').textContent = `Tempo: ${settings.tempo[meter()]} (${meter() === '6/8' ? 'dotted-quarter' : 'quarter-note'} beats per minute)`;
  $('clickAlong').checked = settings.click;
  $('countIn').checked = settings.countIn;
  const use = $('useValues');
  use.innerHTML = '';
  for (const v of VALUES[meter()]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = v.name;
    b.setAttribute('aria-pressed', String(settings.use[meter()].includes(v.id)));
    b.addEventListener('click', () => {
      const list = settings.use[meter()];
      const next = list.includes(v.id) ? list.filter((x) => x !== v.id) : [...list, v.id];
      if (!canFill(meter(), next)) { setFeedback('Those values cannot fill a bar on their own. Keep at least one more.', 'bad'); return; }
      settings.use[meter()] = next;
      save();
      renderSettings();
      newRhythm();
    });
    use.appendChild(b);
  }
  const names = VALUES[meter()].filter((v) => settings.use[meter()].includes(v.id)).map((v) => v.name.toLowerCase());
  $('settingsSummary').textContent = `${meter()}: ${names.join(', ')}`;
}

function setFeedback(text, kind = '') {
  $('feedback').className = `feedback${kind ? ` ${kind}` : ''}`;
  $('feedback').textContent = text;
}

// ---------- sound ----------
function stop() {
  timers.forEach(clearTimeout);
  timers = [];
  if (engine.ctx) engine.stopAll();
  playing = false;
  $('play').textContent = 'Play';
  document.querySelectorAll('.rhythm-bar.now').forEach((b) => b.classList.remove('now'));
}

/** Play the chosen bars (all four by default), after a count-in. */
function play(which = [0, 1, 2, 3]) {
  stop();
  const ctx = engine.ensure();
  const spq = secondsPerQuarter();
  const { barLen, beatLen } = METERS[meter()];
  const pulse = meter() === '6/8' ? 0.5 : 1; // count-in and click: eighths in 6/8, quarters in 4/4
  let t = ctx.currentTime + 0.1;
  const clicks = (from, len) => {
    for (let b = 0; b < len - 1e-6; b += pulse) engine.click(from + b * spq, Math.abs(b % beatLen) < 1e-6 && Math.abs(b % barLen) < 1e-6);
  };
  // A bar of count-in for the whole rhythm; one beat of lead-in when playing a single bar.
  const lead = which.length === 1 ? beatLen : settings.countIn ? barLen : 0;
  clicks(t, lead);
  t += lead * spq;
  const start = t;
  which.forEach((i, k) => {
    const barStart = start + k * barLen * spq;
    let at = 0;
    for (const n of dictation[i]) {
      engine.playPluck(n.midi, barStart + at * spq, { vel: 0.85, dur: n.dur * spq * 0.92, release: 0.06, bright: 0.85 });
      at += n.dur;
    }
    if (settings.click) clicks(barStart, barLen);
    const delay = (barStart - ctx.currentTime) * 1000;
    timers.push(setTimeout(() => {
      document.querySelectorAll('.rhythm-bar.now').forEach((b) => b.classList.remove('now'));
      const el = document.querySelector(`.rhythm-bar[data-i="${i}"]`);
      if (el) el.classList.add('now');
    }, delay));
  });
  const end = start + which.length * barLen * spq;
  timers.push(setTimeout(stop, (end - ctx.currentTime) * 1000 + 300));
  playing = true;
  $('play').textContent = 'Stop';
}

// ---------- answering ----------
function enter(id) {
  if (checked) { setFeedback('Tap New rhythm for another one.'); return; }
  const result = addValue(answer[selected], id, meter());
  if (result === 'full') {
    setFeedback(remaining(answer[selected], meter()) < 1e-6 ? `Bar ${selected + 1} is full. Tap another bar, or Undo.` : "That doesn't fit in what's left of the bar.", 'bad');
    return;
  }
  if (result === 'triplet-beat') { setFeedback('A triplet has to start on a beat.', 'bad'); return; }
  answer[selected] = result;
  setFeedback('');
  if (remaining(result, meter()) < 1e-6 && selected < 3) selected++;
  renderBars();
}

function check() {
  if (checked) return;
  if (answer.some((b) => remaining(b, meter()) > 1e-6)) {
    const missing = answer.map((b, i) => (remaining(b, meter()) > 1e-6 ? i + 1 : null)).filter(Boolean);
    setFeedback(`Fill every bar first (bar${missing.length > 1 ? 's' : ''} ${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} not full).`, 'bad');
    return;
  }
  checked = true;
  const right = answer.filter((b, i) => sameRhythm(b, dictation[i])).length;
  stats.bars += 4;
  stats.barsRight += right;
  stats.tries++;
  if (right === 4) stats.perfect++;
  save();
  renderScore();
  renderBars();
  setFeedback(right === 4 ? 'All four bars right!' : `${right} of 4 bars right. The correct rhythm is shown under each bar you missed; play them to compare.`, right === 4 ? 'good' : 'bad');
}

function newRhythm() {
  stop();
  dictation = randomDictation(meter(), settings.use[meter()]);
  answer = [[], [], [], []];
  selected = 0;
  checked = false;
  renderValues();
  renderBars();
  setFeedback('Press Play to hear four bars, then write the rhythm below.');
}

function init() {
  load();
  renderSettings();
  renderScore();
  newRhythm();
  $('play').addEventListener('click', () => (playing ? stop() : play()));
  $('check').addEventListener('click', check);
  $('newRhythm').addEventListener('click', newRhythm);
  $('undo').addEventListener('click', () => {
    if (checked) return;
    if (!answer[selected].length && selected > 0) selected--;
    answer[selected] = undoLast(answer[selected]);
    renderBars();
  });
  $('clearBar').addEventListener('click', () => { if (!checked) { answer[selected] = []; renderBars(); } });
  $('tempo').addEventListener('input', () => { settings.tempo[meter()] = +$('tempo').value; save(); renderSettings(); });
  $('clickAlong').addEventListener('change', () => { settings.click = $('clickAlong').checked; save(); });
  $('countIn').addEventListener('change', () => { settings.countIn = $('countIn').checked; save(); });
  $('resetScore').addEventListener('click', () => { Object.assign(stats, { bars: 0, barsRight: 0, perfect: 0, tries: 0 }); save(); renderScore(); });
  engine.preload();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
}

init();
