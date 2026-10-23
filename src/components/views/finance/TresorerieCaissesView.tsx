import React, { useState, useMemo } from 'react';
import {
  Wallet,
  Landmark,
  Smartphone,
  Store,
  ArrowRightLeft,
  Search,
  Clock,
  User,
  FileSpreadsheet,
  Printer,
  X,
  Coins,
  ShieldCheck} from 'lucide-react';
import { CompanyConfig, TreasuryAccount, TreasuryMovement, UserAccount } from '../../../types';
import { formatFCFA } from '../../../data/initialData';
import { formatAppDateTime } from '../../../utils/dateUtils';
import { withProfessionalPrintBranding } from '../../../utils/professionalPrint';

interface TresorerieCaissesViewProps {
  treasuryAccounts: TreasuryAccount[];
  treasuryMovements: TreasuryMovement[];
  onAddTreasuryMovement: (movement: Omit<TreasuryMovement, 'id' | 'code'>) => boolean;
  currentUser?: UserAccount | null;
  companyConfig?: CompanyConfig | null;
}

export const TresorerieCaissesView: React.FC<TresorerieCaissesViewProps> = ({
  treasuryAccounts,
  treasuryMovements,
  onAddTreasuryMovement,
  currentUser,
  companyConfig
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('Tous');
  const [accountFilter, setAccountFilter] = useState<string>('Tous');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [moveType, setMoveType] = useState<'Virement interne' | 'Alimentation' | 'Décaissement' | 'Remise en banque'>('Virement interne');
  const [fromAccount, setFromAccount] = useState<string>(treasuryAccounts[0]?.name || 'Caisse Principale');
  const [toAccount, setToAccount] = useState<string>(treasuryAccounts[1]?.name || 'Banque BICICI');
  const [amount, setAmount] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [performedBy, setPerformedBy] = useState(currentUser?.name || '');

  // Total Global Cash & Bank Holdings
  const totalTreasuryBalance = useMemo(() => {
    return treasuryAccounts.reduce((sum, acc) => sum + acc.balance, 0);
  }, [treasuryAccounts]);

  const totalPhysicalCash = useMemo(() => {
    return treasuryAccounts
      .filter(acc => acc.type === 'Caisse')
      .reduce((sum, acc) => sum + acc.balance, 0);
  }, [treasuryAccounts]);

  const totalBankMoney = useMemo(() => {
    return treasuryAccounts
      .filter(acc => acc.type === 'Banque')
      .reduce((sum, acc) => sum + acc.balance, 0);
  }, [treasuryAccounts]);

  const totalMobileMoney = useMemo(() => {
    return treasuryAccounts
      .filter(acc => acc.type === 'Mobile Money')
      .reduce((sum, acc) => sum + acc.balance, 0);
  }, [treasuryAccounts]);

  // Filtered movements
  const filteredMovements = useMemo(() => {
    return treasuryMovements.filter(m => {
      const matchSearch =
        m.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.reference && m.reference.toLowerCase().includes(searchTerm.toLowerCase())) ||
        m.performedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.date.includes(searchTerm);

      const matchType = typeFilter === 'Tous' || m.type === typeFilter;
      const matchAccount =
        accountFilter === 'Tous' ||
        m.fromAccount === accountFilter ||
        m.toAccount === accountFilter;

      return matchSearch && matchType && matchAccount;
    });
  }, [treasuryMovements, searchTerm, typeFilter, accountFilter]);

  // Open modal with presets
  const handleOpenModal = (presetType: 'Virement interne' | 'Alimentation' | 'Décaissement' | 'Remise en banque') => {
    setMoveType(presetType);
    if (presetType === 'Remise en banque') {
      setFromAccount('Caisse Principale');
      setToAccount('Banque BICICI');
    } else if (presetType === 'Alimentation') {
      setFromAccount('Banque BICICI');
      setToAccount('Caisse Principale');
    } else {
      setFromAccount(treasuryAccounts[0]?.name || 'Caisse Principale');
      setToAccount(treasuryAccounts[1]?.name || 'Banque BICICI');
    }
    setAmount('');
    setReason('');
    setReference('');
    setIsModalOpen(true);
  };

  const handleSubmitModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;

    const recorded = onAddTreasuryMovement({
      date: formatAppDateTime(),
      type: moveType,
      fromAccount: moveType !== 'Alimentation' ? fromAccount : fromAccount,
      toAccount: moveType !== 'Décaissement' ? toAccount : undefined,
      amount: Number(amount),
      reason: reason.trim() || 'Mouvement de trésorerie',
      reference: reference.trim() || undefined,
      performedBy: performedBy.trim() || currentUser?.name || 'Système'
    });

    if (recorded !== false) {
      setIsModalOpen(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredMovements.length === 0) {
      alert('Aucun mouvement à exporter.');
      return;
    }

    const headers = [
      'Code',
      'Date Heure',
      'Type Mouvement',
      'Compte Source (Débit)',
      'Compte Destinataire (Crédit)',
      'Montant (FCFA)',
      'Motif',
      'Référence',
      'Opérateur'
    ];

    const rows = filteredMovements.map(m => [
      `"${m.code}"`,
      `"${m.date}"`,
      `"${m.type}"`,
      `"${m.fromAccount || '-'}"`,
      `"${m.toAccount || '-'}"`,
      m.amount,
      `"${m.reason.replace(/"/g, '""')}"`,
      `"${(m.reference || '').replace(/"/g, '""')}"`,
      `"${m.performedBy}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Mouvements_Tresorerie_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Print
  const handlePrint = () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Journal des Mouvements de Trésorerie</title>
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
            .text-right { text-align: right; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">GESTOCK - ÉTAT DES FLUX DE TRÉSORERIE & CAISSES</h1>
              <p style="margin: 3px 0 0 0; color: #64748b; font-size: 11px;">Mouvements de fonds internes, retraits et remises bancaires</p>
            </div>
            <div style="text-align: right; font-size: 10px; color: #64748b;">
              Édité le : ${new Date().toLocaleString('fr-FR')}
            </div>
          </div>

          <div style="display: flex; gap: 15px; margin-bottom: 15px;">
            <div style="flex: 1; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
              <div style="font-size: 10px; color: #64748b; font-weight: bold;">Trésorerie Totale Disponible</div>
              <div style="font-size: 16px; font-weight: bold; color: #001F3F; margin-top: 3px;">${formatFCFA(totalTreasuryBalance)}</div>
            </div>
            <div style="flex: 1; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
              <div style="font-size: 10px; color: #64748b; font-weight: bold;">Espèces en Caisses</div>
              <div style="font-size: 16px; font-weight: bold; color: #047857; margin-top: 3px;">${formatFCFA(totalPhysicalCash)}</div>
            </div>
            <div style="flex: 1; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
              <div style="font-size: 10px; color: #64748b; font-weight: bold;">Comptes Bancaires</div>
              <div style="font-size: 16px; font-weight: bold; color: #1d4ed8; margin-top: 3px;">${formatFCFA(totalBankMoney)}</div>
            </div>
            <div style="flex: 1; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
              <div style="font-size: 10px; color: #64748b; font-weight: bold;">Mobile Money</div>
              <div style="font-size: 16px; font-weight: bold; color: #d97706; margin-top: 3px;">${formatFCFA(totalMobileMoney)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Date</th>
                <th>Type</th>
                <th>Source</th>
                <th>Destination</th>
                <th class="text-right">Montant</th>
                <th>Motif</th>
                <th>Opérateur</th>
              </tr>
            </thead>
            <tbody>
              ${filteredMovements.map(m => `
                <tr>
                  <td><strong>${m.code}</strong></td>
                  <td>${m.date}</td>
                  <td>${m.type}</td>
                  <td>${m.fromAccount || '-'}</td>
                  <td>${m.toAccount || '-'}</td>
                  <td class="text-right"><strong>${formatFCFA(m.amount)}</strong></td>
                  <td>${m.reason}</td>
                  <td>${m.performedBy}</td>
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
          <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 border border-teal-500/20">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#001F3F] tracking-tight">
              Caisses et Mouvements de Trésorerie
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Suivi des soldes des caisses, des comptes bancaires, transferts de fonds et remises en banque
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => handleOpenModal('Virement interne')}
            className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-teal-600/20 transition-all hover:scale-[1.01]"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Nouveau Virement Interne</span>
          </button>

          <button
            onClick={() => handleOpenModal('Remise en banque')}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-blue-600/20 transition-all hover:scale-[1.01]"
          >
            <Landmark className="w-4 h-4" />
            <span>Remise en Banque</span>
          </button>
        </div>
      </div>

      {/* Accounts Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {treasuryAccounts.map((acc) => {
          let icon = <Coins className="w-5 h-5 text-emerald-600" />;
          let iconBg = 'bg-emerald-50';

          if (acc.type === 'Banque') {
            icon = <Landmark className="w-5 h-5 text-blue-600" />;
            iconBg = 'bg-blue-50';
          } else if (acc.type === 'Mobile Money') {
            icon = <Smartphone className="w-5 h-5 text-amber-600" />;
            iconBg = 'bg-amber-50';
          } else if (acc.name.includes('POS')) {
            icon = <Store className="w-5 h-5 text-purple-600" />;
            iconBg = 'bg-purple-50';
          }

          return (
            <div key={acc.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-xl ${iconBg}`}>
                    {icon}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {acc.type}
                  </span>
                </div>

                <div className="mt-3">
                  <h3 className="font-bold text-sm text-[#001F3F]">{acc.name}</h3>
                  {acc.accountNumber && (
                    <p className="font-mono text-[10px] text-slate-500 mt-0.5">{acc.accountNumber}</p>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Solde Disponible</span>
                  <div className="text-xl font-black text-slate-900 tracking-tight">
                    {formatFCFA(acc.balance)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Global Liquidity Summary Bar */}
      <div className="bg-[#001F3F] text-white p-5 rounded-2xl border border-blue-950 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
            <ShieldCheck className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <span className="text-xs font-bold text-blue-200 uppercase tracking-wider">
              Position Globale de Trésorerie Immédiate
            </span>
            <div className="text-2xl font-black text-white mt-0.5">
              {formatFCFA(totalTreasuryBalance)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium border-t sm:border-t-0 sm:border-l border-white/10 pt-3 sm:pt-0 sm:pl-6">
          <div>
            <span className="text-blue-300 block text-[10px] uppercase font-bold">Espèces Caisses</span>
            <span className="text-white font-bold">{formatFCFA(totalPhysicalCash)}</span>
          </div>
          <div className="h-6 w-px bg-white/20" />
          <div>
            <span className="text-blue-300 block text-[10px] uppercase font-bold">Banque BICICI</span>
            <span className="text-white font-bold">{formatFCFA(totalBankMoney)}</span>
          </div>
          <div className="h-6 w-px bg-white/20" />
          <div>
            <span className="text-blue-300 block text-[10px] uppercase font-bold">Mobile Money</span>
            <span className="text-white font-bold">{formatFCFA(totalMobileMoney)}</span>
          </div>
        </div>
      </div>

      {/* Movements Table Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par code, motif, opérateur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-xs font-medium"
          />
        </div>

        {/* Filters & Export */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Movement Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-hidden"
          >
            <option value="Tous">Tous les types de mouvements</option>
            <option value="Virement interne">Virement interne</option>
            <option value="Alimentation">Alimentation</option>
            <option value="Remise en banque">Remise en banque</option>
            <option value="Décaissement">Décaissement</option>
          </select>

          {/* Account Filter */}
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-hidden"
          >
            <option value="Tous">Tous les comptes</option>
            {treasuryAccounts.map(a => (
              <option key={a.id} value={a.name}>{a.name}</option>
            ))}
          </select>

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-semibold text-slate-700 flex items-center gap-1.5 transition-colors"
            title="Exporter en CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-semibold text-slate-700 flex items-center gap-1.5 transition-colors"
            title="Imprimer"
          >
            <Printer className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">Imprimer</span>
          </button>
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 uppercase font-bold tracking-wider text-[11px] border-b border-slate-200">
                <th className="py-3.5 px-4 font-bold text-slate-700">Code</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Date & Heure</th>
                <th className="py-3.5 px-4 font-bold text-slate-700 text-center">Type</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Compte Débité (Source)</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Compte Crédité (Destination)</th>
                <th className="py-3.5 px-4 font-bold text-slate-700 text-right">Montant</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Motif & Justificatif</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Référence</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Opérateur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ArrowRightLeft className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-500 text-sm">Aucun mouvement de trésorerie</p>
                      <p className="text-xs text-slate-400">
                        Effectuez un virement interne ou un mouvement de fonds pour le tracer ici.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMovements.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-semibold whitespace-nowrap">
                      <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {m.code}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap font-medium">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{m.date}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                        <ArrowRightLeft className="w-3 h-3 text-teal-600" />
                        {m.type}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-medium text-slate-800 whitespace-nowrap">
                      {m.fromAccount ? (
                        <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                          {m.fromAccount}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Extérieur</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-medium text-slate-800 whitespace-nowrap">
                      {m.toAccount ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {m.toAccount}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Décaissement</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                      {formatFCFA(m.amount)}
                    </td>

                    <td className="py-3 px-4 text-slate-800 whitespace-nowrap font-medium">
                      {m.reason}
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {m.reference || '-'}
                    </td>

                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{m.performedBy}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Nouveau Mouvement de Trésorerie */}
      {isModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 my-4">
            <div className="flex items-center justify-between p-4 bg-[#001F3F] text-white">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-400/30">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Nouveau Mouvement de Trésorerie</h3>
                  <p className="text-xs text-blue-200">Transfert de fonds entre comptes ou caisses</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitModal} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Type d'Opération</label>
                <select
                  value={moveType}
                  onChange={(e) => setMoveType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 font-bold text-slate-800"
                >
                  <option value="Virement interne">Virement interne entre comptes</option>
                  <option value="Alimentation">Alimentation de caisse (Retrait banque vers caisse)</option>
                  <option value="Remise en banque">Remise en banque (Versement espèces caisse vers banque)</option>
                  <option value="Décaissement">Décaissement direct de trésorerie</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Compte Source (Débit)</label>
                  <select
                    value={fromAccount}
                    onChange={(e) => setFromAccount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 font-medium text-slate-800"
                  >
                    {treasuryAccounts.map(a => (
                      <option key={a.id} value={a.name}>{a.name} ({formatFCFA(a.balance)})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Compte Destinataire (Crédit)</label>
                  <select
                    value={toAccount}
                    onChange={(e) => setToAccount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 font-medium text-slate-800"
                  >
                    {treasuryAccounts.map(a => (
                      <option key={a.id} value={a.name}>{a.name} ({formatFCFA(a.balance)})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Montant à Transférer (FCFA)</label>
                <input
                  type="number"
                  required
                  min={1}
                  placeholder="Ex: 100 000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 font-black text-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Motif / Justification du mouvement</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Versement recettes de la semaine, Dotation caisse..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 font-medium text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Référence Pièce / Bordereau</label>
                  <input
                    type="text"
                    placeholder="Ex: BORD-VERS-101, RET-CHQ..."
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Opérateur Responsable</label>
                  <input
                    type="text"
                    value={performedBy}
                    onChange={(e) => setPerformedBy(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-500 font-medium"
                  />
                </div>
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
                  className="px-5 py-2.5 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-sm transition-all"
                >
                  Exécuter le Mouvement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
