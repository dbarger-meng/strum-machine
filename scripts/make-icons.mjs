// Regenerate the PNG app icons from icons/icon.svg by rendering it in headless Chromium.
// Made with: node scripts/make-icons.mjs  (needs Playwright: npx -y playwright@1.56.1 install chromium)
// Any SVG-to-PNG tool works too; the maskable and Apple icons drop the rounded corners so the
// denim background fills the whole square (no transparency).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(`${execSync('npm root -g').toString().trim()}/playwright`); }

const svg = readFileSync('icons/icon.svg', 'utf8');
const square = svg.replace(' rx="112"', '');
const jobs = [
  ['icons/icon-192.png', svg, 192, true],
  ['icons/icon-512.png', svg, 512, true],
  ['icons/icon-maskable-512.png', square, 512, false],
  ['icons/apple-touch-icon.png', square, 180, false],
];

const browser = await playwright.chromium.launch();
for (const [out, src, size, transparent] of jobs) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const img = `<img src="data:image/svg+xml;base64,${Buffer.from(src).toString('base64')}" width="${size}" height="${size}">`;
  await page.setContent(`<html><body style="margin:0;background:${transparent ? 'transparent' : '#1b2b44'}">${img}</body></html>`);
  await page.screenshot({ path: out, omitBackground: transparent });
  await page.close();
}
await browser.close();
console.log('Icons written to icons/');
