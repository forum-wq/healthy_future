# GAS_TEMPLATE.md — Apps Script `Code.gs` pre Brno endpoint

> **Účel:** Šablóna pre nový Google Apps Script deployment, ktorý slúži všetkým trom Brno HTML stránkam (`registracia.html`, `ucastnici.html`, `dashboard.html`). Brno **musí mať vlastný endpoint** — nezdieľa s Praha ani Olomouc.
>
> **Kompatibilita:** Schéma stĺpcov a JSON odpovedí je identická s Praha endpointom, takže frontend kód `ucastnici.html` a `dashboard.html` funguje bez modifikácie API zmluvy.
>
> **Opravený bug:** V starých Olomouc/Praha implementáciách `doPost()` neukladal `status` field, čo viedlo k tomu, že každá nová registrácia padala do legacy fallback a misclassifikovala sa. Táto šablóna `status` ukladá explicitne — neodstraňuj zápis na riadku `row.push(payload.status || '')`.

---

## Krok 1: Vytvor Google Sheet

Názov: `FSF_Brno_Registracia_2026`

Vytvor jeden tab `Registracie` s týmito stĺpcami v presnom poradí (riadok 1, header):

```
A: timestamp
B: meno
C: priezvisko
D: email
E: mobil
F: status
G: univerzita
H: fakulta
I: záujmy
J: motivacia
K: narodnost
L: gdpr
M: ip_hash
N: user_agent
```

> **Poznámka:** Stĺpec I sa volá `záujmy` s diakritikou — frontend `dashboard.html` očakáva práve tento string ako primary key (s aliasmi `zaujmy`, `interests` ako fallback). Ak premenuješ, zlomíš dashboard.

---

## Krok 2: Apps Script projekt

V tom istom Google Sheete: **Extensions → Apps Script**. Premenuj projekt na `FSF_Brno_API_2026`.

V `Code.gs` nahraď celý obsah týmto:

