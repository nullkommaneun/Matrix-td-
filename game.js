/* ============================================================================
   RESET — Spielengine & UI (game.js)  v0.10.0
   - Titel: RESET
   - Profil: Name (nur Buchstaben), Alter (Input), Seed (optional, 🎲)
   - Attribute: 5 Grundlagen (Start 5), min 1, max 10, +10 Punkte zu verteilen
   - Start wird erst aktiv, wenn Name/Alter gültig & Punkte exakt verteilt
   - Neue Stat-Map + Kartenzuordnung, LuckShift ⇒ Zuversicht
   - Boot/Debug-Integration (CH.*) bleibt erhalten
   ============================================================================ */

/* ---------- RNG ---------- */
function xmur3(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=(h<<13)|(h>>>19);}return function(){h=Math.imul(h^(h>>>16),2246822507);h=Math.imul(h^(h>>>13),3266489909);h^=h>>>16;return h>>>0;};}
function sfc32(a,b,c,d){return function(){a>>>=0;b>>>=0;c>>>=0;d>>>=0;let t=(a+b)|0;a=b^(b>>>9);b=(c+(c<<3))|0;c=(c<<21)|(c>>>11);d=(d+1)|0;t=(t+d)|0;c=(c+t)|0;return (t>>>0)/4294967296;};}
const makeRngFromSeed=(seed)=>{const s=xmur3(seed);return sfc32(s(),s(),s(),s());};
const d10=(rng)=>1+Math.floor(rng()*10);

/* ---------- Enums ---------- */
const Stat = {
  Selbstbild: "Selbstbild",
  Regulation: "Regulation",
  Klarheit:   "Klarheit",
  Grenzen:    "Grenzen",
  Zuversicht: "Zuversicht"
};
const Perk = { Networker:"Networker", Workhorse:"Workhorse", Analytical:"Analytical", Stoic:"Stoic", Creative:"Creative", LuckyBreak:"LuckyBreak" };
const Path = { Aufarbeitung:"Aufarbeitung" };
const Risk = { Safe:"Safe", Medium:"Medium", Hard:"Hard" };

/* ---------- Small Utils ---------- */
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const signStr=(n)=>(n>=0?`+${n}`:`${n}`);
const el=(id)=>document.getElementById(id);
const on=(t,ev,h)=>t&&t.addEventListener(ev,(window.CH?CH.safeWrap(h,t,`${ev}#${t.id||t.tagName}`):h));
const setHTML=(n,html)=>{ n.innerHTML=html; };
function prependTextLine(node, line){ const div=document.createElement('div'); div.textContent=`• ${line}`; node.prepend(div); }

/* ---------- Perk & Luck ---------- */
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

/* ---------- Erfolgschance ---------- */
function successProbability(state, def, dc){
  const baseStat = state.stats[def.stat];
  const statBonus = perkStatBonus(state.perks, def);
  const ls = luckShift(state.stats.Zuversicht, state.perks);
  let successes=0;
  for(let r=1;r<=10;r++){ const total = baseStat + statBonus + r + ls; if(total >= dc) successes++; }
  return successes*10; // Prozent
}

