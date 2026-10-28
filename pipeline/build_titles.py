"""Search by track title: an index of every track's title (on the map and in the vault), split into
small files by the title's first two letters, so the site fetches one only while someone types.

    python pipeline/build_titles.py web/public/data

Reads the published map (map.json, tracks/, titles/, vault/) and writes search/<key>.json. A key is the
title's first two letters; a file that would be too big is split by one more letter, and again
(search/index.json lists the keys that were split, so the site knows to wait for another letter). Each:
  {"t": titles (one per line), "n": artist names (one per line), "a": [artist per title],
   "s": [star per title], "i": [track index, or -1 - vault position]}
A title is listed once per artist (the map's copy first). The site matches titles that start with
what's typed (letters and digits only, accents dropped), like key_of below.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

WORD = re.compile(r"[^0-9a-z]+")


def norm(s: str) -> str:
    """lowercase, accents dropped, anything but a-z and 0-9 removed"""
    s = unicodedata.normalize("NFKD", s.lower())
    return WORD.sub("", "".join(c for c in s if not unicodedata.combining(c)))


MAX_BYTES = 350_000  # a file fetched while typing stays small
MAX_KEY = 8


def key_of(n: str, size: int = 2) -> str:
    return n[:size] if len(n) >= 2 else "_"


def build(data: Path) -> dict:
    meta = json.loads((data / "map.json").read_text())
    n_stars = len(meta["stars"])
    size = meta["meta"].get("shard", 4000)
    seen: set[tuple[str, str]] = set()

    rows: list[tuple[str, str, str, int, int]] = []  # (normalised title, title, artist, star, index)

    def add(title: str, artist: str, s: int, i: int):
        if not title:
            return
        k = (norm(title), artist.lower())
        if k in seen:
            return
        seen.add(k)
        rows.append((k[0], title, artist, s, i))

    for s in range(n_stars):
        w = json.loads((data / "titles" / f"{s}.json").read_text())
        titles, names = w["t"].split("\n"), w["an"].split("\n")
        for i, (t, a) in enumerate(zip(titles, w["a"], strict=False)):
            add(t, names[a], s, i)
    for s in range(n_stars):
        d = data / "vault" / str(s)
        if not d.is_dir():
            continue
        for f in sorted(d.glob("*.json"), key=lambda p: (not p.stem.isdigit(), int(p.stem) if p.stem.isdigit() else 0)):
            if not f.stem.isdigit():
                continue
            w = json.loads(f.read_text())
            titles, names, base = w["t"].split("\n"), w["an"].split("\n"), int(f.stem) * size
            for j, (t, a) in enumerate(zip(titles, w["a"], strict=False)):
                add(t, names[a], s, -1 - (base + j))

    out = data / "search"
    out.mkdir(exist_ok=True)
    for old in out.glob("*.json"):
        old.unlink()
    split: list[str] = []

    def write(key: str, group: list) -> int:
        names, nx, doc = [], {}, {"t": [], "a": [], "s": [], "i": []}
        for _, title, artist, s, i in group:
            if artist not in nx:
                nx[artist] = len(names)
                names.append(artist)
            doc["t"].append(title)
            doc["a"].append(nx[artist])
            doc["s"].append(s)
            doc["i"].append(i)
        text = json.dumps({"t": "\n".join(doc["t"]), "n": "\n".join(names), "a": doc["a"], "s": doc["s"], "i": doc["i"]},
                          ensure_ascii=False, separators=(",", ":"))
        if len(text.encode()) > MAX_BYTES and len(key) < MAX_KEY and key != "_":
            split.append(key)
            subs: dict[str, list] = {}
            for r in group:
                subs.setdefault(r[0][: len(key) + 1] if len(r[0]) > len(key) else key + "_", []).append(r)
            return sum(write(k, g) for k, g in subs.items())
        (out / f"{key}.json").write_text(text)
        return 1

    groups: dict[str, list] = {}
    for r in rows:
        groups.setdefault(key_of(r[0]), []).append(r)
    files = sum(write(k, g) for k, g in groups.items())
    (out / "index.json").write_text(json.dumps({"split": sorted(split)}, separators=(",", ":")))
    return {"files": files, "titles": len(rows), "split": len(split)}


if __name__ == "__main__":
    print(build(Path(sys.argv[1] if len(sys.argv) > 1 else "web/public/data")))
