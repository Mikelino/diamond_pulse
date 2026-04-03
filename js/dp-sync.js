/**
 * dp-sync.js — Diamond Pulse Surface Panel Sync
 * Supabase Realtime Broadcast — zéro installation
 *
 * INTÉGRATION dans index.html (après js/config.js) :
 *   <script src="js/dp-sync.js"></script>
 */

(function () {
  'use strict';

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
    dot.id = 'dp-sync-dot'; dot.textContent = '◉'; dot.style.color = '#888780';
    const lbl = document.createElement('span');
    lbl.id = 'dp-sync-label'; lbl.textContent = 'SYNC · ' + code;
    badge.appendChild(dot); badge.appendChild(lbl);
    document.body.appendChild(badge);
    return { dot, lbl };
  }

  function setBadge(dot, lbl, state, code) {
    const s = {
      waiting:   { c: '#888780', t: 'SYNC · ' + code },
      connected: { c: '#1D9E75', t: 'Surface · connectée' },
      error:     { c: '#E24B4A', t: 'SYNC · erreur' },
    }[state] || { c: '#888780', t: 'SYNC · ' + code };
    dot.style.color = s.c;
    lbl.textContent = s.t;
  }

  // ─── Lecture de l'état Diamond Pulse ───────────────────────────────────────

  function getState() {
    return {
      score:   {
        home: readInt('#matchScoreHome'),
        away: readInt('#matchScoreAway'),
      },
      inning:  {
        number: readInt('#matchInningNum'),
        half:   readHalf(),
      },
      count:   {
        balls:   countDots('#matchBalls .match-dot'),
        strikes: countDots('#matchStrikes .match-dot'),
        outs:    countDots('#matchOuts .match-dot'),
      },
      runners: {
        first:  isBaseOn('matchBase1'),
        second: isBaseOn('matchBase2'),
        third:  isBaseOn('matchBase3'),
      },
      atBat:  readText('#matchBatterDisplay'),
      onDeck: readText('#matchOnDeckDisplay'),
    };
  }

  function readInt(sel) {
    const e = document.querySelector(sel);
    return e ? (parseInt(e.textContent) || 0) : 0;
  }
  function readText(sel) {
    const e = document.querySelector(sel);
    return e ? e.textContent.trim() : '';
  }
  function readHalf() {
    const e = document.getElementById('matchInningArrow');
    return e && e.textContent.trim() === '▼' ? 'bottom' : 'top';
  }

  // Compte les dots actifs (fill non transparent)
  function countDots(sel) {
    let n = 0;
    document.querySelectorAll(sel).forEach(el => {
      const bg = window.getComputedStyle(el).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') n++;
    });
    return n;
  }

  // Vérifie si une base a un coureur (fill non transparent sur le rect SVG)
  function isBaseOn(id) {
    const el = document.getElementById(id);
    if (!el) return false;
    const fill = el.getAttribute('fill') || 'transparent';
    return fill !== 'transparent' && fill !== '' && fill !== 'none';
  }

  // ─── Commandes reçues depuis la Surface ────────────────────────────────────

  function handleCmd(payload) {
    const { action } = payload;
    console.log('[dp-sync] commande:', action);

    switch (action) {
      // Score
      case 'score_home_inc': tap("button[onclick=\"matchScoreAdj('home',1)\"]");    break;
      case 'score_home_dec': tap("button[onclick=\"matchScoreAdj('home',-1)\"]");   break;
      case 'score_away_inc': tap("button[onclick=\"matchScoreAdj('away',1)\"]");    break;
      case 'score_away_dec': tap("button[onclick=\"matchScoreAdj('away',-1)\"]");   break;

      // Inning
      case 'inning_next':   tap("button[onclick='matchInningAdj(1)']");    break;
      case 'inning_prev':   tap("button[onclick='matchInningAdj(-1)']");   break;
      case 'toggle_half':   tap("button#matchInningArrow, [onclick='matchInningToggle()']"); break;
      case 'change_field':  callFn('matchChangeField');                    break;

      // Count — set_count avec type + value
      case 'set_count':     setCount(payload.type, payload.value);        break;
      case 'count_reset':   callFn('matchResetCount');                     break;
      case 'walk':          callFn('matchWalk');                           break;
      case 'strikeout':     callFn('matchStrikeout');                      break;

      // Runners — matchToggleRunner(base)
      case 'toggle_runner_first':  callFn('matchToggleRunner', 'first');  break;
      case 'toggle_runner_second': callFn('matchToggleRunner', 'second'); break;
      case 'toggle_runner_third':  callFn('matchToggleRunner', 'third');  break;
      case 'runners_clear':        callFn('matchClearRunners');            break;

      // Batter
      case 'batter_next': tap("button[onclick='matchBatterAdj(1)']");  break;
      case 'batter_prev': tap("button[onclick='matchBatterAdj(-1)']"); break;

      // Sponsors
      case 'broadcast_silver':   callFn('broadcastSilverBlock'); break;
      case 'broadcast_ballgame': callFn('broadcastBallGame');    break;

      // Sons
      case 'stop_all':   if (typeof liveSoundStopAll === 'function') liveSoundStopAll(); break;
      case 'play_sound': if (typeof liveSoundPlay === 'function') liveSoundPlay(payload.soundId); break;

      // OBS
      case 'copy_obs_url': callFn('matchCopyOverlayUrl'); break;

      default: console.warn('[dp-sync] commande inconnue:', action);
    }
  }

  // Clique sur le premier élément trouvé par sélecteur
  function tap(sel) {
    const el = document.querySelector(sel);
    if (el) { el.click(); }
    else { console.warn('[dp-sync] élément non trouvé:', sel); }
  }

  // Appelle une fonction globale avec arguments optionnels
  function callFn(name, ...args) {
    if (typeof window[name] === 'function') {
      window[name](...args);
    } else {
      console.warn('[dp-sync] fonction non trouvée:', name);
    }
  }

  // Set count via matchState direct ou via dots
  function setCount(type, value) {
    // Méthode 1 : état direct si matchState disponible
    if (typeof matchState !== 'undefined' &&
        typeof matchRenderPanel === 'function' &&
        typeof matchSave === 'function') {
      try {
        matchState[type] = value;
        matchRenderPanel();
        matchSave();
        return;
      } catch(e) { /* fallback */ }
    }
    // Méthode 2 : clic sur le dot correspondant
    const sel = { balls: '#matchBalls', strikes: '#matchStrikes', outs: '#matchOuts' }[type];
    if (!sel) return;
    const dots = document.querySelectorAll(sel + ' .match-dot');
    if (value === 0) {
      // Reset : clique sur le premier dot actif pour tout désactiver
      if (dots[0]) dots[0].click();
    } else if (dots[value - 1]) {
      dots[value - 1].click();
    }
  }

  // ─── Observation des changements ───────────────────────────────────────────

  function watchState(onChange) {
    let last = JSON.stringify(getState()), timer = null;
    const obs = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const next = JSON.stringify(getState());
        if (next !== last) { last = next; onChange(JSON.parse(next)); }
      }, 100);
    });
    obs.observe(document.body, {
      childList: true, subtree: true, attributes: true, characterData: true,
    });
    return obs;
  }

  // ─── Init Supabase Realtime ────────────────────────────────────────────────

  function init() {
    if (!window.supabase) {
      console.error('[dp-sync] window.supabase non disponible. Vérifie que config.js est chargé avant dp-sync.js.');
      return;
    }

    const code = genCode();
    const { dot, lbl } = createBadge(code);
    const channelName = 'dp-panel-' + code;
    console.log('[dp-sync] démarrage · code:', code);

    let observer = null;

    const channel = window.supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'join' }, () => {
        setBadge(dot, lbl, 'connected', code);
        console.log('[dp-sync] Surface connectée');
        // Envoie l'état complet immédiatement
        channel.send({ type: 'broadcast', event: 'state', payload: getState() });
        // Surveille les changements
        if (!observer) {
          observer = watchState(state => {
            channel.send({ type: 'broadcast', event: 'state', payload: state });
          });
        }
      })
      .on('broadcast', { event: 'leave' }, () => {
        setBadge(dot, lbl, 'waiting', code);
        if (observer) { observer.disconnect(); observer = null; }
        console.log('[dp-sync] Surface déconnectée');
      })
      .on('broadcast', { event: 'cmd' }, ({ payload }) => {
        handleCmd(payload);
        // Renvoie l'état mis à jour après l'action
        setTimeout(() => {
          channel.send({ type: 'broadcast', event: 'state', payload: getState() });
        }, 250);
      })
      .subscribe(status => {
        console.log('[dp-sync] Supabase:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[dp-sync] prêt · code:', code);
        }
      });

    window.dpSync = { getCode: () => code, getState, channel };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