/* ---------- Content: Actions & Milestones ---------- */
function makeActions(){
  const list=[]; const A=(o)=>({ cooldown:0, tags:[], pathRestriction:null, prereq:()=>true, onSuccess:()=>{}, onFailure:()=>{}, ...o });

  // Erholung / Aftercare → Regulation
  list.push(A({ id:"breath_reset", name:"Atem-Reset", desc:"Beruhigt, erdet.",
    baseDC:0, stat:Stat.Regulation, energyCost:-10, stressDelta:-20, moneyDelta:0, xpGain:0, tags:["rest","stabilize","aftercare"] }));
  list.push(A({ id:"mindfulness_5", name:"5-Min Achtsamkeit", desc:"Auf Körper & Atem fokussieren.",
    baseDC:0, stat:Stat.Regulation, energyCost:-5, stressDelta:-15, moneyDelta:0, xpGain:0, tags:["rest","stabilize","aftercare"] }));

  list.push(A({ id:"aftercare_walk", name:"10-Min Spaziergang", desc:"Frische Luft, lockere Bewegung.",
    baseDC:6, stat:Stat.Regulation, energyCost:-8, stressDelta:-12, moneyDelta:+2, xpGain:4, tags:["aftercare","stabilize"] }));
  list.push(A({ id:"aftercare_music", name:"Musik-Session", desc:"2–3 Songs, die dich beruhigen.",
    baseDC:6, stat:Stat.Selbstbild, energyCost:-6, stressDelta:-10, moneyDelta:+3, xpGain:3, tags:["aftercare","stabilize"] }));
  list.push(A({ id:"aftercare_checkin", name:"Check-in in 3 Sätzen", desc:"Wie geht’s? Was brauch ich? Was tu ich als Nächstes?",
    baseDC:7, stat:Stat.Klarheit, energyCost:6, stressDelta:-6, moneyDelta:+4, xpGain:6, tags:["aftercare","reflect","stabilize"] }));
  list.push(A({ id:"aftercare_gratitude", name:"3-Punkte Dankbarkeit", desc:"Drei kleine Dinge heute wertschätzen.",
    baseDC:7, stat:Stat.Klarheit, energyCost:6, stressDelta:-6, moneyDelta:+5, xpGain:6, tags:["aftercare","growth"] }));

  // Kern-Aufarbeitung → Klarheit
  list.push(A({ id:"journal_patterns", name:"Journaling: Muster", desc:"3 wiederkehrende Konfliktmuster benennen.",
    baseDC:7, stat:Stat.Klarheit, energyCost:12, stressDelta:8, moneyDelta:0, xpGain:12, tags:["reflect","milestone-setup"] }));
  list.push(A({ id:"values_list", name:"Werte-Inventur", desc:"Top-5 Werte & Grenzen notieren.",
    baseDC:8, stat:Stat.Klarheit, energyCost:14, stressDelta:8, moneyDelta:0, xpGain:14, tags:["reflect","boundaries","milestone-setup"] }));
  list.push(A({ id:"trigger_map", name:"Trigger-Karte", desc:"Auslöser → Reaktion → Gegenzug skizzieren.",
    baseDC:9, stat:Stat.Klarheit, energyCost:16, stressDelta:10, moneyDelta:0, xpGain:18, tags:["skills","milestone-setup"] }));
  list.push(A({ id:"memory_reframe", name:"Erinnerung reframen", desc:"Eine Szene neutral neu beschreiben.",
    baseDC:9, stat:Stat.Klarheit, energyCost:14, stressDelta:10, moneyDelta:0, xpGain:16, tags:["reflect"] }));
  list.push(A({ id:"redflags_sheet", name:"Red-Flags-Sheet", desc:"Eigene Warnsignale notieren.",
    baseDC:8, stat:Stat.Klarheit, energyCost:12, stressDelta:10, moneyDelta:0, xpGain:12, tags:["reflect"] }));
  list.push(A({ id:"future_vision", name:"Zukunftsbild", desc:"3 Kriterien für gesunde Beziehung definieren.",
    baseDC:8, stat:Stat.Klarheit, energyCost:12, stressDelta:8, moneyDelta:0, xpGain:12, tags:["growth","milestone-setup"] }));
  list.push(A({ id:"relapse_plan", name:"Rückfall-Plan", desc:"Wenn Kontaktimpuls X → Handlung Y.",
    baseDC:9, stat:Stat.Klarheit, energyCost:14, stressDelta:10, moneyDelta:0, xpGain:16, tags:["skills","stabilize"] }));

  // Kontakt-Management / Grenzen
  list.push(A({ id:"digital_hygiene", name:"Digital: Mute/Archive", desc:"Benachrichtigungen stummschalten, Chat archivieren.",
    baseDC:7, stat:Stat.Selbstbild, energyCost:6, stressDelta:6, moneyDelta:0, xpGain:8, tags:["contact_mgmt","stabilize"] }));
  list.push(A({ id:"no_contact_action", name:"Kein-Kontakt-Schritt", desc:"1 konkreter Schritt ohne Kontakt.",
    baseDC:8, stat:Stat.Grenzen, energyCost:10, stressDelta:10, moneyDelta:0, xpGain:12, tags:["contact_mgmt","milestone-setup"], cooldown:1 }));
  list.push(A({ id:"return_items", name:"Gegenstände klären", desc:"Eigene Dinge sichern / Rückgabe regeln (ohne Treffen).",
    baseDC:10, stat:Stat.Grenzen, energyCost:16, stressDelta:14, moneyDelta:0, xpGain:16, tags:["contact_mgmt","closure"],
    prereq:(s)=>(s.successTags.get("contact_mgmt")||0)>=2 }));
  list.push(A({ id:"boundary_script", name:"Grenzen-Script", desc:"Zwei Ich-Botschaften formulieren.",
    baseDC:8, stat:Stat.Grenzen, energyCost:12, stressDelta:10, moneyDelta:0, xpGain:14, tags:["boundaries","skills"] }));

  // Netzwerk (Selbstbild)
  list.push(A({ id:"support_call", name:"Support-Gespräch", desc:"20 Min mit Vertrauensperson (sachlich).",
    baseDC:8, stat:Stat.Selbstbild, energyCost:8, stressDelta:8, moneyDelta:0, xpGain:10, tags:["network","stabilize"] }));

  // Routinen (Regulation)
  list.push(A({ id:"routine_pillar", name:"Routine-Pfeiler", desc:"Tägliche Micro-Routine festlegen.",
    baseDC:7, stat:Stat.Regulation, energyCost:10, stressDelta:6, moneyDelta:0, xpGain:10, tags:["stabilize","milestone-setup"], cooldown:1 }));

  return list;
}

