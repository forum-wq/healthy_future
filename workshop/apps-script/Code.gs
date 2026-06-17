/* ============================================================
   REFORMA 3.3 — SteerCo Decision Workshop
   Code.gs — backend logika (Google Apps Script Web App).
   Pár s Content.gs (citlivý obsah, gitignored).

   Deploy: Deploy → New deployment → Web app →
           Execute as "Me", Access "Anyone".
   Script Properties (Project Settings → Script Properties):
     SHEET_ID  = id Google Sheetu pre hlasy
     PINS      = {"123456":"Babela", ...}   (PIN → memberKey)
     CHAIR_KEY = Boruta

   Endpointy (POST JSON, Content-Type: text/plain):
     {action:"auth",     pin}
     {action:"vote",     token, decisionId, optionIndex, comment}
     {action:"results",  token}
     {action:"finalize", token, decisionId, status, wording}   // len chair
   ============================================================ */
"use strict";

var ROUND_ID     = "2026-06-17-final25";   // nový round — staré hlasy (round 2026-06-09) ostávajú v "Votes"/"Finals"
var VOTES_SHEET  = "Votes_final25";
var FINALS_SHEET = "Finals_final25";
var TOKEN_TTL    = 21600;   // 6 h (CacheService max)
var VOTES_HEADERS  = ["timestamp","memberKey","memberLabel","decisionId","optionIndex","optionText","outcome","comment","roundId"];
var FINALS_HEADERS = ["timestamp","decisionId","status","wording","chairKey","roundId"];

/* ---------------- routing ---------------- */
function doPost(e){
  var payload;
  try { payload = JSON.parse(e.postData.contents); }
  catch (err){ return json_({ ok:false, error:"invalid_json" }); }
  return route_(payload);
}
function doGet(e){
  var p = (e && e.parameter) || {};
  if (p.action === "results") return route_({ action:"results", token:p.token });
  return json_({ ok:true, service:"reforma33-workshop" });
}
function route_(p){
  try {
    switch (p && p.action){
      case "auth":     return handleAuth_(p);
      case "vote":     return handleVote_(p);
      case "results":  return handleResults_(p);
      case "finalize": return handleFinalize_(p);
      default:         return json_({ ok:false, error:"unknown_action" });
    }
  } catch (err){
    return json_({ ok:false, error:"server_error", detail:String(err) });
  }
}

/* ---------------- auth ---------------- */
function handleAuth_(p){
  // crude global brute-force throttle
  var cache = CacheService.getScriptCache();
  var fails = parseInt(cache.get("authfails") || "0", 10);
  if (fails > 60) return json_({ ok:false, error:"locked", message:"Príliš veľa pokusov. Skús o chvíľu." });

  var pin = String(p.pin || "").trim();
  var pins = pinMap_();
  var key  = pins[pin];
  if (!key){
    cache.put("authfails", String(fails + 1), 600);
    return json_({ ok:false, error:"bad_pin", message:"Nesprávny PIN." });
  }

  var member = memberByKey_(key);
  if (!member) return json_({ ok:false, error:"unknown_member" });
  member.isChair = (key === chairKey_());

  var token = Utilities.getUuid();
  cache.put("tok_" + token, key, TOKEN_TTL);

  var content = getContent_();  // from Content.gs
  return json_({
    ok:true, token:token, member:member,
    meta:content.meta, members:content.members,
    sectors:content.sectors, decisions:content.decisions, extra:content.extra
  });
}

/* ---------------- vote (upsert by member+decision) ---------------- */
function handleVote_(p){
  var key = memberFromToken_(p.token);
  if (!key) return json_({ ok:false, error:"no_session", message:"Relácia vypršala. Prihlás sa znova." });

  var did = String(p.decisionId || "");   // decisionId je teraz kód (napr. "T10")
  var oi  = parseInt(p.optionIndex, 10);
  var d   = decisionById_(did);
  if (!d) return json_({ ok:false, error:"bad_decision" });
  if (isNaN(oi) || oi < 0 || oi >= d.options.length) return json_({ ok:false, error:"bad_option" });

  var opt    = d.options[oi];
  var member = memberByKey_(key);
  var lock   = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = getSheet_(VOTES_SHEET, VOTES_HEADERS);
    var values = sh.getDataRange().getValues();
    var rowIndex = -1;
    for (var r = 1; r < values.length; r++){
      if (String(values[r][1]) === key && String(values[r][3]) === String(did)){ rowIndex = r + 1; break; }
    }
    var row = [ new Date(), key, member ? member.label : key, did, oi,
                safe_(opt.t), opt.outcome, safe_(String(p.comment || "")), ROUND_ID ];
    if (rowIndex > 0){ sh.getRange(rowIndex, 1, 1, row.length).setValues([row]); }
    else { sh.appendRow(row); }
  } finally { lock.releaseLock(); }
  return json_({ ok:true });
}

