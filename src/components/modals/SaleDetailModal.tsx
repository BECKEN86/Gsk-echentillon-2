import React from 'react';
import {
  X,
  ShoppingBag,
  User,
  CreditCard,
  Printer,
  FileText,
  Ban,
  Trash2,
  Package,
  Layers,
  Clock
} from 'lucide-react';
import { SaleOrder } from '../../types';
import { formatFCFA } from '../../data/initialData';

interface SaleDetailModalProps {
  sale: SaleOrder;
  onClose: () => void;
  onOpenReceipt?: (sale: SaleOrder) => void;
  onOpenInvoice?: (sale: SaleOrder) => void;
  onCancelSale?: (sale: SaleOrder) => void;
  onDeleteSale?: (sale: SaleOrder) => void;
}

export const SaleDetailModal: React.FC<SaleDetailModalProps> = ({
  sale,
  onClose,
  onOpenReceipt,
  onOpenInvoice,
  onCancelSale,
  onDeleteSale
}) => {
  const totalQuantity = sale.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#001F3F]">
                  Détail de la Vente <span className="font-mono text-blue-600">{sale.code}</span>
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    sale.status === 'Annulé'
                      ? 'bg-rose-100 text-rose-800 border-rose-200'
                      : sale.status === 'En attente'
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : sale.status === 'En cours'
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  }`}
                >
                  {sale.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Enregistrée le {sale.date}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Key Info Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 font-semibold mb-1">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Client</span>
              </div>
              <div className="font-bold text-[#001F3F] text-sm truncate">{sale.clientName}</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 font-semibold mb-1">
                <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                <span>Règlement</span>
              </div>
              <div className="font-bold text-slate-800 text-sm">{sale.paymentMethod}</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 font-semibold mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Vendeur / Caisse</span>
              </div>
              <div className="font-bold text-slate-800 truncate">
                {sale.sellerName || 'Caisse'} {sale.pointDeVenteCode ? `(${sale.pointDeVenteCode})` : ''}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
              <div className="flex items-center gap-1.5 text-emerald-700 font-semibold mb-1">
                <Package className="w-3.5 h-3.5" />
                <span>Total Net Payé</span>
              </div>
              <div className="font-extrabold text-emerald-800 text-sm">
                {formatFCFA(sale.finalAmount)}
              </div>
            </div>
          </div>

          {/* Articles Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <h4 className="font-bold text-[#001F3F] text-xs uppercase tracking-wider">
                  Articles et Produits de la vente ({sale.items.length})
                </h4>
              </div>
              <span className="text-xs font-bold text-slate-600 bg-white px-2.5 py-0.5 rounded border border-slate-200">
                {totalQuantity} article(s) au total
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                    <th className="py-2.5 px-4 w-12 text-center">#</th>
                    <th className="py-2.5 px-4">Désignation du Produit</th>
                    <th className="py-2.5 px-4">Unité / Cond.</th>
                    <th className="py-2.5 px-4 text-right">Prix Unitaire</th>
                    <th className="py-2.5 px-4 text-center">Quantité</th>
                    <th className="py-2.5 px-4 text-right">Total Ligne</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sale.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#001F3F]">{item.productName}</div>
                        {item.productId && (
                          <div className="text-[10px] text-slate-400 font-mono">ID: {item.productId}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {item.unitName ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100 font-medium text-[11px]">
                            {item.unitName}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Unité standard</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700">
                        {formatFCFA(item.unitPrice)}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-[#001F3F]">
                        {item.quantity}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700">
                        {formatFCFA(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold border-t-2 border-slate-200 text-slate-800">
                    <td colSpan={4} className="py-3 px-4 text-right text-xs uppercase text-slate-600">
                      Totaux :
                    </td>
                    <td className="py-3 px-4 text-center text-xs font-black text-blue-700">
                      {totalQuantity}
                    </td>
                    <td className="py-3 px-4 text-right text-sm font-black text-emerald-700">
                      {formatFCFA(sale.finalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Breakdown if discount or tax exists */}
          {(sale.discount > 0 || sale.tax > 0) && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 max-w-xs ml-auto space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Sous-total HT :</span>
                <span className="font-semibold text-slate-800">{formatFCFA(sale.totalAmount)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between text-amber-700 font-semibold">
                  <span>Remise appliquée :</span>
                  <span>- {formatFCFA(sale.discount)}</span>
                </div>
              )}
              {sale.tax > 0 && (
                <div className="flex justify-between">
                  <span>TVA :</span>
                  <span className="font-semibold text-slate-800">{formatFCFA(sale.tax)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm text-[#001F3F] pt-2 border-t border-slate-200">
                <span>Total Net :</span>
                <span className="text-emerald-700">{formatFCFA(sale.finalAmount)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {sale.status !== 'Annulé' && onCancelSale && (
              <button
                type="button"
                onClick={() => onCancelSale(sale)}
                className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Annuler la vente et restituer le stock"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Annuler la vente</span>
              </button>
            )}
            {onDeleteSale && (
              <button
                type="button"
                onClick={() => onDeleteSale(sale)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Supprimer définitivement cette commande"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Supprimer</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onOpenReceipt && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenReceipt(sale);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-blue-600" />
                <span>Ticket</span>
              </button>
            )}
            {onOpenInvoice && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenInvoice(sale);
                }}
                className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Facture A4</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
