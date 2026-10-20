/**
 * Graine administrateur GeStock — exportée pour être appelée :
 *   - par server/seed-admin.mjs (CLI)
 *   - par electron/main.cjs    (premier lancement du logiciel de bureau)
 *
 * Garantit qu'un compte « admin / admin123 » unique existe (hash scrypt).
 */

import { hashPassword, verifyPassword } from './auth.mjs';

const ALL_SECTIONS = [
  'accueil',
  'inventaire-approvisionnement', 'inventaire-magasins', 'inventaire-produits',
  'inventaire-physique', 'inventaire-valorisation', 'inventaire-ajustement',
  'inventaire-transferts', 'inventaire-pertes-avaries',
  'acteurs-clients', 'acteurs-fournisseurs',
  'achat-demande-prix', 'achat-bon-commande', 'achat-reception', 'achat-retours',
  'vente-pos', 'vente-sessions', 'vente-commande', 'vente-retours',
  'inventaire-peremption',
  'finance-recettes-depenses', 'finance-marges-resultat', 'finance-tresorerie-caisses',
  'parametres-utilisateurs', 'parametres-configuration', 'parametres-export',
  'parametres-audit', 'guide-utilisateur'
];

const ADMIN_USER = {
  id: 'usr-admin',
  username: 'admin',
  name: 'Administrateur',
  role: 'Administrateur',
  email: '',
  phone: '',
  active: true,
  defaultSection: 'accueil',
  allowedSections: ALL_SECTIONS,
  avatarInitials: 'AD'
};

export async function seedAdmin(store) {
  const db = await store.load();
  const users = db?.users || [];

  // Un compte « admin » existe déjà ? On le met à jour plutôt que de
  // créer un doublon d'identifiant.
  const existing = users.find(u => u.username && u.username.toLowerCase() === 'admin');
  const target = existing
    ? {
        ...existing,
        role: 'Administrateur',
        active: true,
        defaultSection: existing.defaultSection || 'accueil',
        allowedSections: ALL_SECTIONS,
        passwordHash: hashPassword('admin123'),
        password: undefined
      }
    : { ...ADMIN_USER, passwordHash: hashPassword('admin123') };

  await store.upsert('users', target.id, target);

  // Suppression d'éventuels doublons « admin »
  for (const u of users) {
    if (u.username && u.username.toLowerCase() === 'admin' && u.id !== target.id) {
      await store.remove('users', u.id);
    }
  }

  // Vérification : le compte existe et le mot de passe fonctionne
  const db2 = await store.load();
  const admins = (db2?.users || []).filter(u => u.username && u.username.toLowerCase() === 'admin');
  const saved = admins[0];
  if (admins.length !== 1 || !saved || !verifyPassword('admin123', saved.passwordHash || saved.password)) {
    throw new Error('[seed] Le compte admin est absent, dupliqué ou le mot de passe est invalide.');
  }
  return target;
}
