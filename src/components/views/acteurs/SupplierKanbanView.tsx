import React, { useState } from 'react';
import {
  Truck,
  Phone,
  MapPin,
  Edit3,
  Trash2,
  Eye,
  CheckSquare,
  Square,
  Tag
} from 'lucide-react';
import { Supplier } from '../../../types';
import { formatFCFA } from '../../../data/initialData';

interface SupplierKanbanViewProps {
  suppliers: Supplier[];
  onViewSupplierDetail: (supplier: Supplier) => void;
  onEditSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (id: string) => void;
  selectedSupplierIds?: string[];
  onToggleSelectSupplier?: (id: string) => void;
}

type GroupByOption = 'creditStatus' | 'category';

export const SupplierKanbanView: React.FC<SupplierKanbanViewProps> = ({
  suppliers,
  onViewSupplierDetail,
  onEditSupplier,
  onDeleteSupplier,
  selectedSupplierIds = [],
  onToggleSelectSupplier
}) => {
  const [groupBy, setGroupBy] = useState<GroupByOption>('creditStatus');

  interface KanbanCol {
    id: string;
    title: string;
    badgeColor: string;
    headerBg: string;
    borderColor: string;
    suppliers: Supplier[];
  }

  let columns: KanbanCol[] = [];

  if (groupBy === 'creditStatus') {
    columns = [
      {
        id: 'no_credit',
        title: 'Soldes À Jour (0 FCFA)',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        headerBg: 'bg-emerald-50/50',
        borderColor: 'border-emerald-200',
        suppliers: suppliers.filter(s => (s.balance || 0) === 0)
      },
      {
        id: 'moderate_credit',
        title: 'Dettes Modérées (< 100 000 FCFA)',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
        headerBg: 'bg-amber-50/50',
        borderColor: 'border-amber-200',
        suppliers: suppliers.filter(s => (s.balance || 0) > 0 && (s.balance || 0) < 100000)
      },
      {
        id: 'high_credit',
        title: 'Dettes Importantes (≥ 100 000 FCFA)',
        badgeColor: 'bg-red-100 text-red-800 border-red-200',
        headerBg: 'bg-red-50/50',
        borderColor: 'border-red-200',
        suppliers: suppliers.filter(s => (s.balance || 0) >= 100000)
      }
    ];
  } else {
    // Group by unique categories
    const allCategories: string[] = Array.from(new Set(suppliers.flatMap(s => s.categories || ['Divers'])));
    columns = allCategories.map(cat => ({
      id: cat,
      title: `Secteur : ${cat}`,
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      headerBg: 'bg-blue-50/50',
      borderColor: 'border-blue-200',
      suppliers: suppliers.filter(s => (s.categories || []).includes(cat))
    }));

    if (columns.length === 0) {
      columns = [
        {
          id: 'tous',
          title: 'Tous les Fournisseurs',
          badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
          headerBg: 'bg-slate-50',
          borderColor: 'border-slate-200',
          suppliers
        }
      ];
    }
  }

  return (
    <div className="space-y-4">
      {/* Group By Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-500">Regrouper les cartes par :</span>
          <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => setGroupBy('creditStatus')}
              className={`px-3 py-1 rounded-md font-bold transition-all ${
                groupBy === 'creditStatus'
                  ? 'bg-white text-[#001F3F] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Niveau de dette (Solde Dû)
            </button>
            <button
              type="button"
              onClick={() => setGroupBy('category')}
              className={`px-3 py-1 rounded-md font-bold transition-all ${
                groupBy === 'category'
                  ? 'bg-white text-[#001F3F] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Catégories de produits
            </button>
          </div>
        </div>

        <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
          <span>💡 Cliquez sur une carte pour ouvrir la fiche fournisseur détaillée.</span>
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
        {columns.map((column) => {
          const totalColBalance = column.suppliers.reduce((sum, s) => sum + (s.balance || 0), 0);

          return (
            <div
              key={column.id}
              className="bg-slate-100/70 border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-2xs"
            >
              {/* Column Header */}
              <div className={`p-3.5 border-b border-slate-200 ${column.headerBg} flex items-center justify-between gap-2`}>
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-bold text-slate-800 text-xs truncate">{column.title}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${column.badgeColor}`}>
                    {column.suppliers.length}
                  </span>
                </div>

                {groupBy === 'creditStatus' && totalColBalance > 0 && (
                  <span className="text-[11px] font-bold font-mono text-red-700 bg-red-100/60 px-2 py-0.5 rounded-lg shrink-0">
                    {formatFCFA(totalColBalance)}
                  </span>
                )}
              </div>

              {/* Column Cards Container */}
              <div className="p-3 space-y-3 min-h-[300px] max-h-[720px] overflow-y-auto">
                {column.suppliers.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs italic bg-white/60 rounded-xl border border-dashed border-slate-200">
                    Aucun fournisseur dans cette catégorie
                  </div>
                ) : (
                  column.suppliers.map((supplier, sIdx) => {
                    const hasDebt = (supplier.balance || 0) > 0;
                    const isSelected = selectedSupplierIds.includes(supplier.id);

                    return (
                      <div
                        key={supplier.id ? `${supplier.id}_${sIdx}` : `s_${sIdx}`}
                        onClick={() => onViewSupplierDetail(supplier)}
                        className={`bg-white rounded-xl border p-4 shadow-2xs hover:shadow-md transition-all cursor-pointer group space-y-3 ${
                          isSelected
                            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20'
                            : 'border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        {/* Top: Checkbox, Icon, Name & Contact */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {onToggleSelectSupplier && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleSelectSupplier(supplier.id);
                                }}
                                className="text-slate-400 hover:text-blue-600 transition-colors p-0.5 shrink-0"
                                title={isSelected ? 'Désélectionner' : 'Sélectionner'}
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400" />
                                )}
                              </button>
                            )}

                            <div className="w-9 h-9 rounded-xl bg-[#001F3F] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                              <Truck className="w-4 h-4" />
                            </div>

                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-900 text-xs leading-snug truncate group-hover:text-blue-700 transition-colors">
                                {supplier.name}
                              </h4>
                              <p className="text-[11px] text-blue-700 font-semibold truncate">
                                {supplier.contactPerson}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => onViewSupplierDetail(supplier)}
                              className="p-1 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50"
                              title="Consulter la fiche fournisseur"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onEditSupplier(supplier)}
                              className="p-1 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-slate-100"
                              title="Modifier"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteSupplier(supplier.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Coordonnées */}
                        <div className="space-y-1 text-[11px] text-slate-600 border-t border-slate-100 pt-2">
                          <div className="flex items-center gap-1.5 truncate">
                            <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span className="font-mono">{supplier.phone}</span>
                          </div>
                          <div className="flex items-center gap-1.5 truncate text-slate-500">
                            <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                            <span className="truncate">{supplier.address}</span>
                          </div>
                        </div>

                        {/* Solde Crédit (Dette) & Achats Totaux */}
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center justify-between text-[11px]">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Crédit (Dette)</span>
                            <span className={`font-bold font-mono ${hasDebt ? 'text-red-700' : 'text-emerald-700'}`}>
                              {formatFCFA(supplier.balance || 0)}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Achats</span>
                            <span className="font-bold font-mono text-[#001F3F]">
                              {formatFCFA(supplier.totalPurchases || 0)}
                            </span>
                          </div>
                        </div>

                        {/* Badges Catégories */}
                        {supplier.categories && supplier.categories.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {supplier.categories.map((cat, cIdx) => (
                              <span
                                key={cIdx}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1 font-medium"
                              >
                                <Tag className="w-2.5 h-2.5 text-blue-600" />
                                {cat}
                              </span>
                            ))}
                          </div>
                        )}
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
