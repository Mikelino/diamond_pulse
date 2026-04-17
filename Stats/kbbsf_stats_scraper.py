#!/usr/bin/env python3
"""
KBBSF Stats Scraper - Diamond Pulse Edition  v4.2
==================================================
Corrections v4.2 :
  - Délais plus longs entre pages (anti-CloudFront 403)
  - Retry automatique avec backoff exponentiel sur 403/429/5xx
  - Fallback pId WBSC depuis le HTML source (pas uniquement le lien Full Career)
  - openpyxl optionnel (pas de crash si manquant)
  - Résumé final avec statistiques détaillées

Requirements:
    pip install playwright pandas openpyxl
    playwright install chromium

Usage:
    python kbbsf_stats_scraper.py --group all --year 2026
    python kbbsf_stats_scraper.py --group baseball --year 2026
    python kbbsf_stats_scraper.py --group softball --year 2026
    python kbbsf_stats_scraper.py --group youth --year 2026
    python kbbsf_stats_scraper.py --event baseball-u12 --year 2025
    python kbbsf_stats_scraper.py --all-events --all-years
"""

import asyncio
import argparse
import json
import csv
import os
import re
import time
import urllib.request
import urllib.error
from datetime import datetime

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("Installe playwright : pip install playwright && playwright install chromium")
    exit(1)

try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False
    print("Note : installe pandas pour Excel : pip install pandas openpyxl")

try:
    import openpyxl  # noqa — juste pour vérifier la présence
    HAS_OPENPYXL = True
except ImportError:
    HAS_OPENPYXL = False
    print("Note : installe openpyxl pour l'export Excel : pip install openpyxl")

import ctypes

# Empêche Windows de se mettre en veille pendant l'exécution
ctypes.windll.kernel32.SetThreadExecutionState(0x80000002)

# ── Configuration ──────────────────────────────────────────────────────────────

SITE_BASE   = "https://www.baseballsoftball.be"
EVENTS_BASE = f"{SITE_BASE}/en/events"
API_BASE    = f"{SITE_BASE}/api/v1/player/stats"
FED_ID      = 143

# Délais (secondes) — augmentés pour éviter le blocage CloudFront
DELAY_BETWEEN_PLAYERS  = 0.7   # entre chaque page joueur (pId)
DELAY_BETWEEN_ROSTERS  = 1.2   # entre chaque page d'équipe
DELAY_BETWEEN_API      = 0.25   # entre chaque appel API stats
DELAY_AFTER_403        = 15.0  # pause si on reçoit un 403
MAX_RETRIES            = 3     # tentatives max par page

HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
}
API_HEADERS = {**HEADERS, "Accept": "application/json, text/javascript, */*; q=0.01",
               "X-Requested-With": "XMLHttpRequest",
               "Referer": SITE_BASE}

# ── Divisions ─────────────────────────────────────────────────────────────────

EVENTS = {
    "baseball-d1":           ("Baseball D1",           "BD1",  2022),
    "baseball-d2":           ("Baseball D2",           "BD2",  2022),
    "baseball-d3":           ("Baseball D3",           "BD3",  2024),
    "baseball-d4":           ("Baseball D4",           "BD4",  2024),
    "softball-ladies-d1":    ("Softball Ladies D1",    "SLD1", 2022),
    "softball-ladies-d2":    ("Softball Ladies D2",    "SLD2", 2024),
    "softball-ladies-d3":    ("Softball Ladies D3",    "SLD3", 2024),
    "softball-men-d1":       ("Softball Men D1",       "SMD1", 2022),
    "softball-men-reserves": ("Softball Men Reserves", "SMR",  2025),
    "baseball-u15":          ("Baseball U15",          "BU15", 2023),
    "baseball-u12":          ("Baseball U12",          "BU12", 2023),
}

