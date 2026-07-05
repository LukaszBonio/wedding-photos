<div align="center">

# Zdjecia weselne

**PWA do przesylania zdjec weselnych na Dysk Google**

[![Deploy](https://github.com/LukaszBonio/wedding-photos/actions/workflows/deploy.yml/badge.svg)](https://github.com/LukaszBonio/wedding-photos/actions/workflows/deploy.yml)
![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D?logo=vuedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-ready-5A0FC8?logo=pwa&logoColor=white)

Gosc skanuje kod QR, robi zdjecie, wysyla. Zdjecia laduja na Waszym Dysku Google.
Bez logowania, bez instalacji, bez kont.

[Live Demo](https://lukaszbonio.github.io/wedding-photos/) · [Zglos problem](https://github.com/LukaszBonio/wedding-photos/issues)

</div>

---

## Dlaczego to istnieje

- **Bez aplikacji do zainstalowania** — otwiera sie w przegladarce telefonu
- **Dziala offline** — brak zasiegu na sali? Zdjecie poczeka i wysle sie samo
- **Prywatnie** — zdjecia trafiaja na Wasz Dysk Google, nie na zaden obcy serwer
- **Dla kazdego** — duze przyciski, polskie napisy, prosty i elegancki ekran

---

## Jak to dziala

```
  Gosc (telefon)                        Wasz Dysk Google
 +-----------------+    HTTPS POST    +------------------+
 |    Strona PWA   | --------------> | Google Apps      |
 |  (GitHub Pages) |   zdjecie JPEG  | Script (backend) | ----> Folder ze zdjeciami
 +-----------------+                 +------------------+
```

| Warstwa | Technologia | Koszt |
|---------|-------------|-------|
| Frontend | GitHub Pages (statyczna PWA) | darmowy |
| Backend | Google Apps Script | darmowy |
| Storage | Google Drive | darmowy (15 GB) |

Nie ma zadnego wlasnego serwera ani bazy danych do utrzymania.

---

## Szybki start

> **Czas**: ok. 30-45 minut · **Wymagania**: konto Google + konto GitHub (oba darmowe)
> Nie musisz umiec programowac.

### 1. Folder na Dysku Google

1. Wejdz na [drive.google.com](https://drive.google.com) i utworz nowy folder, np. **"Zdjecia weselne"**.
2. Otworz ten folder. Z adresu w przegladarce skopiuj **ID folderu** — ciag po `folders/`:
   ```
   https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz
                                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                          to jest ID folderu
   ```

### 2. Backend (Google Apps Script)

1. Wejdz na [script.google.com](https://script.google.com) → **Nowy projekt**.
2. Nazwij projekt (np. "Wesele — upload"), a nastepnie:
   - Otworz plik `Code.gs`, usun zawartosc i wklej cala zawartosc pliku [`gas/Code.gs`](gas/Code.gs).
   - Wejdz w **Ustawienia projektu** (ikona kola zebatego) → zaznacz **"Pokaz plik manifestu"**.
     Wroc do edytora, otworz `appsscript.json` i wklej zawartosc [`gas/appsscript.json`](gas/appsscript.json).

3. W **Ustawienia projektu → Wlasciwosci skryptu** dodaj:

   | Wlasciwosc | Wartosc | Przyklad |
   |------------|---------|----------|
   | `GOOGLE_DRIVE_FOLDER_ID` | ID folderu z kroku 1 | `1AbCdEfGhIjKlMnOp` |
   | `UPLOAD_TOKEN` | dlugi, losowy ciag znakow | `wesele-2026-9f3k7t2q8w` |
   | `EVENT_END_DATE` | ostatni dzien przyjmowania zdjec | `2026-09-13` |

   > **UPLOAD_TOKEN** wymysl sam — im dluzszy, tym lepiej. Zapamietaj go, bo wpiszesz go tez w GitHub.
   > Po **EVENT_END_DATE** (wlacznie) aplikacja przestaje przyjmowac zdjecia.

4. Kliknij **Wdroz → Nowe wdrozenie**:
   - Typ: **Aplikacja internetowa** (Web app)
   - Wykonaj jako: **Ja** (Me)
   - Kto ma dostep: **Wszyscy** (Anyone)
   - Kliknij **Wdroz**, zatwierdz uprawnienia Google
   - Skopiuj **URL aplikacji** (konczy sie na `/exec`)

> [!WARNING]
> **Pulapka Apps Script:** sama edycja kodu **nie** aktualizuje dzialajacego wdrozenia.
> Po kazdej zmianie w `Code.gs` musisz: **Wdroz → Zarzadzaj wdrozeniami → (olowek) → Wersja: Nowa wersja → Wdroz**.

### 3. Publikacja strony (GitHub Pages)

1. Utworz na GitHub **nowe repozytorium** o nazwie **`wedding-photos`** i wgraj projekt.

   > Nazwa repo musi byc dokladnie **`wedding-photos`**, bo taka jest sciezka bazowa.
   > Jesli chcesz inna nazwe, zmien `BASE_PATH` w `vite.config.ts`.

2. W **Settings → Secrets and variables → Actions** dodaj dwa sekrety:

   | Sekret | Wartosc |
   |--------|---------|
   | `VITE_GAS_URL` | URL `/exec` z kroku 2 |
   | `VITE_UPLOAD_TOKEN` | ten sam token co w Script Properties |

3. W **Settings → Pages → Source** wybierz **"GitHub Actions"**.

4. Gotowe! Kazdy push do galezi `master` automatycznie zbuduje i opublikuje strone:
   ```
   https://TWOJ-LOGIN.github.io/wedding-photos/
   ```

### 4. Kod QR na stoliki

1. Wygeneruj kod QR z adresem strony (dowolny generator QR).
2. Wydrukuj **duzy i czytelny**, z krotka zacheta, np.:
   > *"Zeskanuj i podziel sie z nami zdjeciami z tego dnia"*
3. Rozloz na stolikach.

---

## Checklista przedslubna

- [ ] `EVENT_END_DATE` ustawiona na wlasciwy dzien (np. dzien po weselu)
- [ ] Podmienione **ikony PWA** — pliki w `public/icons/` to placeholdery
- [ ] Kod QR **wygenerowany, wydrukowany i przetestowany**
- [ ] **Test na iPhonie (Safari)** i **Androidzie (Chrome)**: zdjecie → wyslij → sprawdz folder
- [ ] **Test offline**: tryb samolotowy → wyslij → wlacz internet → sprawdz
- [ ] **Pojemnosc Dysku** sprawdzona (ile wolnego miejsca)

---

## Bezpieczenstwo

> [!NOTE]
> Aplikacja jest zaprojektowana pod **maksymalna frekwencje gosci**, nie pod poziom bezpieczenstwa banku.

| Kompromis | Dlaczego |
|-----------|----------|
| Token jest publiczny | Zmienne `VITE_*` trafiaja do kodu przegladarki. Token odsiewa przypadkowy ruch, nie jest tajnym kluczem |
| Kazdy z linkiem moze wyslac | Taki jest zamysl — brak logowania = wiecej zdjec |
| Brak moderacji tresci | Zdjecia trafiaja wprost do folderu. Mozesz zmienic token lub usunac plik |
| Idempotencja | Kazde zdjecie ma UUID — ponowienie nie tworzy duplikatow |

Zdjecia to dane osobowe — trafiaja na **Wasz prywatny Dysk Google**, nie do firmy trzeciej.

---

## Limity Google

| Zasob | Limit | W praktyce |
|-------|-------|------------|
| Pojemnosc Dysku | 15 GB (darmowe) | ~8 000-10 000 zdjec po kompresji (~1-2 MB/szt.) |
| Czas wykonania GAS | 6 min / wywolanie | Zapis trwa ulamek sekundy |
| Rownolegle wykonania | ~30 | Aplikacja wysyla max 2 zdjecia na raz |

Przy typowym weselu (100-150 gosci) to z zapasem wystarcza. Przy wiekszej imprezie rozważ konto Google Workspace.

---

## Rozwiazywanie problemow

<details>
<summary><strong>Nic sie nie wysyla / blad wysylki</strong></summary>

1. `VITE_GAS_URL` konczy sie na `/exec`
2. Po zmianie `Code.gs` utworzono **nowa wersje wdrozenia**
3. `UPLOAD_TOKEN` w Script Properties jest **identyczny** z `VITE_UPLOAD_TOKEN` w GitHub

</details>

<details>
<summary><strong>Biala strona / bledy 404</strong></summary>

Niezgodna sciezka bazowa. Repo musi nazywac sie `wedding-photos` albo zmien `BASE_PATH` w `vite.config.ts`.

</details>

<details>
<summary><strong>Blad CORS w konsoli</strong></summary>

Apps Script odpowiada przez przekierowanie (302) — to normalne. Aplikacja uzywa prostego zadania (`Content-Type: text/plain`), wiec nie wywoluje preflightu. Jesli widzisz CORS — sprawdz, czy nie dodano dodatkowych naglowkow.

</details>

<details>
<summary><strong>Komunikat o HEIC</strong></summary>

HEIC dekoduje natywnie tylko Safari. Na Androidzie aplikacja poprosi o JPEG. Na iPhonie dziala bez zmian.

</details>

<details>
<summary><strong>iOS: zdjecie "utknelo" po zablokowaniu ekranu</strong></summary>

iOS usypia karty w tle. Aplikacja wznawia wysylke po powrocie do karty.

</details>

---

## Dla programistow

> **Wymagania:** Node.js 20.19+ lub 22

```bash
npm install
cp .env.example .env.local   # uzupelnij VITE_GAS_URL i VITE_UPLOAD_TOKEN
npm run dev                  # serwer deweloperski
```

| Polecenie | Opis |
|-----------|------|
| `npm run build` | Build produkcyjny → `dist/` |
| `npm run preview` | Podglad builda |
| `npm run test` | Testy (Vitest) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

### Stos technologiczny

**Frontend:** Vue 3 · TypeScript · Pinia · Vite · vite-plugin-pwa (Workbox) · Dexie (IndexedDB) · Zod

**Backend:** Google Apps Script

**Hosting:** GitHub Pages

Kompresja zdjec w Web Workerze (OffscreenCanvas) z fallbackiem na glowny watek. Kolejka wysylki z ponawianiem i trwaloscia offline w IndexedDB.
