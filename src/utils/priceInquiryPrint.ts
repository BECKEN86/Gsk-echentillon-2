import { formatFCFA } from '../data/initialData';
import { CompanyConfig, PriceInquiry, Supplier } from '../types';
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

export function buildPriceInquiryPrintHtml(
  inquiry: PriceInquiry,
  supplier?: Supplier,
  companyConfig?: CompanyConfig | null
): string {
  const vatRate = inquiry.vatRate ?? 18;
  const totalHT = inquiry.totalHT ?? inquiry.items.reduce(
    (sum, item) => sum + purchaseLineQty(item) * item.estimatedPrice,
    0
  );
  const totalVAT = inquiry.totalVAT ?? inquiry.items.reduce((sum, item) => {
    const itemVat = item.vatRate ?? vatRate;
    const lineHT = purchaseLineQty(item) * item.estimatedPrice;
    return sum + (item.vatAmount ?? Math.round(lineHT * (itemVat / 100)));
  }, 0);
  const totalTTC = inquiry.totalTTC ?? totalHT + totalVAT;
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
  const supplierNames = Array.from(new Map(
    [
      ...inquiry.items.map(item => item.supplierName),
      inquiry.supplierName,
      supplier?.name
    ]
      .filter((name): name is string => typeof name === 'string' && name.trim().length > 0 && name.trim().toLocaleLowerCase() !== 'fournisseurs multiples')
      .map(name => [name.trim().toLocaleLowerCase(), name.trim()])
  ).values());
  const rows = inquiry.items.map((item, index) => {
    const itemVat = item.vatRate != null && String(item.vatRate) !== ''
      ? Number(item.vatRate)
      : vatRate;
    const itemTotal = item.totalAmount
      ?? purchaseLineQty(item) * item.estimatedPrice * (1 + itemVat / 100);

    return `
      <tr>
        <td class="center">${index + 1}</td>
        <td class="code">${escapeHtml(item.barcode || '—')}</td>
        <td class="designation"><strong>${escapeHtml(item.productName)}</strong></td>
        <td class="center">${escapeHtml(item.uoa || '—')}</td>
        <td class="center quantity">${escapeHtml(item.qta && item.qta > 0 ? item.qta : item.requestedQty)}</td>
        <td class="right">${escapeHtml(formatFCFA(item.estimatedPrice))}</td>
        <td class="center">${escapeHtml(itemVat)} %</td>
        <td class="right amount">${escapeHtml(formatFCFA(Math.round(itemTotal)))}</td>
      </tr>`;
  }).join('');
  const supplierList = supplierNames.length
    ? supplierNames.map(name => `<li>${escapeHtml(name)}</li>`).join('')
    : '<li>Fournisseur à préciser</li>';
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
    <title>Demande de prix N° ${escapeHtml(inquiry.code)}</title>
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
      .dvp-sheet {
        position: relative;
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        padding: 10mm 12mm 36mm;
        background: #fff;
        font-size: 11pt;
      }
      .header { display: flex; justify-content: space-between; align-items: flex-start; min-height: 73mm; }
      .document-heading { align-self: flex-end; min-width: 0; padding: 0 0 0 4mm; margin-top: 28mm; }
      .document-heading h1 { margin: 0; color: #001F3F; font-size: 17pt; }
      .header-meta { margin-top: 8mm; padding-left: 4mm; line-height: 2; }
      .header-meta u { text-underline-offset: 2px; }
      .deadline { color: #e00000; }
      .company { width: 78mm; text-align: left; }
      .company-logo { display: block; width: 44mm; height: 33mm; margin-left: auto; object-fit: contain; }
      .company-name { margin: 4mm 0 4mm 14mm; font-size: 13pt; font-weight: 700; text-align: center; }
      .company-details { font-size: 10.5pt; line-height: 2.1; }
      .company-details div { margin: 0; }
      .suppliers { width: 78mm; min-height: 38mm; margin: 6mm 0 0 auto; padding: 3mm; border: 1px solid #9a9a9a; }
      .suppliers h2 { margin: 0 0 3mm; color: #001F3F; font-size: 12pt; text-decoration: underline; }
      .supplier-list { margin: 0; padding: 0; list-style: none; }
      .supplier-list li { margin: 0 0 2.5mm; font-size: 10.5pt; }
      .supplier-list li::before { content: "- "; }
      .section-title { margin: 14mm 0 2mm 3mm; color: #001F3F; font-size: 10pt; text-decoration: underline; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      thead { display: table-header-group; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      .items-table { font-size: 10.5pt; }
      .items-table th { padding: 2mm 1mm; border: 1px solid #000; background: #001F3F; color: #fff; font-weight: 400; }
      .items-table td { padding: .6mm 1mm; border: 1px solid #000; text-align: center; overflow-wrap: anywhere; }
      .center { text-align: center; }
      .right { text-align: right; white-space: nowrap; }
      .code { font-family: Consolas, monospace; font-size: 8.5pt; }
      .totals { width: 78mm; margin: 6mm 0 0 auto; border-collapse: collapse; font-size: 10.5pt; }
      .totals td { padding: 2mm 1.5mm; border: 1px solid #000; }
      .totals td:last-child { text-align: right; white-space: nowrap; }
      .totals .grand-total td { background: #001F3F; color: #fff; font-weight: 700; }
      .notes { margin: 10mm 0 0 14mm; font-size: 9.5pt; }
      .signature { margin: 22mm 0 0 14mm; font-size: 12pt; font-style: italic; text-decoration: underline; break-inside: avoid; }
      .footer { position: absolute; right: 4mm; bottom: 8mm; left: 4mm; padding-top: 5mm; border-top: 1px solid #001F3F; font-size: 9.5pt; line-height: 1.6; text-align: center; }
      @media screen {
        body { background: #e2e8f0; }
        .dvp-sheet { margin: 10mm auto; box-shadow: 0 0 6px #0004; }
      }
      @media print {
        body { background: #fff; }
        .dvp-sheet { margin: 0; }
      }
    </style>
  </head>
  <body>
    <main class="dvp-sheet">
      <header class="header">
        <div class="document-heading">
          <h1>${escapeHtml(inquiry.code)}</h1>
          <div class="header-meta">
            <div><u>Émission</u> : ${formatDate(inquiry.date)}</div>
            <div><u>Échéance</u> : <span class="deadline">${formatDate(inquiry.orderDeadline)}</span></div>
            <div><u>Acheteur</u> : ${escapeHtml(inquiry.buyer || 'Non renseigné')}</div>
          </div>
        </div>
        <div class="company">
          ${logo}
          <div class="company-name">${escapeHtml(companyName)}</div>
          <div class="company-details">${companyDetails.map(detail => `<div>${escapeHtml(detail)}</div>`).join('')}</div>
        </div>
      </header>

      <section class="suppliers">
        <h2>FOURNISSEURS</h2>
        <ul class="supplier-list">${supplierList}</ul>
      </section>

      <h2 class="section-title">LISTE DES PRODUITS</h2>
      <table class="items-table">
        <colgroup>
          <col style="width:6%"><col style="width:16%"><col style="width:22%"><col style="width:8%">
          <col style="width:8%"><col style="width:17%"><col style="width:8%"><col style="width:15%">
        </colgroup>
        <thead><tr>
          <th>N°</th><th>CODE</th><th>DESIGNATION</th><th>UOA</th>
          <th>QTE</th><th>PRIX UNITAIRE</th><th>TVA</th><th>MONTANT TTC</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="8">Aucun article renseigné</td></tr>'}</tbody>
      </table>

      <table class="totals">
        <tbody>
          <tr><td>Total hors taxes</td><td>${escapeHtml(formatFCFA(totalHT))}</td></tr>
          <tr><td>TVA</td><td>${escapeHtml(formatFCFA(totalVAT))}</td></tr>
          <tr class="grand-total"><td>Total TTC</td><td>${escapeHtml(formatFCFA(totalTTC))}</td></tr>
        </tbody>
      </table>

      ${inquiry.notes ? `<div class="notes"><strong>Remarques :</strong> ${escapeHtml(inquiry.notes)}</div>` : ''}
      <div class="signature">Signature &amp; Cachet</div>

      ${footerDetails.length ? `<footer class="footer">${footerDetails.map(detail => escapeHtml(detail)).join(' · ')}</footer>` : ''}
    </main>
  </body>
</html>`;
}
