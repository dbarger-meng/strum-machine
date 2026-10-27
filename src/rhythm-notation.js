// Draw one bar of rhythm on a single-line staff: noteheads, stems, beams, flags, dots,
// triplet numbers and (optionally) the time signature. Stems always point up.

import { GLYPHS } from './notation-glyphs.js?v=22';
import { METERS, beamGroups, noteShape } from './rhythm.js?v=22';

const SVG = 'http://www.w3.org/2000/svg';
const W = 300;
const H = 104;
const LINE = 70; // the staff line
const SP = 10; // pixels per staff space
const K = SP / 250; // glyph units to pixels
const STEM = 3.4 * SP;
const BEAM = 0.5 * SP;
const BEAM_GAP = 0.25 * SP;

function el(name, attrs) {
  const n = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}
const glyph = (name, x, y, scale = 1) => el('path', { d: GLYPHS[name].d, transform: `translate(${x} ${y}) scale(${K * scale} ${-K * scale})`, class: 'glyph' });
const width = (name) => GLYPHS[name].advance * K;

/** Draw `bar` (notes with dur, tuplet) into `svg`. An empty bar draws just the staff. */
export function drawBar(svg, bar, meter, { timeSig = false } = {}) {
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = '';
  const { barLen, num, den } = METERS[meter];
  const left = timeSig ? 36 : 14;
  const right = 14;
  svg.appendChild(el('line', { x1: 2, x2: W - 2, y1: LINE, y2: LINE, class: 'staff-line' }));
  svg.appendChild(el('line', { x1: W - 2, x2: W - 2, y1: LINE - 1.5 * SP, y2: LINE + 1.5 * SP, class: 'bar-line' }));
  if (timeSig) {
    svg.appendChild(glyph(`timeSig${num}`, 8, LINE - 1.1 * SP));
    svg.appendChild(glyph(`timeSig${den}`, 8, LINE + 1.1 * SP));
  }
  const usable = W - left - right;
  let at = 0;
  const placed = bar.map((n) => {
    const shape = noteShape(n);
    const x = left + (at / barLen) * usable;
    at += n.dur;
    const stemX = x + width(shape.head) - 0.6;
    return { n, shape, x, stemX };
  });

  for (const p of placed) {
    svg.appendChild(glyph(p.shape.head, p.x, LINE));
    if (p.shape.dotted) svg.appendChild(el('circle', { cx: p.x + width(p.shape.head) + 4, cy: LINE - 0.5 * SP, r: 1.6, class: 'glyph' }));
    if (p.shape.stem) svg.appendChild(el('line', { x1: p.stemX, x2: p.stemX, y1: LINE - 2, y2: LINE - STEM, class: 'stem' }));
  }

  const beamed = new Set();
  for (const g of beamGroups(bar, meter)) {
    const ps = g.map((i) => placed[i]);
    if (ps.length === 1) {
      const p = ps[0];
      if (p.shape.beams) svg.appendChild(glyph(p.shape.beams === 2 ? 'flag16thUp' : 'flag8thUp', p.stemX - 0.6, LINE - STEM));
      continue;
    }
    g.forEach((i) => beamed.add(i));
    const top = LINE - STEM;
    const x1 = ps[0].stemX - 0.6;
    const x2 = ps[ps.length - 1].stemX + 0.6;
    svg.appendChild(el('rect', { x: x1, y: top, width: x2 - x1, height: BEAM, class: 'beam' }));
    // Second beam over runs of 16ths; a lone 16th gets a short stub toward its neighbour.
    const y2 = top + BEAM + BEAM_GAP;
    for (let k = 0; k < ps.length; k++) {
      if (ps[k].shape.beams < 2) continue;
      let e = k;
      while (e + 1 < ps.length && ps[e + 1].shape.beams >= 2) e++;
      if (e > k) {
        svg.appendChild(el('rect', { x: ps[k].stemX - 0.6, y: y2, width: ps[e].stemX - ps[k].stemX + 1.2, height: BEAM, class: 'beam' }));
      } else {
        const stub = 0.6 * SP;
        const toLeft = k === ps.length - 1;
        svg.appendChild(el('rect', { x: toLeft ? ps[k].stemX - stub : ps[k].stemX - 0.6, y: y2, width: stub + 0.6, height: BEAM, class: 'beam' }));
      }
      k = e;
    }
    if (ps.every((p) => p.n.tuplet)) {
      svg.appendChild(glyph('tuplet3', (x1 + x2) / 2 - width('tuplet3') * 0.4, top - 4, 0.8));
    }
  }
}
