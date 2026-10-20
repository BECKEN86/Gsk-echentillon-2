import React from 'react';
import { X, Printer, MessageCircle } from 'lucide-react';
import { SaleOrder, CompanyConfig } from '../../types';
import { saleReceiptText, sendWhatsApp } from '../../utils/whatsapp';

interface InvoiceModalProps {
  sale: SaleOrder;
  companyConfig?: CompanyConfig | null;
  clientPhone?: string;
  onClose: () => void;
}

const fmt = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

/**
 * Facture A4 imprimable — en-tête société (logo, RCCM, NCC), tableau
 * d'articles, totaux, zone signatures. window.print() avec @media print.
 */
export const InvoiceModal: React.FC<InvoiceModalProps> = ({ sale, companyConfig, clientPhone, onClose }) => {
  const cc = companyConfig;
  const isCancelled = sale.status === 'Annulé';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #invoice-print-area, #invoice-print-area * { visibility: visible; }
          #invoice-print-area {
            position: absolute; inset: 0; margin: 0; padding: 12mm;
            width: 100%; max-height: none; overflow: visible;
            box-shadow: none; border: none; border-radius: 0;
          }
          .invoice-actions { display: none !important; }
        }
      `}</style>

      <div className="bg-slate-200 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl">
        {/* Barre d'actions (non imprimée) */}
        <div className="invoice-actions flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-bold text-slate-700">
            Facture {sale.code} {isCancelled && '— ANNULÉE'}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => sendWhatsApp(clientPhone, saleReceiptText(sale, companyConfig))}
              disabled={!clientPhone}
              title={clientPhone ? `Envoyer au ${clientPhone}` : 'Aucun numéro de téléphone client'}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimer / PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Feuille A4 */}
        <div className="overflow-y-auto p-4">
          <div
            id="invoice-print-area"
            className="bg-white mx-auto shadow-lg rounded-sm p-10 text-slate-800"
            style={{ width: '210mm', minHeight: '280mm', maxWidth: '100%' }}
          >
            {/* Filigrane annulation */}
            {isCancelled && (
              <div className="text-center py-2 mb-4 border-2 border-dashed border-rose-400 rounded text-rose-600 font-black tracking-widest text-sm">
                FACTURE ANNULÉE — DOCUMENT NON VALIDE
              </div>
            )}

            {/* En-tête */}
            <div className="flex justify-between items-start pb-6 border-b-2 border-slate-800">
              <div className="flex items-start gap-4">
                {cc?.logo && (
                  <img src={cc.logo} alt="Logo" className="w-16 h-16 object-contain rounded" />
                )}
                <div>
                  <h1 className="text-xl font-black tracking-tight">{cc?.name || 'GeStock'}</h1>
                  {cc?.address && <p className="text-xs text-slate-600 mt-0.5">{cc.address}</p>}
                  {cc?.phone && <p className="text-xs text-slate-600">Tél : {cc.phone}</p>}
                  {cc?.email && <p className="text-xs text-slate-600">{cc.email}</p>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black tracking-tight">FACTURE</div>
                <div className="font-mono text-sm font-bold mt-1">{sale.code}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {new Date(sale.date).toLocaleDateString('fr-FR', { dateStyle: 'long' })}
                </div>
              </div>
            </div>

            {/* Références légales */}
            {(cc?.rccm || cc?.ncc) && (
              <div className="flex gap-6 text-[11px] text-slate-600 py-2 border-b border-slate-200">
                {cc?.rccm && <span>RCCM : {cc.rccm}</span>}
                {cc?.ncc && <span>NCC : {cc.ncc}</span>}
              </div>
            )}

            {/* Client */}
            <div className="py-5 flex justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                  Facturé à
                </div>
                <div className="font-bold text-sm">{sale.clientName || 'Client comptant'}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                  Règlement
                </div>
                <div className="font-bold text-sm">{sale.paymentMethod}</div>
                {sale.sellerName && (
                  <div className="text-xs text-slate-500">Vendeur : {sale.sellerName}</div>
                )}
              </div>
            </div>

            {/* Articles */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-800 text-left">
                  <th className="py-2 text-[11px] font-bold uppercase tracking-wider">Désignation</th>
                  <th className="py-2 text-[11px] font-bold uppercase tracking-wider text-center w-20">Qté</th>
                  <th className="py-2 text-[11px] font-bold uppercase tracking-wider text-right w-32">P.U.</th>
                  <th className="py-2 text-[11px] font-bold uppercase tracking-wider text-right w-32">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sale.items.map((it, i) => (
                  <tr key={i}>
                    <td className="py-2.5">{it.productName}</td>
                    <td className="py-2.5 text-center">{it.quantity}</td>
                    <td className="py-2.5 text-right font-mono text-xs">{fmt(it.unitPrice)}</td>
                    <td className="py-2.5 text-right font-mono text-xs font-semibold">
                      {fmt(it.total ?? it.unitPrice * it.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totaux */}
            <div className="flex justify-end mt-6">
              <table className="text-sm w-64">
                <tbody>
                  <tr>
                    <td className="py-1.5 text-slate-600">Sous-total</td>
                    <td className="py-1.5 text-right font-mono">{fmt(sale.totalAmount)}</td>
                  </tr>
                  {(sale.discount ?? 0) > 0 && (
                    <tr>
                      <td className="py-1.5 text-slate-600">Remise</td>
                      <td className="py-1.5 text-right font-mono text-rose-600">
                        - {fmt(sale.discount)}
                      </td>
                    </tr>
                  )}
                  {(sale.tax ?? 0) > 0 && (
                    <tr>
                      <td className="py-1.5 text-slate-600">Taxes</td>
                      <td className="py-1.5 text-right font-mono">{fmt(sale.tax)}</td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-slate-800">
                    <td className="py-2 font-black uppercase text-xs tracking-wider">Net à payer</td>
                    <td className="py-2 text-right font-mono font-black text-base">
                      {fmt(sale.finalAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Signatures */}
            <div className="flex justify-end mt-16 pt-4 text-xs text-slate-500">
              <div className="w-48 border-t border-slate-300 pt-2 text-center">
                Signature {cc?.name || 'de l\'entreprise'}
              </div>
            </div>

            <p className="text-center text-[10px] text-slate-400 mt-10">
              Document généré par GeStock — {new Date().toLocaleString('fr-FR')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
