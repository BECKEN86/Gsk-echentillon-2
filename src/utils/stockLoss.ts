import { StockAvarieLoss, StockMovement } from '../types';

export const LOSS_TYPES: StockAvarieLoss['type'][] = [
  'Périmé',
  'Casse/Endommagé',
  'Perte/Vol',
  'Défectueux',
  'Coulage'
];

/**
 * Destockage : mouvement 'Périmé/Casse' (sortie) référencé DEC-xxx.
 * La valeur de la perte est qté × coût de valorisation (jamais le prix de vente).
 */
export function buildDestockMovement(
  l: StockAvarieLoss,
  performedBy: string,
  now: string
): Omit<StockMovement, 'id'> {
  return {
    date: now,
    productId: l.productId,
    productName: l.productName,
    type: 'Périmé/Casse',
    quantity: l.quantity,
    reason: `Perte ${l.code} — ${l.type}${l.depot ? ` (${l.depot})` : ''}${l.notes ? ` : ${l.notes}` : ''}`,
    reference: l.code,
    performedBy
  };
}

export interface LossSummary {
  declaredCount: number;   // constatés, pas encore déstockés
  destockedCount: number;
  totalQuantity: number;   // quantité déstockée
  totalValue: number;      // valeur des pertes déstockées
  byType: Record<string, { count: number; quantity: number; value: number }>;
}

export function summarizeLosses(list: StockAvarieLoss[]): LossSummary {
  const s: LossSummary = { declaredCount: 0, destockedCount: 0, totalQuantity: 0, totalValue: 0, byType: {} };
  list.forEach(l => {
    const bucket = (s.byType[l.type] ||= { count: 0, quantity: 0, value: 0 });
    bucket.count++;
    if (l.status === 'Déstocké') {
      s.destockedCount++;
      s.totalQuantity += l.quantity;
      s.totalValue += l.totalLossValue;
      bucket.quantity += l.quantity;
      bucket.value += l.totalLossValue;
    } else {
      s.declaredCount++;
    }
  });
  return s;
}
