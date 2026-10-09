# Build brief: turn Strum Studio into an installable app

This file is written for Claude Code. Read all of it, then do Phase 1 and Phase 2. Phase 3 is optional and needs the owner's decision first, so stop and ask before starting it.

## Goal

Strum Studio is a working static web app (bluegrass strum pattern editor, chord chart player, tab/ABC/MusicXML/MIDI import). Make it installable as an app on phones and computers, usable offline, and deployed to a public URL on GitHub Pages. The owner is not a developer, so keep setup steps minimal and explain anything they must click themselves.

Repo: https://github.com/dbarger-meng/strum-machine (branch `main`). Final site URL once Pages is on: https://dbarger-meng.github.io/strum-machine/

## Ground rules

- **No build step and no runtime dependencies.** The app is plain ES modules served as static files. Keep it that way. Dev-only tooling is allowed only if there is no simpler way, and must not be needed to run or deploy the app.
- **Everything must work from a sub-path** (`/strum-machine/`), not just from `/`. Use relative URLs everywhere (`./`, never `/`).
- **No external network requests at runtime** (no CDN fonts, scripts or analytics). Offline support depends on this. The app currently makes none.
- Keep the existing look: tokens are CSS variables at the top of `styles.css` (`--ink: #1b2b44` denim, `--brass: #a8761a`, `--paper: #f1f2ec`). UI copy is plain, sentence case, no jargon.
- Run `npm test` before every commit; all tests must pass. Commit in small steps with clear messages.
- Do not rewrite or reformat files you are not changing.

## What exists

```
index.html          page markup; every control has an id
styles.css          all styling (CSS variables at the top)
src/music.js        chords, guitar voicings, bass notes, key and chord detection
src/song.js         chart parsing, strum presets, pattern -> timed events
src/parsers.js      importers: ASCII tab, ABC, MusicXML/MXL, MIDI
src/audio.js        Web Audio synthesis (Karplus-Strong), no sample files
src/app.js          UI, scheduler, import flow; calls init() at the bottom
scripts/serve.mjs   tiny static server for `npm start` (http://localhost:8080)
tests/logic.test.mjs  node:test suite (`npm test`)
```

Facts that matter for this work:

- `index.html` loads `<script type="module" src="src/app.js">` and `styles.css` with relative paths. There is no manifest, service worker or icon yet.
- Persistence uses `localStorage` keys `strumstudio.session` and `strumstudio.patterns`. The share link stores state in `location.hash` and is built from `location.origin + location.pathname`, so it already works under a sub-path.
- Audio starts only after a user click (`AudioEngine.ensure()` in `src/audio.js`). Do not change that; browsers require it.
- `src/parsers.js` has a dynamic `import('node:zlib')` that is only reached when the runtime has no `DecompressionStream` (Node tests). Browsers never reach it. Leave it.
- `scripts/serve.mjs` has a small MIME table that lacks `.webmanifest` and `.png`. Add them (`application/manifest+json`, `image/png`).

## Phase 1: installable PWA with offline support

### 1. Icons

Create these in `icons/` and commit the files:

| File | Size | Notes |
| --- | --- | --- |
| `icon.svg` | scalable | source artwork, also used as the favicon |
| `icon-192.png`, `icon-512.png` | 192, 512 | "any" purpose |
| `icon-maskable-512.png` | 512 | "maskable": keep all artwork inside the central 80% circle; fill the full square with the background colour |
| `apple-touch-icon.png` | 180 | no transparency |

Design: denim `#1b2b44` background, brass `#a8761a` and paper `#f1f2ec` tiles echoing the pattern grid (a row of four rounded tiles, tiles 1 and 3 brass, 2 and 4 paper, like a boom-chuck bar). Simple, readable at 48 px, no text. Draw the SVG by hand.

