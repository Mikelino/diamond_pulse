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
      score:   { home: readInt('#matchScoreHome'), away: readInt('#matchScoreAway') },
      inning:  { number: readInt('#matchInningNum'), half: readHalf() },
      count:   {
        balls:   countActive('#matchBalls .match-dot'),
        strikes: countActive('#matchStrikes .match-dot'),
        outs:    countActive('#matchOuts .match-dot'),
      },
      runners: {
        first:  isRunnerOn('first'),
        second: isRunnerOn('second'),
        third:  isRunnerOn('third'),
      },
      atBat:  readText('#matchBatterDisplay'),
      onDeck: readText('#matchOnDeckDisplay'),
    };
  }

  function readInt(sel)    { const e = document.querySelector(sel); return e ? (parseInt(e.textContent) || 0) : 0; }
  function readText(sel)   { const e = document.querySelector(sel); return e ? e.textContent.trim() : ''; }
  function readHalf()      { const e = document.querySelector('#matchInningArrow'); return e && e.textContent.includes('▼') ? 'bottom' : 'top'; }

  function countActive(sel) {
    let n = 0;
    document.querySelectorAll(sel).forEach(el => {
      const bg = el.style.background || el.style.backgroundColor || '';
      if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') n++;
    });
    return n;
  }

  function isRunnerOn(base) {
    const base2id = { first: 'matchBase1', second: 'matchBase2', third: 'matchBase3' };
    const el = document.getElementById(base2id[base]);
    if (!el) return false;
    const fill = el.getAttribute('fill') || '';
    return fill !== 'transparent' && fill !== '' && fill !== 'rgba(0,0,0,0)';
  }

  // ─── Commandes reçues depuis la Surface ────────────────────────────────────

  function handleCmd(cmd) {
    console.log('[dp-sync] commande:', cmd.action);
    const map = {
      // Score
      score_home_inc:    () => tap('[onclick="matchScoreAdj(\'home\',1)"]'),
      score_home_dec:    () => tap('[onclick="matchScoreAdj(\'home\',-1)"]'),
      score_away_inc:    () => tap('[onclick="matchScoreAdj(\'away\',1)"]'),
      score_away_dec:    () => tap('[onclick="matchScoreAdj(\'away\',-1)"]'),
      // Inning
      inning_next:       () => tap('[onclick="matchInningAdj(1)"]'),
      inning_prev:       () => tap('[onclick="matchInningAdj(-1)"]'),
      toggle_half:       () => tap('[onclick="matchInningToggle()"]'),
      change_field:      () => tap('[onclick="matchChangeField()"]'),
      // Count — set direct via matchSetCount
      set_count:         () => setCountDP(cmd.type, cmd.value),
      count_reset:       () => tap('[onclick="matchResetCount()"]'),
      // Walk & Strikeout
      walk:              () => tap('[onclick="matchWalk()"]'),
      strikeout:         () => tap('[onclick="matchStrikeout()"]'),
      // Runners
      toggle_runner_first:  () => tap('[onclick="matchToggleRunner(\'first\')"]'),
      toggle_runner_second: () => tap('[onclick="matchToggleRunner(\'second\')"]'),
      toggle_runner_third:  () => tap('[onclick="matchToggleRunner(\'third\')"]'),
      runners_clear:        () => tap('[onclick="matchClearRunners()"]'),
      // Batter
      batter_next:       () => tap('[onclick="matchBatterAdj(1)"]'),
      batter_prev:       () => tap('[onclick="matchBatterAdj(-1)"]'),
      // Sponsors
      broadcast_silver:  () => tap('[onclick="broadcastSilverBlock()"]'),
      broadcast_ballgame:() => tap('[onclick="broadcastBallGame()"]'),
      // Sons
      stop_all:          () => { if (typeof liveSoundStopAll === 'function') liveSoundStopAll(); },
      play_sound:        () => { if (typeof liveSoundPlay === 'function') liveSoundPlay(cmd.soundId); },
      // OBS
      copy_obs_url:      () => tap('[onclick="matchCopyOverlayUrl()"]'),
    };
    if (map[cmd.action]) map[cmd.action]();
    else console.warn('[dp-sync] commande inconnue:', cmd.action);
  }

  function tap(sel) {
    const el = document.querySelector(sel);
    if (el) el.click();
    else console.warn('[dp-sync] élément non trouvé:', sel);
  }

  // Appelle matchSetCount(type, value) directement si disponible
  function setCountDP(type, value) {
    if (typeof matchSetCount === 'function') {
      // matchSetCount attend l'index 0-based du dernier dot cliqué
      // On simule : on clique sur le dot correspondant
      const dotMap = {
        balls:   ['b0','b1','b2'],
        strikes: ['s0','s1'],
        outs:    ['o0','o1'],
      };
      // Appel direct via la fonction globale si disponible
      try {
        // matchState est l'objet d'état global dans Diamond Pulse
        if (typeof matchState !== 'undefined' && typeof matchRenderPanel === 'function' && typeof matchSave === 'function') {
          matchState[type] = value;
          matchRenderPanel();
          matchSave();
          return;
        }
      } catch(e) {}
      // Fallback : clique sur le bon dot
      const sel = { balls: '#matchBalls', strikes: '#matchStrikes', outs: '#matchOuts' }[type];
      const dots = document.querySelectorAll(sel + ' .match-dot');
      if (dots[value > 0 ? value - 1 : 0]) dots[value > 0 ? value - 1 : 0].click();
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
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    return obs;
  }

  // ─── Init Supabase Realtime ────────────────────────────────────────────────

  function init() {
    if (!window.supabase) {
      console.error('[dp-sync] window.supabase non disponible. config.js chargé avant dp-sync.js ?');
      return;
    }

    const code = genCode();
    const { dot, lbl } = createBadge(code);
    const channelName = 'dp-panel-' + code;
    console.log('[dp-sync] démarrage · code:', code);

    let observer = null;

    const channel = window.supabase.channel(channelName, {
      config: { broadcast: { self: false } }
    });

    channel
      .on('broadcast', { event: 'join' }, () => {
        setBadge(dot, lbl, 'connected', code);
        console.log('[dp-sync] Surface connectée');
        channel.send({ type: 'broadcast', event: 'state', payload: getState() });
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
        setTimeout(() => {
          channel.send({ type: 'broadcast', event: 'state', payload: getState() });
        }, 200);
      })
      .subscribe(status => {
        console.log('[dp-sync] Supabase Realtime:', status);
        if (status === 'SUBSCRIBED') console.log('[dp-sync] prêt · code:', code);
      });

    window.dpSync = { getCode: () => code, getState, channel };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
