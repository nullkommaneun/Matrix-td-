/* ============================================================================
   RESET — Spielengine & UI (game.js)  v0.12.1
   - Liest Content aus cards.js (window.RESET_CARDS)
   - Linke Spalte zeigt ALLE Karten (interaktiv, klickbar)
   - Keine Tag-Ausgabe im UI
   ============================================================================ */

/* RNG */
function xmur3(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=(h<<13)|(h>>>19);}return function(){h=Math.imul(h^(h>>>16),2246822507);h=Math.imul(h^(h>>>13),3266489909);h^=h>>>16;return h>>>0;};}
function sfc32(a,b,c,d){return function(){a>>>=0;b>>>=0;c>>>=0;d>>>=0;let t=(a+b)|0;a=b^(b>>>9);b=(c+(c<<3))|0;c=(c<<21)|(c>>>11);d=(d+1)|0;t=(t+d)|0;c=(c+t)|0;return (t>>>0)/4294967296;};}
const makeRngFromSeed=(seed)=>{const s=xmur3(seed);return sfc32(s(),s(),s(),s());};
const d10=(rng)=>1+Math.floor(rng()*10);

/* Enums */
const Stat={Selbstbild:"Selbstbild",Regulation:"Regulation",Klarheit:"Klarheit",Grenzen:"Grenzen",Zuversicht:"Zuversicht"};
const Perk={Networker:"Networker",Workhorse:"Workhorse",Analytical:"Analytical",Stoic:"Stoic",Creative:"Creative",LuckyBreak:"LuckyBreak"};
const Path={Aufarbeitung:"Aufarbeitung"};
const Risk={Safe:"Safe",Medium:"Medium",Hard:"Hard"};

/* Helpers */
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const signStr=(n)=>(n>=0?`+${n}`:`${n}`);
const el=(id)=>document.getElementById(id);
const on=(t,ev,h)=>t&&t.addEventListener(ev,(window.CH?CH.safeWrap(h,t,`${ev}#${t.id||t.tagName}`):h));
const setHTML=(n,html)=>{n.innerHTML=html;};

/* Perk/Luck & Prob */
function perkStatBonus(perks,def){let b=0;if(perks.has(Perk.Analytical)&&def.tags.includes("reflect"))b+=2;if(perks.has(Perk.Networker)&&def.tags.includes("networking"))b+=2;return b;}
function luckShift(z,perks){const base=Math.min(2,Math.floor(z/5));const lucky=(perks.has(Perk.LuckyBreak)&&z<=8)?1:0;return base+lucky;}
function successProbability(state,def,dc){const base=state.stats[def.stat];const bonus=perkStatBonus(state.perks,def);const ls=luckShift(state.stats.Zuversicht,state.perks);let s=0;for(let r=1;r<=10;r++){const tot=base+bonus+r+ls;if(tot>=dc)s++;}return s*10;}

/* Karten-Import (aus cards.js) */
function actionsFromCards(payload){
  const raw=(payload&&payload.cards)?payload.cards:[];
  const mapStat=(s)=>{if(Stat[s])return Stat[s];const k=Object.keys(Stat).find(k=>k.toLowerCase()===String(s).toLowerCase());return k?Stat[k]:Stat.Klarheit;};
  return raw.map(c=>{
    const ex=Array.isArray(c.examples)?c.examples.filter(Boolean):[];
    return{
      id:c.id,
      name:c.title,
      desc:ex.length?`• ${ex[0]}\n• ${ex[1]||""}`.trim():"",
      baseDC:Number.isFinite(c.dc)?c.dc:7,
      stat:mapStat(c.stat),
      energyCost:-(c.delta?.E||0),
      stressDelta:(c.delta?.S||0),
      moneyDelta:(c.delta?.H||0),
      xpGain:Number.isFinite(c.xp)?c.xp:0,
      tags:[...(c.tags||[]),`theme:${c.theme}`,c.positive?"positive":"negative"],
      cooldown:0,pathRestriction:null,prereq:()=>true,onSuccess:()=>{},onFailure:()=>{}
    };
  });
}
function validateCards(actions){
  const ids=new Set();
  for(const a of actions){
    if(!a.id||ids.has(a.id))throw new Error(`Duplikat/leer: id=${a.id}`); ids.add(a.id);
    if(!Object.keys(Stat).includes(a.stat))throw new Error(`Unbekannter Stat: ${a.id}`);
    ['baseDC','energyCost','stressDelta','moneyDelta','xpGain'].forEach(k=>{
      if(typeof a[k]!=='number'||!Number.isFinite(a[k]))throw new Error(`Zahl erwartet: ${a.id}.${k}`);
    });
  }
  return true;
}

