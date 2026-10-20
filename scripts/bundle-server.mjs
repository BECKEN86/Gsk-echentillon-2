/**
 * Bundle du serveur embarqué (desktop) : tout le code serveur + express
 * est fusionné dans un unique fichier ESM autonome (server/server.bundle.mjs).
 *
 * Le banner injecte un `require` via createRequire : esbuild ESM n'en
 * fournit pas, alors que les modules CJS bundlés (express…) en ont besoin.
 * Externals : builtins node:* uniquement (fournis par Electron) — la
 * persistance est exclusivement SQLite local.
 */

import { build } from 'esbuild';

try {
  await build({
    entryPoints: ['server/desktop-entry.mjs'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: 'server/server.bundle.mjs',
    external: ['node:*'],
    banner: {
      js: "import { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);"
    },
    logLevel: 'warning'
  });
  console.log('Serveur embarqué bundlé → server/server.bundle.mjs');
} catch (err) {
  console.error('[bundle:server] Échec :', err.message || err);
  process.exit(1);
}