Rasterise with whatever is installed: `rsvg-convert`, ImageMagick `magick`, or `npx -y sharp-cli`. Put the command you used in a comment at the top of `scripts/make-icons.sh` so the owner can regenerate. Do not add these tools to `package.json`.

### 2. Manifest

`manifest.webmanifest` in the repo root:

- `name`: "Strum Studio", `short_name`: "Strum Studio"
- `description`: "Build a bluegrass strum pattern, load a tune, and play along."
- `start_url`: `"./"`, `scope`: `"./"`, `display`: `"standalone"`
- `background_color`: `#f1f2ec`, `theme_color`: `#1b2b44`
- `icons`: the 192, 512 and maskable 512 PNGs plus the SVG, with correct `sizes`, `type` and `purpose`

In `index.html` `<head>` add: `<link rel="manifest" href="manifest.webmanifest">`, `<meta name="theme-color" content="#1b2b44">`, `<link rel="icon" href="icons/icon.svg" type="image/svg+xml">`, `<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-title" content="Strum Studio">`.

### 3. Service worker

`sw.js` in the repo root (root placement gives it scope over the whole app):

- `const VERSION = 'v1'; const CACHE = 'strum-studio-' + VERSION;`
- **Precache** the app shell on `install`: `./`, `./index.html`, `./styles.css`, `./manifest.webmanifest`, every file in `src/`, and every file in `icons/`. Then `self.skipWaiting()`.
- On `activate`: delete caches whose name starts with `strum-studio-` but is not `CACHE`, then `self.clients.claim()`.
- On `fetch` (GET, same origin only): **stale-while-revalidate**. Answer from cache if present and refresh it from the network in the background; if not cached, go to the network and cache the response; if the network fails for a navigation request, fall back to cached `./index.html`.
- Ignore non-GET requests and anything cross-origin.

Register it from `src/app.js` (at the end of `init()` or in a small new module imported by it):

```js
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
```

Do not register when running on `localhost` unless needed for testing; it is fine to register there, but mention in the README that during development the cache can serve stale files and how to bypass it (DevTools, Application, Service Workers, "Update on reload").

**Release rule:** whenever any cached file changes, bump `VERSION` in `sw.js`. Add this to the README under a "Releasing" heading.

**Guard test:** add `tests/precache.test.mjs` (node:test) that reads `sw.js`, lists every file in `src/` and `icons/`, and fails if any is missing from the precache list. This stops the app breaking offline after someone adds a module.

### 4. Install button and hints

In the masthead area of `index.html`/`styles.css`/`src/app.js`:

- Listen for `beforeinstallprompt`; call `preventDefault()`, keep the event, and reveal a button "Install app" in the masthead. On click call `prompt()`, then hide the button. Hide it also on `appinstalled`.
- On iOS Safari (no `beforeinstallprompt`), when not already running standalone (`navigator.standalone !== true` and not `matchMedia('(display-mode: standalone)')`), show a one-line dismissible hint: "To install, tap Share, then Add to Home Screen." Remember dismissal in `localStorage` under `strumstudio.installHint`.
- Style them to match the masthead (paper text on denim, brass button). Keep focus styles visible. No animation.

### 5. Standalone polish

- Add `viewport-fit=cover` to the viewport meta and `padding: env(safe-area-inset-*)` where the masthead and footer touch screen edges, so notches do not cover content.
- In standalone mode the sticky transport bar must still sit below the status bar (check `top` with the safe-area inset).
- Make sure nothing relies on `window.prompt` for essential flows in standalone mode. `prompt()` is used by "Save pattern" and "Copy share link" fallback; it works but is plain. Replace "Save pattern" with an inline text field plus Save button if time allows; otherwise leave it and note it in the README under known limits.

## Phase 2: deploy to GitHub Pages