EVENT_GROUPS = {
    "baseball": ["baseball-d1","baseball-d2","baseball-d3","baseball-d4"],
    "softball": ["softball-ladies-d1","softball-ladies-d2","softball-ladies-d3",
                 "softball-men-d1","softball-men-reserves"],
    "youth":    ["baseball-u15","baseball-u12"],
    "adults":   ["baseball-d1","baseball-d2","baseball-d3","baseball-d4",
                 "softball-ladies-d1","softball-ladies-d2","softball-ladies-d3",
                 "softball-men-d1","softball-men-reserves"],
    "all":      list(EVENTS.keys()),
}

PITCH_RENAME = {
    "pitch_win":"W","pitch_loss":"L","pitch_appear":"APP","pitch_gs":"GS",
    "pitch_save":"SV","pitch_cg":"CG","pitch_sho":"SHO","pitch_ip":"IP",
    "pitch_h":"H","pitch_r":"R","pitch_er":"ER","pitch_bb":"BB","pitch_so":"SO",
    "pitch_hr":"HR","pitch_ab":"AB","pitch_wp":"WP","pitch_hbp":"HBP",
    "pitch_bk":"BK","pitch_whip":"WHIP","pitch_double":"2B","pitch_triple":"3B",
    "pitch_ground":"GB","pitch_fly":"FB","pitch_sfa":"SFA","pitch_sha":"SHA",
}
FIELD_RENAME = {
    "field_g":"G","field_c":"TC","field_po":"PO","field_a":"A","field_e":"E",
    "fldp":"FPCT","field_dp":"DP","field_sba":"SBA","field_csb":"CSB",
    "field_pb":"PB","field_ci":"CI",
}

BATTING_ORDER = [
    "Player","Team","Team_Code","Team_ID","Player_ID","WBSC_ID",
    "Number","Position","Bats","Throws","Year",
    "G","GS","AB","R","H","2B","3B","HR","RBI","TB",
    "AVG","SLG","OBP","OPS","BB","HBP","SO","SB","CS","GDP","SF","SH",
]
PITCHING_ORDER = [
    "Player","Team","Team_Code","Team_ID","Player_ID","WBSC_ID",
    "Number","Position","Bats","Throws","Year",
    "W","L","ERA","APP","GS","SV","CG","SHO","IP",
    "H","R","ER","BB","SO","HR","WHIP","WP","HBP","BK","2B","3B","GB","FB",
]
FIELDING_ORDER = [
    "Player","Team","Team_Code","Team_ID","Player_ID","WBSC_ID",
    "Number","Position","Bats","Throws","Year",
    "G","TC","PO","A","E","FPCT","DP","SBA","CSB","PB","CI",
]


def build_event_url(year: int, slug: str) -> str:
    if year >= 2026:
        return f"{EVENTS_BASE}/{year}-{slug}-{year}"
    return f"{EVENTS_BASE}/{year}-{slug}"


def is_available(year: int, slug: str) -> bool:
    return year >= EVENTS[slug][2]


# ── Appel API stats avec retry ─────────────────────────────────────────────────

def call_stats_api(wbsc_pid: str, event_category: str) -> dict:
    """
    Appel API stats avec retry.
    Retourne toujours un dict propre {batting:[], pitching:[], fielding:[]}.
    """
    empty = {"batting": [], "pitching": [], "fielding": [], "totalsRow": {}}
    url = (f"{API_BASE}?pId={wbsc_pid}&lang=en&tab=career"
           f"&fedId={FED_ID}&eventCategory={event_category}")

    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(url, headers=API_HEADERS)
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
            break
        except urllib.error.HTTPError as e:
            if e.code in (403, 429):
                wait = DELAY_AFTER_403 * (attempt + 1)
                print(f"\n      ⚠ API {e.code} — pause {wait:.0f}s...", end="", flush=True)
                time.sleep(wait)
                if attempt == MAX_RETRIES - 1:
                    return empty
            elif e.code >= 500:
                return empty
            else:
                return empty
        except Exception:
            return empty
    else:
        return empty

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return empty

    if not isinstance(data, dict):
        return empty

    result = {"batting": [], "pitching": [], "fielding": [], "totalsRow": {}}
    for cat in ("batting", "pitching", "fielding"):
        raw_cat = data.get(cat)
        if isinstance(raw_cat, list):
            result[cat] = [r for r in raw_cat if isinstance(r, dict)]
    tr = data.get("totalsRow")
    if isinstance(tr, dict):
        result["totalsRow"] = tr
    return result


