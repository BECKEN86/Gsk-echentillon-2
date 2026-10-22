/**
 * Authentification côté serveur GeStock.
 *
 * - Mots de passe hachés avec scrypt (node:crypto, zéro dépendance)
 * - Sessions en base (collection `sessions`) avec expiration 12 h
 * - Les endpoints d'écriture exigent un Bearer token valide
 * - Migration douce : un mot de passe en clair est vérifié puis remplacé
 *   par son hash à la première connexion réussie
 */

import { scryptSync, createHash, timingSafeEqual, randomBytes, randomUUID } from 'node:crypto';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 h

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  // Format haché "scrypt:<salt>:<hash>"
  if (stored.startsWith('scrypt:')) {
    const [, salt, hex] = stored.split(':');
    if (!salt || !hex) return false;
    const candidate = scryptSync(password, salt, 64);
    const expected = Buffer.from(hex, 'hex');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  }
  // Format haché "sha256:<salt>:<hash>" — comptes créés côté client
  // (même algorithme que src/utils/passwordHash.ts)
  if (stored.startsWith('sha256:')) {
    const [, salt, hex] = stored.split(':');
    if (!salt || !hex) return false;
    const candidate = createHash('sha256').update(`${salt}:${password}`).digest('hex');
    const a = Buffer.from(candidate, 'hex');
    const b = Buffer.from(hex, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }
  // Legacy : mot de passe en clair (comptes existants avant migration)
  return stored === password;
}

export function createAuth(store) {
  const allSections = [
    'accueil',
    'inventaire-approvisionnement', 'inventaire-magasins', 'inventaire-produits',
    'inventaire-physique', 'inventaire-valorisation', 'inventaire-ajustement',
    'inventaire-transferts', 'inventaire-pertes-avaries', 'inventaire-peremption',
    'acteurs-clients', 'acteurs-fournisseurs',
    'achat-demande-prix', 'achat-bon-commande', 'achat-reception', 'achat-retours',
    'vente-pos', 'vente-sessions', 'vente-commande', 'vente-retours',
    'finance-recettes-depenses', 'finance-marges-resultat', 'finance-tresorerie-caisses',
    'parametres-utilisateurs', 'parametres-configuration', 'parametres-import',
    'parametres-export', 'parametres-audit', 'guide-utilisateur'
  ];
  let setupQueue = Promise.resolve();

  /** Lit l'annuaire utilisateurs + sessions depuis le store. */
  async function loadUsers() {
    const db = await store.load();
    return { db, users: db?.users || [], sessions: db?.sessions || [] };
  }

  async function saveUsers(db, users, sessions) {
    await store.save({ ...db, users, sessions });
  }

  return {
    /** Crée le premier compte administrateur une seule fois. */
    async setupFirstAdmin(input = {}) {
      const previousSetup = setupQueue;
      let releaseSetup;
      setupQueue = new Promise(resolve => { releaseSetup = resolve; });
      await previousSetup;

      try {
        const { username, name, password } = input;
        if (
          typeof username !== 'string' ||
          typeof name !== 'string' ||
          typeof password !== 'string'
        ) {
          return { error: 'Les champs du compte administrateur sont invalides.', setupRequired: true };
        }

        const cleanUsername = username.trim();
        const cleanName = name.trim();
        if (
          cleanUsername.length < 3 || cleanUsername.length > 64 ||
          cleanName.length < 2 || cleanName.length > 120 ||
          password.length < 8 || password.length > 128
        ) {
          return { error: 'Saisissez un identifiant (3 à 64 caractères), un nom (2 à 120 caractères) et un mot de passe (8 à 128 caractères).', setupRequired: true };
        }

        const { db, users, sessions } = await loadUsers();
        if (users.length > 0) {
          return { error: 'La configuration initiale a déjà été effectuée.', setupRequired: false };
        }

        const user = {
          id: randomUUID(),
          username: cleanUsername,
          name: cleanName,
          role: 'Administrateur',
          active: true,
          defaultSection: 'accueil',
          allowedSections: allSections,
          avatarInitials: cleanName.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(),
          passwordHash: hashPassword(password)
        };
        const session = {
          id: randomUUID(),
          userId: user.id,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString()
        };
        await store.save({ ...db, users: [user], sessions: [...sessions, session] });

        const { passwordHash: _passwordHash, ...safeUser } = user;
        return { user: safeUser, token: session.id, setupRequired: false };
      } finally {
        releaseSetup();
      }
    },

    async isSetupRequired() {
      const { users } = await loadUsers();
      return users.length === 0;
    },

    /** POST /api/auth/login */
    async login(username, password) {
      const { db, users, sessions } = await loadUsers();
      const user = users.find(
        u => u.username && u.username.toLowerCase() === String(username).trim().toLowerCase()
      );
      if (!user) return { error: 'Identifiant ou mot de passe incorrect.' };
      if (user.active === false) return { error: 'Ce compte a été désactivé.' };

      const stored = user.passwordHash || user.password;
      if (!verifyPassword(password, stored)) {
        return { error: 'Identifiant ou mot de passe incorrect.' };
      }

      // Migration : remplace le mot de passe en clair par son hash scrypt
      let migratedUsers = users;
      if (user.password && !user.passwordHash) {
        migratedUsers = users.map(u =>
          u.id === user.id
            ? { ...u, passwordHash: hashPassword(password), password: undefined }
            : u
        );
      }

      const now = Date.now();
      const liveSessions = sessions.filter(s => new Date(s.expiresAt).getTime() > now);
      const session = {
        id: randomUUID(),
        userId: user.id,
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + SESSION_TTL_MS).toISOString()
      };

      if (db) {
        await saveUsers(db, migratedUsers, [...liveSessions, session]);
      }

      const { password: _p, passwordHash: _ph, ...safeUser } = user;
      return { user: safeUser, token: session.id };
    },

    /** Bearer token → session + utilisateur, ou null */
    async resolveToken(token) {
      if (!token) return null;
      const { users, sessions } = await loadUsers();
      const session = sessions.find(s => s.id === token);
      if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null;
      const user = users.find(u => u.id === session.userId);
      if (!user) return null;
      const { password: _p, passwordHash: _ph, ...safeUser } = user;
      return { user: safeUser, session };
    },

    /** POST /api/auth/logout */
    async logout(token) {
      const { db, users, sessions } = await loadUsers();
      if (!db) return;
      await saveUsers(
        db,
        users,
        sessions.filter(s => s.id !== token)
      );
    },

    /** Middleware Express : exige une session valide pour l'écriture. */
    requireSession() {
      return async (req, res, next) => {
        const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        const resolved = await this.resolveToken(token);
        if (!resolved) {
          return res.status(401).json({ error: 'Session requise ou expirée' });
        }
        req.authUser = resolved.user;
        next();
      };
    }
  };
}
