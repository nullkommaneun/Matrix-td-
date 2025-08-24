/* ============================================================================
   RESET — Spielengine & UI (game.js)  v0.14.0
   - NEU: Attribut→E/S/H-Logik (adjustDeltas) mit Gewichts-Matrix & Boostern
   - Top-3 Vorschläge (XP-first + Safety + Diversity + Hand-Lock)
   - Narrative Log (stories.js), Story-Telemetry im Debug-Panel, CSV-Export
   - Debug-Breakdown pro Karte (mit ?debug=1)
   ============================================================================ */

/* ===== RNG ===== */
function xmur3(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=(h<<13)|(h>>>19);}return function(){h=Math.imul(h^(h>>>16),2246822507);h=Math.imul(h^(h>>>13),3266489909);h^=h>>>16;return h>>>0;};}
function sfc32(a,b,c,d){return function(){a>>>=0;b>>>=0;c>>>=0;d>>>=0;let t=(a+b)|0;a=b^(b>>>9);b=(c+(c<<3))|0;c=(c<<21)|(c>>>11);d=(d+1)|0;t=(t+d)|0;c=(c+t)|0;return (t>>>0)/4294967296;};}
const makeRngFromSeed=(seed)=>{const s=xmur3(seed);return sfc32(s(),s(),s(),s());};
const d10=(rng)=>1+Math.floor(rng()*10);

/* ===== Enums ===== */
const Stat={Selbstbild:"Selbstbild",Regulation:"Regulation",Klarheit:"Klarheit",Grenzen:"Grenzen",Zuversicht:"Zuversicht"};
const Perk={Networker:"Networker",Workhorse:"Workhorse",Analytical:"Analytical",Stoic:"Stoic",Creative:"Creative",LuckyBreak:"LuckyBreak"};
const Path={Aufarbeitung:"Aufarbeitung"};

/* ===== Utils ===== */
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const signStr=(n)=>(n>=0?`+${n}`:`${n}`);
const el=(id)=>document.getElementById(id);
const on=(t,ev,h)=>t&&t.addEventListener(ev,(window.CH?CH.safeWrap(h,t,`${ev}#${t.id||t.tagName}`):h));
const setHTML=(n,html)=>{n.innerHTML=html;};

/* ===== Perk/Luck & Prob ===== */
function perkStatBonus(perks,def){let b=0; if(perks.has(Perk.Analytical)&&def.tags.includes("reflect"))b+=2; if(perks.has(Perk.Networker)&&def.tags.includes("networking"))b+=2; return b;}
function luckShift(z,perks){const base=Math.min(2,Math.floor(z/5)), lucky=(perks.has(Perk.LuckyBreak)&&z<=8)?1:0; return base+lucky;}
function successProbability(state,def,dc){const base=state.stats[def.stat], bonus=perkStatBonus(state.perks,def), ls=luckShift(state.stats.Zuversicht,state.perks); let s=0; for(let r=1;r<=10;r++){const tot=base+bonus+r+ls; if(tot>=dc)s++;} return s*10;}

/* ===== Karten-Import (cards.js) ===== */
function actionsFromCards(payload){
  const raw=(payload&&payload.cards)?payload.cards:[];
  const mapStat=(s)=>{if(Stat[s])return Stat[s];const k=Object.keys(Stat).find(k=>k.toLowerCase()===String(s).toLowerCase());return k?Stat[k]:Stat.Klarheit;};
  return raw.map(c=>{
    const ex=Array.isArray(c.examples)?c.examples.filter(Boolean):[];
    return{
      id:c.id,name:c.title,desc:ex.length?`• ${ex[0]}\n• ${ex[1]||''}`.trim():'',
      baseDC:Number.isFinite(c.dc)?c.dc:7, stat:mapStat(c.stat),
      // Baseline-DELTA (Energie positiv = Gewinn)
      deltaE0: (c.delta?.E||0),
      deltaS0: (c.delta?.S||0),
      deltaH0: (c.delta?.H||0),
      xpGain: Number.isFinite(c.xp)?c.xp:0,
      tags:[...(c.tags||[]),`theme:${c.theme}`,c.positive?'positive':'negative'],
      cooldown:0,pathRestriction:null,prereq:()=>true,onSuccess:()=>{},onFailure:()=>{}
    };
  });
}
function validateCards(actions){
  const ids=new Set();
  for(const a of actions){
    if(!a.id||ids.has(a.id)) throw new Error(`Duplikat/leer: id=${a.id}`); ids.add(a.id);
    if(!Object.keys(Stat).includes(a.stat)) throw new Error(`Unbekannter Stat: ${a.id}`);
    ['baseDC','deltaE0','deltaS0','deltaH0','xpGain'].forEach(k=>{ if(typeof a[k]!=='number'||!Number.isFinite(a[k])) throw new Error(`Zahl erwartet: ${a.id}.${k}`); });
  }
  return true;
}

