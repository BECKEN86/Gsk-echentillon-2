import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  Search,
  Printer,
  FileSpreadsheet,
  AlertTriangle,
  Package
} from 'lucide-react';
import {
  ApprovisionnementRecord,
  CompanyConfig,
  GoodsReception,
  Product
} from '../../../types';
import { formatFCFA } from '../../../data/initialData';
import { exportToCsv } from '../../../utils/csvExport';
import { printList } from '../../../utils/printList';

type ExpiryStatus = 'Expiré' | 'Critique' | 'Vigilance' | 'OK';

const STATUS_STYLES: Record<ExpiryStatus, string> = {
  'Expiré': 'bg-red-100 text-red-800 border-red-300',
  'Critique': 'bg-orange-100 text-orange-800 border-orange-300',
  'Vigilance': 'bg-amber-50 text-amber-700 border-amber-300',
  'OK': 'bg-emerald-50 text-emerald-700 border-emerald-200'
};

const daysUntil = (dateStr: string): number => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return Number.MAX_SAFE_INTEGER;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
};

const statusOf = (days: number): ExpiryStatus =>
  days < 0 ? 'Expiré' : days <= 7 ? 'Critique' : days <= 30 ? 'Vigilance' : 'OK';

interface Lot {
  productId: string;
  productName: string;
  productCode?: string;
  depot?: string;
  sourceDoc: string;
  sourceDate: string;
  expiryDate: string;
  lotQty: number;
  currentStock: number;
  buyPrice: number;
  days: number;
  status: ExpiryStatus;
}

interface PeremptionViewProps {
  products: Product[];
  receptions: GoodsReception[];
  approvisionnements: ApprovisionnementRecord[];
  companyConfig: CompanyConfig | null;
}

/**
 * Alertes de péremption : lots entrés avec une date d'expiration (réceptions
 * et approvisionnements). La quantité affichée est la quantité du lot —
 * le stock actuel du produit est rappelé pour apprécier le risque.
 */
