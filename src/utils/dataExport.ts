import { AppDatabase } from '../services/storageService';
import { parseAppDate } from './dateUtils';
import type { XCell } from './xlsxWriter';

/**
 * Catalogue des parties exportables — construit UNIQUEMENT sur les
 * collections réelles de AppDatabase (aucun module fictif).
 * Lecture seule stricte : aucune mutation des données.
 */

export interface ExportFilters {
  from?: string; // 'YYYY-MM-DD'
  to?: string;   // 'YYYY-MM-DD'
  depot?: string;
  clientId?: string;
  supplierId?: string;
}

export interface ExportPartDef {
  id: string;
  label: string;
  sheetName: string; // ≤ 31 car., compatible Excel
  description?: string;
  supports?: {
    period?: boolean;
    depot?: boolean;
    client?: boolean;
    supplier?: boolean;
  };
  columns: string[];
  buildRows: (db: AppDatabase, f: ExportFilters) => XCell[][];
}

const inPeriod = (date: string | undefined | null, f: ExportFilters): boolean => {
  if (!f.from && !f.to) return true;
  const d = parseAppDate(date);
  if (isNaN(d.getTime())) return false;
  const from = f.from ? parseAppDate(`${f.from} 00:00`) : null;
  const to = f.to ? parseAppDate(`${f.to} 23:59`) : null;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
};

const matchDepot = (depot: string | undefined | null, f: ExportFilters): boolean =>
  !f.depot || depot === f.depot;

const byClient = (id: string | undefined, name: string | undefined, db: AppDatabase, f: ExportFilters): boolean => {
  if (!f.clientId) return true;
  const c = db.clients.find(x => x.id === f.clientId);
  return id === f.clientId || (!!c && name === c.name);
};

const bySupplier = (id: string | undefined, name: string | undefined, db: AppDatabase, f: ExportFilters): boolean => {
  if (!f.supplierId) return true;
  const s = db.suppliers.find(x => x.id === f.supplierId);
  return id === f.supplierId || (!!s && name === s.name);
};

