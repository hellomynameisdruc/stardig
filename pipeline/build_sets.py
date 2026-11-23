"""DJ sets for the star systems: long videos from YouTube channels that publish sets (Boiler Room, HÖR,
Cercle…, listed in set_channels.json), each placed in the styles it plays, with its tracklist read
from the description and matched to tracks on the map.

    YT_API_KEY=… python pipeline/build_sets.py <map data dir> <out dir>

Reads the published map (map.json, tracks/, titles/) and writes into <out dir>:
  index.json         {"built": date, "n": {star name: sets}, "channels": {name: channel id} (those that stream),
                     "all": {name: channel id}, "style": {name: star}}
  djs.json           for placing live streams (supabase/functions/live-sets): {"stars": [names],
                     "a": {artist: [[star, weight], …]}} for artists with 3+ tracks on the map
  s/<slug>.json      a star's sets, most watched first:
                     [{"v": video id, "t": title, "c": channel, "d": seconds, "y": year, "w": views,
                       "tl": [[seconds or -1, "Artist — Title", yt or "", star name or ""], …]}, …]
Only the YouTube Data API (an API key, read-only): lists of uploads and videos' details. Nothing is
downloaded but that text; it's rebuilt from scratch every day, so nothing kept is older than a day.
"""
import json
import os
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

API = "https://www.googleapis.com/youtube/v3/"
MIN_SECONDS = 30 * 60          # a set, not a track or a clip
PER_STAR = 500                 # sets kept per star (most watched first)
MAX_STARS = 2                  # a set goes into its strongest style or two

WORD = re.compile(r"[^0-9a-z]+")


def norm(s: str) -> str:
    """lowercase, accents dropped, anything but a-z and 0-9 removed (as build_titles)"""
    s = unicodedata.normalize("NFKD", s.lower())
    return WORD.sub("", "".join(c for c in s if not unicodedata.combining(c)))


def spaced(s: str) -> str:
    """as norm, but words kept apart by single spaces (so "house" isn't found in "warehouse")"""
    s = unicodedata.normalize("NFKD", s.lower().replace("&", " and "))
    return " ".join(WORD.sub(" ", "".join(c for c in s if not unicodedata.combining(c))).split())


