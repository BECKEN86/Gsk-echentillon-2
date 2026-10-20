import { describe, it, expect } from 'vitest';
import { Client, CustomerReturn, Supplier, SupplierReturn } from '../types';
import {
  alreadyReturnedQty,
  buildCustomerReturnMovements,
  buildCustomerReturnCancelMovements,
  buildSupplierReturnMovements,
  buildSupplierReturnCancelMovements,
  applyCustomerReturnToClient,
  revertCustomerReturnOnClient,
  applySupplierReturnToSupplier,
  revertSupplierReturnOnSupplier
} from './stockReturns';

const NOW = '19/10/2026 12:00';

const makeCustomerReturn = (over: Partial<CustomerReturn> = {}): CustomerReturn => ({
  id: 'rc1',
  code: 'RC-202610-0001',
  date: NOW,
  saleId: 'v1',
  saleCode: 'VTE-202610-0001',
  clientId: 'c1',
  clientName: 'Client A',
  items: [
    { productId: 'p1', productName: 'Art 1', saleQty: 5, returnedQty: 2, unitPrice: 1000, buyPrice: 600, restock: true },
    { productId: 'p2', productName: 'Art 2', saleQty: 3, returnedQty: 1, unitPrice: 500, buyPrice: 300, restock: false }
  ],
  totalAmount: 2500,
  operator: 'Admin',
  status: 'Validé',
  ...over
});

const makeSupplierReturn = (over: Partial<SupplierReturn> = {}): SupplierReturn => ({
  id: 'rf1',
  code: 'RF-202610-0001',
  date: NOW,
  supplierId: 's1',
  supplierName: 'Fourn A',
  items: [
    { productId: 'p1', productName: 'Art 1', returnedQty: 4, unitPrice: 600 }
  ],
  totalAmount: 2400,
  operator: 'Admin',
  status: 'Validé',
  ...over
});

const makeClient = (over: Partial<Client> = {}): Client => ({
  id: 'c1',
  name: 'Client A',
  phone: '',
  email: '',
  address: '',
  type: 'Particulier',
  creditBalance: 2000,
  totalPurchases: 10000,
  ...over
});

const makeSupplier = (over: Partial<Supplier> = {}): Supplier => ({
  id: 's1',
  name: 'Fourn A',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  categories: [],
  balance: 1000,
  totalPurchases: 50000,
  ...over
});

describe('stockReturns — retours clients', () => {
  it('ne génère des entrées que pour les lignes restock', () => {
    const mvts = buildCustomerReturnMovements(makeCustomerReturn(), 'Admin', NOW);
    expect(mvts).toHaveLength(1);
    expect(mvts[0]).toMatchObject({ productId: 'p1', type: 'Entrée', quantity: 2, reference: 'RC-202610-0001' });
  });

  it('la contre-passation ressort les quantités réintégrées', () => {
    const mvts = buildCustomerReturnCancelMovements(makeCustomerReturn(), 'Admin', NOW);
    expect(mvts).toHaveLength(1);
    expect(mvts[0]).toMatchObject({ type: 'Sortie', quantity: 2 });
  });

  it('cumule les quantités déjà retournées hors doc annulé', () => {
    const map = alreadyReturnedQty(
      [makeCustomerReturn(), makeCustomerReturn({ id: 'rc2', status: 'Annulé' })],
      'v1'
    );
    expect(map.get('p1')).toBe(2);
    expect(map.get('p2')).toBe(1);
  });

  it('vente à crédit : déduit le crédit puis émet un avoir pour le reste', () => {
    const res = applyCustomerReturnToClient(makeClient({ creditBalance: 2000 }), makeCustomerReturn(), true, 'AV-202610-0001', NOW);
    expect(res.creditDeduction).toBe(2000);
    expect(res.avoirAmount).toBe(500);
    expect(res.client.creditBalance).toBe(0);
    expect(res.client.totalPurchases).toBe(7500);
    expect(res.client.avoirLines).toHaveLength(1);
    expect(res.client.avoirLines![0]).toMatchObject({ avoirNumber: 'AV-202610-0001', totalAmount: 500, remainingBalance: 500, status: 'Actif' });
  });

  it('vente payée : avoir intégral, crédit inchangé', () => {
    const res = applyCustomerReturnToClient(makeClient(), makeCustomerReturn(), false, 'AV-202610-0002', NOW);
    expect(res.creditDeduction).toBe(0);
    expect(res.avoirAmount).toBe(2500);
    expect(res.client.creditBalance).toBe(2000);
  });

  it('annulation : restaure crédit et achats, supprime l\'avoir', () => {
    const ret = makeCustomerReturn({ creditDeduction: 2000, avoirAmount: 500, avoirNumber: 'AV-202610-0001' });
    const applied = applyCustomerReturnToClient(makeClient(), ret, true, ret.avoirNumber!, NOW).client;
    const reverted = revertCustomerReturnOnClient(applied, ret);
    expect(reverted).not.toBeNull();
    expect(reverted!.creditBalance).toBe(2000);
    expect(reverted!.totalPurchases).toBe(10000);
    expect(reverted!.avoirLines).toHaveLength(0);
  });

  it('annulation refusée si l\'avoir a été entamé', () => {
    const ret = makeCustomerReturn({ creditDeduction: 0, avoirAmount: 2500, avoirNumber: 'AV-202610-0001' });
    const client = applyCustomerReturnToClient(makeClient(), ret, false, ret.avoirNumber!, NOW).client;
    client.avoirLines![0].refundedAmount = 100;
    expect(revertCustomerReturnOnClient(client, ret)).toBeNull();
  });
});

