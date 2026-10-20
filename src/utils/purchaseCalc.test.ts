import { describe, it, expect } from 'vitest';
import { purchaseLineQty, purchaseLineHT, purchaseUnitPrice } from './purchaseCalc';

describe('purchaseLineQty — règle Qta', () => {
  it('Qta > 0 → retourne Qta (le prix est par UOA)', () => {
    expect(purchaseLineQty({ qta: 1, requestedQty: 40 })).toBe(1);
    expect(purchaseLineQty({ qta: 3, requestedQty: 120 })).toBe(3);
  });

  it('Qta = 0 → retourne la quantité produit (mode manuel)', () => {
    expect(purchaseLineQty({ qta: 0, requestedQty: 40 })).toBe(40);
  });

  it('Qta vide/absent → retourne la quantité produit', () => {
    expect(purchaseLineQty({ qta: '', requestedQty: 40 })).toBe(40);
    expect(purchaseLineQty({ requestedQty: 25 })).toBe(25);
    expect(purchaseLineQty({ qta: undefined, quantity: 12 })).toBe(12);
  });

  it('gère les chaînes numériques', () => {
    expect(purchaseLineQty({ qta: '2', requestedQty: '80' })).toBe(2);
    expect(purchaseLineQty({ qta: '0', requestedQty: '80' })).toBe(80);
  });
});

describe('purchaseLineHT — montant de ligne', () => {
  it('cas du bug signalé : Qta=1, UOA de 40, prix UOA 580 000 → 580 000 (pas 23 200 000)', () => {
    expect(purchaseLineHT({ qta: 1, requestedQty: 40 }, 580000)).toBe(580000);
  });

  it('Qta=3, prix UOA 580 000 → 1 740 000', () => {
    expect(purchaseLineHT({ qta: 3, requestedQty: 120 }, 580000)).toBe(1740000);
  });

  it('Qta=0 → Quantité × prix unitaire', () => {
    expect(purchaseLineHT({ qta: 0, requestedQty: 40 }, 500)).toBe(20000);
  });

  it('TVA calculée sur le HT corrigé (Qta × prix)', () => {
    const ht = purchaseLineHT({ qta: 1, requestedQty: 40 }, 580000);
    const vat = Math.round(ht * 0.18);
    expect(vat).toBe(104400);
    expect(ht + vat).toBe(684400);
  });
});

describe('purchaseUnitPrice — prix ramené à l\'unité produit', () => {
  it('UOA de 40 à 580 000 → 14 500 par unité', () => {
    expect(purchaseUnitPrice({ qta: 1, requestedQty: 40, unitPrice: 580000 })).toBe(14500);
  });

  it('Qta=0 → le prix est déjà le prix unitaire', () => {
    expect(purchaseUnitPrice({ qta: 0, requestedQty: 40, unitPrice: 500 })).toBe(500);
  });

  it('quantité nulle → retourne le prix saisi tel quel', () => {
    expect(purchaseUnitPrice({ qta: 1, requestedQty: 0, unitPrice: 580000 })).toBe(580000);
  });
});
