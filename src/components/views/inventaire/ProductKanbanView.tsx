import React, { useState } from 'react';
import { 
  Package, 
  AlertTriangle, 
  CheckCircle, 
  Edit3, 
  Trash2, 
  Barcode, 
  ShoppingBag, 
  Truck,
  CheckSquare,
  Square,
  Layers,
  ArrowUpDown,
  Eye
} from 'lucide-react';
import { Product, ProductCategory } from '../../../types';
import { formatFCFA } from '../../../data/initialData';

interface ProductKanbanViewProps {
  products: Product[];
  categories: ProductCategory[];
  selectedCategory: string;
  selectedProductIds: string[];
  onToggleSelectProduct: (id: string) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (product: Product) => void;
  onViewProductDetail?: (product: Product) => void;
}

type GroupByMode = 'category' | 'stockStatus';

export const ProductKanbanView: React.FC<ProductKanbanViewProps> = ({
  products,
  categories,
  selectedCategory,
  selectedProductIds,
  onToggleSelectProduct,
  onEditProduct,
  onDeleteProduct,
  onViewProductDetail,
}) => {
  const [groupBy, setGroupBy] = useState<GroupByMode>('category');

  // Columns definition based on groupBy
  let columns: { id: string; title: string; color: string; products: Product[] }[] = [];

  if (groupBy === 'category') {
    // If a category is selected (not 'Tous'), only that category is displayed or all
    const relevantCategories = selectedCategory === 'Tous'
      ? categories
      : categories.filter(c => c.name === selectedCategory);

    columns = relevantCategories.map(cat => ({
      id: cat.id,
      title: cat.name,
      color: cat.color || '#2563eb',
      products: products.filter(p => p.category === cat.name || p.categoryId === cat.id)
    }));

    // Check for products in other categories
    const otherProducts = products.filter(
      p => !relevantCategories.some(c => c.name === p.category || c.id === p.categoryId)
    );
    if (otherProducts.length > 0 && selectedCategory === 'Tous') {
      columns.push({
        id: 'other',
        title: 'Autres Catégories',
        color: '#64748b',
        products: otherProducts
      });
    }
  } else {
    // Group by Stock Status
    columns = [
      {
        id: 'in_stock',
        title: 'En Stock Normal',
        color: '#10b981',
        products: products.filter(p => p.isStockable !== false && p.stock > p.minStock)
      },
      {
        id: 'low_stock',
        title: 'Stock Faible / Alerte',
        color: '#f59e0b',
        products: products.filter(p => p.isStockable !== false && p.stock > 0 && p.stock <= p.minStock)
      },
      {
        id: 'out_of_stock',
        title: 'Rupture de Stock',
        color: '#ef4444',
        products: products.filter(p => p.isStockable !== false && p.stock <= 0)
      },
      {
        id: 'non_stockable',
        title: 'Non Stockable / Services',
        color: '#6366f1',
        products: products.filter(p => p.isStockable === false)
      }
    ];
  }

  return (
    <div className="space-y-4">
      {/* Kanban Sub-Toolbar (Grouping Selector & Counts) */}
      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-600">Grouper les colonnes par :</span>
          <div className="inline-flex rounded-lg bg-white border border-slate-200 p-0.5">
            <button
              type="button"
              onClick={() => setGroupBy('category')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                groupBy === 'category'
                  ? 'bg-[#001F3F] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Catégories ({categories.length})
            </button>
            <button
              type="button"
              onClick={() => setGroupBy('stockStatus')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                groupBy === 'stockStatus'
                  ? 'bg-[#001F3F] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Statut de Stock
            </button>
          </div>
        </div>

        <div className="text-slate-500 font-medium hidden sm:block">
          Total : <strong className="text-slate-800">{products.length}</strong> produit(s) affiché(s)
        </div>
      </div>

      {/* Kanban Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-start">
        {columns.map(col => {
          const totalStockValue = col.products.reduce((sum, p) => sum + (p.sellPrice * (p.stock || 0)), 0);

          return (
            <div
              key={col.id}
              className="bg-slate-50/70 border border-slate-200 rounded-2xl flex flex-col max-h-[800px] shadow-2xs"
            >
              {/* Column Header */}
              <div className="p-3.5 border-b border-slate-200 bg-white rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: col.color }}
                  />
                  <h3 className="font-bold text-slate-800 text-xs truncate">
                    {col.title}
                  </h3>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-mono text-[11px] font-bold">
                    {col.products.length}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-medium text-right shrink-0">
                  {col.products.length > 0 && formatFCFA(totalStockValue)}
                </div>
              </div>

              {/* Column Cards Container */}
              <div className="p-3 space-y-3 overflow-y-auto flex-1">
                {col.products.length === 0 ? (
                  <div className="py-8 px-4 text-center text-slate-400 text-xs italic bg-white/50 border border-dashed border-slate-200 rounded-xl">
                    Aucun produit dans cette colonne
                  </div>
                ) : (
                  col.products.map(product => {
                    const isSelected = selectedProductIds.includes(product.id);
                    const isLowStock = product.isStockable !== false && product.stock <= product.minStock;
                    const isOutOfStock = product.isStockable !== false && product.stock <= 0;
                    const storageUnit = product.storageUnit || product.unit || 'sac';
                    const measurementUnit = product.measurementUnit || 'kg';

                    return (
                      <div
                        key={product.id}
                        className={`bg-white border rounded-xl p-3 shadow-2xs transition-all hover:shadow-md ${
                          isSelected
                            ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/20'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Card Top: Checkbox, Code, Image & Name */}
                        <div className="flex items-start gap-2.5">
                          <button
                            type="button"
                            onClick={() => onToggleSelectProduct(product.id)}
                            className="mt-0.5 text-slate-400 hover:text-blue-600 shrink-0"
                            title="Sélectionner le produit"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                          </button>

                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                              />
                            ) : (
                              <span className="font-bold text-[11px] text-slate-500">
                                {product.name.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-mono text-blue-700 font-bold flex items-center gap-0.5">
                                <Barcode className="w-3 h-3 text-slate-400" />
                                {product.code}
                              </span>
                              {product.availableInPOS !== false && (
                                <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-bold border border-emerald-200">
                                  PV
                                </span>
                              )}
                            </div>
                            <h4 
                              onClick={() => (onViewProductDetail ? onViewProductDetail(product) : onEditProduct(product))}
                              className="font-bold text-slate-800 text-xs leading-snug line-clamp-2 hover:text-blue-700 cursor-pointer mt-0.5"
                              title={`${product.name} (cliquer pour voir les détails)`}
                            >
                              {product.name}
                            </h4>
                          </div>
                        </div>

                        {/* Units Details */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 gap-1 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-medium capitalize" title="Unité de stockage">
                              Stockage: <strong>{storageUnit}</strong>
                            </span>
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium" title="Unité de mesure">
                              Mesure: <strong>{measurementUnit}</strong>
                            </span>
                          </div>

                          {product.operationalUnits && product.operationalUnits.length > 0 && (
                            <span className="text-emerald-700 font-bold text-[10px] flex items-center gap-0.5 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                              <Layers className="w-2.5 h-2.5" />
                              {product.operationalUnits.length} UO
                            </span>
                          )}
                        </div>

                        {/* Stock & Prices */}
                        <div className="mt-2 bg-slate-50 p-2 rounded-lg flex items-center justify-between text-xs">
                          <div>
                            <div className="text-[10px] text-slate-400 font-medium">Prix Vente</div>
                            <div className="font-bold text-emerald-700">
                              {formatFCFA(product.sellPrice)}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-[10px] text-slate-400 font-medium">Stock Réserve</div>
                            {product.isStockable !== false ? (
                              <div className={`font-bold flex items-center justify-end gap-1 ${
                                isOutOfStock
                                  ? 'text-red-600'
                                  : isLowStock
                                  ? 'text-amber-600'
                                  : 'text-slate-800'
                              }`}>
                                {isLowStock && <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />}
                                <span>{product.stock} {storageUnit}s</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Service</span>
                            )}
                          </div>
                        </div>

                        {/* Card Footer: Quick Actions */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">
                            Achat: {formatFCFA(product.buyPrice)}
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => (onViewProductDetail ? onViewProductDetail(product) : onEditProduct(product))}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Voir les détails du produit"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onEditProduct(product)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Modifier la fiche produit"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteProduct(product)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Supprimer ce produit"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
