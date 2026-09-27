// Model kolekcji i czyste operacje na niej (bez zapisu — ten jest w storage.ts).

export type Variant = 'normal' | 'reverse' | 'holo' | 'firstEdition';

export const VARIANT_LABELS: Record<Variant, string> = {
  normal: 'Zwykła',
  reverse: 'Reverse holo',
  holo: 'Holo',
  firstEdition: '1. edycja',
};

export interface CollectionEntry {
  /** Klucz: `${cardId}|${variant}|${lang}` — ta sama karta w innym wariancie to osobna pozycja. */
  key: string;
  cardId: string;
  name: string;
  localId: string;
  setId: string;
  setName: string;
  image?: string;
  variant: Variant;
  lang: string;
  quantity: number;
  addedAt: string;
  updatedAt: string;
}

export type CardRef = Omit<CollectionEntry, 'key' | 'quantity' | 'addedAt' | 'updatedAt'>;

export function entryKey(ref: Pick<CardRef, 'cardId' | 'variant' | 'lang'>): string {
  return `${ref.cardId}|${ref.variant}|${ref.lang}`;
}

/** Dodaje `count` sztuk karty; zwraca nową/zmienioną pozycję. */
export function addCard(existing: CollectionEntry | undefined, ref: CardRef, count = 1, now = new Date()): CollectionEntry {
  if (!Number.isInteger(count) || count < 1) throw new Error(`Nieprawidłowa liczba sztuk: ${count}`);
  const ts = now.toISOString();
  if (existing) return { ...existing, quantity: existing.quantity + count, updatedAt: ts };
  return { ...ref, key: entryKey(ref), quantity: count, addedAt: ts, updatedAt: ts };
}

export interface CollectionStats {
  unique: number;
  total: number;
  spare: number;
}

export function stats(entries: CollectionEntry[], keep = 1): CollectionStats {
  let total = 0;
  let spare = 0;
  for (const e of entries) {
    total += e.quantity;
    spare += spareCount(e, keep);
  }
  return { unique: new Set(entries.map((e) => e.cardId)).size, total, spare };
}

/** Ile sztuk można oddać, zostawiając sobie `keep` egzemplarzy. */
export function spareCount(e: CollectionEntry, keep = 1): number {
  return Math.max(0, e.quantity - keep);
}

export function duplicates(entries: CollectionEntry[], keep = 1): CollectionEntry[] {
  return entries.filter((e) => spareCount(e, keep) > 0).sort(bySetThenNumber);
}

export function bySetThenNumber(a: CollectionEntry, b: CollectionEntry): number {
  return (
    a.setName.localeCompare(b.setName) ||
    a.localId.localeCompare(b.localId, undefined, { numeric: true }) ||
    a.variant.localeCompare(b.variant)
  );
}

export function filterEntries(entries: CollectionEntry[], query: string): CollectionEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(
    (e) => e.name.toLowerCase().includes(q) || e.setName.toLowerCase().includes(q) || e.localId.toLowerCase() === q,
  );
}

// ---------- Eksport / import do wymiany ----------

export const EXPORT_FORMAT = 'karty-pokemon/v1';

export interface CollectionExport {
  format: typeof EXPORT_FORMAT;
  owner: string;
  exportedAt: string;
  entries: CollectionEntry[];
}

export function makeExport(entries: CollectionEntry[], owner: string, now = new Date()): CollectionExport {
  return { format: EXPORT_FORMAT, owner: owner.trim() || 'Bez nazwy', exportedAt: now.toISOString(), entries };
}

const VARIANTS = new Set<string>(Object.keys(VARIANT_LABELS));
const str = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;

/** Waliduje plik od znajomego — dane z zewnątrz, więc sprawdzamy każde pole. */
export function parseExport(json: string): CollectionExport {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('To nie jest poprawny plik JSON.');
  }
  const d = data as Partial<CollectionExport>;
  if (!d || d.format !== EXPORT_FORMAT || !Array.isArray(d.entries)) {
    throw new Error('To nie jest plik kolekcji z tej aplikacji.');
  }
  const entries: CollectionEntry[] = [];
  for (const raw of d.entries as Partial<CollectionEntry>[]) {
    if (!raw || !str(raw.cardId) || !str(raw.name) || !VARIANTS.has(raw.variant as string)) continue;
    const quantity = Number(raw.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) continue;
    const image = str(raw.image, 500) && /^https:\/\//.test(raw.image) ? raw.image : undefined;
    const ref: CardRef = {
      cardId: raw.cardId,
      name: raw.name,
      localId: str(raw.localId, 20) ? raw.localId : '',
      setId: str(raw.setId) ? raw.setId : '',
      setName: str(raw.setName) ? raw.setName : '',
      image,
      variant: raw.variant as Variant,
      lang: str(raw.lang, 10) ? raw.lang : 'en',
    };
    const ts = typeof raw.addedAt === 'string' ? raw.addedAt : new Date(0).toISOString();
    entries.push({ ...ref, key: entryKey(ref), quantity, addedAt: ts, updatedAt: ts });
  }
  return {
    format: EXPORT_FORMAT,
    owner: str(d.owner, 60) ? d.owner : 'Znajomy',
    exportedAt: typeof d.exportedAt === 'string' ? d.exportedAt : '',
    entries,
  };
}

export interface TradeProposal {
  /** Ich dublety, których ja nie mam wcale. */
  forMe: CollectionEntry[];
  /** Moje dublety, których oni nie mają wcale. */
  forThem: CollectionEntry[];
}

/**
 * Porównuje kolekcje na poziomie karty (id), bez rozróżniania wariantu:
 * brakująca karta to taka, której nie ma się w żadnym wariancie.
 */
export function tradeProposal(mine: CollectionEntry[], theirs: CollectionEntry[], keep = 1): TradeProposal {
  const myIds = new Set(mine.map((e) => e.cardId));
  const theirIds = new Set(theirs.map((e) => e.cardId));
  return {
    forMe: duplicates(theirs, keep).filter((e) => !myIds.has(e.cardId)),
    forThem: duplicates(mine, keep).filter((e) => !theirIds.has(e.cardId)),
  };
}

// ---------- Eksport tekstowy / CSV ----------

export function duplicatesAsText(entries: CollectionEntry[], keep = 1): string {
  const dups = duplicates(entries, keep);
  if (dups.length === 0) return 'Nie mam jeszcze dubli.';
  const lines = dups.map((e) => `• ${e.name} — ${e.setName} #${e.localId}${e.variant === 'normal' ? '' : ` (${VARIANT_LABELS[e.variant]})`} ×${spareCount(e, keep)}`);
  return `Moje karty Pokémon na wymianę:\n${lines.join('\n')}`;
}

function csvCell(v: string | number): string {
  const s = String(v);
  // Zabezpieczenie przed wstrzykiwaniem formuł w arkuszach kalkulacyjnych.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(entries: CollectionEntry[], keep = 1): string {
  const header = ['Nazwa', 'Set', 'Numer', 'Wariant', 'Język', 'Ilość', 'Na wymianę', 'ID karty'];
  const rows = [...entries].sort(bySetThenNumber).map((e) =>
    [e.name, e.setName, e.localId, VARIANT_LABELS[e.variant], e.lang, e.quantity, spareCount(e, keep), e.cardId].map(csvCell).join(','),
  );
  return [header.join(','), ...rows].join('\n');
}