/* Milestones */
function makeMilestones(){return[
  {id:"clarity",name:"Klarheit gewonnen",desc:"Muster & Werte benannt.",path:Path.Aufarbeitung,isPinnacle:false,requirements:s=>(s.successTags.get("reflect")||0)>=3,rewards:s=>s.xp+=20},
  {id:"contact_solid",name:"Kontakt kompakt",desc:"Mehrere Kontakt-Management-Schritte.",path:Path.Aufarbeitung,isPinnacle:false,requirements:s=>(s.successTags.get("contact_mgmt")||0)>=3,rewards:s=>s.perks.add(Perk.Stoic)},
  {id:"triggers_mastered",name:"Trigger-Kompetenz",desc:"Trigger-Karte + Grenzen-Script.",path:Path.Aufarbeitung,isPinnacle:false,requirements:s=>(s.successTags.get("skills")||0)>=2,rewards:s=>s.money+=50},
  {id:"new_pillars",name:"Neue Pfeiler",desc:"Routinen etabliert, Zukunftsbild skizziert.",path:Path.Aufarbeitung,isPinnacle:true,requirements:s=>(s.successTags.get("milestone-setup")||0)>=4&&s.xp>=80,rewards:s=>s.perks.add(Perk.Creative)}
];}

/* Familien/Gruppierung (für Anzeige) */
function familyOf(def){
  const T=def.tags||[];
  if(T.includes("fam:stabilisieren")||T.includes("aftercare")||T.includes("rest"))return"stabilisieren";
  if(T.includes("fam:reflektieren")||T.includes("reflect")||T.includes("skills"))return"reflektieren";
  if(T.includes("fam:abgrenzen")||T.includes("boundaries"))return"abgrenzen";
  if(T.includes("fam:kontakt")||T.includes("contact_mgmt")||T.includes("closure"))return"kontakt";
  if(T.includes("fam:zukunft")||T.includes("growth")||T.includes("milestone-setup"))return"zukunft";
  return"reflektieren";
}

