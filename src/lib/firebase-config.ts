// Konfiguracja projektu Firebase (Konsola Firebase → Ustawienia projektu → Twoje aplikacje → Aplikacja internetowa).
// Te wartości NIE są tajne — trafiają do przeglądarki każdego użytkownika. Dane chronią
// reguły Firestore (plik firestore.rules), które pozwalają każdemu czytać i zapisywać tylko własną kolekcję.
// null = synchronizacja wyłączona (aplikacja działa wtedy tylko lokalnie).
import type { FirebaseOptions } from 'firebase/app';

export const firebaseConfig: FirebaseOptions | null = null;
