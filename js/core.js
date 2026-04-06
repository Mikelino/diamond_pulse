/* ============================================================
   Diamond Pulse — js/core.js
   Pack Free : navigation + init() sans Live Mode

   Remplace audio.js + soundboard.js pour la distribution Free.
   Chargé en DERNIER dans index-free.html (comme soundboard.js
   l'est dans la version complète).

   Fonctions exposées :
   - mainSwitchTab(tab)
   - switchTeam(teamId)
   - togglePlay(), startPlayback(), stopPlayback()
   - ttsUnlock(), ttsSpeak(), ttsBuildText(), ttsBuildIntroText()
   - renderLiveLineup(), renderLiveVisitors(), renderFieldSongs()
   - initLiveMobileTabs(), renderCustomSounds(), liveSoundEditClose()
   - matchRenderPanel(), matchAutoSetPitcher(), matchSave()
   - showUpgradePrompt(requiredTier)
   - loadLicense(), applyFeatures()
   - init()

   Dépend de (globals) :
   - FEATURES, LICENSE_CACHE_KEY, LICENSE_CACHE_TTL  → data.js
   - appSettings, teams, currentTeamId, allPlayers   → data.js
   - SUPABASE_URL, SUPABASE_KEY                      → data.js
   - saveConfig(), loadConfig(), updateTeamSelector() → data.js
   - render()                                        → players.js
   - refreshOpponentSelects()                        → settings.js
   - renderVisitorsLineup()                          → social.js
   ============================================================ */

// ── Variables partagées (attendues par players.js, settings.js) ──
let cfgAdminUnlocked   = false;
let cfgRenameTargetKey = null;
let cfgDeleteTargetKey = null;

let currentAudio     = null;
let currentPid       = null;
let progressInterval = null;
let sortable         = null;
let isEditMode       = false;

// visitorsLineup attendu par social.js
let visitorsLineup = JSON.parse(localStorage.getItem('visitorsLineup') || '[]');

// ── TEAM SWITCHING ──────────────────────────────────────────────

function switchTeam(teamId) {
  if (!teams[teamId]) return;
  stopPlayback();
  currentTeamId = teamId;
  localStorage.setItem('lastTeamId', teamId);
  document.getElementById('sectionLabel').textContent =
    '⚾ Batting Order — ' + teams[teamId].label;
  document.getElementById('addForm').classList.remove('open');
  render();
}

// ── AUDIO — stubs (fonctionnalité Pro) ─────────────────────────

function togglePlay(entryIndex, e) {
  showUpgradePrompt('Pro');
}

async function startPlayback(entry, entryIndex) {
  showUpgradePrompt('Pro');
}

function stopPlayback() {
  if (currentAudio) { try { currentAudio.pause(); } catch(e) {} currentAudio = null; }
  currentPid = null;
  if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }
}

function ttsUnlock() {}
async function ttsSpeak()          {}
function ttsBuildText()            { return ''; }
function ttsBuildIntroText()       { return ''; }

// ── LIVE MODE — stubs (fonctionnalité Pro) ─────────────────────

function renderLiveLineup()    {}
function renderLiveVisitors()  {}
function renderFieldSongs()    {}
function initLiveMobileTabs()  {}
function renderCustomSounds()  {}
function liveSoundEditClose()  {}
function matchRenderPanel()    {}
function matchAutoSetPitcher() {}
async function matchSave()     {}

// ── NAVIGATION PRINCIPALE ───────────────────────────────────────

function mainSwitchTab(tab) {
  if (tab === 'live') { showUpgradePrompt('Pro'); return; }
  document.querySelectorAll('.main-nav-btn')
    .forEach(b => b.classList.remove('active'));
  const navBtn = document.getElementById(
    'mainNav' + tab.charAt(0).toUpperCase() + tab.slice(1)
  );
  if (navBtn) navBtn.classList.add('active');
  document.querySelectorAll('.main-panel')
    .forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(
    'mainPanel' + tab.charAt(0).toUpperCase() + tab.slice(1)
  );
  if (panel) panel.classList.add('active');
  const addForm = document.getElementById('addForm');
  if (tab !== 'batting' && addForm) addForm.classList.remove('open');
  if (tab === 'batting' && typeof renderVisitorsLineup === 'function') {
    renderVisitorsLineup();
  }
}