export const EXPORT_PARTS: ExportPartDef[] = [
  // ------------------------------------------------ Référentiels
  {
    id: 'articles',
    label: 'Articles & produits',
    sheetName: 'Articles',
    supports: { depot: true },
    columns: ['ID', 'Code', 'Code-barres', 'Désignation', 'Famille', 'Dépôt', 'Stock', 'Seuil alerte', 'Unité', 'Unité stockage', 'Prix achat (FCFA)', 'Prix vente (FCFA)', 'TVA achat %', 'TVA vente %', 'Disponible PV', 'Stockable', 'Dernier réappro'],
    buildRows: (db, f) =>
      db.products
        .filter(p => matchDepot(p.location, f))
        .map(p => [p.id, p.code, p.barcode || '', p.name, p.category || '', p.location || '', p.stock, p.minStock, p.unit || '', p.storageUnit || '', p.buyPrice, p.sellPrice, p.vatPurchase ?? '', p.vatSale ?? '', p.availableInPOS ? 'Oui' : 'Non', p.isStockable !== false ? 'Oui' : 'Non', p.lastRestocked || ''])
  },
  {
    id: 'categories',
    label: 'Familles & catégories',
    sheetName: 'Categories',
    columns: ['ID', 'Nom', 'Description'],
    buildRows: db => db.categories.map(c => [c.id, c.name, c.description || ''])
  },
  {
    id: 'stocks',
    label: 'Stocks actuels',
    sheetName: 'Stocks',
    description: 'Photographie des quantités en fiche produit',
    supports: { depot: true },
    columns: ['ID produit', 'Code', 'Désignation', 'Dépôt', 'Stock actuel', 'Seuil alerte', 'Écart seuil', 'Unité stockage', 'Valeur (prix achat)'],
    buildRows: (db, f) =>
      db.products
        .filter(p => p.isStockable !== false && matchDepot(p.location, f))
        .map(p => [p.id, p.code, p.name, p.location || '', p.stock, p.minStock, p.stock - p.minStock, p.storageUnit || p.unit || '', p.stock * p.buyPrice])
  },
  {
    id: 'sites',
    label: 'Magasins & rayons',
    sheetName: 'Emplacements',
    columns: ['ID', 'Nom', 'Type', 'Capacité', 'Nb étagères', 'Magasin rattaché', 'Zone', 'Description', 'Créé le'],
    buildRows: db => {
      const nameById = new Map(db.storageSites.map(s => [s.id, s.name]));
      return db.storageSites.map(s => [s.id, s.name, s.type, s.capacity ?? '', s.shelfCount ?? '', s.magasinId ? nameById.get(s.magasinId) || s.magasinId : '', s.location || '', s.description || '', s.createdAt || '']);
    }
  },
  {
    id: 'clients',
    label: 'Clients',
    sheetName: 'Clients',
    columns: ['ID', 'Nom', 'Type', 'Téléphone', 'Email', 'Adresse', 'Solde crédit (FCFA)', 'Total achats (FCFA)'],
    buildRows: (db, f) =>
      db.clients
        .filter(c => byClient(c.id, c.name, db, f))
        .map(c => [c.id, c.name, c.type, c.phone || '', c.email || '', c.address || '', c.creditBalance, c.totalPurchases])
  },
  {
    id: 'fournisseurs',
    label: 'Fournisseurs',
    sheetName: 'Fournisseurs',
    columns: ['ID', 'Nom', 'Contact', 'Téléphone', 'Email', 'Adresse', 'Catégories', 'Dette (FCFA)', 'Total achats (FCFA)'],
    buildRows: (db, f) =>
      db.suppliers
        .filter(s => bySupplier(s.id, s.name, db, f))
        .map(s => [s.id, s.name, s.contactPerson || '', s.phone || '', s.email || '', s.address || '', (s.categories || []).join(', '), s.balance, s.totalPurchases ?? ''])
  },
  {
    id: 'utilisateurs',
    label: 'Utilisateurs',
    sheetName: 'Utilisateurs',
    description: 'Comptes — mots de passe et secrets exclus',
    columns: ['ID', 'Identifiant', 'Nom', 'Rôle', 'Email', 'Téléphone', 'Actif', 'Section par défaut', 'Sections autorisées'],
    buildRows: db =>
      db.users.map(u => [
        u.id, u.username, u.name, u.role, u.email || '', u.phone || '',
        u.active === false ? 'Non' : 'Oui', u.defaultSection, (u.allowedSections || []).join(', ')
      ])
  },

  // ------------------------------------------------ Stock & inventaire
  {
    id: 'mouvements',
    label: 'Mouvements de stock',
    sheetName: 'MouvementsStock',
    supports: { period: true },
    columns: ['ID', 'Date', 'Type', 'ID produit', 'Désignation', 'Quantité', 'Motif', 'Référence', 'Opérateur'],
    buildRows: (db, f) =>
      db.movements
        .filter(m => inPeriod(m.date, f))
        .map(m => [m.id, m.date, m.type, m.productId, m.productName, m.quantity, m.reason, m.reference, m.performedBy])
  },
  {
    id: 'approvisionnements',
    label: 'Approvisionnements',
    sheetName: 'Approvisionnements',
    supports: { period: true, depot: true, supplier: true },
    columns: ['ID', 'Référence', 'Date', 'Réception', 'Fournisseur', 'Destination', 'Type dest.', 'Nb lignes', 'Qté totale', 'Valeur (FCFA)', 'Statut', 'Opérateur'],
    buildRows: (db, f) =>
      db.approvisionnements
        .filter(a => inPeriod(a.date, f) && matchDepot(a.targetLocation, f) && bySupplier(undefined, a.supplierName, db, f))
        .map(a => [a.id, a.reference, a.date, a.receptionNumber || '', a.supplierName || '', a.targetLocation || '', a.destinationType || '', a.totalItemsCount, a.totalQuantity, a.totalValue, a.status, a.operator])
  },
  {
    id: 'appro_lignes',
    label: 'Lignes d\'approvisionnement',
    sheetName: 'LignesAppro',
    supports: { period: true, depot: true },
    columns: ['ID appro', 'Référence', 'Date appro', 'ID produit', 'Code', 'Désignation', 'Code-barres', 'Quantité', 'Prix achat', 'Unité', 'Destination ligne', 'Péremption'],
    buildRows: (db, f) =>
      db.approvisionnements
        .filter(a => inPeriod(a.date, f) && matchDepot(a.targetLocation, f))
        .flatMap(a => a.items.map(i => [a.id, a.reference, a.date, i.productId, i.productCode || '', i.productName, i.barcode || '', i.quantity, i.unitPrice ?? '', i.unit || '', i.targetLocation || a.targetLocation || '', i.expirationDate || '']))
  },
  {
    id: 'inventaires',
    label: 'Inventaires physiques',
    sheetName: 'Inventaires',
    supports: { period: true, depot: true },
    columns: ['ID', 'Code', 'Date réf.', 'Début', 'Fin', 'Dépôt', 'Famille', 'Type', 'Mode', 'Opérateur', 'Statut', 'Nb lignes', 'Écart qté', 'Écart valeur (FCFA)', 'Régularisé'],
    buildRows: (db, f) =>
      (db.physicalInventories || [])
        .filter(i => inPeriod(i.referenceDate, f) && (f.depot ? i.depot === 'ALL' || i.depot === f.depot : true))
        .map(i => [i.id, i.code, i.referenceDate, i.startDate, i.endDate || '', i.depot, i.categoryFilter, i.type, i.countingMode, i.operator, i.status, i.items.length, i.totalDiscrepancyQty, i.totalDiscrepancyValue, i.adjustmentsApplied ? 'Oui' : 'Non'])
  },
  {
    id: 'inventaires_lignes',
    label: 'Lignes d\'inventaire',
    sheetName: 'LignesInventaire',
    supports: { period: true, depot: true },
    columns: ['ID inventaire', 'Code inv.', 'Date réf.', 'ID produit', 'Code', 'Désignation', 'Dépôt', 'Théorique', 'Compté 1', 'Compté 2', 'Retenu', 'Écart', 'Coût unit.', 'Écart valeur', 'Statut ligne', 'Justification'],
    buildRows: (db, f) =>
      (db.physicalInventories || [])
        .filter(i => inPeriod(i.referenceDate, f))
        .flatMap(i => i.items
          .filter(l => matchDepot(l.depot, f))
          .map(l => [i.id, i.code, i.referenceDate, l.productId, l.productCode, l.productName, l.depot, l.theoreticalStock, l.count1 ?? '', l.count2 ?? '', l.physicalCount ?? '', l.discrepancy ?? '', l.unitPrice, l.discrepancyValue ?? '', l.countStatus, l.justification || '']))
  },
  {
    id: 'ajustements',
    label: 'Ajustements de stock',
    sheetName: 'Ajustements',
    supports: { period: true, depot: true },
    columns: ['ID', 'Code', 'Date', 'Dépôt', 'Motif général', 'Opérateur', 'Statut', 'Nb lignes', 'Qté +', 'Qté −', 'Écart valeur (FCFA)', 'Validé par', 'Annulé par'],
    buildRows: (db, f) =>
      (db.stockAdjustments || [])
        .filter(a => inPeriod(a.date, f) && (f.depot ? a.depot === 'ALL' || a.depot === f.depot : true))
        .map(a => [a.id, a.code, a.date, a.depot, a.generalReason || '', a.operator, a.status, a.lines.length, a.totalPositiveQty, a.totalNegativeQty, a.totalDiscrepancyValue, a.validatedBy || '', a.cancelledBy || ''])
  },
  {
    id: 'ajustements_lignes',
    label: 'Lignes d\'ajustement',
    sheetName: 'LignesAjustement',
    supports: { period: true, depot: true },
    columns: ['ID ajustement', 'Code', 'Date', 'ID produit', 'Code prod.', 'Désignation', 'Dépôt', 'Théorique', 'Constaté', 'Écart', 'Coût unit.', 'Écart valeur', 'Motif'],
    buildRows: (db, f) =>
      (db.stockAdjustments || [])
        .filter(a => inPeriod(a.date, f))
        .flatMap(a => a.lines
          .filter(l => matchDepot(l.depot, f))
          .map(l => [a.id, a.code, a.date, l.productId, l.productCode, l.productName, l.depot, l.theoreticalStock, l.countedStock ?? '', l.discrepancy ?? '', l.unitPrice, l.discrepancyValue ?? '', l.reason || '']))
  },
  {
    id: 'valorisations',
    label: 'Valorisations archivées',
    sheetName: 'Valorisations',
    supports: { period: true, depot: true },
    columns: ['ID', 'Code', 'Date réf.', 'Méthode', 'Dépôt', 'Famille', 'Nb articles', 'Qté totale', 'Valeur (FCFA)', 'Ruptures', 'Anomalies', 'Créé par', 'Créé le'],
    buildRows: (db, f) =>
      (db.valuations || [])
        .filter(v => inPeriod(v.valuationDate, f) && (f.depot ? v.depotFilter === 'ALL' || v.depotFilter === f.depot : true))
        .map(v => [v.id, v.code, v.valuationDate, v.method, v.depotFilter, v.categoryFilter, v.articleCount, v.totalQuantity, v.totalValue, v.ruptureCount, v.anomalyCount, v.createdBy, v.createdAt])
  },
  {
    id: 'transferts',
    label: 'Transferts magasins',
    sheetName: 'Transferts',
    supports: { period: true, depot: true },
    columns: ['ID', 'Code', 'Date', 'Source', 'Destination', 'Opérateur', 'Réceptionnaire', 'Statut', 'Nb lignes', 'Valeur (FCFA)', 'Réceptionné par', 'Annulé par'],
    buildRows: (db, f) =>
      (db.stockTransfers || [])
        .filter(t => inPeriod(t.date, f) && (f.depot ? t.sourceLocation === f.depot || t.targetLocation === f.depot : true))
        .map(t => [t.id, t.code, t.date, t.sourceLocation, t.targetLocation, t.operator, t.receiver || '', t.status, t.items.length, t.totalValue ?? '', t.receivedBy || '', t.cancelledBy || ''])
  },
  {
    id: 'transferts_lignes',
    label: 'Lignes de transfert',
    sheetName: 'LignesTransfert',
    supports: { period: true, depot: true },
    columns: ['ID transfert', 'Code', 'Date', 'Source', 'Destination', 'ID produit', 'Code prod.', 'Désignation', 'Quantité', 'Unité', 'Coût unit. (CUMP figé)'],
    buildRows: (db, f) =>
      (db.stockTransfers || [])
        .filter(t => inPeriod(t.date, f) && (f.depot ? t.sourceLocation === f.depot || t.targetLocation === f.depot : true))
        .flatMap(t => t.items.map(i => [t.id, t.code, t.date, t.sourceLocation, t.targetLocation, i.productId, i.productCode || '', i.productName, i.quantity, i.unit, i.unitPrice ?? '']))
  },
  {
    id: 'pertes',
    label: 'Pertes & produits avariés',
    sheetName: 'PertesAvaries',
    supports: { period: true, depot: true },
    columns: ['ID', 'Code', 'Date', 'ID produit', 'Code prod.', 'Désignation', 'Quantité', 'Unité', 'Dépôt', 'Coût unit.', 'Valeur perte (FCFA)', 'Type', 'Statut', 'Opérateur', 'Déstocké par'],
    buildRows: (db, f) =>
      (db.stockLosses || [])
        .filter(l => inPeriod(l.date, f) && matchDepot(l.depot, f))
        .map(l => [l.id, l.code, l.date, l.productId, l.productCode || '', l.productName, l.quantity, l.unit, l.depot || '', l.unitPrice, l.totalLossValue, l.type, l.status, l.operator, l.destockedBy || ''])
  },

  // ------------------------------------------------ Ventes
  {
    id: 'ventes',
    label: 'Ventes & factures clients',
    sheetName: 'Ventes',
    description: 'Les ventes VTE tiennent lieu de factures clients',
    supports: { period: true, client: true },
    columns: ['ID', 'N° Vente/Facture', 'Date', 'ID client', 'Client', 'Total HT (FCFA)', 'Remise', 'TVA', 'Net à payer (FCFA)', 'Règlement', 'Statut', 'Vendeur', 'ID session PV', 'Session PV'],
    buildRows: (db, f) =>
      db.saleOrders
        .filter(s => inPeriod(s.date, f) && byClient(s.clientId, s.clientName, db, f))
        .map(s => [s.id, s.code, s.date, s.clientId || '', s.clientName, s.totalAmount, s.discount, s.tax, s.finalAmount, s.paymentMethod, s.status, s.sellerName, s.pointDeVenteId || '', s.pointDeVenteCode || ''])
  },
  {
    id: 'lignes_ventes',
    label: 'Lignes de vente',
    sheetName: 'LignesVente',
    supports: { period: true, client: true },
    columns: ['ID vente', 'N° vente', 'Date', 'Client', 'ID produit', 'Désignation', 'Quantité', 'UOV', 'Contenance', 'Prix vente', 'Coût achat figé', 'Total ligne (FCFA)'],
    buildRows: (db, f) =>
      db.saleOrders
        .filter(s => inPeriod(s.date, f) && byClient(s.clientId, s.clientName, db, f))
        .flatMap(s => s.items.map(i => [s.id, s.code, s.date, s.clientName, i.productId, i.productName, i.quantity, i.unitName || '', i.unitQuantity ?? '', i.unitPrice, i.buyPrice ?? '', i.total]))
  },
  {
    id: 'caisse',
    label: 'Sessions de caisse (Points de vente)',
    sheetName: 'Caisse',
    supports: { period: true },
    columns: ['ID', 'Code', 'Date', 'Opérateur', 'Fond de caisse (FCFA)', 'Solde fermeture', 'Ouverture', 'Fermeture', 'Statut', 'CA total', 'Espèces', 'Crédit', 'Mobile Money', 'Carte', 'Théorique', 'Écart caisse'],
    buildRows: (db, f) =>
      db.pointsDeVente
        .filter(p => inPeriod(p.date, f))
        .map(p => [p.id, p.code, p.date, p.operator, p.openingAmount, p.closingAmount ?? '', p.openedAt, p.closedAt || '', p.status, p.totalSalesAmount ?? '', p.cashSalesAmount ?? '', p.creditSalesAmount ?? '', p.mobileSalesAmount ?? '', p.cardSalesAmount ?? '', p.expectedClosingAmount ?? '', p.cashDifference ?? ''])
  },
  {
    id: 'retours_clients',
    label: 'Retours clients',
    sheetName: 'RetoursClients',
    supports: { period: true, client: true },
    columns: ['ID', 'N° Retour', 'Date', 'ID vente', 'N° vente', 'ID client', 'Client', 'Montant (FCFA)', 'Déduit crédit', 'Avoir', 'N° avoir', 'Statut', 'Opérateur', 'Validé par', 'Annulé par'],
    buildRows: (db, f) =>
      (db.customerReturns || [])
        .filter(r => inPeriod(r.date, f) && byClient(r.clientId, r.clientName, db, f))
        .map(r => [r.id, r.code, r.date, r.saleId, r.saleCode, r.clientId || '', r.clientName || '', r.totalAmount, r.creditDeduction ?? '', r.avoirAmount ?? '', r.avoirNumber || '', r.status, r.operator, r.validatedBy || '', r.cancelledBy || ''])
  },
  {
    id: 'retours_clients_lignes',
    label: 'Lignes de retours clients',
    sheetName: 'LignesRetoursClients',
    supports: { period: true, client: true },
    columns: ['ID retour', 'N° retour', 'Date', 'N° vente', 'ID produit', 'Désignation', 'Qté vendue', 'Qté retournée', 'Prix vente', 'Coût achat figé', 'Réintégré', 'Montant ligne'],
    buildRows: (db, f) =>
      (db.customerReturns || [])
        .filter(r => inPeriod(r.date, f) && byClient(r.clientId, r.clientName, db, f))
        .flatMap(r => r.items.map(i => [r.id, r.code, r.date, r.saleCode, i.productId, i.productName, i.saleQty, i.returnedQty, i.unitPrice, i.buyPrice, i.restock ? 'Oui' : 'Non', i.returnedQty * i.unitPrice]))
  },
  {
    id: 'avoirs_clients',
    label: 'Avoirs clients',
    sheetName: 'AvoirsClients',
    supports: { period: true, client: true },
    columns: ['ID avoir', 'ID client', 'Client', 'N° avoir', 'Document source', 'Date', 'Motif', 'Montant (FCFA)', 'Remboursé', 'Solde', 'Statut'],
    buildRows: (db, f) =>
      db.clients
        .filter(c => byClient(c.id, c.name, db, f))
        .flatMap(c => (c.avoirLines || [])
          .filter(a => inPeriod(a.date, f))
          .map(a => [a.id, c.id, c.name, a.avoirNumber, a.sourceRef, a.date, a.reason, a.totalAmount, a.refundedAmount, a.remainingBalance, a.status]))
  },
  {
    id: 'credits_clients',
    label: 'Crédits clients',
    sheetName: 'CreditsClients',
    supports: { period: true, client: true },
    columns: ['ID crédit', 'ID client', 'Client', 'N° crédit', 'Réf. vente/facture', 'Date', 'Montant initial', 'Versé', 'Reste à payer', 'Échéance', 'Statut'],
    buildRows: (db, f) =>
      db.clients
        .filter(c => byClient(c.id, c.name, db, f))
        .flatMap(c => (c.creditLines || [])
          .filter(l => inPeriod(l.date, f))
          .map(l => [l.id, c.id, c.name, l.creditNumber, l.invoiceRef, l.date, l.initialAmount, l.paidAmount, l.remainingAmount, l.dueDate || '', l.status]))
  },
  {
    id: 'reglements_clients',
    label: 'Règlements clients',
    sheetName: 'ReglementsClients',
    supports: { period: true, client: true },
    columns: ['ID règlement', 'N° règlement', 'ID client', 'Client', 'N° crédit', 'Date', 'Montant versé', 'Reste après', 'Mode', 'Référence', 'Opérateur'],
    buildRows: (db, f) =>
      db.clients
        .filter(c => byClient(c.id, c.name, db, f))
        .flatMap(c => (c.creditLines || []).flatMap(l => (l.payments || [])
          .filter(p => inPeriod(p.date, f))
          .map(p => [p.id, p.paymentNumber, c.id, c.name, l.creditNumber, p.date, p.amount, p.remainingAmount, p.paymentMethod || '', p.reference || '', p.operator])))
  },

  // ------------------------------------------------ Achats
  {
    id: 'demandes_prix',
    label: 'Demandes de prix',
    sheetName: 'DemandesPrix',
    supports: { period: true, supplier: true },
    columns: ['ID', 'Code', 'Date', 'Acheteur', 'Échéance', 'ID fournisseur', 'Fournisseur', 'Nb lignes', 'Total HT', 'TVA %', 'Total TVA', 'Total TTC', 'Statut'],
    buildRows: (db, f) =>
      db.inquiries
        .filter(i => inPeriod(i.date, f) && bySupplier(i.supplierId, i.supplierName, db, f))
        .map(i => [i.id, i.code, i.date, i.buyer || '', i.orderDeadline || '', i.supplierId, i.supplierName, i.items.length, i.totalHT ?? '', i.vatRate ?? '', i.totalVAT ?? '', i.totalTTC ?? '', i.status])
  },
  {
    id: 'achats',
    label: 'Achats (bons de commande)',
    sheetName: 'Achats',
    supports: { period: true, supplier: true },
    columns: ['ID', 'N° BC', 'Date', 'Demande source', 'Acheteur', 'Échéance', 'Réception prévue', 'ID fournisseur', 'Fournisseur', 'Total HT', 'TVA %', 'Total TVA', 'Total TTC', 'Statut', 'Règlement', 'Mode règlement'],
    buildRows: (db, f) =>
      db.purchaseOrders
        .filter(p => inPeriod(p.date, f) && bySupplier(p.supplierId, p.supplierName, db, f))
        .map(p => [p.id, p.code, p.date, p.inquiryCode || '', p.buyer || '', p.orderDeadline || '', p.expectedDate || '', p.supplierId, p.supplierName, p.totalHT ?? '', p.vatRate ?? '', p.totalVAT ?? '', p.totalTTC ?? p.totalAmount, p.status, p.paymentStatus || '', p.paymentMode || ''])
  },
  {
    id: 'lignes_achats',
    label: 'Lignes d\'achat',
    sheetName: 'LignesAchat',
    supports: { period: true, supplier: true },
    columns: ['ID BC', 'N° BC', 'Date', 'Fournisseur', 'ID produit', 'Désignation', 'UOA', 'Qta', 'Quantité', 'Prix unit.', 'TVA %', 'TVA', 'Total ligne (FCFA)'],
    buildRows: (db, f) =>
      db.purchaseOrders
        .filter(p => inPeriod(p.date, f) && bySupplier(p.supplierId, p.supplierName, db, f))
        .flatMap(p => p.items.map(i => [p.id, p.code, p.date, i.supplierName || p.supplierName, i.productId, i.productName, i.uoa || '', i.qta ?? '', i.quantity, i.unitPrice, i.vatRate ?? '', i.vatAmount ?? '', i.total]))
  },
  {
    id: 'receptions',
    label: 'Réceptions marchandises',
    sheetName: 'Receptions',
    supports: { period: true, supplier: true },
    columns: ['ID', 'N° Réception', 'Date', 'N° BC', 'ID fournisseur', 'Fournisseur', 'Réceptionnaire', 'Total HT', 'TVA', 'Total TTC', 'Statut'],
    buildRows: (db, f) =>
      db.receptions
        .filter(r => inPeriod(r.date, f) && bySupplier(r.supplierId, r.supplierName, db, f))
        .map(r => [r.id, r.code, r.date, r.purchaseOrderCode || '', r.supplierId || '', r.supplierName, r.receiverName, r.totalHT ?? '', r.totalVAT ?? '', r.totalTTC ?? r.totalAmount ?? '', r.status])
  },
  {
    id: 'receptions_lignes',
    label: 'Lignes de réception',
    sheetName: 'LignesReception',
    supports: { period: true, supplier: true },
    columns: ['ID réception', 'N° réception', 'Date', 'Fournisseur', 'ID produit', 'Désignation', 'Commandée', 'Reçue', 'Acceptée', 'Péremption', 'Prix unit.', 'Total ligne'],
    buildRows: (db, f) =>
      db.receptions
        .filter(r => inPeriod(r.date, f) && bySupplier(r.supplierId, r.supplierName, db, f))
        .flatMap(r => r.items.map(i => [r.id, r.code, r.date, i.supplierName || r.supplierName, i.productId, i.productName, i.orderedQty, i.receivedQty, i.acceptedQty, i.expirationDate || '', i.unitPrice ?? '', i.total ?? '']))
  },
  {
    id: 'retours_fournisseurs',
    label: 'Retours fournisseurs',
    sheetName: 'RetoursFournisseurs',
    supports: { period: true, supplier: true },
    columns: ['ID', 'N° Retour', 'Date', 'ID fournisseur', 'Fournisseur', 'Doc. source', 'Montant (FCFA)', 'Déduit dette', 'Avoir', 'N° avoir', 'Statut', 'Opérateur'],
    buildRows: (db, f) =>
      (db.supplierReturns || [])
        .filter(r => inPeriod(r.date, f) && bySupplier(r.supplierId, r.supplierName, db, f))
        .map(r => [r.id, r.code, r.date, r.supplierId, r.supplierName, r.sourceRef || '', r.totalAmount, r.debtDeduction ?? '', r.avoirAmount ?? '', r.avoirNumber || '', r.status, r.operator])
  },
  {
    id: 'dettes_fournisseurs',
    label: 'Dettes fournisseurs',
    sheetName: 'DettesFournisseurs',
    supports: { period: true, supplier: true },
    columns: ['ID dette', 'ID fournisseur', 'Fournisseur', 'N° dette', 'Réf. facture/réception', 'Date', 'Montant initial', 'Payé', 'Reste à payer', 'Échéance', 'Statut'],
    buildRows: (db, f) =>
      db.suppliers
        .filter(s => bySupplier(s.id, s.name, db, f))
        .flatMap(s => (s.creditLines || [])
          .filter(l => inPeriod(l.date, f))
          .map(l => [l.id, s.id, s.name, l.creditNumber, l.invoiceRef, l.date, l.initialAmount, l.paidAmount, l.remainingAmount, l.dueDate || '', l.status]))
  },
  {
    id: 'paiements_fournisseurs',
    label: 'Paiements fournisseurs',
    sheetName: 'PaiementsFournisseurs',
    supports: { period: true, supplier: true },
    columns: ['ID paiement', 'N° paiement', 'ID fournisseur', 'Fournisseur', 'N° dette', 'Date', 'Montant versé', 'Reste après', 'Mode', 'Référence', 'Opérateur'],
    buildRows: (db, f) =>
      db.suppliers
        .filter(s => bySupplier(s.id, s.name, db, f))
        .flatMap(s => (s.creditLines || []).flatMap(l => (l.payments || [])
          .filter(p => inPeriod(p.date, f))
          .map(p => [p.id, p.paymentNumber, s.id, s.name, l.creditNumber, p.date, p.amount, p.remainingAmount, p.paymentMethod || '', p.reference || '', p.operator])))
  },
  {
    id: 'avoirs_fournisseurs',
    label: 'Avoirs fournisseurs',
    sheetName: 'AvoirsFournisseurs',
    supports: { period: true, supplier: true },
    columns: ['ID avoir', 'ID fournisseur', 'Fournisseur', 'N° avoir', 'Document source', 'Date', 'Motif', 'Montant (FCFA)', 'Remboursé/déduit', 'Solde', 'Statut'],
    buildRows: (db, f) =>
      db.suppliers
        .filter(s => bySupplier(s.id, s.name, db, f))
        .flatMap(s => (s.avoirLines || [])
          .filter(a => inPeriod(a.date, f))
          .map(a => [a.id, s.id, s.name, a.avoirNumber, a.sourceRef, a.date, a.reason, a.totalAmount, a.refundedAmount, a.remainingBalance, a.status]))
  },

  // ------------------------------------------------ Finance
  {
    id: 'transactions',
    label: 'Recettes & dépenses',
    sheetName: 'RecettesDepenses',
    supports: { period: true },
    columns: ['ID', 'Code', 'Date', 'Type', 'Catégorie', 'Montant (FCFA)', 'Mode', 'Compte', 'Référence', 'Tiers', 'Statut', 'Saisi par', 'Notes'],
    buildRows: (db, f) =>
      db.transactions
        .filter(t => inPeriod(t.date, f))
        .map(t => [t.id, t.code, t.date, t.type, t.category, t.amount, t.paymentMethod, t.account, t.reference || '', t.thirdParty || '', t.status, t.recordedBy, t.notes || ''])
  },
  {
    id: 'comptes',
    label: 'Comptes & trésorerie',
    sheetName: 'ComptesTresorerie',
    description: 'Caisses, banques et comptes mobile money',
    columns: ['ID', 'Nom', 'Type', 'N° compte', 'Solde (FCFA)', 'Devise', 'Mis à jour', 'Description'],
    buildRows: db =>
      db.treasuryAccounts.map(a => [a.id, a.name, a.type, a.accountNumber || '', a.balance, a.currency, a.lastUpdated || '', a.description || ''])
  },
  {
    id: 'mouvements_tresorerie',
    label: 'Mouvements bancaires & caisse',
    sheetName: 'MvtsTresorerie',
    supports: { period: true },
    columns: ['ID', 'Code', 'Date', 'Type', 'Compte source', 'Compte destination', 'Montant (FCFA)', 'Motif', 'Référence', 'Opérateur'],
    buildRows: (db, f) =>
      db.treasuryMovements
        .filter(t => inPeriod(t.date, f))
        .map(t => [t.id, t.code, t.date, t.type, t.fromAccount || '', t.toAccount || '', t.amount, t.reason, t.reference || '', t.performedBy])
  },

  // ------------------------------------------------ Paramètres & audit
  {
    id: 'parametres',
    label: 'Paramètres généraux',
    sheetName: 'Parametres',
    description: 'Configuration société (logo exclu)',
    columns: ['Champ', 'Valeur'],
    buildRows: db => {
      const c = db.companyConfig;
      if (!c) return [];
      return [
        ['Raison sociale', c.name || ''],
        ['Adresse', c.address || ''],
        ['Téléphone', c.phone || ''],
        ['Email', c.email || ''],
        ['RCCM', c.rccm || ''],
        ['NCC', c.ncc || ''],
        ['Logo présent', c.logo ? 'Oui' : 'Non'],
        ['Mis à jour', c.updatedAt || '']
      ];
    }
  },
  {
    id: 'audit',
    label: 'Journal d\'audit',
    sheetName: 'Audit',
    description: 'Historique des actions — données sensibles, réservé Admin/Gérant',
    supports: { period: true },
    columns: ['ID', 'Date/heure', 'Acteur', 'Compte', 'Action', 'Entité', 'Réf. entité', 'Détails'],
    buildRows: (db, f) =>
      db.auditLogs
        .filter(a => inPeriod(a.at, f))
        .map(a => [a.id, a.at, a.actor, a.username || '', a.action, a.entity, a.entityRef || '', a.details || ''])
  }
];

/** Options de dépôt disponibles (magasins + emplacements produits). */
export function depotOptions(db: AppDatabase): string[] {
  const names = new Set<string>();
  db.storageSites.forEach(s => s.name && names.add(s.name));
  db.products.forEach(p => p.location && names.add(p.location));
  return Array.from(names).sort();
}
