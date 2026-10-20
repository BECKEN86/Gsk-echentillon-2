import { AppDatabase } from './storageService';
import { UserAccount } from '../types';

/**
 * Couche d'accès au serveur GeStock (Express → SQLite / Supabase REST).
 *
 * - Authentification par token Bearer (session serveur, hash scrypt)
 * - Synchronisation par entité : seules les lignes modifiées sont envoyées
 *   (plus de PUT de la base complète → pas d'écrasement multi-postes)
 * - Polling du compteur de révision : les changements faits par un autre
 *   poste sont rechargés automatiquement
 * - Mode dégradé : si le serveur est injoignable, l'app reste sur localStorage
 */

// Le serveur Express sert aussi le frontend sur la même origine
// (application Electron → http://127.0.0.1:<port>, `npm start` → :8787,
// `npm run dev` → proxy Vite /api) : l'API locale est joignable sans
// configuration. Aucun serveur distant n'est supporté.
const API_BASE: string =
  typeof window !== 'undefined' && /^https?:\/\//.test(window.location.origin)
    ? `${window.location.origin}/api`
    : '';

/**
 * Sonde une fois /health : si l'origine n'héberge pas le backend
 * (page ouverte en statique), l'app repasse en mode local (localStorage).
 */
let probePromise: Promise<boolean> | null = null;
function ensureApiReachable(): Promise<boolean> {
  if (!API_BASE) return Promise.resolve(false);
  if (!probePromise) {
    probePromise = (async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
        clearTimeout(timer);
        const data = await res.json().catch(() => null);
        return res.ok && data?.ok === true;
      } catch {
        return false;
      }
    })();
  }
  return probePromise;
}

export const isRemoteApiConfigured = (): boolean => Boolean(API_BASE);
const FETCH_TIMEOUT_MS = 5000;
const SAVE_DEBOUNCE_MS = 600;
const REV_POLL_MS = 10000;
const TOKEN_KEY = 'gestock_session_token';

const COLLECTION_KEYS: (keyof AppDatabase)[] = [
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
  'auditLogs',
  'valuations',
  'physicalInventories',
  'stockAdjustments',
  'stockTransfers',
  'stockLosses',
  'customerReturns',
  'supplierReturns'
];

let remoteUp: boolean | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingDb: AppDatabase | null = null;
/** Dernière version connue du serveur (évite de se resynchroniser sur ses propres écritures) */
let lastRev = 0;
/** Instantané de ce qui a été envoyé au serveur — base du diff */
let lastSynced: AppDatabase | null = null;
let syncInFlight = false;

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setSessionToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* stockage indisponible */
  }
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response | null> {
  if (!API_BASE || !(await ensureApiReachable())) {
    remoteUp = false;
    return null;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const token = getSessionToken();
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers
      }
    });
    clearTimeout(timer);
    if (res.status >= 500) {
      remoteUp = false;
      return null;
    }
    remoteUp = true;
    return res;
  } catch {
    remoteUp = false;
    return null;
  }
}

export function isRemoteDatabaseOnline(): boolean | null {
  if (!API_BASE) return false;
  return remoteUp;
}

/* ------------------------------------------------------------------ */
/* Authentification                                                    */
/* ------------------------------------------------------------------ */

export interface LoginResult {
  user?: UserAccount;
  error?: string;
  /** true si le serveur est injoignable — le caller peut basculer en mode dégradé */
  offline?: boolean;
}

export async function loginRemote(username: string, password: string): Promise<LoginResult> {
  const res = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  if (!res) return { offline: true, error: 'Serveur injoignable — mode local.' };
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error || 'Connexion refusée.' };
  setSessionToken(data.token);
  lastSynced = null; // force un rescan complet au premier persist
  return { user: data.user as UserAccount };
}

export async function logoutRemote(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' });
  setSessionToken(null);
  lastSynced = null;
}

/** Restaure la session serveur à partir du token stocké. */
export async function fetchCurrentUser(): Promise<UserAccount | null> {
  if (!getSessionToken()) return null;
  const res = await apiFetch('/auth/me');
  if (!res || !res.ok) {
    if (res && res.status === 401) setSessionToken(null);
    return null;
  }
  const data = await res.json().catch(() => null);
  return (data?.user as UserAccount) || null;
}

/* ------------------------------------------------------------------ */
/* Lecture                                                             */
/* ------------------------------------------------------------------ */

