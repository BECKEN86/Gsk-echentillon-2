export type NavSection = 
  | 'accueil'
  | 'inventaire-approvisionnement'
  | 'inventaire-magasins'
  | 'inventaire-produits'
  | 'inventaire-physique'
  | 'inventaire-valorisation'
  | 'inventaire-ajustement'
  | 'inventaire-transferts'
  | 'inventaire-pertes-avaries'
  | 'acteurs-clients'
  | 'acteurs-fournisseurs'
  | 'achat-demande-prix'
  | 'achat-bon-commande'
  | 'achat-reception'
  | 'vente-pos'
  | 'vente-sessions'
  | 'vente-commande'
  | 'vente-retours'
  | 'achat-retours'
  | 'inventaire-peremption'
  | 'finance-recettes-depenses'
  | 'finance-marges-resultat'
  | 'finance-tresorerie-caisses'
  | 'parametres-utilisateurs'
  | 'parametres-configuration'
  | 'parametres-import'
  | 'parametres-export'
  | 'parametres-audit'
  | 'guide-utilisateur';

export interface ProductCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  color?: string;
}

export type OperationalUnitType = 'UOA' | 'UOV';

export interface OperationalUnit {
  id?: string;
  name?: string; // rétro-compatibilité
  label: string; // Libellé
  type: OperationalUnitType; // Type: UOA ou UOV
  quantity: number; // Quantité
  price: number; // Prix
}

export const STORAGE_CONTAINER_UNITS = [
  'sac',
  'boîte',
  'bidon',
  'carton',
  'casier',
  'fût',
  'palette',
  'bouteille',
  'paquet',
  'rouleau',
  'sachet',
  'bac',
  'pièce'
] as const;

export const MEASUREMENT_UNITS = [
  'kilogramme',
  'litre',
  'mètre',
  'gramme',
  'centilitre',
  'millilitre',
  'centimètre',
  'mètre carré',
  'mètre cube',
  'pièce'
] as const;

// Alias pour compatibilité
export const STORAGE_UNITS = STORAGE_CONTAINER_UNITS;

export interface Product {
  id: string;
  code: string; // SKU
  barcode?: string; // Code-barres ou QR code
  name: string;
  category: string;
  categoryId?: string;
  imageUrl?: string;
  buyPrice: number; // Prix d'achat en FCFA
  sellPrice: number; // Prix de vente en FCFA
  vatPurchase?: number; // TVA sur achat (%)
  vatSale?: number; // TVA sur vente (%)
  stock: number;
  minStock: number; // Seuil d'alerte
  unit: string; // Unité générale
  storageUnit?: string; // Unité de stockage (sac, boite, bidon, carton...)
  measurementUnit?: string; // Unité de mesure (litre, mètre, kg...)
  availableInPOS: boolean; // Disponible dans le point de vente (Disponible PV)
  isStockable: boolean; // Stockable (suivi d'inventaire et mouvements)
  operationalUnits?: OperationalUnit[]; // Chaque produit peut avoir plusieurs UOA et UOV
  uov?: OperationalUnit; // Rétro-compatibilité
  uoa?: OperationalUnit; // Rétro-compatibilité
  location?: string; // Rayon ou magasin (emplacement de stockage par défaut)
  lastRestocked?: string;
}

export interface CreditPayment {
  id: string;
  paymentNumber: string; // Paiement n° (ex: PAI-001)
  date: string; // Date et heure (ex: 2026-07-31 10:15)
  amount: number; // Montant versé
  remainingAmount: number; // Reste à payer après ce versement
  operator: string; // Celui qui a fait la saisie (opérateur)
  paymentMethod?: string; // Espèces, Mobile Money, Virement, Chèque
  reference?: string; // N° de reçu / transaction
}

