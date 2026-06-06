/* ============================================================
   REFORMA 3.3 — SteerCo Decision Workshop
   app.js — PIN gate + per-člen hlasovanie cez GAS backend.
   v4: žiadny citlivý obsah v tomto súbore — 47 rozhodnutí,
   sektory a extra slidy prichádzajú z GAS až po overení PINu.
   ============================================================ */
"use strict";

var GAS_URL = (window.WORKSHOP_CONFIG || {}).GAS_URL || "";

var SK_TOKEN = "reforma33_token";
var SK_MEMBER = "reforma33_member";
var LK_VOTES = "reforma33_myvotes_v4";     // lokálny cache vlastných hlasov (per member)
var LK_SIGS  = "reforma33_sigs_v4";

/* runtime obsah (naplní sa po auth) */
var DECISIONS = [], SECTORS = [], MEMBERS = [], META = {}, EXTRA = {};
var ME = null, TOKEN = null;
var RESULTS = { byDecision:{}, finals:{} };

var STATUS_LABEL = {
  closed_default:"CLOSED (default)", closed_alternative:"CLOSED (alternative)",
  conditional:"CONDITIONAL", deferred:"DEFERRED / HOLD",
  not_approved:"NOT APPROVED", disputed:"DISPUTED", open:"OTVORENÉ"
};
var STATUS_CHOICES = ["closed_default","closed_alternative","conditional","deferred","not_approved","disputed","open"];
var TIER = {
  admin:{key:"admin", label:"LEN POTVRDIŤ", sub:"už žije — administratívne potvrdiť"},
  lock:{key:"lock", label:"FORMÁLNY LOCK", sub:"obsah žije — treba formálny lock"},
  vote:{key:"vote", label:"HLASOVANIE", sub:"skutočné rozhodnutie / otvorené"}
};