/* ===== Milestones ===== */
function makeMilestones(){return[
  {id:"clarity",name:"Klarheit gewonnen",path:Path.Aufarbeitung,isPinnacle:false,requirements:s=>(s.successTags.get("reflect")||0)>=3,rewards:s=>s.xp+=20},
  {id:"contact_solid",name:"Kontakt kompakt",path:Path.Aufarbeitung,isPinnacle:false,requirements:s=>(s.successTags.get("contact_mgmt")||0)>=3,rewards:s=>s.perks.add(Perk.Stoic)},
  {id:"triggers_mastered",name:"Trigger-Kompetenz",path:Path.Aufarbeitung,isPinnacle:false,requirements:s=>(s.successTags.get("skills")||0)>=2,rewards:s=>s.money+=50},
  {id:"new_pillars",name:"Neue Pfeiler",path:Path.Aufarbeitung,isPinnacle:true,requirements:s=>(s.successTags.get("milestone-setup")||0)>=4&&s.xp>=80,rewards:s=>s.perks.add(Perk.Creative)}
];}

/* ===== Familie/Gruppierung ===== */
function familyOf(def){
  const T=def.tags||[];
  if(T.includes("fam:stabilisieren")||T.includes("aftercare")||T.includes("rest")) return "stabilisieren";
  if(T.includes("fam:reflektieren") ||T.includes("reflect")||T.includes("skills")) return "reflektieren";
  if(T.includes("fam:abgrenzen")    ||T.includes("boundaries")) return "abgrenzen";
  if(T.includes("fam:kontakt")      ||T.includes("contact_mgmt")||T.includes("closure")) return "kontakt";
  if(T.includes("fam:zukunft")      ||T.includes("growth")||T.includes("milestone-setup")) return "zukunft";
  return "reflektieren";
}
function storyFamily(def){ const f=familyOf(def); return f==="stabilisieren"?"regulation": f==="reflektieren"?"clarity": f==="abgrenzen"?"boundaries": f==="kontakt"?"contact":"future"; }

/* =============================================================================
   NEU: Attribut→E/S/H-Logik
   ------------------------------------------------------------------------- */
const WEIGHTS = {
  stabilisieren: {
    E: [0.05, 0.35, 0.05, 0.00, 0.10],
    S: [0.05, 0.40, 0.05, 0.00, 0.10],
    H: [0.15, 0.10, 0.05, 0.00, 0.15],
  },
  reflektieren: {
    E: [0.00, 0.15, 0.10, 0.00, 0.10],
    S: [0.00, 0.10, 0.25, 0.05, 0.05],
    H: [0.05, 0.00, 0.35, 0.05, 0.15],
  },
  abgrenzen: {
    E: [0.10, 0.10, 0.00, 0.25, 0.05],
    S: [0.10, 0.10, 0.00, 0.35, 0.05],
    H: [0.25, 0.00, 0.05, 0.20, 0.10],
  },
  kontakt: {
    E: [0.10, 0.10, 0.00, 0.10, 0.05],
    S: [0.10, 0.15, 0.00, 0.30, 0.05],
    H: [0.20, 0.00, 0.00, 0.05, 0.15],
  },
  zukunft: {
    E: [0.00, 0.25, 0.05, 0.00, 0.10],
    S: [0.00, 0.20, 0.10, 0.00, 0.05],
    H: [0.10, 0.00, 0.25, 0.00, 0.20],
  }
};
function dot(w,a){let s=0; for(let i=0;i<w.length;i++) s+=w[i]*a[i]; return s;}
function norm(v){return (v-5)/5;} // 1..10 → -0.8..+1.0

/**
 * adjustDeltas(card, state, {forScoring:boolean})
 * - liefert angepasste DELTAS (dE,dS,dH) + xpAdj
 * - berücksichtigt: Attributes, PerkÖkonomie, Booster, Synergien, Streak
 */
