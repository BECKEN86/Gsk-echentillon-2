import React, { useState, useMemo, useRef } from 'react';
import {
  TrendingUp,
  ArrowUpRight,
  CreditCard,
  Smartphone,
  Banknote,
  Clock} from 'lucide-react';
import { SaleOrder } from '../../types';
import { formatFCFA } from '../../data/initialData';
import { parseAppDate } from '../../utils/dateUtils';

interface MonthlySalesChartProps {
  saleOrders: SaleOrder[];
  onNavigateToSales?: () => void;
}

type ChartType = 'area' | 'bar' | 'breakdown';
type TimeWindow = '6m' | '12m' | 'all';

interface MonthData {
  monthKey: string;
  monthName: string;
  shortLabel: string;
  year: number;
  revenue: number;
  count: number;
  avgBasket: number;
  cash: number;
  mobile: number;
  credit: number;
  card: number;
}

const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const MONTH_SHORT_FR = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'
];

function formatCompactFCFA(val: number): string {
  if (val >= 1_000_000) {
    return `${(val / 1_000_000).toFixed(1).replace('.0', '')}M`;
  }
  if (val >= 1_000) {
    return `${(val / 1_000).toFixed(0)}k`;
  }
  return String(val);
}

// Helper to generate a smooth Bezier SVG path through points
function generateSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];

    // Catmull-Rom to Cubic Bezier conversion
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  return d;
}

