# Partneri zmeny — Future Slovakia Forum

Statická microsite pre fundraisingovú a partnerskú iniciatívu **„Staňte sa partnermi zmeny, budúcnosti a prosperity."** Slúži ako profesionálna lead-capture stránka pre individuálnych donorov, firmy, CSR partnerov, nadácie, grantových partnerov, slovenskú diasporu a ľudí, ktorí vedia otvoriť dvere ďalším donorom.

**Toto nie je eventová stránka. Toto nie je predajná stránka. Toto nie je verejná zbierka s platobnou bránou.**

> ⚠️ **Deploy warning — nezameniť so staršími Brno súbormi.**
> Adresár `/partneri-zmeny/` obsahuje súbory s rovnakými názvami (`index.html`, `registracia.html`, `dashboard.html`) ako `/brno/`, ale ide o úplne **iný projekt**. Pred uploadom na server skontroluj, že nahrávaš správnu sadu:
> - `index.html` má title „Staňte sa partnermi zmeny, budúcnosti a prosperity · Future Slovakia Forum"
> - `registracia.html` používa `const GAS_URL`, **nie** `GAS_URL_BRNO`
> - žiadny zo súborov neobsahuje slová „Kavárna Trojka", „Linda Veverková", „CAPACITY", „Wlachovský", „Kollár", „Mišík"

---

## 0. Final base URL (pred deployom rozhodni)

Microsite je pripravená pre dve možnosti deploymentu. **Vyber jednu pred publikovaním** — kanonické URLs, OG meta a `og:url` musia mať konzistentnú doménu, inak sa rozbije social sharing a Search indexácia.

```
# zvoľ jednu hodnotu pre deploy
FINAL_BASE_URL=https://healthy-future.sk/partneri-zmeny/    # ← default v repe
# alebo:
FINAL_BASE_URL=https://future-slovakia.eu/partneri-zmeny/
```

**Ak deployuješ na `healthy-future.sk`**, ponechaj všetky meta tagy v repe nezmenené — kanonické URLs sú už nastavené na `healthy-future.sk`.

**Ak deployuješ na `future-slovakia.eu`**, najprv prepíš tieto tagy v každom z troch HTML súborov (`index.html`, `registracia.html`, `dashboard.html`):

| Meta tag | Hodnota (príklad pre nový base) |
|---|---|
| `<meta property="og:url">` | `https://future-slovakia.eu/partneri-zmeny/...` |
| `<meta property="og:image">` | `https://future-slovakia.eu/partneri-zmeny/og-image.png` |
| `<link rel="canonical">` | `https://future-slovakia.eu/partneri-zmeny/...` |

Rýchly find & replace:
```bash
sed -i '' 's|https://healthy-future.sk/partneri-zmeny/|https://future-slovakia.eu/partneri-zmeny/|g' index.html registracia.html dashboard.html
```
(Na Linuxe vynechaj `''` po `-i`.)

**Cieľové URL po deployi:**
- `${FINAL_BASE_URL}` → landing page (`index.html`)
- `${FINAL_BASE_URL}registracia.html` → kontaktný formulár
- `${FINAL_BASE_URL}dashboard.html` → verejný agregovaný dashboard

---

## 1. Štruktúra adresára

```
partneri-zmeny/
├── index.html                     ← hlavná landing page (11 sekcií)
├── registracia.html               ← kontaktný formulár (POST → GAS)
├── dashboard.html                 ← verejný agregovaný dashboard (GET ?action=stats)
├── GAS_PARTNERI_TEMPLATE.gs       ← Google Apps Script Code.gs šablóna
├── README.md                      ← tento súbor
├── logo-fsf.png                   ← FSF logo
└── og-image.png                   ← OG preview obrázok (zatiaľ zdieľaný s Brno; viď bod 4)
```

---

## 2. Ako deploynúť

### Krok 1 — Vytvor Google Sheet

1. Vytvor nový Google Sheet, napríklad s názvom `FSF_Partneri_2026`.
2. Premenuj prvý tab na **`Partneri`** (presne tento názov; je hardcoded v GAS).
3. Do riadku 1 vlož tieto stĺpce v presnom poradí:

```
A: timestamp
B: meno
C: priezvisko
D: email
E: mobil
F: organizacia
G: mesto_krajina
H: typ_partnerstva
I: forma_podpory
J: financne_pasmo
K: oblast_podpory
L: support_items
M: preferred_vertical
N: wants_call
O: public_note_allowed
P: sprava
Q: gdpr
R: user_agent
S: status
T: amount_confirmed
U: notes_internal
```

