import React, { useState, useRef, useEffect } from 'react';
import { 
  Menu, 
  Store,
  ChevronRight, 
  LogOut,
  ChevronDown,
  User
} from 'lucide-react';
import { NavSection, PointDeVente, UserAccount } from '../types';

export type SyncStatus = 'online' | 'offline' | 'local';

interface HeaderProps {
  currentSection: NavSection;
  onOpenMobileSidebar: () => void;
  onSelectSection: (section: NavSection) => void;
  lowStockCount: number;
  onOpenTechSpec: () => void;
  activePointDeVente?: PointDeVente;
  onOpenDatabaseManager?: () => void;
  currentUser?: UserAccount | null;
  onLogout?: () => void;
  syncStatus?: SyncStatus;
  onOpenProfile?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentSection,
  onOpenMobileSidebar,
  onSelectSection,
  lowStockCount,
  onOpenTechSpec,
  activePointDeVente,
  onOpenDatabaseManager,
  currentUser,
  onLogout,
  syncStatus = 'local',
  onOpenProfile
}) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const getBreadcrumb = (section: NavSection) => {
    switch (section) {
      case 'accueil':
        return { category: 'Tableau de bord', title: 'Accueil' };
      case 'inventaire-approvisionnement':
        return { category: 'Inventaire', title: 'Approvisionnement' };
      case 'inventaire-produits':
        return { category: 'Inventaire', title: 'Produits' };
      case 'inventaire-physique':
        return { category: 'Inventaire', title: 'Inventaires physiques & Écarts' };
      case 'inventaire-ajustement':
        return { category: 'Inventaire', title: 'Ajustement de produits' };
      case 'inventaire-valorisation':
        return { category: 'Inventaire', title: 'Valorisation du stock' };
      case 'inventaire-transferts':
        return { category: 'Inventaire', title: 'Transferts inter-dépôts' };
      case 'inventaire-pertes-avaries':
        return { category: 'Inventaire', title: 'Pertes, casses & avaries' };
      case 'inventaire-peremption':
        return { category: 'Inventaire', title: 'Alertes de péremption' };
      case 'acteurs-clients':
        return { category: 'Acteurs commercial', title: 'Clients' };
      case 'acteurs-fournisseurs':
        return { category: 'Acteurs commercial', title: 'Fournisseur' };
      case 'achat-demande-prix':
        return { category: 'Achat', title: 'Demande de prix' };
      case 'achat-bon-commande':
        return { category: 'Achat', title: 'Bon Commandes' };
      case 'achat-reception':
        return { category: 'Achat', title: 'Réception' };
      case 'achat-retours':
        return { category: 'Achat', title: 'Retours fournisseurs' };
      case 'vente-sessions':
        return { category: 'Vente', title: 'Points de Vente' };
      case 'vente-pos':
        return { category: 'Vente', title: 'Point de Vente (POS)' };
      case 'vente-commande':
        return { category: 'Vente', title: 'Commande' };
      case 'vente-retours':
        return { category: 'Vente', title: 'Retours clients' };
      case 'finance-recettes-depenses':
        return { category: 'Financière et comptabilité', title: 'Recettes et dépenses' };
      case 'finance-marges-resultat':
        return { category: 'Financière et comptabilité', title: 'Marges et résultat estimé' };
      case 'finance-tresorerie-caisses':
        return { category: 'Financière et comptabilité', title: 'Caisses et trésorerie' };
      case 'parametres-utilisateurs':
        return { category: 'Paramètres', title: 'Utilisateurs' };
      case 'parametres-configuration':
        return { category: 'Paramètres', title: 'Configuration Société' };
      case 'parametres-export':
        return { category: 'Paramètres', title: 'Exportation des données' };
      case 'guide-utilisateur':
        return { category: 'Aide', title: 'Guide Utilisateur' };
      case 'parametres-audit':
        return { category: 'Paramètres', title: 'Journal d\'Audit' };
      default:
        return { category: 'GeStock', title: 'Accueil' };
    }
  };

  const breadcrumb = getBreadcrumb(currentSection);

  return (
    <header className="sticky top-0 z-20 bg-[#001F3F] text-white border-b border-blue-900 shadow-sm px-4 py-3 flex items-center justify-between">
      {/* Left section: Mobile menu toggle & Breadcrumbs (or dedicated POS banner for Caissier) */}
      <div className="flex items-center gap-3">
        {currentUser?.role === 'Caissier' ? (
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">Poste Caisse • Point de Vente</span>
                {activePointDeVente ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>{activePointDeVente.code} • Caisse Active</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    Caisse en attente d'ouverture
                  </span>
                )}
              </div>
              <p className="text-[11px] text-blue-200 hidden sm:block">
                Opérateur : <strong className="text-white">{currentUser.name}</strong> • Vente directe & encaissement
              </p>
            </div>
          </div>
        ) : (
          <>
            <button
              onClick={onOpenMobileSidebar}
              className="md:hidden p-2 rounded-lg bg-blue-800/60 text-white hover:bg-blue-800 transition-colors"
              title="Ouvrir le menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-sm">
              <span className="text-blue-200 font-medium hidden sm:inline">{breadcrumb.category}</span>
              <ChevronRight className="w-4 h-4 text-blue-300 hidden sm:inline" />
              <span className="font-bold text-white bg-white/15 px-3 py-1 rounded-md border border-white/25 shadow-xs">
                {breadcrumb.title}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Right section: Store info, Notifications & User */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">


        {/* User Profile & Role Indicator with Dropdown */}
        <div className="relative" ref={profileDropdownRef}>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 pl-2 border-l border-blue-800 hover:bg-blue-800/50 py-1 px-1.5 rounded-lg transition-colors cursor-pointer text-left group"
              title="Session utilisateur"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#001F3F] to-blue-800 text-white flex items-center justify-center font-bold text-xs border border-blue-900/40 shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                {currentUser?.avatarInitials || 'GS'}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold text-white leading-none group-hover:text-blue-200 transition-colors">
                  {currentUser?.name || 'Utilisateur'}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-semibold text-blue-100 bg-blue-800/70 px-1.5 py-0.2 rounded border border-blue-700 leading-none">
                    {currentUser?.role || 'Opérateur'}
                  </span>
                </div>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-blue-300 hidden sm:block transition-transform ${isProfileOpen ? 'rotate-180 text-white' : ''}`} />
            </button>

            {/* Logout Button */}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                title="Se déconnecter (retourner à la page de connexion)"
                className="p-1.5 text-blue-200 hover:text-rose-300 hover:bg-rose-500/20 rounded-lg transition-colors ml-0.5 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Role Switcher Dropdown */}
          {isProfileOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3.5 py-2 border-b border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Session active
                </div>
                <div className="font-bold text-xs text-slate-800 mt-0.5">
                  {currentUser?.name}
                </div>
                <div className="text-[11px] text-blue-600 font-semibold">
                  Rôle : {currentUser?.role}
                </div>
              </div>

              <div className="p-2 space-y-1">
                {onOpenProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      onOpenProfile();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#001F3F] hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer text-left"
                  >
                    <User className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Modifier mon profil</span>
                  </button>
                )}
              </div>

              {onLogout && (
                <div className="pt-2 px-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center justify-center gap-2 p-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Déconnexion complète</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
