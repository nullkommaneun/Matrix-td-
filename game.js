/* ============================================================================
   RESET — Spielengine & UI (game.js)  v0.12.3
   ---------------------------------------------------------------------------
   Neu:
   - Top-3-Auswahl (XP-first) mit Sicherheitsnetzen + Diversity
   - Nach Klick werden NEUE 3 Karten gezeigt (Hand-Lock-Mechanik)
   - Debug-Breakdown pro Karte (sichtbar mit ?debug=1)
   - Kein Tags-Output im UI
   Abhängigkeiten: boot.js (optional), cards.js (liefert window.RESET_CARDS.cards)
   ============================================================================ */

/* ========== RNG =========================================================== */
function xmur3(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=(h<<13)|(h>>>19);}return function(){h=Math.imul(h^(h>>>16),2246822507);h=Math.imul(h^(h>>>13),3266489909);h^=h>>>16;return h>>>0;};}
function sfc32(a,b,c,d){return function(){a>>>=0;b>>>=0;c>>>=0;d>>>=0;let t=(a+b)|0;a=b^(b>>>9);b=(c+(c<<3))|0;c=(c<<21)|(c>>>11);d=(d+1)|0;t=(t+d)|0;c=(c+t)|0;return (t>>>0)/4294967296;};}
const makeRngFromSeed=(seed)=>{const s=xmur3(seed);return sfc32(s(),s(),s(),s());};
const d10=(rng)=>1+Math.floor(rng()*10);

/* ========== Enums ========================================================= */
const Stat = { Selbstbild:"Selbstbild", Regulation:"Regulation", Klarheit:"Klarheit", Grenzen:"Grenzen", Zuversicht:"Zuversicht" };
const Perk = { Networker:"Networker", Workhorse:"Workhorse", Analytical:"Analytical", Stoic:"Stoic", Creative:"Creative", LuckyBreak:"LuckyBreak" };
const Path = { Aufarbeitung:"Aufarbeitung" };

/* ========== Helpers ======================================================= */
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const signStr=(n)=>(n>=0?`+${n}`:`${n}`);
const el=(id)=>document.getElementById(id);
const on=(t,ev,h)=>t&&t.addEventListener(ev,(window.CH?CH.safeWrap(h,t,`${ev}#${t.id||t.tagName}`):h));
const setHTML=(n,html)=>{ n.innerHTML=html; };

/* ========== Perk/Luck & Prob ============================================= */
function perkStatBonus(perks, def){
  let b=0;
  if(perks.has(Perk.Analytical) && def.tags.includes("reflect")) b+=2;
  if(perks.has(Perk.Networker)  && def.tags.includes("networking")) b+=2;
  return b;
}
function luckShift(zuversicht, perks){
  const base = Math.min(2, Math.floor(zuversicht/5)); // 0..2
  const lucky = (perks.has(Perk.LuckyBreak) && zuversicht <= 8) ? 1 : 0;
  return base + lucky;
}
function successProbability(state, def, dc){
  const baseStat = state.stats[def.stat];
  const statBonus = perkStatBonus(state.perks, def);
  const ls = luckShift(state.stats.Zuversicht, state.perks);
  let successes=0;
  for(let r=1;r<=10;r++){ const total = baseStat + statBonus + r + ls; if(total >= dc) successes++; }
  return successes*10; // %
}

