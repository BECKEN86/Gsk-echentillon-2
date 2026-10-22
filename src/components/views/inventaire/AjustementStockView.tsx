import React, { useMemo, useRef, useState } from 'react';
import {
  Scale,
  Plus,
  Search,
  Printer,
  FileSpreadsheet,
  Trash2,
  ShieldCheck,
  Ban,
  X,
  ChevronLeft,
  CheckCircle2,
  ScanBarcode,
  PackagePlus,
  ListFilter
} from 'lucide-react';
import {
  Product,
  StockMovement,
  ApprovisionnementRecord,
  GoodsReception,
  SaleOrder,
  PhysicalInventory,
  StorageSite,
  CompanyConfig,
  UserAccount,
  StockAdjustment,
  StockAdjustmentLine,
  StockAdjustmentStatus,
  StockTransfer,
  CustomerReturn,
  SupplierReturn
} from '../../../types';
import { formatFCFA } from '../../../data/initialData';
import { formatAppDate, formatAppDateTime } from '../../../utils/dateUtils';
import { computeStockValuation } from '../../../utils/stockValuation';
import { withProfessionalPrintBranding } from '../../../utils/professionalPrint';
import {
  ADJUSTMENT_REASONS,
  LOSS_REASONS,
  refreshAdjustmentLine,
  summarizeAdjustment,
  makeAdjustmentLine
} from '../../../utils/stockAdjustment';

const STATUS_STYLES: Record<StockAdjustmentStatus, string> = {
  'Brouillon': 'bg-slate-100 text-slate-700 border-slate-300',
  'Validé': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Annulé': 'bg-red-50 text-red-700 border-red-200'
};

interface AjustementStockViewProps {
  adjustments: StockAdjustment[];
  products: Product[];
  movements: StockMovement[];
  approvisionnements: ApprovisionnementRecord[];
  receptions: GoodsReception[];
  saleOrders: SaleOrder[];
  inventories?: PhysicalInventory[];
  stockAdjustments?: StockAdjustment[]; // pour la résolution des coûts (auto-référence incluse)
  stockTransfers?: StockTransfer[];
  customerReturns?: CustomerReturn[];
  supplierReturns?: SupplierReturn[];
  storageSites: StorageSite[];
  companyConfig: CompanyConfig | null;
  currentUser: UserAccount | null;
  onSaveAdjustment: (adj: StockAdjustment) => StockAdjustment;
  onValidateAdjustment: (id: string) => boolean;
  onCancelAdjustment: (id: string, reason: string) => boolean;
  onDeleteAdjustment: (id: string) => void;
}

const emptyForm = () => ({
  depot: 'ALL',
  generalReason: '',
  notes: ''
});

