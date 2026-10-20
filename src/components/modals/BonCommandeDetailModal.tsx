import React from 'react';
import {
  X,
  FileText,
  Building2,
  Phone,
  Mail,
  MapPin,
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
  ReceiptText,
  Edit,
  Copy,
  CreditCard,
  MessageCircle
} from 'lucide-react';
import { PurchaseOrder, Supplier, PriceInquiry, CompanyConfig } from '../../types';
import { formatFCFA } from '../../data/initialData';
import { purchaseOrderText, sendWhatsApp } from '../../utils/whatsapp';
import { purchaseLineQty } from '../../utils/purchaseCalc';

interface BonCommandeDetailModalProps {
  po: PurchaseOrder;
  supplier?: Supplier;
  inquiry?: PriceInquiry;
  companyConfig?: CompanyConfig | null;
  onClose: () => void;
  onValidatePO?: (po: PurchaseOrder) => void;
  onReceiveGoods?: (po: PurchaseOrder) => void;
  onEdit?: (po: PurchaseOrder) => void;
  onDuplicate?: (po: PurchaseOrder) => void;
}

export const BonCommandeDetailModal: React.FC<BonCommandeDetailModalProps> = ({
  po,
  supplier,
  inquiry,
  companyConfig,
  onClose,
  onValidatePO,
  onReceiveGoods,
  onEdit,
  onDuplicate
}) => {
  const totalItemsCount = po.items.reduce((sum, item) => sum + item.quantity, 0);

  // Totaux calculés — règle partagée : Qta > 0 → Qta × prix UOA, sinon Quantité × prix
  const totalHT = po.totalHT ?? po.items.reduce(
    (sum, item) => sum + purchaseLineQty(item) * item.unitPrice,
    0
  );
  const vatRate = po.vatRate ?? 18;
  const totalVAT = po.totalVAT ?? Math.round(totalHT * (vatRate / 100));
  const totalTTC = po.totalTTC ?? (po.totalAmount || (totalHT + totalVAT));

  // Impression / Export PDF du bon de commande via iframe cachée
  const handlePrintPOPDF = () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bon de Commande - ${po.code}</title>
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
            .badge-status {
              display: inline-block;
              padding: 3px 8px;
              border-radius: 4px;
              font-weight: bold;
              font-size: 10px;
              text-transform: uppercase;
              margin-left: 8px;
              ${po.status === 'Validé' ? 'background: #dcfce7; color: #166534;' : 'background: #fef3c7; color: #92400e;'}
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
            }
            .totals-row.final {
              background-color: #001F3F;
              color: #ffffff;
              font-weight: 800;
              border-bottom: none;
            }
            .notes-box {
              margin-top: 25px;
              padding: 12px;
              background-color: #fffbeb;
              border: 1px solid #fef3c7;
              border-radius: 8px;
              font-size: 11px;
              clear: both;
            }
            .signatures-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              margin-top: 50px;
              clear: both;
            }
            .sig-block {
              border-top: 1px dashed #94a3b8;
              padding-top: 8px;
              text-align: center;
              font-size: 11px;
              color: #64748b;
            }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td style="vertical-align: top;">
                <div class="title">BON DE COMMANDE GROSSISTE</div>
                <div class="subtitle">GeStock - Plateforme de Gestion de Stock & Achats</div>
              </td>
              <td style="text-align: right; vertical-align: top;">
                <span class="badge">${po.code}</span>
                <span class="badge-status">${po.status}</span>
                <div style="font-size: 10px; color: #64748b; margin-top: 6px;">
                  Émis le : <strong>${po.date}</strong>
                </div>
                ${(po.inquiryCode || inquiry?.code) ? `
                  <div style="font-size: 10px; color: #2563eb; margin-top: 3px;">
                    Devis source : <strong>${po.inquiryCode || inquiry?.code}</strong>
                  </div>
                ` : ''}
              </td>
            </tr>
          </table>

          <div class="info-grid">
            <div class="info-card">
              <h4>Émetteur / Acheteur</h4>
              <div class="info-row">
                <span class="info-label">Société :</span>
                <span class="info-val">GeStock Distribution SARL</span>
              </div>
              <div class="info-row">
                <span class="info-label">Acheteur Responsable :</span>
                <span class="info-val">${po.buyer || 'Kouassi Marc'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Échéance de livraison :</span>
                <span class="info-val">${po.expectedDate || po.orderDeadline || 'Dès que possible'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Statut Paiement :</span>
                <span class="info-val">${po.paymentStatus || 'Non payé'}</span>
              </div>
            </div>

            <div class="info-card">
              <h4>Fournisseur Grossiste</h4>
              <div class="info-row">
                <span class="info-label">Fournisseur :</span>
                <span class="info-val">${supplier ? supplier.name : po.supplierName}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Contact / Représentant :</span>
                <span class="info-val">${supplier?.contactPerson || 'Direction Commerciale'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Téléphone :</span>
                <span class="info-val">${supplier?.phone || 'Non renseigné'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Adresse :</span>
                <span class="info-val">${supplier?.address || 'Non renseignée'}</span>
              </div>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 25px;">#</th>
                <th>Code barre</th>
                <th>Désignation Article</th>
                <th class="text-center">UOA</th>
                <th class="text-center">Qta</th>
                <th class="text-center">Quantité</th>
                <th class="text-right">Prix Unitaire</th>
                <th class="text-center">TVA</th>
                <th class="text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              ${po.items.map((item, idx) => {
                const lineHT = purchaseLineQty(item) * item.unitPrice;
                const vRate = item.vatRate !== undefined ? item.vatRate : vatRate;
                const lineTTC = item.total || Math.round(lineHT * (1 + vRate / 100));
                return `
                  <tr>
                    <td>${idx + 1}</td>
                    <td style="font-family: monospace; font-size: 10px;">${item.barcode || '-'}</td>
                    <td><strong>${item.productName}</strong></td>
                    <td class="text-center">${item.uoa || '-'}</td>
                    <td class="text-center font-bold">${item.qta || '-'}</td>
                    <td class="text-center font-bold">${item.quantity}</td>
                    <td class="text-right">${item.unitPrice.toLocaleString('fr-FR')} FCFA</td>
                    <td class="text-center">${vRate}%</td>
                    <td class="text-right font-bold">${lineTTC.toLocaleString('fr-FR')} FCFA</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="totals-container">
            <div class="totals-row">
              <span class="info-label">Total HT :</span>
              <span class="info-val">${totalHT.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div class="totals-row">
              <span class="info-label">Taux TVA (%) :</span>
              <span class="info-val">${totalVAT.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div class="totals-row final">
              <span>Total TTC :</span>
              <span>${totalTTC.toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>

          ${po.notes ? `
            <div class="notes-box">
              <strong>Instructions & Remarques :</strong><br/>
              ${po.notes}
            </div>
          ` : ''}

          <div class="signatures-grid">
            <div class="sig-block">
              <strong>Visa Acheteur / Direction GeStock</strong><br/>
              <span style="font-size: 10px; color: #94a3b8;">Signature & Date</span>
            </div>
            <div class="sig-block">
              <strong>Bon pour Accord Fournisseur</strong><br/>
              <span style="font-size: 10px; color: #94a3b8;">Signature & Cachet commercial</span>
            </div>
          </div>
        </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error("Erreur lors de l'impression :", e);
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 1000);
        }
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-6xl xl:max-w-7xl overflow-hidden animate-in fade-in zoom-in-95 my-4">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 bg-[#001F3F] text-white border-b border-blue-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 rounded-xl border border-blue-400/30 text-white">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Fiche Bon de Commande</h2>
                <span className="font-mono font-bold text-xs bg-white/20 text-white px-2 py-0.5 rounded-md">
                  {po.code}
                </span>
                {(po.inquiryCode || inquiry?.code) && (
                  <span className="text-xs bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded-md border border-blue-400/30">
                    Devis lié: {po.inquiryCode || inquiry?.code}
                  </span>
                )}
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                Créé le {po.date} • {supplier?.name || po.supplierName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Badge */}
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
              po.status === 'Validé'
                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                : 'bg-amber-500/20 text-amber-200 border-amber-400/40'
            }`}>
              {po.status === 'Validé' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-amber-300" />
              )}
              <span>{po.status}</span>
            </span>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[82vh] overflow-y-auto text-xs">
          
          {/* Top Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" /> Acheteur
              </span>
              <p className="text-xs font-bold text-slate-800 mt-1 truncate">
                {po.buyer || 'Kouassi Marc'}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" /> Date
              </span>
              <p className="text-xs font-bold text-slate-800 mt-1">
                {po.date}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-500" /> Échéance
              </span>
              <p className="text-xs font-bold text-amber-900 mt-1 truncate">
                {po.expectedDate || po.orderDeadline || 'Dès que possible'}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-blue-500" /> Total HT
              </span>
              <p className="text-xs font-black text-blue-900 mt-1 truncate">
                {formatFCFA(totalHT)}
              </p>
            </div>

            <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-purple-600 flex items-center gap-1">
                <Percent className="w-3 h-3 text-purple-600" /> Taux TVA (%) :
              </span>
              <p className="text-xs font-black text-purple-900 mt-1 truncate">
                {formatFCFA(totalVAT)}
              </p>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Total TTC
              </span>
              <p className="text-xs font-black text-emerald-900 mt-1 truncate">
                {formatFCFA(totalTTC)}
              </p>
            </div>
          </div>

          {/* Supplier Details Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{supplier?.name || po.supplierName}</h3>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <span>Contact: {supplier?.contactPerson || 'Direction Commerciale'}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
              {supplier?.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {supplier.phone}
                </span>
              )}
              {supplier?.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {supplier.email}
                </span>
              )}
              {supplier?.address && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {supplier.address}
                </span>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-600" />
                Articles commandés ({po.items.length} lignes • {totalItemsCount} unités)
              </h4>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                    <th className="py-2.5 px-3">Fournisseur</th>
                    <th className="py-2.5 px-3">Code barre</th>
                    <th className="py-2.5 px-3">Désignation</th>
                    <th className="py-2.5 px-2.5 text-center">UOA</th>
                    <th className="py-2.5 px-2 text-center">Qta</th>
                    <th className="py-2.5 px-3 text-center">Quantité</th>
                    <th className="py-2.5 px-3 text-right">Prix Unitaire</th>
                    <th className="py-2.5 px-2.5 text-center">TVA (%)</th>
                    <th className="py-2.5 px-3 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {po.items.map((item, idx) => {
                    const lineHT = purchaseLineQty(item) * item.unitPrice;
                    const vRate = item.vatRate !== undefined ? item.vatRate : vatRate;
                    const lineTTC = item.total || Math.round(lineHT * (1 + vRate / 100));

                    return (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-medium text-slate-600">
                          {item.supplierName || po.supplierName}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                          {item.barcode || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[#001F3F]">
                          {item.productName}
                        </td>
                        <td className="py-2.5 px-2.5 text-center font-semibold text-slate-700">
                          {item.uoa ? (
                            <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                              {item.uoa}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center font-black text-blue-900">
                          {item.qta ?? 1}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium">
                          {formatFCFA(item.unitPrice)}
                        </td>
                        <td className="py-2.5 px-2.5 text-center font-medium text-slate-600">
                          {vRate}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900">
                          {formatFCFA(lineTTC)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold border-t border-slate-200">
                    <td colSpan={7} className="py-2.5 px-3"></td>
                    <td className="py-2.5 px-3 text-right uppercase text-[10px] text-slate-500 whitespace-nowrap">
                      Total HT :
                    </td>
                    <td className="py-2.5 px-3 text-right text-sm font-black text-blue-900 whitespace-nowrap">
                      {formatFCFA(totalHT)}
                    </td>
                  </tr>
                  <tr className="bg-slate-50 font-bold border-t border-slate-100">
                    <td colSpan={7} className="py-2 px-3"></td>
                    <td className="py-2 px-3 text-right uppercase text-[10px] text-slate-500 whitespace-nowrap">
                      Taux TVA (%) :
                    </td>
                    <td className="py-2 px-3 text-right text-sm font-black text-purple-900 whitespace-nowrap">
                      {formatFCFA(totalVAT)}
                    </td>
                  </tr>
                  <tr className="bg-slate-50 font-bold border-t border-slate-200">
                    <td colSpan={7} className="py-2.5 px-3"></td>
                    <td className="py-2.5 px-3 text-right uppercase text-[10px] text-slate-600 whitespace-nowrap">
                      Total TTC :
                    </td>
                    <td className="py-2.5 px-3 text-right text-base font-black text-emerald-900 whitespace-nowrap">
                      {formatFCFA(totalTTC)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Fiche de Règlement des Fournisseurs si validé */}
          {po.settlements && po.settlements.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-[#001F3F] text-xs uppercase tracking-wider flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  Règlement & Modalités de Paiement Fournisseurs
                </h4>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                  po.paymentStatus === 'Payé'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : po.paymentStatus === 'Non payé'
                    ? 'bg-rose-100 text-rose-800 border-rose-200'
                    : 'bg-amber-100 text-amber-800 border-amber-200'
                }`}>
                  Statut : {po.paymentStatus || 'Non payé'}
                </span>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                      <th className="py-2.5 px-3">Fournisseur</th>
                      <th className="py-2.5 px-3 text-right">Montant Concerné</th>
                      <th className="py-2.5 px-3 text-center">Règlement</th>
                      <th className="py-2.5 px-3 text-right">Payé (Cash)</th>
                      <th className="py-2.5 px-3 text-right">Solde à Crédit (Dette)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {po.settlements.map((st, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{st.supplierName}</td>
                        <td className="py-2.5 px-3 text-right font-black text-[#001F3F]">{formatFCFA(st.amount)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            st.paymentMode === 'Cash'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : st.paymentMode === 'Crédit'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {st.paymentMode}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700">{formatFCFA(st.paidAmount)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-rose-700">
                          {st.creditAmount > 0 ? (
                            <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200">
                              {formatFCFA(st.creditAmount)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">Soldé</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notes */}
          {po.notes && (
            <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-900">
              <p className="font-bold text-[11px] uppercase tracking-wide text-amber-800 mb-0.5">Remarques & Consignes</p>
              <p className="text-xs text-amber-950 font-medium leading-relaxed">{po.notes}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            Réf Bon : <span className="font-mono font-bold text-slate-700">{po.code}</span>
            {po.inquiryCode && (
              <span className="ml-2 font-mono text-blue-600">({po.inquiryCode})</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintPOPDF}
              className="px-4 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-4 h-4 text-purple-600" />
              <span>Imprimer en PDF</span>
            </button>

            <button
              type="button"
              onClick={() => sendWhatsApp(supplier?.phone, purchaseOrderText(po, companyConfig))}
              disabled={!supplier?.phone}
              title={supplier?.phone ? `Envoyer le bon de commande au ${supplier.phone}` : 'Aucun numéro de téléphone fournisseur'}
              className="px-4 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-xs transition-colors"
            >
              Fermer
            </button>

            {/* Si En cours : Possibilité de modifier le bon de commande */}
            {po.status === 'En cours' && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(po);
                }}
                className="px-4 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Edit className="w-4 h-4" />
                <span>Modifier le Bon</span>
              </button>
            )}

            {/* Si Validé : Possibilité de dupliquer le bon de commande validé */}
            {po.status === 'Validé' && onDuplicate && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDuplicate(po);
                }}
                className="px-4 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Copy className="w-4 h-4" />
                <span>Dupliquer ce Bon</span>
              </button>
            )}

            {/* Si En cours : bouton pour Valider le Bon de Commande */}
            {po.status === 'En cours' && onValidatePO && (
              <button
                type="button"
                onClick={() => {
                  onValidatePO(po);
                  onClose();
                }}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Valider le Bon de Commande</span>
              </button>
            )}

            {/* Si Validé : bouton Réceptionner */}
            {po.status === 'Validé' && onReceiveGoods && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onReceiveGoods(po);
                }}
                className="px-4 py-2 rounded-lg bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              >
                <ReceiptText className="w-4 h-4" />
                <span>Réceptionner la commande</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
