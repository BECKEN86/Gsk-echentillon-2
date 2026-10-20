import { describe, it, expect } from 'vitest';
import { computeStockValuation } from './stockValuation';
import { Product, StockMovement } from '../types';

const product: Product = {
  id: 'p1', code: 'P001', name: 'Article Test', category: 'Test',
  buyPrice: 100, sellPrice: 150, stock: 0, minStock: 0,
  unit: 'pièce', availableInPOS: true, isStockable: true
};

const mv = (id: string, date: string, type: StockMovement['type'], quantity: number, reference = ''): StockMovement => ({
  id, date, productId: 'p1', productName: 'Article Test', type, quantity, reason: '', reference, performedBy: 'test'
});

const base = (movements: StockMovement[]) => ({
  products: [product],
  movements,
  approvisionnements: [],
  receptions: [],
  saleOrders: [],
  valuationDate: '2026-06-30'
});

describe('computeStockValuation', () => {
  // Scénario : 10 u à 100 F (01/06) + 10 u à 200 F (10/06) + sortie 10 u (20/06)
  const scenario = [
    mv('m1', '2026-06-01 09:00', 'Entrée', 10, 'APP-1'),
    mv('m2', '2026-06-10 09:00', 'Entrée', 10, 'APP-2'),
    mv('m3', '2026-06-20 09:00', 'Sortie', 10, 'VTE-1')
  ];

  // Les entrées n'ont pas de coût lié -> repli sur buyPrice=100 pour les 2 entrées
  it('CUMP après chaque entrée : sortie valorisée au CUMP du moment', () => {
    const lines = computeStockValuation({ ...base(scenario), method: 'CUMP_PERPETUEL' });
    const l = lines[0];
    // entrées : 10x100 + 10x100 = 2000 → CUMP 100 ; sortie 10 → reste 10 x 100 = 1000
    expect(l.quantity).toBe(10);
    expect(l.unitCost).toBe(100);
    expect(l.totalValue).toBe(1000);
  });

  it('FIFO : les couches les plus anciennes sortent en premier', () => {
    const lines = computeStockValuation({ ...base(scenario), method: 'FIFO' });
    const l = lines[0];
    // 2 couches de 10 @ 100 (repli buyPrice) → sortie consomme la 1ère → reste 10 @ 100 = 1000
    expect(l.quantity).toBe(10);
    expect(l.totalValue).toBe(1000);
  });

  it('FIFO avec coûts distincts via approvisionnements', () => {
    const appros = [
      { id: 'a1', reference: 'APP-1', date: '2026-06-01', operator: 'x', receptionNumber: 'R1', destinationType: 'Magasin' as const, targetLocation: 'M1', items: [{ productId: 'p1', productName: 'Article Test', quantity: 10, unitPrice: 100 }], totalItemsCount: 1, totalQuantity: 10, totalValue: 1000, status: 'Validé' as const },
      { id: 'a2', reference: 'APP-2', date: '2026-06-10', operator: 'x', receptionNumber: 'R2', destinationType: 'Magasin' as const, targetLocation: 'M1', items: [{ productId: 'p1', productName: 'Article Test', quantity: 10, unitPrice: 300 }], totalItemsCount: 1, totalQuantity: 10, totalValue: 3000, status: 'Validé' as const }
    ];
    const lines = computeStockValuation({ ...base(scenario), approvisionnements: appros, method: 'FIFO' });
    const l = lines[0];
    // couches : 10@100 + 10@300 ; sortie 10 consomme la couche à 100 → reste 10 @ 300 = 3000
    expect(l.quantity).toBe(10);
    expect(l.unitCost).toBe(300);
    expect(l.totalValue).toBe(3000);
  });

  it('CUMP périodique : moyenne du mois (ouverture + entrées)', () => {
    const lines = computeStockValuation({ ...base(scenario), method: 'CUMP_PERIODIQUE' });
    const l = lines[0];
    // ouverture juin = 0 ; entrées = 20 u pour 2000 F → CUMP 100 ; final (20-10) x 100 = 1000
    expect(l.quantity).toBe(10);
    expect(l.totalValue).toBe(1000);
  });

  it('Signale un stock négatif comme anomalie', () => {
    const lines = computeStockValuation({ ...base([mv('m1', '2026-06-05 09:00', 'Sortie', 5, 'VTE-9')]), method: 'CUMP_PERPETUEL' });
    expect(lines[0].quantity).toBe(-5);
    expect(lines[0].hasAnomaly).toBe(true);
  });

  it('Reconstitue le stock à une date passée (hors mouvements ultérieurs)', () => {
    const lines = computeStockValuation({ ...base(scenario), valuationDate: '2026-06-05', method: 'CUMP_PERPETUEL' });
    // Seul m1 (01/06) est ≤ 05/06
    expect(lines[0].quantity).toBe(10);
    expect(lines[0].totalValue).toBe(1000);
  });
});
