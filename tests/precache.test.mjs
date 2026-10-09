import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Offline use depends on sw.js caching every shipped file. Adding a module or icon without
// listing it here would break the installed app with no signal, so fail loudly instead.
const sw = readFileSync('sw.js', 'utf8');
const listed = (name) => JSON.parse(new RegExp(`const ${name} = (\\[[^\\]]*\\]);`).exec(sw)[1].replace(/'/g, '"'));

test('service worker precaches every source file and icon', () => {
  assert.deepEqual(listed('SRC').sort(), readdirSync('src').filter((f) => f.endsWith('.js')).sort());
  assert.deepEqual(listed('ICONS').sort(), readdirSync('icons').sort());
  for (const f of ['./', './index.html', './manifest.webmanifest', './styles.css?v=']) assert.ok(sw.includes(`'${f}`) || sw.includes(`\`${f}`), `${f} is precached`);
});

test('service worker version matches the asset stamps', () => {
  const v = /const ASSET_VERSION = (\d+);/.exec(sw)[1];
  assert.match(readFileSync('index.html', 'utf8'), new RegExp(`src/app\\.js\\?v=${v}"`));
});

test('manifest lists icons that exist', () => {
  const m = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
  assert.equal(m.start_url, './');
  assert.equal(m.display, 'standalone');
  const icons = readdirSync('icons');
  for (const i of m.icons) assert.ok(icons.includes(i.src.replace('icons/', '')), i.src);
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
});
