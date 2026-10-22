import { describe, expect, it } from 'vitest';
import { Product, PurchaseOrder } from '../types';
import { buildPurchaseOrderPrintHtml, resolvePurchaseOrderUoa } from './purchaseOrderPrint';

const order: PurchaseOrder = {
  id: 'order-1',
  code: 'BC001',
  inquiryCode: 'DEV001',
  date: '2026-10-20',
  expectedDate: '2026-10-30',
  buyer: 'Acheteuse',
  supplierId: 'supplier-1',
  supplierName: 'Fournisseur',
  items: [{
    productId: 'product-1',
    productName: 'Article commandé',
    barcode: '123456',
    uoa: 'Carton',
    qta: 3,
    quantity: 12,
    unitPrice: 750,
    vatRate: 18,
    total: 2655
  }],
  totalHT: 2250,
  vatRate: 18,
  totalVAT: 405,
  totalTTC: 2655,
  totalAmount: 2655,
  status: 'Validé'
};

describe('buildPurchaseOrderPrintHtml', () => {
  it('uses the inquiry sheet layout and company logo for a purchase order', () => {
    const html = buildPurchaseOrderPrintHtml(order, {
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
      ncc: '123456789',
      logo: 'data:image/png;base64,aGVsbG8='
    });

    expect(html).toContain('<title>Bon de commande N° BC001</title>');
    expect(html).toContain('src="data:image/png;base64,aGVsbG8="');
    expect(html).toContain('Ma Société');
    expect(html).toContain('CI-ABJ-2026');
    expect(html).toContain('FOURNISSEUR');
    expect(html).toContain('LISTE DES PRODUITS COMMANDÉS');
    expect(html).toContain('DEV001');
    expect(html).toContain('20-10-2026');
    expect(html).toContain('30-10-2026');
    expect(html).toContain('Signature &amp; Cachet');
    expect(html).toContain('Total hors taxes');
    expect(html).toContain('Total TTC');
    expect(html).toContain('background: #001F3F');
  });

  it('preserves purchase unit quantities and escapes dynamic values', () => {
    const html = buildPurchaseOrderPrintHtml({
      ...order,
      buyer: '<script>alert("x")</script>',
      notes: '<img src=x onerror=alert(1)>',
      items: [{
        ...order.items[0],
        productName: '<b>Injected</b>'
      }]
    });

    expect(html).toContain('<td>3</td>');
    expect(html).toContain('<td>12</td>');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;b&gt;Injected&lt;/b&gt;');
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img src=x');
  });

  it('resolves a generic Achat label to the product UOA in detail and print views', () => {
    const product: Product = {
      id: 'product-1',
      code: 'PRD-0001',
      name: 'Article commandé',
      category: 'Épicerie',
      buyPrice: 750,
      sellPrice: 1000,
      stock: 12,
      minStock: 2,
      unit: 'pièce',
      storageUnit: 'pièce',
      availableInPOS: true,
      isStockable: true,
      uoa: {
        label: 'Achat',
        type: 'UOA',
        quantity: 1,
        price: 750
      },
      operationalUnits: [{
        label: 'Carton de 12',
        type: 'UOA',
        quantity: 12,
        price: 9000
      }]
    };
    const orderWithGenericUoa = {
      ...order,
      items: [{ ...order.items[0], uoa: 'Achat' }]
    };
    const html = buildPurchaseOrderPrintHtml(orderWithGenericUoa, undefined, undefined, [product]);

    expect(resolvePurchaseOrderUoa(orderWithGenericUoa.items[0], [product])).toBe('Carton de 12');
    expect(html).toContain('<td>Carton de 12</td>');
    expect(html).not.toContain('<td>Achat</td>');
  });
});
