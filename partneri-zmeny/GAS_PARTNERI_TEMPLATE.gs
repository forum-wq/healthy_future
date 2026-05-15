// ═══════════════════════════════════════════════════════════════════
//  FSF Partneri zmeny — Google Apps Script backend (Code.gs)
//
//  Endpoints:
//    GET  ?action=count   → public total count (lightweight)
//    GET  ?action=stats   → public aggregated stats (dashboard)
//    POST {meno, priezvisko, email, typ_partnerstva, gdpr, ...}
//                         → submit partnership interest
//
//  Required Script Properties (Apps Script → Project Settings → Script Properties):
//    SHEET_ID           — ID of the Google Sheet (string from sheet URL)
//    INTERNAL_EMAILS    — comma-separated recipients for internal notification
//                         e.g. "david.boruta@future-slovakia.eu,forum@future-slovakia.eu"
//    SHOW_PUBLIC_MONEY  — "true" / "false" — if "true", stats endpoint returns
//                         confirmedTotal/confirmedCount aggregated from the
//                         amount_confirmed column (donor identities never leak).
//
//  Sheet schema (one tab named "Partneri", header on row 1):
//
//    A: timestamp
//    B: meno
//    C: priezvisko
//    D: email
//    E: mobil
//    F: organizacia
//    G: mesto_krajina
//    H: typ_partnerstva
//    I: forma_podpory
//    J: financne_pasmo
//    K: oblast_podpory          ← legacy / interná taxonómia, ukladá sa ak ju FE pošle
//    L: support_items           ← multi-value, separator " | "
//    M: preferred_vertical
//    N: wants_call              ← "Áno" / ""
//    O: public_note_allowed     ← "Áno" / ""
//    P: sprava
//    Q: gdpr                    ← "Áno" / ""
//    R: user_agent
//    S: status                  ← workflow: new / contacted / partner / declined
//    T: amount_confirmed        ← interné, € number alebo prázdne
//    U: notes_internal          ← interné poznámky core tímu
//
//  ⚠️  Bezpečnosť: Google Sheet NESMIE byť verejne zdieľaný. Sheet obsahuje
//  osobné údaje. Verejný dashboard pristupuje výlučne cez GAS endpoint,
//  ktorý vracia iba agregované štatistiky — žiadne mená, e-maily, sumy.
// ═══════════════════════════════════════════════════════════════════

const SHEET_NAME = 'Partneri';
const MAX_OBLAST = 4;
const MAX_SUPPORT_ITEMS = 4;

// ── Helpers ────────────────────────────────────────────────────────
function props_() {
  return PropertiesService.getScriptProperties();
}

function getSheet_() {
  const sheetId = props_().getProperty('SHEET_ID');
  if (!sheetId) throw new Error('Missing Script Property: SHEET_ID');
  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Missing sheet tab: ' + SHEET_NAME);
  return sh;
}

function readAllRows_() {
  const sh = getSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { headers: [], rows: [] };
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const rows = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return { headers: headers, rows: rows };
}

function rowsAsObjects_() {
  const data = readAllRows_();
  return data.rows.map(function(r) {
    const o = {};
    data.headers.forEach(function(h, i) { o[String(h).trim()] = r[i]; });
    return o;
  });
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Clean / safe helpers ──────────────────────────────────────────
// clean_:     trim only — for comparisons, emails, internal logic.
//             Does NOT mutate characters.
// safeSheet_: prepends a leading apostrophe when the value starts with a
//             Sheets-formula trigger (=, +, -, @). The apostrophe forces
//             Sheets to treat the cell as text, but preserves the visible
//             value (the apostrophe is hidden in the UI).
// safePhone_: same protection, but specifically preserves a leading "+"
//             (e.g. "+421 ...") which the old strip-based sanitizer used to
//             destroy.
function clean_(s) {
  return String(s == null ? '' : s).trim();
}

function safeSheet_(s) {
  const raw = clean_(s);
  if (!raw) return '';
  return /^[=+\-@]/.test(raw) ? "'" + raw : raw;
}

function safePhone_(s) {
  const raw = clean_(s);
  if (!raw) return '';
  // Preserve "+421..." in display: stored as text via leading apostrophe,
  // which Sheets hides but keeps the visible "+" intact.
  return raw.charAt(0) === '+' ? "'" + raw : safeSheet_(raw);
}

function isValidEmail_(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean_(s));
}

