// Interval trainer page: "find the 5th above this note" and "name the interval between two notes".

import { AudioEngine } from './audio.js?v=17';
import { renderNeck } from './neck.js?v=17';
import { positionsFor, positionKey } from './fretboard.js?v=17';
import { pretty } from './shapes.js?v=17';
import {
  INTERVAL_SETS, intervalBySemis, nameOf, spellUpper, spellPair, findQuestion, nameQuestion,
} from './intervals.js?v=17';

const $ = (id) => document.getElementById(id);
const STORE = 'strumstudio.intervals';
const engine = new AudioEngine();
const MODES = [['find', 'Find the interval'], ['name', 'Name the interval']];

const settings = { mode: 'find', set: 'common', maxFret: 12, findAll: true, nearby: true, showNames: false, sound: true };
const stats = { find: { right: 0, total: 0, streak: 0, best: 0 }, name: { right: 0, total: 0, streak: 0, best: 0 } };
let q = null;
let missed = false;
let locked = false;
let found = new Set();
let marks = []; // extra marks for taps and answers: { string, fret, label, cls }
let timer = null;
let interacted = false; // browsers only allow sound after the first touch or click

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE)) || {};
    Object.assign(settings, saved.settings || {});
    for (const m of ['find', 'name']) if (saved.best && Number.isInteger(saved.best[m])) stats[m].best = saved.best[m];
  } catch (e) { /* first visit */ }
  if (!MODES.some(([m]) => m === settings.mode)) settings.mode = 'find';
  if (!INTERVAL_SETS[settings.set]) settings.set = 'common';
  if (![5, 7, 12, 15].includes(settings.maxFret)) settings.maxFret = 12;
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify({ settings, best: { find: stats.find.best, name: stats.name.best } })); } catch (e) { /* storage unavailable */ }
}

const positions = () => positionsFor({ maxFret: settings.maxFret });
const semisSet = () => INTERVAL_SETS[settings.set].semis;
const st = () => stats[settings.mode];
const noteName = (midi) => pretty(nameOf(midi));
const allOf = (n) => (n === 2 ? 'both' : `all ${n}`);

// ---------- sound ----------
function play(midis, { together = false } = {}) {
  if (!settings.sound) return;
  const ctx = engine.ensure();
  const t = ctx.currentTime + 0.02;
  midis.forEach((m, i) => engine.playPluck(m, t + (together ? i * 0.02 : i * 0.55), { vel: 0.85, dur: 1.2, release: 0.2, bright: 0.85 }));
}
function hear() {
  if (!q) return;
  if (settings.mode === 'find') play([q.start.midi]);
  else {
    play([q.low.midi, q.high.midi]);
    setTimeout(() => play([q.low.midi, q.high.midi], { together: true }), 1300);
  }
}

// ---------- drawing ----------
function draw() {
  const base = [];
  if (q && settings.mode === 'find') {
    base.push({ ...q.start, label: startName(), cls: 'start' });
  } else if (q) {
    const [lowName, highName] = spellPair(q.low.midi, q.interval.semis);
    base.push({ ...q.low, label: settings.showNames ? lowName : '1', cls: 'start' });
    base.push({ ...q.high, label: settings.showNames ? highName : '2', cls: 'start' });
  }
  const all = [...base.filter((b) => !marks.some((m) => positionKey(m) === positionKey(b))), ...marks];
  renderNeck($('neck'), { maxFret: settings.maxFret, marks: all, onTap: settings.mode === 'find' ? tap : null, tapAll: settings.mode === 'find' });
}

function renderScore() {
  const s = st();
  const pct = s.total ? Math.round((100 * s.right) / s.total) : 0;
  $('score').textContent = `${s.right} of ${s.total} first try${s.total ? ` (${pct}%)` : ''} · streak ${s.streak} · best ${s.best}`;
}