function makeMilestones(){
  return [
    { id:"clarity", name:"Klarheit gewonnen", desc:"Muster & Werte benannt.",
      path:Path.Aufarbeitung, isPinnacle:false,
      requirements:(s)=>(s.successTags.get("reflect")||0)>=3,
      rewards:(s)=> s.xp += 20
    },
    { id:"contact_solid", name:"Kontakt kompakt", desc:"Mehrere Kontakt-Management-Schritte.",
      path:Path.Aufarbeitung, isPinnacle:false,
      requirements:(s)=>(s.successTags.get("contact_mgmt")||0)>=3,
      rewards:(s)=> s.perks.add(Perk.Stoic)
    },
    { id:"triggers_mastered", name:"Trigger-Kompetenz", desc:"Trigger-Karte + Grenzen-Script.",
      path:Path.Aufarbeitung, isPinnacle:false,
      requirements:(s)=>(s.successTags.get("skills")||0)>=2,
      rewards:(s)=> s.money += 50
    },
    { id:"new_pillars", name:"Neue Pfeiler", desc:"Routinen etabliert, Zukunftsbild skizziert.",
      path:Path.Aufarbeitung, isPinnacle:true,
      requirements:(s)=>(s.successTags.get("milestone-setup")||0)>=4 && s.xp>=80,
      rewards:(s)=> s.perks.add(Perk.Creative)
    },
  ];
}

/* ---------- Engine ---------- */
function createState(meta, stats, perks, path, seedStr){
  const rng = makeRngFromSeed(seedStr);
  return {
    meta, stats, perks, path, rng,
    seed: seedStr, sandbox:false, noEnds:false,
    energy:100, stress:0, money:0, xp:0,
    cooldowns:new Map(), sinceSeen:new Map(), successTags:new Map(),
    certificates:new Set(), history:[], milestonesAchieved:new Set(),
    ended:false, endTitle:"", endSummary:""
  };
}

function choiceByWeights(rng, weights){
  const total=weights.reduce((a,b)=>a+b,0); if(total<=0) return -1;
  let t=rng()*total, cum=0; for(let i=0;i<weights.length;i++){ cum+=weights[i]; if(t<=cum) return i; }
  return weights.length-1;
}

