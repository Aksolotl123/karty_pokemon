import type { Settings } from '../lib/storage';
import type { SyncState } from '../lib/sync';
import { SyncPanel } from './SyncPanel';

const LANGS: [Settings['lang'], string][] = [
  ['en', 'Angielski'], ['de', 'Niemiecki'], ['fr', 'Francuski'], ['it', 'Włoski'], ['es', 'Hiszpański'], ['pt', 'Portugalski'],
];

export function SettingsView({ settings, onChange, sync }: { settings: Settings; onChange: (s: Settings) => void; sync: SyncState }) {
  return (
    <section class="settings">
      <SyncPanel state={sync} />
      <label>
        Twoje imię / ksywka (widoczne dla znajomych przy wymianie)
        <input value={settings.owner} maxLength={40} onInput={(e) => onChange({ ...settings, owner: e.currentTarget.value })} />
      </label>
      <label>
        Język kart, które skanujesz
        <select value={settings.lang} onChange={(e) => onChange({ ...settings, lang: e.currentTarget.value as Settings['lang'] })}>
          {LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label>
        Ile sztuk każdej karty zostawiasz sobie (reszta to dublety)
        <input type="number" min={1} max={10} value={settings.keep}
          onChange={(e) => onChange({ ...settings, keep: Math.min(10, Math.max(1, parseInt(e.currentTarget.value, 10) || 1)) })} />
      </label>
      <div class="about">
        <h3>Jak skanować</h3>
        <ul>
          <li>Połóż kartę na ciemnym, matowym tle, w dobrym świetle, bez odblasków.</li>
          <li>Karta powinna wypełniać ramkę. Najważniejszy jest ostry numer w dolnym rogu (np. 025/198).</li>
          <li>Jeśli podgląd jest nieostry, użyj przycisku „Zdjęcie” — aparat robi ostrzejsze zdjęcia.</li>
          <li>Zawsze możesz poprawić nazwę/numer ręcznie i szukać ponownie.</li>
        </ul>
        <p>Dane kart i obrazki: <a href="https://tcgdex.dev" target="_blank" rel="noopener">TCGdex</a>. Kolekcja jest zapisana na tym urządzeniu{sync.kind === 'off' ? '' : ' i — po zalogowaniu — w Twojej prywatnej chmurze Firebase'}.</p>
      </div>
    </section>
  );
}
