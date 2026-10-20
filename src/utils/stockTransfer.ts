import { StockTransfer, StockMovement } from '../types';

/** Valeur totale du transfert = Σ qté × CUMP figé à l'expédition */
export const transferTotalValue = (t: Pick<StockTransfer, 'items'>): number =>
  t.items.reduce((s, i) => s + i.quantity * (i.unitPrice ?? 0), 0);

/**
 * Expédition : les marchandises quittent le dépôt source.
 * Mouvement 'Sortie' par ligne — le stock global diminue tant que le
 * transfert n'est pas réceptionné (marchandises en transit).
 */
export function buildShipMovements(
  t: StockTransfer,
  performedBy: string,
  now: string
): Omit<StockMovement, 'id'>[] {
  return t.items.map(i => ({
    date: now,
    productId: i.productId,
    productName: i.productName,
    type: 'Sortie',
    quantity: i.quantity,
    reason: `Transfert ${t.code} : ${t.sourceLocation} → ${t.targetLocation} (en transit)`,
    reference: t.code,
    performedBy
  }));
}

/**
 * Réception : les marchandises arrivent au dépôt cible.
 * Mouvement 'Entrée' par ligne au CUMP figé à l'expédition —
 * un transfert ne crée jamais de valeur supplémentaire.
 */
export function buildReceiveMovements(
  t: StockTransfer,
  performedBy: string,
  now: string
): Omit<StockMovement, 'id'>[] {
  return t.items.map(i => ({
    date: now,
    productId: i.productId,
    productName: i.productName,
    type: 'Entrée',
    quantity: i.quantity,
    reason: `Transfert ${t.code} reçu à ${t.targetLocation} (depuis ${t.sourceLocation})`,
    reference: t.code,
    performedBy
  }));
}

/**
 * Annulation d'un transfert en transit : retour au dépôt source
 * (contre-passation traçable des sorties, jamais de suppression).
 */
export function buildTransferCancelMovements(
  t: StockTransfer,
  performedBy: string,
  now: string
): Omit<StockMovement, 'id'>[] {
  return t.items.map(i => ({
    date: now,
    productId: i.productId,
    productName: i.productName,
    type: 'Entrée',
    quantity: i.quantity,
    reason: `Annulation transfert ${t.code} — retour à ${t.sourceLocation}${t.cancelReason ? ` : ${t.cancelReason}` : ''}`,
    reference: t.code,
    performedBy
  }));
}
