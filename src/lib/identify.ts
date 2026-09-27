// Dopasowanie wyniku OCR (nazwa + numer) do kart z bazy.
import { nameSimilarity, sameLocalId, type CollectorNumber } from './text';
import { setIdFromCardId, type CardApi, type CardBrief, type SetBrief } from './tcgdex';

export interface ScanHint {
  name?: string | null;
  number?: CollectorNumber | null;
}

export interface Candidate {
  card: CardBrief;
  setId: string;
  setName: string;
  /** 0..1 — pewność dopasowania. */
  score: number;
  /** Czy numer z karty zgadza się z numerem i wielkością setu. */
  numberMatch: boolean;
}

const MAX_SETS_BY_TOTAL = 12;
const MAX_RESULTS = 24;

/**
 * Zwraca listę kandydatów posortowaną od najlepszego.
 * 1) numer "025/198" → sety z 198 kartami oficjalnymi → karta nr 25 w każdym z nich,
 * 2) nazwa → wyszukiwanie po nazwie (+ premia, gdy numer też się zgadza).
 */
export async function identify(api: CardApi, hint: ScanHint): Promise<Candidate[]> {
  const name = hint.name?.trim() || null;
  const number = hint.number ?? null;
  if (!name && !number) return [];

  const sets = await api.sets();
  const setsById = new Map(sets.map((s) => [s.id, s]));
  const found = new Map<string, Candidate>();

  const add = (card: CardBrief, set: SetBrief | undefined, numberMatch: boolean) => {
    const sim = name ? nameSimilarity(name, card.name) : 0;
    // Numer + wielkość setu to bardzo silny sygnał; nazwa rozstrzyga między setami
    // o tej samej liczbie kart.
    const score = numberMatch ? (name ? 0.55 + 0.45 * sim : 0.7) : 0.6 * sim;
    const setId = set?.id ?? setIdFromCardId(card.id);
    const prev = found.get(card.id);
    if (!prev || prev.score < score) {
      found.set(card.id, { card, setId, setName: set?.name ?? setId, score, numberMatch });
    }
  };

  const totalNum = number && /^\d+$/.test(number.total) ? parseInt(number.total, 10) : null;

  if (number && totalNum !== null) {
    const matchingSets = sets.filter((s) => s.cardCount?.official === totalNum).slice(0, MAX_SETS_BY_TOTAL);
    const details = await Promise.allSettled(matchingSets.map((s) => api.set(s.id)));
    details.forEach((r, i) => {
      if (r.status !== 'fulfilled') return;
      const card = r.value.cards?.find((c) => sameLocalId(c.localId, number.local));
      if (card) add(card, matchingSets[i], true);
    });
  }

  if (name) {
    const byName = await api.searchByName(name);
    for (const card of byName) {
      const set = setsById.get(setIdFromCardId(card.id));
      const numberMatch =
        !!number &&
        sameLocalId(card.localId, number.local) &&
        (totalNum === null || set?.cardCount?.official === totalNum);
      add(card, set, numberMatch);
    }
  }

  return [...found.values()]
    .filter((c) => c.numberMatch || c.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);
}
