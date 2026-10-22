/**
 * Couche de persistance GeStock — SQLite local uniquement (node:sqlite,
 * natif Node 24+). Aucun serveur distant : toutes les données restent sur
 * le poste dans gestock.db.
 *
 * Schéma :
 *   documents(collection TEXT, id TEXT, data JSON)  — entités métier
 *   meta(key TEXT, value TEXT)                      — version, compteurs, config société
 */

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

// NB : doit refléter COLLECTION_KEYS de src/services/storageService.ts (+ 'sessions')
export const COLLECTIONS = [
  'products',
  'categories',
  'movements',
  'clients',
  'suppliers',
  'inquiries',
  'purchaseOrders',
  'receptions',
  'approvisionnements',
  'storageSites',
  'saleOrders',
  'pointsDeVente',
  'transactions',
  'treasuryAccounts',
  'treasuryMovements',
  'users',
  'sessions',
  'auditLogs',
  'valuations',
  'physicalInventories',
  'stockAdjustments',
  'stockTransfers',
  'stockLosses',
  'customerReturns',
  'supplierReturns'
];

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function createStore() {
  const { DatabaseSync } = await import('node:sqlite');

  // GESTOCK_DATA_DIR : dossier de données imposé (ex. %APPDATA%\GeStock en mode desktop)
  const DATA_DIR = process.env.GESTOCK_DATA_DIR || join(__dirname, 'data');
  mkdirSync(DATA_DIR, { recursive: true });
  const DB_PATH = join(DATA_DIR, 'gestock.db');

  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS documents (
      collection TEXT NOT NULL,
      id         TEXT NOT NULL,
      data       TEXT NOT NULL,
      PRIMARY KEY (collection, id)
    );
    CREATE INDEX IF NOT EXISTS idx_documents_collection ON documents (collection);
  `);

  const bumpRev = () => {
    db.prepare(`INSERT INTO meta (key, value) VALUES ('rev', '1')
      ON CONFLICT (key) DO UPDATE SET value = CAST(CAST(meta.value AS INTEGER) + 1 AS TEXT)`).run();
  };

  return {
    engine: `SQLite (${DB_PATH})`,

    async load() {
      const rows = db.prepare('SELECT collection, data FROM documents').all();
      if (rows.length === 0) return null;

      const result = { version: 1, lastUpdated: null, counters: {}, companyConfig: null };
      for (const key of COLLECTIONS) result[key] = [];
      for (const row of rows) {
        if (COLLECTIONS.includes(row.collection)) {
          result[row.collection].push(JSON.parse(row.data));
        }
      }
      for (const m of db.prepare('SELECT key, value FROM meta').all()) {
        if (m.key === 'counters') result.counters = JSON.parse(m.value);
        else if (m.key === 'companyConfig') result.companyConfig = JSON.parse(m.value);
        else if (m.key === 'lastUpdated') result.lastUpdated = m.value;
        else if (m.key === 'version') result.version = Number(m.value) || 1;
      }
      return result;
    },

    async save(payload) {
      const insert = db.prepare(
        'INSERT OR REPLACE INTO documents (collection, id, data) VALUES (?, ?, ?)'
      );
      const setMeta = db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)');

      let total = 0;
      db.exec('BEGIN');
      try {
        db.exec('DELETE FROM documents');
        for (const key of COLLECTIONS) {
          for (const entity of Array.isArray(payload[key]) ? payload[key] : []) {
            insert.run(key, String(entity.id || entity.code || randomUUID()), JSON.stringify(entity));
            total++;
          }
        }
        setMeta.run('version', String(payload.version || 1));
        setMeta.run('lastUpdated', String(payload.lastUpdated || new Date().toISOString()));
        setMeta.run('counters', JSON.stringify(payload.counters || {}));
        setMeta.run('companyConfig', JSON.stringify(payload.companyConfig || null));
        bumpRev();
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
      return total;
    },

    async upsert(collection, id, data) {
      if (!COLLECTIONS.includes(collection)) throw new Error(`Collection inconnue : ${collection}`);
      if (collection === 'pointsDeVente') {
        const currentRow = db.prepare(
          'SELECT data FROM documents WHERE collection = ? AND id = ?'
        ).get(collection, String(id));
        if (currentRow) {
          const current = JSON.parse(currentRow.data);
          if (data.status === 'En cours') {
            data = current.occupiedBy
              ? { ...data, occupiedBy: current.occupiedBy }
              : Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'occupiedBy'));
          } else {
            data = Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'occupiedBy'));
          }
        }
      }
      db.prepare('INSERT OR REPLACE INTO documents (collection, id, data) VALUES (?, ?, ?)')
        .run(collection, String(id), JSON.stringify(data));
      bumpRev();
    },

    async claimCashRegister(id, userId) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const row = db.prepare(
          'SELECT data FROM documents WHERE collection = ? AND id = ?'
        ).get('pointsDeVente', String(id));
        if (!row) {
          db.exec('ROLLBACK');
          return { ok: false, error: 'Caisse introuvable.' };
        }

        const session = JSON.parse(row.data);
        if (session.status !== 'En cours') {
          db.exec('ROLLBACK');
          return { ok: false, error: 'Cette caisse n’est pas ouverte.' };
        }
        if (session.occupiedBy && session.occupiedBy !== userId) {
          db.exec('ROLLBACK');
          return { ok: false, error: 'Cette caisse est déjà utilisée par un autre caissier.' };
        }

        const claimed = { ...session, occupiedBy: userId };
        db.prepare(
          'UPDATE documents SET data = ? WHERE collection = ? AND id = ?'
        ).run(JSON.stringify(claimed), 'pointsDeVente', String(id));
        bumpRev();
        db.exec('COMMIT');
        return { ok: true, session: claimed };
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },

    async releaseCashRegister(id, userId) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const row = db.prepare(
          'SELECT data FROM documents WHERE collection = ? AND id = ?'
        ).get('pointsDeVente', String(id));
        if (!row) {
          db.exec('COMMIT');
          return { ok: true };
        }

        const session = JSON.parse(row.data);
        if (session.occupiedBy !== userId) {
          db.exec('COMMIT');
          return { ok: false, error: 'Cette caisse est réservée à un autre utilisateur.' };
        }

        const { occupiedBy: _occupiedBy, ...released } = session;
        db.prepare(
          'UPDATE documents SET data = ? WHERE collection = ? AND id = ?'
        ).run(JSON.stringify(released), 'pointsDeVente', String(id));
        bumpRev();
        db.exec('COMMIT');
        return { ok: true };
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },

    async remove(collection, id) {
      db.prepare('DELETE FROM documents WHERE collection = ? AND id = ?')
        .run(collection, String(id));
      bumpRev();
    },

    async setMeta(key, value) {
      db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(key, value);
      bumpRev();
    },

    async getRev() {
      const row = db.prepare("SELECT value FROM meta WHERE key = 'rev'").get();
      return row ? Number(row.value) || 0 : 0;
    },

    async reset() {
      db.exec('BEGIN');
      try {
        db.exec('DELETE FROM documents');
        db.exec('DELETE FROM meta');
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },

    async stats() {
      const rows = db
        .prepare('SELECT collection, COUNT(*) AS n FROM documents GROUP BY collection')
        .all();
      const counts = {};
      for (const r of rows) counts[r.collection] = r.n;
      return { counts, path: DB_PATH };
    },

    close() {
      db.close();
    }
  };
}