function renderChoices() {
  const box = $('choices');
  box.innerHTML = '';
  box.hidden = settings.mode !== 'name';
  for (const semis of semisSet()) {
    const i = intervalBySemis(semis);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice';
    b.dataset.semis = semis;
    b.innerHTML = '<span class="choice-name"></span><span class="choice-short"></span>';
    b.querySelector('.choice-name').textContent = i.name;
    b.querySelector('.choice-short').textContent = i.short;
    b.addEventListener('click', () => choose(semis, b));
    box.appendChild(b);
  }
}

// ---------- questions ----------
function setFeedback(text, kind = '') {
  $('feedback').className = `feedback${kind ? ` ${kind}` : ''}`;
  $('feedback').textContent = text;
}

function next() {
  clearTimeout(timer);
  missed = false;
  locked = false;
  found = new Set();
  marks = [];
  if (settings.mode === 'find') {
    q = findQuestion({ positions: positions(), semisSet: semisSet(), prev: q && q.start ? q : null });
    if (q) {
      const many = settings.findAll && q.targets.length > 1;
      $('prompt').textContent = `Find the ${q.interval.name.toLowerCase()} above ${startName()}.`;
      setFeedback(many ? `It's in ${q.targets.length} places here; tap ${allOf(q.targets.length)}.` : 'Tap where it is.');
    }
  } else {
    q = nameQuestion({ positions: positions(), semisSet: semisSet(), nearby: settings.nearby, prev: q && q.low ? q : null });
    if (q) {
      $('prompt').textContent = 'What interval is this, from note 1 up to note 2?';
      setFeedback('Pick an answer below. Tap Hear it to listen again.');
      if (interacted) hear();
    }
  }
  if (!q) {
    $('prompt').textContent = '';
    setFeedback('No questions fit these settings. Try more frets.');
  }
  $('choices').querySelectorAll('.choice').forEach((c) => c.classList.remove('right', 'wrong'));
  $('showMe').hidden = settings.mode !== 'find';
  draw();
}

function finish(gotIt) {
  const s = st();
  s.total++;
  if (gotIt) { s.right++; s.streak++; s.best = Math.max(s.best, s.streak); } else s.streak = 0;
  save();
  renderScore();
  locked = true;
}

function answerLine() {
  return `The ${q.interval.name.toLowerCase()} above ${startName()} is ${targetName()}.`;
}
// The start note is named so that the note to find reads cleanly (C♯ up a minor 3rd is E).
const startName = () => spellPair(q.start.midi, q.interval.semis)[0];
const targetName = () => spellPair(q.start.midi, q.interval.semis)[1];
const plain = (name) => name.replace('♯', '#').replace('♭', 'b');
// A tapped note, named relative to the start note when it is within an octave above it.
function tappedName(midi) {
  const diff = midi - q.start.midi;
  return diff >= 1 && diff <= 12 ? spellUpper(plain(startName()), diff) : noteName(midi);
}

function tap(p) {
  if (!q || locked || settings.mode !== 'find') return;
  const midi = positions().find((x) => x.string === p.string && x.fret === p.fret).midi;
  if (positionKey(p) === positionKey(q.start)) { play([midi]); return; }
  const key = positionKey(p);
  if (midi !== q.targetMidi) {
    play([midi]);
    if (!missed) { missed = true; st().streak = 0; renderScore(); }
    marks = marks.filter((m) => positionKey(m) !== key);
    marks.push({ ...p, label: tappedName(midi), cls: 'bad' });
    const diff = midi - q.start.midi;
    const what = diff > 0 && diff <= 12 ? `a ${intervalBySemis(diff).name.toLowerCase()} above` : diff === 0 ? `the same note as` : diff < 0 ? 'below' : 'more than an octave above';
    setFeedback(`That's ${tappedName(midi)}, ${what} ${startName()}. Try again.`, 'bad');
    draw();
    return;
  }
  if (found.has(key)) return;
  found.add(key);
  play([q.start.midi, midi], { together: true });
  marks.push({ ...p, label: targetName(), cls: 'good' });
  const need = settings.findAll ? q.targets.length : 1;
  if (found.size < need) {
    setFeedback(`Yes. ${need - found.size} more to find (${found.size} of ${need} found).`, 'good');
    draw();
    return;
  }
  setFeedback(`${missed ? '' : 'Yes! '}${answerLine()}`, 'good');
  finish(!missed);
  draw();
  timer = setTimeout(next, 1600);
}