export const PeremptionView: React.FC<PeremptionViewProps> = ({
  products,
  receptions,
  approvisionnements,
  companyConfig
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ExpiryStatus>('ALL');
  const [hideOk, setHideOk] = useState(true);

  const lots = useMemo<Lot[]>(() => {
    const byProduct = new Map(products.map(p => [p.id, p]));
    const rows: Lot[] = [];

    const push = (productId: string, productName: string, qty: number, expiry: string | undefined, sourceDoc: string, sourceDate: string) => {
      if (!expiry) return;
      const p = byProduct.get(productId);
      const days = daysUntil(expiry);
      rows.push({
        productId,
        productName: p?.name || productName,
        productCode: p?.code,
        depot: p?.location,
        sourceDoc,
        sourceDate,
        expiryDate: expiry,
        lotQty: qty,
        currentStock: p?.stock ?? 0,
        buyPrice: p?.buyPrice || 0,
        days,
        status: statusOf(days)
      });
    };

    receptions
      .filter(r => r.status !== 'Annulé')
      .forEach(r =>
        r.items.forEach(i =>
          push(i.productId, i.productName, i.acceptedQty ?? i.receivedQty ?? 0, i.expirationDate, r.code, r.date)
        )
      );
    approvisionnements
      .filter(a => a.status !== 'Annulé')
      .forEach(a =>
        a.items.forEach(i =>
          push(i.productId, i.productName, i.quantity, i.expirationDate, a.reference, a.date)
        )
      );

    return rows.sort((a, b) => a.days - b.days);
  }, [products, receptions, approvisionnements]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return lots.filter(l => {
      if (statusFilter !== 'ALL' && l.status !== statusFilter) return false;
      if (hideOk && l.status === 'OK') return false;
      if (!t) return true;
      return l.productName.toLowerCase().includes(t)
        || (l.productCode || '').toLowerCase().includes(t)
        || l.sourceDoc.toLowerCase().includes(t);
    });
  }, [lots, search, statusFilter, hideOk]);

  const kpis = useMemo(() => ({
    expired: lots.filter(l => l.status === 'Expiré').length,
    critical: lots.filter(l => l.status === 'Critique').length,
    watch: lots.filter(l => l.status === 'Vigilance').length,
    atRiskValue: lots
      .filter(l => l.status !== 'OK')
      .reduce((s, l) => s + Math.min(l.lotQty, Math.max(0, l.currentStock)) * l.buyPrice, 0)
  }), [lots]);

  const exportCsv = () => {
    exportToCsv(
      `Alertes_Peremption_${new Date().toISOString().slice(0, 10)}.csv`,
      ['Article', 'Code', 'Lot source', 'Entrée le', 'Péremption', 'Jours restants', 'Qté lot', 'Stock actuel', 'Valeur à risque (FCFA)', 'Statut'],
      filtered.map(l => [
        l.productName, l.productCode || '', l.sourceDoc, l.sourceDate, l.expiryDate,
        l.days === Number.MAX_SAFE_INTEGER ? '' : l.days, l.lotQty, l.currentStock,
        Math.min(l.lotQty, Math.max(0, l.currentStock)) * l.buyPrice, l.status
      ])
    );
  };

  const printView = () => {
    printList({
      title: 'ALERTES DE PÉREMPTION',
      subtitle: 'Lots entrés en stock avec date d\'expiration',
      company: companyConfig,
      professionalBranding: true,
      columns: ['Article', 'Lot', 'Entrée', 'Péremption', 'Jours', 'Qté lot', 'Stock', 'Statut'],
      rows: filtered.map(l => [
        l.productName, l.sourceDoc, l.sourceDate, l.expiryDate,
        String(l.days), String(l.lotQty), String(l.currentStock), l.status
      ])
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-[#001F3F] flex items-center gap-2"><CalendarClock className="w-5 h-5" /> Alertes de péremption</h2>
          <p className="text-xs text-slate-500">Lots en stock dont la date d'expiration approche — critique ≤ 7 j, vigilance ≤ 30 j</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={printView} className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-50"><Printer className="w-3.5 h-3.5" /> Imprimer</button>
          <button onClick={exportCsv} className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-50"><FileSpreadsheet className="w-3.5 h-3.5" /> CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-red-200 p-3.5"><div className="text-[10px] font-bold text-red-500 uppercase flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Expirés</div><div className="text-xl font-black text-red-700">{kpis.expired}</div></div>
        <div className="bg-white rounded-xl border border-orange-200 p-3.5"><div className="text-[10px] font-bold text-orange-500 uppercase">Critiques ≤ 7 j</div><div className="text-xl font-black text-orange-700">{kpis.critical}</div></div>
        <div className="bg-white rounded-xl border border-amber-200 p-3.5"><div className="text-[10px] font-bold text-amber-500 uppercase">Vigilance ≤ 30 j</div><div className="text-xl font-black text-amber-700">{kpis.watch}</div></div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5"><div className="text-[10px] font-bold text-slate-400 uppercase">Valeur à risque</div><div className="text-xl font-black text-[#001F3F]">{formatFCFA(kpis.atRiskValue)}</div></div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher (article, code, lot)…" className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm">
          <option value="ALL">Tous statuts</option>
          <option value="Expiré">Expiré</option>
          <option value="Critique">Critique ≤ 7 j</option>
          <option value="Vigilance">Vigilance ≤ 30 j</option>
          <option value="OK">OK</option>
        </select>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 px-2">
          <input type="checkbox" checked={hideOk} onChange={e => setHideOk(e.target.checked)} />
          Masquer les lots OK
        </label>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase text-slate-500">
            <tr>
              <th className="py-2.5 px-3 text-left">Article</th>
              <th className="py-2.5 px-3 text-left">Dépôt</th>
              <th className="py-2.5 px-3 text-left">Lot source</th>
              <th className="py-2.5 px-3 text-center">Entrée le</th>
              <th className="py-2.5 px-3 text-center">Péremption</th>
              <th className="py-2.5 px-3 text-center">Jours</th>
              <th className="py-2.5 px-3 text-center">Qté lot</th>
              <th className="py-2.5 px-3 text-center">Stock</th>
              <th className="py-2.5 px-3 text-center">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="py-8 text-center text-slate-400 text-xs"><Package className="w-5 h-5 inline mr-1.5 -mt-0.5" />Aucun lot avec date d'expiration ne correspond aux filtres.</td></tr>
            )}
            {filtered.map((l, idx) => (
              <tr key={`${l.productId}-${l.sourceDoc}-${idx}`} className={l.status === 'Expiré' ? 'bg-red-50/40' : l.status === 'Critique' ? 'bg-orange-50/40' : l.status === 'Vigilance' ? 'bg-amber-50/30' : ''}>
                <td className="py-2.5 px-3 font-medium">{l.productName}<div className="text-[10px] text-slate-400 font-mono">{l.productCode}</div></td>
                <td className="py-2.5 px-3 text-slate-500 text-xs">{l.depot || '—'}</td>
                <td className="py-2.5 px-3 font-mono text-xs text-slate-600">{l.sourceDoc}</td>
                <td className="py-2.5 px-3 text-center text-xs text-slate-500">{l.sourceDate}</td>
                <td className="py-2.5 px-3 text-center font-mono font-bold">{l.expiryDate}</td>
                <td className={`py-2.5 px-3 text-center font-black ${l.status === 'Expiré' ? 'text-red-700' : l.status === 'Critique' ? 'text-orange-700' : l.status === 'Vigilance' ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {l.status === 'Expiré' ? `${Math.abs(l.days)} j de retard` : `${l.days} j`}
                </td>
                <td className="py-2.5 px-3 text-center">{l.lotQty}</td>
                <td className="py-2.5 px-3 text-center">{l.currentStock}</td>
                <td className="py-2.5 px-3 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLES[l.status]}`}>{l.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400 italic">La quantité du lot est la quantité réceptionnée — le stock actuel du produit est rappelé pour apprécier le risque. Pensez à déclarer les lots expirés dans « Pertes & Produits avariés ».</p>
    </div>
  );
};