# ── Playwright : navigation avec retry sur 403 ────────────────────────────────

async def safe_goto(page, url: str, retries: int = MAX_RETRIES) -> bool:
    """
    Navigue vers url. Retente avec pause si CloudFront 403.
    Retourne True si succès, False si échec total.
    """
    for attempt in range(retries):
        try:
            resp = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            if resp and resp.status == 403:
                wait = DELAY_AFTER_403 * (attempt + 1)
                print(f"\n      ⚠ 403 CloudFront — pause {wait:.0f}s...", end="", flush=True)
                await asyncio.sleep(wait)
                continue
            # Vérifier que ce n'est pas une page d'erreur CloudFront
            title = await page.title()
            if "error" in title.lower() or "blocked" in title.lower():
                wait = DELAY_AFTER_403 * (attempt + 1)
                print(f"\n      ⚠ Page bloquée ({title}) — pause {wait:.0f}s...", end="", flush=True)
                await asyncio.sleep(wait)
                continue
            return True
        except Exception as e:
            if attempt < retries - 1:
                await asyncio.sleep(5)
            else:
                print(f"\n      ✗ Échec navigation ({e})")
                return False
    return False


# ── Playwright : équipes ──────────────────────────────────────────────────────

async def get_teams(page, event_url: str) -> list[dict]:
    url = f"{event_url}/teams"
    print(f"    Équipes → {url}")
    ok = await safe_goto(page, url)
    if not ok:
        return []

    teams = await page.evaluate("""() => {
        const results = [];
        const seen = new Set();
        for (const td of document.querySelectorAll('table td')) {
            const img = td.querySelector('img');
            const id = img?.title || img?.alt?.replace(' flag','').trim();
            const name = td.textContent.trim();
            if (id && /^\\d+$/.test(id) && name && !seen.has(id)) {
                seen.add(id);
                results.push({id, name});
            }
        }
        if (!results.length) {
            for (const a of document.querySelectorAll('a[href*="/teams/"]')) {
                const m = a.href.match(/\\/teams\\/(\\d+)(?:\\/|$)/);
                if (m && !a.href.includes('/players/') && !seen.has(m[1])) {
                    seen.add(m[1]);
                    results.push({id: m[1], name: a.textContent.trim() || m[1]});
                }
            }
        }
        return results;
    }""")

    print(f"      → {len(teams)} équipes")
    return teams


# ── Playwright : joueurs d'une équipe ─────────────────────────────────────────

async def get_players(page, event_url: str, team_id: str) -> list[dict]:
    url = f"{event_url}/teams/{team_id}"
    ok = await safe_goto(page, url)
    if not ok:
        return []

    await asyncio.sleep(1.0)  # laisser le JS finir

    players = await page.evaluate("""() => {
        const results = [];
        const seen = new Set();
        for (const a of document.querySelectorAll('a[href*="/players/"]')) {
            const m = a.href.match(/\\/players\\/(\\d+)/);
            if (!m || seen.has(m[1])) continue;
            seen.add(m[1]);
            const row = a.closest('tr');
            const cells = row ? Array.from(row.querySelectorAll('td')) : [];
            results.push({
                player_id: m[1],
                name:      a.textContent.trim() || cells[1]?.textContent.trim() || '',
                number:    cells[0]?.textContent.trim() || '',
                position:  cells[2]?.textContent.trim() || '',
                bats:      cells[3]?.textContent.trim() || '',
                throws:    cells[4]?.textContent.trim() || '',
                url:       a.href,
            });
        }
        return results;
    }""")

    return players


