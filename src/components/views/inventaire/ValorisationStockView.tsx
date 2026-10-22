import React, { useMemo, useState } from 'react';
import {
  Calculator,
  RefreshCw,
  Printer,
  FileSpreadsheet,
  FileDown,
  History,
  AlertTriangle,
  Package,
  Boxes,
  Coins,
  PackageX,
  Search,
  Lock,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  X,
  Eye,
  Trash2,
  Scale,
  GitCompare
} from 'lucide-react';
import {
  Product,
  ProductCategory,
  StockMovement,
  ApprovisionnementRecord,
  GoodsReception,
  SaleOrder,
  StorageSite,
  CompanyConfig,
  UserAccount,
  ValuationMethod,
  StockValuationLine,
  StockValuationRecord,
  PhysicalInventory,
  StockAdjustment,
  StockTransfer,
  CustomerReturn,
  SupplierReturn
} from '../../../types';
import { formatFCFA } from '../../../data/initialData';
import { formatAppDate, formatAppDateTime } from '../../../utils/dateUtils';
import { computeStockValuation, VALUATION_METHOD_LABELS } from '../../../utils/stockValuation';
import { withProfessionalPrintBranding } from '../../../utils/professionalPrint';

const PAGE_SIZE = 25;

type SortKey = 'productCode' | 'productName' | 'category' | 'depot' | 'quantity' | 'unitCost' | 'totalValue';

interface ValorisationStockViewProps {
  products: Product[];
  categories: ProductCategory[];
  movements: StockMovement[];
  approvisionnements: ApprovisionnementRecord[];
  receptions: GoodsReception[];
  saleOrders: SaleOrder[];
  storageSites: StorageSite[];
  valuations: StockValuationRecord[];
  inventories?: PhysicalInventory[];
  stockAdjustments?: StockAdjustment[];
  stockTransfers?: StockTransfer[];
  customerReturns?: CustomerReturn[];
  supplierReturns?: SupplierReturn[];
  companyConfig: CompanyConfig | null;
  currentUser: UserAccount | null;
  onSaveValuation: (rec: Omit<StockValuationRecord, 'id' | 'code'>) => void;
  onDeleteValuation?: (id: string) => void;
}

