import React, { useMemo, useState } from 'react';
import {
  RotateCcw,
  Plus,
  Search,
  Printer,
  FileSpreadsheet,
  Trash2,
  X,
  CheckCircle2,
  Ban,
  ChevronLeft
} from 'lucide-react';
import {
  Client,
  CompanyConfig,
  CustomerReturn,
  CustomerReturnItem,
  Product,
  SaleOrder,
  UserAccount
} from '../../../types';
import { formatFCFA } from '../../../data/initialData';
import { formatAppDateTime } from '../../../utils/dateUtils';
import { alreadyReturnedQty } from '../../../utils/stockReturns';
import { printCustomerReturn } from '../../../utils/printReports';
import { exportToCsv } from '../../../utils/csvExport';
import { printList } from '../../../utils/printList';

const STATUS_STYLES: Record<CustomerReturn['status'], string> = {
  'Brouillon': 'bg-slate-100 text-slate-700 border-slate-300',
  'Validé': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Annulé': 'bg-red-50 text-red-700 border-red-200'
};

interface RetoursClientsViewProps {
  returns: CustomerReturn[];
  saleOrders: SaleOrder[];
  clients: Client[];
  products: Product[];
  companyConfig: CompanyConfig | null;
  currentUser: UserAccount | null;
  canManage?: boolean;
  onSaveReturn: (r: CustomerReturn) => CustomerReturn;
  onValidateReturn: (id: string) => boolean;
  onCancelReturn: (id: string, reason: string) => boolean;
  onDeleteReturn: (id: string) => void;
}

interface DraftLine extends CustomerReturnItem {
  maxQty: number;
}

