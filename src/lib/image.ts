// Operacje na obrazach w przeglądarce (canvas).
import { dHash, type Rect } from './geometry';

export type Source = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap;

export function sourceSize(src: Source): { w: number; h: number } {
  if (src instanceof HTMLVideoElement) return { w: src.videoWidth, h: src.videoHeight };
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth, h: src.naturalHeight };
  return { w: src.width, h: src.height };
}

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Kopiuje fragment źródła do nowego canvasa (np. „zamrożenie” klatki z kamery). */
export function crop(src: Source, r: Rect, scale = 1): HTMLCanvasElement {
  const c = canvas(r.w * scale, r.h * scale);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
  return c;
}

/**
 * Przygotowanie wycinka do OCR: powiększenie (mały druk numeru), skala szarości,
 * rozciągnięcie kontrastu. Binaryzację robi już Tesseract.
 */
export function prepareForOcr(src: Source, r: Rect, targetWidth = 1600, fixedScale?: number): HTMLCanvasElement {
  const scale = fixedScale ?? Math.min(4, Math.max(1, targetWidth / Math.max(1, r.w)));
  const c = crop(src, r, scale);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
    d[i] = g;
    hist[d[i]]++;
  }
  // Odcinamy 1% najciemniejszych i najjaśniejszych pikseli (odblaski).
  const n = d.length / 4;
  let lo = 0, hi = 255, acc = 0;
  while (lo < 255 && (acc += hist[lo]) < n * 0.01) lo++;
  acc = 0;
  while (hi > 0 && (acc += hist[hi]) < n * 0.01) hi--;
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.min(255, Math.max(0, ((d[i] - lo) * 255) / range));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const HASH_W = 16;
const HASH_H = 16;

/** Hash wyglądu karty (środek karty: grafika), odporny na drobne różnice oświetlenia. */
export function imageHash(src: Source, r?: Rect): Uint8Array {
  const { w, h } = sourceSize(src);
  const card = r ?? { x: 0, y: 0, w, h };
  // Obszar ilustracji — najbardziej charakterystyczna część karty.
  const art = { x: card.x + card.w * 0.08, y: card.y + card.h * 0.1, w: card.w * 0.84, h: card.h * 0.42 };
  const c = canvas(HASH_W + 1, HASH_H);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, art.x, art.y, art.w, art.h, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const gray = new Uint8Array(c.width * c.height);
  for (let i = 0; i < gray.length; i++) gray[i] = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000;
  return dHash(gray, HASH_W, HASH_H);
}

/** Wczytuje obrazek z innej domeny z CORS; odrzuca, gdy serwer nie pozwala. */
export function loadImage(url: string, timeoutMs = 8000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    const t = setTimeout(() => reject(new Error(`Timeout: ${url}`)), timeoutMs);
    img.onload = () => { clearTimeout(t); resolve(img); };
    img.onerror = () => { clearTimeout(t); reject(new Error(`Nie wczytano obrazka: ${url}`)); };
    img.src = url;
  });
}

/** Zdjęcie z aparatu → canvas (zmniejszony do rozsądnego rozmiaru, z orientacją EXIF). */
export async function fileToCanvas(file: File, maxSide = 3000): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    return crop(img, { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight }, scale);
  } catch {
    throw new Error('Nie udało się otworzyć zdjęcia.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