function bool_(v) {
  return v === true || v === 'true' || v === 'Áno' || v === 'ano' || v === 'yes' || v === 1 || v === '1';
}

// Statuses excluded from the public aggregated dashboard.
// `new`, `contacted`, `partner` remain visible. `declined` is also excluded
// so closed-but-recorded leads do not skew live partnership-interest stats.
const EXCLUDED_STATUSES = ['test', 'deleted', 'spam', 'declined'];

function isPublicRow_(r) {
  const s = clean_(r.status).toLowerCase();
  if (!s) return true; // legacy / blank status counts as visible
  return EXCLUDED_STATUSES.indexOf(s) === -1;
}

// ── GET handler ────────────────────────────────────────────────────
function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = params.action;

  if (action === 'count') {
    return jsonResponse_({ ok: true, count: countPublic_() });
  }

  if (action === 'stats') {
    return jsonResponse_(buildStats_());
  }

  return jsonResponse_({ ok: false, error: 'forbidden' });
}

// Public-facing count: matches what buildStats_() exposes as `total`.
// Same isPublicRow_ filter, so `?action=count` and `?action=stats.total` agree.
function countPublic_() {
  return rowsAsObjects_().filter(isPublicRow_).length;
}

function buildStats_() {
  // Exclude rows flagged as test/deleted/spam/declined from public aggregates.
  // Internal sheet still keeps those rows; they just don't reach the dashboard.
  const regs = rowsAsObjects_().filter(isPublicRow_);
  const total = regs.length;

  const partnerTypes = {};
  const supportForms = {};
  const amountBands = {};
  const interests = {};
  const verticals = {};
  const countries = {};
  let wantsCallCount = 0;
  let confirmedTotal = 0;
  let confirmedCount = 0;

  regs.forEach(function(r){
    const t = clean_(r.typ_partnerstva).toLowerCase();
    if (t) partnerTypes[t] = (partnerTypes[t] || 0) + 1;

    const f = clean_(r.forma_podpory).toLowerCase();
    if (f) supportForms[f] = (supportForms[f] || 0) + 1;

    const a = clean_(r.financne_pasmo).toLowerCase();
    if (a) amountBands[a] = (amountBands[a] || 0) + 1;

    // support_items: stored as "a | b | c"
    const si = clean_(r.support_items);
    if (si) {
      si.split('|').forEach(function(k){
        const key = clean_(k).toLowerCase();
        if (key) interests[key] = (interests[key] || 0) + 1;
      });
    }

    // oblast_podpory (legacy/interná taxonómia) — ak je k dispozícii, mergni
    const op = clean_(r.oblast_podpory);
    if (op) {
      op.split('|').forEach(function(k){
        const key = clean_(k).toLowerCase();
        if (key) interests[key] = (interests[key] || 0) + 1;
      });
    }

    const v = clean_(r.preferred_vertical).toLowerCase();
    if (v) verticals[v] = (verticals[v] || 0) + 1;

    const c = clean_(r.mesto_krajina);
    if (c) countries[c] = (countries[c] || 0) + 1;

    if (bool_(r.wants_call)) wantsCallCount++;

    const amt = Number(r.amount_confirmed);
    if (!isNaN(amt) && amt > 0) {
      confirmedTotal += amt;
      confirmedCount++;
    }
  });

  // Sort countries to top 10
  const countriesArr = Object.keys(countries)
    .map(function(k){ return { name: k, count: countries[k] }; })
    .sort(function(a, b){ return b.count - a.count; })
    .slice(0, 10);

  const showMoney = String(props_().getProperty('SHOW_PUBLIC_MONEY') || '').toLowerCase() === 'true';

  const out = {
    ok: true,
    total: total,
    updated: new Date().toISOString(),
    partnerTypes: partnerTypes,
    supportForms: supportForms,
    amountBands: amountBands,
    interests: interests,
    verticals: verticals,
    countries: countriesArr,
    wantsCallCount: wantsCallCount,
    confirmedTotal: showMoney ? confirmedTotal : null,
    confirmedCount: showMoney ? confirmedCount : null
  };

  return out;
}

