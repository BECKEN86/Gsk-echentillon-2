import { describe, it, expect } from 'vitest';
import {
  buildShipMovements,
  buildReceiveMovements,
  buildTransferCancelMovements,
  transferTotalValue
} from './stockTransfer';
import { buildDestockMovement, summarizeLosses } from './stockLoss';
import { StockTransfer, StockAvarieLoss } from '../types';

const makeTransfer = (status: StockTransfer['status'] = 'En transit'): StockTransfer => ({
  id: 't1',
  code: 'TRF-2026-001',
  date: '2026-02-04 09:00',
  sourceLocation: 'Dépôt principal',
  targetLocation: 'Rayon A',
  operator: 'Testeur',
  status,
  items: [
    { productId: 'p1', productName: 'Riz 25kg', productCode: 'RIZ-25', quantity: 10, unit: 'sac', unitPrice: 20000 },
    { productId: 'p2', productName: 'Huile 5L', productCode: 'HUI-5', quantity: 6, unit: 'bidon', unitPrice: 7500 }
  ],
  totalValue: 10 * 20000 + 6 * 7500
});

describe('stockTransfer — cycle en transit → réceptionné/annulé', () => {
  it('valeur totale = Σ qté × CUMP figé', () => {
    expect(transferTotalValue(makeTransfer())).toBe(245000);
  });

  it('expédition → mouvements Sortie (stock en transit hors dépôt)', () => {
    const movs = buildShipMovements(makeTransfer(), 'Testeur', '2026-02-04 09:05');
    expect(movs).toHaveLength(2);
    expect(movs.every(m => m.type === 'Sortie')).toBe(true);
    expect(movs[0].quantity).toBe(10);
    expect(movs[0].reference).toBe('TRF-2026-001');
    expect(movs[0].reason).toContain('Dépôt principal → Rayon A');
  });

  it('réception → mouvements Entrée qui compensent exactement les sorties', () => {
    const t = makeTransfer();
    const ship = buildShipMovements(t, 'A', '2026-02-04 09:00');
    const recv = buildReceiveMovements(t, 'B', '2026-02-04 12:00');
    // net à zéro par produit → aucune valeur artificielle
    recv.forEach(r => {
      const out = ship.find(s => s.productId === r.productId);
      expect(r.type).toBe('Entrée');
      expect(r.quantity).toBe(out?.quantity);
    });
  });

  it('annulation → mouvements Entrée de retour au dépôt source', () => {
    const t = { ...makeTransfer(), cancelReason: 'Camion immobilisé' };
    const movs = buildTransferCancelMovements(t, 'Testeur', '2026-02-04 11:00');
    expect(movs.every(m => m.type === 'Entrée')).toBe(true);
    expect(movs[0].reason).toContain('retour à Dépôt principal');
    expect(movs[0].reason).toContain('Camion immobilisé');
  });
});

const makeLoss = (status: StockAvarieLoss['status'] = 'Constaté'): StockAvarieLoss => ({
  id: 'l1',
  code: 'DEC-2026-001',
  date: '2026-02-04 10:00',
  productId: 'p1',
  productName: 'Lait en poudre',
  productCode: 'LAI-01',
  quantity: 4,
  unit: 'boîte',
  depot: 'Rayon A',
  unitPrice: 3500,
  totalLossValue: 14000,
  type: 'Périmé',
  operator: 'Testeur',
  status
});

describe('stockLoss — pertes & avariés', () => {
  it('déstockage → mouvement Périmé/Casse référencé DEC', () => {
    const mv = buildDestockMovement(makeLoss(), 'Testeur', '2026-02-04 10:30');
    expect(mv.type).toBe('Périmé/Casse');
    expect(mv.quantity).toBe(4);
    expect(mv.reference).toBe('DEC-2026-001');
    expect(mv.reason).toContain('Périmé');
    expect(mv.reason).toContain('Rayon A');
  });

  it('synthèse : valeur comptabilisée uniquement sur les déstockés', () => {
    const list = [
      makeLoss('Constaté'),
      { ...makeLoss('Déstocké'), id: 'l2', code: 'DEC-2026-002', quantity: 2, totalLossValue: 7000 },
      { ...makeLoss('Déstocké'), id: 'l3', code: 'DEC-2026-003', type: 'Casse/Endommagé' as const, quantity: 3, totalLossValue: 10500 }
    ];
    const s = summarizeLosses(list);
    expect(s.declaredCount).toBe(1);
    expect(s.destockedCount).toBe(2);
    expect(s.totalQuantity).toBe(5);
    expect(s.totalValue).toBe(17500);
    expect(s.byType['Périmé'].count).toBe(2);
    expect(s.byType['Casse/Endommagé'].value).toBe(10500);
  });
});
