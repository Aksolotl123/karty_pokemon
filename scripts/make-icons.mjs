// Generuje ikony PNG aplikacji z public/icons/icon.svg (uruchamiane ręcznie: npm run icons).
import sharp from 'sharp';

const src = new URL('../public/icons/icon.svg', import.meta.url).pathname;
const out = (f) => new URL(`../public/icons/${f}`, import.meta.url).pathname;

await sharp(src).resize(192, 192).png().toFile(out('icon-192.png'));
await sharp(src).resize(512, 512).png().toFile(out('icon-512.png'));
await sharp(src).resize(180, 180).png().toFile(out('apple-touch-icon.png'));
// Wersja „maskable”: logo mniejsze, z marginesem na przycięcie przez system.
await sharp(src).resize(360, 360)
  .extend({ top: 76, bottom: 76, left: 76, right: 76, background: '#1b1d2a' })
  .png().toFile(out('icon-512-maskable.png'));
console.log('Ikony wygenerowane');
