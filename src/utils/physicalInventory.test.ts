import { describe, it, expect } from 'vitest';
import {
  retainedCount,
  lineDiscrepancy,
  lineCountStatus,
  refreshLine,
  summarizeInventory,
  buildAdjustmentMovements,
  makeInventoryLine
} from './physicalInventory';
import { PhysicalInventory } from '../types';

const line = (over: Partial<Parameters<typeof makeInventoryLine>[0]> = {}) =>
  makeInventoryLine({
    productId: 'p1', productCode: 'P1', productName: 'Art',
    category: 'Test', unit: 'pièce', depot: 'M1',
    theoreticalStock: 100, unitPrice: 50, ...over
  });

describe('comptage & écarts', () => {
  it('retenu = comptage 2 si présent, sinon comptage 1, sinon null', () => {
    expect(retainedCount({ count1: null, count2: null })).toBeNull();
    expect(retainedCount({ count1: 95, count2: null })).toBe(95);
    expect(retainedCount({ count1: 95, count2: 108 })).toBe(108);
  });

  it('écart = retenu − théorique (+8 / −5 / 0 / non compté)', () => {
    expect(lineDiscrepancy({ count1: 108, count2: null, theoreticalStock: 100 })).toBe(8);
    expect(lineDiscrepancy({ count1: 95, count2: null, theoreticalStock: 100 })).toBe(-5);
    expect(lineDiscrepancy({ count1: 100, count2: null, theoreticalStock: 100 })).toBe(0);
    expect(lineDiscrepancy({ count1: null, count2: null, theoreticalStock: 100 })).toBeNull();
  });

  it('un comptage à 0 est un écart, jamais un "non compté"', () => {
    const l = refreshLine({ ...line(), count1: 0 });
    expect(l.countStatus).toBe('Écart');
    expect(l.discrepancy).toBe(-100);
    expect(l.discrepancyValue).toBe(-5000);
  });

  it('statuts : Non compté / Sans écart / Écart', () => {
    expect(lineCountStatus({ count1: null, count2: null, theoreticalStock: 10 })).toBe('Non compté');
    expect(lineCountStatus({ count1: 10, count2: null, theoreticalStock: 10 })).toBe('Sans écart');
    expect(lineCountStatus({ count1: 8, count2: null, theoreticalStock: 10 })).toBe('Écart');
  });
});

describe('synthèse & régularisation', () => {
  const inv: PhysicalInventory = {
    id: 'i1', code: 'INV-2026-001', referenceDate: '2026-06-30', startDate: '2026-06-30',
    depot: 'M1', categoryFilter: 'ALL', type: 'Général', countingMode: 'visible',
    operator: 'Resp', status: 'Validé',
    items: [
      refreshLine({ ...line(), count1: 108 }),                                             // +8
      refreshLine({ ...line({ productId: 'p2', productCode: 'P2' }), count1: 95 }),       // −5
      refreshLine({ ...line({ productId: 'p3', productCode: 'P3' }), count1: 100 }),      // 0
      line({ productId: 'p4', productCode: 'P4' })                                         // non compté
    ],
    totalDiscrepancyQty: 3, totalDiscrepancyValue: 150
  };

  it('synthèse : comptés, non comptés, écarts +/−, valeur', () => {
    const s = summarizeInventory(inv.items);
    expect(s.planned).toBe(4);
    expect(s.counted).toBe(3);
    expect(s.uncounted).toBe(1);
    expect(s.positiveGaps).toBe(1);
    expect(s.negativeGaps).toBe(1);
    expect(s.noGap).toBe(1);
    expect(s.totalGapValue).toBe(8 * 50 - 5 * 50);
    expect(s.missingJustifications).toBe(2);
  });

  it('génère une Entrée par écart +, une Sortie par écart −, rien sinon', () => {
    const mvts = buildAdjustmentMovements(inv, 'Resp', '2026-06-30 15:00');
    expect(mvts).toHaveLength(2);
    expect(mvts[0].movement.type).toBe('Entrée');
    expect(mvts[0].movement.quantity).toBe(8);
    expect(mvts[0].quantityChange).toBe(8);
    expect(mvts[1].movement.type).toBe('Sortie');
    expect(mvts[1].quantityChange).toBe(-5);
    expect(mvts.every(m => m.movement.reference === 'INV-2026-001')).toBe(true);
  });
});