export async function loadRemoteDatabase(): Promise<AppDatabase | null> {
  if (!API_BASE) return null;
  const res = await apiFetch('/db');
  if (!res || !res.ok) return null;
  try {
    const db = (await res.json()) as AppDatabase | null;
    if (db) {
      lastSynced = db;
      const revRes = await apiFetch('/rev');
      if (revRes?.ok) lastRev = (await revRes.json()).rev || 0;
    }
    return db;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Écriture — diff par entité                                          */
/* ------------------------------------------------------------------ */

const entityKey = (e: any): string => String(e?.id || e?.code || '');

async function syncDiff(db: AppDatabase): Promise<void> {
  if (syncInFlight) {
    pendingDb = db; // une nouvelle version est arrivée pendant la sync
    return;
  }
  syncInFlight = true;
  try {
    const prev = lastSynced;
    const ops: Promise<Response | null>[] = [];

    for (const key of COLLECTION_KEYS) {
      const current = ((db[key] as any[]) || []).filter(e => entityKey(e));
      if (!Array.isArray(db[key])) continue;
      const prevMap = new Map<string, any>(
        ((prev?.[key] as any[]) || []).map(e => [entityKey(e), e])
      );
      const currIds = new Set(current.map(entityKey));

      for (const entity of current) {
        const id = entityKey(entity);
        const before = prevMap.get(id);
        if (!before || JSON.stringify(before) !== JSON.stringify(entity)) {
          ops.push(
            apiFetch(`/db/${key}/${encodeURIComponent(id)}`, {
              method: 'PUT',
              body: JSON.stringify(entity)
            })
          );
        }
      }
      if (prev) {
        for (const [id] of prevMap) {
          if (!currIds.has(id)) {
            ops.push(apiFetch(`/db/${key}/${encodeURIComponent(id)}`, { method: 'DELETE' }));
          }
        }
      }
    }

    const metaChanged =
      !prev ||
      JSON.stringify(prev.counters) !== JSON.stringify(db.counters) ||
      JSON.stringify(prev.companyConfig) !== JSON.stringify(db.companyConfig);
    if (metaChanged) {
      ops.push(
        apiFetch('/meta', {
          method: 'PUT',
          body: JSON.stringify({
            counters: db.counters,
            companyConfig: db.companyConfig,
            lastUpdated: db.lastUpdated
          })
        })
      );
    }

    if (ops.length === 0) return;

    const results = await Promise.all(ops);
    for (const r of results) {
      if (r?.ok) {
        const data = await r.json().catch(() => null);
        if (data?.rev && data.rev > lastRev) lastRev = data.rev;
      } else if (r && r.status === 401) {
        setSessionToken(null); // session expirée → prochaine action redemandera la connexion
      }
    }
    lastSynced = db;
  } finally {
    syncInFlight = false;
    if (pendingDb) {
      const next = pendingDb;
      pendingDb = null;
      void syncDiff(next);
    }
  }
}

/** Persiste la base (débouncé). Seules les entités modifiées sont envoyées. */
export function persistRemoteDatabase(db: AppDatabase): void {
  if (!API_BASE || !getSessionToken()) return; // pas d'API ou pas de session serveur → localStorage seul
  pendingDb = db;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const toSend = pendingDb;
    pendingDb = null;
    if (toSend) void syncDiff(toSend);
  }, SAVE_DEBOUNCE_MS);
}

/** Remplacement complet (import/restauration) — réservé aux cas exceptionnels. */
export async function pushFullDatabase(db: AppDatabase): Promise<boolean> {
  if (!API_BASE) return false;
  const res = await apiFetch('/db', {
    method: 'PUT',
    body: JSON.stringify(db)
  });
  if (res?.ok) {
    lastSynced = db;
    const data = await res.json().catch(() => null);
    if (data?.rev) lastRev = data.rev;
    return true;
  }
  return false;
}

export async function resetRemoteDatabase(): Promise<boolean> {
  if (!API_BASE) return false;
  const res = await apiFetch('/db/reset', { method: 'POST' });
  return !!res && res.ok;
}

/* ------------------------------------------------------------------ */
/* Synchronisation entrante (autres postes)                            */
/* ------------------------------------------------------------------ */

/**
 * Interroge le compteur de révision toutes les ~10 s. Si un autre poste a
 * modifié la base, onRecharge reçoit la version fraîche. Retourne un stopper.
 */
export function startRemoteWatcher(onRemoteDb: (db: AppDatabase) => void): () => void {
  if (!API_BASE) return () => {};
  const timer = setInterval(async () => {
    if (!getSessionToken() || pendingDb || syncInFlight) return;
    const res = await apiFetch('/rev');
    if (!res?.ok) return;
    const { rev } = await res.json().catch(() => ({ rev: lastRev }));
    if (typeof rev === 'number' && rev !== lastRev) {
      const db = await loadRemoteDatabase(); // met aussi à jour lastRev + lastSynced
      if (db) onRemoteDb(db);
    }
  }, REV_POLL_MS);
  return () => clearInterval(timer);
}