// ── UPGRADE PROMPT ──────────────────────────────────────────────

function showUpgradePrompt(requiredTier) {
  const isBroadcast = requiredTier === 'Broadcast';
  const msg = isBroadcast
    ? 'Broadcast Mode requires a Broadcast licence. Contact Diamond Pulse to activate this feature.'
    : 'Live audio features require a Pro licence. Contact Diamond Pulse to activate this feature.';

  const overlay = document.getElementById('upgradePromptOverlay');
  const title   = document.getElementById('upgradePromptTitle');
  const body    = document.getElementById('upgradePromptBody');
  if (overlay && title && body) {
    title.textContent = isBroadcast
      ? '🔒 Broadcast Licence Required'
      : '🔒 Pro Licence Required';
    body.textContent = msg;
    overlay.style.display = 'flex';
  } else {
    alert(msg);
  }
}

// ── LICENCE ────────────────────────────────────────────────────

async function loadLicense() {
  let cached = null;
  try {
    const raw = localStorage.getItem(LICENSE_CACHE_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch(e) {}

  const now = Date.now();
  const cacheValid = cached?.features && cached?.validatedAt &&
                     (now - cached.validatedAt) < LICENSE_CACHE_TTL;

  if (cacheValid) {
    FEATURES = { ...FEATURES, ...cached.features };
    applyFeatures();
    return;
  }

  try {
    const licenseKey = appSettings?.licenseKey;
    if (!licenseKey) { applyFeatures(); return; }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/licenses?key=eq.${licenseKey}&active=eq.true&select=features,expires_at`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const rows = await res.json();
    if (!rows?.length) {
      localStorage.removeItem(LICENSE_CACHE_KEY);
      applyFeatures();
      return;
    }

    const { features, expires_at } = rows[0];
    if (expires_at && new Date(expires_at) < new Date()) {
      localStorage.removeItem(LICENSE_CACHE_KEY);
      applyFeatures();
      return;
    }

    FEATURES = { ...FEATURES, ...features };
    localStorage.setItem(LICENSE_CACHE_KEY, JSON.stringify({ features, validatedAt: now }));

  } catch(e) {
    if (cached?.features) {
      console.warn('[Diamond Pulse] Offline — using cached licence');
      FEATURES = { ...FEATURES, ...cached.features };
    }
  } finally {
    applyFeatures();
  }
}

function applyFeatures() {
  // Pack Free : le bouton Live Mode n'existe pas dans ce HTML.
  // Si une licence Pro est détectée → informer l'utilisateur qu'il peut
  // passer à la version complète.
  if (FEATURES.soundboard) {
    const banner = document.getElementById('freeUpgradeBanner');
    if (banner) banner.style.display = '';
  }
}

// ── INIT ───────────────────────────────────────────────────────

async function init() {
  const indicator = document.getElementById('saveIndicator');
  if (indicator) {
    indicator.textContent = '⏳ Loading...';
    indicator.classList.add('visible');
  }

  await loadConfig();
  await loadLicense();

  const lastTeamId = localStorage.getItem('lastTeamId');
  if (lastTeamId && teams[lastTeamId]) currentTeamId = lastTeamId;

  if (typeof updateTeamSelector    === 'function') updateTeamSelector();
  if (typeof refreshOpponentSelects === 'function') refreshOpponentSelects();

  document.body.classList.remove('edit-mode');
  const eb = document.getElementById('editModeBtn');
  if (eb) { eb.textContent = '✏️'; eb.title = 'Edit mode'; }
  isEditMode = false;

  if (indicator) indicator.classList.remove('visible');
  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
