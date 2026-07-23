# Ashfall Online

Oryginalne, przeglądarkowe MMORPG dark fantasy inspirowane czytelnymi zasadami klasycznych gier tile-based. Projekt nie wykorzystuje nazwy, kodu, map, fabuły ani assetów Tibii.

## Co już działa

- płynny ruch WASD/strzałkami, kolizje i duża proceduralna mapa,
- cztery profesje: Warden, Ranger, Arcanist i Druid,
- zaznaczanie celów, walka wręcz/dystansowa, czary, cooldowny i efekty,
- cztery typy przeciwników z AI, respawnem, XP i tabelami łupów,
- poziomy, rosnące statystyki i trenowane umiejętności,
- plecak, stackowanie, mikstury, ekwipunek, rzadkości i statystyki przedmiotów,
- NPC, sklep, interakcje oraz dziennik zadań,
- minimapa, strefy świata, cykl oświetlenia, czat i responsywne sterowanie mobilne,
- zapis lokalny oraz opcjonalny zapis konta w Supabase,
- multiplayer pozycyjny i czat przez WebSocket na Render,
- automatyczny deploy klienta na GitHub Pages.

To jest grywalny **vertical slice / fundament MMO**, nie komplet wieloletniej gry komercyjnej. Serwer synchronizuje graczy i czat; walka z potworami działa obecnie po stronie klienta. Przed publiczną premierą ekonomię, potwory, walkę i łupy należy przenieść do autorytatywnej symulacji serwera.

## Architektura

```text
GitHub Pages (Vite + Canvas)
        │ HTTPS / WebSocket
        ▼
Render (Express + ws) ───── Supabase (Auth + Postgres)
```

## Start lokalny

Wymagany Node.js 22+.

```bash
npm install
cp client/.env.example client/.env
cp server/.env.example server/.env
npm run dev
```

Klient: `http://localhost:5173/projekttest/`  
Serwer: `http://localhost:3001/health`

Bez zmiennych środowiskowych gra uruchamia się w pełni grywalnym trybie offline i zapisuje postać w `localStorage`.

## Wdrożenie Supabase

1. Utwórz projekt w Supabase.
2. Otwórz **SQL Editor** i wykonaj plik `supabase/migrations/001_initial.sql`.
3. W **Authentication → URL Configuration** dodaj adres GitHub Pages do dozwolonych redirect URLs.
4. Skopiuj `Project URL`, `anon public key` i `service_role key`.
5. Nigdy nie dodawaj `service_role key` do GitHuba ani klienta.

## Wdrożenie backendu na Render

1. W Render wybierz **New → Blueprint** i wskaż to repozytorium. Render odczyta `render.yaml`.
2. Ustaw:
   - `CLIENT_ORIGIN=https://azya420.github.io`
   - `SUPABASE_URL=<Project URL>`
   - `SUPABASE_SERVICE_ROLE_KEY=<service_role key>`
3. Po deployu skopiuj adres w stylu `https://ashfall-online-server.onrender.com`.
4. Sprawdź endpoint `/health`.

## Wdrożenie klienta na GitHub Pages

1. W repozytorium otwórz **Settings → Pages** i jako źródło wybierz **GitHub Actions**.
2. W **Settings → Secrets and variables → Actions** dodaj:
   - zmienną `VITE_SERVER_URL` z adresem Render,
   - zmienną `VITE_SUPABASE_URL` z Project URL,
   - sekret `VITE_SUPABASE_ANON_KEY` z kluczem `anon`.
3. Uruchom workflow **Deploy client to GitHub Pages** albo wypchnij commit do `main`.

Docelowy adres: `https://azya420.github.io/projekttest/`.

## Sterowanie

| Akcja | Klawisz |
|---|---|
| Ruch | WASD / strzałki |
| Wybór celu | kliknięcie potwora |
| Zwykły atak | Spacja / 1 |
| Czar profesji | 2 |
| Leczenie | 3 |
| Atak obszarowy | 4 |
| NPC / sklep / zadanie | E |
| Czat | Enter |

## Testy i build

```bash
npm test
npm run build
```

## Najważniejsze następne etapy

1. Autorytatywna walka, potwory, przedmioty i anty-cheat na serwerze.
2. Osobne postacie, wybór świata, grupy, gildie, handel i depozyt.
3. Edytor map oraz trwały stan świata i domów.
4. PvP z systemem czaszek, strefami ochronnymi i karami śmierci.
5. Instancje lochów, bossowie, crafting, aukcje i rozbudowane questy.
6. Własne sprite-sheety, animacje kierunkowe, dźwięk i muzyka.

## Licencja

Kod projektu jest przeznaczony do dalszego rozwoju w tym repozytorium. Marka i zawartość Ashfall Online są oryginalne.
