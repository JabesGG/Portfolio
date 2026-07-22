import { defineConfig } from "astro/config";

export default defineConfig({
  // Deployed on Netlify. Swap for a custom domain here if you add one later.
  site: "https://jabezgoh.netlify.app",
  // Stylesheets are kept external on purpose: it lets the Content-Security-Policy
  // stay strict instead of needing 'unsafe-inline' for styles.
  build: {
    inlineStylesheets: "never",
  },
});
