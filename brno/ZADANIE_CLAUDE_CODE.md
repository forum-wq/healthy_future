# ZADANIE: Brno microsite (Future Slovakia Forum)

## Cieľ a kontext

Vytvor **štyri HTML stránky** pre podujatie FSF v Brne dňa **streda 6. mája 2026**, presne podľa kódovej a vizuálnej štruktúry dvoch existujúcich predchodcov:

- Olomouc — https://healthy-future.sk/olomouc/ (paleta terracotta)
- Praha — https://healthy-future.sk/diskusia/ (paleta amber)

Brno je tretí v sérii. **Štruktúrne, typograficky, komponentmi a JS logikou je identický s Praha** (Praha je novší a bohatší vzor — má aj `ucastnici.html` verejný dashboard, ktorý Olomouc nemá). Jediný rozdiel je vo dvojici farebných tokenov a v obsahu.

### Cieľová štruktúra súborov

```
/brno/
├── index.html         ← landing eventu (sekcie: hero, speakers, CTA s QR, about, praktické info, kde sa stretneme, acknowledgment, footer)
├── registracia.html   ← aktívny registračný formulár (POST → Google Apps Script)
├── ucastnici.html     ← verejný live dashboard (GET → Apps Script ?action=stats)
├── dashboard.html     ← admin dashboard chránený heslom (POST auth → token, GET ?key=token)
├── README.md          ← deployment guide pre Dávida
├── Brno.png           ← city watermark (z BRNO_watermark.png — premenuj)
├── wlachovsky_portrait.png
├── kollar_portrait.jpg
├── misik_portrait.jpg
├── logo-fsf.png       ← (skopíruj z /diskusia/logo-fsf.png)
├── og-image.png       ← TODO: Dávid vygeneruje samostatne
├── favicon.png        ← TODO: Dávid vygeneruje samostatne
├── qr-code.png        ← TODO: Dávid vygeneruje cez generátor po deploymente
└── mapa-trojka.png    ← TODO: Dávid vygeneruje cez gen_map.py (vzor v /diskusia/)
```

Cieľové URL po deploymente:
- https://healthy-future.sk/brno/
- https://healthy-future.sk/brno/registracia.html
- https://healthy-future.sk/brno/ucastnici.html
- https://healthy-future.sk/brno/dashboard.html

---

## 1. Vzorové stránky — povinné prečítanie pred prácou

**Pred kódovaním si fetchni a preštuduj všetky štyri Praha súbory:**

1. https://healthy-future.sk/diskusia/index.html
2. https://healthy-future.sk/diskusia/registracia.html ← táto je teraz v "uzavreté ďakujeme" móde, ALE **ty potrebuješ aktívny variant** — viď sekciu 4 nižšie pre špecifikáciu polí
3. https://healthy-future.sk/diskusia/ucastnici.html
4. https://healthy-future.sk/diskusia/dashboard.html

Tvoja Brno verzia bude **kópia týchto súborov s troma zmenami**:
- nahradíš dvojicu farebných tokenov (`--accent` + sekundárna)
- nahradíš obsah (texty, fotky, dátum, miesto, spíkri)
- nahradíš GAS endpoint URL (Brno bude mať vlastný)

Štruktúra HTML, mená CSS tried, JS logika **musí zostať identická s Praha** — neimprovizuj komponentové prepisy.

---

## 2. Farebná paleta — JEDINÝ rozdiel oproti Praha

V `:root` bloku **zmeň iba dva tokeny + farbu sekundárnej cool akcent farby** (eyebrow text + section labels + gradient stripa hore + ďalšie miesta kde Praha používa Maya blue `#4fc5ff`).

### Globálne tokeny (zostávajú identické s Praha)

