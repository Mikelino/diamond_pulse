/**
 * dp-sync.js — Diamond Pulse Surface Panel Sync
 * Zero install — PeerJS via CDN (WebRTC peer-to-peer)
 *
 * INTÉGRATION dans Diamond Pulse :
 *   <script src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"></script>
 *   <script src="js/dp-sync.js"></script>
 */

(function () {
  'use strict';

  function genCode() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  // ─── Badge UI (coin inférieur GAUCHE) ──────────────────────────────────────

  function createBadge(code) {
    const badge = document.createElement('div');
    badge.id = 'dp-sync-badge';
    Object.assign(badge.style, {
      position:     'fixed',
      bottom:       '14px',
      left:         '14px',
      zIndex:       '99999',
      background:   '#0d0d14',
      color:        'rgba(255,255,255,0.55)',
      border:       '0.5px solid rgba(255,255,255,0.15)',
      borderRadius: '10px',
      padding:      '8px 14px',
      fontFamily:   'monospace',
      fontSize:     '12px',
      cursor:       'default',
      userSelect:   'none',
      display:      'flex',
      alignItems:   'center',
      gap:          '8px',
    });

    const dot = document.createElement('span');
    dot.id = 'dp-sync-dot';
    dot.textContent = '◉';
    dot.style.color = '#888780';

    const label = document.createElement('span');
    label.id = 'dp-sync-label';
    label.textContent = 'SYNC · ' + code;

    badge.appendChild(dot);
    badge.appendChild(label);
    document.body.appendChild(badge);
    return { badge, dot, label };
  }

  function setBadgeState(dot, label, state, code) {
    if (state === 'waiting') {
      dot.style.color = '#888780';
      label.textContent = 'SYNC · ' + code;
    } else if (state === 'connected') {
      dot.style.color = '#1D9E75';
      label.textContent = 'Surface · connectée';
    } else if (state === 'error') {
      dot.style.color = '#E24B4A';
      label.textContent = 'SYNC · erreur réseau';
    }
  }

  // ─── Lecture de l'état courant de Diamond Pulse ────────────────────────────

  function getCurrentState() {
    return {
      mode:    detectMode(),
      score:   readScore(),
      inning:  readInning(),
      count:   readCount(),
      runners: readRunners(),
      atBat:   readText('#at-bat-name, .at-bat-player, [data-at-bat]'),
      onDeck:  readText('#on-deck-name, .on-deck-player, [data-on-deck]'),
    };
  }

  function detectMode() {
    const active = document.querySelector(
      '.tab-active, [aria-selected="true"], .mode-btn.active, .nav-link.active, [data-mode].active'
    );
    if (!active) return 'live';
    const t = active.textContent.toLowerCase();
    if (t.includes('lineup'))    return 'lineup';
    if (t.includes('social'))    return 'social';
    if (t.includes('broadcast')) return 'broadcast';
    return 'live';
  }

  function readScore() {
    const nums = document.querySelectorAll('.score-value, [data-score], .score-number');
    return {
      home: nums[0] ? (parseInt(nums[0].textContent) || 0) : 0,
      away: nums[1] ? (parseInt(nums[1].textContent) || 0) : 0,
    };
  }

  function readInning() {
    const numEl  = document.querySelector('[data-inning], .inning-number, #inning-num');
    const halfEl = document.querySelector('[data-inning-half], .inning-half, #inning-half');
    return {
      number: numEl  ? (parseInt(numEl.textContent)  || 1) : 1,
      half:   halfEl ? (halfEl.textContent.includes('▼') ? 'bottom' : 'top') : 'top',
    };
  }

  function readCount() {
    const balls   = document.querySelector('[data-balls], .balls-count, #balls');
    const strikes = document.querySelector('[data-strikes], .strikes-count, #strikes');
    const outs    = document.querySelector('[data-outs], .outs-count, #outs');
    return {
      balls:   balls   ? (parseInt(balls.textContent)   || 0) : 0,
      strikes: strikes ? (parseInt(strikes.textContent) || 0) : 0,
      outs:    outs    ? (parseInt(outs.textContent)    || 0) : 0,
    };
  }

  function readRunners() {
    return {
      first:  !!document.querySelector('[data-runner="1"].active, .runner-first.on'),
      second: !!document.querySelector('[data-runner="2"].active, .runner-second.on'),
      third:  !!document.querySelector('[data-runner="3"].active, .runner-third.on'),
    };
  }

  function readText(selector) {
    const el = document.querySelector(selector);
    return el ? el.textContent.trim() : '';
  }

  // ─── Actions reçues depuis la Surface ──────────────────────────────────────

  function handleCommand(cmd) {
    console.log('[dp-sync] commande:', cmd);
    const map = {
      set_mode:       () => activateMode(cmd.mode),
      batter_next:    () => click('[data-batter-next], .batter-next, button.next-batter'),
      batter_prev:    () => click('[data-batter-prev], .batter-prev, button.prev-batter'),
      score_home_inc: () => click('[data-score-home-inc], button[data-team="home"][data-action="inc"]'),
      score_home_dec: () => click('[data-score-home-dec], button[data-team="home"][data-action="dec"]'),
      score_away_inc: () => click('[data-score-away-inc], button[data-team="away"][data-action="inc"]'),
      score_away_dec: () => click('[data-score-away-dec], button[data-team="away"][data-action="dec"]'),
      count_reset:    () => click('[data-count-reset], .reset-count, button.count-reset'),
      inning_next:    () => click('[data-inning-inc], .inning-up'),
      inning_prev:    () => click('[data-inning-dec], .inning-down'),
      toggle_half:    () => click('[data-toggle-half], .toggle-half, button.inning-half'),
      runner_first:   () => click('[data-runner="1"], .runner-first'),
      runner_second:  () => click('[data-runner="2"], .runner-second'),
      runner_third:   () => click('[data-runner="3"], .runner-third'),
      runners_clear:  () => click('[data-runners-clear], .clear-runners'),
      stop_all:       () => click('[data-stop-all], .stop-all'),
      copy_obs_url:   () => click('[data-copy-obs], .copy-obs'),
      lineup_next:    () => click('[data-lineup-next], .lineup-next'),
      lineup_prev:    () => click('[data-lineup-prev], .lineup-prev'),
      play_sound:     () => playSound(cmd.soundId),
    };
    if (map[cmd.action]) map[cmd.action]();
  }

  function click(selector) {
    const el = document.querySelector(selector);
    if (el) { el.click(); }
    else { console.warn('[dp-sync] non trouvé:', selector); }
  }

  function activateMode(mode) {
    document.querySelectorAll('[role="tab"], .tab-btn, .mode-tab, nav button, .nav-link').forEach(tab => {
      if (tab.textContent.toLowerCase().includes(mode)) tab.click();
    });
  }

  function playSound(soundId) {
    const btn = document.querySelector(
      `[data-sound-id="${soundId}"] .play-btn, [data-sound="${soundId}"] button.play`
    );
    if (btn) btn.click();
  }

  // ─── Observation des changements ───────────────────────────────────────────

  function watchState(onStateChange) {
    let last = JSON.stringify(getCurrentState());
    let timer = null;

    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const next = JSON.stringify(getCurrentState());
        if (next !== last) { last = next; onStateChange(JSON.parse(next)); }
      }, 80);
    });

    observer.observe(document.body, {
      childList: true, subtree: true, attributes: true, characterData: true,
    });
    return observer;
  }

  // ─── Init PeerJS Cloud officiel ────────────────────────────────────────────

  function init() {
    if (typeof Peer === 'undefined') {
      console.error('[dp-sync] PeerJS non chargé. Vérifie que le script PeerJS est inclus avant dp-sync.js');
      return;
    }

    const code = genCode();
    const { dot, label } = createBadge(code);

    // Sans paramètres = PeerJS Cloud officiel (peerjs.com) — fiable et gratuit
    const peer = new Peer('dp-' + code);

    let conn     = null;
    let observer = null;

    peer.on('open', (id) => {
      console.log('[dp-sync] prêt · code:', code, '· peer id:', id);
    });

    peer.on('error', (err) => {
      console.error('[dp-sync] erreur PeerJS:', err.type, err.message);
      // Si l'ID est déjà pris (redémarrage rapide), on ne change pas le badge
      if (err.type !== 'unavailable-id') {
        setBadgeState(dot, label, 'error', code);
      }
    });

    peer.on('connection', (connection) => {
      conn = connection;

      conn.on('open', () => {
        setBadgeState(dot, label, 'connected', code);
        // Envoie l'état complet dès la connexion
        conn.send({ type: 'state', payload: getCurrentState() });

        // Surveille les changements dans Diamond Pulse
        observer = watchState((state) => {
          if (conn && conn.open) conn.send({ type: 'state', payload: state });
        });
      });

      conn.on('data', (data) => {
        if (data.type === 'command') {
          handleCommand(data.payload);
          setTimeout(() => {
            if (conn && conn.open) conn.send({ type: 'state', payload: getCurrentState() });
          }, 200);
        }
      });

      conn.on('close', () => {
        setBadgeState(dot, label, 'waiting', code);
        if (observer) { observer.disconnect(); observer = null; }
        conn = null;
        console.log('[dp-sync] Surface déconnectée');
      });
    });

    // API publique pour debug depuis la console
    window.dpSync = {
      getCode:  () => code,
      getState: getCurrentState,
      peer,
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