function pickOptions(state, pool){
  const risks=[Risk.Safe, Risk.Medium, Risk.Hard];
  const targets=new Map([
    [Risk.Safe,   6 + Math.floor(state.rng()*2)],
    [Risk.Medium, 8 + Math.floor(state.rng()*2)],
    [Risk.Hard,  10 + Math.floor(state.rng()*2)]
  ]);
  const out=[]; const X_NEU=5;

  pool.forEach(def=>{ state.sinceSeen.set(def.id, (state.sinceSeen.get(def.id) ?? (X_NEU+1)) + 1); });

  for(const risk of risks){
    const target = targets.get(risk);
    const candidates = pool.filter(def=>{
      const cd=state.cooldowns.get(def.id) ?? 0;
      const pathOK=(def.pathRestriction===null) || (def.pathRestriction===state.path);
      return pathOK && def.prereq(state) && cd<=0;
    });
    if(!candidates.length) continue;

    const weights = candidates.map(def=>{
      const fitGrad = 1 - (Math.abs(def.baseDC - target)/5);
      let w = Math.max(0, Math.min(1, fitGrad));
      if (state.stress >= 70 && (def.tags.includes("rest") || def.tags.includes("aftercare"))) w *= 1.6;
      if (state.energy <= 30 && def.energyCost >= 25) w *= 0.6;
      if (def.tags.includes("milestone-setup")) w *= 1.25;
      if (state.sandbox && def.tags.includes("aftercare")) w *= 1.5;
      const age = state.sinceSeen.get(def.id) ?? (X_NEU+1);
      w *= (age > X_NEU) ? 1.2 : 0.8;
      return w;
    });

    const idx = choiceByWeights(state.rng, weights);
    if(idx>=0){ const chosen=candidates[idx]; state.sinceSeen.set(chosen.id,0); out.push({def:chosen, risk, targetDC:target}); }
  }

  // Fallback: Aftercare/Erholung
  const ids=new Set(out.map(o=>o.def.id));
  const prefer=["aftercare_walk","aftercare_music","aftercare_checkin","aftercare_gratitude","breath_reset","mindfulness_5"];
  for(const id of prefer){ if(out.length>=3) break; const a=pool.find(x=>x.id===id); if(a && !ids.has(a.id)){ out.push({def:a, risk:Risk.Safe, targetDC:0}); ids.add(a.id); } }
  return out;
}

function applyPerkEconomy(perks, def, stressDelta, hopeDelta, xpGain){
  let s=stressDelta, h=hopeDelta, x=xpGain;
  if(perks.has(Perk.Workhorse) && def.tags.includes("stabilize")){ s=Math.trunc(s*0.85); h=Math.trunc(h*1.10); }
  if(perks.has(Perk.Stoic) && s>0) s=Math.trunc(s*0.90);
  if(perks.has(Perk.Creative) && def.tags.includes("growth")) x=Math.trunc(x*1.10);
  return [s,h,x];
}

