// Kopiuje silnik OCR i słownik angielski do public/tesseract, żeby aplikacja
// nie zależała od CDN i działała offline. Uruchamiane automatycznie przed dev/build.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));
const out = join(dirname(new URL(import.meta.url).pathname), '..', 'public', 'tesseract');

const files = [
  [join(pkgDir('tesseract.js'), 'dist', 'worker.min.js'), 'worker.min.js'],
  ...['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'].map(
    (f) => [join(pkgDir('tesseract.js-core'), f), join('core', f)],
  ),
  [join(pkgDir('@tesseract.js-data/eng'), '4.0.0_best_int', 'eng.traineddata.gz'), join('lang', 'eng.traineddata.gz')],
];

for (const [from, to] of files) {
  const dest = join(out, to);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(from, dest);
}
console.log(`OCR: skopiowano ${files.length} plików do public/tesseract`);