export interface ClientCreditLine {
  id: string;
  clientId: string;
  creditNumber: string; // Référence crédit (ex: CRD-2026-001)
  invoiceRef: string; // Réf Vente ou Facture (ex: VTE-2026-098)
  date: string; // Date de création
  initialAmount: number; // Montant initial
  paidAmount: number; // Montant déjà versé
  remainingAmount: number; // Reste à payer
  dueDate?: string; // Date d'échéance
  status: 'En cours' | 'Soldé' | 'En retard';
  notes?: string;
  payments: CreditPayment[]; // Historique de versements
}

export interface AvoirRefund {
  id: string;
  refundNumber: string; // Remboursement n° (ex: RMB-001)
  date: string; // Date et heure
  amount: number; // Montant remboursé / déduit
  remainingBalance: number; // Solde restant de l'avoir
  operator: string; // Opérateur ayant fait la saisie
  refundMethod?: string; // Espèces, Avoir sur vente, Mobile Money, Virement
  notes?: string;
}

export interface ClientAvoirLine {
  id: string;
  clientId: string;
  avoirNumber: string; // Référence avoir (ex: AV-2026-001)
  sourceRef: string; // Réf Vente ou Retour (ex: RET-2026-003)
  date: string; // Date d'émission
  reason: string; // Motif de l'avoir (Retour produit, Remise, Trop-perçu)
  totalAmount: number; // Montant initial de l'avoir
  refundedAmount: number; // Montant déjà remboursé ou utilisé
  remainingBalance: number; // Solde restant disponible
  status: 'Actif' | 'Totalement remboursé' | 'Partiellement remboursé';
  notes?: string;
  refunds: AvoirRefund[]; // Historique de remboursement
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  type: 'Particulier' | 'Entreprise';
  creditBalance: number; // Solde dû (crédit accordé)
  totalPurchases: number;
  creditLines?: ClientCreditLine[];
  avoirLines?: ClientAvoirLine[];
}

export interface SupplierCreditLine {
  id: string;
  supplierId: string;
  creditNumber: string; // Référence dette/crédit (ex: DET-SAN-001)
  invoiceRef: string; // Réf Facture fournisseur / Bon de réception (ex: FAC-2026-881)
  date: string; // Date de création
  initialAmount: number; // Montant initial de la facture / dette
  paidAmount: number; // Montant déjà réglé / versé
  remainingAmount: number; // Reste à payer
  dueDate?: string; // Date d'échéance de paiement
  status: 'En cours' | 'Soldé' | 'En retard';
  notes?: string;
  payments: CreditPayment[]; // Historique de versements faits au fournisseur
}

export interface SupplierAvoirLine {
  id: string;
  supplierId: string;
  avoirNumber: string; // Référence avoir (ex: AVF-2026-001)
  sourceRef: string; // Réf Avoir / Bon de retour (ex: RET-FOUR-002)
  date: string; // Date d'émission
  reason: string; // Motif (Retour produit défectueux, Ristourne, Erreur de facturation)
  totalAmount: number; // Montant initial de l'avoir
  refundedAmount: number; // Montant déjà remboursé ou déduit sur commande
  remainingBalance: number; // Solde restant disponible
  status: 'Actif' | 'Totalement remboursé' | 'Partiellement remboursé';
  notes?: string;
  refunds: AvoirRefund[]; // Historique de remboursements / déductions
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  categories: string[];
  balance: number; // Solde Dû (Crédit fournisseur / Dette)
  totalPurchases?: number; // Total Achats (FCFA)
  creditLines?: SupplierCreditLine[];
  avoirLines?: SupplierAvoirLine[];
}

export interface StockMovement {
  id: string;
  date: string;
  productId: string;
  productName: string;
  type: 'Entrée' | 'Sortie' | 'Ajustement' | 'Périmé/Casse';
  quantity: number;
  reason: string;
  reference: string;
  performedBy: string;
}

/** Méthodes de valorisation du stock prises en charge */
export type ValuationMethod = 'CUMP_PERPETUEL' | 'CUMP_PERIODIQUE' | 'FIFO';