/* ========== Karten-Import (aus cards.js) ================================== */
function actionsFromCards(payload){
  const raw=(payload&&payload.cards)?payload.cards:[];
  const mapStat=(s)=>{ if(Stat[s])return Stat[s]; const k=Object.keys(Stat).find(k=>k.toLowerCase()===String(s).toLowerCase()); return k?Stat[k]:Stat.Klarheit; };
  return raw.map(c=>{
    const ex = Array.isArray(c.examples)?c.examples.filter(Boolean):[];
    return {
      id:c.id, name:c.title,
      desc:ex.length?`• ${ex[0]}\n• ${ex[1]||''}`.trim():'',
      baseDC:Number.isFinite(c.dc)?c.dc:7,
      stat:mapStat(c.stat),
      energyCost:-(c.delta?.E||0),   // Kosten positiv, Rückgewinn negativ → invertieren
      stressDelta:(c.delta?.S||0),
      moneyDelta:(c.delta?.H||0),
      xpGain:Number.isFinite(c.xp)?c.xp:0,
      tags:[...(c.tags||[]),`theme:${c.theme}`,c.positive?'positive':'negative'],
      cooldown:0, pathRestriction:null, prereq:()=>true, onSuccess:()=>{}, onFailure:()=>{}
    };
  });
}
function validateCards(actions){
  const ids=new Set();
  for(const a of actions){
    if(!a.id||ids.has(a.id)) throw new Error(`Duplikat/leer: id=${a.id}`); ids.add(a.id);
    if(!Object.keys(Stat).includes(a.stat)) throw new Error(`Unbekannter Stat: ${a.id}`);
    ['baseDC','energyCost','stressDelta','moneyDelta','xpGain'].forEach(k=>{
      if(typeof a[k] !== 'number' || !Number.isFinite(a[k])) throw new Error(`Zahl erwartet: ${a.id}.${k}`);
    });
  }
  return true;
}

/* ========== Milestones ==================================================== */
function makeMilestones(){
  return [
    { id:"clarity", name:"Klarheit gewonnen", path:Path.Aufarbeitung, isPinnacle:false,
      requirements:(s)=>(s.successTags.get("reflect")||0)>=3, rewards:(s)=> s.xp += 20 },
    { id:"contact_solid", name:"Kontakt kompakt", path:Path.Aufarbeitung, isPinnacle:false,
      requirements:(s)=>(s.successTags.get("contact_mgmt")||0)>=3, rewards:(s)=> s.perks.add(Perk.Stoic) },
    { id:"triggers_mastered", name:"Trigger-Kompetenz", path:Path.Aufarbeitung, isPinnacle:false,
      requirements:(s)=>(s.successTags.get("skills")||0)>=2, rewards:(s)=> s.money += 50 },
    { id:"new_pillars", name:"Neue Pfeiler", path:Path.Aufarbeitung, isPinnacle:true,
      requirements:(s)=>(s.successTags.get("milestone-setup")||0)>=4 && s.xp>=80, rewards:(s)=> s.perks.add(Perk.Creative) },
  ];
}

/* ========== Familie/Gruppierung ========================================== */
function familyOf(def){
  const T=def.tags||[];
  if(T.includes("fam:stabilisieren")||T.includes("aftercare")||T.includes("rest")) return "stabilisieren";
  if(T.includes("fam:reflektieren") ||T.includes("reflect")   ||T.includes("skills")) return "reflektieren";
  if(T.includes("fam:abgrenzen")    ||T.includes("boundaries")) return "abgrenzen";
  if(T.includes("fam:kontakt")      ||T.includes("contact_mgmt")||T.includes("closure")) return "kontakt";
  if(T.includes("fam:zukunft")      ||T.includes("growth") ||T.includes("milestone-setup")) return "zukunft";
  return "reflektieren";
}

/* ========== Engine Core =================================================== */
function createState(meta, stats, perks, path, seed){
  const rng=makeRngFromSeed(seed);
  return{
    meta, stats, perks, path, rng,
    seed, sandbox:false, noEnds:false,
    energy:100, stress:0, money:0, xp:0,
    cooldowns:new Map(), sinceSeen:new Map(), successTags:new Map(),
    certificates:new Set(), history:[], milestonesAchieved:new Set(),
    ended:false, endTitle:"", endSummary:""
  };
}
function applyPerkEconomy(perks, def, s,h,x){
  if(perks.has(Perk.Workhorse)&&def.tags.includes("stabilize")){ s=Math.trunc(s*0.85); h=Math.trunc(h*1.10); }
  if(perks.has(Perk.Stoic) && s>0) s=Math.trunc(s*0.90);
  if(perks.has(Perk.Creative)&&def.tags.includes("growth")) x=Math.trunc(x*1.10);
  return [s,h,x];
}

