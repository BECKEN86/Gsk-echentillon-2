import { describe, expect, it } from 'vitest';
import { AppDatabase } from '../services/storageService';
import { EXPORT_PARTS, ExportFilters, depotOptions } from './dataExport';
import { buildXlsx, buildZip } from './xlsxWriter';
import { Client, Product, SaleOrder, StockMovement, UserAccount } from '../types';

const emptyDb = (over: Partial<AppDatabase> = {}): AppDatabase => ({
  version: 1,
  lastUpdated: '',
  counters: {},
  products: [],
  categories: [],
  movements: [],
  clients: [],
  suppliers: [],
  inquiries: [],
  purchaseOrders: [],
  receptions: [],
  approvisionnements: [],
  storageSites: [],
  saleOrders: [],
  pointsDeVente: [],
  transactions: [],
  treasuryAccounts: [],
  treasuryMovements: [],
  users: [],
  auditLogs: [],
  valuations: [],
  physicalInventories: [],
  stockAdjustments: [],
  stockTransfers: [],
  stockLosses: [],
  customerReturns: [],
  supplierReturns: [],
  companyConfig: null,
  ...over
});

const part = (id: string) => {
  const p = EXPORT_PARTS.find(x => x.id === id);
  if (!p) throw new Error(`partie inconnue: ${id}`);
  return p;
};

const product = (id: string, depot = 'Magasin A'): Product => ({
  id, code: `P-${id}`, name: `Produit ${id}`, category: 'Boissons',
  buyPrice: 100, sellPrice: 150, stock: 10, minStock: 2, unit: 'pièce', location: depot
} as Product);

describe('EXPORT_PARTS — catalogue réel', () => {
  it('ne contient aucun module inexistant (compta, immobilisations, plan comptable…)', () => {
    const ids = EXPORT_PARTS.map(p => p.id);
    ['comptabilite', 'plan_comptable', 'journaux', 'ecritures', 'immobilisations', 'factures_clients', 'factures_fournisseurs', 'marques'].forEach(f => {
      expect(ids).not.toContain(f);
    });
  });

  it('chaque partie a un nom de feuille ≤ 31 car. compatible Excel', () => {
    EXPORT_PARTS.forEach(p => {
      expect(p.sheetName.length).toBeLessThanOrEqual(31);
      expect(p.sheetName).not.toMatch(/[\[\]\*\?\/\\:]/);
      expect(p.columns.length).toBeGreaterThan(0);
    });
  });

  it('utilisateurs : jamais de mot de passe ni secret dans les lignes', () => {
    const users: UserAccount[] = [{
      id: 'u1', username: 'admin', name: 'Admin', role: 'Administrateur',
      password: 'secret123', passwordHash: 'sha256:ab:cd',
      allowedSections: ['accueil'], defaultSection: 'accueil'
    } as UserAccount];
    const p = part('utilisateurs');
    expect(p.columns.join(' ').toLowerCase()).not.toMatch(/password|mot.?de.?passe|hash|secret|token/);
    const rows = p.buildRows(emptyDb({ users }), {});
    const flat = JSON.stringify(rows);
    expect(flat).not.toContain('secret123');
    expect(flat).not.toContain('sha256:');
  });

  it('lignes ventes : aplatit les items avec clés étrangères (id/code vente, id produit)', () => {
    const sale: SaleOrder = {
      id: 's1', code: 'VTE-1', date: '2025-06-10 10:00', clientName: 'Moussa',
      items: [{ productId: 'p1', productName: 'Eau', quantity: 2, unitPrice: 100, total: 200 }],
      totalAmount: 200, discount: 0, tax: 0, finalAmount: 200,
      paymentMethod: 'Espèces', status: 'Validé', sellerName: 'Caissier'
    } as SaleOrder;
    const rows = part('lignes_ventes').buildRows(emptyDb({ saleOrders: [sale] }), {});
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('s1');
    expect(rows[0]).toContain('VTE-1');
    expect(rows[0]).toContain('p1');
  });
});

