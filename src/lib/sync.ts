// Synchronizacja kolekcji z Firebase (logowanie + Firestore).
// SDK Firebase ładujemy dopiero przy potrzebie, żeby nie spowalniać startu aplikacji.
import type { Auth, User } from 'firebase/auth';
import type { Firestore, Unsubscribe } from 'firebase/firestore';
import type { CollectionEntry } from './collection';
import { firebaseConfig } from './firebase-config';
import { docId, parseRemoteDoc, planMerge, tombstone, type RemoteDoc, type Tombstone } from './sync-merge';

export type SyncState =
  | { kind: 'off' } // brak konfiguracji Firebase
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'syncing' | 'synced' | 'pending' | 'error'; user: { email: string | null; name: string | null }; message?: string };

export interface SyncHost {
  getLocal(): Promise<CollectionEntry[]>;
  applyRemote(save: CollectionEntry[], remove: Tombstone[]): Promise<void>;
  onState(state: SyncState): void;
}

export const syncConfigured = firebaseConfig !== null;

interface Fb {
  auth: Auth;
  db: Firestore;
  authMod: typeof import('firebase/auth');
  fsMod: typeof import('firebase/firestore');
}

let fbPromise: Promise<Fb> | null = null;
let currentUser: User | null = null;
let stopListening: Unsubscribe | null = null;

function loadFirebase(): Promise<Fb> {
  if (!firebaseConfig) return Promise.reject(new Error('Synchronizacja nie jest skonfigurowana.'));
  fbPromise ??= (async () => {
    const [{ initializeApp }, authMod, fsMod] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore'),
    ]);
    const app = initializeApp(firebaseConfig!);
    const db = fsMod.initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      // Kolejka zapisów przetrwa brak internetu i zamknięcie aplikacji.
      localCache: fsMod.persistentLocalCache({ tabManager: fsMod.persistentMultipleTabManager() }),
    });
    return { auth: authMod.getAuth(app), db, authMod, fsMod };
  })();
  return fbPromise;
}

function userInfo(u: User) {
  return { email: u.email, name: u.displayName };
}

/** Uruchamia nasłuch logowania; po zalogowaniu scala kolekcje i słucha zmian z chmury. */
export async function startSync(host: SyncHost): Promise<void> {
  if (!syncConfigured) return host.onState({ kind: 'off' });
  host.onState({ kind: 'loading' });
  let fb: Fb;
  try {
    fb = await loadFirebase();
  } catch (e) {
    console.error(e);
    return host.onState({ kind: 'signed-out' });
  }
  fb.authMod.onAuthStateChanged(fb.auth, (user) => {
    stopListening?.();
    stopListening = null;
    currentUser = user;
    if (!user) return host.onState({ kind: 'signed-out' });
    host.onState({ kind: 'syncing', user: userInfo(user) });
    listen(fb, user, host);
  });
}

function listen(fb: Fb, user: User, host: SyncHost) {
  const { collection, onSnapshot } = fb.fsMod;
  let first = true; // czekamy na pierwszy snapshot z serwera
  // Zmiany przetwarzamy po kolei — nowy snapshot czeka na zakończenie poprzedniego.
  let queue = Promise.resolve();
  stopListening = onSnapshot(
    collection(fb.db, 'users', user.uid, 'cards'),
    { includeMetadataChanges: true },
    (snap) => {
      // Pełne scalanie (wysłanie kart, których chmura nie zna) tylko na świeżym stanie z serwera —
      // stara pamięć podręczna mogłaby nie znać usunięć z innych urządzeń.
      const full = first && !snap.metadata.fromCache;
      if (full) first = false;
      const docs = (full ? snap.docs : snap.docChanges().filter((c) => c.type !== 'removed').map((c) => c.doc))
        .map((d) => parseRemoteDoc(d.data()))
        .filter((d): d is RemoteDoc => d !== null);
      const pending = snap.metadata.hasPendingWrites || snap.metadata.fromCache;
      queue = queue
        .then(async () => {
          const plan = planMerge(await host.getLocal(), docs, full);
          await host.applyRemote(plan.saveLocal, plan.deleteLocal);
          if (plan.upload.length) await upload(fb, user.uid, plan.upload);
          if (currentUser?.uid === user.uid) host.onState({ kind: pending ? 'pending' : 'synced', user: userInfo(user) });
        })
        .catch((e) => host.onState({ kind: 'error', user: userInfo(user), message: describeError(e) }));
    },
    (e) => host.onState({ kind: 'error', user: userInfo(user), message: describeError(e) }),
  );
}