> **Bezpečnosť:** Tento Sheet obsahuje osobné údaje. **NESMIE byť verejne zdieľaný.** Prístup výlučne core tímu FSF (David Boruta a definovaný okruh ľudí, ktorí majú legitímny dôvod pristupovať k partnerskému CRM-u).

Skopíruj **Sheet ID** z URL (časť medzi `/d/` a `/edit`):
```
https://docs.google.com/spreadsheets/d/<TENTO_ID>/edit
```

### Krok 2 — Vytvor Apps Script projekt

V tom istom Sheete: **Extensions → Apps Script**.

1. Premenuj projekt na `FSF_Partneri_API`.
2. Otvor `Code.gs` a nahraď celý obsah obsahom súboru **`GAS_PARTNERI_TEMPLATE.gs`** z tohto adresára.

### Krok 3 — Script Properties

V Apps Script editore: **Project Settings (ozubené koleso vľavo) → Script Properties → Add property**.

| Property | Required | Hodnota |
|---|---|---|
| `SHEET_ID` | áno | ID z URL Google Sheetu (viď Krok 1) |
| `INTERNAL_EMAILS` | áno | `david.boruta@future-slovakia.eu,forum@future-slovakia.eu` |
| `SHOW_PUBLIC_MONEY` | nie | `false` (default). Nastav na `true` iba ak chceš zverejniť agregovaný progres bridge fundingu na dashboarde. Žiadne mená a žiadne individuálne sumy sa neexportujú — iba súčet z stĺpca `amount_confirmed`. |

### Krok 4 — Deploy ako Web App

V Apps Script editore: **Deploy → New deployment**.

| Field | Value |
|---|---|
| Type | Web app |
| Description | FSF Partneri API v1 |
| Execute as | Me (tvoj Google účet) |
| Who has access | **Anyone** |

Stlač **Deploy**, potvrď permissions (Gmail/Sheets prístup). Skopíruj **Web app URL** (formát: `https://script.google.com/macros/s/AKfycb.../exec`).

### Krok 5 — Vlož GAS URL do HTML

Otvor a nahraď v dvoch súboroch:

**`registracia.html`** — vyhľadaj `const GAS_URL`:
```javascript
const GAS_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
```

**`dashboard.html`** — vyhľadaj `const API`:
```javascript
const API = 'https://script.google.com/macros/s/AKfycb.../exec';
```

Rýchle overenie:
```bash
grep -n "REPLACE_WITH_PARTNERI_GAS_URL" partneri-zmeny/*.html
```
(po správnom nahradení by `grep` nemal vrátiť nič.)

### Krok 6 — Nahraj na web

Nahraj celý adresár `partneri-zmeny/` na statický web hosting (FTP/SFTP na `healthy-future.sk`, alebo Netlify, GitHub Pages, atď.). Cesty k assetom sú relatívne — nemeň ich.

---

## 3. Ako stránka funguje

| Súbor | Čo robí |
|---|---|
| `index.html` | Statická landing page s 11 sekciami — hero, prečo teraz, reformný Venn, čo budujeme, čo presne financujete (6 nákladových kariet), výskumné tímy + timeline, output flow, prečo pripravenosť, strategické línie, čo nie je partnerstvo, transparentnosť, final CTA, footer. |
| `registracia.html` | Krátky profesionálny formulár → POST cez `fetch` na GAS endpoint. Po úspechu zobrazí success panel. Pri duplicitnom e-maile zobrazí alert. Validácia: meno, priezvisko, validný e-mail, typ partnerstva, GDPR. Max 4 support_items checkboxy. |
| `dashboard.html` | GET `?action=stats` každých 60 sekúnd. Renderuje counter, mini-stats (záujemcovia celkom / individuálni donori / firmy / prepojenia / calls), 2 donut charty, 3 bar listy (sumy, support items, vertikály) a voliteľne top 10 lokácií. **Žiadne osobné údaje.** |
| `GAS_PARTNERI_TEMPLATE.gs` | Apps Script backend: doGet (action=count / action=stats), doPost (validácia, duplicate guard, append row), MailApp odošle potvrdenie submitterovi a internú notifikáciu core tímu. |

---

## 4. Bezpečnostné poznámky

