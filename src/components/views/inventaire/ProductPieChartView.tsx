import React, { useState } from 'react';
import { 
  PieChart as PieChartIcon, 
  Layers, 
  DollarSign, 
  Store, 
  Archive, 
  TrendingUp,
  Package,
  CheckCircle,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import { Product, ProductCategory } from '../../../types';
import { formatFCFA } from '../../../data/initialData';

interface ProductPieChartViewProps {
  products: Product[];
  categories: ProductCategory[];
  onSelectProductForEdit?: (product: Product) => void;
}

type ChartMetric = 'category-count' | 'category-value' | 'stock-status' | 'pos-availability';

interface SliceData {
  label: string;
  value: number;
  color: string;
  formattedValue: string;
  filterKey: string;
}

const PALETTE = [
  '#2563EB', '#059669', '#D97706', '#7C3AED', '#DC2626',
  '#0891B2', '#DB2777', '#4B5563', '#10B981', '#6366F1'
];

export const ProductPieChartView: React.FC<ProductPieChartViewProps> = ({
  products,
  categories,
  onSelectProductForEdit
}) => {
  const [metric, setMetric] = useState<ChartMetric>('category-count');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  // Compute metrics
  const totalProducts = products.length;
  const totalStockValue = products.reduce((acc, p) => acc + (p.stock * p.buyPrice), 0);
  const posCount = products.filter(p => p.availableInPOS !== false).length;
  const stockableCount = products.filter(p => p.isStockable !== false).length;

  // Build slices data based on active metric
  const slices: SliceData[] = React.useMemo(() => {
    if (metric === 'category-count') {
      const map: { [key: string]: number } = {};
      products.forEach(p => {
        map[p.category] = (map[p.category] || 0) + 1;
      });

      return Object.entries(map).map(([catName, count], idx) => {
        const catObj = categories.find(c => c.name === catName);
        const color = catObj?.color || PALETTE[idx % PALETTE.length];
        return {
          label: catName,
          value: count,
          color,
          formattedValue: `${count} produit${count > 1 ? 's' : ''}`,
          filterKey: catName
        };
      });
    }

    if (metric === 'category-value') {
      const map: { [key: string]: number } = {};
      products.forEach(p => {
        const val = p.stock * p.buyPrice;
        map[p.category] = (map[p.category] || 0) + val;
      });

      return Object.entries(map).map(([catName, val], idx) => {
        const catObj = categories.find(c => c.name === catName);
        const color = catObj?.color || PALETTE[idx % PALETTE.length];
        return {
          label: catName,
          value: val,
          color,
          formattedValue: formatFCFA(val),
          filterKey: catName
        };
      });
    }

    if (metric === 'stock-status') {
      let inStock = 0;
      let lowStock = 0;
      let outOfStock = 0;

      products.forEach(p => {
        if (p.stock <= 0) outOfStock++;
        else if (p.stock <= p.minStock) lowStock++;
        else inStock++;
      });

      return [
        {
          label: 'En Stock Normal',
          value: inStock,
          color: '#10B981',
          formattedValue: `${inStock} produit(s)`,
          filterKey: 'in-stock'
        },
        {
          label: 'Stock Faible (Alerte)',
          value: lowStock,
          color: '#F59E0B',
          formattedValue: `${lowStock} produit(s)`,
          filterKey: 'low-stock'
        },
        {
          label: 'Rupture de Stock',
          value: outOfStock,
          color: '#EF4444',
          formattedValue: `${outOfStock} produit(s)`,
          filterKey: 'out-of-stock'
        }
      ].filter(s => s.value > 0);
    }

    if (metric === 'pos-availability') {
      const available = products.filter(p => p.availableInPOS !== false).length;
      const notAvailable = products.length - available;

      return [
        {
          label: 'Disponible Point de Vente (PV)',
          value: available,
          color: '#2563EB',
          formattedValue: `${available} produit(s)`,
          filterKey: 'pos-yes'
        },
        {
          label: 'Non vendu en caisse (Stock interne/Gros)',
          value: notAvailable,
          color: '#94A3B8',
          formattedValue: `${notAvailable} produit(s)`,
          filterKey: 'pos-no'
        }
      ].filter(s => s.value > 0);
    }

    return [];
  }, [products, categories, metric]);

  const totalSliceValue = slices.reduce((acc, s) => acc + s.value, 0);

  // SVG Pie chart calculation
  const size = 300;
  const center = size / 2;
  const radius = 110;
  const innerRadius = 55; // Donut style for modern clarity

  let accumulatedAngle = 0;
  const arcSegments = slices.map((slice) => {
    const angle = totalSliceValue > 0 ? (slice.value / totalSliceValue) * 360 : 0;
    const startAngle = accumulatedAngle;
    const endAngle = accumulatedAngle + angle;
    accumulatedAngle += angle;

    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);

    const x3 = center + innerRadius * Math.cos(endRad);
    const y3 = center + innerRadius * Math.sin(endRad);
    const x4 = center + innerRadius * Math.cos(startRad);
    const y4 = center + innerRadius * Math.sin(startRad);

    const largeArc = angle > 180 ? 1 : 0;

    // SVG path definition
    const path = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`,
      'Z'
    ].join(' ');

    const percentage = totalSliceValue > 0 ? Math.round((slice.value / totalSliceValue) * 100) : 0;

    return {
      path,
      slice,
      percentage,
      startAngle,
      endAngle
    };
  });

  // Filtered products if user clicked on slice
  const displayedProducts = products.filter(p => {
    if (!selectedFilter) return true;

    if (metric === 'category-count' || metric === 'category-value') {
      return p.category === selectedFilter;
    }
    if (metric === 'stock-status') {
      if (selectedFilter === 'out-of-stock') return p.stock <= 0;
      if (selectedFilter === 'low-stock') return p.stock > 0 && p.stock <= p.minStock;
      if (selectedFilter === 'in-stock') return p.stock > p.minStock;
    }
    if (metric === 'pos-availability') {
      if (selectedFilter === 'pos-yes') return p.availableInPOS !== false;
      if (selectedFilter === 'pos-no') return p.availableInPOS === false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Références</div>
            <div className="text-xl font-bold text-[#001F3F]">{totalProducts}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Valeur Stock (Achat)</div>
            <div className="text-xl font-bold text-emerald-700">{formatFCFA(totalStockValue)}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Disponibles en Caisse (PV)</div>
            <div className="text-xl font-bold text-indigo-700">{posCount} / {totalProducts}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Produits Stockables</div>
            <div className="text-xl font-bold text-amber-700">{stockableCount}</div>
          </div>
        </div>
      </div>

      {/* Camembert Main Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        {/* Metric Switcher Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-[#001F3F] flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-blue-600" />
              <span>Analyse Graphique en Camembert</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Visualisez instantanément la répartition de votre catalogue. Cliquez sur une portion pour filtrer.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs overflow-x-auto">
            <button
              onClick={() => { setMetric('category-count'); setSelectedFilter(null); }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
                metric === 'category-count'
                  ? 'bg-white text-[#001F3F] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Par Catégorie (Qté)
            </button>
            <button
              onClick={() => { setMetric('category-value'); setSelectedFilter(null); }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
                metric === 'category-value'
                  ? 'bg-white text-[#001F3F] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Par Valeur Stock (FCFA)
            </button>
            <button
              onClick={() => { setMetric('stock-status'); setSelectedFilter(null); }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
                metric === 'stock-status'
                  ? 'bg-white text-[#001F3F] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Par Statut Stock
            </button>
            <button
              onClick={() => { setMetric('pos-availability'); setSelectedFilter(null); }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
                metric === 'pos-availability'
                  ? 'bg-white text-[#001F3F] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Par Disponibilité PV
            </button>
          </div>
        </div>

        {/* Chart + Legend Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center pt-6">
          {/* SVG Pie Chart Canvas */}
          <div className="md:col-span-6 flex flex-col items-center justify-center">
            <div className="relative w-[300px] h-[300px]">
              <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="overflow-visible"
              >
                {arcSegments.map((segment, index) => {
                  const isHovered = hoveredIndex === index;
                  const isSelected = selectedFilter === segment.slice.filterKey;

                  return (
                    <g key={index}>
                      <path
                        d={segment.path}
                        fill={segment.slice.color}
                        stroke="#ffffff"
                        strokeWidth={isHovered || isSelected ? "3" : "1.5"}
                        className="cursor-pointer transition-all duration-200"
                        style={{
                          transform: isHovered || isSelected ? 'scale(1.04)' : 'scale(1)',
                          transformOrigin: `${center}px ${center}px`,
                          filter: isHovered ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))' : 'none'
                        }}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        onClick={() => {
                          setSelectedFilter(prev => prev === segment.slice.filterKey ? null : segment.slice.filterKey);
                        }}
                      />
                    </g>
                  );
                })}

                {/* Center Donut Hub */}
                <circle
                  cx={center}
                  cy={center}
                  r={innerRadius - 4}
                  fill="#ffffff"
                  className="pointer-events-none drop-shadow-xs"
                />
              </svg>

              {/* Center Info Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
                {hoveredIndex !== null ? (
                  <>
                    <span className="text-[10px] text-slate-500 font-bold uppercase truncate max-w-[90px]">
                      {slices[hoveredIndex]?.label}
                    </span>
                    <span className="text-base font-extrabold text-[#001F3F]">
                      {arcSegments[hoveredIndex]?.percentage}%
                    </span>
                    <span className="text-[10px] font-semibold text-slate-600 truncate max-w-[100px]">
                      {slices[hoveredIndex]?.formattedValue}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Total</span>
                    <span className="text-sm font-extrabold text-[#001F3F]">
                      {metric === 'category-value' ? formatFCFA(totalStockValue) : totalProducts}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {metric === 'category-value' ? 'Valeur stock' : 'Références'}
                    </span>
                  </>
                )}
              </div>
            </div>

            {selectedFilter && (
              <div className="mt-4 flex items-center gap-2">
                <span className="text-xs text-slate-600">
                  Filtre actif : <strong>{selectedFilter}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedFilter(null)}
                  className="text-xs text-blue-600 hover:underline font-semibold"
                >
                  (Réinitialiser)
                </button>
              </div>
            )}
          </div>

          {/* Slices Legend and Percentages */}
          <div className="md:col-span-6 space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Détail des tranches ({slices.length})
            </h3>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
              {slices.map((slice, idx) => {
                const percentage = totalSliceValue > 0 ? Math.round((slice.value / totalSliceValue) * 100) : 0;
                const isHovered = hoveredIndex === idx;
                const isSelected = selectedFilter === slice.filterKey;

                return (
                  <div
                    key={idx}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => {
                      setSelectedFilter(prev => prev === slice.filterKey ? null : slice.filterKey);
                    }}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/60 shadow-xs'
                        : isHovered
                        ? 'border-slate-300 bg-slate-50'
                        : 'border-slate-100 bg-slate-50/40 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="text-xs font-bold text-slate-800 truncate">
                        {slice.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-slate-600 font-semibold">
                        {slice.formattedValue}
                      </span>
                      <span
                        className="text-xs font-mono font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: slice.color }}
                      >
                        {percentage}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Filtered Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-3">
          <h3 className="text-sm font-bold text-[#001F3F]">
            Articles correspondants ({displayedProducts.length})
          </h3>
          {selectedFilter && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full font-semibold">
              Filtré par : {selectedFilter}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold">
                <th className="py-2.5 px-3">Produit</th>
                <th className="py-2.5 px-3">Catégorie</th>
                <th className="py-2.5 px-3 text-right">Prix Achat</th>
                <th className="py-2.5 px-3 text-right">Prix Vente</th>
                <th className="py-2.5 px-3 text-center">Stock</th>
                <th className="py-2.5 px-3 text-center">Disponible PV</th>
                <th className="py-2.5 px-3 text-center">Stockable</th>
                {onSelectProductForEdit && <th className="py-2.5 px-3 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedProducts.map(p => (
                <tr key={p.id} className="hover:bg-blue-50/40 text-slate-700">
                  <td className="py-2.5 px-3 font-semibold text-slate-900 flex items-center gap-2">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="w-7 h-7 rounded object-cover border border-slate-200" />
                    ) : (
                      <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center font-bold text-[10px] text-slate-500">
                        {p.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div>{p.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">{p.code}</div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                      {p.category}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-600 font-medium">
                    {formatFCFA(p.buyPrice)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                    {formatFCFA(p.sellPrice)}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold">
                    {p.stock} {p.unit}s
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.availableInPOS !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                      {p.availableInPOS !== false ? 'OUI' : 'NON'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.isStockable !== false ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'}`}>
                      {p.isStockable !== false ? 'OUI' : 'NON'}
                    </span>
                  </td>
                  {onSelectProductForEdit && (
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => onSelectProductForEdit(p)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded font-semibold text-[11px]"
                      >
                        Modifier
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
