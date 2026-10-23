import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Plus,
  Search,
  Printer,
  FileSpreadsheet,
  Trash2,
  X,
  PackageMinus,
  CheckCircle2
} from 'lucide-react';
import {
  Product,
  StockMovement,
  ApprovisionnementRecord,
  GoodsReception,
  SaleOrder,
  PhysicalInventory,
  StockAdjustment,
  StockTransfer,
  StockAvarieLoss,
  StorageSite,
  CompanyConfig,
  UserAccount,
  CustomerReturn,
  SupplierReturn
} from '../../../types';
import { formatFCFA } from '../../../data/initialData';
import { formatAppDate, formatAppDateTime } from '../../../utils/dateUtils';
import { computeStockValuation } from '../../../utils/stockValuation';
import { withProfessionalPrintBranding } from '../../../utils/professionalPrint';
import { LOSS_TYPES, summarizeLosses } from '../../../utils/stockLoss';

const STATUS_STYLES: Record<StockAvarieLoss['status'], string> = {
  'Constaté': 'bg-amber-50 text-amber-700 border-amber-200',
  'Déstocké': 'bg-slate-800 text-white border-slate-800'
};

const TYPE_STYLES: Record<StockAvarieLoss['type'], string> = {
  'Périmé': 'bg-purple-50 text-purple-700 border-purple-200',
  'Casse/Endommagé': 'bg-orange-50 text-orange-700 border-orange-200',
  'Perte/Vol': 'bg-red-50 text-red-700 border-red-200',
  'Défectueux': 'bg-blue-50 text-blue-700 border-blue-200',
  'Coulage': 'bg-teal-50 text-teal-700 border-teal-200'
};

interface PertesAvariesViewProps {
  losses: StockAvarieLoss[];
  products: Product[];
  movements: StockMovement[];
  approvisionnements: ApprovisionnementRecord[];
  receptions: GoodsReception[];
  saleOrders: SaleOrder[];
  inventories?: PhysicalInventory[];
  stockAdjustments?: StockAdjustment[];
  stockTransfers?: StockTransfer[];
  customerReturns?: CustomerReturn[];
  supplierReturns?: SupplierReturn[];
  storageSites: StorageSite[];
  companyConfig: CompanyConfig | null;
  currentUser: UserAccount | null;
  onDeclareLoss: (l: StockAvarieLoss) => StockAvarieLoss;
  onDestockLoss: (id: string) => boolean;
  onDeleteLoss: (id: string) => void;
}