function adjustDeltas(state, def, opts={forScoring:false}){
  const fam = familyOf(def);
  const W = WEIGHTS[fam];
  const stats = state.stats;
  const A = [norm(stats.Selbstbild), norm(stats.Regulation), norm(stats.Klarheit), norm(stats.Grenzen), norm(stats.Zuversicht)];

  // 1) Perk-Ökonomie auf S/H/XP anwenden (wie bisher)
  const [sAdjPerk, hAdjPerk, xAdj] = applyPerkEconomy(state.perks, def, def.deltaS0, def.deltaH0, def.xpGain);

  // 2) Förderlichkeit (hE/hS/hH)
  let hE = dot(W.E, A), hS = dot(W.S, A), hH = dot(W.H, A);

  // 3) State-Booster
  if (state.stress >= 70) hS *= 1.20;
  if (state.energy <= 30) hE *= 1.15;

  // Helper
  const gainMult = (h) => clamp(1 + h, 0.6, 1.6);
  const costMult = (h) => clamp(1 - h, 0.6, 1.4);

  // 4) DELTA-Berechnung (E gewinnt positiv, S negativ ist gut)
  let dE = def.deltaE0;                      // Energie-Baseline
  let dS = sAdjPerk;
  let dH = hAdjPerk;

  dE = (dE >= 0) ? dE * gainMult(hE) : dE * costMult(hE);
  dS = (dS <= 0) ? dS * gainMult(hS) : dS * costMult(hS);
  dH = (dH >= 0) ? dH * gainMult(hH) : dH * costMult(hH);

  // Zuversicht hoher Wert -> Hoffnung etwas effizienter
  if (stats.Zuversicht >= 8) dH *= 1.10;

  // 5) Synergien/Reibung
  if (stats.Klarheit >= 7 && stats.Grenzen >= 7 && fam === 'abgrenzen') dH += 1;
  if (stats.Regulation <= 3 && fam === 'reflektieren') dS += 2;

  // 6) Streak-Flow (nur wenn vorherige Karte selbe Familie)
  const prevStreak = (state._streak && state._streak.fam === storyFamily(def) && state._streak.len >= (opts.forScoring?1:1));
  if (prevStreak){ dS *= 0.90; dH *= 1.10; }

  // 7) harte Caps
  dE = Math.sign(dE) >= 0 ? Math.min(dE, 20) : Math.max(dE, -20);
  dS = Math.sign(dS) >= 0 ? Math.min(dS, 20) : Math.max(dS, -20);
  dH = Math.sign(dH) >= 0 ? Math.min(dH, 15) : Math.max(dH, -10);

  return { dE, dS, dH, xAdj };
}

/* ===== Engine Core ===== */
function createState(meta,stats,perks,path,seed){
  const rng=makeRngFromSeed(seed);
  return{meta,stats,perks,path,rng,seed,sandbox:false,noEnds:false,energy:100,stress:0,money:0,xp:0,cooldowns:new Map(),sinceSeen:new Map(),successTags:new Map(),certificates:new Set(),history:[],milestonesAchieved:new Set(),ended:false,endTitle:"",endSummary:""};
}

/* ===== Auswahl (Top-3) + Hand-Lock ===== */
function phaseOf(state){ if(state.stress>=60||state.energy<=30) return "stabilisieren"; if((state.successTags.get("reflect")||0)<3||state.xp<60) return "aufarbeitung"; return "integration"; }
function weightsForPhase(phase){
  if(phase==="stabilisieren")return{w_xp:1.0,w_ms:0.25,w_hope:0.6,w_energy:0.6,w_stress:1.2,w_nov:0.05};
  if(phase==="aufarbeitung") return{w_xp:1.2,w_ms:0.45,w_hope:0.4,w_energy:0.3,w_stress:0.6,w_nov:0.05};
  return                         {w_xp:1.0,w_ms:0.55,w_hope:0.6,w_energy:0.3,w_stress:0.5,w_nov:0.07};
}
function noveltyBonus(state,def){const age=state.sinceSeen.get(def.id)??0;return Math.max(-0.10,Math.min(0.25,(age-3)*0.03));}
function isUnsafeAfter(state, dE, dS){ const eAfter=state.energy + dE; const sAfter=state.stress + Math.max(0,dS); return (eAfter<0)||(sAfter>100); }

function scoreBreakdown(state,def){
  const phase=phaseOf(state), w=weightsForPhase(phase);
  const p = successProbability(state,def,def.baseDC)/100;

  const adj = adjustDeltas(state, def, {forScoring:true});
  const XPexp = p * adj.xAdj;
  const MS = def.tags.includes("milestone-setup") ? p * 10 : 0;

  if (isUnsafeAfter(state, adj.dE, adj.dS)) {
    return { unsafe:true, score:-1e9, phase, fam:familyOf(def) };
  }

  // Score aus erwarteter XP + Ressourcenwirkung
  const score = w.w_xp*XPexp + w.w_ms*MS
              + w.w_hope*Math.max(0, adj.dH)
              + w.w_energy*Math.max(0, adj.dE)
              - w.w_stress*Math.max(0, adj.dS)
              + w.w_nov*noveltyBonus(state,def);

  const energyAfter = state.energy + adj.dE;
  const stressAfter = state.stress + adj.dS;

  return { unsafe:false, score, phase, fam:familyOf(def), p,
           ...adj, energyAfter, stressAfter, weights:w };
}

function pickTop3XP(state,actions){
  actions.forEach(a=>state.sinceSeen.set(a.id,(state.sinceSeen.get(a.id)??6)+1));
  const eligible=actions.filter(a=>(state.cooldowns.get(a.id)||0)<=0 && a.prereq(state));

  const list = (arr)=>arr.map(a=>({def:a,dbg:scoreBreakdown(state,a)}))
                          .filter(x=>!x.dbg.unsafe)
                          .sort((a,b)=>b.dbg.score-a.dbg.score);

  let scored = list(eligible);
  if(scored.length<3){ const all=list(actions), seen=new Set(scored.map(x=>x.def.id)); for(const it of all){ if(seen.has(it.def.id))continue; scored.push(it); seen.add(it.def.id); if(scored.length>=3)break; } }

  const families=new Set(), out=[];
  for(const it of scored){ const fam=it.dbg.fam; if(families.has(fam) && scored.some(x=>!families.has(x.dbg.fam))) continue; out.push(it); families.add(fam); if(out.length===3)break; }
  let i=0; while(out.length<3 && i<scored.length){ if(!out.includes(scored[i])) out.push(scored[i]); i++; }
  out.forEach(x=>state.sinceSeen.set(x.def.id,0));
  return out.map(x=>({def:x.def,risk:"xp",targetDC:x.def.baseDC,score:x.dbg.score,dbg:x.dbg}));
}