```javascript
// ═══════════════════════════════════════════════════════════════════
//  FSF Brno Registration API
//  Endpoints:
//    GET  ?action=stats   → public aggregated stats for ucastnici.html
//    GET  ?action=count   → public registration count for capacity gate
//    POST {meno, priezvisko, ...}   → submit registration
//    POST {__action:'auth', password} → admin auth, returns token
//    GET  ?key=<token>    → admin raw rows for dashboard.html
// ═══════════════════════════════════════════════════════════════════

const SHEET_NAME = 'Registracie';
const CAPACITY = 70;  // Kavárna Trojka — max kapacita sály
const TOKEN_TTL_SECONDS = 3600;

// ── Helpers ────────────────────────────────────────────────────────
function getSheet_() {
  return SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
}

function readAllRows_() {
  const sh = getSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { headers: [], rows: [] };
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const rows = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return { headers, rows };
}

function rowsAsObjects_() {
  const { headers, rows } = readAllRows_();
  return rows.map(r => {
    const o = {};
    headers.forEach((h, i) => { o[h] = r[i]; });
    return o;
  });
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function hashIp_(ip) {
  if (!ip) return '';
  const raw = ip + ':fsf-brno-2026';
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return bytes.slice(0, 8).map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

// ── Token handling (admin) ─────────────────────────────────────────
function makeToken_() {
  const t = Utilities.getUuid().replace(/-/g, '');
  const cache = CacheService.getScriptCache();
  cache.put('tok:' + t, '1', TOKEN_TTL_SECONDS);
  return t;
}

function tokenValid_(t) {
  if (!t) return false;
  return CacheService.getScriptCache().get('tok:' + t) === '1';
}

// ── GET handler ────────────────────────────────────────────────────
function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = params.action;
  const key = params.key;

  // Admin: raw rows
  if (key) {
    if (!tokenValid_(key)) {
      return jsonResponse_({ error: 'unauthorized' });
    }
    return jsonResponse_({ rows: rowsAsObjects_() });
  }

  // Public: aggregated stats
  if (action === 'stats') {
    const regs = rowsAsObjects_();
    const total = regs.length;

    const status = { student: 0, absolvent: 0, verejnost: 0 };
    regs.forEach(r => {
      const s = String(r.status || '').toLowerCase().trim();
      if (s === 'student' || s === 'študent') status.student++;
      else if (s === 'absolvent') status.absolvent++;
      else status.verejnost++;
    });

    const interests = {};
    regs.forEach(r => {
      const raw = r['záujmy'] || r['zaujmy'] || '';
      String(raw).split(',').forEach(k => {
        const key = String(k || '').trim().toLowerCase();
        if (key) interests[key] = (interests[key] || 0) + 1;
      });
    });

    const uniMap = {};
    regs.forEach(r => {
      const u = (r.univerzita || '').toString().trim();
      if (u) uniMap[u] = (uniMap[u] || 0) + 1;
    });
    const universities = Object.keys(uniMap)
      .map(name => ({ name, count: uniMap[name] }))
      .sort((a, b) => b.count - a.count);

    const facMap = {};
    regs.forEach(r => {
      const fac = (r.fakulta || '').toString().trim();
      if (!fac) return;
      const uni = (r.univerzita || '').toString().trim();
      const k = fac + '|||' + uni;
      facMap[k] = (facMap[k] || 0) + 1;
    });
    const faculties = Object.keys(facMap).map(k => {
      const [name, university] = k.split('|||');
      return { name, university, count: facMap[k] };
    }).sort((a, b) => b.count - a.count);

    return jsonResponse_({ total, status, interests, universities, faculties });
  }

  // Public: capacity check
  if (action === 'count') {
    const sh = getSheet_();
    const count = Math.max(0, sh.getLastRow() - 1);
    return jsonResponse_({ count, capacity: CAPACITY, full: count >= CAPACITY });
  }

  return jsonResponse_({ error: 'forbidden' });
}

// ── POST handler ───────────────────────────────────────────────────
function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ error: 'invalid_json' });
  }

  // Admin auth
  if (payload && payload.__action === 'auth') {
    const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
    if (!expected) return jsonResponse_({ error: 'admin_password_not_configured' });
    if (payload.password !== expected) {
      Utilities.sleep(1000); // throttle brute force
      return jsonResponse_({ error: 'invalid_password' });
    }
    const token = makeToken_();
    return jsonResponse_({ token, expiresInSeconds: TOKEN_TTL_SECONDS });
  }

  // Registration submission

  // Server-side capacity gate (client-side gate is bypassable)
  const sh = getSheet_();
  const currentCount = Math.max(0, sh.getLastRow() - 1);
  if (currentCount >= CAPACITY) {
    return jsonResponse_({ error: 'capacity_full' });
  }

  // Required field validation
  const required = ['meno', 'priezvisko', 'email', 'gdpr'];
  for (const f of required) {
    if (!payload[f]) {
      return jsonResponse_({ error: 'missing_field', field: f });
    }
  }
  if (!String(payload.email).includes('@')) {
    return jsonResponse_({ error: 'invalid_email' });
  }

  // Duplicate guard (same email already registered)
  const existing = rowsAsObjects_();
  const emailLower = String(payload.email).trim().toLowerCase();
  if (existing.some(r => String(r.email || '').trim().toLowerCase() === emailLower)) {
    return jsonResponse_({ error: 'already_registered', email: payload.email });
  }

  // Normalize záujmy (comma-separated, lowercase, max 2)
  let zaujmy = '';
  if (Array.isArray(payload.zaujmy)) {
    zaujmy = payload.zaujmy.slice(0, 2).map(s => String(s).toLowerCase().trim()).join(',');
  } else if (typeof payload.zaujmy === 'string') {
    zaujmy = payload.zaujmy.split(',').slice(0, 2).map(s => s.toLowerCase().trim()).join(',');
  }

  // Build row matching header order
  const ip = (e && e.parameter && e.parameter.ip) || '';
  const ua = (e && e.parameter && e.parameter.ua) || '';
  const row = [
    new Date(),                                  // A timestamp
    String(payload.meno || '').trim(),           // B meno
    String(payload.priezvisko || '').trim(),     // C priezvisko
    String(payload.email || '').trim(),          // D email
    String(payload.mobil || '').trim(),          // E mobil
    String(payload.status || '').trim(),         // F status  ← FIX: was missing in old impl
    String(payload.univerzita || '').trim(),     // G univerzita
    String(payload.fakulta || '').trim(),        // H fakulta
    zaujmy,                                       // I záujmy
    String(payload.motivacia || '').trim(),      // J motivacia
    String(payload.narodnost || '').trim(),      // K narodnost
    payload.gdpr ? 'Áno' : '',                   // L gdpr
    hashIp_(ip),                                  // M ip_hash (privacy-safe)
    String(ua).slice(0, 200)                     // N user_agent
  ];

  sh.appendRow(row);

  return jsonResponse_({
    ok: true,
    position: currentCount + 1,
    capacity: CAPACITY
  });
}
```

