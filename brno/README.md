# Brno event — deployment guide

Microsite pre podujatie **„Slovensko, ako ho vidia tí, čo ho riadili"** (streda 6. mája 2026, Kavárna Trojka, Brno). Tretí event v sérii po Olomouci a Prahe.

Cieľové URL:
- `https://healthy-future.sk/brno/` → landing
- `https://healthy-future.sk/brno/registracia.html` → aktívny formulár
- `https://healthy-future.sk/brno/ucastnici.html` → verejný live dashboard
- `https://healthy-future.sk/brno/dashboard.html` → admin (password-protected)

---

## 1. Štruktúra adresára

```
brno/
├── index.html              ← landing eventu
├── registracia.html        ← aktívny registračný formulár (POST → GAS)
├── ucastnici.html          ← verejný live dashboard (GET ?action=stats)
├── dashboard.html          ← admin dashboard (auth → token)
├── README.md               ← tento súbor
├── GAS_TEMPLATE.md         ← Apps Script Code.gs šablóna
├── CONTENT_TEXTS.md        ← texty obsahu (referencia)
├── ZADANIE_CLAUDE_CODE.md  ← spec v2 (referencia)
├── STARTER_PROMPT.txt      ← prvá správa pre Claude Code (referencia)
│
├── Brno.png                ← hero watermark (používa index.html)
├── logo-fsf.png            ← FSF logo
├── wlachovsky_portrait.png ← spíker 1
├── kollar_portrait.jpg     ← spíker 2
├── misik_portrait.jpg      ← spíker 3
├── qr-brno.png             ← QR kód na registráciu
├── pesi-trasa-trojka.png   ← mapa v modaly (pešia trasa)
│
├── mapa-trojka.png         ← TODO: Dávid vygeneruje cez gen_map.py (GPS 49.193211, 16.606475)
├── vchod-trojka.jpg        ← TODO: Dávid — foto vchodu cez nádvorie
├── og-image.png            ← TODO: Dávid — 1200×630 OG preview
└── favicon.png             ← TODO: Dávid — 32×32 skratka FSF loga
```

Orig assety (pôvodné uploady, nepoužívajú sa v HTML, možno po verifikácii zmazať):
`M_wlachosky.jpeg`, `mwlachovsky.jpg`, `miroslav-wlachovsky-photo-1-modified-350x350.png`, `Miroslav_Kollar.jpg`, `matej_misik_01_-_copy_edited.jpg`, `Miroslav Wlachovský_ Výskum a Analýza.docx`.

---

## 2. Pred publikom — checklist

### 2.1 Google Apps Script endpoint

**Povinný krok — bez neho registrácia nefunguje.** Detailný návod v [`GAS_TEMPLATE.md`](GAS_TEMPLATE.md).

Zhrnutie:
1. Vytvoriť Google Sheet `FSF_Brno_Registracia_2026` s presnými 14 stĺpcami (viď GAS_TEMPLATE Krok 1).
2. Cez Extensions → Apps Script vytvoriť projekt `FSF_Brno_API_2026`, vložiť šablónu `Code.gs`.
3. V Script Properties nastaviť `ADMIN_PASSWORD` (min. 16 znakov, unikátne pre Brno).
4. Deploy → New deployment → Web app → Execute as **Me** / Who has access **Anyone**.
5. Skopírovať Web app URL (formát `https://script.google.com/macros/s/AKfycb.../exec`).

⚠️ **Fix `status` field bug:** v šablóne `Code.gs` je zápis `row.push(payload.status || '')` na riadku F (stĺpec 6). V starých Olomouc/Praha implementáciách chýbal — tu ho **neodstraňuj**, pieklo to klasifikáciu v dashbordoch.

⚠️ **Server-side capacity gate:** `doPost()` odmieta registráciu pri `>= CAPACITY`. Klient je len UI, server je autoritatívny. Nemeň bez premýšľania.

### 2.2 Vložiť GAS URL do HTML

V troch súboroch nahraď placeholder `REPLACE_ME_BRNO_GAS_DEPLOYMENT_URL`:

| Súbor | Premenná |
|---|---|
| `registracia.html` | `const GAS_URL_BRNO` |
| `ucastnici.html` | `const API` |
| `dashboard.html` | `const API` |

Rýchle overenie:
```bash
grep -n "REPLACE_ME" brno/*.html
```

### 2.3 Doplniť chýbajúce assety

| Súbor | Ako vygenerovať |
|---|---|
| `mapa-trojka.png` | Cez `diskusia/gen_map.py` — GPS Kavárna Trojka `49.193211, 16.606475`, zoom level porovnateľný s Prahou |
| `vchod-trojka.jpg` | Foto vchodu cez nádvorie Domu pánov z Kunštátu (Linda Veverková vie urobiť pri rekognoskácii) |
| `og-image.png` | Canva (1200×630) alebo `diskusia/gen_og_v5.py` — Brno watermark + hero text + dátum |
| `favicon.png` | 32×32 alebo 64×64, skratka FSF loga — samostatný export |

### 2.4 Kapacita