- **Verejný dashboard nezobrazuje osobné údaje.** GAS endpoint `?action=stats` vracia iba agregáty (počty po kategóriách). Mená, e-maily, telefóny, organizácie a konkrétne správy nikdy neopustia Google Sheet.
- **Google Sheet nezdieľaj verejne.** Prístup iba pre core tím FSF. Sheet obsahuje plné osobné údaje.
- **Duplicate e-mail guard.** GAS odmieta druhý záznam s tým istým e-mailom (`error: already_registered`). Pri legitímnom doplnení informácií posielame e-mail ručne.
- **Server-side validácia.** GAS validuje meno, priezvisko, e-mail, typ_partnerstva a GDPR aj na backende — klientská strana je bypassable.
- **Sanitizácia (formula-injection guard).** Všetky free-text hodnoty (`meno`, `priezvisko`, `organizacia`, `mesto_krajina`, `sprava`, `user_agent`) prechádzajú cez `safeSheet_()` — keď začínajú znakom `=`, `+`, `-` alebo `@`, vloží sa pred ne neviditeľná apostrofa, aby Sheets cellu interpretoval ako text. **Telefón používa `safePhone_()`**, ktorý zachová úvodný `+` (napr. `+421 ...`) — starší global strip prístup z neho robil `421`. Slugy (`typ_partnerstva`, `forma_podpory`, atď.) sa iba `clean_()`-ujú (trim + lowercase). Frontend dashboard escapuje všetky vykresľované hodnoty cez `esc()`.
- **CSP.** Všetky tri HTML súbory majú reštriktívnu Content Security Policy vrátane `frame-ancestors 'none'` (anti-clickjacking, anti-iframe-embed). `connect-src` povolí iba `script.google.com` a `script.googleusercontent.com` (Apps Script redirect).
- **Status filter pre verejný dashboard.** Oba verejné endpointy — `?action=count` (cez `countPublic_()`) aj `?action=stats` (cez `buildStats_()`) — používajú ten istý `isPublicRow_` filter a vyraďujú riadky so `status` ∈ `{test, deleted, spam, declined}`. Dôsledok: hodnota vrátená z `?action=count` sa **vždy rovná** `stats.total`. Core tím vie dať záznam do `test`/`deleted` v stĺpci `S` Sheetu bez toho, aby zmizol z internej evidencie — len sa nezapočítava do verejných čísel. Konfigurácia je v konštante `EXCLUDED_STATUSES` v GAS template.
- **Privacy guard pre lokácie.** Dashboard zobrazí sekciu „Top 10 lokácií" iba ak `total >= 5` zaznamov **a** zároveň iba tie lokácie s `count >= 2`. Chráni to pred deanonymizáciou cez unikátne mesto / krajinu pri nízkom počte záujemcov.
- **SHOW_PUBLIC_MONEY default = false.** Aj keď to zapneš, GAS exportuje iba **agregovaný súčet** z stĺpca `amount_confirmed`. Neexponuje rozpis po donoroch, mená ani konkrétne sumy jednotlivcov.
- **Fundraisingové pásma sú orientačné**, nie verejný záväzok. Pole `financne_pasmo` slúži ako signál pre core tím, nie ako záväzná suma.
- **GDPR.** Formulár vyžaduje explicitný consent checkbox. Submitter dostane potvrdzujúci e-mail. Súhlas je možné odvolať na `forum@future-slovakia.eu`.

---

## 5. Ako upraviť sumy

Sumy sú **staticky vložené** v `index.html` v sekcii „Čo presne financujete" (6 nákladových kariet) a v `registracia.html` v selecte „Orientačná výška podpory".

Pri zmene súm aktualizuj **obidva súbory naraz**:

1. `index.html` — sekcia `.cost-grid`, hodnoty `.cost-amount` a popisky.
2. `registracia.html` — `<select id="financne_pasmo">`, hodnoty `<option>`.
3. `dashboard.html` — `AMOUNT_LABEL` mapa v scripte (zlucuje slugy s humánnymi popismi v dashboarde).

Tieto tri musia byť konzistentné v slugoch (`do_100`, `100_500`, `600_mesiac`, atď.), inak sa dashboard a Sheet rozladia.

---

## 6. Checklist pred publikovaním