---

## Krok 3: Properties — heslo

V Apps Script editore: **Project Settings (ozubené koleso vľavo) → Script Properties → Add property**:

| Property | Value |
|---|---|
| `ADMIN_PASSWORD` | (silné heslo, min. 16 znakov, ktoré poznáš iba ty a nikdy neukladaj do gitu/HTML) |

---

## Krok 4: Deploy

**Deploy → New deployment**:

| Field | Value |
|---|---|
| Type | Web app |
| Description | FSF Brno API v1 |
| Execute as | Me (tvoj Google účet) |
| Who has access | Anyone |

Stlač **Deploy**, potvrď permissions. Skopíruj **Web app URL** (formát: `https://script.google.com/macros/s/AKfycb…/exec`).

---

## Krok 5: Vlož URL do HTML súborov

V troch súboroch nahraď placeholder:

**`brno/registracia.html`**:
```javascript
const GAS_URL_BRNO = 'https://script.google.com/macros/s/AKfycb.../exec';
```

**`brno/ucastnici.html`**:
```javascript
const API = 'https://script.google.com/macros/s/AKfycb.../exec';
```

**`brno/dashboard.html`**:
```javascript
const API = 'https://script.google.com/macros/s/AKfycb.../exec';
```

Re-uploadnuť všetky tri súbory na server.

---

## Krok 6: Testovanie pred publikom

1. **Test capacity GET** — v prehliadači: `https://script.google.com/.../exec?action=count` → očakávaný JSON `{count: 0, capacity: 70, full: false}`.
2. **Test stats GET** — `?action=stats` → `{total: 0, status: {...}, interests: {}, universities: [], faculties: []}`.
3. **Test submit POST** cez `registracia.html` — odošli skúšobnú registráciu, over že:
   - sa zapíše do Sheetu
   - `status` field NIE JE prázdny (tu bol predtým bug)
   - `záujmy` field obsahuje validné hodnoty oddelené čiarkou
4. **Test duplicate** — odošli druhý raz s rovnakým emailom → očakávaný response `{error: 'already_registered'}`.
5. **Test capacity gate** — zmeň dočasne `CAPACITY = 1` v Code.gs, redeploy, skús druhú registráciu → `{error: 'capacity_full'}`. Vráť `CAPACITY = 70`, redeploy.
6. **Test admin auth** — v `dashboard.html` zadaj heslo, over že login funguje a načítajú sa dáta.

---

## Krok 7: Bezpečnostné poznámky

- **Heslo do dashboardu** nikdy nedávaj do HTML, ani do gitu. Zostáva iba v GAS Script Properties.
- **IP hash je privacy-safe** — nezachovávame raw IP, iba krátky SHA-256 hash so soľou (8 hex znakov). Stačí na detekciu spamu, neumožňuje deanonymizáciu.
- **Token TTL 1 hodina** — admin sa po hodine musí prihlásiť znova. Pre kratšie sedenia môžeš znížiť `TOKEN_TTL_SECONDS`.
- **Throttling brute force** — `Utilities.sleep(1000)` pri zlom hesle. Pre serióznejšie attack-resistant deployment by bolo treba IP-based rate limiting cez CacheService.
- **Re-deploy pri zmene Code.gs** — Apps Script vyžaduje **New version** pri každej zmene logiky. Nezabudni klik **Manage deployments → ceruzka pri aktívnom deploymente → Version: New version → Deploy**, inak budú zmeny "live" len v editore, nie v API.

---

**Verzia šablóny:** v1 · 22. apríla 2026 · pre Brno deployment
