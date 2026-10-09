# Strum Studio

A browser app for building bluegrass strum patterns and playing along with a tune. Inspired by [Strum Machine](https://strummachine.com), but it works differently: you design the strum yourself, and you can load a melody from tab or notation files.

No build step and no dependencies. The guitar uses recorded samples (bundled, about 300 KB); other sounds are synthesized in the browser, and nothing leaves your device.

## Install it as an app

Live at **https://dbarger-meng.github.io/strum-machine/**. It installs from the browser, with no app store:

- **Android (Chrome):** open the link, then tap **Install app** at the top of the page (or the **⋮** menu, then **Install app** / **Add to Home screen**). It appears in your app drawer and opens full screen.
- **Computer (Chrome or Edge):** click **Install app** on the page, or the install icon at the right of the address bar.
- **iPhone or iPad (Safari):** tap **Share**, then **Add to Home Screen**.

Once opened, the app keeps a copy on the device and works offline, including importing files. When online it picks up new releases automatically.

Phone notes: iPhones can silence web audio when the ringer switch is set to silent. Importing `.mxl` files needs Safari 16.4 or later.

## Run it

```
npm start        # serves the folder at http://localhost:8080
npm test         # parser, chart and pattern tests (Node 18+)
```

Browsers block ES modules opened from `file://`, so use `npm start` (or any static server). The folder also works as-is on GitHub Pages.

## What it does

**Strum pattern editor.** One bar on a beat grid (eighth or sixteenth notes). Paint each step with a root bass, fifth bass, chuck, down strum, up strum, chop or rest. Presets cover boom-chuck, boom-chuck-a, boom-strum, mandolin-style chop, and waltz and 2/4 versions. Swing and looseness sliders shape the feel. Save patterns in your browser or copy a share link.

**Bass runs.** At chord changes the last beat can turn into a two-note stepwise run into the next chord (every change, or every other one).

**Chord chart.** Drag chords from the palette onto the bars. The palette shows the chords on each step of the key you pick, I to VII in order. A chord type switch shows them as they fall in the key, or all major, minor, 7th or diminished, and "Other chord" covers anything else. Drop on the + to put two or more chords in one bar, drag a chord in the chart to move it, or drag it to the bin to remove it. You can also tap a chord, then tap bars to place it. Each chord uses a guitar voicing (open shapes where they exist, barre shapes otherwise). Tempo, key shift, time signature, loop, count-in and click are in the transport bar.

**Load a tune.** Drop a file or paste text:

| Format | Notes |
| --- | --- |
| ASCII guitar tab | Six-string staffs, standard tuning or labeled tunings (drop D, DADGAD), capo. Chord names written above a staff become the chart. |
| ABC (`.abc`) | Repeats, first and second endings, chords, ties, triplets, pickup bars. First tune in the file. |
| MusicXML (`.xml`, `.musicxml`, `.mxl`) | Repeats and endings, chord symbols, tempo, multiple parts. |
| MIDI (`.mid`) | Picks the most melody-like track; others can be chosen. |

The melody plays (fiddle, mandolin or guitar sound) over the strum. If the file has no chord symbols, chords are guessed from the melody and written into the chart so you can edit them.

## Limits

- **Scanned PDFs and photos of sheet music are not supported.** Reading notation from an image needs optical music recognition, which cannot run in a plain web page. Convert the page in MuseScore or Audiveris to MusicXML or MIDI first.
- Tab has no rhythm information. By default each bar is stretched to fit the time signature, so bar lines must line up. If your tab uses a fixed spacing, choose "Each dash is an eighth note" (or another value) under Tab timing.
- Chord guessing uses major and minor triads, so sevenths and other colors need to be added by hand.
- The guitar is one recorded steel-string guitar, repitched to each note, with a light room reverb. The fiddle and mandolin melody sounds are still synthesized.

## Releasing

The site is published by GitHub Pages from `main`. Browsers keep files for a few minutes, so every local file URL carries a version stamp (`?v=3`). Whenever a shipped file changes, run `npm run bump` before committing; it also updates `ASSET_VERSION` in `sw.js`, so installed apps fetch the new files. `npm test` fails if the stamps are missing or mixed, or if a file in `src/` or `icons/` is missing from the offline list in `sw.js`.

During local development the service worker serves stamped files from its cache, so code edits may not show until you bump the version, or tick "Update on reload" in DevTools > Application > Service workers.

Icons are drawn in `icons/icon.svg`; `node scripts/make-icons.mjs` regenerates the PNGs.

## Credits

Guitar recordings in `samples/guitar/` come from the FluidR3 GM soundfont by Frank Wen, as rendered to MP3 by [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts), and are used under the [Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/) license.

## Layout

```
index.html, styles.css
src/music.js     chords, voicings, bass notes, key and chord detection
src/song.js      chart parsing, presets, pattern to timed events
src/chart-edit.js chord palette and drag-and-drop chart edits
src/parsers.js   tab, ABC, MusicXML/MXL and MIDI importers
src/audio.js     Web Audio: sampled guitar, Karplus-Strong fallback, fiddle, chop, click, reverb
samples/guitar/  steel-string guitar recordings, one every three semitones
src/app.js       UI, scheduler, import flow, install button
sw.js            offline cache (service worker)
manifest.webmanifest, icons/   app name, colors and icons for installing
tests/           node:test suite
```
