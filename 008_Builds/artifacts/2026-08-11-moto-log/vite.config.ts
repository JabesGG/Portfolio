import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Served from the portfolio's Netlify build at /moto/ (Astro copies public/ verbatim).
export default defineConfig({
  base: "/moto/",
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    // The site's CSP is script-src 'self' with no 'unsafe-inline'. Vite's
    // modulepreload polyfill is emitted as an inline script, so it has to go —
    // every browser that can run this app supports modulepreload natively.
    modulePreload: { polyfill: false },
    cssCodeSplit: false,
    assetsInlineLimit: 0,
  },
});