```css
:root{
  --bg-primary:#0a1628;
  --bg-secondary:#10233b;
  --bg-overlay:rgba(10,22,40,0.84);
  --text-primary:#f5f7fb;
  --text-secondary:#9fb0c7;
  --text-muted:#7f8ea3;
  --btn-text:#0a1628;
  --border-soft:rgba(255,255,255,0.10);
  --card-bg:rgba(255,255,255,0.03);
  --font:'Inter Tight',system-ui,sans-serif;

  /* === MENÍ SA PRE BRNO === */
  --accent:#c25b5b;          /* Praha mala #e8a849 amber  → Brno má coral burgundy */
  --accent-hover:#a84a4a;    /* Praha mala #d99a34        → Brno tmavšia varianta */
}
```

### Cool sekundárna (eyebrow / section labels / gradient stripa)

V Praha kóde je `#4fc5ff` (Maya blue) **hardcoded na ~6 miestach** (nie cez CSS premennú). Nájdi všetky výskyty `#4fc5ff` aj `rgba(79,197,255, …)` v Praha kóde a nahraď ich Brno sekundárnou:

| Praha (Maya blue) | Brno (sage green) |
|---|---|
| `#4fc5ff` | `#7fa88e` |
| `rgba(79,197,255,0.25)` | `rgba(127,168,142,0.30)` |
| `rgba(79,197,255,0.20)` | `rgba(127,168,142,0.25)` |
| `rgba(79,197,255,0.10)` | `rgba(127,168,142,0.12)` |

Rovnako v `dashboard.html` segment palette zmeň `--c1:#4fc5ff` na `--c1:#7fa88e` (a nech `--c2:#c25b5b` aby Brno akcent dominoval).

### Vizuálna kontrola

Logika voľby: Praha mala teplý amber + studenú Maya blue. Brno má **teplú coral burgundy + studenú sage green** — Moravský motív (víno + vinice). Drží warm/cool dvojicu série.

---

## 3. Obsah pre `index.html`

### 3.1 `<head>` meta + SEO

```html
<title>Slovensko, ako ho vidia tí, čo ho riadili — diskusia v Brne 6. mája 2026 | Future Slovakia Forum</title>
<meta name="description" content="Tri perspektívy z prvej ruky — diplomacia, samospráva, zdravotníctvo. Wlachovský, Kollár, Mišík. Streda 6. 5. 2026, 17:00, Kavárna Trojka, Brno.">
<meta property="og:title" content="Slovensko, ako ho vidia tí, čo ho riadili">
<meta property="og:description" content="Diplomat, primátor, health economist v Brne. Wlachovský, Kollár, Mišík. 6.5.2026, 17:00, Kavárna Trojka.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://healthy-future.sk/brno/">
<meta property="og:image" content="https://healthy-future.sk/brno/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="sk_SK">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Slovensko, ako ho vidia tí, čo ho riadili">
<meta name="twitter:image" content="https://healthy-future.sk/brno/og-image.png">
<link rel="canonical" href="https://healthy-future.sk/brno/">
```

CSP rovnako ako Praha (uprav iba `connect-src 'self'` aby umožňoval `https://script.google.com` a `https://script.googleusercontent.com` pre GAS volania).

### 3.2 HERO

```
[Logo FSF, biele, height 48 px]

Eyebrow:    "Diskusia o budúcnosti Slovenska"
H1:         "Slovensko,"
            "ako ho vidia tí, čo ho riadili."
Sub:        "Tri perspektívy z prvej ruky — diplomacia, samospráva, zdravotníctvo."

Meta:       "streda 6. mája 2026 • 17:00–19:00"
            "Kavárna Trojka • Dům pánů z Kunštátu • Dominikánská 9 • Brno"

CTA:        "Registrovať sa →"  (link na registracia.html, primary button)
Micro:      "Bezplatná účasť · Po hlavnej časti presun do okolia na neformálny pokec"
            "Kto už je registrovaný →"  (link na ucastnici.html, accent farba, smaller text)

Hero illustration vpravo: Brno.png (presný setup ako Praha — 55% width, opacity 0.17, gradient overlay z bg-primary do transparent)
```

