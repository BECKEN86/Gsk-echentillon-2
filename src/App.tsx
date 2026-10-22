import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header, SyncStatus } from './components/Header';

// Vues chargées à la demande : le bundle initial ne contient que le shell + la vue affichée
const AccueilView = lazy(() => import('./components/views/AccueilView').then(m => ({ default: m.AccueilView })));
const ProduitsView = lazy(() => import('./components/views/inventaire/ProduitsView').then(m => ({ default: m.ProduitsView })));
const ApprovisionnementView = lazy(() => import('./components/views/inventaire/ApprovisionnementView').then(m => ({ default: m.ApprovisionnementView })));
const MagasinsView = lazy(() => import('./components/views/inventaire/MagasinsView').then(m => ({ default: m.MagasinsView })));
const ValorisationStockView = lazy(() => import('./components/views/inventaire/ValorisationStockView').then(m => ({ default: m.ValorisationStockView })));
const InventairePhysiqueView = lazy(() => import('./components/views/inventaire/InventairePhysiqueView').then(m => ({ default: m.InventairePhysiqueView })));
const AjustementStockView = lazy(() => import('./components/views/inventaire/AjustementStockView').then(m => ({ default: m.AjustementStockView })));
const TransfertsView = lazy(() => import('./components/views/inventaire/TransfertsView').then(m => ({ default: m.TransfertsView })));
const PertesAvariesView = lazy(() => import('./components/views/inventaire/PertesAvariesView').then(m => ({ default: m.PertesAvariesView })));
const PeremptionView = lazy(() => import('./components/views/inventaire/PeremptionView').then(m => ({ default: m.PeremptionView })));
const RetoursClientsView = lazy(() => import('./components/views/vente/RetoursClientsView').then(m => ({ default: m.RetoursClientsView })));
const RetoursFournisseursView = lazy(() => import('./components/views/achat/RetoursFournisseursView').then(m => ({ default: m.RetoursFournisseursView })));
const ClientsView = lazy(() => import('./components/views/acteurs/ClientsView').then(m => ({ default: m.ClientsView })));
const FournisseursView = lazy(() => import('./components/views/acteurs/FournisseursView').then(m => ({ default: m.FournisseursView })));
const DemandePrixView = lazy(() => import('./components/views/achat/DemandePrixView').then(m => ({ default: m.DemandePrixView })));
const BonCommandeView = lazy(() => import('./components/views/achat/BonCommandeView').then(m => ({ default: m.BonCommandeView })));
const ReceptionView = lazy(() => import('./components/views/achat/ReceptionView').then(m => ({ default: m.ReceptionView })));
const PointDeVenteView = lazy(() => import('./components/views/vente/PointDeVenteView').then(m => ({ default: m.PointDeVenteView })));
const PointDeVenteSessionsView = lazy(() => import('./components/views/vente/PointDeVenteSessionsView').then(m => ({ default: m.PointDeVenteSessionsView })));
const CommandeVenteView = lazy(() => import('./components/views/vente/CommandeVenteView').then(m => ({ default: m.CommandeVenteView })));
const RecettesDepensesView = lazy(() => import('./components/views/finance/RecettesDepensesView').then(m => ({ default: m.RecettesDepensesView })));
const MargesResultatView = lazy(() => import('./components/views/finance/MargesResultatView').then(m => ({ default: m.MargesResultatView })));
const TresorerieCaissesView = lazy(() => import('./components/views/finance/TresorerieCaissesView').then(m => ({ default: m.TresorerieCaissesView })));
const UtilisateursView = lazy(() => import('./components/views/parametres/UtilisateursView').then(m => ({ default: m.UtilisateursView })));
const ConfigurationView = lazy(() => import('./components/views/parametres/ConfigurationView').then(m => ({ default: m.ConfigurationView })));
const AuditLogView = lazy(() => import('./components/views/parametres/AuditLogView').then(m => ({ default: m.AuditLogView })));
const ExportDonneesView = lazy(() => import('./components/views/parametres/ExportDonneesView').then(m => ({ default: m.ExportDonneesView })));
const GuideUtilisateurView = lazy(() => import('./components/views/parametres/GuideUtilisateurView').then(m => ({ default: m.GuideUtilisateurView })));
import { ReceiptModal } from './components/modals/ReceiptModal';
import { InvoiceModal } from './components/modals/InvoiceModal';
import { TechSpecModal } from './components/modals/TechSpecModal';
import { DatabaseManagerModal } from './components/modals/DatabaseManagerModal';
import { LoginView } from './components/views/auth/LoginView';
import { generateUniqueId } from './utils/idGenerator';
import { nextDocumentCode } from './utils/documentNumber';
import {
  computeRestockMap,
  buildCancelMovements,
  findSaleRevenueTransaction,
  revertClientMetrics,
  } from './utils/businessRules';
import { buildWipedDatabase } from './utils/resetDatabase';
import { buildAdjustmentMovements } from './utils/physicalInventory';
import { buildAdjustmentDocMovements, buildCompensationMovements, summarizeAdjustment } from './utils/stockAdjustment';
import { buildShipMovements, buildReceiveMovements, buildTransferCancelMovements } from './utils/stockTransfer';
import { buildDestockMovement } from './utils/stockLoss';
import {
  buildCustomerReturnMovements,
  buildCustomerReturnCancelMovements,
  buildSupplierReturnMovements,
  buildSupplierReturnCancelMovements,
  applyCustomerReturnToClient,
  revertCustomerReturnOnClient,
  applySupplierReturnToSupplier,
  revertSupplierReturnOnSupplier
} from './utils/stockReturns';
import { formatAppDate, formatAppDateTime } from './utils/dateUtils';
import { purchaseLineQty } from './utils/purchaseCalc';
import { isPasswordHashed } from './utils/passwordHash';
import { loadDatabase, saveDatabase, getEmptyDatabase, clearLocalDatabaseCache, AppDatabase } from './services/storageService';
import {
  loadRemoteDatabase,
  persistRemoteDatabase,
  logoutRemote,
  fetchCurrentUser,
  isRemoteDatabaseOnline,
  isRemoteApiConfigured,
  pushFullDatabase,
  getSessionToken,
  startRemoteWatcher,
  claimCashRegisterRemote,
  releaseCashRegisterRemote
} from './services/apiService';
import { getStoredUser, saveStoredUser, isSectionAllowedForUser, canManageStockOperations } from './services/authService';
import { showAuditSuccess, showToast } from './utils/toast';
import { canOpenMultipleCashRegisters, canUseCashRegister, filterCashierOrders } from './utils/posAccess';

import {
  NavSection,
  UserAccount,
  Product,
  ProductCategory,
  Client,
  Supplier,
  StockMovement,
  PriceInquiry,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderSupplierSettlement,
  SupplierCreditLine,
  GoodsReception,
  SaleOrder,
  PointDeVente,
  FinancialTransaction,
  TreasuryAccount,
  TreasuryMovement,
  CartItem,
  CompanyConfig,
  AuditLog,
  ApprovisionnementRecord,
  StorageSite,
  StockValuationRecord,
  PhysicalInventory,
  StockAdjustment,
  StockTransfer,
  StockAvarieLoss,
  CustomerReturn,
  SupplierReturn
} from './types';