function showMe() {
  if (!q || locked || settings.mode !== 'find') return;
  for (const t of q.targets) if (!found.has(positionKey(t))) marks.push({ ...t, label: targetName(), cls: 'ans' });
  play([q.start.midi, q.targetMidi]);
  setFeedback(`${answerLine()} Next one in a moment.`);
  finish(false);
  draw();
  timer = setTimeout(next, 2600);
}

function choose(semis, button) {
  if (!q || locked || settings.mode !== 'name') return;
  if (semis === q.interval.semis) {
    button.classList.add('right');
    const [lowName, highName] = spellPair(q.low.midi, q.interval.semis);
    setFeedback(`${missed ? '' : 'Yes! '}${q.interval.name} (${lowName} up to ${highName}).`, 'good');
    finish(!missed);
    marks = [{ ...q.low, label: lowName, cls: 'start' }, { ...q.high, label: highName, cls: 'good' }];
    draw();
    play([q.low.midi, q.high.midi], { together: true });
    timer = setTimeout(next, 1800);
  } else {
    button.classList.add('wrong');
    if (!missed) { missed = true; st().streak = 0; renderScore(); }
    setFeedback(`Not a ${intervalBySemis(semis).name.toLowerCase()}. Listen again and try another.`, 'bad');
  }
}

// ---------- settings ----------
function renderSettings() {
  const modeEl = $('mode');
  modeEl.innerHTML = '';
  for (const [m, label] of MODES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(m === settings.mode));
    b.textContent = label;
    b.addEventListener('click', () => { if (m !== settings.mode) { settings.mode = m; changed(); } });
    modeEl.appendChild(b);
  }
  $('intervalSet').value = settings.set;
  $('fretRange').value = settings.maxFret;
  $('findAll').checked = settings.findAll;
  $('nearby').checked = settings.nearby;
  $('showNames').checked = settings.showNames;
  $('sound').checked = settings.sound;
  $('settingsSummary').textContent = `${settings.set === 'common' ? 'Common intervals' : 'All intervals'}, frets 0 to ${settings.maxFret}`;
}

function changed() {
  save();
  renderSettings();
  renderChoices();
  renderScore();
  next();
}

function init() {
  load();
  document.addEventListener('pointerdown', () => { interacted = true; }, { once: true, capture: true });
  for (const [k, v] of Object.entries(INTERVAL_SETS)) $('intervalSet').add(new Option(v.label, k));
  $('intervalSet').addEventListener('change', () => { settings.set = $('intervalSet').value; changed(); });
  $('fretRange').addEventListener('change', () => { settings.maxFret = +$('fretRange').value; changed(); });
  for (const id of ['findAll', 'nearby']) $(id).addEventListener('change', () => { settings[id] = $(id).checked; changed(); });
  $('showNames').addEventListener('change', () => { settings.showNames = $('showNames').checked; save(); draw(); });
  $('sound').addEventListener('change', () => { settings.sound = $('sound').checked; save(); });
  $('hear').addEventListener('click', hear);
  $('showMe').addEventListener('click', showMe);
  $('skip').addEventListener('click', next);
  $('resetScore').addEventListener('click', () => {
    for (const m of ['find', 'name']) Object.assign(stats[m], { right: 0, total: 0, streak: 0, best: 0 });
    save();
    renderScore();
  });
  renderSettings();
  renderChoices();
  renderScore();
  engine.preload();
  next();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
}

init();