> **Poznámka:** Pri H1 použi `<br>` na zalomenie po "Slovensko," — typograficky lepšie pre dramatickosť. V `<title>` ale nech je názov bez `<br>`.

### 3.3 SPEAKERS — 3 spíkri vedľa seba

Praha má `grid-template-columns:1fr 1fr` (2 spíkri). **Pre Brno zmeň na `repeat(3,1fr)` na desktop, na mobile zostáva 1fr (Praha media query už toto rieši).**

Texty pre 3 karty — pozri samostatný súbor `CONTENT_TEXTS.md` (oddelený od zadania, aby ho Dávid mohol ľahko upravovať bez prelistovania celého briefu).

### 3.4 REGISTRATION CTA s QR

Identicky ako Praha:
- Vľavo: H2 "Registrácia", krátky odsek, status note (s ikonou)
- Vpravo: primary button + QR kód

Texty:
```
H2:        "Registrácia"
Para:      "Kavárna Trojka má kapacitu 70 miest. Registrujte sa včas."
Note:      [icon] "Prosíme o presnosť — počty pomáhajú s prípravou priestoru."
Button:    "Registrovať sa →"
QR caption: "Skenuj a registruj sa"
```

### 3.5 O ČOM TO BUDE

Pozri `CONTENT_TEXTS.md`.

### 3.6 PRAKTICKÉ INFORMÁCIE — 3 stĺpce

```
DOPRAVA
Tramvaj (šaliňa) — zastávka **Šilingrovo náměstí** (linky 5, 6, 12) alebo **Česká** (linky 1, 6, 9, 10).
Z Hlavného nádražia tramvajou linkou 12 dve zastávky, alebo 12 minút pešo.

VSTUP
Kavárna Trojka sídli **na nádvorí Domu pánov z Kunštátu**.
Vchod je z Dominikánskej ulice cez priechod pod historickou bránou — potom doľava.

FORMÁT
Krátke úvody všetkých troch rečníkov, **moderovaná diskusia** a otázky z publika.
Po oficiálnej časti pokračujeme **v podniku v okolí** na neformálny pokec — presné miesto sa upresní v deň podujatia.
```

### 3.7 KDE SA STRETNEME — 2 karty (mapa + foto vchodu)

Praha má 2 venue cards (mapa areálu + foto vchodu) s `routeModal` popupom. Pre Brno rovnaká štruktúra:

**Karta 1 (mapa):**
- `<img src="mapa-trojka.png" alt="Mapa polohy Kavárna Trojka v centre Brna">`
- H4: "Kavárna Trojka — Dominikánská 9"
- P: "Na nádvorí Domu pánov z Kunštátu, ~5 minút pešo zo Šilingrova náměstí."
- Button: "Trasa zo Šilingrova náměstí — 5 min. pešo →" (otvára modal s `pesi-trasa-trojka.png`)

**Karta 2 (vchod):**
- `<img src="vchod-trojka.jpg" alt="Vchod do Kavárny Trojka cez nádvorie Domu pánov z Kunštátu">`
- H4: "Vchod cez nádvorie"
- P: "Z Dominikánskej ulice cez bránu Domu pánov z Kunštátu, potom doľava na nádvorí."

> **TODO note v HTML:** `<!-- TODO: Dávid vygeneruje mapa-trojka.png cez gen_map.py s GPS 49.193211, 16.606475. Foto vchodu doplní samostatne. -->`

### 3.8 ACKNOWLEDGMENT — voliteľné

Pre Brno **vynechaj acknowledgment sekciu** (Praha ju má kvôli FSV UK Jinonice, Brno je v komerčnom priestore). Namiesto nej daj jednoduchšie poďakovanie v päte:

```
Ďakujeme **Kavárne Trojka** za poskytnutie priestoru v historickom Dome pánov z Kunštátu.
```

### 3.9 FOOTER

