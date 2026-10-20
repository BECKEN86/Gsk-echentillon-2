import {
  Client,
  ClientAvoirLine,
  CustomerReturn,
  StockMovement,
  Supplier,
  SupplierAvoirLine,
  SupplierReturn
} from '../types';
import { generateUniqueId } from './idGenerator';

/**
 * Règles métier des retours marchandises.
 *
 * Retour client (RC-xxx) :
 *  - lignes `restock` → mouvement 'Entrée' au coût d'achat figé sur la vente
 *    (la valorisation résout le coût via la ligne RC — aucune valeur inventée) ;
 *  - vente à crédit → le montant retourné déduit d'abord le crédit client,
 *    le reste devient un avoir ; vente payée → avoir intégral ;
 *  - annulation → contre-passation 'Sortie' + annulation de l'avoir (refusée
 *    si l'avoir a déjà été entamé).
 *
 * Retour fournisseur (RF-xxx) :
 *  - validation → mouvements 'Sortie' (consomment les couches CUMP/FIFO) ;
 *  - le montant déduit d'abord la dette fournisseur, le reste devient un avoir ;
 *  - annulation → contre-passation 'Entrée' au prix d'achat du retour.
 */

/** Quantités déjà retournées par produit pour une vente (hors annulés et doc courant). */
export function alreadyReturnedQty(
  returns: CustomerReturn[],
  saleId: string,
  excludeId?: string
): Map<string, number> {
  const map = new Map<string, number>();
  returns
    .filter(r => r.saleId === saleId && r.status !== 'Annulé' && r.id !== excludeId)
    .forEach(r =>
      r.items.forEach(i =>
        map.set(i.productId, (map.get(i.productId) || 0) + i.returnedQty)
      )
    );
  return map;
}

/** Mouvements d'entrée générés à la validation d'un retour client (lignes restock). */
export function buildCustomerReturnMovements(
  ret: CustomerReturn,
  operator: string,
  now: string
): StockMovement[] {
  return ret.items
    .filter(i => i.restock && i.returnedQty > 0)
    .map(i => ({
      id: generateUniqueId(`m_${i.productId}`),
      date: now,
      productId: i.productId,
      productName: i.productName,
      type: 'Entrée',
      quantity: i.returnedQty,
      reason: `Retour client ${ret.code} (vente ${ret.saleCode})`,
      reference: ret.code,
      performedBy: operator
    }));
}

/** Contre-passation d'un retour client validé : les réintégrations ressortent. */
export function buildCustomerReturnCancelMovements(
  ret: CustomerReturn,
  operator: string,
  now: string
): StockMovement[] {
  return ret.items
    .filter(i => i.restock && i.returnedQty > 0)
    .map(i => ({
      id: generateUniqueId(`m_${i.productId}`),
      date: now,
      productId: i.productId,
      productName: i.productName,
      type: 'Sortie',
      quantity: i.returnedQty,
      reason: `Annulation retour client ${ret.code}`,
      reference: ret.code,
      performedBy: operator
    }));
}

/** Mouvements de sortie générés à la validation d'un retour fournisseur. */
export function buildSupplierReturnMovements(
  ret: SupplierReturn,
  operator: string,
  now: string
): StockMovement[] {
  return ret.items
    .filter(i => i.returnedQty > 0)
    .map(i => ({
      id: generateUniqueId(`m_${i.productId}`),
      date: now,
      productId: i.productId,
      productName: i.productName,
      type: 'Sortie',
      quantity: i.returnedQty,
      reason: `Retour fournisseur ${ret.code} → ${ret.supplierName}`,
      reference: ret.code,
      performedBy: operator
    }));
}

/** Contre-passation d'un retour fournisseur validé : les quantités réintègrent le stock. */
export function buildSupplierReturnCancelMovements(
  ret: SupplierReturn,
  operator: string,
  now: string
): StockMovement[] {
  return ret.items
    .filter(i => i.returnedQty > 0)
    .map(i => ({
      id: generateUniqueId(`m_${i.productId}`),
      date: now,
      productId: i.productId,
      productName: i.productName,
      type: 'Entrée',
      quantity: i.returnedQty,
      reason: `Annulation retour fournisseur ${ret.code}`,
      reference: ret.code,
      performedBy: operator
    }));
}

