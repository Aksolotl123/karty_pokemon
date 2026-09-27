import { useRef, useState } from 'preact/hooks';
import {
  duplicates, duplicatesAsText, makeExport, parseExport, spareCount, tradeProposal,
  type CollectionEntry, type CollectionExport,
} from '../lib/collection';
import { dateStamp, readFileText, shareFile, shareText } from '../lib/share';
import type { Settings } from '../lib/storage';
import { CardRow } from './CardRow';

interface Props {
  entries: CollectionEntry[];
  settings: Settings;
}

export function Trade({ entries, settings }: Props) {
  const [friend, setFriend] = useState<CollectionExport | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const keep = settings.keep;
  const mine = duplicates(entries, keep);
  const proposal = friend ? tradeProposal(entries, friend.entries, keep) : null;

  async function loadFriend(file: File | undefined) {
    if (!file) return;
    try {
      setFriend(parseExport(await readFileText(file)));
      setMessage(null);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function run(action: () => Promise<string | void>) {
    try {
      setMessage((await action()) || null);
    } catch (e) {
      setMessage(`Nie udało się: ${(e as Error).message}`);
    }
  }

  const owner = settings.owner.trim() || 'moja-kolekcja';

  return (
    <section class="trade">
      <h2>Wymiana z kolegą/koleżanką</h2>
      <ol class="steps">
        <li>Wyślij swoją kolekcję znajomemu (przycisk niżej).</li>
        <li>Poproś o plik z jego/jej aplikacji.</li>
        <li>Wczytaj go — pokażę, co możecie sobie wymienić.</li>
      </ol>
      <div class="row">
        <button class="primary" disabled={!entries.length} onClick={() => run(() => shareFile(`${safeFilename(owner)}-${dateStamp()}.json`, JSON.stringify(makeExport(entries, settings.owner)), 'application/json', 'Moja kolekcja kart Pokémon'))}>Wyślij moją kolekcję</button>
        <button class="secondary" onClick={() => fileRef.current?.click()}>Wczytaj plik znajomego</button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => loadFriend(e.currentTarget.files?.[0])} />
      {message && <p class="status">{message}</p>}

      {proposal && friend && (
        <div class="proposal">
          <h3>{friend.owner} może Ci dać ({proposal.forMe.length})</h3>
          {proposal.forMe.length ? (
            <ul class="card-list">{proposal.forMe.map((e) => <CardRow key={e.key} entry={e}><span class="badge">×{spareCount(e, keep)}</span></CardRow>)}</ul>
          ) : <p class="empty">Brak dubli, których Ci brakuje.</p>}
          <h3>Ty możesz dać {friend.owner} ({proposal.forThem.length})</h3>
          {proposal.forThem.length ? (
            <ul class="card-list">{proposal.forThem.map((e) => <CardRow key={e.key} entry={e}><span class="badge">×{spareCount(e, keep)}</span></CardRow>)}</ul>
          ) : <p class="empty">Nie masz dubli, których brakuje znajomemu.</p>}
          <button class="secondary" onClick={() => setFriend(null)}>Zamknij porównanie</button>
        </div>
      )}

      <h2>Moje dublety ({mine.reduce((n, e) => n + spareCount(e, keep), 0)})</h2>
      <p class="hint">Zostawiam sobie {keep} szt. każdej karty — resztę można wymienić (zmienisz w Ustawieniach).</p>
      {mine.length ? (
        <>
          <button class="secondary" onClick={() => run(() => shareText(duplicatesAsText(entries, keep), 'Karty na wymianę'))}>Wyślij listę dubli jako tekst</button>
          <ul class="card-list">{mine.map((e) => <CardRow key={e.key} entry={e}><span class="badge">×{spareCount(e, keep)}</span></CardRow>)}</ul>
        </>
      ) : <p class="empty">Nie masz jeszcze dubli.</p>}
    </section>
  );
}

function safeFilename(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'kolekcja';
}
