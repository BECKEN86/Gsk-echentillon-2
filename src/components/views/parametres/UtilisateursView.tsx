import React, { useMemo, useState } from 'react';
import {
  UserCog,
  UserPlus,
  Trash2,
  Search,
  X,
  Shield,
  Briefcase,
  CreditCard,
  Building,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Pencil,
  Power,
  KeyRound
} from 'lucide-react';
import { UserAccount, UserRole, NavSection } from '../../../types';
import { ALL_SECTIONS, DEFAULT_SECTIONS_BY_ROLE, DEFAULT_SECTION_BY_ROLE } from '../../../services/authService';
import { generateUniqueId } from '../../../utils/idGenerator';
import { hashPasswordLocal } from '../../../utils/passwordHash';

interface UtilisateursViewProps {
  users: UserAccount[];
  currentUser?: UserAccount | null;
  onAddUser: (user: UserAccount) => boolean;
  onUpdateUser: (user: UserAccount) => boolean;
  onToggleUserActive: (id: string) => boolean;
  /** newSecret : hash "sha256:..." si Web Crypto disponible, sinon mot de passe en clair */
  onResetUserPassword: (id: string, newSecret: string) => boolean;
  onDeleteUser: (id: string) => boolean;
}

const SECTION_LABELS: Record<NavSection, string> = {
  'accueil': 'Tableau de bord',
  'inventaire-approvisionnement': 'Approvisionnement',
  'inventaire-magasins': 'Magasins & Rayons',
  'inventaire-produits': 'Catalogue Produits',
  'inventaire-physique': 'Inventaires physiques & Écarts',
  'inventaire-ajustement': 'Ajustement de produits',
  'inventaire-valorisation': 'Valorisation du stock',
  'inventaire-transferts': 'Transferts inter-dépôts',
  'inventaire-pertes-avaries': 'Pertes, casses & avaries',
  'inventaire-peremption': 'Alertes de péremption',
  'acteurs-clients': 'Clients & Crédits',
  'acteurs-fournisseurs': 'Fournisseurs',
  'achat-demande-prix': 'Demande de prix',
  'achat-bon-commande': 'Bons de Commande',
  'achat-reception': 'Réceptions Marchandises',
  'achat-retours': 'Retours fournisseurs',
  'vente-pos': 'Caisse POS',
  'vente-sessions': 'Points de Vente',
  'vente-commande': 'Commandes Clients',
  'vente-retours': 'Retours clients',
  'finance-recettes-depenses': 'Recettes et Dépenses',
  'finance-marges-resultat': 'Marges & Résultat',
  'finance-tresorerie-caisses': 'Caisses & Trésorerie',
  'parametres-utilisateurs': 'Utilisateurs',
  'parametres-configuration': 'Configuration Société',
  'parametres-import': 'Importer une base de données',
  'parametres-export': 'Savegarder (Export Excel)',
  'parametres-audit': 'Journal d\'Audit',
  'guide-utilisateur': 'Guide Utilisateur (PDF)'
};

const ROLE_META: Record<UserRole, { color: string; icon: React.ReactNode }> = {
  'Administrateur': { color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: <Shield className="w-3.5 h-3.5" /> },
  'Gérant': { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: <Briefcase className="w-3.5 h-3.5" /> },
  'Caissier': { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CreditCard className="w-3.5 h-3.5" /> },
  'Responsable Agence': { color: 'bg-purple-50 text-purple-700 border-purple-200', icon: <Building className="w-3.5 h-3.5" /> }
};

const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

