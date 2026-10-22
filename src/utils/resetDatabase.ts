import { AppDatabase } from '../services/storageService';

/**
 * Remise à zéro de la base de données.
 *
 * Toutes les collections métier sont vidées et les compteurs de numérotation
 * repartent de zéro. Sont conservés, car indispensables au fonctionnement :
 * - `users` : les comptes configurés — sans eux, plus personne ne pourrait se
 *   connecter après la purge ;
 * - `companyConfig` : l'identité de la société imprimée sur les documents.
 *
 * Le journal d'audit est vidé également ; l'application y réécrit immédiatement
 * une entrée `database.reset` afin que la purge reste tracée.
 */
export function buildWipedDatabase(db: AppDatabase): AppDatabase {
  return {
    version: db.version || 1,
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
    users: db.users || [],
    auditLogs: [],
    valuations: [],
    physicalInventories: [],
    stockAdjustments: [],
    stockTransfers: [],
    stockLosses: [],
    customerReturns: [],
    supplierReturns: [],
    companyConfig: db.companyConfig ?? null
  };
}