export const MonthlySalesChart: React.FC<MonthlySalesChartProps> = ({
  saleOrders,
  onNavigateToSales
}) => {
  const [chartType, setChartType] = useState<ChartType>('area');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('12m');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Traitement et agrégation des données par mois
  const monthlyData = useMemo(() => {
    const validSales = saleOrders.filter(s => s.status !== 'Annulé' && s.status !== 'En cours');

    // Trouver l'horizon temporel
    const dates = validSales
      .map(s => parseAppDate(s.date))
      .filter(d => !isNaN(d.getTime()));

    const now = new Date();
    const referenceDate = dates.length > 0
      ? new Date(Math.max(...dates.map(d => d.getTime()), now.getTime()))
      : now;

    const map = new Map<string, MonthData>();

    // Initialiser les mois récents (pour une continuité visuelle propre)
    const monthsToPrepopulate = timeWindow === '6m' ? 6 : timeWindow === '12m' ? 12 : 12;
    for (let i = monthsToPrepopulate - 1; i >= 0; i--) {
      const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      map.set(key, {
        monthKey: key,
        monthName: `${MONTH_NAMES_FR[m]} ${y}`,
        shortLabel: `${MONTH_SHORT_FR[m]} ${String(y).slice(2)}`,
        year: y,
        revenue: 0,
        count: 0,
        avgBasket: 0,
        cash: 0,
        mobile: 0,
        credit: 0,
        card: 0
      });
    }

    // Agréger chaque commande
    validSales.forEach(sale => {
      const d = parseAppDate(sale.date);
      if (isNaN(d.getTime())) return;

      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;

      if (!map.has(key)) {
        if (timeWindow === 'all') {
          map.set(key, {
            monthKey: key,
            monthName: `${MONTH_NAMES_FR[m]} ${y}`,
            shortLabel: `${MONTH_SHORT_FR[m]} ${String(y).slice(2)}`,
            year: y,
            revenue: 0,
            count: 0,
            avgBasket: 0,
            cash: 0,
            mobile: 0,
            credit: 0,
            card: 0
          });
        } else {
          return; // Hors de la fenêtre choisie
        }
      }

      const item = map.get(key)!;
      const amount = sale.finalAmount || 0;
      item.revenue += amount;
      item.count += 1;

      switch (sale.paymentMethod) {
        case 'Espèces':
          item.cash += amount;
          break;
        case 'Mobile Money':
          item.mobile += amount;
          break;
        case 'Crédit':
          item.credit += amount;
          break;
        case 'Carte':
          item.card += amount;
          break;
        default:
          item.cash += amount;
      }
    });

    // Calculer les paniers moyens et trier chronologiquement
    const list = Array.from(map.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    list.forEach(m => {
      m.avgBasket = m.count > 0 ? Math.round(m.revenue / m.count) : 0;
    });

    return list;
  }, [saleOrders, timeWindow]);

  // Statistiques globales de la période affichée
  const stats = useMemo(() => {
    const totalRev = monthlyData.reduce((acc, m) => acc + m.revenue, 0);
    const totalOrders = monthlyData.reduce((acc, m) => acc + m.count, 0);
    const avgMonthly = monthlyData.length > 0 ? Math.round(totalRev / monthlyData.length) : 0;
    const bestMonth = monthlyData.reduce(
      (best, cur) => (cur.revenue > best.revenue ? cur : best),
      { monthName: 'N/A', revenue: 0, count: 0, avgBasket: 0, cash: 0, mobile: 0, credit: 0, card: 0, monthKey: '', shortLabel: '', year: 0 } as MonthData
    );
    const overallAvgBasket = totalOrders > 0 ? Math.round(totalRev / totalOrders) : 0;

    return {
      totalRev,
      totalOrders,
      avgMonthly,
      bestMonth,
      overallAvgBasket
    };
  }, [monthlyData]);

  // Graph layout dimensions (SVG internal coordinates)
  const svgWidth = 840;
  const svgHeight = 280;
  const paddingLeft = 60;
  const paddingRight = 24;
  const paddingTop = 20;
  const paddingBottom = 40;

  const chartW = svgWidth - paddingLeft - paddingRight;
  const chartH = svgHeight - paddingTop - paddingBottom;

  const maxRevenue = useMemo(() => {
    const maxVal = Math.max(...monthlyData.map(m => m.revenue), 1000);
    // Round up to nice number
    const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
    return Math.ceil((maxVal * 1.15) / magnitude) * magnitude;
  }, [monthlyData]);

  // Y-axis ticks
  const yTicks = useMemo(() => {
    const count = 4;
    const ticks: number[] = [];
    for (let i = 0; i <= count; i++) {
      ticks.push(Math.round((maxRevenue / count) * i));
    }
    return ticks;
  }, [maxRevenue]);

  // Points coordinates calculation
  const dataPoints = useMemo(() => {
    const n = monthlyData.length;
    if (n === 0) return [];
    return monthlyData.map((d, index) => {
      const x = n === 1 
        ? paddingLeft + chartW / 2 
        : paddingLeft + (index / (n - 1)) * chartW;
      const yRatio = d.revenue / maxRevenue;
      const y = paddingTop + chartH - yRatio * chartH;
      return { x, y, data: d, index };
    });
  }, [monthlyData, maxRevenue, chartW, chartH, paddingLeft, paddingTop]);

  // Area path
  const areaPath = useMemo(() => {
    if (dataPoints.length === 0) return '';
    const smoothLine = generateSmoothPath(dataPoints);
    const firstPoint = dataPoints[0];
    const lastPoint = dataPoints[dataPoints.length - 1];
    const bottomY = paddingTop + chartH;
    return `${smoothLine} L ${lastPoint.x.toFixed(1)} ${bottomY} L ${firstPoint.x.toFixed(1)} ${bottomY} Z`;
  }, [dataPoints, paddingTop, chartH]);

  const linePath = useMemo(() => {
    if (dataPoints.length === 0) return '';
    return generateSmoothPath(dataPoints);
  }, [dataPoints]);

  // Handle Mouse Hover on SVG
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || dataPoints.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const scaleX = svgWidth / rect.width;
    const svgX = clientX * scaleX;

    // Find nearest point
    let closestIdx = 0;
    let minDist = Infinity;
    dataPoints.forEach((p, idx) => {
      const dist = Math.abs(p.x - svgX);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    });

    setHoveredIndex(closestIdx);
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  const activeData = hoveredIndex !== null && dataPoints[hoveredIndex] ? dataPoints[hoveredIndex].data : null;
  const activePoint = hoveredIndex !== null && dataPoints[hoveredIndex] ? dataPoints[hoveredIndex] : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 lg:p-6 shadow-xs space-y-6">
      {/* En-tête : Titre & Contrôles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100 shadow-xs">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#001F3F]">
                Évolution Mensuelle des Ventes
              </h2>
              <p className="text-xs text-slate-500">
                Visualisation dynamique du chiffre d'affaires et des modes d'encaissement
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sélecteur de période */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs">
            <button
              onClick={() => { setTimeWindow('6m'); setHoveredIndex(null); }}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                timeWindow === '6m'
                  ? 'bg-white text-[#001F3F] shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              6 mois
            </button>
            <button
              onClick={() => { setTimeWindow('12m'); setHoveredIndex(null); }}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                timeWindow === '12m'
                  ? 'bg-white text-[#001F3F] shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              12 mois
            </button>
            <button
              onClick={() => { setTimeWindow('all'); setHoveredIndex(null); }}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                timeWindow === 'all'
                  ? 'bg-white text-[#001F3F] shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Historique complet
            </button>
          </div>

          {/* Type de vue graphique */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs">
            <button
              onClick={() => setChartType('area')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                chartType === 'area'
                  ? 'bg-[#001F3F] text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Courbe en aires lissée"
            >
              Courbe
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                chartType === 'bar'
                  ? 'bg-[#001F3F] text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Histogramme"
            >
              Barres
            </button>
            <button
              onClick={() => setChartType('breakdown')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                chartType === 'breakdown'
                  ? 'bg-[#001F3F] text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Ventilation par mode de paiement"
            >
              Règlements
            </button>
          </div>
        </div>
      </div>

      {/* Cartes statistiques condensées */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Période
          </div>
          <div className="text-lg font-bold text-[#001F3F] mt-0.5">
            {formatFCFA(stats.totalRev)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Sur {monthlyData.length} mois affichés
          </div>
        </div>

        <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Moyenne Mensuelle
          </div>
          <div className="text-lg font-bold text-blue-700 mt-0.5">
            {formatFCFA(stats.avgMonthly)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Régularité du chiffre d'affaires
          </div>
        </div>

        <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Meilleur Mois
          </div>
          <div className="text-lg font-bold text-emerald-700 mt-0.5 truncate">
            {stats.bestMonth.revenue > 0 ? formatFCFA(stats.bestMonth.revenue) : '0 FCFA'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 truncate">
            {stats.bestMonth.revenue > 0 ? stats.bestMonth.monthName : 'Aucune vente'}
          </div>
        </div>

        <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Panier Moyen
          </div>
          <div className="text-lg font-bold text-purple-700 mt-0.5">
            {formatFCFA(stats.overallAvgBasket)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {stats.totalOrders} commande{stats.totalOrders > 1 ? 's' : ''} au total
          </div>
        </div>
      </div>

      {/* Légende pour le mode Règlements */}
      {chartType === 'breakdown' && (
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs pt-1 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block"></span>
            <span className="text-slate-600 font-medium">Espèces</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-blue-500 inline-block"></span>
            <span className="text-slate-600 font-medium">Mobile Money</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-amber-500 inline-block"></span>
            <span className="text-slate-600 font-medium">Crédit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-purple-500 inline-block"></span>
            <span className="text-slate-600 font-medium">Carte</span>
          </div>
        </div>
      )}

      {/* Conteneur Graphique SVG Interactif et Responsive */}
      <div className="relative w-full pt-1">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-64 sm:h-72 select-none overflow-visible"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.45" />
              <stop offset="70%" stopColor="#2563EB" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>
          </defs>

          {/* Lignes de repère horizontales (Y-axis grid) */}
          {yTicks.map((tick, i) => {
            const y = paddingTop + chartH - (tick / maxRevenue) * chartH;
            return (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={svgWidth - paddingRight}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-400 font-sans"
                  fontSize="11"
                >
                  {formatCompactFCFA(tick)}
                </text>
              </g>
            );
          })}

          {/* Ligne d'axe X */}
          <line
            x1={paddingLeft}
            y1={paddingTop + chartH}
            x2={svgWidth - paddingRight}
            y2={paddingTop + chartH}
            stroke="#CBD5E1"
            strokeWidth="1.2"
          />

          {/* Type : COURBE (AREA) */}
          {chartType === 'area' && (
            <>
              {/* Aire colorée */}
              {areaPath && (
                <path
                  d={areaPath}
                  fill="url(#salesGradient)"
                  className="transition-all duration-300"
                />
              )}

              {/* Ligne de contour */}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#1D4ED8"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Points sur la courbe */}
              {dataPoints.map((p, idx) => {
                const isHovered = hoveredIndex === idx;
                return (
                  <circle
                    key={idx}
                    cx={p.x}
                    cy={p.y}
                    r={isHovered ? 6 : 4}
                    fill={isHovered ? '#001F3F' : '#2563EB'}
                    stroke={isHovered ? '#93C5FD' : '#FFFFFF'}
                    strokeWidth={isHovered ? 2.5 : 2}
                    className="transition-all duration-150 cursor-pointer"
                  />
                );
              })}
            </>
          )}

          {/* Type : BARRES (BAR CHART) */}
          {chartType === 'bar' && (
            <>
              {dataPoints.map((p, idx) => {
                const n = dataPoints.length;
                const slotWidth = chartW / n;
                const barWidth = Math.min(Math.max(slotWidth * 0.55, 12), 44);
                const barX = p.x - barWidth / 2;
                const barHeight = Math.max((p.data.revenue / maxRevenue) * chartH, 2);
                const barY = paddingTop + chartH - barHeight;
                const isHovered = hoveredIndex === idx;

                return (
                  <g key={idx} className="cursor-pointer">
                    <rect
                      x={barX}
                      y={barY}
                      width={barWidth}
                      height={barHeight}
                      rx={4}
                      fill={isHovered ? '#001F3F' : 'url(#barGradient)'}
                      className="transition-all duration-150"
                    />
                  </g>
                );
              })}
            </>
          )}

          {/* Type : RÈGLEMENTS (STACKED BAR BREAKDOWN) */}
          {chartType === 'breakdown' && (
            <>
              {dataPoints.map((p, idx) => {
                const n = dataPoints.length;
                const slotWidth = chartW / n;
                const barWidth = Math.min(Math.max(slotWidth * 0.55, 12), 44);
                const barX = p.x - barWidth / 2;
                const isHovered = hoveredIndex === idx;

                const d = p.data;
                const baseY = paddingTop + chartH;

                let currentY = baseY;

                // Segments: cash, mobile, credit, card
                const segments = [
                  { key: 'cash', val: d.cash, color: '#10B981' },
                  { key: 'mobile', val: d.mobile, color: '#3B82F6' },
                  { key: 'credit', val: d.credit, color: '#F59E0B' },
                  { key: 'card', val: d.card, color: '#8B5CF6' }
                ];

                return (
                  <g key={idx} opacity={hoveredIndex === null || isHovered ? 1 : 0.65} className="cursor-pointer">
                    {d.revenue === 0 ? (
                      <rect
                        x={barX}
                        y={baseY - 2}
                        width={barWidth}
                        height={2}
                        fill="#E2E8F0"
                        rx={1}
                      />
                    ) : (
                      segments.map((seg, sIdx) => {
                        if (seg.val <= 0) return null;
                        const segHeight = (seg.val / maxRevenue) * chartH;
                        currentY -= segHeight;
                        const isTop = sIdx === segments.filter(s => s.val > 0).length - 1;

                        return (
                          <rect
                            key={seg.key}
                            x={barX}
                            y={currentY}
                            width={barWidth}
                            height={segHeight}
                            fill={seg.color}
                            rx={isTop ? 4 : 0}
                          />
                        );
                      })
                    )}
                  </g>
                );
              })}
            </>
          )}

          {/* Ligne repère verticale active au survol */}
          {activePoint && (
            <line
              x1={activePoint.x}
              y1={paddingTop}
              x2={activePoint.x}
              y2={paddingTop + chartH}
              stroke="#001F3F"
              strokeDasharray="4 4"
              strokeWidth="1.5"
              opacity="0.6"
            />
          )}

          {/* Libellés de l'axe X (Mois) */}
          {dataPoints.map((p, idx) => {
            const isHovered = hoveredIndex === idx;
            return (
              <text
                key={idx}
                x={p.x}
                y={svgHeight - 12}
                textAnchor="middle"
                fontSize="11"
                className={`transition-colors font-sans select-none ${
                  isHovered ? 'fill-[#001F3F] font-bold text-xs' : 'fill-slate-500 font-medium'
                }`}
              >
                {p.data.shortLabel}
              </text>
            );
          })}
        </svg>

        {/* Info-bulle flottante au survol (Tooltip) */}
        {activeData && activePoint && (
          <div
            className="absolute z-30 pointer-events-none transition-all duration-75"
            style={{
              left: `${(activePoint.x / svgWidth) * 100}%`,
              top: '15px',
              transform: activePoint.x > svgWidth * 0.7 ? 'translateX(-105%)' : 'translateX(10%)'
            }}
          >
            <div className="bg-[#001F3F] text-white p-3.5 rounded-xl shadow-xl border border-blue-900/60 text-xs min-w-[210px] space-y-2">
              <div className="border-b border-blue-900/80 pb-1.5 flex items-center justify-between">
                <span className="font-bold text-blue-200">{activeData.monthName}</span>
                <span className="text-[10px] bg-blue-500/20 px-2 py-0.5 rounded text-blue-300 font-medium">
                  {activeData.count} vente{activeData.count > 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Chiffre d'Affaires :</span>
                  <span className="font-bold text-emerald-400 text-sm">{formatFCFA(activeData.revenue)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Panier Moyen :</span>
                  <span className="font-semibold text-slate-200">{formatFCFA(activeData.avgBasket)}</span>
                </div>
              </div>

              {/* Ventilation par moyen de paiement */}
              {activeData.revenue > 0 && (
                <div className="pt-2 border-t border-blue-900/80 space-y-1 text-[10px]">
                  <div className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">
                    Modes de règlement
                  </div>
                  {activeData.cash > 0 && (
                    <div className="flex items-center justify-between text-emerald-300">
                      <span className="flex items-center gap-1">
                        <Banknote className="w-3 h-3" /> Espèces :
                      </span>
                      <span>{formatFCFA(activeData.cash)}</span>
                    </div>
                  )}
                  {activeData.mobile > 0 && (
                    <div className="flex items-center justify-between text-blue-300">
                      <span className="flex items-center gap-1">
                        <Smartphone className="w-3 h-3" /> Mobile Money :
                      </span>
                      <span>{formatFCFA(activeData.mobile)}</span>
                    </div>
                  )}
                  {activeData.credit > 0 && (
                    <div className="flex items-center justify-between text-amber-300">
                      <span className="flex items-center gap-1">
                        <CreditCard className="w-3 h-3" /> Crédit :
                      </span>
                      <span>{formatFCFA(activeData.credit)}</span>
                    </div>
                  )}
                  {activeData.card > 0 && (
                    <div className="flex items-center justify-between text-indigo-300">
                      <span className="flex items-center gap-1">
                        <CreditCard className="w-3 h-3" /> Carte bancaire :
                      </span>
                      <span>{formatFCFA(activeData.card)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pied du graphique avec lien rapide */}
      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 text-slate-500">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Données calculées en temps réel à partir des commandes validées</span>
        </div>
        {onNavigateToSales && (
          <button
            onClick={onNavigateToSales}
            className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 transition-colors"
          >
            Consulter le journal des ventes <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