/* ===== Narrative / Tone / Streak / Meter ===== */
function getTone(){ try{ return localStorage.getItem('reset.tone') || 'neutral'; }catch{return 'neutral';} }
function timeOfDay(){ const h=new Date().getHours(); if(h>=5&&h<11)return'morgen'; if(h>=11&&h<17)return'mittag'; if(h>=17&&h<23)return'abend'; return'nacht'; }
function updateStreak(state,fam){ state._streak=state._streak||{fam:null,len:0}; if(state._streak.fam===fam)state._streak.len++; else state._streak={fam,len:1}; return state._streak.len; }
function arrow(v){ const m=window.RESET_STORIES.meters; if(v>=+6)return m.up; if(v>+1)return m.sUp; if(v<=-6)return m.down; if(v<-1)return m.sDown; return m.flat; }
function pick(list,rng){ if(!list||!list.length)return''; return list[Math.floor(rng()*list.length)]; }
function expandSyn(s,rng){ return s.replace(/\{syn:([^}]+)\}/g,(_,csv)=>pick(csv.split(',').map(x=>x.trim()),rng)); }
function expandTOD(s,rng){ const bag=window.RESET_STORIES.tod||{}; return s.replace(/\{tod:…\}/g,()=>pick(bag[timeOfDay()]||[],rng)||''); }
function expandPhase(s){ return s.replace(/\{phase:([^}]+)\}/g,''); }
function expandStreak(s,has){ return s.replace(/\{streak:\+\}/g,()=>has?'':''); }
function expandNudge(s,include){ return s.replace(/\{nudge:([^}]+)\}/g,(_,txt)=>include?txt:''); }

function makeNarrative(state,def,res){
  const famKey=storyFamily(def), bag=window.RESET_STORIES, tone=getTone(), rng=state.rng||Math;
  const icon=(bag.icons&&bag.icons[famKey])||'✳️', outcome=res.success?'✅':'✶';
  const pack=(bag.byFamily[famKey]||{})[tone] || (bag.byFamily[famKey]||{}).neutral || {};
  const pool=res.success?(pack.success||[]):(pack.near||[]);
  let lineA=pick(pool,rng)||'', lineB=pick(pool.filter(x=>x!==lineA),rng)||'';
  const hasStreak=(state._streak && state._streak.fam===famKey && state._streak.len>=1);
  const includeNudge=!res.success;
  const expand=(t)=>expandNudge(expandStreak(expandPhase(expandTOD(expandSyn(t,rng))),hasStreak),includeNudge);
  lineA=expand(lineA); lineB=expand(lineB);
  if (hasStreak && window.RESET_STORIES.streakLines[famKey]) {
    const hint = pick(window.RESET_STORIES.streakLines[famKey], rng);
    lineB = lineB ? lineB : hint;
  }
  const E=res.deltas.E,S=res.deltas.S,H=res.deltas.H;
  const meter=`[ E ${arrow(E)} ]  [ S ${arrow(-S)} ]  [ H ${arrow(H)} ]`;
  return [`${icon} ${def.name} ${outcome}`,lineA,(lineB&&lineB!==lineA)?lineB:'',meter].filter(Boolean).join('\n');
}

