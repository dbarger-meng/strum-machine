import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Every local asset URL carries the same ?v= stamp (see scripts/bump-version.mjs),
// so a release never mixes a new page with old cached code.
test('local asset URLs all carry the same version stamp', () => {
  const files = ['index.html', ...readdirSync('src').filter((f) => f.endsWith('.js')).map((f) => `src/${f}`)];
  const versions = new Set();
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/(?:from |import\()'(\.\/[^']+)'|(?:href|src)="((?:src\/)?[\w-]+\.(?:css|js)[^"]*)"/g)) {
      const url = m[1] || m[2];
      const v = /\?v=(\d+)$/.exec(url);
      assert.ok(v, `${f}: ${url} has no ?v= stamp; run npm run bump`);
      versions.add(v[1]);
    }
  }
  assert.equal(versions.size, 1, `mixed versions ${[...versions]}; run npm run bump`);
});
