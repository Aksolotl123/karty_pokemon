# Karty Pokémon — skaner kolekcji

Aplikacja na telefon (PWA) do inwentaryzacji kart Pokémon TCG: robisz zdjęcie karty
aparatem, aplikacja rozpoznaje ją i dodaje do kolekcji. Na tej podstawie widzisz swoje
dublety i możesz porównać kolekcję ze znajomym, żeby zobaczyć, co możecie sobie wymienić.

Nie wymaga instalacji ze sklepu ani serwera: działa w przeglądarce telefonu (Android/iPhone)
i można ją dodać do ekranu głównego jak zwykłą aplikację.

## Jak działa rozpoznawanie

1. **Kamera** — kartę ustawiasz w ramce i naciskasz „Skanuj” (albo „Zdjęcie”, żeby użyć
   systemowego aparatu z autofokusem, co daje ostrzejszy obraz).
2. **OCR na telefonie** ([Tesseract.js](https://tesseract.projectnaptha.com/)) odczytuje dwa
   fragmenty karty:
   - **numer kolekcjonerski** z dolnego rogu, np. `025/198` (także `TG12/TG30`, `SV045/SV122`),
   - **nazwę** z górnego paska, np. `Pikachu`, `Charizard ex`.
3. **Dopasowanie w bazie [TCGdex](https://tcgdex.dev)** (darmowe API z danymi i obrazkami
   wszystkich kart):
   - liczba po ukośniku (`198`) wskazuje sety o dokładnie tylu kartach, a numer (`025`) —
     kartę w każdym z nich; nazwa rozstrzyga, który set się zgadza,
   - gdy numer jest nieczytelny, szukamy po nazwie, a kandydatów porządkujemy także po
     podobieństwie obrazu (hash ilustracji).
4. Pokazuję listę kandydatów z obrazkami (zielona ramka = zgadza się numer i set).
   Stukasz właściwą kartę, wybierasz wariant (zwykła / reverse holo / holo / 1. edycja)
   i ilość. Nazwę i numer zawsze można poprawić ręcznie.

Silnik OCR i słownik są hostowane razem z aplikacją, więc po pierwszym uruchomieniu
rozpoznawanie tekstu działa bez internetu. Do wyszukania karty w bazie potrzebny jest internet.

## Kolekcja i wymiana

- **Kolekcja** jest zapisana w pamięci telefonu (IndexedDB), bez kont i serwerów.
  W „Kopia zapasowa i eksport” możesz pobrać kopię (JSON), arkusz (CSV) i wczytać kopię.
- **Dublety** to karty, których masz więcej niż ustawione „zostawiam sobie N sztuk” (domyślnie 1).
- **Wymiana**:
  1. „Wyślij moją kolekcję” — plik idzie przez systemowe „Udostępnij” (Messenger, WhatsApp, e-mail…),
  2. znajomy robi to samo w swojej aplikacji,
  3. „Wczytaj plik znajomego” pokazuje: co on/ona może dać Tobie (jego/jej dublety, których nie masz
     w żadnym wariancie) i co Ty możesz dać jemu/jej.
- „Wyślij listę dubli jako tekst” — gotowa wiadomość do wklejenia na grupę.

## Synchronizacja w chmurze (Firebase, opcjonalnie)

Bez konfiguracji aplikacja działa tylko lokalnie. Po podaniu konfiguracji Firebase w Ustawieniach
pojawia się „Kopia w chmurze” (logowanie Google lub e-mail + hasło):

- kolekcja jest w Firestore pod `users/{uid}/cards/…` — każdy widzi tylko swoją (reguły w `firestore.rules`),
- telefon nadal trzyma pełną kopię lokalnie i działa bez internetu; zmiany wysyłają się, gdy wróci sieć,
- przy konflikcie wygrywa nowsza zmiana danej karty; usunięcia zapisują się jako „nagrobki”, żeby inne urządzenie nie przywróciło karty,
- przy pierwszym logowaniu kolekcje z telefonu i z chmury są łączone.

Konfiguracja (jednorazowo, w [konsoli Firebase](https://console.firebase.google.com)):

1. Projekt → **Dodaj aplikację → Web** → skopiuj obiekt `firebaseConfig` do `src/lib/firebase-config.ts`.
2. **Authentication → Sign-in method**: włącz **Google** oraz **E-mail/hasło**.
3. **Authentication → Settings → Authorized domains**: dodaj `aksolotl123.github.io`.
4. **Firestore Database → Utwórz bazę** (tryb produkcyjny, region np. `eur3`), a w zakładce **Reguły** wklej zawartość `firestore.rules` i opublikuj.

Wartości w `firebaseConfig` nie są tajne (trafiają do przeglądarki) — dane chronią reguły Firestore.

## Uruchomienie

Wymagany Node.js 20+.

```bash
npm install
npm run dev        # serwer deweloperski (http://localhost:5173, także w sieci lokalnej)
npm test           # testy jednostkowe (Vitest)
npm run build      # wersja produkcyjna w dist/
npm run test:e2e   # testy w przeglądarce (Playwright) — skan z udawanej kamery i zdjęcia
```

> Kamera w przeglądarce wymaga **HTTPS** (wyjątek: `localhost`). Do testów na telefonie
> najprościej użyć wersji opublikowanej na GitHub Pages.

### Publikacja na GitHub Pages

Workflow `.github/workflows/ci.yml` przy każdym pushu uruchamia testy, a z gałęzi `main`
publikuje aplikację. Jednorazowo trzeba włączyć: **Settings → Pages → Source: GitHub Actions**.
Aplikacja będzie pod adresem `https://<użytkownik>.github.io/karty_pokemon/`.
(Pages dla repozytoriów prywatnych wymaga płatnego planu GitHub.)

Na telefonie: otwórz adres → menu przeglądarki → „Dodaj do ekranu głównego”.

## Struktura

| Plik | Co robi |
|---|---|
| `src/lib/text.ts` | parsowanie numeru i nazwy z tekstu OCR, porównywanie nazw |
| `src/lib/identify.ts` | dopasowanie wyniku OCR do kart z bazy |
| `src/lib/tcgdex.ts` | klient API TCGdex (z cache i timeoutem) |
| `src/lib/ocr.ts`, `image.ts`, `geometry.ts` | OCR, wycinanie fragmentów karty, hash obrazu |
| `src/lib/collection.ts` | model kolekcji, dublety, propozycja wymiany, eksport/import, CSV |
| `src/lib/storage.ts` | zapis w IndexedDB, ustawienia |
| `src/lib/sync.ts`, `sync-merge.ts` | synchronizacja z Firebase, scalanie zmian |
| `src/components/` | ekrany: Skaner, Kolekcja, Wymiana, Ustawienia |

## Ograniczenia i pomysły na dalszy rozwój

- Karty japońskie/koreańskie/chińskie nie są obsługiwane przez OCR (słownik łaciński).
  Języki europejskie wybierasz w Ustawieniach.
- Karty promo bez numeru „x/y” (np. `SWSH050`) rozpoznawane są po nazwie.
- Skuteczność zależy od zdjęcia: dobre światło, bez odblasków (holo!), karta wypełnia ramkę.
- Możliwe rozszerzenia: wspólna lista wymian online (na bazie Firebase), ceny z
  Cardmarket (TCGdex je udostępnia), stan karty (NM/LP…), rozpoznawanie samym obrazem
  (model ML na telefonie) dla kart z nieczytelnym tekstem.
