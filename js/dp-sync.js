/**
 * dp-sync.js — Diamond Pulse Surface Panel Sync
 * Utilise Supabase Realtime Broadcast — déjà chargé dans Diamond Pulse
 *
 * INTÉGRATION dans index.html (après js/config.js) :
 *   <script src="js/dp-sync.js"></script>
 *
 * Supabase est déjà disponible via window.supabase (chargé dans config.js)
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
      error:     { c: '#E24B4A', t: 'SYNC · erreur' },
    }[state] || { c: '#888780', t: 'SYNC · ' + code };
    dot.style.color = s.c;
    lbl.textContent = s.t;
  }

  // ─── Lecture de l'état Diamond Pulse ───────────────────────────────────────

  function getState() {
    return {
      mode:   detectMode(),
      score:  { home: readInt('#matchScoreHome'), away: readInt('#matchScoreAway') },
      inning: { number: readInt('#matchInningNum'), half: readHalf() },
      count:  {
        balls:   countActive('#matchBalls .match-dot'),
        strikes: countActive('#matchStrikes .match-dot'),
        outs:    countActive('#matchOuts .match-dot'),
      },
      atBat:  readText('#matchBatterDisplay'),
      onDeck: readText('#matchOnDeckDisplay'),
    };
  }

  function detectMode() {
    const btn = document.querySelector('#mainNavLive.active, #mainNavBatting.active, #mainNavSocial.active');
    if (!btn) return 'live';
    if (btn.id === 'mainNavBatting') return 'lineup';
    if (btn.id === 'mainNavSocial')  return 'social';
    return 'live';
  }

  function readInt(sel)    { const e = document.querySelector(sel); return e ? (parseInt(e.textContent) || 0) : 0; }
  function readText(sel)   { const e = document.querySelector(sel); return e ? e.textContent.trim() : ''; }
  function readHalf()      { const e = document.querySelector('#matchInningArrow'); return e && e.textContent.includes('▼') ? 'bottom' : 'top'; }
  function countActive(sel){ return document.querySelectorAll(sel + '[style*="background: rgb"]').length ||
                                    document.querySelectorAll(sel + '.active').length; }

  // ─── Commandes reçues depuis la Surface ────────────────────────────────────

  function handleCmd(cmd) {
    console.log('[dp-sync] commande:', cmd.action);
    const map = {
      set_mode:       () => activateMode(cmd.mode),
      batter_next:    () => tap('[onclick="matchBatterAdj(1)"]'),
      batter_prev:    () => tap('[onclick="matchBatterAdj(-1)"]'),
      score_home_inc: () => tap('[onclick="matchScoreAdj(\'home\',1)"]'),
      score_home_dec: () => tap('[onclick="matchScoreAdj(\'home\',-1)"]'),
      score_away_inc: () => tap('[onclick="matchScoreAdj(\'away\',1)"]'),
      score_away_dec: () => tap('[onclick="matchScoreAdj(\'away\',-1)"]'),
      count_reset:    () => tap('[onclick="matchResetCount()"]'),
      inning_next:    () => tap('[onclick="matchInningAdj(1)"]'),
      inning_prev:    () => tap('[onclick="matchInningAdj(-1)"]'),
      toggle_half:    () => tap('[onclick="matchInningToggle()"]'),
      runner_first:   () => tap('[onclick="matchToggleRunner(\'first\')"]'),
      runner_second:  () => tap('[onclick="matchToggleRunner(\'second\')"]'),
      runner_third:   () => tap('[onclick="matchToggleRunner(\'third\')"]'),
      runners_clear:  () => tap('[onclick="matchClearRunners()"]'),
      stop_all:       () => { if (typeof liveSoundStopAll === 'function') liveSoundStopAll(); },
      copy_obs_url:   () => tap('[onclick="matchCopyOverlayUrl()"]'),
      play_sound:     () => { if (typeof liveSoundPlay === 'function') liveSoundPlay(cmd.soundId); },
    };
    if (map[cmd.action]) map[cmd.action]();
    else console.warn('[dp-sync] commande inconnue:', cmd.action);
  }

  function tap(sel) {
    const el = document.querySelector(sel);
    if (el) el.click();
    else console.warn('[dp-sync] non trouvé:', sel);
  }

  function activateMode(mode) {
    const map = { live: 'mainNavLive', lineup: 'mainNavBatting', social: 'mainNavSocial' };
    const btn = document.getElementById(map[mode]);
    if (btn) btn.click();
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
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    return obs;
  }

  // ─── Init Supabase Realtime ────────────────────────────────────────────────

  function init() {
    if (!window.supabase) {
      console.error('[dp-sync] window.supabase non disponible. Vérifie que config.js est chargé avant dp-sync.js');
      return;
    }

    const code = genCode();
    const { dot, lbl } = createBadge(code);
    const channelName = 'dp-panel-' + code;

    console.log('[dp-sync] démarrage · code:', code);

    let observer = null;
    let surfacePresent = false;

    const channel = window.supabase.channel(channelName, {
      config: { broadcast: { self: false } }
    });

    channel
      .on('broadcast', { event: 'join' }, () => {
        surfacePresent = true;
        setBadge(dot, lbl, 'connected', code);
        console.log('[dp-sync] Surface connectée');
        // Envoie l'état immédiatement
        channel.send({ type: 'broadcast', event: 'state', payload: getState() });
        // Surveille les changements
        if (!observer) {
          observer = watchState(state => {
            channel.send({ type: 'broadcast', event: 'state', payload: state });
          });
        }
      })
      .on('broadcast', { event: 'leave' }, () => {
        surfacePresent = false;
        setBadge(dot, lbl, 'waiting', code);
        if (observer) { observer.disconnect(); observer = null; }
        console.log('[dp-sync] Surface déconnectée');
      })
      .on('broadcast', { event: 'cmd' }, ({ payload }) => {
        handleCmd(payload);
        setTimeout(() => {
          channel.send({ type: 'broadcast', event: 'state', payload: getState() });
        }, 200);
      })
      .subscribe((status) => {
        console.log('[dp-sync] Supabase Realtime:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[dp-sync] prêt · code:', code);
        }
      });

    window.dpSync = { getCode: () => code, getState, channel };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
