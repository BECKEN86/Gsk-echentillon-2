import React, { useState, useMemo } from 'react';
import {
  Store,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  DollarSign,
  Lock,
  Unlock,
  Eye,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Printer,
  ShoppingBag,
  CreditCard,
  ArrowRight,
  TrendingUp,
  Receipt,
  CheckSquare,
  Square,
  ChevronDown
} from 'lucide-react';
import { CompanyConfig, PointDeVente, SaleOrder } from '../../../types';
import { formatFCFA } from '../../../data/initialData';
import { PointDeVenteOpenModal, PointDeVenteCloseModal } from '../../modals/PointDeVenteModal';
import { PointDeVenteDetailModal } from '../../modals/PointDeVenteDetailModal';

interface PointDeVenteSessionsViewProps {
  pointsDeVente: PointDeVente[];
  onOpenPointDeVente: (data: {
    code: string;
    date: string;
    operator: string;
    openingAmount: number;
    openedAt: string;
    notes?: string;
  }) => boolean | void;
  onClosePointDeVente: (pvId: string, closingAmount: number, closedAt: string, notes?: string) => void;
  onNavigateToPOS: (pv?: PointDeVente) => void;
  onOpenReceipt?: (sale: SaleOrder) => void;
  companyConfig?: CompanyConfig | null;
}