/* ===== Ausführen & Meta ===== */
function applyAction(state,option){
  const def=option.def;

  // Erfolgsberechnung (wie bisher)
  const last=state.history.slice(-20), succRate=last.length?(last.filter(x=>x).length/last.length):1.0;
  const safety=(succRate<0.40)?1:0;
  const base=state.stats[def.stat], bonus=perkStatBonus(state.perks,def), ls=luckShift(state.stats.Zuversicht,state.perks);
  const roll=d10(state.rng), total=base+bonus+roll+ls, dcEff=Math.max(0,def.baseDC-safety), success=total>=dcEff, margin=total-dcEff;

  // Angepasste Deltas & XP (vor Streak-Update!)
  const adj = adjustDeltas(state, def, {forScoring:false});

  // Apply
  state.energy = clamp(state.energy + adj.dE, 0, 100);
  state.stress = clamp(state.stress + adj.dS, 0, 100);
  state.money  = state.money + adj.dH;
  state.xp     = state.xp + adj.xAdj;

  // Cooldowns ticken (inkl. Hand-Lock)
  if(def.cooldown&&def.cooldown>0) state.cooldowns.set(def.id,def.cooldown);
  for(const [k,v] of [...state.cooldowns.entries()]) state.cooldowns.set(k,Math.max(0,v-1));

  // Erfolgstags
  if(success){ def.tags.forEach(t=>state.successTags.set(t,(state.successTags.get(t)||0)+1)); def.onSuccess(state); }
  else def.onFailure(state);

  // Ends/Milestones
  if(!state.noEnds){ if(state.stress>=100) endGame(state,"Rückfall/Überlastung","Stress bei 100. Mehr Erholung & Grenzen."); else checkMilestones(state); } else state.stress=Math.min(state.stress,99);

  // Streak für nächste Auswahl / Story
  updateStreak(state, storyFamily(def));

  state.history.push(success); if(state.history.length>50)state.history.shift();

  const prob=successProbability(state,def,def.baseDC);
  const tech=`Aktion: ${def.name}. DC=${def.baseDC}, Stat=${def.stat}, Erfolg≈${prob}% · W10=${roll}, Luck+${ls}, Margin ${margin}; Δ: E ${signStr(adj.dE)}, S ${signStr(adj.dS)}, H ${signStr(adj.dH)}, XP +${adj.xAdj}.`;
  if(window.CH){ CH.logger.info(`Aktion ${def.id} → ${success?'Erfolg':'Near'}`,{roll, luckShift:ls, baseStat:base, statBonus:bonus, dc:def.baseDC, dcEff, deltas:adj, prob, margin}); }

  return { success, margin, tech, deltas:{E:adj.dE,S:adj.dS,H:adj.dH}, def };
}

/* ===== Reports/Legacy ===== */
function checkMilestones(state){ if(state.noEnds)return; const ms=makeMilestones().filter(m=>m.path===state.path&&!state.milestonesAchieved.has(m.id)); for(const m of ms){ if(m.requirements(state)){ m.rewards(state); state.milestonesAchieved.add(m.id); if(m.isPinnacle){ endGame(state,`Pinnacle erreicht: ${m.name}`,legacySummary(state)); break; } } } }
function legacySummary(state){ let rank=0; if(["new_pillars"].some(id=>state.milestonesAchieved.has(id)))rank=3000; else if(state.milestonesAchieved.size>=2)rank=2000; else if(state.milestonesAchieved.size>=1)rank=1000; const hope=Math.trunc(state.money), ms=state.milestonesAchieved.size*100, well=(100-state.stress)*5; return `Legacy-Score: ${rank+hope+ms+well}  (Rang=${rank}, Hoffnung=${hope}, Milestones=${ms}, Wohlbefinden=${well}).`; }
function endGame(state,title,summary){ state.ended=true; state.endTitle=title; state.endSummary=summary; }

