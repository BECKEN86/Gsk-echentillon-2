/**
 * Serveur local GeStock — API Express + application web.
 *
 * Persistance : SQLite local uniquement (voir db.mjs) — aucun serveur
 * distant. Dossier de données : GESTOCK_DATA_DIR ou server/data.
 *
 * Toute la logique Express est dans app.mjs (partagée avec le mode
 * desktop Electron) ; ce fichier ne fait que choisir le port et écouter.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.mjs';

const { app, store } = await createApp();

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8787;
app.listen(PORT, () => {
  console.log(`GeStock API prête → http://localhost:${PORT}/api`);
  if (existsSync(join(__dirname, '..', 'dist'))) {
    console.log(`Application web   → http://localhost:${PORT}`);
  }
  console.log(`Persistance : ${store.engine}`);
});
