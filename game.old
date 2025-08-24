/* ============================================================================
   RESET — Spielengine & UI (game.js)  v0.11.0
   Fokus dieses Builds:
     - Leicht verständliche Kartenbezeichnungen
     - Hintergrund: fortgeschrittene Entscheidungslogik (Phasen, Nutzenfunktion)
       · Phasen: stabilisierung → aufarbeitung → integration (automatisch erkannt)
       · Utility je Phase: Gewichte auf XP / Hoffnung / Stress / Energie / Milestones
       · Familien-Bias: stabilisieren | reflektieren | abgrenzen | kontakt | zukunft
       · Risk-Bias + DC-Fit, Neuheitsbonus, Gefahrencheck (Energie/Stress)
       · Auswahl: pro Risiko (safe/medium/hard) jeweils beste Karte (argmax)
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

/* ========================================================================== */
/*  KARTEN & MEILENSTEINE                                                     */
/* ========================================================================== */

function makeActions(){
  const list=[]; const A=(o)=>({ cooldown:0, tags:[], pathRestriction:null, prereq:()=>true, onSuccess:()=>{}, onFailure:()=>{}, ...o });

  // Stabilisieren / Aftercare (Familie: stabilisieren)
  list.push(A({ id:"breath_reset", name:"Atmen", desc:"Atem-Reset; beruhigt, erdet.",
    baseDC:0, stat:Stat.Regulation, energyCost:-10, stressDelta:-20, moneyDelta:0, xpGain:0, tags:["rest","stabilize","aftercare","fam:stabilisieren"] }));
  list.push(A({ id:"mindfulness_5", name:"Körper-Scan", desc:"5 Minuten Achtsamkeit.",
    baseDC:0, stat:Stat.Regulation, energyCost:-5, stressDelta:-15, moneyDelta:0, xpGain:0, tags:["rest","stabilize","aftercare","fam:stabilisieren"] }));
  list.push(A({ id:"aftercare_walk", name:"Spaziergang kurz", desc:"10 Minuten draußen.",
    baseDC:6, stat:Stat.Regulation, energyCost:-8, stressDelta:-12, moneyDelta:+2, xpGain:4, tags:["aftercare","stabilize","fam:stabilisieren"] }));
  list.push(A({ id:"aftercare_music", name:"Musik 2 Songs", desc:"2–3 beruhigende Tracks.",
    baseDC:6, stat:Stat.Selbstbild, energyCost:-6, stressDelta:-10, moneyDelta:+3, xpGain:3, tags:["aftercare","stabilize","fam:stabilisieren"] }));
  list.push(A({ id:"aftercare_checkin", name:"Check-in (3 Sätze)", desc:"Wie geht’s? Was brauch ich? Was als Nächstes?",
    baseDC:7, stat:Stat.Klarheit, energyCost:6, stressDelta:-6, moneyDelta:+4, xpGain:6, tags:["aftercare","reflect","stabilize","fam:stabilisieren"] }));
  list.push(A({ id:"aftercare_gratitude", name:"Dankbarkeit ×3", desc:"Drei kleine Dinge wertschätzen.",
    baseDC:7, stat:Stat.Klarheit, energyCost:6, stressDelta:-6, moneyDelta:+5, xpGain:6, tags:["aftercare","growth","fam:stabilisieren"] }));

  // Reflektieren (Familie: reflektieren)
  list.push(A({ id:"journal_patterns", name:"Muster finden", desc:"3 wiederkehrende Konfliktmuster.",
    baseDC:7, stat:Stat.Klarheit, energyCost:12, stressDelta:8, moneyDelta:0, xpGain:12, tags:["reflect","milestone-setup","fam:reflektieren"] }));
  list.push(A({ id:"values_list", name:"Werte 5", desc:"Top-5 Werte & Grenzen.",
    baseDC:8, stat:Stat.Klarheit, energyCost:14, stressDelta:8, moneyDelta:0, xpGain:14, tags:["reflect","boundaries","milestone-setup","fam:reflektieren"] }));
  list.push(A({ id:"trigger_map", name:"Trigger-Karte", desc:"Auslöser → Reaktion → Gegenzug.",
    baseDC:9, stat:Stat.Klarheit, energyCost:16, stressDelta:10, moneyDelta:0, xpGain:18, tags:["skills","milestone-setup","fam:reflektieren"] }));
  list.push(A({ id:"memory_reframe", name:"Reframe Szene", desc:"Szene neutral neu beschreiben.",
    baseDC:9, stat:Stat.Klarheit, energyCost:14, stressDelta:10, moneyDelta:0, xpGain:16, tags:["reflect","fam:reflektieren"] }));
  list.push(A({ id:"redflags_sheet", name:"Red Flags", desc:"Eigene Warnsignale notieren.",
    baseDC:8, stat:Stat.Klarheit, energyCost:12, stressDelta:10, moneyDelta:0, xpGain:12, tags:["reflect","fam:reflektieren"] }));
  list.push(A({ id:"future_vision", name:"Zukunftsbild", desc:"3 Kriterien für gesunde Beziehung.",
    baseDC:8, stat:Stat.Klarheit, energyCost:12, stressDelta:8, moneyDelta:0, xpGain:12, tags:["growth","milestone-setup","fam:reflektieren","fam:zukunft"] }));
  list.push(A({ id:"relapse_plan", name:"Rückfall-Plan", desc:"Wenn Impuls X → Handlung Y.",
    baseDC:9, stat:Stat.Klarheit, energyCost:14, stressDelta:10, moneyDelta:0, xpGain:16, tags:["skills","stabilize","fam:reflektieren","fam:zukunft"] }));

  // Abgrenzen / Kontakt (Familie: abgrenzen/kontakt)
  list.push(A({ id:"digital_hygiene", name:"Benachr. stumm", desc:"Mute/Archive setzen.",
    baseDC:7, stat:Stat.Selbstbild, energyCost:6, stressDelta:6, moneyDelta:0, xpGain:8, tags:["contact_mgmt","stabilize","fam:kontakt"] }));
  list.push(A({ id:"no_contact_action", name:"Kein-Kontakt", desc:"1 Schritt ohne Kontakt.",
    baseDC:8, stat:Stat.Grenzen, energyCost:10, stressDelta:10, moneyDelta:0, xpGain:12, tags:["contact_mgmt","milestone-setup","fam:abgrenzen"], cooldown:1 }));
  list.push(A({ id:"return_items", name:"Dinge klären", desc:"Eigene Dinge sichern / Rückgabe regeln.",
    baseDC:10, stat:Stat.Grenzen, energyCost:16, stressDelta:14, moneyDelta:0, xpGain:16, tags:["contact_mgmt","closure","fam:abgrenzen"],
    prereq:(s)=>(s.successTags.get("contact_mgmt")||0)>=2 }));
  list.push(A({ id:"boundary_script", name:"Grenzen sagen", desc:"Zwei Ich-Botschaften formulieren.",
    baseDC:8, stat:Stat.Grenzen, energyCost:12, stressDelta:10, moneyDelta:0, xpGain:14, tags:["boundaries","skills","fam:abgrenzen"] }));
  list.push(A({ id:"support_call", name:"Support-Gespräch", desc:"20 Min sachlich mit Vertrauensperson.",
    baseDC:8, stat:Stat.Selbstbild, energyCost:8, stressDelta:8, moneyDelta:0, xpGain:10, tags:["network","stabilize","fam:kontakt"] }));

  // Routinen (Familie: zukunft)
  list.push(A({ id:"routine_pillar", name:"Routine-Pfeiler", desc:"Tägliche Micro-Routine.",
    baseDC:7, stat:Stat.Regulation, energyCost:10, stressDelta:6, moneyDelta:0, xpGain:10, tags:["stabilize","milestone-setup","fam:zukunft"], cooldown:1 }));

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

/* ========================================================================== */
/*  ENTSCHEIDUNGSLOGIK (Advanced)                                             */
/* ========================================================================== */

// Familie aus Tags ermitteln (erste passende gewinnt)
function familyOf(def){
  const T = def.tags || [];
  if (T.includes("fam:stabilisieren") || T.includes("aftercare") || T.includes("rest")) return "stabilisieren";
  if (T.includes("fam:reflektieren")  || T.includes("reflect")   || T.includes("skills")) return "reflektieren";
  if (T.includes("fam:abgrenzen")     || T.includes("boundaries")) return "abgrenzen";
  if (T.includes("fam:kontakt")       || T.includes("contact_mgmt") || T.includes("closure")) return "kontakt";
  if (T.includes("fam:zukunft")       || T.includes("growth") || T.includes("milestone-setup")) return "zukunft";
  return "reflektieren";
}

// Phase je State
function phaseOf(state){
  if (state.stress >= 60 || state.energy <= 30) return "stabilisierung";
  if ((state.successTags.get("reflect")||0) < 3 || state.xp < 60) return "aufarbeitung";
  return "integration";
}

// Gewichte je Phase (höher = wichtiger)
function phaseCoeffs(phase){
  switch(phase){
    case "stabilisierung": return { xp:0.7, hope:0.8, stress:1.4, energy:1.2, milestone:0.6 };
    case "aufarbeitung":   return { xp:1.2, hope:0.8, stress:0.9, energy:0.7, milestone:1.2 };
    case "integration":    return { xp:1.0, hope:1.0, stress:0.8, energy:0.6, milestone:1.3 };
    default:               return { xp:1.0, hope:1.0, stress:1.0, energy:1.0, milestone:1.0 };
  }
}

// Bias der Phase auf Kartenfamilien (multiplikativ als +x)
function familyPhaseBias(phase, fam){
  const map = {
    stabilisierung: { stabilisieren:+0.50, reflektieren:-0.05, abgrenzen:-0.10, kontakt:-0.10, zukunft:-0.10 },
    aufarbeitung:   { stabilisieren:-0.05, reflektieren:+0.40, abgrenzen:+0.20, kontakt:+0.10, zukunft:+0.10 },
    integration:    { stabilisieren:-0.10, reflektieren:+0.00, abgrenzen:+0.10, kontakt:+0.10, zukunft:+0.50 }
  };
  return (map[phase] && map[phase][fam]) ?? 0;
}

// Risk-Bias je Phase (multiplikativ)
function riskPhaseBias(phase, risk){
  const R = String(risk).toLowerCase();
  const map = {
    stabilisierung: { safe:1.15, medium:0.95, hard:0.75 },
    aufarbeitung:   { safe:0.95, medium:1.05, hard:1.00 },
    integration:    { safe:1.00, medium:1.00, hard:1.05 }
  };
  return (map[phase] && map[phase][R]) ?? 1.0;
}

// DC-Fit (0..1), je näher an Target, desto besser
function dcFit(baseDC, target){ return Math.max(0, Math.min(1, 1 - Math.abs(baseDC - target)/6)); }

// Neuheit aus sinceSeen (leicht positiv, Cap)
function noveltyBonus(state, def){
  const age = state.sinceSeen.get(def.id) ?? 0; // je höher, desto länger nicht gesehen
  return Math.max(-0.10, Math.min(0.25, (age - 3) * 0.03));
}

// Score einer Aktion unter den aktuellen Bedingungen
function scoreAction(state, def, targetDC, risk){
  // Ressourcenwirkungen unter Perks
  const [sAdj, hAdj, xAdj] = applyPerkEconomy(state.perks, def, def.stressDelta, def.moneyDelta, def.xpGain);

  // Gefahrencheck (nicht wählbar, wenn kaputt)
  if ((state.energy - def.energyCost) < 0) return -1e9;
  if ((state.stress + Math.max(0, sAdj)) > 100) return -1e9;

  const phase = phaseOf(state);
  const coeff = phaseCoeffs(phase);
  const fam = familyOf(def);

  // Erfolg wirkt v. a. auf Milestone-Fortschritt → p nur dort nutzen
  const p = successProbability(state, def, def.baseDC) / 100;

  const baseUtility =
      coeff.xp    * xAdj
    + coeff.hope  * hAdj
    - coeff.stress* sAdj
    - coeff.energy* def.energyCost;

  const milestoneScore = coeff.milestone * (def.tags.includes("milestone-setup") ? p * 10 : 0);
  const fit = dcFit(def.baseDC, targetDC);
  const phaseBias = 1 + familyPhaseBias(phase, fam);
  const riskBiasV = riskPhaseBias(phase, risk);
  const novel = noveltyBonus(state, def);
  const jitter = (state.rng() - 0.5) * 0.01; // minimale Streuung

  // Zusammensetzen – Fit als sanfter Multiplikator, Bias multiplicativ
  const score = (baseUtility + milestoneScore) * (0.9 + 0.2*fit) * phaseBias * riskBiasV + novel + jitter;
  return score;
}

/* ========================================================================== */
/*  ENGINE                                                                     */
/* ========================================================================== */

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

function choiceByWeights(rng, weights){ const total=weights.reduce((a,b)=>a+b,0); if(total<=0) return -1; let t=rng()*total,c=0; for(let i=0;i<weights.length;i++){ c+=weights[i]; if(t<=c) return i; } return weights.length-1; }

// NEU: Advanced-Auswahl pro Risiko (argmax Utility)
function pickOptions(state, pool){
  const risks=[Risk.Safe, Risk.Medium, Risk.Hard];
  const targets=new Map([
    [Risk.Safe,   6 + Math.floor(state.rng()*2)],
    [Risk.Medium, 8 + Math.floor(state.rng()*2)],
    [Risk.Hard,  10 + Math.floor(state.rng()*2)]
  ]);

  // Neuheit altern lassen
  const X_NEU=5;
  pool.forEach(def=>{
    state.sinceSeen.set(def.id, (state.sinceSeen.get(def.id) ?? (X_NEU+1)) + 1);
  });

  const out=[];
  for (const risk of risks){
    const target = targets.get(risk);
    // Kandidaten filtern
    const candidates = pool.filter(def=>{
      const cd=state.cooldowns.get(def.id) ?? 0;
      const pathOK = (def.pathRestriction===null) || (def.pathRestriction===state.path);
      return pathOK && def.prereq(state) && cd<=0;
    });
    if (!candidates.length) continue;

    // Argmax nach Score
    let best=null, bestScore=-1e9;
    for (const def of candidates){
      const s = scoreAction(state, def, target, risk);
      if (s > bestScore){ bestScore=s; best={def, risk, targetDC:target, score:s}; }
    }
    if (best){
      state.sinceSeen.set(best.def.id, 0);
      out.push(best);
    }
  }

  // Falls <3, mit Aftercare auffüllen (bestbewertete)
  if (out.length<3){
    const ids=new Set(out.map(o=>o.def.id));
    const fillers = pool.filter(d=>(d.tags.includes("aftercare")||d.tags.includes("rest")) && !ids.has(d.id));
    const target = 6; // soft
    fillers.sort((a,b)=> scoreAction(state,b,target,Risk.Safe) - scoreAction(state,a,target,Risk.Safe));
    for (const f of fillers){ if (out.length>=3) break; out.push({def:f, risk:Risk.Safe, targetDC:target, score:scoreAction(state,f,target,Risk.Safe)}); }
  }

  return out.slice(0,3);
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
  if(state.stress>=70) hints.push("Mehr Erholung/Aftercare (Atmen, Spaziergang, Musik).");
  if((state.successTags.get("reflect")||0)<3) hints.push("Reflexion vertiefen (Journaling, Red Flags, Reframing).");
  if((state.successTags.get("contact_mgmt")||0)<2) hints.push("Kontakt-Management konsistenter halten (Mute/Archive, Kein-Kontakt).");
  if((state.successTags.get("skills")||0)<1) hints.push("Konkrete Skills stärken (Trigger-Karte, Grenzen sagen).");
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

/* ========================================================================== */
/*  UI-BINDING & STARTSCREEN                                                   */
/* ========================================================================== */

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
  CH.loader.registerModule('game','0.11.0');
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
function recomputePool(){ const used = sumStats() - BASELINE_TOTAL; pre.poolLeft = POOL_TOTAL - used; }

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

  elNameOk.textContent = validName() ? "✓" : "✖";
  elNameOk.className = validName() ? "ok" : "danger";

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
      if(pre.poolLeft<=0) return;
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