/* ========== XP-first Auswahl (Top-3) + Hand-Lock + Debug ================== */
function phaseOf(state){
  if(state.stress>=60||state.energy<=30) return "stabilisieren";
  if((state.successTags.get("reflect")||0)<3 || state.xp<60) return "aufarbeitung";
  return "integration";
}
function weightsForPhase(phase){
  if(phase==="stabilisieren") return { w_xp:0.6,  w_ms:0.20, w_stress:1.20, w_energy:0.90, w_nov:0.05 };
  if(phase==="aufarbeitung")  return { w_xp:1.0,  w_ms:0.35, w_stress:0.60, w_energy:0.40, w_nov:0.05 };
  return                         { w_xp:0.90, w_ms:0.45, w_stress:0.50, w_energy:0.35, w_nov:0.07 };
}
function noveltyBonus(state, def){ const age=state.sinceSeen.get(def.id) ?? 0; return Math.max(-0.10, Math.min(0.25, (age-3)*0.03)); }
function isUnsafe(state, def, sAdj){ const eAfter=state.energy-def.energyCost; const sAfter=state.stress+Math.max(0,sAdj); return (eAfter<0)||(sAfter>100); }

function scoreBreakdown(state, def){
  const phase = phaseOf(state);
  const w = weightsForPhase(phase);
  const p = successProbability(state, def, def.baseDC)/100;
  const [sAdj,hAdj,xAdj] = applyPerkEconomy(state.perks, def, def.stressDelta, def.moneyDelta, def.xpGain);
  if(isUnsafe(state, def, sAdj)) return { unsafe:true, score:-1e9, phase, fam:familyOf(def) };

  const energyAfter = state.energy - def.energyCost;
  const stressAfter = state.stress + Math.max(0, sAdj);
  const XPexp = p * xAdj;
  const MS = def.tags.includes("milestone-setup") ? p * 10 : 0;
  const stressPenalty = Math.max(0, stressAfter - 80);
  const energyPenalty = Math.max(0, 25 - energyAfter);
  const novelty = noveltyBonus(state, def);

  const score = w.w_xp*XPexp + w.w_ms*MS + w.w_nov*novelty - w.w_stress*stressPenalty - w.w_energy*energyPenalty;

  return { unsafe:false, score, phase, fam:familyOf(def), p, xAdj, sAdj, hAdj, XPexp, MS, stressAfter, energyAfter, stressPenalty, energyPenalty, novelty, w };
}

function pickTop3XP(state, actions){
  // Neuheit altern lassen
  actions.forEach(a => state.sinceSeen.set(a.id, (state.sinceSeen.get(a.id) ?? 6) + 1));

  // 1) Primär nur Aktionen mit cooldown<=0 zulassen
  const eligible = actions.filter(a => (state.cooldowns.get(a.id)||0) <= 0 && a.prereq(state));

  const scoreList = (list)=> list
    .map(a => ({ def:a, dbg:scoreBreakdown(state,a) }))
    .filter(x => !x.dbg.unsafe)
    .sort((a,b)=> b.dbg.score - a.dbg.score);

  let scored = scoreList(eligible);

  // 2) Fallback: wenn zu wenig, auch gesperrte berücksichtigen
  if (scored.length < 3){
    const scoredAll = scoreList(actions);
    // Mergen, ohne Duplikate
    const seen = new Set(scored.map(x=>x.def.id));
    for (const item of scoredAll){
      if (seen.has(item.def.id)) continue;
      scored.push(item); seen.add(item.def.id);
      if (scored.length>=3) break;
    }
  }

  // 3) Diversity: bevorzugt unterschiedliche Familien
  const families = new Set(), out=[];
  for(const item of scored){
    const fam=item.dbg.fam;
    if(families.has(fam) && scored.some(x=>!families.has(x.dbg.fam))) continue;
    out.push(item); families.add(fam);
    if(out.length===3) break;
  }
  // 4) Falls <3, mit nächsten besten auffüllen
  let i=0; while(out.length<3 && i<scored.length){ if(!out.includes(scored[i])) out.push(scored[i]); i++; }

  // sinceSeen für gewählte resetten
  out.forEach(x=> state.sinceSeen.set(x.def.id, 0));

  return out.map(x => ({ def:x.def, risk:"xp", targetDC:x.def.baseDC, score:x.dbg.score, dbg:x.dbg }));
}

