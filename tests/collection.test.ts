import { describe, expect, it } from 'vitest';
import {
  addCard, duplicates, duplicatesAsText, entryKey, makeExport, parseExport, stats, toCsv, tradeProposal,
  type CardRef, type CollectionEntry,
} from '../src/lib/collection';

const ref = (cardId: string, extra: Partial<CardRef> = {}): CardRef => ({
  cardId, name: cardId.toUpperCase(), localId: cardId.split('-')[1] ?? '1', setId: cardId.split('-')[0],
  setName: 'Set ' + cardId.split('-')[0], variant: 'normal', lang: 'en', ...extra,
});
const entry = (cardId: string, quantity: number, extra: Partial<CardRef> = {}): CollectionEntry => {
  let e = addCard(undefined, ref(cardId, extra), 1, new Date('2026-01-01T00:00:00Z'));
  if (quantity > 1) e = addCard(e, ref(cardId, extra), quantity - 1, new Date('2026-01-01T00:00:00Z'));
  return e;
};

describe('addCard', () => {
  it('tworzy i zwiększa pozycję', () => {
    const a = addCard(undefined, ref('sv01-25'));
    expect(a.quantity).toBe(1);
    expect(a.key).toBe('sv01-25|normal|en');
    expect(addCard(a, ref('sv01-25'), 2).quantity).toBe(3);
  });
  it('odrzuca nieprawidłowe ilości', () => {
    expect(() => addCard(undefined, ref('a-1'), 0)).toThrow();
    expect(() => addCard(undefined, ref('a-1'), 1.5)).toThrow();
  });
  it('wariant to osobna pozycja', () => {
    expect(entryKey(ref('a-1', { variant: 'reverse' }))).not.toBe(entryKey(ref('a-1')));
  });
});

describe('duplikaty i statystyki', () => {
  const col = [entry('a-1', 3), entry('a-2', 1), entry('a-1', 2, { variant: 'reverse' })];
  it('liczy dublety z parametrem „zostaw”', () => {
    expect(duplicates(col).length).toBe(2);
    expect(duplicates(col, 2).map((e) => e.key)).toEqual(['a-1|normal|en']);
    expect(stats(col)).toEqual({ unique: 2, total: 6, spare: 3 });
    expect(stats([])).toEqual({ unique: 0, total: 0, spare: 0 });
  });
  it('tekst do wysłania', () => {
    expect(duplicatesAsText([])).toContain('Nie mam');
    const t = duplicatesAsText(col);
    expect(t).toContain('A-1 — Set a #1 ×2');
    expect(t).toContain('(Reverse holo) ×1');
  });
});

describe('wymiana', () => {
  it('proponuje tylko karty, których druga strona nie ma w żadnym wariancie', () => {
    const mine = [entry('a-1', 2), entry('a-2', 3), entry('a-3', 1)];
    const theirs = [entry('a-2', 1, { variant: 'reverse' }), entry('a-4', 2), entry('a-3', 5)];
    const p = tradeProposal(mine, theirs);
    expect(p.forThem.map((e) => e.cardId)).toEqual(['a-1']);
    expect(p.forMe.map((e) => e.cardId)).toEqual(['a-4']);
  });
});

describe('eksport / import', () => {
  it('przechodzi w obie strony', () => {
    const col = [entry('a-1', 2)];
    const back = parseExport(JSON.stringify(makeExport(col, ' Ola ')));
    expect(back.owner).toBe('Ola');
    expect(back.entries).toEqual(col);
  });
  it('odrzuca obce pliki', () => {
    expect(() => parseExport('nie json')).toThrow(/JSON/);
    expect(() => parseExport('{"format":"inne","entries":[]}')).toThrow(/tej aplikacji/);
  });
  it('pomija uszkodzone pozycje i niebezpieczne adresy obrazków', () => {
    const file = {
      format: 'karty-pokemon/v1', owner: 'X', entries: [
        { ...entry('a-1', 1), image: 'javascript:alert(1)' },
        { ...entry('a-2', 1), quantity: -3 },
        { ...entry('a-3', 1), variant: 'zlota' },
        { cardId: 'a-4' },
      ],
    };
    const res = parseExport(JSON.stringify(file));
    expect(res.entries.map((e) => e.cardId)).toEqual(['a-1']);
    expect(res.entries[0].image).toBeUndefined();
  });
});

describe('CSV', () => {
  it('escapuje przecinki, cudzysłowy i formuły', () => {
    const csv = toCsv([entry('a-1', 2, { name: 'Mr. "Mime", jr', setName: '=HYPERLINK()' })]);
    const row = csv.split('\n')[1];
    expect(row).toContain('"Mr. ""Mime"", jr"');
    expect(row).toContain("'=HYPERLINK()");
    expect(row).toContain(',2,1,');
  });
});
