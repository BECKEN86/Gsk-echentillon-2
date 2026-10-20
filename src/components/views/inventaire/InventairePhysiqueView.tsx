import React, { useMemo, useRef, useState } from 'react';
import {
  ClipboardCheck,
  Plus,
  Search,
  Printer,
  FileSpreadsheet,
  FileDown,
  Trash2,
  Play,
  ShieldCheck,
  Lock,
  X,
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  PackagePlus,
  ScanBarcode
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
  PhysicalInventory,
  PhysicalInventoryItem,
  PhysicalInventoryStatus,
  PhysicalInventoryType,
  InventoryCountingMode,
  StockAdjustment,
  StockTransfer,
  CustomerReturn,
  SupplierReturn
} from '../../../types';
import { formatFCFA } from '../../../data/initialData';
import { formatAppDate, formatAppDateTime } from '../../../utils/dateUtils';
import { computeStockValuation } from '../../../utils/stockValuation';
import {
  DISCREPANCY_REASONS,
  refreshLine,
  summarizeInventory,
  makeInventoryLine
} from '../../../utils/physicalInventory';

const STATUS_ORDER: PhysicalInventoryStatus[] = ['Brouillon', 'En cours', 'À contrôler', 'À valider', 'Validé', 'Clôturé'];
const STATUS_STYLES: Record<PhysicalInventoryStatus, string> = {
  'Brouillon': 'bg-slate-100 text-slate-700 border-slate-300',
  'En cours': 'bg-blue-50 text-blue-700 border-blue-200',
  'À contrôler': 'bg-amber-50 text-amber-700 border-amber-200',
  'À valider': 'bg-purple-50 text-purple-700 border-purple-200',
  'Validé': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Clôturé': 'bg-slate-800 text-white border-slate-800'
};
const INVENTORY_TYPES: PhysicalInventoryType[] = ['Général', 'Partiel', 'Par famille', 'Par emplacement'];

interface InventairePhysiqueViewProps {
  inventories: PhysicalInventory[];
  stockAdjustments?: StockAdjustment[];
  stockTransfers?: StockTransfer[];
  customerReturns?: CustomerReturn[];
  supplierReturns?: SupplierReturn[];
  products: Product[];
  categories: ProductCategory[];
  movements: StockMovement[];
  approvisionnements: ApprovisionnementRecord[];
  receptions: GoodsReception[];
  saleOrders: SaleOrder[];
  storageSites: StorageSite[];
  companyConfig: CompanyConfig | null;
  currentUser: UserAccount | null;
  onSaveInventory: (inv: PhysicalInventory) => PhysicalInventory;
  onDeleteInventory: (id: string) => void;
  onApplyAdjustments: (invId: string) => boolean;
}

const emptyForm = () => ({
  referenceDate: formatAppDate(),
  startDate: formatAppDate(),
  depot: 'ALL',
  categoryFilter: 'ALL',
  type: 'Général' as PhysicalInventoryType,
  countingMode: 'visible' as InventoryCountingMode,
  scope: 'all' as 'all' | 'positive' | 'active',
  team: '',
  notes: ''
});

