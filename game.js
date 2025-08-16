/* ============================================================================
   Closure Hub — Aufarbeitung (game.js)
   - Vollständige Spiel-Logik für die gesplittete Web-App
   - Optimiert: Hilfsfunktionen, weniger Duplikate, robuste UI-Bindings
   - Features: Seeded RNG, 3 Optionen (safe/medium/hard), DC/Erfolgs-%,
               Sicherheitsnetz, Cooldowns (aktionsbasiert), Fokusmodus-Hooks
   ============================================================================ */

/* ---------- Seeded RNG (xmur3 + sfc32) ---------- */
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}
function sfc32(a, b, c, d) {
  return function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
function makeRngFromSeed(seedStr) {
  const seeder = xmur3(seedStr);
  return sfc32(seeder(), seeder(), seeder(), seeder());
}

/* ---------- Enums/Types ---------- */
const Stat = { Appearance: "Appearance", Physique: "Physique", Intellect: "Intellect", Luck: "Luck" };
const Perk = { Networker: "Networker", Workhorse: "Workhorse", Analytical: "Analytical", Stoic: "Stoic", Creative: "Creative", LuckyBreak: "LuckyBreak" };
const Path = { Ausbildung: "Ausbildung", Universitaet: "Universitaet", Freelancer: "Freelancer" }; // technisch beibehalten
const Risk = { Safe: "Safe", Medium: "Medium", Hard: "Hard" };

/* ---------- Small Utils ---------- */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const signStr = (n) => (n >= 0 ? "+" + n : "" + n);
const toPct = (n) => `${clamp(Math.round(n), 0, 100)}%`;
const d10 = (rng) => 1 + Math.floor(rng() * 10);

function el(id) { return document.getElementById(id); }
function on(target, type, handler) { target.addEventListener(type, handler); }

/* Robust: wendet eine Liste von Updates auf das DOM an */
function setHTML(node, html) { node.innerHTML = html; }
function prependTextLine(node, line) {
  const div = document.createElement("div");
  div.textContent = `• ${line}`;
  node.prepend(div);
}

/* ---------- Gameplay Helpers ---------- */
function choiceByWeights(rng, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return -1;
  let t = rng() * total, cum = 0;
  for (let i = 0; i < weights.length; i++) { cum += weights[i]; if (t <= cum) return i; }
  return weights.length - 1;
}
function luckShift(luck, perks) {
  const shift = Math.min(2, Math.floor(luck / 5));
  const lucky = (perks.has(Perk.LuckyBreak) && luck <= 8) ? 1 : 0;
  return shift + lucky;
}
function perkStatBonus(perks, def) {
  let bonus = 0;
  // „Analytical“ unterstützt Reflexions-Checks; „Networker“ könnten wir für networking-Tags nutzen (derzeit selten)
  if (perks.has(Perk.Analytical) && def.tags.includes("reflect")) bonus += 2;
  if (perks.has(Perk.Networker) && def.tags.includes("networking")) bonus += 2;
  return bonus;
}
/* „money“ fungiert hier als Hoffnung (±). Einheitlicher Adapter für Ressourcen-Effekte + Perks. */
function applyPerkEconomy(perks, def, stressDelta, hopeDelta, xpGain) {
  let s = stressDelta, h = hopeDelta, x = xpGain;
  if (perks.has(Perk.Workhorse) && def.tags.includes("stabilize")) { s = Math.trunc(s * 0.85); h = Math.trunc(h * 1.10); }
  if (perks.has(Perk.Stoic) && s > 0) s = Math.trunc(s * 0.90);
  if (perks.has(Perk.Creative) && def.tags.includes("growth")) x = Math.trunc(x * 1.10);
  return [s, h, x];
}
function successProbability(state, def, dc) {
  const baseStat = state.stats[def.stat];
  const statBonus = perkStatBonus(state.perks, def);
  const ls = luckShift(state.stats.Luck, state.perks);
  let successes = 0;
  for (let r = 1; r <= 10; r++) {
    const total = baseStat + statBonus + r + ls;
    if (total >= dc) successes++;
  }
  return successes * 10; // 10 mögliche Ergebnisse → *10 ergibt %
}

/* ---------- Content: Actions & Milestones ---------- */
function makeActions() {
  const list = [];
  const A = (o) => ({ cooldown: 0, tags: [], pathRestriction: null, prereq: () => true, onSuccess: () => { }, onFailure: () => { }, ...o });

  // Erholung
  list.push(A({
    id: "breath_reset", name: "Atem-Reset", desc: "Beruhigt, erdet.",
    baseDC: 0, stat: Stat.Physique, energyCost: -10, stressDelta: -20, moneyDelta: 0, xpGain: 0, tags: ["rest", "stabilize"]
  }));
  list.push(A({
    id: "mindfulness_5", name: "5-Min Achtsamkeit", desc: "Auf Körper & Atem fokussieren.",
    baseDC: 0, stat: Stat.Physique, energyCost: -5, stressDelta: -15, moneyDelta: 0, xpGain: 0, tags: ["rest", "stabilize"]
  }));

  // Kern-Aufarbeitung
  list.push(A({
    id: "journal_patterns", name: "Journaling: Muster", desc: "3 wiederkehrende Konfliktmuster benennen.",
    baseDC: 7, stat: Stat.Intellect, energyCost: 12, stressDelta: 8, moneyDelta: 0, xpGain: 12, tags: ["reflect", "milestone-setup"]
  }));

  list.push(A({
    id: "values_list", name: "Werte-Inventur", desc: "Top-5 Werte & Grenzen notieren.",
    baseDC: 8, stat: Stat.Intellect, energyCost: 14, stressDelta: 8, moneyDelta: 0, xpGain: 14, tags: ["reflect", "boundaries", "milestone-setup"]
  }));

  list.push(A({
    id: "digital_hygiene", name: "Digital: Mute/Archive", desc: "Benachrichtigungen stummschalten, Chat archivieren.",
    baseDC: 7, stat: Stat.Appearance, energyCost: 6, stressDelta: 6, moneyDelta: 0, xpGain: 8, tags: ["contact_mgmt", "stabilize"]
  }));

  list.push(A({
    id: "no_contact_action", name: "Kein-Kontakt-Schritt", desc: "1 konkreter Schritt ohne Kontakt.",
    baseDC: 8, stat: Stat.Appearance, energyCost: 10, stressDelta: 10, moneyDelta: 0, xpGain: 12, tags: ["contact_mgmt", "milestone-setup"], cooldown: 1
  }));

  list.push(A({
    id: "support_call", name: "Support-Gespräch", desc: "20 Min mit Vertrauensperson (sachlich).",
    baseDC: 8, stat: Stat.Appearance, energyCost: 8, stressDelta: 8, moneyDelta: 0, xpGain: 10, tags: ["network", "stabilize"]
  }));

  list.push(A({
    id: "trigger_map", name: "Trigger-Karte", desc: "Auslöser → Reaktion → Gegenzug skizzieren.",
    baseDC: 9, stat: Stat.Intellect, energyCost: 16, stressDelta: 10, moneyDelta: 0, xpGain: 18, tags: ["skills", "milestone-setup"]
  }));

  list.push(A({
    id: "boundary_script", name: "Grenzen-Script", desc: "Zwei Ich-Botschaften formulieren.",
    baseDC: 8, stat: Stat.Appearance, energyCost: 12, stressDelta: 10, moneyDelta: 0, xpGain: 14, tags: ["boundaries", "skills"]
  }));

  list.push(A({
    id: "memory_reframe", name: "Erinnerung reframen", desc: "Eine Szene neutral neu beschreiben.",
    baseDC: 9, stat: Stat.Intellect, energyCost: 14, stressDelta: 10, moneyDelta: 0, xpGain: 16, tags: ["reflect"]
  }));

  list.push(A({
    id: "return_items", name: "Gegenstände klären", desc: "Eigene Dinge sichern / Rückgabe regeln (ohne Treffen).",
    baseDC: 10, stat: Stat.Appearance, energyCost: 16, stressDelta: 14, moneyDelta: 0, xpGain: 16, tags: ["contact_mgmt", "closure"],
    prereq: (s) => (s.successTags.get("contact_mgmt") || 0) >= 2
  }));

  list.push(A({
    id: "routine_pillar", name: "Routine-Pfeiler", desc: "Tägliche Micro-Routine festlegen.",
    baseDC: 7, stat: Stat.Physique, energyCost: 10, stressDelta: 6, moneyDelta: 0, xpGain: 10, tags: ["stabilize", "milestone-setup"], cooldown: 1
  }));

  list.push(A({
    id: "redflags_sheet", name: "Red-Flags-Sheet", desc: "Eigene Warnsignale notieren.",
    baseDC: 8, stat: Stat.Intellect, energyCost: 12, stressDelta: 10, moneyDelta: 0, xpGain: 12, tags: ["reflect"]
  }));

  list.push(A({
    id: "future_vision", name: "Zukunftsbild", desc: "3 Kriterien für gesunde Beziehung definieren.",
    baseDC: 8, stat: Stat.Intellect, energyCost: 12, stressDelta: 8, moneyDelta: 0, xpGain: 12, tags: ["growth", "milestone-setup"]
  }));

  list.push(A({
    id: "relapse_plan", name: "Rückfall-Plan", desc: "Wenn Kontaktimpuls X → Handlung Y.",
    baseDC: 9, stat: Stat.Intellect, energyCost: 14, stressDelta: 10, moneyDelta: 0, xpGain: 16, tags: ["skills", "stabilize"]
  }));

  return list;
}

function makeMilestones() {
  return [
    {
      id: "clarity", name: "Klarheit gewonnen", desc: "Muster & Werte benannt.",
      path: Path.Ausbildung, isPinnacle: false,
      requirements: (s) => (s.successTags.get("reflect") || 0) >= 3,
      rewards: (s) => s.xp += 20
    },
    {
      id: "contact_solid", name: "Kontakt kompakt", desc: "Mehrere Kontakt-Management-Schritte.",
      path: Path.Ausbildung, isPinnacle: false,
      requirements: (s) => (s.successTags.get("contact_mgmt") || 0) >= 3,
      rewards: (s) => s.perks.add(Perk.Stoic)
    },
    {
      id: "triggers_mastered", name: "Trigger-Kompetenz", desc: "Trigger-Karte + Grenzen-Script.",
      path: Path.Ausbildung, isPinnacle: false,
      requirements: (s) => (s.successTags.get("skills") || 0) >= 2,
      rewards: (s) => s.money += 50 // symbolische "Hoffnung"
    },
    {
      id: "new_pillars", name: "Neue Pfeiler", desc: "Routinen etabliert, Zukunftsbild skizziert.",
      path: Path.Ausbildung, isPinnacle: true,
      requirements: (s) => (s.successTags.get("milestone-setup") || 0) >= 4 && s.xp >= 80,
      rewards: (s) => s.perks.add(Perk.Creative)
    },
  ];
}

/* ---------- Engine ---------- */
function createState(meta, stats, perks, path, seedStr) {
  const rng = makeRngFromSeed(seedStr);
  return {
    meta, stats, perks, path, rng,
    energy: 100, stress: 0, money: 0, xp: 0, // money == Hoffnung
    cooldowns: new Map(),
    sinceSeen: new Map(),
    successTags: new Map(),
    certificates: new Set(), // nicht genutzt, behalten für Kompatibilität
    history: [],
    milestonesAchieved: new Set(),
    ended: false, endTitle: "", endSummary: ""
  };
}

function pickOptions(state, pool) {
  const risks = [Risk.Safe, Risk.Medium, Risk.Hard];
  const targets = new Map([
    [Risk.Safe, 6 + Math.floor(state.rng() * 2)],   // 6..7
    [Risk.Medium, 8 + Math.floor(state.rng() * 2)], // 8..9
    [Risk.Hard, 10 + Math.floor(state.rng() * 2)]   // 10..11
  ]);
  const out = [];
  const X_NEU = 5;

  // „Neuheit“ altern lassen
  pool.forEach(def => {
    state.sinceSeen.set(def.id, (state.sinceSeen.get(def.id) ?? (X_NEU + 1)) + 1);
  });

  for (const risk of risks) {
    const target = targets.get(risk);
    const candidates = pool.filter(def => {
      const cd = state.cooldowns.get(def.id) ?? 0;
      const pathOK = (def.pathRestriction === null) || (def.pathRestriction === state.path);
      return pathOK && def.prereq(state) && cd <= 0;
    });
    if (!candidates.length) continue;

    const weights = candidates.map(def => {
      const fitGrad = 1 - (Math.abs(def.baseDC - target) / 5);
      let w = Math.max(0, Math.min(1, fitGrad));
      if (state.stress >= 70 && def.tags.includes("rest")) w *= 1.5;
      if (state.energy <= 30 && def.energyCost >= 25) w *= 0.6;
      if (def.tags.includes("milestone-setup")) w *= 1.25;
      const age = state.sinceSeen.get(def.id) ?? (X_NEU + 1);
      w *= (age > X_NEU) ? 1.2 : 0.8;
      return w;
    });

    const idx = choiceByWeights(state.rng, weights);
    if (idx >= 0) {
      const chosen = candidates[idx];
      state.sinceSeen.set(chosen.id, 0);
      out.push({ def: chosen, risk, targetDC: target });
    }
  }

  // Falls weniger als 3 gefunden, mit Erholung auffüllen
  const ids = new Set(out.map(o => o.def.id));
  function ensureRest() {
    const r1 = pool.find(a => a.id === "breath_reset");
    if (r1 && !ids.has(r1.id)) return { def: r1, risk: Risk.Safe, targetDC: 0 };
    const r2 = pool.find(a => a.id === "mindfulness_5");
    if (r2 && !ids.has(r2.id)) return { def: r2, risk: Risk.Safe, targetDC: 0 };
    return null;
  }
  while (out.length < 3) {
    const extra = ensureRest();
    if (!extra) break;
    out.push(extra); ids.add(extra.def.id);
  }
  return out;
}

function applyAction(state, option) {
  const def = option.def;

  // Sicherheitsnetz
  const last = state.history.slice(-20);
  const succRate = last.length ? (last.filter(x => x).length / last.length) : 1.0;
  const safety = (succRate < 0.40) ? 1 : 0;

  const baseStat = state.stats[def.stat];
  const statBonus = perkStatBonus(state.perks, def);
  const ls = luckShift(state.stats.Luck, state.perks);
  const roll = d10(state.rng);
  const total = baseStat + statBonus + roll + ls;
  const dcEff = Math.max(0, def.baseDC - safety);
  const success = total >= dcEff;

  // Ressourcen + Perks
  const [stressAdj, hopeAdj, xpAdj] = applyPerkEconomy(state.perks, def, def.stressDelta, def.moneyDelta, def.xpGain);

  state.energy = clamp(state.energy - def.energyCost, 0, 100); // negative Kosten geben Energie
  state.stress = clamp(state.stress + stressAdj, 0, 100);
  state.money += hopeAdj; // „Hoffnung“
  state.xp += xpAdj;

  // Cooldowns (aktionsbasiert)
  if (def.cooldown && def.cooldown > 0) state.cooldowns.set(def.id, def.cooldown);
  for (const [k, v] of [...state.cooldowns.entries()]) state.cooldowns.set(k, Math.max(0, v - 1));

  // Tags nur bei Erfolg
  if (success) {
    def.tags.forEach(tag => state.successTags.set(tag, (state.successTags.get(tag) || 0) + 1));
    def.onSuccess(state);
  } else {
    def.onFailure(state);
  }

  // Endbedingungen
  if (state.stress >= 100) {
    endGame(state, "Rückfall/Überlastung", "Stress bei 100. Hinweis: Mehr Erholung und klare Grenzen einplanen.");
  } else {
    checkMilestones(state);
  }

  state.history.push(success);
  if (state.history.length > 50) state.history.shift();

  // Logzeile (Erklärbarkeit)
  const prob = successProbability(state, def, def.baseDC); // Anzeige ohne Safety
  const parts = [];
  parts.push(`Aktion: ${def.name} [${String(option.risk).toLowerCase()}]`);
  parts.push(`DC=${def.baseDC}, Stat=${def.stat}, Erfolgs-%≈${prob}%`);
  let msg = `W10=${roll}, Luck-Shift +${ls}, Stat ${def.stat} ${baseStat}`;
  if (statBonus) msg += ` (+Perk ${statBonus})`;
  if (safety === 1) msg += `, Sicherheitsnetz −1 DC`;
  msg += ` → Summe=${total} ${success ? "≥" : "<"} DC ${dcEff} → ${success ? "Erfolg" : "Misserfolg"}; `;
  msg += `Δ: Energie ${signStr(-def.energyCost)}, Stress ${signStr(stressAdj)}, Hoffnung ${signStr(hopeAdj)}, Einsicht +${xpAdj}.`;
  return `${parts.join(" · ")}. ${msg}`;
}

function checkMilestones(state) {
  const ms = makeMilestones().filter(m => m.path === state.path && !state.milestonesAchieved.has(m.id));
  for (const m of ms) {
    if (m.requirements(state)) {
      m.rewards(state);
      state.milestonesAchieved.add(m.id);
      if (m.isPinnacle) {
        endGame(state, `Pinnacle erreicht: ${m.name}`, legacySummary(state));
        break;
      }
    }
  }
}
function legacySummary(state) {
  let rankScore = 0;
  if (["new_pillars"].some(id => state.milestonesAchieved.has(id))) rankScore = 3000;
  else if (state.milestonesAchieved.size >= 2) rankScore = 2000;
  else if (state.milestonesAchieved.size >= 1) rankScore = 1000;

  const hope = Math.trunc(state.money);
  const milestones = state.milestonesAchieved.size * 100;
  const wellbeing = (100 - state.stress) * 5;
  const score = rankScore + hope + milestones + wellbeing;

  return `Legacy-Score: ${score}  (Rang=${rankScore}, Hoffnung=${hope}, Milestones=${milestones}, Wohlbefinden=${wellbeing}).`;
}
function endGame(state, title, summary) {
  state.ended = true; state.endTitle = title; state.endSummary = summary;
}

/* ---------- UI Binding ---------- */
const elStart = el("start-screen");
const elGame = el("game-screen");
const elEnd = el("end-screen");

const elGender = el("gender-label");
const elGenderToggle = el("gender-toggle");
const elAgeVal = el("age-val");
const elAgeMinus = el("age-minus");
const elAgePlus = el("age-plus");
const elPtsLeft = el("pts-left");
const elSeedInput = el("seed-input");
const elConfirm = el("confirm-btn");

const elOptions = el("options");
const elLog = el("log");
const elStatus = el("status");
const elCooldowns = el("cooldowns");

const elRefresh = el("btn-refresh");
const elExit = el("btn-exit");
const elRestart = el("btn-restart");
const elFocus = el("btn-focus");

const elEndTitle = el("end-title");
const elEndSummary = el("end-summary");
const elToStart = el("btn-to-start");

/* Start Setup */
const pre = {
  gender: "Divers",
  age: 18,
  stats: { Appearance: 2, Physique: 2, Intellect: 2, Luck: 2 },
  pointsLeft: 10
};

let GAME = null;
const ACTIONS = makeActions();

function updateStartUI() {
  elGender.textContent = pre.gender;
  elAgeVal.textContent = pre.age;
  elPtsLeft.textContent = pre.pointsLeft;
  el("stat-Appearance").textContent = pre.stats.Appearance;
  el("stat-Physique").textContent = pre.stats.Physique;
  el("stat-Intellect").textContent = pre.stats.Intellect;
  el("stat-Luck").textContent = pre.stats.Luck;
  elConfirm.disabled = pre.pointsLeft !== 0;
}

function toStart() {
  pre.gender = "Divers"; pre.age = 18; pre.pointsLeft = 10;
  pre.stats = { Appearance: 2, Physique: 2, Intellect: 2, Luck: 2 };
  elSeedInput.value = "";
  updateStartUI();
  elStart.classList.remove("hidden");
  elGame.classList.add("hidden");
  elEnd.classList.add("hidden");
  setHTML(elLog, "");
  document.body.classList.remove("focus");
  elFocus.textContent = "Fokusmodus: AUS";
}

function startGame() {
  const seed = (elSeedInput.value || ("" + Date.now())).trim();
  GAME = createState(
    { gender: pre.gender, age: pre.age, background: "Neutral" },
    { ...pre.stats },
    new Set(),                // Start ohne Perks
    Path.Ausbildung,          // Path technisch beibehalten
    seed
  );
  elStart.classList.add("hidden");
  elGame.classList.remove("hidden");
  refreshOptions();
  renderStatus();
  renderCooldowns();
}

function renderStatus() {
  const s = GAME;
  setHTML(elStatus, `
    <div>Energie: <strong>${s.energy}</strong> &nbsp; Stress: <strong>${s.stress}</strong> &nbsp; Hoffnung: <strong>${s.money}</strong> &nbsp; Einsicht (XP): <strong>${s.xp}</strong></div>
    <div>Pfad: <span class="pill">Aufarbeitung</span></div>
    <div>Perks: ${s.perks.size ? [...s.perks].join(", ") : "–"}</div>
    <div>Meilensteine: ${s.milestonesAchieved.size ? [...s.milestonesAchieved].join(", ") : "–"}</div>
  `);
}
function renderCooldowns() {
  const lines = [];
  for (const [k, v] of GAME.cooldowns.entries()) if (v > 0) lines.push(`• ${k}: ${v} Aktionen`);
  setHTML(elCooldowns, lines.length ? lines.join("<br>") : "Keine.");
}
function refreshOptions() {
  const opts = pickOptions(GAME, ACTIONS);
  elOptions.innerHTML = "";
  for (const opt of opts) elOptions.appendChild(optionCard(opt));
}

function optionCard(opt) {
  const def = opt.def;
  const prob = successProbability(GAME, def, def.baseDC);
  const div = document.createElement("div");
  div.className = "option-card";

  // Durchführbarkeit prüfen (Stress/ Energie unter Berücksichtigung von Perks)
  const [stressAdj] = applyPerkEconomy(GAME.perks, def, def.stressDelta, def.moneyDelta, def.xpGain);
  const canAfford = (GAME.energy - def.energyCost) >= 0 && (GAME.stress + Math.max(0, stressAdj)) <= 100;

  div.innerHTML = `
    <h4 style="margin:0 0 6px;">${def.name}<span class="badge">${String(opt.risk).toLowerCase()}</span></h4>
    <div class="meta">Stat: ${def.stat} · DC ${def.baseDC} · Erfolgs-%≈${prob}</div>
    <div class="details" style="margin:6px 0 0;">
      <div class="muted">${def.desc}</div>
      <div class="meta">Kosten: Energie ${def.energyCost < 0 ? "+" + (-def.energyCost) : def.energyCost}
        · Stress ${signStr(def.stressDelta)} · Hoffnung ${signStr(def.moneyDelta)} · Einsicht +${def.xpGain}</div>
      <div class="meta">Tags: ${def.tags.join(", ") || "–"}</div>
    </div>
    <div style="margin-top:8px; display:flex; gap:8px; align-items:center;">
      <button class="primary" ${canAfford ? "" : "disabled"}>Ausführen</button>
      <button class="toggle" type="button">Details ${document.body.classList.contains('focus') ? "zeigen" : "verbergen"}</button>
      ${canAfford ? "" : `<span class="danger">Nicht durchführbar (Energie/Stress)</span>`}
    </div>
  `;

  const btnRun = div.querySelector("button.primary");
  on(btnRun, "click", () => {
    const entry = applyAction(GAME, opt);
    prependTextLine(elLog, entry);
    if (GAME.ended) { showEnd(); } else { refreshOptions(); renderStatus(); renderCooldowns(); }
  });

  const btnTog = div.querySelector("button.toggle");
  const details = div.querySelector(".details");
  on(btnTog, "click", () => {
    const vis = details.style.display !== "none";
    details.style.display = vis ? "none" : "block";
    btnTog.textContent = `Details ${vis ? "zeigen" : "verbergen"}`;
  });

  // initial je nach Fokusmodus verstecken
  if (document.body.classList.contains("focus")) details.style.display = "none";
  return div;
}

function showEnd() {
  elGame.classList.add("hidden");
  elEnd.classList.remove("hidden");
  elEndTitle.textContent = GAME.endTitle;
  elEndSummary.textContent = GAME.endSummary;
}

/* ---------- Events ---------- */
document.querySelectorAll("button[data-stat]").forEach(btn => {
  on(btn, "click", () => {
    const stat = btn.getAttribute("data-stat");
    const delta = parseInt(btn.getAttribute("data-delta"), 10);
    const cur = pre.stats[stat];

    if (delta > 0 && pre.pointsLeft <= 0) return;
    const nv = clamp(cur + delta, 0, 10);
    if (nv !== cur) {
      pre.stats[stat] = nv;
      pre.pointsLeft += (delta > 0 ? -1 : +1);
      pre.pointsLeft = clamp(pre.pointsLeft, 0, 10);
      updateStartUI();
    }
  });
});

on(elGenderToggle, "click", () => {
  pre.gender = pre.gender === "Männlich" ? "Weiblich" : (pre.gender === "Weiblich" ? "Divers" : "Männlich");
  updateStartUI();
});
on(elAgeMinus, "click", () => { pre.age = Math.max(10, pre.age - 1); updateStartUI(); });
on(elAgePlus, "click", () => { pre.age = Math.min(80, pre.age + 1); updateStartUI(); });

on(elConfirm, "click", startGame);
on(elRefresh, "click", () => refreshOptions());
on(elExit, "click", () => { endGame(GAME, "Freiwilliger Abschluss", legacySummary(GAME)); showEnd(); });
on(elRestart, "click", () => toStart());
on(elFocus, "click", () => {
  document.body.classList.toggle("focus");
  const onState = document.body.classList.contains("focus");
  elFocus.textContent = `Fokusmodus: ${onState ? "AN" : "AUS"}`;
});

/* ---------- Init ---------- */
toStart();
