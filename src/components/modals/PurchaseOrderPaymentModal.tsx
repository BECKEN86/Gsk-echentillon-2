import React, { useState, useMemo } from 'react';
import {
  X,
  CreditCard,
  Building2,
  Calendar,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  Clock,
  ShieldCheck,
  Receipt,
  Layers,
  ArrowRight
} from 'lucide-react';
import { PurchaseOrder, Supplier, PurchaseOrderSupplierSettlement } from '../../types';
import { formatFCFA } from '../../data/initialData';

interface PurchaseOrderPaymentModalProps {
  po: PurchaseOrder;
  suppliers: Supplier[];
  onClose: () => void;
  onConfirmValidation: (po: PurchaseOrder, settlements: PurchaseOrderSupplierSettlement[]) => void;
}

export const PurchaseOrderPaymentModal: React.FC<PurchaseOrderPaymentModalProps> = ({
  po,
  suppliers,
  onClose,
  onConfirmValidation
}) => {
  // 1. Regrouper tous les articles par fournisseur concerné
  const supplierGroups = useMemo(() => {
    const groups: { [key: string]: { id: string; name: string; amount: number; itemsCount: number } } = {};

    if (po.items && po.items.length > 0) {
      po.items.forEach(item => {
        const suppId = item.supplierId || po.supplierId;
        const suppObj = suppliers.find(s => s.id === suppId);
        const suppName = item.supplierName || suppObj?.name || po.supplierName || 'Fournisseur';

        const itemTotal = item.total || (item.quantity * item.unitPrice + (item.vatAmount || 0));

        if (!groups[suppId]) {
          groups[suppId] = {
            id: suppId,
            name: suppName,
            amount: 0,
            itemsCount: 0
          };
        }
        groups[suppId].amount += itemTotal;
        groups[suppId].itemsCount += item.quantity;
      });
    } else {
      // Cas sans articles explicites
      const suppObj = suppliers.find(s => s.id === po.supplierId);
      groups[po.supplierId] = {
        id: po.supplierId,
        name: po.supplierName || suppObj?.name || 'Fournisseur principal',
        amount: po.totalTTC || po.totalAmount || 0,
        itemsCount: 0
      };
    }

    return Object.values(groups);
  }, [po, suppliers]);

  // 2. État des règlements par fournisseur
  const [settlementMap, setSettlementMap] = useState<{
    [supplierId: string]: {
      paymentMode: 'Cash' | 'Crédit' | 'Partiel';
      paidAmount: number;
      creditAmount: number;
      paymentMethod: string;
      reference: string;
      notes: string;
    };
  }>(() => {
    const initial: {
      [supplierId: string]: {
        paymentMode: 'Cash' | 'Crédit' | 'Partiel';
        paidAmount: number;
        creditAmount: number;
        paymentMethod: string;
        reference: string;
        notes: string;
      };
    } = {};

    supplierGroups.forEach(sg => {
      // Par défaut : Cash (payé au comptant)
      initial[sg.id] = {
        paymentMode: 'Cash',
        paidAmount: sg.amount,
        creditAmount: 0,
        paymentMethod: 'Espèces',
        reference: '',
        notes: ''
      };
    });
    return initial;
  });

  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mettre à jour le mode de règlement pour un fournisseur
  const handleModeChange = (supplierId: string, totalAmount: number, newMode: 'Cash' | 'Crédit' | 'Partiel') => {
    setSettlementMap(prev => {
      const current = prev[supplierId] || {
        paymentMode: 'Cash',
        paidAmount: totalAmount,
        creditAmount: 0,
        paymentMethod: 'Espèces',
        reference: '',
        notes: ''
      };

      let paid = totalAmount;
      let credit = 0;

      if (newMode === 'Crédit') {
        paid = 0;
        credit = totalAmount;
      } else if (newMode === 'Cash') {
        paid = totalAmount;
        credit = 0;
      } else if (newMode === 'Partiel') {
        // Demi ou acompte par défaut si non renseigné
        paid = Math.round(totalAmount / 2);
        credit = totalAmount - paid;
      }

      return {
        ...prev,
        [supplierId]: {
          ...current,
          paymentMode: newMode,
          paidAmount: paid,
          creditAmount: credit
        }
      };
    });
  };

  // Mettre à jour le montant réglé en cash pour un mode partiel
  const handlePaidAmountChange = (supplierId: string, totalAmount: number, val: number) => {
    const validPaid = Math.max(0, Math.min(totalAmount, val || 0));
    const credit = totalAmount - validPaid;

    setSettlementMap(prev => {
      const current = prev[supplierId];
      return {
        ...prev,
        [supplierId]: {
          ...current,
          paidAmount: validPaid,
          creditAmount: credit
        }
      };
    });
  };

  // Calcul des totaux globaux
  const summary = useMemo(() => {
    let totalOrder = 0;
    let totalPaid = 0;
    let totalCredit = 0;

    supplierGroups.forEach(sg => {
      const s = settlementMap[sg.id];
      totalOrder += sg.amount;
      if (s) {
        totalPaid += s.paidAmount;
        totalCredit += s.creditAmount;
      } else {
        totalPaid += sg.amount;
      }
    });

    let overallStatus: 'Payé' | 'Payé partiellement' | 'Non payé' = 'Payé';
    if (totalPaid === 0 && totalCredit > 0) {
      overallStatus = 'Non payé';
    } else if (totalPaid > 0 && totalCredit > 0) {
      overallStatus = 'Payé partiellement';
    } else if (totalCredit === 0) {
      overallStatus = 'Payé';
    }

    return { totalOrder, totalPaid, totalCredit, overallStatus };
  }, [supplierGroups, settlementMap]);

  // Validation du formulaire
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Préparer les règlements
    const settlements: PurchaseOrderSupplierSettlement[] = supplierGroups.map(sg => {
      const s = settlementMap[sg.id] || {
        paymentMode: 'Cash',
        paidAmount: sg.amount,
        creditAmount: 0,
        paymentMethod: 'Espèces',
        reference: '',
        notes: ''
      };

      return {
        supplierId: sg.id,
        supplierName: sg.name,
        amount: sg.amount,
        paymentMode: s.paymentMode,
        paidAmount: s.paidAmount,
        creditAmount: s.creditAmount,
        paymentDate: paymentDate,
        reference: s.reference || undefined,
        notes: s.notes || undefined
      };
    });

    onConfirmValidation(po, settlements);
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 my-4">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 bg-[#001F3F] text-white border-b border-blue-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-400/30">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">Fiche de Règlement & Mode de Paiement</h3>
                <span className="font-mono text-xs font-bold bg-white/20 text-white px-2 py-0.5 rounded-md">
                  {po.code}
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                Validation du bon de commande et enregistrement des modalités de paiement fournisseur
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-xs">
          
          {/* Bannière explicative */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-blue-900 flex items-start gap-3">
            <Receipt className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-xs">Règlement des fournisseurs pour la validation</p>
              <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                Définissez pour chaque fournisseur concerné son mode de règlement (<strong>Cash</strong>, <strong>Crédit</strong> ou <strong>Partiel</strong>). 
                Les montants à crédit seront automatiquement enregistrés dans le solde dû et les fiches dettes des fournisseurs correspondants.
              </p>
            </div>
          </div>

          {/* Date de règlement & Informations Commande */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Date de Règlement *
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <span className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Acheteur
              </span>
              <p className="text-xs font-bold text-slate-800 py-2">
                {po.buyer || 'Kouassi Marc'}
              </p>
            </div>

            <div>
              <span className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Fournisseurs Concernés
              </span>
              <p className="text-xs font-bold text-blue-700 py-2">
                {supplierGroups.length} fournisseur(s) sollicité(s)
              </p>
            </div>
          </div>

          {/* Tableau des Fournisseurs Concernés */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                Détail des Fournisseurs & Règlements
              </h4>
              <span className="text-slate-500 text-[11px]">
                Total Commande : <strong className="text-slate-900">{formatFCFA(summary.totalOrder)}</strong>
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                    <th className="py-3 px-3.5">Fournisseur</th>
                    <th className="py-3 px-3.5 text-right">Montant Concerné</th>
                    <th className="py-3 px-3.5 text-center">Règlement</th>
                    <th className="py-3 px-3.5 text-right">Montant Réglé (Cash)</th>
                    <th className="py-3 px-3.5 text-right">Solde à Crédit (Dette)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {supplierGroups.map(sg => {
                    const currentSettlement = settlementMap[sg.id] || {
                      paymentMode: 'Cash',
                      paidAmount: sg.amount,
                      creditAmount: 0,
                      paymentMethod: 'Espèces',
                      reference: '',
                      notes: ''
                    };

                    const suppObj = suppliers.find(s => s.id === sg.id);

                    return (
                      <tr key={sg.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Fournisseur */}
                        <td className="py-3.5 px-3.5">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              {sg.name}
                            </span>
                            {suppObj?.contactPerson && (
                              <span className="text-[11px] text-slate-500 ml-5">
                                Contact: {suppObj.contactPerson} {suppObj.phone ? `(${suppObj.phone})` : ''}
                              </span>
                            )}
                            {sg.itemsCount > 0 && (
                              <span className="text-[10px] text-slate-400 ml-5">
                                {sg.itemsCount} article(s) dans la commande
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Montant Concerné */}
                        <td className="py-3.5 px-3.5 text-right font-black text-[#001F3F] text-sm whitespace-nowrap">
                          {formatFCFA(sg.amount)}
                        </td>

                        {/* Liste Déroulante Règlement : Crédit, Partiel, Cash */}
                        <td className="py-3.5 px-3.5 text-center">
                          <select
                            value={currentSettlement.paymentMode}
                            onChange={(e) => handleModeChange(sg.id, sg.amount, e.target.value as 'Cash' | 'Crédit' | 'Partiel')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all ${
                              currentSettlement.paymentMode === 'Cash'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : currentSettlement.paymentMode === 'Crédit'
                                ? 'bg-rose-50 text-rose-800 border-rose-300'
                                : 'bg-amber-50 text-amber-800 border-amber-300'
                            }`}
                          >
                            <option value="Cash">Cash (Comptant)</option>
                            <option value="Crédit">Crédit (Dette)</option>
                            <option value="Partiel">Partiel (Acompte)</option>
                          </select>
                        </td>

                        {/* Montant Réglé (Cash) */}
                        <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                          {currentSettlement.paymentMode === 'Partiel' ? (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                min="0"
                                max={sg.amount}
                                value={currentSettlement.paidAmount}
                                onChange={(e) => handlePaidAmountChange(sg.id, sg.amount, Number(e.target.value))}
                                className="w-28 px-2.5 py-1 text-right bg-white border border-blue-400 rounded-lg font-black text-xs text-emerald-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <span className="text-[11px] font-bold text-slate-400">F</span>
                            </div>
                          ) : (
                            <span className={`font-bold text-xs ${currentSettlement.paidAmount > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                              {formatFCFA(currentSettlement.paidAmount)}
                            </span>
                          )}
                        </td>

                        {/* Solde à Crédit (Dette) */}
                        <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                          <span className={`font-black text-xs ${
                            currentSettlement.creditAmount > 0 
                              ? 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200' 
                              : 'text-slate-400'
                          }`}>
                            {formatFCFA(currentSettlement.creditAmount)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Totaux généraux */}
                <tfoot>
                  <tr className="bg-slate-50 font-bold border-t-2 border-slate-200 text-slate-800 text-xs">
                    <td className="py-3 px-3.5 uppercase text-[11px] text-slate-600 font-extrabold">
                      Totaux Règlements :
                    </td>
                    <td className="py-3 px-3.5 text-right text-sm font-black text-[#001F3F]">
                      {formatFCFA(summary.totalOrder)}
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                        summary.overallStatus === 'Payé'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : summary.overallStatus === 'Non payé'
                          ? 'bg-rose-100 text-rose-800 border-rose-200'
                          : 'bg-amber-100 text-amber-800 border-amber-200'
                      }`}>
                        {summary.overallStatus === 'Payé' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : summary.overallStatus === 'Non payé' ? (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                        )}
                        <span>{summary.overallStatus}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-right text-sm font-black text-emerald-700">
                      {formatFCFA(summary.totalPaid)}
                    </td>
                    <td className="py-3 px-3.5 text-right text-sm font-black text-rose-700">
                      {formatFCFA(summary.totalCredit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Récapitulatif visuel sous forme de cartes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5">
              <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Total Réglé Comptant (Cash)
              </span>
              <p className="text-base font-black text-emerald-900">{formatFCFA(summary.totalPaid)}</p>
              <p className="text-[10px] text-emerald-600 mt-0.5">Décaissement immédiat</p>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3.5">
              <span className="text-[10px] uppercase font-bold text-rose-700 tracking-wider flex items-center gap-1.5 mb-1">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                Total Enregistré à Crédit (Dettes)
              </span>
              <p className="text-base font-black text-rose-900">{formatFCFA(summary.totalCredit)}</p>
              <p className="text-[10px] text-rose-600 mt-0.5">Ajouté aux créances des fournisseurs</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <span className="text-[10px] uppercase font-bold text-slate-600 tracking-wider flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                Montant Global Validé
              </span>
              <p className="text-base font-black text-[#001F3F]">{formatFCFA(summary.totalOrder)}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">TTC (Taxes incluses)</p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <div className="text-slate-500 text-xs">
              Statut à l'enregistrement : <strong className="text-emerald-700">Validé</strong>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
              >
                Annuler
              </button>

              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-sm flex items-center gap-2 active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>Confirmer le règlement & Valider le Bon de Commande</span>
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};