export const AjustementStockView: React.FC<AjustementStockViewProps> = ({
  adjustments,
  products,
  movements,
  approvisionnements,
  receptions,
  saleOrders,
  inventories = [],
  stockTransfers = [],
  customerReturns = [],
  supplierReturns = [],
  storageSites,
  companyConfig,
  currentUser,
  onSaveAdjustment,
  onValidateAdjustment,
  onCancelAdjustment,
  onDeleteAdjustment
}) => {
  const [selected, setSelected] = useState<StockAdjustment | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [listSearch, setListSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | StockAdjustmentStatus>('ALL');
  const [gapFilter, setGapFilter] = useState<'ALL' | 'GAP+' | 'GAP-' | 'OK' | 'UNSET'>('ALL');
  const [lineSearch, setLineSearch] = useState('');
  const [quickAdd, setQuickAdd] = useState('');
  const [confirmValidate, setConfirmValidate] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<StockAdjustment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<StockAdjustment | null>(null);

  const isReadOnly = selected ? selected.status !== 'Brouillon' : false;

  const depotOptions = useMemo(() => {
    const names = new Set<string>();
    storageSites.forEach(s => s.name && names.add(s.name));
    products.forEach(p => p.location && names.add(p.location));
    return Array.from(names).sort();
  }, [storageSites, products]);

  const filteredList = useMemo(() => {
    const t = listSearch.trim().toLowerCase();
    return adjustments.filter(a => {
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (!t) return true;
      return a.code.toLowerCase().includes(t)
        || a.operator.toLowerCase().includes(t)
        || a.lines.some(l => l.productCode.toLowerCase().includes(t) || l.productName.toLowerCase().includes(t));
    });
  }, [adjustments, listSearch, statusFilter]);

  const summary = useMemo(
    () => (selected ? summarizeAdjustment(selected.lines, selected.generalReason) : null),
    [selected]
  );

  /**
   * Coût de valorisation CUMP à la date du jour + stock théorique actuel.
   * Seuls les documents validés influencent les coûts : la signature exclut les
   * brouillons pour ne pas recalculer tout le catalogue à chaque frappe.
   */
  const validatedAdjSig = useMemo(
    () => adjustments.filter(a => a.status !== 'Brouillon').map(a => `${a.id}:${a.status}`).join('|'),
    [adjustments]
  );
  const valuationNow = useMemo(
    () => new Map(computeStockValuation({
      products, movements, approvisionnements, receptions, saleOrders, inventories,
      stockAdjustments: adjustments.filter(a => a.status !== 'Brouillon'), stockTransfers,
      customerReturns, supplierReturns,
      valuationDate: formatAppDate(), method: 'CUMP_PERPETUEL'
    }).map(l => [l.productId, l])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, movements, approvisionnements, receptions, saleOrders, inventories, validatedAdjSig, stockTransfers, customerReturns, supplierReturns]
  );

  const makeLineFor = (p: Product): StockAdjustmentLine => {
    const val = valuationNow.get(p.id);
    return makeAdjustmentLine({
      productId: p.id,
      productCode: p.code,
      productName: p.name,
      barcode: p.barcode,
      category: p.category || 'Sans famille',
      unit: p.storageUnit || p.unit || 'pièce',
      depot: p.location || 'Non affecté',
      theoreticalStock: val?.quantity ?? p.stock,
      unitPrice: val?.unitCost ?? p.buyPrice ?? 0
    });
  };

  // ---- Création du document ----
  const handleCreate = () => {
    if (form.generalReason === 'Autre motif' && !form.notes.trim()) {
      alert('Le motif « Autre » exige une explication dans les observations.');
      return;
    }
    const adj: StockAdjustment = {
      id: '',
      code: '',
      date: formatAppDateTime(),
      depot: form.depot,
      generalReason: form.generalReason || undefined,
      notes: form.notes || undefined,
      operator: currentUser?.name || 'Système',
      status: 'Brouillon',
      lines: [],
      totalPositiveQty: 0,
      totalNegativeQty: 0,
      totalDiscrepancyValue: 0,
      createdAt: formatAppDateTime()
    };
    const saved = onSaveAdjustment(adj);
    setIsCreateOpen(false);
    setForm(emptyForm());
    setSelected(saved);
  };

  // Sauvegarde différée des frappes : la saisie d'un chiffre ne doit pas
  // sérialiser toute la base (localStorage + serveur) à chaque touche.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDoc = useRef<StockAdjustment | null>(null);

  const flushSave = () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (pendingDoc.current) { onSaveAdjustment(pendingDoc.current); pendingDoc.current = null; }
  };

  const scheduleSave = (doc: StockAdjustment) => {
    pendingDoc.current = doc;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveTimer.current = null; flushSave(); }, 400);
  };

  const commit = (adj: StockAdjustment, debounced = false) => {
    const s = summarizeAdjustment(adj.lines, adj.generalReason);
    const saved = {
      ...adj,
      totalPositiveQty: s.totalPositiveQty,
      totalNegativeQty: s.totalNegativeQty,
      totalDiscrepancyValue: s.totalDiscrepancyValue
    };
    setSelected(saved);
    if (debounced) scheduleSave(saved);
    else { flushSave(); onSaveAdjustment(saved); }
  };

  const updateLine = (productId: string, patch: Partial<StockAdjustmentLine>) => {
    if (!selected || isReadOnly) return;
    commit({
      ...selected,
      lines: selected.lines.map(l => l.productId === productId ? refreshAdjustmentLine({ ...l, ...patch }) : l)
    }, true);
  };

  const removeLine = (productId: string) => {
    if (!selected || isReadOnly) return;
    commit({ ...selected, lines: selected.lines.filter(l => l.productId !== productId) });
  };

  const handleQuickAdd = () => {
    if (!selected || isReadOnly) return;
    const t = quickAdd.trim().toLowerCase();
    if (!t) return;
    const p = products.find(pr =>
      pr.isStockable !== false && !selected.lines.some(l => l.productId === pr.id) &&
      (pr.code.toLowerCase() === t || pr.barcode === quickAdd.trim() || pr.name.toLowerCase().includes(t))
    );
    if (!p) {
      alert('Article introuvable, non stockable, ou déjà présent dans cet ajustement.');
      return;
    }
    commit({ ...selected, lines: [...selected.lines, makeLineFor(p)] });
    setQuickAdd('');
  };

  /** Charge tous les articles du dépôt sélectionné (hors lignes déjà présentes) */
  const handleLoadDepot = () => {
    if (!selected || isReadOnly) return;
    const existing = new Set(selected.lines.map(l => l.productId));
    const newLines = products
      .filter(p => p.isStockable !== false && !existing.has(p.id))
      .filter(p => selected.depot === 'ALL' || (p.location || 'Non affecté') === selected.depot)
      .map(makeLineFor);
    if (newLines.length === 0) {
      alert('Aucun article supplémentaire pour ce dépôt.');
      return;
    }
    commit({ ...selected, lines: [...selected.lines, ...newLines] });
  };

  // ---- Validation ----
  const handleValidate = () => {
    if (!selected || !summary) return;
    if (selected.lines.length === 0) { alert('Ajoutez au moins un article.'); return; }
    if (summary.enteredCount < selected.lines.length) {
      alert(`${selected.lines.length - summary.enteredCount} ligne(s) sans quantité constatée : complétez ou supprimez-les avant de valider.`);
      return;
    }
    if (summary.missingReasons > 0) {
      alert(`${summary.missingReasons} écart(s) sans motif : renseignez un motif de ligne ou un motif général.`);
      return;
    }
    setConfirmValidate(true);
  };

  const doValidate = () => {
    if (!selected) return;
    flushSave(); // garantit que le parent valide le document à jour
    const ok = onValidateAdjustment(selected.id);
    setConfirmValidate(false);
    if (!ok) {
      alert('Validation impossible : le document a déjà été validé, ou une régularisation rendrait un stock négatif. Aucune ligne n\'a été appliquée.');
      return;
    }
    setSelected({ ...selected, status: 'Validé', validatedBy: currentUser?.name, validatedAt: formatAppDateTime() });
  };

  const doCancel = () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) { alert('Un motif d\'annulation est obligatoire.'); return; }
    flushSave();
    const ok = onCancelAdjustment(cancelTarget.id, cancelReason.trim());
    if (!ok) {
      alert('Annulation impossible : seul un ajustement « Validé » peut être annulé, et la contre-passation ne doit pas rendre un stock négatif.');
    } else if (selected?.id === cancelTarget.id) {
      setSelected({ ...selected, status: 'Annulé', cancelledBy: currentUser?.name, cancelledAt: formatAppDateTime(), cancelReason: cancelReason.trim() });
    }
    setCancelTarget(null);
    setCancelReason('');
  };

  const visibleLines = useMemo(() => {
    if (!selected) return [];
    const t = lineSearch.trim().toLowerCase();
    return selected.lines.filter(l => {
      if (gapFilter === 'GAP+' && !(l.discrepancy != null && l.discrepancy > 0)) return false;
      if (gapFilter === 'GAP-' && !(l.discrepancy != null && l.discrepancy < 0)) return false;
      if (gapFilter === 'OK' && !(l.discrepancy === 0)) return false;
      if (gapFilter === 'UNSET' && l.countedStock != null) return false;
      if (!t) return true;
      return l.productCode.toLowerCase().includes(t) || l.productName.toLowerCase().includes(t) || (l.barcode || '').includes(t);
    });
  }, [selected, gapFilter, lineSearch]);

  // ---- Impression : fiche détaillée (avant/après) ou liste des ajustements ----
  const printDoc = (kind: 'fiche' | 'list') => {
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
      tr.gap-pos td { background: #ecfdf5; }
      tr.gap-neg td { background: #fef2f2; }
      tr.loss td { background: #fff7ed; }
      .totals { display: flex; gap: 16px; margin-top: 12px; }
      .tbox { border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 12px; }
      .tbox .lbl { font-size: 9px; text-transform: uppercase; color: #64748b; }
      .tbox .val { font-size: 14px; font-weight: 800; color: #001F3F; }
      .foot { margin-top: 16px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }`;

    let body = '';
    let title = '';
    if (kind === 'fiche' && selected) {
      const adj = selected;
      const s = summarizeAdjustment(adj.lines, adj.generalReason);
      title = `Fiche d'ajustement de stock — ${adj.code}`;
      const rows = adj.lines.map(l => {
        const isLoss = l.reason && LOSS_REASONS.includes(l.reason);
        const cls = (l.discrepancy ?? 0) > 0 ? 'gap-pos' : (l.discrepancy ?? 0) < 0 ? (isLoss ? 'loss' : 'gap-neg') : '';
        return `<tr class="${cls}"><td class="mono">${l.productCode}</td><td>${l.productName}</td>
          <td>${l.category}</td><td>${l.depot}</td><td>${l.unit}</td>
          <td class="num">${l.theoreticalStock}</td>
          <td class="num">${l.countedStock ?? '—'}</td>
          <td class="num">${l.discrepancy == null ? '—' : (l.discrepancy > 0 ? '+' : '') + l.discrepancy}</td>
          <td class="num">${l.countedStock == null ? '—' : l.countedStock}</td>
          <td class="num">${formatFCFA(l.unitPrice)}</td>
          <td class="num">${formatFCFA(l.discrepancyValue ?? 0)}</td>
          <td>${l.reason || adj.generalReason || ''}</td></tr>`;
      }).join('');
      body = `
        <div class="meta">
          <span>Date : <b>${adj.date}</b></span>
          <span>Dépôt : <b>${adj.depot === 'ALL' ? 'Tous' : adj.depot}</b></span>
          <span>Motif général : <b>${adj.generalReason || '—'}</b></span>
          <span>Auteur : <b>${adj.operator}</b></span>
          <span>Statut : <b>${adj.status}</b></span>
          ${adj.validatedBy ? `<span>Validé par : <b>${adj.validatedBy}</b> le ${adj.validatedAt || ''}</span>` : ''}
          ${adj.cancelledBy ? `<span>Annulé par : <b>${adj.cancelledBy}</b> le ${adj.cancelledAt || ''} — ${adj.cancelReason || ''}</span>` : ''}
          ${adj.notes ? `<span>Observations : <b>${adj.notes}</b></span>` : ''}
        </div>
        <table><thead><tr>
          <th>Code</th><th>Désignation</th><th>Famille</th><th>Dépôt</th><th>Unité</th>
          <th class="num">Théorique</th><th class="num">Constatée</th><th class="num">Écart</th>
          <th class="num">Après ajust.</th><th class="num">Coût unit.</th><th class="num">Valeur écart</th><th>Motif</th>
        </tr></thead><tbody>${rows}</tbody></table>
        <div class="totals">
          <div class="tbox"><div class="lbl">Lignes</div><div class="val">${s.lineCount}</div></div>
          <div class="tbox"><div class="lbl">Augmentations</div><div class="val">+${s.totalPositiveQty}</div></div>
          <div class="tbox"><div class="lbl">Diminutions</div><div class="val">−${s.totalNegativeQty}</div></div>
          <div class="tbox"><div class="lbl">Valeur nette des écarts</div><div class="val">${formatFCFA(s.totalDiscrepancyValue)}</div></div>
        </div>
        <div class="foot"><span>GeStock — ${formatAppDateTime()}</span><span>Auteur : ______________  Validateur : ______________</span></div>`;
    } else {
      title = 'Liste des ajustements de stock';
      const rows = filteredList.map(a => `<tr><td class="mono">${a.code}</td><td>${a.date}</td>
        <td>${a.depot === 'ALL' ? 'Tous' : a.depot}</td><td>${a.operator}</td>
        <td class="num">${a.lines.length}</td>
        <td class="num">+${a.totalPositiveQty}</td><td class="num">−${a.totalNegativeQty}</td>
        <td class="num">${formatFCFA(a.totalDiscrepancyValue)}</td><td>${a.status}</td></tr>`).join('');
      body = `
        <div class="meta"><span>Ajustements : <b>${filteredList.length}</b></span><span>Période : <b>toutes</b></span></div>
        <table><thead><tr><th>N°</th><th>Date</th><th>Dépôt</th><th>Auteur</th><th class="num">Lignes</th><th class="num">Écart +</th><th class="num">Écart −</th><th class="num">Valeur</th><th>Statut</th></tr></thead>
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

  const exportCsv = (kind: 'fiche' | 'list') => {
    let csv = '';
    let filename = 'ajustements.csv';
    if (kind === 'fiche' && selected) {
      filename = `ajustement-${selected.code || 'brouillon'}.csv`;
      const head = ['Code', 'Désignation', 'Famille', 'Dépôt', 'Unité', 'Théorique', 'Constatée', 'Écart', 'Coût unit.', 'Valeur écart', 'Motif', 'Observations'];
      const rows = selected.lines.map(l => [
        l.productCode, l.productName, l.category, l.depot, l.unit,
        l.theoreticalStock, l.countedStock ?? '', l.discrepancy ?? '',
        l.unitPrice, l.discrepancyValue ?? 0, l.reason || selected.generalReason || '', l.notes || ''
      ]);
      csv = '﻿' + [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    } else {
      const head = ['N°', 'Date', 'Dépôt', 'Auteur', 'Lignes', 'Écart +', 'Écart −', 'Valeur écarts', 'Statut', 'Validateur', 'Annulé par'];
      const rows = filteredList.map(a => [
        a.code, a.date, a.depot, a.operator, a.lines.length, a.totalPositiveQty, a.totalNegativeQty,
        a.totalDiscrepancyValue, a.status, a.validatedBy || '', a.cancelledBy || ''
      ]);
      csv = '﻿' + [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ================= LISTE =================
  if (!selected) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-[#001F3F] flex items-center gap-2"><Scale className="w-6 h-6" /> Ajustement de produits</h2>
            <p className="text-xs text-slate-500 mt-1">Corrections de quantités traçables — chaque validation génère des mouvements de régularisation.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => printDoc('list')} className="px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs flex items-center gap-1.5">
              <Printer className="w-4 h-4" /> Imprimer la liste
            </button>
            <button onClick={() => exportCsv('list')} className="px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4" /> Exporter CSV
            </button>
            <button onClick={() => setIsCreateOpen(true)} className="px-4 py-2 rounded-lg bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all">
              <Plus className="w-4 h-4" /> Nouvel ajustement
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={listSearch} onChange={e => setListSearch(e.target.value)}
              placeholder="Rechercher : n° d'ajustement, article, auteur…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-[#001F3F]/20 outline-none" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">
            <option value="ALL">Tous les statuts</option>
            <option value="Brouillon">Brouillon</option>
            <option value="Validé">Validé</option>
            <option value="Annulé">Annulé</option>
          </select>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-[#001F3F] text-white uppercase text-[10px]">
              <tr>
                <th className="px-4 py-3 text-left">N°</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Dépôt</th>
                <th className="px-4 py-3 text-left">Auteur</th>
                <th className="px-4 py-3 text-right">Lignes</th>
                <th className="px-4 py-3 text-right">Écarts +</th>
                <th className="px-4 py-3 text-right">Écarts −</th>
                <th className="px-4 py-3 text-right">Valeur</th>
                <th className="px-4 py-3 text-center">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.map(a => (
                <tr key={a.id} onClick={() => setSelected(a)} className="hover:bg-slate-50 cursor-pointer">
                  <td className="px-4 py-2.5 font-mono font-bold text-[#001F3F]">{a.code}</td>
                  <td className="px-4 py-2.5 text-slate-600">{a.date}</td>
                  <td className="px-4 py-2.5">{a.depot === 'ALL' ? 'Tous' : a.depot}</td>
                  <td className="px-4 py-2.5 text-slate-600">{a.operator}</td>
                  <td className="px-4 py-2.5 text-right">{a.lines.length}</td>
                  <td className="px-4 py-2.5 text-right text-emerald-600 font-semibold">{a.totalPositiveQty > 0 ? `+${a.totalPositiveQty}` : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-red-600 font-semibold">{a.totalNegativeQty > 0 ? `−${a.totalNegativeQty}` : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-bold">{formatFCFA(a.totalDiscrepancyValue)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${STATUS_STYLES[a.status]}`}>{a.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                    {a.status === 'Brouillon' && (
                      <button onClick={() => setConfirmDelete(a)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Supprimer le brouillon">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {a.status === 'Validé' && (
                      <button onClick={() => setCancelTarget(a)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Annuler l'ajustement (contre-passation)">
                        <Ban className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredList.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">Aucun ajustement — cliquez sur « Nouvel ajustement ».</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal de création */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setIsCreateOpen(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="font-black text-[#001F3F]">Nouvel ajustement de stock</h3>
                <button onClick={() => setIsCreateOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Dépôt concerné</label>
                  <select value={form.depot} onChange={e => setForm(f => ({ ...f, depot: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                    <option value="ALL">Tous les dépôts</option>
                    {depotOptions.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Motif général (optionnel)</label>
                  <select value={form.generalReason} onChange={e => setForm(f => ({ ...f, generalReason: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                    <option value="">— Aucun (motif par ligne) —</option>
                    {ADJUSTMENT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Observations{form.generalReason === 'Autre motif' ? ' (obligatoire)' : ''}</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm resize-none" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsCreateOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600">Annuler</button>
                <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-[#001F3F] text-white text-xs font-bold">Créer le document</button>
              </div>
            </div>
          </div>
        )}

        {confirmDelete && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
              <h3 className="font-black text-[#001F3F] mb-2">Supprimer le brouillon {confirmDelete.code} ?</h3>
              <p className="text-xs text-slate-500 mb-4">Seuls les brouillons peuvent être supprimés. Cette action est définitive.</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600">Conserver</button>
                <button onClick={() => { flushSave(); onDeleteAdjustment(confirmDelete.id); setConfirmDelete(null); }} className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold">Supprimer</button>
              </div>
            </div>
          </div>
        )}
        {cancelTarget && cancelModal()}
      </div>
    );
  }

  function cancelModal() {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setCancelTarget(null)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
          <h3 className="font-black text-[#001F3F] mb-2">Annuler l'ajustement {cancelTarget?.code} ?</h3>
          <p className="text-xs text-slate-500 mb-3">
            L'ajustement validé ne sera pas supprimé : des <b>mouvements compensatoires</b> seront générés dans le journal de stock et le document passera au statut « Annulé ».
          </p>
          <label className="text-[11px] font-bold text-slate-500 uppercase">Motif d'annulation (obligatoire)</label>
          <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={2}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm resize-none mb-4" />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setCancelTarget(null); setCancelReason(''); }} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600">Retour</button>
            <button onClick={doCancel} className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold">Annuler l'ajustement</button>
          </div>
        </div>
      </div>
    );
  }

  // ================= DOCUMENT =================
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-black text-[#001F3F] flex items-center gap-2">
              Ajustement <span className="font-mono">{selected.code}</span>
              <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${STATUS_STYLES[selected.status]}`}>{selected.status}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {selected.date} • Dépôt : {selected.depot === 'ALL' ? 'Tous' : selected.depot} • Auteur : {selected.operator}
              {selected.validatedBy ? ` • Validé par ${selected.validatedBy} le ${selected.validatedAt}` : ''}
              {selected.cancelledBy ? ` • Annulé par ${selected.cancelledBy} (${selected.cancelReason})` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => printDoc('fiche')} className="px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs flex items-center gap-1.5">
            <Printer className="w-4 h-4" /> Imprimer
          </button>
          <button onClick={() => exportCsv('fiche')} className="px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4" /> Exporter
          </button>
          {!isReadOnly && (
            <>
              <button onClick={handleLoadDepot} className="px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs flex items-center gap-1.5">
                <PackagePlus className="w-4 h-4" /> Charger le dépôt
              </button>
              <button onClick={handleValidate} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all">
                <ShieldCheck className="w-4 h-4" /> Valider l'ajustement
              </button>
            </>
          )}
          {selected.status === 'Validé' && (
            <button onClick={() => setCancelTarget(selected)} className="px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs flex items-center gap-1.5">
              <Ban className="w-4 h-4" /> Annuler l'ajustement
            </button>
          )}
        </div>
      </div>

      {(selected.generalReason || selected.notes) && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-600">
          {selected.generalReason && <span className="font-bold">Motif général : {selected.generalReason}</span>}
          {selected.notes && <span className="ml-3">Observations : {selected.notes}</span>}
        </div>
      )}

      {/* Récapitulatif */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Lignes', value: `${summary.enteredCount}/${summary.lineCount} saisies`, cls: 'text-[#001F3F]' },
            { label: 'Augmentations', value: `+${summary.totalPositiveQty}`, cls: 'text-emerald-600' },
            { label: 'Diminutions', value: `−${summary.totalNegativeQty}`, cls: 'text-red-600' },
            { label: 'Écarts nuls', value: String(summary.zeroCount), cls: 'text-slate-500' },
            { label: 'Valeur nette', value: formatFCFA(summary.totalDiscrepancyValue), cls: summary.totalDiscrepancyValue >= 0 ? 'text-emerald-600' : 'text-red-600' }
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase">{k.label}</div>
              <div className={`text-lg font-black ${k.cls}`}>{k.value}</div>
            </div>
          ))}
        </div>
      )}
      {summary && summary.missingReasons > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-2.5 text-xs font-semibold">
          {summary.missingReasons} écart(s) sans motif — renseignez un motif par ligne ou un motif général avant validation.
        </div>
      )}

      {/* Barre d'outils lignes */}
      <div className="flex flex-wrap items-center gap-2">
        {!isReadOnly && (
          <div className="relative">
            <ScanBarcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={quickAdd} onChange={e => setQuickAdd(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
              placeholder="Code / code-barres / désignation + Entrée"
              className="pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-xs w-72 focus:ring-2 focus:ring-[#001F3F]/20 outline-none" />
          </div>
        )}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={lineSearch} onChange={e => setLineSearch(e.target.value)}
            placeholder="Rechercher dans les lignes…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-[#001F3F]/20 outline-none" />
        </div>
        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
          <ListFilter className="w-3.5 h-3.5" />
          {(['ALL', 'GAP+', 'GAP-', 'OK', 'UNSET'] as const).map(f => (
            <button key={f} onClick={() => setGapFilter(f)}
              className={`px-2 py-1.5 rounded-lg border ${gapFilter === f ? 'bg-[#001F3F] text-white border-[#001F3F]' : 'border-slate-200 hover:bg-slate-50'}`}>
              {f === 'ALL' ? 'Tout' : f === 'GAP+' ? 'Écarts +' : f === 'GAP-' ? 'Écarts −' : f === 'OK' ? 'Sans écart' : 'Non saisis'}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau des lignes */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-auto">
        <table className="w-full text-xs min-w-[1200px]">
          <thead className="bg-[#001F3F] text-white uppercase text-[10px] sticky top-0">
            <tr>
              <th className="px-3 py-3 text-left">Code</th>
              <th className="px-3 py-3 text-left">Désignation</th>
              <th className="px-3 py-3 text-left">Famille</th>
              <th className="px-3 py-3 text-left">Dépôt</th>
              <th className="px-3 py-3 text-left">Unité</th>
              <th className="px-3 py-3 text-right">Théorique</th>
              <th className="px-3 py-3 text-right">Constatée</th>
              <th className="px-3 py-3 text-right">Écart</th>
              <th className="px-3 py-3 text-right">Coût unit.</th>
              <th className="px-3 py-3 text-right">Valeur écart</th>
              <th className="px-3 py-3 text-left">Motif</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleLines.map(l => {
              const isLoss = l.reason ? LOSS_REASONS.includes(l.reason) : false;
              return (
                <tr key={l.productId} className={
                  l.discrepancy == null ? '' :
                  l.discrepancy > 0 ? 'bg-emerald-50/40' :
                  l.discrepancy < 0 ? (isLoss ? 'bg-orange-50/50' : 'bg-red-50/40') : 'bg-slate-50/40'
                }>
                  <td className="px-3 py-2 font-mono font-bold text-[#001F3F]">{l.productCode}</td>
                  <td className="px-3 py-2 font-semibold">{l.productName}{l.barcode ? <span className="block text-[10px] text-slate-400 font-mono">{l.barcode}</span> : null}</td>
                  <td className="px-3 py-2 text-slate-500">{l.category}</td>
                  <td className="px-3 py-2 text-slate-500">{l.depot}</td>
                  <td className="px-3 py-2 text-slate-500">{l.unit}</td>
                  <td className="px-3 py-2 text-right font-semibold">{l.theoreticalStock}</td>
                  <td className="px-3 py-2 text-right">
                    {isReadOnly ? (
                      <span className="font-bold">{l.countedStock ?? '—'}</span>
                    ) : (
                      <input type="number" min={0} step="any" value={l.countedStock ?? ''}
                        onChange={e => updateLine(l.productId, { countedStock: e.target.value === '' ? null : Number(e.target.value) })}
                        className="w-20 px-2 py-1 rounded border border-slate-200 text-right font-bold focus:ring-2 focus:ring-[#001F3F]/20 outline-none"
                        placeholder="—" />
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right font-black ${l.discrepancy == null ? 'text-slate-300' : l.discrepancy > 0 ? 'text-emerald-600' : l.discrepancy < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                    {l.discrepancy == null ? '—' : (l.discrepancy > 0 ? '+' : '') + l.discrepancy}
                  </td>
                  <td className="px-3 py-2 text-right">{formatFCFA(l.unitPrice)}</td>
                  <td className={`px-3 py-2 text-right font-bold ${(l.discrepancyValue ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {l.discrepancy == null ? '—' : formatFCFA(l.discrepancyValue ?? 0)}
                  </td>
                  <td className="px-3 py-2">
                    {isReadOnly ? (
                      <span className="text-slate-600">{l.reason || selected.generalReason || '—'}</span>
                    ) : (
                      <select value={l.reason || ''} onChange={e => updateLine(l.productId, { reason: e.target.value || undefined })}
                        className={`px-2 py-1 rounded border text-[11px] max-w-[190px] ${l.discrepancy != null && l.discrepancy !== 0 && !l.reason && !selected.generalReason ? 'border-amber-400 bg-amber-50' : 'border-slate-200'}`}>
                        <option value="">{selected.generalReason ? `(général : ${selected.generalReason.slice(0, 22)}…)` : '— Choisir un motif —'}</option>
                        {ADJUSTMENT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!isReadOnly && (
                      <button onClick={() => removeLine(l.productId)} className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50" title="Retirer la ligne">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {visibleLines.length === 0 && (
              <tr><td colSpan={12} className="px-4 py-10 text-center text-slate-400">
                {selected.lines.length === 0
                  ? 'Document vide — ajoutez un produit (code / code-barres) ou chargez le dépôt.'
                  : 'Aucune ligne ne correspond aux filtres.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation de validation */}
      {confirmValidate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmValidate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-[#001F3F] mb-2 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600" /> Valider {selected.code} ?</h3>
            <p className="text-xs text-slate-500 mb-3">
              {summary?.positiveCount || 0} entrée(s) et {summary?.negativeCount || 0} sortie(s) de régularisation seront enregistrées dans le journal de stock
              (valeur nette : <b>{formatFCFA(summary?.totalDiscrepancyValue || 0)}</b>). Le document deviendra <b>non modifiable</b>.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmValidate(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600">Retour</button>
              <button onClick={doValidate} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Valider définitivement
              </button>
            </div>
          </div>
        </div>
      )}
      {cancelTarget && cancelModal()}
    </div>
  );
};