```
[Logo FSF na low opacity]

Lokálna koordinácia: **Linda Veverková** (MUNI Brno) · **Jakub Biely** (MUNI Brno)
Kontakt: studenti@future-slovakia.eu

Iniciatíva Future Slovakia Forum · 2026
```

Bez partnerskych lôg ako v Praha (FSV UK, INESS, Pražská kaviareň) — Brno tieto inštitucionálne partnerstvá zatiaľ nemá.

---

## 4. Obsah pre `registracia.html`

**AKTÍVNA verzia** (nie "Ďakujeme, registrácia uzavretá"). Praha registracia.html v jej súčasnom stave je archívna verzia — ty potrebuješ predchádzajúci aktívny stav. Tu je špecifikácia formulára:

### 4.1 Layout

Identický header ako Praha (logo + eyebrow + H1 + sub + meta), ale obsah hovorí o registrácii:

```
Eyebrow:  "Brno • 6. mája 2026"
H1:       "Registrácia"
Sub:      "Bezplatná účasť. Vyplňte, prosím, formulár pred podujatím."
Meta:     "streda 6. mája 2026 • 17:00 • Kavárna Trojka • Dominikánská 9 • Brno"
```

### 4.2 Polia formulára

Field set musí byť **kompatibilný s Praha GAS schémou** (aby `ucastnici.html` a `dashboard.html` mohli ten istý frontend kód použiť na obe inštalácie). Polia:

| Field name (form) | Type | Required | UI label | GAS column key |
|---|---|---|---|---|
| `meno` | text | ✓ | "Meno" | `meno` |
| `priezvisko` | text | ✓ | "Priezvisko" | `priezvisko` |
| `email` | email | ✓ | "Email" | `email` |
| `mobil` | tel | optional | "Mobil (voliteľné)" | `mobil` |
| `status` | radio | ✓ | "Som:" → Študent / Absolvent / Iné | `status` |
| `univerzita` | select+text | conditional* | "Univerzita" | `univerzita` |
| `fakulta` | text | conditional* | "Fakulta / odbor" | `fakulta` |
| `zaujmy` | checkboxes (max 2) | optional | "O čo sa najviac zaujímam" | `záujmy` (comma-separated) |
| `motivacia` | textarea | optional | "Krátko o sebe / motivácia" (placeholder: "Voliteľné — poteší") | `motivacia` |
| `narodnost` | select | ✓ | "Národnosť" → SK / CZ / iné | `narodnost` |
| `gdpr` | checkbox | ✓ | (text nižšie) | `gdpr` |

*Conditional: ak status = Študent alebo Absolvent → univerzita + fakulta sú required; ak Iné → skryté.

**Univerzita select options** (Brno):
```
— vyberte —
Masarykova univerzita (MUNI)
Vysoké učení technické v Brně (VUT)
Mendelova univerzita v Brně (MENDELU)
Veterinární univerzita Brno (VETUNI)
Janáčkova akademie múzických umění (JAMU)
Iná česká univerzita
Iná slovenská univerzita
```

**Záujmy checkboxes** (max 2):
- `zdravotnictvo` → "Zdravotníctvo"
- `skolstvo` → "Školstvo a vzdelávanie"
- `financie` → "Reforma verejných financií"
- `decentralizacia` → "Decentralizácia"
- `ine` → "Iné"

**GDPR text** (pri checkboxe, presne tento text):
```
Súhlasím so spracovaním uvedených osobných údajov pre účely organizácie podujatia
a komunikácie zo strany Future Slovakia Forum, v súlade s Nariadením EÚ 2016/679
(GDPR). Údaje sú spracované výlučne pre tieto účely, neposkytujú sa tretím stranám
a uchovávame ich len po dobu nevyhnutnú na organizáciu podujatia a spätnú väzbu.
```

### 4.3 Klientská capacity gate

Pred submitom skontroluj kapacitu cez `GET ${GAS_URL}?action=count`:
- ak `count >= CAPACITY` → zobraz "Kapacita naplnená" stav, disable submit button
- inak povolí submit

