import React from 'react';
import {
  X,
  FileText,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  Package,
  Layers,
  DollarSign,
  User,
  Barcode,
  Percent,
  Printer,
  Edit,
  Copy
} from 'lucide-react';
import { PriceInquiry, Supplier } from '../../types';
import { formatFCFA } from '../../data/initialData';
import { purchaseLineQty } from '../../utils/purchaseCalc';

interface DemandePrixDetailModalProps {
  inquiry: PriceInquiry;
  supplier?: Supplier;
  onClose: () => void;
  onConvertToPurchaseOrder: (inquiry: PriceInquiry) => void;
  onEdit?: (inquiry: PriceInquiry) => void;
  onDuplicate?: (inquiry: PriceInquiry) => void;
}

export const DemandePrixDetailModal: React.FC<DemandePrixDetailModalProps> = ({
  inquiry,
  supplier,
  onClose,
  onConvertToPurchaseOrder,
  onEdit,
  onDuplicate
}) => {
  const totalItemsCount = inquiry.items.reduce((sum, item) => sum + item.requestedQty, 0);

  // Totals calculations — règle partagée : Qta > 0 → Qta × prix UOA, sinon Quantité × prix
  const totalHT = inquiry.totalHT ?? inquiry.items.reduce(
    (sum, item) => sum + purchaseLineQty(item) * item.estimatedPrice,
    0
  );
  const vatRate = inquiry.vatRate ?? 18;
  const totalVAT = inquiry.totalVAT ?? Math.round(totalHT * (vatRate / 100));
  const totalTTC = inquiry.totalTTC ?? (totalHT + totalVAT);

  // Impression / Export PDF de la fiche de demande de prix
  const handlePrintInquiryPDF = () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Demande de Prix - ${inquiry.code}</title>
          <meta charset="utf-8" />
          <style>
            @page { size: A4; margin: 15mm; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 20px;
              font-size: 12px;
              line-height: 1.4;
            }
            .header-table {
              width: 100%;
              margin-bottom: 25px;
              border-bottom: 2px solid #001F3F;
              padding-bottom: 15px;
            }
            .title {
              font-size: 20px;
              font-weight: 800;
              color: #001F3F;
              margin: 0 0 4px 0;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .subtitle {
              font-size: 11px;
              color: #64748b;
              margin: 0;
            }
            .badge {
              display: inline-block;
              background: #f1f5f9;
              padding: 4px 10px;
              border-radius: 6px;
              font-weight: bold;
              color: #001F3F;
              font-size: 11px;
              font-family: monospace;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 25px;
            }
            .info-card {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 12px 15px;
            }
            .info-card h4 {
              margin: 0 0 8px 0;
              font-size: 11px;
              text-transform: uppercase;
              color: #475569;
              letter-spacing: 0.5px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 4px;
            }
            .info-row {
              margin: 4px 0;
              display: flex;
              justify-content: space-between;
            }
            .info-label {
              color: #64748b;
              font-weight: 500;
            }
            .info-val {
              color: #0f172a;
              font-weight: 700;
            }
            table.items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            table.items-table th {
              background-color: #001F3F;
              color: #ffffff;
              font-weight: 700;
              text-align: left;
              padding: 8px 10px;
              font-size: 11px;
              text-transform: uppercase;
            }
            table.items-table td {
              border-bottom: 1px solid #e2e8f0;
              padding: 8px 10px;
              font-size: 11px;
            }
            table.items-table tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .totals-container {
              float: right;
              width: 280px;
              margin-top: 10px;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              overflow: hidden;
            }
            .totals-row {
              display: flex;
              justify-content: space-between;
              padding: 7px 12px;
              border-bottom: 1px solid #e2e8f0;
              font-size: 11px;
            }
            .totals-row.grand-total {
              background-color: #001F3F;
              color: #ffffff;
              font-weight: 800;
              font-size: 13px;
              border-bottom: none;
            }
            .footer-note {
              margin-top: 50px;
              padding-top: 15px;
              border-top: 1px dashed #cbd5e1;
              color: #64748b;
              font-size: 10px;
              text-align: center;
              clear: both;
            }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td>
                <h1 class="title">Demande de Prix</h1>
                <p class="subtitle">Document de consultation tarifaire et cotation fournisseur</p>
              </td>
              <td style="text-align: right;">
                <span class="badge">Réf : ${inquiry.code}</span>
                <div style="margin-top: 5px; color: #475569; font-size: 11px;">
                  Date d'émission : <strong>${inquiry.date}</strong>
                </div>
                <div style="margin-top: 3px; color: #dc2626; font-weight: bold; font-size: 11px;">
                  Échéance : ${inquiry.orderDeadline || 'À convenir'}
                </div>
              </td>
            </tr>
          </table>

          <div class="info-grid">
            <div class="info-card">
              <h4>Demandeur (Acheteur)</h4>
              <div class="info-row">
                <span class="info-label">Acheteur responsable :</span>
                <span class="info-val">${inquiry.buyer || 'Non spécifié'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Référence consultation :</span>
                <span class="info-val">${inquiry.code}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Date limite de réponse :</span>
                <span class="info-val">${inquiry.orderDeadline || 'Non définie'}</span>
              </div>
            </div>

            <div class="info-card">
              <h4>Destinataire (Fournisseur)</h4>
              <div class="info-row">
                <span class="info-label">Fournisseur :</span>
                <span class="info-val">${inquiry.supplierName || supplier?.name || 'Fournisseur de consultation'}</span>
              </div>
              ${supplier?.contactPerson ? `
              <div class="info-row">
                <span class="info-label">Contact :</span>
                <span class="info-val">${supplier.contactPerson}</span>
              </div>` : ''}
              ${supplier?.phone ? `
              <div class="info-row">
                <span class="info-label">Téléphone :</span>
                <span class="info-val">${supplier.phone}</span>
              </div>` : ''}
              ${supplier?.email ? `
              <div class="info-row">
                <span class="info-label">Email :</span>
                <span class="info-val">${supplier.email}</span>
              </div>` : ''}
              ${supplier?.address ? `
              <div class="info-row">
                <span class="info-label">Adresse :</span>
                <span class="info-val">${supplier.address}</span>
              </div>` : ''}
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 15%;">Fournisseur</th>
                <th style="width: 15%;">Code barre</th>
                <th style="width: 32%;">Désignation</th>
                <th class="text-center" style="width: 10%;">UOA</th>
                <th class="text-center" style="width: 8%;">Quantité</th>
                <th class="text-right" style="width: 10%;">Prix Unit.</th>
                <th class="text-center" style="width: 5%;">TVA</th>
                <th class="text-right" style="width: 15%;">Montant</th>
              </tr>
            </thead>
            <tbody>
              ${inquiry.items.map(it => {
                const suppName = it.supplierName || inquiry.supplierName || '—';
                const itemVat = it.vatRate != null && String(it.vatRate) !== '' ? Number(it.vatRate) : vatRate;
                const itemTotal = it.totalAmount ?? purchaseLineQty(it) * it.estimatedPrice * (1 + itemVat / 100);
                return `
                  <tr>
                    <td>${suppName}</td>
                    <td style="font-family: monospace;">${it.barcode || '—'}</td>
                    <td><strong>${it.productName}</strong></td>
                    <td class="text-center">${it.uoa || '—'}</td>
                    <td class="text-center"><strong>${it.requestedQty}</strong></td>
                    <td class="text-right">${it.estimatedPrice.toLocaleString('fr-FR')} F CFA</td>
                    <td class="text-center">${itemVat}%</td>
                    <td class="text-right"><strong>${Math.round(itemTotal).toLocaleString('fr-FR')} F CFA</strong></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="totals-container">
            <div class="totals-row">
              <span>Total HT :</span>
              <strong>${totalHT.toLocaleString('fr-FR')} F CFA</strong>
            </div>
            <div class="totals-row">
              <span>Taux TVA (%) / Taxes :</span>
              <strong>${totalVAT.toLocaleString('fr-FR')} F CFA</strong>
            </div>
            <div class="totals-row grand-total">
              <span>Total TTC :</span>
              <span>${totalTTC.toLocaleString('fr-FR')} F CFA</span>
            </div>
          </div>

          <div class="footer-note">
            Merci de nous transmettre votre meilleure offre tarifaire et conditions de livraison avant la date limite indiquée.<br />
            Document généré automatiquement via la plateforme de gestion des achats.
          </div>
        </body>
      </html>
    `;

    const printIframe = document.createElement('iframe');
    printIframe.setAttribute('style', 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;');
    document.body.appendChild(printIframe);
    const printDoc = printIframe.contentWindow?.document;
    if (printDoc) {
      printDoc.open();
      printDoc.write(htmlContent);
      printDoc.close();
      setTimeout(() => {
        try {
          printIframe.contentWindow?.focus();
          printIframe.contentWindow?.print();
        } catch {
          window.print();
        }
        setTimeout(() => {
          if (document.body.contains(printIframe)) {
            document.body.removeChild(printIframe);
          }
        }, 1500);
      }, 350);
    }
  };

  const getStatusBadge = (status: PriceInquiry['status']) => {
    switch (status) {
      case 'Validé':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Validé
          </span>
        );
      case 'En cours':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
            <Clock className="w-3.5 h-3.5" />
            En cours
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-6xl xl:max-w-7xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-6">
        
        {/* Header */}
        <div className="p-5 bg-linear-to-r from-slate-900 via-blue-950 to-[#001F3F] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
              <FileText className="w-6 h-6 text-purple-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold font-mono tracking-tight text-white">{inquiry.code}</span>
                {getStatusBadge(inquiry.status)}
              </div>
              <p className="text-xs text-blue-200 mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Date : {inquiry.date}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-300" /> Échéance : {inquiry.orderDeadline || 'Non définie'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-blue-300" /> Acheteur : {inquiry.buyer || 'Non assigné'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
          
          {/* Champs de la fiche : Date, Échéance, Total HT, Taux TVA, Total TTC */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1 mb-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Date
              </span>
              <p className="text-sm font-bold text-slate-900">{inquiry.date}</p>
            </div>

            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-amber-700 tracking-wider flex items-center gap-1 mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" /> Échéance
              </span>
              <p className="text-sm font-bold text-amber-950">{inquiry.orderDeadline || '-'}</p>
            </div>

            <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-blue-700 tracking-wider flex items-center gap-1 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-blue-600" /> Total HT
              </span>
              <p className="text-sm font-black text-blue-950">{formatFCFA(totalHT)}</p>
            </div>

            {/* Taux TVA (%) : la somme du montant des taxes */}
            <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-purple-700 tracking-wider flex items-center gap-1 mb-1">
                <Percent className="w-3.5 h-3.5 text-purple-600" /> Taux TVA (%) :
              </span>
              <p className="text-sm font-black text-purple-950">{formatFCFA(totalVAT)}</p>
              <span className="text-[10px] text-purple-600 font-medium">Somme des taxes ({vatRate}%)</span>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider flex items-center gap-1 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Total TTC
              </span>
              <p className="text-base font-black text-emerald-900">{formatFCFA(totalTTC)}</p>
            </div>
          </div>

          {/* Tableau de saisie / lignes de consultation */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="font-bold text-[#001F3F] text-xs uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-purple-600" />
                Lignes d'articles consultés ({inquiry.items.length})
              </h4>
              <span className="text-xs text-slate-500 font-medium">
                Volume cumulé : <strong className="text-slate-800">{totalItemsCount} unités</strong>
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                    <th className="py-2.5 px-3">Fournisseur</th>
                    <th className="py-2.5 px-3">Code barre</th>
                    <th className="py-2.5 px-3">Désignation</th>
                    <th className="py-2.5 px-2.5 text-center">UOA</th>
                    <th className="py-2.5 px-2.5 text-center">Qta</th>
                    <th className="py-2.5 px-3 text-center">Quantité</th>
                    <th className="py-2.5 px-3 text-right">Prix unitaire</th>
                    <th className="py-2.5 px-3 text-center">TVA</th>
                    <th className="py-2.5 px-3 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {inquiry.items.map((item, idx) => {
                    const itemSupplier = item.supplierName || inquiry.supplierName;
                    const itemBarcode = item.barcode || '—';
                    const itemVat = item.vatRate ?? vatRate;
                    const itemTotal = item.totalAmount ?? (purchaseLineQty(item) * item.estimatedPrice * (1 + itemVat / 100));

                    return (
                      <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                        {/* Fournisseur */}
                        <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {itemSupplier}
                          </span>
                        </td>

                        {/* Code barre */}
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            <Barcode className="w-3.5 h-3.5 text-slate-400" />
                            {itemBarcode}
                          </span>
                        </td>

                        {/* Désignation */}
                        <td className="py-3 px-3 font-bold text-[#001F3F]">
                          {item.productName}
                        </td>

                        {/* UOA */}
                        <td className="py-3 px-2.5 text-center text-slate-600 font-medium">
                          {item.uoa ? (
                            <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200">
                              {item.uoa}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Qta */}
                        <td className="py-3 px-2.5 text-center text-blue-900 font-bold">
                          {item.qta !== undefined ? (
                            <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-200">
                              {item.qta}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Quantité */}
                        <td className="py-3 px-3 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-800 font-bold border border-blue-200">
                            {item.requestedQty}
                          </span>
                        </td>

                        {/* Prix unitaire */}
                        <td className="py-3 px-3 text-right font-medium text-slate-600">
                          {formatFCFA(item.estimatedPrice)}
                        </td>

                        {/* TVA */}
                        <td className="py-3 px-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            {itemVat}%
                          </span>
                        </td>

                        {/* Montant */}
                        <td className="py-3 px-3 text-right font-bold text-slate-900">
                          {formatFCFA(Math.round(itemTotal))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold border-t-2 border-slate-200 text-slate-800">
                    <td colSpan={8} className="py-3 px-3 text-right text-xs text-slate-600 uppercase font-bold">
                      Total TTC :
                    </td>
                    <td className="py-3 px-3 text-right text-base text-emerald-900 font-extrabold">
                      {formatFCFA(totalTTC)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes */}
          {inquiry.notes && (
            <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-900">
              <p className="font-bold text-[11px] uppercase tracking-wide text-amber-800 mb-0.5">Remarques & Consignes</p>
              <p className="text-xs text-amber-950 font-medium leading-relaxed">{inquiry.notes}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            Réf: <span className="font-mono font-bold text-slate-700">{inquiry.code}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintInquiryPDF}
              className="px-4 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-4 h-4 text-purple-600" />
              <span>Imprimer en PDF</span>
            </button>


            {/* Si En cours : Possibilité de modifier la demande de prix */}
            {inquiry.status === 'En cours' && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(inquiry);
                }}
                className="px-4 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Edit className="w-4 h-4" />
                <span>Modifier la Demande</span>
              </button>
            )}

            {/* Si Validé : Possibilité de dupliquer la demande de prix validée */}
            {inquiry.status === 'Validé' && onDuplicate && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDuplicate(inquiry);
                }}
                className="px-4 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Copy className="w-4 h-4" />
                <span>Dupliquer cette Demande</span>
              </button>
            )}

            {inquiry.status === 'Validé' ? (
              <span className="px-3.5 py-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Devis Validé (Bon de commande généré)</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onConvertToPurchaseOrder(inquiry);
                }}
                className="px-4 py-2 rounded-lg bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all active:scale-95"
              >
                <span>Convertir en Bon de Commande</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