export const ValorisationStockView: React.FC<ValorisationStockViewProps> = ({
  products,
  categories,
  movements,
  approvisionnements,
  receptions,
  saleOrders,
  storageSites,
  valuations,
  inventories = [],
  stockAdjustments = [],
  stockTransfers = [],
  customerReturns = [],
  supplierReturns = [],
  companyConfig,
  currentUser,
  onSaveValuation,
  onDeleteValuation
}) => {
  // --- Filtres ---
  const [valuationDate, setValuationDate] = useState(formatAppDate());
  const [depotFilter, setDepotFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [method, setMethod] = useState<ValuationMethod>('CUMP_PERPETUEL');

  // --- Résultats du calcul ---
  const [allLines, setAllLines] = useState<StockValuationLine[] | null>(null);
  const [computedMeta, setComputedMeta] = useState<{ date: string; method: ValuationMethod } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('totalValue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  // --- Historique ---
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<StockValuationRecord | null>(null);
  const [confirmCloseValuation, setConfirmCloseValuation] = useState(false);

  const depotOptions = useMemo(() => {
    const names = new Set<string>();
    storageSites.forEach(s => s.name && names.add(s.name));
    products.forEach(p => p.location && names.add(p.location));
    return Array.from(names).sort();
  }, [storageSites, products]);

  /** Lance le calcul sur tout le catalogue, les filtres s'appliquent ensuite en lecture */
  const runCalculation = () => {
    const lines = computeStockValuation({
      products,
      movements,
      approvisionnements,
      receptions,
      saleOrders,
      inventories,
      stockAdjustments,
      stockTransfers,
      customerReturns,
      supplierReturns,
      valuationDate,
      method
    });
    setAllLines(lines);
    setComputedMeta({ date: valuationDate, method });
    setPage(1);
  };

  // Calcul initial au chargement
  React.useEffect(() => {
    if (allLines === null) runCalculation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Application des filtres d'affichage ---
  const filteredLines = useMemo(() => {
    if (!allLines) return [];
    const term = searchTerm.trim().toLowerCase();
    return allLines.filter(l => {
      if (depotFilter !== 'ALL' && l.depot !== depotFilter) return false;
      if (categoryFilter !== 'ALL' && l.category !== categoryFilter) return false;
      if (term && !l.productName.toLowerCase().includes(term) && !l.productCode.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [allLines, depotFilter, categoryFilter, searchTerm]);

  const sortedLines = useMemo(() => {
    const arr = [...filteredLines];
    arr.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va ?? '').localeCompare(String(vb ?? ''), 'fr');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filteredLines, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sortedLines.length / PAGE_SIZE));
  const pagedLines = sortedLines.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // --- Réconciliation : stock réel (fiche produit) vs stock théorique (mouvements) ---
  // L'écart n'a de sens que lorsque la valorisation porte sur la date du jour.
  const liveStockById = useMemo(() => new Map(products.map(p => [p.id, p.stock])), [products]);
  const isTodayValuation = computedMeta?.date === formatAppDate();

  // --- Indicateurs ---
  const stats = useMemo(() => ({
    articleCount: filteredLines.length,
    totalQuantity: filteredLines.reduce((s, l) => s + l.quantity, 0),
    totalValue: filteredLines.reduce((s, l) => s + l.totalValue, 0),
    ruptureCount: filteredLines.filter(l => l.quantity <= 0).length,
    anomalyCount: filteredLines.filter(l => l.hasAnomaly || l.quantity < 0).length,
    ecartCount: isTodayValuation
      ? filteredLines.filter(l => (liveStockById.get(l.productId) ?? 0) !== l.quantity).length
      : 0
  }), [filteredLines, isTodayValuation, liveStockById]);

  const hasInsufficientHistory = useMemo(
    () => filteredLines.some(l => l.anomalyNote?.includes('Aucun mouvement')),
    [filteredLines]
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  // --- Sous-totaux par famille et dépôt (pour l'état imprimé) ---
  const subtotalBy = (lines: StockValuationLine[], key: 'category' | 'depot') => {
    const map = new Map<string, { qty: number; value: number }>();
    lines.forEach(l => {
      const e = map.get(l[key]) || { qty: 0, value: 0 };
      e.qty += l.quantity;
      e.value += l.totalValue;
      map.set(l[key], e);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  };

  const buildReportHtml = (lines: StockValuationLine[], meta: { date: string; method: ValuationMethod }, record?: StockValuationRecord) => {
    const depotLabel = record ? record.depotFilter : depotFilter;
    const catLabel = record ? record.categoryFilter : categoryFilter;
    const total = lines.reduce((s, l) => s + l.totalValue, 0);
    const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
    const famSubs = subtotalBy(lines, 'category');
    const depSubs = subtotalBy(lines, 'depot');

    const rows = lines.map(l => `
      <tr>
        <td class="mono">${l.productCode}</td>
        <td>${l.productName}</td>
        <td>${l.category}</td>
        <td>${l.depot}</td>
        <td>${l.unit}</td>
        <td class="num ${l.quantity < 0 ? 'neg' : ''}">${l.quantity}</td>
        <td class="num">${formatFCFA(l.unitCost)}${l.costEstimated ? ' *' : ''}</td>
        <td class="num bold">${formatFCFA(l.totalValue)}</td>
        <td>${l.lastMovementDate || '-'}</td>
      </tr>`).join('');

    const famRows = famSubs.map(([k, v]) => `<tr><td>${k}</td><td class="num">${v.qty}</td><td class="num">${formatFCFA(v.value)}</td></tr>`).join('');
    const depRows = depSubs.map(([k, v]) => `<tr><td>${k}</td><td class="num">${v.qty}</td><td class="num">${formatFCFA(v.value)}</td></tr>`).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Valorisation du stock</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: Arial, sans-serif; color: #0f172a; font-size: 11px; margin: 0; }
  .header { display: flex; justify-content: space-between; border-bottom: 3px solid #001F3F; padding-bottom: 10px; margin-bottom: 14px; }
  .company { font-size: 17px; font-weight: 800; color: #001F3F; }
  .sub { color: #64748b; font-size: 10px; }
  h1 { font-size: 16px; text-transform: uppercase; color: #001F3F; margin: 8px 0 4px; }
  .meta { display: flex; gap: 24px; flex-wrap: wrap; font-size: 10px; margin-bottom: 10px; }
  .meta b { color: #001F3F; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #001F3F; color: #fff; padding: 6px; text-align: left; font-size: 10px; text-transform: uppercase; }
  td { padding: 5px 6px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .bold { font-weight: 700; }
  .neg { color: #dc2626; font-weight: 700; }
  .mono { font-family: monospace; }
  .totals { display: flex; gap: 20px; margin-top: 12px; }
  .tbox { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 14px; }
  .tbox .lbl { font-size: 9px; text-transform: uppercase; color: #64748b; }
  .tbox .val { font-size: 15px; font-weight: 800; color: #001F3F; }
  .subtables { display: flex; gap: 24px; margin-top: 14px; }
  .subtables table { width: auto; min-width: 260px; }
  .subtables th { background: #334155; }
  .warn { margin-top: 12px; padding: 8px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; font-size: 10px; }
  .foot { margin-top: 18px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
</style></head><body>
  <div class="header">
    <div>
      <div class="company">${companyConfig?.name || 'GeStock'}</div>
      <div class="sub">${companyConfig?.address || ''} ${companyConfig?.phone ? '• ' + companyConfig.phone : ''}</div>
      <div class="sub">${companyConfig?.rccm ? 'RCCM : ' + companyConfig.rccm : ''} ${companyConfig?.ncc ? '• NCC : ' + companyConfig.ncc : ''}</div>
    </div>
    <div style="text-align:right">
      <div class="sub">Édité le ${formatAppDateTime()}</div>
      <div class="sub">Par ${currentUser?.name || 'Système'}</div>
      ${record ? `<div class="sub">État clôturé : <b>${record.code}</b></div>` : ''}
    </div>
  </div>
  <h1>État de valorisation du stock</h1>
  <div class="meta">
    <span>Date de valorisation : <b>${meta.date}</b></span>
    <span>Dépôt : <b>${depotLabel === 'ALL' ? 'Tous les dépôts' : depotLabel}</b></span>
    <span>Famille : <b>${catLabel === 'ALL' ? 'Toutes' : catLabel}</b></span>
    <span>Méthode : <b>${VALUATION_METHOD_LABELS[meta.method]}</b></span>
  </div>
  <table>
    <thead><tr>
      <th>Code</th><th>Désignation</th><th>Famille</th><th>Dépôt</th><th>Unité</th>
      <th class="num">Qté stock</th><th class="num">Coût unitaire</th><th class="num">Valeur totale</th><th>Dernier mouvement</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div class="tbox"><div class="lbl">Articles</div><div class="val">${lines.length}</div></div>
    <div class="tbox"><div class="lbl">Quantité totale</div><div class="val">${totalQty}</div></div>
    <div class="tbox"><div class="lbl">Valeur totale du stock</div><div class="val">${formatFCFA(total)}</div></div>
  </div>
  <div class="subtables">
    <div><h1 style="font-size:11px">Sous-totaux par famille</h1>
      <table><thead><tr><th>Famille</th><th class="num">Quantité</th><th class="num">Valeur</th></tr></thead><tbody>${famRows}</tbody></table></div>
    <div><h1 style="font-size:11px">Sous-totaux par dépôt</h1>
      <table><thead><tr><th>Dépôt</th><th class="num">Quantité</th><th class="num">Valeur</th></tr></thead><tbody>${depRows}</tbody></table></div>
  </div>
  ${lines.some(l => l.costEstimated) ? '<div class="warn">(*) Coût estimé : certaines entrées n\'ont pas de coût historique enregistré, le prix d\'achat de la fiche produit a été utilisé.</div>' : ''}
  <div class="foot">
    <span>Document généré par GeStock — ${formatAppDateTime()}</span>
    <span>Signature : ______________________</span>
  </div>
  <script>window.onload = () => { window.print(); }<\/script>
</body></html>`;
  };

  const openReport = (lines: StockValuationLine[], meta: { date: string; method: ValuationMethod }, record?: StockValuationRecord) => {
    const w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) return;
    w.document.write(withProfessionalPrintBranding(buildReportHtml(lines, meta, record), companyConfig));
    w.document.close();
  };

  const handlePrint = () => {
    if (!computedMeta || filteredLines.length === 0) return;
    openReport(filteredLines, computedMeta);
  };

  const handleExportExcel = () => {
    if (!computedMeta || filteredLines.length === 0) return;
    const sep = ';';
    const header = ['Code', 'Désignation', 'Famille', 'Dépôt', 'Unité', 'Qté stock', 'Coût unitaire', 'Valeur totale', 'Dernier mouvement', 'Méthode'];
    const rows = filteredLines.map(l => [
      l.productCode, l.productName, l.category, l.depot, l.unit,
      l.quantity, l.unitCost, l.totalValue, l.lastMovementDate || '', VALUATION_METHOD_LABELS[l.method]
    ]);
    rows.push([]);
    rows.push(['', '', '', '', '', stats.totalQuantity, '', stats.totalValue, '', 'TOTAL GÉNÉRAL']);
    const csv = '﻿' + [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(sep)).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `valorisation-stock-${computedMeta.date}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleCloseValuation = () => {
    if (!computedMeta || !allLines) return;
    onSaveValuation({
      valuationDate: computedMeta.date,
      method: computedMeta.method,
      depotFilter,
      categoryFilter,
      lines: filteredLines,
      articleCount: stats.articleCount,
      totalQuantity: stats.totalQuantity,
      totalValue: stats.totalValue,
      ruptureCount: stats.ruptureCount,
      anomalyCount: stats.anomalyCount,
      createdBy: currentUser?.name || 'Système',
      createdAt: formatAppDateTime(),
      status: 'Clôturé'
    });
    setConfirmCloseValuation(false);
    setIsHistoryOpen(true);
  };

  const SortHeader: React.FC<{ label: string; k: SortKey; className?: string }> = ({ label, k, className }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`py-2.5 px-3 cursor-pointer select-none hover:bg-slate-100 transition-colors ${className || ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortKey === k ? 'text-blue-600' : 'text-slate-300'}`} />
      </span>
    </th>
  );

  return (
    <div className="space-y-5 pb-12">
      {/* Barre de paramètres */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-base font-bold text-[#001F3F]">Paramètres de valorisation</h2>
              <p className="text-[11px] text-slate-500">Stock reconstitué à la date choisie à partir des mouvements enregistrés</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={runCalculation}
              className="px-3.5 py-2 rounded-lg bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Calculator className="w-4 h-4" /> Calculer
            </button>
            <button
              onClick={runCalculation}
              title="Recalculer avec les données actuelles"
              className="px-3.5 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Actualiser
            </button>
            <button
              onClick={handlePrint}
              disabled={!computedMeta || filteredLines.length === 0}
              className="px-3.5 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40"
            >
              <Printer className="w-4 h-4" /> Imprimer
            </button>
            <button
              onClick={handleExportExcel}
              disabled={!computedMeta || filteredLines.length === 0}
              className="px-3.5 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40"
            >
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </button>
            <button
              onClick={handlePrint}
              disabled={!computedMeta || filteredLines.length === 0}
              title="Exporter l'état en PDF (via la boîte d'impression)"
              className="px-3.5 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40"
            >
              <FileDown className="w-4 h-4" /> PDF
            </button>
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <History className="w-4 h-4" /> Historique
            </button>
            <button
              onClick={() => setConfirmCloseValuation(true)}
              disabled={!computedMeta || filteredLines.length === 0}
              title="Clôturer et archiver cet état de valorisation"
              className="px-3.5 py-2 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40"
            >
              <Lock className="w-4 h-4" /> Clôturer
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Date de valorisation</label>
            <input
              type="date"
              value={valuationDate}
              onChange={e => setValuationDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Dépôt</label>
            <select
              value={depotFilter}
              onChange={e => { setDepotFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">Tous les dépôts</option>
              {depotOptions.map(d => <option key={d} value={d}>{d}</option>)}
              <option value="Non affecté">Non affecté</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Famille d'articles</label>
            <select
              value={categoryFilter}
              onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">Toutes les familles</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Méthode</label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value as ValuationMethod)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
            >
              {(Object.keys(VALUATION_METHOD_LABELS) as ValuationMethod[]).map(m => (
                <option key={m} value={m}>{VALUATION_METHOD_LABELS[m]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Recherche</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
                placeholder="Code ou désignation…"
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Indicateurs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase"><Package className="w-4 h-4 text-blue-600" /> Articles</div>
          <div className="text-xl font-extrabold text-[#001F3F] mt-1">{stats.articleCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase"><Boxes className="w-4 h-4 text-indigo-600" /> Quantité totale</div>
          <div className="text-xl font-extrabold text-[#001F3F] mt-1">{stats.totalQuantity.toLocaleString('fr-FR')}</div>
        </div>
        <div className="bg-[#001F3F] rounded-xl border border-blue-950 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-bold text-blue-200 uppercase"><Coins className="w-4 h-4 text-emerald-400" /> Valeur du stock</div>
          <div className="text-xl font-extrabold text-white mt-1">{formatFCFA(stats.totalValue)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase"><PackageX className="w-4 h-4 text-red-600" /> Ruptures</div>
          <div className={`text-xl font-extrabold mt-1 ${stats.ruptureCount > 0 ? 'text-red-600' : 'text-[#001F3F]'}`}>{stats.ruptureCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase"><AlertTriangle className="w-4 h-4 text-amber-600" /> Anomalies</div>
          <div className={`text-xl font-extrabold mt-1 ${stats.anomalyCount > 0 ? 'text-amber-600' : 'text-[#001F3F]'}`}>{stats.anomalyCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm" title="Produits dont le stock réel diffère du stock théorique reconstitué (valorisation du jour uniquement)">
          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase"><GitCompare className="w-4 h-4 text-rose-600" /> Écarts réel</div>
          <div className={`text-xl font-extrabold mt-1 ${stats.ecartCount > 0 ? 'text-rose-600' : 'text-[#001F3F]'}`}>
            {isTodayValuation ? stats.ecartCount : '—'}
          </div>
        </div>
      </div>

      {/* Avertissement données insuffisantes */}
      {hasInsufficientHistory && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 font-medium">
            Historique incomplet pour certains articles : aucun mouvement enregistré — le stock actuel a été valorisé au prix d'achat de la fiche.
            La valorisation historique de ces articles ne peut pas être garantie.
          </p>
        </div>
      )}

      {/* Tableau détaillé */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-bold text-[#001F3F]">
            Tableau de valorisation
            {computedMeta && (
              <span className="ml-2 text-[11px] font-medium text-slate-500">
                au {computedMeta.date} • {VALUATION_METHOD_LABELS[computedMeta.method]}
              </span>
            )}
          </h2>
          <span className="text-xs text-slate-500">{sortedLines.length} ligne(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <SortHeader label="Code" k="productCode" />
                <SortHeader label="Désignation" k="productName" />
                <SortHeader label="Famille" k="category" />
                <SortHeader label="Dépôt" k="depot" />
                <th className="py-2.5 px-3">Unité</th>
                <SortHeader label="Qté stock" k="quantity" className="text-right" />
                <th className="py-2.5 px-3 text-right" title="Stock actuel de la fiche produit">Réel</th>
                <th className="py-2.5 px-3 text-right" title="Écart stock réel − stock théorique (date du jour)">Écart</th>
                <SortHeader label="Coût unitaire" k="unitCost" className="text-right" />
                <SortHeader label="Valeur totale" k="totalValue" className="text-right" />
                <th className="py-2.5 px-3">Dernier mvt</th>
                <th className="py-2.5 px-3">Méthode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedLines.length === 0 ? (
                <tr><td colSpan={12} className="py-10 text-center text-slate-400">Aucune donnée — ajustez les filtres puis cliquez « Calculer ».</td></tr>
              ) : pagedLines.map(l => (
                <tr key={l.productId} className={`hover:bg-blue-50/40 ${l.quantity < 0 ? 'bg-red-50/60' : ''}`}>
                  <td className="py-2.5 px-3 font-mono text-slate-600">{l.productCode}</td>
                  <td className="py-2.5 px-3 font-bold text-[#001F3F]">
                    {l.productName}
                    {l.hasAnomaly && (
                      <div className="text-[10px] font-medium text-amber-700 flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="w-3 h-3" /> {l.anomalyNote}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">{l.category}</td>
                  <td className="py-2.5 px-3 text-slate-600">{l.depot}</td>
                  <td className="py-2.5 px-3 text-slate-600">{l.unit}</td>
                  <td className={`py-2.5 px-3 text-right font-bold ${l.quantity < 0 ? 'text-red-600' : 'text-slate-800'}`}>{l.quantity}</td>
                  {(() => {
                    const real = liveStockById.get(l.productId) ?? 0;
                    const ecart = real - l.quantity;
                    return (
                      <>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-600">{isTodayValuation ? real : '—'}</td>
                        <td className={`py-2.5 px-3 text-right font-bold ${!isTodayValuation ? 'text-slate-300' : ecart !== 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {isTodayValuation ? (ecart > 0 ? `+${ecart}` : ecart) : '—'}
                        </td>
                      </>
                    );
                  })()}
                  <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                    {formatFCFA(l.unitCost)}
                    {l.costEstimated && <span className="text-amber-500" title="Coût estimé (prix d'achat fiche)"> *</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-emerald-700">{formatFCFA(l.totalValue)}</td>
                  <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{l.lastMovementDate || '-'}</td>
                  <td className="py-2.5 px-3 text-slate-500 text-[11px]">{VALUATION_METHOD_LABELS[l.method]}</td>
                </tr>
              ))}
            </tbody>
            {sortedLines.length > 0 && (
              <tfoot>
                <tr className="bg-[#001F3F] text-white font-bold">
                  <td colSpan={5} className="py-3 px-3 uppercase text-[11px]">Total général ({stats.articleCount} articles)</td>
                  <td className="py-3 px-3 text-right">{stats.totalQuantity.toLocaleString('fr-FR')}</td>
                  <td colSpan={2}></td>
                  <td className="py-3 px-3"></td>
                  <td className="py-3 px-3 text-right text-emerald-300">{formatFCFA(stats.totalValue)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs">
            <span className="text-slate-500">Page {page} / {pageCount}</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(pageCount, p + 1))}
                disabled={page === pageCount}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal confirmation clôture */}
      {confirmCloseValuation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center gap-2.5">
              <Lock className="w-5 h-5 text-teal-600" />
              <h3 className="font-bold text-[#001F3F]">Clôturer la valorisation ?</h3>
            </div>
            <div className="p-5 space-y-2 text-xs text-slate-600">
              <p>L'état sera archivé dans l'historique avec :</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Date de référence : <b>{computedMeta?.date}</b></li>
                <li>Méthode : <b>{computedMeta ? VALUATION_METHOD_LABELS[computedMeta.method] : ''}</b></li>
                <li>Valeur totale : <b>{formatFCFA(stats.totalValue)}</b></li>
                <li>{stats.articleCount} article(s), {stats.anomalyCount} anomalie(s) signalée(s)</li>
              </ul>
              {stats.anomalyCount > 0 && (
                <p className="text-amber-700 font-semibold pt-1">⚠ Des anomalies sont présentes : l'état archivé portera cette mention.</p>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setConfirmCloseValuation(false)}
                className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold text-xs"
              >
                Annuler
              </button>
              <button
                onClick={handleCloseValuation}
                className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <Lock className="w-4 h-4" /> Clôturer et archiver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal historique des valorisations */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-slate-100 bg-[#001F3F] text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-amber-300" /> Historique des états de valorisation
              </h3>
              <button onClick={() => { setIsHistoryOpen(false); setViewingRecord(null); }} className="p-1 hover:bg-white/10 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {viewingRecord ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setViewingRecord(null)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Retour à la liste
                    </button>
                    <button
                      onClick={() => openReport(viewingRecord.lines, { date: viewingRecord.valuationDate, method: viewingRecord.method }, viewingRecord)}
                      className="px-3.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold text-xs flex items-center gap-1.5"
                    >
                      <Printer className="w-4 h-4" /> Réimprimer l'état
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><span className="text-slate-500">Code</span><p className="font-bold font-mono">{viewingRecord.code}</p></div>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><span className="text-slate-500">Date de valorisation</span><p className="font-bold">{viewingRecord.valuationDate}</p></div>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><span className="text-slate-500">Méthode</span><p className="font-bold">{VALUATION_METHOD_LABELS[viewingRecord.method]}</p></div>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><span className="text-slate-500">Valeur totale</span><p className="font-bold text-emerald-700">{formatFCFA(viewingRecord.totalValue)}</p></div>
                  </div>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-semibold uppercase border-b border-slate-200">
                          <th className="py-2 px-3">Code</th><th className="py-2 px-3">Désignation</th><th className="py-2 px-3">Famille</th>
                          <th className="py-2 px-3">Dépôt</th><th className="py-2 px-3 text-right">Qté</th>
                          <th className="py-2 px-3 text-right">Coût unit.</th><th className="py-2 px-3 text-right">Valeur</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {viewingRecord.lines.map(l => (
                          <tr key={l.productId} className="hover:bg-blue-50/40">
                            <td className="py-2 px-3 font-mono text-slate-600">{l.productCode}</td>
                            <td className="py-2 px-3 font-bold text-[#001F3F]">{l.productName}</td>
                            <td className="py-2 px-3">{l.category}</td>
                            <td className="py-2 px-3">{l.depot}</td>
                            <td className={`py-2 px-3 text-right font-bold ${l.quantity < 0 ? 'text-red-600' : ''}`}>{l.quantity}</td>
                            <td className="py-2 px-3 text-right">{formatFCFA(l.unitCost)}</td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-700">{formatFCFA(l.totalValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <>
                  {valuations.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                      <History className="w-8 h-8 opacity-40" />
                      <span>Aucune valorisation clôturée. Utilisez « Clôturer » après un calcul pour archiver un état.</span>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-semibold uppercase border-b border-slate-200">
                          <th className="py-2 px-3">Code</th><th className="py-2 px-3">Date valorisation</th><th className="py-2 px-3">Méthode</th>
                          <th className="py-2 px-3">Dépôt</th><th className="py-2 px-3 text-right">Articles</th>
                          <th className="py-2 px-3 text-right">Valeur totale</th><th className="py-2 px-3">Clôturé par</th><th className="py-2 px-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {valuations.map(v => (
                          <tr key={v.id} className="hover:bg-blue-50/40">
                            <td className="py-2.5 px-3 font-mono font-bold text-[#001F3F]">{v.code}</td>
                            <td className="py-2.5 px-3">{v.valuationDate}</td>
                            <td className="py-2.5 px-3">{VALUATION_METHOD_LABELS[v.method]}</td>
                            <td className="py-2.5 px-3">{v.depotFilter === 'ALL' ? 'Tous' : v.depotFilter}</td>
                            <td className="py-2.5 px-3 text-right">{v.articleCount}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-700">{formatFCFA(v.totalValue)}</td>
                            <td className="py-2.5 px-3 text-slate-600">{v.createdBy}<div className="text-[10px] text-slate-400">{v.createdAt}</div></td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => setViewingRecord(v)}
                                  title="Consulter l'état clôturé"
                                  className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                {onDeleteValuation && (
                                  <button
                                    onClick={() => { if (window.confirm(`Supprimer l'état ${v.code} ?`)) onDeleteValuation(v.id); }}
                                    title="Supprimer cet état archivé"
                                    className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
