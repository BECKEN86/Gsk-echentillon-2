/**
 * Build de l'installateur Windows (.exe NSIS) — wrapper Node pour fixer
 * USE_HARD_LINKS=false (contourne les EPERM antivirus/indexeur Windows
 * lors de l'extraction du binaire Electron, quel que soit le shell).
 */

process.env.USE_HARD_LINKS = 'false';

const { build, Platform, Arch } = await import('electron-builder');

try {
  await build({ targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64) });
} catch (err) {
  console.error('[dist-win] Échec du build :', err.message || err);
  process.exit(1);
}
