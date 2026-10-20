import { describe, it, expect } from 'vitest';
import {
  computeRestockMap,
  buildCancelMovements,
  findSaleRevenueTransaction,
  revertClientMetrics,
  canCancelSale,
  canDeleteSale
} from './businessRules';
import { SaleOrder, Client, FinancialTransaction } from '../types';

const sale: SaleOrder = {
  id: 'vte-1',
  code: 'VTE-202605-0001',
  date: '2026-05-15 10:00',
  clientId: 'c1',
  clientName: 'Awa',
  items: [
    { productId: 'p1', productName: 'Riz', quantity: 2, unitPrice: 500, buyPrice: 300, total: 1000 },
    { productId: 'p1', productName: 'Riz', quantity: 1, unitPrice: 500, buyPrice: 300, total: 500 },
    { productId: 'p2', productName: 'Huile', quantity: 3, unitPrice: 1200, buyPrice: 900, total: 3600 }
  ],
  totalAmount: 5100,
  discount: 0,
  tax: 0,
  finalAmount: 5100,
  paymentMethod: 'Espèces',
  status: 'Terminé',
  sellerName: 'Moussa'
};

const client: Client = {
  id: 'c1',
  name: 'Awa',
  phone: '',
  email: '',
  address: '',
  type: 'Particulier',
  creditBalance: 0,
  totalPurchases: 5100
};

const transactions: FinancialTransaction[] = [
  {
    id: 'tx-1',
    code: 'REC-202605-0001',
    date: '2026-05-15 10:00',
    type: 'Recette',
    category: 'Vente marchandises',
    amount: 5100,
    paymentMethod: 'Espèces',
    account: 'Caisse POS',
    reference: 'VTE-202605-0001',
    status: 'Validé',
    recordedBy: 'Moussa'
  },
  {
    id: 'tx-2',
    code: 'DEP-202605-0001',
    date: '2026-05-15 11:00',
    type: 'Dépense',
    category: 'Loyer',
    amount: 2000,
    paymentMethod: 'Espèces',
    account: 'Caisse POS',
    status: 'Validé',
    recordedBy: 'Admin'
  }
];

describe('annulation de vente (contre-passation)', () => {
  it('agrège les quantités par produit', () => {
    const restock = computeRestockMap(sale);
    expect(restock.get('p1')).toBe(3); // 2 + 1
    expect(restock.get('p2')).toBe(3);
  });

  it('génère un mouvement d\'entrée tracé par ligne', () => {
    const mvs = buildCancelMovements(sale, 'Admin', '2026-05-15 12:00');
    expect(mvs).toHaveLength(3);
    expect(mvs[0].type).toBe('Entrée');
    expect(mvs[0].reference).toBe('VTE-202605-0001');
    expect(mvs[0].performedBy).toBe('Admin');
  });

  it('retrouve la recette liée (et pas une dépense)', () => {
    const tx = findSaleRevenueTransaction(sale, transactions);
    expect(tx?.id).toBe('tx-1');
  });

  it('aucune recette à reverser pour une vente à crédit', () => {
    const credit = { ...sale, paymentMethod: 'Crédit' as const };
    expect(findSaleRevenueTransaction(credit, transactions)).toBeUndefined();
  });

  it('décrémente le crédit client pour une vente à crédit', () => {
    const c = { ...client, creditBalance: 5100 };
    const out = revertClientMetrics(c, { ...sale, paymentMethod: 'Crédit' });
    expect(out.creditBalance).toBe(0);
    expect(out.totalPurchases).toBe(0);
  });

  it('préserve le crédit client pour une vente comptant', () => {
    const c = { ...client, creditBalance: 200 };
    const out = revertClientMetrics(c, sale);
    expect(out.creditBalance).toBe(200);
  });

  it('ne peut pas annuler une vente déjà annulée ou inexistante', () => {
    expect(canCancelSale(sale)).toBe(true);
    expect(canCancelSale({ ...sale, status: 'Annulé' })).toBe(false);
    expect(canCancelSale(undefined)).toBe(false);
  });
});

describe('suppression de commande client', () => {
  it('autorise la suppression des documents sans effet comptable actif', () => {
    expect(canDeleteSale({ ...sale, status: 'En cours' })).toBe(true);
    expect(canDeleteSale({ ...sale, status: 'En attente' })).toBe(true);
    expect(canDeleteSale({ ...sale, status: 'Annulé' })).toBe(true);
  });

  it('interdit la suppression d\'une vente validée ou terminée (pièce comptable)', () => {
    expect(canDeleteSale({ ...sale, status: 'Validé' })).toBe(false);
    expect(canDeleteSale({ ...sale, status: 'Terminé' })).toBe(false);
    expect(canDeleteSale(undefined)).toBe(false);
  });
});
