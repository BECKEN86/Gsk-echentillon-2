import {
  Product,
  ProductCategory,
  StockMovement,
  Client,
  Supplier,
  PriceInquiry,
  PurchaseOrder,
  GoodsReception,
  SaleOrder,
  PointDeVente,
  FinancialTransaction,
  TreasuryAccount,
  TreasuryMovement,
  UserAccount,
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
} from '../types';

export interface AppDatabase {
  version: number;
  lastUpdated: string;
  /** Compteurs persistants de numérotation des documents (clé "PREFIX-YYYYMM" → dernier n°) */
  counters: Record<string, number>;
  products: Product[];
  categories: ProductCategory[];
  movements: StockMovement[];
  clients: Client[];
  suppliers: Supplier[];
  inquiries: PriceInquiry[];
  purchaseOrders: PurchaseOrder[];
  receptions: GoodsReception[];
  approvisionnements: ApprovisionnementRecord[];
  storageSites: StorageSite[];
  saleOrders: SaleOrder[];
  pointsDeVente: PointDeVente[];
  transactions: FinancialTransaction[];
  treasuryAccounts: TreasuryAccount[];
  treasuryMovements: TreasuryMovement[];
  users: UserAccount[];
  /** Journal d'audit centralisé (qui/quoi/quand) */
  auditLogs: AuditLog[];
  /** États de valorisation du stock clôturés et archivés */
  valuations: StockValuationRecord[];
  /** Inventaires physiques (brouillons → clôturés) */
  physicalInventories: PhysicalInventory[];
  /** Documents d'ajustement de stock (brouillons → validés/annulés) */
  stockAdjustments: StockAdjustment[];
  /** Transferts inter-dépôts (en transit → réceptionnés/annulés) */
  stockTransfers: StockTransfer[];
  /** Déclarations de pertes, casses et produits avariés */
  stockLosses: StockAvarieLoss[];
  /** Retours clients validés ou en brouillon (réintégration + avoir) */
  customerReturns: CustomerReturn[];
  /** Retours fournisseurs (sortie de stock + déduction dette/avoir) */
  supplierReturns: SupplierReturn[];
  /** Paramètres de la société (document singleton, null si non renseigné) */
  companyConfig: CompanyConfig | null;
}

const STORAGE_KEY = 'gestock_local_database_v1';

const COLLECTION_KEYS: (keyof Omit<AppDatabase, 'version' | 'lastUpdated' | 'counters' | 'companyConfig'>)[] = [
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

export function getDefaultDatabase(): AppDatabase {
  return {
    version: 1,
    lastUpdated: new Date().toISOString(),
    counters: {},
    products: [],
    categories: [],
    movements: [],
    clients: [],
    suppliers: [],
    inquiries: [],
    purchaseOrders: [],
    receptions: [],
    approvisionnements: [],
    storageSites: [],
    saleOrders: [],
    pointsDeVente: [],
    transactions: [],
    treasuryAccounts: [],
    treasuryMovements: [],
    users: [],
    auditLogs: [],
    valuations: [],
    physicalInventories: [],
    stockAdjustments: [],
    stockTransfers: [],
    stockLosses: [],
    customerReturns: [],
    supplierReturns: [],
    companyConfig: null
  };
}

/**
 * Déduplique les ventes : les sessions de caisse (pointsDeVente) ne portent plus
 * leur liste de ventes — elle est dérivée de `saleOrders` via pointDeVenteId/Code.
 * Les anciennes sauvegardes qui embarquaient pv.sales voient ces ventes migrées
 * vers saleOrders (dédup par id) puis le champ est vidé.
 */
export function normalizeDatabase(parsed: Partial<AppDatabase>): AppDatabase {
  const read = <T,>(key: keyof AppDatabase): T[] =>
    Array.isArray((parsed as any)[key]) ? ((parsed as any)[key] as T[]) : [];

  let saleOrders = read<SaleOrder>('saleOrders');
  const pointsDeVente = read<PointDeVente>('pointsDeVente');
  const storedUsers = read<UserAccount>('users');
  const storedAppro = read<ApprovisionnementRecord>('approvisionnements');

  // Migration : remonter les ventes embarquées dans pv.sales qui manqueraient dans saleOrders
  const knownSaleIds = new Set(saleOrders.map(s => s.id));
  const embeddedExtras = pointsDeVente
    .flatMap(pv => pv.sales || [])
    .filter(s => s && s.id && !knownSaleIds.has(s.id));
  if (embeddedExtras.length > 0) {
    saleOrders = [...embeddedExtras, ...saleOrders];
  }

  return {
    version: parsed.version || 1,
    lastUpdated: parsed.lastUpdated || new Date().toISOString(),
    counters: parsed.counters && typeof parsed.counters === 'object' ? parsed.counters : {},
    products: read<Product>('products'),
    categories: read<ProductCategory>('categories'),
    movements: read<StockMovement>('movements'),
    clients: read<Client>('clients'),
    suppliers: read<Supplier>('suppliers'),
    inquiries: read<PriceInquiry>('inquiries'),
    purchaseOrders: read<PurchaseOrder>('purchaseOrders'),
    receptions: read<GoodsReception>('receptions'),
    approvisionnements: storedAppro,
    storageSites: read<StorageSite>('storageSites'),
    saleOrders,
    pointsDeVente: pointsDeVente.map(pv => ({ ...pv, sales: [] })),
    transactions: read<FinancialTransaction>('transactions'),
    treasuryAccounts: read<TreasuryAccount>('treasuryAccounts'),
    treasuryMovements: read<TreasuryMovement>('treasuryMovements'),
    users: storedUsers,
    auditLogs: read<AuditLog>('auditLogs'),
    valuations: read<StockValuationRecord>('valuations'),
    physicalInventories: read<PhysicalInventory>('physicalInventories'),
    stockAdjustments: read<StockAdjustment>('stockAdjustments'),
    stockTransfers: read<StockTransfer>('stockTransfers'),
    stockLosses: read<StockAvarieLoss>('stockLosses'),
    customerReturns: read<CustomerReturn>('customerReturns'),
    supplierReturns: read<SupplierReturn>('supplierReturns'),
    companyConfig:
      parsed.companyConfig && typeof parsed.companyConfig === 'object'
        ? parsed.companyConfig
        : null
  };
}

/**
 * Base entièrement vide — utilisée comme pré-amorçage quand le serveur local
 * (SQLite) est la source de vérité : l'état réel arrive via l'API juste après.
 */
export function getEmptyDatabase(): AppDatabase {
  return {
    ...getDefaultDatabase(),
    products: [],
    categories: [],
    movements: [],
    clients: [],
    suppliers: [],
    inquiries: [],
    purchaseOrders: [],
    receptions: [],
    approvisionnements: [],
    storageSites: [],
    saleOrders: [],
    pointsDeVente: [],
    transactions: [],
    treasuryAccounts: [],
    treasuryMovements: [],
    users: [],
    auditLogs: [],
    valuations: [],
    physicalInventories: [],
    stockAdjustments: [],
    stockTransfers: [],
    stockLosses: [],
    customerReturns: [],
    supplierReturns: [],
    counters: {},
    companyConfig: null
  };
}

/**
 * Purge le cache navigateur — appelée dès que le serveur local (SQLite) est
 * la source de vérité pour que les anciennes données ne réapparaissent jamais.
 * Le token de session serveur (`gestock_session_token`) est conservé.
 */
export function clearLocalDatabaseCache(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('gestock_current_user_v1');
  } catch (error) {
    console.error('Erreur lors du nettoyage du cache local de la base:', error);
  }
}