describe('EXPORT_PARTS — filtres', () => {
  it('période : filtre les mouvements sur la date', () => {
    const movements = [
      { id: 'm1', date: '2025-01-05 09:00', type: 'Entrée', productId: 'p', productName: 'P', quantity: 1, reason: '', reference: '', performedBy: '' },
      { id: 'm2', date: '2025-06-05 09:00', type: 'Sortie', productId: 'p', productName: 'P', quantity: 1, reason: '', reference: '', performedBy: '' }
    ] as StockMovement[];
    const db = emptyDb({ movements });
    expect(part('mouvements').buildRows(db, {})).toHaveLength(2);
    expect(part('mouvements').buildRows(db, { from: '2025-05-01' })).toHaveLength(1);
    expect(part('mouvements').buildRows(db, { to: '2025-01-31' })).toHaveLength(1);
    expect(part('mouvements').buildRows(db, { from: '2025-02-01', to: '2025-02-28' })).toHaveLength(0);
  });

  it('dépôt : filtre les articles sur l\'emplacement', () => {
    const db = emptyDb({ products: [product('a', 'Magasin A'), product('b', 'Magasin B')] });
    expect(part('articles').buildRows(db, { depot: 'Magasin A' })).toHaveLength(1);
  });

  it('client : filtre les ventes sur l\'ID client', () => {
    const clients: Client[] = [{
      id: 'c1', name: 'Moussa', type: 'Particulier', phone: '', email: '', address: '',
      creditBalance: 0, creditLines: [], avoirLines: [], totalPurchases: 0
    } as Client];
    const sales = [
      { id: 's1', code: 'VTE-1', date: '2025-06-10', clientId: 'c1', clientName: 'Moussa', items: [], totalAmount: 0, discount: 0, tax: 0, finalAmount: 0, paymentMethod: 'Espèces', status: 'Validé', sellerName: '' },
      { id: 's2', code: 'VTE-2', date: '2025-06-10', clientId: 'c2', clientName: 'Autre', items: [], totalAmount: 0, discount: 0, tax: 0, finalAmount: 0, paymentMethod: 'Espèces', status: 'Validé', sellerName: '' }
    ] as SaleOrder[];
    const rows = part('ventes').buildRows(emptyDb({ clients, saleOrders: sales }), { clientId: 'c1' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('s1');
  });

  it('depotOptions : union des magasins et emplacements produits', () => {
    const db = emptyDb({
      products: [product('a', 'Magasin A')],
      storageSites: [{ id: 's1', name: 'Rayon 1', type: 'Rayon' } as never]
    });
    expect(depotOptions(db)).toEqual(['Magasin A', 'Rayon 1']);
  });
});

describe('buildZip / buildXlsx', () => {
  it('produit une archive ZIP valide (signature PK)', () => {
    const zip = buildZip([{ name: 'a.txt', data: new TextEncoder().encode('hello') }]);
    expect(zip[0]).toBe(0x50); // P
    expect(zip[1]).toBe(0x4b); // K
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
  });

  it('produit un classeur .xlsx valide (ZIP + Content Types)', () => {
    const xlsx = buildXlsx([{ name: 'Test', rows: [['A', 'B'], [1, 'x']] }]);
    expect(xlsx[0]).toBe(0x50);
    expect(xlsx[1]).toBe(0x4b);
    const text = new TextDecoder('latin1').decode(xlsx);
    expect(text).toContain('[Content_Types].xml');
    expect(text).toContain('xl/workbook.xml');
    expect(text).toContain('xl/worksheets/sheet1.xml');
  });

  it('dédoublonne et assainit les noms de feuilles', () => {
    const xlsx = buildXlsx([
      { name: 'Ventes', rows: [['x']] },
      { name: 'Ventes', rows: [['x']] },
      { name: 'A/B:C*D?E[F]G\\H un nom vraiment très très long', rows: [['x']] }
    ]);
    const text = new TextDecoder('latin1').decode(xlsx);
    expect(text).toContain('Ventes (2)');
    expect(text).not.toMatch(/sheet name="[^"]*[\[\]\*\?\/\\:]/);
  });

  it('échappe le XML dans les chaînes', () => {
    const xlsx = buildXlsx([{ name: 'T', rows: [['v'], ['<a&b>"c"']] }]);
    const text = new TextDecoder('latin1').decode(xlsx);
    expect(text).toContain('&lt;a&amp;b&gt;');
    expect(text).not.toContain('<a&b>');
  });
});
