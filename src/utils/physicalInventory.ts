import { PhysicalInventory, PhysicalInventoryItem, StockMovement } from '../types';
import { generateUniqueId } from './idGenerator';

/** Motifs d'écart proposés à la justification */
export const DISCREPANCY_REASONS = [
  'Erreur de réception',
  'Erreur de vente ou de sortie',
  'Perte ou disparition',
  'Casse ou détérioration',
  'Produits périmés',
  'Erreur de saisie',
  'Transfert non enregistré',
  'Produit retrouvé',
  'Autre motif'
];

/**
 * Quantité physique retenue : le 2e comptage prime sur le 1er.
 * `null` tant qu'aucun comptage n'est saisi — un non-compté n'est JAMAIS un zéro.
 */
export function retainedCount(item: Pick<PhysicalInventoryItem, 'count1' | 'count2'>): number | null {
  if (item.count2 != null) return item.count2;
  if (item.count1 != null) return item.count1;
  return null;
}

/** Écart = quantité physique retenue − quantité théorique ; null si non compté */
export function lineDiscrepancy(
  item: Pick<PhysicalInventoryItem, 'count1' | 'count2' | 'theoreticalStock'>
): number | null {
  const retained = retainedCount(item);
  return retained == null ? null : retained - item.theoreticalStock;
}

/** Statut de comptage dérivé de la ligne */
export function lineCountStatus(
  item: Pick<PhysicalInventoryItem, 'count1' | 'count2' | 'theoreticalStock'>
): PhysicalInventoryItem['countStatus'] {
  const d = lineDiscrepancy(item);
  if (d == null) return 'Non compté';
  return d === 0 ? 'Sans écart' : 'Écart';
}

/** Recalcule physicalCount / discrepancy / discrepancyValue / countStatus d'une ligne */
export function refreshLine(item: PhysicalInventoryItem): PhysicalInventoryItem {
  const retained = retainedCount(item);
  const discrepancy = retained == null ? null : retained - item.theoreticalStock;
  return {
    ...item,
    physicalCount: retained,
    discrepancy,
    discrepancyValue: discrepancy == null ? 0 : discrepancy * item.unitPrice,
    countStatus: lineCountStatus(item)
  };
}

export interface InventorySummary {
  planned: number;
  counted: number;
  uncounted: number;
  positiveGaps: number; // nb lignes écart > 0
  negativeGaps: number;
  noGap: number;
  totalGapQty: number;
  totalGapValue: number;
  positiveValue: number;
  negativeValue: number;
  missingJustifications: number; // écarts ≠ 0 sans motif
}

export function summarizeInventory(items: PhysicalInventoryItem[]): InventorySummary {
  const s: InventorySummary = {
    planned: items.length, counted: 0, uncounted: 0,
    positiveGaps: 0, negativeGaps: 0, noGap: 0,
    totalGapQty: 0, totalGapValue: 0,
    positiveValue: 0, negativeValue: 0,
    missingJustifications: 0
  };
  items.forEach(i => {
    if (i.physicalCount == null) { s.uncounted++; return; }
    s.counted++;
    const d = i.discrepancy ?? 0;
    s.totalGapQty += d;
    s.totalGapValue += i.discrepancyValue ?? 0;
    if (d > 0) { s.positiveGaps++; s.positiveValue += i.discrepancyValue ?? 0; }
    else if (d < 0) { s.negativeGaps++; s.negativeValue += Math.abs(i.discrepancyValue ?? 0); }
    else s.noGap++;
    if (d !== 0 && !(i.justification && i.justification.trim())) s.missingJustifications++;
  });
  return s;
}

/**
 * Mouvements de régularisation à générer à la clôture :
 *  écart > 0 → 'Entrée', écart < 0 → 'Sortie', écart nul ou non compté → aucun mouvement.
 * Référence = code de l'inventaire (traçabilité + résolution du coût en valorisation).
 */
export function buildAdjustmentMovements(
  inv: PhysicalInventory,
  performedBy: string,
  now: string
): { productId: string; productName: string; movement: Omit<StockMovement, 'id'>; quantityChange: number }[] {
  return inv.items
    .filter(i => i.discrepancy != null && i.discrepancy !== 0)
    .map(i => ({
      productId: i.productId,
      productName: i.productName,
      movement: {
        date: now,
        productId: i.productId,
        productName: i.productName,
        type: i.discrepancy! > 0 ? 'Entrée' as const : 'Sortie' as const,
        quantity: Math.abs(i.discrepancy!),
        reason: `Régularisation inventaire ${inv.code}${i.justification ? ` — ${i.justification}` : ''}`,
        reference: inv.code,
        performedBy
      },
      quantityChange: i.discrepancy!
    }));
}

/** Nouvelle ligne d'inventaire initialisée (jamais comptée) */
export function makeInventoryLine(input: {
  productId: string;
  productCode: string;
  productName: string;
  barcode?: string;
  category: string;
  unit: string;
  depot: string;
  theoreticalStock: number;
  unitPrice: number;
}): PhysicalInventoryItem {
  return {
    ...input,
    count1: null,
    count2: null,
    physicalCount: null,
    discrepancy: null,
    discrepancyValue: 0,
    countStatus: 'Non compté'
  };
}

export function makeAdjustmentMovementId(productId: string): string {
  return generateUniqueId(`m_${productId}`);
}
