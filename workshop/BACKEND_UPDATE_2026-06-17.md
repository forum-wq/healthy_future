# BACKEND UPDATE — REFORMA 3.3 follow-up round (`2026-06-17-final25`)

Tento dokument popisuje, čo treba spraviť v **Google Apps Script (GAS) + Google Sheet** backende,
aby hlasovacia stránka používala **novú sadu 25 otvorených rozhodnutí** (P0–P3) namiesto starých 47.

Front-end (`index.html`, `app.js`, `styles.css`, `config.js`) je už prerobený a commitnuteľný.
Citlivý obsah (znenia rozhodnutí) **nie je** v žiadnom verejnom súbore — prichádza z GAS až po PIN logine.

---

## 1. GAS_URL a PINy — NEMENIŤ
- `config.js` ponecháva **rovnaký `GAS_URL`**. Nasadenie nového deploymentu nie je potrebné na zmenu dát
  (Content.gs je súčasť toho istého GAS projektu) — stačí re-deploy existujúceho web appu po vložení nového obsahu.
- **PINy ostávajú nezmenené.** Script Property `PINS` ani `CHAIR_KEY` sa **nemenia**.
- PINy nie sú a nesmú byť vo front-ende ani v tomto repozitári.

## 2. Nahradiť dataset rozhodnutí (Content.gs)
1. Otvor GAS projekt (script.google.com) viazaný na existujúci `/exec` deployment.
2. Súbor **`Content.gs`** prepíš obsahom z lokálneho `apps-script/Content.gs`
   (vygenerovaný z `reforma33_questionnaire_items.json`, `as_of 2026-06-17`).
   - Obsahuje `MEMBERS` (nezmenené), `META`, `SECTORS` (7), `EXTRA` a `DECISIONS` (**25** bodov: `T10…N11`).
   - Ekvivalentný strojový payload je v **`data/decisions_2026-06-17-final25.json`** (rovnaké `getContent_()` dáta + `roundId`).
3. `Code.gs` prepíš lokálnym `apps-script/Code.gs` (zmeny nižšie, bod 4).
4. **Deploy → Manage deployments → (existujúci) → Edit → Version: New version → Deploy.**
   `GAS_URL` zostane rovnaká.

## 3. MEMBERS / PINS — source of truth ostáva backend
- `MEMBERS` v `Content.gs` je skopírovaný **verbatim** zo starého backendu:
  keys (`Babela, Boruta, Smatana, Kolejakova, Ornyi, Misik, Petrik`), mená, roly, `veto`, `isChair` — **bez zmeny**.
- Chair zostáva **Bořuta** (`CHAIR_KEY=Boruta`).
- Smatana je podľa podkladu dočasne neaktívny (MAKRO zastupuje INESS) — **flagy sme NEMENILI**, ostáva plnohodnotný hlasujúci.

## 4. Nový round + nové taby (oddelenie od starého hlasovania)
`Code.gs` bol upravený takto:
- `ROUND_ID = "2026-06-17-final25"`.
- Hlasy/finály idú do **nových tabov** `Votes_final25` / `Finals_final25` (založia sa automaticky pri prvom zápise).
  → **Starý round 2026-06-09 ostáva nedotknutý** v pôvodných taboch `Votes` / `Finals` (archív).
- Do oboch tabov pribudol stĺpec **`roundId`**.
- `decisionId` je teraz **kód** (napr. `T10`, `R3`, `V2`) — backend ho spracúva ako reťazec (zrušený `parseInt`).
- Chair finalizácia (`action:"finalize"`, len `CHAIR_KEY`) funguje nezmenene, ukladá `roundId`.

### Archivácia starého roundu
- Netreba mazať nič. Pôvodné `Votes`/`Finals` = archív roundu 2026-06-09.
- (Voliteľné) premenuj ich na `Votes_2026-06-09` / `Finals_2026-06-09` pre prehľadnosť — backend ich už nepoužíva.

## 5. Overenie po nasadení
- Login existujúcim PINom → po prihlásení **25** rozhodnutí, počítadlo „Nedokončené" = **25**.
- IDs `T10…N11` v jump dropdowne; staré `#1…#47` nie sú v agende.
- Hlas sa uloží do `Votes_final25` pod správny `memberKey` + `roundId=2026-06-17-final25`.
- Export JSON/CSV má dátum **2026-06-17** a `round`; Print/PDF píše 17. 6. 2026.
- Decision Record: matica + tally + mechanický stav „UZAVRETÝ (návrh)" (≥4/7 a Bořuta+Babeľa) + chair finalizácia.

## 6. Uzatváracie pravidlo (mechanické)
Bod je **uzavretý (návrh)**, ak rovnaká možnosť získa **≥ 4/7** hlasov **a** hlasujú za ňu **Bořuta aj Babeľa**.
Je to len návrh — do MASTER ide až po **finalizácii chairom**.

## 7. Vyradené (už uzavreté) body — len kontext
`R1 (#20)`, `M5 (#31)`, `M10 (#31)`, `V1 (#41)`, `V4 (#44)` sú uzavreté z predošlého online kola a v tomto rounde
sa **o nich nehlasuje**. Zobrazujú sa len ako kontext na slide „Už uzavreté (kontext)" (z `EXTRA.excludedClosed`).
