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
  Layers,
  DollarSign,
  User,
  Percent,
  Printer,
  ReceiptText,
  Edit,
  Copy,
  CreditCard,
  MessageCircle
} from 'lucide-react';
import { PurchaseOrder, Supplier, PriceInquiry, CompanyConfig, Product } from '../../types';
import { formatFCFA } from '../../data/initialData';
import { purchaseOrderText, sendWhatsApp } from '../../utils/whatsapp';
import { purchaseLineQty } from '../../utils/purchaseCalc';
import { buildPurchaseOrderPrintHtml, resolvePurchaseOrderUoa } from '../../utils/purchaseOrderPrint';
import { withProfessionalPrintBranding } from '../../utils/professionalPrint';

interface BonCommandeDetailModalProps {
  po: PurchaseOrder;
  supplier?: Supplier;
  inquiry?: PriceInquiry;
  companyConfig?: CompanyConfig | null;
  products?: Product[];
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
  products = [],
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
    const htmlContent = withProfessionalPrintBranding(
      buildPurchaseOrderPrintHtml({ ...po, inquiryCode: po.inquiryCode || inquiry?.code }, supplier, companyConfig, products),
      companyConfig
    );

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
                {po.buyer || '—'}
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
                          {resolvePurchaseOrderUoa(item, products) ? (
                            <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                              {resolvePurchaseOrderUoa(item, products)}
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
