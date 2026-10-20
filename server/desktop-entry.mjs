/**
 * Point d'entrée du serveur pour le mode desktop — re-exporté tel quel ;
 * esbuild le bundle en un unique fichier CJS chargé par require()
 * depuis electron/main.cjs (le require() traverse app.asar sans souci,
 * contrairement au résolveur ESM).
 */

export { createApp } from './app.mjs';
export { seedAdmin } from './seed.mjs';