function applyAction(state, option){
  const def=option.def;
  const last=state.history.slice(-20);
  const succRate = last.length ? (last.filter(x=>x).length/last.length) : 1.0;
  const safety = (succRate < 0.40) ? 1 : 0;

  const baseStat = state.stats[def.stat];
  const statBonus = perkStatBonus(state.perks, def);
  const ls = luckShift(state.stats.Zuversicht, state.perks);
  const roll = d10(state.rng);
  const total = baseStat + statBonus + roll + ls;
  const dcEff = Math.max(0, def.baseDC - safety);
  const success = total >= dcEff;

  const [stressAdj, hopeAdj, xpAdj] = applyPerkEconomy(state.perks, def, def.stressDelta, def.moneyDelta, def.xpGain);
  state.energy = clamp(state.energy - def.energyCost, 0, 100);
  state.stress = clamp(state.stress + stressAdj, 0, 100);
  state.money += hopeAdj;
  state.xp += xpAdj;

  if(def.cooldown && def.cooldown>0) state.cooldowns.set(def.id, def.cooldown);
  for(const [k,v] of [...state.cooldowns.entries()]) state.cooldowns.set(k, Math.max(0, v-1));

  if(success){ def.tags.forEach(tag=> state.successTags.set(tag,(state.successTags.get(tag)||0)+1)); def.onSuccess(state); }
  else def.onFailure(state);

  if(!state.noEnds){
    if(state.stress>=100) endGame(state, "Rückfall/Überlastung", "Stress bei 100. Hinweis: mehr Erholung & Grenzen.");
    else checkMilestones(state);
  } else { state.stress=Math.min(state.stress, 99); }

  state.history.push(success); if(state.history.length>50) state.history.shift();

  if(window.CH){ const prob=successProbability(state,def,def.baseDC);
    CH.logger.info(`Aktion ${def.id} → ${success?'Erfolg':'Fail'}`, {roll, luckShift:ls, baseStat, statBonus, dc:def.baseDC, dcEff, energyCost:def.energyCost, stressAdj, hopeAdj, xpAdj, prob}); }

  const prob = successProbability(state, def, def.baseDC);
  const parts=[]; parts.push(`Aktion: ${def.name} [${String(option.risk).toLowerCase()}]`); parts.push(`DC=${def.baseDC}, Stat=${def.stat}, Erfolgschance≈${prob}%`);
  let msg=`W10=${roll}, Luck-Shift +${ls}, Stat ${def.stat} ${baseStat}`; if(statBonus) msg+=` (+Perk ${statBonus})`; if(safety===1) msg+=`, Sicherheitsnetz −1 DC`;
  msg+=` → Summe=${total} ${success?'≥':'<'} DC ${dcEff} → ${success?'Erfolg':'Misserfolg'}; Δ: Energie ${signStr(-def.energyCost)}, Stress ${signStr(stressAdj)}, Hoffnung ${signStr(hopeAdj)}, Einsicht +${xpAdj}.`;
  return `${parts.join(" · ")}. ${msg}`;
}

function checkMilestones(state){
  if(state.noEnds) return;
  const ms=makeMilestones().filter(m=>m.path===state.path && !state.milestonesAchieved.has(m.id));
  for(const m of ms){
    if(m.requirements(state)){
      m.rewards(state); state.milestonesAchieved.add(m.id);
      if(m.isPinnacle){ endGame(state, `Pinnacle erreicht: ${m.name}`, legacySummary(state)); break; }
    }
  }
}
function legacySummary(state){
  let rankScore=0;
  if(["new_pillars"].some(id=>state.milestonesAchieved.has(id))) rankScore=3000;
  else if(state.milestonesAchieved.size>=2) rankScore=2000;
  else if(state.milestonesAchieved.size>=1) rankScore=1000;
  const hope=Math.trunc(state.money);
  const milestones=state.milestonesAchieved.size*100;
  const wellbeing=(100 - state.stress)*5;
  const score=rankScore + hope + milestones + wellbeing;
  return `Legacy-Score: ${score}  (Rang=${rankScore}, Hoffnung=${hope}, Milestones=${milestones}, Wohlbefinden=${wellbeing}).`;
}
function endGame(state,title,summary){ state.ended=true; state.endTitle=title; state.endSummary=summary; }

