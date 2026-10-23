import React from 'react';
import {
  X,
  ReceiptText,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  Ban,
  ShieldCheck,
  Layers,
  DollarSign,
  User,
  Percent,
  Printer,
  AlertTriangle,
  Hourglass
} from 'lucide-react';
import { GoodsReception, Supplier, PurchaseOrder } from '../../types';
import { formatFCFA } from '../../data/initialData';
import { CompanyConfig } from '../../types';
import { withProfessionalPrintBranding } from '../../utils/professionalPrint';

interface ReceptionDetailModalProps {
  reception: GoodsReception;
  supplier?: Supplier;
  purchaseOrder?: PurchaseOrder;
  companyConfig?: CompanyConfig | null;
  onClose: () => void;
  onValidateReception?: (receptionId: string) => void;
  /** true si la réception n'est pas encore utilisée par un approvisionnement */
  canCancelReception?: boolean;
  onCancelReception?: (receptionId: string) => void;
}

export const ReceptionDetailModal: React.FC<ReceptionDetailModalProps> = ({
  reception,
  supplier,
  purchaseOrder,
  companyConfig,
  onClose,
  onValidateReception,
  canCancelReception = false,
  onCancelReception
}) => {
  const totalOrderedCount = reception.items.reduce((sum, item) => sum + (item.orderedQty || 0), 0);
  const totalReceivedCount = reception.items.reduce((sum, item) => sum + (item.receivedQty || 0), 0);
  const totalAcceptedCount = reception.items.reduce((sum, item) => sum + (item.acceptedQty || 0), 0);

  // Totaux calculés
  const totalHT = reception.totalHT ?? reception.items.reduce(
    (sum, item) => sum + (item.acceptedQty || 0) * (item.unitPrice || 0),
    0
  );
  const vatRate = reception.vatRate ?? (purchaseOrder?.vatRate ?? 18);
  const totalVAT = reception.totalVAT ?? Math.round(totalHT * (vatRate / 100));
  const totalTTC = reception.totalTTC ?? (reception.totalAmount || (totalHT + totalVAT));

  // Impression / Export PDF du bordereau de réception via iframe cachée
  const handlePrintReceptionPDF = () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bordereau de Réception - ${reception.code}</title>
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
              border-bottom: 2px solid #0f766e;
              padding-bottom: 15px;
            }
            .title {
              font-size: 20px;
              font-weight: 800;
              color: #0f766e;
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
              color: #0f766e;
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
              ${reception.status === 'Validé' ? 'background: #dcfce7; color: #166534;' : 'background: #fef3c7; color: #92400e;'}
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
              background-color: #0f766e;
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
              background-color: #0f766e;
              color: #ffffff;
              font-weight: 800;
              border-bottom: none;
            }
            .notes-box {
              margin-top: 25px;
              padding: 12px;
              background-color: #f0fdf4;
              border: 1px solid #bbf7d0;
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
                <div class="title">BORDEREAU DE RÉCEPTION DE MARCHANDISES</div>
                <div class="subtitle">GeStock - Contrôle de conformité et entrée en stock</div>
              </td>
              <td style="text-align: right; vertical-align: top;">
                <span class="badge">${reception.code}</span>
                <span class="badge-status">${reception.status}</span>
                <div style="font-size: 10px; color: #64748b; margin-top: 6px;">
                  Date de réception : <strong>${reception.date}</strong>
                </div>
                ${reception.purchaseOrderCode ? `
                  <div style="font-size: 10px; color: #2563eb; margin-top: 3px;">
                    Bon de Commande : <strong>${reception.purchaseOrderCode}</strong>
                  </div>
                ` : ''}
              </td>
            </tr>
          </table>

          <div class="info-grid">
            <div class="info-card">
              <h4>Magasin & Réceptionnaire</h4>
              <div class="info-row">
                <span class="info-label">Société :</span>
                <span class="info-val">GeStock Distribution SARL</span>
              </div>
              <div class="info-row">
                <span class="info-label">Réceptionnaire / Magasinier :</span>
                <span class="info-val">${reception.receiverName || '—'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Bon de commande lié :</span>
                <span class="info-val">${reception.purchaseOrderCode || 'Direct'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Unités acceptées en stock :</span>
                <span class="info-val">${totalAcceptedCount} unité(s)</span>
              </div>
            </div>

            <div class="info-card">
              <h4>Fournisseur</h4>
              <div class="info-row">
                <span class="info-label">Fournisseur :</span>
                <span class="info-val">${supplier ? supplier.name : reception.supplierName}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Contact :</span>
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
                <th class="text-center">Commandé</th>
                <th class="text-center">Reçu</th>
                <th class="text-center">Accepté</th>
                <th class="text-center">Date d'expiration</th>
              </tr>
            </thead>
            <tbody>
              ${reception.items.map((item, idx) => {
                return `
                  <tr>
                    <td>${idx + 1}</td>
                    <td style="font-family: monospace; font-size: 10px;">${item.barcode || '-'}</td>
                    <td><strong>${item.productName}</strong></td>
                    <td class="text-center">${item.orderedQty}</td>
                    <td class="text-center font-bold">${item.receivedQty}</td>
                    <td class="text-center font-bold" style="color: #0f766e;">${item.acceptedQty}</td>
                    <td class="text-center" style="font-family: monospace; font-weight: bold; color: #b45309;">
                      ${item.expirationDate || '-'}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="totals-container">
            <div class="totals-row">
              <span class="info-label">Total articles :</span>
              <span class="info-val">${reception.items.length} article(s)</span>
            </div>
            <div class="totals-row">
              <span class="info-label">Total unités commandées :</span>
              <span class="info-val">${totalOrderedCount}</span>
            </div>
            <div class="totals-row">
              <span class="info-label">Total unités reçues :</span>
              <span class="info-val">${totalReceivedCount}</span>
            </div>
            <div class="totals-row final">
              <span>Unités Entrées en Stock :</span>
              <span>${totalAcceptedCount} unité(s)</span>
            </div>
          </div>

          ${reception.notes ? `
            <div class="notes-box">
              <strong>Observations de livraison & Conformité :</strong><br/>
              ${reception.notes}
            </div>
          ` : ''}

          <div class="signatures-grid">
            <div class="sig-block">
              <strong>Visa Magasinier / Contrôleur</strong><br/>
              <span style="font-size: 10px; color: #94a3b8;">Signature & Date</span>
            </div>
            <div class="sig-block">
              <strong>Chauffeur / Livreur</strong><br/>
              <span style="font-size: 10px; color: #94a3b8;">Signature & Heure</span>
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
      doc.write(withProfessionalPrintBranding(htmlContent, companyConfig));
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
            <div className="p-2.5 bg-teal-500/30 rounded-xl border border-teal-400/30 text-teal-300">
              <ReceiptText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Fiche Bon de Réception</h2>
                <span className="font-mono font-bold text-xs bg-white/20 text-white px-2 py-0.5 rounded-md">
                  {reception.code}
                </span>
                {reception.purchaseOrderCode && (
                  <span className="text-xs bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded-md border border-blue-400/30">
                    Commande source: {reception.purchaseOrderCode}
                  </span>
                )}
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                Reçu le {reception.date} • {supplier?.name || reception.supplierName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Badge */}
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
              reception.status === 'Validé'
                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                : reception.status === 'Annulé'
                  ? 'bg-rose-500/20 text-rose-200 border-rose-400/40'
                  : 'bg-amber-500/20 text-amber-200 border-amber-400/40'
            }`}>
              {reception.status === 'Validé' ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              ) : reception.status === 'Annulé' ? (
                <Ban className="w-3.5 h-3.5 text-rose-300" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-amber-300" />
              )}
              <span>{reception.status}</span>
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

          {/* Bannière Alerte Expiration dans le détail */}
          {(() => {
            let expiredCount = 0;
            let expiringSoonCount = 0;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            reception.items.forEach(it => {
              if (it.expirationDate) {
                const expDate = new Date(it.expirationDate);
                expDate.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays < 0) expiredCount++;
                else if (diffDays <= 30) expiringSoonCount++;
              }
            });

            if (expiredCount === 0 && expiringSoonCount === 0) return null;

            return (
              <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                expiredCount > 0 ? 'bg-rose-50 border-rose-300 text-rose-950' : 'bg-amber-50 border-amber-300 text-amber-950'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg text-white ${expiredCount > 0 ? 'bg-rose-600 animate-pulse' : 'bg-amber-600'}`}>
                    {expiredCount > 0 ? <AlertTriangle className="w-5 h-5" /> : <Hourglass className="w-5 h-5" />}
                  </div>
                  <div>
                    <h5 className="font-bold text-sm">
                      {expiredCount > 0
                        ? `Alerte DLC : ${expiredCount} article(s) périmé(s) dans cette réception !`
                        : `Vigilance DLC : ${expiringSoonCount} article(s) à date de péremption imminente (≤ 30 jours)`}
                    </h5>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Vérifiez les dates d'expiration enregistrées avant d'autoriser la vente ou le stockage libre en magasin.
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
          
          {/* Top Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" /> Réceptionnaire
              </span>
              <p className="text-xs font-bold text-slate-800 mt-1 truncate">
                {reception.receiverName || '—'}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" /> Date
              </span>
              <p className="text-xs font-bold text-slate-800 mt-1">
                {reception.date}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <ReceiptText className="w-3 h-3 text-blue-500" /> Bon Commande
              </span>
              <p className="text-xs font-bold text-blue-800 mt-1 truncate font-mono">
                {reception.purchaseOrderCode || 'Direct'}
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
                <ShieldCheck className="w-3 h-3 text-emerald-600" /> Total Validé
              </span>
              <p className="text-xs font-black text-emerald-900 mt-1 truncate">
                {formatFCFA(totalTTC)}
              </p>
            </div>
          </div>

          {/* Supplier Details Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{supplier?.name || reception.supplierName}</h3>
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
                <Layers className="w-4 h-4 text-teal-600" />
                Articles contrôlés ({reception.items.length} lignes • {totalAcceptedCount} acceptés / {totalOrderedCount} commandés)
              </h4>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                    <th className="py-2.5 px-3">Code barre</th>
                    <th className="py-2.5 px-3">Désignation</th>
                    <th className="py-2.5 px-3 text-center">Qté Commandée</th>
                    <th className="py-2.5 px-3 text-center">Qté Reçue</th>
                    <th className="py-2.5 px-3 text-center text-teal-700">Qté Acceptée</th>
                    <th className="py-2.5 px-3 text-center">Date d'expiration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {reception.items.map((item, idx) => {
                    return (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                          {item.barcode || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[#001F3F]">
                          {item.productName}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-500 font-medium">
                          {item.orderedQty}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                          {item.receivedQty}
                        </td>
                        <td className="py-2.5 px-3 text-center font-black text-teal-700 bg-teal-50/40">
                          {item.acceptedQty}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {item.expirationDate ? (() => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const expDate = new Date(item.expirationDate);
                            expDate.setHours(0, 0, 0, 0);
                            const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                            if (diffDays < 0) {
                              return (
                                <div className="inline-flex flex-col items-center gap-0.5">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-black">
                                    <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                    Périmé ({Math.abs(diffDays)} j)
                                  </span>
                                  <span className="font-mono text-[10px] text-rose-700">{item.expirationDate}</span>
                                </div>
                              );
                            } else if (diffDays <= 30) {
                              return (
                                <div className="inline-flex flex-col items-center gap-0.5">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                                    <Hourglass className="w-3 h-3 text-amber-600 shrink-0" />
                                    {diffDays === 0 ? "Aujourd'hui" : `Dans ${diffDays} j`}
                                  </span>
                                  <span className="font-mono text-[10px] text-amber-800">{item.expirationDate}</span>
                                </div>
                              );
                            } else {
                              return (
                                <div className="inline-flex flex-col items-center gap-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-medium">
                                    <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                                    Valide ({diffDays} j)
                                  </span>
                                  <span className="font-mono text-[10px] text-slate-500">{item.expirationDate}</span>
                                </div>
                              );
                            }
                          })() : (
                            <span className="text-slate-400 font-medium">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold border-t border-slate-200 text-slate-700">
                    <td colSpan={2} className="py-2.5 px-3">
                      Total : <span className="text-[#001F3F] font-bold">{reception.items.length} article(s)</span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-500 font-bold">
                      {totalOrderedCount}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-700 font-bold">
                      {totalReceivedCount}
                    </td>
                    <td className="py-2.5 px-3 text-center text-teal-800 font-black text-sm bg-teal-50">
                      {totalAcceptedCount}
                    </td>
                    <td className="py-2.5 px-3 text-center text-xs text-slate-500">
                      Unités acceptées en stock
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes */}
          {reception.notes && (
            <div className="p-3.5 bg-teal-50/80 border border-teal-200 rounded-xl text-teal-900">
              <p className="font-bold text-[11px] uppercase tracking-wide text-teal-800 mb-0.5">Observations & Conformité</p>
              <p className="text-xs text-teal-950 font-medium leading-relaxed">{reception.notes}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            Réf Réception : <span className="font-mono font-bold text-slate-700">{reception.code}</span>
            {reception.purchaseOrderCode && (
              <span className="ml-2 font-mono text-blue-600">({reception.purchaseOrderCode})</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintReceptionPDF}
              className="px-4 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-4 h-4 text-purple-600" />
              <span>Imprimer en PDF</span>
            </button>

            {/* Annulation possible tant que la réception n'est pas utilisée par un approvisionnement */}
            {reception.status !== 'Annulé' && canCancelReception && onCancelReception && (
              <button
                type="button"
                onClick={() => {
                  onCancelReception(reception.id);
                  onClose();
                }}
                title="Annuler cette réception"
                className="px-4 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Ban className="w-4 h-4 text-rose-600" />
                <span>Annuler la réception</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-xs transition-colors"
            >
              Fermer
            </button>

            {/* Si En cours ou En attente : bouton pour Valider et entrer en stock */}
            {reception.status !== 'Validé' && reception.status !== 'Annulé' && onValidateReception && (
              <button
                type="button"
                onClick={() => {
                  onValidateReception(reception.id);
                  onClose();
                }}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Valider le stock (Entrée)</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
