/**
 * Stamped in at build time so you can tell whether a relaunch actually picked up
 * a new version. The installed app updates on the launch *after* the one that
 * downloads it, so without this you would be guessing.
 *
 * Parcel substitutes process.env.* at build time; the fallback covers a build
 * where the variable was not set. See the rebuild recipe in the README.
 */
export const BUILD_STAMP: string = process.env.BUILD_STAMP || "dev";
