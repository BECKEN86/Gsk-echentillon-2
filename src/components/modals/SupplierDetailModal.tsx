import React, { useState } from 'react';
import {
  X,
  Truck,
  Edit3,
  Printer,
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  History,
  Plus,
  CheckCircle2,
  RotateCcw,
  Receipt,
  Wallet,
  Tag,
  DollarSign} from 'lucide-react';
import { CompanyConfig, Supplier, SupplierCreditLine, SupplierAvoirLine, CreditPayment, AvoirRefund } from '../../types';
import { formatFCFA } from '../../data/initialData';
import { withProfessionalPrintBranding } from '../../utils/professionalPrint';

interface SupplierDetailModalProps {
  supplier: Supplier | null;
  companyConfig?: CompanyConfig | null;
  isOpen: boolean;
  onClose: () => void;
  onEditSupplier: (supplier: Supplier) => void;
  onUpdateSupplier: (updatedSupplier: Supplier) => void;
}

export const SupplierDetailModal: React.FC<SupplierDetailModalProps> = ({
  supplier,
  companyConfig,
  isOpen,
  onClose,
  onUpdateSupplier
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'credits' | 'avoirs'>('general');

  // Selected credit line ID
  const [selectedCreditId, setSelectedCreditId] = useState<string | null>(null);
  // Selected avoir line ID
  const [selectedAvoirId, setSelectedAvoirId] = useState<string | null>(null);

  // Sub-modal for adding payment to credit line
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentOperator, setPaymentOperator] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Virement bancaire');
  const [paymentRef, setPaymentRef] = useState<string>('');

  // Sub-modal for adding refund to avoir line
  const [isAddRefundOpen, setIsAddRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundOperator, setRefundOperator] = useState<string>('');
  const [refundMethod, setRefundMethod] = useState<string>('Déduction sur facture');
  const [refundNote, setRefundNote] = useState<string>('');

  // Sub-modal for creating a new debt line ("ajoute une dette")
  const [isAddDebtOpen, setIsAddDebtOpen] = useState(false);
  const [debtAmount, setDebtAmount] = useState<number>(0);
  const [debtInvoiceRef, setDebtInvoiceRef] = useState<string>('');
  const [debtNotes, setDebtNotes] = useState<string>('');
  const [debtDueDate, setDebtDueDate] = useState<string>('');

  // Sub-modal for creating a new avoir line ("ajoute un avoir")
  const [isAddAvoirLineOpen, setIsAddAvoirLineOpen] = useState(false);
  const [newAvoirAmount, setNewAvoirAmount] = useState<number>(0);
  const [newAvoirReason, setNewAvoirReason] = useState<string>('');
  const [newAvoirSourceRef, setNewAvoirSourceRef] = useState<string>('');
  const [newAvoirNotes, setNewAvoirNotes] = useState<string>('');

  // Edit mode: versement / remboursement en cours de modification
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editingRefundId, setEditingRefundId] = useState<string | null>(null);

  if (!isOpen || !supplier) return null;

  const creditLines = supplier.creditLines || [];
  const avoirLines = supplier.avoirLines || [];

  // Default selection if not selected yet
  const currentCreditLine = creditLines.find(c => c.id === selectedCreditId) || creditLines[0] || null;
  const currentAvoirLine = avoirLines.find(a => a.id === selectedAvoirId) || avoirLines[0] || null;
  const editingPayment = editingPaymentId && currentCreditLine
    ? currentCreditLine.payments.find(p => p.id === editingPaymentId) || null
    : null;
  const editingRefund = editingRefundId && currentAvoirLine
    ? currentAvoirLine.refunds.find(r => r.id === editingRefundId) || null
    : null;

  // Total calculated debts & avoirs
  const totalDebtFromLines = creditLines.reduce((sum, c) => sum + c.remainingAmount, 0);
  const totalBalance = creditLines.length > 0 ? totalDebtFromLines : (supplier.balance || 0);
  const totalAvailableAvoirs = avoirLines.reduce((sum, a) => sum + a.remainingBalance, 0);

  // Handle submitting new payment on selected credit line — ou modification d'un versement existant
  const handleAddPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCreditLine || paymentAmount <= 0) return;

    if (editingPayment) {
      const updatedPayments = (currentCreditLine.payments || []).map(p =>
        p.id === editingPayment.id
          ? {
              ...p,
              amount: Number(paymentAmount),
              operator: paymentOperator.trim() || p.operator,
              paymentMethod,
              reference: paymentRef.trim() || p.reference
            }
          : p
      );
      // Recalcule le reste à payer après chaque versement
      let cumulative = 0;
      updatedPayments.forEach(p => {
        cumulative += p.amount;
        p.remainingAmount = Math.max(0, currentCreditLine.initialAmount - cumulative);
      });
      const totalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
      const newRemaining = Math.max(0, currentCreditLine.initialAmount - totalPaid);
      const updatedCreditLine: SupplierCreditLine = {
        ...currentCreditLine,
        paidAmount: totalPaid,
        remainingAmount: newRemaining,
        status: newRemaining === 0 ? 'Soldé' : 'En cours',
        payments: updatedPayments
      };
      const updatedCreditLines = creditLines.map(c => c.id === currentCreditLine.id ? updatedCreditLine : c);
      onUpdateSupplier({
        ...supplier,
        balance: updatedCreditLines.reduce((sum, c) => sum + c.remainingAmount, 0),
        creditLines: updatedCreditLines
      });
      setEditingPaymentId(null);
      setIsAddPaymentOpen(false);
      setPaymentAmount(0);
      setPaymentRef('');
      return;
    }

    const currentRemaining = currentCreditLine.remainingAmount;
    const amountToApply = Math.min(paymentAmount, currentRemaining);
    const newRemaining = Math.max(0, currentRemaining - amountToApply);
    const paymentSeq = (currentCreditLine.payments?.length || 0) + 1;

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newPayment: CreditPayment = {
      id: `spay_${Date.now()}`,
      paymentNumber: `Paiement n° ${paymentSeq}`,
      date: formattedDate,
      amount: amountToApply,
      remainingAmount: newRemaining,
      operator: paymentOperator.trim(),
      paymentMethod,
      reference: paymentRef.trim() || `VIR-${Math.floor(1000 + Math.random() * 9000)}`
    };

    const updatedPayments = [...(currentCreditLine.payments || []), newPayment];
    const updatedCreditLine: SupplierCreditLine = {
      ...currentCreditLine,
      paidAmount: currentCreditLine.paidAmount + amountToApply,
      remainingAmount: newRemaining,
      status: newRemaining === 0 ? 'Soldé' : 'En cours',
      payments: updatedPayments
    };

    const updatedCreditLines = creditLines.map(c => c.id === currentCreditLine.id ? updatedCreditLine : c);
    const updatedTotalDebt = updatedCreditLines.reduce((sum, c) => sum + c.remainingAmount, 0);

    const updatedSupplier: Supplier = {
      ...supplier,
      balance: updatedTotalDebt,
      creditLines: updatedCreditLines
    };

    onUpdateSupplier(updatedSupplier);
    setIsAddPaymentOpen(false);
    setPaymentAmount(0);
    setPaymentRef('');
  };

  // Handle submitting new refund on selected avoir line — ou modification d'un remboursement existant
  const handleAddRefundSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAvoirLine || refundAmount <= 0) return;

    if (editingRefund) {
      const updatedRefunds = (currentAvoirLine.refunds || []).map(r =>
        r.id === editingRefund.id
          ? {
              ...r,
              amount: Number(refundAmount),
              operator: refundOperator.trim() || r.operator,
              refundMethod,
              notes: refundNote.trim()
            }
          : r
      );
      // Recalcule le solde restant après chaque remboursement
      let cumulative = 0;
      updatedRefunds.forEach(r => {
        cumulative += r.amount;
        r.remainingBalance = Math.max(0, currentAvoirLine.totalAmount - cumulative);
      });
      const totalRefunded = updatedRefunds.reduce((sum, r) => sum + r.amount, 0);
      const newBalance = Math.max(0, currentAvoirLine.totalAmount - totalRefunded);
      const updatedAvoirLine: SupplierAvoirLine = {
        ...currentAvoirLine,
        refundedAmount: totalRefunded,
        remainingBalance: newBalance,
        status: newBalance === 0 ? 'Totalement remboursé' : 'Partiellement remboursé',
        refunds: updatedRefunds
      };
      const updatedAvoirLines = avoirLines.map(a => a.id === currentAvoirLine.id ? updatedAvoirLine : a);
      onUpdateSupplier({ ...supplier, avoirLines: updatedAvoirLines });
      setEditingRefundId(null);
      setIsAddRefundOpen(false);
      setRefundAmount(0);
      setRefundNote('');
      return;
    }

    const currentBalance = currentAvoirLine.remainingBalance;
    const amountToApply = Math.min(refundAmount, currentBalance);
    const newBalance = Math.max(0, currentBalance - amountToApply);
    const refundSeq = (currentAvoirLine.refunds?.length || 0) + 1;

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newRefund: AvoirRefund = {
      id: `sref_${Date.now()}`,
      refundNumber: `Remboursement n° ${refundSeq}`,
      date: formattedDate,
      amount: amountToApply,
      remainingBalance: newBalance,
      operator: refundOperator.trim(),
      refundMethod,
      notes: refundNote.trim() || 'Déduit sur facture / Règlement'
    };

    const updatedRefunds = [...(currentAvoirLine.refunds || []), newRefund];
    const newRefundedTotal = currentAvoirLine.refundedAmount + amountToApply;
    const updatedAvoirLine: SupplierAvoirLine = {
      ...currentAvoirLine,
      refundedAmount: newRefundedTotal,
      remainingBalance: newBalance,
      status: newBalance === 0 ? 'Totalement remboursé' : 'Partiellement remboursé',
      refunds: updatedRefunds
    };

    const updatedAvoirLines = avoirLines.map(a => a.id === currentAvoirLine.id ? updatedAvoirLine : a);

    const updatedSupplier: Supplier = {
      ...supplier,
      avoirLines: updatedAvoirLines
    };

    onUpdateSupplier(updatedSupplier);
    setIsAddRefundOpen(false);
    setRefundAmount(0);
    setRefundNote('');
  };

  // Ouvre le formulaire de versement / remboursement en mode modification
  const openEditPayment = (p: CreditPayment) => {
    setEditingPaymentId(p.id);
    setPaymentAmount(p.amount);
    setPaymentOperator(p.operator);
    setPaymentMethod(p.paymentMethod || 'Virement bancaire');
    setPaymentRef(p.reference || '');
    setIsAddPaymentOpen(true);
  };

  const openEditRefund = (r: AvoirRefund) => {
    setEditingRefundId(r.id);
    setRefundAmount(r.amount);
    setRefundOperator(r.operator);
    setRefundMethod(r.refundMethod || 'Déduction sur facture');
    setRefundNote(r.notes || '');
    setIsAddRefundOpen(true);
  };

  // Impression d'un reçu (versement ou remboursement/déduction)
  const printReceipt = (title: string, rows: [string, string][]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { window.print(); return; }
    const html = `<!DOCTYPE html><html><head><title>${title}</title><meta charset="utf-8" />
      <style>
        @page { size: 80mm auto; margin: 8mm; }
        body { font-family: "Courier New", monospace; font-size: 12px; color: #0f172a; margin: 0; padding: 8px; }
        .center { text-align: center; }
        .brand { font-size: 16px; font-weight: 800; letter-spacing: 1px; }
        .title { font-size: 13px; font-weight: 700; text-transform: uppercase; margin: 8px 0; border-top: 1px dashed #334155; border-bottom: 1px dashed #334155; padding: 6px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        td { padding: 3px 0; vertical-align: top; }
        td:last-child { text-align: right; font-weight: 700; }
        .footer { margin-top: 14px; border-top: 1px dashed #334155; padding-top: 8px; font-size: 10px; text-align: center; color: #475569; }
        .sign { display: flex; justify-content: space-between; margin-top: 24px; font-size: 10px; }
      </style></head><body>
      <div class="center"><div class="brand">GESTOCK</div><div>Gestion Commerciale &amp; POS</div></div>
      <div class="title center">${title}</div>
      <table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
      <div class="sign"><span>Signature fournisseur</span><span>Signature caissier</span></div>
      <div class="footer">Document généré le ${new Date().toLocaleString('fr-FR')} — GeStock</div>
      </body></html>`;
    printWindow.document.write(withProfessionalPrintBranding(html, companyConfig, 'receipt'));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handlePrintPayment = (p: CreditPayment, line: SupplierCreditLine) => {
    printReceipt(`Reçu de versement ${p.paymentNumber}`, [
      ['Fournisseur', supplier.name],
      ['Dette', line.creditNumber],
      ['Facture', line.invoiceRef],
      ['Date', p.date],
      ['Montant versé', formatFCFA(p.amount)],
      ['Reste à payer', formatFCFA(p.remainingAmount)],
      ['Mode', p.paymentMethod || '—'],
      ['Référence', p.reference || '—'],
      ['Opérateur', p.operator]
    ]);
  };

  const handlePrintRefund = (r: AvoirRefund, line: SupplierAvoirLine) => {
    printReceipt(`Reçu de déduction ${r.refundNumber}`, [
      ['Fournisseur', supplier.name],
      ['Avoir', line.avoirNumber],
      ['Réf. source', line.sourceRef],
      ['Date', r.date],
      ['Montant', formatFCFA(r.amount)],
      ['Solde restant', formatFCFA(r.remainingBalance)],
      ['Mode', r.refundMethod || '—'],
      ['Opérateur', r.operator]
    ]);
  };

  // Impression de l'ensemble des lignes de la ligne sélectionnée
  const printLinesTable = (title: string, head: string[], rows: string[][], total: [string, string]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { window.print(); return; }
    const html = `<!DOCTYPE html><html><head><title>${title}</title><meta charset="utf-8" />
      <style>
        @page { size: A4; margin: 14mm; }
        body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; font-size: 12px; color: #0f172a; margin: 0; padding: 16px; }
        .brand { font-size: 18px; font-weight: 800; color: #001F3F; }
        .title { font-size: 15px; font-weight: 700; text-transform: uppercase; margin: 14px 0 10px; border-bottom: 2px solid #001F3F; padding-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #001F3F; color: #fff; text-align: left; padding: 7px 8px; font-size: 10px; text-transform: uppercase; }
        td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) td { background: #f8fafc; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }
        .total td { font-weight: 800; border-top: 2px solid #001F3F; border-bottom: none; background: #fff !important; }
        .footer { margin-top: 16px; font-size: 10px; text-align: center; color: #64748b; }
      </style></head><body>
      <div class="brand">GESTOCK</div>
      <div class="title">${title}</div>
      <table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>
        ${rows.map(r => `<tr>${r.map((c, i) => `<td class="${i >= 2 ? 'num' : ''}">${c}</td>`).join('')}</tr>`).join('')}
        <tr class="total"><td colspan="${head.length - 1}">${total[0]}</td><td class="num">${total[1]}</td></tr>
      </tbody></table>
      <div class="footer">Document généré le ${new Date().toLocaleString('fr-FR')} — GeStock</div>
      </body></html>`;
    printWindow.document.write(withProfessionalPrintBranding(html, companyConfig));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handlePrintPaymentsList = (line: SupplierCreditLine) => {
    const payments = line.payments || [];
    if (payments.length === 0) return;
    printLinesTable(
      `Historique des versements — ${line.creditNumber} (${supplier.name})`,
      ['Paiement n°', 'Date et heure', 'Montant', 'Reste à payer', 'Opérateur', 'Mode'],
      payments.map(p => [p.paymentNumber, p.date, formatFCFA(p.amount), formatFCFA(p.remainingAmount), p.operator, p.paymentMethod || '—']),
      ['Total versé', formatFCFA(line.paidAmount)]
    );
  };

  const handlePrintRefundsList = (line: SupplierAvoirLine) => {
    const refunds = line.refunds || [];
    if (refunds.length === 0) return;
    printLinesTable(
      `Historique des déductions — ${line.avoirNumber} (${supplier.name})`,
      ['Remboursement n°', 'Date et heure', 'Montant', 'Solde restant', 'Opérateur', 'Mode'],
      refunds.map(r => [r.refundNumber, r.date, formatFCFA(r.amount), formatFCFA(r.remainingBalance), r.operator, r.refundMethod || '—']),
      ['Total déduit', formatFCFA(line.refundedAmount)]
    );
  };

  // Handle creating a new debt line ("ajoute une dette")
  const handleAddDebtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debtAmount <= 0) return;

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const seq = creditLines.length + 1;

    const newCreditLine: SupplierCreditLine = {
      id: `scrd_${Date.now()}`,
      supplierId: supplier.id,
      creditNumber: `DET-${supplier.name.slice(0, 3).toUpperCase()}-${now.getFullYear()}-${String(seq).padStart(3, '0')}`,
      invoiceRef: debtInvoiceRef.trim() || `FAC-${supplier.name.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      date: formattedDate,
      initialAmount: debtAmount,
      paidAmount: 0,
      remainingAmount: debtAmount,
      dueDate: debtDueDate || undefined,
      status: 'En cours',
      notes: debtNotes.trim() || 'Dette fournisseur / Facture à payer',
      payments: []
    };

    const updatedCreditLines = [newCreditLine, ...creditLines];
    const updatedTotalDebt = updatedCreditLines.reduce((sum, c) => sum + c.remainingAmount, 0);

    const updatedSupplier: Supplier = {
      ...supplier,
      balance: updatedTotalDebt,
      creditLines: updatedCreditLines
    };

    onUpdateSupplier(updatedSupplier);
    setSelectedCreditId(newCreditLine.id);
    setIsAddDebtOpen(false);
    setDebtAmount(0);
    setDebtInvoiceRef('');
    setDebtNotes('');
    setDebtDueDate('');
  };

  // Handle creating a new avoir line ("ajoute un avoir")
  const handleAddAvoirSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAvoirAmount <= 0) return;

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const seq = avoirLines.length + 1;

    const newAvoirLine: SupplierAvoirLine = {
      id: `sav_${Date.now()}`,
      supplierId: supplier.id,
      avoirNumber: `AVF-${supplier.name.slice(0, 3).toUpperCase()}-${now.getFullYear()}-${String(seq).padStart(3, '0')}`,
      sourceRef: newAvoirSourceRef.trim() || `RET-${Math.floor(100 + Math.random() * 900)}`,
      date: formattedDate,
      reason: newAvoirReason.trim() || 'Avoir fournisseur / Ristourne',
      totalAmount: newAvoirAmount,
      refundedAmount: 0,
      remainingBalance: newAvoirAmount,
      status: 'Actif',
      notes: newAvoirNotes.trim() || 'Avoir à déduire ou rembourser par le fournisseur',
      refunds: []
    };

    const updatedAvoirLines = [newAvoirLine, ...avoirLines];

    const updatedSupplier: Supplier = {
      ...supplier,
      avoirLines: updatedAvoirLines
    };

    onUpdateSupplier(updatedSupplier);
    setSelectedAvoirId(newAvoirLine.id);
    setIsAddAvoirLineOpen(false);
    setNewAvoirAmount(0);
    setNewAvoirReason('');
    setNewAvoirSourceRef('');
    setNewAvoirNotes('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-7xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-slate-900 via-[#001F3F] to-blue-950 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-blue-900/40">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shrink-0 shadow-inner">
              <Truck className="w-6 h-6 text-blue-300" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white truncate">
                  {supplier.name}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30">
                  Fournisseur Grossiste
                </span>
              </div>
              <p className="text-xs text-blue-200/80 mt-0.5 truncate flex items-center gap-1.5">
                <span>Interlocuteur: <strong className="text-white font-medium">{supplier.contactPerson}</strong></span>
                <span>•</span>
                <span>{supplier.phone}</span>
              </p>
            </div>
          </div>

          {/* Quick Header Actions: Only the close X button */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Fermer la fiche"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50/80 px-4 sm:px-6 gap-2 sm:gap-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`py-3.5 px-2 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'general'
                ? 'border-[#001F3F] text-[#001F3F]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>Information générale</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('credits')}
            className={`py-3.5 px-2 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'credits'
                ? 'border-[#001F3F] text-[#001F3F]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CreditCard className="w-4 h-4 text-red-600" />
            <span>Ligne de crédit</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              totalBalance > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'
            }`}>
              {creditLines.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('avoirs')}
            className={`py-3.5 px-2 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'avoirs'
                ? 'border-[#001F3F] text-[#001F3F]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-emerald-600" />
            <span>Ligne des avoirs</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              totalAvailableAvoirs > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
            }`}>
              {avoirLines.length}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50/40 space-y-6">
          {/* TAB 1: INFORMATION GÉNÉRALE */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Top KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 uppercase">Crédit / Dette Fournisseur</div>
                    <div className="text-xl font-bold text-red-700">
                      {formatFCFA(totalBalance)}
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 uppercase">Avoirs Disponibles</div>
                    <div className="text-xl font-bold text-emerald-700">
                      {formatFCFA(totalAvailableAvoirs)}
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 uppercase">Total Achats Effectués</div>
                    <div className="text-xl font-bold text-[#001F3F]">
                      {formatFCFA(supplier.totalPurchases || 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* General Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Contact Card */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span>Coordonnées & Interlocuteur</span>
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                        <Truck className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-slate-400 text-[10px]">Société / Raison Sociale</div>
                        <div className="font-bold text-slate-800 text-sm">{supplier.name}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                        <Building2 className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-slate-400 text-[10px]">Commercial / Responsable de compte</div>
                        <div className="font-semibold text-slate-800">{supplier.contactPerson}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                        <Phone className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <div className="text-slate-400 text-[10px]">Téléphone direct</div>
                        <div className="font-semibold text-slate-800 font-mono">{supplier.phone}</div>
                      </div>
                    </div>

                    {supplier.email && (
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                          <Mail className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-slate-400 text-[10px]">Email professionnel</div>
                          <div className="font-semibold text-slate-800">{supplier.email}</div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                        <MapPin className="w-4 h-4 text-red-500" />
                      </div>
                      <div>
                        <div className="text-slate-400 text-[10px]">Adresse / Dépôt de livraison</div>
                        <div className="font-semibold text-slate-800">{supplier.address}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Categories & Activity Card */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Tag className="w-4 h-4 text-blue-600" />
                    <span>Catégories & Activités Fournies</span>
                  </h3>

                  <div className="space-y-4 text-xs">
                    <div>
                      <div className="text-slate-500 text-[11px] mb-2 font-medium">Secteurs de produits livrés :</div>
                      <div className="flex flex-wrap gap-2">
                        {supplier.categories.map((cat, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200/80 font-bold text-xs flex items-center gap-1.5"
                          >
                            <Tag className="w-3.5 h-3.5 text-blue-600" />
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                      <div className="font-bold text-slate-800 text-xs">Aperçu des conditions d'achat :</div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Ce fournisseur est enregistré dans le catalogue grossiste. Vous pouvez suivre l'ensemble des factures d'achat en crédit dans l'onglet <strong>Ligne de crédit</strong> avec chaque versement opéré, ainsi que les retours et ristournes dans <strong>Ligne des avoirs</strong>.
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2">
                      <span className="text-slate-500">Factures de crédit actives :</span>
                      <span className="font-bold text-slate-800">{creditLines.filter(c => c.status !== 'Soldé').length} facture(s)</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Avoirs fournisseurs actifs :</span>
                      <span className="font-bold text-slate-800">{avoirLines.filter(a => a.status === 'Actif').length} avoir(s)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LIGNE DE CRÉDIT & HISTORIQUE DE PAIEMENT */}
          {activeTab === 'credits' && (
            <div className="space-y-6">
              {/* Header of Tab: Title, total and button "Ajouter une dette" */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div>
                  <h3 className="text-sm font-bold text-[#001F3F] flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-red-600" />
                    <span>Ligne de crédit</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Sélectionnez une facture de crédit ci-dessous pour voir l'historique détaillé des versements effectués au fournisseur.
                  </p>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">Reste à payer</span>
                    <span className="font-bold text-red-700 text-sm font-mono">{formatFCFA(totalBalance)}</span>
                  </div>

                  {/* Bouton: créer une ligne de crédit renommé "Ajouter une dette" */}
                  <button
                    type="button"
                    onClick={() => setIsAddDebtOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ajouter une dette</span>
                  </button>
                </div>
              </div>

              {creditLines.length === 0 ? (
                <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">Aucune dette envers ce fournisseur</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Toutes les factures d'achat auprès de ce fournisseur sont entièrement réglées.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddDebtOpen(true)}
                      className="px-4 py-2 rounded-xl bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs inline-flex items-center gap-2 shadow-sm transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Ajouter une dette</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Credit Lines Selector */}
                  <div className="lg:col-span-5 space-y-3">
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                      <span>Factures de crédit ({creditLines.length})</span>
                      <span className="text-[11px] font-normal text-slate-500">Cliquer pour inspecter</span>
                    </div>

                    <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                      {creditLines.map((line) => {
                        const isSelected = currentCreditLine?.id === line.id;
                        const isPaid = line.remainingAmount === 0;

                        return (
                          <div
                            key={line.id}
                            onClick={() => setSelectedCreditId(line.id)}
                            className={`p-4 rounded-xl border text-xs cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-blue-50/60 border-blue-500 shadow-xs ring-1 ring-blue-500/30'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-bold text-slate-900 font-mono text-sm block">
                                  {line.creditNumber}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  Facture: <strong>{line.invoiceRef}</strong>
                                </span>
                              </div>

                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isPaid
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-red-100 text-red-800 border border-red-200'
                              }`}>
                                {line.status}
                              </span>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                              <div>
                                <span className="text-slate-400 block text-[10px]">Reste à verser</span>
                                <span className={`font-bold font-mono ${isPaid ? 'text-emerald-700' : 'text-red-700'}`}>
                                  {formatFCFA(line.remainingAmount)}
                                </span>
                              </div>

                              <div className="text-right">
                                <span className="text-slate-400 block text-[10px]">Versements effectués</span>
                                <span className="font-semibold text-slate-700">
                                  {(line.payments || []).length} versement(s)
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Column: Selected Credit Line Detail & Payment History */}
                  <div className="lg:col-span-7 space-y-4">
                    {currentCreditLine ? (
                      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-5">
                        {/* Selected Line Summary Card */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-slate-900 text-base font-mono">
                                  {currentCreditLine.creditNumber}
                                </h4>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  currentCreditLine.remainingAmount === 0
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {currentCreditLine.status}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Facture fournisseur / Bon de commande : <strong className="text-slate-700">{currentCreditLine.invoiceRef}</strong>
                              </p>
                            </div>

                            {/* Action Button: Enregistrer un versement */}
                            {currentCreditLine.remainingAmount > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPaymentId(null);
                                  setPaymentAmount(currentCreditLine.remainingAmount);
                                  setIsAddPaymentOpen(true);
                                }}
                                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors self-start sm:self-auto"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Régler un versement</span>
                              </button>
                            )}
                          </div>

                          {/* Amounts Breakdown */}
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-xs">
                            <div>
                              <span className="text-slate-400 block text-[10px]">Montant initial</span>
                              <span className="font-bold text-slate-800 font-mono">
                                {formatFCFA(currentCreditLine.initialAmount)}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Déjà versé</span>
                              <span className="font-bold text-emerald-700 font-mono">
                                {formatFCFA(currentCreditLine.paidAmount)}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Reste à payer</span>
                              <span className="font-bold text-red-700 font-mono">
                                {formatFCFA(currentCreditLine.remainingAmount)}
                              </span>
                            </div>
                          </div>

                          {currentCreditLine.notes && (
                            <div className="text-[11px] text-slate-500 italic bg-white p-2 rounded border border-slate-100">
                              Note : {currentCreditLine.notes}
                            </div>
                          )}
                        </div>

                        {/* Historical Payments Section:
                            "quand on sélectionne une ligne de crédit elle affiche les historique de versement 
                            que nous avons fait au fournisseur: Paiement n°, Date et heure, montant, Reste à payer, celui qui a faite la saisie (opérateur)"
                        */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                              <History className="w-4 h-4 text-blue-600" />
                              <span>Historique des versements faits au fournisseur</span>
                            </h4>
                            <div className="flex items-center gap-2">
                              {(currentCreditLine.payments || []).length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handlePrintPaymentsList(currentCreditLine)}
                                  title="Imprimer l'ensemble des versements de cette ligne"
                                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-[11px] flex items-center gap-1 transition-colors"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>Imprimer la liste</span>
                                </button>
                              )}
                              <span className="text-xs text-slate-500">
                                {(currentCreditLine.payments || []).length} versement(s) enregistré(s)
                              </span>
                            </div>
                          </div>

                          {(!currentCreditLine.payments || currentCreditLine.payments.length === 0) ? (
                            <div className="bg-slate-50 p-6 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                              Aucun versement n'a encore été enregistré pour cette dette.
                            </div>
                          ) : (
                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead>
                                    <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200 font-bold uppercase text-[10px] tracking-wider">
                                      <th className="py-2.5 px-3">Paiement n°</th>
                                      <th className="py-2.5 px-3">Date et heure</th>
                                      <th className="py-2.5 px-3 text-right">Montant</th>
                                      <th className="py-2.5 px-3 text-right">Reste à payer</th>
                                      <th className="py-2.5 px-3">Opérateur</th>
                                      <th className="py-2.5 px-3">Mode</th>
                                      <th className="py-2.5 px-3 text-right">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 bg-white">
                                    {currentCreditLine.payments.map((pmt, pIdx) => (
                                      <tr key={pmt.id || pIdx} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                                          {pmt.paymentNumber}
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap font-mono text-[11px]">
                                          {pmt.date}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700 font-mono whitespace-nowrap">
                                          {formatFCFA(pmt.amount)}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-bold text-slate-700 font-mono whitespace-nowrap">
                                          {formatFCFA(pmt.remainingAmount)}
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-800 font-medium whitespace-nowrap">
                                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px]">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                            {pmt.operator}
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                                          {pmt.paymentMethod || 'Virement'}
                                        </td>
                                        <td className="py-2.5 px-3">
                                          <div className="flex items-center justify-end gap-1">
                                            {currentCreditLine.status !== 'Soldé' && (
                                              <button
                                                type="button"
                                                onClick={() => openEditPayment(pmt)}
                                                title="Modifier ce versement"
                                                className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-colors"
                                              >
                                                <Edit3 className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() => handlePrintPayment(pmt, currentCreditLine)}
                                              title="Imprimer le reçu de versement"
                                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors"
                                            >
                                              <Printer className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                        Sélectionnez une ligne de crédit à gauche pour afficher son détail.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LIGNE DES AVOIRS & HISTORIQUE DE REMBOURSEMENT */}
          {activeTab === 'avoirs' && (
            <div className="space-y-6">
              {/* Header of Tab: Title, total and button "Ajouter un avoir" */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div>
                  <h3 className="text-sm font-bold text-[#001F3F] flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-emerald-600" />
                    <span>Ligne des avoirs</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Sélectionnez un avoir fournisseur ci-dessous pour voir l'historique de déduction ou remboursement obtenu.
                  </p>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">Solde Avoirs Restant</span>
                    <span className="font-bold text-emerald-700 text-sm font-mono">{formatFCFA(totalAvailableAvoirs)}</span>
                  </div>

                  {/* Bouton: créer une ligne des avoirs renommé "Ajouter un avoir" */}
                  <button
                    type="button"
                    onClick={() => setIsAddAvoirLineOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ajouter un avoir</span>
                  </button>
                </div>
              </div>

              {avoirLines.length === 0 ? (
                <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <RotateCcw className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">Aucun avoir enregistré</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Aucun avoir pour retour de marchandises ou ristourne n'est actuellement ouvert auprès de ce fournisseur.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddAvoirLineOpen(true)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-2 shadow-sm transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Ajouter un avoir</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Avoir Lines Selector */}
                  <div className="lg:col-span-5 space-y-3">
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                      <span>Lignes d'avoirs ({avoirLines.length})</span>
                      <span className="text-[11px] font-normal text-slate-500">Cliquer pour inspecter</span>
                    </div>

                    <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                      {avoirLines.map((avoir) => {
                        const isSelected = currentAvoirLine?.id === avoir.id;
                        const isFullyRefunded = avoir.remainingBalance === 0;

                        return (
                          <div
                            key={avoir.id}
                            onClick={() => setSelectedAvoirId(avoir.id)}
                            className={`p-4 rounded-xl border text-xs cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-emerald-50/60 border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-bold text-slate-900 font-mono text-sm block">
                                  {avoir.avoirNumber}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  Réf: <strong>{avoir.sourceRef}</strong>
                                </span>
                              </div>

                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isFullyRefunded
                                  ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}>
                                {avoir.status}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-600 mt-2 line-clamp-1 italic">
                              {avoir.reason}
                            </p>

                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                              <div>
                                <span className="text-slate-400 block text-[10px]">Solde disponible</span>
                                <span className={`font-bold font-mono ${isFullyRefunded ? 'text-slate-400' : 'text-emerald-700'}`}>
                                  {formatFCFA(avoir.remainingBalance)}
                                </span>
                              </div>

                              <div className="text-right">
                                <span className="text-slate-400 block text-[10px]">Remboursements</span>
                                <span className="font-semibold text-slate-700">
                                  {(avoir.refunds || []).length} opération(s)
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Column: Selected Avoir Line Detail & Refund History */}
                  <div className="lg:col-span-7 space-y-4">
                    {currentAvoirLine ? (
                      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-5">
                        {/* Selected Line Summary Card */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-slate-900 text-base font-mono">
                                  {currentAvoirLine.avoirNumber}
                                </h4>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  currentAvoirLine.remainingBalance === 0
                                    ? 'bg-slate-200 text-slate-700'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {currentAvoirLine.status}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Pièce d'origine : <strong className="text-slate-700">{currentAvoirLine.sourceRef}</strong>
                              </p>
                            </div>

                            {/* Action Button: Enregistrer une déduction / remboursement */}
                            {currentAvoirLine.remainingBalance > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRefundId(null);
                                  setRefundAmount(currentAvoirLine.remainingBalance);
                                  setIsAddRefundOpen(true);
                                }}
                                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors self-start sm:self-auto"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Déduire / Rembourser</span>
                              </button>
                            )}
                          </div>

                          <div className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
                            <strong>Motif :</strong> {currentAvoirLine.reason}
                          </div>

                          {/* Amounts Breakdown */}
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-xs">
                            <div>
                              <span className="text-slate-400 block text-[10px]">Montant initial de l'avoir</span>
                              <span className="font-bold text-slate-800 font-mono">
                                {formatFCFA(currentAvoirLine.totalAmount)}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Déjà déduit</span>
                              <span className="font-bold text-slate-700 font-mono">
                                {formatFCFA(currentAvoirLine.refundedAmount)}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Solde disponible</span>
                              <span className="font-bold text-emerald-700 font-mono">
                                {formatFCFA(currentAvoirLine.remainingBalance)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Historical Refunds Section:
                            "Ligne des avoirs suivi de l'historique de remboursement"
                        */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                              <History className="w-4 h-4 text-emerald-600" />
                              <span>Historique des déductions & remboursements</span>
                            </h4>
                            <div className="flex items-center gap-2">
                              {(currentAvoirLine.refunds || []).length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handlePrintRefundsList(currentAvoirLine)}
                                  title="Imprimer l'ensemble des déductions de cette ligne"
                                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-[11px] flex items-center gap-1 transition-colors"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>Imprimer la liste</span>
                                </button>
                              )}
                              <span className="text-xs text-slate-500">
                                {(currentAvoirLine.refunds || []).length} opération(s)
                              </span>
                            </div>
                          </div>

                          {(!currentAvoirLine.refunds || currentAvoirLine.refunds.length === 0) ? (
                            <div className="bg-slate-50 p-6 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                              Aucun remboursement ou déduction n'a encore été opéré sur cet avoir.
                            </div>
                          ) : (
                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead>
                                    <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200 font-bold uppercase text-[10px] tracking-wider">
                                      <th className="py-2.5 px-3">Remboursement n°</th>
                                      <th className="py-2.5 px-3">Date et heure</th>
                                      <th className="py-2.5 px-3 text-right">Montant</th>
                                      <th className="py-2.5 px-3 text-right">Solde restant</th>
                                      <th className="py-2.5 px-3">Opérateur</th>
                                      <th className="py-2.5 px-3">Mode</th>
                                      <th className="py-2.5 px-3 text-right">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 bg-white">
                                    {currentAvoirLine.refunds.map((ref, rIdx) => (
                                      <tr key={ref.id || rIdx} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                                          {ref.refundNumber}
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap font-mono text-[11px]">
                                          {ref.date}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700 font-mono whitespace-nowrap">
                                          {formatFCFA(ref.amount)}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-bold text-slate-700 font-mono whitespace-nowrap">
                                          {formatFCFA(ref.remainingBalance)}
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-800 font-medium whitespace-nowrap">
                                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px]">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                            {ref.operator}
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                                          {ref.refundMethod || 'Déduction'}
                                        </td>
                                        <td className="py-2.5 px-3">
                                          <div className="flex items-center justify-end gap-1">
                                            {currentAvoirLine.status !== 'Totalement remboursé' && (
                                              <button
                                                type="button"
                                                onClick={() => openEditRefund(ref)}
                                                title="Modifier ce remboursement"
                                                className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-colors"
                                              >
                                                <Edit3 className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() => handlePrintRefund(ref, currentAvoirLine)}
                                              title="Imprimer le reçu de déduction"
                                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors"
                                            >
                                              <Printer className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                        Sélectionnez un avoir à gauche pour afficher son détail.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer: Discreet status line, NO Fermer or Modifier buttons! */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-xs text-slate-500">
          <div>
            Fiche fournisseur certifiée • Réf: <span className="font-mono font-semibold text-slate-700">{supplier.id}</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Société {supplier.name} • Contact direct: {supplier.contactPerson}
          </div>
        </div>

        {/* SUB-MODAL 1: Ajouter une dette ("ajoute une dette") */}
        {isAddDebtOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
              <div className="p-4 bg-[#001F3F] text-white flex items-center justify-between">
                <h4 className="font-bold text-sm flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-300" />
                  <span>Ajouter une dette</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAddDebtOpen(false)}
                  className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddDebtSubmit} className="p-5 space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Référence Facture Fournisseur / Bon de commande
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: FAC-SAN-9982"
                    value={debtInvoiceRef}
                    onChange={(e) => setDebtInvoiceRef(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Montant de la dette (FCFA)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={debtAmount || ''}
                    onChange={(e) => setDebtAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 font-bold font-mono text-base"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Date d'échéance de paiement (optionnel)
                  </label>
                  <input
                    type="date"
                    value={debtDueDate}
                    onChange={(e) => setDebtDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Description / Notes sur la dette
                  </label>
                  <textarea
                    rows={2}
                    value={debtNotes}
                    onChange={(e) => setDebtNotes(e.target.value)}
                    placeholder="Articles livrés, conditions négociées..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddDebtOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#001F3F] hover:bg-blue-900 text-white font-bold flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Créer la dette</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SUB-MODAL 2: Ajouter un versement sur la ligne de dette */}
        {isAddPaymentOpen && currentCreditLine && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
              <div className="p-4 bg-emerald-700 text-white flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    <span>{editingPayment ? `Modifier le versement ${editingPayment.paymentNumber}` : 'Régler un versement au fournisseur'}</span>
                  </h4>
                  <p className="text-[11px] text-emerald-100 mt-0.5">
                    Sur la dette {currentCreditLine.creditNumber}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setEditingPaymentId(null); setIsAddPaymentOpen(false); }}
                  className="p-1 rounded-lg text-slate-200 hover:text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddPaymentSubmit} className="p-5 space-y-4 text-xs">
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 flex justify-between items-center">
                  <span className="text-slate-600">Reste actuel à payer :</span>
                  <span className="font-bold text-emerald-800 text-sm font-mono">
                    {formatFCFA(currentCreditLine.remainingAmount)}
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Montant du versement (FCFA)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={editingPayment ? currentCreditLine.remainingAmount + editingPayment.amount : currentCreditLine.remainingAmount}
                    value={paymentAmount || ''}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500 font-bold font-mono text-base"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Opérateur (Celui qui fait la saisie)
                  </label>
                  <input
                    type="text"
                    required
                    value={paymentOperator}
                    onChange={(e) => setPaymentOperator(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Mode de règlement</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Virement bancaire">Virement bancaire</option>
                      <option value="Chèque">Chèque</option>
                      <option value="Espèces">Espèces</option>
                      <option value="Mobile Money">Mobile Money</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">N° Référence / Chèque</label>
                    <input
                      type="text"
                      placeholder="ex: VIR-9901"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setEditingPaymentId(null); setIsAddPaymentOpen(false); }}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{editingPayment ? 'Enregistrer les modifications' : 'Valider le versement'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SUB-MODAL 3: Ajouter un avoir ("ajoute un avoir") */}
        {isAddAvoirLineOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
              <div className="p-4 bg-emerald-800 text-white flex items-center justify-between">
                <h4 className="font-bold text-sm flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" />
                  <span>Ajouter un avoir fournisseur</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAddAvoirLineOpen(false)}
                  className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddAvoirSubmit} className="p-5 space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Référence Pièce / Bon de retour
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: RET-FOUR-018"
                    value={newAvoirSourceRef}
                    onChange={(e) => setNewAvoirSourceRef(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Montant de l'avoir (FCFA)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newAvoirAmount || ''}
                    onChange={(e) => setNewAvoirAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500 font-bold font-mono text-base"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Motif de l'avoir
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Retour marchandises défectueuses, ristourne..."
                    value={newAvoirReason}
                    onChange={(e) => setNewAvoirReason(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Notes complémentaires
                  </label>
                  <textarea
                    rows={2}
                    value={newAvoirNotes}
                    onChange={(e) => setNewAvoirNotes(e.target.value)}
                    placeholder="Précisions sur la déduction à appliquer..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddAvoirLineOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Créer l'avoir</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SUB-MODAL 4: Enregistrer un remboursement ou déduction sur l'avoir */}
        {isAddRefundOpen && currentAvoirLine && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
              <div className="p-4 bg-emerald-800 text-white flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    <RotateCcw className="w-4 h-4" />
                    <span>{editingRefund ? `Modifier le remboursement ${editingRefund.refundNumber}` : "Déduire ou rembourser l'avoir"}</span>
                  </h4>
                  <p className="text-[11px] text-emerald-200 mt-0.5">
                    Avoir {currentAvoirLine.avoirNumber}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setEditingRefundId(null); setIsAddRefundOpen(false); }}
                  className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddRefundSubmit} className="p-5 space-y-4 text-xs">
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 flex justify-between items-center">
                  <span className="text-slate-600">Solde disponible sur l'avoir :</span>
                  <span className="font-bold text-emerald-800 text-sm font-mono">
                    {formatFCFA(currentAvoirLine.remainingBalance)}
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Montant déduit / remboursé (FCFA)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={editingRefund ? currentAvoirLine.remainingBalance + editingRefund.amount : currentAvoirLine.remainingBalance}
                    value={refundAmount || ''}
                    onChange={(e) => setRefundAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500 font-bold font-mono text-base"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Opérateur (Celui qui fait la saisie)
                  </label>
                  <input
                    type="text"
                    required
                    value={refundOperator}
                    onChange={(e) => setRefundOperator(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mode d'imputation
                  </label>
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Déduction sur facture">Déduction sur facture / Bon de commande</option>
                    <option value="Virement reçu">Virement bancaire reçu</option>
                    <option value="Espèces remboursées">Espèces remboursées</option>
                    <option value="Chèque reçu">Chèque de remboursement</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Notes / Référence de déduction
                  </label>
                  <input
                    type="text"
                    value={refundNote}
                    onChange={(e) => setRefundNote(e.target.value)}
                    placeholder="ex: Imputé sur facture FAC-SAN-899"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setEditingRefundId(null); setIsAddRefundOpen(false); }}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{editingRefund ? 'Enregistrer les modifications' : "Valider l'opération"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
