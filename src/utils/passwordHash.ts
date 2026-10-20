/**
 * Hachage de mot de passe côté client (annuaire local / mode dégradé).
 *
 * Format : "sha256:<saltHex>:<hashHex>" où hash = SHA-256(`${salt}:${password}`).
 * Le serveur (server/auth.mjs) vérifie le même format : les comptes créés
 * localement restent authentifiables après synchronisation de la base.
 * Les hash "scrypt:<salt>:<hash>" (format serveur) ne sont pas vérifiables
 * en local — la connexion exige alors le serveur.
 */

const SHA256_PREFIX = 'sha256:';
const SCRYPT_PREFIX = 'scrypt:';

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function subtle(): SubtleCrypto | null {
  return typeof crypto !== 'undefined' && crypto.subtle ? crypto.subtle : null;
}

/** true si le mot de passe stocké est déjà haché (sha256 local ou scrypt serveur). */
export function isPasswordHashed(stored?: string): boolean {
  return !!stored && (stored.startsWith(SHA256_PREFIX) || stored.startsWith(SCRYPT_PREFIX));
}

/**
 * Hash un mot de passe en sha256 salé.
 * Retourne '' si Web Crypto est indisponible (contexte non sécurisé) :
 * l'appelant conserve alors le mot de passe en clair (comportement legacy).
 */
export async function hashPasswordLocal(password: string): Promise<string> {
  const s = subtle();
  if (!s) return '';
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = toHex(saltBytes.buffer as ArrayBuffer);
  const digest = await s.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`));
  return `${SHA256_PREFIX}${salt}:${toHex(digest)}`;
}

/**
 * Vérifie un mot de passe contre la valeur stockée.
 * Supporte : "sha256:salt:hash" (local), "scrypt:..." (serveur → toujours faux en local),
 * et le clair legacy (comptes non migrés).
 */
export async function verifyPasswordLocal(password: string, stored?: string): Promise<boolean> {
  if (!stored) return false;
  if (stored.startsWith(SCRYPT_PREFIX)) return false; // non vérifiable sans serveur
  if (stored.startsWith(SHA256_PREFIX)) {
    const [, salt, hex] = stored.split(':');
    const s = subtle();
    if (!salt || !hex || !s) return false;
    const digest = await s.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`));
    return toHex(digest) === hex;
  }
  return stored === password; // legacy : mot de passe en clair
}
