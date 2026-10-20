import React from 'react';
import { X, Printer, MessageCircle } from 'lucide-react';
import { SaleOrder, CompanyConfig } from '../../types';
import { formatFCFA } from '../../data/initialData';
import { saleReceiptText, sendWhatsApp } from '../../utils/whatsapp';

interface ReceiptModalProps {
  sale: SaleOrder;
  onClose: () => void;
  companyConfig?: CompanyConfig | null;
  clientPhone?: string;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, onClose, companyConfig, clientPhone }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-sm shadow-xl overflow-hidden text-slate-800 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-bold text-[#001F3F] flex items-center gap-2">
            <Printer className="w-4 h-4 text-blue-600" />
            Ticket de Caisse N° {sale.code}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Area */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs font-mono bg-slate-50 text-slate-900 border-b border-slate-200" id="printable-ticket">
          {/* Ticket Header */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-400">
            {companyConfig?.logo && (
              <img
                src={companyConfig.logo}
                alt="Logo"
                className="h-12 mx-auto object-contain mb-1"
              />
            )}
            <div className="text-base font-extrabold uppercase tracking-widest text-[#001F3F]">
              {companyConfig?.name || 'GeStock Commerce'}
            </div>
            {(companyConfig?.address || companyConfig?.phone) && (
              <div className="text-[10px] text-slate-500">
                {[companyConfig?.address, companyConfig?.phone && `Tel: ${companyConfig.phone}`]
                  .filter(Boolean)
                  .join(' • ')}
              </div>
            )}
            {!companyConfig && (
              <div className="text-[10px] text-slate-500">Abidjan, Cocody Marché • Tel: +225 07 00 11 22 33</div>
            )}
            {(companyConfig?.rccm || companyConfig?.ncc) && (
              <div className="text-[9px] text-slate-400">
                {[companyConfig?.rccm && `RCCM: ${companyConfig.rccm}`, companyConfig?.ncc && `NCC: ${companyConfig.ncc}`]
                  .filter(Boolean)
                  .join(' • ')}
              </div>
            )}
            <div className="text-[10px] text-slate-400 pt-1">Date: {sale.date}</div>
          </div>

          {/* Customer & Sale Info */}
          <div className="text-[11px] space-y-0.5 pb-2 border-b border-dashed border-slate-300">
            <div><strong>N° Ticket :</strong> {sale.code}</div>
            <div><strong>Client :</strong> {sale.clientName}</div>
            <div><strong>Vendeur :</strong> {sale.sellerName}</div>
            <div><strong>Paiement :</strong> {sale.paymentMethod}</div>
          </div>

          {/* Items Table */}
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-slate-400 uppercase font-bold text-slate-800">
                <th className="py-1">Article</th>
                <th className="py-1 text-center">Qté</th>
                <th className="py-1 text-right">P.U</th>
                <th className="py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sale.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-1 pr-1 font-semibold">{item.productName}</td>
                  <td className="py-1 text-center font-bold">{item.quantity}</td>
                  <td className="py-1 text-right">{formatFCFA(item.unitPrice)}</td>
                  <td className="py-1 text-right font-bold">{formatFCFA(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="pt-2 border-t border-dashed border-slate-400 space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Sous-total HT:</span>
              <span>{formatFCFA(sale.totalAmount)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-red-700">
                <span>Remise:</span>
                <span>-{formatFCFA(sale.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-sm text-[#001F3F] pt-1 border-t border-slate-400">
              <span>NET À PAYER:</span>
              <span>{formatFCFA(sale.finalAmount)}</span>
            </div>
          </div>

          <div className="text-center text-[10px] text-slate-500 pt-3 border-t border-dashed border-slate-300">
            *** Merci de votre confiance ! ***<br />
            Les marchandises vendues ne sont ni reprises ni échangées.
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-white flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold text-xs"
          >
            Fermer
          </button>
          <button
            onClick={() => sendWhatsApp(clientPhone, saleReceiptText(sale, companyConfig))}
            disabled={!clientPhone}
            title={clientPhone ? `Envoyer le reçu au ${clientPhone}` : 'Aucun numéro de téléphone client'}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <MessageCircle className="w-4 h-4" />
            <span>WhatsApp</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-lg bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer le Ticket</span>
          </button>
        </div>
      </div>
    </div>
  );
};
