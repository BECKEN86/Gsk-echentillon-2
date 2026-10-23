import React, { useEffect, useState } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { UserAccount } from '../../../types';
import { ALL_SECTIONS, authenticate } from '../../../services/authService';
import {
  getFirstAdminSetupStatus,
  loginRemote,
  setupFirstAdminRemote
} from '../../../services/apiService';
import { generateUniqueId } from '../../../utils/idGenerator';
import { hashPasswordLocal } from '../../../utils/passwordHash';

interface LoginViewProps {
  /** migration : hash sha256 à persister pour un compte legacy connecté en clair */
  onLoginSuccess: (user: UserAccount, migration?: { userId: string; passwordHash: string }) => void;
  /** Annuaire des comptes déjà créés */
  users?: UserAccount[];
  onCreateFirstAdmin: (user: UserAccount, remote: boolean) => void | Promise<void>;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, users = [], onCreateFirstAdmin }) => {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [serverSetupRequired, setServerSetupRequired] = useState<boolean | null>(null);
  const isSetupRequired = serverSetupRequired ?? users.length === 0;

  useEffect(() => {
    let active = true;
    void getFirstAdminSetupStatus().then(required => {
      if (active && required !== null) setServerSetupRequired(required);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (isSetupRequired) {
      if (username.trim().length < 3 || name.trim().length < 2) {
        setErrorMessage('Saisissez un identifiant (3 caractères minimum) et un nom complet.');
        return;
      }
      if (password.length < 8 || password !== passwordConfirmation) {
        setErrorMessage(password.length < 8
          ? 'Le mot de passe doit contenir au moins 8 caractères.'
          : 'Les mots de passe ne correspondent pas.');
        return;
      }
    }
    setIsLoading(true);

    try {
      if (isSetupRequired) {
        const remoteSetup = await setupFirstAdminRemote(username, name, password);
        if (remoteSetup.user) {
          await onCreateFirstAdmin(remoteSetup.user, true);
          onLoginSuccess(remoteSetup.user);
          return;
        }
        if (remoteSetup.setupRequired === false) {
          setServerSetupRequired(false);
          setErrorMessage(remoteSetup.error || 'La configuration initiale est déjà terminée. Connectez-vous.');
          return;
        }
        if (!remoteSetup.offline) {
          setErrorMessage(remoteSetup.error || 'Impossible de créer le compte administrateur.');
          return;
        }

        const passwordHash = await hashPasswordLocal(password);
        const firstAdmin: UserAccount = {
          id: generateUniqueId('usr'),
          username: username.trim(),
          password: passwordHash ? undefined : password,
          passwordHash: passwordHash || undefined,
          name: name.trim(),
          role: 'Administrateur',
          active: true,
          avatarInitials: name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(),
          defaultSection: 'accueil',
          allowedSections: ALL_SECTIONS
        };
        const { password: _password, passwordHash: _passwordHash, ...safeUser } = firstAdmin;
        await onCreateFirstAdmin(firstAdmin, false);
        onLoginSuccess(safeUser);
        return;
      }

      // 1. Serveur local (SQLite) d'abord : c'est lui la source de vérité —
      //    un jeton de session est posé et les données sont gérées par la base,
      //    pas par le cache navigateur.
      const remote = await loginRemote(username, password);
      if (remote.user) {
        onLoginSuccess(remote.user);
        return;
      }
      // Serveur joignable mais identifiants refusés → erreur définitive
      if (!remote.offline && remote.error) {
        setErrorMessage(remote.error);
        return;
      }

      // 2. Serveur injoignable → repli local (annuaire en mémoire/localStorage)
      const localRes = await authenticate(username, password, users);
      if (localRes.success && localRes.user) {
        onLoginSuccess(localRes.user, localRes.migration);
        return;
      }

      setErrorMessage(localRes.error || 'Identifiant ou mot de passe incorrect.');
    } catch (error) {
      console.error('Erreur lors de la configuration ou de la connexion:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Une erreur est survenue.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-[#0A1628]">
      {/* Decorative background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0A1628] via-[#0D2440] to-[#12325A]" />
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md rounded-3xl bg-white p-8 sm:p-10 shadow-2xl shadow-black/40 animate-in fade-in zoom-in-95 duration-300">
        {/* Brand */}
        <div className="flex items-center gap-3.5 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center font-black text-white text-2xl shadow-lg shadow-blue-500/40">
            GS
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">GeStock</h1>
            <p className="text-[11px] text-slate-500 font-semibold tracking-wide">GESTION COMMERCIALE & POS</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {isSetupRequired ? 'Première configuration' : 'Connexion'}
            </h2>
            <p className="text-sm text-slate-500 mt-1.5">
              {isSetupRequired
                ? 'Créez le compte administrateur pour commencer.'
                : 'Accédez à votre espace de travail'}
            </p>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSetupRequired && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Nom complet</label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Votre nom"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Identifiant
              </label>
              <div className="relative group">
                <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <input
                  type="text"
                  required
                  maxLength={64}
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Votre identifiant"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Mot de passe
              </label>
              <div className="relative group">
                <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  maxLength={128}
                  autoComplete={isSetupRequired ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSetupRequired ? '8 caractères minimum' : 'Votre mot de passe'}
                  className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 transition-colors"
                  title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {isSetupRequired && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Confirmer le mot de passe
                </label>
                <input
                  type="password"
                  required
                  maxLength={128}
                  autoComplete="new-password"
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  placeholder="Confirmez le mot de passe"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 active:scale-[0.99] text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/30 transition-all disabled:opacity-70 disabled:active:scale-100 group"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Vérification…</span>
                </>
              ) : (
                <>
                  <span>{isSetupRequired ? 'Créer le compte administrateur' : 'Se connecter'}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
