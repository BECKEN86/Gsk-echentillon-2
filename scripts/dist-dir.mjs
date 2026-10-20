/**
 * Build du dossier applicatif non installé (win-unpacked) — même
 * contournement USE_HARD_LINKS que dist-win.mjs.
 */

process.env.USE_HARD_LINKS = 'false';

const { build, Platform, Arch } = await import('electron-builder');

try {
  await build({ targets: Platform.WINDOWS.createTarget(['dir'], Arch.x64) });
} catch (err) {
  console.error('[dist-dir] Échec du build :', err.message || err);
  process.exit(1);
}