def slug(name: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", name.lower()).encode("ascii", "ignore").decode())).strip("-") or "x"


# —— the tracklist in a description
TS = re.compile(r"^\s*[\[(]?((?:\d{1,2}:)?\d{1,2}:\d{2})[\])]?\s*(?:[-–—.:|)]\s*)?(.+?)\s*$")
NUM = re.compile(r"^\s*(?:\d{1,3}[.)]|[-•*])\s+(.+?)\s*$")
DASH = re.compile(r"\s+[-–—]\s+")
PARENS = re.compile(r"\s*[\[(][^\])]*[\])]")


def seconds(ts: str) -> int:
    p = [int(x) for x in ts.split(":")]
    return p[0] * 3600 + p[1] * 60 + p[2] if len(p) == 3 else p[0] * 60 + p[1]


def tracklist(desc: str) -> list:
    """[(seconds or -1, artist, title)]: lines with a time stamp, or a numbered list, that read Artist - Title"""
    stamped, numbered = [], []
    for line in desc.splitlines():
        m = TS.match(line)
        if m:
            stamped.append((seconds(m.group(1)), m.group(2)))
            continue
        m = NUM.match(line)
        if m:
            numbered.append((-1, m.group(1)))
    rows = stamped if len(stamped) >= 3 else numbered if len(numbered) >= 3 else []
    out = []
    for sec, text in rows:
        text = text.strip(" \t-–—|")
        parts = DASH.split(text, maxsplit=1)
        if len(parts) == 2 and parts[0] and parts[1]:
            out.append((sec, parts[0].strip(), parts[1].strip()))
        elif text and sec >= 0:
            out.append((sec, "", text))
    return out if sum(1 for _, a, _ in out if a) >= 3 else []


# —— the map: what's on it, by artist and title
class MapIndex:
    def __init__(self, data: Path):
        meta = json.loads((data / "map.json").read_text())
        self.stars = [s["name"] for s in meta["stars"]]
        self.track = {}                       # "artist|title" → (yt, star)
        self.artist = defaultdict(Counter)    # artist → tracks per star
        self.style = {norm(n): k for k, n in enumerate(self.stars) if len(norm(n)) >= 4}
        self.words = {spaced(n): k for k, n in enumerate(self.stars) if len(norm(n)) >= 4}
        for si in range(len(self.stars)):
            base = json.loads((data / "tracks" / f"{si}.json").read_text())
            words = json.loads((data / "titles" / f"{si}.json").read_text())
            yt = base["yt"]
            ids = [yt[k:k + 11] for k in range(0, len(yt), 11)] if isinstance(yt, str) else yt
            titles, names = words["t"].split("\n"), words["an"].split("\n")
            for i, (t, a) in enumerate(zip(titles, words["a"], strict=False)):
                an = norm(names[a])
                if not an:
                    continue
                self.artist[an][si] += 1
                for tt in {norm(t), norm(PARENS.sub("", t))}:
                    if tt:
                        self.track.setdefault(f"{an}|{tt}", (ids[i], si))

    def find(self, artist: str, title: str):
        an = norm(artist)
        for a in {an, norm(re.split(r"\s+(?:feat\.?|ft\.?|featuring)\s+", artist, flags=re.I)[0]), norm(re.split(r"\s*(?:&|,| x | and | vs\.? )\s*", artist, flags=re.I)[0])}:
            for t in {norm(title), norm(PARENS.sub("", title))}:
                hit = self.track.get(f"{a}|{t}")
                if hit:
                    return hit
        return None


# who plays: the head of the title, before the venue ("DJ | Boiler Room: City", "DJ @ venue for Cercle",
# "DJ in The Lab", "A - B | HÖR - date"), split into names (b2b, x, &, " - ")
HEAD = re.compile(r"\s*(?:\||@|/|:|\(|\[|\s(?:at|for|live|in the lab|returns to|takeover)\b)\s*", re.I)
NAMES = re.compile(r"\s*(?:\bb2b\b|\bx\b|&|,|\s[-–—]\s|\bw/|\bwith\b|\band\b)\s*", re.I)
NOT_DJ = {"boilerroom", "djset", "liveset", "fullset", "set", "mix", "live", "dj", "hr", "hor", "hoer", "cercle", "mixmag", "intro", "outro"}


def djs(title: str) -> list:
    head = HEAD.split(title, maxsplit=1)[0]
    head = re.sub(r"\b(?:dj set|live set|full set|techno set|house set|set)\b.*$", "", head, flags=re.I)
    return [n for n in (norm(x) for x in NAMES.split(head)) if len(n) >= 3 and n not in NOT_DJ]


def place(v: dict, tl: list, idx: MapIndex, channel: str) -> dict:
    """votes per star from what the set plays (its tracklist), who plays it (the DJs' own tracks) and what it's called"""
    score = Counter()
    hits = [h for h in (idx.find(a, t) for _, a, t in tl if a) if h]
    for _, si in hits:
        score[si] += 3.0 / max(1, len(hits)) * 3          # the tracklist, worth 9 in all
    title = v["snippet"]["title"]
    for n in djs(title):
        if n == norm(channel) or n in idx.style:
            continue
        own = idx.artist.get(n)
        if own:
            tot = sum(own.values())
            for si, c in own.items():
                score[si] += 4.0 * c / tot * min(1.0, tot / 5)   # a DJ's own records, worth 4 (less for a name with few)
    named = f" {spaced(title)} "
    rest = f' {spaced(v["snippet"].get("description", "")[:600] + " " + " ".join(v["snippet"].get("tags", [])))} '
    for n, si in idx.words.items():
        if f" {n} " in named:
            score[si] += 3.0 + len(n) / 10                # a style in the title
        elif f" {n} " in rest:
            score[si] += 1.0                               # …or in the description and tags
    if not score:
        return {}
    top = score.most_common()
    best = top[0][1]
    if best < 2.0:
        return {}
    keep = [si for si, s in top[:MAX_STARS] if s >= best * 0.5]
    return {"stars": keep, "hits": hits}


# —— YouTube
def get(path: str, **q):
    q["key"] = os.environ["YT_API_KEY"]
    with urllib.request.urlopen(API + path + "?" + urllib.parse.urlencode(q), timeout=30) as r:
        return json.load(r)


def channel_id(name: str, handle: str):
    if handle:
        try:
            items = get("channels", part="id", forHandle=handle).get("items") or []
            if items:
                return items[0]["id"]
        except Exception as e:  # noqa: BLE001
            print(f"  {handle}: {e}")
    items = get("search", part="snippet", q=name, type="channel", maxResults=1).get("items") or []
    if items:
        print(f"  {name}: found by search as {items[0]['snippet']['title']!r}")
        return items[0]["snippet"]["channelId"]
    return None


def uploads(cid: str, limit: int):
    ids, token = [], None
    while len(ids) < limit:
        q = {"part": "contentDetails", "playlistId": "UU" + cid[2:], "maxResults": 50}
        if token:
            q["pageToken"] = token
        r = get("playlistItems", **q)
        ids += [it["contentDetails"]["videoId"] for it in r.get("items", [])]
        token = r.get("nextPageToken")
        if not token:
            break
    return ids


DUR = re.compile(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?")


def duration(iso: str) -> int:
    d, h, m, s = (int(x or 0) for x in DUR.match(iso).groups())
    return d * 86400 + h * 3600 + m * 60 + s


def videos(ids: list):
    for k in range(0, len(ids), 50):
        yield from get("videos", part="snippet,contentDetails,status,statistics", id=",".join(ids[k:k + 50]), maxResults=50).get("items", [])


def build(data: Path, out: Path):
    cfg = json.loads((Path(__file__).parent / "set_channels.json").read_text())
    idx = MapIndex(data)
    print(f"map: {len(idx.stars)} stars, {len(idx.track):,} title keys, {len(idx.artist):,} artists")
    per = defaultdict(list)
    seen, found = set(), {}
    for ch in cfg["channels"]:
        try:
            cid = channel_id(ch["name"], ch.get("handle", ""))
            if not cid:
                print(f"{ch['name']}: channel not found")
                continue
            ids = uploads(cid, ch.get("limit", 6000))
            vs = list(videos(ids))
        except Exception as e:  # noqa: BLE001 — one channel's trouble doesn't stop the others…
            if getattr(e, "code", 0) == 403:  # …but the day's quota running out (or a bad key) does: keep yesterday's sets
                sys.exit(f"YouTube refused ({e}): the daily quota may be spent. Nothing published.")
            print(f"{ch['name']}: skipped ({e})")
            continue
        found[ch["name"]] = cid
        n = placed = 0
        for v in vs:
            if v["id"] in seen or v["snippet"].get("liveBroadcastContent", "none") != "none":
                continue
            if not v["status"].get("embeddable") or v["status"].get("privacyStatus") != "public":
                continue
            d = duration(v["contentDetails"].get("duration", "PT0S"))
            if d < MIN_SECONDS:
                continue
            seen.add(v["id"])
            n += 1
            tl = tracklist(v["snippet"].get("description", ""))
            p = place(v, tl, idx, ch["name"])
            if not p:
                continue
            placed += 1
            rows = []
            for sec, a, t in tl:
                hit = idx.find(a, t) if a else None
                rows.append([sec, f"{a} — {t}" if a else t, hit[0] if hit else "", idx.stars[hit[1]] if hit else ""])
            rec = {"v": v["id"], "t": v["snippet"]["title"], "c": v["snippet"].get("channelTitle", ch["name"]), "d": d,
                   "y": int(v["snippet"]["publishedAt"][:4]), "w": int(v.get("statistics", {}).get("viewCount", 0)), "tl": rows}
            for si in p["stars"]:
                per[si].append(rec)
        print(f"{ch['name']}: {len(ids)} uploads, {n} sets, {placed} placed")
    (out / "s").mkdir(parents=True, exist_ok=True)
    counts = {}
    for si, recs in per.items():
        recs.sort(key=lambda r: -r["w"])
        recs = recs[:PER_STAR]
        counts[idx.stars[si]] = len(recs)
        json.dump(recs, open(out / "s" / f"{slug(idx.stars[si])}.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    style = {ch["name"]: ch["style"] for ch in cfg["channels"] if ch.get("style") and ch["name"] in found}
    # "channels": the ones that stream, for the live check (which reads this file); "all": every channel read
    streams = {n: c for n, c in found.items() if any(ch["name"] == n and ch.get("live") for ch in cfg["channels"])}
    json.dump({"built": date.today().isoformat(), "n": counts, "channels": streams, "all": found, "style": style}, open(out / "index.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    djs = {}
    for a, c in idx.artist.items():
        tot = sum(c.values())
        if tot >= 3:
            djs[a] = [[si, round(4.0 * n / tot * min(1.0, tot / 5), 2)] for si, n in c.most_common(2) if n / tot >= 0.25]
    json.dump({"stars": idx.stars, "a": djs}, open(out / "djs.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"{sum(counts.values())} sets in {len(counts)} stars")


if __name__ == "__main__":
    build(Path(sys.argv[1]), Path(sys.argv[2]))
