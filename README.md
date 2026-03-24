# 💎 Diamond Pulse

**The game-day experience manager for baseball & softball clubs.**

Diamond Pulse is a self-hosted progressive web app (PWA) that gives your announcer full control over the atmosphere at every game — walk-up songs, team introductions, soundboard, inning change music, visitor lineup, and social media exports. All from a single HTML file, deployed on your own infrastructure.

---

## Table of Contents

1. [Features](#features)
2. [Installation & Setup](#installation--setup)
3. [Advanced Configuration](#advanced-configuration)
4. [Self-Hosting & Commercialization](#self-hosting--commercialization)

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

Edit `config.js` with your Supabase credentials and club defaults:

```js
const APP_CONFIG = {
  supabaseUrl:  'https://your-project.supabase.co',
  supabaseKey:  'your-anon-public-key',
  bucket:       'songs',
  clubName:     'Your Club Name',
  // ...other defaults
};
```

> `config.js` is only used on first launch. Once saved, all settings are read from Supabase and `config.js` is ignored.

### Step 4 — Deploy

Upload these files to your hosting provider:
```
index.html
config.js
manifest.json
setup.sql        ← for reference only, not served
```

For **GitHub Pages**: push to a public repository, enable Pages under *Settings → Pages*, and set the source to the `main` branch root.

### Step 5 — First launch

Open the app in a browser (Chrome or Safari recommended). On first load it will:
1. Read `config.js` defaults
2. Create the initial config entry in Supabase
3. Redirect you to the Config panel to complete setup

From this point, all data (players, songs, settings) is stored in Supabase. The app works as a PWA and can be added to the home screen on iOS and Android.

---

## Advanced Configuration

### Audio files

All audio is stored in the `songs` Supabase bucket with the following path conventions:

| Type | Path prefix |
|------|-------------|
| Walk-up songs | `{playerid}.mp3` |
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

Enable password protection under *Config → Security*. This adds a lock screen on app load. The password is stored (hashed) in Supabase config. Useful for shared devices where you don't want unauthorized changes.

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

### Deployment package

When distributing Diamond Pulse to a new club, provide:

```
index.html       ← the entire application
config.js        ← template to fill in with their Supabase credentials
manifest.json    ← PWA manifest
setup.sql        ← one-time database setup script
README.md        ← this file
```

### Setup for a new club — checklist

- [ ] Club creates a Supabase project (free)
- [ ] Club runs `setup.sql` in the SQL Editor
- [ ] Club fills in `config.js` with their URL and anon key
- [ ] Files deployed to GitHub Pages or any static host
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

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS — single file, no build step
- **Backend**: [Supabase](https://supabase.com) (PostgreSQL + Storage)
- **Drag & drop**: [Sortable.js](https://sortablejs.github.io/Sortable/)
- **Fonts**: Oswald, Barlow Condensed (Google Fonts)
- **PWA**: Web App Manifest + installable on iOS/Android

---

*Diamond Pulse — Built for the diamond.*
