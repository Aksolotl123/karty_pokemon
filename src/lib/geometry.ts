// Czysta geometria: ramka karty w podglądzie kamery i wycinki do OCR.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Proporcje karty Pokémon: 63 × 88 mm. */
export const CARD_ASPECT = 63 / 88;

/** Obszary karty (ułamki szerokości/wysokości), lekko wychodzące poza ramkę na wypadek niedokładnego ułożenia. */
export const REGIONS = {
  name: { x: 0.02, y: -0.03, w: 0.72, h: 0.19 },
  number: { x: -0.02, y: 0.83, w: 1.04, h: 0.2 },
} satisfies Record<string, Rect>;

/**
 * Przekształcenie `object-fit: cover`: jak piksele wideo mapują się na element.
 * Zwraca skalę i przesunięcie (w pikselach elementu).
 */
export function coverTransform(elW: number, elH: number, srcW: number, srcH: number) {
  const scale = Math.max(elW / srcW, elH / srcH);
  return { scale, offsetX: (elW - srcW * scale) / 2, offsetY: (elH - srcH * scale) / 2 };
}

/**
 * Ramka karty w pikselach źródła (wideo/zdjęcia), wycentrowana w widocznym obszarze.
 * `visibleW/H` — rozmiar części źródła, która jest widoczna na ekranie.
 */
export function cardGuide(srcW: number, srcH: number, visibleW = srcW, visibleH = srcH, fill = 0.82): Rect {
  let h = visibleH * fill;
  let w = h * CARD_ASPECT;
  if (w > visibleW * fill) {
    w = visibleW * fill;
    h = w / CARD_ASPECT;
  }
  return { x: (srcW - w) / 2, y: (srcH - h) / 2, w, h };
}

/** Wycinek karty w pikselach źródła, przycięty do granic obrazu. */
export function regionRect(card: Rect, region: Rect, srcW: number, srcH: number): Rect {
  const x0 = Math.max(0, card.x + region.x * card.w);
  const y0 = Math.max(0, card.y + region.y * card.h);
  const x1 = Math.min(srcW, card.x + (region.x + region.w) * card.w);
  const y1 = Math.min(srcH, card.y + (region.y + region.h) * card.h);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

// ---------- Podobieństwo obrazów (dHash) ----------

/** Hash różnicowy z obrazu w skali szarości o wymiarach (w+1) × h. */
export function dHash(gray: ArrayLike<number>, w: number, h: number): Uint8Array {
  const bits = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      bits[y * w + x] = gray[y * (w + 1) + x] < gray[y * (w + 1) + x + 1] ? 1 : 0;
    }
  }
  return bits;
}

export function hashSimilarity(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let same = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) same++;
  return same / a.length;
}
