import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  Minus,
  Search,
  Calendar,
  CreditCard,
  FileSpreadsheet,
  Printer,
  Trash2,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Tag,
  Wallet,
  X
} from 'lucide-react';
import { CompanyConfig, FinancialTransaction, TreasuryAccount, UserAccount } from '../../../types';
import { formatFCFA } from '../../../data/initialData';
import { withProfessionalPrintBranding } from '../../../utils/professionalPrint';

interface RecettesDepensesViewProps {
  transactions: FinancialTransaction[];
  treasuryAccounts: TreasuryAccount[];
  onAddTransaction: (tx: Omit<FinancialTransaction, 'id' | 'code'>) => boolean;
  onDeleteTransaction?: (id: string) => void;
  currentUser?: UserAccount | null;
  companyConfig?: CompanyConfig | null;
}

const CATEGORIES_RECETTES = [
  'Vente marchandises',
  'Recouvrement créance',
  'Prestation de service',
  'Subvention / Apport',
  'Autre recette'
];

const CATEGORIES_DEPENSES = [
  'Achat marchandises',
  'Loyer & Charges',
  'Salaires & Primes',
  'Factures & Énergie',
  'Transport & Carburant',
  'Entretien & Maintenance',
  'Impôts & Taxes',
  'Frais bancaires & commissions',
  'Marketing & Communication',
  'Autre dépense'
];

