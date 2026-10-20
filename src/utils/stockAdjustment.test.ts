import { describe, it, expect } from 'vitest';
import {
  refreshAdjustmentLine,
  summarizeAdjustment,
  makeAdjustmentLine,
  buildAdjustmentDocMovements,
  buildCompensationMovements
} from './stockAdjustment';
import { StockAdjustment } from '../types';

const baseLine = () =>
  makeAdjustmentLine({
    productId: 'p1',
    productCode: 'ART-1',
    productName: 'Article 1',
    category: 'Boissons',
    unit: 'pièce',
    depot: 'Magasin A',
    theoreticalStock: 100,
    unitPrice: 500
  });

const makeAdj = (lines: ReturnType<typeof baseLine>[], status: StockAdjustment['status'] = 'Brouillon'): StockAdjustment => ({
  id: 'a1',
  code: 'ADJ-2026-001',
  date: '2026-02-04 10:00',
  depot: 'Magasin A',
  operator: 'Testeur',
  status,
  lines,
  totalPositiveQty: 0,
  totalNegativeQty: 0,
  totalDiscrepancyValue: 0
});

describe('refreshAdjustmentLine', () => {
  it('calcule un écart positif et sa valeur', () => {
    const l = refreshAdjustmentLine({ ...baseLine(), countedStock: 108 });
    expect(l.discrepancy).toBe(8);
    expect(l.discrepancyValue).toBe(4000); // +8 × 500
  });

  it('calcule un écart négatif', () => {
    const l = refreshAdjustmentLine({ ...baseLine(), countedStock: 95 });
    expect(l.discrepancy).toBe(-5);
    expect(l.discrepancyValue).toBe(-2500);
  });

  it('un zéro constaté n\'est pas un non-saisi', () => {
    const l = refreshAdjustmentLine({ ...baseLine(), countedStock: 0 });
    expect(l.discrepancy).toBe(-100);
    const untouched = refreshAdjustmentLine(baseLine());
    expect(untouched.discrepancy).toBeNull();
  });
});

describe('summarizeAdjustment', () => {
  it('sépare augmentations, diminutions, écarts nuls et non saisis', () => {
    const lines = [
      refreshAdjustmentLine({ ...baseLine(), countedStock: 108 }),           // +8
      refreshAdjustmentLine({ ...baseLine(), productId: 'p2', countedStock: 95 }), // −5
      refreshAdjustmentLine({ ...baseLine(), productId: 'p3', countedStock: 100, reason: 'Correction après contrôle' }), // 0
      baseLine()                                                              // non saisi
    ];
    const s = summarizeAdjustment(lines, 'Régularisation autorisée');
    expect(s.lineCount).toBe(4);
    expect(s.enteredCount).toBe(3);
    expect(s.positiveCount).toBe(1);
    expect(s.negativeCount).toBe(1);
    expect(s.zeroCount).toBe(1);
    expect(s.totalPositiveQty).toBe(8);
    expect(s.totalNegativeQty).toBe(5);
    expect(s.totalDiscrepancyValue).toBe(1500); // 4000 − 2500
    expect(s.missingReasons).toBe(0); // motif général couvre les écarts
  });

  it('compte les écarts sans motif', () => {
    const lines = [refreshAdjustmentLine({ ...baseLine(), countedStock: 90 })];
    const s = summarizeAdjustment(lines, undefined);
    expect(s.missingReasons).toBe(1);
  });
});

describe('buildAdjustmentDocMovements', () => {
  it('écart + → Entrée, écart − → Sortie, référence = code ADJ', () => {
    const adj = makeAdj([
      refreshAdjustmentLine({ ...baseLine(), countedStock: 108, reason: 'Produit retrouvé en magasin' }),
      refreshAdjustmentLine({ ...baseLine(), productId: 'p2', countedStock: 95, reason: 'Produit cassé ou endommagé' }),
      refreshAdjustmentLine({ ...baseLine(), productId: 'p3', countedStock: 100 }) // écart 0 → aucun mouvement
    ]);
    const movs = buildAdjustmentDocMovements(adj, 'Testeur', '2026-02-04 11:00');
    expect(movs).toHaveLength(2);
    expect(movs[0].movement.type).toBe('Entrée');
    expect(movs[0].movement.quantity).toBe(8);
    expect(movs[0].movement.reference).toBe('ADJ-2026-001');
    expect(movs[0].quantityChange).toBe(8);
    expect(movs[1].movement.type).toBe('Sortie');
    expect(movs[1].quantityChange).toBe(-5);
  });
});

describe('buildCompensationMovements', () => {
  it('inverse les signes pour l\'annulation d\'un ajustement validé', () => {
    const adj = makeAdj([
      refreshAdjustmentLine({ ...baseLine(), countedStock: 108 }),
      refreshAdjustmentLine({ ...baseLine(), productId: 'p2', countedStock: 95 })
    ], 'Validé');
    adj.cancelReason = 'Double saisie';
    const movs = buildCompensationMovements(adj, 'Testeur', '2026-02-04 12:00');
    expect(movs).toHaveLength(2);
    // +8 validé → compensation −8 (Sortie) ; −5 validé → compensation +5 (Entrée)
    expect(movs[0].movement.type).toBe('Sortie');
    expect(movs[0].quantityChange).toBe(-8);
    expect(movs[1].movement.type).toBe('Entrée');
    expect(movs[1].quantityChange).toBe(5);
    expect(movs[0].movement.reason).toContain('Annulation ajustement ADJ-2026-001');
  });
});