/** Ligne calculée de l'état de valorisation */
export interface StockValuationLine {
  productId: string;
  productCode: string;
  productName: string;
  category: string;
  depot: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
  lastMovementDate?: string;
  method: ValuationMethod;
  /** true si le coût unitaire provient d'un repli (prix d'achat fiche) plutôt que du mouvement d'origine */
  costEstimated?: boolean;
  hasAnomaly?: boolean;
  anomalyNote?: string;
}

/** État de valorisation clôturé et conservé dans l'historique */
export interface StockValuationRecord {
  id: string;
  code: string; // Ex: VAL-2026-001
  valuationDate: string; // Date de référence du calcul
  method: ValuationMethod;
  depotFilter: string; // 'ALL' ou nom du dépôt
  categoryFilter: string; // 'ALL' ou famille
  lines: StockValuationLine[];
  articleCount: number;
  totalQuantity: number;
  totalValue: number;
  ruptureCount: number;
  anomalyCount: number;
  createdBy: string;
  createdAt: string;
  status: 'Clôturé';
}

export interface PriceInquiryItem {
  id?: string;
  productId: string;
  barcode?: string;
  productName: string; // Designation
  uoa?: string; // UOA (Unité Opérationnelle d'Achat)
  qta?: number; // Qta (Quantité d'UOA commandée / saisie)
  supplierId?: string;
  supplierName?: string;
  requestedQty: number; // Quantité
  estimatedPrice: number; // Prix unitaire
  vatRate?: number; // Taux TVA (ex: 18%)
  vatAmount?: number; // Montant TVA
  totalAmount?: number; // Montant TTC ou total
}

export interface PriceInquiry {
  id: string;
  code: string; // Référence ex: "DEV-202610-0001"
  date: string; // Date
  buyer?: string; // Acheteur
  orderDeadline?: string; // Échéance de commande
  supplierId: string;
  supplierName: string;
  items: PriceInquiryItem[];
  totalHT?: number; // Total HT
  vatRate?: number; // Taux TVA (ex: 18%)
  totalVAT?: number; // Total TVA
  totalTTC?: number; // Total TTC / Total
  status: 'En cours' | 'Validé';
  notes?: string;
}

export interface PurchaseOrderItem {
  productId: string;
  barcode?: string;
  productName: string;
  uoa?: string;
  qta?: number;
  supplierId?: string;
  supplierName?: string;
  quantity: number;
  unitPrice: number;
  vatRate?: number;
  vatAmount?: number;
  total: number;
}

export interface PurchaseOrderSupplierSettlement {
  supplierId: string;
  supplierName: string;
  amount: number; // Montant total concernant ce fournisseur
  paymentMode: 'Cash' | 'Crédit' | 'Partiel'; // Règlement : Crédit, partiel, cash
  paidAmount: number; // Montant réglé (en cash / comptant)
  creditAmount: number; // Montant à crédit (solde restant dû)
  paymentDate?: string; // Date du règlement
  reference?: string; // Référence du règlement / chèque / reçu
  notes?: string;
}

export interface PurchaseOrder {
  id: string;
  code: string;
  inquiryId?: string; // Réf ou ID de la demande de prix source
  inquiryCode?: string; // Code du devis source (ex: DEV-202610-0001)
  date: string;
  buyer?: string; // Acheteur
  orderDeadline?: string; // Échéance de commande
  expectedDate?: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseOrderItem[];
  totalHT?: number;
  vatRate?: number;
  totalVAT?: number;
  totalTTC?: number;
  totalAmount: number;
  status: 'En cours' | 'Validé' | 'Reçu';
  paymentStatus?: 'Non payé' | 'Payé partiellement' | 'Payé';
  paymentMode?: 'Cash' | 'Crédit' | 'Partiel' | 'Mixte';
  settlements?: PurchaseOrderSupplierSettlement[];
  validatedAt?: string;
  notes?: string;
}

