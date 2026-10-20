import React, { useState } from 'react';
import {
  ShoppingBag,
  Search,
  Printer,
  Download,
  Ban,
  FileText,
  Trash2,
  Eye
} from 'lucide-react';
import { SaleOrder } from '../../../types';
import { formatFCFA } from '../../../data/initialData';
import { SaleDetailModal } from '../../modals/SaleDetailModal';

interface CommandeVenteViewProps {
  saleOrders: SaleOrder[];
  onOpenReceipt: (sale: SaleOrder) => void;
  onOpenInvoice?: (sale: SaleOrder) => void;
  onCancelSale?: (saleId: string) => void;
  onDeleteSale?: (saleId: string) => void;
}

export const CommandeVenteView: React.FC<CommandeVenteViewProps> = ({
  saleOrders,
  onOpenReceipt,
  onOpenInvoice,
  onCancelSale,
  onDeleteSale
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSaleForDetail, setSelectedSaleForDetail] = useState<SaleOrder | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'cancel' | 'delete';
    sale: SaleOrder;
  } | null>(null);

  const filteredSales = saleOrders.filter(sale =>
    sale.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sync open modal with latest state in saleOrders
  const activeDetailSale = selectedSaleForDetail
    ? saleOrders.find(s => s.id === selectedSaleForDetail.id) || null
    : null;

  // Exportation CSV globale des données de vente
  const handleExportCSV = () => {
    if (filteredSales.length === 0) {
      return;
    }

    const headers = [
      'N° Vente',
      'Date',
      'Client',
      'Nombre Articles',
      'Détail Articles',
      'Sous-total HT FCFA',
      'TVA FCFA',
      'Remise FCFA',
      'Montant Total TTC FCFA',
      'Mode de Paiement',
      'Statut'
    ];

    const rows = filteredSales.map(s => {
      const totalQty = s.items.reduce((sum, i) => sum + i.quantity, 0);
      const itemsDetail = s.items.map(i => `${i.productName} (x${i.quantity})`).join(' | ');
      return [
        `"${s.code}"`,
        `"${s.date}"`,
        `"${s.clientName.replace(/"/g, '""')}"`,
        totalQty,
        `"${itemsDetail.replace(/"/g, '""')}"`,
        s.totalAmount,
        s.tax,
        s.discount,
        s.finalAmount,
        `"${s.paymentMethod}"`,
        `"${s.status}"`
      ];
    });

    const csvContent = [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ventes_globales_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-[#001F3F]">Commandes & Ventes Enregistrées</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Consultez l'historique complet des tickets de caisse, ventes à crédit et factures émises.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
          title="Exporter toutes les ventes filtrées au format CSV pour Excel"
        >
          <Download className="w-4 h-4" />
          <span>Exporter Ventes (CSV)</span>
        </button>
      </div>

      {/* Search & Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par N° Vente, client ou mode de paiement..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 text-slate-800 placeholder-slate-400 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="text-xs text-slate-500 font-medium">
          <strong>{filteredSales.length}</strong> vente(s) enregistrée(s)
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">N° Vente / Date</th>
                <th className="py-3 px-4">Client</th>
                <th className="py-3 px-4 text-center">Articles</th>
                <th className="py-3 px-4 text-center">Mode Paiement</th>
                <th className="py-3 px-4 text-right">Montant Total</th>
                <th className="py-3 px-4 text-center">Statut</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.map((sale, idx) => (
                <tr
                  key={sale.id ? `${sale.id}_${idx}` : `vte_${idx}`}
                  onClick={() => setSelectedSaleForDetail(sale)}
                  className="hover:bg-blue-50/50 text-slate-700 transition-colors cursor-pointer group"
                  title="Cliquer pour voir le détail des produits de cette vente"
                >
                  <td className="py-3 px-4">
                    <div className="font-mono font-bold text-blue-700 flex items-center gap-1.5">
                      <span>{sale.code}</span>
                      <Eye className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-[10px] text-slate-400">{sale.date}</div>
                  </td>

                  <td className="py-3 px-4 font-bold text-[#001F3F]">
                    {sale.clientName}
                  </td>

                  <td className="py-3 px-4 text-center text-slate-600">
                    <span className="font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      {sale.items.reduce((sum, i) => sum + i.quantity, 0)} unité(s)
                    </span>
                  </td>

                  <td className="py-3 px-4 text-center">
                    <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-[11px]">
                      {sale.paymentMethod}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-right font-extrabold text-emerald-700 text-sm">
                    {formatFCFA(sale.finalAmount)}
                  </td>

                  <td className="py-3 px-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold ${
                      sale.status === 'Annulé'
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : sale.status === 'En attente'
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : sale.status === 'En cours'
                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    }`}>
                      {sale.status}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenReceipt(sale);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Imprimer le ticket de caisse"
                      >
                        <Printer className="w-3.5 h-3.5 text-blue-600" />
                        <span>Ticket</span>
                      </button>

                      {onOpenInvoice && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenInvoice(sale);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Facture A4 imprimable (avec en-tête société)"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Facture</span>
                        </button>
                      )}

                      {sale.status !== 'Annulé' && onCancelSale && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmAction({ type: 'cancel', sale });
                          }}
                          className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Annuler la vente et contre-passer ses effets (stock, trésorerie, crédit client)"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Annuler</span>
                        </button>
                      )}

                      {onDeleteSale && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmAction({ type: 'delete', sale });
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                          title="Supprimer la commande"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Screen / Modal: Détail des produits de la vente */}
      {activeDetailSale && (
        <SaleDetailModal
          sale={activeDetailSale}
          onClose={() => setSelectedSaleForDetail(null)}
          onOpenReceipt={onOpenReceipt}
          onOpenInvoice={onOpenInvoice}
          onCancelSale={(s) => setConfirmAction({ type: 'cancel', sale: s })}
          onDeleteSale={(s) => setConfirmAction({ type: 'delete', sale: s })}
        />
      )}

      {/* Modal de Confirmation Annulation / Suppression (In-App, sans window.confirm) */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmAction.type === 'cancel'
                    ? 'bg-rose-100 text-rose-600'
                    : 'bg-red-100 text-red-600'
                }`}
              >
                {confirmAction.type === 'cancel' ? (
                  <Ban className="w-6 h-6" />
                ) : (
                  <Trash2 className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-[#001F3F]">
                  {confirmAction.type === 'cancel'
                    ? `Annuler la vente ${confirmAction.sale.code} ?`
                    : `Supprimer la commande ${confirmAction.sale.code} ?`}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Client : <span className="font-semibold text-slate-700">{confirmAction.sale.clientName}</span> — Montant :{' '}
                  <span className="font-bold text-emerald-700">{formatFCFA(confirmAction.sale.finalAmount)}</span>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200 leading-relaxed">
              {confirmAction.type === 'cancel'
                ? "L'annulation remettra immédiatement les articles vendus en stock, ajustera le solde crédit du client et compensera l'encaissement en trésorerie."
                : "La commande sera définitivement supprimée de la liste. S'il s'agissait d'une vente active, le stock et la trésorerie sont automatiquement régularisés."}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmAction.type === 'cancel') {
                    onCancelSale?.(confirmAction.sale.id);
                  } else {
                    onDeleteSale?.(confirmAction.sale.id);
                    if (selectedSaleForDetail?.id === confirmAction.sale.id) {
                      setSelectedSaleForDetail(null);
                    }
                  }
                  setConfirmAction(null);
                }}
                className={`px-4 py-2 rounded-xl text-white font-bold text-xs shadow-xs transition-colors cursor-pointer ${
                  confirmAction.type === 'cancel'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {confirmAction.type === 'cancel' ? "Confirmer l'annulation" : 'Confirmer la suppression'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
