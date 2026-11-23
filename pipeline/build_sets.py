"""DJ sets for the star systems: long videos from YouTube channels that publish sets (Boiler Room, HÖR,
Cercle…, listed in set_channels.json), each placed in the styles it plays, with its tracklist read
from the description and matched to tracks on the map.

    YT_API_KEY=… python pipeline/build_sets.py <map data dir> <out dir> [<yesterday's sets dir>]

Reads the published map (map.json, tracks/, titles/) and writes into <out dir>:
  index.json         {"built": date, "n": {star name: sets}, "channels": {name: channel id} (those that stream),
                     "all": {name: channel id}, "style": {name: star}}
  djs.json           for placing live streams (supabase/functions/live-sets): {"stars": [names],
                     "a": {artist: [[star, weight], …]}} for artists with 3+ tracks on the map
  s/<slug>.json      a star's sets, most watched first:
                     [{"v": video id, "t": title, "c": channel, "d": seconds, "y": year, "w": views,
                       "tl": [[seconds or -1, "Artist — Title", yt or "", star name or ""], …]}, …]
  cache.json.gz      what was read (so a day reads only what's new): channel ids, the videos seen per
                     channel, the sets' details; each set's details are read again within 25 days
Only the YouTube Data API (an API key, read-only): lists of uploads and videos' details, nothing but text.
"""
import gzip
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import date, timedelta
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


def place(title: str, text: str, tl: list, idx: MapIndex, channel: str) -> dict:
    """votes per star from what the set plays (its tracklist), who plays it (the DJs' own tracks) and what it's called"""
    score = Counter()
    hits = [h for h in (idx.find(a, t) for _, a, t in tl if a) if h]
    for _, si in hits:
        score[si] += 3.0 / max(1, len(hits)) * 3          # the tracklist, worth 9 in all
    for n in djs(title):
        if n == norm(channel) or n in idx.style:
            continue
        own = idx.artist.get(n)
        if own:
            tot = sum(own.values())
            for si, c in own.items():
                score[si] += 4.0 * c / tot * min(1.0, tot / 5)   # a DJ's own records, worth 4 (less for a name with few)
    named = f" {spaced(title)} "
    rest = f" {spaced(text)} "
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


# —— YouTube: every call counted against the day's budget (the API's quota is 10,000 units a day; the
# live check on Supabase takes its share too)
BUDGET = int(os.environ.get("SETS_BUDGET", "6000"))
units = 0


class OutOfBudget(Exception):
    pass


