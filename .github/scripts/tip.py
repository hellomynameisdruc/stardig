"""SYSTEM's tip: a random track from the map, posted to COMMS · ALL as the station's own message (like
the founder's /tip). Run by .github/workflows/tip.yml twice a day.

Reads the published map from the site and writes to Supabase with the service key, which only lives in
the repository's secrets (SUPABASE_SERVICE_KEY): Supabase → Project Settings → API Keys → a secret key
(sb_secret_…), or the legacy service_role key. Bigger styles come up more often, like /tip.
"""
import json
import os
import random
import sys
import urllib.error
import urllib.parse
import urllib.request

SITE = os.environ.get("SITE", "https://stardig.app/")
SB = os.environ.get("SUPABASE_URL", "https://muuaqquhqgthkfzlqkvq.supabase.co")
KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
SAFE = "-_.!~*'()"  # what encodeURIComponent leaves as it is, as the site writes a track's link


def get(path: str):
    with urllib.request.urlopen(urllib.parse.urljoin(SITE, path), timeout=60) as r:
        return json.load(r)


def pick(rng: random.Random):
    stars = get("data/map.json")["stars"]
    total = sum(s["tracks"] for s in stars)
    r = rng.random() * total
    s = next((k for k, st in enumerate(stars) if (r := r - st["tracks"]) < 0), 0)
    tr, words = get(f"data/tracks/{s}.json"), get(f"data/titles/{s}.json")
    titles, names = words["t"].split("\n"), words["an"].split("\n")
    n = min(len(titles), tr.get("n", len(titles)))
    i = rng.randrange(n)
    yt = tr["yt"][i * 11:i * 11 + 11] if isinstance(tr["yt"], str) else tr["yt"][i]
    who = names[words["a"][i]]
    star = stars[s]["name"]
    link = f"{SITE}#sig-{yt}.{urllib.parse.quote(star, safe=SAFE)}"
    said = f"♪ {titles[i]}" + (f" — {who}" if who else "")
    return said[:200], link, star


def headers():
    """a new secret key (sb_secret_…) goes in the apikey header alone; a legacy service_role key (a JWT)
    goes there and as the bearer too"""
    h = {"apikey": KEY, "Content-Type": "application/json", "Prefer": "return=minimal"}
    if KEY.startswith("eyJ"):
        h["Authorization"] = f"Bearer {KEY}"
    return h


def post(body: str):
    req = urllib.request.Request(f"{SB}/rest/v1/messages", method="POST", data=json.dumps({"room": "all", "body": body, "pilot": None}).encode(),
                                 headers=headers())
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status
    except urllib.error.HTTPError as e:
        sys.exit(f"Supabase said {e.code}: {e.read().decode()[:300]}")


if __name__ == "__main__":
    said, link, star = pick(random.Random())
    body = f"{said}\n{link}"
    print(f"{star}: {body}")
    if "--dry" in sys.argv:
        sys.exit(0)
    if not KEY:
        sys.exit("No SUPABASE_SERVICE_KEY secret: add it in the repository's Settings → Secrets → Actions")
    print("posted", post(body))
