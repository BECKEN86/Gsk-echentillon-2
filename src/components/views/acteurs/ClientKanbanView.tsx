import React, { useState } from 'react';
import {
  User,
  Building2,
  Phone,
  MapPin,
  CreditCard,
  Edit3,
  Trash2,
  Eye,
  RotateCcw,
  ShoppingBag,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  CheckSquare,
  Square
} from 'lucide-react';
import { Client } from '../../../types';
import { formatFCFA } from '../../../data/initialData';

interface ClientKanbanViewProps {
  clients: Client[];
  onViewClientDetail: (client: Client) => void;
  onEditClient: (client: Client) => void;
  onDeleteClient: (id: string) => void;
  selectedClientIds?: string[];
  onToggleSelectClient?: (id: string) => void;
}

type GroupByOption = 'creditStatus' | 'clientType';

export const ClientKanbanView: React.FC<ClientKanbanViewProps> = ({
  clients,
  onViewClientDetail,
  onEditClient,
  onDeleteClient,
  selectedClientIds = [],
  onToggleSelectClient
}) => {
  const [groupBy, setGroupBy] = useState<GroupByOption>('creditStatus');

  interface KanbanCol {
    id: string;
    title: string;
    badgeColor: string;
    headerBg: string;
    borderColor: string;
    clients: Client[];
  }

  let columns: KanbanCol[] = [];

  if (groupBy === 'creditStatus') {
    columns = [
      {
        id: 'no_credit',
        title: 'Comptes Sains / À Jour (0 FCFA)',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        headerBg: 'bg-emerald-50/50',
        borderColor: 'border-emerald-200',
        clients: clients.filter(c => (c.creditBalance || 0) === 0)
      },
      {
        id: 'moderate_credit',
        title: 'Crédits Modérés (< 50 000 FCFA)',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
        headerBg: 'bg-amber-50/50',
        borderColor: 'border-amber-200',
        clients: clients.filter(c => (c.creditBalance || 0) > 0 && (c.creditBalance || 0) < 50000)
      },
      {
        id: 'high_credit',
        title: 'Crédits Importants (≥ 50 000 FCFA)',
        badgeColor: 'bg-red-100 text-red-800 border-red-200',
        headerBg: 'bg-red-50/50',
        borderColor: 'border-red-200',
        clients: clients.filter(c => (c.creditBalance || 0) >= 50000)
      }
    ];
  } else {
    columns = [
      {
        id: 'particulier',
        title: 'Clients Particuliers',
        badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
        headerBg: 'bg-blue-50/50',
        borderColor: 'border-blue-200',
        clients: clients.filter(c => c.type === 'Particulier')
      },
      {
        id: 'entreprise',
        title: 'Comptes Entreprises / B2B',
        badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        headerBg: 'bg-indigo-50/50',
        borderColor: 'border-indigo-200',
        clients: clients.filter(c => c.type === 'Entreprise')
      }
    ];
  }

  return (
    <div className="space-y-4">
      {/* Sub-toolbar to choose grouping mode */}
      <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-2xs text-xs">
        <div className="flex items-center gap-2 text-slate-600">
          <ArrowUpDown className="w-3.5 h-3.5 text-blue-600" />
          <span className="font-semibold">Grouper le Kanban par :</span>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setGroupBy('creditStatus')}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
              groupBy === 'creditStatus'
                ? 'bg-white text-[#001F3F] shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Statut du Crédit
          </button>
          <button
            type="button"
            onClick={() => setGroupBy('clientType')}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
              groupBy === 'clientType'
                ? 'bg-white text-[#001F3F] shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Type de Client
          </button>
        </div>
      </div>

      {/* Kanban Columns Grid */}
      <div className={`grid grid-cols-1 md:grid-cols-${columns.length} gap-4`}>
        {columns.map(col => {
          const colTotalDebt = col.clients.reduce((sum, c) => sum + (c.creditBalance || 0), 0);

          return (
            <div
              key={col.id}
              className={`bg-slate-50/70 rounded-2xl border ${col.borderColor} flex flex-col min-h-[500px] overflow-hidden`}
            >
              {/* Column Header */}
              <div className={`p-4 border-b ${col.borderColor} ${col.headerBg} flex items-center justify-between`}>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 text-xs">
                      {col.title}
                    </h3>
                    <span className={`px-2 py-0.2 rounded-full font-bold text-[10px] border ${col.badgeColor}`}>
                      {col.clients.length}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Total Dettes : <strong className={colTotalDebt > 0 ? 'text-red-600' : 'text-emerald-700'}>{formatFCFA(colTotalDebt)}</strong>
                  </div>
                </div>
              </div>

              {/* Cards List */}
              <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                {col.clients.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs italic">
                    Aucun client dans cette colonne
                  </div>
                ) : (
                  col.clients.map(client => {
                    const activeCreditsCount = client.creditLines?.filter(c => c.remainingAmount > 0).length || 0;
                    const activeAvoirsCount = client.avoirLines?.filter(a => a.remainingBalance > 0).length || 0;

                    return (
                      <div
                        key={client.id}
                        onClick={() => onViewClientDetail(client)}
                        className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all cursor-pointer space-y-2.5"
                      >
                        {/* Top: Avatar, Name & Type */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {onToggleSelectClient && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleSelectClient(client.id);
                                }}
                                className="text-slate-400 hover:text-blue-600 transition-colors shrink-0"
                              >
                                {selectedClientIds.includes(client.id) ? (
                                  <CheckSquare className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white shrink-0 ${
                              client.type === 'Entreprise' ? 'bg-[#001F3F]' : 'bg-blue-600'
                            }`}>
                              {client.type === 'Entreprise' ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-800 text-xs leading-snug truncate hover:text-blue-700">
                                {client.name}
                              </h4>
                              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold border border-slate-200 inline-block mt-0.5">
                                {client.type}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => onViewClientDetail(client)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="Fiche client complète"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onEditClient(client)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded"
                              title="Modifier ce client"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteClient(client.id)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Supprimer ce client"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Contact details */}
                        <div className="space-y-1 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                          <div className="flex items-center gap-1.5 truncate">
                            <Phone className="w-3 h-3 text-blue-600 shrink-0" />
                            <span className="truncate">{client.phone}</span>
                          </div>
                          <div className="flex items-center gap-1.5 truncate">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{client.address}</span>
                          </div>
                        </div>

                        {/* Credit & Avoirs Badges */}
                        {(activeCreditsCount > 0 || activeAvoirsCount > 0) && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[10px]">
                            {activeCreditsCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-bold border border-red-200 flex items-center gap-1">
                                <Receipt className="w-3 h-3" />
                                {activeCreditsCount} crédit(s) actif(s)
                              </span>
                            )}
                            {activeAvoirsCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 flex items-center gap-1">
                                <RotateCcw className="w-3 h-3" />
                                {activeAvoirsCount} avoir(s)
                              </span>
                            )}
                          </div>
                        )}

                        {/* Financial Block */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Solde Dû</span>
                            <span className={`font-black text-xs ${client.creditBalance > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                              {formatFCFA(client.creditBalance || 0)}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Achats</span>
                            <span className="font-bold text-slate-700 text-xs">
                              {formatFCFA(client.totalPurchases || 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