export const InventairePhysiqueView: React.FC<InventairePhysiqueViewProps> = ({
  inventories,
  stockAdjustments = [],
  stockTransfers = [],
  customerReturns = [],
  supplierReturns = [],
  products,
  categories,
  movements,
  approvisionnements,
  receptions,
  saleOrders,
  storageSites,
  companyConfig,
  currentUser,
  onSaveInventory,
  onDeleteInventory,
  onApplyAdjustments
}) => {
  const [selected, setSelected] = useState<PhysicalInventory | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [searchTerm, setSearchTerm] = useState('');
  const [lineSearch, setLineSearch] = useState('');
  const [gapFilter, setGapFilter] = useState<'ALL' | 'GAP+' | 'GAP-' | 'OK' | 'UNCOUNTED'>('ALL');
  const [quickAdd, setQuickAdd] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<PhysicalInventory | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);
  const [listSearch, setListSearch] = useState('');

  const isReadOnly = selected ? (selected.status === 'Validé' || selected.status === 'Clôturé') : false;

  const depotOptions = useMemo(() => {
    const names = new Set<string>();
    storageSites.forEach(s => s.name && names.add(s.name));
    products.forEach(p => p.location && names.add(p.location));
    return Array.from(names).sort();
  }, [storageSites, products]);

  const filteredList = useMemo(() => {
    const t = listSearch.trim().toLowerCase();
    return inventories.filter(i =>
      !t || i.code.toLowerCase().includes(t) || i.operator.toLowerCase().includes(t)
    );
  }, [inventories, listSearch]);

  // ---- Création : charge les articles du périmètre avec stock théorique à la date de référence ----
  const handleCreate = () => {
    const valuation = computeStockValuation({
      products, movements, approvisionnements, receptions, saleOrders, inventories, stockAdjustments, stockTransfers,
      customerReturns, supplierReturns,
      valuationDate: form.referenceDate,
      method: 'CUMP_PERPETUEL'
    });
    const costByProduct = new Map(valuation.map(l => [l.productId, l]));

    const items: PhysicalInventoryItem[] = products
      .filter(p => {
        if (p.isStockable === false) return false;
        const val = costByProduct.get(p.id);
        const depot = p.location || 'Non affecté';
        if (form.depot !== 'ALL' && depot !== form.depot) return false;
        if (form.categoryFilter !== 'ALL' && (p.category || 'Sans famille') !== form.categoryFilter) return false;
        if (form.scope === 'positive' && (val?.quantity ?? p.stock) <= 0) return false;
        if (form.scope === 'active' && !p.availableInPOS) return false;
        return true;
      })
      .map(p => {
        const val = costByProduct.get(p.id);
        return makeInventoryLine({
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
      });

    if (items.length === 0) {
      alert('Aucun article ne correspond au périmètre choisi.');
      return;
    }

    const inv: PhysicalInventory = {
      id: '',
      code: '',
      referenceDate: form.referenceDate,
      startDate: form.startDate,
      depot: form.depot,
      categoryFilter: form.categoryFilter,
      type: form.type,
      countingMode: form.countingMode,
      operator: currentUser?.name || 'Responsable',
      team: form.team || undefined,
      status: 'Brouillon',
      notes: form.notes || undefined,
      items,
      totalDiscrepancyQty: 0,
      totalDiscrepancyValue: 0,
      createdAt: formatAppDateTime()
    };
    const saved = onSaveInventory(inv);
    setIsCreateOpen(false);
    setForm(emptyForm());
    setSelected(saved);
  };

  // Sauvegarde différée des frappes : un chiffre saisi ne doit pas
  // sérialiser toute la base (localStorage + serveur) à chaque touche.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDoc = useRef<PhysicalInventory | null>(null);

  const flushSave = () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (pendingDoc.current) { onSaveInventory(pendingDoc.current); pendingDoc.current = null; }
  };

  const scheduleSave = (doc: PhysicalInventory) => {
    pendingDoc.current = doc;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveTimer.current = null; flushSave(); }, 400);
  };

  // ---- Mise à jour locale d'une ligne, puis sauvegarde ----
  const updateLine = (productId: string, patch: Partial<PhysicalInventoryItem>) => {
    if (!selected || isReadOnly) return;
    const next: PhysicalInventory = {
      ...selected,
      items: selected.items.map(i => i.productId === productId ? refreshLine({ ...i, ...patch }) : i)
    };
    commit(next, true);
  };

  const commit = (inv: PhysicalInventory, debounced = false) => {
    const s = summarizeInventory(inv.items);
    const saved = { ...inv, totalDiscrepancyQty: s.totalGapQty, totalDiscrepancyValue: s.totalGapValue };
    setSelected(saved);
    if (debounced) scheduleSave(saved);
    else { flushSave(); onSaveInventory(saved); }
  };

  const setStatus = (status: PhysicalInventoryStatus) => {
    if (!selected) return;
    if (status === 'À valider') {
      const s = summarizeInventory(selected.items);
      if (s.uncounted > 0 && !window.confirm(`${s.uncounted} article(s) non compté(s) : ils seront ignorés lors de la régularisation. Continuer ?`)) return;
      if (s.missingJustifications > 0) {
        alert(`${s.missingJustifications} écart(s) n'ont pas de motif. Justifiez chaque différence avant la validation.`);
        return;
      }
    }
    if (status === 'Validé') {
      commit({ ...selected, status, validatedBy: currentUser?.name || 'Système', validatedAt: formatAppDateTime() });
      return;
    }
    commit({ ...selected, status });
  };

  // ---- Ajout rapide d'article (code / code-barres / nom) ----
  const handleQuickAdd = () => {
    if (!selected || isReadOnly) return;
    const t = quickAdd.trim().toLowerCase();
    if (!t) return;
    const p = products.find(pr =>
      pr.id && !selected.items.some(i => i.productId === pr.id) &&
      (pr.code.toLowerCase() === t || pr.barcode === quickAdd.trim() || pr.name.toLowerCase().includes(t))
    );
    if (!p) {
      alert('Article introuvable ou déjà présent dans cet inventaire.');
      return;
    }
    const valuation = computeStockValuation({
      products: [p], movements, approvisionnements, receptions, saleOrders, inventories, stockAdjustments, stockTransfers,
      customerReturns, supplierReturns,
      valuationDate: selected.referenceDate, method: 'CUMP_PERPETUEL'
    });
    const val = valuation[0];
    const line = makeInventoryLine({
      productId: p.id, productCode: p.code, productName: p.name, barcode: p.barcode,
      category: p.category || 'Sans famille', unit: p.storageUnit || p.unit || 'pièce',
      depot: p.location || 'Non affecté',
      theoreticalStock: val?.quantity ?? p.stock,
      unitPrice: val?.unitCost ?? p.buyPrice ?? 0
    });
    commit({ ...selected, items: [...selected.items, line] });
    setQuickAdd('');
  };

  const removeLine = (productId: string) => {
    if (!selected || isReadOnly) return;
    commit({ ...selected, items: selected.items.filter(i => i.productId !== productId) });
  };

  // ---- Filtrage du tableau de comptage ----
  const visibleItems = useMemo(() => {
    if (!selected) return [];
    const t = lineSearch.trim().toLowerCase();
    return selected.items.filter(i => {
      if (t && !i.productName.toLowerCase().includes(t) && !i.productCode.toLowerCase().includes(t) && !(i.barcode || '').includes(t)) return false;
      if (gapFilter === 'GAP+' && !(i.discrepancy != null && i.discrepancy > 0)) return false;
      if (gapFilter === 'GAP-' && !(i.discrepancy != null && i.discrepancy < 0)) return false;
      if (gapFilter === 'OK' && i.discrepancy !== 0) return false;
      if (gapFilter === 'UNCOUNTED' && i.physicalCount != null) return false;
      return true;
    });
  }, [selected, lineSearch, gapFilter]);

  const summary = useMemo(() => (selected ? summarizeInventory(selected.items) : null), [selected]);
  const showTheoretical = selected?.countingMode === 'visible';

  // ---- États imprimés ----
  const printSheet = (kind: 'blank' | 'counts' | 'gaps' | 'final') => {
    if (!selected || !summary) return;
    const inv = selected;
    const blind = inv.countingMode === 'blind';
    let rowsHtml = '';
    let title = '';

    if (kind === 'blank') {
      title = 'Feuille de comptage physique';
      rowsHtml = inv.items.map(i => `
        <tr><td class="mono">${i.productCode}</td><td>${i.productName}</td><td>${i.barcode || '-'}</td>
        <td>${i.category}</td><td>${i.depot}</td><td>${i.unit}</td>
        ${blind ? '' : `<td class="num">${i.theoreticalStock}</td>`}
        <td class="fill"></td><td class="fill"></td><td class="fill"></td></tr>`).join('');
    } else {
      const src = kind === 'gaps' ? inv.items.filter(i => (i.discrepancy ?? 0) !== 0) : inv.items;
      title = kind === 'gaps' ? 'État des écarts' : kind === 'counts' ? 'État des quantités comptées' : "Rapport final d'inventaire";
      rowsHtml = src.map(i => `
        <tr class="${(i.discrepancy ?? 0) !== 0 ? 'gap' : ''}"><td class="mono">${i.productCode}</td>
        <td>${i.productName}</td><td>${i.category}</td><td>${i.depot}</td>
        <td class="num">${i.theoreticalStock}</td><td class="num">${i.physicalCount ?? '—'}</td>
        <td class="num">${i.discrepancy == null ? '—' : (i.discrepancy > 0 ? '+' : '') + i.discrepancy}</td>
        <td class="num">${formatFCFA(i.unitPrice)}</td>
        <td class="num">${formatFCFA(i.discrepancyValue ?? 0)}</td>
        <td>${i.justification || ''}</td></tr>`).join('');
    }

    const isBlank = kind === 'blank';
    const headCells = isBlank
      ? `<th>Code</th><th>Désignation</th><th>Code-barres</th><th>Famille</th><th>Empl.</th><th>Unité</th>${blind ? '' : '<th class="num">Théorique</th>'}<th>Compté 1</th><th>Compté 2</th><th>Obs.</th>`
      : `<th>Code</th><th>Désignation</th><th>Famille</th><th>Empl.</th><th class="num">Théorique</th><th class="num">Compté</th><th class="num">Écart</th><th class="num">Coût unit.</th><th class="num">Valeur écart</th><th>Motif</th>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
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
      .fill { border: 1px solid #94a3b8; min-width: 55px; height: 20px; }
      tr.gap td { background: #fffbeb; }
      .totals { display: flex; gap: 16px; margin-top: 12px; }
      .tbox { border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 12px; }
      .tbox .lbl { font-size: 9px; text-transform: uppercase; color: #64748b; }
      .tbox .val { font-size: 14px; font-weight: 800; color: #001F3F; }
      .foot { margin-top: 16px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
    </style></head><body>
      <div class="header">
        <div>
          <div class="company">${companyConfig?.name || 'GeStock'}</div>
          <div class="sub">${companyConfig?.address || ''} ${companyConfig?.phone ? '• ' + companyConfig.phone : ''}</div>
        </div>
        <div style="text-align:right"><div class="sub">Édité le ${formatAppDateTime()} par ${currentUser?.name || 'Système'}</div></div>
      </div>
      <h1>${title} — ${inv.code}</h1>
      <div class="meta">
        <span>Date de référence : <b>${inv.referenceDate}</b></span>
        <span>Période : <b>${inv.startDate}${inv.endDate ? ' → ' + inv.endDate : ''}</b></span>
        <span>Dépôt : <b>${inv.depot === 'ALL' ? 'Tous' : inv.depot}</b></span>
        <span>Type : <b>${inv.type}</b> • Mode : <b>${blind ? 'Comptage à l\u2019aveugle' : 'Théorique visible'}</b></span>
        <span>Responsable : <b>${inv.operator}</b>${inv.team ? ` • Équipe : <b>${inv.team}</b>` : ''}</span>
        <span>Statut : <b>${inv.status}</b></span>
      </div>
      <table><thead><tr>${headCells}</tr></thead><tbody>${rowsHtml}</tbody></table>
      ${isBlank ? '' : `
      <div class="totals">
        <div class="tbox"><div class="lbl">Articles prévus</div><div class="val">${summary.planned}</div></div>
        <div class="tbox"><div class="lbl">Comptés</div><div class="val">${summary.counted}</div></div>
        <div class="tbox"><div class="lbl">Écarts +</div><div class="val">${summary.positiveGaps}</div></div>
        <div class="tbox"><div class="lbl">Écarts −</div><div class="val">${summary.negativeGaps}</div></div>
        <div class="tbox"><div class="lbl">Valeur des écarts</div><div class="val">${formatFCFA(summary.totalGapValue)}</div></div>
      </div>`}
      <div class="foot"><span>GeStock — ${formatAppDateTime()}</span><span>Signature responsable : ______________  Validateur : ______________</span></div>
      <script>window.onload = () => { window.print(); }<\/script>
    </body></html>`;
    const w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  const exportCsv = () => {
    if (!selected) return;
    const head = ['Code', 'Désignation', 'Code-barres', 'Famille', 'Emplacement', 'Unité', 'Théorique', 'Compté 1', 'Compté 2', 'Retenu', 'Écart', 'Coût unit.', 'Valeur écart', 'Motif', 'Statut'];
    const rows = selected.items.map(i => [
      i.productCode, i.productName, i.barcode || '', i.category, i.depot, i.unit,
      i.theoreticalStock, i.count1 ?? '', i.count2 ?? '', i.physicalCount ?? '',
      i.discrepancy ?? '', i.unitPrice, i.discrepancyValue ?? 0, i.justification || '', i.countStatus
    ]);
    const csv = '﻿' + [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `inventaire-${selected.code || 'brouillon'}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ============================ RENDU ============================
  return (
    <div className="space-y-5 pb-12">
      {!selected ? (
        <>
          {/* ======= LISTE DES INVENTAIRES ======= */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <ClipboardCheck className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-base font-bold text-[#001F3F]">Inventaires physiques</h2>
                <p className="text-[11px] text-slate-500">Comptage → écarts → justification → validation → régularisation</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  value={listSearch}
                  onChange={e => setListSearch(e.target.value)}
                  placeholder="N° ou responsable…"
                  className="pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs w-48 focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="px-4 py-2 rounded-lg bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Nouvel inventaire
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold uppercase border-b border-slate-200">
                  <th className="py-2.5 px-4">N° Inventaire</th>
                  <th className="py-2.5 px-4">Référence</th>
                  <th className="py-2.5 px-4">Période</th>
                  <th className="py-2.5 px-4">Périmètre</th>
                  <th className="py-2.5 px-4 text-center">Articles</th>
                  <th className="py-2.5 px-4 text-right">Écarts</th>
                  <th className="py-2.5 px-4">Responsable</th>
                  <th className="py-2.5 px-4">Statut</th>
                  <th className="py-2.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.length === 0 ? (
                  <tr><td colSpan={9} className="py-12 text-center text-slate-400">
                    <ClipboardCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Aucun inventaire — cliquez « Nouvel inventaire » pour démarrer un comptage.
                  </td></tr>
                ) : filteredList.map(inv => {
                  const s = summarizeInventory(inv.items);
                  return (
                    <tr key={inv.id} className="hover:bg-blue-50/40 cursor-pointer" onClick={() => setSelected(inv)}>
                      <td className="py-3 px-4 font-mono font-bold text-[#001F3F]">{inv.code}</td>
                      <td className="py-3 px-4">{inv.referenceDate}</td>
                      <td className="py-3 px-4 text-slate-600">{inv.startDate}{inv.endDate ? ` → ${inv.endDate}` : ''}</td>
                      <td className="py-3 px-4 text-slate-600">{inv.depot === 'ALL' ? 'Tous dépôts' : inv.depot}{inv.categoryFilter !== 'ALL' ? ` • ${inv.categoryFilter}` : ''}</td>
                      <td className="py-3 px-4 text-center font-bold">{s.planned}</td>
                      <td className={`py-3 px-4 text-right font-bold ${s.totalGapValue !== 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {formatFCFA(s.totalGapValue)}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{inv.operator}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLES[inv.status]}`}>{inv.status}</span>
                      </td>
                      <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setSelected(inv)} className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600" title="Ouvrir">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {inv.status === 'Brouillon' && (
                            <button onClick={() => setConfirmDelete(inv)} className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600" title="Supprimer">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {/* ======= FICHE INVENTAIRE ======= */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelected(null)} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-extrabold text-[#001F3F] font-mono">{selected.code}</h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${STATUS_STYLES[selected.status]}`}>{selected.status}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                      {selected.countingMode === 'blind' ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {selected.countingMode === 'blind' ? 'Comptage à l\u2019aveugle' : 'Théorique visible'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Référence {selected.referenceDate} • {selected.depot === 'ALL' ? 'Tous dépôts' : selected.depot}
                    {selected.categoryFilter !== 'ALL' ? ` • ${selected.categoryFilter}` : ''} • {selected.type}
                    {' '}• Responsable : <b>{selected.operator}</b>{selected.team ? ` • Équipe : ${selected.team}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button onClick={() => printSheet('blank')} className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5" /> Feuille de comptage
                </button>
                <button onClick={() => printSheet('counts')} className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5" /> Comptages
                </button>
                <button onClick={() => printSheet('gaps')} className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold text-xs flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5" /> Écarts
                </button>
                <button onClick={exportCsv} className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                </button>
                <button onClick={() => printSheet('final')} className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs flex items-center gap-1.5">
                  <FileDown className="w-3.5 h-3.5" /> Rapport PDF
                </button>
              </div>
            </div>

            {/* Bandeau workflow */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {STATUS_ORDER.map((s, idx) => (
                <React.Fragment key={s}>
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                    s === selected.status ? STATUS_STYLES[s] + ' ring-1 ring-offset-1 ring-slate-300' : 'bg-white text-slate-400 border-slate-200'
                  }`}>{s}</span>
                  {idx < STATUS_ORDER.length - 1 && <span className="text-slate-300">→</span>}
                </React.Fragment>
              ))}
            </div>

            {/* KPIs */}
            {summary && (
              <div className="grid grid-cols-3 md:grid-cols-7 gap-2.5 text-center">
                <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200"><div className="text-[10px] font-bold text-slate-500 uppercase">Prévus</div><div className="text-lg font-extrabold text-[#001F3F]">{summary.planned}</div></div>
                <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200"><div className="text-[10px] font-bold text-slate-500 uppercase">Comptés</div><div className="text-lg font-extrabold text-blue-700">{summary.counted}</div></div>
                <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200"><div className="text-[10px] font-bold text-slate-500 uppercase">Non comptés</div><div className={`text-lg font-extrabold ${summary.uncounted > 0 ? 'text-amber-600' : 'text-[#001F3F]'}`}>{summary.uncounted}</div></div>
                <div className="bg-emerald-50 rounded-lg p-2.5 border border-emerald-200"><div className="text-[10px] font-bold text-emerald-700 uppercase">Écarts +</div><div className="text-lg font-extrabold text-emerald-700">{summary.positiveGaps}</div></div>
                <div className="bg-red-50 rounded-lg p-2.5 border border-red-200"><div className="text-[10px] font-bold text-red-700 uppercase">Écarts −</div><div className="text-lg font-extrabold text-red-700">{summary.negativeGaps}</div></div>
                <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200"><div className="text-[10px] font-bold text-slate-500 uppercase">Sans écart</div><div className="text-lg font-extrabold text-[#001F3F]">{summary.noGap}</div></div>
                <div className="bg-amber-50 rounded-lg p-2.5 border border-amber-200"><div className="text-[10px] font-bold text-amber-700 uppercase">Valeur écarts</div><div className="text-lg font-extrabold text-amber-800">{formatFCFA(summary.totalGapValue)}</div></div>
              </div>
            )}

            {/* Barre d'actions du workflow */}
            <div className="flex items-center justify-between flex-wrap gap-2 border-t border-slate-100 pt-3">
              <div className="flex items-center gap-2">
                {selected.status === 'Brouillon' && (
                  <button onClick={() => setStatus('En cours')} className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5">
                    <Play className="w-3.5 h-3.5" /> Démarrer le comptage
                  </button>
                )}
                {selected.status === 'En cours' && (
                  <button onClick={() => setStatus('À contrôler')} className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Passer au contrôle des écarts
                  </button>
                )}
                {selected.status === 'À contrôler' && (
                  <button onClick={() => setStatus('À valider')} className="px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Soumettre pour validation
                  </button>
                )}
                {selected.status === 'À valider' && (
                  <>
                    <button onClick={() => setStatus('Validé')} className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" /> Valider l'inventaire
                    </button>
                    <button onClick={() => setStatus('À contrôler')} className="px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 font-semibold text-xs">
                      Renvoyer au contrôle
                    </button>
                  </>
                )}
                {selected.status === 'Validé' && !selected.adjustmentsApplied && (
                  <button onClick={() => setConfirmApply(true)} className="px-3.5 py-2 rounded-lg bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" /> Générer les ajustements & clôturer
                  </button>
                )}
                {selected.status === 'Clôturé' && (
                  <span className="px-3.5 py-2 rounded-lg bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" /> Inventaire clôturé — régularisé le {selected.closedAt}
                  </span>
                )}
              </div>
              {summary && summary.missingJustifications > 0 && !isReadOnly && (
                <span className="text-xs text-amber-700 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {summary.missingJustifications} écart(s) sans motif
                </span>
              )}
            </div>
          </div>

          {/* Outils du tableau */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={lineSearch}
                onChange={e => setLineSearch(e.target.value)}
                placeholder="Rechercher dans les lignes…"
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <select
              value={gapFilter}
              onChange={e => setGapFilter(e.target.value as typeof gapFilter)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
            >
              <option value="ALL">Toutes les lignes</option>
              <option value="UNCOUNTED">Non comptées</option>
              <option value="GAP+">Écarts positifs</option>
              <option value="GAP-">Écarts négatifs</option>
              <option value="OK">Sans écart</option>
            </select>
            {!isReadOnly && (
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    value={quickAdd}
                    onChange={e => setQuickAdd(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
                    placeholder="Code / code-barres à ajouter…"
                    className="pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs w-56 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button onClick={handleQuickAdd} className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200" title="Ajouter l'article">
                  <PackagePlus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Tableau de comptage */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Désignation</th>
                    <th className="py-2.5 px-3">Code-barres</th>
                    <th className="py-2.5 px-3">Famille</th>
                    <th className="py-2.5 px-3">Empl.</th>
                    <th className="py-2.5 px-3">Unité</th>
                    {showTheoretical && <th className="py-2.5 px-3 text-right">Théorique</th>}
                    <th className="py-2.5 px-3 text-center">Compté 1</th>
                    <th className="py-2.5 px-3 text-center">Compté 2</th>
                    <th className="py-2.5 px-3 text-right">Retenu</th>
                    {showTheoretical && <th className="py-2.5 px-3 text-right">Écart</th>}
                    <th className="py-2.5 px-3 text-right">Coût unit.</th>
                    {showTheoretical && <th className="py-2.5 px-3 text-right">Valeur écart</th>}
                    {showTheoretical && <th className="py-2.5 px-3">Motif</th>}
                    <th className="py-2.5 px-3">Obs.</th>
                    <th className="py-2.5 px-3 text-center">Statut</th>
                    {!isReadOnly && <th className="py-2.5 px-3"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleItems.length === 0 ? (
                    <tr><td colSpan={16} className="py-10 text-center text-slate-400">Aucune ligne ne correspond au filtre.</td></tr>
                  ) : visibleItems.map(i => {
                    const isGap = i.discrepancy != null && i.discrepancy !== 0;
                    return (
                      <tr key={i.productId} className={`${isGap ? 'bg-amber-50/60' : i.physicalCount != null ? 'bg-emerald-50/30' : ''} hover:bg-blue-50/40`}>
                        <td className="py-2 px-3 font-mono text-slate-600">{i.productCode}</td>
                        <td className="py-2 px-3 font-bold text-[#001F3F]">{i.productName}</td>
                        <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">{i.barcode || '-'}</td>
                        <td className="py-2 px-3 text-slate-600">{i.category}</td>
                        <td className="py-2 px-3 text-slate-600">{i.depot}</td>
                        <td className="py-2 px-3 text-slate-600">{i.unit}</td>
                        {showTheoretical && <td className="py-2 px-3 text-right font-bold text-slate-700">{i.theoreticalStock}</td>}
                        <td className="py-2 px-3 text-center">
                          <input
                            type="number" min="0"
                            value={i.count1 ?? ''}
                            disabled={isReadOnly}
                            onChange={e => updateLine(i.productId, { count1: e.target.value === '' ? null : Number(e.target.value) })}
                            className="w-16 px-1.5 py-1 text-center bg-white border border-slate-200 rounded text-xs font-bold disabled:bg-slate-50 disabled:text-slate-400"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="number" min="0"
                            value={i.count2 ?? ''}
                            disabled={isReadOnly || i.count1 == null}
                            onChange={e => updateLine(i.productId, { count2: e.target.value === '' ? null : Number(e.target.value) })}
                            className="w-16 px-1.5 py-1 text-center bg-white border border-slate-200 rounded text-xs font-bold disabled:bg-slate-50 disabled:text-slate-400"
                          />
                        </td>
                        <td className="py-2 px-3 text-right font-extrabold text-[#001F3F]">{i.physicalCount ?? '—'}</td>
                        {showTheoretical && (
                          <td className={`py-2 px-3 text-right font-extrabold ${i.discrepancy == null ? 'text-slate-400' : i.discrepancy > 0 ? 'text-emerald-700' : i.discrepancy < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                            {i.discrepancy == null ? '—' : (i.discrepancy > 0 ? '+' : '') + i.discrepancy}
                          </td>
                        )}
                        <td className="py-2 px-3 text-right text-slate-600">{formatFCFA(i.unitPrice)}</td>
                        {showTheoretical && (
                          <td className={`py-2 px-3 text-right font-bold ${(i.discrepancyValue ?? 0) > 0 ? 'text-emerald-700' : (i.discrepancyValue ?? 0) < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                            {i.discrepancy == null ? '—' : formatFCFA(i.discrepancyValue ?? 0)}
                          </td>
                        )}
                        {showTheoretical && (
                          <td className="py-2 px-3">
                            {isGap ? (
                              <select
                                value={i.justification || ''}
                                disabled={isReadOnly}
                                onChange={e => updateLine(i.productId, { justification: e.target.value })}
                                className={`w-36 px-1.5 py-1 border rounded text-[11px] ${!i.justification ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white'}`}
                              >
                                <option value="">Motif requis…</option>
                                {DISCREPANCY_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                        )}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={i.notes || ''}
                            disabled={isReadOnly}
                            onChange={e => updateLine(i.productId, { notes: e.target.value })}
                            className="w-24 px-1.5 py-1 bg-white border border-slate-200 rounded text-[11px] disabled:bg-slate-50"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            i.countStatus === 'Écart' ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : i.countStatus === 'Sans écart' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : i.countStatus === 'Compté' ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                          }`}>{i.countStatus}</span>
                        </td>
                        {!isReadOnly && (
                          <td className="py-2 px-3 text-center">
                            <button onClick={() => removeLine(i.productId)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500" title="Retirer la ligne">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ======= MODAL CRÉATION ======= */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-4">
            <div className="p-4 border-b border-slate-100 bg-[#001F3F] text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-blue-300" /> Nouvel inventaire physique</h3>
              <button onClick={() => setIsCreateOpen(false)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-500 uppercase mb-1">Date de référence (stock théorique)</label>
                <input type="date" value={form.referenceDate} onChange={e => setForm({ ...form, referenceDate: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium" />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase mb-1">Date de début</label>
                <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium" />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase mb-1">Dépôt / magasin</label>
                <select value={form.depot} onChange={e => setForm({ ...form, depot: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium">
                  <option value="ALL">Tous les dépôts</option>
                  {depotOptions.map(d => <option key={d} value={d}>{d}</option>)}
                  <option value="Non affecté">Non affecté</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase mb-1">Famille d'articles</label>
                <select value={form.categoryFilter} onChange={e => setForm({ ...form, categoryFilter: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium">
                  <option value="ALL">Toutes les familles</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase mb-1">Type d'inventaire</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as PhysicalInventoryType })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium">
                  {INVENTORY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase mb-1">Périmètre des articles</label>
                <select value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value as typeof form.scope })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium">
                  <option value="all">Tous les articles stockables (stock nul inclus)</option>
                  <option value="positive">Stock positif uniquement</option>
                  <option value="active">Articles actifs au POS uniquement</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase mb-1">Mode de comptage</label>
                <select value={form.countingMode} onChange={e => setForm({ ...form, countingMode: e.target.value as InventoryCountingMode })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium">
                  <option value="visible">Quantités théoriques visibles</option>
                  <option value="blind">Comptage à l'aveugle (théorique masqué)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase mb-1">Équipe de comptage</label>
                <input type="text" value={form.team} onChange={e => setForm({ ...form, team: e.target.value })} placeholder="Ex: Kouassi M., Traoré A." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium" />
              </div>
              <div className="col-span-2">
                <label className="block font-semibold text-slate-500 uppercase mb-1">Observations</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium" placeholder="Consignes particulières, zones concernées…" />
              </div>
              <div className="col-span-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-[11px] text-blue-800">
                Les quantités théoriques sont figées à la <b>date de référence</b> — reconstituées depuis les mouvements de stock (CUMP). Les mouvements enregistrés pendant le comptage n'affectent pas la comparaison.
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setIsCreateOpen(false)} className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold text-xs">Annuler</button>
              <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Créer & charger les articles
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======= MODAL SUPPRESSION ======= */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="p-5 text-center space-y-3">
              <Trash2 className="w-10 h-10 text-red-500 mx-auto" />
              <p className="font-bold text-[#001F3F]">Supprimer l'inventaire {confirmDelete.code} ?</p>
              <p className="text-xs text-slate-500">Seul un brouillon peut être supprimé. Cette action est définitive.</p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center gap-2">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold text-xs">Annuler</button>
              <button onClick={() => { flushSave(); onDeleteInventory(confirmDelete.id); setConfirmDelete(null); }} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* ======= MODAL CONFIRMATION AJUSTEMENTS ======= */}
      {confirmApply && selected && summary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center gap-2.5">
              <Lock className="w-5 h-5 text-[#001F3F]" />
              <h3 className="font-bold text-[#001F3F]">Générer les ajustements de stock</h3>
            </div>
            <div className="p-5 space-y-3 text-xs text-slate-600">
              <p>Des mouvements de régularisation référencés <b className="font-mono">{selected.code}</b> seront créés :</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><b className="text-emerald-700">{summary.positiveGaps} entrée(s)</b> de régularisation (+)</li>
                <li><b className="text-red-600">{summary.negativeGaps} sortie(s)</b> de régularisation (−)</li>
                <li>{summary.noGap} article(s) sans écart — aucun mouvement</li>
                {summary.uncounted > 0 && <li className="text-amber-700 font-semibold">{summary.uncounted} article(s) non compté(s) — ignorés</li>}
              </ul>
              <p className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-amber-800 font-medium">
                L'opération est définitive : les stocks seront mis à jour et l'inventaire passera à « Clôturé ».
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setConfirmApply(false)} className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold text-xs">Annuler</button>
              <button
                onClick={() => {
                  flushSave(); // le parent doit régulariser le document à jour
                  const ok = onApplyAdjustments(selected.id);
                  setConfirmApply(false);
                  if (!ok) alert('Échec de la régularisation — vérifiez les stocks (aucun mouvement partiel n\u2019a été appliqué).');
                }}
                className="px-4 py-2 rounded-lg bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" /> Confirmer la régularisation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