/* ---------- Reports/Export ---------- */
function buildReport(state){
  const total=state.history.length||1; const succ=state.history.filter(Boolean).length; const rate=Math.round((succ/total)*100);
  const entries=[...state.successTags.entries()].sort((a,b)=>b[1]-a[1]); const top=entries.slice(0,5).map(([k,v])=>`${k}: ${v}`).join(", ")||"–";
  const ms=state.milestonesAchieved.size ? [...state.milestonesAchieved].join(", ") : "–";
  const hints=[];
  if(state.stress>=70) hints.push("Mehr Erholung/Aftercare (Atem-Reset, Spaziergang, Musik).");
  if((state.successTags.get("reflect")||0)<3) hints.push("Reflexion vertiefen (Journaling, Red-Flags, Reframing).");
  if((state.successTags.get("contact_mgmt")||0)<2) hints.push("Kontakt-Management konsistenter halten (Mute/Archive, Kein-Kontakt-Schritte).");
  if((state.successTags.get("skills")||0)<1) hints.push("Konkrete Skills stärken (Trigger-Karte, Grenzen-Script).");
  if((state.successTags.get("milestone-setup")||0)>=4) hints.push("Setup gut → Zukunftsbild/Routinen festigen.");
  return [`Erfolgsrate: ${rate}% (${succ}/${total})`,`Meilensteine: ${ms}`,`Wichtige Fortschritte: ${top}`,hints.length?`Nächste Schritte:\n• ${hints.join("\n• ")}`:"Nächste Schritte: –"].join("\n");
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
function downloadText(filename, text){
  const blob=new Blob([text],{type:"application/json"}); const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove();
}

/* ---------- UI Binding ---------- */
const elStart=el("start-screen");
const elGame=el("game-screen");
const elEnd=el("end-screen");

const elName=el("name-input");
const elNameOk=el("name-ok");
const elGender=el("gender-label");
const elGenderToggle=el("gender-toggle");
const elAgeInput=el("age-input");
const elSeedInput=el("seed-input");
const elSeedDice=el("seed-dice");
const elConfirm=el("confirm-btn");

const elPtsLeft=el("pts-left");
const elHint=el("start-hint");

const elOptions=el("options");
const elLog=el("log");
const elStatus=el("status");
const elCooldowns=el("cooldowns");

const elRefresh=el("btn-refresh");
const elExit=el("btn-exit");
const elRestart=el("btn-restart");
const elFocus=el("btn-focus");
const elDebugOpen=el("btn-debug");

const elEndTitle=el("end-title");
const elEndSummary=el("end-summary");
const elToStart=el("btn-to-start");

/* ---------- Start Setup ---------- */
const NAME_RE = /^[A-Za-zÄÖÜäöüß]{2,20}$/;

const BASELINE_TOTAL = 5*5;  // 5 Attribute à 5
const POOL_TOTAL     = 10;   // +10 Punkte verteilbar

const pre = {
  name: "",
  gender: "Divers",
  age: 18,
  stats: { Selbstbild:5, Regulation:5, Klarheit:5, Grenzen:5, Zuversicht:5 },
  poolLeft: POOL_TOTAL
};

let GAME=null;
const ACTIONS=makeActions();

/* ---------- Health Checks ---------- */
if(window.CH){
  CH.loader.registerModule('game','0.10.0');
  try{
    CH.loader.checkDom([
      "start-screen","game-screen","end-screen","name-input","name-ok","gender-label","gender-toggle",
      "age-input","seed-input","seed-dice","confirm-btn","pts-left","start-hint",
      "stat-Selbstbild","stat-Regulation","stat-Klarheit","stat-Grenzen","stat-Zuversicht",
      "options","log","status","cooldowns","btn-refresh","btn-exit","btn-restart","btn-focus","btn-debug",
      "end-title","end-summary","btn-to-start","btn-mdc"
    ]);
    CH.loader.checkActions(ACTIONS, Stat);
    CH.logger.info('Health-Check game.js OK.');
  }catch(e){ CH.diagnostics.recordError(e,'health-check(game)'); }
}

/* ---------- Start Screen Logic ---------- */
function sumStats(){ const s=pre.stats; return s.Selbstbild+s.Regulation+s.Klarheit+s.Grenzen+s.Zuversicht; }
function recomputePool(){
  const used = sumStats() - BASELINE_TOTAL;     // wie viele extra Punkte wurden schon vergeben?
  pre.poolLeft = POOL_TOTAL - used;             // Rest im Pool (kann <0 sein → zu viel verteilt)
}

function validName(){ return NAME_RE.test(pre.name); }
function validAge(){ const n = Number(elAgeInput.value); return Number.isInteger(n) && n>=10 && n<=99; }
function canStart(){
  const attrsOk = Object.values(pre.stats).every(v=>v>=1 && v<=10);
  const poolOk  = pre.poolLeft === 0;
  return validName() && validAge() && attrsOk && poolOk;
}

function updateStartUI(){
  elName.value = pre.name;
  elGender.textContent = pre.gender;
  elAgeInput.value = pre.age;
  el("stat-Selbstbild").textContent = pre.stats.Selbstbild;
  el("stat-Regulation").textContent = pre.stats.Regulation;
  el("stat-Klarheit").textContent   = pre.stats.Klarheit;
  el("stat-Grenzen").textContent    = pre.stats.Grenzen;
  el("stat-Zuversicht").textContent = pre.stats.Zuversicht;

  recomputePool();
  elPtsLeft.textContent = pre.poolLeft;
  elPtsLeft.classList.toggle('ok', pre.poolLeft===0);
  elPtsLeft.classList.toggle('danger', pre.poolLeft<0);

  // Name-Validierung
  elNameOk.textContent = validName() ? "✓" : "✖";
  elNameOk.className = validName() ? "ok" : "danger";

  // Hinweistext
  let hint = [];
  if(!validName()) hint.push("Name (nur Buchstaben, 2–20)");
  if(!validAge())  hint.push("Alter (10–99)");
  if(pre.poolLeft!==0) hint.push(`${Math.abs(pre.poolLeft)} Punkt(e) ${pre.poolLeft>0?'zu verteilen':'zu viel'}`);
  elHint.textContent = hint.length ? ("Fehlt: " + hint.join(" · ")) : "Alles bereit.";

  elConfirm.disabled = !canStart();
}

function toStart(){
  pre.name=""; pre.gender="Divers"; pre.age=18;
  pre.stats={ Selbstbild:5, Regulation:5, Klarheit:5, Grenzen:5, Zuversicht:5 };
  pre.poolLeft=POOL_TOTAL;
  elSeedInput.value="";
  updateStartUI();
  elStart.classList.remove("hidden");
  elGame.classList.add("hidden");
  elEnd.classList.add("hidden");
  setHTML(elLog,"");
  document.body.classList.remove("focus");
  if(elFocus) elFocus.textContent="FOKUS: AUS";
  if(window.CH) CH.logger.info('Zurück zum Start.');
}

/* Attribute Buttons */
document.querySelectorAll("button[data-stat]").forEach(btn=>{
  on(btn, "click", ()=>{
    const stat = btn.getAttribute("data-stat");
    const delta = parseInt(btn.getAttribute("data-delta"), 10); // -1 / +1
    const cur = pre.stats[stat];
    if(delta>0){
      recomputePool();
      if(pre.poolLeft<=0) return;            // nichts mehr zu verteilen
      if(cur>=10) return;
      pre.stats[stat] = Math.min(10, cur+1);
    } else {
      if(cur<=1) return;
      pre.stats[stat] = Math.max(1, cur-1);
    }
    updateStartUI();
  });
});

on(elName, "input", ()=>{ pre.name = (elName.value||"").trim(); updateStartUI(); });
on(elGenderToggle, "click", ()=>{ pre.gender = pre.gender==="Männlich"?"Weiblich":(pre.gender==="Weiblich"?"Divers":"Männlich"); updateStartUI(); });
on(elAgeInput, "input", ()=>{ const n=Number(elAgeInput.value); pre.age = Number.isFinite(n)?n:pre.age; updateStartUI(); });
on(elSeedDice, "click", ()=>{ elSeedInput.value = String(Date.now()); });

/* ---------- Game Start ---------- */
function startGame(){
  const seed = (elSeedInput.value || (`${pre.name}#${pre.age}`)).trim();
  GAME = createState(
    { name: pre.name, gender: pre.gender, age: pre.age, background:"Neutral" },
    { ...pre.stats },
    new Set(),
    Path.Aufarbeitung,
    seed
  );
  if(window.CH){
    CH.logger.info('Spielstart', { seed, stats:GAME.stats, meta:GAME.meta });
    CH.diagnostics.setStateSupplier(()=>({
      seed: GAME.seed,
      meta: GAME.meta,
      resources:{ energy:GAME.energy, stress:GAME.stress, hope:GAME.money, xp:GAME.xp },
      ended: GAME.ended, milestones:[...GAME.milestonesAchieved],
      successTags: Object.fromEntries(GAME.successTags), historyLen: GAME.history.length
    }));
  }
  elStart.classList.add("hidden");
  elGame.classList.remove("hidden");
  refreshOptions(); renderStatus(); renderCooldowns();
}

/* ---------- Game UI ---------- */
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
function refreshOptions(){ const opts=pickOptions(GAME, ACTIONS); elOptions.innerHTML=""; for(const opt of opts) elOptions.appendChild(optionCard(opt)); }

function optionCard(opt){
  const def=opt.def; const prob=successProbability(GAME,def,def.baseDC);
  const div=document.createElement("div"); div.className="option-card";
  div.innerHTML = `
    <h4 style="margin:0 0 6px;">${def.name}<span class="badge">${String(opt.risk).toLowerCase()}</span></h4>
    <div class="meta">Stat: ${def.stat} · Schwierigkeit (DC): ${def.baseDC} · Erfolgschance: ${prob}%</div>
    <div class="details" style="margin:6px 0 0;">
      <div class="muted">${def.desc}</div>
      <div class="meta">Kosten: Energie ${def.energyCost<0?`+${-def.energyCost}`:def.energyCost} · Stress ${signStr(def.stressDelta)} · Hoffnung ${signStr(def.moneyDelta)} · Einsicht +${def.xpGain}</div>
      <div class="meta">Tags: ${def.tags.join(", ")||"–"}</div>
    </div>
    <div style="margin-top:8px; display:flex; gap:8px; align-items:center;">
      <button class="primary">Ausführen</button>
    </div>
  `;
  div.querySelector("button.primary").addEventListener("click", ()=> {
    const entry=applyAction(GAME,opt);
    prependTextLine(elLog, entry);
    if(GAME.ended) showEnd(); else { refreshOptions(); renderStatus(); renderCooldowns(); }
  });
  const details = div.querySelector(".details");
  if(document.body.classList.contains("focus")) details.style.display="none";
  return div;
}

/* ---------- Endscreen ---------- */
function showEnd(){
  elGame.classList.add("hidden"); elEnd.classList.remove("hidden");
  elEndTitle.textContent = GAME.endTitle; elEndSummary.textContent = GAME.endSummary;
  const rep=el("end-report"); if(rep) setHTML(rep, buildReport(GAME));

  const btnCont=el("btn-continue");
  const btnReseed=el("btn-reseed");
  const btnDl=el("btn-download");
  const btnMdc=el("btn-mdc");

  if(btnCont) btnCont.onclick = ()=>{ GAME.sandbox=true; GAME.noEnds=true; GAME.ended=false; GAME.energy=Math.max(GAME.energy,30); GAME.stress=Math.min(GAME.stress,95); elEnd.classList.add("hidden"); elGame.classList.remove("hidden"); refreshOptions(); renderStatus(); renderCooldowns(); };
  if(btnReseed) btnReseed.onclick = ()=>{ const same=GAME.seed||(""+Date.now()); toStart(); elSeedInput.value=same; };
  if(btnDl) btnDl.onclick = ()=>{ const fname=`reset_run_${(GAME.seed||'seed')}.json`; downloadText(fname, sessionAsJSON(GAME)); };
  if(btnMdc) btnMdc.onclick = ()=>{ if(window.CH&&CH.ui) CH.ui.open(); };
  if(elToStart) elToStart.onclick = ()=> toStart();
}

/* ---------- Wire Up Buttons ---------- */
on(elConfirm, "click", startGame);
on(elRefresh, "click", ()=> refreshOptions());
on(elExit, "click", ()=>{ endGame(GAME, "Freiwilliger Abschluss", legacySummary(GAME)); showEnd(); });
on(elRestart, "click", ()=> toStart());
on(elFocus, "click", ()=>{ document.body.classList.toggle("focus"); const onState=document.body.classList.contains("focus"); elFocus.textContent = `FOKUS: ${onState?"AN":"AUS"}`; if(GAME) refreshOptions(); });
on(elDebugOpen, "click", ()=> window.CH && CH.ui && CH.ui.open());

/* ---------- Init ---------- */
if(window.CH && CH.loader){ CH.loader.ready(CH.safeWrap(()=>{ toStart(); CH.logger.info('Game-UI initialisiert.'); }, null, 'boot')); }
else document.addEventListener('DOMContentLoaded', ()=> toStart());