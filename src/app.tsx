import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { Collection } from './components/Collection';
import { Scanner } from './components/Scanner';
import { SettingsView } from './components/SettingsView';
import { Trade } from './components/Trade';
import type { CardRef, CollectionEntry } from './lib/collection';
import {
  addToCollection, applyRemote, importEntries, loadCollection, loadSettings, requestPersistence, saveSettings, setQuantity, type Settings,
} from './lib/storage';
import { pushChanges, startSync, type SyncState } from './lib/sync';
import { createApi } from './lib/tcgdex';

type Tab = 'scan' | 'collection' | 'trade' | 'settings';
const TABS: [Tab, string, string][] = [
  ['scan', 'Skaner', '📷'],
  ['collection', 'Kolekcja', '🗂️'],
  ['trade', 'Wymiana', '🔄'],
  ['settings', 'Ustawienia', '⚙️'],
];

export function App() {
  const [tab, setTab] = useState<Tab>('scan');
  const [entries, setEntries] = useState<CollectionEntry[]>([]);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [toast, setToast] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncState>({ kind: 'off' });
  const api = useMemo(() => createApi(settings.lang), [settings.lang]);

  const reload = useCallback(() => loadCollection().then(setEntries), []);

  useEffect(() => {
    reload().catch((e) => setLoadError(`Nie udało się wczytać kolekcji: ${(e as Error).message}`));
    requestPersistence();
    startSync({
      getLocal: loadCollection,
      applyRemote: async (save, remove) => {
        if (!save.length && !remove.length) return;
        await applyRemote(save, remove);
        await reload();
      },
      onState: setSync,
    });
  }, []);

  // Błąd wysyłki nie może zablokować pracy na telefonie — dane są już zapisane lokalnie.
  const push = (entries: CollectionEntry[], deleted: string[] = []) =>
    pushChanges(entries, deleted).catch((e) => console.error('Synchronizacja', e));

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const owned = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) m.set(e.cardId, (m.get(e.cardId) ?? 0) + e.quantity);
    return m;
  }, [entries]);

  async function add(ref: CardRef, count: number) {
    const e = await addToCollection(ref, count);
    push([e]);
    await reload();
    setToast(`Dodano: ${e.name} (masz ${e.quantity} szt.)`);
  }

  function changeSettings(s: Settings) {
    setSettings(s);
    saveSettings(s);
  }

  return (
    <div class="app">
      <header>
        <h1>Karty Pokémon</h1>
      </header>
      <main>
        {loadError && <p class="error">{loadError}</p>}
        <div hidden={tab !== 'scan'}>
          <Scanner api={api} lang={settings.lang} active={tab === 'scan'} ownedCount={(id) => owned.get(id) ?? 0} onAdd={add} />
        </div>
        {tab === 'collection' && (
          <Collection
            entries={entries}
            settings={settings}
            onQuantity={async (key, q) => {
              const e = await setQuantity(key, q);
              push(e ? [e] : [], e ? [] : [key]);
              await reload();
            }}
            onImport={async (list) => { await importEntries(list); push(list); await reload(); }}
          />
        )}
        {tab === 'trade' && <Trade entries={entries} settings={settings} />}
        {tab === 'settings' && <SettingsView settings={settings} onChange={changeSettings} sync={sync} />}
      </main>
      {toast && <div class="toast" role="status">{toast}</div>}
      <nav class="tabs">
        {TABS.map(([id, label, icon]) => (
          <button key={id} class={tab === id ? 'on' : ''} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}>
            <span aria-hidden="true">{icon}</span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
