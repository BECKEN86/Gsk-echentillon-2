import { SaleOrder, StockMovement, FinancialTransaction, Client } from '../types';
import { generateUniqueId } from './idGenerator';

/**
 * Règles métier pures — extraites d'App.tsx pour être testables.
 */

/** Quantités à restituer par produit lors d'une annulation de vente. */
export function computeRestockMap(sale: SaleOrder): Map<string, number> {
  const restock = new Map<string, number>();
  sale.items.forEach(item => {
    restock.set(item.productId, (restock.get(item.productId) || 0) + item.quantity);
  });
  return restock;
}

/** Mouvements d'entrée générés par une annulation de vente. */
export function buildCancelMovements(
  sale: SaleOrder,
  operator: string,
  now: string
): StockMovement[] {
  return sale.items.map(item => ({
    id: generateUniqueId(`m_${item.productId}`),
    date: now,
    productId: item.productId,
    productName: item.productName,
    type: 'Entrée',
    quantity: item.quantity,
    reason: `Annulation vente ${sale.code}`,
    reference: sale.code,
    performedBy: operator
  }));
}

/** Écriture de recette auto liée à une vente (à contre-passer à l'annulation). */
export function findSaleRevenueTransaction(
  sale: SaleOrder,
  transactions: FinancialTransaction[]
): FinancialTransaction | undefined {
  if (sale.paymentMethod === 'Crédit') return undefined;
  return transactions.find(t => t.reference === sale.code && t.type === 'Recette');
}

/** Nouveaux indicateurs client après annulation (crédit et cumul achats). */
export function revertClientMetrics(client: Client, sale: SaleOrder): Client {
  return {
    ...client,
    creditBalance:
      sale.paymentMethod === 'Crédit'
        ? Math.max(0, client.creditBalance - sale.finalAmount)
        : client.creditBalance,
    totalPurchases: Math.max(0, client.totalPurchases - sale.finalAmount)
  };
}

/** Vrai si la vente peut être annulée (existe et n'est pas déjà annulée). */
export function canCancelSale(sale: SaleOrder | undefined): boolean {
  return !!sale && sale.status !== 'Annulé';
}

/**
 * Vrai si la commande/vente peut être supprimée physiquement, sans effet de
 * bord : les statuts 'En cours' (brouillon) et 'En attente' (ticket suspendu)
 * n'ont jamais impacté le stock ni la trésorerie ; 'Annulé' a déjà été
 * contre-passé. Une vente 'Validé'/'Terminé' est une pièce comptable :
 * elle doit être annulée (trace conservée), pas supprimée.
 */
export function canDeleteSale(sale: SaleOrder | undefined): boolean {
  if (!sale) return false;
  return sale.status === 'En cours' || sale.status === 'En attente' || sale.status === 'Annulé';
}
