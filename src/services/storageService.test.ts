import { describe, it, expect } from 'vitest';
import { normalizeDatabase, getDefaultDatabase } from './storageService';

describe('normalizeDatabase', () => {
  it('laisse les collections vides si elles sont absentes', () => {
    const db = normalizeDatabase({});
    expect(db.users).toEqual([]);
    expect(db.products).toEqual([]);
    expect(db.categories).toEqual([]);
    expect(db.storageSites).toEqual([]);
    expect(db.approvisionnements).toEqual([]);
  });

  it('migre les ventes embarquées dans pv.sales vers saleOrders (dédup par id)', () => {
    const mkSale = (id: string, code: string, finalAmount: number) => ({
      id, code, date: '2026-05-15 10:00', clientName: 'C', items: [],
      totalAmount: finalAmount, discount: 0, tax: 0, finalAmount,
      paymentMethod: 'Espèces' as const, status: 'Terminé' as const, sellerName: 'T'
    });
    const sale = mkSale('s1', 'VTE-1', 100);
    const db = normalizeDatabase({
      saleOrders: [sale],
      pointsDeVente: [
        {
          id: 'pv1',
          code: 'PV0001',
          status: 'En cours',
          sales: [sale, mkSale('s2', 'VTE-2', 50)]
        }
      ]
    } as any);
    const ids = db.saleOrders.map(s => s.id);
    expect(ids).toContain('s1');
    expect(ids).toContain('s2');
    expect(ids.filter(i => i === 's1')).toHaveLength(1); // pas de doublon
    expect(db.pointsDeVente[0].sales).toEqual([]); // champ vidé après migration
  });

  it('conserve les compteurs et la config société', () => {
    const db = normalizeDatabase({
      counters: { 'VTE-202605': 7 },
      companyConfig: {
        name: 'SICOVELON', address: 'San Pédro', phone: '0700000000',
        email: 'contact@sicovelon.ci', rccm: 'CI-SAN-01', ncc: '0000000A'
      }
    });
    expect(db.counters['VTE-202605']).toBe(7);
    expect(db.companyConfig?.name).toBe('SICOVELON');
  });

  it('auditLogs est initialisé à [] si absent', () => {
    expect(normalizeDatabase({}).auditLogs).toEqual([]);
  });
});

describe('getDefaultDatabase', () => {
  it('contient des collections vides', () => {
    const db = getDefaultDatabase();
    for (const key of [
      'products', 'categories', 'movements', 'clients', 'suppliers', 'inquiries',
      'purchaseOrders', 'receptions', 'approvisionnements', 'saleOrders', 'pointsDeVente',
      'transactions', 'treasuryAccounts', 'treasuryMovements', 'users', 'auditLogs'
    ]) {
      expect(db[key as keyof typeof db], key).toBeDefined();
    }
    expect(db.products).toEqual([]);
    expect(db.users).toEqual([]);
  });
});