export interface GoodsReceptionItem {
  productId: string;
  barcode?: string;
  productName: string;
  uoa?: string;
  qta?: number;
  supplierId?: string;
  supplierName?: string;
  orderedQty: number;
  receivedQty: number;
  acceptedQty: number;
  expirationDate?: string; // Date d'expiration du produit réceptionné
  unitPrice?: number;
  vatRate?: number;
  vatAmount?: number;
  total?: number;
}

export interface GoodsReception {
  id: string;
  code: string;
  date: string;
  purchaseOrderId?: string;
  purchaseOrderCode?: string;
  supplierId?: string;
  supplierName: string;
  items: GoodsReceptionItem[];
  receiverName: string;
  totalHT?: number;
  vatRate?: number;
  totalVAT?: number;
  totalTTC?: number;
  totalAmount?: number;
  status: 'En cours' | 'Validé' | 'En attente' | 'Annulé';
  notes?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
  /** Identifiant unique de ligne panier (un même produit peut apparaître sur plusieurs lignes) */
  lineId?: string;
}

export interface SaleOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  /** Coût d'achat figé au moment de la vente (marge historique fiable) */
  buyPrice?: number;
  /** Libellé de l'unité de vente choisie (UOV), ex: 'Carton de 12' */
  unitName?: string;
  /** Contenance de l'UOV en unités de base (ex: 12 pour un carton de 12) */
  unitQuantity?: number;
  total: number;
}

export interface SaleOrder {
  id: string;
  code: string;
  date: string;
  clientId?: string;
  clientName: string;
  items: SaleOrderItem[];
  totalAmount: number;
  discount: number;
  tax: number;
  finalAmount: number;
  paymentMethod: 'Espèces' | 'Mobile Money' | 'Carte' | 'Crédit';
  status: 'Terminé' | 'Validé' | 'En cours' | 'En attente' | 'Annulé';
  sellerName: string;
  pointDeVenteId?: string; // ID du point de vente rattaché
  pointDeVenteCode?: string; // N° Point de vente (ex: PV0001)
}

export interface PointDeVente {
  id: string;
  code: string; // Numero (PV0001)
  date: string; // Date
  operator: string; // Opérateur
  occupiedBy?: string; // Identifiant du compte qui utilise actuellement la caisse
  openingAmount: number; // Montant d'ouverture (Solde Ouverture)
  closingAmount?: number; // Montant à la fermeture (Solde fermeture)
  openedAt: string; // Date et heure ouverture (Début)
  closedAt?: string; // Date et heure de fermeture (Fin)
  status: 'En cours' | 'Fermé'; // Statut : encours, fermé
  sales?: SaleOrder[]; // Lignes de vente dérivées de saleOrders (non persistées)
  totalSalesAmount?: number; // Total du chiffre d'affaires
  cashSalesAmount?: number; // Total espèces
  creditSalesAmount?: number; // Total crédit
  mobileSalesAmount?: number; // Total Mobile Money
  cardSalesAmount?: number; // Total carte bancaire
  expectedClosingAmount?: number; // Solde théorique = Solde ouverture + Espèces
  cashDifference?: number; // Écart de caisse = Solde fermeture réel - Solde théorique
  notes?: string;
}

export interface FinancialTransaction {
  id: string;
  code: string; // ex: REC-2026-001, DEP-2026-001
  date: string;
  type: 'Recette' | 'Dépense';
  category: string; // Vente marchandises, Achat marchandises, Loyer & Charges, Salaires, Transport & Livraison, Factures & Énergie, Impôts & Taxes, Maintenance, etc.
  amount: number;
  paymentMethod: 'Espèces' | 'Virement bancaire' | 'Chèque' | 'Mobile Money' | 'Carte';
  account: string; // 'Caisse Principale' | 'Banque BICICI' | 'Compte Mobile Money' | 'Caisse POS'
  reference?: string;
  thirdParty?: string;
  notes?: string;
  status: 'Validé' | 'En attente';
  recordedBy: string;
}