/* ===== Story-Telemetry & CSV ===== */
const CSV_HEADERS=["ts","seed","name","card_id","card_name","family","success","margin","dE","dS","dH","energy","stress","hope","xp","phase","tone"];
let CSV_ROWS=[CSV_HEADERS.join(",")];
const TELE={byFam:{regulation:0,clarity:0,boundaries:0,contact:0,future:0},success:0,tries:0,xp:0,topCards:new Map()};
function resetTelemetry(state){ CSV_ROWS=[CSV_HEADERS.join(",")]; TELE.byFam={regulation:0,clarity:0,boundaries:0,contact:0,future:0}; TELE.success=0; TELE.tries=0; TELE.xp=0; TELE.topCards.clear(); renderTelemetry(); }
function addTelemetry(state,def,res){
  const famKey=storyFamily(def), tone=getTone(), phase=phaseOf(state);
  TELE.byFam[famKey]=(TELE.byFam[famKey]||0)+1; TELE.tries+=1; if(res.success)TELE.success+=1; TELE.xp+=def.xpGain;
  TELE.topCards.set(def.name,(TELE.topCards.get(def.name)||0)+1);
  const row=[new Date().toISOString(),state.seed,state.meta.name||"",def.id,JSON.stringify(def.name),famKey,res.success?1:0,res.margin,res.deltas.E,res.deltas.S,res.deltas.H,state.energy,state.stress,state.money,state.xp,phase,tone].join(",");
  CSV_ROWS.push(row); renderTelemetry();
}
function renderTelemetry(){ const box=document.getElementById('debug-telemetry'); if(!box) return; const rate=TELE.tries?Math.round(100*TELE.success/TELE.tries):0; const famLines=Object.entries(TELE.byFam).map(([k,v])=>`• ${k}: ${v}`).join("\n"); const tops=[...TELE.topCards.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n,c])=>`• ${n} ×${c}`).join("\n")||"–"; box.textContent=`Story-Telemetry\nErfolg: ${rate}% (${TELE.success}/${TELE.tries})\nXP ca.: ${TELE.xp}\nFamilien:\n${famLines}\n\nTop-Karten:\n${tops}`; }
function downloadCSV(){ const blob=new Blob([CSV_ROWS.join("\n")],{type:"text/csv;charset=utf-8"}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`reset_run_${Date.now()}.csv`; document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove(); }

/* ===== UI ===== */
const elStart=el("start-screen"), elGame=el("game-screen"), elEnd=el("end-screen");
const elName=el("name-input"), elNameOk=el("name-ok"), elGender=el("gender-label"), elGenderToggle=el("gender-toggle");
const elAgeInput=el("age-input"), elSeedInput=el("seed-input"), elSeedDice=el("seed-dice"), elConfirm=el("confirm-btn");
const elPtsLeft=el("pts-left"), elHint=el("start-hint");
const elOptions=el("options"), elLog=el("log"), elStatus=el("status"), elCooldowns=el("cooldowns");
const elRefresh=el("btn-refresh"), elExit=el("btn-exit"), elRestart=el("btn-restart"), elFocus=el("btn-focus"), elDebugOpen=el("btn-debug");

/* ===== Start-Screen ===== */
const NAME_RE=/^[A-Za-zÄÖÜäöüß]{2,20}$/; const BASELINE_TOTAL=25; const POOL_TOTAL=10;
const pre={name:"",gender:"Divers",age:18,stats:{Selbstbild:5,Regulation:5,Klarheit:5,Grenzen:5,Zuversicht:5},poolLeft:POOL_TOTAL};
function sumStats(){const s=pre.stats;return s.Selbstbild+s.Regulation+s.Klarheit+s.Grenzen+s.Zuversicht;}
function recomputePool(){const used=sumStats()-BASELINE_TOTAL; pre.poolLeft=POOL_TOTAL-used;}
function validName(){return NAME_RE.test(pre.name);} function validAge(){const n=Number(elAgeInput.value);return Number.isInteger(n)&&n>=10&&n<=99;}
function canStart(){const ok=Object.values(pre.stats).every(v=>v>=1&&v<=10);return validName()&&validAge()&&ok&&pre.poolLeft===0;}
function updateStartUI(){
  elName.value=pre.name; elGender.textContent=pre.gender; elAgeInput.value=pre.age;
  el("stat-Selbstbild").textContent=pre.stats.Selbstbild; el("stat-Regulation").textContent=pre.stats.Regulation; el("stat-Klarheit").textContent=pre.stats.Klarheit; el("stat-Grenzen").textContent=pre.stats.Grenzen; el("stat-Zuversicht").textContent=pre.stats.Zuversicht;
  recomputePool(); elPtsLeft.textContent=pre.poolLeft; elPtsLeft.classList.toggle('ok',pre.poolLeft===0); elPtsLeft.classList.toggle('danger',pre.poolLeft<0);
  elNameOk.textContent=validName()?"✓":"✖"; elNameOk.className=validName()?"ok":"danger";
  const miss=[]; if(!validName())miss.push("Name (2–20, nur Buchstaben)"); if(!validAge())miss.push("Alter (10–99)"); if(pre.poolLeft!==0)miss.push(`${Math.abs(pre.poolLeft)} Punkt(e) ${pre.poolLeft>0?'zu verteilen':'zu viel'}`);
  elHint.textContent=miss.length?("Fehlt: "+miss.join(" · ")):"Alles bereit."; elConfirm.disabled=!canStart();
}
function toStart(){
  pre.name=""; pre.gender="Divers"; pre.age=18; pre.stats={Selbstbild:5,Regulation:5,Klarheit:5,Grenzen:5,Zuversicht:5}; pre.poolLeft=POOL_TOTAL; elSeedInput.value="";
  updateStartUI(); elStart.classList.remove("hidden"); elGame.classList.add("hidden"); elEnd.classList.add("hidden");
  setHTML(elLog,""); document.body.classList.remove("focus"); if(elFocus)elFocus.textContent="FOKUS: AUS";
  resetTelemetry(GAME||{}); if(window.CH) CH.logger.info('Zurück zum Start.');
}
document.querySelectorAll("button[data-stat]").forEach(btn=>{on(btn,"click",()=>{const s=btn.getAttribute("data-stat"),d=parseInt(btn.getAttribute("data-delta"),10),cur=pre.stats[s]; if(d>0){recomputePool(); if(pre.poolLeft<=0||cur>=10)return; pre.stats[s]=Math.min(10,cur+1);} else {if(cur<=1)return; pre.stats[s]=Math.max(1,cur-1);} updateStartUI();});});
on(elName,"input",()=>{pre.name=(elName.value||"").trim();updateStartUI();});
on(elGenderToggle,"click",()=>{pre.gender=pre.gender==="Männlich"?"Weiblich":(pre.gender==="Weiblich"?"Divers":"Männlich");updateStartUI();});
on(elAgeInput,"input",()=>{const n=Number(elAgeInput.value);pre.age=Number.isFinite(n)?n:pre.age;updateStartUI();});
on(elSeedDice,"click",()=>{elSeedInput.value=String(Date.now());});

/* ===== Daten ===== */
const ACTIONS=actionsFromCards(window.RESET_CARDS||{});
if(window.CH){try{validateCards(ACTIONS);CH.loader.checkActions(ACTIONS,Stat);}catch(e){CH.diagnostics.recordError(e,'cards-validate');}}

/* ===== Rendering Top-3 & Debug ===== */
const SHOW_CARD_DEBUG=!!(window.CH&&CH.config&&CH.config.debug);
const HAND_LOCK_TURNS=2; let CURRENT_HAND=[];
function eshBoxes(dE,dS,dH){return `<div class="meta" style="margin-top:6px">[ E ${signStr(dE)} ]  [ S ${signStr(dS)} ]  [ H ${signStr(dH)} ]</div>`;}
function debugBlock(def,dbg){ if(!SHOW_CARD_DEBUG||!dbg||dbg.unsafe)return''; const cd=(GAME&&GAME.cooldowns.get(def.id))||0, age=(GAME&&GAME.sinceSeen.get(def.id))||0; const f=x=>(typeof x==='number'?Math.round(x*100)/100:x); return `<details class="meta" style="margin-top:6px" open><summary>Debug</summary><div class="meta">Phase: <strong>${dbg.phase}</strong> · Familie: ${dbg.fam} · cd=${cd} · seen=${age}</div><div class="meta">p=${f(dbg.p)} · XPexp=${f(dbg.xAdj*dbg.p)} · MS=${f(dbg.score)} (inkl. Ressourcen)</div><div class="meta">Δ: E=${f(dbg.dE)} · S=${f(dbg.dS)} · H=${f(dbg.dH)} → after: E=${f(dbg.energyAfter)} · S=${f(dbg.stressAfter)}</div></details>`;}
function interactiveCard(opt){
  const def=opt.def, dbg=opt.dbg||scoreBreakdown(GAME,def);
  const prob = (typeof GAME==='object'&&GAME) ? successProbability(GAME,def,def.baseDC) : null;
  const lines=(def.desc||'').split('\n').filter(Boolean);
  const div=document.createElement("div"); div.className="option-card";
  div.innerHTML=`<h4 style="margin:0 0 6px;">${def.name}</h4>
    <div class="meta">Stat: ${def.stat} · DC: ${def.baseDC}${prob===null?'':` · Erfolgschance: ${prob}%`}</div>
    <div class="details" style="margin:6px 0 0;">
      <div class="muted">${lines.map(x=>x.startsWith('•')?x:`• ${x}`).join('<br>')}</div>
      ${eshBoxes(dbg.dE, dbg.dS, dbg.dH)}
      ${debugBlock(def, dbg)}
    </div>
    <div style="margin-top:8px"><button class="primary">Ausführen</button></div>`;
  div.querySelector("button.primary").addEventListener("click",()=>{
    CURRENT_HAND.forEach(id=>{const cur=GAME.cooldowns.get(id)||0; GAME.cooldowns.set(id,Math.max(cur,HAND_LOCK_TURNS));});
    const res=applyAction(GAME,{def,risk:"xp",targetDC:def.baseDC});
    const story=makeNarrative(GAME,def,res);
    const li=document.createElement('div'); li.style.whiteSpace='pre-wrap'; li.textContent=story;
    if(SHOW_CARD_DEBUG){ const sub=document.createElement('div'); sub.className='meta'; sub.textContent=res.tech; li.appendChild(sub); }
    elLog.prepend(li);
    addTelemetry(GAME,def,res);
    if(GAME.ended) showEnd(); else { renderTop3(); renderStatus(); renderCooldowns(); }
  });
  return div;
}
function renderTop3(){ const top=pickTop3XP(GAME,ACTIONS); elOptions.innerHTML=""; top.forEach(o=>elOptions.appendChild(interactiveCard(o))); CURRENT_HAND=top.map(o=>o.def.id); }

/* ===== Start / Status / Buttons ===== */
let GAME=null;
function startGame(){
  const seed=(elSeedInput.value||(`${pre.name}#${pre.age}`)).trim();
  GAME=createState({name:pre.name,gender:pre.gender,age:pre.age,background:"Neutral"},{...pre.stats},new Set(),Path.Aufarbeitung,seed);
  resetTelemetry(GAME);
  if(window.CH){ CH.logger.info('Spielstart',{seed,stats:GAME.stats,meta:GAME.meta}); CH.diagnostics.setStateSupplier(()=>({seed:GAME.seed,meta:GAME.meta,resources:{energy:GAME.energy,stress:GAME.stress,hope:GAME.money,xp:GAME.xp},ended:GAME.ended,milestones:[...GAME.milestonesAchieved],successTags:Object.fromEntries(GAME.successTags),historyLen:GAME.history.length})); }
  elStart.classList.add("hidden"); elGame.classList.remove("hidden");
  renderTop3(); renderStatus(); renderCooldowns();
}
function renderStatus(){
  const s=GAME;
  setHTML(elStatus, `<div><strong>${s.meta.name}</strong> · ${s.meta.age} · ${s.meta.gender}</div>
    <div>Energie: <strong>${s.energy}</strong> &nbsp; Stress: <strong>${s.stress}</strong> &nbsp; Hoffnung: <strong>${s.money}</strong> &nbsp; Einsicht (XP): <strong>${s.xp}</strong></div>
    <div>Pfad: <span class="pill">Aufarbeitung</span> &nbsp; <span class="muted">v${window.CH?CH.VERSION:'—'} · Build ${window.CH?CH.BUILD:'—'}</span></div>
    <div>Perks: ${s.perks.size?[...s.perks].join(", "):"–"}</div>
    <div>Meilensteine: ${s.milestonesAchieved.size?[...s.milestonesAchieved].join(", "):"–"}</div>`);
}
function renderCooldowns(){ const lines=[]; for(const[k,v]of GAME.cooldowns.entries()) if(v>0)lines.push(`• ${k}: ${v} Aktionen`); setHTML(elCooldowns,lines.length?lines.join("<br>"):"Keine."); }

on(elConfirm,"click",startGame);
on(elRefresh,"click",()=>renderTop3());
on(elExit,"click",()=>{ endGame(GAME,"Freiwilliger Abschluss",legacySummary(GAME)); showEnd(); });
on(elRestart,"click",()=>toStart());
on(elFocus,"click",()=>{ document.body.classList.toggle("focus"); const onState=document.body.classList.contains("focus"); elFocus.textContent=`FOKUS: ${onState?"AN":"AUS"}`; if(GAME) renderTop3(); });
on(elDebugOpen,"click",()=>{ if(window.CH&&CH.ui) CH.ui.open(); renderTelemetry(); });

/* ===== Endscreen ===== */
const elEndTitle=el("end-title"), elEndSummary=el("end-summary"), elToStart=el("btn-to-start");
function buildReport(state){const total=state.history.length||1,succ=state.history.filter(Boolean).length,rate=Math.round((succ/total)*100);
  const entries=[...state.successTags.entries()].sort((a,b)=>b[1]-a[1]); const top=entries.slice(0,5).map(([k,v])=>`${k}: ${v}`).join(", ")||"–";
  const ms=state.milestonesAchieved.size?[...state.milestonesAchieved].join(", "):"–"; const hints=[];
  if(state.stress>=70)hints.push("Mehr Aftercare (Atmen, Spaziergang, Musik).");
  if((state.successTags.get("reflect")||0)<3)hints.push("Reflexion vertiefen (Journaling, Red Flags, Reframing).");
  if((state.successTags.get("contact_mgmt")||0)<2)hints.push("Kontakt-Management (Mute/Archive, Kein-Kontakt).");
  if((state.successTags.get("skills")||0)<1)hints.push("Skills (Trigger-Karte, Grenzen).");
  if((state.successTags.get("milestone-setup")||0)>=4)hints.push("Zukunftsbild/Routinen festigen.");
  return[`Erfolgsrate: ${rate}% (${succ}/${total})`,`Meilensteine: ${ms}`,`Fortschritte: ${top}`,hints.length?`Nächste Schritte:\n• ${hints.join("\n• ")}`:"Nächste Schritte: –"].join("\n");
}
function showEnd(){
  elGame.classList.add("hidden"); elEnd.classList.remove("hidden");
  elEndTitle.textContent=GAME.endTitle; elEndSummary.textContent=GAME.endSummary;
  const rep=el("end-report"); if(rep) setHTML(rep, buildReport(GAME));
  const btnCont=el("btn-continue"), btnReseed=el("btn-reseed"), btnDl=el("btn-download"), btnMdc=el("btn-mdc");
  if(btnCont) btnCont.onclick=()=>{ GAME.sandbox=true; GAME.noEnds=true; GAME.ended=false; GAME.energy=Math.max(GAME.energy,30); GAME.stress=Math.min(GAME.stress,95); elEnd.classList.add("hidden"); elGame.classList.remove("hidden"); renderTop3(); renderStatus(); renderCooldowns(); };
  if(btnReseed) btnReseed.onclick=()=>{ const same=GAME.seed||(""+Date.now()); toStart(); elSeedInput.value=same; };
  if(btnDl) btnDl.onclick=()=>{ const fname=`reset_run_${(GAME.seed||'seed')}.json`; const blob=new Blob([JSON.stringify({run:sessionAsJSON(GAME), csv:CSV_ROWS.join("\n")},null,2)],{type:"application/json"}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=fname; document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove(); };
  const btnExport=document.getElementById('debug-export'); if(btnExport) btnExport.onclick=downloadCSV;
  if(elToStart) elToStart.onclick=()=>toStart();
}

/* ===== Init ===== */
if(window.CH&&CH.loader){ CH.loader.registerModule('game','0.14.0'); CH.loader.ready(CH.safeWrap(()=>{ toStart(); CH.logger.info('Game-UI initialisiert.'); },null,'boot')); } else { document.addEventListener('DOMContentLoaded',()=>toStart()); }