export function loadDatabase(): AppDatabase {
  if (typeof window === 'undefined') {
    return getDefaultDatabase();
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getDefaultDatabase();
      saveDatabase(initial);
      return initial;
    }

    return normalizeDatabase(JSON.parse(raw) as Partial<AppDatabase>);
  } catch (error) {
    console.error('Erreur de lecture de la base locale, chargement d’une base vide:', error);
    return getDefaultDatabase();
  }
}

export function saveDatabase(data: AppDatabase): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const toSave: AppDatabase = {
      ...data,
      pointsDeVente: data.pointsDeVente.map(pv => ({ ...pv, sales: [] })),
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    return true;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la base locale:', error);
    if (typeof window !== 'undefined' && error instanceof DOMException && error.name === 'QuotaExceededError') {
      alert('Espace de stockage local saturé : la sauvegarde automatique a échoué. Exportez une sauvegarde JSON puis allégez la base.');
    }
    return false;
  }
}

export function exportDatabaseJSON(database: AppDatabase): string {
  return JSON.stringify(database, null, 2);
}

export function downloadBackupFile(database: AppDatabase): void {
  const jsonStr = exportDatabaseJSON(database);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const nowStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `gestock_backup_${nowStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importDatabaseJSON(jsonStr: string): { success: boolean; data?: AppDatabase; error?: string } {
  try {
    const parsed = JSON.parse(jsonStr) as Partial<AppDatabase>;

    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'Fichier JSON invalide' };
    }

    if (!Array.isArray(parsed.products) && !Array.isArray(parsed.saleOrders)) {
      return { success: false, error: 'Structure de base de données non reconnue' };
    }

    // Les collections absentes deviennent des listes vides (jamais de données de démo injectées)
    const imported = normalizeDatabase(parsed);

    saveDatabase(imported);
    return { success: true, data: imported };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erreur lors du décodage du fichier JSON' };
  }
}

export function getDatabaseStats(db: AppDatabase) {
  const totalRecords = COLLECTION_KEYS.reduce((sum, k) => sum + (db[k]?.length || 0), 0);

  let sizeInKB = 0;
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      sizeInKB = Math.round((new Blob([raw]).size / 1024) * 10) / 10;
    }
  }

  return {
    totalRecords,
    sizeInKB,
    lastUpdated: db.lastUpdated,
    counts: {
      products: db.products.length,
      clients: db.clients.length,
      suppliers: db.suppliers.length,
      inquiries: db.inquiries.length,
      purchaseOrders: db.purchaseOrders.length,
      receptions: db.receptions.length,
      saleOrders: db.saleOrders.length,
      pointsDeVente: db.pointsDeVente.length,
      transactions: db.transactions.length,
      treasuryMovements: db.treasuryMovements.length
    }
  };
}
