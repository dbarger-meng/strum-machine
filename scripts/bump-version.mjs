// Stamp a new version on every local asset URL (index.html and the imports in src/),
// so browsers fetch fresh copies instead of mixing a new page with old cached code.
// Run `npm run bump` whenever any shipped file changes, before committing.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const files = ['index.html', ...readdirSync('src').filter((f) => f.endsWith('.js')).map((f) => `src/${f}`)];
const ASSET = /((?:from |import\()'\.\/[\w-]+\.js|(?:href|src)="(?:src\/)?[\w-]+\.(?:css|js))(\?v=\d+)?(['"])/g;

let current = 0;
for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(ASSET)) current = Math.max(current, Number((m[2] || '?v=0').slice(3)));
const next = current + 1;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const out = src.replace(ASSET, (_, url, _v, quote) => `${url}?v=${next}${quote}`);
  if (out !== src) writeFileSync(f, out);
}
console.log(`Asset version is now ${next}.`);