export interface TreasuryAccount {
  id: string;
  name: string;
  type: 'Caisse' | 'Banque' | 'Mobile Money';
  accountNumber?: string;
  balance: number;
  currency: string;
  lastUpdated: string;
  description?: string;
}

export interface TreasuryMovement {
  id: string;
  code: string;
  date: string;
  type: 'Alimentation' | 'Décaissement' | 'Virement interne' | 'Remise en banque';
  fromAccount?: string;
  toAccount?: string;
  amount: number;
  reason: string;
  reference?: string;
  performedBy: string;
  notes?: string;
}

export type UserRole = 'Administrateur' | 'Gérant' | 'Caissier' | 'Responsable Agence';

export interface UserAccount {
  id: string;
  username: string;
  password?: string;      // transitoire (création) — haché côté serveur, jamais renvoyé
  passwordHash?: string;  // hash scrypt côté serveur — jamais exposé aux clients
  name: string;
  role: UserRole;
  email?: string;
  phone?: string;
  avatarInitials: string;
  /** Compte actif (absent/true = actif ; false = connexion refusée) */
  active?: boolean;
  defaultSection: NavSection;
  allowedSections: NavSection[];
}

/** Entrée du journal d'audit centralisé */
export interface AuditLog {
  id: string;
  /** ISO datetime */
  at: string;
  /** Nom de l'acteur (currentUser.name) ou 'Système' */
  actor: string;
  /** Identifiant du compte, si connu */
  username?: string;
  /** Ex: 'sale.create', 'sale.cancel', 'user.create', 'po.validate' */
  action: string;
  /** Collection concernée (ex: 'saleOrders') */
  entity: string;
  /** Id/code de l'entité concernée */
  entityRef?: string;
  /** Détails lisibles (montants, quantités, avant/après synthétique) */
  details?: string;
}

export interface CompanyConfig {
  name: string;        // Raison sociale / nom commercial
  address: string;     // Siège / adresse
  phone: string;       // Contact téléphonique
  email: string;
  logo?: string;       // Data URL (base64) du logo
  rccm: string;        // N° Registre de Commerce (RCCM)
  ncc: string;         // N° Compte Contribuable (NCC)
  updatedAt?: string;
}

export interface ApprovisionnementItem {
  productId: string;
  productCode?: string;
  productName: string;
  barcode?: string;
  quantity: number; // Quantité mise en stock
  unitPrice?: number;
  unit?: string;
  targetLocation?: string; // Rayon ou Magasin de destination
  expirationDate?: string;
  notes?: string;
}

export interface ApprovisionnementRecord {
  id: string;
  reference: string; // Ex: APP-2026-001
  date: string; // Date et heure de l'approvisionnement
  operator: string; // Opérateur ayant effectué la mise en stock
  receptionNumber: string; // Ex: REC-2026-008 (Reception n°)
  receptionId?: string; // ID technique de la réception
  supplierName?: string; // Fournisseur de la réception
  destinationType: 'Magasin' | 'Rayon' | 'Mixte'; // Type de destination
  targetLocation: string; // Emplacement de stockage ou rayon configuré par l'utilisateur
  items: ApprovisionnementItem[]; // Lignes d'approvisionnement (produits concernés)
  totalItemsCount: number;
  totalQuantity: number;
  totalValue: number;
  status: 'Validé' | 'En attente' | 'Annulé';
  notes?: string;
  createdAt?: string;
}

/** Emplacement de stockage : magasin (capacité) ou rayon (étagères). */
export interface StorageSite {
  id: string;
  name: string;
  type: 'Magasin' | 'Rayon';
  /** Capacité de stockage en unités — pertinent pour type 'Magasin' */
  capacity?: number;
  /** Nombre d'étagères — pertinent pour type 'Rayon' */
  shelfCount?: number;
  /** Magasin de rattachement — pertinent pour type 'Rayon' */
  magasinId?: string;
  /** Adresse ou zone géographique de l'emplacement */
  location?: string;
  description?: string;
  createdAt: string;
}

