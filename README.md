# Zdjęcia weselne 📷

Aplikacja (PWA), dzięki której goście weselni jednym dotknięciem wysyłają zdjęcia
prosto do folderu na Waszym Dysku Google — bez logowania, bez instalacji, bez kont.
Gość skanuje kod QR, robi zdjęcie (albo wybiera z galerii), opcjonalnie dopisuje
krótki opis i wysyła. Zdjęcia lądują na Waszym Dysku Google.

- **Bez aplikacji do zainstalowania** — otwiera się w przeglądarce telefonu.
- **Działa offline** — brak zasięgu na sali? Zdjęcie poczeka i wyśle się samo, gdy wróci internet.
- **Prywatnie** — zdjęcia trafiają na Wasz Dysk Google, nie na żaden obcy serwer.
- **Dla każdego** — duże przyciski, polskie napisy, prosty i elegancki ekran.

---

## Spis treści

1. [Jak to działa](#jak-to-działa)
2. [Co będzie potrzebne](#co-będzie-potrzebne)
3. [Wdrożenie krok po kroku](#wdrożenie-krok-po-kroku)
   - [Część 1 — Folder na Dysku Google](#część-1--folder-na-dysku-google)
   - [Część 2 — Backend (Google Apps Script)](#część-2--backend-google-apps-script)
   - [Część 3 — Publikacja strony (GitHub Pages)](#część-3--publikacja-strony-github-pages)
   - [Część 4 — Kod QR na stoliki](#część-4--kod-qr-na-stoliki)
4. [Checklista przedślubna](#checklista-przedślubna)
5. [Bezpieczeństwo i świadome kompromisy](#bezpieczeństwo-i-świadome-kompromisy)
6. [Limity Google (Drive / Apps Script)](#limity-google-drive--apps-script)
7. [Rozwiązywanie problemów](#rozwiązywanie-problemów)
8. [Dla programistów (uruchomienie lokalne)](#dla-programistów-uruchomienie-lokalne)

---

## Jak to działa

```
Gość (telefon)                     Wasz Dysk Google
┌──────────────┐   HTTPS POST     ┌────────────────┐
│  Strona PWA  │ ───────────────► │ Google Apps    │ ──► Folder ze zdjęciami
│ (GitHub Pages)│  zdjęcie (JPEG) │ Script (backend)│
└──────────────┘                  └────────────────┘
```

Strona to statyczna aplikacja hostowana za darmo na GitHub Pages. Backendem jest
skrypt Google Apps Script działający na Waszym koncie Google — to on zapisuje pliki
w folderze. Nie ma żadnego własnego serwera ani bazy danych do utrzymania.

---

## Co będzie potrzebne

- **Konto Google** (najlepiej dedykowane na wesele — patrz uwaga o pojemności niżej).
- **Konto GitHub** (darmowe) — do hostowania strony.
- Około **30–45 minut** na jednorazową konfigurację.

Nie musisz umieć programować. Wystarczy dokładnie wykonać poniższe kroki.

---

## Wdrożenie krok po kroku

### Część 1 — Folder na Dysku Google

1. Wejdź na [drive.google.com](https://drive.google.com) i utwórz nowy folder,
   np. **„Zdjęcia weselne"**.
2. Otwórz ten folder. Popatrz na adres w przeglądarce — wygląda tak:
   `https://drive.google.com/drive/folders/`**`1AbC...XyZ`**
3. Skopiuj tę końcówkę (ciąg po `folders/`). To jest **ID folderu** — przyda się za chwilę.

### Część 2 — Backend (Google Apps Script)

1. Wejdź na [script.google.com](https://script.google.com) → **Nowy projekt**.
2. Nazwij projekt (np. „Wesele — upload"), a następnie:
   - W lewym panelu kliknij plik `Code.gs`, usuń jego zawartość i wklej całą
     zawartość pliku [`gas/Code.gs`](gas/Code.gs) z tego repozytorium.
   - Wejdź w **Ustawienia projektu** (ikona koła zębatego) i zaznacz
     **„Pokaż plik manifestu »appsscript.json« w edytorze"**. Wróć do edytora,
     otwórz `appsscript.json` i wklej zawartość [`gas/appsscript.json`](gas/appsscript.json).
3. Ustaw dane konfiguracyjne w **Ustawienia projektu → Właściwości skryptu**
   (Script Properties). Dodaj trzy właściwości:

   | Nazwa | Wartość | Przykład |
   |---|---|---|
   | `GOOGLE_DRIVE_FOLDER_ID` | ID folderu z Części 1 | `1AbC...XyZ` |
   | `UPLOAD_TOKEN` | długi, losowy ciąg znaków | `wesele-2026-9f3k7t2q8w...` |
   | `EVENT_END_DATE` | ostatni dzień przyjmowania zdjęć (`RRRR-MM-DD`) | `2026-09-13` |

   > `UPLOAD_TOKEN` wymyśl sam — im dłuższy i bardziej losowy, tym lepiej.
   > Zapamiętaj go: ten **sam** ciąg wpiszesz później w GitHub jako `VITE_UPLOAD_TOKEN`.
   > Po `EVENT_END_DATE` (włącznie do końca tego dnia) aplikacja przestaje przyjmować zdjęcia.

4. Kliknij **Wdróż → Nowe wdrożenie**:
   - **Typ**: „Aplikacja internetowa" (Web app).
   - **Wykonaj jako**: „Ja" (Me).
   - **Kto ma dostęp**: „Wszyscy" (Anyone).
   - Kliknij **Wdróż**, zatwierdź uprawnienia (Google zapyta o dostęp do Dysku — zezwól).
   - Skopiuj **URL aplikacji internetowej** — kończy się na **`/exec`**.
     Ten adres wpiszesz w GitHub jako `VITE_GAS_URL`.

> ⚠️ **Najważniejsza pułapka Apps Script.** Sama edycja kodu **nie** aktualizuje
> działającej aplikacji. Po **każdej** zmianie w `Code.gs` musisz zrobić:
> **Wdróż → Zarządzaj wdrożeniami → (ołówek/Edytuj) → Wersja: Nowa wersja → Wdróż**.
> Adres `/exec` pozostaje ten sam, ale zaczyna serwować nowy kod dopiero po utworzeniu nowej wersji.

**Szybki test backendu (opcjonalnie):** wklej URL `/exec` w przeglądarce — powinien
zwrócić krótką odpowiedź JSON (np. o nieprawidłowym żądaniu), a nie błąd Google.
To znaczy, że backend żyje.

### Część 3 — Publikacja strony (GitHub Pages)

1. Utwórz na GitHub **nowe repozytorium** o nazwie **`wedding-photos`** i wgraj do
   niego zawartość tego projektu (przez „Upload files" lub `git push`).

   > 📌 Nazwa repozytorium musi brzmieć dokładnie **`wedding-photos`**, bo taka jest
   > ścieżka bazowa aplikacji. Jeśli chcesz inną nazwę, zmień `BASE_PATH`
   > w pliku `vite.config.ts` (to jedyne miejsce) na `'/twoja-nazwa/'`.

2. W repozytorium wejdź w **Settings → Secrets and variables → Actions →
   New repository secret** i dodaj **dwa sekrety**:

   | Nazwa sekretu | Wartość |
   |---|---|
   | `VITE_GAS_URL` | adres `/exec` z Części 2 |
   | `VITE_UPLOAD_TOKEN` | ten sam `UPLOAD_TOKEN` co w Script Properties |

3. Wejdź w **Settings → Pages** i w polu **Source** wybierz **„GitHub Actions"**.
4. Gotowe. Każdy push do gałęzi `main` automatycznie zbuduje i opublikuje stronę
   (workflow: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).
   Po zakończeniu (zakładka **Actions**) strona będzie pod adresem:

   ```
   https://TWOJA-NAZWA-UZYTKOWNIKA.github.io/wedding-photos/
   ```

### Część 4 — Kod QR na stoliki

1. Wygeneruj kod QR z adresem strony z Części 3 (dowolny generator QR, np. wpisz
   adres w wyszukiwarkę „generator QR").
2. Wydrukuj go **duży i czytelny**, z krótką zachętą, np.
   *„Zeskanuj i podziel się z nami zdjęciami z tego dnia 💛"*.
3. Rozłóż na stolikach. To wszystko — goście skanują i wysyłają.

---

## Checklista przedślubna

- [ ] `EVENT_END_DATE` ustawiona na właściwy dzień (np. dzień po weselu).
- [ ] Podmienione **ikony PWA** — pliki w `public/icons/` to tymczasowe placeholdery.
      Wstaw własne (192×192 i 512×512 PNG; dla iOS warto dodać 180×180 jako
      `apple-touch-icon`).
- [ ] Kod QR **wygenerowany i wydrukowany**, przetestowany skanerem telefonu.
- [ ] **Test end-to-end na iPhonie (Safari)** i **Androidzie (Chrome)**: zrób
      zdjęcie → wyślij → sprawdź, że plik pojawił się w folderze na Dysku.
- [ ] **Test trybu offline**: włącz tryb samolotowy → wyślij zdjęcie → włącz
      internet → sprawdź, że wysłało się samo.
- [ ] **Pojemność Dysku** sprawdzona (ile wolnego miejsca — patrz niżej).
- [ ] Rozważ **dedykowane konto Google** na wesele (czyste 15 GB, porządek, prywatność).

---

## Bezpieczeństwo i świadome kompromisy

Ta aplikacja jest zaprojektowana pod **maksymalną frekwencję gości**, a nie pod
poziom bezpieczeństwa banku. Świadomie przyjęto następujące kompromisy:

- **Token jest publiczny.** Każda zmienna `VITE_*` trafia do kodu przeglądarki, więc
  `VITE_UPLOAD_TOKEN` jest widoczny dla każdego, kto otworzy stronę. To **nie** jest
  tajny klucz — to filtr odsiewający przypadkowy ruch i proste boty. Kto ma link/QR,
  ten ma i token. To celowe: brak logowania = więcej wysłanych zdjęć.
- **Każdy z linkiem może wysłać zdjęcie.** Taki jest zamysł (goście). Zabezpieczenia
  to: token, data zakończenia (`EVENT_END_DATE`), walidacja typu i rozmiaru pliku
  oraz sanityzacja opisu.
- **Brak automatycznej moderacji treści.** Zdjęcia trafiają wprost do folderu.
  W razie nadużyć możesz: zmienić `UPLOAD_TOKEN` (unieważnia stary link), cofnąć
  wdrożenie Apps Script, lub po prostu usunąć plik z Dysku.
- **Dane gości.** Zdjęcia to dane osobowe i trafiają na **Wasz prywatny Dysk Google**
  — nie do żadnej firmy trzeciej. Upload zawsze idzie do sieci i **nie** jest
  cache'owany przez aplikację.
- **Idempotencja.** Każde zdjęcie ma unikalny identyfikator, więc ponowienie wysyłki
  (np. po chwilowym braku sieci) nie tworzy duplikatów na Dysku.

Jeśli potrzebujesz twardej kontroli dostępu lub moderacji — ta architektura nie jest
do tego przeznaczona.

---

## Limity Google (Drive / Apps Script)

**Pojemność Dysku.** Darmowe konto Google ma **15 GB** współdzielone z Gmailem i
Dyskiem. Zdjęcie po kompresji waży zwykle ~1–2 MB, co daje orientacyjnie
**~8 000–10 000 zdjęć** na czystym koncie. Jeśli konto jest już zapełnione albo
spodziewasz się ogromnej liczby zdjęć, użyj dedykowanego konta lub wykup Google One.

**Apps Script.** Backend korzysta z limitów konta Google:

- czas jednego wykonania do **6 minut** (nasz zapis trwa ułamek sekundy),
- ok. **30 równoczesnych wykonań**,
- dzienne limity zapisów na Dysku.

Aplikacja sama łagodzi obciążenie: wysyła maksymalnie **2 zdjęcia równolegle** na
telefon i **ponawia z odczekiwaniem** (backoff) przy błędach. Przy typowym weselu
(ok. 100–150 gości) to z zapasem wystarcza. Przy bardzo dużej imprezie rozważ konto
Google Workspace (wyższe limity).

---

## Rozwiązywanie problemów

**Nic się nie wysyła / błąd wysyłki.**
Sprawdź kolejno: (1) `VITE_GAS_URL` kończy się na `/exec`; (2) po każdej zmianie
kodu `Code.gs` utworzono **nową wersję wdrożenia** Apps Script; (3) `UPLOAD_TOKEN`
w Script Properties jest **identyczny** z sekretem `VITE_UPLOAD_TOKEN` w GitHub.

**Biała strona / błędy 404 na plikach po wdrożeniu.**
Niezgodna ścieżka bazowa. Repozytorium musi nazywać się `wedding-photos` **albo**
zmień `BASE_PATH` w `vite.config.ts` na `'/nazwa-twojego-repo/'` i wypchnij zmianę.

**Błąd „CORS" w konsoli.**
Apps Script odpowiada przez przekierowanie (302) — to normalne. Aplikacja używa
prostego żądania (`Content-Type: text/plain`, bez własnych nagłówków), więc nie
wywołuje preflightu. Jeśli mimo to widzisz CORS przy preflight — upewnij się, że do
żądania nie dodano żadnych dodatkowych nagłówków.

**Komunikat o HEIC.**
Format HEIC dekoduje natywnie tylko Safari. Na Androidzie/komputerze aplikacja
poprosi o wybór zdjęcia JPEG lub zmianę ustawień aparatu. Na iPhonie działa bez zmian.

**iOS: zdjęcie „utknęło" po zablokowaniu ekranu.**
iOS usypia karty w tle. Aplikacja wznawia wysyłkę po powrocie do karty. Poproś
gości, żeby nie zamykali karty do zakończenia wysyłki (jest o tym komunikat na ekranie).

**„Przekroczono limit".**
Chwilowo osiągnięto limit Google. Aplikacja sama ponawia po odczekaniu; przy bardzo
dużym ruchu rozważ konto Workspace.

---

## Dla programistów (uruchomienie lokalne)

Wymagania: **Node.js 20.19+ lub 22**.

```bash
npm install
cp .env.example .env.local   # uzupełnij VITE_GAS_URL i VITE_UPLOAD_TOKEN
npm run dev                  # serwer deweloperski
```

Pozostałe polecenia:

```bash
npm run build        # produkcyjny build (z type-checkiem) → dist/
npm run preview      # podgląd produkcyjnego builda
npm run test         # testy jednostkowe i komponentów (Vitest)
npm run lint         # ESLint
npm run format       # Prettier
```

**Stos technologiczny:** Vue 3 + TypeScript, Pinia, Vite, vite-plugin-pwa (Workbox),
Dexie (IndexedDB), Zod. Kompresja zdjęć w Web Workerze (OffscreenCanvas) z fallbackiem
na główny wątek. Kolejka wysyłki z ponawianiem i trwałością offline w IndexedDB.
Backend: Google Apps Script (`gas/`). Hosting: GitHub Pages. Bez własnego serwera,
bez Firebase/Supabase.