async function upload(fb: Fb, uid: string, docs: RemoteDoc[]): Promise<void> {
  const { doc, writeBatch } = fb.fsMod;
  // Limit Firestore: 500 operacji na batch.
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(fb.db);
    for (const d of docs.slice(i, i + 400)) batch.set(doc(fb.db, 'users', uid, 'cards', docId(d.key)), d);
    // Nie czekamy na serwer: bez internetu Firestore wyśle zapisy później.
    batch.commit().catch((e) => console.error('Nie wysłano zmian do chmury', e));
  }
}

/** Wysyła lokalne zmiany (no-op, gdy nikt nie jest zalogowany). */
export async function pushChanges(entries: CollectionEntry[], deletedKeys: string[] = []): Promise<void> {
  if (!currentUser || !fbPromise) return;
  const docs: RemoteDoc[] = [...entries, ...deletedKeys.map((k) => tombstone(k))];
  if (docs.length) await upload(await fbPromise, currentUser.uid, docs);
}

// ---------- Logowanie ----------

export async function signInWithGoogle(): Promise<void> {
  const { auth, authMod } = await loadFirebase();
  await authMod.signInWithPopup(auth, new authMod.GoogleAuthProvider());
}

export async function signInWithEmail(email: string, password: string, createAccount: boolean): Promise<void> {
  const { auth, authMod } = await loadFirebase();
  if (createAccount) await authMod.createUserWithEmailAndPassword(auth, email.trim(), password);
  else await authMod.signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function resetPassword(email: string): Promise<void> {
  const { auth, authMod } = await loadFirebase();
  await authMod.sendPasswordResetEmail(auth, email.trim());
}

export async function signOutSync(): Promise<void> {
  const { auth, authMod } = await loadFirebase();
  await authMod.signOut(auth);
}

const AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Nieprawidłowy e-mail lub hasło.',
  'auth/invalid-email': 'Nieprawidłowy adres e-mail.',
  'auth/user-not-found': 'Nie ma konta z tym adresem.',
  'auth/wrong-password': 'Nieprawidłowe hasło.',
  'auth/email-already-in-use': 'Konto z tym adresem już istnieje — zaloguj się.',
  'auth/weak-password': 'Hasło musi mieć co najmniej 6 znaków.',
  'auth/popup-closed-by-user': 'Zamknięto okno logowania.',
  'auth/cancelled-popup-request': 'Zamknięto okno logowania.',
  'auth/popup-blocked': 'Przeglądarka zablokowała okno logowania. Zezwól na wyskakujące okna albo użyj e-maila.',
  'auth/unauthorized-domain': 'Ten adres strony nie jest dodany w Firebase (Authentication → Settings → Authorized domains).',
  'auth/operation-not-allowed': 'Ta metoda logowania nie jest włączona w konsoli Firebase.',
  'auth/network-request-failed': 'Brak połączenia z internetem.',
  'auth/too-many-requests': 'Za dużo prób. Spróbuj za chwilę.',
  'permission-denied': 'Brak dostępu do bazy — sprawdź reguły Firestore (plik firestore.rules).',
  unavailable: 'Brak połączenia z chmurą — zmiany zostaną wysłane później.',
};

export function describeError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  return AUTH_MESSAGES[code] ?? `Błąd synchronizacji${code ? ` (${code})` : ''}.`;
}