Všetky tri frontendy a GAS Code.gs majú `CAPACITY = 70` (sála Kavárne Trojka). Ak sa zmení, zmeň **všetky štyri** miesta:
- `registracia.html` — const `CAPACITY`
- `ucastnici.html` — const `CAPACITY` + hardcoded `0 / 70 miest` v hero
- `dashboard.html` — const nemá (používa `?capText` hardcoded `' / 70'` v JS + `0 / 70` v HTML init)
- `Code.gs` — const `CAPACITY`

---

## 3. Deployment

Adresár `brno/` na root webservera (statické HTML hosting — webflow, Netlify, GitHub Pages, alebo priamy FTP/SFTP). Preservuj relatívne cesty — všetky `src="..."` sú relatívne k `brno/`.

Po nahratí otvoriť:
- `https://healthy-future.sk/brno/` — kontrola hero, fotky, CTA
- `https://healthy-future.sk/brno/registracia.html` — odošli testovaciu registráciu
- `https://healthy-future.sk/brno/ucastnici.html` — over, že počítadlo a grafy zobrazujú dáta
- `https://healthy-future.sk/brno/dashboard.html` — prihlás sa, over tabuľku registrácií

---

## 4. Testing checklist — po deployi

### registracia.html
- [ ] Submit s prázdnymi povinnými poľami → inline error hlášky
- [ ] Submit s neplatným e-mailom → error
- [ ] Radio Študent → zobrazí univerzita + fakulta
- [ ] Radio Iné → skryje univerzita + fakulta
- [ ] Označenie 3. checkboxu v „Záujmy" → zablokované, hláška o maxime 2
- [ ] Odoslaná testovacia registrácia → „Ďakujeme" panel
- [ ] V Google Sheete sa objavil riadok so všetkými 14 stĺpcami, **`status` nie je prázdny**
- [ ] Druhá registrácia s rovnakým e-mailom → alert „už registrovaná"
- [ ] `?action=count` vracia správny počet

### ucastnici.html
- [ ] Hero počítadlo ukazuje aktuálny total
- [ ] Donut pie (status) a (záujmy) sa renderujú
- [ ] Top univerzity a top fakulty bar list
- [ ] Auto-refresh každú minútu (`setInterval(load, 60000)`)

### dashboard.html
- [ ] Login — zlé heslo → „Nesprávne heslo", 1s throttle
- [ ] Login — správne heslo → dashboard sa zobrazí
- [ ] Tabuľka registrácií zoradená abecedne podľa priezviska
- [ ] Idle 15 min → auto-logout
- [ ] Logout tlačidlo funguje

### Cross-browser + responsive
- [ ] Chrome + Safari + Firefox (desktop)
- [ ] Mobile: 380 px, 640 px, 900 px breakpointy
- [ ] Lighthouse: Performance ≥ 90, A11y ≥ 95, SEO ≥ 95
- [ ] W3C HTML validator: 0 errors

---

## 5. Známe TODO pre Dávida

V kóde sú značené `<!-- TODO: -->` komentármi:

1. **`index.html`** — venue sekcia má odkazy na `mapa-trojka.png`, `vchod-trojka.jpg` a modal obrázok `pesi-trasa-trojka.png` (posledný už dodaný). Prvé dva treba doplniť.
2. **`registracia.html`, `ucastnici.html`, `dashboard.html`** — všetky tri majú `REPLACE_ME_BRNO_GAS_DEPLOYMENT_URL` placeholder. Bez deploymentu GAS-u formulár neodošle a dashboardy nezobrazia dáta.
3. **`og-image.png`, `favicon.png`** — meta tagy ich očakávajú na uvedených cestách. Chýbajúce favicon → 404 v consoli (neblokujúce). Chýbajúce og-image → OG preview bez obrázka pri zdieľaní.

---

## 6. Farebná paleta (referencia)

Brno = Praha štruktúra × 2 tokeny:

| Token | Praha | Brno |
|---|---|---|
| `--accent` | `#e8a849` (amber) | `#c25b5b` (coral burgundy) |
| `--accent-hover` / hardcoded `#d99a34` | `#d99a34` | `#a84a4a` |
| Hardcoded cool secondary | `#4fc5ff` (Maya blue) | `#7fa88e` (sage green) |
| `rgba(79,197,255,…)` | Maya variant | `rgba(127,168,142,…)` |
| `rgba(232,168,73,…)` | amber variant | `rgba(194,91,91,…)` |

Sémantika: teplá coral burgundy + studená sage green = Moravský vínny motív (víno + vinice). Drží warm/cool dvojicu série (Praha amber+maya, Olomouc amber+steel, Brno burgundy+sage).

---

## 7. Post-event

Keď podujatie skončí:
1. Nahraď `registracia.html` archívnou „Registrácia uzavretá — ďakujeme" verziou (vzor: `diskusia/registracia.html` a `Olomouc/registracia.html` po eventoch).
2. V `index.html` v hero oddel CTA/odkazu na registráciu a pridaj thank-you banner (vzor: úpravy `Olomouc/index.html` a `diskusia/index.html` po eventoch).
3. `ucastnici.html` a `dashboard.html` nechaj aktívne pokiaľ chceš mať prehľad — alebo odstráň a archivuj Sheet.

---

**Verzia README:** v1 · 23. apríla 2026 · pripravené pred Brno deploymentom
