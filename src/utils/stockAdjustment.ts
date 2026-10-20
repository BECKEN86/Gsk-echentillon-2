import { StockAdjustment, StockAdjustmentLine, StockMovement } from '../types';

/** Motifs d'ajustement proposés (configurable) */
export const ADJUSTMENT_REASONS = [
  'Écart constaté lors d\'un inventaire',
  'Produit cassé ou endommagé',
  'Produit périmé',
  'Perte ou disparition',
  'Erreur de saisie antérieure',
  'Produit retrouvé en magasin',
  'Correction après contrôle',
  'Régularisation autorisée',
  'Autre motif'
];

/** Motifs correspondant à des pertes réelles (traitement comptable distinct) */
export const LOSS_REASONS = [
  'Produit cassé ou endommagé',
  'Produit périmé',
  'Perte ou disparition'
];

/** Recalcule écart et valeur d'une ligne après saisie de la quantité constatée */
export function refreshAdjustmentLine(line: StockAdjustmentLine): StockAdjustmentLine {
  const counted = line.countedStock ?? null;
  const discrepancy = counted == null ? null : counted - line.theoreticalStock;
  return {
    ...line,
    discrepancy,
    discrepancyValue: discrepancy == null ? 0 : discrepancy * line.unitPrice
  };
}

export function makeAdjustmentLine(input: {
  productId: string;
  productCode: string;
  productName: string;
  barcode?: string;
  category: string;
  unit: string;
  depot: string;
  theoreticalStock: number;
  unitPrice: number;
}): StockAdjustmentLine {
  return { ...input, countedStock: null, discrepancy: null, discrepancyValue: 0 };
}

export interface AdjustmentSummary {
  lineCount: number;
  enteredCount: number;   // lignes avec quantité constatée saisie
  positiveCount: number;
  negativeCount: number;
  zeroCount: number;
  totalPositiveQty: number;
  totalNegativeQty: number; // valeur absolue
  totalDiscrepancyValue: number;
  missingReasons: number;   // écarts ≠ 0 sans motif (ligne ou général)
}

export function summarizeAdjustment(lines: StockAdjustmentLine[], generalReason?: string): AdjustmentSummary {
  const s: AdjustmentSummary = {
    lineCount: lines.length, enteredCount: 0,
    positiveCount: 0, negativeCount: 0, zeroCount: 0,
    totalPositiveQty: 0, totalNegativeQty: 0, totalDiscrepancyValue: 0,
    missingReasons: 0
  };
  lines.forEach(l => {
    if (l.countedStock == null) return;
    s.enteredCount++;
    const d = l.discrepancy ?? 0;
    s.totalDiscrepancyValue += l.discrepancyValue ?? 0;
    if (d > 0) { s.positiveCount++; s.totalPositiveQty += d; }
    else if (d < 0) { s.negativeCount++; s.totalNegativeQty += -d; }
    else s.zeroCount++;
    if (d !== 0 && !(l.reason || generalReason)) s.missingReasons++;
  });
  return s;
}

/**
 * Mouvements de validation : écart > 0 → 'Entrée', écart < 0 → 'Sortie'.
 * Référence = code du document d'ajustement.
 */
export function buildAdjustmentDocMovements(
  adj: StockAdjustment,
  performedBy: string,
  now: string
): { productId: string; movement: Omit<StockMovement, 'id'>; quantityChange: number }[] {
  return adj.lines
    .filter(l => l.discrepancy != null && l.discrepancy !== 0)
    .map(l => ({
      productId: l.productId,
      movement: {
        date: now,
        productId: l.productId,
        productName: l.productName,
        type: l.discrepancy! > 0 ? 'Entrée' as const : 'Sortie' as const,
        quantity: Math.abs(l.discrepancy!),
        reason: `Ajustement ${adj.code}${l.reason || adj.generalReason ? ` — ${l.reason || adj.generalReason}` : ''}`,
        reference: adj.code,
        performedBy
      },
      quantityChange: l.discrepancy!
    }));
}

/**
 * Contre-passation à l'annulation d'un ajustement validé :
 * inverse le signe de chaque ligne régularisée (traçable, jamais de suppression).
 */
export function buildCompensationMovements(
  adj: StockAdjustment,
  performedBy: string,
  now: string
): { productId: string; movement: Omit<StockMovement, 'id'>; quantityChange: number }[] {
  return adj.lines
    .filter(l => l.discrepancy != null && l.discrepancy !== 0)
    .map(l => ({
      productId: l.productId,
      movement: {
        date: now,
        productId: l.productId,
        productName: l.productName,
        type: l.discrepancy! > 0 ? 'Sortie' as const : 'Entrée' as const, // inverse de la régularisation
        quantity: Math.abs(l.discrepancy!),
        reason: `Annulation ajustement ${adj.code}${adj.cancelReason ? ` — ${adj.cancelReason}` : ''}`,
        reference: adj.code,
        performedBy
      },
      quantityChange: -l.discrepancy!
    }));
}
