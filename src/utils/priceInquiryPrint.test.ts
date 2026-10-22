import { describe, expect, it } from 'vitest';
import { PriceInquiry } from '../types';
import { buildPriceInquiryPrintHtml } from './priceInquiryPrint';

const inquiry: PriceInquiry = {
  id: 'inquiry-1',
  code: 'DEV001',
  date: '2026-10-20',
  buyer: 'Acheteuse',
  orderDeadline: '2026-10-30',
  supplierId: 'supplier-1',
  supplierName: 'Fournisseur',
  items: [{
    productId: 'product-1',
    productName: 'Article demandé',
    barcode: '123456',
    uoa: 'Carton',
    requestedQty: 2,
    estimatedPrice: 1000
  }],
  status: 'En cours'
};

describe('buildPriceInquiryPrintHtml', () => {
  it('builds a professional printable consultation with company and supplier details', () => {
    const html = buildPriceInquiryPrintHtml(inquiry, {
      id: 'supplier-1',
      name: 'Fournisseur',
      contactPerson: 'Contact',
      phone: '01020304',
      email: 'contact@example.com',
      address: 'Abidjan',
      categories: [],
      totalPurchases: 0,
      balance: 0
    }, {
      name: 'Ma Société',
      address: 'Plateau, Abidjan',
      phone: '05060708',
      email: 'achats@example.com',
      rccm: 'CI-ABJ-2026',
      ncc: '123456789'
    });

    expect(html).toContain('Demande de prix');
    expect(html).toContain('<title>Demande de prix N° DEV001</title>');
    expect(html).toContain('<u>Émission</u> : 20-10-2026');
    expect(html).toContain('<u>Échéance</u> : <span class="deadline">30-10-2026</span>');
    expect(html).toContain('Ma Société');
    expect(html).toContain('CI-ABJ-2026');
    expect(html).toContain('achats@example.com');
    expect(html).toContain('FOURNISSEURS');
    expect(html).toContain('LISTE DES PRODUITS');
    expect(html).toContain('Signature &amp; Cachet');
    expect(html).toContain('Total hors taxes');
    expect(html).toContain('Total TTC');
    expect(html).toContain('width:15%');
    expect(html).toContain('background: #001F3F');
  });

  it('lists each supplier once, including suppliers specified per item', () => {
    const html = buildPriceInquiryPrintHtml({
      ...inquiry,
      supplierName: 'Fournisseurs multiples',
      items: [
        { ...inquiry.items[0], supplierName: 'Fournisseur A' },
        { ...inquiry.items[0], supplierId: 'supplier-2', supplierName: 'Fournisseur B' },
        { ...inquiry.items[0], supplierId: 'supplier-1', supplierName: 'Fournisseur A' }
      ]
    });

    expect(html).toContain('Fournisseur A');
    expect(html).toContain('Fournisseur B');
    expect(html.indexOf('Fournisseur A')).toBe(html.lastIndexOf('Fournisseur A'));
    expect(html).not.toContain('Fournisseurs multiples');
  });

  it('prints the purchase unit quantity and calculates tax per item rate', () => {
    const html = buildPriceInquiryPrintHtml({
      ...inquiry,
      vatRate: 18,
      items: [{
        ...inquiry.items[0],
        qta: 3,
        requestedQty: 12,
        estimatedPrice: 750,
        vatRate: 0,
        vatAmount: 0,
        totalAmount: 2250
      }, {
        ...inquiry.items[0],
        qta: 2,
        requestedQty: 8,
        estimatedPrice: 1000,
        vatRate: 18,
        vatAmount: 360,
        totalAmount: 2360
      }]
    });

    expect(html).toContain('<td class="center quantity">3</td>');
    expect(html).toContain('<td class="center quantity">2</td>');
    expect(html).not.toContain('<td class="center quantity">12</td>');
    expect(html).toMatch(/<td>Total hors taxes<\/td><td>4\u202f250 FCFA<\/td>/);
    expect(html).toMatch(/<td>TVA<\/td><td>360 FCFA<\/td>/);
    expect(html).toMatch(/<td>Total TTC<\/td><td>4\u202f610 FCFA<\/td>/);
  });

  it('escapes user-provided text before inserting it into the printable document', () => {
    const html = buildPriceInquiryPrintHtml({
      ...inquiry,
      buyer: '<script>alert("x")</script>',
      notes: '<img src=x onerror=alert(1)>'
    }, undefined, {
      name: 'Société & Fils',
      address: '',
      phone: '',
      email: '',
      rccm: '',
      ncc: ''
    });

    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img src=x');
  });
});