export const RecettesDepensesView: React.FC<RecettesDepensesViewProps> = ({
  transactions,
  treasuryAccounts,
  onAddTransaction,
  onDeleteTransaction,
  currentUser,
  companyConfig
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'Tous' | 'Recette' | 'Dépense'>('Tous');
  const [accountFilter, setAccountFilter] = useState<string>('Tous');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'Recette' | 'Dépense'>('Dépense');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formCategory, setFormCategory] = useState(CATEGORIES_DEPENSES[0]);
  const [formAmount, setFormAmount] = useState<number | ''>('');
  const [formPaymentMethod, setFormPaymentMethod] = useState<'Espèces' | 'Virement bancaire' | 'Chèque' | 'Mobile Money' | 'Carte'>('Espèces');
  const [formAccount, setFormAccount] = useState('Caisse Principale');
  const [formThirdParty, setFormThirdParty] = useState('');
  const [formReference, setFormReference] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Selected for viewing
  const [selectedTx, setSelectedTx] = useState<FinancialTransaction | null>(null);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchSearch =
        tx.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.thirdParty && tx.thirdParty.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (tx.reference && tx.reference.toLowerCase().includes(searchTerm.toLowerCase())) ||
        tx.date.includes(searchTerm);

      const matchType = typeFilter === 'Tous' || tx.type === typeFilter;
      const matchAccount = accountFilter === 'Tous' || tx.account === accountFilter;

      return matchSearch && matchType && matchAccount;
    });
  }, [transactions, searchTerm, typeFilter, accountFilter]);

  // Aggregate KPI Calculations
  const totalRecettes = useMemo(() => {
    return transactions
      .filter(t => t.type === 'Recette')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const totalDepenses = useMemo(() => {
    return transactions
      .filter(t => t.type === 'Dépense')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const soldeNet = totalRecettes - totalDepenses;
  const ratioCouverture = totalDepenses > 0 ? Math.round((totalRecettes / totalDepenses) * 100) : 100;

  // Open modal with pre-selected type
  const handleOpenAddModal = (type: 'Recette' | 'Dépense') => {
    setModalType(type);
    setFormCategory(type === 'Recette' ? CATEGORIES_RECETTES[0] : CATEGORIES_DEPENSES[0]);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormAmount('');
    setFormThirdParty('');
    setFormReference('');
    setFormNotes('');
    setIsModalOpen(true);
  };

  const handleSubmitModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAmount || Number(formAmount) <= 0) return;

    const recorded = onAddTransaction({
      date: formDate,
      type: modalType,
      category: formCategory,
      amount: Number(formAmount),
      paymentMethod: formPaymentMethod,
      account: formAccount,
      thirdParty: formThirdParty.trim() || undefined,
      reference: formReference.trim() || undefined,
      notes: formNotes.trim() || undefined,
      status: 'Validé',
      recordedBy: currentUser?.name || 'Système'
    });

    if (recorded !== false) {
      setIsModalOpen(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      alert('Aucune transaction à exporter.');
      return;
    }

    const headers = [
      'Code',
      'Date',
      'Type',
      'Catégorie',
      'Montant (FCFA)',
      'Compte',
      'Mode de Paiement',
      'Tiers',
      'Référence',
      'Statut',
      'Enregistré par'
    ];

    const rows = filteredTransactions.map(t => [
      `"${t.code}"`,
      `"${t.date}"`,
      `"${t.type}"`,
      `"${t.category.replace(/"/g, '""')}"`,
      t.amount,
      `"${t.account}"`,
      `"${t.paymentMethod}"`,
      `"${(t.thirdParty || '').replace(/"/g, '""')}"`,
      `"${(t.reference || '').replace(/"/g, '""')}"`,
      `"${t.status}"`,
      `"${t.recordedBy}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Recettes_Depenses_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Print Report
  const handlePrintReport = () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Journal des Recettes et Dépenses</title>
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
              padding-bottom: 12px;
              margin-bottom: 15px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .title { font-size: 18px; font-weight: 800; color: #001F3F; margin: 0; }
            .kpi-row {
              display: flex;
              gap: 20px;
              margin-bottom: 15px;
              padding: 10px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
            }
            .kpi-item { flex: 1; }
            .kpi-label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: bold; }
            .kpi-val { font-size: 14px; font-weight: bold; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th {
              background-color: #001F3F;
              color: white;
              padding: 7px 9px;
              text-align: left;
              font-size: 10px;
              text-transform: uppercase;
            }
            td {
              border-bottom: 1px solid #e2e8f0;
              padding: 7px 9px;
              font-size: 11px;
            }
            tr:nth-child(even) { background-color: #f8fafc; }
            .recette { color: #047857; font-weight: bold; }
            .depense { color: #b91c1c; font-weight: bold; }
            .text-right { text-align: right; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">GESTOCK - SUIVI DES RECETTES ET DÉPENSES</h1>
              <p style="margin: 3px 0 0 0; color: #64748b; font-size: 11px;">État récapitulatif des flux d'exploitation</p>
            </div>
            <div style="text-align: right; font-size: 10px; color: #64748b;">
              Édité le : ${new Date().toLocaleString('fr-FR')}
            </div>
          </div>

          <div class="kpi-row">
            <div class="kpi-item">
              <div class="kpi-label">Total Recettes</div>
              <div class="kpi-val recette">${formatFCFA(totalRecettes)}</div>
            </div>
            <div class="kpi-item">
              <div class="kpi-label">Total Dépenses</div>
              <div class="kpi-val depense">${formatFCFA(totalDepenses)}</div>
            </div>
            <div class="kpi-item">
              <div class="kpi-label">Solde Net</div>
              <div class="kpi-val" style="color: ${soldeNet >= 0 ? '#047857' : '#b91c1c'}">${formatFCFA(soldeNet)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Réf</th>
                <th>Type</th>
                <th>Catégorie</th>
                <th>Tiers</th>
                <th>Compte</th>
                <th>Règlement</th>
                <th class="text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTransactions.map(t => `
                <tr>
                  <td>${t.date}</td>
                  <td><strong>${t.code}</strong></td>
                  <td class="${t.type === 'Recette' ? 'recette' : 'depense'}">${t.type}</td>
                  <td>${t.category}</td>
                  <td>${t.thirdParty || '-'}</td>
                  <td>${t.account}</td>
                  <td>${t.paymentMethod}</td>
                  <td class="text-right ${t.type === 'Recette' ? 'recette' : 'depense'}">
                    ${t.type === 'Recette' ? '+' : '-'}${formatFCFA(t.amount)}
                  </td>
                </tr>
              `).join('')}
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
      frameDoc.write(withProfessionalPrintBranding(htmlContent, companyConfig));
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
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#001F3F] tracking-tight">
              Suivi des Recettes et Dépenses
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Gestion comptable des encaissements, des décaissements et des charges d'exploitation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => handleOpenAddModal('Recette')}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-emerald-600/20 transition-all hover:scale-[1.01]"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Recette</span>
          </button>

          <button
            onClick={() => handleOpenAddModal('Dépense')}
            className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-red-600/20 transition-all hover:scale-[1.01]"
          >
            <Minus className="w-4 h-4" />
            <span>Nouvelle Dépense</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Recettes */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Recettes</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-700">{formatFCFA(totalRecettes)}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Encaissements enregistrés</p>
        </div>

        {/* Dépenses */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Dépenses</span>
            <span className="p-2 rounded-xl bg-red-50 text-red-600">
              <TrendingDown className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-red-700">{formatFCFA(totalDepenses)}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Charges & décaissements</p>
        </div>

        {/* Solde Net */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Solde Net d'Exploitation</span>
            <span className={`p-2 rounded-xl ${soldeNet >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <span className={`text-2xl font-black ${soldeNet >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {formatFCFA(soldeNet)}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {soldeNet >= 0 ? 'Excédent financier opérationnel' : 'Déficit opérationnel'}
          </p>
        </div>

        {/* Ratio Couverture */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Couverture des Charges</span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Tag className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{ratioCouverture}%</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              ratioCouverture >= 100 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {ratioCouverture >= 100 ? 'Équilibré' : 'Attention'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Recettes / Dépenses</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par référence, tiers, catégorie..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs font-medium"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {(['Tous', 'Recette', 'Dépense'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setTypeFilter(tab)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all text-xs ${
                  typeFilter === tab
                    ? 'bg-white text-[#001F3F] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Account Filter */}
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-hidden"
          >
            <option value="Tous">Tous les comptes</option>
            {treasuryAccounts.map(acc => (
              <option key={acc.id} value={acc.name}>{acc.name}</option>
            ))}
          </select>

          {/* Export & Print */}
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-semibold text-slate-700 flex items-center gap-1.5 transition-colors"
            title="Exporter en CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          <button
            onClick={handlePrintReport}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-semibold text-slate-700 flex items-center gap-1.5 transition-colors"
            title="Imprimer"
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
                <th className="py-3.5 px-4 font-bold text-slate-700">Date</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Réf</th>
                <th className="py-3.5 px-4 font-bold text-slate-700 text-center">Type</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Catégorie</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Tiers</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Compte</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Mode Règlement</th>
                <th className="py-3.5 px-4 font-bold text-slate-700 text-right">Montant</th>
                <th className="py-3.5 px-4 font-bold text-slate-700 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <DollarSign className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-500 text-sm">Aucune transaction trouvée</p>
                      <p className="text-xs text-slate-400">
                        Enregistrez une nouvelle recette ou dépense pour commencer le suivi financier.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(tx => {
                  const isRecette = tx.type === 'Recette';

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-medium text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{tx.date}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-semibold whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {tx.code}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isRecette ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                            Recette
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                            <ArrowDownRight className="w-3 h-3 text-red-600" />
                            Dépense
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        {tx.category}
                      </td>

                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {tx.thirdParty || '-'}
                      </td>

                      <td className="py-3 px-4 text-slate-700 font-medium whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] border border-slate-200">
                          {tx.account}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                          <span>{tx.paymentMethod}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-black whitespace-nowrap">
                        <span className={isRecette ? 'text-emerald-700' : 'text-red-700'}>
                          {isRecette ? '+' : '-'}{formatFCFA(tx.amount)}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedTx(tx)}
                            className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-slate-100"
                            title="Détails"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {onDeleteTransaction && (
                            <button
                              onClick={() => {
                                if (confirm(`Supprimer l'opération ${tx.code} ?`)) {
                                  onDeleteTransaction(tx.id);
                                }
                              }}
                              className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
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

      {/* Modal: Nouvelle Recette ou Dépense */}
      {isModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 my-4">
            <div className={`flex items-center justify-between p-4 text-white ${
              modalType === 'Recette' ? 'bg-emerald-700' : 'bg-red-700'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/10 border border-white/20">
                  {modalType === 'Recette' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    Enregistrer une {modalType === 'Recette' ? 'Recette' : 'Dépense'}
                  </h3>
                  <p className="text-xs text-white/80">Flux financier et justification comptable</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitModal} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Montant (FCFA)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    placeholder="Ex: 50 000"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Catégorie</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 font-medium text-slate-800"
                >
                  {(modalType === 'Recette' ? CATEGORIES_RECETTES : CATEGORIES_DEPENSES).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Compte / Caisse</label>
                  <select
                    value={formAccount}
                    onChange={(e) => setFormAccount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 font-medium text-slate-800"
                  >
                    {treasuryAccounts.map(acc => (
                      <option key={acc.id} value={acc.name}>{acc.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mode de Paiement</label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 font-medium text-slate-800"
                  >
                    <option value="Espèces">Espèces</option>
                    <option value="Virement bancaire">Virement bancaire</option>
                    <option value="Mobile Money">Mobile Money</option>
                    <option value="Chèque">Chèque</option>
                    <option value="Carte">Carte bancaire</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tiers (Client / Fournisseur / Organisme)</label>
                  <input
                    type="text"
                    placeholder="Ex: CIE, Fournisseur, Client..."
                    value={formThirdParty}
                    onChange={(e) => setFormThirdParty(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Référence Pièce / Facture</label>
                  <input
                    type="text"
                    placeholder="Ex: FAC-2026-08, CHQ-889..."
                    value={formReference}
                    onChange={(e) => setFormReference(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Observations / Motif détaillé</label>
                <textarea
                  rows={2}
                  placeholder="Justificatif ou informations complémentaires..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 font-medium text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 rounded-xl font-bold text-white shadow-sm transition-all ${
                    modalType === 'Recette'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  Valider la {modalType === 'Recette' ? 'Recette' : 'Dépense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Détail de Transaction */}
      {selectedTx && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 my-4">
            <div className={`p-4 text-white flex items-center justify-between ${
              selectedTx.type === 'Recette' ? 'bg-emerald-700' : 'bg-red-700'
            }`}>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">Opération {selectedTx.code}</h3>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="p-1 rounded text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Type :</span>
                <span className={`font-bold ${selectedTx.type === 'Recette' ? 'text-emerald-700' : 'text-red-700'}`}>
                  {selectedTx.type}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Montant :</span>
                <span className="font-black text-base text-slate-900">{formatFCFA(selectedTx.amount)}</span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Date :</span>
                <span className="font-semibold text-slate-800">{selectedTx.date}</span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Catégorie :</span>
                <span className="font-semibold text-slate-800">{selectedTx.category}</span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Compte :</span>
                <span className="font-semibold text-slate-800">{selectedTx.account}</span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Règlement :</span>
                <span className="font-semibold text-slate-800">{selectedTx.paymentMethod}</span>
              </div>

              {selectedTx.thirdParty && (
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Tiers :</span>
                  <span className="font-semibold text-slate-800">{selectedTx.thirdParty}</span>
                </div>
              )}

              {selectedTx.reference && (
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Pièce / Réf :</span>
                  <span className="font-mono text-slate-800">{selectedTx.reference}</span>
                </div>
              )}

              {selectedTx.notes && (
                <div className="pt-2">
                  <span className="text-slate-500 font-medium block mb-1">Notes :</span>
                  <p className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-700 italic">
                    {selectedTx.notes}
                  </p>
                </div>
              )}

              <div className="text-[11px] text-slate-400 pt-2 text-right">
                Enregistré par {selectedTx.recordedBy}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedTx(null)}
                className="px-4 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
