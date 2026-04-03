/**
 * dp-sync.js — Diamond Pulse Surface Panel Sync
 * Relay WebSocket public — zéro installation, zéro compte
 *
 * INTÉGRATION dans index.html avant </body> :
 *   <script src="js/dp-sync.js"></script>
 *
 * Script classique — pas de type="module" requis
 */

(function () {
  'use strict';

  const RELAY = 'wss://socketsbay.com/wss/v2/1/demo/';

  function genCode() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  // ─── Badge — coin inférieur gauche ─────────────────────────────────────────

  function createBadge(code) {
    const badge = document.createElement('div');
    badge.id = 'dp-sync-badge';
    Object.assign(badge.style, {
      position: 'fixed', bottom: '14px', left: '14px', zIndex: '99999',
      background: '#0d0d14', color: 'rgba(255,255,255,0.55)',
      border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: '10px',
      padding: '8px 14px', fontFamily: 'monospace', fontSize: '12px',
      userSelect: 'none', display: 'flex', alignItems: 'center', gap: '8px',
    });
    const dot = document.createElement('span');
    dot.id = 'dp-sync-dot';
    dot.textContent = '◉';
    dot.style.color = '#888780';
    const lbl = document.createElement('span');
    lbl.id = 'dp-sync-label';
    lbl.textContent = 'SYNC · ' + code;
    badge.appendChild(dot);
    badge.appendChild(lbl);
    document.body.appendChild(badge);
    return { dot, lbl };
  }

  function setBadge(dot, lbl, state, code) {
    const s = {
      waiting:   { c: '#888780', t: 'SYNC · ' + code },
      connected: { c: '#1D9E75', t: 'Surface · connectée' },
      error:     { c: '#E24B4A', t: 'SYNC · erreur relay' },
    }[state];
    dot.style.color = s.c;
    lbl.textContent = s.t;
  }

  // ─── Lecture de l'état Diamond Pulse ───────────────────────────────────────

  function getState() {
    return {
      mode:   detectMode(),
      score:  { home: readInt('.score-home,[data-score-home]'), away: readInt('.score-away,[data-score-away]') },
      inning: { number: readInt('[data-inning],.inning-number'), half: readHalf() },
      count:  { balls: readInt('[data-balls]'), strikes: readInt('[data-strikes]'), outs: readInt('[data-outs]') },
      atBat:  readText('[data-at-bat],.at-bat-name,#at-bat-name'),
      onDeck: readText('[data-on-deck],.on-deck-name,#on-deck-name'),
    };
  }

  function detectMode() {
    const el = document.querySelector('.tab-active,[aria-selected="true"],.mode-btn.active,.nav-link.active');
    if (!el) return 'live';
    const t = el.textContent.toLowerCase();
    if (t.includes('lineup'))    return 'lineup';
    if (t.includes('social'))    return 'social';
    if (t.includes('broadcast')) return 'broadcast';
    return 'live';
  }

  function readInt(sel)  { const e = document.querySelector(sel); return e ? (parseInt(e.textContent) || 0) : 0; }
  function readText(sel) { const e = document.querySelector(sel); return e ? e.textContent.trim() : ''; }
  function readHalf()    { const e = document.querySelector('[data-inning-half],.inning-half'); return e && e.textContent.includes('▼') ? 'bottom' : 'top'; }

  // ─── Commandes reçues depuis la Surface ────────────────────────────────────

  function handleCmd(cmd) {
    console.log('[dp-sync] commande:', cmd.action);
    ({
      set_mode:       () => activateMode(cmd.mode),
      batter_next:    () => tap('[data-batter-next],.batter-next'),
      batter_prev:    () => tap('[data-batter-prev],.batter-prev'),
      score_home_inc: () => tap('button[data-team="home"][data-action="inc"],[data-score-home-inc]'),
      score_home_dec: () => tap('button[data-team="home"][data-action="dec"],[data-score-home-dec]'),
      score_away_inc: () => tap('button[data-team="away"][data-action="inc"],[data-score-away-inc]'),
      score_away_dec: () => tap('button[data-team="away"][data-action="dec"],[data-score-away-dec]'),
      count_reset:    () => tap('[data-count-reset],.reset-count'),
      inning_next:    () => tap('[data-inning-inc],.inning-up'),
      inning_prev:    () => tap('[data-inning-dec],.inning-down'),
      toggle_half:    () => tap('[data-toggle-half],.toggle-half'),
      runner_first:   () => tap('[data-runner="1"],.runner-first'),
      runner_second:  () => tap('[data-runner="2"],.runner-second'),
      runner_third:   () => tap('[data-runner="3"],.runner-third'),
      runners_clear:  () => tap('[data-runners-clear],.clear-runners'),
      stop_all:       () => tap('[data-stop-all],.stop-all'),
      copy_obs_url:   () => tap('[data-copy-obs],.copy-obs'),
      lineup_next:    () => tap('[data-lineup-next],.lineup-next'),
      lineup_prev:    () => tap('[data-lineup-prev],.lineup-prev'),
      play_sound:     () => tapSound(cmd.soundId),
    }[cmd.action] || (() => {}))();
  }

  function tap(sel) {
    const el = document.querySelector(sel);
    if (el) el.click();
    else console.warn('[dp-sync] non trouvé:', sel);
  }

  function tapSound(id) {
    const el = document.querySelector(`[data-sound-id="${id}"] .play-btn,[data-sound="${id}"] .play`);
    if (el) el.click();
  }

  function activateMode(mode) {
    document.querySelectorAll('[role="tab"],.tab-btn,nav button,.nav-link,.mode-tab').forEach(t => {
      if (t.textContent.toLowerCase().includes(mode)) t.click();
    });
  }

  // ─── Observation des changements ───────────────────────────────────────────

  function watchState(onChange) {
    let last = JSON.stringify(getState()), timer = null;
    const obs = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const next = JSON.stringify(getState());
        if (next !== last) { last = next; onChange(JSON.parse(next)); }
      }, 80);
    });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    return obs;
  }

  // ─── WebSocket relay ───────────────────────────────────────────────────────

  const code = genCode();
  const CHANNEL = 'dp-' + code; // canal unique basé sur le code
  let ws = null;
  let observer = null;
  let connected = false;
  let { dot, lbl } = { dot: null, lbl: null };

  function send(type, payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ channel: CHANNEL, type, payload }));
    }
  }

  function connect() {
    ws = new WebSocket(RELAY);

    ws.onopen = () => {
      console.log('[dp-sync] relay connecté · code:', code);
      // Rejoint le canal
      ws.send(JSON.stringify({ channel: CHANNEL, type: 'host', payload: { ready: true } }));
    };

    ws.onmessage = (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }

      // Filtre les messages du bon canal
      if (msg.channel !== CHANNEL) return;

      if (msg.type === 'join') {
        // La Surface vient de rejoindre
        connected = true;
        setBadge(dot, lbl, 'connected', code);
        console.log('[dp-sync] Surface connectée');
        send('state', getState());
        if (!observer) {
          observer = watchState(state => send('state', state));
        }
      }

      if (msg.type === 'leave') {
        connected = false;
        setBadge(dot, lbl, 'waiting', code);
        if (observer) { observer.disconnect(); observer = null; }
        console.log('[dp-sync] Surface déconnectée');
      }

      if (msg.type === 'cmd') {
        handleCmd(msg.payload);
        setTimeout(() => send('state', getState()), 200);
      }
    };

    ws.onerror = () => {
      console.error('[dp-sync] erreur WebSocket');
      setBadge(dot, lbl, 'error', code);
    };

    ws.onclose = () => {
      console.warn('[dp-sync] relay déconnecté — reconnexion dans 3s');
      connected = false;
      setBadge(dot, lbl, 'waiting', code);
      setTimeout(connect, 3000);
    };
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  function init() {
    const b = createBadge(code);
    dot = b.dot; lbl = b.lbl;
    connect();
    window.dpSync = { getCode: () => code, getState };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
