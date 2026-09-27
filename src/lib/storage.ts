// Trwały zapis kolekcji w IndexedDB (na telefonie, bez serwera).
import { createStore, del, get, promisifyRequest, set, setMany, update, values } from 'idb-keyval';
import { addCard, type CardRef, type CollectionEntry, entryKey } from './collection';
import type { Tombstone } from './sync-merge';

const store = createStore('karty-pokemon', 'collection');

export async function loadCollection(): Promise<CollectionEntry[]> {
  return values<CollectionEntry>(store);
}

/** Atomowo zwiększa liczbę sztuk (bezpieczne przy szybkim, podwójnym kliknięciu). */
export async function addToCollection(ref: CardRef, count = 1): Promise<CollectionEntry> {
  let result!: CollectionEntry;
  await update<CollectionEntry>(
    entryKey(ref),
    (existing) => (result = addCard(existing, ref, count)),
    store,
  );
  return result;
}

/** Zwraca zmienioną pozycję albo null, gdy została usunięta (lub nie istniała). */
export async function setQuantity(key: string, quantity: number): Promise<CollectionEntry | null> {
  if (quantity <= 0) {
    await del(key, store);
    return null;
  }
  const e = await get<CollectionEntry>(key, store);
  if (!e) return null;
  const next = { ...e, quantity, updatedAt: new Date().toISOString() };
  await set(key, next, store);
  return next;
}

/**
 * Zmiany z chmury. W jednej transakcji sprawdzamy updatedAt, żeby nie nadpisać
 * zmiany zrobionej na telefonie w tej samej chwili.
 */
export async function applyRemote(save: CollectionEntry[], remove: Tombstone[]): Promise<void> {
  if (!save.length && !remove.length) return;
  await store('readwrite', async (s) => {
    const current = await Promise.all(
      [...save, ...remove].map((r) => promisifyRequest(s.get(r.key) as IDBRequest<CollectionEntry | undefined>)),
    );
    save.forEach((e, i) => {
      const old = current[i];
      if (!old || old.updatedAt < e.updatedAt) s.put(e, e.key);
    });
    remove.forEach((t, i) => {
      const old = current[save.length + i];
      if (old && old.updatedAt <= t.updatedAt) s.delete(t.key);
    });
    return promisifyRequest(s.transaction);
  });
}

/** Import kopii zapasowej: zastępuje pozycje o tych samych kluczach. */
export async function importEntries(entries: CollectionEntry[]): Promise<void> {
  await setMany(entries.map((e) => [e.key, e] as [string, CollectionEntry]), store);
}

// Ustawienia są małe — wystarczy localStorage; brak dostępu nie może psuć aplikacji.
export interface Settings {
  owner: string;
  lang: 'en' | 'de' | 'fr' | 'it' | 'es' | 'pt';
  keep: number;
}

const DEFAULTS: Settings = { owner: '', lang: 'en', keep: 1 };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem('karty-pokemon:settings');
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem('karty-pokemon:settings', JSON.stringify(s));
  } catch (e) {
    console.warn('Nie udało się zapisać ustawień', e);
  }
}

/** Prosi przeglądarkę, żeby nie czyściła danych przy braku miejsca. */
export async function requestPersistence(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch (e) {
    console.warn('Brak trwałego magazynu', e);
  }
}
