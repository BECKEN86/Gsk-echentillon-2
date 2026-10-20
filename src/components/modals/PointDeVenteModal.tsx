import React, { useState } from 'react';
import {
  X,
  Store,
  Calendar,
  Clock,
  User,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  FileText,
  AlertTriangle,
  Lock,
  Unlock,
  Coins
} from 'lucide-react';
import { PointDeVente } from '../../types';
import { formatFCFA } from '../../data/initialData';

interface PointDeVenteOpenModalProps {
  isOpen: boolean;
  onClose: () => void;
  nextCode: string; // e.g. "PV0003"
  defaultOperator?: string;
  onConfirmOpen: (data: {
    code: string;
    date: string;
    operator: string;
    openingAmount: number;
    openedAt: string;
    notes?: string;
  }) => void;
}

export const PointDeVenteOpenModal: React.FC<PointDeVenteOpenModalProps> = ({
  isOpen,
  onClose,
  nextCode,
  defaultOperator = 'Kouassi Marc',
  onConfirmOpen
}) => {
  const [code, setCode] = useState(nextCode);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [operator, setOperator] = useState(defaultOperator);
  const [openingAmount, setOpeningAmount] = useState<number>(50000);
  const [openedAt, setOpenedAt] = useState(() => {
    const now = new Date();
    const d = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0];
    return `${d} ${time}`;
  });
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmOpen({
      code,
      date,
      operator,
      openingAmount: Number(openingAmount) || 0,
      openedAt,
      notes: notes.trim() || undefined
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 my-4">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-[#001F3F] text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              <Unlock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Ouverture du Point de Vente</h3>
              <p className="text-xs text-blue-200">Démarrage d'une nouvelle session de caisse</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-900 flex items-start gap-2.5">
            <Store className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Veuillez renseigner le fond de caisse initial et vérifier l'opérateur avant d'ouvrir les ventes.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Numéro (Code PV) *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="PV0001"
                className="w-full px-3 py-2 bg-slate-50 font-mono font-bold text-blue-700 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 text-slate-800 font-semibold border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" /> Opérateur Responsable *
            </label>
            <input
              type="text"
              required
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              placeholder="Nom de l'opérateur ou caissier"
              className="w-full px-3 py-2 bg-white text-slate-800 font-semibold border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Date et Heure Ouverture (Début) *
              </label>
              <input
                type="text"
                required
                value={openedAt}
                onChange={(e) => setOpenedAt(e.target.value)}
                placeholder="2026-10-18 08:30:00"
                className="w-full px-3 py-2 bg-slate-50 text-slate-700 font-mono text-[11px] border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-emerald-600" /> Solde Ouverture (FCFA) *
              </label>
              <input
                type="number"
                min="0"
                required
                value={openingAmount}
                onChange={(e) => setOpeningAmount(Number(e.target.value))}
                placeholder="50000"
                className="w-full px-3 py-2 bg-white text-emerald-800 font-black text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Notes & Consignes d'ouverture (optionnel)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Fond de caisse en petites coupures, consigne de poste..."
              className="w-full px-3 py-2 bg-slate-50 text-slate-800 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Statut initial : <strong className="text-emerald-600">En cours</strong>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#001F3F] hover:bg-blue-900 text-white font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Ouvrir le Point de Vente</span>
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};

interface PointDeVenteCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  pv: PointDeVente;
  onConfirmClose: (pvId: string, closingAmount: number, closedAt: string, notes?: string) => void;
}