```javascript
const GAS_URL_BRNO = 'REPLACE_ME_BRNO_GAS_DEPLOYMENT_URL';  // viď GAS_TEMPLATE.md
const CAPACITY = 70;  // Kavárna Trojka, max kapacita sály
```

> **Warning komentár v JS:** `// Client-side capacity gate je bypassable cez priame API volania. Server-side validácia v doPost() je v GAS_TEMPLATE.md povinná.`

### 4.4 Submit handler

POST na `GAS_URL_BRNO` ako `text/plain;charset=utf-8` (CORS-simple), JSON v body. Po response:
- Success: skry formulár, zobraz inline "✓ Ďakujeme za registráciu" panel s linkom na `index.html` a `ucastnici.html`
- Error: zobraz inline error message s emailom `studenti@future-slovakia.eu`

---

## 5. Obsah pre `ucastnici.html`

**100% identický s Praha ucastnici.html**, iba zmeny:

1. `<title>` → "Kto príde? — Slovensko, ako ho vidia tí, čo ho riadili | Future Slovakia Forum"
2. `<meta description>` → upravené pre Brno
3. `const API` → `GAS_URL_BRNO`
4. `const CAPACITY` → 70 (kapacita sály Kavárny Trojka)
5. CTA bottom text → "Kavárna Trojka má kapacitu 70 miest. Registrácia je nutná."
6. Farby tokens → Brno paleta (viď sekcia 2)
7. Link "Späť na podujatie" → `index.html`

JS logika `renderAll()`, `renderPie()`, `renderBars()`, `renderLegend()`, `animateNumber()` **zostáva identická** — Praha implementácia je správna.

---

## 6. Obsah pre `dashboard.html`

**100% identický s Praha dashboard.html**, iba zmeny:

1. `<title>` → "Admin dashboard — Brno"
2. `const API` → `GAS_URL_BRNO`
3. `const CAPACITY` → 70
4. Farby tokens → Brno paleta
5. Heslo → bude na strane GAS (Dávid nastaví v Properties pri deployi); HTML nemení nič

JS logika auth flow (POST `__action: 'auth'` → token, GET `?key=<token>`), idle timer, render funkcie **zostávajú identické**.

---

## 7. Google Apps Script endpoint

Brno má **vlastný GAS deployment** na **vlastný Google Sheet**. Šablóna kódu je v samostatnom súbore `GAS_TEMPLATE.md`. Dávid bude potrebovať:

1. Vytvoriť nový Google Sheet "FSF_Brno_Registracia_2026"
2. Vytvoriť nový Apps Script projekt linkovaný na ten sheet
3. Skopírovať `GAS_TEMPLATE.md` ako `Code.gs`
4. Nastaviť Properties: `ADMIN_PASSWORD`
5. Deploy ako Web App (Anyone, execute as me)
6. URL skopírovať do `registracia.html`, `ucastnici.html`, `dashboard.html` ako `GAS_URL_BRNO`

**Dôležité — fix `status` field bug:** v `doPost()` musí byť uložený `status` field (Študent/Absolvent/Iné). V starých Olomouc/Praha implementáciách táto kolóna chýbala v insertion, čo viedlo k misclassifikácii. Šablóna `GAS_TEMPLATE.md` to už má opravené — neodstraňuj.

**Server-side capacity gate:** v `doPost()` pred zápisom skontroluj počet riadkov a vráť `{error: "capacity_full"}` ak >= CAPACITY. Klient len UI; server je autoritatívny.

---

## 8. Technické požiadavky

- HTML5 semantic markup
- WCAG AA accessibility (alt texty, focus states, kontrast 4.5:1)
- Mobile-first responsive (breakpoints 640px, 900px ako Praha)
- Inter Tight cez Google Fonts (preconnect už v meta)
- Žiadne externé JS knižnice — vanilla JS stačí
- Rovnaký CSP header ako Praha (s connect-src pre GAS endpointy)
- `loading="lazy"` na všetkých nesúvislých img s viewportom