export const RetoursClientsView: React.FC<RetoursClientsViewProps> = ({
  returns,
  saleOrders,
  clients,
  products,
  companyConfig,
  currentUser,
  canManage = true,
  onSaveReturn,
  onValidateReturn,
  onCancelReturn,
  onDeleteReturn
}) => {
  const [selected, setSelected] = useState<CustomerReturn | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [listSearch, setListSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | CustomerReturn['status']>('ALL');
  const [confirmValidate, setConfirmValidate] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<CustomerReturn | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<CustomerReturn | null>(null);

  // Formulaire de création
  const [saleQuery, setSaleQuery] = useState('');
  const [formSale, setFormSale] = useState<SaleOrder | null>(null);
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [formNotes, setFormNotes] = useState('');

  const isReadOnly = selected ? selected.status !== 'Brouillon' : false;

  const filteredList = useMemo(() => {
    const t = listSearch.trim().toLowerCase();
    return returns.filter(r => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (!t) return true;
      return r.code.toLowerCase().includes(t)
        || r.saleCode.toLowerCase().includes(t)
        || (r.clientName || '').toLowerCase().includes(t);
    });
  }, [returns, listSearch, statusFilter]);

  const kpis = useMemo(() => ({
    drafts: returns.filter(r => r.status === 'Brouillon').length,
    validated: returns.filter(r => r.status === 'Validé').length,
    totalReturned: returns.filter(r => r.status === 'Validé').reduce((s, r) => s + r.totalAmount, 0)
  }), [returns]);

  // Ventes retournables : uniquement celles dont le stock a été déduit
  // (Validé/Terminé — une vente suspendue « En attente » n'a rien déstocké)
  const saleSuggestions = useMemo(() => {
    const t = saleQuery.trim().toLowerCase();
    if (!t) return [];
    return saleOrders
      .filter(s => (s.status === 'Validé' || s.status === 'Terminé') &&
        (s.code.toLowerCase().includes(t) || s.clientName.toLowerCase().includes(t)))
      .slice(0, 6);
  }, [saleOrders, saleQuery]);

  const pickSale = (sale: SaleOrder) => {
    setFormSale(sale);
    setSaleQuery(`${sale.code} — ${sale.clientName}`);
    const done = alreadyReturnedQty(returns, sale.id);
    setDraftLines(
      sale.items.map(it => {
        const already = done.get(it.productId) || 0;
        const maxQty = Math.max(0, it.quantity - already);
        const p = products.find(x => x.id === it.productId);
        return {
          productId: it.productId,
          productName: it.productName,
          unit: it.unitName || p?.storageUnit || p?.unit || 'pièce',
          saleQty: it.quantity,
          maxQty,
          returnedQty: 0,
          unitPrice: it.unitPrice,
          buyPrice: it.buyPrice ?? p?.buyPrice ?? 0,
          restock: true
        };
      })
    );
  };

  const updateDraftLine = (productId: string, patch: Partial<DraftLine>) => {
    setDraftLines(prev =>
      prev.map(l => {
        if (l.productId !== productId) return l;
        const next = { ...l, ...patch };
        next.returnedQty = Math.min(Math.max(0, next.returnedQty), next.maxQty);
        return next;
      })
    );
  };

  const draftTotal = draftLines.reduce((s, l) => s + l.returnedQty * l.unitPrice, 0);

  const handleCreate = () => {
    if (!formSale) { alert('Sélectionnez la vente concernée.'); return; }
    const items = draftLines.filter(l => l.returnedQty > 0);
    if (items.length === 0) { alert('Aucune quantité retournée — renseignez au moins une ligne.'); return; }
    const client = clients.find(c => c.id === formSale.clientId);
    const ret: CustomerReturn = {
      id: '',
      code: '',
      date: formatAppDateTime(),
      saleId: formSale.id,
      saleCode: formSale.code,
      clientId: formSale.clientId,
      clientName: client?.name || formSale.clientName,
      items: items.map(({ maxQty: _m, ...l }) => l),
      totalAmount: items.reduce((s, l) => s + l.returnedQty * l.unitPrice, 0),
      operator: currentUser?.name || 'Système',
      status: 'Brouillon',
      notes: formNotes.trim() || undefined,
      createdAt: formatAppDateTime()
    };
    const saved = onSaveReturn(ret);
    setIsCreateOpen(false);
    setSaleQuery('');
    setFormSale(null);
    setDraftLines([]);
    setFormNotes('');
    setSelected(saved);
  };

  const doValidate = () => {
    if (!selected) return;
    const ok = onValidateReturn(selected.id);
    setConfirmValidate(false);
    if (!ok) {
      alert('Validation impossible : document déjà traité ou lignes vides.');
      return;
    }
    setSelected({ ...selected, status: 'Validé', validatedBy: currentUser?.name, validatedAt: formatAppDateTime() });
  };

  const doCancel = () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) { alert('Un motif d\'annulation est obligatoire.'); return; }
    const ok = onCancelReturn(cancelTarget.id, cancelReason.trim());
    if (ok && selected?.id === cancelTarget.id) {
      setSelected({ ...selected, status: 'Annulé', cancelledBy: currentUser?.name, cancelledAt: formatAppDateTime(), cancelReason: cancelReason.trim() });
    }
    setCancelTarget(null);
    setCancelReason('');
  };

  const exportCsv = () => {
    exportToCsv(
      `Retours_Clients_${new Date().toISOString().slice(0, 10)}.csv`,
      ['N° Retour', 'Date', 'Vente', 'Client', 'Articles', 'Montant (FCFA)', 'Avoir', 'Statut', 'Opérateur'],
      filteredList.map(r => [
        r.code, r.date, r.saleCode, r.clientName || 'Comptoir',
        r.items.reduce((s, i) => s + i.returnedQty, 0),
        r.totalAmount, r.avoirNumber || '', r.status, r.operator
      ])
    );
  };

  const printListView = () => {
    printList({
      title: 'RETOURS CLIENTS',
      subtitle: `${filteredList.length} document(s)`,
      company: companyConfig,
      columns: ['N° Retour', 'Date', 'Vente', 'Client', 'Qté', 'Montant', 'Avoir', 'Statut'],
      rows: filteredList.map(r => [
        r.code, r.date, r.saleCode, r.clientName || 'Comptoir',
        String(r.items.reduce((s, i) => s + i.returnedQty, 0)),
        formatFCFA(r.totalAmount), r.avoirNumber || '—', r.status
      ])
    });
  };

  const cancelModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl p-5 space-y-4">
        <h3 className="font-black text-[#001F3F]">Annuler le retour {cancelTarget?.code} ?</h3>
        <p className="text-xs text-slate-500">Les quantités réintégrées seront retirées du stock par contre-passation et l'avoir généré sera supprimé (impossible s'il a été entamé).</p>
        <textarea
          value={cancelReason}
          onChange={e => setCancelReason(e.target.value)}
          placeholder="Motif d'annulation (obligatoire)"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          rows={2}
        />
        <div className="flex justify-end gap-2">
          <button onClick={() => { setCancelTarget(null); setCancelReason(''); }} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">Fermer</button>
          <button onClick={doCancel} className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold">Annuler le retour</button>
        </div>
      </div>
    </div>
  );

  // ---- Vue liste ----
  if (!selected) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[#001F3F] flex items-center gap-2"><RotateCcw className="w-5 h-5" /> Retours clients</h2>
            <p className="text-xs text-slate-500">Marchandises rendues après vente — réintégration stock, avoir ou déduction crédit</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={printListView} className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-50"><Printer className="w-3.5 h-3.5" /> Imprimer</button>
            <button onClick={exportCsv} className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-50"><FileSpreadsheet className="w-3.5 h-3.5" /> CSV</button>
            {canManage && (
              <button onClick={() => setIsCreateOpen(true)} className="px-3.5 py-2 rounded-lg bg-[#001F3F] text-white text-xs font-bold flex items-center gap-1.5 hover:bg-blue-900"><Plus className="w-4 h-4" /> Nouveau retour</button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-3.5"><div className="text-[10px] font-bold text-slate-400 uppercase">Brouillons</div><div className="text-xl font-black text-slate-700">{kpis.drafts}</div></div>
          <div className="bg-white rounded-xl border border-slate-200 p-3.5"><div className="text-[10px] font-bold text-slate-400 uppercase">Validés</div><div className="text-xl font-black text-emerald-700">{kpis.validated}</div></div>
          <div className="bg-white rounded-xl border border-slate-200 p-3.5"><div className="text-[10px] font-bold text-slate-400 uppercase">Total retourné</div><div className="text-xl font-black text-[#001F3F]">{formatFCFA(kpis.totalReturned)}</div></div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={listSearch} onChange={e => setListSearch(e.target.value)} placeholder="Rechercher (n° retour, vente, client)…" className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm">
            <option value="ALL">Tous statuts</option>
            <option value="Brouillon">Brouillon</option>
            <option value="Validé">Validé</option>
            <option value="Annulé">Annulé</option>
          </select>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase text-slate-500">
              <tr>
                <th className="py-2.5 px-3 text-left">N° Retour</th>
                <th className="py-2.5 px-3 text-left">Date</th>
                <th className="py-2.5 px-3 text-left">Vente</th>
                <th className="py-2.5 px-3 text-left">Client</th>
                <th className="py-2.5 px-3 text-center">Qté</th>
                <th className="py-2.5 px-3 text-right">Montant</th>
                <th className="py-2.5 px-3 text-center">Statut</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-slate-400 text-xs">Aucun retour client enregistré.</td></tr>
              )}
              {filteredList.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelected(r)}>
                  <td className="py-2.5 px-3 font-mono font-bold text-[#001F3F]">{r.code}</td>
                  <td className="py-2.5 px-3 text-slate-600">{r.date}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">{r.saleCode}</td>
                  <td className="py-2.5 px-3">{r.clientName || 'Comptoir'}</td>
                  <td className="py-2.5 px-3 text-center">{r.items.reduce((s, i) => s + i.returnedQty, 0)}</td>
                  <td className="py-2.5 px-3 text-right font-bold">{formatFCFA(r.totalAmount)}</td>
                  <td className="py-2.5 px-3 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLES[r.status]}`}>{r.status}</span></td>
                  <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => printCustomerReturn(r, companyConfig)} title="Imprimer le bon de retour" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"><Printer className="w-3.5 h-3.5" /></button>
                      {r.status === 'Brouillon' && canManage && (
                        <button onClick={() => setConfirmDelete(r)} title="Supprimer le brouillon" className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal création */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-black text-[#001F3F] flex items-center gap-2"><RotateCcw className="w-5 h-5" /> Nouveau retour client</h3>
                <button onClick={() => { setIsCreateOpen(false); setFormSale(null); setDraftLines([]); setSaleQuery(''); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                <div className="relative">
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Vente concernée *</label>
                  <input
                    value={saleQuery}
                    onChange={e => { setSaleQuery(e.target.value); setFormSale(null); }}
                    placeholder="Rechercher par n° de vente ou client…"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  {saleSuggestions.length > 0 && !formSale && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg divide-y divide-slate-100">
                      {saleSuggestions.map(s => (
                        <button key={s.id} onClick={() => pickSale(s)} className="w-full text-left px-3 py-2 hover:bg-blue-50 text-xs">
                          <span className="font-mono font-bold text-[#001F3F]">{s.code}</span> — {s.clientName} — {formatFCFA(s.finalAmount)} — <span className="text-slate-400">{s.date}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {formSale && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500">
                        <tr>
                          <th className="py-2 px-2.5 text-left">Article</th>
                          <th className="py-2 px-2.5 text-center">Vendue</th>
                          <th className="py-2 px-2.5 text-center">Retournable</th>
                          <th className="py-2 px-2.5 text-center w-24">Retournée</th>
                          <th className="py-2 px-2.5 text-right">Prix vente</th>
                          <th className="py-2 px-2.5 text-right">Montant</th>
                          <th className="py-2 px-2.5 text-center">Réintégrer</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {draftLines.map(l => (
                          <tr key={l.productId} className={l.maxQty === 0 ? 'opacity-40' : ''}>
                            <td className="py-2 px-2.5 font-medium">{l.productName}</td>
                            <td className="py-2 px-2.5 text-center">{l.saleQty}</td>
                            <td className="py-2 px-2.5 text-center">{l.maxQty}</td>
                            <td className="py-2 px-2.5 text-center">
                              <input
                                type="number" min={0} max={l.maxQty}
                                value={l.returnedQty}
                                disabled={l.maxQty === 0}
                                onChange={e => updateDraftLine(l.productId, { returnedQty: Number(e.target.value) })}
                                className="w-20 px-2 py-1 border border-slate-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50"
                              />
                            </td>
                            <td className="py-2 px-2.5 text-right">{formatFCFA(l.unitPrice)}</td>
                            <td className="py-2 px-2.5 text-right font-bold">{formatFCFA(l.returnedQty * l.unitPrice)}</td>
                            <td className="py-2 px-2.5 text-center">
                              <input type="checkbox" checked={l.restock} disabled={l.maxQty === 0} onChange={e => updateDraftLine(l.productId, { restock: e.target.checked })} title="Réintégrer le stock (décocher si avarié)" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Observations</label>
                  <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} placeholder="Motif du retour, état des articles…" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <div className="text-sm font-bold text-[#001F3F]">Total : {formatFCFA(draftTotal)}</div>
                <div className="flex gap-2">
                  <button onClick={() => { setIsCreateOpen(false); setFormSale(null); setDraftLines([]); setSaleQuery(''); }} className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold">Annuler</button>
                  <button onClick={handleCreate} disabled={draftTotal <= 0} className="px-4 py-2 rounded-lg bg-[#001F3F] text-white text-xs font-bold disabled:opacity-40">Créer le retour</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-sm shadow-2xl p-5 space-y-4">
              <h3 className="font-black text-[#001F3F]">Supprimer le brouillon {confirmDelete.code} ?</h3>
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">Fermer</button>
                <button onClick={() => { onDeleteReturn(confirmDelete.id); setConfirmDelete(null); }} className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold">Supprimer</button>
              </div>
            </div>
          </div>
        )}
        {cancelTarget && cancelModal()}
      </div>
    );
  }

  // ---- Vue détail ----
  const returnedTotal = selected.items.reduce((s, i) => s + i.returnedQty * i.unitPrice, 0);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#001F3F]"><ChevronLeft className="w-4 h-4" /> Retour à la liste</button>
        <div className="flex items-center gap-2">
          <button onClick={() => printCustomerReturn(selected, companyConfig)} className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold flex items-center gap-1.5"><Printer className="w-3.5 h-3.5" /> Imprimer</button>
          {selected.status === 'Brouillon' && canManage && (
            <button onClick={() => setConfirmValidate(true)} className="px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Valider</button>
          )}
          {selected.status === 'Validé' && canManage && (
            <button onClick={() => setCancelTarget(selected)} className="px-3.5 py-2 rounded-lg bg-red-600 text-white text-xs font-bold flex items-center gap-1.5"><Ban className="w-4 h-4" /> Annuler</button>
          )}
          {selected.status === 'Brouillon' && canManage && (
            <button onClick={() => setConfirmDelete(selected)} className="px-3 py-2 rounded-lg bg-white border border-rose-300 text-rose-600 text-xs font-bold flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Supprimer</button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><div className="text-[10px] font-bold text-slate-400 uppercase">N° Retour</div><div className="font-mono font-black text-[#001F3F]">{selected.code}</div></div>
        <div><div className="text-[10px] font-bold text-slate-400 uppercase">Date</div><div className="font-bold text-slate-700">{selected.date}</div></div>
        <div><div className="text-[10px] font-bold text-slate-400 uppercase">Vente</div><div className="font-mono font-bold text-slate-700">{selected.saleCode}</div></div>
        <div><div className="text-[10px] font-bold text-slate-400 uppercase">Statut</div><span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLES[selected.status]}`}>{selected.status}</span></div>
        <div><div className="text-[10px] font-bold text-slate-400 uppercase">Client</div><div className="font-bold text-slate-700">{selected.clientName || 'Comptoir'}</div></div>
        <div><div className="text-[10px] font-bold text-slate-400 uppercase">Opérateur</div><div className="font-bold text-slate-700">{selected.operator}</div></div>
        {selected.validatedBy && <div><div className="text-[10px] font-bold text-slate-400 uppercase">Validé par</div><div className="font-bold text-slate-700">{selected.validatedBy} — {selected.validatedAt}</div></div>}
        {selected.avoirNumber && <div><div className="text-[10px] font-bold text-slate-400 uppercase">Avoir généré</div><div className="font-mono font-bold text-emerald-700">{selected.avoirNumber} — {formatFCFA(selected.avoirAmount || 0)}</div></div>}
        {selected.creditDeduction ? <div><div className="text-[10px] font-bold text-slate-400 uppercase">Déduit du crédit</div><div className="font-bold text-slate-700">{formatFCFA(selected.creditDeduction)}</div></div> : null}
        {selected.cancelledBy && <div><div className="text-[10px] font-bold text-slate-400 uppercase">Annulé par</div><div className="font-bold text-red-700">{selected.cancelledBy} — {selected.cancelReason}</div></div>}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase text-slate-500">
            <tr>
              <th className="py-2.5 px-3 text-left">Article</th>
              <th className="py-2.5 px-3 text-center">Vendue</th>
              <th className="py-2.5 px-3 text-center">Retournée</th>
              <th className="py-2.5 px-3 text-right">Prix vente</th>
              <th className="py-2.5 px-3 text-right">Coût achat</th>
              <th className="py-2.5 px-3 text-right">Montant</th>
              <th className="py-2.5 px-3 text-center">Réintégré</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {selected.items.map(i => (
              <tr key={i.productId}>
                <td className="py-2.5 px-3 font-medium">{i.productName}</td>
                <td className="py-2.5 px-3 text-center">{i.saleQty}</td>
                <td className="py-2.5 px-3 text-center font-bold">{i.returnedQty}</td>
                <td className="py-2.5 px-3 text-right">{formatFCFA(i.unitPrice)}</td>
                <td className="py-2.5 px-3 text-right text-slate-500">{formatFCFA(i.buyPrice)}</td>
                <td className="py-2.5 px-3 text-right font-bold">{formatFCFA(i.returnedQty * i.unitPrice)}</td>
                <td className="py-2.5 px-3 text-center">{i.restock ? <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" /> : <span className="text-[10px] text-amber-600 font-bold">Non réintégré</span>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 border-t border-slate-200">
            <tr>
              <td colSpan={5} className="py-2.5 px-3 text-right font-black text-[#001F3F] uppercase text-[11px]">Total retour</td>
              <td className="py-2.5 px-3 text-right font-black text-[#001F3F]">{formatFCFA(returnedTotal)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {selected.notes && <div className="bg-white rounded-xl border border-slate-200 p-4 text-xs text-slate-600"><span className="font-bold">Observations : </span>{selected.notes}</div>}
      {isReadOnly && <p className="text-[11px] text-slate-400 italic">Document en lecture seule — l'historique des mouvements est conservé.</p>}

      {confirmValidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-sm shadow-2xl p-5 space-y-4">
            <h3 className="font-black text-[#001F3F]">Valider le retour {selected.code} ?</h3>
            <p className="text-xs text-slate-500">Les lignes « réintégrer » rentreront en stock au coût d'achat d'origine ; le crédit client sera déduit puis un avoir émis pour le reste.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmValidate(false)} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">Fermer</button>
              <button onClick={doValidate} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold">Valider</button>
            </div>
          </div>
        </div>
      )}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-sm shadow-2xl p-5 space-y-4">
            <h3 className="font-black text-[#001F3F]">Supprimer le brouillon {confirmDelete.code} ?</h3>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">Fermer</button>
              <button onClick={() => { onDeleteReturn(confirmDelete.id); setConfirmDelete(null); setSelected(null); }} className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold">Supprimer</button>
            </div>
          </div>
        </div>
      )}
      {cancelTarget && cancelModal()}
    </div>
  );
};