export type InventoryCountStatus = 'Non compté' | 'Compté' | 'Écart' | 'Sans écart';
export type PhysicalInventoryStatus = 'Brouillon' | 'En cours' | 'À contrôler' | 'À valider' | 'Validé' | 'Clôturé';
export type PhysicalInventoryType = 'Général' | 'Partiel' | 'Par famille' | 'Par emplacement';
export type InventoryCountingMode = 'visible' | 'blind'; // comptage avec quantités théoriques visibles ou à l'aveugle

export interface PhysicalInventoryItem {
  productId: string;
  productCode: string;
  productName: string;
  barcode?: string;
  category: string;
  unit: string;
  depot: string;
  /** Stock théorique figé à la date de référence */
  theoreticalStock: number;
  /** 1er passage (null = pas encore compté) */
  count1?: number | null;
  /** 2e passage / recomptage */
  count2?: number | null;
  /** Quantité physique retenue (count2 si saisi, sinon count1) */
  physicalCount?: number | null;
  /** physicalCount - theoreticalStock (null tant que non compté) */
  discrepancy?: number | null;
  /** Coût unitaire de valorisation (CUMP à la date de référence) */
  unitPrice: number;
  /** discrepancy * unitPrice */
  discrepancyValue?: number;
  justification?: string;
  notes?: string;
  countStatus: InventoryCountStatus;
  adjusted?: boolean;
}

export interface PhysicalInventory {
  id: string;
  code: string; // Ex: INV-2026-001
  /** Date de référence pour le stock théorique */
  referenceDate: string;
  startDate: string;
  endDate?: string;
  depot: string; // 'ALL' ou nom du dépôt
  categoryFilter: string; // 'ALL' ou famille
  type: PhysicalInventoryType;
  countingMode: InventoryCountingMode;
  operator: string; // Responsable de l'inventaire
  team?: string; // Équipe de comptage
  status: PhysicalInventoryStatus;
  notes?: string;
  items: PhysicalInventoryItem[];
  totalDiscrepancyQty: number;
  totalDiscrepancyValue: number;
  validatedBy?: string;
  validatedAt?: string;
  closedAt?: string;
  /** true quand les mouvements de régularisation ont été générés (anti double application) */
  adjustmentsApplied?: boolean;
  createdAt?: string;
}

export type StockAdjustmentStatus = 'Brouillon' | 'Validé' | 'Annulé';

/** Ligne d'ajustement : théorique figé à la saisie, écart = constatée − théorique */
export interface StockAdjustmentLine {
  productId: string;
  productCode: string;
  productName: string;
  barcode?: string;
  category: string;
  unit: string;
  depot: string;
  theoreticalStock: number;
  /** Quantité réellement constatée (null = non saisie) */
  countedStock?: number | null;
  /** countedStock - theoreticalStock */
  discrepancy?: number | null;
  /** Coût unitaire de valorisation (CUMP à la saisie) */
  unitPrice: number;
  /** discrepancy * unitPrice */
  discrepancyValue?: number;
  /** Motif de l'écart (obligatoire si écart ≠ 0) */
  reason?: string;
  notes?: string;
}

/** Document d'ajustement de stock (plusieurs lignes possibles) */
export interface StockAdjustment {
  id: string;
  code: string; // Ex: ADJ-2026-001
  date: string; // Date et heure de l'opération
  depot: string; // 'ALL' ou nom du dépôt
  generalReason?: string;
  notes?: string;
  operator: string; // Auteur de l'ajustement
  status: StockAdjustmentStatus;
  lines: StockAdjustmentLine[];
  totalPositiveQty: number;
  totalNegativeQty: number;
  totalDiscrepancyValue: number;
  validatedBy?: string;
  validatedAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancelReason?: string;
  createdAt?: string;
}

