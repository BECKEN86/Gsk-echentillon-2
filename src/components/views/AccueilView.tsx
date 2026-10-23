import React, { useMemo } from 'react';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  ShoppingCart,
  Store,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  FileText,
  Users,
  ChevronRight,
  DollarSign,
  Scale,
  CalendarDays,
  PiggyBank
} from 'lucide-react';
import { Product, SaleOrder, PurchaseOrder, NavSection } from '../../types';
import { formatFCFA } from '../../data/initialData';
import { parseAppDate } from '../../utils/dateUtils';

interface AccueilViewProps {
  products: Product[];
  saleOrders: SaleOrder[];
  purchaseOrders: PurchaseOrder[];
  onNavigate: (section: NavSection) => void;
}

export const AccueilView: React.FC<AccueilViewProps> = ({
  products,
  saleOrders,
  purchaseOrders,
  onNavigate
}) => {
  const totalStockValue = products.reduce((sum, p) => sum + p.stock * p.buyPrice, 0);
  const totalStockPotentialValue = products.reduce((sum, p) => sum + p.stock * p.sellPrice, 0);
  const lowStockProducts = products.filter(p => p.stock <= p.minStock);
  const totalSalesToday = saleOrders
    .filter(s => s.status !== 'En cours')
    .reduce((sum, s) => sum + s.finalAmount, 0);
  const pendingPurchaseOrders = purchaseOrders.filter(po => po.status === 'En cours' || po.status === 'Validé');

  // Coûts d'achat actuels (repli pour les ventes sans snapshot buyPrice)
  const productCostMap = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach(p => map.set(p.id, p.buyPrice || 0));
    return map;
  }, [products]);

  // CA + Bénéfice (marge brute) par jour, mois et année — ventes finalisées uniquement
  const salesMetrics = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();

    const acc = {
      day: { revenue: 0, cogs: 0, count: 0 },
      month: { revenue: 0, cogs: 0, count: 0 },
      year: { revenue: 0, cogs: 0, count: 0 }
    };

    saleOrders
      .filter(s => s.status !== 'En cours' && s.status !== 'Annulé')
      .forEach(sale => {
        const sd = parseAppDate(sale.date);
        if (isNaN(sd.getTime()) || sd.getFullYear() !== y) return;

        const cogs = sale.items.reduce(
          (sum, it) => sum + (it.buyPrice ?? productCostMap.get(it.productId) ?? 0) * it.quantity,
          0
        );

        acc.year.revenue += sale.finalAmount;
        acc.year.cogs += cogs;
        acc.year.count++;

        if (sd.getMonth() === m) {
          acc.month.revenue += sale.finalAmount;
          acc.month.cogs += cogs;
          acc.month.count++;
          if (sd.getDate() === d) {
            acc.day.revenue += sale.finalAmount;
            acc.day.cogs += cogs;
            acc.day.count++;
          }
        }
      });

    return acc;
  }, [saleOrders, productCostMap]);

  const perfPeriods: { key: 'day' | 'month' | 'year'; label: string; sub: string }[] = [
    { key: 'day', label: "Aujourd'hui", sub: 'Ventes du jour' },
    { key: 'month', label: 'Ce mois', sub: 'Mois en cours' },
    { key: 'year', label: 'Cette année', sub: 'Année en cours' }
  ];

  return (
    <div className="space-y-6 pb-12">


      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Chiffre d'Affaires - Accent Navy Card */}
        <div className="bg-[#001F3F] p-5 rounded-xl border border-blue-950 shadow-sm text-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-200 uppercase tracking-wider">Ventes du jour</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/30 text-blue-300 flex items-center justify-center border border-blue-400/30">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">{formatFCFA(totalSalesToday)}</div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-blue-200 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>{saleOrders.length} transactions enregistrées</span>
            </div>
          </div>
        </div>

        {/* Card 2: Valeur du Stock - White Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Valeur Stock (Achat)</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#001F3F] tracking-tight">{formatFCFA(totalStockValue)}</div>
            <div className="text-xs text-slate-500 mt-1">
              Valeur de vente max: <span className="text-blue-700 font-bold">{formatFCFA(totalStockPotentialValue)}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Alertes Stock Faible */}
        <div 
          onClick={() => onNavigate('inventaire-produits')}
          className={`p-5 rounded-xl border shadow-sm cursor-pointer transition-colors ${
            lowStockProducts.length > 0
              ? 'bg-red-50/80 border-red-200 hover:bg-red-100/80'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-700 uppercase tracking-wider">Alertes Stock</span>
            <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center border border-red-200">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-red-800 tracking-tight">
              {lowStockProducts.length} <span className="text-sm font-normal text-red-600">produit(s)</span>
            </div>
            <div className="text-xs text-red-700 mt-1 flex items-center gap-1 font-medium">
              <span>Seuil de sécurité atteint</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Card 4: Commandes Fournisseur */}
        <div 
          onClick={() => onNavigate('achat-bon-commande')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Achats en attente</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#001F3F] tracking-tight">
              {pendingPurchaseOrders.length} <span className="text-sm font-normal text-slate-500">commande(s)</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Commandes d'approvisionnement
            </div>
          </div>
        </div>
      </div>

      {/* Performance Commerciale : CA & Bénéfice par jour / mois / année */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-base font-bold text-[#001F3F]">Performance Commerciale</h2>
              <p className="text-[11px] text-slate-500">Montant des ventes &amp; bénéfice réalisé (marge brute)</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('finance-marges-resultat')}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
          >
            Marges &amp; Résultat <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {perfPeriods.map(({ key, label, sub }) => {
            const data = salesMetrics[key];
            const profit = data.revenue - data.cogs;
            const marginRate = data.cogs > 0 ? (profit / data.cogs) * 100 : 0;

            return (
              <div key={key} className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
                    <p className="text-[10px] text-slate-400">{sub} • {data.count} vente(s)</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${
                    profit >= 0
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    Marge {marginRate.toFixed(1)}%
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase">
                    <DollarSign className="w-3.5 h-3.5 text-blue-500" />
                    <span>Montant des ventes</span>
                  </div>
                  <p className="text-xl font-extrabold text-[#001F3F] tracking-tight mt-0.5">
                    {formatFCFA(data.revenue)}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase">
                    <PiggyBank className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Bénéfice réalisé</span>
                  </div>
                  <p className={`text-xl font-extrabold tracking-tight mt-0.5 ${profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {formatFCFA(profit)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid Layout: Low Stock Alert Table & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Low Stock Alert items */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <h2 className="text-base font-bold text-[#001F3F]">Produits nécessitant un réapprovisionnement</h2>
            </div>
            <button
              onClick={() => onNavigate('inventaire-produits')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
            >
              Voir tout <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              <span>Tous vos produits ont un niveau de stock suffisant !</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Produit</th>
                    <th className="py-2.5 px-3 text-center">Stock actuel</th>
                    <th className="py-2.5 px-3 text-center">Seuil min</th>
                    <th className="py-2.5 px-3 text-right">Prix d'achat</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lowStockProducts.map((product, idx) => (
                    <tr key={product.id ? `${product.id}_${idx}` : `low_${idx}`} className="hover:bg-blue-50/40 text-slate-800">
                      <td className="py-2.5 px-3 font-mono text-slate-600">{product.code}</td>
                      <td className="py-2.5 px-3 font-bold text-[#001F3F]">{product.name}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-red-600">
                        {product.stock} {product.unit}s
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-500">{product.minStock} {product.unit}s</td>
                      <td className="py-2.5 px-3 text-right font-medium">{formatFCFA(product.buyPrice)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => onNavigate('inventaire-approvisionnement')}
                          className="px-2.5 py-1 rounded-md bg-[#001F3F] text-white hover:bg-blue-900 text-[11px] font-medium transition-colors"
                        >
                          Approvisionner
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Quick Navigation Shortcuts & Recent Sales */}
        <div className="space-y-6">
          {/* Quick Shortcuts */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">
              Raccourcis Rapides
            </h2>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => onNavigate('vente-sessions')}
                className="p-3 rounded-lg bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-left transition-all group"
              >
                <Store className="w-5 h-5 text-emerald-700 mb-1 group-hover:scale-105 transition-transform" />
                <div className="text-xs font-bold text-[#001F3F]">Point de Vente</div>
                <div className="text-[10px] text-slate-500">Tableau de bord & sessions</div>
              </button>

              <button
                onClick={() => onNavigate('inventaire-approvisionnement')}
                className="p-3 rounded-lg bg-blue-50 hover:bg-blue-100/80 border border-blue-200 text-left transition-all group"
              >
                <Package className="w-5 h-5 text-blue-700 mb-1 group-hover:scale-105 transition-transform" />
                <div className="text-xs font-bold text-[#001F3F]">Entrée Stock</div>
                <div className="text-[10px] text-slate-500">Ajouter du stock</div>
              </button>

              <button
                onClick={() => onNavigate('achat-bon-commande')}
                className="p-3 rounded-lg bg-purple-50 hover:bg-purple-100/80 border border-purple-200 text-left transition-all group"
              >
                <FileText className="w-5 h-5 text-purple-700 mb-1 group-hover:scale-105 transition-transform" />
                <div className="text-xs font-bold text-[#001F3F]">Bon Commandes</div>
                <div className="text-[10px] text-slate-500">Commander fournisseur</div>
              </button>

              <button
                onClick={() => onNavigate('acteurs-clients')}
                className="p-3 rounded-lg bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 text-left transition-all group"
              >
                <Users className="w-5 h-5 text-indigo-700 mb-1 group-hover:scale-105 transition-transform" />
                <div className="text-xs font-bold text-[#001F3F]">Gérer Clients</div>
                <div className="text-[10px] text-slate-500">Crédits & comptes</div>
              </button>

              <button
                onClick={() => onNavigate('finance-recettes-depenses')}
                className="p-3 rounded-lg bg-amber-50 hover:bg-amber-100/80 border border-amber-200 text-left transition-all group"
              >
                <DollarSign className="w-5 h-5 text-amber-700 mb-1 group-hover:scale-105 transition-transform" />
                <div className="text-xs font-bold text-[#001F3F]">Recettes / Dépenses</div>
                <div className="text-[10px] text-slate-500">Flux d'exploitation</div>
              </button>

              <button
                onClick={() => onNavigate('finance-marges-resultat')}
                className="p-3 rounded-lg bg-teal-50 hover:bg-teal-100/80 border border-teal-200 text-left transition-all group"
              >
                <Scale className="w-5 h-5 text-teal-700 mb-1 group-hover:scale-105 transition-transform" />
                <div className="text-xs font-bold text-[#001F3F]">Marges & Résultat</div>
                <div className="text-[10px] text-slate-500">Rentabilité estimée</div>
              </button>
            </div>
          </div>

          {/* Recent Sales Activity */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Dernières Ventes
              </h2>
              <button
                onClick={() => onNavigate('vente-commande')}
                className="text-xs text-blue-600 hover:text-blue-800 font-bold"
              >
                Voir tout
              </button>
            </div>

            <div className="space-y-2.5">
              {saleOrders.slice(0, 3).map((sale, idx) => (
                <div key={sale.id ? `${sale.id}_${idx}` : `sale_${idx}`} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <div className="font-bold text-[#001F3F]">{sale.code} • {sale.clientName}</div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{sale.date}</span>
                      <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 font-semibold border border-blue-200">
                        {sale.paymentMethod}
                      </span>
                    </div>
                  </div>
                  <div className="font-bold text-emerald-700 text-sm">
                    {formatFCFA(sale.finalAmount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
