// Klient publicznego API TCGdex (https://tcgdex.dev) — darmowe, bez klucza,
// z obrazkami kart i wieloma językami.

export const API_BASE = 'https://api.tcgdex.net/v2';

export interface CardBrief {
  id: string;
  localId: string;
  name: string;
  image?: string;
}

export interface SetBrief {
  id: string;
  name: string;
  logo?: string;
  symbol?: string;
  cardCount: { total: number; official: number };
}

export interface SetDetail extends SetBrief {
  releaseDate?: string;
  cards: CardBrief[];
}

export interface CardDetail extends CardBrief {
  rarity?: string;
  category?: string;
  set: SetBrief;
  variants?: { normal?: boolean; reverse?: boolean; holo?: boolean; firstEdition?: boolean };
}

export type Lang = 'en' | 'de' | 'fr' | 'it' | 'es' | 'pt';

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

/** Adres obrazka karty. TCGdex zwraca bazowy URL bez rozszerzenia. */
export function cardImageUrl(image: string | undefined, quality: 'low' | 'high' = 'low'): string | undefined {
  return image ? `${image}/${quality}.webp` : undefined;
}

/** Id setu z id karty ("swsh3-136" → "swsh3"). Id setów mogą zawierać "-" i ".". */
export function setIdFromCardId(cardId: string): string {
  const i = cardId.lastIndexOf('-');
  return i > 0 ? cardId.slice(0, i) : cardId;
}

type Fetch = typeof fetch;

export interface CardApi {
  sets(): Promise<SetBrief[]>;
  set(id: string): Promise<SetDetail>;
  card(id: string): Promise<CardDetail>;
  searchByName(name: string): Promise<CardBrief[]>;
}

export function createApi(lang: Lang, fetchImpl: Fetch = (...a) => fetch(...a), timeoutMs = 15000): CardApi {
  const setCache = new Map<string, Promise<SetDetail>>();
  let setsPromise: Promise<SetBrief[]> | null = null;

  async function get<T>(path: string): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetchImpl(`${API_BASE}/${lang}${path}`, { signal: ctrl.signal });
    } catch (e) {
      throw new ApiError(ctrl.signal.aborted ? 'Przekroczono czas oczekiwania na bazę kart' : 'Brak połączenia z bazą kart (TCGdex)');
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 404) throw new ApiError(`Nie znaleziono: ${path}`, 404);
    if (!res.ok) throw new ApiError(`Baza kart zwróciła błąd ${res.status}`, res.status);
    return (await res.json()) as T;
  }

  // Nieudane zapytania usuwamy z cache, żeby kolejna próba poszła do sieci.
  function cached<T>(map: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
    let p = map.get(key);
    if (!p) {
      p = load();
      map.set(key, p);
      p.catch(() => map.delete(key));
    }
    return p;
  }

  return {
    sets() {
      if (!setsPromise) {
        setsPromise = get<SetBrief[]>('/sets');
        setsPromise.catch(() => { setsPromise = null; });
      }
      return setsPromise;
    },
    set: (id) => cached(setCache, id, () => get<SetDetail>(`/sets/${encodeURIComponent(id)}`)),
    card: (id) => get<CardDetail>(`/cards/${encodeURIComponent(id)}`),
    async searchByName(name) {
      const q = name.trim();
      if (!q) return [];
      const result = await get<CardBrief[]>(`/cards?name=${encodeURIComponent(q)}`);
      return Array.isArray(result) ? result : [];
    },
  };
}
