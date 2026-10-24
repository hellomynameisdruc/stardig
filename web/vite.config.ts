import { defineConfig } from "vite";

// every built file opens with the copyright line, so copies keep the author's name
const banner = "/*! stardig \u00a9 2026 hellomynameisdruc. All rights reserved. https://stardig.app */";
export default defineConfig({
  base: "./",
  build: { target: "es2022", rollupOptions: { input: { main: "index.html", comms: "comms.html" }, output: { banner } } },
  server: { port: 5173 },
});
