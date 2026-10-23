import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  BarChart3,
  Percent,
  Package,
  FileSpreadsheet,
  Printer,
  Scale,
  Award
} from 'lucide-react';
import { CompanyConfig, Product, SaleOrder, FinancialTransaction } from '../../../types';
import { formatFCFA } from '../../../data/initialData';
import { parseAppDate } from '../../../utils/dateUtils';
import { withProfessionalPrintBranding } from '../../../utils/professionalPrint';

interface MargesResultatViewProps {
  products: Product[];
  saleOrders: SaleOrder[];
  transactions: FinancialTransaction[];
  companyConfig?: CompanyConfig | null;
}

export const MargesResultatView: React.FC<MargesResultatViewProps> = ({
  products,
  saleOrders,
  transactions,
  companyConfig
}) => {
  const [periodFilter, setPeriodFilter] = useState<'all' | 'month' | 'quarter' | 'year'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('Toutes');
  const [productSearch, setProductSearch] = useState('');

  // Vrai si la date (format local "YYYY-MM-DD[ HH:mm]") tombe dans la période choisie
  const isInPeriod = (dateStr: string) => {
    if (periodFilter === 'all') return true;
    const d = parseAppDate(dateStr);
    if (isNaN(d.getTime())) return true;
    const now = new Date();
    if (periodFilter === 'month') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (periodFilter === 'quarter') {
      return Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3) && d.getFullYear() === now.getFullYear();
    }
    if (periodFilter === 'year') {
      return d.getFullYear() === now.getFullYear();
    }
    return true;
  };

  // 1. Filtrer les ventes selon la période
  const filteredSales = useMemo(() => {
    return saleOrders.filter(sale => {
      if (sale.status === 'Annulé' || sale.status === 'En cours') return false;
      return isInPeriod(sale.date);
    });
  }, [saleOrders, periodFilter]);

  // 2. Chiffre d'Affaires total & Remises
  const totalSalesRevenue = useMemo(() => {
    return filteredSales.reduce((sum, s) => sum + s.finalAmount, 0);
  }, [filteredSales]);

  const totalDiscounts = useMemo(() => {
    return filteredSales.reduce((sum, s) => sum + (s.discount || 0), 0);
  }, [filteredSales]);

  // 3. Calcul du Coût d'Achat des Marchandises Vendues (CAMV)
  const productCostMap = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach(p => {
      map.set(p.id, p.buyPrice || 0);
    });
    return map;
  }, [products]);

  const totalCOGS = useMemo(() => {
    let cogs = 0;
    filteredSales.forEach(sale => {
      sale.items.forEach(item => {
        // Coût figé au moment de la vente ; repli sur le prix d'achat actuel
        // pour les ventes antérieures à l'introduction du snapshot
        const buyPrice = item.buyPrice ?? productCostMap.get(item.productId) ?? 0;
        cogs += buyPrice * item.quantity;
      });
    });
    return cogs;
  }, [filteredSales, productCostMap]);

  // 4. Marge Brute Commerciale
  const grossMargin = totalSalesRevenue - totalCOGS;
  const grossMarginRate = totalCOGS > 0 ? ((grossMargin / totalCOGS) * 100) : 0; // Taux de marge = Marge / Coût
  const markupRate = totalSalesRevenue > 0 ? ((grossMargin / totalSalesRevenue) * 100) : 0; // Taux de marque = Marge / CA

  // 5. Charges d'exploitation hors achats de marchandises (pour éviter le double comptage avec CAMV)
  //    Filtrées sur la même période que les ventes pour un résultat net cohérent.
  const operatingExpenses = useMemo(() => {
    return transactions
      .filter(t => t.type === 'Dépense' && t.category !== 'Achat marchandises' && isInPeriod(t.date))
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, periodFilter]);

  // 6. Résultat Net Estimé
  const netEstimatedProfit = grossMargin - operatingExpenses;
  const netProfitRate = totalSalesRevenue > 0 ? ((netEstimatedProfit / totalSalesRevenue) * 100) : 0;

  // 7. Analyse détaillée de la rentabilité par Produit
  const productProfitability = useMemo(() => {
    const map = new Map<string, {
      productId: string;
      productName: string;
      category: string;
      buyPrice: number;
      sellPrice: number;
      soldQty: number;
      totalRevenue: number;
      totalCost: number;
      totalMargin: number;
      markupRate: number;
    }>();

    // Init with products
    products.forEach(p => {
      map.set(p.id, {
        productId: p.id,
        productName: p.name,
        category: p.category,
        buyPrice: p.buyPrice,
        sellPrice: p.sellPrice,
        soldQty: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalMargin: 0,
        markupRate: 0
      });
    });

    // Accumulate from sales
    filteredSales.forEach(sale => {
      sale.items.forEach(item => {
        let entry = map.get(item.productId);
        if (!entry) {
          entry = {
            productId: item.productId,
            productName: item.productName,
            category: 'Divers',
            buyPrice: 0,
            sellPrice: item.unitPrice,
            soldQty: 0,
            totalRevenue: 0,
            totalCost: 0,
            totalMargin: 0,
            markupRate: 0
          };
          map.set(item.productId, entry);
        }
        entry.soldQty += item.quantity;
        entry.totalRevenue += item.total || (item.unitPrice * item.quantity);
        entry.totalCost += (item.buyPrice ?? entry.buyPrice ?? 0) * item.quantity;
      });
    });

    // Compute margins and filter
    const list = Array.from(map.values())
      .map(item => {
        const margin = item.totalRevenue - item.totalCost;
        const rate = item.totalRevenue > 0 ? ((margin / item.totalRevenue) * 100) : 0;
        return {
          ...item,
          totalMargin: margin,
          markupRate: rate
        };
      })
      .filter(item => {
        const matchesCategory = categoryFilter === 'Toutes' || item.category === categoryFilter;
        const matchesSearch = item.productName.toLowerCase().includes(productSearch.toLowerCase());
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => b.totalMargin - a.totalMargin);

    return list;
  }, [products, filteredSales, categoryFilter, productSearch]);

  const categories = ['Toutes', ...Array.from(new Set(products.map(p => p.category)))];

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Produit',
      'Catégorie',
      'Prix Achat (FCFA)',
      'Prix Vente (FCFA)',
      'Quantité Vendue',
      'CA Total (FCFA)',
      'Coût Achat Total (FCFA)',
      'Marge Brute (FCFA)',
      'Taux de Marque (%)'
    ];

    const rows = productProfitability.map(p => [
      `"${p.productName.replace(/"/g, '""')}"`,
      `"${p.category}"`,
      p.buyPrice,
      p.sellPrice,
      p.soldQty,
      p.totalRevenue,
      p.totalCost,
      p.totalMargin,
      p.markupRate.toFixed(1)
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Analyse_Marges_Resultat_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Print Report
  const handlePrint = () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rapport des Marges et Résultat Estimé</title>
          <meta charset="utf-8" />
          <style>
            @page { size: A4 portrait; margin: 12mm; }
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
            .pl-box {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 12px 16px;
              margin-bottom: 20px;
            }
            .pl-row {
              display: flex;
              justify-content: space-between;
              padding: 6px 0;
              border-bottom: 1px dashed #e2e8f0;
              font-size: 12px;
            }
            .pl-total {
              font-weight: bold;
              border-top: 2px solid #001F3F;
              border-bottom: none;
              padding-top: 8px;
              margin-top: 4px;
              font-size: 14px;
            }
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
            .green { color: #047857; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">GESTOCK - COMPTE DE RÉSULTAT PRÉVISIONNEL & MARGES</h1>
              <p style="margin: 3px 0 0 0; color: #64748b; font-size: 11px;">Synthèse de performance et rentabilité commerciale</p>
            </div>
            <div style="text-align: right; font-size: 10px; color: #64748b;">
              Édité le : ${new Date().toLocaleString('fr-FR')}
            </div>
          </div>

          <div class="pl-box">
            <h3 style="margin: 0 0 10px 0; font-size: 13px; color: #001F3F; text-transform: uppercase;">Cascade du Résultat d'Exploitation</h3>
            <div class="pl-row">
              <span>Chiffre d'Affaires Réalisé</span>
              <strong>${formatFCFA(totalSalesRevenue)}</strong>
            </div>
            <div class="pl-row" style="color: #b91c1c;">
              <span>(-) Coût d'Achat des Marchandises Vendues (CAMV)</span>
              <span>- ${formatFCFA(totalCOGS)}</span>
            </div>
            <div class="pl-row green" style="background: #ecfdf5; padding: 6px 8px; border-radius: 4px;">
              <span>(=) Marge Commerciale Brute (${markupRate.toFixed(1)}% de marque)</span>
              <span>+ ${formatFCFA(grossMargin)}</span>
            </div>
            <div class="pl-row" style="color: #b91c1c;">
              <span>(-) Charges & Dépenses d'Exploitation (Loyer, Salaires, Énergie...)</span>
              <span>- ${formatFCFA(operatingExpenses)}</span>
            </div>
            <div class="pl-row pl-total" style="color: ${netEstimatedProfit >= 0 ? '#047857' : '#b91c1c'}">
              <span>(=) RÉSULTAT NET ESTIMÉ (${netProfitRate.toFixed(1)}% de rentabilité)</span>
              <span>${formatFCFA(netEstimatedProfit)}</span>
            </div>
          </div>

          <h3 style="font-size: 12px; text-transform: uppercase; color: #001F3F; margin-bottom: 6px;">Top Rentabilité par Produit</h3>
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Catégorie</th>
                <th class="text-right">Qté Vendue</th>
                <th class="text-right">CA Total</th>
                <th class="text-right">Coût CAMV</th>
                <th class="text-right">Marge Brute</th>
                <th class="text-right">Taux Marque</th>
              </tr>
            </thead>
            <tbody>
              ${productProfitability.slice(0, 20).map(p => `
                <tr>
                  <td><strong>${p.productName}</strong></td>
                  <td>${p.category}</td>
                  <td class="text-right">${p.soldQty}</td>
                  <td class="text-right">${formatFCFA(p.totalRevenue)}</td>
                  <td class="text-right">${formatFCFA(p.totalCost)}</td>
                  <td class="text-right green">${formatFCFA(p.totalMargin)}</td>
                  <td class="text-right">${p.markupRate.toFixed(1)}%</td>
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
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 border border-purple-500/20">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#001F3F] tracking-tight">
              Marges et Résultat Estimé
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Analyse de rentabilité commerciale, coût d'achat des marchandises (CAMV) et compte de résultat d'exploitation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setPeriodFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${periodFilter === 'all' ? 'bg-white text-[#001F3F] shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Tout
            </button>
            <button
              onClick={() => setPeriodFilter('month')}
              className={`px-3 py-1.5 rounded-lg transition-all ${periodFilter === 'month' ? 'bg-white text-[#001F3F] shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Ce mois
            </button>
            <button
              onClick={() => setPeriodFilter('quarter')}
              className={`px-3 py-1.5 rounded-lg transition-all ${periodFilter === 'quarter' ? 'bg-white text-[#001F3F] shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Trimestre
            </button>
            <button
              onClick={() => setPeriodFilter('year')}
              className={`px-3 py-1.5 rounded-lg transition-all ${periodFilter === 'year' ? 'bg-white text-[#001F3F] shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Cette année
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-emerald-700 transition-colors"
            title="Exporter CSV"
          >
            <FileSpreadsheet className="w-4 h-4" />
          </button>

          <button
            onClick={handlePrint}
            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-blue-700 transition-colors"
            title="Imprimer"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI 4 Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Chiffre d'Affaires */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Chiffre d'Affaires (CA)</span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900">{formatFCFA(totalSalesRevenue)}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{filteredSales.length} commande(s) client</p>
        </div>

        {/* Coût d'Achat (CAMV) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Coût des Marchandises (CAMV)</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-amber-900">{formatFCFA(totalCOGS)}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Coût d'achat réel stock vendu</p>
        </div>

        {/* Marge Brute */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Marge Commerciale Brute</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Percent className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700">{formatFCFA(grossMargin)}</span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {markupRate.toFixed(1)}% marque
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Taux de marge : {grossMarginRate.toFixed(1)}%</p>
        </div>

        {/* Résultat Net Estimé */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Résultat Net Estimé</span>
            <span className={`p-2 rounded-xl ${netEstimatedProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              <Award className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-black ${netEstimatedProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {formatFCFA(netEstimatedProfit)}
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              netEstimatedProfit >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {netProfitRate.toFixed(1)}% net
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Après déduction des charges ({formatFCFA(operatingExpenses)})</p>
        </div>
      </div>

      {/* Financial Cascade / Income Statement Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <h2 className="text-sm font-bold text-[#001F3F] uppercase tracking-wider mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-600" />
          Compte de Résultat d'Exploitation Simplifié (P&L)
        </h2>

        <div className="space-y-3 text-xs">
          {/* Step 1: CA */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <span className="font-bold text-slate-800 text-sm">Chiffre d'Affaires Brut</span>
              <p className="text-[11px] text-slate-500 mt-0.5">Montant cumulé des ventes de marchandises</p>
            </div>
            <span className="text-base font-black text-slate-900">{formatFCFA(totalSalesRevenue + totalDiscounts)}</span>
          </div>

          {/* Step 2: Remises */}
          {totalDiscounts > 0 && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-amber-900">
              <div>
                <span className="font-bold">(-) Remises et Rabais Commerciaux accordés</span>
                <p className="text-[11px] text-amber-700 mt-0.5">Réductions accordées aux clients en caisse</p>
              </div>
              <span className="font-bold">- {formatFCFA(totalDiscounts)}</span>
            </div>
          )}

          {/* Step 3: CAMV */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-red-50/60 border border-red-200 text-red-900">
            <div>
              <span className="font-bold">(-) Coût d'Achat des Marchandises Vendues (CAMV)</span>
              <p className="text-[11px] text-red-700 mt-0.5">Valorisation au prix d'achat fournisseur des produits écoulés</p>
            </div>
            <span className="font-bold text-sm">- {formatFCFA(totalCOGS)}</span>
          </div>

          {/* Step 4: Marge Commerciale */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 font-bold">
            <div>
              <span className="text-sm uppercase tracking-wide">(=) MARGE COMMERCIALE BRUTE</span>
              <p className="text-[11px] text-emerald-700 font-normal mt-0.5">
                Richesse brute créée par l'activité de revente (Taux de marque : {markupRate.toFixed(1)}%)
              </p>
            </div>
            <span className="text-lg font-black text-emerald-800">+{formatFCFA(grossMargin)}</span>
          </div>

          {/* Step 5: Charges d'exploitation */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800">
            <div>
              <span className="font-bold">(-) Charges de Fonctionnement & d'Exploitation</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Salaires, loyers, factures CIE/SODECI, carburant, maintenance (hors achats stocks)
              </p>
            </div>
            <span className="font-bold text-red-700">- {formatFCFA(operatingExpenses)}</span>
          </div>

          {/* Step 6: Résultat Net Estimé */}
          <div className={`flex items-center justify-between p-4 rounded-xl border font-bold ${
            netEstimatedProfit >= 0
              ? 'bg-linear-to-r from-emerald-500/10 via-emerald-500/5 to-white border-emerald-300 text-emerald-950'
              : 'bg-linear-to-r from-red-500/10 via-red-500/5 to-white border-red-300 text-red-950'
          }`}>
            <div>
              <span className="text-base font-black uppercase tracking-wide">
                (=) RÉSULTAT D'EXPLOITATION NET ESTIMÉ
              </span>
              <p className="text-[11px] text-slate-600 font-normal mt-0.5">
                Bénéfice net prévisionnel avant impôts et dotations
              </p>
            </div>
            <div className="text-right">
              <span className={`text-xl font-black ${netEstimatedProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {formatFCFA(netEstimatedProfit)}
              </span>
              <span className="block text-[10px] text-slate-500 font-semibold mt-0.5">
                Rentabilité nette : {netProfitRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Product Profitability Analysis Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#001F3F] uppercase tracking-wider">
              Rentabilité Commerciale Détaillée par Article
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Marge unitaire, volume écoulé, marge globale et taux de marque
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Filtrer un produit..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden"
            />

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-hidden"
            >
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 uppercase font-bold tracking-wider text-[11px] border-b border-slate-200">
                <th className="py-3 px-4 font-bold text-slate-700">Produit</th>
                <th className="py-3 px-4 font-bold text-slate-700">Catégorie</th>
                <th className="py-3 px-4 font-bold text-slate-700 text-right">Prix Achat</th>
                <th className="py-3 px-4 font-bold text-slate-700 text-right">Prix Vente</th>
                <th className="py-3 px-4 font-bold text-slate-700 text-center">Quantité Vendue</th>
                <th className="py-3 px-4 font-bold text-slate-700 text-right">CA Généré</th>
                <th className="py-3 px-4 font-bold text-slate-700 text-right">Coût CAMV</th>
                <th className="py-3 px-4 font-bold text-slate-700 text-right">Marge Brute</th>
                <th className="py-3 px-4 font-bold text-slate-700 text-right">Taux de Marque</th>
                <th className="py-3 px-4 font-bold text-slate-700 text-center">Performance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {productProfitability.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
                    Aucun produit trouvé dans cette période.
                  </td>
                </tr>
              ) : (
                productProfitability.map((p, idx) => {
                  let badgeColor = 'bg-slate-100 text-slate-600';
                  let badgeText = 'Neutre';

                  if (p.markupRate >= 30) {
                    badgeColor = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                    badgeText = 'Excellente';
                  } else if (p.markupRate >= 15) {
                    badgeColor = 'bg-blue-50 text-blue-700 border border-blue-200';
                    badgeText = 'Bonne';
                  } else if (p.markupRate > 0) {
                    badgeColor = 'bg-amber-50 text-amber-700 border border-amber-200';
                    badgeText = 'Moyenne';
                  } else if (p.totalRevenue > 0) {
                    badgeColor = 'bg-red-50 text-red-700 border border-red-200';
                    badgeText = 'Déficitaire';
                  }

                  return (
                    <tr key={p.productId || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                        {p.productName}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-medium">
                          {p.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 whitespace-nowrap font-medium">
                        {formatFCFA(p.buyPrice)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-800 whitespace-nowrap font-bold">
                        {formatFCFA(p.sellPrice)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap font-bold text-slate-900">
                        {p.soldQty}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-bold text-slate-900">
                        {formatFCFA(p.totalRevenue)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap text-slate-600 font-medium">
                        {formatFCFA(p.totalCost)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-black text-emerald-700">
                        {p.totalMargin > 0 ? `+${formatFCFA(p.totalMargin)}` : formatFCFA(p.totalMargin)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-bold text-slate-800">
                        {p.markupRate.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeColor}`}>
                          {badgeText}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
