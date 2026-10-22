import React, { useState, useMemo, useEffect } from 'react';
import { 
  Home, 
  Package, 
  PackagePlus, 
  Box, 
  Users, 
  UserCheck, 
  Truck, 
  ShoppingCart, 
  FileText, 
  ClipboardCheck, 
  ReceiptText, 
  Store, 
  ShoppingBag, 
  CreditCard,
  DollarSign,
  TrendingUp,
  Scale,
  Wallet,
  ChevronDown, 
  ArrowRightLeft,
  AlertTriangle,
  Menu, 
  X, 
  Search,
  LogOut,
  Settings,
  UserCog,
  Building2,
  ScrollText,
  FileSpreadsheet,
  BookOpen,
  Upload,
  Undo2,
  CalendarClock
} from 'lucide-react';
import { NavSection, UserAccount } from '../types';
import { isSectionAllowedForUser } from '../services/authService';

interface SidebarProps {
  currentSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  lowStockCount: number;
  pendingOrdersCount: number;
  activeSessionsCount?: number;
  onOpenTechSpec: () => void;
  onOpenDatabaseManager?: () => void;
  currentUser?: UserAccount | null;
  onLogout?: () => void;
}

interface NavSubItem {
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: () => void;
  badge?: number | string;
  badgeType?: 'danger' | 'success' | 'warning' | 'info';
  description?: string;
  /** Sous-menu dépliable (3ᵉ niveau) — si présent, l'item ne navigue pas mais déplie ses enfants */
  children?: NavSubItem[];
}

