// A - or + button that steps a value: one tap is one step; holding keeps stepping, faster after
// a moment. Used for the tempo on the play-along and rhythm pages.

/** `step(n)` is called with how many units to move: 1 for a tap, 1 then 5 while held. */
export function holdToStep(btn, step) {
  let wait = null;
  let repeat = null;
  let held = false;
  const stop = () => { clearTimeout(wait); clearInterval(repeat); wait = repeat = null; };
  btn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    held = false;
    stop();
    wait = setTimeout(() => {
      held = true;
      let n = 0;
      repeat = setInterval(() => { n++; step(n > 15 ? 5 : 1); }, 110);
    }, 450);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, stop);
  btn.addEventListener('click', () => {
    if (held) { held = false; return; } // the hold already did the stepping
    step(1);
  });
  btn.addEventListener('contextmenu', (e) => e.preventDefault()); // long-press on phones
}