/* ============================================================ HELPERS */
function esc(s){ return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function tierOf(d){ return TIER[d.tier] || TIER.vote; }
function sectorOf(d){ for (var i=0;i<SECTORS.length;i++){ if (SECTORS[i].key===d.sector) return SECTORS[i]; } return {num:"?",name:d.sector}; }
function decisionById(id){ for (var i=0;i<DECISIONS.length;i++){ if (DECISIONS[i].id===id) return DECISIONS[i]; } return null; }
function recOption(d){ for (var i=0;i<d.options.length;i++){ if (d.options[i].rec) return d.options[i]; } return null; }
function recWording(d){ var r=recOption(d); return r?r.final:(d.options[0]?d.options[0].final:""); }
function el(id){ return document.getElementById(id); }

/* ============================================================ NET */
function api(payload){
  if (!GAS_URL || GAS_URL.indexOf("REPLACE_WITH") === 0){
    return Promise.resolve({ ok:false, error:"no_backend", message:"Backend (GAS_URL) nie je nakonfigurovaný v config.js." });
  }
  return fetch(GAS_URL, {
    method:"POST",
    headers:{ "Content-Type":"text/plain;charset=utf-8" },
    body:JSON.stringify(payload)
  }).then(function(r){ return r.json(); })
    .catch(function(err){ return { ok:false, error:"network", message:String(err) }; });
}

/* ============================================================ LOCAL CACHE (vlastné hlasy) */
function myVotes(){
  try { var raw=localStorage.getItem(LK_VOTES); if(raw){ var o=JSON.parse(raw); return o[ME.key]||{}; } }catch(e){}
  return {};
}
function setMyVote(id, idx, comment){
  var all={}; try{ all=JSON.parse(localStorage.getItem(LK_VOTES)||"{}"); }catch(e){}
  var mine=all[ME.key]||{}; mine[id]={idx:idx, comment:comment}; all[ME.key]=mine;
  try{ localStorage.setItem(LK_VOTES, JSON.stringify(all)); }catch(e){}
}
function myVote(id){ var v=myVotes()[id]; return v?v:null; }

/* ============================================================ AUTH */
function showLogin(msg){
  var box=el("login"); if(!box) return;
  box.style.display="flex";
  el("login-err").textContent=msg||"";
  el("app-root").style.display="none";
  setTimeout(function(){ var i=el("pin-input"); if(i){ i.focus(); } },50);
}
function hideLogin(){ var box=el("login"); if(box) box.style.display="none"; el("app-root").style.display="flex"; }

function doLogin(){
  var pin=(el("pin-input").value||"").trim();
  if(!pin){ el("login-err").textContent="Zadaj PIN."; return; }
  el("login-btn").disabled=true; el("login-err").textContent="Overujem…";
  api({action:"auth", pin:pin}).then(function(res){
    el("login-btn").disabled=false;
    if(!res.ok){ el("login-err").textContent=res.message||"Prihlásenie zlyhalo."; return; }
    TOKEN=res.token; ME=res.member;
    DECISIONS=res.decisions||[]; SECTORS=res.sectors||[]; MEMBERS=res.members||[];
    META=res.meta||{}; EXTRA=res.extra||{};
    try{ sessionStorage.setItem(SK_TOKEN, TOKEN); sessionStorage.setItem(SK_MEMBER, JSON.stringify(ME)); }catch(e){}
    el("pin-input").value="";
    boot();
  });
}
function logout(){
  try{ sessionStorage.removeItem(SK_TOKEN); sessionStorage.removeItem(SK_MEMBER); }catch(e){}
  TOKEN=null; ME=null; DECISIONS=[]; SECTORS=[];
  showLogin("Odhlásené.");
}

/* try restore session: re-auth not possible without PIN, but token may still be valid -> probe with results */
function tryRestore(){
  var t, m;
  try{ t=sessionStorage.getItem(SK_TOKEN); m=JSON.parse(sessionStorage.getItem(SK_MEMBER)||"null"); }catch(e){}
  if(!t||!m){ showLogin(""); return; }
  // we still need content; token alone doesn't return content, so just ask user to re-login
  // (keeps it simple + secure). Show login prefilled hint.
  showLogin("");
}

/* ============================================================ BOOT (po auth) */
function boot(){
  hideLogin();
  renderIdentity();
  buildStage();
  collectSlides();
  buildJump();
  bindVotes();
  bindSignatures();
  showSlide(0);
}

function renderIdentity(){
  var chip=el("identity"); if(!chip) return;
  var veto = ME.veto ? '<span class="veto-badge" title="právo veta">VETO</span>' : '';
  var chair = ME.isChair ? '<span class="chair-badge" title="chair — potvrdzuje finálny status">CHAIR</span>' : '';
  chip.innerHTML = '<span class="who"><b>'+esc(ME.label)+'</b> · '+esc(ME.role)+'</span>'+veto+chair+
                   '<button class="logout" onclick="logout()">Odhlásiť</button>';
}

/* ============================================================ STAGE (všetky slidy z dát) */
function buildStage(){
  var html="";

  /* 1 — TITLE */
  html+='<section class="slide active title-slide" data-title="Title">'+
    '<span class="eyebrow">Osobný workshop · 9. 6. 2026</span>'+
    '<h1>'+esc(META.title||"REFORMA 3.3 — SteerCo Decision Workshop")+'</h1>'+
    '<p class="sub">'+esc(META.subtitle||"")+'</p>'+
    '<p class="lead">'+esc(META.lead||"")+'</p>'+
    '<div class="counter-box">'+
      '<div class="c"><b>'+DECISIONS.length+'</b><span>rozhodnutí</span></div>'+
      '<div class="c"><b>'+SECTORS.length+'</b><span>sektorov</span></div>'+
      '<div class="c"><b>'+countTier_("vote")+'</b><span>hlasovaní</span></div>'+
      '<div class="c"><b>'+(countTier_("lock")+countTier_("admin"))+'</b><span>lock / potvrdiť</span></div>'+
    '</div>'+
    '<div class="footer-line">INTERNÉ · Healthy Future of Slovakia · Future Slovakia Forum</div>'+
  '</section>';

  /* 2 — NÁVOD (generický, nie citlivý) */
  html+='<section class="slide" data-title="Návod">'+
    '<div class="kicker">Návod</div><h1>Ako tento deck používať</h1>'+
    '<div class="grid cols-2">'+
      '<div class="card accent"><h3>Každý rozhodovací slide</h3>'+
        '<ol class="steps"><li>Čo tým meníme</li><li>Čo presne hlasujeme</li><li>Hlasovacie možnosti</li><li>Komentár / podmienka</li><li>Detail + finálny wording</li></ol></div>'+
      '<div class="card flow"><h3>Pravidlá</h3>'+
        '<ul class="rules" style="margin:0;padding-left:18px;line-height:1.7;">'+
        '<li>Každý hlasuje <b>za seba</b> — tvoj hlas sa ukladá pod tvoje meno.</li>'+
        '<li>Pri <b>PODMIENENE</b> zapíš konkrétnu podmienku.</li>'+
        '<li>Pri <b>ODLOŽIŤ</b> zapíš owner, termín a dôvod.</li>'+
        '<li>Finálny status položky potvrdzuje <b>chair</b> na slide Decision Record.</li></ul></div>'+
    '</div>'+
    '<div class="note-box" style="margin-top:14px;">Hlasy sa ukladajú na server (Google Sheet) — vidno ich naprieč zariadeniami. Na slide <b>Decision Record</b> daj <b>„Obnoviť výsledky"</b> pre aktuálnu maticu hlasov.</div>'+
  '</section>';

  /* 3 — AGENDA */
  html+='<section class="slide" data-title="Agenda"><div class="kicker">Prehľad</div>'+
    '<h1>Agenda — rozhodnutia po sektoroch</h1><div id="sector-agenda"></div>'+
    '<div class="legend" style="margin-top:10px;">'+
      '<span><i class="swatch sw-blue"></i> <b>LEN POTVRDIŤ</b></span>'+
      '<span><i class="swatch sw-amber"></i> <b>FORMÁLNY LOCK</b></span>'+
      '<span><i class="swatch sw-red"></i> <b>HLASOVANIE</b></span></div>'+
  '</section>';

  /* 4.. — sektory + rozhodnutia */
  SECTORS.forEach(function(sec){
    var items=DECISIONS.filter(function(d){ return d.sector===sec.key; });
    if(!items.length) return;
    var liste=items.map(function(d){ var t=tierOf(d);
      return '<li><span class="tier '+t.key+'">'+t.label+'</span> <b>'+esc(d.title)+'</b><br><span class="muted">'+esc(d.change)+'</span></li>';
    }).join("");
    html+='<section class="slide sector-divider" data-title="Sektor '+sec.num+'">'+
      '<div class="sec-tag">Sektor '+sec.num+' / '+SECTORS.length+'</div>'+
      '<h1>'+esc(sec.name)+'</h1><p class="sec-blurb">'+esc(sec.blurb)+'</p>'+
      '<ul class="sec-list">'+liste+'</ul></section>';
    items.forEach(function(d){ html+=decisionHTML(d,sec); });
  });

  /* závislosti */
  html+='<section class="slide" data-title="Rozhrania"><div class="kicker">Závislosti</div>'+
    '<h1>Rozhrania, ktoré treba po hlasovaní patchnúť</h1><div class="grid cols-2">'+
    (EXTRA.dependencies||[]).map(function(x,i){
      var span=(i===(EXTRA.dependencies.length-1) && (EXTRA.dependencies.length%2===1))?' style="grid-column:1/-1;"':'';
      return '<div class="card accent"'+span+'><h3>'+esc(x.h)+'</h3><p>'+esc(x.p)+'</p></div>';
    }).join("")+'</div></section>';

  /* closure */
  html+='<section class="slide" data-title="Closure package"><div class="kicker">Návrh</div>'+
    '<h1>Odporúčaný closure package</h1><div class="closure">'+
    (EXTRA.closure||[]).map(function(x){ return '<div class="item"><div><div class="ttl">'+esc(x.ttl)+'</div><div class="txt">'+esc(x.txt)+'</div></div></div>'; }).join("")+
    '</div></section>';

  /* patch plan */
  var pr=(EXTRA.patch&&EXTRA.patch.rows)||[];
  html+='<section class="slide" data-title="Patch plan"><div class="kicker">Po hlasovaní</div>'+
    '<h1>Čo sa musí upraviť po rozhodnutí</h1><table class="tbl">'+
    '<thead><tr><th>Decision</th><th>Document patches</th><th>Owner</th><th>Trigger</th></tr></thead><tbody>'+
    pr.map(function(r){ return '<tr><td>'+esc(r.decision)+'</td><td>'+esc(r.patches)+'</td><td>'+esc(r.owner)+'</td><td>'+esc(r.trigger)+'</td></tr>'; }).join("")+
    '</tbody></table>'+
    (EXTRA.patch&&EXTRA.patch.warn?'<div class="blocker-warn" style="margin-top:16px;background:#fff6e7;border-color:#f0cd8a;border-left-color:var(--warn);color:#6b4a12;"><span class="ic">⚠</span><span>'+esc(EXTRA.patch.warn)+'</span></div>':'')+
  '</section>';

  /* DECISION RECORD */
  html+='<section class="slide" data-title="Decision Record"><div class="kicker">Generované zo hlasov</div>'+
    '<h1>Decision Record — pozície, tally a finál</h1>'+
    '<div class="toolbar" style="margin:0 0 12px;"><button class="btn maya" onclick="refreshResults()">↻ Obnoviť výsledky</button>'+
      '<button class="btn" onclick="exportJSON()">Export JSON</button>'+
      '<button class="btn ghost" onclick="exportCSV()">Export CSV</button>'+
      '<button class="btn ghost" onclick="printRecord()">Print / PDF</button>'+
      '<span id="results-status" class="muted" style="align-self:center;font-size:12px;"></span></div>'+
    '<div id="dr-wrap" style="overflow:auto;"></div>'+
    '<hr class="sep"><h3 style="color:var(--sapphire);margin:0 0 6px;font-size:14px;">Podpisy · 7 členov SteerCo · 9. 6. 2026</h3>'+
    '<div class="sig-grid" id="sig-grid"></div>'+
  '</section>';

  /* ZÁVER + appendix */
  html+='<section class="slide" data-title="Záver"><div class="kicker">Definícia</div><h1>Čo znamená „uzavreté"</h1>'+
    '<div class="grid cols-2"><div class="card accent"><h3>Položka je uzavretá iba ak:</h3>'+
      '<ol class="steps"><li>je zvolená možnosť</li><li>je zaznamenaný owner</li><li>sú zaznamenané podmienky, ak sú</li><li>sú zaznamenané patch targets</li><li>je exportovaný Decision Record</li><li>je poznačené version-coupling</li></ol></div>'+
      '<div class="card flow"><h3>Záverečná správa</h3><p style="line-height:1.55;">Po tomto workshope majú Async Balík 1 a Balík 2 prestať byť backlogom a stať sa SteerCo Decision Recordom. Otvorené zostanú len položky, ktoré SteerCo explicitne odloží s ownerom, termínom a dôvodom.</p></div></div>'+
    '<details class="detail" style="margin-top:16px;"><summary>Appendix — zdrojové dokumenty</summary><div class="dbody appendix"><ul>'+
      (EXTRA.appendix||[]).map(function(x){ return '<li>'+esc(x)+'</li>'; }).join("")+
    '</ul></div></details></section>';

  el("stage").innerHTML=html;
  renderAgenda();
  renderSignatures();
}

function countTier_(t){ var n=0; DECISIONS.forEach(function(d){ if(d.tier===t) n++; }); return n; }

function renderAgenda(){
  var host=el("sector-agenda"); if(!host) return;
  var h='<div class="agenda-grid">';
  SECTORS.forEach(function(sec){
    var items=DECISIONS.filter(function(d){return d.sector===sec.key;});
    var c={admin:0,lock:0,vote:0}; items.forEach(function(d){ c[d.tier]++; });
    var chips="";
    if(c.vote)  chips+='<span class="tier vote">'+c.vote+'× hlas.</span> ';
    if(c.lock)  chips+='<span class="tier lock">'+c.lock+'× lock</span> ';
    if(c.admin) chips+='<span class="tier admin">'+c.admin+'× potvr.</span>';
    h+='<div class="agenda-card"><div class="ag-num">'+sec.num+'</div><div class="ag-body">'+
       '<div class="ag-name">'+esc(sec.name)+' <span class="ag-count">· '+items.length+'</span></div>'+
       '<div class="ag-blurb">'+esc(sec.blurb)+'</div><div class="ag-chips">'+chips+'</div></div></div>';
  });
  h+='</div>'; host.innerHTML=h;
}

function decisionHTML(d,sec){
  var t=tierOf(d);
  var chip='<span class="tier-chip '+t.key+'">'+t.label+' <span class="sub">· '+t.sub+'</span></span>';
  var opts=d.options.map(function(o,i){
    var rec=o.rec?' recommended':''; var tag=o.rec?' <span class="rec-tag">Odporúčané</span>':'';
    return '<label class="opt'+rec+'" data-opt="'+i+'"><input type="radio" name="vote-'+d.id+'" value="'+i+'"><span class="otext">'+esc(o.t)+tag+'</span></label>';
  }).join("");
  var coord=d.coordFlag?'<div class="coord-flag"><b>⚠ Koordinačná poznámka</b> — '+esc(d.coordFlag)+'</div>':'';
  return '<section class="slide" data-title="'+sec.num+'·'+esc(d.title)+'" data-decision="'+d.id+'">'+
    '<div class="dhead"><div class="dnum">'+sec.num+'</div><div class="dtitle">'+
      '<div class="sec-mini">Sektor '+sec.num+' — '+esc(sec.name)+'</div><h2>'+esc(d.title)+'</h2>'+chip+
      '<div class="owner-line">Owner: <b>'+esc(d.owner)+'</b></div></div></div>'+
    '<div class="change-box"><div class="ck">Čo tým meníme</div><div class="ct">'+esc(d.change)+'</div></div>'+coord+
    '<div class="qbox"><div class="qk">Čo presne hlasujeme</div><div class="qt">'+esc(d.question)+'</div></div>'+
    '<div class="vote-block"><div class="vk">Tvoj hlas — <b>'+esc(ME.label)+'</b></div>'+opts+'</div>'+
    '<div class="comment-wrap"><label for="comment-'+d.id+'">Komentár / podmienka (voliteľné)</label>'+
      '<textarea id="comment-'+d.id+'" placeholder="Pri PODMIENENE zapíš podmienku; pri ODLOŽIŤ owner + termín + dôvod."></textarea></div>'+
    '<div class="current-vote" id="current-'+d.id+'"></div>'+
    '<details class="detail"><summary>Detail — odporúčaný / finálny wording · source note</summary><div class="dbody">'+
      '<h4>Odporúčaný wording</h4><div class="wording-box">'+esc(recWording(d)||"—")+'</div>'+
      '<div id="finalprev-'+d.id+'"></div>'+
      '<h4>Source note</h4><p class="muted" style="margin:0;font-size:12px;">'+esc(d.source_note||"—")+'</p>'+
    '</div></details></section>';
}

/* ============================================================ NAV */
var slides=[], current=0;
function collectSlides(){ slides=Array.prototype.slice.call(document.querySelectorAll(".stage .slide")); }
function showSlide(i){
  if(i<0)i=0; if(i>slides.length-1)i=slides.length-1;
  if(slides[current]) slides[current].classList.remove("active");
  current=i; slides[current].classList.add("active");
  el("pcur").textContent=(current+1); el("ptot").textContent=slides.length;
  el("pfill").style.width=((current+1)/slides.length*100)+"%";
  el("prevBtn").disabled=(current===0); el("nextBtn").disabled=(current===slides.length-1);
  el("jump").value=String(current);
  document.querySelector(".stage").scrollTop=0;
  if(slides[current].getAttribute("data-title")==="Decision Record"){ refreshResults(); }
}
function buildJump(){ el("jump").innerHTML=slides.map(function(s,i){ return '<option value="'+i+'">'+(i+1)+'/'+slides.length+' · '+esc(s.getAttribute("data-title")||"")+'</option>'; }).join(""); }

/* ============================================================ VOTING */
var saveTimers={};
function updateCurrentVote(d, savedMsg){
  var box=el("current-"+d.id); if(!box) return;
  var v=myVote(d.id);
  if(v && v.idx!=null && d.options[v.idx]){
    var o=d.options[v.idx];
    box.innerHTML='<b>Tvoj hlas:</b> '+esc(o.t)+' &nbsp;→&nbsp; <span class="st '+o.outcome+'">'+STATUS_LABEL[o.outcome]+'</span>'+
                  (savedMsg?' <span class="saved">'+esc(savedMsg)+'</span>':'');
  } else {
    box.innerHTML='<b>Tvoj hlas:</b> — zatiaľ nehlasované — <span class="st open">'+STATUS_LABEL.open+'</span>';
  }
  var fp=el("finalprev-"+d.id);
  if(fp){ var fw=(v&&d.options[v.idx])?d.options[v.idx].final:""; fp.innerHTML=fw?'<h4>Finálny wording podľa tvojej voľby</h4><div class="wording-box" style="border-left-color:var(--green);background:#eef8f1;">'+esc(fw)+'</div>':''; }
}
function pushVote(d){
  var v=myVote(d.id); if(!v||v.idx==null) return;
  updateCurrentVote(d,"ukladám…");
  api({action:"vote", token:TOKEN, decisionId:d.id, optionIndex:v.idx, comment:v.comment||""}).then(function(res){
    if(res.ok){ updateCurrentVote(d,"uložené ✓"); }
    else if(res.error==="no_session"){ updateCurrentVote(d,"⚠ relácia vypršala"); logout(); }
    else { updateCurrentVote(d,"⚠ "+(res.message||"nepodarilo sa uložiť")); }
  });
}
function bindVotes(){
  DECISIONS.forEach(function(d){
    var saved=myVote(d.id);
    var radios=document.getElementsByName("vote-"+d.id);
    for(var i=0;i<radios.length;i++){
      if(saved && String(saved.idx)===radios[i].value){ radios[i].checked=true; radios[i].closest(".opt").classList.add("chosen"); }
      radios[i].addEventListener("change", function(ev){
        var idx=parseInt(ev.target.value,10);
        var ta=el("comment-"+d.id); var cm=ta?ta.value:"";
        setMyVote(d.id, idx, cm);
        ev.target.closest(".vote-block").querySelectorAll(".opt").forEach(function(l){ l.classList.remove("chosen"); });
        ev.target.closest(".opt").classList.add("chosen");
        pushVote(d);
      });
    }
    var ta=el("comment-"+d.id);
    if(ta){
      if(saved && saved.comment) ta.value=saved.comment;
      ta.addEventListener("input", function(){
        var v=myVote(d.id); var idx=v?v.idx:null;
        if(idx==null) return;                 // komentár sa uloží až keď je zvolená možnosť
        setMyVote(d.id, idx, ta.value);
        clearTimeout(saveTimers[d.id]);
        saveTimers[d.id]=setTimeout(function(){ pushVote(d); }, 800);
      });
    }
    updateCurrentVote(d);
  });
}

/* ============================================================ SIGNATURES (lokálne) */
function renderSignatures(){
  var g=el("sig-grid"); if(!g) return;
  g.innerHTML=MEMBERS.map(function(m){
    return '<div class="sig"><label>'+esc(m.label)+(m.veto?' <span class="mini-veto">veto</span>':'')+'</label>'+
           '<input data-sig="'+esc(m.key)+'" placeholder="podpis / potvrdenie"></div>';
  }).join("");
}
function bindSignatures(){
  var store={}; try{ store=JSON.parse(localStorage.getItem(LK_SIGS)||"{}"); }catch(e){}
  document.querySelectorAll("[data-sig]").forEach(function(inp){
    var k=inp.getAttribute("data-sig"); if(store[k]) inp.value=store[k];
    inp.addEventListener("input", function(){
      store[k]=inp.value; try{ localStorage.setItem(LK_SIGS, JSON.stringify(store)); }catch(e){}
    });
  });
}

/* ============================================================ RESULTS / RECORD */
function tallyOf(did){
  var arr=(RESULTS.byDecision[String(did)])||[];
  var counts={}, vetoDissent=false, leading=-1, leadN=0, tie=false;
  arr.forEach(function(v){ counts[v.optionIndex]=(counts[v.optionIndex]||0)+1; });
  Object.keys(counts).forEach(function(k){ var n=counts[k];
    if(n>leadN){ leadN=n; leading=parseInt(k,10); tie=false; } else if(n===leadN){ tie=true; } });
  // veto dissent: a veto-holder picked something other than the leading option
  arr.forEach(function(v){
    var m=memberMeta_(v.memberKey);
    if(m&&m.veto&&leading>=0&&v.optionIndex!==leading) vetoDissent=true;
  });
  return { arr:arr, counts:counts, leading:leading, tie:tie, vetoDissent:vetoDissent };
}
function memberMeta_(key){ for(var i=0;i<MEMBERS.length;i++){ if(MEMBERS[i].key===key) return MEMBERS[i]; } return null; }
function voteForMember_(did, key){ var arr=(RESULTS.byDecision[String(did)])||[]; for(var i=0;i<arr.length;i++){ if(arr[i].memberKey===key) return arr[i]; } return null; }

function refreshResults(){
  var st=el("results-status"); if(st) st.textContent="načítavam…";
  api({action:"results", token:TOKEN}).then(function(res){
    if(!res.ok){ if(res.error==="no_session"){ logout(); return; } if(st) st.textContent="⚠ "+(res.message||res.error); return; }
    RESULTS={ byDecision:res.byDecision||{}, finals:res.finals||{} };
    buildRecord();
    if(st) st.textContent="aktualizované";
  });
}

function buildRecord(){
  var wrap=el("dr-wrap"); if(!wrap) return;
  var head='<table class="tbl matrix"><thead><tr><th class="cell-num">#</th><th>Rozhodnutie</th>';
  MEMBERS.forEach(function(m){ head+='<th class="mh" title="'+esc(m.label)+'">'+esc(shortName_(m.label))+(m.veto?' ⚖':'')+'</th>'; });
  head+='<th>Tally</th><th>Vedúca / finál</th></tr></thead><tbody>';

  var rows=DECISIONS.map(function(d){
    var sec=sectorOf(d); var tal=tallyOf(d.id);
    var cells=MEMBERS.map(function(m){
      var v=voteForMember_(d.id, m.key);
      if(!v) return '<td class="mc empty">·</td>';
      var lead=(v.optionIndex===tal.leading);
      var cls='mc out-'+v.outcome+(m.veto&&!lead?' veto-dis':'')+(lead?' lead':'');
      return '<td class="'+cls+'" title="'+esc(m.label)+': '+esc(v.optionText)+(v.comment?(' — '+esc(v.comment)):'')+'">'+(v.optionIndex+1)+'</td>';
    }).join("");
    var tallyStr=Object.keys(tal.counts).sort(function(a,b){return tal.counts[b]-tal.counts[a];})
      .map(function(k){ return (parseInt(k,10)+1)+":"+tal.counts[k]; }).join(" ")||"—";
    var fin=RESULTS.finals[String(d.id)];
    var leadTxt = tal.leading>=0 ? (d.options[tal.leading]?d.options[tal.leading].t:"") : "—";
    var finCell;
    if(fin){ finCell='<span class="st '+fin.status+'">'+(STATUS_LABEL[fin.status]||fin.status)+'</span>'; }
    else { finCell='<span class="muted">'+(tal.tie?'<b class="disp">DISPUTED (remíza)</b>':esc(trunc_(leadTxt,46)))+'</span>'; }
    if(tal.vetoDissent) finCell+=' <span class="veto-warn" title="veto-holder nesúhlasí s vedúcou možnosťou">⚖ veto?</span>';
    var chairBtn = ME.isChair ? '<button class="btn tiny" onclick="openFinalize('+d.id+')">✎</button>' : '';
    return '<tr><td class="cell-num">'+d.id+'</td><td class="dt">'+sec.num+'·'+esc(trunc_(d.title,40))+'</td>'+cells+
           '<td class="tally">'+tallyStr+'</td><td class="fin">'+finCell+' '+chairBtn+'</td></tr>'+
           (fin&&fin.wording?'<tr class="finrow"><td></td><td colspan="'+(MEMBERS.length+3)+'"><b>Finál:</b> '+esc(fin.wording)+'</td></tr>':'');
  }).join("");

  wrap.innerHTML=head+rows+'</tbody></table>'+
    '<p class="flow-tip" style="margin-top:8px;">Bunka = poradie zvolenej možnosti (hover = plné znenie). ⚖ = veto-holder. „⚖ veto?" označuje, že držiteľ veta nesúhlasí s vedúcou možnosťou — finál potvrdí chair.</p>';
}

/* chair finalize modal */
function openFinalize(did){
  var d=decisionById(did); if(!d) return;
  var tal=tallyOf(did);
  var existing=RESULTS.finals[String(did)]||{};
  var defStatus=existing.status || (tal.leading>=0 && d.options[tal.leading] ? d.options[tal.leading].outcome : "open");
  var defWording=existing.wording || (tal.leading>=0 && d.options[tal.leading] ? d.options[tal.leading].final : recWording(d));
  var optsHtml=STATUS_CHOICES.map(function(s){ return '<option value="'+s+'"'+(s===defStatus?' selected':'')+'>'+STATUS_LABEL[s]+'</option>'; }).join("");
  var m=el("modal");
  m.innerHTML='<div class="modal-box"><h3>Finál — #'+did+' '+esc(d.title)+'</h3>'+
    '<label class="ml">Status</label><select id="fin-status">'+optsHtml+'</select>'+
    '<label class="ml">Finálny wording</label><textarea id="fin-wording">'+esc(defWording)+'</textarea>'+
    '<div class="modal-actions"><button class="btn ghost" onclick="closeFinalize()">Zrušiť</button>'+
      '<button class="btn maya" onclick="saveFinalize('+did+')">Uložiť finál</button></div>'+
    '<div id="fin-err" class="muted" style="font-size:12px;"></div></div>';
  m.style.display="flex";
}
function closeFinalize(){ var m=el("modal"); if(m){ m.style.display="none"; m.innerHTML=""; } }
function saveFinalize(did){
  var status=el("fin-status").value, wording=el("fin-wording").value;
  el("fin-err").textContent="ukladám…";
  api({action:"finalize", token:TOKEN, decisionId:did, status:status, wording:wording}).then(function(res){
    if(res.ok){ closeFinalize(); refreshResults(); }
    else { el("fin-err").textContent="⚠ "+(res.message||res.error); if(res.error==="no_session") logout(); }
  });
}

/* ============================================================ EXPORT */
function buildExportObject(){
  return { workshop:META.workshop, date:META.date, generated_by:ME?ME.label:"",
    decisions:DECISIONS.map(function(d){
      var sec=sectorOf(d); var tal=tallyOf(d.id); var fin=RESULTS.finals[String(d.id)]||null;
      return { id:d.id, sector:sec.num+" "+sec.name, title:d.title, owner:d.owner,
        readiness_tier:tierOf(d).key, change:d.change,
        positions:MEMBERS.map(function(m){ var v=voteForMember_(d.id,m.key);
          return { member:m.label, key:m.key, veto:!!m.veto, option:v?v.optionText:"", option_index:v?v.optionIndex:null, outcome:v?v.outcome:"", comment:v?v.comment:"" }; }),
        tally:tal.counts, leading_option:tal.leading>=0&&d.options[tal.leading]?d.options[tal.leading].t:"",
        veto_dissent:tal.vetoDissent, disputed:tal.tie,
        final_status:fin?fin.status:"", final_wording:fin?fin.wording:"", finalized_by:fin?fin.by:"",
        source_note:d.source_note||"" };
    })};
}
function dl_(fn,txt,type){ var b=new Blob([txt],{type:type||"text/plain;charset=utf-8"}); var u=URL.createObjectURL(b);
  var a=document.createElement("a"); a.href=u; a.download=fn; document.body.appendChild(a); a.click();
  setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(u); },100); }
