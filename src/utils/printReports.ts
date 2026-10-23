import { CompanyConfig, CustomerReturn, PointDeVente, SaleOrder, SupplierReturn } from '../types';
import { formatFCFA } from '../data/initialData';
import { withProfessionalPrintBranding } from './professionalPrint';

/** Imprime un document HTML dans un iframe invisible (même mécanique que les états existants). */
function printHtml(htmlContent: string) {
  const printFrame = document.createElement('iframe');
  printFrame.style.position = 'fixed';
  printFrame.style.right = '0';
  printFrame.style.bottom = '0';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = '0';
  document.body.appendChild(printFrame);
  const doc = printFrame.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(htmlContent);
  doc.close();
  printFrame.contentWindow?.focus();
  setTimeout(() => {
    printFrame.contentWindow?.print();
    setTimeout(() => document.body.removeChild(printFrame), 1000);
  }, 250);
}

const esc = (s?: string) =>
  (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const TICKET_CSS = `
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: "Courier New", monospace; color: #111; margin: 0; font-size: 11px; width: 72mm; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .line { border-top: 1px dashed #444; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; font-size: 10.5px; }
  .r { text-align: right; }
  .big { font-size: 14px; font-weight: bold; }
`;

const companyHeader = (config?: CompanyConfig | null) => `
  <div class="center">
    <div class="big">${esc(config?.name || 'GESTOCK')}</div>
    ${config?.address ? `<div>${esc(config.address)}</div>` : ''}
    ${config?.phone ? `<div>Tél : ${esc(config.phone)}</div>` : ''}
    ${config?.rccm ? `<div>RCCM : ${esc(config.rccm)}</div>` : ''}
  </div>
  <div class="line"></div>`;

/**
 * Z de caisse — état de clôture de session :
 * ventes par mode de règlement, espèces attendues vs comptées, écart,
 * signatures caissier / contrôleur.
 */
export function printSessionZ(pv: PointDeVente, sales: SaleOrder[], config?: CompanyConfig | null) {
  const done = sales.filter(s => s.status !== 'Annulé' && s.status !== 'En cours');
  const cancelled = sales.filter(s => s.status === 'Annulé');
  const byMethod = (m: string) =>
    done.filter(s => s.paymentMethod === m).reduce((s, o) => s + (o.finalAmount || o.totalAmount), 0);
  const countByMethod = (m: string) => done.filter(s => s.paymentMethod === m).length;

  const cash = byMethod('Espèces');
  const expected = pv.openingAmount + cash;
  const diff = pv.closingAmount !== undefined ? pv.closingAmount - expected : undefined;

  const rows: [string, number, number][] = [
    ['Espèces', cash, countByMethod('Espèces')],
    ['Mobile Money', byMethod('Mobile Money'), countByMethod('Mobile Money')],
    ['Carte', byMethod('Carte'), countByMethod('Carte')],
    ['Crédit', byMethod('Crédit'), countByMethod('Crédit')]
  ];
  const total = done.reduce((s, o) => s + (o.finalAmount || o.totalAmount), 0);

  printHtml(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Z de caisse ${esc(pv.code)}</title><style>${TICKET_CSS}</style></head><body>
    ${companyHeader(config)}
    <div class="center bold">Z DE CAISSE — ${esc(pv.code)}</div>
    <div class="center">${esc(pv.date)}</div>
    <div class="line"></div>
    <table>
      <tr><td>Ouverture</td><td class="r">${esc(pv.openedAt)}</td></tr>
      <tr><td>Fermeture</td><td class="r">${esc(pv.closedAt || '—')}</td></tr>
      <tr><td>Caissier</td><td class="r">${esc(pv.operator)}</td></tr>
      <tr><td>Fond de caisse</td><td class="r bold">${formatFCFA(pv.openingAmount)}</td></tr>
    </table>
    <div class="line"></div>
    <div class="bold">VENTES PAR RÈGLEMENT</div>
    <table>
      ${rows.map(([label, amt, n]) => `
        <tr><td>${label} (${n})</td><td class="r">${formatFCFA(amt)}</td></tr>`).join('')}
      <tr><td class="bold">TOTAL (${done.length})</td><td class="r bold">${formatFCFA(total)}</td></tr>
      ${cancelled.length ? `<tr><td>Annulées (${cancelled.length})</td><td class="r">—</td></tr>` : ''}
    </table>
    <div class="line"></div>
    <div class="bold">CONTRÔLE DES ESPÈCES</div>
    <table>
      <tr><td>Théorique (fond + espèces)</td><td class="r">${formatFCFA(expected)}</td></tr>
      <tr><td>Compté</td><td class="r">${pv.closingAmount !== undefined ? formatFCFA(pv.closingAmount) : '—'}</td></tr>
      <tr><td class="bold">Écart</td><td class="r bold">${diff !== undefined ? `${diff > 0 ? '+' : ''}${formatFCFA(diff)}` : '—'}</td></tr>
    </table>
    ${pv.notes ? `<div class="line"></div><div>Notes : ${esc(pv.notes)}</div>` : ''}
    <div class="line"></div>
    <table>
      <tr><td>Caissier</td><td class="r">Contrôleur</td></tr>
      <tr><td colspan="2" style="height:28px"></td></tr>
      <tr><td>_______________</td><td class="r">_______________</td></tr>
    </table>
    <div class="line"></div>
    <div class="center">Édité le ${new Date().toLocaleString('fr-FR')}</div>
  </body></html>`);
}

/** Bon de retour client — ticket 80 mm. */
export function printCustomerReturn(ret: CustomerReturn, config?: CompanyConfig | null) {
  printHtml(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Retour ${esc(ret.code)}</title><style>${TICKET_CSS}</style></head><body>
    ${companyHeader(config)}
    <div class="center bold">RETOUR CLIENT — ${esc(ret.code)}</div>
    <div class="center">${esc(ret.date)} — ${esc(ret.status)}</div>
    <div class="line"></div>
    <table>
      <tr><td>Vente</td><td class="r">${esc(ret.saleCode)}</td></tr>
      <tr><td>Client</td><td class="r">${esc(ret.clientName || 'Comptoir')}</td></tr>
      <tr><td>Opérateur</td><td class="r">${esc(ret.operator)}</td></tr>
    </table>
    <div class="line"></div>
    <table>
      ${ret.items.map(i => `
        <tr><td>${esc(i.productName)}<br/><span style="color:#555">${i.returnedQty} × ${formatFCFA(i.unitPrice)}${i.restock ? '' : ' — non réintégré'}</span></td>
        <td class="r bold">${formatFCFA(i.returnedQty * i.unitPrice)}</td></tr>`).join('')}
    </table>
    <div class="line"></div>
    <table>
      <tr><td class="bold">TOTAL RETOUR</td><td class="r bold">${formatFCFA(ret.totalAmount)}</td></tr>
      ${ret.creditDeduction ? `<tr><td>Déduit du crédit</td><td class="r">${formatFCFA(ret.creditDeduction)}</td></tr>` : ''}
      ${ret.avoirNumber ? `<tr><td>Avoir ${esc(ret.avoirNumber)}</td><td class="r">${formatFCFA(ret.avoirAmount || 0)}</td></tr>` : ''}
    </table>
    ${ret.notes ? `<div class="line"></div><div>Notes : ${esc(ret.notes)}</div>` : ''}
    <div class="line"></div>
    <table><tr><td>Client</td><td class="r">Magasinier</td></tr><tr><td colspan="2" style="height:28px"></td></tr><tr><td>___________</td><td class="r">___________</td></tr></table>
  </body></html>`);
}

/** Bon de retour fournisseur — ticket 80 mm. */
export function printSupplierReturn(ret: SupplierReturn, config?: CompanyConfig | null) {
  printHtml(withProfessionalPrintBranding(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Retour ${esc(ret.code)}</title><style>${TICKET_CSS}</style></head><body>
    ${companyHeader(config)}
    <div class="center bold">RETOUR FOURNISSEUR — ${esc(ret.code)}</div>
    <div class="center">${esc(ret.date)} — ${esc(ret.status)}</div>
    <div class="line"></div>
    <table>
      <tr><td>Fournisseur</td><td class="r">${esc(ret.supplierName)}</td></tr>
      ${ret.sourceRef ? `<tr><td>Document source</td><td class="r">${esc(ret.sourceRef)}</td></tr>` : ''}
      <tr><td>Opérateur</td><td class="r">${esc(ret.operator)}</td></tr>
    </table>
    <div class="line"></div>
    <table>
      ${ret.items.map(i => `
        <tr><td>${esc(i.productName)}<br/><span style="color:#555">${i.returnedQty} × ${formatFCFA(i.unitPrice)}</span></td>
        <td class="r bold">${formatFCFA(i.returnedQty * i.unitPrice)}</td></tr>`).join('')}
    </table>
    <div class="line"></div>
    <table>
      <tr><td class="bold">TOTAL RETOUR</td><td class="r bold">${formatFCFA(ret.totalAmount)}</td></tr>
      ${ret.debtDeduction ? `<tr><td>Déduit de la dette</td><td class="r">${formatFCFA(ret.debtDeduction)}</td></tr>` : ''}
      ${ret.avoirNumber ? `<tr><td>Avoir ${esc(ret.avoirNumber)}</td><td class="r">${formatFCFA(ret.avoirAmount || 0)}</td></tr>` : ''}
    </table>
    ${ret.notes ? `<div class="line"></div><div>Notes : ${esc(ret.notes)}</div>` : ''}
    <div class="line"></div>
    <table><tr><td>Magasinier</td><td class="r">Fournisseur</td></tr><tr><td colspan="2" style="height:28px"></td></tr><tr><td>___________</td><td class="r">___________</td></tr></table>
  </body></html>`, config, 'receipt'));
}