/* ========== Ausführen / Meilensteine ===================================== */
function applyAction(state, option){
  const def=option.def;
  const last=state.history.slice(-20);
  const succRate=last.length?(last.filter(x=>x).length/last.length):1.0;
  const safety=(succRate<0.40)?1:0;

  const base=state.stats[def.stat];
  const bonus=perkStatBonus(state.perks,def);
  const ls=luckShift(state.stats.Zuversicht,state.perks);
  const roll=d10(state.rng);
  const total=base+bonus+roll+ls;
  const dcEff=Math.max(0,def.baseDC-safety);
  const success=total>=dcEff;

  const [sAdj,hAdj,xAdj]=applyPerkEconomy(state.perks,def,def.stressDelta,def.moneyDelta,def.xpGain);
  state.energy=clamp(state.energy-def.energyCost,0,100);
  state.stress=clamp(state.stress+sAdj,0,100);
  state.money+=hAdj; state.xp+=xAdj;

  if(def.cooldown&&def.cooldown>0) state.cooldowns.set(def.id,def.cooldown);
  // globaler Tick für alle Cooldowns (inkl. Hand-Lock)
  for(const [k,v] of [...state.cooldowns.entries()]) state.cooldowns.set(k,Math.max(0,v-1));

  if(success){ def.tags.forEach(t=>state.successTags.set(t,(state.successTags.get(t)||0)+1)); def.onSuccess(state); }
  else def.onFailure(state);

  if(!state.noEnds){
    if(state.stress>=100) endGame(state,"Rückfall/Überlastung","Stress bei 100. Mehr Erholung & Grenzen.");
    else checkMilestones(state);
  } else state.stress=Math.min(state.stress,99);

  state.history.push(success); if(state.history.length>50) state.history.shift();

  if(window.CH){ const prob=successProbability(state,def,def.baseDC); CH.logger.info(`Aktion ${def.id} → ${success?'Erfolg':'Fail'}`,{roll, luckShift:ls, baseStat:base, statBonus:bonus, dc:def.baseDC, dcEff, energyCost:def.energyCost, stressAdj:sAdj, hopeAdj:hAdj, xpAdj:xAdj, prob}); }

  const prob=successProbability(state,def,def.baseDC);
  let msg=`Aktion: ${def.name}. DC=${def.baseDC}, Stat=${def.stat}, Erfolg≈${prob}% · W10=${roll}, Luck +${ls}, Stat ${def.stat} ${base}`;
  if(bonus) msg+=` (+Perk ${bonus})`;
  if(safety===1) msg+=`, Sicherheitsnetz −1 DC`;
  msg+=` → Summe=${total} ${success?'≥':'<'} ${dcEff} → ${success?'Erfolg':'Misserfolg'}; Δ: E ${signStr(-def.energyCost)}, S ${signStr(sAdj)}, H ${signStr(hAdj)}, XP +${xAdj}.`;
  return msg;
}
function checkMilestones(state){
  if(state.noEnds) return;
  const ms=makeMilestones().filter(m=>m.path===state.path && !state.milestonesAchieved.has(m.id));
  for(const m of ms){
    if(m.requirements(state)){
      m.rewards(state); state.milestonesAchieved.add(m.id);
      if(m.isPinnacle){ endGame(state,`Pinnacle erreicht: ${m.name}`,legacySummary(state)); break; }
    }
  }
}
function legacySummary(state){
  let rank=0; if(["new_pillars"].some(id=>state.milestonesAchieved.has(id)))rank=3000;
  else if(state.milestonesAchieved.size>=2)rank=2000; else if(state.milestonesAchieved.size>=1)rank=1000;
  const hope=Math.trunc(state.money), ms=state.milestonesAchieved.size*100, well=(100-state.stress)*5;
  return `Legacy-Score: ${rank+hope+ms+well}  (Rang=${rank}, Hoffnung=${hope}, Milestones=${ms}, Wohlbefinden=${well}).`;
}
function endGame(state,title,summary){ state.ended=true; state.endTitle=title; state.endSummary=summary; }