def get(path: str, cost: int = 1, **q):
    global units
    if units + cost > BUDGET:
        raise OutOfBudget
    units += cost
    q["key"] = os.environ["YT_API_KEY"]
    try:
        with urllib.request.urlopen(API + path + "?" + urllib.parse.urlencode(q), timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 403:             # the day's quota spent (or the key refused): stop here, keep what's read
            print(f"YouTube refused: {e}")
            raise OutOfBudget from e
        raise


def each(names, step):
    """step(name) for every channel; one channel's trouble (a playlist gone, say) doesn't stop the others"""
    for n in names:
        try:
            step(n)
        except (urllib.error.URLError, KeyError, ValueError) as e:
            print(f"{n}: skipped ({e})")


def channel_id(name: str, handle: str):
    if handle:
        items = get("channels", part="id", forHandle=handle).get("items") or []
        if items:
            return items[0]["id"]
    items = get("search", 100, part="snippet", q=name, type="channel", maxResults=1).get("items") or []
    if items:
        print(f"  {name}: found by search as {items[0]['snippet']['title']!r}")
        return items[0]["snippet"]["channelId"]
    return None


DUR = re.compile(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?")


def duration(iso: str) -> int:
    d, h, m, s = (int(x or 0) for x in DUR.match(iso).groups())
    return d * 86400 + h * 3600 + m * 60 + s


def details(ids: list):
    """videos' details, 50 a call; a video that isn't returned is gone (deleted, private)"""
    for k in range(0, len(ids), 50):
        yield from get("videos", part="snippet,contentDetails,status,statistics", id=",".join(ids[k:k + 50]), maxResults=50).get("items", [])


def as_set(v: dict):
    """a video worth keeping: long, public, playable here, not a stream that's on or to come"""
    sn = v["snippet"]
    if sn.get("liveBroadcastContent", "none") != "none" or not v["status"].get("embeddable") or v["status"].get("privacyStatus") != "public":
        return None
    d = duration(v["contentDetails"].get("duration", "PT0S"))
    if d < MIN_SECONDS:
        return None
    return {"t": sn["title"], "c": sn.get("channelTitle", ""), "d": d, "y": int(sn["publishedAt"][:4]),
            "w": int(v.get("statistics", {}).get("viewCount", 0)),
            "tl": tracklist(sn.get("description", "")), "dd": (sn.get("description", "")[:600] + " " + " ".join(sn.get("tags", []))).strip(),
            "at": date.today().isoformat()}


# —— the build: what's new on each channel, the oldest details refreshed (nothing kept is older than ~25 days),
# the rest of a new channel's back catalogue read as the budget allows (a big one takes a few days)
REFRESH_DAYS = 25
MAX_LOOKUPS = 10               # new channels looked up a day (a search costs 100 units)


def read_channel(name: str, cid: str, cache: dict, complete: bool):
    known = set(cache["known"].get(cid, []))
    fresh, token, finished = [], None, False
    while True:
        q = {"part": "contentDetails", "playlistId": "UU" + cid[2:], "maxResults": 50}
        if token:
            q["pageToken"] = token
        r = get("playlistItems", **q)
        page = [it["contentDetails"]["videoId"] for it in r.get("items", [])]
        new = [i for i in page if i not in known and i not in fresh]
        fresh += new
        token = r.get("nextPageToken")
        if not token:
            finished = True
            break
        if complete and len(new) < len(page):
            break                     # into what was read before
    got = 0
    for k in range(0, len(fresh), 50):
        batch = fresh[k:k + 50]
        seen = set()
        for v in details(batch):
            seen.add(v["id"])
            if v["snippet"].get("liveBroadcastContent", "none") != "none":
                continue              # a stream on or to come: read again once it's over
            known.add(v["id"])
            rec = as_set(v)
            if rec:
                rec["c"] = rec["c"] or name
                cache["sets"][v["id"]] = rec
                got += 1
        known.update(i for i in batch if i not in seen)     # gone
        cache["known"][cid] = sorted(known)
    cache["known"][cid] = sorted(known)
    return finished, len(fresh), got


def build(data: Path, out: Path, prev: Path | None):
    cfg = json.loads((Path(__file__).parent / "set_channels.json").read_text())
    idx = MapIndex(data)
    print(f"map: {len(idx.stars)} stars, {len(idx.track):,} title keys, {len(idx.artist):,} artists")
    cache = {"channels": {}, "done": [], "known": {}, "sets": {}}
    if prev and (prev / "cache.json.gz").exists():
        cache.update(json.loads(gzip.decompress((prev / "cache.json.gz").read_bytes())))
    if prev and (prev / "index.json").exists():   # channel ids found before the cache existed
        old = json.loads((prev / "index.json").read_text())
        for n, c in {**old.get("channels", {}), **old.get("all", {})}.items():
            cache["channels"].setdefault(n, c)
    print(f"cache: {len(cache['sets']):,} sets, {sum(len(x) for x in cache['known'].values()):,} videos read before")
    names = [ch["name"] for ch in cfg["channels"]]
    try:
        # 1. channels: the ones not met before are looked up (a search costs 100, so a few a day)
        def look(n):
            ch = next(c for c in cfg["channels"] if c["name"] == n)
            cid = channel_id(n, ch.get("handle", ""))
            if cid:
                cache["channels"][n] = cid
            else:
                print(f"{n}: channel not found")
        each([n for n in names if n not in cache["channels"]][:MAX_LOOKUPS], look)

        # 2. what's new on the channels read through before
        def new(n):
            _, k, got = read_channel(n, cache["channels"][n], cache, True)
            if k:
                print(f"{n}: {k} new uploads, {got} sets")
        each([n for n in names if n in cache["done"] and n in cache["channels"]], new)
        # 3. the oldest details read again (views, still there, still playable)
        cutoff = (date.today() - timedelta(days=REFRESH_DAYS)).isoformat()
        old_ids = [v for _, v in sorted((r["at"], v) for v, r in cache["sets"].items() if r["at"] < cutoff)]
        for k in range(0, len(old_ids), 50):
            batch = old_ids[k:k + 50]
            back = {v["id"]: v for v in details(batch)}
            for vid in batch:
                rec = as_set(back[vid]) if vid in back else None
                if rec:
                    rec["c"] = rec["c"] or cache["sets"][vid]["c"]
                    cache["sets"][vid] = rec
                else:
                    cache["sets"].pop(vid, None)
        if old_ids:
            print(f"refreshed {len(old_ids)} sets")

        # 4. the back catalogues not finished yet, as far as the budget goes
        def back(n):
            finished, k, got = read_channel(n, cache["channels"][n], cache, False)
            if finished:
                cache["done"].append(n)
            print(f"{n}: {k} uploads read, {got} sets{'' if finished else ' (more next time)'}")
        each([n for n in names if n not in cache["done"] and n in cache["channels"]], back)
    except OutOfBudget:
        print(f"budget of {BUDGET} units reached: the rest next time")
    print(f"YouTube units used: {units}")

    # —— the sets placed in styles, a file per star
    per = defaultdict(list)
    for vid, r in cache["sets"].items():
        p = place(r["t"], r["dd"], r["tl"], idx, r["c"])
        if not p:
            continue
        rows = []
        for sec, a, t in r["tl"]:
            hit = idx.find(a, t) if a else None
            rows.append([sec, f"{a} — {t}" if a else t, hit[0] if hit else "", idx.stars[hit[1]] if hit else ""])
        rec = {"v": vid, "t": r["t"], "c": r["c"], "d": r["d"], "y": r["y"], "w": r["w"], "tl": rows}
        for si in p["stars"]:
            per[si].append(rec)
    (out / "s").mkdir(parents=True, exist_ok=True)
    counts = {}
    for si, recs in per.items():
        recs.sort(key=lambda r: -r["w"])
        recs = recs[:PER_STAR]
        counts[idx.stars[si]] = len(recs)
        json.dump(recs, open(out / "s" / f"{slug(idx.stars[si])}.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    found = {n: c for n, c in cache["channels"].items() if n in names}
    style = {ch["name"]: ch["style"] for ch in cfg["channels"] if ch.get("style") and ch["name"] in found}
    # the live check (supabase/functions/live-sets) watches every channel through its feed: "channels"
    json.dump({"built": date.today().isoformat(), "n": counts, "channels": found, "style": style}, open(out / "index.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    djs = {}
    for a, c in idx.artist.items():
        tot = sum(c.values())
        if tot >= 3:
            djs[a] = [[si, round(4.0 * n / tot * min(1.0, tot / 5), 2)] for si, n in c.most_common(2) if n / tot >= 0.25]
    json.dump({"stars": idx.stars, "a": djs}, open(out / "djs.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    (out / "cache.json.gz").write_bytes(gzip.compress(json.dumps(cache, ensure_ascii=False, separators=(",", ":")).encode()))
    print(f"{len(cache['sets']):,} sets known; {sum(counts.values()):,} placed in {len(counts)} stars")


if __name__ == "__main__":
    build(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]) if len(sys.argv) > 3 else None)