export const PointDeVenteSessionsView: React.FC<PointDeVenteSessionsViewProps> = ({
  pointsDeVente,
  onOpenPointDeVente,
  onClosePointDeVente,
  onNavigateToPOS,
  onOpenReceipt,
  companyConfig
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Tous' | 'En cours' | 'Fermé'>('Tous');
  const [selectedPVIds, setSelectedPVIds] = useState<string[]>([]);

  // Modals state
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
  const [pvToClose, setPvToClose] = useState<PointDeVente | null>(null);
  const [selectedPVDetail, setSelectedPVDetail] = useState<PointDeVente | null>(null);

  // Next code generation: e.g. PV0003
  const nextPVCode = useMemo(() => {
    let maxNum = 0;
    pointsDeVente.forEach(pv => {
      const match = pv.code.match(/PV(\d+)/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    return `PV${String(maxNum + 1).padStart(4, '0')}`;
  }, [pointsDeVente]);

  // Filtered Points de Vente
  const filteredPointsDeVente = useMemo(() => {
    return pointsDeVente.filter(pv => {
      const matchSearch =
        pv.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pv.operator.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pv.date.includes(searchTerm);
      const matchStatus = statusFilter === 'Tous' || pv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [pointsDeVente, searchTerm, statusFilter]);

  // Aggregate stats
  const activePVCount = pointsDeVente.filter(p => p.status === 'En cours').length;
  const closedPVCount = pointsDeVente.filter(p => p.status === 'Fermé').length;

  const totalSalesAll = useMemo(() => {
    return pointsDeVente.reduce((sum, pv) => {
      const salesSum = pv.sales?.reduce((s, o) => s + (o.finalAmount || o.totalAmount), 0) || 0;
      return sum + salesSum;
    }, 0);
  }, [pointsDeVente]);

  const totalCashSalesAll = useMemo(() => {
    return pointsDeVente.reduce((sum, pv) => {
      const cashSum = pv.sales
        ?.filter(o => o.paymentMethod === 'Espèces')
        .reduce((s, o) => s + (o.finalAmount || o.totalAmount), 0) || 0;
      return sum + cashSum;
    }, 0);
  }, [pointsDeVente]);

  const totalOpeningFunds = useMemo(() => {
    return pointsDeVente
      .filter(p => p.status === 'En cours')
      .reduce((sum, pv) => sum + pv.openingAmount, 0);
  }, [pointsDeVente]);

  // Selection handlers
  const handleToggleSelectAll = () => {
    if (selectedPVIds.length === filteredPointsDeVente.length) {
      setSelectedPVIds([]);
    } else {
      setSelectedPVIds(filteredPointsDeVente.map(p => p.id));
    }
  };

  const handleToggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPVIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Export CSV
  const handleExportCSV = () => {
    const listToExport = selectedPVIds.length > 0
      ? filteredPointsDeVente.filter(p => selectedPVIds.includes(p.id))
      : filteredPointsDeVente;

    if (listToExport.length === 0) {
      alert('Aucun point de vente à exporter.');
      return;
    }

    const headers = [
      'Date',
      'Numero',
      'Operateur',
      'Solde Ouverture (FCFA)',
      'Solde Fermeture (FCFA)',
      'Debut (Ouverture)',
      'Fin (Fermeture)',
      'Statut',
      'Nb Ventes',
      'Total Ventes (FCFA)',
      'Ecart Caisse (FCFA)'
    ];

    const rows = listToExport.map(pv => {
      const totalSales = pv.sales?.reduce((s, o) => s + (o.finalAmount || o.totalAmount), 0) || 0;
      return [
        `"${pv.date}"`,
        `"${pv.code}"`,
        `"${pv.operator.replace(/"/g, '""')}"`,
        pv.openingAmount,
        pv.closingAmount !== undefined ? pv.closingAmount : 'En cours',
        `"${pv.openedAt}"`,
        pv.closedAt ? `"${pv.closedAt}"` : 'En cours',
        `"${pv.status}"`,
        pv.sales?.length || 0,
        totalSales,
        pv.cashDifference !== undefined ? pv.cashDifference : '-'
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Points_de_Vente_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Print Summary Table
  const handlePrintSummary = () => {
    const listToPrint = selectedPVIds.length > 0
      ? filteredPointsDeVente.filter(p => selectedPVIds.includes(p.id))
      : filteredPointsDeVente;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Liste des Points de Vente - Journal de Caisse</title>
          <meta charset="utf-8" />
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 15px;
              font-size: 11px;
            }
            .header {
              border-bottom: 2px solid #001F3F;
              padding-bottom: 10px;
              margin-bottom: 16px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .title { font-size: 18px; font-weight: 800; color: #001F3F; margin: 0; }
            .subtitle { font-size: 11px; color: #64748b; margin-top: 3px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th {
              background-color: #001F3F;
              color: white;
              padding: 8px 10px;
              text-align: left;
              font-size: 10px;
              text-transform: uppercase;
            }
            td {
              border-bottom: 1px solid #e2e8f0;
              padding: 8px 10px;
              font-size: 11px;
            }
            tr:nth-child(even) { background-color: #f8fafc; }
            .badge-encours { color: #047857; font-weight: bold; }
            .badge-ferme { color: #475569; font-weight: bold; }
            .text-right { text-align: right; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">GESTOCK - ÉTATS DES POINTS DE VENTE</h1>
              <p class="subtitle">Historique des sessions de caisse et lignes de vente</p>
            </div>
            <div style="text-align: right; font-size: 10px; color: #64748b;">
              Édité le : ${new Date().toLocaleString('fr-FR')}<br />
              Total sessions : ${listToPrint.length}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Numéro</th>
                <th>Opérateur</th>
                <th class="text-right">Solde Ouverture</th>
                <th class="text-right">Solde Fermeture</th>
                <th>Début</th>
                <th>Fin</th>
                <th>Statut</th>
                <th class="text-right">Ventes</th>
                <th class="text-right">Chiffre d'Affaires</th>
              </tr>
            </thead>
            <tbody>
              ${listToPrint.map(pv => {
                const totalSales = pv.sales?.reduce((s, o) => s + (o.finalAmount || o.totalAmount), 0) || 0;
                return `
                  <tr>
                    <td>${pv.date}</td>
                    <td><strong>${pv.code}</strong></td>
                    <td>${pv.operator}</td>
                    <td class="text-right">${formatFCFA(pv.openingAmount)}</td>
                    <td class="text-right">${pv.closingAmount !== undefined ? formatFCFA(pv.closingAmount) : '-'}</td>
                    <td>${pv.openedAt}</td>
                    <td>${pv.closedAt || '-'}</td>
                    <td class="${pv.status === 'En cours' ? 'badge-encours' : 'badge-ferme'}">${pv.status}</td>
                    <td class="text-right">${pv.sales?.length || 0}</td>
                    <td class="text-right"><strong>${formatFCFA(totalSales)}</strong></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(htmlContent);
      frameDoc.close();
      setTimeout(() => {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(printFrame);
        }, 1000);
      }, 500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Introduction */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#001F3F] tracking-tight">
                Gestion des Points de Vente
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Sessions de caisse, soldes d'ouverture & de fermeture, horaires et lignes de vente des commandes client
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => onNavigateToPOS()}
            className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 font-bold text-xs flex items-center gap-2 transition-all shadow-2xs"
          >
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <span>Accéder à la Caisse POS</span>
          </button>

          <button
            onClick={() => setIsOpenModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-emerald-600/20 transition-all hover:scale-[1.01]"
          >
            <Plus className="w-4 h-4" />
            <span>Ouvrir un Point de Vente</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Points de Vente</span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Store className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{pointsDeVente.length}</span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {activePVCount} en cours
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{closedPVCount} session(s) fermée(s)</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Chiffre d'Affaires Global</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-700">{formatFCFA(totalSalesAll)}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Total des commandes encaissées</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Espèces Encaissées</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-amber-900">{formatFCFA(totalCashSalesAll)}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Comptant espèces en caisse</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Fonds de Caisse Actif</span>
            <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Unlock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-purple-900">{formatFCFA(totalOpeningFunds)}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Soldes d'ouverture des sessions en cours</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par Numéro (PV0001), opérateur, date..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs font-medium"
          />
        </div>

        {/* Status Filter buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          {(['Tous', 'En cours', 'Fermé'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all text-xs ${
                statusFilter === tab
                  ? 'bg-white text-[#001F3F] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Action Buttons: Export & Print */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-semibold text-slate-700 flex items-center gap-1.5 transition-colors"
            title="Exporter en CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          <button
            onClick={handlePrintSummary}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-semibold text-slate-700 flex items-center gap-1.5 transition-colors"
            title="Imprimer le journal des points de vente"
          >
            <Printer className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">Imprimer</span>
          </button>
        </div>
      </div>

      {/* Main Table View */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 uppercase font-bold tracking-wider text-[11px] border-b border-slate-200">
                <th className="py-3.5 px-3 w-10 text-center">
                  <button
                    onClick={handleToggleSelectAll}
                    className="p-1 rounded text-slate-500 hover:text-[#001F3F] transition-colors"
                  >
                    {selectedPVIds.length > 0 && selectedPVIds.length === filteredPointsDeVente.length ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Date</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Numéro</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Opérateur</th>
                <th className="py-3.5 px-4 font-bold text-slate-700 text-right">Solde Ouverture</th>
                <th className="py-3.5 px-4 font-bold text-slate-700 text-right">Solde Fermeture</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Début</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Fin</th>
                <th className="py-3.5 px-4 font-bold text-slate-700 text-center">Statut</th>
                <th className="py-3.5 px-4 font-bold text-slate-700 text-right">Lignes de Vente</th>
                <th className="py-3.5 px-4 font-bold text-slate-700 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredPointsDeVente.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Store className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-500 text-sm">Aucun point de vente trouvé</p>
                      <p className="text-xs text-slate-400">
                        Ouvrez un nouveau point de vente pour démarrer les encaissements.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPointsDeVente.map(pv => {
                  const isSelected = selectedPVIds.includes(pv.id);
                  const salesCount = pv.sales?.length || 0;
                  const totalSalesAmount = pv.sales?.reduce((s, o) => s + (o.finalAmount || o.totalAmount), 0) || 0;

                  return (
                    <tr
                      key={pv.id}
                      onClick={() => setSelectedPVDetail(pv)}
                      className={`hover:bg-blue-50/40 transition-colors cursor-pointer ${
                        isSelected ? 'bg-blue-50/60' : ''
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <td
                        className="py-3.5 px-3 text-center"
                        onClick={(e) => handleToggleSelectOne(pv.id, e)}
                      >
                        <button className="p-1 rounded text-slate-500 hover:text-[#001F3F]">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 font-medium text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{pv.date}</span>
                        </div>
                      </td>

                      {/* Numéro (PV0001) */}
                      <td className="py-3.5 px-4 font-semibold">
                        <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                          {pv.code}
                        </span>
                      </td>

                      {/* Opérateur */}
                      <td className="py-3.5 px-4 font-medium text-slate-800 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                            {pv.operator.slice(0, 2).toUpperCase()}
                          </div>
                          <span>{pv.operator}</span>
                        </div>
                      </td>

                      {/* Solde Ouverture */}
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                        {formatFCFA(pv.openingAmount)}
                      </td>

                      {/* Solde Fermeture */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {pv.closingAmount !== undefined ? (
                          <span className="font-bold text-slate-900">{formatFCFA(pv.closingAmount)}</span>
                        ) : (
                          <span className="text-slate-400 italic">En cours</span>
                        )}
                      </td>

                      {/* Début (Date et heure ouverture) */}
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-mono text-[11px]">{pv.openedAt}</span>
                        </div>
                      </td>

                      {/* Fin (Date et heure fermeture) */}
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {pv.closedAt ? (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-mono text-[11px]">{pv.closedAt}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>

                      {/* Statut (En cours / Fermé) */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {pv.status === 'En cours' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                            <Unlock className="w-3 h-3 text-emerald-600" />
                            En cours
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            <Lock className="w-3 h-3 text-slate-500" />
                            Fermé
                          </span>
                        )}
                      </td>

                      {/* Lignes de Vente (Commandes client concernées) */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPVDetail(pv);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold border border-blue-200 transition-colors"
                          title="Voir les commandes client de cette session"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>{salesCount} commande{salesCount > 1 ? 's' : ''}</span>
                          <span className="text-[10px] text-blue-500 font-normal">({formatFCFA(totalSalesAmount)})</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 px-4 text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View Detail Button */}
                          <button
                            onClick={() => setSelectedPVDetail(pv)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                            title="Consulter la fiche détaillée et lignes de vente"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Quick POS Access for En cours */}
                          {pv.status === 'En cours' && (
                            <button
                              onClick={() => onNavigateToPOS(pv)}
                              className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] flex items-center gap-1 border border-emerald-200 transition-colors"
                              title="Accéder à la caisse de ce point de vente"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Caisse</span>
                            </button>
                          )}

                          {/* Close Point de Vente Button */}
                          {pv.status === 'En cours' && (
                            <button
                              onClick={() => setPvToClose(pv)}
                              className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[11px] flex items-center gap-1 border border-amber-200 transition-colors"
                              title="Clôturer ce point de vente"
                            >
                              <Lock className="w-3.5 h-3.5 text-amber-600" />
                              <span>Clôturer</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Ouvrir un Point de Vente */}
      <PointDeVenteOpenModal
        isOpen={isOpenModalOpen}
        onClose={() => setIsOpenModalOpen(false)}
        nextCode={nextPVCode}
        onConfirmOpen={(data) => {
          const opened = onOpenPointDeVente(data);
          if (opened !== false) {
            setIsOpenModalOpen(false);
          }
        }}
      />

      {/* Modal 2: Clôturer un Point de Vente */}
      {pvToClose && (
        <PointDeVenteCloseModal
          isOpen={true}
          onClose={() => setPvToClose(null)}
          pv={pvToClose}
          onConfirmClose={(pvId, closingAmount, closedAt, notes) => {
            onClosePointDeVente(pvId, closingAmount, closedAt, notes);
            setPvToClose(null);
            // Refresh detail modal if open
            if (selectedPVDetail && selectedPVDetail.id === pvId) {
              setSelectedPVDetail(prev => prev ? {
                ...prev,
                closingAmount,
                closedAt,
                status: 'Fermé',
                notes: notes || prev.notes
              } : null);
            }
          }}
        />
      )}

      {/* Modal 3: Fiche Détail du Point de Vente & Lignes de Vente */}
      {selectedPVDetail && (
        <PointDeVenteDetailModal
          pv={selectedPVDetail}
          onClose={() => setSelectedPVDetail(null)}
          onOpenReceipt={onOpenReceipt}
          onOpenCloseModal={(pv) => setPvToClose(pv)}
          companyConfig={companyConfig}
        />
      )}
    </div>
  );
};
