# Strum Studio

A browser app for building bluegrass strum patterns and playing along with a tune. Inspired by [Strum Machine](https://strummachine.com), but it works differently: you design the strum yourself, and you can load a melody from tab or notation files.

No build step and no dependencies. Sounds are synthesized in the browser, and nothing leaves your device.

## Run it

```
npm start        # serves the folder at http://localhost:8080
npm test         # parser, chart and pattern tests (Node 18+)
```

Browsers block ES modules opened from `file://`, so use `npm start` (or any static server). The folder also works as-is on GitHub Pages.

## What it does

**Strum pattern editor.** One bar on a beat grid (eighth or sixteenth notes). Paint each step with a root bass, fifth bass, chuck, down strum, up strum, chop or rest. Presets cover boom-chuck, boom-chuck-a, boom-strum, mandolin-style chop, and waltz and 2/4 versions. Swing and looseness sliders shape the feel. Save patterns in your browser or copy a share link.

**Bass runs.** At chord changes the last beat can turn into a two-note stepwise run into the next chord (every change, or every other one).

**Chord chart.** Type bars like `| G | C D | % |`. Each chord uses a guitar voicing (open shapes where they exist, barre shapes otherwise). Tempo, key shift, time signature, loop, count-in and click are in the transport bar.

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
- Sounds are synthesized plucked strings, not recordings.

## Layout

```
index.html, styles.css
src/music.js     chords, voicings, bass notes, key and chord detection
src/song.js      chart parsing, presets, pattern to timed events
src/parsers.js   tab, ABC, MusicXML/MXL and MIDI importers
src/audio.js     Web Audio synthesis (Karplus-Strong strings, fiddle, chop, click)
src/app.js       UI, scheduler, import flow
tests/           node:test suite
```
