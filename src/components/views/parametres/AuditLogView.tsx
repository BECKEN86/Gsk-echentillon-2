import React, { useMemo, useState } from 'react';
import { ScrollText, Search, Download, User, Filter } from 'lucide-react';
import { AuditLog } from '../../../types';

interface AuditLogViewProps {
  logs: AuditLog[];
}

const ACTION_LABELS: Record<string, { label: string; cls: string }> = {
  'sale.create':          { label: 'Vente',              cls: 'bg-emerald-100 text-emerald-700' },
  'sale.cancel':          { label: 'Annulation vente',   cls: 'bg-rose-100 text-rose-700' },
  'po.validate':          { label: 'Validation BC',      cls: 'bg-blue-100 text-blue-700' },
  'reception.validate':   { label: 'Réception',          cls: 'bg-indigo-100 text-indigo-700' },
  'stock.movement':       { label: 'Mouvement stock',    cls: 'bg-amber-100 text-amber-700' },
  'transaction.recette':  { label: 'Recette',            cls: 'bg-emerald-100 text-emerald-700' },
  'transaction.depense':  { label: 'Dépense',            cls: 'bg-orange-100 text-orange-700' },
  'treasury.movement':    { label: 'Trésorerie',         cls: 'bg-cyan-100 text-cyan-700' },
  'user.create':          { label: 'Création compte',    cls: 'bg-violet-100 text-violet-700' },
  'user.update':          { label: 'Modif. compte',      cls: 'bg-violet-100 text-violet-700' },
  'user.delete':          { label: 'Suppression compte', cls: 'bg-rose-100 text-rose-700' },
  'user.activate':        { label: 'Activation compte',  cls: 'bg-emerald-100 text-emerald-700' },
  'user.deactivate':      { label: 'Désactivation',      cls: 'bg-rose-100 text-rose-700' },
  'user.resetPassword':   { label: 'Reset mot de passe', cls: 'bg-amber-100 text-amber-700' },
  'company.update':       { label: 'Config. société',    cls: 'bg-slate-200 text-slate-700' }
};

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });

export const AuditLogView: React.FC<AuditLogViewProps> = ({ logs }) => {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter(l => {
      if (actionFilter && l.action !== actionFilter) return false;
      if (!q) return true;
      return (
        l.actor.toLowerCase().includes(q) ||
        (l.entityRef || '').toLowerCase().includes(q) ||
        (l.details || '').toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q)
      );
    });
  }, [logs, search, actionFilter]);

  const exportCsv = () => {
    const header = 'Date;Acteur;Action;Entité;Référence;Détails';
    const rows = filtered.map(l =>
      [
        new Date(l.at).toLocaleString('fr-FR'),
        l.actor,
        l.action,
        l.entity,
        l.entityRef || '',
        (l.details || '').replace(/;/g, ',')
      ].join(';')
    );
    const blob = new Blob(['﻿' + [header, ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-gestock-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const actionKeys = Array.from(new Set(logs.map(l => l.action)));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-blue-600" />
            Journal d'audit
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Traçabilité des actions sensibles — {filtered.length} entrée(s)
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Exporter CSV
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher (acteur, référence, détail…)"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
          />
        </div>
        <div className="relative">
          <Filter className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none appearance-none"
          >
            <option value="">Toutes les actions</option>
            {actionKeys.map(a => (
              <option key={a} value={a}>
                {ACTION_LABELS[a]?.label || a}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left">
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Acteur</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Action</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Référence</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400 text-sm">
                    Aucune entrée d'audit pour le moment.
                  </td>
                </tr>
              )}
              {filtered.map(l => (
                <tr key={l.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-mono text-xs">
                    {fmtDateTime(l.at)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="flex items-center gap-1.5 text-slate-800 font-medium">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {l.actor}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 rounded-lg text-xs font-bold ${
                        ACTION_LABELS[l.action]?.cls || 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {ACTION_LABELS[l.action]?.label || l.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-slate-600">
                    {l.entityRef || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs max-w-md truncate" title={l.details}>
                    {l.details || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
