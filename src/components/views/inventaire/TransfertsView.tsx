import React, { useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Plus,
  Search,
  Printer,
  FileSpreadsheet,
  Trash2,
  Ban,
  X,
  CheckCircle2,
  ScanBarcode,
  PackageCheck,
  Truck
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
  StorageSite,
  CompanyConfig,
  UserAccount,
  CustomerReturn,
  SupplierReturn
} from '../../../types';
import { formatFCFA } from '../../../data/initialData';
import { formatAppDate, formatAppDateTime } from '../../../utils/dateUtils';
import { computeStockValuation } from '../../../utils/stockValuation';
import { transferTotalValue } from '../../../utils/stockTransfer';

type TransferStatus = StockTransfer['status'];

const STATUS_STYLES: Record<TransferStatus, string> = {
  'En transit': 'bg-amber-50 text-amber-700 border-amber-200',
  'Réceptionné': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Annulé': 'bg-red-50 text-red-700 border-red-200'
};

interface DraftLine {
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  available: number; // stock global actuel
}

interface TransfertsViewProps {
  transfers: StockTransfer[];
  products: Product[];
  movements: StockMovement[];
  approvisionnements: ApprovisionnementRecord[];
  receptions: GoodsReception[];
  saleOrders: SaleOrder[];
  inventories?: PhysicalInventory[];
  stockAdjustments?: StockAdjustment[];
  customerReturns?: CustomerReturn[];
  supplierReturns?: SupplierReturn[];
  storageSites: StorageSite[];
  companyConfig: CompanyConfig | null;
  currentUser: UserAccount | null;
  onCreateTransfer: (t: StockTransfer) => { ok: boolean; error?: string };
  onReceiveTransfer: (id: string) => boolean;
  onCancelTransfer: (id: string, reason: string) => boolean;
  onDeleteTransfer: (id: string) => void;
}

const emptyForm = () => ({
  sourceLocation: '',
  targetLocation: '',
  receiver: '',
  notes: ''
});