export interface StockTransfer {
  id: string;
  code: string; // Ex: TRF-2026-001
  date: string;
  sourceLocation: string; // Ex: "Dépôt Principal / Réserve"
  targetLocation: string; // Ex: "Rayon Magasin / Comptoir"
  operator: string;
  receiver?: string;
  status: 'En transit' | 'Réceptionné' | 'Annulé';
  items: {
    productId: string;
    productName: string;
    productCode?: string;
    quantity: number;
    unit: string;
    /** Coût unitaire CUMP figé à l'expédition — la réception réintègre ce coût (aucune valeur créée) */
    unitPrice?: number;
  }[];
  totalValue?: number;
  receivedBy?: string;
  receivedAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancelReason?: string;
  notes?: string;
  createdAt?: string;
}

export interface StockAvarieLoss {
  id: string;
  code: string; // Ex: DEC-2026-001
  date: string;
  productId: string;
  productName: string;
  productCode?: string;
  quantity: number;
  unit: string;
  depot?: string;
  unitPrice: number;
  totalLossValue: number;
  type: 'Périmé' | 'Casse/Endommagé' | 'Perte/Vol' | 'Défectueux' | 'Coulage';
  operator: string;
  notes?: string;
  status: 'Constaté' | 'Déstocké';
  destockedBy?: string;
  destockedAt?: string;
  createdAt?: string;
}

// ---- Retours clients (marchandises rendues après une vente) ----

export interface CustomerReturnItem {
  productId: string;
  productCode?: string;
  productName: string;
  barcode?: string;
  unit?: string;
  /** Quantité vendue sur la ligne d'origine */
  saleQty: number;
  /** Quantité retournée par ce document */
  returnedQty: number;
  /** Prix de vente unitaire d'origine (base de l'avoir/remboursement) */
  unitPrice: number;
  /** Coût d'achat figé sur la ligne de vente — coût de réintégration du stock */
  buyPrice: number;
  /** true → réintègre le stock ; false → non réintégré (avarie, à expertiser) */
  restock: boolean;
}

export interface CustomerReturn {
  id: string;
  code: string; // Ex: RC-202610-0001
  date: string;
  saleId: string;
  saleCode: string;
  clientId?: string;
  clientName?: string;
  items: CustomerReturnItem[];
  /** Somme retournée au prix de vente (montant de l'avoir/remboursement) */
  totalAmount: number;
  /** Part déduite du crédit client (vente à crédit non soldée) */
  creditDeduction?: number;
  /** Part convertie en avoir client */
  avoirAmount?: number;
  /** Référence de l'avoir client généré (AV-xxx) */
  avoirNumber?: string;
  operator: string;
  status: 'Brouillon' | 'Validé' | 'Annulé';
  notes?: string;
  validatedBy?: string;
  validatedAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancelReason?: string;
  createdAt?: string;
}

// ---- Retours fournisseurs (marchandises renvoyées au fournisseur) ----

export interface SupplierReturnItem {
  productId: string;
  productCode?: string;
  productName: string;
  barcode?: string;
  unit?: string;
  returnedQty: number;
  /** Prix d'achat unitaire retenu (valeur de sortie et de l'avoir fournisseur) */
  unitPrice: number;
}

export interface SupplierReturn {
  id: string;
  code: string; // Ex: RF-202610-0001
  date: string;
  supplierId: string;
  supplierName: string;
  /** Document d'origine éventuel (code REC/APP) */
  sourceRef?: string;
  items: SupplierReturnItem[];
  /** Somme retournée au prix d'achat */
  totalAmount: number;
  /** Part déduite de la dette fournisseur */
  debtDeduction?: number;
  /** Part convertie en avoir fournisseur */
  avoirAmount?: number;
  /** Référence de l'avoir fournisseur généré (AVF-xxx) */
  avoirNumber?: string;
  operator: string;
  status: 'Brouillon' | 'Validé' | 'Annulé';
  notes?: string;
  validatedBy?: string;
  validatedAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancelReason?: string;
  createdAt?: string;
}