export const PointDeVenteCloseModal: React.FC<PointDeVenteCloseModalProps> = ({
  isOpen,
  onClose,
  pv,
  onConfirmClose
}) => {
  const [closedAt, setClosedAt] = useState(() => {
    const now = new Date();
    const d = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0];
    return `${d} ${time}`;
  });

  // Calcul des ventes de la session
  const totalSalesCount = pv.sales?.length || 0;
  const totalSalesAmount = pv.sales?.reduce((s, o) => s + (o.finalAmount || o.totalAmount), 0) || 0;
  const cashSalesAmount = pv.sales
    ?.filter(o => o.paymentMethod === 'Espèces')
    .reduce((s, o) => s + (o.finalAmount || o.totalAmount), 0) || 0;
  const mobileSalesAmount = pv.sales
    ?.filter(o => o.paymentMethod === 'Mobile Money')
    .reduce((s, o) => s + (o.finalAmount || o.totalAmount), 0) || 0;
  const creditSalesAmount = pv.sales
    ?.filter(o => o.paymentMethod === 'Crédit')
    .reduce((s, o) => s + (o.finalAmount || o.totalAmount), 0) || 0;

  // Solde théorique = Solde ouverture + Ventes espèces
  const expectedClosing = pv.openingAmount + cashSalesAmount;

  const [closingAmount, setClosingAmount] = useState<number>(expectedClosing);
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const discrepancy = Number(closingAmount) - expectedClosing;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmClose(pv.id, Number(closingAmount) || 0, closedAt, notes.trim() || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 my-4">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-[#001F3F] text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">Fermeture & Clôture du Point de Vente</h3>
                <span className="font-mono text-xs font-bold bg-white/20 px-2 py-0.5 rounded text-white">
                  {pv.code}
                </span>
              </div>
              <p className="text-xs text-blue-200">Arrêté de caisse journalier et comptage physique</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
          {/* Info cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Opérateur</span>
              <span className="font-bold text-slate-800 text-xs">{pv.operator}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Date</span>
              <span className="font-bold text-slate-800 text-xs">{pv.date}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Début</span>
              <span className="font-mono font-bold text-slate-700 text-[11px] truncate block">{pv.openedAt.split(' ')[1] || pv.openedAt}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Ventes faites</span>
              <span className="font-bold text-blue-700 text-xs">{totalSalesCount} commande(s)</span>
            </div>
          </div>

          {/* Breakdown */}
          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
            <div className="p-3 bg-slate-50/80 flex items-center justify-between">
              <span className="font-semibold text-slate-600">Solde Ouverture (Fond initial) :</span>
              <span className="font-black text-slate-900">{formatFCFA(pv.openingAmount)}</span>
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="text-slate-600">+ Ventes Réglées en Espèces (Cash) :</span>
              <span className="font-bold text-emerald-700">+{formatFCFA(cashSalesAmount)}</span>
            </div>
            <div className="p-3 flex items-center justify-between text-slate-500 text-[11px]">
              <span>Autre : Ventes Mobile Money ({formatFCFA(mobileSalesAmount)}) & Crédit ({formatFCFA(creditSalesAmount)}) :</span>
              <span className="font-medium text-slate-600">{formatFCFA(mobileSalesAmount + creditSalesAmount)}</span>
            </div>
            <div className="p-3 bg-blue-50/70 flex items-center justify-between">
              <span className="font-bold text-blue-950 uppercase text-[11px]">Solde Théorique Attendu en Caisse :</span>
              <span className="font-black text-blue-900 text-sm">{formatFCFA(expectedClosing)}</span>
            </div>
          </div>

          {/* Input Solde Fermeture */}
          <div className="space-y-3 bg-amber-50/50 p-4 rounded-xl border border-amber-200/80">
            <div>
              <label className="block font-bold text-slate-800 mb-1 text-xs flex items-center justify-between">
                <span>Montant à la fermeture (Solde fermeture) *</span>
                <span className="text-[11px] text-slate-500 font-normal">Espèces physiques comptées</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  required
                  value={closingAmount}
                  onChange={(e) => setClosingAmount(Number(e.target.value))}
                  className="w-full pl-3 pr-14 py-2.5 bg-white text-slate-900 font-black text-base border-2 border-amber-400 rounded-xl focus:outline-none focus:border-amber-600 shadow-2xs"
                />
                <span className="absolute right-3 top-3 font-bold text-slate-400 text-xs">FCFA</span>
              </div>
            </div>

            {/* Écart de caisse */}
            <div className="flex items-center justify-between pt-1">
              <span className="font-bold text-slate-700 text-xs">Écart de caisse calculé :</span>
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-black border ${
                discrepancy === 0
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : discrepancy > 0
                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                  : 'bg-rose-100 text-rose-800 border-rose-300'
              }`}>
                {discrepancy === 0 ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>0 FCFA (Caisse équilibrée)</span>
                  </>
                ) : discrepancy > 0 ? (
                  <>
                    <Coins className="w-3.5 h-3.5 text-blue-600" />
                    <span>+{formatFCFA(discrepancy)} (Excédent)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>{formatFCFA(discrepancy)} (Déficit)</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Date et Heure Fermeture */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" /> Date et Heure de Fermeture (Fin) *
            </label>
            <input
              type="text"
              required
              value={closedAt}
              onChange={(e) => setClosedAt(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-slate-800 font-mono text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Remarques de clôture (justification d'écart ou consigne)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="R.A.S ou détails sur l'écart constaté..."
              className="w-full px-3 py-2 bg-slate-50 text-slate-800 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Statut après validation : <strong className="text-slate-800">Fermé</strong>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
              >
                <Lock className="w-4 h-4 text-white" />
                <span>Confirmer la Fermeture du Point de Vente</span>
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};
