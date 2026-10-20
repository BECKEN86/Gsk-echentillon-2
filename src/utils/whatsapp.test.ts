import { describe, expect, it } from 'vitest';
import { normalizePhoneForWhatsApp, saleReceiptText, purchaseOrderText } from './whatsapp';
import { PurchaseOrder, SaleOrder } from '../types';

describe('normalizePhoneForWhatsApp', () => {
  it('retourne vide sans numéro', () => {
    expect(normalizePhoneForWhatsApp(undefined)).toBe('');
    expect(normalizePhoneForWhatsApp('')).toBe('');
    expect(normalizePhoneForWhatsApp('abc')).toBe('');
  });

  it('conserve un numéro déjà international', () => {
    expect(normalizePhoneForWhatsApp('+225 07 08 09 10 11')).toBe('2250708091011');
    expect(normalizePhoneForWhatsApp('00225 07 08 09 10 11')).toBe('2250708091011');
  });

  it('préfixe les numéros locaux avec l\'indicatif 225', () => {
    expect(normalizePhoneForWhatsApp('07 08 09 10 11')).toBe('225708091011');
    expect(normalizePhoneForWhatsApp('05 44 55 66 77')).toBe('225544556677');
  });
});

describe('saleReceiptText', () => {
  const sale = {
    code: 'VTE-001', date: '2025-06-10 10:30', clientName: 'Moussa',
    paymentMethod: 'Espèces', sellerName: 'Caissier',
    items: [{ productName: 'Eau 1.5L', quantity: 2, unitPrice: 500, total: 1000 }],
    totalAmount: 1000, discount: 0, tax: 0, finalAmount: 1000, status: 'Validé'
  } as SaleOrder;

  it('contient le numéro, le client, les lignes et le total', () => {
    const text = saleReceiptText(sale);
    expect(text).toContain('VTE-001');
    expect(text).toContain('Moussa');
    expect(text).toContain('Eau 1.5L');
    expect(text).toContain('NET À PAYER');
  });

  it('affiche la remise quand elle existe', () => {
    const text = saleReceiptText({ ...sale, discount: 200, finalAmount: 800 });
    expect(text).toContain('Remise : -');
  });
});

describe('purchaseOrderText', () => {
  it('contient le code BC, le fournisseur et le total TTC', () => {
    const po = {
      code: 'BC-01', date: '2025-06-10', supplierName: 'Distrib SARL',
      items: [{ productName: 'Riz 25kg', quantity: 10, unitPrice: 20000, total: 200000 }],
      totalTTC: 200000, status: 'Validé'
    } as PurchaseOrder;
    const text = purchaseOrderText(po);
    expect(text).toContain('BC-01');
    expect(text).toContain('Distrib SARL');
    expect(text).toContain('Riz 25kg');
    expect(text).toContain('TOTAL TTC');
  });
});