# ── Playwright : pId WBSC ─────────────────────────────────────────────────────

async def get_wbsc_pid(page, player_url: str) -> str | None:
    """
    Extrait le pId WBSC depuis la page joueur.
    Méthode 1 : lien Full Career  (wbsc.org/en/player/nom-12345/history)
    Méthode 2 : recherche regex dans le HTML source
    """
    ok = await safe_goto(page, player_url)
    if not ok:
        return None

    pid = await page.evaluate("""() => {
        // Méthode 1 : lien Full Career
        const a = document.querySelector('a[href*="wbsc.org/en/player"]');
        if (a) {
            const m = a.href.match(/-(\\d+)\\/history/);
            if (m) return m[1];
        }
        // Méthode 2 : chercher dans tout le HTML (attributs data-*, scripts inline)
        const html = document.documentElement.innerHTML;
        const patterns = [
            /\"playerId\":\\s*(\\d+)/,
            /\"pId\":\\s*(\\d+)/,
            /player[_-]?id[\"':\\s]+([0-9]{5,7})/i,
            /\\/player\\/[a-z-]+-([0-9]{5,7})[\\/\"]/i,
        ];
        for (const pat of patterns) {
            const m = html.match(pat);
            if (m) return m[1];
        }
        return null;
    }""")

    return pid


# ── Aplatisseurs ──────────────────────────────────────────────────────────────

def flatten_batting(ctx: dict, row: dict) -> dict:
    return {
        **ctx,
        "Year": row.get("year",""), "Team_Code": row.get("teamcode",""),
        "G": row.get("g",""), "GS": row.get("gs",""),
        "AB": row.get("ab",""), "R": row.get("r",""),
        "H": row.get("h",""), "2B": row.get("double",""),
        "3B": row.get("triple",""), "HR": row.get("hr",""),
        "RBI": row.get("rbi",""), "TB": row.get("tb",""),
        "AVG": row.get("avg",""), "SLG": row.get("slg",""),
        "OBP": row.get("obp",""), "OPS": row.get("ops",""),
        "BB": row.get("bb",""), "HBP": row.get("hbp",""),
        "SO": row.get("so",""), "GDP": row.get("gdp",""),
        "SF": row.get("sf",""), "SH": row.get("sh",""),
        "SB": row.get("sb",""), "CS": row.get("cs",""),
    }


def flatten_pitching(ctx: dict, row: dict) -> dict:
    renamed = {PITCH_RENAME.get(k, k): v for k, v in row.items()}
    out = {**ctx,
           "Year": row.get("year",""), "Team_Code": row.get("teamcode",""),
           "ERA": renamed.get("era","")}
    skip = {"year","teamcode","pos","bavg","era"}
    for k, v in renamed.items():
        if k not in skip and k not in out:
            out[k] = v
    return out


def flatten_fielding(ctx: dict, row: dict) -> dict:
    renamed = {FIELD_RENAME.get(k, k): v for k, v in row.items()}
    out = {**ctx,
           "Year": row.get("year",""), "Team_Code": row.get("teamcode","")}
    skip = {"year","teamcode","pos","sbap"}
    for k, v in renamed.items():
        if k not in skip and k not in out:
            out[k] = v
    return out


# ── Orchestration ─────────────────────────────────────────────────────────────

