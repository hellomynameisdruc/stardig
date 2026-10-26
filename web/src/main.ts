// stardig — entry point. The observatory is made for a computer: on a phone, for now, a card says so and
// nothing else loads (no map, no tracks). ?mobile=1 lets this device in anyway (remembered).
// Fonts ship with the site (latin + cyrillic only)
import "@fontsource/dotgothic16/latin-400.css";
import "@fontsource/dotgothic16/latin-ext-400.css";
import "@fontsource/dotgothic16/cyrillic-400.css";
import "@fontsource/martian-mono/latin-300.css";
import "@fontsource/martian-mono/cyrillic-300.css";
import "@fontsource/martian-mono/latin-400.css";
import "@fontsource/martian-mono/cyrillic-400.css";
import "@fontsource/martian-mono/latin-600.css";
import "@fontsource/martian-mono/cyrillic-600.css";
import "./style.css";
import { logoHtml } from "./ui/logo";

const KEY = "kosmos-mobile";
function letIn() {
  try {
    const q = new URLSearchParams(location.search).get("mobile");
    if (q === "1") localStorage.setItem(KEY, "1"); else if (q === "0") localStorage.removeItem(KEY);
    return localStorage.getItem(KEY) === "1";
  } catch { return false; }
}
/** a phone: a touch screen whose short side is phone-sized (tablets and laptops pass) */
const phone = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 600;

function desktopOnly() {
  const link = `${location.origin}/`;
  document.body.className = "desk-only";
  document.body.innerHTML = `<main class="desk-card" role="main">
    <span class="inv logo">${logoHtml(1.6)}</span>
    <p class="dk-k">OBSERVATORY // SIGNAL WEAK ON THIS SCREEN</p>
    <h1>STARDIG IS MADE FOR A COMPUTER</h1>
    <p>The map of electronic music needs a big screen and a keyboard: millions of tracks among the stars, the player beside them. The phone version is closed for now.</p>
    <p class="dk-u">Open <b>${link.replace(/^https?:\/\//, "").replace(/\/$/, "")}</b> on your laptop or desktop.</p>
    <button type="button" class="key" id="dkCopy">⧉ COPY THE LINK</button>
    <p class="dk-c">hellomynameisdruc © 2026</p></main>`;
  const b = document.getElementById("dkCopy")!;
  b.onclick = async () => {
    try { if (navigator.share) { await navigator.share({ title: "stardig", url: link }); return; } await navigator.clipboard.writeText(link); b.textContent = "COPIED ✓"; }
    catch { b.textContent = link; }
  };
}

if (phone() && !letIn()) desktopOnly(); else import("./app");