/* ---------------- results (tally + per-member + finals) ---------------- */
function handleResults_(p){
  var key = memberFromToken_(p.token);
  if (!key) return json_({ ok:false, error:"no_session" });

  var votesSh  = getSheet_(VOTES_SHEET, VOTES_HEADERS);
  var finalsSh = getSheet_(FINALS_SHEET, FINALS_HEADERS);
  var vv = votesSh.getDataRange().getValues();
  var fv = finalsSh.getDataRange().getValues();

  var byDecision = {};   // did -> [ {memberKey, optionIndex, optionText, outcome, comment} ]
  for (var r = 1; r < vv.length; r++){
    var did = String(vv[r][3]); if (!did) continue;
    (byDecision[did] = byDecision[did] || []).push({
      memberKey: String(vv[r][1]), label: String(vv[r][2]),
      optionIndex: parseInt(vv[r][4], 10), optionText: String(vv[r][5]),
      outcome: String(vv[r][6]), comment: String(vv[r][7] || "")
    });
  }
  var finals = {};
  for (var f = 1; f < fv.length; f++){
    var fd = String(fv[f][1]); if (!fd) continue;
    finals[fd] = { status:String(fv[f][2]), wording:String(fv[f][3]),
                   by:String(fv[f][4]), at:fv[f][0] };
  }
  return json_({ ok:true, byDecision:byDecision, finals:finals });
}

/* ---------------- finalize (chair only) ---------------- */
function handleFinalize_(p){
  var key = memberFromToken_(p.token);
  if (!key) return json_({ ok:false, error:"no_session" });
  if (key !== chairKey_()) return json_({ ok:false, error:"not_chair", message:"Finálny status môže nastaviť len chair." });

  var did = String(p.decisionId || "");   // decisionId je teraz kód (napr. "T10")
  if (!decisionById_(did)) return json_({ ok:false, error:"bad_decision" });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = getSheet_(FINALS_SHEET, FINALS_HEADERS);
    var values = sh.getDataRange().getValues();
    var rowIndex = -1;
    for (var r = 1; r < values.length; r++){
      if (String(values[r][1]) === String(did)){ rowIndex = r + 1; break; }
    }
    var row = [ new Date(), did, safe_(String(p.status || "")), safe_(String(p.wording || "")), key, ROUND_ID ];
    if (rowIndex > 0){ sh.getRange(rowIndex, 1, 1, row.length).setValues([row]); }
    else { sh.appendRow(row); }
  } finally { lock.releaseLock(); }
  return json_({ ok:true });
}

/* ---------------- helpers ---------------- */
function props_(){ return PropertiesService.getScriptProperties(); }
function chairKey_(){ return props_().getProperty("CHAIR_KEY") || "Boruta"; }
function pinMap_(){
  var raw = props_().getProperty("PINS");
  if (!raw) throw new Error("Chýba Script Property: PINS");
  return JSON.parse(raw);
}
function memberFromToken_(token){
  if (!token) return null;
  return CacheService.getScriptCache().get("tok_" + String(token));
}
function memberByKey_(key){
  var ms = getContent_().members;
  for (var i = 0; i < ms.length; i++){ if (ms[i].key === key){
    return { key:ms[i].key, label:ms[i].label, role:ms[i].role, veto:!!ms[i].veto, isChair:!!ms[i].isChair };
  }}
  return null;
}
function decisionById_(id){
  var ds = getContent_().decisions;
  for (var i = 0; i < ds.length; i++){ if (String(ds[i].id) === String(id)) return ds[i]; }
  return null;
}
function getSheet_(name, headers){
  var id = props_().getProperty("SHEET_ID");
  if (!id) throw new Error("Chýba Script Property: SHEET_ID");
  var ss = SpreadsheetApp.openById(id);
  var sh = ss.getSheetByName(name);
  if (!sh){ sh = ss.insertSheet(name); sh.appendRow(headers); }
  else if (sh.getLastRow() === 0){ sh.appendRow(headers); }
  return sh;
}
function safe_(v){
  v = String(v == null ? "" : v);
  return /^[=\+\-@]/.test(v) ? "'" + v : v;   // formula-injection guard
}
function json_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
