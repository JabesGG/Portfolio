import { defineConfig } from "astro/config";

export default defineConfig({
  // Change this to your real domain once you have one.
  site: "https://jabezgoh.com",
  // Stylesheets are kept external on purpose: it lets the Content-Security-Policy
  // stay strict instead of needing 'unsafe-inline' for styles.
  build: {
    inlineStylesheets: "never",
  },
});