- [ ] GAS Sheet vytvorený s presnými 21 stĺpcami v poradí A–U
- [ ] Google Sheet **nie je verejne zdieľaný** (Share → Restricted)
- [ ] `SHEET_ID`, `INTERNAL_EMAILS`, `SHOW_PUBLIC_MONEY` nastavené v Script Properties
- [ ] GAS deployed ako Web app, access **Anyone**
- [ ] GAS URL vložená do `registracia.html` a `dashboard.html` (`grep REPLACE_` nevracia nič)
- [ ] Test submit z `registracia.html` → riadok v Sheete obsahuje všetky polia, `status = "new"`
- [ ] Test duplicate: druhý submit s rovnakým e-mailom → alert „už registrovaný"
- [ ] Test `?action=stats` v prehliadači → JSON s agregátmi, **bez** osobných údajov
- [ ] Test `?action=count` v prehliadači → `{ok: true, count: N}`
- [ ] Dashboard sa načíta a zobrazí (counter, mini-counters, donuts, bary)
- [ ] Submitter dostal potvrdzujúci e-mail
- [ ] Interná notifikácia došla na obe adresy v `INTERNAL_EMAILS`
- [ ] Mobile responsivity: 380 px, 640 px, 900 px breakpointy
- [ ] OG image zobrazuje sa pri zdieľaní na FB/LinkedIn/Twitter
- [ ] GDPR text formulára obsahuje účel a kontakt pre odvolanie súhlasu
- [ ] Verejný dashboard otestovaný — žiadne osobné údaje v DOM ani v API odpovedi

---

## 7. Známe TODO / otvorené body

### 🚫 BLOCKER pred public launch

**OG image — nahradiť Brno OG image za nový partnerský OG image.**

Aktuálny `og-image.png` v adresári je **kópia z `/brno/og-image.png`** (eventový vizuál Brno diskusie — Wlachovský, Kollár, Mišík). Pri zdieľaní na FB / LinkedIn / Twitter / Slack to bude zavádzajúce — link bude vyzerať ako pozvánka na minulé eventové podujatie, nie ako partnerská iniciatíva.

Pred public launchom vytvoriť nový **`og-image-partneri.png`** (1200×630) s:
- headline „Staňte sa partnermi zmeny, budúcnosti a prosperity."
- pod-headline „Fakty a činy. Reformy pre Slovensko."
- FSF logo a brand colors (`#c25b5b` coral burgundy + `#7fa88e` sage green, `#0a1628` navy background)
- bez tvárí, bez eventového dátumu, bez Brno motívov

Keď nový obrázok existuje, v každom z troch HTML súborov nahraď:
```bash
sed -i '' 's|og-image\.png|og-image-partneri.png|g' index.html registracia.html dashboard.html
```

### Ostatné

1. **`admin.html`** — interný admin pohľad (token-protected) nie je súčasťou tohto deploymentu. Core tím pracuje priamo s Google Sheetom (status, amount_confirmed, notes_internal). Ak by neskôr bol potrebný read-only web pohľad pre väčší okruh tímu, dá sa pridať obdobne ako `brno/dashboard.html` (token-based session cez ScriptCache).
2. **OG image pre `registracia.html` a `dashboard.html`** — `noindex, follow`, ale OG meta sú vyplnené pre prípadné zdieľanie. Tie isté `sed`-replace pravidlá z BLOCKER sekcie vyššie pokryjú aj tieto dva súbory.
3. **Favicon** — momentálne sa používa `logo-fsf.png` ako favicon. Pre lepší výsledok export 32×32 a 64×64 `favicon.png` zo skratky loga.

---

## 8. Tón a terminológia

Microsite zámerne nepoužíva „čistené" zjednodušené formulácie. Toto je think-tank / fundraising / policy stránka, nie úradný formulár.

Ponechané odborné termíny:
**reformná infraštruktúra, core kapacita, core tím, policy brief, fundraising intelligence, QA, dashboard, pipeline, lead-capture, donor, compliance, conflict-of-interest screening, explainer.**

Pri prvom výskyte je v texte krátke vysvetlenie v zátvorke (napr. „QA = quality assurance — odborná kontrola pred publikáciou"), ale termíny sa neprepisujú.

Slogan:
> **Fakty a činy. Reformy pre Slovensko.**

(Nepoužívať: „Fakty do praxe. Reformy pre Slovensko.")

Pozícia:
- **Nežiadame o charitu. Ponúkame partnerstvo.**
- **Partnerstvo neznamená vplyv na odborné závery.**
- **Cena nepripravenosti je vždy vyššia ako cena prípravy.**
- **Toto nie sú náklady na prevádzku pre prevádzku. Toto je cena toho, aby Slovensko pri najbližšej príležitosti nezačínalo od nuly.**

---

**Verzia README:** v1 · máj 2026 · pripravené pre prvý deploy.
