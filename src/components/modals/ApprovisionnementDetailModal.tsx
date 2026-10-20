import React from 'react';
import {
  X,
  PackagePlus,
  Calendar,
  User,
  ReceiptText,
  Building2,
  MapPin,
  CheckCircle2,
  Printer,
  Layers,
  Barcode,
  Package,
  Clock,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import { ApprovisionnementRecord, CompanyConfig } from '../../types';
import { formatFCFA } from '../../data/initialData';

interface ApprovisionnementDetailModalProps {
  appro: ApprovisionnementRecord;
  companyConfig?: CompanyConfig | null;
  onClose: () => void;
  onDeleteApprovisionnement?: (id: string) => void;
}

export const ApprovisionnementDetailModal: React.FC<ApprovisionnementDetailModalProps> = ({
  appro,
  companyConfig,
  onClose,
  onDeleteApprovisionnement
}) => {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    const companyName = companyConfig?.name || 'GESTOCK DISTRIBUTION';
    const companyAddress = companyConfig?.address || 'Abidjan, Côte d\'Ivoire';
    const companyPhone = companyConfig?.phone || '+225 07 00 00 00 00';
    const companyEmail = companyConfig?.email || 'contact@gestock.ci';
    const rccm = companyConfig?.rccm ? `RCCM: ${companyConfig.rccm}` : '';
    const ncc = companyConfig?.ncc ? `NCC: ${companyConfig.ncc}` : '';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bon d'Approvisionnement - ${appro.reference}</title>
          <meta charset="utf-8" />
          <style>
            @page { size: A4; margin: 15mm; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 24px;
              font-size: 12px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #001F3F;
              padding-bottom: 16px;
              margin-bottom: 20px;
            }
            .company h1 {
              font-size: 20px;
              font-weight: 800;
              color: #001F3F;
              margin: 0 0 4px 0;
            }
            .company p {
              margin: 2px 0;
              color: #475569;
              font-size: 11px;
            }
            .doc-info {
              text-align: right;
            }
            .doc-title {
              font-size: 18px;
              font-weight: 800;
              color: #001F3F;
              text-transform: uppercase;
              margin: 0 0 6px 0;
            }
            .doc-ref {
              display: inline-block;
              background: #f1f5f9;
              padding: 4px 10px;
              border-radius: 4px;
              font-family: monospace;
              font-size: 13px;
              font-weight: bold;
              color: #001F3F;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 12px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 12px 16px;
              margin-bottom: 20px;
            }
            .meta-item {
              font-size: 11px;
            }
            .meta-label {
              color: #64748b;
              font-weight: 600;
              text-transform: uppercase;
              font-size: 10px;
            }
            .meta-value {
              font-weight: 700;
              color: #0f172a;
              margin-top: 2px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th {
              background: #001F3F;
              color: #ffffff;
              padding: 8px 10px;
              text-align: left;
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            td {
              padding: 8px 10px;
              border-bottom: 1px solid #e2e8f0;
              font-size: 11px;
            }
            tr:nth-child(even) { background: #f8fafc; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .totals {
              display: flex;
              justify-content: flex-end;
              margin-bottom: 30px;
            }
            .totals-table {
              width: 280px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
            }
            .totals-table td {
              padding: 6px 10px;
              border: none;
            }
            .totals-table .total-row {
              border-top: 2px solid #001F3F;
              font-size: 13px;
              font-weight: 800;
              color: #001F3F;
            }
            .signatures {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 40px;
              margin-top: 40px;
              padding-top: 10px;
            }
            .sign-box {
              border-top: 1px dashed #94a3b8;
              padding-top: 8px;
              text-align: center;
              font-size: 11px;
              color: #475569;
            }
            .notes {
              background: #fffbeb;
              border: 1px solid #fef3c7;
              border-radius: 6px;
              padding: 10px;
              margin-bottom: 20px;
              font-size: 11px;
              color: #92400e;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company">
              <h1>${companyName}</h1>
              <p>${companyAddress}</p>
              <p>Tél : ${companyPhone} | Email : ${companyEmail}</p>
              <p>${rccm} ${ncc}</p>
            </div>
            <div class="doc-info">
              <div class="doc-title">Bon d'Approvisionnement</div>
              <div class="doc-ref">${appro.reference}</div>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <div class="meta-label">Date & Heure</div>
              <div class="meta-value">${appro.date}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Opérateur / Magasinier</div>
              <div class="meta-value">${appro.operator}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Bordereau Réception Associé</div>
              <div class="meta-value">${appro.receptionNumber} ${appro.supplierName ? `(${appro.supplierName})` : ''}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Destination (Mise en Stock)</div>
              <div class="meta-value">${appro.destinationType} : ${appro.targetLocation}</div>
            </div>
          </div>

          ${appro.notes ? `
            <div class="notes">
              <strong>Observations :</strong> ${appro.notes}
            </div>
          ` : ''}

          <table>
            <thead>
              <tr>
                <th style="width: 50px;">N°</th>
                <th>Code</th>
                <th>Désignation Produit</th>
                <th class="text-center">Quantité Mise en Stock</th>
                <th>Emplacement / Rayon</th>
                <th>Péremption</th>
                <th class="text-right">Prix Unitaire</th>
                <th class="text-right">Total HT</th>
              </tr>
            </thead>
            <tbody>
              ${appro.items.map((it, idx) => `
                <tr>
                  <td class="text-center">${idx + 1}</td>
                  <td style="font-family: monospace;">${it.productCode || '-'}</td>
                  <td><strong>${it.productName}</strong></td>
                  <td class="text-center" style="font-weight: bold; color: #047857;">
                    ${it.quantity} ${it.unit ? it.unit + '(s)' : ''}
                  </td>
                  <td>${it.targetLocation || appro.targetLocation}</td>
                  <td>${it.expirationDate || 'N/A'}</td>
                  <td class="text-right">${formatFCFA(it.unitPrice || 0)}</td>
                  <td class="text-right" style="font-weight: bold;">
                    ${formatFCFA((it.quantity || 0) * (it.unitPrice || 0))}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            <table class="totals-table">
              <tr>
                <td>Total lignes :</td>
                <td class="text-right"><strong>${appro.items.length}</strong></td>
              </tr>
              <tr>
                <td>Total unités approvisionnées :</td>
                <td class="text-right"><strong>${appro.totalQuantity}</strong></td>
              </tr>
              <tr class="total-row">
                <td>Valeur Totale :</td>
                <td class="text-right">${formatFCFA(appro.totalValue)}</td>
              </tr>
            </table>
          </div>

          <div class="signatures">
            <div class="sign-box">
              <strong>L'Opérateur / Magasinier</strong><br /><br /><br />
              ${appro.operator}
            </div>
            <div class="sign-box">
              <strong>Le Responsable Stock / Point de Vente</strong><br /><br /><br />
              Signature & Cachet
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden my-4">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-[#001F3F] to-blue-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-blue-200">
              <PackagePlus className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-wide">Fiche d'Approvisionnement</h2>
                <span className="font-mono px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold">
                  {appro.reference}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  {appro.status}
                </span>
              </div>
              <p className="text-xs text-blue-200/80 mt-0.5">
                Mise en stock effectuée suite à la réception {appro.receptionNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-blue-600" /> Date & Heure
              </span>
              <p className="font-bold text-[#001F3F] text-xs mt-1">{appro.date}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <User className="w-3 h-3 text-blue-600" /> Opérateur
              </span>
              <p className="font-bold text-[#001F3F] text-xs mt-1">{appro.operator}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <ReceiptText className="w-3 h-3 text-emerald-600" /> Réception n°
              </span>
              <p className="font-bold text-emerald-700 font-mono text-xs mt-1">
                {appro.receptionNumber}
              </p>
              {appro.supplierName && (
                <p className="text-[10px] text-slate-500 truncate">{appro.supplierName}</p>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-amber-600" /> Destination
              </span>
              <p className="font-bold text-amber-800 text-xs mt-1 flex items-center gap-1">
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 border border-amber-200">
                  {appro.destinationType}
                </span>
                <span className="truncate">{appro.targetLocation}</span>
              </p>
            </div>
          </div>

          {/* Observations */}
          {appro.notes && (
            <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900">
              <p className="font-bold text-[10px] uppercase tracking-wider text-amber-800 mb-0.5">Observations</p>
              <p className="text-xs">{appro.notes}</p>
            </div>
          )}

          {/* Lignes d'approvisionnement (produits concernés) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-sm text-[#001F3F]">
                  Lignes d'approvisionnement ({appro.items.length} produit{appro.items.length > 1 ? 's' : ''})
                </h3>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Total : {appro.totalQuantity} unités mises en stock
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-500 border-b border-slate-200 uppercase font-semibold text-[10px]">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Produit</th>
                    <th className="py-2.5 px-3 text-center">Quantité Entrée</th>
                    <th className="py-2.5 px-3">Emplacement</th>
                    <th className="py-2.5 px-3">Péremption</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {appro.items.map((it, idx) => (
                    <tr key={`${it.productId}_${idx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 text-xs">{it.productName}</div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          {it.productCode && <span className="font-mono">{it.productCode}</span>}
                          {it.barcode && (
                            <span className="font-mono flex items-center gap-1">
                              <Barcode className="w-2.5 h-2.5" /> {it.barcode}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-black text-xs">
                          +{it.quantity} {it.unit ? it.unit : ''}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-medium">
                        {it.targetLocation || appro.targetLocation}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {it.expirationDate ? (
                          <span className="font-mono">{it.expirationDate}</span>
                        ) : (
                          <span className="text-slate-400 italic">Non spécifiée</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              Référence : <strong className="font-mono text-slate-700">{appro.reference}</strong>
            </span>
            {onDeleteApprovisionnement && (
              <button
                type="button"
                onClick={() => onDeleteApprovisionnement(appro.id)}
                className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Supprimer cet approvisionnement"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Supprimer</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-lg bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer Bon d'Approvisionnement</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-xs transition-colors cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