// ── POST handler ───────────────────────────────────────────────────
function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ ok: false, error: 'invalid_json' });
  }

  // ── Required fields ────────────────────────────────────────────
  if (!clean_(payload.meno)) {
    return jsonResponse_({ ok: false, error: 'missing_field', field: 'meno' });
  }
  if (!clean_(payload.priezvisko)) {
    return jsonResponse_({ ok: false, error: 'missing_field', field: 'priezvisko' });
  }
  if (!isValidEmail_(payload.email)) {
    return jsonResponse_({ ok: false, error: 'invalid_email' });
  }
  if (!clean_(payload.typ_partnerstva)) {
    return jsonResponse_({ ok: false, error: 'missing_field', field: 'typ_partnerstva' });
  }
  if (!bool_(payload.gdpr)) {
    return jsonResponse_({ ok: false, error: 'gdpr_required' });
  }

  // ── Duplicate guard ────────────────────────────────────────────
  // clean_ (trim only) for both sides — never mutate the email value when
  // comparing or storing it. An email like "a+tag@x.com" must survive intact.
  const emailLower = clean_(payload.email).toLowerCase();
  const existing = rowsAsObjects_();
  const dup = existing.some(function(r){
    return clean_(r.email).toLowerCase() === emailLower;
  });
  if (dup) {
    return jsonResponse_({ ok: false, error: 'already_registered' });
  }

  // ── Normalize multi-value fields ───────────────────────────────
  // Server-side cap matches client (max 4). Slugs are lowercased.
  function joinArr(arr, max){
    if (!Array.isArray(arr)) {
      if (typeof arr === 'string') arr = arr.split(/[,|]/);
      else return '';
    }
    return arr
      .slice(0, max)
      .map(function(s){ return clean_(s).toLowerCase(); })
      .filter(function(s){ return !!s; })
      .join(' | ');
  }

  const supportItems = joinArr(payload.support_items, MAX_SUPPORT_ITEMS);
  const oblastPodpory = joinArr(payload.oblast_podpory, MAX_OBLAST);

  // ── Build row in header order ──────────────────────────────────
  // Free-text fields use safeSheet_ (formula-injection guard via leading
  // apostrophe). Phone uses safePhone_ to preserve "+421...". E-mail is
  // already validated by isValidEmail_, but we still pass through safeSheet_
  // in case of an exotic local-part that begins with @/+/=/- (rare but
  // permitted by the @-check above).
  const sh = getSheet_();
  const ua = clean_(payload.user_agent).slice(0, 200);

  const row = [
    new Date(),                                        // A timestamp
    safeSheet_(payload.meno),                          // B meno
    safeSheet_(payload.priezvisko),                    // C priezvisko
    safeSheet_(payload.email),                         // D email
    safePhone_(payload.mobil),                         // E mobil — preserves +
    safeSheet_(payload.organizacia),                   // F organizacia
    safeSheet_(payload.mesto_krajina),                 // G mesto_krajina
    clean_(payload.typ_partnerstva).toLowerCase(),     // H typ_partnerstva (slug)
    clean_(payload.forma_podpory).toLowerCase(),       // I forma_podpory (slug)
    clean_(payload.financne_pasmo).toLowerCase(),      // J financne_pasmo (slug)
    oblastPodpory,                                     // K oblast_podpory
    supportItems,                                      // L support_items
    clean_(payload.preferred_vertical).toLowerCase(),  // M preferred_vertical (slug)
    bool_(payload.wants_call) ? 'Áno' : '',            // N wants_call
    bool_(payload.public_note_allowed) ? 'Áno' : '',   // O public_note_allowed
    safeSheet_(payload.sprava),                        // P sprava
    bool_(payload.gdpr) ? 'Áno' : '',                  // Q gdpr
    safeSheet_(ua),                                    // R user_agent
    'new',                                              // S status (workflow)
    '',                                                 // T amount_confirmed (interne)
    ''                                                  // U notes_internal (interne)
  ];

  sh.appendRow(row);

  // ── Notifications ──────────────────────────────────────────────
  try {
    sendSubmitterConfirmation_(payload);
  } catch (err) {
    // Email failures must not block successful storage
    Logger.log('Submitter email failed: ' + err);
  }
  try {
    sendInternalNotification_(payload);
  } catch (err) {
    Logger.log('Internal email failed: ' + err);
  }

  return jsonResponse_({ ok: true });
}