export const UtilisateursView: React.FC<UtilisateursViewProps> = ({
  users,
  currentUser,
  onAddUser,
  onUpdateUser,
  onToggleUserActive,
  onResetUserPassword,
  onDeleteUser
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [resetTarget, setResetTarget] = useState<UserAccount | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [userToDelete, setUserToDelete] = useState<UserAccount | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Create form state
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formRole, setFormRole] = useState<UserRole>('Caissier');
  const [formEmail, setFormEmail] = useState('');
  const [formSections, setFormSections] = useState<NavSection[]>(DEFAULT_SECTIONS_BY_ROLE['Caissier']);

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }, [users, searchTerm]);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormUsername('');
    setFormPassword('');
    setFormRole('Caissier');
    setFormEmail('');
    setFormSections(DEFAULT_SECTIONS_BY_ROLE['Caissier']);
    setFormError(null);
    setIsCreateOpen(true);
  };

  const openEditModal = (u: UserAccount) => {
    setEditingUser(u);
    setFormName(u.name);
    setFormUsername(u.username);
    setFormPassword('');
    setFormRole(u.role);
    setFormEmail(u.email || '');
    setFormSections(u.allowedSections);
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleRoleChange = (role: UserRole) => {
    setFormRole(role);
    setFormSections(DEFAULT_SECTIONS_BY_ROLE[role]);
  };

  const toggleSection = (section: NavSection) => {
    setFormSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const username = formUsername.trim();
    const name = formName.trim();

    if (!name) return setFormError('Le nom complet est requis.');
    if (!/^[a-zA-Z0-9._-]{3,}$/.test(username)) {
      return setFormError("L'identifiant doit contenir au moins 3 caractères (lettres, chiffres, . _ -).");
    }
    if (users.some(u => u.username.toLowerCase() === username.toLowerCase() && u.id !== editingUser?.id)) {
      return setFormError('Cet identifiant est déjà utilisé.');
    }
    if (!editingUser && formPassword.length < 6) {
      return setFormError('Le mot de passe doit contenir au moins 6 caractères.');
    }
    if (formEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail)) {
      return setFormError("L'adresse email est invalide.");
    }
    if (formSections.length === 0) {
      return setFormError('Sélectionnez au moins un module autorisé.');
    }

    if (editingUser) {
      const updated: UserAccount = {
        ...editingUser,
        name,
        role: formRole,
        email: formEmail.trim() || undefined,
        avatarInitials: initialsOf(name),
        defaultSection: formSections.includes(DEFAULT_SECTION_BY_ROLE[formRole])
          ? DEFAULT_SECTION_BY_ROLE[formRole]
          : formSections[0],
        allowedSections: formSections
      };
      if (onUpdateUser(updated)) {
        setIsCreateOpen(false);
        setFeedback({ type: 'success', text: `Compte "${username}" mis à jour.` });
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFormError('La mise à jour a été refusée.');
      }
      return;
    }

    // Hash sha256 salé quand Web Crypto est disponible ; sinon clair legacy
    const passwordHash = await hashPasswordLocal(formPassword);
    const newUser: UserAccount = {
      id: generateUniqueId('usr'),
      username,
      password: passwordHash ? undefined : formPassword,
      passwordHash: passwordHash || undefined,
      active: true,
      name,
      role: formRole,
      email: formEmail.trim() || undefined,
      avatarInitials: initialsOf(name),
      defaultSection: formSections.includes(DEFAULT_SECTION_BY_ROLE[formRole])
        ? DEFAULT_SECTION_BY_ROLE[formRole]
        : formSections[0],
      allowedSections: formSections
    };

    if (onAddUser(newUser)) {
      setIsCreateOpen(false);
      setFeedback({ type: 'success', text: `Compte "${username}" créé avec succès.` });
      setTimeout(() => setFeedback(null), 4000);
    } else {
      setFormError('La création du compte a été refusée.');
    }
  };

  const confirmResetPassword = async () => {
    if (!resetTarget) return;
    if (resetPassword.length < 6) {
      setFeedback({ type: 'error', text: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
      return;
    }
    const secret = (await hashPasswordLocal(resetPassword)) || resetPassword;
    if (onResetUserPassword(resetTarget.id, secret)) {
      setFeedback({ type: 'success', text: `Mot de passe de "${resetTarget.username}" réinitialisé.` });
      setTimeout(() => setFeedback(null), 4000);
    }
    setResetTarget(null);
    setResetPassword('');
  };

  const confirmDelete = () => {
    if (!userToDelete) return;
    if (onDeleteUser(userToDelete.id)) {
      setFeedback({ type: 'success', text: `Compte "${userToDelete.username}" supprimé.` });
      setTimeout(() => setFeedback(null), 4000);
    }
    setUserToDelete(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">
              <UserCog className="w-5 h-5 text-slate-700" />
            </div>
            Utilisateurs
          </h1>
          <p className="text-xs text-slate-500 mt-1.5">
            {users.length} compte{users.length > 1 ? 's' : ''} enregistré{users.length > 1 ? 's' : ''} — gestion des accès par rôle
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#001F3F] hover:bg-blue-900 text-white text-xs font-bold shadow-sm transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Nouvel utilisateur
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success'
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span className="font-medium">{feedback.text}</span>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Rechercher un utilisateur…"
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:border-blue-500 focus:outline-none shadow-2xs"
        />
      </div>

      {/* Users table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="px-4 py-3 font-bold">Utilisateur</th>
                <th className="px-4 py-3 font-bold">Identifiant</th>
                <th className="px-4 py-3 font-bold">Rôle</th>
                <th className="px-4 py-3 font-bold">Statut</th>
                <th className="px-4 py-3 font-bold">Email</th>
                <th className="px-4 py-3 font-bold">Accès</th>
                <th className="px-4 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => {
                  const meta = ROLE_META[u.role] || ROLE_META['Caissier'];
                  const isSelf = currentUser?.id === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#001F3F] to-blue-800 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                            {u.avatarInitials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 truncate">{u.name}</div>
                            {isSelf && <div className="text-[10px] text-blue-600 font-semibold">Vous</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">{u.username}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border font-semibold text-[10px] ${meta.color}`}>
                          {meta.icon}
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          u.active === false
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {u.active === false ? 'Désactivé' : 'Actif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{u.email || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {u.role === 'Administrateur' || u.role === 'Gérant'
                          ? 'Accès complet'
                          : `${u.allowedSections.length} module${u.allowedSections.length > 1 ? 's' : ''}`}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            title="Modifier"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setResetTarget(u); setResetPassword(''); }}
                            title="Réinitialiser le mot de passe"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleUserActive(u.id)}
                            disabled={isSelf}
                            title={isSelf ? 'Impossible sur votre propre compte' : u.active === false ? 'Réactiver' : 'Désactiver'}
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 ${
                              u.active === false
                                ? 'text-emerald-500 hover:bg-emerald-50'
                                : 'text-slate-400 hover:text-orange-600 hover:bg-orange-50'
                            }`}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setUserToDelete(u)}
                            disabled={isSelf}
                            title={isSelf ? 'Vous ne pouvez pas supprimer votre propre compte' : 'Supprimer'}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-3xl shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-sm font-black text-[#001F3F] flex items-center gap-2">
                {editingUser
                  ? <><Pencil className="w-4 h-4 text-blue-600" /> Modifier "{editingUser.username}"</>
                  : <><UserPlus className="w-4 h-4 text-blue-600" /> Créer un compte utilisateur</>}
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="font-medium">{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Nom complet *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="Ex : Fatou Bamba"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Identifiant *
                  </label>
                  <input
                    type="text"
                    value={formUsername}
                    onChange={e => setFormUsername(e.target.value)}
                    placeholder="Ex : fbamba"
                    autoComplete="off"
                    disabled={!!editingUser}
                    title={editingUser ? "L'identifiant n'est pas modifiable" : undefined}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-500 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
                {!editingUser && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Mot de passe *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formPassword}
                      onChange={e => setFormPassword(e.target.value)}
                      placeholder="Min. 6 caractères"
                      autoComplete="new-password"
                      className="w-full px-3 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                )}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    placeholder="utilisateur@entreprise.ci"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Rôle *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.keys(ROLE_META) as UserRole[]).map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleRoleChange(role)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        formRole === role
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                          : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-slate-700">
                        {ROLE_META[role].icon}
                        <span className="text-[10px] font-bold leading-tight">{role}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Modules autorisés *
                  </label>
                  <span className="text-[10px] text-slate-400">{formSections.length} sélectionné(s)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  {ALL_SECTIONS.map(section => (
                    <label
                      key={section}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer text-xs text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={formSections.includes(section)}
                        onChange={() => toggleSection(section)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="truncate">{SECTION_LABELS[section]}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs"
                >
                  {editingUser ? 'Enregistrer' : 'Créer le compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-sm shadow-xl p-5 space-y-4">
            <h3 className="text-sm font-black text-[#001F3F] flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-600" />
              Réinitialiser le mot de passe
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Nouveau mot de passe pour <strong>{resetTarget.name}</strong> (
              <span className="font-mono">{resetTarget.username}</span>) :
            </p>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={resetPassword}
                onChange={e => setResetPassword(e.target.value)}
                placeholder="Min. 6 caractères"
                autoComplete="new-password"
                autoFocus
                className="w-full px-3 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setResetTarget(null); setResetPassword(''); }}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmResetPassword}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-sm shadow-xl p-5 space-y-4">
            <h3 className="text-sm font-black text-[#001F3F]">Supprimer le compte ?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Le compte <strong>{userToDelete.name}</strong> (<span className="font-mono">{userToDelete.username}</span>)
              sera définitivement supprimé. Cette action est irréversible.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