/**
 * Impact client à la validation d'un retour :
 * - crédit d'abord déduit (vente à crédit), le reste → avoir AV-xxx ;
 * - totalPurchases réduit du montant retourné.
 * Retourne le client mis à jour + les montants calculés.
 */
export function applyCustomerReturnToClient(
  client: Client,
  ret: CustomerReturn,
  wasCreditSale: boolean,
  avoirNumber: string,
  now: string
): { client: Client; creditDeduction: number; avoirAmount: number } {
  const creditDeduction = wasCreditSale
    ? Math.min(client.creditBalance, ret.totalAmount)
    : 0;
  const avoirAmount = ret.totalAmount - creditDeduction;

  const avoirLines = [...(client.avoirLines || [])];
  if (avoirAmount > 0) {
    const avoir: ClientAvoirLine = {
      id: generateUniqueId('avc'),
      clientId: client.id,
      avoirNumber,
      sourceRef: ret.code,
      date: now,
      reason: `Retour produit (${ret.saleCode})`,
      totalAmount: avoirAmount,
      refundedAmount: 0,
      remainingBalance: avoirAmount,
      status: 'Actif',
      refunds: []
    };
    avoirLines.unshift(avoir);
  }

  return {
    client: {
      ...client,
      creditBalance: client.creditBalance - creditDeduction,
      totalPurchases: Math.max(0, client.totalPurchases - ret.totalAmount),
      avoirLines
    },
    creditDeduction,
    avoirAmount
  };
}

/**
 * Annulation d'un retour client : restaure le crédit déduit et le cumul achats,
 * et supprime l'avoir généré — impossible si l'avoir a déjà été entamé.
 */
export function revertCustomerReturnOnClient(
  client: Client,
  ret: CustomerReturn
): Client | null {
  const avoir = (client.avoirLines || []).find(a => a.avoirNumber === ret.avoirNumber);
  if (avoir && avoir.refundedAmount > 0) return null; // avoir entamé → annulation impossible

  return {
    ...client,
    creditBalance: client.creditBalance + (ret.creditDeduction || 0),
    totalPurchases: client.totalPurchases + ret.totalAmount,
    avoirLines: (client.avoirLines || []).filter(a => a.avoirNumber !== ret.avoirNumber)
  };
}

/**
 * Impact fournisseur à la validation d'un retour :
 * - dette d'abord déduite, le reste → avoir AVF-xxx ;
 * - totalPurchases réduit du montant retourné.
 */
export function applySupplierReturnToSupplier(
  supplier: Supplier,
  ret: SupplierReturn,
  avoirNumber: string,
  now: string
): { supplier: Supplier; debtDeduction: number; avoirAmount: number } {
  const debtDeduction = Math.min(supplier.balance, ret.totalAmount);
  const avoirAmount = ret.totalAmount - debtDeduction;

  const avoirLines = [...(supplier.avoirLines || [])];
  if (avoirAmount > 0) {
    const avoir: SupplierAvoirLine = {
      id: generateUniqueId('avf'),
      supplierId: supplier.id,
      avoirNumber,
      sourceRef: ret.code,
      date: now,
      reason: 'Retour marchandises',
      totalAmount: avoirAmount,
      refundedAmount: 0,
      remainingBalance: avoirAmount,
      status: 'Actif',
      refunds: []
    };
    avoirLines.unshift(avoir);
  }

  return {
    supplier: {
      ...supplier,
      balance: supplier.balance - debtDeduction,
      totalPurchases: Math.max(0, (supplier.totalPurchases || 0) - ret.totalAmount),
      avoirLines
    },
    debtDeduction,
    avoirAmount
  };
}

/**
 * Annulation d'un retour fournisseur : restaure la dette déduite et le cumul
 * achats, et supprime l'avoir — impossible si l'avoir a déjà été entamé.
 */
export function revertSupplierReturnOnSupplier(
  supplier: Supplier,
  ret: SupplierReturn
): Supplier | null {
  const avoir = (supplier.avoirLines || []).find(a => a.avoirNumber === ret.avoirNumber);
  if (avoir && avoir.refundedAmount > 0) return null;

  return {
    ...supplier,
    balance: supplier.balance + (ret.debtDeduction || 0),
    totalPurchases: (supplier.totalPurchases || 0) + ret.totalAmount,
    avoirLines: (supplier.avoirLines || []).filter(a => a.avoirNumber !== ret.avoirNumber)
  };
}