export default function App() {
  // Pré-amorçage : si une session serveur existe, la base SQLite (serveur
  // local) est la source de vérité — on démarre vide et on ignore le cache
  // navigateur (il sera purgé). Sans session, repli sur localStorage.
  const [initialDb] = useState<AppDatabase>(() =>
    getSessionToken() ? getEmptyDatabase() : loadDatabase()
  );
  const initialUsers = initialDb.users || [];

  // User Authentication & Session state
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => getStoredUser(initialUsers));

  // Active view section state (initialized according to user role when authenticated)
  const [currentSection, setCurrentSection] = useState<NavSection>(() => {
    const stored = getStoredUser(initialUsers);
    if (stored) {
      if (stored.role === 'Administrateur') return 'accueil';
      if (stored.role === 'Gérant') return 'finance-marges-resultat';
      if (stored.role === 'Caissier') return 'vente-pos';
      if (stored.role === 'Responsable Agence') return 'vente-sessions';
      return stored.defaultSection || 'accueil';
    }
    return 'accueil';
  });
  const [selectedPointDeVenteId, setSelectedPointDeVenteId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Authentication handler: orient users towards their specific views
  const handleLoginSuccess = (user: UserAccount, migration?: { userId: string; passwordHash: string }) => {
    // Migration douce : remplace le mot de passe en clair par son hash sha256
    if (migration) {
      setUsers(prev =>
        prev.map(u =>
          u.id === migration.userId
            ? { ...u, passwordHash: migration.passwordHash, password: undefined }
            : u
        )
      );
    }
    setCurrentUser(user);
    saveStoredUser(user);
    if (user.role === 'Administrateur') {
      setCurrentSection('accueil');
    } else if (user.role === 'Gérant') {
      setCurrentSection('finance-marges-resultat');
    } else if (user.role === 'Caissier') {
      setCurrentSection('vente-pos');
    } else if (user.role === 'Responsable Agence') {
      setCurrentSection('vente-sessions');
    } else {
      setCurrentSection(user.defaultSection || 'accueil');
    }
    showToast('Connexion réussie.');
  };

  const handleLogout = async () => {
    const occupiedSession = pointsDeVente.find(
      session => session.occupiedBy === currentUser?.id
    );
    if (occupiedSession) {
      await releaseCashRegisterRemote(occupiedSession.id);
      setPointsDeVente(prev => prev.map(session => {
        if (session.id !== occupiedSession.id) return session;
        const { occupiedBy: _occupiedBy, ...released } = session;
        return released;
      }));
    }
    await logoutRemote(); // révoque la session côté serveur
    saveStoredUser(null);
    setCurrentUser(null);
    showToast('Vous êtes déconnecté.');
  };

  const handleCreateFirstAdmin = async (user: UserAccount, remote: boolean) => {
    if (remote) {
      setDbLoaded(false);
      const database = await loadRemoteDatabase();
      if (!database) {
        throw new Error('Le compte a été créé, mais le chargement de la base serveur a échoué. Rechargez la page pour vous connecter.');
      }
      clearLocalDatabaseCache();
      handleDatabaseRestored(database);
      setDbLoaded(true);
      showToast('Le compte administrateur a été créé avec succès.');
      return;
    }
    setUsers(prev => prev.length === 0 ? [user] : prev);
    showToast('Le compte administrateur a été créé avec succès.');
  };

  // Route protection: Caissier is strictly locked to their point of sale ('vente-pos') and has no other menu
  useEffect(() => {
    if (currentUser?.role === 'Caissier') {
      if (currentSection !== 'vente-pos') {
        setCurrentSection('vente-pos');
      }
    } else if (currentUser && !isSectionAllowedForUser(currentUser, currentSection)) {
      const fallback = currentUser.defaultSection || 'accueil';
      setCurrentSection(fallback);
    }
  }, [currentUser, currentSection]);

  // App domain state
  const [categories, setCategories] = useState<ProductCategory[]>(initialDb.categories);
  const [products, setProducts] = useState<Product[]>(initialDb.products);
  const [clients, setClients] = useState<Client[]>(initialDb.clients);
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialDb.suppliers);
  const [movements, setMovements] = useState<StockMovement[]>(initialDb.movements);
  const [inquiries, setInquiries] = useState<PriceInquiry[]>(initialDb.inquiries);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(initialDb.purchaseOrders);
  const [receptions, setReceptions] = useState<GoodsReception[]>(initialDb.receptions);
  const [approvisionnements, setApprovisionnements] = useState<ApprovisionnementRecord[]>(
    () => initialDb.approvisionnements || []
  );
  const [approTargetReceptionId, setApproTargetReceptionId] = useState<string | null>(null);
  const [receptionSourcePO, setReceptionSourcePO] = useState<PurchaseOrder | null>(null);
  const [poToOpenDetail, setPoToOpenDetail] = useState<PurchaseOrder | null>(null);
  const [storageSites, setStorageSites] = useState<StorageSite[]>(
    () => initialDb.storageSites || []
  );
  const [saleOrders, setSaleOrders] = useState<SaleOrder[]>(initialDb.saleOrders);
  const [pointsDeVente, setPointsDeVente] = useState<PointDeVente[]>(initialDb.pointsDeVente);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(initialDb.transactions);
  const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccount[]>(initialDb.treasuryAccounts);
  const [treasuryMovements, setTreasuryMovements] = useState<TreasuryMovement[]>(initialDb.treasuryMovements);
  // Annuaire des comptes configurés pour cette installation
  const [users, setUsers] = useState<UserAccount[]>(initialUsers);
  // Journal d'audit centralisé
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(initialDb.auditLogs || []);
  // États de valorisation du stock clôturés
  const [valuations, setValuations] = useState<StockValuationRecord[]>(initialDb.valuations || []);
  // Inventaires physiques (brouillons → clôturés)
  const [inventories, setInventories] = useState<PhysicalInventory[]>(initialDb.physicalInventories || []);
  // Documents d'ajustement de stock (brouillons → validés/annulés)
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>(initialDb.stockAdjustments || []);
  // Transferts inter-dépôts (en transit → réceptionnés/annulés)
  const [stockTransfers, setStockTransfers] = useState<StockTransfer[]>(initialDb.stockTransfers || []);
  // Pertes, casses et produits avariés (constatés → déstockés)
  const [stockLosses, setStockLosses] = useState<StockAvarieLoss[]>(initialDb.stockLosses || []);
  // Retours clients (réintégration stock + avoir client)
  const [customerReturns, setCustomerReturns] = useState<CustomerReturn[]>(initialDb.customerReturns || []);
  // Retours fournisseurs (sortie de stock + déduction dette/avoir fournisseur)
  const [supplierReturns, setSupplierReturns] = useState<SupplierReturn[]>(initialDb.supplierReturns || []);
  // Paramètres de la société (ticket, documents)
  const [companyConfig, setCompanyConfig] = useState<CompanyConfig | null>(initialDb.companyConfig || null);

  // Compteurs de numérotation des documents (persistés dans la base)
  const [counters, setCounters] = useState<Record<string, number>>(() => initialDb.counters || {});
  const countersRef = useRef<Record<string, number>>(initialDb.counters || {});
  // La sauvegarde est bloquée tant que la base distante n'a pas été tentée
  const [dbLoaded, setDbLoaded] = useState(false);

  // Modals state
  const [activeReceiptSale, setActiveReceiptSale] = useState<SaleOrder | null>(null);
  const [activeInvoiceSale, setActiveInvoiceSale] = useState<SaleOrder | null>(null);
  const [isTechSpecOpen, setIsTechSpecOpen] = useState<boolean>(false);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState<boolean>(false);

  // Persist every modification to local database automatically (localStorage + SQLite distant)
  useEffect(() => {
    if (!dbLoaded) return;
    const currentDb: AppDatabase = {
      version: 1,
      lastUpdated: new Date().toISOString(),
      counters,
      products,
      categories,
      movements,
      clients,
      suppliers,
      inquiries,
      purchaseOrders,
      receptions,
      approvisionnements,
      storageSites,
      saleOrders,
      pointsDeVente: pointsDeVente.map(({ sales: _ignored, ...rest }) => rest),
      transactions,
      treasuryAccounts,
      treasuryMovements,
      users,
      auditLogs,
      valuations,
      physicalInventories: inventories,
      stockAdjustments,
      stockTransfers,
      stockLosses,
      customerReturns,
      supplierReturns,
      companyConfig
    };
    if (getSessionToken()) {
      // Une session serveur est active : SQLite gère les données — le cache
      // navigateur est purgé au lieu d'être réécrit.
      clearLocalDatabaseCache();
    } else {
      saveDatabase(currentDb);
    }
    persistRemoteDatabase(currentDb);
  }, [
    dbLoaded,
    counters,
    products,
    categories,
    movements,
    clients,
    suppliers,
    inquiries,
    purchaseOrders,
    receptions,
    approvisionnements,
    storageSites,
    saleOrders,
    pointsDeVente,
    transactions,
    treasuryAccounts,
    treasuryMovements,
    users,
    auditLogs,
    valuations,
    inventories,
    stockAdjustments,
    stockTransfers,
    stockLosses,
    customerReturns,
    supplierReturns,
    companyConfig
  ]);

  // Alimente les compteurs à partir des codes déjà présents dans la base
  // (évite les collisions après restauration d'une sauvegarde plus ancienne)
  const seedCounters = (db: AppDatabase) => {
    const map: Record<string, number> = { ...countersRef.current, ...(db.counters || {}) };
    const allCodes = [
      ...db.inquiries.map(i => i.code),
      ...db.purchaseOrders.map(p => p.code),
      ...db.receptions.map(r => r.code),
      ...(db.approvisionnements || []).map(a => a.reference),
      ...db.saleOrders.map(s => s.code),
      ...db.transactions.map(t => t.code),
      ...db.treasuryMovements.map(t => t.code),
      ...(db.valuations || []).map(v => v.code),
      ...(db.physicalInventories || []).map(i => i.code),
      ...(db.stockAdjustments || []).map(a => a.code),
      ...(db.stockTransfers || []).map(t => t.code),
      ...(db.stockLosses || []).map(l => l.code),
      ...(db.customerReturns || []).map(r => r.code),
      ...(db.supplierReturns || []).map(r => r.code)
    ];
    allCodes.forEach(code => {
      const m = /^([A-Z]+)-(\d{6})-(\d{4})$/.exec(code || '');
      if (m) {
        const key = `${m[1]}-${m[2]}`;
        const n = parseInt(m[3], 10);
        if (n > (map[key] || 0)) map[key] = n;
      }
    });
    countersRef.current = map;
    setCounters(map);
  };

  // Génère le prochain numéro de document : PREFIX-YYYYMM-NNNN (compteur persistant)
  const nextCode = (prefix: string): string => {
    const { code, counters: next } = nextDocumentCode(countersRef.current, prefix);
    countersRef.current = next;
    setCounters(next);
    return code;
  };

  // Journal d'audit centralisé : qui / quoi / quand (plafonné à 2000 entrées)
  const logAudit = (action: string, entity: string, entityRef?: string, details?: string) => {
    const entry: AuditLog = {
      id: generateUniqueId('audit'),
      at: new Date().toISOString(),
      actor: currentUser?.name || 'Système',
      username: currentUser?.username,
      action,
      entity,
      entityRef,
      details
    };
    setAuditLogs(prev => [entry, ...prev].slice(0, 2000));
    showAuditSuccess(action, entity);
  };

  /**
   * Verrou anti double-exécution : deux appels rapprochés (double-clic,
   * double soumission) peuvent lire un état pas encore re-rendu et passer
   * les gardes `status`. On mémorise chaque opération réussie par
   * (opération, document) — une clé déjà vue est ignorée.
   */
  const executedOps = useRef(new Set<string>());
  const runOnce = (key: string, fn: () => boolean): boolean => {
    if (executedOps.current.has(key)) return false;
    const ok = fn();
    if (ok) executedOps.current.add(key);
    return ok;
  };

  const handleDatabaseRestored = (newDb: AppDatabase) => {
    setProducts(newDb.products);
    setCategories(newDb.categories);
    setMovements(newDb.movements);
    setClients(newDb.clients);
    setSuppliers(newDb.suppliers);
    setInquiries(newDb.inquiries);
    setPurchaseOrders(newDb.purchaseOrders);
    setReceptions(newDb.receptions);
    setApprovisionnements(newDb.approvisionnements || []);
    setStorageSites(newDb.storageSites || []);
    setSaleOrders(newDb.saleOrders);
    setPointsDeVente(newDb.pointsDeVente.map(pv => ({ ...pv, sales: [] })));
    setTransactions(newDb.transactions);
    setTreasuryAccounts(newDb.treasuryAccounts);
    setTreasuryMovements(newDb.treasuryMovements);
    setUsers(newDb.users || []);
    setValuations(newDb.valuations || []);
    setInventories(newDb.physicalInventories || []);
    setStockAdjustments(newDb.stockAdjustments || []);
    setStockTransfers(newDb.stockTransfers || []);
    setStockLosses(newDb.stockLosses || []);
    setCustomerReturns(newDb.customerReturns || []);
    setSupplierReturns(newDb.supplierReturns || []);
    setAuditLogs(newDb.auditLogs || []);
    setCompanyConfig(newDb.companyConfig || null);
    setCounters(newDb.counters || {});
    countersRef.current = newDb.counters || {};
    seedCounters(newDb);
  };

  // Chargement initial : restauration de session serveur puis base distante
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Le token serveur valide la session stockée (sinon → retour login si serveur joignable)
      const remoteUser = await fetchCurrentUser();
      if (cancelled) return;
      if (remoteUser) {
        setCurrentUser(remoteUser);
        saveStoredUser(remoteUser);
      } else if (currentUser && isRemoteDatabaseOnline()) {
        // Serveur joignable mais session expirée/révoquée → déconnexion
        saveStoredUser(null);
        setCurrentUser(null);
      }

      // Chargement depuis le serveur local (SQLite) — seule source de vérité
      if (remoteUser || currentUser) {
        const remote = await loadRemoteDatabase();
        if (cancelled) return;
        if (remote) {
          clearLocalDatabaseCache(); // le serveur SQLite est désormais la source de vérité
          handleDatabaseRestored(remote);
        } else {
          seedCounters(initialDb);
        }
      } else {
        seedCounters(initialDb);
      }
      setDbLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Synchronisation entrante : recharge quand un autre poste modifie la base
  useEffect(() => {
    if (!currentUser || !dbLoaded) return;
    return startRemoteWatcher(db => handleDatabaseRestored(db));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, dbLoaded]);

  // Statut de synchronisation affiché dans le header (Synchro / Hors ligne / Local)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  useEffect(() => {
    const update = () => {
      const online = isRemoteDatabaseOnline();
      setSyncStatus(
        getSessionToken() ? (online === false ? 'offline' : 'online') : 'local'
      );
    };
    update();
    const t = setInterval(update, 5000);
    return () => clearInterval(t);
  }, [currentUser]);

  // Computed state
  const lowStockCount = products.filter(p => p.stock <= p.minStock).length;
  const pendingOrdersCount = saleOrders.filter(s => s.status === 'En attente').length;
  const activeSessionsCount = pointsDeVente.filter(p => p.status === 'En cours').length;
  const isCashier = currentUser?.role === 'Caissier';
  // Opérations sensibles (validation/annulation stock) : interdites au caissier
  const canManageStockOps = canManageStockOperations(currentUser ?? null);
  const requireStockOps = (): boolean => {
    if (canManageStockOps) return true;
    alert("Opération réservée : votre rôle ne permet pas les validations et régularisations de stock.");
    return false;
  };

  // Sessions de caisse enrichies : les ventes et totaux sont dérivés de saleOrders
  // (les ventes annulées sont exclues des totaux). Plus de double stockage.
  const pointsDeVenteWithSales = useMemo(() => {
    return pointsDeVente.map(pv => {
      const sessionSales = saleOrders.filter(
        o =>
          o.status !== 'Annulé' &&
          o.status !== 'En cours' &&
          (o.pointDeVenteId === pv.id || (!!pv.code && o.pointDeVenteCode === pv.code))
      );
      // Rétro-compatibilité : ventes embarquées dans pv.sales absentes de saleOrders
      const legacyExtras = (pv.sales || []).filter(
        s => s.status !== 'Annulé' && s.status !== 'En cours' && !sessionSales.some(x => x.id === s.id)
      );
      const all = [...sessionSales, ...legacyExtras];
      const sum = (pred: (o: SaleOrder) => boolean) =>
        all.filter(pred).reduce((s, o) => s + (o.finalAmount || o.totalAmount), 0);
      const cashSales = sum(o => o.paymentMethod === 'Espèces');
      return {
        ...pv,
        sales: all,
        totalSalesAmount: sum(() => true),
        cashSalesAmount: cashSales,
        creditSalesAmount: sum(o => o.paymentMethod === 'Crédit'),
        mobileSalesAmount: sum(o => o.paymentMethod === 'Mobile Money'),
        cardSalesAmount: sum(o => o.paymentMethod === 'Carte'),
        expectedClosingAmount:
          pv.status === 'En cours' ? pv.openingAmount + cashSales : pv.expectedClosingAmount
      };
    });
  }, [pointsDeVente, saleOrders]);

  // Prochain code de session de caisse (max PVxxxx + 1)
  const nextPvCode = useMemo(() => {
    let maxNum = 0;
    pointsDeVente.forEach(pv => {
      const match = pv.code.match(/PV(\d+)/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    return `PV${String(maxNum + 1).padStart(4, '0')}`;
  }, [pointsDeVente]);

  // Active Point de Vente: for cashier, priority to their own open session
  const activePointDeVente = useMemo(() => {
    if (isCashier) {
      return pointsDeVenteWithSales.find(
        p => p.status === 'En cours' && p.occupiedBy === currentUser?.id
      );
    }
    const selectedSession = pointsDeVenteWithSales.find(
      p => p.id === selectedPointDeVenteId && canUseCashRegister(p, currentUser)
    );
    if (selectedSession) return selectedSession;
    return pointsDeVenteWithSales.find(p => canUseCashRegister(p, currentUser));
  }, [pointsDeVenteWithSales, currentUser, isCashier, selectedPointDeVenteId]);

  const handleSelectCashRegister = async (registerId: string): Promise<boolean> => {
    if (currentUser?.role !== 'Caissier') return false;
    const target = pointsDeVente.find(session => session.id === registerId);
    if (!target || target.status !== 'En cours') return false;
    if (target.occupiedBy && target.occupiedBy !== currentUser.id) {
      showToast('Cette caisse est déjà utilisée par un autre caissier.', 'error');
      return false;
    }

    const claimResult = await claimCashRegisterRemote(registerId);
    if (claimResult.remote && !claimResult.ok) {
      showToast(claimResult.error || 'Cette caisse ne peut pas être réservée.', 'error');
      return false;
    }

    const previousSession = pointsDeVente.find(
      session => session.occupiedBy === currentUser.id && session.id !== registerId
    );
    if (previousSession) {
      void releaseCashRegisterRemote(previousSession.id);
    }
    setPointsDeVente(prev => prev.map(session => {
      if (session.id === registerId) return { ...session, occupiedBy: currentUser.id };
      if (session.id === previousSession?.id) {
        const { occupiedBy: _occupiedBy, ...released } = session;
        return released;
      }
      return session;
    }));
    setSelectedPointDeVenteId(registerId);
    showToast(`La caisse ${target.code} vous est réservée.`);
    return true;
  };

  // Handlers for Categories
  const handleAddCategory = (catData: Omit<ProductCategory, 'id'>) => {
    const newCat: ProductCategory = {
      ...catData,
      id: generateUniqueId('cat')
    };
    setCategories(prev => [...prev, newCat]);
    showToast('La catégorie a été créée avec succès.');
  };

  const handleUpdateCategory = (updatedCat: ProductCategory) => {
    setCategories(prev => prev.map(c => c.id === updatedCat.id ? updatedCat : c));
    setProducts(prev =>
      prev.map(p => {
        const oldCat = categories.find(c => c.id === updatedCat.id);
        if (oldCat && p.category === oldCat.name) {
          return { ...p, category: updatedCat.name, categoryId: updatedCat.id };
        }
        return p;
      })
    );
    showToast('La catégorie a été modifiée avec succès.');
  };

  const handleDeleteCategory = (id: string) => {
    const cat = categories.find(c => c.id === id);
    setCategories(prev => prev.filter(c => c.id !== id));
    // Les produits de la catégorie supprimée sont réassignés à "Non classé"
    if (cat) {
      setProducts(prev =>
        prev.map(p =>
          p.category === cat.name || p.categoryId === id
            ? { ...p, category: 'Non classé', categoryId: undefined }
            : p
        )
      );
    }
    showToast('La catégorie a été supprimée avec succès.');
  };

  // Handlers for Products
  const handleAddProduct = (newProdData: Omit<Product, 'id'>) => {
    const newProdId = generateUniqueId('p');
    const newProd: Product = {
      ...newProdData,
      id: newProdId
    };
    setProducts(prev => [newProd, ...prev]);

    // Record stock movement only if product is stockable and stock > 0
    if (newProd.isStockable !== false && newProd.stock > 0) {
      setMovements(prev => [
        {
          id: generateUniqueId(`m_${newProd.id}`),
          date: formatAppDateTime(),
          productId: newProd.id,
          productName: newProd.name,
          type: 'Entrée',
          quantity: newProd.stock,
          reason: 'Création produit avec stock initial',
          reference: newProd.code,
          performedBy: currentUser?.name || 'Système'
        },
        ...prev
      ]);
    }
    showToast('Le produit a été créé avec succès.');
  };

  const handleBatchAddProducts = (newProducts: Product[]) => {
    setProducts(prev => [...newProducts, ...prev]);
    showToast(`${newProducts.length} produit(s) importé(s) avec succès.`);
  };

  const handleUpdateProduct = (updatedProduct: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    showToast('Le produit a été modifié avec succès.');
  };

  const handleDeleteProduct = (id: string) => {
    const referenced =
      movements.some(m => m.productId === id) ||
      saleOrders.some(s => s.items.some(i => i.productId === id)) ||
      purchaseOrders.some(po => po.items.some(i => i.productId === id)) ||
      receptions.some(r => r.items.some(i => i.productId === id));
    if (referenced) {
      alert(
        'Suppression impossible : ce produit est référencé dans des ventes, commandes, réceptions ou mouvements de stock (historique à conserver).'
      );
      return;
    }
    setProducts(prev => prev.filter(p => p.id !== id));
    showToast('Le produit a été supprimé avec succès.');
  };

  // Handlers for Clients
  const handleAddClient = (clientData: Omit<Client, 'id' | 'totalPurchases'>): Client => {
    const newClient: Client = {
      ...clientData,
      id: generateUniqueId('c'),
      totalPurchases: 0
    };
    setClients(prev => [newClient, ...prev]);
    showToast('Le client a été créé avec succès.');
    return newClient;
  };

  const handleUpdateClient = (updatedClient: Client) => {
    setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
    showToast('Le client a été modifié avec succès.');
  };

  const handleDeleteClient = (id: string) => {
    const client = clients.find(c => c.id === id);
    if (client && (client.creditBalance > 0 || client.totalPurchases > 0)) {
      alert(
        `Suppression impossible : ${client.name} a un historique d'achats ou un solde crédit (${client.creditBalance} FCFA). L'audit commercial doit être conservé.`
      );
      return;
    }
    setClients(prev => prev.filter(c => c.id !== id));
    showToast('Le client a été supprimé avec succès.');
  };

  // Handlers for Suppliers
  const handleAddSupplier = (supplierData: Omit<Supplier, 'id' | 'balance'>) => {
    const newSupplier: Supplier = {
      ...supplierData,
      id: generateUniqueId('s'),
      balance: 0
    };
    setSuppliers(prev => [newSupplier, ...prev]);
    showToast('Le fournisseur a été créé avec succès.');
  };

  const handleUpdateSupplier = (updatedSupplier: Supplier) => {
    setSuppliers(prev => prev.map(s => s.id === updatedSupplier.id ? updatedSupplier : s));
    showToast('Le fournisseur a été modifié avec succès.');
  };

  const handleDeleteSupplier = (id: string) => {
    const supplier = suppliers.find(s => s.id === id);
    const hasDebt = supplier && supplier.balance > 0;
    const hasHistory = supplier && ((supplier.totalPurchases || 0) > 0 || (supplier.creditLines || []).length > 0);
    if (hasDebt || hasHistory) {
      alert(
        `Suppression impossible : ${supplier.name} a un solde dû (${supplier.balance} FCFA) ou un historique d'achats. L'audit doit être conservé.`
      );
      return;
    }
    setSuppliers(prev => prev.filter(s => s.id !== id));
    showToast('Le fournisseur a été supprimé avec succès.');
  };

  // Handlers for Demandes de prix
  const handleAddInquiry = (inquiryData: Omit<PriceInquiry, 'id'>) => {
    const newInquiry: PriceInquiry = {
      ...inquiryData,
      id: generateUniqueId('dp'),
      code: nextCode('DEV')
    };
    setInquiries(prev => [newInquiry, ...prev]);
    showToast('La demande de prix a été créée avec succès.');
  };

  const handleConvertToPurchaseOrder = (inquiry: PriceInquiry) => {
    // Create new Purchase Order from RFQ
    const poItems: PurchaseOrderItem[] = inquiry.items.map(item => ({
      productId: item.productId,
      barcode: item.barcode,
      productName: item.productName,
      uoa: item.uoa,
      qta: item.qta,
      supplierId: item.supplierId || inquiry.supplierId,
      supplierName: item.supplierName || inquiry.supplierName,
      quantity: item.requestedQty,
      unitPrice: item.estimatedPrice,
      vatRate: item.vatRate,
      vatAmount: item.vatAmount,
      // Montant : Qta > 0 → Qta × prix UOA ; sinon Quantité × prix (cf. purchaseCalc)
      total: item.totalAmount || (purchaseLineQty(item) * item.estimatedPrice)
    }));

    const totalHT = inquiry.totalHT ?? inquiry.items.reduce((s, i) => s + purchaseLineQty(i) * i.estimatedPrice, 0);
    const vatRate = inquiry.vatRate ?? 18;
    const totalVAT = inquiry.totalVAT ?? Math.round(totalHT * (vatRate / 100));
    const totalTTC = inquiry.totalTTC ?? (totalHT + totalVAT);

    const newPO: PurchaseOrder = {
      id: generateUniqueId('bc'),
      code: nextCode('BC'),
      inquiryId: inquiry.id,
      inquiryCode: inquiry.code,
      date: formatAppDate(),
      buyer: inquiry.buyer || currentUser?.name || 'Acheteur',
      orderDeadline: inquiry.orderDeadline,
      expectedDate: inquiry.orderDeadline || formatAppDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
      supplierId: inquiry.supplierId,
      supplierName: inquiry.supplierName,
      items: poItems,
      totalHT,
      vatRate,
      totalVAT,
      totalTTC,
      totalAmount: totalTTC,
      status: 'En cours', // Le bon de commande créé a le statut 'En cours'
      paymentStatus: 'Non payé',
      notes: inquiry.notes ? `Issu de la demande de prix ${inquiry.code}. ${inquiry.notes}` : `Issu de la demande de prix ${inquiry.code}`
    };

    setPurchaseOrders(prev => [newPO, ...prev]);

    // La demande de prix est automatiquement validée (ne peut plus être modifiée ni supprimée)
    setInquiries(prev =>
      prev.map(i => i.id === inquiry.id ? { ...i, status: 'Validé' } : i)
    );

    setCurrentSection('achat-bon-commande');
    // Enchaînement : la fiche du bon créé s'ouvre pour validation (étape suivante)
    setPoToOpenDetail(newPO);
    showToast('Le bon de commande a été créé à partir de la demande de prix.');
  };

  const handleDeleteInquiry = (id: string) => {
    // Les demandes de prix validées ne peuvent plus être supprimées
    const target = inquiries.find(i => i.id === id);
    if (target?.status === 'Validé') return;
    setInquiries(prev => prev.filter(i => i.id !== id));
    if (target) showToast('La demande de prix a été supprimée avec succès.');
  };

  const handleDeleteMultipleInquiries = (ids: string[]) => {
    // Ne pas supprimer les demandes de prix validées
    const deletableCount = inquiries.filter(i => ids.includes(i.id) && i.status !== 'Validé').length;
    setInquiries(prev => prev.filter(i => !ids.includes(i.id) || i.status === 'Validé'));
    if (deletableCount > 0) showToast(`${deletableCount} demande(s) de prix supprimée(s) avec succès.`);
  };

  const handleUpdateInquiry = (updatedInquiry: PriceInquiry) => {
    // Une demande de prix est modifiable uniquement si elle est en cours
    setInquiries(prev => prev.map(i => {
      if (i.id === updatedInquiry.id && i.status === 'En cours') {
        return updatedInquiry;
      }
      return i;
    }));
    if (inquiries.some(i => i.id === updatedInquiry.id && i.status === 'En cours')) {
      showToast('La demande de prix a été modifiée avec succès.');
    }
  };

  const handleDuplicateInquiry = (inquiryToDuplicate: PriceInquiry) => {
    // Duplicable lorsqu'elle est déjà validée (ou depuis la liste)
    const duplicated: PriceInquiry = {
      ...inquiryToDuplicate,
      id: generateUniqueId('dp'),
      code: nextCode('DEV'),
      date: formatAppDate(),
      status: 'En cours', // La copie revient au statut "En cours"
      notes: inquiryToDuplicate.notes ? `[Copie de ${inquiryToDuplicate.code}] ${inquiryToDuplicate.notes}` : `Copie de la demande ${inquiryToDuplicate.code}`
    };

    setInquiries(prev => [duplicated, ...prev]);
    showToast('La demande de prix a été dupliquée avec succès.');
  };

  // Handlers for Purchase Orders
  const handleAddPurchaseOrder = (poData: Omit<PurchaseOrder, 'id'>, sourceInquiryId?: string) => {
    const newPO: PurchaseOrder = {
      ...poData,
      id: generateUniqueId('bc'),
      code: nextCode('BC')
    };
    setPurchaseOrders(prev => [newPO, ...prev]);
    showToast('Le bon de commande a été créé avec succès.');

    // Validation automatique de la demande de prix source
    const targetInqId = sourceInquiryId || poData.inquiryId;
    if (targetInqId) {
      setInquiries(prev =>
        prev.map(i => (i.id === targetInqId || (poData.inquiryCode && i.code === poData.inquiryCode))
          ? { ...i, status: 'Validé' }
          : i
        )
      );
    }
  };

  const handleUpdatePurchaseOrderStatus = (id: string, status: 'En cours' | 'Validé') => {
    setPurchaseOrders(prev => prev.map(p => p.id === id ? { ...p, status } : p));

    // Enchaînement : bon validé → la fiche de réception s'ouvre (étape suivante)
    if (status === 'Validé') {
      const po = purchaseOrders.find(p => p.id === id);
      if (po) {
        setReceptionSourcePO({ ...po, status: 'Validé' });
        setCurrentSection('achat-reception');
      }
    }
    showToast(status === 'Validé'
      ? 'Le bon de commande a été validé avec succès.'
      : 'Le bon de commande a été remis en cours.');
  };

  const handleValidatePurchaseOrderWithSettlements = (
    poId: string,
    settlements: PurchaseOrderSupplierSettlement[]
  ) => {
    const targetPO = purchaseOrders.find(p => p.id === poId);
    if (!targetPO) return;

    let totalPaid = 0;
    let totalCredit = 0;
    settlements.forEach(s => {
      totalPaid += s.paidAmount;
      totalCredit += s.creditAmount;
    });

    let paymentStatus: 'Payé' | 'Payé partiellement' | 'Non payé' = 'Payé';
    if (totalPaid === 0 && totalCredit > 0) {
      paymentStatus = 'Non payé';
    } else if (totalPaid > 0 && totalCredit > 0) {
      paymentStatus = 'Payé partiellement';
    } else {
      paymentStatus = 'Payé';
    }

    let paymentMode: 'Cash' | 'Crédit' | 'Partiel' | 'Mixte' = 'Cash';
    const modes = Array.from(new Set(settlements.map(s => s.paymentMode)));
    if (modes.length === 1) {
      paymentMode = modes[0];
    } else {
      paymentMode = 'Mixte';
    }

    // Contrôle bloquant : la caisse doit couvrir le règlement comptant
    if (totalPaid > 0) {
      const caisse = treasuryAccounts.find(a => a.name === 'Caisse Principale');
      if (caisse && caisse.balance < totalPaid) {
        alert(
          `Solde insuffisant en "Caisse Principale" (${caisse.balance.toLocaleString('fr-FR')} FCFA) pour un règlement comptant de ${totalPaid.toLocaleString('fr-FR')} FCFA.`
        );
        return;
      }
    }

    // 1. Mettre à jour le Bon de Commande
    setPurchaseOrders(prev => prev.map(p => {
      if (p.id === poId) {
        return {
          ...p,
          status: 'Validé',
          paymentStatus,
          paymentMode,
          settlements,
          validatedAt: new Date().toISOString()
        };
      }
      return p;
    }));

    // 2. Mettre à jour les Fournisseurs concernés (création des créances/dettes et cumul achats)
    setSuppliers(prev => prev.map(supp => {
      const suppSettlement = settlements.find(s => s.supplierId === supp.id);
      if (!suppSettlement) return supp;

      const newTotalPurchases = (supp.totalPurchases || 0) + suppSettlement.amount;
      const newBalance = supp.balance + suppSettlement.creditAmount;

      const existingCreditLines = supp.creditLines || [];
      let newCreditLines = [...existingCreditLines];

      if (suppSettlement.creditAmount > 0) {
        const newLine: SupplierCreditLine = {
          id: generateUniqueId('det'),
          supplierId: supp.id,
          creditNumber: `DET-${targetPO.code.replace('BC-', '')}`,
          invoiceRef: targetPO.code,
          date: suppSettlement.paymentDate || formatAppDate(),
          initialAmount: suppSettlement.amount,
          paidAmount: suppSettlement.paidAmount,
          remainingAmount: suppSettlement.creditAmount,
          status: suppSettlement.creditAmount === 0 ? 'Soldé' : 'En cours',
          notes: `Règlement bon de commande ${targetPO.code} (${suppSettlement.paymentMode})`,
          payments: suppSettlement.paidAmount > 0 ? [{
            id: generateUniqueId('pmt'),
            paymentNumber: `REG-${targetPO.code.replace('BC-', '')}-01`,
            date: suppSettlement.paymentDate || formatAppDate(),
            amount: suppSettlement.paidAmount,
            remainingAmount: suppSettlement.creditAmount,
            operator: currentUser?.name || targetPO.buyer || 'Système',
            paymentMethod: 'Espèces',
            reference: `Acompte cash ${targetPO.code}`
          }] : []
        };
        newCreditLines = [newLine, ...existingCreditLines];
      }

      return {
        ...supp,
        totalPurchases: newTotalPurchases,
        balance: newBalance,
        creditLines: newCreditLines
      };
    }));

    // 3. Enregistrer automatiquement la dépense financière et débiter la trésorerie si paiement comptant
    if (totalPaid > 0) {
      const newTx: FinancialTransaction = {
        id: generateUniqueId('tx'),
        code: nextCode('DEP'),
        date: formatAppDateTime(),
        type: 'Dépense',
        category: 'Achat marchandises',
        amount: totalPaid,
        paymentMethod: 'Espèces',
        account: 'Caisse Principale',
        reference: targetPO.code,
        thirdParty: targetPO.supplierName,
        status: 'Validé',
        recordedBy: currentUser?.name || targetPO.buyer || 'Système',
        notes: `Règlement comptant Bon de Commande ${targetPO.code}`
      };
      setTransactions(prev => [newTx, ...prev]);

      setTreasuryAccounts(prev =>
        prev.map(acc => {
          if (acc.name === 'Caisse Principale') {
            return {
              ...acc,
              balance: acc.balance - totalPaid,
              lastUpdated: formatAppDateTime()
            };
          }
          return acc;
        })
      );
    }

    logAudit(
      'po.validate',
      'purchaseOrders',
      targetPO.code,
      `Réglé ${totalPaid.toLocaleString('fr-FR')} FCFA — crédit ${totalCredit.toLocaleString('fr-FR')} FCFA`
    );

    // Enchaînement : la fiche de réception s'ouvre automatiquement (étape suivante)
    setReceptionSourcePO({ ...targetPO, status: 'Validé' });
    setCurrentSection('achat-reception');
  };

  const handleUpdatePurchaseOrder = (updatedPO: PurchaseOrder) => {
    // Un bon de commande est modifiable uniquement s'il est en cours
    setPurchaseOrders(prev => prev.map(p => {
      if (p.id === updatedPO.id && p.status === 'En cours') {
        return updatedPO;
      }
      return p;
    }));
    if (purchaseOrders.some(p => p.id === updatedPO.id && p.status === 'En cours')) {
      showToast('Le bon de commande a été modifié avec succès.');
    }
  };

  const handleDuplicatePurchaseOrder = (poToDuplicate: PurchaseOrder) => {
    // Duplicable lorsqu'il est déjà validé
    const duplicated: PurchaseOrder = {
      ...poToDuplicate,
      id: generateUniqueId('bc'),
      code: nextCode('BC'),
      date: formatAppDate(),
      status: 'En cours', // Le nouveau bon de commande créé par duplication est "En cours"
      paymentStatus: 'Non payé',
      notes: poToDuplicate.notes ? `[Copie de ${poToDuplicate.code}] ${poToDuplicate.notes}` : `Copie du bon de commande ${poToDuplicate.code}`
    };

    setPurchaseOrders(prev => [duplicated, ...prev]);
    showToast('Le bon de commande a été dupliqué avec succès.');
  };

  const handleDeletePurchaseOrder = (id: string) => {
    if (!requireStockOps()) return;
    const po = purchaseOrders.find(p => p.id === id);
    if (po && po.status !== 'En cours') {
      alert(
        `Suppression impossible : le bon de commande ${po.code} est "${po.status}". Un document validé ou réceptionné est une pièce comptable (règlement fournisseur, trésorerie, stock déjà impactés).`
      );
      return;
    }
    setPurchaseOrders(prev => prev.filter(p => p.id !== id));
    if (po) logAudit('purchaseOrder.delete', 'purchaseOrders', po.code, 'Bon de commande supprimé (statut "En cours")');
  };

  const handleDeleteMultiplePurchaseOrders = (ids: string[]) => {
    if (!requireStockOps()) return;
    const blocked = purchaseOrders.find(p => ids.includes(p.id) && p.status !== 'En cours');
    if (blocked) {
      alert(
        `Suppression impossible : le bon ${blocked.code} est "${blocked.status}". Seuls les bons de commande "En cours" peuvent être supprimés.`
      );
      return;
    }
    setPurchaseOrders(prev => prev.filter(p => !ids.includes(p.id)));
    logAudit('purchaseOrder.deleteMultiple', 'purchaseOrders', ids.join(', '), `${ids.length} bon(s) de commande supprimé(s)`);
  };

  const handleReceiveGoodsFromPO = (po: PurchaseOrder) => {
    // Garde-fou : seul un bon validé peut être réceptionné (évite le double comptage de stock)
    if (po.status !== 'Validé') {
      alert(`Seul un bon de commande "Validé" peut être réceptionné (statut actuel : "${po.status}").`);
      return;
    }

    // Ouvre la fiche de réception pré-remplie depuis le BC (saisie des dates de péremption)
    setReceptionSourcePO(po);
    setCurrentSection('achat-reception');
  };

  // Handlers for Receptions
  const handleValidateReception = (receptionId: string) => {
    const reception = receptions.find(r => r.id === receptionId);
    if (!reception || reception.status === 'Validé' || reception.status === 'Annulé') return;

    setReceptions(prev =>
      prev.map(r => r.id === receptionId ? { ...r, status: 'Validé' } : r)
    );
    logAudit(
      'reception.validate',
      'receptions',
      reception.code,
      `${reception.items.reduce((s, i) => s + (i.acceptedQty || 0), 0)} article(s) réceptionné(s) — en attente de mise en stock via approvisionnement`
    );
    // Pas de mise à jour du stock ici : la mise en stock s'effectue à la validation de l'approvisionnement
  };

  const handleAddDirectReception = (recData: Omit<GoodsReception, 'id'>) => {
    const newRec: GoodsReception = {
      ...recData,
      id: generateUniqueId('rec'),
      code: nextCode('REC')
    };
    setReceptions(prev => [newRec, ...prev]);
    showToast('La réception a été créée avec succès.');

    // If linked to a PO, mark that PO as received
    if (newRec.purchaseOrderId) {
      setPurchaseOrders(prev =>
        prev.map(p => p.id === newRec.purchaseOrderId ? { ...p, status: 'Reçu' } : p)
      );
    }

    // La réception ne met pas à jour le stock : la mise en stock s'effectue à la validation de l'approvisionnement

    // Enchaînement : la fiche d'approvisionnement s'ouvre pour cette réception (étape suivante)
    setApproTargetReceptionId(newRec.id);
    setCurrentSection('inventaire-approvisionnement');
  };

  // Annulation d'une réception : possible tant qu'elle n'a pas servi à un approvisionnement
  const handleCancelReception = (receptionId: string) => {
    if (!requireStockOps()) return;
    const reception = receptions.find(r => r.id === receptionId);
    if (!reception || reception.status === 'Annulé') return;

    const usedInAppro = approvisionnements.some(
      a => a.receptionId === reception.id || a.receptionNumber === reception.code
    );
    if (usedInAppro) {
      alert(`Annulation impossible : la réception ${reception.code} a déjà fait l'objet d'un approvisionnement.`);
      return;
    }

    if (!window.confirm(`Annuler la réception ${reception.code} ? Cette action marquera le bordereau comme "Annulé".`)) return;

    setReceptions(prev =>
      prev.map(r => r.id === receptionId ? { ...r, status: 'Annulé' } : r)
    );

    // Si la réception venait d'un bon de commande, le BC redevient réceptionnable
    if (reception.purchaseOrderId) {
      setPurchaseOrders(prev =>
        prev.map(p => p.id === reception.purchaseOrderId && p.status === 'Reçu' ? { ...p, status: 'Validé' } : p)
      );
    }

    logAudit(
      'reception.cancel',
      'receptions',
      reception.code,
      `Réception annulée (${reception.items.reduce((s, i) => s + (i.acceptedQty || 0), 0)} article(s))`
    );
  };

  const handleDeleteReception = (id: string) => {
    const rec = receptions.find(r => r.id === id);
    if (rec && rec.status === 'Validé') {
      alert(
        `Suppression impossible : la réception ${rec.code} est validée. Créez plutôt un mouvement correctif.`
      );
      return;
    }
    setReceptions(prev => prev.filter(r => r.id !== id));
    if (rec) showToast('La réception a été supprimée avec succès.');
  };

  const handleDeleteMultipleReceptions = (ids: string[]) => {
    const blocked = receptions.find(r => ids.includes(r.id) && r.status === 'Validé');
    if (blocked) {
      alert(`Suppression impossible : la réception ${blocked.code} est validée.`);
      return;
    }
    setReceptions(prev => prev.filter(r => !ids.includes(r.id)));
    const deletedCount = receptions.filter(r => ids.includes(r.id)).length;
    if (deletedCount > 0) showToast(`${deletedCount} réception(s) supprimée(s) avec succès.`);
  };

  // Handlers for Approvisionnements (Mise en stock des marchandises après réception)
  const handleAddApprovisionnement = (approData: Omit<ApprovisionnementRecord, 'id'>) => {
    // Une réception ne peut être mise en stock qu'une seule fois :
    // un second approvisionnement actif pour la même réception est refusé
    if (approData.receptionId || approData.receptionNumber) {
      const already = approvisionnements.find(
        a =>
          a.status !== 'Annulé' &&
          (a.receptionId === approData.receptionId || a.receptionNumber === approData.receptionNumber)
      );
      if (already) {
        alert(`La réception ${approData.receptionNumber} a déjà été mise en stock (${already.reference}).`);
        return false;
      }
    }
    return runOnce(`appro.create:${approData.reference || approData.receptionNumber}`, () => {
    const newAppro: ApprovisionnementRecord = {
      ...approData,
      id: generateUniqueId('app')
    };

    setApprovisionnements(prev => [newAppro, ...prev]);

    // Journal d'audit centralisé
    logAudit(
      'approvisionnement.create',
      'approvisionnements',
      newAppro.reference,
      `${newAppro.totalQuantity} article(s) mis en stock (${newAppro.destinationType}: ${newAppro.targetLocation}) suite à ${newAppro.receptionNumber}`
    );

    // Mettre à jour les stocks de produits et date de dernier réassort
    const stockAdditions = new Map<string, number>();
    newAppro.items.forEach(item => {
      stockAdditions.set(item.productId, (stockAdditions.get(item.productId) || 0) + item.quantity);
    });

    setProducts(prev =>
      prev.map(p => {
        const added = stockAdditions.get(p.id);
        if (added) {
          return {
            ...p,
            stock: p.stock + added,
            location: newAppro.targetLocation || p.location,
            lastRestocked: formatAppDate()
          };
        }
        return p;
      })
    );

    // Enregistrer les mouvements de stock réels 'Entrée'
    const newMovements: StockMovement[] = newAppro.items.map(item => ({
      id: generateUniqueId(`m_${item.productId}`),
      date: formatAppDateTime(),
      productId: item.productId,
      productName: item.productName,
      type: 'Entrée',
      quantity: item.quantity,
      reason: `Approvisionnement ${newAppro.reference} (Réc: ${newAppro.receptionNumber}) vers ${item.targetLocation || newAppro.targetLocation}`,
      reference: newAppro.reference,
      performedBy: newAppro.operator || currentUser?.name || 'Système'
    }));

    setMovements(prev => [...newMovements, ...prev]);
    return true;
    });
  };

  /**
   * Suppression définitive d'un approvisionnement :
   * - Si le document était actif (non annulé), ses quantités sont régularisées
   *   en stock (avec mouvements de sortie compensatoires) ;
   * - Le document est retiré immédiatement de la liste des approvisionnements.
   */
  const handleDeleteApprovisionnement = (id: string) => {
    const appro = approvisionnements.find(a => a.id === id);
    if (!appro) return;

    if (appro.status !== 'Annulé') {
      const withdrawals = new Map<string, number>();
      appro.items.forEach(it =>
        withdrawals.set(it.productId, (withdrawals.get(it.productId) || 0) + it.quantity)
      );

      const now = formatAppDateTime();
      const compMovements: StockMovement[] = appro.items.map(it => ({
        id: generateUniqueId(`m_${it.productId}`),
        date: now,
        productId: it.productId,
        productName: it.productName,
        type: 'Sortie',
        quantity: it.quantity,
        reason: `Suppression approvisionnement ${appro.reference}`,
        reference: appro.reference,
        performedBy: currentUser?.name || 'Système'
      }));

      setMovements(prev => [...compMovements, ...prev]);
      setProducts(prev =>
        prev.map(p => {
          const w = withdrawals.get(p.id);
          return w && p.isStockable !== false ? { ...p, stock: Math.max(0, p.stock - w) } : p;
        })
      );
    }

    // Retrait immédiat et définitif de la liste
    setApprovisionnements(prev => prev.filter(a => a.id !== id));
    logAudit(
      'approvisionnement.delete',
      'approvisionnements',
      appro.reference,
      `Approvisionnement supprimé (${appro.totalQuantity} article(s) régularisés)`
    );
  };

  // Handlers for Storage Sites (Magasins & Rayons de stockage)
  const handleAddStorageSite = (siteData: Omit<StorageSite, 'id' | 'createdAt'>) => {
    const newSite: StorageSite = {
      ...siteData,
      id: generateUniqueId('site'),
      createdAt: new Date().toISOString()
    };
    setStorageSites(prev => [newSite, ...prev]);
    logAudit(
      'storage-site.create',
      'storageSites',
      newSite.name,
      `${newSite.type} "${newSite.name}" créé${newSite.type === 'Magasin' ? ` — capacité ${newSite.capacity ?? 0} u` : ` — ${newSite.shelfCount ?? 0} étagère(s)`}`
    );
    return true;
  };

  // Handlers for Stock Valuation (états clôturés archivés)
  const handleSaveValuation = (recData: Omit<StockValuationRecord, 'id' | 'code'>) => {
    const newRec: StockValuationRecord = {
      ...recData,
      id: generateUniqueId('val'),
      code: nextCode('VAL')
    };
    setValuations(prev => [newRec, ...prev]);
    logAudit(
      'valuation.close',
      'valuations',
      newRec.code,
      `Valorisation ${newRec.valuationDate} (${newRec.method}) clôturée — ${newRec.articleCount} article(s), ${newRec.totalValue.toLocaleString('fr-FR')} FCFA`
    );
  };

  const handleDeleteValuation = (id: string) => {
    const target = valuations.find(v => v.id === id);
    setValuations(prev => prev.filter(v => v.id !== id));
    logAudit('valuation.delete', 'valuations', target?.code || id);
  };

  // Handlers for Physical Inventory
  // Crée (id/code générés) ou met à jour un inventaire ; retourne la fiche enregistrée
  const handleSaveInventory = (inv: PhysicalInventory): PhysicalInventory => {
    const isNew = !inv.id;
    const saved: PhysicalInventory = inv.id
      ? inv
      : { ...inv, id: generateUniqueId('inv'), code: nextCode('INV') };
    setInventories(prev => {
      const exists = prev.some(i => i.id === saved.id);
      return exists ? prev.map(i => (i.id === saved.id ? saved : i)) : [saved, ...prev];
    });
    showToast(isNew
      ? 'L’inventaire physique a été créé avec succès.'
      : 'L’inventaire physique a été enregistré avec succès.');
    return saved;
  };

  const handleDeleteInventory = (id: string) => {
    const target = inventories.find(i => i.id === id);
    if (!target || target.status !== 'Brouillon') return; // seul un brouillon est supprimable
    setInventories(prev => prev.filter(i => i.id !== id));
    logAudit('inventory.delete', 'physicalInventories', target.code);
  };

  /**
   * Régularisation : applique les écarts de l'inventaire validé au stock réel.
   * - écart > 0 → mouvement 'Entrée', écart < 0 → 'Sortie' (référence = code inventaire)
   * - atomique : si une ligne rendrait un stock négatif, RIEN n'est appliqué (retour false)
   * - anti double application : refuse si déjà clôturé/régularisé
   */
  const handleApplyInventoryAdjustments = (invId: string): boolean =>
    runOnce(`inv.adjust:${invId}`, () => {
    if (!requireStockOps()) return false;
    const inv = inventories.find(i => i.id === invId);
    if (!inv || inv.status !== 'Validé' || inv.adjustmentsApplied) return false;

    const adjustments = buildAdjustmentMovements(inv, currentUser?.name || 'Système', formatAppDateTime());
    const deltas = new Map<string, number>();
    adjustments.forEach(a => deltas.set(a.productId, (deltas.get(a.productId) || 0) + a.quantityChange));

    // Pré-contrôle : aucun stock ne doit devenir négatif
    for (const [productId, delta] of deltas) {
      const product = products.find(p => p.id === productId);
      if (!product || product.stock + delta < 0) return false;
    }

    const now = formatAppDateTime();
    const newMovements: StockMovement[] = adjustments.map(a => ({
      ...a.movement,
      id: generateUniqueId(`m_${a.productId}`)
    }));

    setMovements(prev => [...newMovements, ...prev]);
    setProducts(prev =>
      prev.map(p => {
        const delta = deltas.get(p.id);
        return delta ? { ...p, stock: p.stock + delta } : p;
      })
    );
    setInventories(prev =>
      prev.map(i =>
        i.id === invId
          ? {
              ...i,
              status: 'Clôturé',
              adjustmentsApplied: true,
              closedAt: now,
              endDate: i.endDate || formatAppDate(),
              items: i.items.map(it => (it.discrepancy != null && it.discrepancy !== 0 ? { ...it, adjusted: true } : it))
            }
          : i
      )
    );
    logAudit(
      'inventory.adjust',
      'physicalInventories',
      inv.code,
      `${adjustments.length} mouvement(s) de régularisation généré(s) — écart total ${inv.totalDiscrepancyValue.toLocaleString('fr-FR')} FCFA`
    );
    return true;
  });

  // Handlers for Stock Adjustments (Ajustement de produits)
  // Crée (id/code générés) ou met à jour un ajustement ; retourne le document enregistré
  const handleSaveAdjustment = (adj: StockAdjustment): StockAdjustment => {
    const isNew = !adj.id;
    const saved: StockAdjustment = adj.id
      ? adj
      : { ...adj, id: generateUniqueId('adj'), code: nextCode('ADJ') };
    setStockAdjustments(prev => {
      const exists = prev.some(a => a.id === saved.id);
      return exists ? prev.map(a => (a.id === saved.id ? saved : a)) : [saved, ...prev];
    });
    showToast(isNew
      ? 'L’ajustement de stock a été créé avec succès.'
      : 'L’ajustement de stock a été enregistré avec succès.');
    return saved;
  };

  const handleDeleteAdjustment = (id: string) => {
    const target = stockAdjustments.find(a => a.id === id);
    if (!target || target.status !== 'Brouillon') return; // seul un brouillon est supprimable
    setStockAdjustments(prev => prev.filter(a => a.id !== id));
    logAudit('adjustment.delete', 'stockAdjustments', target.code);
  };

  /**
   * Validation : écart > 0 → mouvement 'Entrée', écart < 0 → 'Sortie' (référence = code ADJ).
   * Atomique : pré-contrôle des stocks négatifs, tout ou rien. Anti double validation.
   */
  const handleValidateAdjustment = (id: string): boolean =>
    runOnce(`adj.validate:${id}`, () => {
    if (!requireStockOps()) return false;
    const adj = stockAdjustments.find(a => a.id === id);
    if (!adj || adj.status !== 'Brouillon') return false;

    const applied = buildAdjustmentDocMovements(adj, currentUser?.name || 'Système', formatAppDateTime());
    const deltas = new Map<string, number>();
    applied.forEach(a => deltas.set(a.productId, (deltas.get(a.productId) || 0) + a.quantityChange));

    for (const [productId, delta] of deltas) {
      const product = products.find(p => p.id === productId);
      if (!product || product.stock + delta < 0) return false;
    }

    const now = formatAppDateTime();
    const newMovements: StockMovement[] = applied.map(a => ({
      ...a.movement,
      id: generateUniqueId(`m_${a.productId}`)
    }));
    const s = summarizeAdjustment(adj.lines, adj.generalReason);

    setMovements(prev => [...newMovements, ...prev]);
    setProducts(prev =>
      prev.map(p => {
        const delta = deltas.get(p.id);
        return delta ? { ...p, stock: p.stock + delta } : p;
      })
    );
    setStockAdjustments(prev =>
      prev.map(a =>
        a.id === id
          ? {
              ...a,
              status: 'Validé',
              validatedBy: currentUser?.name || 'Système',
              validatedAt: now,
              totalPositiveQty: s.totalPositiveQty,
              totalNegativeQty: s.totalNegativeQty,
              totalDiscrepancyValue: s.totalDiscrepancyValue
            }
          : a
      )
    );
    logAudit(
      'adjustment.validate',
      'stockAdjustments',
      adj.code,
      `${applied.length} mouvement(s) de régularisation — valeur nette ${s.totalDiscrepancyValue.toLocaleString('fr-FR')} FCFA`
    );
    return true;
  });

  /**
   * Annulation d'un ajustement validé : contre-passation traçable (mouvements inverses),
   * le document n'est jamais supprimé.
   */
  const handleCancelAdjustment = (id: string, reason: string): boolean =>
    runOnce(`adj.cancel:${id}`, () => {
    if (!requireStockOps()) return false;
    const adj = stockAdjustments.find(a => a.id === id);
    if (!adj || adj.status !== 'Validé') return false;

    const withReason = { ...adj, cancelReason: reason };
    const applied = buildCompensationMovements(withReason, currentUser?.name || 'Système', formatAppDateTime());
    const deltas = new Map<string, number>();
    applied.forEach(a => deltas.set(a.productId, (deltas.get(a.productId) || 0) + a.quantityChange));

    for (const [productId, delta] of deltas) {
      const product = products.find(p => p.id === productId);
      if (!product || product.stock + delta < 0) return false;
    }

    const now = formatAppDateTime();
    const newMovements: StockMovement[] = applied.map(a => ({
      ...a.movement,
      id: generateUniqueId(`m_${a.productId}`)
    }));

    setMovements(prev => [...newMovements, ...prev]);
    setProducts(prev =>
      prev.map(p => {
        const delta = deltas.get(p.id);
        return delta ? { ...p, stock: p.stock + delta } : p;
      })
    );
    setStockAdjustments(prev =>
      prev.map(a =>
        a.id === id
          ? { ...a, status: 'Annulé', cancelledBy: currentUser?.name || 'Système', cancelledAt: now, cancelReason: reason }
          : a
      )
    );
    logAudit('adjustment.cancel', 'stockAdjustments', adj.code, reason);
    return true;
  });

  // Handlers for Stock Transfers (Transferts inter-dépôts)
  /**
   * Création : marchandises expédiées → mouvements 'Sortie' (en transit).
   * Pré-contrôle atomique des stocks disponibles — tout ou rien.
   */
  const handleCreateTransfer = (t: StockTransfer): { ok: boolean; error?: string } => {
    if (!canManageStockOps) return { ok: false, error: 'Opération réservée à un rôle gestionnaire.' };
    for (const item of t.items) {
      const p = products.find(x => x.id === item.productId);
      if (!p) return { ok: false, error: `Article introuvable : ${item.productName}` };
      if (item.quantity <= 0) return { ok: false, error: `Quantité invalide pour ${p.name}` };
      if (item.quantity > p.stock) return { ok: false, error: `Stock insuffisant pour ${p.name} : ${p.stock} disponible(s), ${item.quantity} demandée(s)` };
    }
    const now = formatAppDateTime();
    const saved: StockTransfer = { ...t, id: generateUniqueId('trf'), code: nextCode('TRF') };
    const shipMovements: StockMovement[] = buildShipMovements(saved, currentUser?.name || 'Système', now)
      .map(m => ({ ...m, id: generateUniqueId(`m_${m.productId}`) }));

    setMovements(prev => [...shipMovements, ...prev]);
    setProducts(prev =>
      prev.map(p => {
        const item = saved.items.find(i => i.productId === p.id);
        return item ? { ...p, stock: p.stock - item.quantity } : p;
      })
    );
    setStockTransfers(prev => [saved, ...prev]);
    logAudit(
      'transfer.create', 'stockTransfers', saved.code,
      `${saved.sourceLocation} → ${saved.targetLocation} : ${saved.items.length} article(s), ${(saved.totalValue || 0).toLocaleString('fr-FR')} FCFA`
    );
    return { ok: true };
  };

  /**
   * Réception au dépôt cible : les quantités réintègrent le stock
   * (mouvements 'Entrée' au CUMP figé à l'expédition — aucune valeur créée).
   * Si tout le stock du produit a été transféré, son emplacement suit la destination.
   */
  const handleReceiveTransfer = (id: string): boolean =>
    runOnce(`trf.receive:${id}`, () => {
    if (!requireStockOps()) return false;
    const t = stockTransfers.find(x => x.id === id);
    if (!t || t.status !== 'En transit') return false;
    const now = formatAppDateTime();
    const receiveMovements: StockMovement[] = buildReceiveMovements(t, currentUser?.name || 'Système', now)
      .map(m => ({ ...m, id: generateUniqueId(`m_${m.productId}`) }));

    setMovements(prev => [...receiveMovements, ...prev]);
    setProducts(prev =>
      prev.map(p => {
        const item = t.items.find(i => i.productId === p.id);
        if (!item) return p;
        const fullyMoved = p.stock <= 0; // tout le stock résiduel était en transit
        return { ...p, stock: p.stock + item.quantity, location: fullyMoved ? t.targetLocation : p.location };
      })
    );
    setStockTransfers(prev =>
      prev.map(x => x.id === id ? { ...x, status: 'Réceptionné', receivedBy: currentUser?.name || 'Système', receivedAt: now } : x)
    );
    logAudit('transfer.receive', 'stockTransfers', t.code, `Reçu à ${t.targetLocation}`);
    return true;
  });

  /** Annulation d'un transfert en transit : retour traçable au dépôt source. */
  const handleCancelTransfer = (id: string, reason: string): boolean =>
    runOnce(`trf.cancel:${id}`, () => {
    if (!requireStockOps()) return false;
    const t = stockTransfers.find(x => x.id === id);
    if (!t || t.status !== 'En transit') return false;
    const now = formatAppDateTime();
    const cancelled = { ...t, cancelReason: reason };
    const cancelMovements: StockMovement[] = buildTransferCancelMovements(cancelled, currentUser?.name || 'Système', now)
      .map(m => ({ ...m, id: generateUniqueId(`m_${m.productId}`) }));

    setMovements(prev => [...cancelMovements, ...prev]);
    setProducts(prev =>
      prev.map(p => {
        const item = t.items.find(i => i.productId === p.id);
        return item ? { ...p, stock: p.stock + item.quantity } : p;
      })
    );
    setStockTransfers(prev =>
      prev.map(x => x.id === id ? { ...x, status: 'Annulé', cancelledBy: currentUser?.name || 'Système', cancelledAt: now, cancelReason: reason } : x)
    );
    logAudit('transfer.cancel', 'stockTransfers', t.code, reason);
    return true;
  });

  const handleDeleteTransfer = (id: string) => {
    const t = stockTransfers.find(x => x.id === id);
    if (!t || t.status === 'Réceptionné') return; // un transfert reçu fait partie de l'historique
    setStockTransfers(prev => prev.filter(x => x.id !== id));
    logAudit('transfer.delete', 'stockTransfers', t.code);
  };

  // Handlers for Stock Losses (Pertes, casses & avariés)
  const handleDeclareLoss = (l: StockAvarieLoss): StockAvarieLoss => {
    const saved: StockAvarieLoss = { ...l, id: generateUniqueId('loss'), code: nextCode('DEC') };
    setStockLosses(prev => [saved, ...prev]);
    logAudit('loss.declare', 'stockLosses', saved.code, `${l.quantity} × ${l.productName} (${l.type})`);
    return saved;
  };

  /**
   * Déstockage : mouvement 'Périmé/Casse' + sortie du stock.
   * Bloqué si la déclaration est déjà déstockée ou si le stock deviendrait négatif.
   */
  const handleDestockLoss = (id: string): boolean =>
    runOnce(`loss.destock:${id}`, () => {
    if (!requireStockOps()) return false;
    const l = stockLosses.find(x => x.id === id);
    if (!l || l.status !== 'Constaté') return false;
    const p = products.find(x => x.id === l.productId);
    if (!p || p.stock - l.quantity < 0) return false;

    const now = formatAppDateTime();
    const mv: StockMovement = {
      ...buildDestockMovement(l, currentUser?.name || 'Système', now),
      id: generateUniqueId(`m_${l.productId}`)
    };
    setMovements(prev => [mv, ...prev]);
    setProducts(prev => prev.map(x => x.id === l.productId ? { ...x, stock: x.stock - l.quantity } : x));
    setStockLosses(prev =>
      prev.map(x => x.id === id ? { ...x, status: 'Déstocké', destockedBy: currentUser?.name || 'Système', destockedAt: now } : x)
    );
    logAudit('loss.destock', 'stockLosses', l.code, `${l.quantity} × ${l.productName} — ${l.totalLossValue.toLocaleString('fr-FR')} FCFA`);
    return true;
  });

  const handleDeleteLoss = (id: string) => {
    const l = stockLosses.find(x => x.id === id);
    if (!l || l.status !== 'Constaté') return; // déstockée = historique de mouvements
    setStockLosses(prev => prev.filter(x => x.id !== id));
    logAudit('loss.delete', 'stockLosses', l.code);
  };

  // ---- Handlers for Customer Returns (Retours clients) ----

  const handleSaveCustomerReturn = (r: CustomerReturn): CustomerReturn => {
    const isNew = !r.id;
    const saved: CustomerReturn = r.id
      ? r
      : { ...r, id: generateUniqueId('rc'), code: nextCode('RC') };
    setCustomerReturns(prev => {
      const exists = prev.some(x => x.id === saved.id);
      return exists ? prev.map(x => (x.id === saved.id ? saved : x)) : [saved, ...prev];
    });
    showToast(isNew ? 'Le retour client a été créé avec succès.' : 'Le retour client a été enregistré avec succès.');
    return saved;
  };

  const handleDeleteCustomerReturn = (id: string) => {
    const target = customerReturns.find(r => r.id === id);
    if (!target || target.status !== 'Brouillon') return; // seul un brouillon est supprimable
    setCustomerReturns(prev => prev.filter(r => r.id !== id));
    logAudit('return.customer.delete', 'customerReturns', target.code);
  };

  /**
   * Validation d'un retour client : les lignes « restock » réintègrent le stock
   * au coût d'achat figé sur la vente. Le montant retourné déduit d'abord le
   * crédit client (vente à crédit), le reste devient un avoir AV-xxx.
   */
  const handleValidateCustomerReturn = (id: string): boolean =>
    runOnce(`rc.validate:${id}`, () => {
      if (!requireStockOps()) return false;
      const ret = customerReturns.find(r => r.id === id);
      if (!ret || ret.status !== 'Brouillon' || ret.items.length === 0) return false;
      if (!ret.items.some(i => i.returnedQty > 0)) return false;

      const now = formatAppDateTime();
      const operator = currentUser?.name || 'Système';
      const sale = saleOrders.find(s => s.id === ret.saleId);
      const wasCredit = sale?.paymentMethod === 'Crédit';

      const additions = new Map<string, number>();
      ret.items.filter(i => i.restock && i.returnedQty > 0).forEach(i =>
        additions.set(i.productId, (additions.get(i.productId) || 0) + i.returnedQty)
      );

      const avoirNumber = nextCode('AV');
      let creditDeduction = 0;
      let avoirAmount = ret.totalAmount;
      if (ret.clientId) {
        const client = clients.find(c => c.id === ret.clientId);
        if (client) {
          const res = applyCustomerReturnToClient(client, ret, wasCredit, avoirNumber, now);
          creditDeduction = res.creditDeduction;
          avoirAmount = res.avoirAmount;
          setClients(prev => prev.map(c => (c.id === client.id ? res.client : c)));
        }
      }

      const newMovements = buildCustomerReturnMovements(ret, operator, now);
      setMovements(prev => [...newMovements, ...prev]);
      setProducts(prev =>
        prev.map(p => {
          const a = additions.get(p.id);
          return a ? { ...p, stock: p.stock + a } : p;
        })
      );
      setCustomerReturns(prev =>
        prev.map(r =>
          r.id === id
            ? {
                ...r,
                status: 'Validé',
                validatedBy: operator,
                validatedAt: now,
                creditDeduction,
                avoirAmount,
                avoirNumber: avoirAmount > 0 ? avoirNumber : undefined
              }
            : r
        )
      );
      logAudit(
        'return.customer.validate',
        'customerReturns',
        ret.code,
        `${ret.totalAmount.toLocaleString('fr-FR')} FCFA — ${additions.size} article(s) réintégré(s), avoir ${avoirAmount.toLocaleString('fr-FR')} FCFA`
      );
      return true;
    });

  /** Annulation d'un retour client validé : contre-passation + restauration client. */
  const handleCancelCustomerReturn = (id: string, reason: string): boolean =>
    runOnce(`rc.cancel:${id}`, () => {
      if (!requireStockOps()) return false;
      const ret = customerReturns.find(r => r.id === id);
      if (!ret || ret.status !== 'Validé') return false;

      // Avoir entamé → annulation impossible (intégrité financière)
      if (ret.clientId && ret.avoirNumber) {
        const client = clients.find(c => c.id === ret.clientId);
        const reverted = client ? revertCustomerReturnOnClient(client, ret) : null;
        if (client && !reverted) {
          alert(`Annulation impossible : l'avoir ${ret.avoirNumber} a déjà été partiellement remboursé ou utilisé.`);
          return false;
        }
        if (reverted) setClients(prev => prev.map(c => (c.id === client!.id ? reverted : c)));
      } else if (ret.clientId && !ret.avoirNumber) {
        const client = clients.find(c => c.id === ret.clientId);
        if (client) {
          const reverted = revertCustomerReturnOnClient(client, ret);
          if (reverted) setClients(prev => prev.map(c => (c.id === client.id ? reverted : c)));
        }
      }

      // Pré-contrôle : les réintégrations doivent pouvoir ressortir sans stock négatif
      const withdrawals = new Map<string, number>();
      ret.items.filter(i => i.restock && i.returnedQty > 0).forEach(i =>
        withdrawals.set(i.productId, (withdrawals.get(i.productId) || 0) + i.returnedQty)
      );
      for (const [productId, qty] of withdrawals) {
        const p = products.find(x => x.id === productId);
        if (!p || p.stock - qty < 0) {
          alert(`Annulation impossible : retirer ${qty} × ${p?.name || productId} rendrait le stock négatif.`);
          return false;
        }
      }

      const now = formatAppDateTime();
      const operator = currentUser?.name || 'Système';
      const compMovements = buildCustomerReturnCancelMovements(ret, operator, now);
      setMovements(prev => [...compMovements, ...prev]);
      setProducts(prev =>
        prev.map(p => {
          const w = withdrawals.get(p.id);
          return w ? { ...p, stock: p.stock - w } : p;
        })
      );
      setCustomerReturns(prev =>
        prev.map(r =>
          r.id === id
            ? { ...r, status: 'Annulé', cancelledBy: operator, cancelledAt: now, cancelReason: reason }
            : r
        )
      );
      logAudit('return.customer.cancel', 'customerReturns', ret.code, reason);
      return true;
    });

  // ---- Handlers for Supplier Returns (Retours fournisseurs) ----

  const handleSaveSupplierReturn = (r: SupplierReturn): SupplierReturn => {
    const isNew = !r.id;
    const saved: SupplierReturn = r.id
      ? r
      : { ...r, id: generateUniqueId('rf'), code: nextCode('RF') };
    setSupplierReturns(prev => {
      const exists = prev.some(x => x.id === saved.id);
      return exists ? prev.map(x => (x.id === saved.id ? saved : x)) : [saved, ...prev];
    });
    showToast(isNew ? 'Le retour fournisseur a été créé avec succès.' : 'Le retour fournisseur a été enregistré avec succès.');
    return saved;
  };

  const handleDeleteSupplierReturn = (id: string) => {
    const target = supplierReturns.find(r => r.id === id);
    if (!target || target.status !== 'Brouillon') return;
    setSupplierReturns(prev => prev.filter(r => r.id !== id));
    logAudit('return.supplier.delete', 'supplierReturns', target.code);
  };

  /**
   * Validation d'un retour fournisseur : mouvements 'Sortie' (consomment les
   * couches CUMP/FIFO). Le montant déduit d'abord la dette fournisseur,
   * le reste devient un avoir AVF-xxx. Pré-contrôle atomique des stocks.
   */
  const handleValidateSupplierReturn = (id: string): boolean =>
    runOnce(`rf.validate:${id}`, () => {
      if (!requireStockOps()) return false;
      const ret = supplierReturns.find(r => r.id === id);
      if (!ret || ret.status !== 'Brouillon' || ret.items.length === 0) return false;

      const withdrawals = new Map<string, number>();
      ret.items.filter(i => i.returnedQty > 0).forEach(i =>
        withdrawals.set(i.productId, (withdrawals.get(i.productId) || 0) + i.returnedQty)
      );
      if (withdrawals.size === 0) return false;
      for (const [productId, qty] of withdrawals) {
        const p = products.find(x => x.id === productId);
        if (!p || p.stock - qty < 0) return false; // tout ou rien
      }

      const now = formatAppDateTime();
      const operator = currentUser?.name || 'Système';
      const avoirNumber = nextCode('AVF');

      let debtDeduction = 0;
      let avoirAmount = ret.totalAmount;
      const supplier = suppliers.find(s => s.id === ret.supplierId);
      if (supplier) {
        const res = applySupplierReturnToSupplier(supplier, ret, avoirNumber, now);
        debtDeduction = res.debtDeduction;
        avoirAmount = res.avoirAmount;
        setSuppliers(prev => prev.map(s => (s.id === supplier.id ? res.supplier : s)));
      }

      const newMovements = buildSupplierReturnMovements(ret, operator, now);
      setMovements(prev => [...newMovements, ...prev]);
      setProducts(prev =>
        prev.map(p => {
          const w = withdrawals.get(p.id);
          return w ? { ...p, stock: p.stock - w } : p;
        })
      );
      setSupplierReturns(prev =>
        prev.map(r =>
          r.id === id
            ? {
                ...r,
                status: 'Validé',
                validatedBy: operator,
                validatedAt: now,
                debtDeduction,
                avoirAmount,
                avoirNumber: avoirAmount > 0 ? avoirNumber : undefined
              }
            : r
        )
      );
      logAudit(
        'return.supplier.validate',
        'supplierReturns',
        ret.code,
        `${ret.totalAmount.toLocaleString('fr-FR')} FCFA — ${withdrawals.size} article(s) renvoyé(s), dette −${debtDeduction.toLocaleString('fr-FR')} FCFA`
      );
      return true;
    });

  /** Annulation d'un retour fournisseur validé : les quantités réintègrent le stock. */
  const handleCancelSupplierReturn = (id: string, reason: string): boolean =>
    runOnce(`rf.cancel:${id}`, () => {
      if (!requireStockOps()) return false;
      const ret = supplierReturns.find(r => r.id === id);
      if (!ret || ret.status !== 'Validé') return false;

      const supplier = suppliers.find(s => s.id === ret.supplierId);
      if (supplier) {
        const reverted = revertSupplierReturnOnSupplier(supplier, ret);
        if (!reverted) {
          alert(`Annulation impossible : l'avoir ${ret.avoirNumber} a déjà été partiellement remboursé ou utilisé.`);
          return false;
        }
        setSuppliers(prev => prev.map(s => (s.id === supplier.id ? reverted : s)));
      }

      const now = formatAppDateTime();
      const operator = currentUser?.name || 'Système';
      const additions = new Map<string, number>();
      ret.items.filter(i => i.returnedQty > 0).forEach(i =>
        additions.set(i.productId, (additions.get(i.productId) || 0) + i.returnedQty)
      );
      const compMovements = buildSupplierReturnCancelMovements(ret, operator, now);
      setMovements(prev => [...compMovements, ...prev]);
      setProducts(prev =>
        prev.map(p => {
          const a = additions.get(p.id);
          return a ? { ...p, stock: p.stock + a } : p;
        })
      );
      setSupplierReturns(prev =>
        prev.map(r =>
          r.id === id
            ? { ...r, status: 'Annulé', cancelledBy: operator, cancelledAt: now, cancelReason: reason }
            : r
        )
      );
      logAudit('return.supplier.cancel', 'supplierReturns', ret.code, reason);
      return true;
    });

  const handleDeleteStorageSite = (id: string) => {
    setStorageSites(prev => prev.filter(s => s.id !== id));
    logAudit('storage-site.delete', 'storageSites', id);
  };

  // Handlers for Points de Vente (Sessions de caisse)
  const handleOpenPointDeVente = (data: {
    code: string;
    date: string;
    operator: string;
    openingAmount: number;
    openedAt: string;
    notes?: string;
  }): boolean => {
    const canOpenMultiple = canOpenMultipleCashRegisters(currentUser?.role);
    const operator = currentUser?.role === 'Caissier'
      ? currentUser.name || currentUser.username
      : data.operator;
    const alreadyOpen = canOpenMultiple
      ? undefined
      : pointsDeVente.find(p => p.status === 'En cours');
    if (!canOpenMultiple && alreadyOpen) {
      alert(
          `La caisse ${alreadyOpen.code} (${alreadyOpen.operator}) est déjà ouverte. Seuls un Responsable Agence ou un Administrateur peuvent ouvrir plusieurs caisses simultanément.`
      );
      return false;
    }
    const newPV: PointDeVente = {
      id: generateUniqueId('pv'),
      code: data.code,
      date: data.date,
      operator,
      ...(currentUser?.role === 'Caissier' ? { occupiedBy: currentUser.id } : {}),
      openingAmount: data.openingAmount,
      openedAt: data.openedAt,
      status: 'En cours',
      sales: [],
      totalSalesAmount: 0,
      cashSalesAmount: 0,
      creditSalesAmount: 0,
      mobileSalesAmount: 0,
      cardSalesAmount: 0,
      expectedClosingAmount: data.openingAmount,
      notes: data.notes
    };
    setPointsDeVente(prev => [newPV, ...prev]);
    setSelectedPointDeVenteId(newPV.id);
    showToast('La session de caisse a été ouverte avec succès.');
    return true;
  };

  const handleClosePointDeVente = (
    pvId: string,
    closingAmount: number,
    closedAt: string,
    notes?: string
  ) => {
    const pv = pointsDeVente.find(p => p.id === pvId);
    if (!pv) return;

    // Espèces encaissées dérivées de saleOrders (source unique de vérité)
    const cashSales = saleOrders
      .filter(
        s =>
          s.status !== 'Annulé' &&
          s.status !== 'En cours' &&
          s.paymentMethod === 'Espèces' &&
          (s.pointDeVenteId === pvId || (!!pv.code && s.pointDeVenteCode === pv.code))
      )
      .reduce((sum, s) => sum + (s.finalAmount || s.totalAmount), 0);
    const expectedClosing = pv.openingAmount + cashSales;
    const cashDiff = closingAmount - expectedClosing;

    setPointsDeVente(prev =>
      prev.map(p => {
        if (p.id === pvId) {
          const { occupiedBy: _occupiedBy, ...session } = p;
          return {
            ...session,
            closingAmount,
            closedAt,
            status: 'Fermé' as const,
            expectedClosingAmount: expectedClosing,
            cashDifference: cashDiff,
            notes: notes ? (p.notes ? `${p.notes}\n${notes}` : notes) : p.notes
          };
        }
        return p;
      })
    );
    if (selectedPointDeVenteId === pvId) setSelectedPointDeVenteId(null);
    showToast('La session de caisse a été clôturée avec succès.');
  };

  // Handlers for POS Sales
  // Retourne la vente créée, ou false si l'encaissement est refusé (stock insuffisant)
  const handleCompleteSale = (saleData: Omit<SaleOrder, 'id' | 'code'>, cartItems: CartItem[]): SaleOrder | false => {
    if (!canUseCashRegister(activePointDeVente, currentUser)) {
      showToast('Sélectionnez une caisse ouverte et disponible avant de procéder à un encaissement.', 'error');
      return false;
    }

    // Contrôle bloquant : la demande est agrégée par produit (un même produit
    // peut figurer sur plusieurs lignes du panier, ex: UOV différentes)
    const demandedByProduct = new Map<string, number>();
    cartItems.forEach(item => {
      demandedByProduct.set(
        item.product.id,
        (demandedByProduct.get(item.product.id) || 0) + item.quantity
      );
    });
    for (const [productId, qty] of demandedByProduct) {
      const p = products.find(x => x.id === productId);
      if (p && p.isStockable !== false && qty > p.stock) {
        alert(
          `Stock insuffisant pour "${p.name}" : ${qty} demandé(s), ${p.stock} disponible(s).`
        );
        return false;
      }
    }

    // Find active Point de Vente ('En cours') for current cashier or overall
    const activePV = activePointDeVente;

    const newSale: SaleOrder = {
      ...saleData,
      id: generateUniqueId('vte'),
      code: nextCode('VTE'),
      // Coût d'achat figé au moment de la vente : les marges historiques
      // ne bougent plus si le prix d'achat du produit change ensuite
      items: saleData.items.map(it => ({
        ...it,
        buyPrice: it.buyPrice ?? products.find(p => p.id === it.productId)?.buyPrice ?? 0
      })),
      pointDeVenteId: saleData.pointDeVenteId || activePV?.id,
      pointDeVenteCode: saleData.pointDeVenteCode || activePV?.code,
      sellerName: saleData.sellerName || currentUser?.name || activePV?.operator || 'Caissier'
    };
    setSaleOrders(prev => [newSale, ...prev]);
    logAudit(
      'sale.create',
      'saleOrders',
      newSale.code,
      `${newSale.finalAmount.toLocaleString('fr-FR')} FCFA — ${newSale.paymentMethod} — ${newSale.items.length} article(s)`
    );

    // Les lignes de vente de la session sont dérivées de saleOrders
    // (memo pointsDeVenteWithSales) — plus d'écriture dans pv.sales.

    // Batch deduct stock for each item sold
    const deductions = new Map<string, number>();
    cartItems.forEach(item => {
      deductions.set(item.product.id, (deductions.get(item.product.id) || 0) + item.quantity);
    });

    setProducts(prev =>
      prev.map(p => {
        const deduct = deductions.get(p.id);
        if (deduct && p.isStockable !== false) {
          return {
            ...p,
            stock: p.stock - deduct
          };
        }
        return p;
      })
    );

    // Batch record stock exit movement with guaranteed unique IDs
    const newMovements: StockMovement[] = cartItems
      .filter(item => item.product.isStockable !== false)
      .map(item => ({
        id: generateUniqueId(`m_${item.product.id}`),
        date: formatAppDateTime(),
        productId: item.product.id,
        productName: item.product.name,
        type: 'Sortie',
        quantity: item.quantity,
        reason: `Vente caisse POS ${newSale.code}`,
        reference: newSale.code,
        performedBy: newSale.sellerName
      }));

    setMovements(prev => [...newMovements, ...prev]);

    // Update Client metrics: total purchases for ANY payment method, and credit balance if payment is Crédit
    if (newSale.clientId) {
      setClients(prev =>
        prev.map(c => {
          if (c.id === newSale.clientId) {
            return {
              ...c,
              creditBalance: newSale.paymentMethod === 'Crédit' ? c.creditBalance + newSale.finalAmount : c.creditBalance,
              totalPurchases: c.totalPurchases + newSale.finalAmount
            };
          }
          return c;
        })
      );
    }

    // Auto-record financial revenue transaction and increment treasury account (for Cash, Mobile Money, Card)
    if (newSale.paymentMethod !== 'Crédit') {
      const paymentToAccountMap: Record<string, string> = {
        'Espèces': 'Caisse Point de Vente (POS)',
        'Mobile Money': 'Compte Mobile Money',
        'Carte': 'Banque BICICI'
      };
      const targetAccount = paymentToAccountMap[newSale.paymentMethod] || 'Caisse Point de Vente (POS)';

      const newTx: FinancialTransaction = {
        id: generateUniqueId('tx'),
        code: nextCode('REC'),
        date: newSale.date,
        type: 'Recette',
        category: 'Vente marchandises',
        amount: newSale.finalAmount,
        paymentMethod: newSale.paymentMethod === 'Carte' ? 'Carte' : newSale.paymentMethod === 'Mobile Money' ? 'Mobile Money' : 'Espèces',
        account: targetAccount,
        reference: newSale.code,
        thirdParty: newSale.clientName,
        status: 'Validé',
        recordedBy: newSale.sellerName,
        notes: `Encaissement vente caisse POS ${newSale.code}`
      };
      setTransactions(prev => [newTx, ...prev]);

      setTreasuryAccounts(prev =>
        prev.map(acc => {
          if (acc.name === targetAccount) {
            return {
              ...acc,
              balance: acc.balance + newSale.finalAmount,
              lastUpdated: formatAppDateTime()
            };
          }
          return acc;
        })
      );
    }
    return newSale;
  };

  // Commande POS mise en attente au changement de page (brouillon "En cours" :
  // pas de déduction de stock ni d'impact sur les totaux tant qu'elle n'est pas encaissée)
  const handleParkSaleOrder = (saleData: Omit<SaleOrder, 'id' | 'code'>) => {
    const draft: SaleOrder = {
      ...saleData,
      id: generateUniqueId('vte'),
      code: nextCode('VTE'),
      status: 'En cours'
    };
    setSaleOrders(prev => [draft, ...prev]);
    showToast('La commande a été mise en attente avec succès.');
  };

  // Reprise d'un brouillon : on le retire de la liste (la vente finale est recréée à l'encaissement)
  const handleRemovePendingOrder = (orderId: string) => {
    const wasPending = saleOrders.some(o => o.id === orderId && o.status === 'En cours');
    setSaleOrders(prev => prev.filter(o => o.id !== orderId || o.status !== 'En cours'));
    if (wasPending) showToast('La commande en attente a été supprimée.');
  };

  // Annulation d'une vente : contre-passation complète (statut, stock,
  // mouvements, client, transaction financière et trésorerie)
  const handleCancelSale = (saleId: string) => {
    const sale = saleOrders.find(s => s.id === saleId);
    if (!sale || sale.status === 'Annulé') return false;

    const now = formatAppDateTime();
    const operator = currentUser?.name || 'Système';

    // 1. Statut de la vente
    setSaleOrders(prev => prev.map(s => (s.id === saleId ? { ...s, status: 'Annulé' } : s)));

    // 2. Restitution du stock + mouvements d'entrée tracés
    const restock = computeRestockMap(sale);
    setProducts(prev =>
      prev.map(p => {
        const add = restock.get(p.id);
        return add && p.isStockable !== false ? { ...p, stock: p.stock + add } : p;
      })
    );
    setMovements(prev => [...buildCancelMovements(sale, operator, now), ...prev]);

    // 3. Contre-passation des indicateurs client (crédit et cumul achats)
    if (sale.clientId) {
      setClients(prev =>
        prev.map(c => (c.id === sale.clientId ? revertClientMetrics(c, sale) : c))
      );
    }

    // 4. Contre-passation comptable : la recette d'origine est conservée dans le
    // journal et une écriture inverse (Dépense) la compense — trace complète.
    const linkedTx = findSaleRevenueTransaction(sale, transactions);
    if (linkedTx) {
      const reversal: FinancialTransaction = {
        ...linkedTx,
        id: generateUniqueId('tx'),
        code: nextCode('DEP'),
        date: now,
        type: 'Dépense',
        category: 'Annulation vente',
        reference: sale.code,
        notes: `Contre-passation de ${linkedTx.code} (annulation ${sale.code})`,
        recordedBy: operator
      };
      setTransactions(prev => [reversal, ...prev]);
      setTreasuryAccounts(prev =>
        prev.map(acc =>
          acc.name === linkedTx.account
            ? { ...acc, balance: acc.balance - linkedTx.amount, lastUpdated: now }
            : acc
        )
      );
    }

    logAudit(
      'sale.cancel',
      'saleOrders',
      sale.code,
      `${sale.finalAmount.toLocaleString('fr-FR')} FCFA — stock restitué${linkedTx ? `, recette ${linkedTx.code} contre-passée` : ''}`
    );
    return true;
  };

  /**
   * Suppression d'une commande client.
   * Si la vente était active, ses effets sur le stock et la trésorerie sont
   * automatiquement contre-passés pour préserver l'intégrité de l'inventaire.
   */
  const handleDeleteSale = (saleId: string) => {
    const sale = saleOrders.find(s => s.id === saleId);
    if (!sale) return;

    // Si la vente était encore active, régularisation automatique du stock et trésorerie
    if (sale.status !== 'Annulé' && sale.status !== 'En cours' && sale.status !== 'En attente') {
      const now = formatAppDateTime();
      const operator = currentUser?.name || 'Système';

      const restock = computeRestockMap(sale);
      setProducts(prev =>
        prev.map(p => {
          const add = restock.get(p.id);
          return add && p.isStockable !== false ? { ...p, stock: p.stock + add } : p;
        })
      );
      setMovements(prev => [...buildCancelMovements(sale, operator, now), ...prev]);

      if (sale.clientId) {
        setClients(prev =>
          prev.map(c => (c.id === sale.clientId ? revertClientMetrics(c, sale) : c))
        );
      }

      const linkedTx = findSaleRevenueTransaction(sale, transactions);
      if (linkedTx) {
        setTransactions(prev => prev.filter(t => t.id !== linkedTx.id));
        setTreasuryAccounts(prev =>
          prev.map(acc =>
            acc.name === linkedTx.account
              ? { ...acc, balance: acc.balance - linkedTx.amount, lastUpdated: now }
              : acc
          )
        );
      }
    }

    setCustomerReturns(prev => prev.filter(r => r.saleId !== sale.id));
    setSaleOrders(prev => prev.filter(s => s.id !== saleId));
    logAudit(
      'sale.delete',
      'saleOrders',
      sale.code,
      `Commande client supprimée (${sale.finalAmount.toLocaleString('fr-FR')} FCFA)`
    );
  };

  // Handlers for Paramètres : Utilisateurs & Configuration société
  const handleAddUser = (user: UserAccount): boolean => {
    if (users.some(u => u.username.toLowerCase() === user.username.toLowerCase())) {
      alert('Cet identifiant est déjà utilisé.');
      return false;
    }
    setUsers(prev => [...prev, user]);
    logAudit('user.create', 'users', user.username, `${user.name} — ${user.role}`);
    return true;
  };

  const handleUpdateUser = (updated: UserAccount): boolean => {
    const target = users.find(u => u.id === updated.id);
    if (!target) return false;
    // Un admin ne peut pas se retirer ses propres droits en session
    if (currentUser?.id === updated.id && updated.role !== 'Administrateur' && target.role === 'Administrateur') {
      alert('Vous ne pouvez pas rétrograder votre propre compte en session.');
      return false;
    }
    setUsers(prev => prev.map(u => (u.id === updated.id ? { ...u, ...updated } : u)));
    logAudit('user.update', 'users', updated.username, `${updated.name} — ${updated.role}`);
    return true;
  };

  const handleToggleUserActive = (id: string): boolean => {
    const target = users.find(u => u.id === id);
    if (!target) return false;
    if (currentUser?.id === id) {
      alert('Vous ne pouvez pas désactiver votre propre compte en session.');
      return false;
    }
    if (target.role === 'Administrateur' && target.active !== false &&
        users.filter(u => u.role === 'Administrateur' && u.active !== false).length <= 1) {
      alert('Impossible de désactiver le dernier compte Administrateur actif.');
      return false;
    }
    setUsers(prev =>
      prev.map(u => (u.id === id ? { ...u, active: u.active === false ? true : false } : u))
    );
    logAudit(
      target.active === false ? 'user.activate' : 'user.deactivate',
      'users',
      target.username,
      target.name
    );
    return true;
  };

  /** newSecret : hash "sha256:..." (préféré) ou mot de passe en clair (fallback legacy) */
  const handleResetUserPassword = (id: string, newSecret: string): boolean => {
    const target = users.find(u => u.id === id);
    if (!target) return false;
    const hashed = isPasswordHashed(newSecret);
    setUsers(prev =>
      prev.map(u =>
        u.id === id
          ? { ...u, password: hashed ? undefined : newSecret, passwordHash: hashed ? newSecret : undefined }
          : u
      )
    );
    logAudit('user.resetPassword', 'users', target.username, target.name);
    return true;
  };

  const handleDeleteUser = (id: string): boolean => {
    const target = users.find(u => u.id === id);
    if (!target) return false;
    if (currentUser?.id === id) {
      alert('Vous ne pouvez pas supprimer votre propre compte en session.');
      return false;
    }
    if (target.role === 'Administrateur' && users.filter(u => u.role === 'Administrateur').length <= 1) {
      alert('Impossible de supprimer le dernier compte Administrateur.');
      return false;
    }
    setUsers(prev => prev.filter(u => u.id !== id));
    logAudit('user.delete', 'users', target.username, `${target.name} — ${target.role}`);
    return true;
  };

  const handleSaveCompanyConfig = (config: CompanyConfig) => {
    setCompanyConfig(config);
    logAudit('company.update', 'companyConfig', config.name, 'Paramètres société mis à jour');
  };

  /**
   * Remise à zéro de la base (Paramètres → Configuration Société → Zone de
   * danger) : vide toutes les collections métier et remet les compteurs de
   * numérotation à zéro. Les comptes utilisateurs (dont l'utilisateur de
   * test) et la configuration société sont conservés — sinon plus aucun
   * accès ne serait possible après la purge.
   */
  const handleResetDatabase = async (): Promise<boolean> => {
    if (currentUser?.role !== 'Administrateur') {
      alert('Remise à zéro réservée à un compte Administrateur.');
      return false;
    }

    const wiped = buildWipedDatabase({
      version: 1,
      lastUpdated: new Date().toISOString(),
      counters,
      products,
      categories,
      movements,
      clients,
      suppliers,
      inquiries,
      purchaseOrders,
      receptions,
      approvisionnements,
      storageSites,
      saleOrders,
      pointsDeVente: pointsDeVente.map(({ sales: _ignored, ...rest }) => rest),
      transactions,
      treasuryAccounts,
      treasuryMovements,
      users,
      auditLogs,
      valuations,
      physicalInventories: inventories,
      stockAdjustments,
      stockTransfers,
      stockLosses,
      customerReturns,
      supplierReturns,
      companyConfig
    });

    // Remplacement complet côté serveur en un seul appel (évite un DELETE par entité)
    if (isRemoteApiConfigured() && getSessionToken()) {
      const remoteOk = await pushFullDatabase(wiped);
      if (!remoteOk) {
        alert('Le serveur distant est injoignable : remise à zéro annulée pour éviter une resynchronisation de l\'ancienne base.');
        return false;
      }
    }

    // Les anciens compteurs ne doivent pas être re-semés depuis la base vidée
    countersRef.current = {};
    handleDatabaseRestored(wiped);
    // La purge elle-même reste tracée dans le journal de la base remise à zéro
    logAudit(
      'database.reset',
      'system',
      undefined,
      'Remise à zéro de la base — comptes utilisateurs et configuration société conservés'
    );
    return true;
  };

  // Handlers for Financial Transactions (Recettes et Dépenses)
  const handleAddFinancialTransaction = (txData: Omit<FinancialTransaction, 'id' | 'code'>): boolean => {
    const isRecette = txData.type === 'Recette';

    // Contrôle bloquant : une dépense ne peut excéder le solde du compte débité
    if (!isRecette) {
      const acc = treasuryAccounts.find(a => a.name === txData.account);
      if (acc && acc.balance < txData.amount) {
        alert(
          `Solde insuffisant sur "${acc.name}" (${acc.balance.toLocaleString('fr-FR')} FCFA) pour cette dépense de ${txData.amount.toLocaleString('fr-FR')} FCFA.`
        );
        return false;
      }
    }

    const newTx: FinancialTransaction = {
      ...txData,
      id: generateUniqueId('tx'),
      code: nextCode(isRecette ? 'REC' : 'DEP')
    };

    setTransactions(prev => [newTx, ...prev]);

    // Automatically update treasury account balance
    setTreasuryAccounts(prev =>
      prev.map(acc => {
        if (acc.name === txData.account) {
          const delta = isRecette ? txData.amount : -txData.amount;
          return {
            ...acc,
            balance: acc.balance + delta,
            lastUpdated: formatAppDateTime()
          };
        }
        return acc;
      })
    );
    logAudit(
      isRecette ? 'transaction.recette' : 'transaction.depense',
      'transactions',
      newTx.code,
      `${txData.amount.toLocaleString('fr-FR')} FCFA — ${txData.account} — ${txData.category}`
    );
    return true;
  };

  const handleDeleteFinancialTransaction = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    setTransactions(prev => prev.filter(t => t.id !== id));

    // Reverse balance effect (le plafond à 0 reste protecteur pour une contre-passation)
    setTreasuryAccounts(prev =>
      prev.map(acc => {
        if (acc.name === tx.account) {
          const reverseDelta = tx.type === 'Recette' ? -tx.amount : tx.amount;
          return {
            ...acc,
            balance: Math.max(0, acc.balance + reverseDelta),
            lastUpdated: formatAppDateTime()
          };
        }
        return acc;
      })
    );
    showToast('La transaction a été supprimée avec succès.');
  };

  // Handlers for Treasury Movements
  const handleAddTreasuryMovement = (mvData: Omit<TreasuryMovement, 'id' | 'code'>): boolean => {
    // Contrôle bloquant : le compte source doit couvrir le montant mouvementé
    if (mvData.fromAccount) {
      const src = treasuryAccounts.find(a => a.name === mvData.fromAccount);
      if (src && src.balance < mvData.amount) {
        alert(
          `Solde insuffisant sur "${src.name}" (${src.balance.toLocaleString('fr-FR')} FCFA) pour ce mouvement de ${mvData.amount.toLocaleString('fr-FR')} FCFA.`
        );
        return false;
      }
    }

    const newMovement: TreasuryMovement = {
      ...mvData,
      id: generateUniqueId('tr'),
      code: nextCode('TR')
    };

    setTreasuryMovements(prev => [newMovement, ...prev]);

    // Update balances of source and destination accounts
    setTreasuryAccounts(prev =>
      prev.map(acc => {
        let newBalance = acc.balance;
        if (mvData.fromAccount && acc.name === mvData.fromAccount) {
          newBalance = newBalance - mvData.amount;
        }
        if (mvData.toAccount && acc.name === mvData.toAccount) {
          newBalance = newBalance + mvData.amount;
        }
        return {
          ...acc,
          balance: newBalance,
          lastUpdated: formatAppDateTime()
        };
      })
    );
    logAudit(
      'treasury.movement',
      'treasuryMovements',
      newMovement.code,
      `${mvData.amount.toLocaleString('fr-FR')} FCFA — ${mvData.fromAccount || '—'} → ${mvData.toAccount || '—'}`
    );
    return true;
  };

  // If not authenticated, render LoginView with role routing
  if (!currentUser) {
    return (
      <LoginView
        onLoginSuccess={handleLoginSuccess}
        users={users}
        onCreateFirstAdmin={handleCreateFirstAdmin}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col md:flex-row font-sans selection:bg-blue-600 selection:text-white">
      {/* Sliding Menu Drawer (Sidebar) - Masqué pour l'utilisateur de point de vente (Caissier) qui n'a pas de menu */}
      {!isCashier && (
        <Sidebar
          currentSection={currentSection}
          onSelectSection={setCurrentSection}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          lowStockCount={lowStockCount}
          pendingOrdersCount={pendingOrdersCount}
          activeSessionsCount={activeSessionsCount}
          onOpenTechSpec={() => setIsTechSpecOpen(true)}
          onOpenDatabaseManager={() => setIsDatabaseModalOpen(true)}
          currentUser={currentUser}
          onLogout={handleLogout}
        />
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Header with quick Point de Vente dashboard button and local DB trigger */}
        <Header
          currentSection={currentSection}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onSelectSection={setCurrentSection}
          lowStockCount={lowStockCount}
          onOpenTechSpec={() => setIsTechSpecOpen(true)}
          activePointDeVente={activePointDeVente}
          onOpenDatabaseManager={() => setIsDatabaseModalOpen(true)}
          currentUser={currentUser}
          onLogout={handleLogout}
          syncStatus={syncStatus}
        />

        {/* Dynamic View Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          <Suspense fallback={
            <div className="flex items-center justify-center py-24 text-slate-400 text-sm font-semibold">
              Chargement du module…
            </div>
          }>
          {currentSection === 'accueil' && (
            <AccueilView
              products={products}
              saleOrders={saleOrders}
              purchaseOrders={purchaseOrders}
              onNavigate={setCurrentSection}
            />
          )}

          {currentSection === 'inventaire-approvisionnement' && (
            <ApprovisionnementView
              approvisionnements={approvisionnements}
              receptions={receptions}
              products={products}
              companyConfig={companyConfig}
              currentUser={currentUser}
              movements={movements}
              storageSites={storageSites}
              onAddApprovisionnement={handleAddApprovisionnement}
              onDeleteApprovisionnement={handleDeleteApprovisionnement}
              initialReceptionIdToOpen={approTargetReceptionId}
              onClearInitialReceptionId={() => setApproTargetReceptionId(null)}
            />
          )}

          {currentSection === 'inventaire-valorisation' && (
            <ValorisationStockView
              products={products}
              categories={categories}
              movements={movements}
              approvisionnements={approvisionnements}
              receptions={receptions}
              saleOrders={saleOrders}
              storageSites={storageSites}
              valuations={valuations}
              inventories={inventories}
              stockAdjustments={stockAdjustments}
              stockTransfers={stockTransfers}
              customerReturns={customerReturns}
              supplierReturns={supplierReturns}
              companyConfig={companyConfig}
              currentUser={currentUser}
              onSaveValuation={handleSaveValuation}
              onDeleteValuation={handleDeleteValuation}
            />
          )}

          {currentSection === 'inventaire-physique' && (
            <InventairePhysiqueView
              inventories={inventories}
              stockAdjustments={stockAdjustments}
              stockTransfers={stockTransfers}
              customerReturns={customerReturns}
              supplierReturns={supplierReturns}
              products={products}
              categories={categories}
              movements={movements}
              approvisionnements={approvisionnements}
              receptions={receptions}
              saleOrders={saleOrders}
              storageSites={storageSites}
              companyConfig={companyConfig}
              currentUser={currentUser}
              onSaveInventory={handleSaveInventory}
              onDeleteInventory={handleDeleteInventory}
              onApplyAdjustments={handleApplyInventoryAdjustments}
            />
          )}

          {currentSection === 'inventaire-ajustement' && (
            <AjustementStockView
              adjustments={stockAdjustments}
              products={products}
              movements={movements}
              approvisionnements={approvisionnements}
              receptions={receptions}
              saleOrders={saleOrders}
              inventories={inventories}
              stockTransfers={stockTransfers}
              customerReturns={customerReturns}
              supplierReturns={supplierReturns}
              storageSites={storageSites}
              companyConfig={companyConfig}
              currentUser={currentUser}
              onSaveAdjustment={handleSaveAdjustment}
              onValidateAdjustment={handleValidateAdjustment}
              onCancelAdjustment={handleCancelAdjustment}
              onDeleteAdjustment={handleDeleteAdjustment}
            />
          )}

          {currentSection === 'inventaire-transferts' && (
            <TransfertsView
              transfers={stockTransfers}
              products={products}
              movements={movements}
              approvisionnements={approvisionnements}
              receptions={receptions}
              saleOrders={saleOrders}
              inventories={inventories}
              stockAdjustments={stockAdjustments}
              customerReturns={customerReturns}
              supplierReturns={supplierReturns}
              storageSites={storageSites}
              companyConfig={companyConfig}
              currentUser={currentUser}
              onCreateTransfer={handleCreateTransfer}
              onReceiveTransfer={handleReceiveTransfer}
              onCancelTransfer={handleCancelTransfer}
              onDeleteTransfer={handleDeleteTransfer}
            />
          )}

          {currentSection === 'inventaire-pertes-avaries' && (
            <PertesAvariesView
              losses={stockLosses}
              products={products}
              movements={movements}
              approvisionnements={approvisionnements}
              receptions={receptions}
              saleOrders={saleOrders}
              inventories={inventories}
              stockAdjustments={stockAdjustments}
              stockTransfers={stockTransfers}
              customerReturns={customerReturns}
              supplierReturns={supplierReturns}
              storageSites={storageSites}
              companyConfig={companyConfig}
              currentUser={currentUser}
              onDeclareLoss={handleDeclareLoss}
              onDestockLoss={handleDestockLoss}
              onDeleteLoss={handleDeleteLoss}
            />
          )}

          {currentSection === 'inventaire-peremption' && (
            <PeremptionView
              products={products}
              receptions={receptions}
              approvisionnements={approvisionnements}
              companyConfig={companyConfig}
            />
          )}

          {currentSection === 'inventaire-magasins' && (
            <MagasinsView
              storageSites={storageSites}
              currentUser={currentUser}
              onAddStorageSite={handleAddStorageSite}
              onDeleteStorageSite={handleDeleteStorageSite}
            />
          )}

          {currentSection === 'inventaire-produits' && (
            <ProduitsView
              products={products}
              categories={categories}
              companyConfig={companyConfig}
              movements={movements}
              onAddProduct={handleAddProduct}
              onBatchAddProducts={handleBatchAddProducts}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
              onAddCategory={handleAddCategory}
              onUpdateCategory={handleUpdateCategory}
              onDeleteCategory={handleDeleteCategory}
            />
          )}

          {currentSection === 'acteurs-clients' && (
            <ClientsView
              clients={clients}
              companyConfig={companyConfig}
              onAddClient={handleAddClient}
              onUpdateClient={handleUpdateClient}
              onDeleteClient={handleDeleteClient}
            />
          )}

          {currentSection === 'acteurs-fournisseurs' && (
            <FournisseursView
              suppliers={suppliers}
              companyConfig={companyConfig}
              onAddSupplier={handleAddSupplier}
              onUpdateSupplier={handleUpdateSupplier}
              onDeleteSupplier={handleDeleteSupplier}
            />
          )}

          {currentSection === 'achat-demande-prix' && (
            <DemandePrixView
              inquiries={inquiries}
              suppliers={suppliers}
              products={products}
              onAddInquiry={handleAddInquiry}
              onUpdateInquiry={handleUpdateInquiry}
              onDuplicateInquiry={handleDuplicateInquiry}
              onConvertToPurchaseOrder={handleConvertToPurchaseOrder}
              onDeleteInquiry={handleDeleteInquiry}
              onDeleteMultipleInquiries={handleDeleteMultipleInquiries}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              currentUser={currentUser}
              companyConfig={companyConfig}
            />
          )}

          {currentSection === 'achat-bon-commande' && (
            <BonCommandeView
              purchaseOrders={purchaseOrders}
              inquiries={inquiries}
              suppliers={suppliers}
              products={products}
              onAddPurchaseOrder={handleAddPurchaseOrder}
              onUpdatePurchaseOrder={handleUpdatePurchaseOrder}
              onDuplicatePurchaseOrder={handleDuplicatePurchaseOrder}
              onUpdatePurchaseOrderStatus={handleUpdatePurchaseOrderStatus}
              onValidatePurchaseOrderWithSettlements={handleValidatePurchaseOrderWithSettlements}
              onDeletePurchaseOrder={handleDeletePurchaseOrder}
              onDeleteMultiplePurchaseOrders={handleDeleteMultiplePurchaseOrders}
              onReceiveGoods={handleReceiveGoodsFromPO}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onNavigateToDemandePrix={() => setCurrentSection('achat-demande-prix')}
              initialPOToOpen={poToOpenDetail}
              onClearInitialPO={() => setPoToOpenDetail(null)}
              currentUser={currentUser}
              companyConfig={companyConfig}
            />
          )}

          {currentSection === 'achat-reception' && (
            <ReceptionView
              receptions={receptions}
              purchaseOrders={purchaseOrders}
              products={products}
              suppliers={suppliers}
              currentUser={currentUser}
              onValidateReception={handleValidateReception}
              onAddDirectReception={handleAddDirectReception}
              onDeleteReception={handleDeleteReception}
              onDeleteMultipleReceptions={handleDeleteMultipleReceptions}
              approvisionnements={approvisionnements}
              onCancelReception={handleCancelReception}
              initialPurchaseOrder={receptionSourcePO}
              onClearInitialPurchaseOrder={() => setReceptionSourcePO(null)}
              companyConfig={companyConfig}
              onNavigateToBonCommande={() => setCurrentSection('achat-bon-commande')}
            />
          )}

          {currentSection === 'achat-retours' && (
            <RetoursFournisseursView
              returns={supplierReturns}
              suppliers={suppliers}
              products={products}
              companyConfig={companyConfig}
              currentUser={currentUser}
              canManage={canManageStockOps}
              onSaveReturn={handleSaveSupplierReturn}
              onValidateReturn={handleValidateSupplierReturn}
              onCancelReturn={handleCancelSupplierReturn}
              onDeleteReturn={handleDeleteSupplierReturn}
            />
          )}

          {currentSection === 'vente-sessions' && (
            <PointDeVenteSessionsView
              pointsDeVente={pointsDeVenteWithSales}
              onOpenPointDeVente={handleOpenPointDeVente}
              onClosePointDeVente={handleClosePointDeVente}
              onNavigateToPOS={(pv) => {
                setSelectedPointDeVenteId(pv?.id || null);
                setCurrentSection('vente-pos');
              }}
              onOpenReceipt={setActiveReceiptSale}
              companyConfig={companyConfig}
            />
          )}

          {currentSection === 'vente-pos' && (
            <PointDeVenteView
              products={products}
              clients={clients}
              onAddClient={handleAddClient}
              activePointDeVente={activePointDeVente}
              saleOrders={filterCashierOrders(saleOrders, currentUser, pointsDeVente)}
              openCashRegisters={pointsDeVente.filter(session => session.status === 'En cours')}
              onSelectCashRegister={handleSelectCashRegister}
              onNavigateToSessions={isCashier ? undefined : () => setCurrentSection('vente-sessions')}
              onCompleteSale={handleCompleteSale}
              onOpenReceipt={setActiveReceiptSale}
              onParkOrder={handleParkSaleOrder}
              onResumePendingOrder={handleRemovePendingOrder}
              currentUser={currentUser}
              nextSessionCode={nextPvCode}
              onOpenPointDeVente={handleOpenPointDeVente}
              onClosePointDeVente={handleClosePointDeVente}
            />
          )}

          {currentSection === 'vente-commande' && (
            <CommandeVenteView
              saleOrders={saleOrders}
              onOpenReceipt={setActiveReceiptSale}
              onOpenInvoice={setActiveInvoiceSale}
              onCancelSale={handleCancelSale}
              onDeleteSale={handleDeleteSale}
            />
          )}

          {currentSection === 'vente-retours' && (
            <RetoursClientsView
              returns={customerReturns}
              clients={clients}
              products={products}
              saleOrders={saleOrders}
              companyConfig={companyConfig}
              currentUser={currentUser}
              canManage={canManageStockOps}
              onSaveReturn={handleSaveCustomerReturn}
              onValidateReturn={handleValidateCustomerReturn}
              onCancelReturn={handleCancelCustomerReturn}
              onDeleteReturn={handleDeleteCustomerReturn}
            />
          )}

          {currentSection === 'finance-recettes-depenses' && (
            <RecettesDepensesView
              transactions={transactions}
              treasuryAccounts={treasuryAccounts}
              onAddTransaction={handleAddFinancialTransaction}
              onDeleteTransaction={handleDeleteFinancialTransaction}
              currentUser={currentUser}
              companyConfig={companyConfig}
            />
          )}

          {currentSection === 'finance-marges-resultat' && (
            <MargesResultatView
              products={products}
              saleOrders={saleOrders}
              transactions={transactions}
              companyConfig={companyConfig}
            />
          )}

          {currentSection === 'finance-tresorerie-caisses' && (
            <TresorerieCaissesView
              treasuryAccounts={treasuryAccounts}
              treasuryMovements={treasuryMovements}
              onAddTreasuryMovement={handleAddTreasuryMovement}
              currentUser={currentUser}
              companyConfig={companyConfig}
            />
          )}

          {currentSection === 'parametres-utilisateurs' && (
            <UtilisateursView
              users={users}
              currentUser={currentUser}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onToggleUserActive={handleToggleUserActive}
              onResetUserPassword={handleResetUserPassword}
              onDeleteUser={handleDeleteUser}
            />
          )}

          {currentSection === 'parametres-configuration' && (
            <ConfigurationView
              config={companyConfig}
              onSave={handleSaveCompanyConfig}
              canResetDatabase={currentUser?.role === 'Administrateur'}
              onResetDatabase={handleResetDatabase}
            />
          )}

          {currentSection === 'parametres-export' && canManageStockOps && (
            <ExportDonneesView
              db={{
                version: 1,
                lastUpdated: new Date().toISOString(),
                counters,
                products,
                categories,
                movements,
                clients,
                suppliers,
                inquiries,
                purchaseOrders,
                receptions,
                approvisionnements,
                storageSites,
                saleOrders,
                pointsDeVente: pointsDeVente.map(({ sales: _ignored, ...rest }) => rest),
                transactions,
                treasuryAccounts,
                treasuryMovements,
                users,
                auditLogs,
                valuations,
                physicalInventories: inventories,
                stockAdjustments,
                stockTransfers,
                stockLosses,
                customerReturns,
                supplierReturns,
                companyConfig
              }}
              companyConfig={companyConfig}
              currentUser={currentUser}
              onAudit={(entityRef, details) => logAudit('data.export', 'database', entityRef, details)}
            />
          )}

          {currentSection === 'guide-utilisateur' && (
            <GuideUtilisateurView companyConfig={companyConfig} />
          )}

          {currentSection === 'parametres-audit' && (
            <AuditLogView logs={auditLogs} />
          )}
          </Suspense>
        </main>
      </div>

      {/* Ticket/Receipt Modal */}
      {activeReceiptSale && (
        <ReceiptModal
          sale={activeReceiptSale}
          onClose={() => setActiveReceiptSale(null)}
          companyConfig={companyConfig}
          clientPhone={clients.find(c => c.id === activeReceiptSale.clientId || c.name === activeReceiptSale.clientName)?.phone}
        />
      )}

      {/* Facture A4 */}
      {activeInvoiceSale && (
        <InvoiceModal
          sale={activeInvoiceSale}
          onClose={() => setActiveInvoiceSale(null)}
          companyConfig={companyConfig}
          clientPhone={clients.find(c => c.id === activeInvoiceSale.clientId || c.name === activeInvoiceSale.clientName)?.phone}
        />
      )}

      {/* Technical Blueprint Modal */}
      {isTechSpecOpen && (
        <TechSpecModal
          onClose={() => setIsTechSpecOpen(false)}
        />
      )}

      {/* Database Manager Modal (Sauvegarde, Restauration, Base Locale) */}
      {isDatabaseModalOpen && (
        <DatabaseManagerModal
          currentDatabase={{
            version: 1,
            lastUpdated: new Date().toISOString(),
            counters,
            products,
            categories,
            movements,
            clients,
            suppliers,
            inquiries,
            purchaseOrders,
            receptions,
            approvisionnements,
            storageSites,
            saleOrders,
            pointsDeVente: pointsDeVenteWithSales,
            transactions,
            treasuryAccounts,
            treasuryMovements,
            users,
            auditLogs,
            valuations,
            physicalInventories: inventories,
            stockAdjustments,
            stockTransfers,
            stockLosses,
            customerReturns,
            supplierReturns,
            companyConfig
          }}
          onDatabaseRestored={handleDatabaseRestored}
          onClose={() => setIsDatabaseModalOpen(false)}
        />
      )}
    </div>
  );
}
