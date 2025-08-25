/* ============================================================================
   RESET — Boot/Diagnostics/Loader (boot.js)  v0.10.1
   ============================================================================ */
(function (global) {
  'use strict';

  const CH = global.CH = global.CH || {};
  CH.VERSION = '0.10.1';
  CH.BUILD = '2025-08-24';

  (function setDebugFlag(){
    function hasFlag(name) {
      const s = (global.location.search || '').toLowerCase();
      const h = (global.location.hash   || '').toLowerCase();
      const re = new RegExp(`[?&#]${name.toLowerCase()}(?:=(1|true))?(?:[&#]|$)`, 'i');
      return re.test(s) || re.test(h);
    }
    const on = hasFlag('debug') ||
               localStorage.getItem('ch.debug') === '1' ||
               localStorage.getItem('reset.devstart') === '1';
    CH.config = { debug: !!on };
  })();

  const Utils = CH.utils = {
    fnv1a(str){ let h=0x811c9dc5; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=(h+((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24)))>>>0; } return h>>>0; },
    b64Encode(str){ if(global.TextEncoder){ const bytes=new TextEncoder().encode(str); let bin=''; bytes.forEach(b=>bin+=String.fromCharCode(b)); return btoa(bin);} return btoa(unescape(encodeURIComponent(str))); },
    b64Decode(b64){ const bin=atob(b64); if(global.TextDecoder){ const bytes=new Uint8Array([...bin].map(c=>c.charCodeAt(0))); return new TextDecoder().decode(bytes);} return decodeURIComponent(escape(bin)); },
    nowIso(){ return new Date().toISOString(); },
    isNumber(x){ return typeof x==='number' && Number.isFinite(x); },
  };

  class Logger {
    constructor(limit=400){ this.limit=limit; this.buf=[]; }
    push(level,msg,data){ const line={t:Utils.nowIso(),level,msg:String(msg),data:data??null}; this.buf.push(line); if(this.buf.length>this.limit) this.buf.shift();
      if(CH.config.debug){ const m=(level==='ERROR'||level==='FATAL')?'error':(level==='WARN'?'warn':'log'); console[m](`[${level}]`,msg,data??''); }
      return line;
    }
    debug(m,d){return this.push('DEBUG',m,d)} info(m,d){return this.push('INFO',m,d)} warn(m,d){return this.push('WARN',m,d)}
    error(m,d){return this.push('ERROR',m,d)} fatal(m,d){return this.push('FATAL',m,d)} asText(){return this.buf.map(x=>`${x.t} [${x.level}] ${x.msg}${x.data?' '+JSON.stringify(x.data):''}`).join('\n')}
    clear(){this.buf=[]}
  }
  CH.logger = new Logger();

  const Loader = CH.loader = {
    health:{ ok:true, checks:[], features:{}, modules:[] },
    ready(fn){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', fn, {once:true}); else fn(); },
    check(name,ok,detail){ this.health.checks.push({name,ok,detail:detail??null}); if(!ok) this.health.ok=false; return ok; },
    assert(name,cond,detail){ const ok=!!cond; this.check(name,ok,detail); if(!ok) throw new Error(`Health-Check fehlgeschlagen: ${name}`); },
    featureDetect(){
      const f=this.health.features;
      f.base64=typeof btoa==='function' && typeof atob==='function';
      f.storage=(function(){ try{ localStorage.setItem('_ch_t','1'); localStorage.removeItem('_ch_t'); return true; }catch{return false;} })();
      f.performance=typeof performance!=='undefined' && typeof performance.now==='function';
      f.clipboard=!!(navigator.clipboard && navigator.clipboard.writeText);
      ['base64','storage','performance'].forEach(k=>this.check(`Feature:${k}`,!!f[k]));
    },
    checkDom(ids){ ids.forEach(id=>this.assert(`DOM #${id}`, !!document.getElementById(id))); },
    checkActions(actions, validStats){
      const ids=new Set();
      actions.forEach(a=>{
        this.assert(`Action:${a.id}:id`, typeof a.id==='string' && a.id);
        this.assert(`Action:${a.id}:unique`, !ids.has(a.id)); ids.add(a.id);
        this.assert(`Action:${a.id}:stat`, !!validStats[a.stat]);
        ['baseDC','energyCost','stressDelta','moneyDelta','xpGain'].forEach(key=>this.assert(`Action:${a.id}:${key}`, CH.utils.isNumber(a[key])));
      });
    },
    registerModule(name,version){ this.health.modules.push({name,version}); }
  };
  Loader.featureDetect();

  const Diagnostics = CH.diagnostics = {
    errors: [], stateSupplier: null,
    setStateSupplier(fn){ this.stateSupplier = fn; },
    recordError(err,label,extra){ const e={t:Utils.nowIso(),label:label||'unknown',message:String(err&&err.message||err),stack:(err&&err.stack)?String(err.stack):null,extra:extra??null}; this.errors.push(e); CH.logger.error(`Caught error @${label||'unknown'}: ${e.message}`); CH.ui.flag(); return e; },
    generateMachineCode(){
      const env={url:location.href, ua:navigator.userAgent, lang:navigator.language, platform:navigator.platform, screen:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio||1}};
      const payload={ meta:{ver:CH.VERSION,build:CH.BUILD,ts:Utils.nowIso()}, env, health:CH.loader.health, logs:CH.logger.buf, errors:this.errors, state: (typeof this.stateSupplier==='function'?this.stateSupplier():null) };
      const json=JSON.stringify(payload); const sig=Utils.fnv1a(json).toString(16).padStart(8,'0'); const b64=Utils.b64Encode(json);
      return `CH1-${sig}-${b64}`;
    },
    parseMachineCode(code){ if(!code||!code.startsWith('CH1-')) throw new Error('Ungültiges Format'); const parts=code.split('-'); const sig=parts[1]; const b64=parts.slice(2).join('-'); const json=Utils.b64Decode(b64); const calc=Utils.fnv1a(json).toString(16).padStart(8,'0'); if(calc!==sig) throw new Error('Signaturprüfung fehlgeschlagen'); return JSON.parse(json); }
  };

  addEventListener('error', ev=>Diagnostics.recordError(ev.error||ev.message||'window.onerror','window.onerror'));
  addEventListener('unhandledrejection', ev=>Diagnostics.recordError(ev.reason||'unhandledrejection','unhandledrejection'));

  CH.safeWrap = function(fn,ctx,label){
    return function wrapped(){ try{ return fn.apply(ctx||this, arguments); } catch(e){ Diagnostics.recordError(e, label||fn.name||'handler'); } };
  };

  const UI = CH.ui = {
    elPanel:null, elHealth:null, elLogs:null, elCode:null,
    init(){ if(this._inited) return; this._inited=true;
      this.elPanel=document.getElementById('debug-panel');
      this.elHealth=document.getElementById('debug-health');
      this.elLogs=document.getElementById('debug-logs');
      this.elCode=document.getElementById('debug-code');
      const btnOpen=document.getElementById('btn-debug');
      const btnClose=document.getElementById('debug-close');
      const btnRun=document.getElementById('debug-run');
      const btnCopy=document.getElementById('debug-copy');

      if(btnOpen) btnOpen.addEventListener('click', CH.safeWrap(()=>this.open(), this, 'debug-open'));
      if(btnClose) btnClose.addEventListener('click', CH.safeWrap(()=>this.close(), this, 'debug-close'));
      if(btnRun) btnRun.addEventListener('click', CH.safeWrap(()=>this.refreshCode(), this, 'debug-generate'));
      if(btnCopy) btnCopy.addEventListener('click', CH.safeWrap(async ()=>{
        const code=this.elCode?this.elCode.value:''; if(!code) return;
        try{ if(navigator.clipboard&&navigator.clipboard.writeText) await navigator.clipboard.writeText(code);
             else { const ta=document.createElement('textarea'); ta.value=code; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } }
        catch(e){ CH.diagnostics.recordError(e,'debug-copy'); }
      }, this, 'debug-copy'));

      document.addEventListener('keydown', CH.safeWrap((e)=>{ if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='d'){ e.preventDefault(); this.toggle(); } }, this, 'debug-hotkey'));
    },
    open(){ if(this.elPanel){ this.elPanel.classList.remove('hidden'); this.render(); this.refreshCode(); this.flag(false);} },
    close(){ if(this.elPanel) this.elPanel.classList.add('hidden'); },
    toggle(){ if(!this.elPanel) return; this.elPanel.classList.contains('hidden')?this.open():this.close(); },
    render(){ if(!this.elHealth||!this.elLogs) return; const h=CH.loader.health;
      const checks=h.checks.map(c=>`${c.ok?'✔':'✖'} ${c.name}${c.detail?' — '+JSON.stringify(c.detail):''}`).join('\n');
      const mods=h.modules.length?'\n\nModule:\n'+h.modules.map(m=>`• ${m.name} v${m.version}`).join('\n'):''; 
      this.elHealth.textContent=`Gesamtstatus: ${h.ok?'OK':'PROBLEME'}\n${checks}${mods}`;
      this.elLogs.textContent=CH.logger.asText()||'—';
    },
    refreshCode(){ if(this.elCode) this.elCode.value = CH.diagnostics.generateMachineCode(); },
    flag(on=true){ const btn=document.getElementById('btn-debug'); if(btn) btn.classList.toggle('danger', !!on); }
  };

  CH.loader.ready(()=> UI.init());
})(window);