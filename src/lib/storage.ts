// Trwały zapis kolekcji w IndexedDB (na telefonie, bez serwera).
import { createStore, del, get, set, values, setMany, update } from 'idb-keyval';
import { addCard, type CardRef, type CollectionEntry, entryKey } from './collection';

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

export async function setQuantity(key: string, quantity: number): Promise<void> {
  if (quantity <= 0) return del(key, store);
  const e = await get<CollectionEntry>(key, store);
  if (!e) return;
  await set(key, { ...e, quantity, updatedAt: new Date().toISOString() }, store);
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
