#!/usr/bin/env python3
"""Sync publications from a Google Scholar profile into assets/scholar-publications.json.

Usage:
  python scripts/sync_scholar.py
  SCHOLAR_PROFILE_URL="https://scholar.google.com/citations?user=XXXX" python scripts/sync_scholar.py

The script reads assets/site-config.json for a fallback profile URL.
"""
from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Optional
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
CONFIG_PATH = ASSETS / "site-config.json"
OUTPUT_PATH = ASSETS / "scholar-publications.json"
METRICS_PATH = ASSETS / "scholar-metrics.json"
SITE_DATA_PATH = ASSETS / "site-data.js"
MANUAL_PATH = ASSETS / "manual-publications.json"
AWARDS_PATH = ASSETS / "awards.json"
TALKS_PATH = ASSETS / "talks.json"
NEWS_PATH = ASSETS / "news.json"
BLOGS_PATH = ASSETS / "blogs.json"


@dataclass
class Publication:
    title: str
    authors: str = ""
    venue: str = ""
    year: int = 0
    status: str = "published"
    url: str = ""
    featured: bool = False
    tags: Optional[List[str]] = None

    def to_dict(self):
        data = asdict(self)
        if data["tags"] is None:
            data["tags"] = []
        return data


def read_profile_url() -> str:
    env_url = os.environ.get("SCHOLAR_PROFILE_URL", "").strip()
    if env_url:
        return env_url
    if CONFIG_PATH.exists():
        try:
            config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
            return str(config.get("scholar_profile_url", "")).strip()
        except Exception:
            return ""
    return ""


def with_query(url: str, **params: str) -> str:
    parsed = urlparse(url)
    current = dict(parse_qsl(parsed.query))
    current.update({k: v for k, v in params.items() if v is not None})
    return urlunparse(parsed._replace(query=urlencode(current)))


def normalize_text(text: str) -> str:
    return " ".join((text or "").split())


def parse_year(text: str) -> int:
    for token in (text or "").split():
        if token.isdigit() and len(token) == 4:
            return int(token)
    return 0


def parse_int(text: str) -> int:
    digits = "".join(ch for ch in str(text or "") if ch.isdigit())
    return int(digits) if digits else 0


def scholar_session() -> requests.Session:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"
        )
    }
    session = requests.Session()
    session.headers.update(headers)
    return session


def fetch_soup(session: requests.Session, url: str) -> BeautifulSoup:
    resp = session.get(url, timeout=30)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")


def parse_metrics(soup: BeautifulSoup) -> dict:
    metrics = {
        "citations": 0,
        "h_index": 0,
        "i10_index": 0,
    }
    for row in soup.select("#gsc_rsb_st tr"):
        header = normalize_text(row.select_one("td.gsc_rsb_sc1") and row.select_one("td.gsc_rsb_sc1").get_text(" ")).lower()
        values = row.select("td.gsc_rsb_std")
        if not values:
            continue
        all_value = parse_int(values[0].get_text(" "))
        if header == "citations":
            metrics["citations"] = all_value
        elif header == "h-index":
            metrics["h_index"] = all_value
        elif header == "i10-index":
            metrics["i10_index"] = all_value
    return metrics


def parse_profile(profile_url: str) -> tuple[List[Publication], dict]:
    session = scholar_session()
    pubs: List[Publication] = []
    seen = set()
    profile_soup = fetch_soup(session, with_query(profile_url, cstart="0", pagesize="100"))
    metrics = parse_metrics(profile_soup)
    first_rows = profile_soup.select("tr.gsc_a_tr")
    if not first_rows:
        raise RuntimeError("Scholar returned no publication rows; request may have been blocked.")

    # Scholar paginates by 100 items.
    for start in range(0, 2000, 100):
        url = with_query(profile_url, cstart=str(start), pagesize="100")
        soup = profile_soup if start == 0 else fetch_soup(session, url)
        rows = soup.select("tr.gsc_a_tr")
        if not rows:
            break
        for row in rows:
            title_el = row.select_one("a.gsc_a_at")
            if not title_el:
                continue
            title = normalize_text(title_el.get_text(" "))
            href = title_el.get("href", "")
            full_url = f"https://scholar.google.com{href}" if href.startswith("/") else href
            tds = row.select("td.gsc_a_t .gs_gray")
            authors = normalize_text(tds[0].get_text(" ")) if len(tds) >= 1 else ""
            venue = normalize_text(tds[1].get_text(" ")) if len(tds) >= 2 else ""
            year_el = row.select_one("span.gsc_a_h")
            year = parse_year(year_el.get_text(" ") if year_el else "")
            key = (title.lower(), year)
            if key in seen:
                continue
            seen.add(key)
            pubs.append(Publication(title=title, authors=authors, venue=venue, year=year, url=full_url).to_dict())
        if len(rows) < 100:
            break
    return pubs, metrics




