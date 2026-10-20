/**
 * Application Express GeStock — factorisée pour être montée :
 *   - par server/index.mjs   (lancement Node classique)
 *   - par electron/main.cjs  (application de bureau — serveur embarqué)
 *
 * Retourne { app, store } ; c'est l'appelant qui choisit le port et
 * l'interface d'écoute.
 */

import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './db.mjs';
import { createAuth, hashPassword } from './auth.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function createApp({ staticDir } = {}) {
  const store = await createStore();
  const auth = createAuth(store);

  const app = express();
  app.use(express.json({ limit: '25mb' }));

  /* ---------------------------------------------------------------- */
  /* CORS — en production, restreindre via CORS_ORIGIN                  */
  /* ---------------------------------------------------------------- */

  const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.length === 0 || (origin && allowedOrigins.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  /* ---------------------------------------------------------------- */
  /* Helpers                                                          */
  /* ---------------------------------------------------------------- */

  const bearerToken = req =>
    (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();

  /** Retire password/passwordHash avant tout envoi aux clients. */
  function sanitizeDb(db) {
    if (!db) return db;
    const { sessions: _s, ...rest } = db;
    return {
      ...rest,
      sessions: [],
      users: (db.users || []).map(u => {
        const { password: _p, passwordHash: _ph, ...safe } = u;
        return safe;
      })
    };
  }

  /** Hache les mots de passe en clair avant écriture en base. */
  function hashUserPasswords(db) {
    if (!db) return db;
    return {
      ...db,
      users: (db.users || []).map(u =>
        u.password ? { ...u, passwordHash: hashPassword(u.password), password: undefined } : u
      )
    };
  }

  const requireSession = auth.requireSession();
  const requireAdmin = [
    requireSession,
    (req, res, next) =>
      req.authUser.role === 'Administrateur'
        ? next()
        : res.status(403).json({ error: 'Réservé aux administrateurs' })
  ];

  /* ---------------------------------------------------------------- */
  /* Auth                                                             */
  /* ---------------------------------------------------------------- */

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
      }
      const result = await auth.login(username, password);
      if (result.error) return res.status(401).json({ error: result.error });
      res.json(result);
    } catch (err) {
      console.error('[POST /api/auth/login]', err);
      res.status(500).json({ error: 'Erreur de connexion' });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    try {
      await auth.logout(bearerToken(req));
      res.json({ ok: true });
    } catch (err) {
      console.error('[POST /api/auth/logout]', err);
      res.status(500).json({ error: 'Erreur de déconnexion' });
    }
  });

  app.get('/api/auth/me', requireSession, (req, res) => {
    res.json({ user: req.authUser });
  });

  /* ---------------------------------------------------------------- */
  /* Données                                                          */
  /* ---------------------------------------------------------------- */

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, engine: store.engine });
  });

  app.get('/api/rev', requireSession, async (_req, res) => {
    try {
      res.json({ rev: await store.getRev() });
    } catch (err) {
      res.status(500).json({ error: 'Erreur de révision' });
    }
  });

  app.get('/api/db', requireSession, async (_req, res) => {
    try {
      const db = await store.load();
      res.json(sanitizeDb(db)); // null si base vierge → fallback local du frontend
    } catch (err) {
      console.error('[GET /api/db]', err);
      res.status(500).json({ error: 'Erreur de lecture de la base' });
    }
  });

  app.put('/api/db', requireSession, async (req, res) => {
    try {
      const payload = hashUserPasswords(req.body);
      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ error: 'Corps de requête invalide' });
      }
      // Les sessions sont gérées par le serveur — jamais écrasées par un client
      const current = await store.load();
      if (current?.sessions) payload.sessions = current.sessions;
      const records = await store.save(payload);
      const rev = await store.getRev();
      res.json({ ok: true, records, rev });
    } catch (err) {
      console.error('[PUT /api/db]', err);
      res.status(500).json({ error: "Erreur d'écriture dans la base" });
    }
  });

  app.put('/api/db/:collection/:id', requireSession, async (req, res) => {
    try {
      const { collection, id } = req.params;
      let entity = req.body;
      if (collection === 'users' && entity?.password) {
        entity = { ...entity, passwordHash: hashPassword(entity.password), password: undefined };
      }
      await store.upsert(collection, id, entity);
      res.json({ ok: true, rev: await store.getRev() });
    } catch (err) {
      console.error('[PUT /api/db/:collection/:id]', err);
      res.status(400).json({ error: err.message || "Erreur d'écriture" });
    }
  });

  app.delete('/api/db/:collection/:id', requireSession, async (req, res) => {
    try {
      const { collection, id } = req.params;
      if (collection === 'sessions') {
        return res.status(403).json({ error: 'Sessions gérées par le serveur' });
      }
      await store.remove(collection, id);
      res.json({ ok: true, rev: await store.getRev() });
    } catch (err) {
      console.error('[DELETE /api/db/:collection/:id]', err);
      res.status(400).json({ error: err.message || 'Erreur de suppression' });
    }
  });

  app.put('/api/meta', requireSession, async (req, res) => {
    try {
      const { counters, companyConfig, lastUpdated } = req.body || {};
      if (counters !== undefined) await store.setMeta('counters', JSON.stringify(counters));
      if (companyConfig !== undefined) await store.setMeta('companyConfig', JSON.stringify(companyConfig));
      await store.setMeta('lastUpdated', String(lastUpdated || new Date().toISOString()));
      res.json({ ok: true, rev: await store.getRev() });
    } catch (err) {
      console.error('[PUT /api/meta]', err);
      res.status(500).json({ error: "Erreur d'écriture des métadonnées" });
    }
  });

  app.post('/api/db/reset', ...requireAdmin, async (_req, res) => {
    try {
      await store.reset();
      res.json({ ok: true });
    } catch (err) {
      console.error('[POST /api/db/reset]', err);
      res.status(500).json({ error: 'Erreur de réinitialisation' });
    }
  });

  app.get('/api/stats', async (_req, res) => {
    try {
      res.json(await store.stats());
    } catch (err) {
      console.error('[GET /api/stats]', err);
      res.status(500).json({ error: 'Erreur de statistiques' });
    }
  });

  /* ---------------------------------------------------------------- */
  /* Application web (build Vite) — servie par le même processus        */
  /* ---------------------------------------------------------------- */

  const DIST_DIR = staticDir || join(__dirname, '..', 'dist');
  if (existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
    // Fallback SPA : toute route non-API renvoie index.html
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(join(DIST_DIR, 'index.html'));
    });
  }

  return { app, store };
}
