# REFORMA 3.3 — SteerCo Decision Workshop

Interaktívny rozhodovací deck (47 rozhodnutí v 8 sektoroch) s **PIN prihlásením**
a **per-člen hlasovaním cez viac zariadení**. Hostuje sa na **GitHub Pages**
(verejné repo), preto citlivý obsah **nie je** v statických súboroch — prichádza
z **Google Apps Script (GAS) backendu** až po overení PINu.

```
Prehliadač (GitHub Pages, public)            Google (privátne)
 index.html · app.js · styles.css · config.js  ──PIN──▶  GAS Web App (Code.gs + Content.gs)
                                               ◀token+obsah   Google Sheet (Votes, Finals)
```

## Čo sa smie / nesmie commitnúť

**Commit (verejné, bez citlivého obsahu):**
`index.html`, `app.js`, `styles.css`, `config.js`, `apps-script/Code.gs`, `README.md`, `.gitignore`

**NIKDY necommitnúť** (chráni `.gitignore`):
`apps-script/Content.gs` (47 rozhodnutí), `apps-script/PINS.local.txt`,
`decision_record_template.json`, `printable_decision_record.md`, `*.docx`, `*.pptx`

> Pred pushom vždy over `git status` — žiadny z hore uvedených citlivých súborov nesmie byť staged.

## Nasadenie backendu (Google)

1. **Google Sheet** — vytvor nový Sheet (taby `Votes` a `Finals` sa vytvoria
   automaticky pri prvom zápise). Skopíruj jeho **ID** z URL
   (`/d/`**`<TOTO>`**`/edit`).
2. **Apps Script** — [script.google.com](https://script.google.com) → *New project*.
   - Vlož obsah `apps-script/Code.gs` do `Code.gs`.
   - Pridaj súbor (`+` → Script) `Content.gs` a vlož doň lokálny `apps-script/Content.gs`.
3. **Script Properties** — *Project Settings → Script properties → Add*:
   | Property | Hodnota |
   |---|---|
   | `SHEET_ID` | ID Sheetu z kroku 1 |
   | `PINS` | JSON z `apps-script/PINS.local.txt` (napr. `{"742238":"Babela", ...}`) |
   | `CHAIR_KEY` | `Boruta` |
4. **Deploy** — *Deploy → New deployment → Web app*:
   - **Execute as:** *Me*
   - **Who has access:** *Anyone* (inak fetch z prehliadača zlyhá)
   - skopíruj **Web app URL** (končí na `/exec`).

## Pripojenie frontendu

V `config.js` nahraď `REPLACE_WITH_GAS_WEB_APP_URL` skopírovanou `/exec` URL.
(Tento súbor sa commituje — URL je verejná, ale chránená PINom.)

## PINy

7 PINov je vygenerovaných v `apps-script/PINS.local.txt` (gitignored).
Každému členovi pošli jeho PIN **súkromne** (Signal / 1Password / SMS).
Veto-holderi (právo veta): **Babeľa, Bořuta, Smatana**. Chair: **Bořuta**.

## Ako to funguje

- Člen sa prihlási PINom → backend ho identifikuje a pošle obsah.
- Hlasuje za seba; hlas sa ukladá do Sheetu (`Votes`, upsert per člen+rozhodnutie).
- Slide **Decision Record** → *Obnoviť výsledky* → matica pozícií 7 členov + tally +
  označenie veto-nesúhlasu. **Finálny status** každej položky nastaví **chair**
  (uloží sa do `Finals`); ostatní ho vidia read-only.
- Export JSON/CSV + Print/PDF obsahuje per-člen pozície aj finály.

## Lokálne preview

`python3 -m http.server` v priečinku `workshop/` a otvor `http://localhost:8000/`.
Backend musí byť nasadený (alebo `config.js` ukazuje na test deployment),
inak prihlásenie ohlási, že backend nie je nakonfigurovaný.

## Bezpečnosť (čo to dáva a čo nie)

- PIN sa overuje **server-side**; obsah ani PINy nie sú v public súboroch.
- GAS endpoint je verejný, ale každá akcia vyžaduje platný PIN→token (6 h TTL),
  s hrubým throttlingom proti brute-force.
- Token v `sessionStorage` (zavretie tabu = odhlásenie). Po vypršaní treba PIN znova.