/* Engine core */
function createState(meta,stats,perks,path,seed){
  const rng=makeRngFromSeed(seed);
  return{meta,stats,perks,path,rng,seed,sandbox:false,noEnds:false,energy:100,stress:0,money:0,xp:0,cooldowns:new Map(),sinceSeen:new Map(),successTags:new Map(),certificates:new Set(),history:[],milestonesAchieved:new Set(),ended:false,endTitle:"",endSummary:""};
}
function applyPerkEconomy(perks,def,s,h,x){
  if(perks.has(Perk.Workhorse)&&def.tags.includes("stabilize")){s=Math.trunc(s*0.85);h=Math.trunc(h*1.10);}
  if(perks.has(Perk.Stoic)&&s>0)s=Math.trunc(s*0.90);
  if(perks.has(Perk.Creative)&&def.tags.includes("growth"))x=Math.trunc(x*1.10);
  return[s,h,x];
}
function applyAction(state,option){
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

  if(def.cooldown&&def.cooldown>0)state.cooldowns.set(def.id,def.cooldown);
  for(const[k,v]of[...state.cooldowns.entries()])state.cooldowns.set(k,Math.max(0,v-1));

  if(success){def.tags.forEach(t=>state.successTags.set(t,(state.successTags.get(t)||0)+1));def.onSuccess(state);} else def.onFailure(state);

  if(!state.noEnds){ if(state.stress>=100) endGame(state,"Rückfall/Überlastung","Stress bei 100. Mehr Erholung & Grenzen."); else checkMilestones(state); }
  else state.stress=Math.min(state.stress,99);

  state.history.push(success); if(state.history.length>50)state.history.shift();

  if(window.CH){const prob=successProbability(state,def,def.baseDC); CH.logger.info(`Aktion ${def.id} → ${success?'Erfolg':'Fail'}`,{roll, luckShift:ls, baseStat:base, statBonus:bonus, dc:def.baseDC, dcEff, energyCost:def.energyCost, stressAdj:sAdj, hopeAdj:hAdj, xpAdj:xAdj, prob});}

  const prob=successProbability(state,def,def.baseDC);
  let msg=`Aktion: ${def.name}. DC=${def.baseDC}, Stat=${def.stat}, Erfolg≈${prob}% · W10=${roll}, Luck +${ls}, Stat ${def.stat} ${base}`;
  if(bonus)msg+=` (+Perk ${bonus})`;
  if(safety===1)msg+=`, Sicherheitsnetz −1 DC`;
  msg+=` → Summe=${total} ${success?'≥':'<'} ${dcEff} → ${success?'Erfolg':'Misserfolg'}; Δ: E ${signStr(-def.energyCost)}, S ${signStr(sAdj)}, H ${signStr(hAdj)}, XP +${xAdj}.`;
  return msg;
}
function checkMilestones(state){
  if(state.noEnds)return;
  const ms=makeMilestones().filter(m=>m.path===state.path&&!state.milestonesAchieved.has(m.id));
  for(const m of ms){
    if(m.requirements(state)){ m.rewards(state); state.milestonesAchieved.add(m.id);
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
function endGame(state,title,summary){state.ended=true;state.endTitle=title;state.endSummary=summary;}

/* Reports/Export */
function buildReport(state){
  const total=state.history.length||1, succ=state.history.filter(Boolean).length, rate=Math.round((succ/total)*100);
  const entries=[...state.successTags.entries()].sort((a,b)=>b[1]-a[1]), top=entries.slice(0,5).map(([k,v])=>`${k}: ${v}`).join(", ")||"–";
  const ms=state.milestonesAchieved.size?[...state.milestonesAchieved].join(", "):"–";
  const hints=[]; if(state.stress>=70)hints.push("Mehr Aftercare (Atmen, Spaziergang, Musik).");
  if((state.successTags.get("reflect")||0)<3)hints.push("Reflexion vertiefen (Journaling, Red Flags, Reframing).");
  if((state.successTags.get("contact_mgmt")||0)<2)hints.push("Kontakt-Management (Mute/Archive, Kein-Kontakt).");
  if((state.successTags.get("skills")||0)<1)hints.push("Skills (Trigger-Karte, Grenzen).");
  if((state.successTags.get("milestone-setup")||0)>=4)hints.push("Zukunftsbild/Routinen festigen.");
  return[`Erfolgsrate: ${rate}% (${succ}/${total})`,`Meilensteine: ${ms}`,`Fortschritte: ${top}`,hints.length?`Nächste Schritte:\n• ${hints.join("\n• ")}`:"Nächste Schritte: –"].join("\n");
}
function sessionAsJSON(state){
  const obj={seed:state.seed,sandbox:state.sandbox,summary:{endTitle:state.endTitle,endSummary:state.endSummary,legacy:legacySummary(state)},meta:state.meta,stats:state.stats,resources:{energy:state.energy,stress:state.stress,hope:state.money,xp:state.xp},milestones:[...state.milestonesAchieved],successTags:Object.fromEntries(state.successTags),history:state.history};
  return JSON.stringify(obj,null,2);
}
function downloadText(filename,text){const blob=new Blob([text],{type:"application/json"});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();URL.revokeObjectURL(a.href);a.remove();}

/* UI Elemente */
const elStart=el("start-screen"), elGame=el("game-screen"), elEnd=el("end-screen");
const elName=el("name-input"), elNameOk=el("name-ok"), elGender=el("gender-label"), elGenderToggle=el("gender-toggle");
const elAgeInput=el("age-input"), elSeedInput=el("seed-input"), elSeedDice=el("seed-dice"), elConfirm=el("confirm-btn");
const elPtsLeft=el("pts-left"), elHint=el("start-hint");
const elOptions=el("options"), elLog=el("log"), elStatus=el("status"), elCooldowns=el("cooldowns");
const elRefresh=el("btn-refresh"), elExit=el("btn-exit"), elRestart=el("btn-restart"), elFocus=el("btn-focus"), elDebugOpen=el("btn-debug");
const elEndTitle=el("end-title"), elEndSummary=el("end-summary"), elToStart=el("btn-to-start");

/* Start-Screen / Attribute */
const NAME_RE=/^[A-Za-zÄÖÜäöüß]{2,20}$/; const BASELINE_TOTAL=25; const POOL_TOTAL=10;
const pre={name:"",gender:"Divers",age:18,stats:{Selbstbild:5,Regulation:5,Klarheit:5,Grenzen:5,Zuversicht:5},poolLeft:POOL_TOTAL};
function sumStats(){const s=pre.stats;return s.Selbstbild+s.Regulation+s.Klarheit+s.Grenzen+s.Zuversicht;}
function recomputePool(){const used=sumStats()-BASELINE_TOTAL;pre.poolLeft=POOL_TOTAL-used;}
function validName(){return NAME_RE.test(pre.name);} function validAge(){const n=Number(elAgeInput.value);return Number.isInteger(n)&&n>=10&&n<=99;}
function canStart(){const ok=Object.values(pre.stats).every(v=>v>=1&&v<=10);return validName()&&validAge()&&ok&&pre.poolLeft===0;}
function updateStartUI(){
  elName.value=pre.name; elGender.textContent=pre.gender; elAgeInput.value=pre.age;
  el("stat-Selbstbild").textContent=pre.stats.Selbstbild; el("stat-Regulation").textContent=pre.stats.Regulation;
  el("stat-Klarheit").textContent=pre.stats.Klarheit; el("stat-Grenzen").textContent=pre.stats.Grenzen; el("stat-Zuversicht").textContent=pre.stats.Zuversicht;
  recomputePool(); elPtsLeft.textContent=pre.poolLeft; elPtsLeft.classList.toggle('ok',pre.poolLeft===0); elPtsLeft.classList.toggle('danger',pre.poolLeft<0);
  elNameOk.textContent=validName()?"✓":"✖"; elNameOk.className=validName()?"ok":"danger";
  const miss=[]; if(!validName())miss.push("Name"); if(!validAge())miss.push("Alter"); if(pre.poolLeft!==0)miss.push(`${Math.abs(pre.poolLeft)} Punkt(e) ${pre.poolLeft>0?'zu verteilen':'zu viel'}`);
  elHint.textContent=miss.length?("Fehlt: "+miss.join(" · ")):"Alles bereit."; elConfirm.disabled=!canStart();
}
function toStart(){pre.name="";pre.gender="Divers";pre.age=18;pre.stats={Selbstbild:5,Regulation:5,Klarheit:5,Grenzen:5,Zuversicht:5};pre.poolLeft=POOL_TOTAL;elSeedInput.value="";updateStartUI();elStart.classList.remove("hidden");elGame.classList.add("hidden");elEnd.classList.add("hidden");setHTML(elLog,"");document.body.classList.remove("focus");if(elFocus)elFocus.textContent="FOKUS: AUS";if(window.CH)CH.logger.info('Zurück zum Start.');}
document.querySelectorAll("button[data-stat]").forEach(btn=>{on(btn,"click",()=>{const s=btn.getAttribute("data-stat"),d=parseInt(btn.getAttribute("data-delta"),10),cur=pre.stats[s];if(d>0){recomputePool();if(pre.poolLeft<=0||cur>=10)return;pre.stats[s]=Math.min(10,cur+1);}else{if(cur<=1)return;pre.stats[s]=Math.max(1,cur-1);}updateStartUI();});});
on(elName,"input",()=>{pre.name=(elName.value||"").trim();updateStartUI();});
on(elGenderToggle,"click",()=>{pre.gender=pre.gender==="Männlich"?"Weiblich":(pre.gender==="Weiblich"?"Divers":"Männlich");updateStartUI();});
on(elAgeInput,"input",()=>{const n=Number(elAgeInput.value);pre.age=Number.isFinite(n)?n:pre.age;updateStartUI();});
on(elSeedDice,"click",()=>{elSeedInput.value=String(Date.now());});

/* Karten laden */
const ACTIONS=actionsFromCards(window.RESET_CARDS||{});
if(window.CH){try{validateCards(ACTIONS);CH.loader.checkActions(ACTIONS,Stat);}catch(e){CH.diagnostics.recordError(e,'cards-validate');}}

/* INTERAKTIVE KATALOG-ANSICHT (alle Karten, klickbar) */
function eshBoxes(a){const E=-a.energyCost,S=a.stressDelta,H=a.moneyDelta;return `<div class="meta" style="margin-top:6px">[ E ${signStr(E)} ] &nbsp; [ S ${signStr(S)} ] &nbsp; [ H ${signStr(H)} ]</div>`;}
function interactiveCard(def){
  const div=document.createElement("div"); div.className="option-card";
  const prob=(typeof GAME==='object'&&GAME)?successProbability(GAME,def,def.baseDC):null;
  const lines=(def.desc||'').split('\n').filter(Boolean);
  div.innerHTML=`
    <h4 style="margin:0 0 6px;">${def.name}</h4>
    <div class="meta">Stat: ${def.stat} · DC: ${def.baseDC}${prob===null?"":` · Erfolgschance: ${prob}%`}</div>
    <div class="details" style="margin:6px 0 0;">
      <div class="muted">${lines.map(x=>x.startsWith('•')?x:`• ${x}`).join('<br>')}</div>
      ${eshBoxes(def)}
    </div>
    <div style="margin-top:8px"><button class="primary">Ausführen</button></div>
  `;
  div.querySelector("button.primary").addEventListener("click",()=>{
    const entry=applyAction(GAME,{def,risk:"manual",targetDC:def.baseDC});
    const li=document.createElement('div'); li.textContent='• '+entry; elLog.prepend(li);
    if(GAME.ended)showEnd(); else { renderAllCards(); renderStatus(); renderCooldowns(); }
  });
  return div;
}
function renderAllCards(){
  const container=elOptions; container.innerHTML="";
  const labels={stabilisieren:"Stabilisieren",reflektieren:"Reflektieren",abgrenzen:"Abgrenzen",kontakt:"Kontakt",zukunft:"Zukunft"};
  const order=["stabilisieren","reflektieren","abgrenzen","kontakt","zukunft"];
  const byFam=new Map(); for(const a of ACTIONS){const f=familyOf(a); if(!byFam.has(f))byFam.set(f,[]); byFam.get(f).push(a);}
  for(const fam of order){
    const list=(byFam.get(fam)||[]).slice().sort((a,b)=>(a.baseDC-b.baseDC)||a.name.localeCompare(b.name,'de'));
    if(!list.length)continue;
    const h=document.createElement('h4'); h.style.margin="6px 0"; h.textContent=labels[fam]; const sep=document.createElement('div'); sep.className='sep';
    container.appendChild(h); container.appendChild(sep);
    list.forEach(a=>container.appendChild(interactiveCard(a)));
    const sep2=document.createElement('div'); sep2.className='sep'; container.appendChild(sep2);
  }
}

/* Spielstart & Status */
let GAME=null;
function startGame(){
  const seed=(elSeedInput.value||(`${pre.name}#${pre.age}`)).trim();
  GAME=createState({name:pre.name,gender:pre.gender,age:pre.age,background:"Neutral"},{...pre.stats},new Set(),Path.Aufarbeitung,seed);
  if(window.CH){CH.logger.info('Spielstart',{seed,stats:GAME.stats,meta:GAME.meta});CH.diagnostics.setStateSupplier(()=>({seed:GAME.seed,meta:GAME.meta,resources:{energy:GAME.energy,stress:GAME.stress,hope:GAME.money,xp:GAME.xp},ended:GAME.ended,milestones:[...GAME.milestonesAchieved],successTags:Object.fromEntries(GAME.successTags),historyLen:GAME.history.length}));}
  elStart.classList.add("hidden"); elGame.classList.remove("hidden");
  renderAllCards(); renderStatus(); renderCooldowns();
}
function renderStatus(){
  const s=GAME;
  setHTML(elStatus,`
    <div><strong>${s.meta.name}</strong> · ${s.meta.age} · ${s.meta.gender}</div>
    <div>Energie: <strong>${s.energy}</strong> &nbsp; Stress: <strong>${s.stress}</strong> &nbsp; Hoffnung: <strong>${s.money}</strong> &nbsp; Einsicht (XP): <strong>${s.xp}</strong></div>
    <div>Pfad: <span class="pill">Aufarbeitung</span> &nbsp; <span class="muted">v${window.CH?CH.VERSION:'—'} · Build ${window.CH?CH.BUILD:'—'}</span></div>
    <div>Perks: ${s.perks.size?[...s.perks].join(", "):"–"}</div>
    <div>Meilensteine: ${s.milestonesAchieved.size?[...s.milestonesAchieved].join(", "):"–"}</div>
  `);
}
function renderCooldowns(){const lines=[];for(const[k,v]of GAME.cooldowns.entries())if(v>0)lines.push(`• ${k}: ${v} Aktionen`);setHTML(elCooldowns,lines.length?lines.join("<br>"):"Keine.");}

/* Buttons */
on(elConfirm,"click",startGame);
on(elRefresh,"click",()=>renderAllCards());
on(elExit,"click",()=>{endGame(GAME,"Freiwilliger Abschluss",legacySummary(GAME));showEnd();});
on(elRestart,"click",()=>toStart());
on(elFocus,"click",()=>{document.body.classList.toggle("focus");const onState=document.body.classList.contains("focus");elFocus.textContent=`FOKUS: ${onState?"AN":"AUS"}`;if(GAME)renderAllCards();});
on(elDebugOpen,"click",()=>window.CH&&CH.ui&&CH.ui.open());

/* Endscreen */
function showEnd(){
  elGame.classList.add("hidden"); elEnd.classList.remove("hidden");
  elEndTitle.textContent=GAME.endTitle; elEndSummary.textContent=GAME.endSummary;
  const rep=el("end-report"); if(rep) setHTML(rep,buildReport(GAME));
  const btnCont=el("btn-continue"), btnReseed=el("btn-reseed"), btnDl=el("btn-download"), btnMdc=el("btn-mdc");
  if(btnCont)btnCont.onclick=()=>{GAME.sandbox=true;GAME.noEnds=true;GAME.ended=false;GAME.energy=Math.max(GAME.energy,30);GAME.stress=Math.min(GAME.stress,95);elEnd.classList.add("hidden");elGame.classList.remove("hidden");renderAllCards();renderStatus();renderCooldowns();};
  if(btnReseed)btnReseed.onclick=()=>{const same=GAME.seed||(""+Date.now());toStart();elSeedInput.value=same;};
  if(btnDl)btnDl.onclick=()=>{const fname=`reset_run_${(GAME.seed||'seed')}.json`;downloadText(fname,sessionAsJSON(GAME));};
  if(btnMdc)btnMdc.onclick=()=>{if(window.CH&&CH.ui)CH.ui.open();};
  if(elToStart)elToStart.onclick=()=>toStart();
}

/* Init */
if(window.CH&&CH.loader){CH.loader.registerModule('game','0.12.1');CH.loader.ready(CH.safeWrap(()=>{toStart();CH.logger.info('Game-UI initialisiert.');},null,'boot'));}else{document.addEventListener('DOMContentLoaded',()=>toStart());}