describe('stockReturns — retours fournisseurs', () => {
  it('génère des sorties à la validation', () => {
    const mvts = buildSupplierReturnMovements(makeSupplierReturn(), 'Admin', NOW);
    expect(mvts).toHaveLength(1);
    expect(mvts[0]).toMatchObject({ productId: 'p1', type: 'Sortie', quantity: 4, reference: 'RF-202610-0001' });
  });

  it('la contre-passation réintègre les quantités', () => {
    const mvts = buildSupplierReturnCancelMovements(makeSupplierReturn(), 'Admin', NOW);
    expect(mvts).toHaveLength(1);
    expect(mvts[0]).toMatchObject({ type: 'Entrée', quantity: 4 });
  });

  it('déduit la dette puis émet un avoir pour le reste', () => {
    const res = applySupplierReturnToSupplier(makeSupplier({ balance: 1000 }), makeSupplierReturn(), 'AVF-202610-0001', NOW);
    expect(res.debtDeduction).toBe(1000);
    expect(res.avoirAmount).toBe(1400);
    expect(res.supplier.balance).toBe(0);
    expect(res.supplier.totalPurchases).toBe(47600);
    expect(res.supplier.avoirLines).toHaveLength(1);
    expect(res.supplier.avoirLines![0]).toMatchObject({ avoirNumber: 'AVF-202610-0001', remainingBalance: 1400 });
  });

  it('dette supérieure au retour : pas d\'avoir', () => {
    const res = applySupplierReturnToSupplier(makeSupplier({ balance: 10000 }), makeSupplierReturn(), 'AVF-202610-0002', NOW);
    expect(res.debtDeduction).toBe(2400);
    expect(res.avoirAmount).toBe(0);
    expect(res.supplier.balance).toBe(7600);
    expect(res.supplier.avoirLines).toHaveLength(0);
  });

  it('annulation : restaure dette et achats, supprime l\'avoir', () => {
    const ret = makeSupplierReturn({ debtDeduction: 1000, avoirAmount: 1400, avoirNumber: 'AVF-202610-0001' });
    const applied = applySupplierReturnToSupplier(makeSupplier(), ret, ret.avoirNumber!, NOW).supplier;
    const reverted = revertSupplierReturnOnSupplier(applied, ret);
    expect(reverted).not.toBeNull();
    expect(reverted!.balance).toBe(1000);
    expect(reverted!.totalPurchases).toBe(50000);
    expect(reverted!.avoirLines).toHaveLength(0);
  });

  it('annulation refusée si l\'avoir fournisseur a été entamé', () => {
    const ret = makeSupplierReturn({ debtDeduction: 0, avoirAmount: 2400, avoirNumber: 'AVF-202610-0001' });
    const supplier = applySupplierReturnToSupplier(makeSupplier({ balance: 0 }), ret, ret.avoirNumber!, NOW).supplier;
    supplier.avoirLines![0].refundedAmount = 200;
    expect(revertSupplierReturnOnSupplier(supplier, ret)).toBeNull();
  });
});
