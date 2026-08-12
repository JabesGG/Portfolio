import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native shell config. `webDir` points at the *native* build — produced from
 * index-single.html, which carries no web manifest and registers no service
 * worker. Inside the shell the app is served from the local origin, so both
 * would be wrong: the store listing replaces the manifest, and Capacitor's own
 * asset handling replaces the worker.
 *
 * Build it with:
 *   parcel build index-single.html --public-url ./ --dist-dir dist-native --no-source-maps
 *   mv dist-native/index-single.html dist-native/index.html
 */
const config: CapacitorConfig = {
  appId: "app.jabezgoh.motolog",
  appName: "Moto Log",
  webDir: "dist-native",
  android: {
    backgroundColor: "#15181B",
  },
  ios: {
    backgroundColor: "#15181B",
    contentInset: "always",
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_icon",
      iconColor: "#15181B",
    },
  },
};

export default config;
