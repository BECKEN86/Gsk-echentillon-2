/**
 * Seed administrateur GeStock (CLI) — voir seed.mjs pour la logique.
 * Usage : node server/seed-admin.mjs
 */

import { createStore } from './db.mjs';
import { seedAdmin } from './seed.mjs';

const store = await createStore();
try {
  await seedAdmin(store);
} catch (err) {
  console.error('[seed] ERREUR :', err.message);
  process.exit(1);
}

console.log('──────────────────────────────────────────────');
console.log('  Compte administrateur prêt');
console.log(`  Persistance  : ${store.engine}`);
console.log('  Identifiant  : admin');
console.log('  Mot de passe : admin123');
console.log('──────────────────────────────────────────────');
