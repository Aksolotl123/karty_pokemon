// Czysta logika tekstowa: parsowanie wyników OCR i porównywanie nazw kart.

export interface CollectorNumber {
  /** Numer karty w secie, tak jak jest wydrukowany, np. "25", "025", "TG12". */
  local: string;
  /** Liczba po ukośniku, np. "198" lub "TG30". */
  total: string;
}

// OCR często myli litery z cyframi w krótkich numerach — poprawiamy tylko
// wewnątrz dopasowanego numeru, nigdy w całym tekście.
const DIGIT_FIXES: Record<string, string> = { O: '0', o: '0', D: '0', Q: '0', I: '1', l: '1', '|': '1', i: '1', S: '5', s: '5', B: '8', Z: '2', z: '2' };

function fixDigits(s: string): string {
  return s.replace(/[OoDQIl|iSsBZz]/g, (c) => DIGIT_FIXES[c] ?? c);
}

/**
 * Szuka numeru kolekcjonerskiego w stylu "025/198", "TG12/TG30", "SV045/SV122".
 * Zwraca pierwszy wiarygodny wynik albo null.
 */
export function parseCollectorNumber(text: string): CollectorNumber | null {
  const re = /(?<![A-Za-z0-9])([A-Z]{1,3})?([0-9OoDQIl|iSsBZz]{1,3})\s*[/\\]\s*([A-Z]{1,3})?([0-9OoDQIl|iSsBZz]{2,3})(?![0-9])/g;
  for (const m of text.matchAll(re)) {
    const [, rawPrefixA = '', rawA, prefixB = '', rawB] = m;
    // Prefiks (TG, GG, SV...) występuje zawsze po obu stronach ukośnika;
    // samotne litery przed numerem to np. kod języka "EN" sklejony przez OCR.
    const prefixA = prefixB ? rawPrefixA : '';
    const a = fixDigits(rawA);
    const b = fixDigits(rawB);
    if (!/^\d+$/.test(a) || !/^\d+$/.test(b)) continue;
    const total = parseInt(b, 10);
    if (total === 0) continue;
    // Numer bez prefiksu musi mieć co najmniej 2 cyfry albo pasować do liczby
    // kart — odrzuca przypadkowe "1/2" z tekstu ataków.
    if (!prefixA && !prefixB && b.length < 2) continue;
    return { local: prefixA + a, total: prefixB + b };
  }
  return null;
}

// Słowa z górnego paska karty, które nie są nazwą.
const NAME_STOPWORDS = new Set([
  'basic', 'stage', 'stage1', 'stage2', 'hp', 'pv', 'kp', 'evolves', 'from', 'trainer', 'item',
  'supporter', 'stadium', 'tool', 'energy', 'pokemon', 'pokémon', 'tera', 'restored', 'mega',
  'level', 'lv', 'break', 'put', 'this', 'card', 'on', 'the', 'of',
]);

/** Nazwy, które faktycznie są częścią nazwy karty (ex, V, VMAX, GX...). */
const NAME_SUFFIXES = new Set(['ex', 'gx', 'v', 'vmax', 'vstar', 'vunion', 'lv.x', 'prime', 'legend', 'star', 'δ']);

/**
 * Wybiera najbardziej prawdopodobną nazwę karty z linii tekstu rozpoznanych
 * w górnym pasku karty. Linie z większą wysokością (większa czcionka) wygrywają.
 */
export function extractName(lines: { text: string; height?: number }[]): string | null {
  let best: { name: string; score: number } | null = null;
  for (const line of lines) {
    const words = line.text
      .replace(/[^\p{L}\p{N}.'’\- ]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean);
    const kept: string[] = [];
    for (const w of words) {
      const lw = w.toLowerCase();
      if (NAME_SUFFIXES.has(lw) && kept.length > 0) { kept.push(w); continue; }
      if (NAME_STOPWORDS.has(lw)) continue;
      if (/\d/.test(w)) continue; // HP 120, "Stage 1" itd.
      if (!/\p{L}{2,}/u.test(w)) continue;
      kept.push(w);
    }
    if (kept.length === 0 || kept.length > 4) continue;
    const name = kept.join(' ');
    const letters = (name.match(/\p{L}/gu) ?? []).length;
    if (letters < 3) continue;
    const score = (line.height ?? 10) * 10 + letters;
    if (!best || score > best.score) best = { name, score };
  }
  return best?.name ?? null;
}

/** Normalizuje nazwę do porównań: małe litery, bez akcentów i znaków specjalnych. */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Podobieństwo nazw w zakresie 0..1 (1 = identyczne po normalizacji). */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  // OCR często dokleja/gubi przyrostek ("Pikachu" vs "Pikachu ex") — prefiks liczymy wysoko.
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (shorter.length >= 4 && longer.startsWith(shorter)) return 0.85;
  return Math.max(0, 1 - levenshtein(na, nb) / Math.max(na.length, nb.length));
}

/** Porównuje numery kart w secie: "025" == "25", "tg12" == "TG12". */
export function sameLocalId(a: string, b: string): boolean {
  const norm = (s: string) => s.toUpperCase().replace(/^([A-Z]*)0*(\d)/, '$1$2');
  return norm(a) === norm(b);
}