interface NavGroup {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  subItems: NavSubItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentSection,
  onSelectSection,
  collapsed,
  onToggleCollapse,
  isOpenMobile,
  onCloseMobile,
  lowStockCount,
  pendingOrdersCount,
  activeSessionsCount = 0,
  onOpenTechSpec,
  onOpenDatabaseManager,
  currentUser,
  onLogout
}) => {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    if (currentSection === 'accueil') {
      return {
        inventaire: false,
        acteurs: false,
        achat: false,
        vente: false,
        finance: false,
        parametres: false
      };
    }
    const initial: Record<string, boolean> = {
      inventaire: false,
      acteurs: false,
      achat: false,
      vente: false,
      finance: false,
      parametres: false
    };
    if (currentSection.startsWith('inventaire-')) initial.inventaire = true;
    else if (currentSection.startsWith('acteurs-')) initial.acteurs = true;
    else if (currentSection.startsWith('achat-')) initial.achat = true;
    else if (currentSection.startsWith('vente-')) initial.vente = true;
    else if (currentSection.startsWith('finance-')) initial.finance = true;
    else if (currentSection.startsWith('parametres-')) initial.parametres = true;
    return initial;
  });
  const [searchQuery, setSearchQuery] = useState('');
  // Sous-menus dépliés (3ᵉ niveau, ex : Approvisionnement → Liste Appro / Magasin)
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const toggleSubMenu = (id: string, currentlyOpen: boolean) => {
    setExpandedItems(prev => ({ ...prev, [id]: !currentlyOpen }));
  };

  // Fermer automatiquement tous les menus quand la page d'accueil est active
  useEffect(() => {
    if (currentSection === 'accueil') {
      setOpenGroups({
        inventaire: false,
        acteurs: false,
        achat: false,
        vente: false,
        finance: false,
        parametres: false
      });
    }
  }, [currentSection]);

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const rawNavGroups: NavGroup[] = useMemo(() => [
    {
      key: 'inventaire',
      label: 'Inventaire & Stocks',
      icon: Package,
      iconColor: 'text-blue-600',
      subItems: [
        {
          id: 'inventaire-approvisionnement',
          label: 'Approvisionnement',
          icon: PackagePlus,
          description: 'Entrées stock post-réception',
          children: [
            {
              id: 'inventaire-approvisionnement',
              label: 'Liste Appro',
              icon: ClipboardCheck,
              description: 'Bons d\'approvisionnement'
            },
            {
              id: 'inventaire-magasins',
              label: 'Magasin',
              icon: Store,
              description: 'Magasins & rayons de stockage'
            }
          ]
        },
        {
          id: 'inventaire-produits',
          label: 'Catalogue Produits',
          icon: Box,
          description: 'Articles, prix & UOA/UOV'
        },
        {
          id: 'inventaire-physique',
          label: 'Inventaires physiques',
          icon: ClipboardCheck,
          description: 'Rapprochement des écarts'
        },
        {
          id: 'inventaire-ajustement',
          label: 'Ajustement de produits',
          icon: Scale,
          description: 'Corrections de quantités'
        },
        {
          id: 'inventaire-valorisation',
          label: 'Valorisation du stock',
          icon: TrendingUp,
          description: 'Coût d\'achat & marges'
        },
        {
          id: 'inventaire-transferts',
          label: 'Transferts magasins',
          icon: ArrowRightLeft,
          description: 'Transferts entre réserves & PV'
        },
        {
          id: 'inventaire-pertes-avaries',
          label: 'Pertes & Produits avariés',
          icon: AlertTriangle,
          description: 'Endommagés, perdus ou périmés'
        },
        {
          id: 'inventaire-peremption',
          label: 'Alertes péremption',
          icon: CalendarClock,
          description: 'Lots expirant sous 30 jours'
        }
      ]
    },
    {
      key: 'acteurs',
      label: 'Acteurs Commerciaux',
      icon: Users,
      iconColor: 'text-indigo-600',
      subItems: [
        {
          id: 'acteurs-clients',
          label: 'Clients & Crédits',
          icon: UserCheck,
          description: 'Portefeuille & encours'
        },
        {
          id: 'acteurs-fournisseurs',
          label: 'Fournisseurs',
          icon: Truck,
          description: 'Fournisseurs & dettes'
        }
      ]
    },
    {
      key: 'achat',
      label: 'Achats & Commandes',
      icon: ShoppingCart,
      iconColor: 'text-purple-600',
      subItems: [
        {
          id: 'achat-demande-prix',
          label: 'Demande de prix',
          icon: FileText,
          description: 'Devis & comparatifs'
        },
        {
          id: 'achat-bon-commande',
          label: 'Bons de Commande',
          icon: ClipboardCheck,
          description: 'Validation & règlements'
        },
        {
          id: 'achat-reception',
          label: 'Réceptions Marchandises',
          icon: ReceiptText,
          description: 'Contrôle livraison'
        },
        {
          id: 'achat-retours',
          label: 'Retours fournisseurs',
          icon: Undo2,
          description: 'Renvois & avoirs fournisseurs'
        }
      ]
    },
    {
      key: 'vente',
      label: 'Vente & Caisse POS',
      icon: Store,
      iconColor: 'text-emerald-600',
      subItems: [
        {
          id: 'vente-sessions',
          label: 'Points de Vente',
          icon: Store,
          badge: activeSessionsCount > 0 ? `${activeSessionsCount} actif` : undefined,
          badgeType: 'success',
          description: 'Sessions & tableau de bord'
        },
        {
          id: 'vente-pos',
          label: 'Caisse POS',
          icon: CreditCard,
          description: 'Terminal encaissement'
        },
        {
          id: 'vente-commande',
          label: 'Commandes Clients',
          icon: ShoppingBag,
          badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined,
          badgeType: 'warning',
          description: 'Historique des ventes'
        },
        {
          id: 'vente-retours',
          label: 'Retours clients',
          icon: Undo2,
          description: 'Reprises & avoirs clients'
        }
      ]
    },
    {
      key: 'finance',
      label: 'Financière & Comptabilité',
      icon: DollarSign,
      iconColor: 'text-amber-600',
      subItems: [
        {
          id: 'finance-recettes-depenses',
          label: 'Recettes et Dépenses',
          icon: TrendingUp,
          description: 'Journal des flux'
        },
        {
          id: 'finance-marges-resultat',
          label: 'Marges & Résultat Estimé',
          icon: Scale,
          description: 'Rentabilité & CAMV'
        },
        {
          id: 'finance-tresorerie-caisses',
          label: 'Caisses & Trésorerie',
          icon: Wallet,
          description: 'Soldes & virements'
        }
      ]
    },
    {
      key: 'parametres',
      label: 'Paramètres',
      icon: Settings,
      iconColor: 'text-slate-600',
      subItems: [
        {
          id: 'parametres-utilisateurs',
          label: 'Utilisateurs',
          icon: UserCog,
          description: 'Comptes & droits d\'accès'
        },
        {
          id: 'parametres-configuration',
          label: 'Configuration Société',
          icon: Building2,
          description: 'Raison sociale, logo, RCCM/NCC'
        },
        {
          id: 'parametres-import',
          label: 'Importer',
          icon: Upload,
          action: () => onOpenDatabaseManager?.(),
          description: 'Importer une base de données depuis une sauvegarde JSON'
        },
        {
          id: 'parametres-export',
          label: 'Savegarder',
          icon: FileSpreadsheet,
          description: 'Exportation des données (Excel)'
        },
        {
          id: 'parametres-audit',
          label: 'Journal d\'Audit',
          icon: ScrollText,
          description: 'Traçabilité des actions'
        }
      ]
    }
  ], [lowStockCount, pendingOrdersCount, activeSessionsCount, onOpenDatabaseManager]);

  // Filter navigation items by active user role permissions
  const navGroups: NavGroup[] = useMemo(() => {
    const allowed = (id: NavSection) => isSectionAllowedForUser(currentUser ?? null, id);
    return rawNavGroups
      .map(group => ({
        ...group,
        subItems: group.subItems
          .map(item => item.children
            ? { ...item, children: item.children.filter(c => allowed(c.id)) }
            : item)
          .filter(item => item.children ? item.children.length > 0 : allowed(item.id))
      }))
      .filter(group => group.subItems.length > 0);
  }, [rawNavGroups, currentUser]);

  const handleNavClick = (sectionId: NavSection) => {
    onSelectSection(sectionId);
    if (sectionId === 'accueil') {
      setOpenGroups({
        inventaire: false,
        acteurs: false,
        achat: false,
        vente: false,
        finance: false,
        parametres: false
      });
    }
    if (isOpenMobile) {
      onCloseMobile();
    }
  };

  // Filter groups based on search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return navGroups;
    const query = searchQuery.toLowerCase().trim();

    const matches = (item: NavSubItem) =>
      item.label.toLowerCase().includes(query) ||
      Boolean(item.description && item.description.toLowerCase().includes(query));

    return navGroups
      .map(group => {
        const groupMatches = group.label.toLowerCase().includes(query);
        const filteredItems = group.subItems
          .map(item => {
            if (!item.children) return item;
            // Parent : si le parent ne matche pas, on ne garde que les enfants qui matchent
            return { ...item, children: matches(item) ? item.children : item.children.filter(matches) };
          })
          .filter(item => matches(item) || (item.children && item.children.length > 0));

        if (groupMatches) return group;
        if (filteredItems.length > 0) {
          return { ...group, subItems: filteredItems };
        }
        return null;
      })
      .filter((g): g is NavGroup => g !== null);
  }, [navGroups, searchQuery]);

  const renderBadge = (badge: number | string | undefined, type: 'danger' | 'success' | 'warning' | 'info' = 'info') => {
    if (!badge) return null;

    const styles = {
      danger: 'bg-rose-50 text-rose-700 border-rose-200',
      success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      warning: 'bg-amber-50 text-amber-700 border-amber-200',
      info: 'bg-blue-50 text-blue-700 border-blue-200'
    }[type];

    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border tracking-tight leading-none ${styles}`}>
        {badge}
      </span>
    );
  };

  const renderLeafItem = (item: NavSubItem) => {
    const ItemIcon = item.icon;
    const isActive = currentSection === item.id;

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          if (item.action) {
            item.action();
            if (isOpenMobile) onCloseMobile();
            return;
          }
          handleNavClick(item.id);
        }}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 group relative text-left ${
          isActive
            ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-2xs'
            : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
        }`}
        title={collapsed ? item.label : undefined}
      >
        <ItemIcon
          className={`w-4 h-4 shrink-0 transition-colors ${
            isActive
              ? 'text-blue-600'
              : 'text-slate-400 group-hover:text-slate-700'
          }`}
        />
        {!collapsed && (
          <div className="flex-1 flex items-center justify-between min-w-0">
            <span className="truncate">{item.label}</span>
            {renderBadge(item.badge, item.badgeType)}
          </div>
        )}
        {/* Active left indicator bar */}
        {isActive && !collapsed && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-blue-600 rounded-r"></span>
        )}
      </button>
    );
  };

  const navContent = (
    <div className="flex flex-col h-full bg-white text-slate-700 border-r border-slate-200 shadow-sm select-none transition-all duration-300">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-[#001F3F] flex items-center justify-center font-black text-white shadow-sm shadow-blue-500/20 shrink-0 border border-blue-200/50">
            <span className="text-sm tracking-wider">GS</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-base tracking-tight text-[#001F3F] flex items-center gap-1.5">
                GeStock <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">PRO</span>
              </span>
              <span className="text-[11px] text-slate-500 truncate">Gestion Commerciale & POS</span>
            </div>
          )}
        </div>

        {/* Toggle Collapse Button (Desktop) */}
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          title={collapsed ? "Déplier le menu" : "Réduire le menu"}
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Close Button (Mobile) */}
        <button
          onClick={onCloseMobile}
          className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Quick Search in Menu (when not collapsed) */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher dans le menu..."
              className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 text-xs rounded-lg pl-8 pr-7 py-2 border border-slate-200 focus:border-blue-500 focus:bg-white focus:outline-none transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Navigation Groups List */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300">
        {/* Direct Item: Accueil */}
        {(!currentUser || isSectionAllowedForUser(currentUser, 'accueil')) && (
          <div>
            <button
              onClick={() => handleNavClick('accueil')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-150 group relative ${
                currentSection === 'accueil'
                  ? 'bg-blue-600 text-white font-bold shadow-sm shadow-blue-600/30'
                  : 'text-slate-700 hover:bg-slate-100/90 hover:text-slate-900'
              }`}
              title="Tableau de bord Accueil"
            >
              <Home className={`w-4 h-4 shrink-0 ${currentSection === 'accueil' ? 'text-white' : 'text-slate-500 group-hover:text-blue-600'}`} />
              {!collapsed && <span className="truncate">Tableau de bord</span>}
              {currentSection === 'accueil' && !collapsed && (
                <span className="w-1.5 h-1.5 rounded-full bg-white ml-auto"></span>
              )}
            </button>
          </div>
        )}

        {/* Grouped Categories */}
        {filteredGroups.map(group => {
          const isGroupOpen = searchQuery.trim() ? true : Boolean(openGroups[group.key]);
          const GroupIcon = group.icon;
          const hasActiveChild = group.subItems.some(item => item.id === currentSection);

          return (
            <div key={group.key} className="space-y-1">
              {/* Category Group Header Button */}
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase rounded-lg transition-colors ${
                    hasActiveChild ? 'text-blue-700 font-extrabold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <GroupIcon className={`w-3.5 h-3.5 shrink-0 ${group.iconColor}`} />
                    <span className="truncate">{group.label}</span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 text-slate-400 ${
                      isGroupOpen ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </button>
              ) : (
                <div className="w-full flex justify-center py-1">
                  <div className="w-6 border-b border-slate-200" />
                </div>
              )}

              {/* Category Sub-items */}
              {(isGroupOpen || collapsed) && (
                <div className={`space-y-0.5 ${!collapsed ? 'pl-2 border-l border-slate-200/90 ml-3.5' : ''}`}>
                  {group.subItems.map(item => {
                    // Sous-menu dépliable (3ᵉ niveau) — sidebar non réduite
                    if (!collapsed && item.children && item.children.length > 0) {
                      const ParentIcon = item.icon;
                      const hasActiveChild = item.children.some(c => c.id === currentSection);
                      const isOpen = expandedItems[item.id] ?? (searchQuery.trim() ? true : hasActiveChild);

                      return (
                        <div key={item.id} className="space-y-0.5">
                          <button
                            type="button"
                            onClick={() => toggleSubMenu(item.id, isOpen)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 group relative text-left ${
                              hasActiveChild
                                ? 'text-blue-700 font-bold'
                                : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                            }`}
                          >
                            <ParentIcon
                              className={`w-4 h-4 shrink-0 transition-colors ${
                                hasActiveChild ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-700'
                              }`}
                            />
                            <span className="flex-1 truncate">{item.label}</span>
                            <ChevronDown
                              className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${
                                isOpen ? 'rotate-0' : '-rotate-90'
                              }`}
                            />
                          </button>
                          {isOpen && (
                            <div className="space-y-0.5 pl-3 ml-4 border-l border-slate-200/90">
                              {item.children.map(child => renderLeafItem(child))}
                            </div>
                          )}
                        </div>
                      );
                    }

                    // Sidebar réduite : les enfants remplacent le parent
                    const leaves = item.children && item.children.length > 0 ? item.children : [item];
                    return leaves.map(leaf => renderLeafItem(leaf));
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Direct Item: Guide Utilisateur (après le groupe Paramètres) */}
        {(!currentUser || isSectionAllowedForUser(currentUser, 'guide-utilisateur')) && (
          <div>
            <button
              onClick={() => handleNavClick('guide-utilisateur')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-150 group relative ${
                currentSection === 'guide-utilisateur'
                  ? 'bg-blue-600 text-white font-bold shadow-sm shadow-blue-600/30'
                  : 'text-slate-700 hover:bg-slate-100/90 hover:text-slate-900'
              }`}
              title="Guide Utilisateur (PDF)"
            >
              <BookOpen className={`w-4 h-4 shrink-0 ${currentSection === 'guide-utilisateur' ? 'text-white' : 'text-slate-500 group-hover:text-blue-600'}`} />
              {!collapsed && <span className="truncate">Guide Utilisateur</span>}
              {currentSection === 'guide-utilisateur' && !collapsed && (
                <span className="w-1.5 h-1.5 rounded-full bg-white ml-auto"></span>
              )}
            </button>
          </div>
        )}

        {filteredGroups.length === 0 && searchQuery && (
          <div className="px-3 py-6 text-center text-xs text-slate-400">
            Aucun module ne correspond à &laquo;&nbsp;{searchQuery}&nbsp;&raquo;
          </div>
        )}
      </nav>

      {/* Sidebar Footer: Current User & Logout */}
      {currentUser && (
        <div className="p-3 border-t border-slate-200 bg-slate-50/70 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#001F3F] to-blue-800 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                {currentUser.avatarInitials}
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-slate-800 truncate leading-tight">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] font-semibold text-blue-600 truncate leading-tight">
                    {currentUser.role}
                  </span>
                </div>
              )}
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                title="Déconnexion (changer de profil)"
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Drawer */}
      <aside
        className={`hidden md:block h-screen sticky top-0 transition-all duration-300 z-30 shrink-0 ${
          collapsed ? 'w-18' : 'w-64'
        }`}
      >
        {navContent}
      </aside>

      {/* Mobile Backdrop & Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10 shadow-2xl animate-in slide-in-from-left duration-250">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};
