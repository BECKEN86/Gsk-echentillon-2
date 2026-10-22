import { UserAccount, UserRole, NavSection } from '../types';
import { hashPasswordLocal, verifyPasswordLocal } from '../utils/passwordHash';

export const ALL_SECTIONS: NavSection[] = [
  'accueil',
  'inventaire-approvisionnement',
  'inventaire-magasins',
  'inventaire-produits',
  'inventaire-physique',
  'inventaire-ajustement',
  'inventaire-valorisation',
  'inventaire-transferts',
  'inventaire-pertes-avaries',
  'inventaire-peremption',
  'acteurs-clients',
  'acteurs-fournisseurs',
  'achat-demande-prix',
  'achat-bon-commande',
  'achat-reception',
  'achat-retours',
  'vente-pos',
  'vente-sessions',
  'vente-commande',
  'vente-retours',
  'finance-recettes-depenses',
  'finance-marges-resultat',
  'finance-tresorerie-caisses',
  'parametres-utilisateurs',
  'parametres-configuration',
  'parametres-import',
  'parametres-export',
  'parametres-audit',
  'guide-utilisateur'
];

/** Sections autorisées par défaut selon le rôle (modifiables par utilisateur). */
export const DEFAULT_SECTIONS_BY_ROLE: Record<UserRole, NavSection[]> = {
  'Administrateur': ALL_SECTIONS,
  'Gérant': ALL_SECTIONS,
  'Caissier': ['vente-pos', 'guide-utilisateur'],
  'Responsable Agence': [
    'vente-sessions',
    'vente-pos',
    'vente-commande',
    'vente-retours',
    'inventaire-produits',
    'inventaire-approvisionnement',
    'inventaire-magasins',
    'inventaire-physique',
    'inventaire-ajustement',
    'inventaire-valorisation',
    'inventaire-transferts',
    'inventaire-pertes-avaries',
    'inventaire-peremption',
    'acteurs-clients',
    'acteurs-fournisseurs',
    'achat-retours',
    'finance-tresorerie-caisses',
    'guide-utilisateur'
  ]
};

/** Section affichée par défaut à la connexion selon le rôle. */
export const DEFAULT_SECTION_BY_ROLE: Record<UserRole, NavSection> = {
  'Administrateur': 'accueil',
  'Gérant': 'finance-marges-resultat',
  'Caissier': 'vente-pos',
  'Responsable Agence': 'vente-sessions'
};

const AUTH_STORAGE_KEY = 'gestock_current_user_v1';

export function getStoredUser(directory: UserAccount[] = []): UserAccount | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as UserAccount;
    // ensure allowedSections is up to date with the matching account in the directory
    const matched = directory.find(u => u.username === user.username);
    const merged: UserAccount = matched
      ? {
          ...matched,
          ...user,
          allowedSections: matched.allowedSections,
          defaultSection: matched.defaultSection
        }
      : user;
    // never expose the password in the session object
    const { password: _pw, passwordHash: _ph, ...safe } = merged;
    return safe;
  } catch (error) {
    console.error('Erreur lecture session utilisateur:', error);
    return null;
  }
}

export function saveStoredUser(user: UserAccount | null): void {
  if (typeof window === 'undefined') return;
  try {
    // Quand une session serveur (SQLite) est active, l'utilisateur est
    // restauré via le token Bearer — pas de copie dans le cache navigateur.
    if (localStorage.getItem('gestock_session_token')) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return;
    }
    if (!user) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } else {
      const { password: _pw, passwordHash: _ph, ...safe } = user;
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(safe));
    }
  } catch (error) {
    console.error('Erreur sauvegarde session utilisateur:', error);
  }
}

export interface AuthResult {
  success: boolean;
  user?: UserAccount;
  error?: string;
  /**
   * Migration douce : le compte s'est connecté avec un mot de passe en clair
   * — le hash sha256 à persister à la place (l'appelant met à jour l'annuaire).
   */
  migration?: { userId: string; passwordHash: string };
}

export async function authenticate(username: string, password: string, directory: UserAccount[] = []): Promise<AuthResult> {
  const cleanUsername = username.trim().toLowerCase();
  const found = directory.find(u => u.username.toLowerCase() === cleanUsername);

  if (!found) {
    return { success: false, error: 'Identifiant introuvable. Veuillez vérifier votre saisie.' };
  }

  if (found.active === false) {
    return { success: false, error: 'Ce compte a été désactivé. Contactez un administrateur.' };
  }

  // Compte haché : sha256 vérifiable localement ; scrypt exige le serveur
  if (found.passwordHash) {
    const ok = await verifyPasswordLocal(password, found.passwordHash);
    if (!ok) {
      const needsServer = found.passwordHash.startsWith('scrypt:');
      return {
        success: false,
        error: needsServer
          ? 'Ce compte exige le serveur pour se connecter (hash serveur).'
          : 'Mot de passe incorrect.'
      };
    }
    const { password: _pw, passwordHash: _ph, ...safeUser } = found;
    saveStoredUser(safeUser);
    return { success: true, user: safeUser };
  }

  // Compte legacy en clair : vérification directe puis migration vers sha256
  if (!found.password || found.password !== password) {
    return { success: false, error: 'Mot de passe incorrect.' };
  }

  const { password: _pw, passwordHash: _ph, ...safeUser } = found;
  saveStoredUser(safeUser);

  const newHash = await hashPasswordLocal(password);
  return {
    success: true,
    user: safeUser,
    migration: newHash ? { userId: found.id, passwordHash: newHash } : undefined
  };
}

export function isSectionAllowedForUser(user: UserAccount | null, section: NavSection): boolean {
  if (!user) return false;
  if (user.role === 'Administrateur' || user.role === 'Gérant') return true;
  return user.allowedSections.includes(section);
}

/**
 * Opérations sensibles sur le stock (validations, annulations, déstockages,
 * contre-passations) : refusées au rôle Caissier — un caissier vend, il ne
 * régularise pas l'inventaire. Vérifié dans les handlers, indépendamment de l'UI.
 */
export function canManageStockOperations(user: UserAccount | null): boolean {
  if (!user) return true;
  return user.role !== 'Caissier';
}
