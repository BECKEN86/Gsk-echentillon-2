import React, { useState, useMemo } from 'react';
import {
  X,
  Edit3,
  Barcode,
  Package,
  Layers,
  Tag,
  AlertTriangle,
  CheckCircle,
  Truck,
  ShoppingBag,
  Boxes,
  Info,
  History,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  User} from 'lucide-react';
import { Product, StockMovement } from '../../types';
import { formatFCFA } from '../../data/initialData';

interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (product: Product) => void;
  movements?: StockMovement[];
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  isOpen,
  onClose,
  onEdit,
  movements = []
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'units' | 'movements' | 'logistics'>('general');
  const [movementSearch, setMovementSearch] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('ALL');

  // Mouvements spécifiques à ce produit (Hooks appelés de façon inconditionnelle)
  const productMovements = useMemo(() => {
    if (!product) return [];
    return (movements || []).filter(
      m => m.productId === product.id || m.productName === product.name
    );
  }, [movements, product]);

  const filteredMovements = useMemo(() => {
    return productMovements.filter(m => {
      const matchType = movementTypeFilter === 'ALL' || m.type === movementTypeFilter;
      const matchSearch = !movementSearch.trim() || 
        m.reason.toLowerCase().includes(movementSearch.toLowerCase()) ||
        m.reference.toLowerCase().includes(movementSearch.toLowerCase()) ||
        (m.performedBy && m.performedBy.toLowerCase().includes(movementSearch.toLowerCase())) ||
        m.date.includes(movementSearch);
      return matchType && matchSearch;
    });
  }, [productMovements, movementTypeFilter, movementSearch]);

  // Statistiques des mouvements
  const movementStats = useMemo(() => {
    const totalEntries = productMovements
      .filter(m => m.type === 'Entrée')
      .reduce((sum, m) => sum + m.quantity, 0);

    const totalExits = productMovements
      .filter(m => m.type === 'Sortie' || m.type === 'Périmé/Casse')
      .reduce((sum, m) => sum + m.quantity, 0);

    const netChange = totalEntries - totalExits;

    return { totalEntries, totalExits, netChange, count: productMovements.length };
  }, [productMovements]);

  if (!isOpen || !product) return null;

  const storageUnit = product.storageUnit || product.unit || 'pièce';
  const measurementUnit = product.measurementUnit || 'kilogramme';
  const isLowStock = product.isStockable !== false && product.stock > 0 && product.stock <= product.minStock;
  const isOutOfStock = product.isStockable !== false && product.stock <= 0;

  const margin = product.sellPrice - product.buyPrice;
  const marginPercent = product.buyPrice > 0 ? ((margin / product.buyPrice) * 100).toFixed(1) : '100';

  const stockPurchaseValue = (product.stock || 0) * product.buyPrice;
  const stockSaleValue = (product.stock || 0) * product.sellPrice;

  // Filter operational units
  const operationalUnits = product.operationalUnits || [];
  const uovList = operationalUnits.filter(u => u.type === 'UOV');
  const uoaList = operationalUnits.filter(u => u.type === 'UOA');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div 
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl lg:max-w-4xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/80 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Image Preview */}
            <div className="w-16 h-16 rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-full h-full bg-blue-50 text-blue-700 font-bold text-lg flex items-center justify-center">
                  {product.name.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1">
                  <Barcode className="w-3.5 h-3.5 text-blue-600" />
                  {product.code}
                </span>
                {product.barcode && (
                  <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    EAN: {product.barcode}
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
                  {product.category}
                </span>
              </div>

              <h2 className="text-xl font-bold text-[#001F3F] leading-snug">
                {product.name}
              </h2>

              {/* Status pills */}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {product.isStockable === false ? (
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                    Service / Non stockable
                  </span>
                ) : isOutOfStock ? (
                  <span className="px-2.5 py-0.5 rounded-md bg-red-100 text-red-700 text-[11px] font-bold border border-red-200 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Rupture de Stock
                  </span>
                ) : isLowStock ? (
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-200 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    Stock Faible ({product.stock} {storageUnit}s)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                    En Stock ({product.stock} {storageUnit}s)
                  </span>
                )}

                {product.availableInPOS !== false ? (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold" title="Disponible en caisse / Point de vente">
                    Disponible PV
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[11px] font-medium">
                    Hors PV
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(product);
              }}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Modifier</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-5 pt-2 gap-2 text-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`pb-2.5 px-3 font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'general'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Tarifs & Stock</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('units')}
            className={`pb-2.5 px-3 font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'units'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Unités UOA / UOV ({operationalUnits.length})</span>
          </button>

          {/* NOUVEAU TAB : HISTORIQUE DES MOUVEMENTS */}
          <button
            type="button"
            onClick={() => setActiveTab('movements')}
            className={`pb-2.5 px-3 font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'movements'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4 text-teal-600" />
            <span>Historique Mouvements ({movementStats.count})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logistics')}
            className={`pb-2.5 px-3 font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'logistics'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Inventaire & Infos</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 max-h-[68vh] overflow-y-auto space-y-5 text-xs text-slate-700">
          
          {/* TAB 1: Tarifs & Stock */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              {/* Financial KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Prix d'Achat</span>
                  <span className="text-base font-bold text-slate-800 mt-0.5 block">{formatFCFA(product.buyPrice)}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">TVA Achat: {product.vatPurchase ?? 0}%</span>
                </div>

                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Prix de Vente</span>
                  <span className="text-base font-bold text-emerald-700 mt-0.5 block">{formatFCFA(product.sellPrice)}</span>
                  <span className="text-[10px] text-emerald-600 mt-0.5 block">TVA Vente: {product.vatSale ?? 0}%</span>
                </div>

                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200">
                  <span className="text-[10px] uppercase font-bold text-blue-800 block">Marge Brute</span>
                  <span className="text-base font-bold text-blue-700 mt-0.5 block">{formatFCFA(margin)}</span>
                  <span className="text-[10px] text-blue-600 font-semibold mt-0.5 block">Taux: +{marginPercent}%</span>
                </div>

                <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200">
                  <span className="text-[10px] uppercase font-bold text-purple-800 block">Stock Disponible</span>
                  <span className="text-base font-bold text-purple-700 mt-0.5 block">
                    {product.isStockable !== false ? `${product.stock} ${storageUnit}s` : 'Non stockable'}
                  </span>
                  <span className="text-[10px] text-purple-600 mt-0.5 block">Alerte à: {product.minStock} {storageUnit}s</span>
                </div>
              </div>

              {/* Stock Value Summary */}
              {product.isStockable !== false && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 block">Valeur marchande au coût d'achat :</span>
                    <strong className="text-slate-800 text-sm">{formatFCFA(stockPurchaseValue)}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block">Valeur potentielle à la vente :</span>
                    <strong className="text-emerald-700 text-sm">{formatFCFA(stockSaleValue)}</strong>
                  </div>
                </div>
              )}

              {/* Aperçu Mouvements de stock avec bouton d'accès rapide */}
              <div className="p-4 bg-teal-50/60 rounded-xl border border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-teal-600 text-white rounded-lg">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-teal-950 text-xs">Historique des entrées / sorties</h4>
                    <p className="text-[11px] text-teal-800 mt-0.5">
                      <strong>{movementStats.totalEntries}</strong> entrées enregistrées • <strong>{movementStats.totalExits}</strong> sorties décomptées ({movementStats.count} mouvements au total).
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('movements')}
                  className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-lg shadow-2xs transition-colors shrink-0"
                >
                  Consulter l'historique complet
                </button>
              </div>

              {/* Units summary block */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50/60 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[11px] text-slate-500 font-medium">Unité de stockage (conditionnement)</span>
                  <div className="font-bold text-slate-800 text-sm capitalize mt-0.5 flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-purple-600" />
                    <span>{storageUnit}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 font-medium">Unité de mesure (volume / poids)</span>
                  <div className="font-bold text-slate-800 text-sm capitalize mt-0.5 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-blue-600" />
                    <span>{measurementUnit}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Unités UOA / UOV */}
          {activeTab === 'units' && (
            <div className="space-y-4">
              {/* UOV (Ventes) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
                    Unités Opérationnelles de Vente (UOV) ({uovList.length})
                  </h4>
                </div>

                {uovList.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
                    Aucune UOV spécifique enregistrée. La vente s'effectue au prix unitaire de base.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                        <tr>
                          <th className="py-2 px-3">Libellé</th>
                          <th className="py-2 px-3 text-center">Quantité ({storageUnit}s)</th>
                          <th className="py-2 px-3 text-right">Prix de vente (FCFA)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {uovList.map((u, i) => (
                          <tr key={u.id || i} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-semibold text-slate-800">{u.label || u.name}</td>
                            <td className="py-2 px-3 text-center font-bold text-slate-700">{u.quantity}</td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-700">{formatFCFA(u.price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* UOA (Achats) */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-amber-600" />
                    Unités Opérationnelles d'Achat (UOA) ({uoaList.length})
                  </h4>
                </div>

                {uoaList.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
                    Aucune UOA spécifique enregistrée. L'achat s'effectue au prix d'achat standard.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                        <tr>
                          <th className="py-2 px-3">Libellé</th>
                          <th className="py-2 px-3 text-center">Quantité ({storageUnit}s)</th>
                          <th className="py-2 px-3 text-right">Prix d'achat (FCFA)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {uoaList.map((u, i) => (
                          <tr key={u.id || i} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-semibold text-slate-800">{u.label || u.name}</td>
                            <td className="py-2 px-3 text-center font-bold text-slate-700">{u.quantity}</td>
                            <td className="py-2 px-3 text-right font-bold text-slate-800">{formatFCFA(u.price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SECTION HISTORIQUE COMPLET DES MOUVEMENTS DE STOCK DU PRODUIT */}
          {activeTab === 'movements' && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center justify-between text-emerald-800">
                    <span className="text-[10px] uppercase font-bold">Total Entrées</span>
                    <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-lg font-black text-emerald-700 mt-1">
                    +{movementStats.totalEntries} {storageUnit}s
                  </div>
                  <span className="text-[10px] text-emerald-600">Approvisionnements & Réceptions</span>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <div className="flex items-center justify-between text-rose-800">
                    <span className="text-[10px] uppercase font-bold">Total Sorties</span>
                    <ArrowUpRight className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="text-lg font-black text-rose-700 mt-1">
                    -{movementStats.totalExits} {storageUnit}s
                  </div>
                  <span className="text-[10px] text-rose-600">Ventes & Pertes</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-[10px] uppercase font-bold">Stock Actuel en Magasin</span>
                    <Boxes className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="text-lg font-black text-[#001F3F] mt-1">
                    {product.stock} {storageUnit}s
                  </div>
                  <span className="text-[10px] text-slate-500">Solde théorique calculé</span>
                </div>
              </div>

              {/* Filters toolbar for movements */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filtrer par motif, réf, opérateur..."
                    value={movementSearch}
                    onChange={(e) => setMovementSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={movementTypeFilter}
                    onChange={(e) => setMovementTypeFilter(e.target.value)}
                    className="w-full sm:w-auto px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
                  >
                    <option value="ALL">Tous les types de mouvement</option>
                    <option value="Entrée">Entrées uniquement</option>
                    <option value="Sortie">Sorties uniquement</option>
                    <option value="Ajustement">Ajustements</option>
                    <option value="Périmé/Casse">Périmé / Casse</option>
                  </select>
                </div>
              </div>

              {/* Movements Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                {filteredMovements.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <History className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-bold text-slate-600">Aucun mouvement de stock trouvé pour ce produit</p>
                    <p className="text-[11px] text-slate-400">
                      Les livraisons validées et ventes de ce produit apparaîtront automatiquement ici.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                          <th className="py-2.5 px-3">Date & Heure</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3 text-center">Quantité</th>
                          <th className="py-2.5 px-3">Motif / Contexte</th>
                          <th className="py-2.5 px-3">Référence Document</th>
                          <th className="py-2.5 px-3">Opérateur</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {filteredMovements.map((m) => {
                          const isEntry = m.type === 'Entrée';
                          const isExit = m.type === 'Sortie' || m.type === 'Périmé/Casse';

                          return (
                            <tr key={m.id} className="hover:bg-slate-50/80">
                              {/* Date */}
                              <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-medium font-mono text-[11px]">
                                {m.date}
                              </td>

                              {/* Type badge */}
                              <td className="py-2.5 px-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  isEntry
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : m.type === 'Sortie'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : m.type === 'Ajustement'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-red-100 text-red-800 border-red-200'
                                }`}>
                                  {isEntry ? (
                                    <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                                  ) : isExit ? (
                                    <ArrowUpRight className="w-3 h-3 text-rose-600" />
                                  ) : null}
                                  <span>{m.type}</span>
                                </span>
                              </td>

                              {/* Quantité */}
                              <td className={`py-2.5 px-3 text-center font-black ${
                                isEntry ? 'text-emerald-700' : isExit ? 'text-rose-700' : 'text-blue-700'
                              }`}>
                                {isEntry ? `+${m.quantity}` : isExit ? `-${m.quantity}` : m.quantity} {storageUnit}s
                              </td>

                              {/* Motif */}
                              <td className="py-2.5 px-3 font-medium text-slate-800 max-w-xs truncate" title={m.reason}>
                                {m.reason}
                              </td>

                              {/* Référence */}
                              <td className="py-2.5 px-3 whitespace-nowrap font-mono text-blue-700 font-semibold text-[11px]">
                                {m.reference || '-'}
                              </td>

                              {/* Opérateur */}
                              <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3 text-slate-400" />
                                  <span>{m.performedBy || 'Système'}</span>
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: Inventaire & Caractéristiques */}
          {activeTab === 'logistics' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-medium">Référence SKU</span>
                  <div className="font-mono font-bold text-blue-700 text-sm mt-0.5">{product.code}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-medium">Code Barre / QR Code</span>
                  <div className="font-mono text-slate-800 text-sm mt-0.5">{product.barcode || 'Non défini'}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-medium">Dernier réapprovisionnement</span>
                  <div className="font-medium text-slate-800 text-sm mt-0.5">{product.lastRestocked || 'Non renseigné'}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-medium">Disponibilité Point de Vente</span>
                  <div className="font-bold text-emerald-700 text-sm mt-0.5">
                    {product.availableInPOS !== false ? 'Oui, vendable en caisse' : 'Non disponible en caisse'}
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-[11px] text-blue-900 leading-relaxed">
                  <strong>Gestion des stocks : </strong>
                  {product.isStockable !== false 
                    ? "Ce produit est suivi en inventaire. Ses entrées, sorties et niveaux d'alerte déclenchent des avertissements."
                    : "Ce produit est configuré comme service / non-stockable. Aucun décompte d'inventaire n'est appliqué."}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-xs text-slate-500">
          <div>
            Fiche produit certifiée • Réf: <span className="font-mono font-semibold text-slate-700">{product.code}</span>
          </div>
          <div className="text-[11px] text-slate-400">
            {movementStats.count} mouvement(s) de stock répertorié(s)
          </div>
        </div>
      </div>
    </div>
  );
};