function exportJSON(){ dl_("reforma33_decision_record_2026-06-09.json", JSON.stringify(buildExportObject(),null,2), "application/json;charset=utf-8"); }
function csvCell(s){ s=String(s==null?"":s); return '"'+s.replace(/"/g,'""')+'"'; }
function exportCSV(){
  var rows=[["id","sector","title","owner","tier","member","veto","option","outcome","comment","leading","final_status","final_wording"]];
  DECISIONS.forEach(function(d){ var sec=sectorOf(d); var tal=tallyOf(d.id); var fin=RESULTS.finals[String(d.id)]||{};
    var lead=tal.leading>=0&&d.options[tal.leading]?d.options[tal.leading].t:"";
    MEMBERS.forEach(function(m){ var v=voteForMember_(d.id,m.key);
      rows.push([d.id, sec.num+" "+sec.name, d.title, d.owner, tierOf(d).key, m.label, m.veto?"veto":"",
        v?v.optionText:"", v?v.outcome:"", v?v.comment:"", lead, fin.status||"", fin.wording||""]);
    });
  });
  dl_("reforma33_decision_record_2026-06-09.csv", "﻿"+rows.map(function(r){return r.map(csvCell).join(",");}).join("\r\n"), "text/csv;charset=utf-8");
}
function printRecord(){
  var o=buildExportObject();
  var rows=o.decisions.map(function(d){
    var pos=d.positions.map(function(p){ return esc(shortName_(p.member))+":"+(p.option_index!=null?(p.option_index+1):"–"); }).join(" ");
    var st=d.final_status?(STATUS_LABEL[d.final_status]||d.final_status):(d.disputed?"DISPUTED":"—");
    return '<tr><td>'+d.id+'</td><td>'+esc(d.sector)+'</td><td>'+esc(d.title)+'</td><td>'+pos+'</td><td>'+esc(d.leading_option)+'</td><td>'+esc(d.final_wording||"—")+'</td><td>'+esc(st)+(d.veto_dissent?" ⚖":"")+'</td></tr>';
  }).join("");
  el("print-area").innerHTML='<h1>REFORMA 3.3 — SteerCo Decision Record</h1><div>'+esc(o.workshop)+' · 9. 6. 2026 · INTERNÉ · export: '+esc(o.generated_by)+'</div>'+
    '<table><thead><tr><th>#</th><th>Sektor</th><th>Decision</th><th>Pozície (poradie možnosti)</th><th>Vedúca</th><th>Finálny wording</th><th>Status</th></tr></thead><tbody>'+rows+'</tbody></table>';
  window.print();
}

/* ============================================================ UTIL */
function shortName_(label){ var p=String(label).replace(/^(Prof\.|MUDr\.|Mgr\.|Ing\.|Dr\.)\s*/,"").split(" "); return p[p.length-1]; }
function trunc_(s,n){ s=String(s||""); return s.length>n?s.slice(0,n-1)+"…":s; }

/* ============================================================ INIT */
function init(){
  el("prevBtn").addEventListener("click", function(){ showSlide(current-1); });
  el("nextBtn").addEventListener("click", function(){ showSlide(current+1); });
  el("jump").addEventListener("change", function(e){ showSlide(parseInt(e.target.value,10)); });
  el("login-btn").addEventListener("click", doLogin);
  el("pin-input").addEventListener("keydown", function(e){ if(e.key==="Enter") doLogin(); });
  document.addEventListener("keydown", function(e){
    if(!ME) return;
    var t=(e.target.tagName||"").toLowerCase(); if(t==="textarea"||t==="input"||t==="select") return;
    if(e.key==="ArrowRight"||e.key==="PageDown"){ e.preventDefault(); showSlide(current+1); }
    else if(e.key==="ArrowLeft"||e.key==="PageUp"){ e.preventDefault(); showSlide(current-1); }
    else if(e.key==="Home"){ e.preventDefault(); showSlide(0); }
    else if(e.key==="End"){ e.preventDefault(); showSlide(slides.length-1); }
  });
  tryRestore();
}
window.logout=logout; window.refreshResults=refreshResults;
window.exportJSON=exportJSON; window.exportCSV=exportCSV; window.printRecord=printRecord;
window.openFinalize=openFinalize; window.closeFinalize=closeFinalize; window.saveFinalize=saveFinalize;
document.addEventListener("DOMContentLoaded", init);
