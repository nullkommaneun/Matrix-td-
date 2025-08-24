/* ============================================================================
   RESET — Styles (style.css)
   ============================================================================ */
:root{
  --bg:#0a0d0a; --panel:#121515; --neon:#00ff88; --text:#b8f1d9; --muted:#7bc6a7; --danger:#ff4d4d;
}
*{ box-sizing:border-box }
html,body{ height:100% }
body{
  margin:0; background:var(--bg); color:var(--text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
h1,h2,h3{ margin:.2rem 0 .6rem; color:var(--neon) }
.wrap{ padding:16px; max-width:1400px; margin:0 auto }
.hidden{ display:none !important }

.panel{
  border:1px solid var(--neon);
  background:linear-gradient(135deg,rgba(18,21,21,.95),rgba(18,21,21,.9)),
             repeating-linear-gradient(45deg,rgba(255,255,255,.03) 0 2px, rgba(0,0,0,.04) 2px 4px);
  padding:12px; border-radius:6px; position:relative;
}
.panel:before,.panel:after{ content:""; position:absolute; width:6px;height:6px; background:var(--bg); border:1px solid var(--neon); border-radius:50% }
.panel:before{ top:-4px; left:-4px } .panel:after{ bottom:-4px; right:-4px }

.row{ display:grid; gap:12px }
.row.cols-2{ grid-template-columns:1fr 1fr }
.row.cols-3{ grid-template-columns:1fr 1fr 1fr }
.header{ display:flex; align-items:center; justify-content:space-between; margin-bottom:8px }

button,input,select{
  font:inherit; color:var(--text); background:var(--panel); border:1px solid var(--neon);
  border-radius:4px; padding:6px 10px;
}
button{ cursor:pointer } button.primary{ background:var(--neon); color:#000; border-color:var(--neon) }
button:disabled{ opacity:.5; cursor:not-allowed }
.inline{ display:inline-flex; align-items:center; gap:8px }
.stack{ display:flex; flex-direction:column }
.muted{ color:var(--muted) }
.danger{ color:var(--danger) }
.pill{ border:1px solid var(--neon); padding:2px 6px; border-radius:999px; font-size:12px; color:var(--muted) }

.stat-row{ display:grid; grid-template-columns: 220px 36px 50px 36px; gap:8px; align-items:center; margin:6px 0 }
.log{ height:60vh; overflow:auto; padding-right:6px; font-size:13px; line-height:1.25rem; white-space:pre-wrap; scrollbar-color:var(--neon) transparent }
.option-card{ border:1px solid var(--neon); border-radius:6px; padding:10px; margin:8px 0 }
.badge{ display:inline-block; font-size:11px; padding:2px 6px; border:1px solid var(--neon); border-radius:999px; margin-left:6px; color:var(--muted) }
.meta{ font-size:12px; color: var(--muted) }
.sep { height:1px; background:linear-gradient(90deg,transparent,var(--neon),transparent); margin:8px 0; opacity:.4 }

/* Fokus */
body.focus .option-card .details{ display:none }
body.focus .option-card{ padding:8px }
body.focus .option-card h4{ margin:0 0 4px }

/* Debug-Panel */
.debug-panel{ position:fixed; inset:0; background:rgba(10,13,10,.92); backdrop-filter:blur(2px); z-index:9999; overflow:auto; padding:16px }
.debug-panel .panel{ max-width:1100px; margin:0 auto }
#btn-debug.danger{ box-shadow:0 0 0 2px var(--danger) inset }

/* Brandline / Logo */
.brandline { display:flex; align-items:center; gap:10px; }
.logo-reset { width:40px; height:40px; filter: drop-shadow(0 0 6px rgba(0,255,136,.25)); }
@keyframes logo-spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
@media (hover:hover){ .logo-reset:hover { animation: logo-spin 6s linear infinite; } }