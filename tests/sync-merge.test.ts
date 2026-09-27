import { describe, expect, it } from 'vitest';
import { addCard, type CardRef, type CollectionEntry } from '../src/lib/collection';
import { docId, parseRemoteDoc, planMerge, tombstone } from '../src/lib/sync-merge';

const ref = (id: string): CardRef => ({ cardId: id, name: id, localId: '1', setId: 's', setName: 'S', variant: 'normal', lang: 'en' });
const at = (iso: string) => new Date(`2026-09-${iso}Z`);
const entry = (id: string, qty: number, time: string): CollectionEntry => ({ ...addCard(undefined, ref(id), qty, at(time)) });
const key = (id: string) => `${id}|normal|en`;

describe('planMerge', () => {
  it('nowsza wersja wygrywa w obie strony', () => {
    const local = [entry('a', 1, '01T10:00:00'), entry('b', 5, '02T10:00:00')];
    const remote = [entry('a', 3, '01T12:00:00'), entry('b', 2, '01T12:00:00')];
    const plan = planMerge(local, remote, true);
    expect(plan.saveLocal.map((e) => [e.key, e.quantity])).toEqual([[key('a'), 3]]);
    expect(plan.upload.map((e) => [e.key, e.quantity])).toEqual([[key('b'), 5]]);
    expect(plan.deleteLocal).toEqual([]);
  });

  it('identyczne dane → nic do zrobienia (echo własnego zapisu)', () => {
    const e = entry('a', 2, '01T10:00:00');
    expect(planMerge([e], [{ ...e }], true)).toEqual({ saveLocal: [], deleteLocal: [], upload: [] });
  });

  it('nowe karty z chmury i z telefonu', () => {
    const plan = planMerge([entry('mine', 1, '01T10:00:00')], [entry('cloud', 1, '01T10:00:00')], true);
    expect(plan.saveLocal.map((e) => e.cardId)).toEqual(['cloud']);
    expect(plan.upload.map((e) => e.cardId)).toEqual(['mine']);
  });

  it('bez pełnego stanu nie wysyła kart, których nie ma w zmianach', () => {
    expect(planMerge([entry('mine', 1, '01T10:00:00')], [], false).upload).toEqual([]);
  });

  it('usunięcie na innym urządzeniu usuwa kartę, chyba że dodano ją później', () => {
    const t = tombstone(key('a'), at('01T12:00:00'));
    expect(planMerge([entry('a', 1, '01T10:00:00')], [t], true).deleteLocal).toEqual([t]);
    const readded = planMerge([entry('a', 1, '01T13:00:00')], [t], true);
    expect(readded.deleteLocal).toEqual([]);
    expect(readded.upload.map((e) => e.cardId)).toEqual(['a']);
    // nagrobek dla karty, której nie mamy — nic nie robimy i nie wysyłamy
    expect(planMerge([], [t], true)).toEqual({ saveLocal: [], deleteLocal: [], upload: [] });
  });
});

describe('parseRemoteDoc', () => {
  it('rozpoznaje nagrobek i pozycję, odrzuca śmieci', () => {
    expect(parseRemoteDoc({ key: 'k', deleted: true, updatedAt: '2026-09-01T00:00:00.000Z' })).toEqual({ key: 'k', deleted: true, updatedAt: '2026-09-01T00:00:00.000Z' });
    const e = entry('a', 2, '01T10:00:00');
    expect(parseRemoteDoc(e)).toEqual(e);
    expect(parseRemoteDoc({ deleted: true })).toBeNull();
    expect(parseRemoteDoc(null)).toBeNull();
    expect(parseRemoteDoc({ ...e, quantity: 0 })).toBeNull();
  });
});

describe('docId', () => {
  it('nie zawiera znaków niedozwolonych w Firestore', () => {
    const id = docId('sv03.5-001/x|reverse|en');
    expect(id).not.toMatch(/[/.]/);
    expect(id).not.toMatch(/^__.*__$/);
    expect(decodeURIComponent(id)).toBe('sv03.5-001/x|reverse|en');
  });
});
