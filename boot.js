/* ============================================================================
   Closure Hub — Boot/Diagnostics/Loader (boot.js)
   Zweck:
     - Globales CH-Namespace mit:
       * CH.config (Debug-Flag, Builddaten)
       * CH.logger  (Ringpuffer-Logger)
       * CH.loader  (Modullader, Health-Check, Assertions)
       * CH.diagnostics (Fehleraufnahme, Maschinencode (MDC))
       * CH.ui      (Debug-Panel zum Anzeigen/Kopieren des MDC)
     - Global-Error-Capture (window.onerror, unhandledrejection)
     - Hilfen: safeWrap für Event-Handler, UTF8-Base64, FNV-1a Hash
   Dateien, die dies nutzen:
     - game.js (Engine/UI) ruft Loader-Checks & Diagnostics auf
     - index.html liefert Debug-Panel-Container
   ============================================================================ */
(function (global) {
  'use strict';

  // --- Namespace & Build -----------------------------------------------------
  const CH = global.CH = global.CH || {};
  CH.VERSION = '0.9.0';
  CH.BUILD = '2025-08-24';
  CH.config = {
    debug: (new URLSearchParams(global.location.search).get('debug') || localStorage.getItem('ch.debug')) === '1'
  };

  // --- Utils -----------------------------------------------------------------
  const Utils = CH.utils = {
    // FNV-1a 32-bit Hash (schnell, stabil)
    fnv1a(str) {
      let h = 0x811c9dc5;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
      }
      return h >>> 0;
    },
    // Unicode-sichere Base64 (ohne externe Libs)
    b64Encode(str) { return btoa(unescape(encodeURIComponent(str))); },
    b64Decode(b64) { return decodeURIComponent(escape(atob(b64))); },
    nowIso() { return new Date().toISOString(); },
    clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },
    isNumber(x) { return typeof x === 'number' && Number.isFinite(x); },
  };

  // --- Logger (Ringpuffer) ---------------------------------------------------
  class Logger {
    constructor(limit = 400) { this.limit = limit; this.buf = []; }
    push(level, msg, data) {
      const line = { t: Utils.nowIso(), level, msg: String(msg), data: data ?? null };
      this.buf.push(line); if (this.buf.length > this.limit) this.buf.shift();
      if (CH.config.debug) {
        const prefix = `[${level}]`;
        // eslint-disable-next-line no-console
        console[level === 'ERROR' || level === 'FATAL' ? 'error' :
                level === 'WARN' ? 'warn' : 'log'](prefix, msg, data ?? '');
      }
      return line;
    }
    debug(m, d) { return this.push('DEBUG', m, d); }
    info(m, d)  { return this.push('INFO',  m, d); }
    warn(m, d)  { return this.push('WARN',  m, d); }
    error(m, d) { return this.push('ERROR', m, d); }
    fatal(m, d) { return this.push('FATAL', m, d); }
    asText() {
      return this.buf.map(x => `${x.t} [${x.level}] ${x.msg}${x.data ? ' ' + JSON.stringify(x.data) : ''}`).join('\n');
    }
    clear() { this.buf = []; }
  }
  CH.logger = new Logger();

  // --- Loader / Health-Check -------------------------------------------------
  const Loader = CH.loader = {
    health: { ok: true, checks: [], features: {}, modules: [] },
    ready(fn) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn, { once: true });
      } else fn();
    },
    check(name, ok, detail) {
      this.health.checks.push({ name, ok, detail: detail ?? null });
      if (!ok) this.health.ok = false;
      return ok;
    },
    assert(name, cond, detail) {
      const ok = !!cond;
      this.check(name, ok, detail);
      if (!ok) throw new Error(`Health-Check fehlgeschlagen: ${name}`);
    },
    featureDetect() {
      const f = this.health.features;
      f.base64 = typeof btoa === 'function' && typeof atob === 'function';
      f.storage = (function(){ try { localStorage.setItem('_ch_test','1'); localStorage.removeItem('_ch_test'); return true; } catch { return false; }})();
      f.performance = typeof performance !== 'undefined' && typeof performance.now === 'function';
      f.clipboard = !!(navigator.clipboard && navigator.clipboard.writeText);
      ['base64','storage','performance'].forEach(k => this.check(`Feature:${k}`, !!f[k]));
    },
    checkDom(ids) {
      ids.forEach(id => this.assert(`DOM #${id}`, !!document.getElementById(id)));
    },
    checkActions(actions, validStats) {
      const ids = new Set();
      actions.forEach(a => {
        this.assert(`Action:${a.id}:id`, typeof a.id === 'string' && a.id);
        this.assert(`Action:${a.id}:unique`, !ids.has(a.id)); ids.add(a.id);
        this.assert(`Action:${a.id}:stat`, !!validStats[a.stat]);
        ['baseDC','energyCost','stressDelta','moneyDelta','xpGain'].forEach(key => {
          this.assert(`Action:${a.id}:${key}`, Utils.isNumber(a[key]));
        });
      });
    },
    registerModule(name, version) {
      this.health.modules.push({ name, version });
    }
  };

  // führe Basiserkennung sofort durch
  Loader.featureDetect();

  // --- Diagnostics / Maschinencode ------------------------------------------
  const Diagnostics = CH.diagnostics = {
    errors: [],
    stateSupplier: null,   // per game.js gesetzt
    setStateSupplier(fn) { this.stateSupplier = fn; },

    recordError(err, label, extra) {
      const e = {
        t: Utils.nowIso(),
        label: label || 'unknown',
        message: String(err && err.message || err),
        stack: (err && err.stack) ? String(err.stack) : null,
        extra: extra ?? null
      };
      this.errors.push(e);
      CH.logger.error(`Caught error @${label || 'unknown'}: ${e.message}`);
      CH.ui.flag(); // visueller Hinweis
      return e;
    },

    generateMachineCode() {
      // baue Snapshot zusammen
      const env = {
        url: global.location.href,
        ua: navigator.userAgent,
        lang: navigator.language,
        platform: navigator.platform,
        screen: { w: global.innerWidth, h: global.innerHeight, dpr: global.devicePixelRatio || 1 }
      };
      const state = (typeof this.stateSupplier === 'function') ? this.stateSupplier() : null;
      const payload = {
        meta: { ver: CH.VERSION, build: CH.BUILD, ts: Utils.nowIso() },
        env,
        health: CH.loader.health,
        logs: CH.logger.buf,
        errors: this.errors,
        state
      };
      const json = JSON.stringify(payload);
      const sig = Utils.fnv1a(json).toString(16).padStart(8, '0');
      const b64 = Utils.b64Encode(json);
      return `CH1-${sig}-${b64}`;
    },
    parseMachineCode(code) {
      if (!code || !code.startsWith('CH1-')) throw new Error('Ungültiges Format');
      const parts = code.split('-');
      const sig = parts[1];
      const b64 = parts.slice(2).join('-'); // falls '-' im Base64 vorkommt
      const json = Utils.b64Decode(b64);
      const calc = Utils.fnv1a(json).toString(16).padStart(8, '0');
      if (calc !== sig) throw new Error('Signaturprüfung fehlgeschlagen');
      return JSON.parse(json);
    }
  };

  // --- Global Error-Capture --------------------------------------------------
  global.addEventListener('error', (ev) => {
    Diagnostics.recordError(ev.error || ev.message || 'window.onerror', 'window.onerror');
  });
  global.addEventListener('unhandledrejection', (ev) => {
    Diagnostics.recordError(ev.reason || 'unhandledrejection', 'unhandledrejection');
  });

  // --- Safe Wrapper für Event-Handler ---------------------------------------
  CH.safeWrap = function (fn, ctx, label) {
    return function wrappedHandler(/* ...args */) {
      try { return fn.apply(ctx || this, arguments); }
      catch (e) { Diagnostics.recordError(e, label || fn.name || 'handler'); }
    };
  };

  // --- Kleine UI für Debug ---------------------------------------------------
  const UI = CH.ui = {
    elPanel: null, elHealth: null, elLogs: null, elCode: null,
    flagBadgeActive: false,
    init() {
      this.elPanel = document.getElementById('debug-panel');
      this.elHealth = document.getElementById('debug-health');
      this.elLogs = document.getElementById('debug-logs');
      this.elCode = document.getElementById('debug-code');
      const btnOpen = document.getElementById('btn-debug');
      const btnClose = document.getElementById('debug-close');
      const btnRun = document.getElementById('debug-run');
      const btnCopy = document.getElementById('debug-copy');

      if (btnOpen) btnOpen.addEventListener('click', CH.safeWrap(() => this.open(), this, 'debug-open'));
      if (btnClose) btnClose.addEventListener('click', CH.safeWrap(() => this.close(), this, 'debug-close'));
      if (btnRun) btnRun.addEventListener('click', CH.safeWrap(() => this.refreshCode(), this, 'debug-generate'));
      if (btnCopy) btnCopy.addEventListener('click', CH.safeWrap(async () => {
        const code = this.elCode ? this.elCode.value : '';
        if (!code) return;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(code);
          } else {
            const ta = document.createElement('textarea');
            ta.value = code; document.body.appendChild(ta);
            ta.select(); document.execCommand('copy'); ta.remove();
          }
          CH.logger.info('Maschinencode in Zwischenablage kopiert.');
        } catch (e) {
          Diagnostics.recordError(e, 'debug-copy');
        }
      }, this, 'debug-copy')));

      // Tastaturkürzel: Strg/⌘ + Shift + D
      document.addEventListener('keydown', CH.safeWrap((e) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
          e.preventDefault(); this.toggle();
        }
      }, this, 'debug-hotkey'));
    },
    open() { if (this.elPanel) { this.elPanel.classList.remove('hidden'); this.render(); this.refreshCode(); this.flag(false); } },
    close() { if (this.elPanel) this.elPanel.classList.add('hidden'); },
    toggle() { if (!this.elPanel) return; this.elPanel.classList.contains('hidden') ? this.open() : this.close(); },
    render() {
      if (!this.elHealth || !this.elLogs) return;
      const h = CH.loader.health;
      const checks = h.checks.map(c => `${c.ok ? '✔' : '✖'} ${c.name}${c.detail ? ' — ' + JSON.stringify(c.detail) : ''}`).join('\n');
      const mods = h.modules.length ? '\n\nModule:\n' + h.modules.map(m => `• ${m.name} v${m.version}`).join('\n') : '';
      this.elHealth.textContent = `Gesamtstatus: ${h.ok ? 'OK' : 'PROBLEME'}\n${checks}${mods}`;
      this.elLogs.textContent = CH.logger.asText() || '—';
    },
    refreshCode() { if (this.elCode) { this.elCode.value = CH.diagnostics.generateMachineCode(); } },
    flag(on = true) {
      this.flagBadgeActive = !!on;
      const btnOpen = document.getElementById('btn-debug');
      if (!btnOpen) return;
      btnOpen.classList.toggle('danger', this.flagBadgeActive);
    }
  };

  Loader.ready(() => UI.init());

})(window);