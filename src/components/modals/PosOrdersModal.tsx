import React, { useState } from 'react';
import { 
  X, 
  Search, 
  Printer, 
  Download, 
  ShoppingBag, 
  Receipt, 
  CreditCard, 
  Smartphone, 
  Banknote, 
  Calendar,
  Eye,
  Filter
} from 'lucide-react';
import { SaleOrder, PointDeVente, UserAccount } from '../../types';
import { formatFCFA } from '../../data/initialData';

interface PosOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleOrders: SaleOrder[];
  activePointDeVente?: PointDeVente;
  onOpenReceipt: (sale: SaleOrder) => void;
  /** Recharge une commande "En cours" dans le panier pour la terminer */
  onResumeOrder?: (order: SaleOrder) => void;
  currentUser?: UserAccount | null;
}

export const PosOrdersModal: React.FC<PosOrdersModalProps> = ({
  isOpen,
  onClose,
  saleOrders = [],
  activePointDeVente,
  onOpenReceipt,
  onResumeOrder,
  currentUser
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState<string>('Tous');
  const [sessionFilter, setSessionFilter] = useState<'all' | 'current'>(
    activePointDeVente ? 'current' : 'all'
  );
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<SaleOrder | null>(null);

  if (!isOpen) return null;

  // Filter orders according to session, search term, and payment method
  const filteredOrders = saleOrders.filter(order => {
    // Session filter
    if (sessionFilter === 'current' && activePointDeVente) {
      const matchPvId = order.pointDeVenteId === activePointDeVente.id;
      const matchPvCode = order.pointDeVenteCode === activePointDeVente.code;
      // If neither is explicitly set, check if operator matches
      const matchOperator = order.sellerName === activePointDeVente.operator;
      if (!matchPvId && !matchPvCode && !matchOperator) {
        return false;
      }
    }

    // Payment method filter
    if (selectedPaymentFilter !== 'Tous' && order.paymentMethod !== selectedPaymentFilter) {
      return false;
    }

    // Search query filter
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      const matchCode = order.code.toLowerCase().includes(term);
      const matchClient = order.clientName.toLowerCase().includes(term);
      const matchPayment = order.paymentMethod.toLowerCase().includes(term);
      const matchItems = order.items.some(item => item.productName.toLowerCase().includes(term));
      return matchCode || matchClient || matchPayment || matchItems;
    }

    return true;
  });

  // Calculate totals
  const totalAmount = filteredOrders.reduce((sum, order) => sum + order.finalAmount, 0);
  const cashAmount = filteredOrders
    .filter(o => o.paymentMethod === 'Espèces')
    .reduce((sum, o) => sum + o.finalAmount, 0);
  const mobileAmount = filteredOrders
    .filter(o => o.paymentMethod === 'Mobile Money')
    .reduce((sum, o) => sum + o.finalAmount, 0);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      alert('Aucune commande à exporter.');
      return;
    }

    const headers = [
      'N° Commande',
      'Date & Heure',
      'Client',
      'Point de Vente',
      'Caissier / Opérateur',
      'Articles',
      'Montant Total TTC (FCFA)',
      'Mode de Paiement',
      'Statut'
    ];

    const rows = filteredOrders.map(order => {
      const itemsDetail = order.items.map(i => `${i.productName} (x${i.quantity})`).join(' | ');
      return [
        `"${order.code}"`,
        `"${order.date}"`,
        `"${order.clientName.replace(/"/g, '""')}"`,
        `"${order.pointDeVenteCode || activePointDeVente?.code || 'POS'}"`,
        `"${order.sellerName || activePointDeVente?.operator || ''}"`,
        `"${itemsDetail.replace(/"/g, '""')}"`,
        order.finalAmount,
        `"${order.paymentMethod}"`,
        `"${order.status}"`
      ];
    });

    const csvContent = [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `commandes_caisse_${activePointDeVente?.code || 'pos'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const paymentBadge = (method: string) => {
    switch (method) {
      case 'Espèces':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Banknote className="w-3 h-3 text-emerald-600" />
            Espèces
          </span>
        );
      case 'Mobile Money':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
            <Smartphone className="w-3 h-3 text-violet-600" />
            Mobile Money
          </span>
        );
      case 'Carte':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <CreditCard className="w-3 h-3 text-blue-600" />
            Carte
          </span>
        );
      case 'Crédit':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Crédit Client
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {method}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in-50 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#001F3F]">Liste des Commandes & Ventes</h2>
                {activePointDeVente && (
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {activePointDeVente.code}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Consultez l'historique des tickets, réimprimez les reçus et suivez les encaissements de la caisse.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
              title="Exporter les commandes filtrées en CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Exporter CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 border-b border-slate-200 text-xs">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-500 block text-[11px]">Commandes affichées</span>
            <span className="text-base font-bold text-slate-800">{filteredOrders.length}</span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-500 block text-[11px]">Total Encaissé</span>
            <span className="text-base font-bold text-emerald-600">{formatFCFA(totalAmount)}</span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-500 block text-[11px]">Espèces</span>
            <span className="text-base font-bold text-slate-800">{formatFCFA(cashAmount)}</span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-500 block text-[11px]">Mobile Money</span>
            <span className="text-base font-bold text-violet-700">{formatFCFA(mobileAmount)}</span>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="p-4 border-b border-slate-200 space-y-3 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par N° ticket (VTE-...), client, article..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 text-slate-800 placeholder-slate-400 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Session Filter */}
            {activePointDeVente && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setSessionFilter('current')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    sessionFilter === 'current'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cette Caisse ({activePointDeVente.code})
                </button>
                <button
                  type="button"
                  onClick={() => setSessionFilter('all')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    sessionFilter === 'all'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Toutes les Ventes
                </button>
              </div>
            )}
          </div>

          {/* Payment Method Badges */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-400 text-[11px] font-medium mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Règlement:
            </span>
            {['Tous', 'Espèces', 'Mobile Money', 'Carte', 'Crédit'].map(method => (
              <button
                key={method}
                type="button"
                onClick={() => setSelectedPaymentFilter(method)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedPaymentFilter === method
                    ? 'bg-[#001F3F] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">Aucune commande trouvée</p>
              <p className="text-xs text-slate-400 mt-1">
                {searchTerm || selectedPaymentFilter !== 'Tous'
                  ? 'Essayez de modifier vos filtres de recherche.'
                  : "Aucune vente n'a encore été enregistrée dans cette session."}
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[11px]">
                  <tr>
                    <th className="px-4 py-3">N° Commande</th>
                    <th className="px-4 py-3">Date & Heure</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Articles</th>
                    <th className="px-4 py-3">Règlement</th>
                    <th className="px-4 py-3 text-right">Montant Total</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map(order => {
                    const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
                    return (
                      <tr 
                        key={order.id}
                        className="hover:bg-blue-50/40 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-slate-800">
                            {order.code}
                          </span>
                          {order.status === 'En cours' && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap">
                              En cours
                            </span>
                          )}
                          {order.status === 'Validé' && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                              Validé
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                          {order.date}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{order.clientName}</div>
                          {order.sellerName && (
                            <div className="text-[10px] text-slate-400">Par {order.sellerName}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-[220px]">
                          <div className="truncate text-slate-700" title={order.items.map(i => `${i.productName} (x${i.quantity})`).join(', ')}>
                            {order.items.map(i => `${i.productName} (x${i.quantity})`).join(', ')}
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {totalQty} article{totalQty > 1 ? 's' : ''} au total
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {paymentBadge(order.paymentMethod)}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className="font-bold text-slate-900">
                            {formatFCFA(order.finalAmount)}
                          </span>
                          {order.discount > 0 && (
                            <div className="text-[10px] text-rose-500">
                              Remise: -{formatFCFA(order.discount)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {order.status === 'En cours' && onResumeOrder ? (
                            <button
                              type="button"
                              onClick={() => onResumeOrder(order)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-xs transition-colors"
                              title="Recharger cette commande dans le panier pour la terminer"
                            >
                              <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Reprendre</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onOpenReceipt(order)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold text-xs transition-colors"
                              title="Imprimer ou afficher le ticket de caisse"
                            >
                              <Printer className="w-3.5 h-3.5 text-blue-600" />
                              <span>Ticket</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-slate-50">
          <span className="text-xs text-slate-500">
            {filteredOrders.length} vente{filteredOrders.length > 1 ? 's' : ''} trouvée{filteredOrders.length > 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs transition-colors"
          >
            Retour à la caisse
          </button>
        </div>

      </div>
    </div>
  );
};
