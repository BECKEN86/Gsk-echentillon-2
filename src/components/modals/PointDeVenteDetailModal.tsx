import React from 'react';
import {
  X,
  Store,
  Calendar,
  Clock,
  User,
  DollarSign,
  Lock,
  Unlock,
  Coins,
  Receipt,
  FileSpreadsheet,
  Printer,
  ShoppingBag
} from 'lucide-react';
import { CompanyConfig, PointDeVente, SaleOrder } from '../../types';
import { formatFCFA } from '../../data/initialData';
import { printSessionZ } from '../../utils/printReports';

interface PointDeVenteDetailModalProps {
  pv: PointDeVente;
  onClose: () => void;
  onOpenReceipt?: (sale: SaleOrder) => void;
  onOpenCloseModal?: (pv: PointDeVente) => void;
  companyConfig?: CompanyConfig | null;
}

export const PointDeVenteDetailModal: React.FC<PointDeVenteDetailModalProps> = ({
  pv,
  onClose,
  onOpenReceipt,
  onOpenCloseModal,
  companyConfig
}) => {
  const sales = pv.sales || [];
  const totalSalesCount = sales.length;
  const totalSalesAmount = sales.reduce((s, o) => s + (o.finalAmount || o.totalAmount), 0);
  const cashSalesAmount = sales
    .filter(o => o.paymentMethod === 'Espèces')
    .reduce((s, o) => s + (o.finalAmount || o.totalAmount), 0);
  const mobileSalesAmount = sales
    .filter(o => o.paymentMethod === 'Mobile Money')
    .reduce((s, o) => s + (o.finalAmount || o.totalAmount), 0);
  const creditSalesAmount = sales
    .filter(o => o.paymentMethod === 'Crédit')
    .reduce((s, o) => s + (o.finalAmount || o.totalAmount), 0);
  const expectedClosing = pv.openingAmount + cashSalesAmount;
  const discrepancy = pv.closingAmount !== undefined ? pv.closingAmount - expectedClosing : undefined;

  // Export CSV des commandes de cette session
  const handleExportSessionCSV = () => {
    if (sales.length === 0) {
      alert('Aucune vente enregistrée pour ce point de vente.');
      return;
    }

    const headers = [
      'N° Vente',
      'Date Heure',
      'Point de Vente',
      'Client',
      'Articles',
      'Total TTC FCFA',
      'Mode de Paiement',
      'Statut'
    ];

    const rows = sales.map(s => {
      const itemsDetail = s.items.map(i => `${i.productName} (x${i.quantity})`).join(' | ');
      return [
        `"${s.code}"`,
        `"${s.date}"`,
        `"${pv.code}"`,
        `"${s.clientName.replace(/"/g, '""')}"`,
        `"${itemsDetail.replace(/"/g, '""')}"`,
        s.finalAmount || s.totalAmount,
        `"${s.paymentMethod}"`,
        `"${s.status}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ventes_${pv.code}_${pv.date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl overflow-hidden animate-in fade-in zoom-in-95 my-4">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 bg-[#001F3F] text-white border-b border-blue-900">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              pv.status === 'En cours'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                : 'bg-slate-700/50 text-slate-300 border-slate-600'
            }`}>
              <Store className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">Fiche Point de Vente</h3>
                <span className="font-mono text-sm font-bold bg-white/20 px-2.5 py-0.5 rounded-md text-white">
                  {pv.code}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1 ${
                  pv.status === 'En cours'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                    : 'bg-slate-700 text-slate-300 border-slate-600'
                }`}>
                  {pv.status === 'En cours' ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  <span>Statut : {pv.status}</span>
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                Session du {pv.date} • Opérateur : <strong>{pv.operator}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-xs">
          
          {/* Top 6 Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* 1. Date */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1 mb-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Date
              </span>
              <p className="text-sm font-bold text-slate-900">{pv.date}</p>
            </div>

            {/* 2. Opérateur */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1 mb-1">
                <User className="w-3.5 h-3.5 text-slate-400" /> Opérateur
              </span>
              <p className="text-xs font-bold text-slate-900 truncate" title={pv.operator}>
                {pv.operator}
              </p>
            </div>

            {/* 3. Début */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider flex items-center gap-1 mb-1">
                <Clock className="w-3.5 h-3.5 text-emerald-600" /> Début (Ouverture)
              </span>
              <p className="text-[11px] font-mono font-bold text-emerald-950">
                {pv.openedAt}
              </p>
            </div>

            {/* 4. Fin */}
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-blue-700 tracking-wider flex items-center gap-1 mb-1">
                <Clock className="w-3.5 h-3.5 text-blue-600" /> Fin (Fermeture)
              </span>
              <p className="text-[11px] font-mono font-bold text-blue-950">
                {pv.closedAt || <span className="text-amber-600 font-sans italic font-normal">En cours...</span>}
              </p>
            </div>

            {/* 5. Solde Ouverture */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1 mb-1">
                <Coins className="w-3.5 h-3.5 text-slate-400" /> Solde Ouverture
              </span>
              <p className="text-sm font-black text-slate-900">{formatFCFA(pv.openingAmount)}</p>
            </div>

            {/* 6. Solde Fermeture */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1 mb-1">
                <Coins className="w-3.5 h-3.5 text-slate-400" /> Solde Fermeture
              </span>
              <p className="text-sm font-black text-slate-900">
                {pv.closingAmount !== undefined ? formatFCFA(pv.closingAmount) : <span className="text-slate-400 italic font-normal">-</span>}
              </p>
            </div>
          </div>

          {/* Analyse Caisse & Rapprochement */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h4 className="font-bold text-[#001F3F] text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-600" />
              Récapitulatif Financier de la Caisse
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Total Ventes</span>
                <span className="text-sm font-black text-[#001F3F]">{formatFCFA(totalSalesAmount)}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">{totalSalesCount} commande(s)</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] text-emerald-600 uppercase font-bold block mb-0.5">Ventes Espèces</span>
                <span className="text-sm font-black text-emerald-700">{formatFCFA(cashSalesAmount)}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Encaissé cash</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] text-blue-600 uppercase font-bold block mb-0.5">Mobile Money</span>
                <span className="text-sm font-black text-blue-700">{formatFCFA(mobileSalesAmount)}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Orange/Wave/MTN</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] text-amber-600 uppercase font-bold block mb-0.5">Ventes Crédit</span>
                <span className="text-sm font-black text-amber-700">{formatFCFA(creditSalesAmount)}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Créances clients</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Écart de Caisse</span>
                {discrepancy !== undefined ? (
                  <span className={`text-sm font-black ${
                    discrepancy === 0 ? 'text-emerald-600' : discrepancy > 0 ? 'text-blue-600' : 'text-rose-600'
                  }`}>
                    {discrepancy === 0 ? '0 FCFA' : `${discrepancy > 0 ? '+' : ''}${formatFCFA(discrepancy)}`}
                  </span>
                ) : (
                  <span className="text-xs text-amber-600 font-semibold italic">Session en cours</span>
                )}
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {pv.status === 'Fermé' ? (discrepancy === 0 ? 'Conforme' : 'Écart constaté') : 'Non clôturé'}
                </span>
              </div>
            </div>
          </div>

          {/* Section : Lignes de Vente (Commandes Client Concernées) */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="font-bold text-[#001F3F] text-xs uppercase tracking-wider flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
                Lignes de Vente (Commandes Client de cette Session)
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] font-bold">
                  {totalSalesCount}
                </span>
              </h4>

              <button
                type="button"
                onClick={handleExportSessionCSV}
                disabled={sales.length === 0}
                className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200 flex items-center gap-1.5 transition-colors w-fit disabled:opacity-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Exporter les Ventes (CSV)</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                    <th className="py-2.5 px-3">N° Commande</th>
                    <th className="py-2.5 px-3">Date & Heure</th>
                    <th className="py-2.5 px-3">Client</th>
                    <th className="py-2.5 px-3">Articles</th>
                    <th className="py-2.5 px-3 text-center">Paiement</th>
                    <th className="py-2.5 px-3 text-right">Montant TTC</th>
                    <th className="py-2.5 px-3 text-center">Ticket</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {sales.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Aucune vente enregistrée sur ce point de vente.
                      </td>
                    </tr>
                  ) : (
                    sales.map((order) => {
                      const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
                      const finalTotal = order.finalAmount || order.totalAmount;

                      return (
                        <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                            {order.code}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                            {order.date}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {order.clientName}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-[11px] text-slate-600 line-clamp-1" title={order.items.map(i => `${i.productName} (x${i.quantity})`).join(', ')}>
                              {order.items.map(i => `${i.productName} (${i.quantity})`).join(', ')}
                            </span>
                            <span className="text-[10px] text-slate-400">{totalQty} article(s)</span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              order.paymentMethod === 'Espèces'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : order.paymentMethod === 'Mobile Money'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : order.paymentMethod === 'Crédit'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-purple-50 text-purple-800 border border-purple-200'
                            }`}>
                              {order.paymentMethod}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                            {formatFCFA(finalTotal)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {onOpenReceipt && (
                              <button
                                type="button"
                                onClick={() => onOpenReceipt(order)}
                                className="p-1 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                                title="Voir le ticket de caisse"
                              >
                                <Receipt className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          {pv.notes && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700">
              <p className="font-bold text-[11px] uppercase tracking-wide text-slate-500 mb-0.5">Remarques</p>
              <p className="text-xs text-slate-800 font-medium leading-relaxed">{pv.notes}</p>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            Session: <span className="font-mono font-bold text-slate-800">{pv.code}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => printSessionZ(pv, sales, companyConfig)}
              title="État de clôture : ventes par règlement, espèces attendues vs comptées, écart"
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-[#001F3F] border border-slate-300 font-semibold text-xs flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Z de caisse</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-xs"
            >
              Fermer
            </button>

            {pv.status === 'En cours' && onOpenCloseModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCloseModal(pv);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
              >
                <Lock className="w-4 h-4" />
                <span>Clôturer ce Point de Vente</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
