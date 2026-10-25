// DOM access shared by the UI layers.

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
/** how many screen px one CSS px of `el` takes (the page is drawn at 80% on desktop screens) */
export const uiZoom = (el: HTMLElement) => { const w = el.getBoundingClientRect().width; return el.offsetWidth && w ? w / el.offsetWidth : 1; };
/** the system asks for less motion (macOS / Windows / iOS "Reduce motion") */
export const systemStill = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const motionPref = (() => { try { return localStorage.getItem("kosmos-motion"); } catch { return null; } })();
/** less motion: animations freeze or are skipped — as the system asks, unless the visitor turned motion on here */
export const reduce = systemStill ? motionPref !== "on" : motionPref === "off";
if (typeof document !== "undefined") document.documentElement.classList.toggle("still", reduce);
/** turn motion on or off on this site (reloads, as the whole map is set up for one or the other) */
export function setMotion(on: boolean) { try { localStorage.setItem("kosmos-motion", on ? "on" : "off"); } catch { /* storage unavailable */ } location.reload(); }
