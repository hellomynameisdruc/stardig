"""Load test on lived-in data: the site opened by a pilot with a long flight log across many styles,
beacons, and a COMMS channel full of shared tracks from all over the map — on a phone and on a laptop.
Supabase is stood in for here (nothing leaves the machine). It fails (exit 1) if the start loads the
tracks of styles nobody is looking at, if the page freezes, or if memory runs away: the two freezes of
October 2026 (the flight log loading every style it mentions; chat cards asking for repaints that
multiplied) would both have failed it.

  cd web && npm run build && npx vite preview --port 4173 &
  python3 e2e/load.py          # URL=… and PW_CHROMIUM=… to override
"""
import asyncio
import json
import os
import pathlib
import re
import sys
import urllib.parse

from playwright.async_api import async_playwright

URL = os.environ.get("URL", "http://localhost:4173/")
CHROMIUM = os.environ.get("PW_CHROMIUM") or None
DATA = pathlib.Path(__file__).resolve().parent.parent / "public" / "data"
SB = "https://muuaqquhqgthkfzlqkvq.supabase.co"

# limits
MAX_START_FILES = 24       # data files fetched by opening the site: the stars in view and those flown past on the way to the open star (12–20, by timing), not every style the log and the chat mention (that was 80)
MAX_TASK_MS = 1200         # the longest freeze allowed after the first seconds
MAX_HEAP_MB = 200

m = json.loads((DATA / "map.json").read_text())
stars = [s["name"] for s in m["stars"]]


def yt_of(si, k):
    t = json.loads((DATA / "tracks" / f"{si}.json").read_text())
    return t["yt"][k * 11:k * 11 + 11] if isinstance(t.get("yt"), str) else t["yt"][k]


picks = [(si, 3) for si in range(len(stars))]
log = [{"k": f"{si}-{k}", "t": 1761400000000 - n * 60000, "y": yt_of(si, k), "st": stars[si]} for n, (si, k) in enumerate(picks[:40])]
likes = [{"y": yt_of(si, 5), "s": si, "i": 5, "t": "A track", "a": "An artist", "at": 1761400000000 - n, "st": stars[si]} for n, (si, _) in enumerate(picks[:12])]
U = "22222222-2222-3333-4444-555555555555"
msgs = []
for n in range(60):
    si = n % len(stars)
    link = f"https://stardig.app/#sig-{yt_of(si, 7)}.{urllib.parse.quote(stars[si])}"
    body = link if n % 3 else f"♪ Some title — Some artist\n{link}"  # old shares and new ones
    msgs.append({"id": 100 + n, "pilot": U, "body": body, "room": "all", "reply_to": None, "created_at": "2099-01-01T00:%02d:00Z" % (n % 60)})
PILOT = {"id": U, "nick": "DIGGER", "avatar": 7, "rank": "pilot", "admin": False, "access": True}


async def rest(route):
    u, acc = route.request.url, route.request.headers.get("accept", "")
    if "/rest/v1/messages" in u:
        body = msgs[::-1]
    elif "/rest/v1/pilots" in u:
        body = PILOT if "object" in acc else [PILOT]
    else:
        body = []
    await route.fulfill(status=200, content_type="application/json", body=json.dumps(body))


def socket(ws):  # the realtime line: accept every join, say nothing more
    def on(msg):
        try:
            j = json.loads(msg)
        except Exception:
            return
        if isinstance(j, list) and len(j) >= 4 and j[3] == "phx_join":
            ws.send(json.dumps([j[0], j[1], j[2], "phx_reply", {"status": "ok", "response": {"postgres_changes": []}}]))
        elif isinstance(j, list) and len(j) >= 4 and j[3] == "heartbeat":
            ws.send(json.dumps([None, j[1], "phoenix", "phx_reply", {"status": "ok", "response": {}}]))
    ws.on_message(on)


INIT = ("localStorage.setItem('kosmos-briefed','1');"
        f"localStorage.setItem('kosmos-log2', {json.dumps(json.dumps(log))});"
        f"localStorage.setItem('kosmos-likes', {json.dumps(json.dumps(likes))});"
        "window.__lt=[];new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lt.push([Math.round(e.startTime),Math.round(e.duration)])}).observe({type:'longtask',buffered:true});")


async def run(b, name, viewport, scale, mobile):
    ctx = await b.new_context(viewport=viewport, device_scale_factor=scale, is_mobile=mobile, has_touch=mobile)
    await ctx.route(f"{SB}/**", rest)
    await ctx.route_web_socket(re.compile(r"wss://muuaqquhqgthkfzlqkvq\.supabase\.co/.*"), socket)
    await ctx.add_init_script(INIT)
    pg = await ctx.new_page()
    errors, files = [], []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("request", lambda r: files.append(r.url) if re.search(r"/data/(tracks|titles|vault)/", r.url) else None)
    await pg.goto(URL)
    await pg.wait_for_timeout(10000)  # COMMS connects a few seconds in, on its own
    start_files = len(files)
    try:
        await pg.locator("#tabComms").click(timeout=3000)
    except Exception:
        await pg.evaluate("document.getElementById('tabComms').click()")
    await pg.wait_for_timeout(12000)  # older shared cards are looked up now, one style at a time
    lt = await asyncio.wait_for(pg.evaluate("window.__lt"), 30)
    heap = await pg.evaluate("performance.memory ? performance.memory.usedJSHeapSize / 1e6 : 0")
    late = [d for t, d in lt if t > 4000]
    fails = []
    if start_files > MAX_START_FILES:
        fails.append(f"opening the site fetched {start_files} star files (max {MAX_START_FILES})")
    if late and max(late) > MAX_TASK_MS:
        fails.append(f"a freeze of {max(late)} ms (max {MAX_TASK_MS})")
    # a runaway: freezes that keep growing (each about twice the last), whatever their size
    if len(late) >= 5 and all(late[k + 1] > late[k] * 1.6 for k in range(len(late) - 4, len(late) - 1)):
        fails.append(f"freezes keep growing: {late[-4:]} ms")
    if heap > MAX_HEAP_MB:
        fails.append(f"{heap:.0f} MB of memory (max {MAX_HEAP_MB})")
    if errors:
        fails.append(f"page errors: {errors[:2]}")
    print(f"{name}: start files {start_files}, all files {len(files)}, longest freeze {max(late or [0])} ms, freezes {sum(late)} ms, heap {heap:.0f} MB"
          + ("" if not fails else "\n  FAIL: " + "\n  FAIL: ".join(fails)), flush=True)
    await ctx.close()
    return not fails


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROMIUM) if CHROMIUM else await p.chromium.launch()
        ok = await run(b, "phone", {"width": 390, "height": 844}, 3, True)
        ok = await run(b, "laptop", {"width": 1440, "height": 900}, 2, False) and ok
        await b.close()
    sys.exit(0 if ok else 1)

asyncio.run(main())
