# 💎 Diamond Pulse

**The game-day experience manager for baseball & softball clubs.**

Diamond Pulse is a self-hosted progressive web app (PWA) that gives your announcer full control over the atmosphere at every game — walk-up songs, team introductions, soundboard, inning change music, visitor lineup, and social media exports. No build step, no framework — just static files deployed on your own infrastructure.

---

## Table of Contents

1. [Features](#features)
2. [Installation & Setup](#installation--setup)
3. [Advanced Configuration](#advanced-configuration)
4. [Self-Hosting & Commercialization](#self-hosting--commercialization)
5. [Project Structure](#project-structure)
6. [Developer Notes](#developer-notes)

---

## Features

### 🎵 Live Mode

The main screen used on game day. Designed for one-handed operation on mobile.

**Walk-Up Songs**
- Batting order with drag-and-drop reordering
- Each player has a personal MP3 walk-up song stored in Supabase Storage
- One tap to play, auto-stop on next player
- Mark players as present/absent per game
- Support for a visitor lineup with walk-up songs

**Soundboard**
- 10 preset sound slots in two categories:
  - ⚾ Baseball: National Anthem, Home Run!, Strike Out, Walk Off
  - 🎭 Ambiance: Applause, Let's Go!, Charge!, Drumroll, Air Horn, Sad Trombone
- Unlimited custom sounds (upload any MP3)
- Mark custom sounds as ⭐ favorites — they sort to the top
- Stop All button to instantly silence everything

**Change Field Songs**
- Dedicated playlist for between-inning music
- Upload and manage MP3s independently of walk-up songs
- One tap to play, stop individually or via Stop All

**Team Introduction**
- Sequential player introduction overlay (full screen)
- Displays batting order number, player photo, position, jersey number, and name
- TTS (text-to-speech) player name announcement
- Background music with independent mixer
- Swipe left/right on mobile to navigate players
- Progress dots, pause/resume, previous/next controls

**Audio Mixer**
- Independent volume control for TTS and background music
- Mute per channel
- Persistent across sessions

### 📋 Lineup Mode

- Visual batting order editor
- Player presence toggle (present / absent)
- Drag-and-drop reordering (desktop and mobile long-press)
- Position assignment per game slot
- Visitor team lineup management

### 📸 Social Mode

Canvas-based image exports for Instagram stories:
- **Lineup card** — full batting order with player photos
- **Score card** — inning-by-inning score with team logos
- **MVP card** — spotlight on a selected player

All exports match your club's colors and identity.

### ⚙️ Configuration

- **Teams** — manage multiple teams, each with its own roster
- **Players** — name, jersey number, position, photo, walk-up song, TTS pronunciation
- **Club identity** — club name, logo, accent color, background color
- **Interface** — language (FR / EN / NL), theme
- **Positions** — customizable position labels
- **Opponents** — saved opponent teams for visitor lineup
- **Security** — optional password protection

---

## Installation & Setup

### Prerequisites

- A [Supabase](https://supabase.com) account (free tier is sufficient)
- A static hosting provider: [GitHub Pages](https://pages.github.com), Netlify, Vercel, or any web server

### Step 1 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **anon public key** (found under *Settings → API*)

### Step 2 — Run the SQL setup script

1. In your Supabase dashboard, go to **SQL Editor → New query**
2. Paste the contents of `setup.sql` and click **Run**

This creates:
- The `config` table (stores all app data as JSONB)
- Public RLS policies for read/write access
- Two storage buckets: `songs` (audio files) and `photos` (player photos)

### Step 3 — Configure the app

Edit `js/config.js` with your Supabase credentials and club defaults:

```js
const APP_CONFIG = {
  supabaseUrl:  'https://your-project.supabase.co',
  supabaseKey:  'your-anon-public-key',
  bucket:       'songs',
  clubName:     'Your Club Name',
  // ...other defaults
};
```

> `js/config.js` is only used on first launch. Once saved, all settings are read from Supabase and `config.js` is ignored.

### Step 4 — Deploy

Upload the full project folder to your hosting provider:

```
index.html
manifest.json
setup.sql          ← for reference only, not served
README.md          ← this file
css/
  style.css
js/
  config.js        ← fill in your Supabase credentials here
  data.js
  players.js
  audio.js
  social.js
  settings.js
  soundboard.js
icons/
  apple-touch-icon.png
```

For **GitHub Pages**: push to a public repository, enable Pages under *Settings → Pages*, and set the source to the `main` branch root.

### Step 5 — First launch

Open the app in a browser (Chrome or Safari recommended). On first load it will:
1. Read `js/config.js` defaults
2. Create the initial config entry in Supabase
3. Redirect you to the Config panel to complete setup

From this point, all data (players, songs, settings) is stored in Supabase. The app works as a PWA and can be added to the home screen on iOS and Android.

---

## Advanced Configuration

### Audio files

All audio is stored in the `songs` Supabase bucket with the following path conventions:

| Type | Path prefix |
|------|-------------|
| Walk-up songs | `{teamId}/{playerName}.mp3` |
| Preset soundboard | `soundboard/{key}.mp3` |
| Custom soundboard | `soundboard/custom_{id}.mp3` |
| Change field songs | `soundboard/field_{id}.mp3` |
| Intro background music | *(URL stored in appSettings)* |

Only MP3 files are supported.

### Player photos

Stored in the `photos` Supabase bucket. Photos are cropped to square in-app before upload. Recommended size: 400×400px minimum.

### TTS pronunciation

Each player has a **pronunciation** field (separate from their display name) used for the TTS announcer during Team Introduction. Use phonetic spelling for unusual names, e.g. `"Doe-min-ik"` instead of `"Dominique"`.

### Multi-team support

Diamond Pulse supports multiple teams within a single club (e.g. A-team, B-team, Women's team). Each team has its own roster and lineup. The active team is selected via the team selector in the header.

### Password protection

Enable password protection under *Config → Security*. This adds a lock screen on app load. The password is stored in Supabase config. Useful for shared devices where you don't want unauthorized changes.

### Language

The app is fully translated in **French**, **English**, and **Dutch**. Switch via the flag selector in the header. The language setting is persisted per device.

### Colors & branding

Set your club's accent color and background color under *Config → Interface*. Changes apply immediately and are saved to Supabase. The favicon and PWA icon are derived from your uploaded club logo.

---

## Self-Hosting & Commercialization

Diamond Pulse is designed from the ground up as a **self-hosted product**. There is no central server, no subscription, no shared infrastructure.

### Why self-hosted?

| Concern | How Diamond Pulse handles it |
|---|---|
| **Music rights** | Each club uses its own Supabase storage. Files never pass through a third-party server. |
| **GDPR** | Player data (names, photos) stays in the club's own Supabase project, in their chosen region. |
| **Reliability** | No dependency on a central service. If Supabase is up, the app works. |
| **Cost** | Supabase free tier covers most small clubs (500MB storage, 50,000 monthly active users). |

### Deployment package for a new club

When distributing Diamond Pulse to a new club, provide the full project folder (see structure above). The only file the club needs to edit is `js/config.js`.

### Setup for a new club — checklist

- [ ] Club creates a Supabase project (free)
- [ ] Club runs `setup.sql` in the SQL Editor
- [ ] Club fills in `js/config.js` with their URL and anon key
- [ ] Full project folder deployed to GitHub Pages or any static host
- [ ] App opened in browser, initial configuration completed
- [ ] Players added, photos uploaded, walk-up songs assigned
- [ ] Done — ready for game day

### Recommended hosting

| Provider | Cost | Notes |
|---|---|---|
| GitHub Pages | Free | Recommended. Simple, reliable, custom domain support. |
| Netlify | Free tier | Good alternative, drag-and-drop deploy. |
| Vercel | Free tier | Works well, slightly more setup. |
| Any web server | Variable | Any server that can serve static files works. |

### Supabase sizing

The Supabase free tier includes 500MB of storage. Typical usage per club:

- Player photos: ~50–200KB each → 25 players ≈ 5MB
- Walk-up songs (30s clips): ~500KB each → 25 players ≈ 12MB
- Soundboard + field songs: ~20MB typical

A club with a full roster and complete soundboard will use well under 100MB, leaving ample headroom on the free tier.

---

## Project Structure

```
diamond-pulse/
├── index.html              ← App shell — HTML structure only (~1 900 lines)
├── manifest.json           ← PWA manifest
├── setup.sql               ← One-time Supabase database setup
├── README.md               ← This file
├── css/
│   └── style.css           ← All styles (~2 600 lines)
├── js/
│   ├── config.js           ← Club configuration — edit this for each deployment
│   ├── data.js             ← Global state + Supabase persistence (saveConfig/loadConfig)
│   ├── players.js          ← Player rendering, add/edit, photo upload
│   ├── audio.js            ← Walk-up song playback, TTS, drag & drop, tab navigation
│   ├── social.js           ← Instagram story exports, team intro overlay, visitor lineup
│   ├── settings.js         ← Full config page (teams, colors, fonts, TTS, password)
│   └── soundboard.js       ← Soundboard, field songs, live lineup, match panel, app init
└── icons/
    └── apple-touch-icon.png
```

### File responsibilities at a glance

| File | What to edit when… |
|---|---|
| `js/config.js` | Setting up a new club |
| `js/data.js` | Changing how data is saved/loaded from Supabase |
| `js/players.js` | Modifying player cards, lineup rendering, photo crop |
| `js/audio.js` | Changing playback behavior, TTS engines, drag & drop |
| `js/social.js` | Modifying story exports (canvas layout, colors, fonts) |
| `js/settings.js` | Adding new config options, changing the config UI |
| `js/soundboard.js` | Soundboard presets, field songs, match overlay, init logic |
| `css/style.css` | Any visual/layout change |

---

## Developer Notes

### No build step

Diamond Pulse uses plain HTML, CSS, and JavaScript — no Node.js, no bundler, no compilation. Open `index.html` in a browser and it works. Deploy by uploading files to any static host.

### Adding a new feature

1. Identify which file the feature belongs to (see table above)
2. Add your functions to that file
3. If the feature needs new UI, add the HTML to `index.html`
4. If the feature needs new styles, add them to `css/style.css`
5. If the feature needs to persist data, use `saveConfig()` from `js/data.js`

### Global scope

All JavaScript files are loaded as regular `<script>` tags (not ES modules), so all functions are in the global scope and can call each other freely. This is intentional — it keeps the architecture simple and avoids import/export complexity without a build tool.

### Script load order

Scripts are loaded in this order in `index.html`:

```html
<script src="js/config.js"></script>     <!-- Must be first — defines APP_CONFIG -->
<script src="js/data.js"></script>        <!-- Must be second — defines global state -->
<script src="js/players.js"></script>
<script src="js/audio.js"></script>
<script src="js/social.js"></script>
<script src="js/settings.js"></script>
<script src="js/soundboard.js"></script>  <!-- Must be last — calls init() on DOMContentLoaded -->
```

---

*Diamond Pulse — Built for the diamond.*