// ── Email: submitter confirmation ─────────────────────────────────
function sendSubmitterConfirmation_(payload) {
  const to = clean_(payload.email);
  if (!to) return;

  const subject = 'Ďakujeme za záujem o partnerstvo s Future Slovakia Forum';
  const body =
    'Dobrý deň,\n\n'
    + 'ďakujeme za váš záujem stať sa partnerom Future Slovakia Forum.\n\n'
    + 'Vašu správu sme prijali. Ozveme sa vám osobne, aby sme dohodli vhodnú formu spolupráce.\n\n'
    + 'Fakty a činy. Reformy pre Slovensko.\n\n'
    + 'Dávid Bořuta\n'
    + 'Future Slovakia Forum\n'
    + 'www.future-slovakia.eu';

  MailApp.sendEmail({
    to: to,
    subject: subject,
    body: body,
    name: 'Future Slovakia Forum',
    replyTo: 'david.boruta@future-slovakia.eu',
    noReply: false
  });
}

// ── Email: internal notification ─────────────────────────────────
function sendInternalNotification_(payload) {
  const recipientsRaw = props_().getProperty('INTERNAL_EMAILS') || '';
  const recipients = recipientsRaw.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
  if (!recipients.length) {
    Logger.log('No INTERNAL_EMAILS configured — skipping internal notification.');
    return;
  }

  function row(label, val){
    const v = String(val == null || val === '' ? '—' : val);
    return label + ': ' + v;
  }

  // Plain-text email body: clean_ (trim only). Emails don't render formulas,
  // so we don't need the apostrophe guard here — values render as typed.
  const body =
    'Nový záujem o partnerstvo FSF\n'
    + '────────────────────────────\n\n'
    + row('Meno', clean_(payload.meno) + ' ' + clean_(payload.priezvisko)) + '\n'
    + row('E-mail', clean_(payload.email)) + '\n'
    + row('Mobil', clean_(payload.mobil)) + '\n'
    + row('Organizácia', clean_(payload.organizacia)) + '\n'
    + row('Mesto / krajina', clean_(payload.mesto_krajina)) + '\n\n'
    + row('Typ partnerstva', clean_(payload.typ_partnerstva)) + '\n'
    + row('Forma podpory', clean_(payload.forma_podpory)) + '\n'
    + row('Finančné pásmo', clean_(payload.financne_pasmo)) + '\n'
    + row('Preferovaná vertikála', clean_(payload.preferred_vertical)) + '\n'
    + row('Support items', Array.isArray(payload.support_items) ? payload.support_items.join(', ') : payload.support_items) + '\n'
    + row('Oblasti podpory', Array.isArray(payload.oblast_podpory) ? payload.oblast_podpory.join(', ') : payload.oblast_podpory) + '\n\n'
    + row('Chce úvodný rozhovor', bool_(payload.wants_call) ? 'Áno' : 'Nie') + '\n'
    + row('Anonymizované použitie OK', bool_(payload.public_note_allowed) ? 'Áno' : 'Nie') + '\n'
    + row('GDPR súhlas', bool_(payload.gdpr) ? 'Áno' : 'Nie') + '\n\n'
    + 'Krátka správa:\n'
    + (clean_(payload.sprava) || '—') + '\n\n'
    + '────────────────────────────\n'
    + row('User-agent', clean_(payload.user_agent)) + '\n'
    + 'Čas odoslania: ' + new Date().toString() + '\n';

  MailApp.sendEmail({
    to: recipients.join(','),
    subject: 'Nový záujem o partnerstvo FSF',
    body: body,
    name: 'FSF Partneri — notifikácia',
    noReply: false
  });
}
