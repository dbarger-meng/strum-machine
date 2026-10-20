// Draw a guitar neck with labelled dots, for the triad and scale pages.
// Uses the same .fb grid styles as the fretboard trainer.

import { STRINGS } from './fretboard.js?v=19';

/**
 * marks: [{ string, fret, label, cls }] where cls is a space-separated list of mark classes
 * (root, t1, t2, other, faint, start, good, bad, ans). onTap(mark) makes marked positions
 * buttons; with tapAll, every position is a button and onTap gets { string, fret } plus any mark.
 */
export function renderNeck(el, { maxFret = 15, marks = [], onTap = null, tapAll = false }) {
  const at = new Map(marks.map((m) => [`${m.string}:${m.fret}`, m]));
  el.innerHTML = '';
  el.style.setProperty('--frets', maxFret);
  STRINGS.forEach((st, row) => {
    const name = document.createElement('span');
    name.className = 'fb-name';
    name.textContent = st.name;
    el.appendChild(name);
    for (let fret = 0; fret <= maxFret; fret++) {
      const m = at.get(`${st.index}:${fret}`);
      const tappable = onTap && (m || tapAll);
      const c = document.createElement(tappable ? 'button' : 'div');
      if (tappable) {
        c.type = 'button';
        c.addEventListener('click', () => onTap({ string: st.index, fret, ...m }));
        c.setAttribute('aria-label', `${st.name} string, ${fret === 0 ? 'open' : `fret ${fret}`}`);
      }
      c.className = `fb-pos${fret === 0 ? ' open' : ''}${tappable ? '' : ' static'}`;
      c.style.setProperty('--gauge', `${1 + row * 0.5}px`);
      if (m) {
        const dot = document.createElement('b');
        dot.className = `mark ${m.cls || 'other'}`;
        dot.textContent = m.label;
        c.appendChild(dot);
        c.setAttribute('aria-label', `${st.name} string, ${fret === 0 ? 'open' : `fret ${fret}`}: ${m.label}`);
      }
      el.appendChild(c);
    }
  });
  el.appendChild(document.createElement('span'));
  for (let fret = 0; fret <= maxFret; fret++) {
    const n = document.createElement('span');
    n.className = 'fb-num';
    const dots = fret === 12 ? '●●' : [3, 5, 7, 9, 15].includes(fret) ? '●' : '';
    n.innerHTML = `${fret}${dots ? `<i>${dots}</i>` : ''}`;
    el.appendChild(n);
  }
}

/** Play notes one after another (or together, for a strum) with the guitar samples. */
export function playNotes(engine, midis, { gap = 0.25, dur = 0.6 } = {}) {
  const ctx = engine.ensure();
  engine.stopAll();
  const t0 = ctx.currentTime + 0.05;
  midis.forEach((m, i) => engine.playPluck(m, t0 + i * gap, { vel: 0.85, dur, release: 0.15, bright: 0.85 }));
  return t0 + midis.length * gap + dur;
}