/* ========== Reports/Export =============================================== */
function buildReport(state){
  const total=state.history.length||1, succ=state.history.filter(Boolean).length, rate=Math.round((succ/total)*100);
  const entries=[...state.successTags.entries()].sort((a,b)=>b[1]-a[1]); const top=entries.slice(0,5).map(([k,v])=>`${k}: ${v}`).join(", ")||"–";
  const ms=state.milestonesAchieved.size?[...state.milestonesAchieved].join(", "):"–";
  const hints=[];
  if(state.stress>=70) hints.push("Mehr Aftercare (Atmen, Spaziergang, Musik).");
  if((state.successTags.get("reflect")||0)<3) hints.push("Reflexion vertiefen (Journaling, Red Flags, Reframing).");
  if((state.successTags.get("contact_mgmt")||0)<2) hints.push("Kontakt-Management (Mute/Archive, Kein-Kontakt).");
  if((state.successTags.get("skills")||0)<1) hints.push("Skills (Trigger-Karte, Grenzen).");
  if((state.successTags.get("milestone-setup")||0)>=4) hints.push("Zukunftsbild/Routinen festigen.");
  return [`Erfolgsrate: ${rate}% (${succ}/${total})`,`Meilensteine: ${ms}`,`Fortschritte: ${top}`,hints.length?`Nächste Schritte:\n• ${hints.join("\n• ")}`:"Nächste Schritte: –"].join("\n");
}
function sessionAsJSON(state){
  const obj={ seed:state.seed, sandbox:state.sandbox,
    summary:{ endTitle:state.endTitle, endSummary:state.endSummary, legacy:legacySummary(state) },
    meta: state.meta, stats: state.stats,
    resources:{ energy:state.energy, stress:state.stress, hope:state.money, xp:state.xp },
    milestones:[...state.milestonesAchieved], successTags:Object.fromEntries(state.successTags), history:state.history
  };
  return JSON.stringify(obj, null, 2);
}
function downloadText(filename,text){ const blob=new Blob([text],{type:"application/json"}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove(); }

/* ========== UI-Elemente =================================================== */
const elStart=el("start-screen"), elGame=el("game-screen"), elEnd=el("end-screen");
const elName=el("name-input"), elNameOk=el("name-ok"), elGender=el("gender-label"), elGenderToggle=el("gender-toggle");
const elAgeInput=el("age-input"), elSeedInput=el("seed-input"), elSeedDice=el("seed-dice"), elConfirm=el("confirm-btn");
const elPtsLeft=el("pts-left"), elHint=el("start-hint");
const elOptions=el("options"), elLog=el("log"), elStatus=el("status"), elCooldowns=el("cooldowns");
const elRefresh=el("btn-refresh"), elExit=el("btn-exit"), elRestart=el("btn-restart"), elFocus=el("btn-focus"), elDebugOpen=el("btn-debug");

/* ========== Start-Screen / Attribute ===================================== */
const NAME_RE=/^[A-Za-zÄÖÜäöüß]{2,20}$/; const BASELINE_TOTAL=25; const POOL_TOTAL=10;
const pre={ name:"", gender:"Divers", age:18, stats:{Selbstbild:5,Regulation:5,Klarheit:5,Grenzen:5,Zuversicht:5}, poolLeft:POOL_TOTAL };

function sumStats(){ const s=pre.stats; return s.Selbstbild+s.Regulation+s.Klarheit+s.Grenzen+s.Zuversicht; }
function recomputePool(){ const used=sumStats()-BASELINE_TOTAL; pre.poolLeft=POOL_TOTAL-used; }
function validName(){ return NAME_RE.test(pre.name); }
function validAge(){ const n=Number(elAgeInput.value); return Number.isInteger(n)&&n>=10&&n<=99; }
function canStart(){ const attrsOk=Object.values(pre.stats).every(v=>v>=1&&v<=10); return validName()&&validAge()&&attrsOk&&(pre.poolLeft===0); }
function updateStartUI(){
  elName.value=pre.name; elGender.textContent=pre.gender; elAgeInput.value=pre.age;
  el("stat-Selbstbild").textContent=pre.stats.Selbstbild; el("stat-Regulation").textContent=pre.stats.Regulation;
  el("stat-Klarheit").textContent=pre.stats.Klarheit; el("stat-Grenzen").textContent=pre.stats.Grenzen; el("stat-Zuversicht").textContent=pre.stats.Zuversicht;
  recomputePool(); elPtsLeft.textContent=pre.poolLeft; elPtsLeft.classList.toggle('ok',pre.poolLeft===0); elPtsLeft.classList.toggle('danger',pre.poolLeft<0);
  elNameOk.textContent=validName()?"✓":"✖"; elNameOk.className=validName()?"ok":"danger";
  const miss=[]; if(!validName())miss.push("Name (2–20, nur Buchstaben)"); if(!validAge())miss.push("Alter (10–99)"); if(pre.poolLeft!==0)miss.push(`${Math.abs(pre.poolLeft)} Punkt(e) ${pre.poolLeft>0?'zu verteilen':'zu viel'}`);
  elHint.textContent=miss.length?("Fehlt: "+miss.join(" · ")):"Alles bereit.";
  elConfirm.disabled=!canStart();
}
function toStart(){
  pre.name=""; pre.gender="Divers"; pre.age=18;
  pre.stats={Selbstbild:5,Regulation:5,Klarheit:5,Grenzen:5,Zuversicht:5}; pre.poolLeft=POOL_TOTAL; elSeedInput.value="";
  updateStartUI(); elStart.classList.remove("hidden"); elGame.classList.add("hidden"); elEnd.classList.add("hidden");
  setHTML(elLog,""); document.body.classList.remove("focus"); if(elFocus) elFocus.textContent="FOKUS: AUS";
  if(window.CH) CH.logger.info('Zurück zum Start.');
}
document.querySelectorAll("button[data-stat]").forEach(btn=>{
  on(btn,"click",()=>{
    const s=btn.getAttribute("data-stat"), d=parseInt(btn.getAttribute("data-delta"),10), cur=pre.stats[s];
    if(d>0){ recomputePool(); if(pre.poolLeft<=0||cur>=10) return; pre.stats[s]=Math.min(10,cur+1); }
    else { if(cur<=1) return; pre.stats[s]=Math.max(1,cur-1); }
    updateStartUI();
  });
});
on(elName,"input",()=>{ pre.name=(elName.value||"").trim(); updateStartUI(); });
on(elGenderToggle,"click",()=>{ pre.gender=pre.gender==="Männlich"?"Weiblich":(pre.gender==="Weiblich"?"Divers":"Männlich"); updateStartUI(); });
on(elAgeInput,"input",()=>{ const n=Number(elAgeInput.value); pre.age=Number.isFinite(n)?n:pre.age; updateStartUI(); });
on(elSeedDice,"click",()=>{ elSeedInput.value=String(Date.now()); });

/* ========== Karten laden & validieren ==================================== */
const ACTIONS = actionsFromCards(window.RESET_CARDS||{});
if(window.CH){ try{ validateCards(ACTIONS); CH.loader.checkActions(ACTIONS, Stat); } catch(e){ CH.diagnostics.recordError(e,'cards-validate'); } }

/* ========== Rendering: Top-3 + Debug-Breakdown + Hand-Lock =============== */
const SHOW_CARD_DEBUG = !!(window.CH && CH.config && CH.config.debug);
const HAND_LOCK_TURNS = 2;           // wie lange gezeigte Karten gesperrt werden (Anzeige-Sperre)
let CURRENT_HAND = [];               // aktuell gezeigte Karten-IDs

function eshBoxes(a){
  const E=-a.energyCost, S=a.stressDelta, H=a.moneyDelta;
  return `<div class="meta" style="margin-top:6px">[ E ${signStr(E)} ] &nbsp; [ S ${signStr(S)} ] &nbsp; [ H ${signStr(H)} ]</div>`;
}
function debugBlock(def, dbg){
  if(!SHOW_CARD_DEBUG || !dbg || dbg.unsafe) return '';
  const cd = (GAME && GAME.cooldowns.get(def.id)) || 0;
  const age = (GAME && GAME.sinceSeen.get(def.id)) || 0;
  const f=(x)=> (typeof x==='number' ? (Math.round(x*100)/100) : x);
  return `
    <details class="meta" style="margin-top:6px" open>
      <summary>Debug</summary>
      <div class="meta">Phase: <strong>${dbg.phase}</strong> · Familie: ${dbg.fam} · cd=${cd} · since=${age}</div>
      <div class="meta">p=${f(dbg.p)} · XPexp=${f(dbg.XPexp)} · MS=${f(dbg.MS)} · nov=${f(dbg.novelty)}</div>
      <div class="meta">after: E=${f(dbg.energyAfter)} · S=${f(dbg.stressAfter)}</div>
      <div class="meta">penalties: stress=${f(dbg.stressPenalty)} · energy=${f(dbg.energyPenalty)}</div>
      <div class="meta">weights: xp=${dbg.w.w_xp}, ms=${dbg.w.w_ms}, stress=${dbg.w.w_stress}, energy=${dbg.w.w_energy}, nov=${dbg.w.w_nov}</div>
      <div class="meta"><strong>score=${f(dbg.score)}</strong></div>
    </details>
  `;
}
function interactiveCard(opt){ // opt = {def, dbg}
  const def=opt.def, dbg=opt.dbg;
  const prob=(typeof GAME==='object'&&GAME)?successProbability(GAME,def,def.baseDC):null;
  const lines=(def.desc||'').split('\n').filter(Boolean);
  const div=document.createElement("div"); div.className="option-card";
  div.innerHTML=`
    <h4 style="margin:0 0 6px;">${def.name}</h4>
    <div class="meta">Stat: ${def.stat} · DC: ${def.baseDC}${prob===null?"":` · Erfolgschance: ${prob}%`}</div>
    <div class="details" style="margin:6px 0 0;">
      <div class="muted">${lines.map(x=>x.startsWith('•')?x:`• ${x}`).join('<br>')}</div>
      ${eshBoxes(def)}
      ${debugBlock(def, dbg)}
    </div>
    <div style="margin-top:8px"><button class="primary">Ausführen</button></div>
  `;
  div.querySelector("button.primary").addEventListener("click", ()=>{
    // Hand-Lock: alle aktuell gezeigten Karten für HAND_LOCK_TURNS sperren
    CURRENT_HAND.forEach(id=>{
      const cur = GAME.cooldowns.get(id) || 0;
      GAME.cooldowns.set(id, Math.max(cur, HAND_LOCK_TURNS));
    });
    const entry = applyAction(GAME, {def, risk:"xp", targetDC:def.baseDC});
    const li=document.createElement('div'); li.textContent='• '+entry; elLog.prepend(li);
    if(GAME.ended) showEnd(); else { renderTop3(); renderStatus(); renderCooldowns(); }
  });
  return div;
}
function renderTop3(){
  const top = pickTop3XP(GAME, ACTIONS);
  elOptions.innerHTML="";
  top.forEach(o => elOptions.appendChild(interactiveCard(o)));
  CURRENT_HAND = top.map(o=>o.def.id);
}

/* ========== Start / Status / Buttons ===================================== */
let GAME=null;
function startGame(){
  const seed=(elSeedInput.value||(`${pre.name}#${pre.age}`)).trim();
  GAME=createState({name:pre.name,gender:pre.gender,age:pre.age,background:"Neutral"},{...pre.stats},new Set(),Path.Aufarbeitung,seed);
  if(window.CH){
    CH.logger.info('Spielstart',{seed,stats:GAME.stats,meta:GAME.meta});
    CH.diagnostics.setStateSupplier(()=>({ seed:GAME.seed, meta:GAME.meta,
      resources:{energy:GAME.energy,stress:GAME.stress,hope:GAME.money,xp:GAME.xp},
      ended:GAME.ended, milestones:[...GAME.milestonesAchieved],
      successTags:Object.fromEntries(GAME.successTags), historyLen:GAME.history.length }));
  }
  elStart.classList.add("hidden"); elGame.classList.remove("hidden");
  renderTop3(); renderStatus(); renderCooldowns();
}
function renderStatus(){
  const s=GAME;
  setHTML(elStatus, `
    <div><strong>${s.meta.name}</strong> · ${s.meta.age} · ${s.meta.gender}</div>
    <div>Energie: <strong>${s.energy}</strong> &nbsp; Stress: <strong>${s.stress}</strong> &nbsp; Hoffnung: <strong>${s.money}</strong> &nbsp; Einsicht (XP): <strong>${s.xp}</strong></div>
    <div>Pfad: <span class="pill">Aufarbeitung</span> &nbsp; <span class="muted">v${window.CH?CH.VERSION:'—'} · Build ${window.CH?CH.BUILD:'—'}</span></div>
    <div>Perks: ${s.perks.size?[...s.perks].join(", "):"–"}</div>
    <div>Meilensteine: ${s.milestonesAchieved.size?[...s.milestonesAchieved].join(", "):"–"}</div>
  `);
}
function renderCooldowns(){ const lines=[]; for(const [k,v] of GAME.cooldowns.entries()) if(v>0) lines.push(`• ${k}: ${v} Aktionen`); setHTML(elCooldowns, lines.length?lines.join("<br>"):"Keine."); }

on(elConfirm,"click",startGame);
on(elRefresh,"click",()=>renderTop3());
on(elExit,"click",()=>{ endGame(GAME,"Freiwilliger Abschluss",legacySummary(GAME)); showEnd(); });
on(elRestart,"click",()=>toStart());
on(elFocus,"click",()=>{ document.body.classList.toggle("focus"); const onState=document.body.classList.contains("focus"); elFocus.textContent=`FOKUS: ${onState?"AN":"AUS"}`; if(GAME) renderTop3(); });
on(elDebugOpen,"click",()=> window.CH && CH.ui && CH.ui.open());

/* ========== Endscreen ===================================================== */
const elEndTitle=el("end-title"), elEndSummary=el("end-summary"), elToStart=el("btn-to-start");
function showEnd(){
  elGame.classList.add("hidden"); elEnd.classList.remove("hidden");
  elEndTitle.textContent = GAME.endTitle; elEndSummary.textContent = GAME.endSummary;
  const rep=el("end-report"); if(rep) setHTML(rep, buildReport(GAME));

  const btnCont=el("btn-continue"), btnReseed=el("btn-reseed"), btnDl=el("btn-download"), btnMdc=el("btn-mdc");
  if(btnCont) btnCont.onclick = ()=>{ GAME.sandbox=true; GAME.noEnds=true; GAME.ended=false; GAME.energy=Math.max(GAME.energy,30); GAME.stress=Math.min(GAME.stress,95); elEnd.classList.add("hidden"); elGame.classList.remove("hidden"); renderTop3(); renderStatus(); renderCooldowns(); };
  if(btnReseed) btnReseed.onclick = ()=>{ const same=GAME.seed||(""+Date.now()); toStart(); elSeedInput.value=same; };
  if(btnDl) btnDl.onclick = ()=>{ const fname=`reset_run_${(GAME.seed||'seed')}.json`; downloadText(fname, sessionAsJSON(GAME)); };
  if(btnMdc) btnMdc.onclick = ()=>{ if(window.CH&&CH.ui) CH.ui.open(); };
  if(elToStart) elToStart.onclick = ()=> toStart();
}

/* ========== Init ========================================================== */
if(window.CH && CH.loader){
  CH.loader.registerModule('game','0.12.3');
  CH.loader.ready(CH.safeWrap(()=>{ toStart(); CH.logger.info('Game-UI initialisiert.'); }, null, 'boot'));
} else {
  document.addEventListener('DOMContentLoaded', ()=> toStart());
}