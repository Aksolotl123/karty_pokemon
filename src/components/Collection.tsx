import { useMemo, useRef, useState } from 'preact/hooks';
import { bySetThenNumber, filterEntries, makeExport, parseExport, stats, toCsv, type CollectionEntry } from '../lib/collection';
import { dateStamp, downloadFile, readFileText } from '../lib/share';
import type { Settings } from '../lib/storage';
import { CardRow } from './CardRow';

interface Props {
  entries: CollectionEntry[];
  settings: Settings;
  onQuantity: (key: string, quantity: number) => Promise<void>;
  onImport: (entries: CollectionEntry[]) => Promise<void>;
}

type Sort = 'set' | 'name' | 'recent' | 'qty';

export function Collection({ entries, settings, onQuantity, onImport }: Props) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const s = stats(entries, settings.keep);
  const shown = useMemo(() => {
    const list = [...filterEntries(entries, query)];
    const cmp: Record<Sort, (a: CollectionEntry, b: CollectionEntry) => number> = {
      set: bySetThenNumber,
      name: (a, b) => a.name.localeCompare(b.name) || bySetThenNumber(a, b),
      recent: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      qty: (a, b) => b.quantity - a.quantity || bySetThenNumber(a, b),
    };
    return list.sort(cmp[sort]);
  }, [entries, query, sort]);

  async function importBackup(file: File | undefined) {
    if (!file) return;
    try {
      const data = parseExport(await readFileText(file));
      if (!confirm(`Wczytać ${data.entries.length} pozycji z kopii „${data.owner}”? Pozycje o tych samych kartach zostaną nadpisane.`)) return;
      await onImport(data.entries);
      setMessage(`Wczytano ${data.entries.length} pozycji.`);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function changeQty(e: CollectionEntry, q: number) {
    if (q === 0 && !confirm(`Usunąć ${e.name} z kolekcji?`)) return;
    onQuantity(e.key, q).catch((err) => setMessage(`Nie zapisano: ${(err as Error).message}`));
  }

  return (
    <section class="collection">
      <div class="stats">
        <div><b>{s.unique}</b><span>różnych kart</span></div>
        <div><b>{s.total}</b><span>sztuk razem</span></div>
        <div><b>{s.spare}</b><span>na wymianę</span></div>
      </div>

      <div class="toolbar">
        <input type="search" placeholder="Szukaj: nazwa, set, numer" value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
        <select value={sort} onChange={(e) => setSort(e.currentTarget.value as Sort)} aria-label="Sortowanie">
          <option value="recent">Ostatnio dodane</option>
          <option value="set">Set i numer</option>
          <option value="name">Nazwa</option>
          <option value="qty">Ilość</option>
        </select>
      </div>

      {entries.length === 0 ? (
        <p class="empty">Kolekcja jest pusta. Przejdź do „Skaner” i zeskanuj pierwszą kartę.</p>
      ) : (
        <ul class="card-list">
          {shown.map((e) => (
            <CardRow key={e.key} entry={e}>
              <div class="qty">
                <button onClick={() => changeQty(e, e.quantity - 1)} aria-label="Mniej">−</button>
                <output>{e.quantity}</output>
                <button onClick={() => changeQty(e, e.quantity + 1)} aria-label="Więcej">+</button>
              </div>
            </CardRow>
          ))}
        </ul>
      )}

      <details class="backup">
        <summary>Kopia zapasowa i eksport</summary>
        <p>Dane są zapisane tylko na tym telefonie. Rób kopię co jakiś czas.</p>
        <div class="row">
          <button class="secondary" disabled={!entries.length} onClick={() => downloadFile(`karty-pokemon-${dateStamp()}.json`, JSON.stringify(makeExport(entries, settings.owner), null, 1), 'application/json')}>Kopia (JSON)</button>
          <button class="secondary" disabled={!entries.length} onClick={() => downloadFile(`karty-pokemon-${dateStamp()}.csv`, '﻿' + toCsv(entries, settings.keep), 'text/csv')}>Arkusz (CSV)</button>
          <button class="secondary" onClick={() => fileRef.current?.click()}>Wczytaj kopię</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => importBackup(e.currentTarget.files?.[0])} />
      </details>
      {message && <p class="status">{message}</p>}
    </section>
  );
}