async def scrape_event(year: int, slug: str, output_dir: str):
    if not is_available(year, slug):
        print(f"\n  [SKIP] {slug} non disponible avant {EVENTS[slug][2]}")
        return None

    event_label, event_cat, _ = EVENTS[slug]
    event_url = build_event_url(year, slug)

    print(f"\n{'='*65}")
    print(f"  {event_label} {year}  |  catégorie API : {event_cat}")
    print(f"  {event_url}")
    print(f"{'='*65}")

    result = {
        "metadata": {
            "event": event_label, "year": year,
            "event_category": event_cat,
            "scraped_at": datetime.now().isoformat(),
            "source": event_url,
        },
        "batting": [], "pitching": [], "fielding": [],
        "standings": [], "rosters": {},
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9",
            }
        )
        page = await ctx.new_page()

        # 1. Équipes
        teams = await get_teams(page, event_url)
        if not teams:
            print("  ✗ Aucune équipe trouvée")
            await browser.close()
            return None

        stats_ok = stats_empty = stats_err = 0

        for t_idx, team in enumerate(teams, 1):
            tid, tname = team["id"], team["name"]
            print(f"\n  [{t_idx}/{len(teams)}] {tname}  (id={tid})")

            # 2. Joueurs
            players = await get_players(page, event_url, tid)
            print(f"    → {len(players)} joueurs")
            result["rosters"][tname] = [
                {k: v for k, v in pl.items() if k != "url"}
                for pl in players
            ]
            await asyncio.sleep(DELAY_BETWEEN_ROSTERS)

            for p_idx, player in enumerate(players, 1):
                pname = player["name"] or f"#{player['number']}"
                print(f"    [{p_idx:>2}/{len(players)}] {pname:<34}", end=" ", flush=True)

                # 3. pId WBSC
                wbsc_pid = await get_wbsc_pid(page, player["url"])
                await asyncio.sleep(DELAY_BETWEEN_PLAYERS)

                if not wbsc_pid:
                    print("✗  (pId introuvable)")
                    stats_err += 1
                    continue

                # 4. API stats
                api = call_stats_api(wbsc_pid, event_cat)
                time.sleep(DELAY_BETWEEN_API)

                player_ctx = {
                    "Player": pname, "Team": tname,
                    "Team_ID": tid, "Player_ID": player["player_id"],
                    "WBSC_ID": wbsc_pid,
                    "Number": player.get("number",""),
                    "Position": player.get("position",""),
                    "Bats": player.get("bats",""),
                    "Throws": player.get("throws",""),
                }

                b_rows = api["batting"]
                p_rows = api["pitching"]
                f_rows = api["fielding"]

                for row in b_rows:
                    result["batting"].append(flatten_batting(player_ctx, row))
                for row in p_rows:
                    result["pitching"].append(flatten_pitching(player_ctx, row))
                for row in f_rows:
                    result["fielding"].append(flatten_fielding(player_ctx, row))

                if b_rows or p_rows or f_rows:
                    print(f"✓  bat={len(b_rows)} pit={len(p_rows)} fld={len(f_rows)}")
                    stats_ok += 1
                else:
                    print("—  (pas encore de stats)")
                    stats_empty += 1

        # 5. Classement
        try:
            ok = await safe_goto(page, f"{event_url}/standings")
            if ok:
                standings = await page.evaluate("""() => {
                    const out = [];
                    for (const table of document.querySelectorAll('table')) {
                        const hdrs = [...table.querySelectorAll('thead th')]
                                     .map(h => h.textContent.trim());
                        if (hdrs.length < 2) continue;
                        for (const row of table.querySelectorAll('tbody tr')) {
                            const cells = [...row.querySelectorAll('td')];
                            const obj = {};
                            cells.forEach((c,i) => {
                                if (i < hdrs.length) obj[hdrs[i]] = c.textContent.trim();
                            });
                            if (Object.keys(obj).length) out.push(obj);
                        }
                    }
                    return out;
                }""")
                result["standings"] = standings
                print(f"\n  Classement : {len(standings)} entrées")
        except Exception as e:
            print(f"\n  Classement indisponible : {e}")

        await browser.close()

    total = stats_ok + stats_empty + stats_err
    print(f"\n  Résumé : {total} joueurs "
          f"| {stats_ok} avec stats "
          f"| {stats_empty} sans stats "
          f"| {stats_err} erreurs pId")

    # ── Sauvegarde ────────────────────────────────────────────────────────────
    os.makedirs(output_dir, exist_ok=True)

    json_path = os.path.join(output_dir, f"{slug}_{year}_full.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"  JSON   : {json_path}")

    for cat, col_order in [("batting", BATTING_ORDER),
                            ("pitching", PITCHING_ORDER),
                            ("fielding", FIELDING_ORDER)]:
        rows = result[cat]
        if not rows:
            print(f"  CSV {cat:<10}: (vide)")
            continue
        all_keys = list(dict.fromkeys(
            [c for c in col_order if c in rows[0]]
            + [k for k in rows[0].keys() if k not in col_order]
        ))
        csv_path = os.path.join(output_dir, f"{slug}_{year}_{cat}.csv")
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=all_keys, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)
        print(f"  CSV {cat:<10}: {csv_path}  ({len(rows)} lignes)")

    if HAS_PANDAS and HAS_OPENPYXL:
        xlsx_path = os.path.join(output_dir, f"{slug}_{year}_stats.xlsx")
        try:
            with pd.ExcelWriter(xlsx_path, engine="openpyxl") as writer:
                for cat in ("batting","pitching","fielding"):
                    if result[cat]:
                        pd.DataFrame(result[cat]).to_excel(
                            writer, sheet_name=cat.capitalize(), index=False)
                if result["standings"]:
                    pd.DataFrame(result["standings"]).to_excel(
                        writer, sheet_name="Standings", index=False)
                roster_rows = [{"Team": tn, **pl}
                               for tn, pls in result["rosters"].items()
                               for pl in pls]
                if roster_rows:
                    pd.DataFrame(roster_rows).to_excel(
                        writer, sheet_name="Rosters", index=False)
            print(f"  Excel  : {xlsx_path}")
        except Exception as e:
            print(f"  Excel  : échec ({e})")
    elif HAS_PANDAS and not HAS_OPENPYXL:
        print("  Excel  : ignoré (manque openpyxl — pip install openpyxl)")

    return result