def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def load_site_data(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        raw = path.read_text(encoding="utf-8").strip()
        prefix = "window.PORTFOLIO_DATA = "
        if raw.startswith(prefix):
            raw = raw[len(prefix):]
        if raw.endswith(";"):
            raw = raw[:-1]
        return json.loads(raw)
    except Exception:
        return {}


def rebuild_site_data():
    config = load_json(CONFIG_PATH, {})
    scholar_pubs = load_json(OUTPUT_PATH, [])
    scholar_metrics = load_json(METRICS_PATH, {})
    manual_pubs = load_json(MANUAL_PATH, [])
    awards = load_json(AWARDS_PATH, [])
    talks = load_json(TALKS_PATH, [])
    news = load_json(NEWS_PATH, [])
    blogs = load_json(BLOGS_PATH, [])
    existing_site_data = load_site_data(SITE_DATA_PATH)
    existing_config = existing_site_data.get('config', {})

    combined = []
    seen = set()
    for pub in scholar_pubs + manual_pubs:
        key = str(pub.get('title', '')).strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        combined.append(pub)

    featured = [p for p in combined if p.get('featured')]
    featured = sorted(featured, key=lambda p: (-int(p.get('year', 0)), str(p.get('title', ''))))[:4]
    combined = sorted(combined, key=lambda p: (not p.get('featured', False), -int(p.get('year', 0)), str(p.get('title', ''))))

    site_data = {
        'config': {
            'name': config.get('name', 'Deepa Tilwani'),
            'tagline': config.get('tagline', ''),
            'description': config.get('description', ''),
            'resume_pdf': config.get('resume_pdf', 'assets/Deepa_Tilwani_Resume.pdf'),
            'scholar_profile_url': config.get('scholar_profile_url', ''),
            'linkedin_url': config.get('linkedin_url', ''),
            'github_url': config.get('github_url', existing_config.get('github_url', '')),
            'email': config.get('email', existing_config.get('email', '')),
            'phone': config.get('phone', existing_config.get('phone', '')),
            'location': config.get('location', existing_config.get('location', '')),
            'profile_image': config.get('profile_image', existing_config.get('profile_image', 'images/profile.png')),
        },
        'education': config.get('education', existing_site_data.get('education', [])),
        'experience': config.get('experience', existing_site_data.get('experience', [])),
        'teaching': config.get('teaching', existing_site_data.get('teaching', [])),
        'service': config.get('service', existing_site_data.get('service', [])),
        'mentoring': config.get('mentoring', existing_site_data.get('mentoring', [])),
        'research_areas': config.get('research_areas', existing_site_data.get('research_areas', [])),
        'talks': talks,
        'news': news or existing_site_data.get('news', []),
        'blogs': blogs or existing_site_data.get('blogs', []),
        'awards': awards,
        'scholar_metrics': scholar_metrics,
        'publications': combined,
        'featured_publications': featured,
    }
    SITE_DATA_PATH.write_text('window.PORTFOLIO_DATA = ' + json.dumps(site_data, indent=2, ensure_ascii=False) + ';\n', encoding='utf-8')

def main() -> int:
    profile_url = read_profile_url()
    if not profile_url:
        print("No Scholar profile URL configured. Set SCHOLAR_PROFILE_URL or assets/site-config.json.")
        return 0

    try:
        publications, metrics = parse_profile(profile_url)
    except Exception as exc:
        print(f"Scholar sync skipped: {exc}", file=sys.stderr)
        print("Keeping existing Scholar data and site-data.js unchanged.")
        return 0

    OUTPUT_PATH.write_text(json.dumps(publications, indent=2, ensure_ascii=False), encoding="utf-8")
    METRICS_PATH.write_text(json.dumps(metrics, indent=2, ensure_ascii=False), encoding="utf-8")
    rebuild_site_data()
    print(
        f"Wrote {len(publications)} publications to {OUTPUT_PATH.relative_to(ROOT)}, "
        f"metrics to {METRICS_PATH.relative_to(ROOT)}, and refreshed site-data.js"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