export const PertesAvariesView: React.FC<PertesAvariesViewProps> = ({
  losses,
  products,
  movements,
  approvisionnements,
  receptions,
  saleOrders,
  inventories = [],
  stockAdjustments = [],
  stockTransfers = [],
  customerReturns = [],
  supplierReturns = [],
  companyConfig,
  currentUser,
  onDeclareLoss,
  onDestockLoss,
  onDeleteLoss
}) => {
  const [selected, setSelected] = useState<StockAvarieLoss | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [listSearch, setListSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | StockAvarieLoss['status']>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | StockAvarieLoss['type']>('ALL');
  const [confirmDestock, setConfirmDestock] = useState<StockAvarieLoss | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StockAvarieLoss | null>(null);

  // Formulaire de déclaration
  const [productQuery, setProductQuery] = useState('');
  const [formProduct, setFormProduct] = useState<Product | null>(null);
  const [formQty, setFormQty] = useState<number>(1);
  const [formType, setFormType] = useState<StockAvarieLoss['type']>('Casse/Endommagé');
  const [formUnitPrice, setFormUnitPrice] = useState<number | ''>('');
  const [formNotes, setFormNotes] = useState('');

  /** CUMP du jour par produit — coût de valorisation de la perte (jamais le prix de vente) */
  const valuationNow = useMemo(
    () => new Map(computeStockValuation({
      products, movements, approvisionnements, receptions, saleOrders, inventories, stockAdjustments, stockTransfers,
      customerReturns, supplierReturns,
      valuationDate: formatAppDate(), method: 'CUMP_PERPETUEL'
    }).map(l => [l.productId, l])),
    [products, movements, approvisionnements, receptions, saleOrders, inventories, stockAdjustments, stockTransfers, customerReturns, supplierReturns]
  );

  const filteredList = useMemo(() => {
    const t = listSearch.trim().toLowerCase();
    return losses.filter(l => {
      if (statusFilter !== 'ALL' && l.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && l.type !== typeFilter) return false;
      if (!t) return true;
      return l.code.toLowerCase().includes(t)
        || l.productName.toLowerCase().includes(t)
        || (l.productCode || '').toLowerCase().includes(t)
        || l.operator.toLowerCase().includes(t);
    });
  }, [losses, listSearch, statusFilter, typeFilter]);

  const summary = useMemo(() => summarizeLosses(losses), [losses]);

  const productSuggestions = useMemo(() => {
    const t = productQuery.trim().toLowerCase();
    if (!t) return [];
    return products
      .filter(p => p.isStockable !== false &&
        (p.code.toLowerCase().includes(t) || p.name.toLowerCase().includes(t) || (p.barcode || '').includes(t)))
      .slice(0, 6);
  }, [products, productQuery]);

  const pickProduct = (p: Product) => {
    setFormProduct(p);
    setProductQuery(`${p.code} — ${p.name}`);
    const val = valuationNow.get(p.id);
    setFormUnitPrice(val?.unitCost ?? p.buyPrice ?? 0);
  };

  const resetForm = () => {
    setFormProduct(null);
    setProductQuery('');
    setFormQty(1);
    setFormType('Casse/Endommagé');
    setFormUnitPrice('');
    setFormNotes('');
  };

  const handleDeclare = () => {
    if (!formProduct) { alert('Sélectionnez un article.'); return; }
    if (!formQty || formQty <= 0) { alert('Quantité invalide.'); return; }
    if (formQty > formProduct.stock) {
      if (!window.confirm(`La quantité déclarée (${formQty}) dépasse le stock actuel (${formProduct.stock}). Continuer quand même ?`)) return;
    }
    if (formUnitPrice === '' || formUnitPrice < 0) { alert('Coût unitaire de valorisation invalide.'); return; }
    const loss: StockAvarieLoss = {
      id: '',
      code: '',
      date: formatAppDateTime(),
      productId: formProduct.id,
      productName: formProduct.name,
      productCode: formProduct.code,
      quantity: formQty,
      unit: formProduct.storageUnit || formProduct.unit || 'pièce',
      depot: formProduct.location || 'Non affecté',
      unitPrice: Number(formUnitPrice),
      totalLossValue: formQty * Number(formUnitPrice),
      type: formType,
      operator: currentUser?.name || 'Système',
      notes: formNotes || undefined,
      status: 'Constaté',
      createdAt: formatAppDateTime()
    };
    onDeclareLoss(loss);
    setIsCreateOpen(false);
    resetForm();
  };

  const doDestock = () => {
    if (!confirmDestock) return;
    const ok = onDestockLoss(confirmDestock.id);
    if (!ok) alert('Déstockage impossible : la déclaration est déjà déstockée, ou le stock deviendrait négatif.');
    if (selected?.id === confirmDestock.id) setSelected({ ...selected, status: 'Déstocké', destockedBy: currentUser?.name, destockedAt: formatAppDateTime() });
    setConfirmDestock(null);
  };

  const printDoc = (kind: 'list' | 'fiche') => {
    const css = `
      @page { size: A4 landscape; margin: 12mm; }
      body { font-family: Arial, sans-serif; font-size: 11px; color: #0f172a; margin: 0; }
      .header { display: flex; justify-content: space-between; border-bottom: 3px solid #001F3F; padding-bottom: 10px; margin-bottom: 12px; }
      .company { font-size: 17px; font-weight: 800; color: #001F3F; }
      .sub { color: #64748b; font-size: 10px; }
      h1 { font-size: 15px; text-transform: uppercase; color: #001F3F; margin: 6px 0; }
      .meta { display: flex; gap: 20px; flex-wrap: wrap; font-size: 10px; margin-bottom: 10px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #001F3F; color: #fff; padding: 6px; text-align: left; font-size: 9.5px; text-transform: uppercase; }
      td { padding: 5px 6px; border-bottom: 1px solid #e2e8f0; }
      .num { text-align: right; font-variant-numeric: tabular-nums; }
      .mono { font-family: monospace; }
      .totals { display: flex; gap: 16px; margin-top: 12px; }
      .tbox { border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 12px; }
      .tbox .lbl { font-size: 9px; text-transform: uppercase; color: #64748b; }
      .tbox .val { font-size: 14px; font-weight: 800; color: #001F3F; }
      .foot { margin-top: 16px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }`;

    let body = '';
    let title = '';
    if (kind === 'fiche' && selected) {
      const l = selected;
      title = `Déclaration de perte — ${l.code}`;
      body = `
        <div class="meta">
          <span>Date : <b>${l.date}</b></span>
          <span>Type : <b>${l.type}</b></span>
          <span>Dépôt : <b>${l.depot || '—'}</b></span>
          <span>Déclaré par : <b>${l.operator}</b></span>
          <span>Statut : <b>${l.status}</b></span>
          ${l.destockedBy ? `<span>Déstocké par : <b>${l.destockedBy}</b> le ${l.destockedAt || ''}</span>` : ''}
          ${l.notes ? `<span>Observations : <b>${l.notes}</b></span>` : ''}
        </div>
        <table><thead><tr><th>Code</th><th>Désignation</th><th>Unité</th><th class="num">Quantité perdue</th><th class="num">Coût unit.</th><th class="num">Valeur de la perte</th></tr></thead>
        <tbody><tr><td class="mono">${l.productCode || ''}</td><td>${l.productName}</td><td>${l.unit}</td>
        <td class="num">${l.quantity}</td><td class="num">${formatFCFA(l.unitPrice)}</td><td class="num">${formatFCFA(l.totalLossValue)}</td></tr></tbody></table>
        <div class="foot"><span>GeStock — ${formatAppDateTime()}</span><span>Déclarant : ______________  Responsable : ______________</span></div>`;
    } else {
      title = 'État des pertes, casses et produits avariés';
      const rows = filteredList.map(l => `<tr><td class="mono">${l.code}</td><td>${l.date}</td>
        <td class="mono">${l.productCode || ''}</td><td>${l.productName}</td><td>${l.depot || '—'}</td>
        <td>${l.type}</td><td class="num">${l.quantity}</td><td class="num">${formatFCFA(l.unitPrice)}</td>
        <td class="num">${formatFCFA(l.totalLossValue)}</td><td>${l.status}</td></tr>`).join('');
      body = `
        <div class="meta"><span>Déclarations : <b>${filteredList.length}</b></span>
        <span>Valeur déstockée : <b>${formatFCFA(summary.totalValue)}</b></span></div>
        <table><thead><tr><th>N°</th><th>Date</th><th>Code</th><th>Désignation</th><th>Dépôt</th><th>Type</th><th class="num">Qté</th><th class="num">Coût unit.</th><th class="num">Valeur</th><th>Statut</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <div class="foot"><span>GeStock — ${formatAppDateTime()}</span><span>Édité par ${currentUser?.name || 'Système'}</span></div>`;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head><body>
      <div class="header">
        <div><div class="company">${companyConfig?.name || 'GeStock'}</div>
        <div class="sub">${companyConfig?.address || ''} ${companyConfig?.phone ? '• ' + companyConfig.phone : ''}</div></div>
        <div style="text-align:right"><div class="sub">Édité le ${formatAppDateTime()} par ${currentUser?.name || 'Système'}</div></div>
      </div>
      <h1>${title}</h1>${body}
      <script>window.onload = () => { window.print(); }<\/script></body></html>`;
    const w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) return;
    w.document.write(withProfessionalPrintBranding(html, companyConfig));
    w.document.close();
  };

  const exportCsv = () => {
    const head = ['N°', 'Date', 'Code article', 'Désignation', 'Dépôt', 'Type', 'Quantité', 'Coût unit.', 'Valeur perte', 'Statut', 'Déclaré par', 'Déstocké par'];
    const rows = filteredList.map(l => [
      l.code, l.date, l.productCode || '', l.productName, l.depot || '', l.type,
      l.quantity, l.unitPrice, l.totalLossValue, l.status, l.operator, l.destockedBy || ''
    ]);
    const csv = '﻿' + [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'pertes-avaries.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#001F3F] flex items-center gap-2"><AlertTriangle className="w-6 h-6 text-orange-500" /> Pertes &amp; Produits avariés</h2>
          <p className="text-xs text-slate-500 mt-1">Déclarez les pertes, puis déstockez-les : chaque déstockage génère un mouvement « Périmé/Casse » traçable.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => printDoc('list')} className="px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs flex items-center gap-1.5">
            <Printer className="w-4 h-4" /> Imprimer l'état
          </button>
          <button onClick={exportCsv} className="px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4" /> Exporter CSV
          </button>
          <button onClick={() => setIsCreateOpen(true)} className="px-4 py-2 rounded-lg bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all">
            <Plus className="w-4 h-4" /> Déclarer une perte
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="text-[10px] font-bold text-slate-400 uppercase">En attente de déstockage</div>
          <div className="text-lg font-black text-amber-600">{summary.declaredCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Déstockées</div>
          <div className="text-lg font-black text-[#001F3F]">{summary.destockedCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Quantité perdue</div>
          <div className="text-lg font-black text-red-600">{summary.totalQuantity}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Valeur des pertes</div>
          <div className="text-lg font-black text-red-600">{formatFCFA(summary.totalValue)}</div>
        </div>
      </div>

      {/* Répartition par type */}
      {Object.keys(summary.byType).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {LOSS_TYPES.filter(t => summary.byType[t]).map(t => (
            <span key={t} className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold ${TYPE_STYLES[t]}`}>
              {t} : {summary.byType[t].count} déclaration(s) • {formatFCFA(summary.byType[t].value)}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={listSearch} onChange={e => setListSearch(e.target.value)}
            placeholder="Rechercher : n°, article, déclarant…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-[#001F3F]/20 outline-none" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">
          <option value="ALL">Tous les types</option>
          {LOSS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">
          <option value="ALL">Tous les statuts</option>
          <option value="Constaté">Constaté</option>
          <option value="Déstocké">Déstocké</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-[#001F3F] text-white uppercase text-[10px]">
            <tr>
              <th className="px-4 py-3 text-left">N°</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Article</th>
              <th className="px-4 py-3 text-left">Dépôt</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-right">Qté</th>
              <th className="px-4 py-3 text-right">Coût unit.</th>
              <th className="px-4 py-3 text-right">Valeur</th>
              <th className="px-4 py-3 text-center">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredList.map(l => (
              <tr key={l.id} onClick={() => setSelected(l)} className="hover:bg-slate-50 cursor-pointer">
                <td className="px-4 py-2.5 font-mono font-bold text-[#001F3F]">{l.code}</td>
                <td className="px-4 py-2.5 text-slate-600">{l.date}</td>
                <td className="px-4 py-2.5 font-semibold">{l.productName}
                  {l.productCode && <span className="block text-[10px] text-slate-400 font-mono">{l.productCode}</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-500">{l.depot || '—'}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${TYPE_STYLES[l.type]}`}>{l.type}</span>
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-red-600">{l.quantity} {l.unit}</td>
                <td className="px-4 py-2.5 text-right">{formatFCFA(l.unitPrice)}</td>
                <td className="px-4 py-2.5 text-right font-bold text-red-600">{formatFCFA(l.totalLossValue)}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${STATUS_STYLES[l.status]}`}>{l.status}</span>
                </td>
                <td className="px-4 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    {l.status === 'Constaté' && (
                      <>
                        <button onClick={() => setConfirmDestock(l)} className="px-2 py-1 rounded-lg bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-bold flex items-center gap-1 hover:bg-orange-100" title="Sortir du stock">
                          <PackageMinus className="w-3.5 h-3.5" /> Déstocker
                        </button>
                        <button onClick={() => setConfirmDelete(l)} className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50" title="Supprimer la déclaration">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredList.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">Aucune perte déclarée — cliquez sur « Déclarer une perte ».</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de déclaration */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setIsCreateOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-black text-[#001F3F]">Déclarer une perte / avarie</h3>
              <button onClick={() => setIsCreateOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Article *</label>
                <input value={productQuery}
                  onChange={e => { setProductQuery(e.target.value); setFormProduct(null); }}
                  placeholder="Code, code-barres ou désignation…"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                {productSuggestions.length > 0 && !formProduct && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                    {productSuggestions.map(p => (
                      <button key={p.id} onClick={() => pickProduct(p)}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 flex justify-between">
                        <span><span className="font-mono font-bold">{p.code}</span> — {p.name}</span>
                        <span className="text-slate-400">stock {p.stock}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Quantité *</label>
                  <input type="number" min={1} step="any" value={formQty} onChange={e => setFormQty(Number(e.target.value))}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Type *</label>
                  <select value={formType} onChange={e => setFormType(e.target.value as StockAvarieLoss['type'])}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                    {LOSS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Coût unit. (CUMP)</label>
                  <input type="number" min={0} step="any" value={formUnitPrice} onChange={e => setFormUnitPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                </div>
              </div>
              {formProduct && (
                <p className="text-[10px] text-slate-500">
                  Stock actuel : <b>{formProduct.stock}</b> {formProduct.storageUnit || formProduct.unit} •
                  Valeur de la perte : <b className="text-red-600">{formatFCFA(formQty * (Number(formUnitPrice) || 0))}</b>
                  {' '}— valorisée au coût d'achat (CUMP), jamais au prix de vente.
                </p>
              )}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Observations</label>
                <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm resize-none"
                  placeholder="Circonstances, emplacement, lot concerné…" />
              </div>
              <p className="text-[10px] text-slate-400">
                La déclaration n'impacte pas le stock : cliquez ensuite sur « Déstocker » pour générer le mouvement Périmé/Casse.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setIsCreateOpen(false); resetForm(); }} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600">Annuler</button>
              <button onClick={handleDeclare} className="px-4 py-2 rounded-lg bg-[#001F3F] text-white text-xs font-bold">Déclarer</button>
            </div>
          </div>
        </div>
      )}

      {/* Détail */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-black text-[#001F3F] flex items-center gap-2">
                {selected.code}
                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${STATUS_STYLES[selected.status]}`}>{selected.status}</span>
              </h3>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-xs text-slate-600 space-y-1.5">
              <p><b>Article :</b> {selected.productCode} — {selected.productName}</p>
              <p><b>Type :</b> {selected.type} • <b>Dépôt :</b> {selected.depot || '—'}</p>
              <p><b>Quantité :</b> {selected.quantity} {selected.unit} • <b>Coût unit. :</b> {formatFCFA(selected.unitPrice)}</p>
              <p><b>Valeur de la perte :</b> <span className="text-red-600 font-bold">{formatFCFA(selected.totalLossValue)}</span></p>
              <p><b>Déclarée par :</b> {selected.operator} le {selected.date}</p>
              {selected.destockedBy && <p><b>Déstockée par :</b> {selected.destockedBy} le {selected.destockedAt}</p>}
              {selected.notes && <p><b>Observations :</b> {selected.notes}</p>}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => printDoc('fiche')} className="px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs flex items-center gap-1.5">
                <Printer className="w-4 h-4" /> Imprimer la fiche
              </button>
              {selected.status === 'Constaté' && (
                <button onClick={() => setConfirmDestock(selected)} className="px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1.5">
                  <PackageMinus className="w-4 h-4" /> Déstocker
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmDestock && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmDestock(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-[#001F3F] mb-2 flex items-center gap-2"><PackageMinus className="w-5 h-5 text-orange-600" /> Déstocker {confirmDestock.code} ?</h3>
            <p className="text-xs text-slate-500 mb-4">
              <b>{confirmDestock.quantity} {confirmDestock.unit}</b> de « {confirmDestock.productName} » seront retirées du stock
              (mouvement « Périmé/Casse » — {formatFCFA(confirmDestock.totalLossValue)}). Irréversible.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDestock(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600">Retour</button>
              <button onClick={doDestock} className="px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Déstocker
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-[#001F3F] mb-2">Supprimer la déclaration {confirmDelete.code} ?</h3>
            <p className="text-xs text-slate-500 mb-4">Seule une déclaration non déstockée peut être supprimée — le stock n'a pas encore été touché.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600">Conserver</button>
              <button onClick={() => { onDeleteLoss(confirmDelete.id); setConfirmDelete(null); if (selected?.id === confirmDelete.id) setSelected(null); }} className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