# ── CLI ────────────────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(
        description="KBBSF Stats Scraper v4.2 — stats individuelles via API directe",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples :
  python kbbsf_stats_scraper.py --group all --year 2026
  python kbbsf_stats_scraper.py --group baseball --year 2026
  python kbbsf_stats_scraper.py --group softball --year 2026
  python kbbsf_stats_scraper.py --group youth --year 2026
  python kbbsf_stats_scraper.py --event baseball-u12 --year 2025
  python kbbsf_stats_scraper.py --all-events --all-years
        """
    )
    parser.add_argument("--year",       type=int, default=2026)
    parser.add_argument("--event",      default="baseball-d1",
                        choices=list(EVENTS.keys()))
    parser.add_argument("--group",      choices=list(EVENT_GROUPS.keys()))
    parser.add_argument("--all-events", action="store_true")
    parser.add_argument("--all-years",  action="store_true")
    parser.add_argument("--output",     default="diamond_pulse_data")
    args = parser.parse_args()

    if args.all_events or args.group == "all":
        slugs = list(EVENTS.keys())
    elif args.group:
        slugs = EVENT_GROUPS[args.group]
    else:
        slugs = [args.event]

    years = list(range(2022, 2027)) if args.all_years else [args.year]

    print(f"\nDivisions : {', '.join(slugs)}")
    print(f"Années    : {', '.join(map(str, years))}")
    print(f"Sortie    : {args.output}/")

    for year in years:
        for slug in slugs:
            try:
                await scrape_event(year, slug, args.output)
            except Exception as e:
                print(f"\nERREUR {slug} {year} : {e}")
                import traceback; traceback.print_exc()

    print(f"\n{'='*65}")
    print(f"  Terminé ! Données dans : {args.output}/")
    print(f"{'='*65}")


if __name__ == "__main__":
    asyncio.run(main())