---

## 9. Slovak typografia (povinné)

- Vykanie ("vás", "vaše", "registrujte sa") — adresát sú dospelí univerzitní študenti
- Slovenské úvodzovky „takto" v celom texte
- Em-dash — (U+2014) v body texte, en-dash – v rozpätiach (17:00–19:00)
- Separátor `•` (U+2022) alebo `·` (U+00B7) v meta riadkoch — drž sa Praha vzoru (Praha používa `•` pre primary meta a `·` pre venue)
- Nezalomovacie medzery `&nbsp;` pred/po em-dash a v "NR&nbsp;SR", "1&nbsp;400 eur" atp.

---

## 10. Workflow pre teba (Claude Code)

**Iteratívny postup s vizuálnou kontrolou** — Dávid preferuje screenshot/preview po každej hlavnej sekcii pred pokračovaním.

1. **Začni s `index.html`:**
   - a) Skopíruj Praha `index.html` → `brno/index.html`
   - b) Najprv aktualizuj `:root` tokens (akcent + replace `#4fc5ff` → `#7fa88e`). Ukáž screenshot — over že paleta sedí.
   - c) Aktualizuj hero (titulok, dátum, CTA, watermark). Ukáž screenshot.
   - d) Aktualizuj speakers grid na 3 stĺpce + obsah z `CONTENT_TEXTS.md`. Ukáž screenshot.
   - e) Aktualizuj zvyšné sekcie (CTA, about, praktické, mapa, footer). Po každej sekcii rýchlo skontroluj.
2. **Potom `registracia.html`:**
   - Začni od layoutu, potom forma, potom JS handler s capacity gate.
3. **Potom `ucastnici.html`** — len token/text swap z Praha verzie.
4. **Potom `dashboard.html`** — len token/text swap.
5. **Potom `README.md` a `GAS_TEMPLATE.md` finálne aktualizácie.**
6. **Pred odovzdaním:**
   - Lighthouse audit na všetkých 4 stránkach
   - HTML W3C validátor
   - Test responsive na 380, 640, 900, 1280 px
   - Test formulára: validácia required polí, conditional univerzita/fakulta, max 2 záujmy
   - Spýtaj sa Dávida na finálne potvrdenie pred odovzdaním

**Pri akejkoľvek nejednoznačnosti:** opýtaj sa, alebo nechaj `<!-- TODO: -->` komentár a pokračuj. Nevymýšľaj texty, fakty ani URL.

---

## 11. Validačné kritériá pred odovzdaním

- [ ] Lighthouse Performance ≥ 90, Accessibility ≥ 95, SEO ≥ 95 (na všetkých 4 stránkach)
- [ ] HTML W3C validátor: 0 errors
- [ ] Responsive testované 380 / 640 / 900 / 1280 px
- [ ] Všetky `<img>` majú `alt`
- [ ] `:root` tokens identické s Praha okrem `--accent` a `--accent-hover`
- [ ] Žiadne `#4fc5ff` ani `rgba(79,197,255,...)` v Brno súboroch (všetko nahradené sage green)
- [ ] Form validuje required, blokuje pri kapacite
- [ ] GAS endpoint placeholder má jasný `REPLACE_ME_BRNO_GAS_DEPLOYMENT_URL` marker
- [ ] Slovenská typografia konzistentná
- [ ] Brno coral burgundy paleta nie je nikde zamenená s Praha amber alebo Olomouc terracotta

---

**Verzia zadania:** v2 (kompletne prepísaná) · 22. apríla 2026 · Dávid Bořuta (FSF)

**Súvisiace súbory v tomto adresári:**
- `STARTER_PROMPT.txt` — krátka prvá správa, ktorou spustíš prácu
- `CONTENT_TEXTS.md` — texty obsahu (bios, hero, popisky) pre ľahkú editáciu
- `GAS_TEMPLATE.md` — Apps Script `Code.gs` šablóna pre Brno deployment
