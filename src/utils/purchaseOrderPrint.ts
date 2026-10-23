import { formatFCFA } from '../data/initialData';
import { CompanyConfig, Product, PurchaseOrder, PurchaseOrderItem, Supplier } from '../types';
import { parseAppDate } from './dateUtils';
import { purchaseLineQty } from './purchaseCalc';

const escapeHtml = (value: string | number | undefined | null): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDate = (value?: string): string => {
  if (!value) return 'Non définie';
  const date = parseAppDate(value);
  return Number.isNaN(date.getTime())
    ? escapeHtml(value)
    : `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
};

export function resolvePurchaseOrderUoa(
  item: PurchaseOrderItem,
  products: Product[] = []
): string | undefined {
  const isGenericUoa = (value?: string) =>
    !value || ['achat', 'conditionnement achat'].includes(value.trim().toLocaleLowerCase());
  const product = products.find(candidate =>
    candidate.id === item.productId ||
    (!!item.barcode && candidate.barcode === item.barcode) ||
    candidate.name === item.productName
  );

  if (!isGenericUoa(item.uoa)) return item.uoa?.trim();
  if (!product) return undefined;

  const operationalUoa = product.operationalUnits?.find(unit =>
    unit.type === 'UOA' && !isGenericUoa(unit.label || unit.name)
  );
  const legacyUoa = product.uoa && !isGenericUoa(product.uoa.label || product.uoa.name)
    ? product.uoa.label || product.uoa.name
    : undefined;

  return operationalUoa?.label || operationalUoa?.name || legacyUoa || product.storageUnit || product.unit || undefined;
}

export function buildPurchaseOrderPrintHtml(
  order: PurchaseOrder,
  supplier?: Supplier,
  companyConfig?: CompanyConfig | null,
  products: Product[] = []
): string {
  const vatRate = order.vatRate ?? 18;
  const totalHT = order.totalHT ?? order.items.reduce(
    (sum, item) => sum + purchaseLineQty(item) * item.unitPrice,
    0
  );
  const totalVAT = order.totalVAT ?? order.items.reduce((sum, item) => {
    const itemVat = item.vatRate ?? vatRate;
    const lineHT = purchaseLineQty(item) * item.unitPrice;
    return sum + (item.vatAmount ?? Math.round(lineHT * (itemVat / 100)));
  }, 0);
  const totalTTC = order.totalTTC ?? order.totalAmount ?? totalHT + totalVAT;
  const companyName = companyConfig?.name?.trim() || 'GeStock';
  const logo = companyConfig?.logo && /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z\d+/=\s]+$/i.test(companyConfig.logo)
    ? `<img class="company-logo" src="${escapeHtml(companyConfig.logo)}" alt="Logo ${escapeHtml(companyName)}">`
    : '';
  const companyDetails = [
    companyConfig?.address,
    companyConfig?.phone && `Contact : ${companyConfig.phone}`,
    companyConfig?.email,
    companyConfig?.rccm && `RCM : ${companyConfig.rccm}`,
    companyConfig?.ncc && `NCC : ${companyConfig.ncc}`
  ].filter(Boolean);
  const supplierName = supplier?.name || order.supplierName || 'Fournisseur à préciser';
  const rows = order.items.map((item, index) => {
    const itemVat = item.vatRate ?? vatRate;
    const lineTotal = item.total ?? Math.round(
      purchaseLineQty(item) * item.unitPrice * (1 + itemVat / 100)
    );

    return `
      <tr>
        <td>${index + 1}</td>
        <td class="code">${escapeHtml(item.barcode || '—')}</td>
        <td class="designation">${escapeHtml(item.productName)}</td>
        <td>${escapeHtml(resolvePurchaseOrderUoa(item, products) || '—')}</td>
        <td>${escapeHtml(item.qta || '—')}</td>
        <td>${escapeHtml(item.quantity)}</td>
        <td class="right">${escapeHtml(formatFCFA(item.unitPrice))}</td>
        <td>${escapeHtml(itemVat)} %</td>
        <td class="right">${escapeHtml(formatFCFA(lineTotal))}</td>
      </tr>`;
  }).join('');
  const footerDetails = [
    companyConfig?.name,
    companyConfig?.address && `Adresse : ${companyConfig.address}`,
    companyConfig?.phone && `Contact : ${companyConfig.phone}`,
    companyConfig?.rccm && `RCM : ${companyConfig.rccm}`,
    companyConfig?.ncc && `NCC : ${companyConfig.ncc}`
  ].filter(Boolean);

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Bon de commande N° ${escapeHtml(order.code)}</title>
    <style>
      @page { size: A4; margin: 0; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: #000;
        font: 10.5pt/1.45 Calibri, Carlito, "Segoe UI", Arial, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .sheet {
        position: relative;
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        padding: 10mm 12mm 36mm;
        background: #fff;
        font-size: 10.5pt;
      }
      .header { display: flex; justify-content: space-between; align-items: flex-start; min-height: 65mm; }
      .document-heading { align-self: flex-end; min-width: 0; padding-left: 4mm; margin-top: 24mm; }
      .document-heading h1 { margin: 0; color: #001F3F; font-size: 17pt; }
      .header-meta { margin-top: 6mm; padding-left: 4mm; line-height: 1.9; }
      .header-meta u { text-underline-offset: 2px; }
      .company { width: 78mm; text-align: left; }
      .company-logo { display: block; width: 44mm; height: 33mm; margin-left: auto; object-fit: contain; }
      .company-name { margin: 4mm 0; font-size: 13pt; font-weight: 700; text-align: center; }
      .company-details { font-size: 9.5pt; line-height: 1.8; }
      .supplier { width: 78mm; min-height: 32mm; margin: 6mm 0 0 auto; padding: 3mm; border: 1px solid #9a9a9a; }
      .supplier h2 { margin: 0 0 2mm; color: #001F3F; font-size: 12pt; text-decoration: underline; }
      .supplier p { margin: 1mm 0; }
      .section-title { margin: 12mm 0 2mm 3mm; color: #001F3F; font-size: 10pt; text-decoration: underline; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      thead { display: table-header-group; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      .items-table { font-size: 8pt; }
      .items-table th { padding: 2mm .7mm; border: 1px solid #000; background: #001F3F; color: #fff; font-weight: 400; }
      .items-table td { padding: 1mm .7mm; border: 1px solid #000; text-align: center; overflow-wrap: anywhere; }
      .right { text-align: right !important; white-space: nowrap; }
      .code { font-family: Consolas, monospace; font-size: 7pt; }
      .designation { text-align: left !important; }
      .totals { width: 78mm; margin: 6mm 0 0 auto; font-size: 10pt; }
      .totals td { padding: 2mm 1.5mm; border: 1px solid #000; }
      .totals td:last-child { text-align: right; white-space: nowrap; }
      .totals .grand-total td { background: #001F3F; color: #fff; font-weight: 700; }
      .notes { margin: 8mm 0 0 4mm; font-size: 9.5pt; white-space: pre-wrap; }
      .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 16mm; margin: 18mm 4mm 0; break-inside: avoid; }
      .signature { min-height: 22mm; border-bottom: 1px solid #000; font-size: 10pt; }
      .signature span { display: block; margin-top: 24mm; text-align: center; font-style: italic; }
      .footer { position: absolute; right: 4mm; bottom: 8mm; left: 4mm; padding-top: 4mm; border-top: 1px solid #001F3F; font-size: 8.5pt; line-height: 1.5; text-align: center; }
      @media screen {
        body { background: #e2e8f0; }
        .sheet { margin: 10mm auto; box-shadow: 0 0 6px #0004; }
      }
      @media print {
        body { background: #fff; }
        .sheet { margin: 0; }
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      <header class="header">
        <div class="document-heading">
          <h1>BON DE COMMANDE</h1>
          <div class="header-meta">
            <div><u>Référence</u> : ${escapeHtml(order.code)}</div>
            <div><u>Émission</u> : ${formatDate(order.date)}</div>
            <div><u>Acheteur</u> : ${escapeHtml(order.buyer || 'Non renseigné')}</div>
            <div><u>Statut</u> : ${escapeHtml(order.status)}</div>
            ${order.inquiryCode ? `<div><u>Demande de prix</u> : ${escapeHtml(order.inquiryCode)}</div>` : ''}
            <div><u>Livraison prévue</u> : ${formatDate(order.expectedDate || order.orderDeadline)}</div>
          </div>
        </div>
        <div class="company">
          ${logo}
          <div class="company-name">${escapeHtml(companyName)}</div>
          <div class="company-details">${companyDetails.map(detail => `<div>${escapeHtml(detail)}</div>`).join('')}</div>
        </div>
      </header>

      <section class="supplier">
        <h2>FOURNISSEUR</h2>
        <p><strong>${escapeHtml(supplierName)}</strong></p>
        ${supplier?.contactPerson ? `<p>Contact : ${escapeHtml(supplier.contactPerson)}</p>` : ''}
        ${supplier?.phone ? `<p>Téléphone : ${escapeHtml(supplier.phone)}</p>` : ''}
        ${supplier?.email ? `<p>${escapeHtml(supplier.email)}</p>` : ''}
        ${supplier?.address ? `<p>${escapeHtml(supplier.address)}</p>` : ''}
      </section>

      <h2 class="section-title">LISTE DES PRODUITS COMMANDÉS</h2>
      <table class="items-table">
        <colgroup>
          <col style="width:4%"><col style="width:12%"><col style="width:20%"><col style="width:7%">
          <col style="width:7%"><col style="width:7%"><col style="width:16%"><col style="width:7%"><col style="width:20%">
        </colgroup>
        <thead><tr>
          <th>N°</th><th>CODE</th><th>DÉSIGNATION</th><th>UOA</th><th>QTA</th>
          <th>QTÉ</th><th>PRIX UNITAIRE</th><th>TVA</th><th>MONTANT TTC</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="9">Aucun article renseigné</td></tr>'}</tbody>
      </table>

      <table class="totals">
        <tbody>
          <tr><td>Total hors taxes</td><td>${escapeHtml(formatFCFA(totalHT))}</td></tr>
          <tr><td>TVA</td><td>${escapeHtml(formatFCFA(totalVAT))}</td></tr>
          <tr class="grand-total"><td>Total TTC</td><td>${escapeHtml(formatFCFA(totalTTC))}</td></tr>
        </tbody>
      </table>

      ${order.notes ? `<div class="notes"><strong>Remarques :</strong> ${escapeHtml(order.notes)}</div>` : ''}
      <div class="signatures">
        <div class="signature"><strong>Visa de l'acheteur</strong><span>Signature &amp; Cachet</span></div>
        <div class="signature"><strong>Accord du fournisseur</strong><span>Signature &amp; Cachet</span></div>
      </div>

      ${footerDetails.length ? `<footer class="footer">${footerDetails.map(detail => escapeHtml(detail)).join(' · ')}</footer>` : ''}
    </main>
  </body>
</html>`;
}