export const TransfertsView: React.FC<TransfertsViewProps> = ({
  transfers,
  products,
  movements,
  approvisionnements,
  receptions,
  saleOrders,
  inventories = [],
  stockAdjustments = [],
  customerReturns = [],
  supplierReturns = [],
  storageSites,
  companyConfig,
  currentUser,
  onCreateTransfer,
  onReceiveTransfer,
  onCancelTransfer,
  onDeleteTransfer
}) => {
  const [selected, setSelected] = useState<StockTransfer | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [quickAdd, setQuickAdd] = useState('');
  const [listSearch, setListSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TransferStatus>('ALL');
  const [confirmReceive, setConfirmReceive] = useState<StockTransfer | null>(null);
  const [cancelTarget, setCancelTarget] = useState<StockTransfer | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<StockTransfer | null>(null);

  const depotOptions = useMemo(() => {
    const names = new Set<string>();
    storageSites.forEach(s => s.name && names.add(s.name));
    products.forEach(p => p.location && names.add(p.location));
    return Array.from(names).sort();
  }, [storageSites, products]);

  /** CUMP du jour par produit — coût figé à l'expédition */
  const valuationNow = useMemo(
    () => new Map(computeStockValuation({
      products, movements, approvisionnements, receptions, saleOrders, inventories, stockAdjustments, stockTransfers: transfers,
      customerReturns, supplierReturns,
      valuationDate: formatAppDate(), method: 'CUMP_PERPETUEL'
    }).map(l => [l.productId, l])),
    [products, movements, approvisionnements, receptions, saleOrders, inventories, stockAdjustments, transfers, customerReturns, supplierReturns]
  );

  const filteredList = useMemo(() => {
    const t = listSearch.trim().toLowerCase();
    return transfers.filter(tr => {
      if (statusFilter !== 'ALL' && tr.status !== statusFilter) return false;
      if (!t) return true;
      return tr.code.toLowerCase().includes(t)
        || tr.sourceLocation.toLowerCase().includes(t)
        || tr.targetLocation.toLowerCase().includes(t)
        || tr.operator.toLowerCase().includes(t)
        || tr.items.some(i => i.productName.toLowerCase().includes(t) || (i.productCode || '').toLowerCase().includes(t));
    });
  }, [transfers, listSearch, statusFilter]);

  const kpis = useMemo(() => ({
    transit: transfers.filter(t => t.status === 'En transit').length,
    received: transfers.filter(t => t.status === 'Réceptionné').length,
    transitValue: transfers.filter(t => t.status === 'En transit').reduce((s, t) => s + (t.totalValue || 0), 0)
  }), [transfers]);

  const handleQuickAdd = () => {
    const t = quickAdd.trim().toLowerCase();
    if (!t) return;
    const p = products.find(pr =>
      pr.isStockable !== false && !draftLines.some(l => l.productId === pr.id) &&
      (pr.code.toLowerCase() === t || pr.barcode === quickAdd.trim() || pr.name.toLowerCase().includes(t))
    );
    if (!p) {
      alert('Article introuvable, non stockable, ou déjà dans la liste.');
      return;
    }
    const val = valuationNow.get(p.id);
    setDraftLines(prev => [...prev, {
      productId: p.id,
      productName: p.name,
      productCode: p.code,
      quantity: 1,
      unit: p.storageUnit || p.unit || 'pièce',
      unitPrice: val?.unitCost ?? p.buyPrice ?? 0,
      available: p.stock
    }]);
    setQuickAdd('');
  };

  const updateDraftQty = (productId: string, qty: number) => {
    setDraftLines(prev => prev.map(l => l.productId === productId ? { ...l, quantity: qty } : l));
  };

  const handleCreate = () => {
    if (!form.sourceLocation || !form.targetLocation) {
      alert('Sélectionnez le dépôt source et le dépôt de destination.');
      return;
    }
    if (form.sourceLocation === form.targetLocation) {
      alert('Le dépôt source et la destination doivent être différents.');
      return;
    }
    if (draftLines.length === 0) { alert('Ajoutez au moins un article.'); return; }
    const bad = draftLines.find(l => !l.quantity || l.quantity <= 0);
    if (bad) { alert(`Quantité invalide pour ${bad.productName}.`); return; }

    const t: StockTransfer = {
      id: '',
      code: '',
      date: formatAppDateTime(),
      sourceLocation: form.sourceLocation,
      targetLocation: form.targetLocation,
      operator: currentUser?.name || 'Système',
      receiver: form.receiver || undefined,
      status: 'En transit',
      items: draftLines.map(l => ({
        productId: l.productId,
        productName: l.productName,
        productCode: l.productCode,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unitPrice
      })),
      totalValue: transferTotalValue({ items: draftLines }),
      notes: form.notes || undefined,
      createdAt: formatAppDateTime()
    };
    const res = onCreateTransfer(t);
    if (!res.ok) {
      alert(res.error || 'Transfert refusé.');
      return;
    }
    setIsCreateOpen(false);
    setForm(emptyForm());
    setDraftLines([]);
  };

  const doReceive = () => {
    if (!confirmReceive) return;
    const ok = onReceiveTransfer(confirmReceive.id);
    if (!ok) alert('Réception impossible : le transfert n\'est plus en transit.');
    if (selected?.id === confirmReceive.id) setSelected({ ...selected, status: 'Réceptionné', receivedBy: currentUser?.name, receivedAt: formatAppDateTime() });
    setConfirmReceive(null);
  };

  const doCancel = () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) { alert('Un motif d\'annulation est obligatoire.'); return; }
    const ok = onCancelTransfer(cancelTarget.id, cancelReason.trim());
    if (!ok) alert('Annulation impossible : seul un transfert « En transit » peut être annulé.');
    else if (selected?.id === cancelTarget.id) setSelected({ ...selected, status: 'Annulé', cancelledBy: currentUser?.name, cancelledAt: formatAppDateTime(), cancelReason: cancelReason.trim() });
    setCancelTarget(null);
    setCancelReason('');
  };

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
      .totals { display: flex; gap: 16px; margin-top: 12px; }
      .tbox { border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 12px; }
      .tbox .lbl { font-size: 9px; text-transform: uppercase; color: #64748b; }
      .tbox .val { font-size: 14px; font-weight: 800; color: #001F3F; }
      .foot { margin-top: 16px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }`;

    let body = '';
    let title = '';
    if (kind === 'fiche' && selected) {
      const tr = selected;
      title = `Bon de transfert — ${tr.code}`;
      const rows = tr.items.map(i => `<tr><td class="mono">${i.productCode || ''}</td><td>${i.productName}</td>
        <td>${i.unit}</td><td class="num">${i.quantity}</td>
        <td class="num">${i.unitPrice != null ? formatFCFA(i.unitPrice) : '—'}</td>
        <td class="num">${i.unitPrice != null ? formatFCFA(i.quantity * i.unitPrice) : '—'}</td></tr>`).join('');
      body = `
        <div class="meta">
          <span>Date : <b>${tr.date}</b></span>
          <span>Source : <b>${tr.sourceLocation}</b></span>
          <span>Destination : <b>${tr.targetLocation}</b></span>
          <span>Expéditeur : <b>${tr.operator}</b></span>
          ${tr.receiver ? `<span>Destinataire : <b>${tr.receiver}</b></span>` : ''}
          <span>Statut : <b>${tr.status}</b></span>
          ${tr.receivedBy ? `<span>Reçu par : <b>${tr.receivedBy}</b> le ${tr.receivedAt || ''}</span>` : ''}
          ${tr.cancelledBy ? `<span>Annulé par : <b>${tr.cancelledBy}</b> — ${tr.cancelReason || ''}</span>` : ''}
          ${tr.notes ? `<span>Observations : <b>${tr.notes}</b></span>` : ''}
        </div>
        <table><thead><tr><th>Code</th><th>Désignation</th><th>Unité</th><th class="num">Quantité</th><th class="num">Coût unit.</th><th class="num">Valeur</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <div class="totals">
          <div class="tbox"><div class="lbl">Articles</div><div class="val">${tr.items.length}</div></div>
          <div class="tbox"><div class="lbl">Quantité totale</div><div class="val">${tr.items.reduce((s, i) => s + i.quantity, 0)}</div></div>
          <div class="tbox"><div class="lbl">Valeur transférée</div><div class="val">${formatFCFA(tr.totalValue || 0)}</div></div>
        </div>
        <div class="foot"><span>GeStock — ${formatAppDateTime()}</span><span>Expéditeur : ______________  Réceptionnaire : ______________</span></div>`;
    } else {
      title = 'Liste des transferts inter-dépôts';
      const rows = filteredList.map(t => `<tr><td class="mono">${t.code}</td><td>${t.date}</td>
        <td>${t.sourceLocation}</td><td>${t.targetLocation}</td><td>${t.operator}</td>
        <td class="num">${t.items.length}</td><td class="num">${t.items.reduce((s, i) => s + i.quantity, 0)}</td>
        <td class="num">${formatFCFA(t.totalValue || 0)}</td><td>${t.status}</td></tr>`).join('');
      body = `
        <div class="meta"><span>Transferts : <b>${filteredList.length}</b></span></div>
        <table><thead><tr><th>N°</th><th>Date</th><th>Source</th><th>Destination</th><th>Opérateur</th><th class="num">Lignes</th><th class="num">Qté</th><th class="num">Valeur</th><th>Statut</th></tr></thead>
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
    w.document.write(html);
    w.document.close();
  };

  const exportCsv = (kind: 'fiche' | 'list') => {
    let csv = '';
    let filename = 'transferts.csv';
    if (kind === 'fiche' && selected) {
      filename = `transfert-${selected.code}.csv`;
      const head = ['Code', 'Désignation', 'Unité', 'Quantité', 'Coût unitaire', 'Valeur'];
      const rows = selected.items.map(i => [i.productCode || '', i.productName, i.unit, i.quantity, i.unitPrice ?? '', i.unitPrice != null ? i.quantity * i.unitPrice : '']);
      csv = '﻿' + [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    } else {
      const head = ['N°', 'Date', 'Source', 'Destination', 'Opérateur', 'Lignes', 'Quantité', 'Valeur', 'Statut'];
      const rows = filteredList.map(t => [t.code, t.date, t.sourceLocation, t.targetLocation, t.operator, t.items.length, t.items.reduce((s, i) => s + i.quantity, 0), t.totalValue || 0, t.status]);
      csv = '﻿' + [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const cancelModal = () => (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setCancelTarget(null)}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="font-black text-[#001F3F] mb-2">Annuler le transfert {cancelTarget?.code} ?</h3>
        <p className="text-xs text-slate-500 mb-3">
          Les marchandises en transit <b>retournent en stock</b> au dépôt source (mouvements compensatoires traçables).
        </p>
        <label className="text-[11px] font-bold text-slate-500 uppercase">Motif d'annulation (obligatoire)</label>
        <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={2}
          className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm resize-none mb-4" />
        <div className="flex justify-end gap-2">
          <button onClick={() => { setCancelTarget(null); setCancelReason(''); }} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600">Retour</button>
          <button onClick={doCancel} className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold">Annuler le transfert</button>
        </div>
      </div>
    </div>
  );

  // ================= LISTE =================
  if (!selected) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-[#001F3F] flex items-center gap-2"><ArrowRightLeft className="w-6 h-6" /> Transferts inter-dépôts</h2>
            <p className="text-xs text-slate-500 mt-1">Déplacements de marchandises — la valeur totale de l'entreprise reste inchangée.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => printDoc('list')} className="px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs flex items-center gap-1.5">
              <Printer className="w-4 h-4" /> Imprimer la liste
            </button>
            <button onClick={() => exportCsv('list')} className="px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4" /> Exporter CSV
            </button>
            <button onClick={() => setIsCreateOpen(true)} className="px-4 py-2 rounded-lg bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all">
              <Plus className="w-4 h-4" /> Nouveau transfert
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> En transit</div>
            <div className="text-lg font-black text-amber-600">{kpis.transit}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><PackageCheck className="w-3.5 h-3.5" /> Réceptionnés</div>
            <div className="text-lg font-black text-emerald-600">{kpis.received}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Valeur en transit</div>
            <div className="text-lg font-black text-[#001F3F]">{formatFCFA(kpis.transitValue)}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={listSearch} onChange={e => setListSearch(e.target.value)}
              placeholder="Rechercher : n°, dépôt, article, opérateur…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-[#001F3F]/20 outline-none" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">
            <option value="ALL">Tous les statuts</option>
            <option value="En transit">En transit</option>
            <option value="Réceptionné">Réceptionné</option>
            <option value="Annulé">Annulé</option>
          </select>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-[#001F3F] text-white uppercase text-[10px]">
              <tr>
                <th className="px-4 py-3 text-left">N°</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Source</th>
                <th className="px-4 py-3 text-left">Destination</th>
                <th className="px-4 py-3 text-left">Opérateur</th>
                <th className="px-4 py-3 text-right">Lignes</th>
                <th className="px-4 py-3 text-right">Quantité</th>
                <th className="px-4 py-3 text-right">Valeur</th>
                <th className="px-4 py-3 text-center">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.map(t => (
                <tr key={t.id} onClick={() => setSelected(t)} className="hover:bg-slate-50 cursor-pointer">
                  <td className="px-4 py-2.5 font-mono font-bold text-[#001F3F]">{t.code}</td>
                  <td className="px-4 py-2.5 text-slate-600">{t.date}</td>
                  <td className="px-4 py-2.5">{t.sourceLocation}</td>
                  <td className="px-4 py-2.5 font-semibold">{t.targetLocation}</td>
                  <td className="px-4 py-2.5 text-slate-600">{t.operator}</td>
                  <td className="px-4 py-2.5 text-right">{t.items.length}</td>
                  <td className="px-4 py-2.5 text-right">{t.items.reduce((s, i) => s + i.quantity, 0)}</td>
                  <td className="px-4 py-2.5 text-right font-bold">{formatFCFA(t.totalValue || 0)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${STATUS_STYLES[t.status]}`}>{t.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {t.status === 'En transit' && (
                        <>
                          <button onClick={() => setConfirmReceive(t)} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50" title="Réceptionner au dépôt cible">
                            <PackageCheck className="w-4 h-4" />
                          </button>
                          <button onClick={() => setCancelTarget(t)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Annuler le transfert">
                            <Ban className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {(t.status === 'En transit' || t.status === 'Annulé') && (
                        <button onClick={() => setConfirmDelete(t)} className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50" title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredList.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">Aucun transfert — cliquez sur « Nouveau transfert ».</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal de création */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setIsCreateOpen(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6 space-y-4 max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="font-black text-[#001F3F]">Nouveau transfert inter-dépôts</h3>
                <button onClick={() => setIsCreateOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Dépôt source *</label>
                  <select value={form.sourceLocation} onChange={e => setForm(f => ({ ...f, sourceLocation: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                    <option value="">— Choisir —</option>
                    {depotOptions.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Dépôt destination *</label>
                  <select value={form.targetLocation} onChange={e => setForm(f => ({ ...f, targetLocation: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                    <option value="">— Choisir —</option>
                    {depotOptions.filter(d => d !== form.sourceLocation).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Destinataire</label>
                  <input value={form.receiver} onChange={e => setForm(f => ({ ...f, receiver: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Nom du réceptionnaire" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Observations</label>
                  <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                </div>
              </div>

              <div>
                <div className="relative mb-2">
                  <ScanBarcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={quickAdd} onChange={e => setQuickAdd(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
                    placeholder="Code / code-barres / désignation + Entrée pour ajouter"
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-[#001F3F]/20 outline-none" />
                </div>
                <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2 text-left">Code</th>
                      <th className="px-3 py-2 text-left">Désignation</th>
                      <th className="px-3 py-2 text-right">Stock dispo</th>
                      <th className="px-3 py-2 text-right">Quantité</th>
                      <th className="px-3 py-2 text-right">Coût unit.</th>
                      <th className="px-3 py-2 text-right">Valeur</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {draftLines.map(l => (
                      <tr key={l.productId}>
                        <td className="px-3 py-1.5 font-mono font-bold text-[#001F3F]">{l.productCode}</td>
                        <td className="px-3 py-1.5">{l.productName} <span className="text-slate-400">({l.unit})</span></td>
                        <td className="px-3 py-1.5 text-right text-slate-500">{l.available}</td>
                        <td className="px-3 py-1.5 text-right">
                          <input type="number" min={1} max={l.available} step="any" value={l.quantity}
                            onChange={e => updateDraftQty(l.productId, Number(e.target.value))}
                            className={`w-20 px-2 py-1 rounded border text-right font-bold outline-none ${l.quantity > l.available ? 'border-red-400 bg-red-50 text-red-600' : 'border-slate-200'}`} />
                          {l.quantity > l.available && <div className="text-[9px] text-red-500 font-bold">Dépasse le stock</div>}
                        </td>
                        <td className="px-3 py-1.5 text-right">{formatFCFA(l.unitPrice)}</td>
                        <td className="px-3 py-1.5 text-right font-bold">{formatFCFA(l.quantity * l.unitPrice)}</td>
                        <td className="px-3 py-1.5 text-right">
                          <button onClick={() => setDraftLines(prev => prev.filter(x => x.productId !== l.productId))}
                            className="p-1 rounded text-slate-300 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                    {draftLines.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Aucun article — scannez ou recherchez un produit.</td></tr>
                    )}
                  </tbody>
                </table>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  À la création, les quantités quittent le stock (statut « En transit ») ; elles y réintègrent à la réception — le CUMP est figé par ligne, aucune valeur n'est créée.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => setIsCreateOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600">Annuler</button>
                <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-[#001F3F] text-white text-xs font-bold">Créer le transfert</button>
              </div>
            </div>
          </div>
        )}

        {confirmReceive && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmReceive(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
              <h3 className="font-black text-[#001F3F] mb-2 flex items-center gap-2"><PackageCheck className="w-5 h-5 text-emerald-600" /> Réceptionner {confirmReceive.code} ?</h3>
              <p className="text-xs text-slate-500 mb-4">
                {confirmReceive.items.reduce((s, i) => s + i.quantity, 0)} unité(s) réintègrent le stock à <b>{confirmReceive.targetLocation}</b>.
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmReceive(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600">Retour</button>
                <button onClick={doReceive} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold">Confirmer la réception</button>
              </div>
            </div>
          </div>
        )}
        {cancelTarget && cancelModal()}
        {confirmDelete && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
              <h3 className="font-black text-[#001F3F] mb-2">Supprimer {confirmDelete.code} ?</h3>
              <p className="text-xs text-slate-500 mb-4">
                {confirmDelete.status === 'En transit'
                  ? 'Attention : les marchandises sont déjà sorties du stock — préférez « Annuler » pour les faire réintégrer traçablement.'
                  : 'Le document annulé sera supprimé de la liste (les mouvements de compensation restent dans le journal).'}
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600">Conserver</button>
                <button onClick={() => { onDeleteTransfer(confirmDelete.id); setConfirmDelete(null); }} className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold">Supprimer</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ================= FICHE =================
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50">
            <X className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-black text-[#001F3F] flex items-center gap-2">
              Transfert <span className="font-mono">{selected.code}</span>
              <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${STATUS_STYLES[selected.status]}`}>{selected.status}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {selected.date} • {selected.sourceLocation} <ArrowRightLeft className="w-3 h-3 inline" /> {selected.targetLocation} • Par {selected.operator}
              {selected.receivedBy ? ` • Reçu par ${selected.receivedBy} le ${selected.receivedAt}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => printDoc('fiche')} className="px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs flex items-center gap-1.5">
            <Printer className="w-4 h-4" /> Imprimer le bon
          </button>
          <button onClick={() => exportCsv('fiche')} className="px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4" /> Exporter
          </button>
          {selected.status === 'En transit' && (
            <>
              <button onClick={() => setConfirmReceive(selected)} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all">
                <PackageCheck className="w-4 h-4" /> Réceptionner
              </button>
              <button onClick={() => setCancelTarget(selected)} className="px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs flex items-center gap-1.5">
                <Ban className="w-4 h-4" /> Annuler
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-[#001F3F] text-white uppercase text-[10px]">
            <tr>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Désignation</th>
              <th className="px-4 py-3 text-left">Unité</th>
              <th className="px-4 py-3 text-right">Quantité</th>
              <th className="px-4 py-3 text-right">Coût unit. (CUMP)</th>
              <th className="px-4 py-3 text-right">Valeur</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {selected.items.map(i => (
              <tr key={i.productId}>
                <td className="px-4 py-2.5 font-mono font-bold text-[#001F3F]">{i.productCode || '—'}</td>
                <td className="px-4 py-2.5 font-semibold">{i.productName}</td>
                <td className="px-4 py-2.5 text-slate-500">{i.unit}</td>
                <td className="px-4 py-2.5 text-right font-bold">{i.quantity}</td>
                <td className="px-4 py-2.5 text-right">{i.unitPrice != null ? formatFCFA(i.unitPrice) : '—'}</td>
                <td className="px-4 py-2.5 text-right font-bold">{i.unitPrice != null ? formatFCFA(i.quantity * i.unitPrice) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-black text-[#001F3F]">
            <tr>
              <td className="px-4 py-3" colSpan={3}>Total</td>
              <td className="px-4 py-3 text-right">{selected.items.reduce((s, i) => s + i.quantity, 0)}</td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3 text-right">{formatFCFA(selected.totalValue || 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {confirmReceive && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmReceive(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-[#001F3F] mb-2 flex items-center gap-2"><PackageCheck className="w-5 h-5 text-emerald-600" /> Réceptionner {confirmReceive.code} ?</h3>
            <p className="text-xs text-slate-500 mb-4">
              {confirmReceive.items.reduce((s, i) => s + i.quantity, 0)} unité(s) réintègrent le stock à <b>{confirmReceive.targetLocation}</b>.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmReceive(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600">Retour</button>
              <button onClick={doReceive} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Confirmer la réception
              </button>
            </div>
          </div>
        </div>
      )}
      {cancelTarget && cancelModal()}
    </div>
  );
};