1. Add `.github/workflows/pages.yml`: on push to `main` and on manual dispatch; permissions `contents: read`, `pages: write`, `id-token: write`; steps: `actions/checkout`, run `npm test`, copy only the shipped files into `dist/` (`index.html`, `styles.css`, `manifest.webmanifest`, `sw.js`, `src/`, `icons/`), `actions/configure-pages`, `actions/upload-pages-artifact` with `path: dist`, then a `deploy` job using `actions/deploy-pages`. Use current major versions of those actions. Tests and scripts must not be published.
2. The owner must switch Pages to "GitHub Actions": repo Settings, Pages, Build and deployment, Source = "GitHub Actions". You cannot do this from the repo files. If `gh` is authenticated, you may try `gh api -X POST repos/dbarger-meng/strum-machine/pages -f build_type=workflow` and report the result; otherwise tell the owner the exact clicks.
3. After the first successful run, open https://dbarger-meng.github.io/strum-machine/ and verify the checklist below against the live site.
4. Update `README.md`: add an "Install as an app" section (Android/desktop Chrome and Edge: Install button or address-bar icon; iPhone/iPad: Safari, Share, Add to Home Screen), the live URL, the "Releasing" rule, and the offline note.

## Verification checklist

Do these and report results honestly; do not claim anything you did not run.

- [ ] `npm test` passes, including the new precache test.
- [ ] `npm start`, open http://localhost:8080: no console errors; manifest parses (DevTools, Application, Manifest shows name, icons, no warnings).
- [ ] Service worker is "activated and running". Switch DevTools to Offline and reload: the app loads and Play works.
- [ ] Lighthouse (Chrome DevTools) reports the page as installable. If Lighthouse is not available in your environment, say so and verify the manifest and worker by hand instead.
- [ ] Load a pasted ABC tune while offline: import still works (importers are local code).
- [ ] The share link round-trips: copy it, open in a new tab, same pattern and chart.
- [ ] On the deployed URL, `Install app` appears in Chrome/Edge and the installed window opens without browser chrome.
- [ ] iOS check cannot be done in a sandbox; list it as "owner to test on iPhone" with the exact steps.

Browser audio caveats to put in the README: iPhones can silence Web Audio when the ringer switch is on silent; Safari needs 16.4+ for `.mxl` import (`DecompressionStream('deflate-raw')`).

## Phase 3 (optional, ask the owner first): app stores and desktop

Only start this if the owner says yes. Costs and requirements to tell them before starting:

- Apple App Store: Apple Developer account ($99/year) and a Mac with Xcode to build and submit.
- Google Play: developer account ($25 one time).
- Desktop programs: no fee, but the owner must be able to run the build on each OS or use CI.

If approved, use **Capacitor** (wraps the same static files; works without a bundler):

1. Add `scripts/build.mjs` that copies the shipped files into `dist/` (the same list as the Pages workflow; reuse it there so the two cannot drift).
2. `npm i -D @capacitor/cli @capacitor/core @capacitor/ios @capacitor/android`, then `npx cap init "Strum Studio" <reverse-domain id the owner chooses> --web-dir=dist`. Ask for the app id; do not invent one.
3. `npm run build && npx cap add android` (and `ios` on macOS), `npx cap sync`.
4. Known issue to handle: in the iOS web view, Web Audio is muted by the ringer switch. Test and, if needed, add a small plugin or native config to set the audio session to playback. Report what you find.
5. Do not commit `node_modules`, `ios/Pods` or build outputs. Add them to `.gitignore`.

For a desktop program, Tauri is the lighter option; propose it rather than adding it unasked.

## Out of scope for this brief

Changing the sound engine, the pattern editor, or the importers. Image/PDF sheet music recognition (needs a separate OMR service). Accounts, sync or a backend. If you find a bug in those areas while working, note it in your final report instead of fixing it here.

## Definition of done

Phase 1 and 2 are complete, tests pass, the work is pushed to `main`, the live site is verified (or the exact owner steps remaining are listed), and your final message says in a few sentences what changed, what you verified, what you could not verify, and what the owner must click.
