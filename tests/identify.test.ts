import { describe, expect, it, vi } from 'vitest';
import { identify } from '../src/lib/identify';
import type { CardApi, SetBrief, SetDetail } from '../src/lib/tcgdex';

const sets: SetBrief[] = [
  { id: 'sv01', name: 'Scarlet & Violet', cardCount: { official: 198, total: 258 } },
  { id: 'swsh6', name: 'Chilling Reign', cardCount: { official: 198, total: 233 } },
  { id: 'swsh3', name: 'Darkness Ablaze', cardCount: { official: 189, total: 201 } },
];
const details: Record<string, SetDetail> = {
  sv01: { ...sets[0], cards: [{ id: 'sv01-025', localId: '025', name: 'Pawmi' }] },
  swsh6: { ...sets[1], cards: [{ id: 'swsh6-25', localId: '25', name: 'Charizard' }] },
  swsh3: { ...sets[2], cards: [{ id: 'swsh3-25', localId: '25', name: 'Charizard' }] },
};

function fakeApi(byName: Record<string, { id: string; localId: string; name: string }[]> = {}): CardApi {
  return {
    sets: vi.fn(async () => sets),
    set: vi.fn(async (id: string) => details[id]),
    card: vi.fn(),
    searchByName: vi.fn(async (n: string) => byName[n] ?? []),
  };
}

describe('identify', () => {
  it('numer + liczba kart wybiera sety, nazwa rozstrzyga', async () => {
    const api = fakeApi();
    const res = await identify(api, { name: 'Pawmi', number: { local: '025', total: '198' } });
    expect(res.map((c) => c.card.id)).toEqual(['sv01-025', 'swsh6-25']);
    expect(res[0].numberMatch).toBe(true);
    expect(res[0].setName).toBe('Scarlet & Violet');
    expect(api.set).not.toHaveBeenCalledWith('swsh3');
  });

  it('sama nazwa → wyszukiwanie po nazwie, numer daje premię', async () => {
    const api = fakeApi({ Charizard: [
      { id: 'swsh3-25', localId: '25', name: 'Charizard' },
      { id: 'swsh6-25', localId: '25', name: 'Charizard' },
    ] });
    const res = await identify(api, { name: 'Charizard', number: { local: '25', total: '189' } });
    expect(res[0].card.id).toBe('swsh3-25');
    expect(res[0].numberMatch).toBe(true);
    expect(res[1].numberMatch).toBe(false);
  });

  it('numery z prefiksem (TG) dopasowuje przez nazwę', async () => {
    const api = fakeApi({ Pikachu: [{ id: 'swsh11tg-TG05', localId: 'TG05', name: 'Pikachu' }] });
    const res = await identify(api, { name: 'Pikachu', number: { local: 'TG5', total: 'TG30' } });
    expect(res[0].numberMatch).toBe(true);
  });

  it('niepodobne nazwy są odfiltrowane', async () => {
    const api = fakeApi({ Pikachu: [{ id: 'x-1', localId: '1', name: 'Zygarde' }] });
    expect(await identify(api, { name: 'Pikachu' })).toEqual([]);
  });

  it('brak danych → brak zapytań', async () => {
    const api = fakeApi();
    expect(await identify(api, { name: '  ', number: null })).toEqual([]);
    expect(api.sets).not.toHaveBeenCalled();
  });

  it('błąd jednego setu nie psuje wyniku', async () => {
    const api = fakeApi();
    api.set = vi.fn(async (id: string) => { if (id === 'sv01') throw new Error('500'); return details[id]; });
    const res = await identify(api, { number: { local: '25', total: '198' } });
    expect(res.map((c) => c.card.id)).toEqual(['swsh6-25']);
  });
});
