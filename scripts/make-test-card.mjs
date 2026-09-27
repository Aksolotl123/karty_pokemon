// Renderuje syntetyczną kartę do testów e2e (tests/e2e/fixtures/*.png).
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const dir = new URL('../tests/e2e/fixtures/', import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.goto(`file://${dir}card.html`);
const png = await page.locator('#card').screenshot();
await browser.close();
await sharp(png).resize(630, 880).png().toFile(`${dir}card.png`);
// „Zdjęcie” telefonem: karta na ciemnym stole, lekko mniejsza niż kadr.
const card = await sharp(png).resize(1140, 1592).toBuffer();
await sharp({ create: { width: 1200, height: 1600, channels: 3, background: '#2b2b30' } })
  .composite([{ input: card, left: 30, top: 4 }])
  .modulate({ brightness: 0.95 })
  .jpeg({ quality: 88 })
  .toFile(`${dir}photo.jpg`);
console.log('ok');

// Klatka dla udawanej kamery Chromium (--use-file-for-fake-video-capture): 1280×720, karta na środku.
const W = 1280, H = 720;
const small = await sharp(png).resize(412, 575).toBuffer();
const { data } = await sharp({ create: { width: W, height: H, channels: 3, background: '#2b2b30' } })
  .composite([{ input: small, left: Math.round((W - 412) / 2), top: Math.round((H - 575) / 2) }])
  .removeAlpha().raw().toBuffer({ resolveWithObject: true });
const Y = Buffer.alloc(W * H), U = Buffer.alloc((W / 2) * (H / 2)), V = Buffer.alloc((W / 2) * (H / 2));
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 3, r = data[i], g = data[i + 1], b = data[i + 2];
  Y[y * W + x] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  if (y % 2 === 0 && x % 2 === 0) {
    const j = (y / 2) * (W / 2) + x / 2;
    U[j] = Math.round(128 - 0.168736 * r - 0.331264 * g + 0.5 * b);
    V[j] = Math.round(128 + 0.5 * r - 0.418688 * g - 0.081312 * b);
  }
}
const { writeFileSync } = await import('node:fs');
writeFileSync(`${dir}camera.y4m`, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F30:1 Ip A1:1 C420jpeg\nFRAME\n`), Y, U, V]));
console.log('camera.y4m ok');
