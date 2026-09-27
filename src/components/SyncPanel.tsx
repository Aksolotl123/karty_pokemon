import { useState } from 'preact/hooks';
import { describeError, resetPassword, signInWithEmail, signInWithGoogle, signOutSync, type SyncState } from '../lib/sync';

const STATUS: Record<string, string> = {
  syncing: 'Synchronizuję…',
  synced: 'Zsynchronizowano ✓',
  pending: 'Zmiany czekają na internet',
};

export function SyncPanel({ state }: { state: SyncState }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: () => Promise<void>, success?: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      if (success) setMessage(success);
    } catch (e) {
      setMessage(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  if (state.kind === 'off') return null;

  return (
    <div class="sync">
      <h3>Kopia w chmurze</h3>
      {state.kind === 'loading' && <p class="status">Łączę…</p>}

      {state.kind === 'signed-out' && (
        <>
          <p class="hint">Zaloguj się, żeby kolekcja była bezpieczna w chmurze i widoczna na innych urządzeniach.</p>
          <button class="primary" disabled={busy} onClick={() => run(signInWithGoogle)}>Zaloguj przez Google</button>
          <form class="email-login" onSubmit={(e) => { e.preventDefault(); run(() => signInWithEmail(email, password, false)); }}>
            <input type="email" autocomplete="email" placeholder="E-mail" value={email} onInput={(e) => setEmail(e.currentTarget.value)} required />
            <input type="password" autocomplete="current-password" placeholder="Hasło (min. 6 znaków)" value={password} onInput={(e) => setPassword(e.currentTarget.value)} required minLength={6} />
            <div class="row">
              <button type="submit" class="secondary" disabled={busy}>Zaloguj</button>
              <button type="button" class="secondary" disabled={busy || !email || password.length < 6} onClick={() => run(() => signInWithEmail(email, password, true))}>Załóż konto</button>
              <button type="button" class="link" disabled={busy || !email} onClick={() => run(() => resetPassword(email), 'Wysłano e-mail do zmiany hasła.')}>Nie pamiętam hasła</button>
            </div>
          </form>
        </>
      )}

      {'user' in state && (
        <>
          <p>Zalogowano: <b>{state.user.email ?? state.user.name}</b></p>
          <p class={state.kind === 'error' ? 'error' : 'status'}>{state.kind === 'error' ? state.message : STATUS[state.kind]}</p>
          <button class="secondary" disabled={busy} onClick={() => run(signOutSync)}>Wyloguj</button>
          <p class="hint">Po wylogowaniu kolekcja zostaje na tym telefonie.</p>
        </>
      )}
      {message && <p class="status">{message}</p>}
    </div>
  );
}
