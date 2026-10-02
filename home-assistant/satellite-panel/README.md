# Satellite Panel — panel ścienny dla satelity Assist

Własna karta Lovelace (`custom:satellite-panel-card`) dla telefonu z aplikacją
View Assist Companion (VACA). Wygląd w stylu dedykowanych paneli (NSPanel / Aqara):
duży zegar, pogoda, statusy, kafelki urządzeń, sceny. Do tego wskaźnik Pip-Boy,
który pokazuje fazy pracy asystenta głosowego.

| Stan `assist_satellite` | Co widać |
|---|---|
| `idle` | mała ikona Pip-Boy z migającym kursorem (dotknięcie = wybudzenie asystenta) |
| `listening` | pełnoekranowy terminal CRT, „NASŁUCHUJĘ”, animowany equalizer |
| `processing` | „PRZETWARZAM”, pasek ładowania, rozpoznany tekst (STT) |
| `responding` | „WYKONUJĘ”, odpowiedź asystenta (TTS) |
| koniec | „WYKONANO” ✓ przez `hold_ms` (domyślnie 3 s), potem powrót do panelu |

## Pliki
- `satellite-panel-card.js` — kod karty (w HA zarejestrowany jako zasób dashboardu, inline)
- `dashboard.yaml` — konfiguracja dashboardu `/panel-kuchnia/panel`

## Opcje karty
- `satellite` (wymagane) — encja `assist_satellite.*`; z niej wyliczane są `stt`, `tts`, `wake`
  (`sensor.<id>_stt`, `sensor.<id>_tts`, `button.<id>_wake`) — można je nadpisać
- `weather`, `info[]`, `tiles[]`, `scenes[]` — elementy panelu (`entity`, `name`, `icon`, `icon_on`, `confirm`)
- `confirm: true` — wymaga drugiego dotknięcia (np. płyta indukcyjna)
- przytrzymanie kafelka otwiera okno szczegółów encji

## Aktualizacja
Po zmianie kodu zaktualizuj zasób w HA (Ustawienia → Pulpity → Zasoby) i zrób
„Refresh” na satelicie (`button.vaca_57b6a763f_refresh`).
