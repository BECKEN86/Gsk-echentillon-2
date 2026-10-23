import React, { useState } from 'react';
import {
  X,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  Edit3,
  CreditCard,
  History,
  Plus,
  CheckCircle2,
  UserCheck,
  RotateCcw,
  Receipt,
  Printer,
  } from 'lucide-react';
import { CompanyConfig, Client, ClientCreditLine, ClientAvoirLine, CreditPayment, AvoirRefund } from '../../types';
import { formatFCFA } from '../../data/initialData';
import { withProfessionalPrintBranding } from '../../utils/professionalPrint';

interface ClientDetailModalProps {
  client: Client | null;
  companyConfig?: CompanyConfig | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateClient: (updatedClient: Client) => void;
}

export const ClientDetailModal: React.FC<ClientDetailModalProps> = ({
  client,
  companyConfig,
  isOpen,
  onClose,
  onUpdateClient
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
  const [paymentMethod, setPaymentMethod] = useState<string>('Espèces');
  const [paymentRef, setPaymentRef] = useState<string>('');

  // Sub-modal for adding refund to avoir line
  const [isAddRefundOpen, setIsAddRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundOperator, setRefundOperator] = useState<string>('');
  const [refundMethod, setRefundMethod] = useState<string>('Espèces');
  const [refundNote, setRefundNote] = useState<string>('');

  // Sub-modal for creating a new debt / credit line ("ajoute une dette")
  const [isAddDebtOpen, setIsAddDebtOpen] = useState(false);
  const [debtAmount, setDebtAmount] = useState<number>(0);
  const [debtInvoiceRef, setDebtInvoiceRef] = useState<string>('');
  const [debtNotes, setDebtNotes] = useState<string>('');
  const [debtDate, setDebtDate] = useState<string>('');

  // Sub-modal for creating a new avoir line ("ajoute un avoir")
  const [isAddAvoirLineOpen, setIsAddAvoirLineOpen] = useState(false);
  const [newAvoirAmount, setNewAvoirAmount] = useState<number>(0);
  const [newAvoirReason, setNewAvoirReason] = useState<string>('');
  const [newAvoirSourceRef, setNewAvoirSourceRef] = useState<string>('');
  const [newAvoirDate, setNewAvoirDate] = useState<string>('');

  // Edit mode: versement / remboursement en cours de modification
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editingRefundId, setEditingRefundId] = useState<string | null>(null);

  if (!isOpen || !client) return null;

  const creditLines = client.creditLines || [];
  const avoirLines = client.avoirLines || [];

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
  const totalCreditBalance = creditLines.length > 0 ? totalDebtFromLines : client.creditBalance;
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
      const updatedCreditLine: ClientCreditLine = {
        ...currentCreditLine,
        paidAmount: totalPaid,
        remainingAmount: newRemaining,
        status: newRemaining === 0 ? 'Soldé' : 'En cours',
        payments: updatedPayments
      };
      const updatedCreditLines = creditLines.map(c => c.id === currentCreditLine.id ? updatedCreditLine : c);
      onUpdateClient({
        ...client,
        creditBalance: updatedCreditLines.reduce((sum, c) => sum + c.remainingAmount, 0),
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
      id: `pay_${Date.now()}`,
      paymentNumber: `Paiement n° ${paymentSeq}`,
      date: formattedDate,
      amount: amountToApply,
      remainingAmount: newRemaining,
      operator: paymentOperator.trim() || 'Opérateur Caisse',
      paymentMethod,
      reference: paymentRef.trim() || `REC-${Math.floor(1000 + Math.random() * 9000)}`
    };

    const updatedPayments = [...(currentCreditLine.payments || []), newPayment];
    const updatedCreditLine: ClientCreditLine = {
      ...currentCreditLine,
      paidAmount: currentCreditLine.paidAmount + amountToApply,
      remainingAmount: newRemaining,
      status: newRemaining === 0 ? 'Soldé' : 'En cours',
      payments: updatedPayments
    };

    const updatedCreditLines = creditLines.map(c => c.id === currentCreditLine.id ? updatedCreditLine : c);
    const updatedTotalDebt = updatedCreditLines.reduce((sum, c) => sum + c.remainingAmount, 0);

    const updatedClient: Client = {
      ...client,
      creditBalance: updatedTotalDebt,
      creditLines: updatedCreditLines
    };

    onUpdateClient(updatedClient);
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
      const updatedAvoirLine: ClientAvoirLine = {
        ...currentAvoirLine,
        refundedAmount: totalRefunded,
        remainingBalance: newBalance,
        status: newBalance === 0 ? 'Totalement remboursé' : 'Partiellement remboursé',
        refunds: updatedRefunds
      };
      const updatedAvoirLines = avoirLines.map(a => a.id === currentAvoirLine.id ? updatedAvoirLine : a);
      onUpdateClient({ ...client, avoirLines: updatedAvoirLines });
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
      id: `ref_${Date.now()}`,
      refundNumber: `Remboursement n° ${refundSeq}`,
      date: formattedDate,
      amount: amountToApply,
      remainingBalance: newBalance,
      operator: refundOperator.trim() || 'Opérateur Caisse',
      refundMethod,
      notes: refundNote.trim()
    };

    const updatedRefunds = [...(currentAvoirLine.refunds || []), newRefund];
    const updatedAvoirLine: ClientAvoirLine = {
      ...currentAvoirLine,
      refundedAmount: currentAvoirLine.refundedAmount + amountToApply,
      remainingBalance: newBalance,
      status: newBalance === 0 ? 'Totalement remboursé' : 'Partiellement remboursé',
      refunds: updatedRefunds
    };

    const updatedAvoirLines = avoirLines.map(a => a.id === currentAvoirLine.id ? updatedAvoirLine : a);

    const updatedClient: Client = {
      ...client,
      avoirLines: updatedAvoirLines
    };

    onUpdateClient(updatedClient);
    setIsAddRefundOpen(false);
    setRefundAmount(0);
    setRefundNote('');
  };

  // Handle creating a new debt line ("ajoute une dette")
  const handleAddDebtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debtAmount <= 0) return;

    const now = new Date();
    const formattedDate = debtDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const debtSeq = String(Date.now()).slice(-4);

    const newCreditLine: ClientCreditLine = {
      id: `crd_${Date.now()}`,
      clientId: client.id,
      creditNumber: `CRD-${debtSeq}`,
      invoiceRef: debtInvoiceRef.trim() || `FAC-${debtSeq}`,
      date: formattedDate,
      initialAmount: Number(debtAmount),
      paidAmount: 0,
      remainingAmount: Number(debtAmount),
      status: 'En cours',
      notes: debtNotes.trim() || 'Achat à crédit',
      payments: []
    };

    const updatedCreditLines = [newCreditLine, ...creditLines];
    const updatedTotalDebt = updatedCreditLines.reduce((sum, c) => sum + c.remainingAmount, 0);

    const updatedClient: Client = {
      ...client,
      creditBalance: updatedTotalDebt,
      creditLines: updatedCreditLines
    };

    onUpdateClient(updatedClient);
    setSelectedCreditId(newCreditLine.id);
    setIsAddDebtOpen(false);
    setDebtAmount(0);
    setDebtInvoiceRef('');
    setDebtNotes('');
    setDebtDate('');
  };

  // Ouvre le formulaire de versement / remboursement en mode modification
  const openEditPayment = (p: CreditPayment) => {
    setEditingPaymentId(p.id);
    setPaymentAmount(p.amount);
    setPaymentOperator(p.operator);
    setPaymentMethod(p.paymentMethod || 'Espèces');
    setPaymentRef(p.reference || '');
    setIsAddPaymentOpen(true);
  };

  const openEditRefund = (r: AvoirRefund) => {
    setEditingRefundId(r.id);
    setRefundAmount(r.amount);
    setRefundOperator(r.operator);
    setRefundMethod(r.refundMethod || 'Espèces');
    setRefundNote(r.notes || '');
    setIsAddRefundOpen(true);
  };

  // Impression d'un reçu (versement ou remboursement)
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
      <div class="sign"><span>Signature client</span><span>Signature caissier</span></div>
      <div class="footer">Document généré le ${new Date().toLocaleString('fr-FR')} — GeStock</div>
      </body></html>`;
    printWindow.document.write(withProfessionalPrintBranding(html, companyConfig, 'receipt'));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handlePrintPayment = (p: CreditPayment, line: ClientCreditLine) => {
    printReceipt(`Reçu de versement ${p.paymentNumber}`, [
      ['Client', client.name],
      ['Ligne de crédit', line.creditNumber],
      ['Facture', line.invoiceRef],
      ['Date', p.date],
      ['Montant versé', formatFCFA(p.amount)],
      ['Reste à payer', formatFCFA(p.remainingAmount)],
      ['Mode', p.paymentMethod || '—'],
      ['Référence', p.reference || '—'],
      ['Opérateur', p.operator]
    ]);
  };

  const handlePrintRefund = (r: AvoirRefund, line: ClientAvoirLine) => {
    printReceipt(`Reçu de remboursement ${r.refundNumber}`, [
      ['Client', client.name],
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

  const handlePrintPaymentsList = (line: ClientCreditLine) => {
    const payments = line.payments || [];
    if (payments.length === 0) return;
    printLinesTable(
      `Historique des versements — ${line.creditNumber} (${client.name})`,
      ['Paiement n°', 'Date et heure', 'Montant', 'Reste à payer', 'Opérateur'],
      payments.map(p => [p.paymentNumber, p.date, formatFCFA(p.amount), formatFCFA(p.remainingAmount), p.operator]),
      ['Total versé', formatFCFA(line.paidAmount)]
    );
  };

  const handlePrintRefundsList = (line: ClientAvoirLine) => {
    const refunds = line.refunds || [];
    if (refunds.length === 0) return;
    printLinesTable(
      `Historique des remboursements — ${line.avoirNumber} (${client.name})`,
      ['Remboursement n°', 'Date et heure', 'Montant', 'Solde restant', 'Opérateur'],
      refunds.map(r => [r.refundNumber, r.date, formatFCFA(r.amount), formatFCFA(r.remainingBalance), r.operator]),
      ['Total remboursé', formatFCFA(line.refundedAmount)]
    );
  };

  // Handle creating a new avoir line ("ajoute un avoir")
  const handleAddAvoirSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAvoirAmount <= 0) return;

    const now = new Date();
    const formattedDate = newAvoirDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const avrSeq = String(Date.now()).slice(-4);

    const newAvoirLine: ClientAvoirLine = {
      id: `avr_${Date.now()}`,
      clientId: client.id,
      avoirNumber: `AVR-${avrSeq}`,
      sourceRef: newAvoirSourceRef.trim() || `CMD-${avrSeq}`,
      date: formattedDate,
      totalAmount: Number(newAvoirAmount),
      refundedAmount: 0,
      remainingBalance: Number(newAvoirAmount),
      status: 'Actif',
      reason: newAvoirReason.trim() || 'Avoir accordé',
      refunds: []
    };

    const updatedAvoirLines = [newAvoirLine, ...avoirLines];

    const updatedClient: Client = {
      ...client,
      avoirLines: updatedAvoirLines
    };

    onUpdateClient(updatedClient);
    setSelectedAvoirId(newAvoirLine.id);
    setIsAddAvoirLineOpen(false);
    setNewAvoirAmount(0);
    setNewAvoirReason('');
    setNewAvoirSourceRef('');
    setNewAvoirDate('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div 
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-6xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
              client.type === 'Entreprise' ? 'bg-[#001F3F]' : 'bg-blue-600'
            }`}>
              {client.type === 'Entreprise' ? <Building2 className="w-6 h-6" /> : <User className="w-6 h-6" />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[#001F3F] leading-tight">
                  {client.name}
                </h2>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                  {client.type}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-blue-600" />
                  {client.phone}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {client.address}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-5 pt-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`pb-2.5 px-3 font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'general'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Information générale</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('credits')}
            className={`pb-2.5 px-3 font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'credits'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Ligne de crédit ({creditLines.length})</span>
            {totalCreditBalance > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">
                {formatFCFA(totalCreditBalance)}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('avoirs')}
            className={`pb-2.5 px-3 font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'avoirs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Ligne des avoirs ({avoirLines.length})</span>
            {totalAvailableAvoirs > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                {formatFCFA(totalAvailableAvoirs)}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-5 max-h-[70vh] overflow-y-auto text-xs text-slate-700">
          {/* TAB 1: INFORMATION GÉNÉRALE */}
          {activeTab === 'general' && (
            <div className="space-y-5">
              {/* Financial KPI Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className={`p-4 rounded-xl border ${
                  totalCreditBalance > 0 
                    ? 'bg-red-50/70 border-red-200 text-red-900' 
                    : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                }`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                    Solde Dû (Crédit en cours)
                  </span>
                  <span className={`text-2xl font-black mt-1 block ${totalCreditBalance > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {formatFCFA(totalCreditBalance)}
                  </span>
                  <span className="text-[11px] opacity-80 mt-1 block">
                    {totalCreditBalance > 0 ? 'Dette à recouvrer' : 'Compte client sain et à jour'}
                  </span>
                </div>

                <div className="p-4 rounded-xl border bg-emerald-50/60 border-emerald-200 text-emerald-900">
                  <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                    Avoirs disponibles
                  </span>
                  <span className="text-2xl font-black text-emerald-700 mt-1 block">
                    {formatFCFA(totalAvailableAvoirs)}
                  </span>
                  <span className="text-[11px] text-emerald-700 opacity-80 mt-1 block">
                    {avoirLines.length} ligne(s) d'avoir enregistrée(s)
                  </span>
                </div>

                <div className="p-4 rounded-xl border bg-slate-50 border-slate-200 text-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Cumul des Achats
                  </span>
                  <span className="text-2xl font-black text-[#001F3F] mt-1 block">
                    {formatFCFA(client.totalPurchases || 0)}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Chiffre d'affaires historique
                  </span>
                </div>
              </div>

              {/* Client Profile Details Card */}
              <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-slate-800 text-xs flex items-center gap-2 border-b border-slate-200 pb-2">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  <span>Coordonnées & Informations du Client</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-slate-400 block">Nom complet / Raison Sociale</span>
                    <strong className="text-slate-800 text-sm block mt-0.5">{client.name}</strong>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold uppercase text-slate-400 block">Type de Client</span>
                    <span className="inline-block mt-0.5 font-bold text-blue-900 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                      {client.type}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold uppercase text-slate-400 block">Téléphone</span>
                    <a href={`tel:${client.phone}`} className="text-blue-700 hover:underline font-bold text-xs mt-0.5 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      {client.phone}
                    </a>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold uppercase text-slate-400 block">Email</span>
                    {client.email ? (
                      <a href={`mailto:${client.email}`} className="text-blue-700 hover:underline font-medium text-xs mt-0.5 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" />
                        {client.email}
                      </a>
                    ) : (
                      <span className="text-slate-400 italic">Non renseigné</span>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <span className="text-[10px] font-semibold uppercase text-slate-400 block">Adresse & Localisation</span>
                    <div className="text-slate-700 font-medium text-xs mt-0.5 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {client.address || 'Non spécifiée'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Summary of Active Credits & Avoirs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-3.5 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-red-600" />
                      Lignes de crédit en cours
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('credits')}
                      className="text-[11px] text-blue-600 hover:underline font-semibold"
                    >
                      Voir détails →
                    </button>
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    {creditLines.filter(c => c.remainingAmount > 0).length} crédit(s) actif(s) pour un reste à payer total de{' '}
                    <strong className="text-red-600">{formatFCFA(totalCreditBalance)}</strong>.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-xl p-3.5 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <RotateCcw className="w-4 h-4 text-emerald-600" />
                      Avoirs clients disponibles
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('avoirs')}
                      className="text-[11px] text-blue-600 hover:underline font-semibold"
                    >
                      Voir détails →
                    </button>
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    {avoirLines.filter(a => a.remainingBalance > 0).length} avoir(s) actif(s) pour un solde disponible de{' '}
                    <strong className="text-emerald-700">{formatFCFA(totalAvailableAvoirs)}</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LIGNE DE CRÉDIT */}
          {activeTab === 'credits' && (
            <div className="space-y-4">
              {creditLines.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-400 space-y-3">
                  <CreditCard className="w-8 h-8 text-slate-300 mx-auto" />
                  <div>
                    <p className="font-bold text-slate-700 text-sm">Aucune ligne de crédit pour ce client</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Les lignes de crédit représentent les dettes du client envers l'établissement.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDebtAmount(0);
                      setDebtInvoiceRef('');
                      setDebtNotes('');
                      setIsAddDebtOpen(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ajouter une dette</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Master List of Credit Lines (Left / Top) */}
                  <div className="lg:col-span-5 space-y-2">
                    <div className="flex items-center justify-between pb-1">
                      <span className="font-bold text-slate-800 text-xs">
                        Ligne de crédit ({creditLines.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setDebtAmount(0);
                          setDebtInvoiceRef('');
                          setDebtNotes('');
                          setIsAddDebtOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] shadow-xs flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Ajouter une dette</span>
                      </button>
                    </div>

                    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                      {creditLines.map((line) => {
                        const isSelected = currentCreditLine?.id === line.id;
                        return (
                          <div
                            key={line.id}
                            onClick={() => setSelectedCreditId(line.id)}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-blue-50/70 border-blue-500 shadow-xs ring-1 ring-blue-400'
                                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-xs text-blue-900 flex items-center gap-1">
                                <Receipt className="w-3.5 h-3.5 text-blue-600" />
                                {line.creditNumber}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                line.status === 'Soldé'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}>
                                {line.status}
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                              <span>Facture : <strong>{line.invoiceRef}</strong></span>
                              <span>{line.date}</span>
                            </div>

                            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                              <div>
                                <span className="text-[10px] text-slate-400 block">Initial</span>
                                <span className="font-semibold text-slate-700">{formatFCFA(line.initialAmount)}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-slate-400 block">Reste à payer</span>
                                <span className={`font-bold ${line.remainingAmount > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                                  {formatFCFA(line.remainingAmount)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Detail Panel: Payment History of Selected Credit Line (Right) */}
                  <div className="lg:col-span-7 bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3.5">
                    {currentCreditLine ? (
                      <>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-800 text-sm">
                                {currentCreditLine.creditNumber}
                              </h4>
                              <span className="font-mono text-[11px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                                Réf: {currentCreditLine.invoiceRef}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Créé le {currentCreditLine.date} {currentCreditLine.notes && `• ${currentCreditLine.notes}`}
                            </p>
                          </div>

                          {currentCreditLine.remainingAmount > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPaymentId(null);
                                setPaymentAmount(currentCreditLine.remainingAmount);
                                setIsAddPaymentOpen(true);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Enregistrer versement</span>
                            </button>
                          )}
                        </div>

                        {/* Credit Line Status Summary */}
                        <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Montant initial</span>
                            <span className="font-bold text-slate-800 text-xs block mt-0.5">{formatFCFA(currentCreditLine.initialAmount)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total déjà versé</span>
                            <span className="font-bold text-emerald-700 text-xs block mt-0.5">{formatFCFA(currentCreditLine.paidAmount)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-red-500 uppercase font-bold block">Reste à payer</span>
                            <span className="font-black text-red-600 text-xs block mt-0.5">{formatFCFA(currentCreditLine.remainingAmount)}</span>
                          </div>
                        </div>

                        {/* Historical Payments Table (REQUIRED SPEC: Paiement n°, Date et heure, montant, Reste à payer, celui qui a faite la saisie (opérateur)) */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                              <History className="w-3.5 h-3.5 text-blue-600" />
                              Historique des versements ({currentCreditLine.payments?.length || 0})
                            </span>
                            {(currentCreditLine.payments?.length || 0) > 0 && (
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
                          </div>

                          {(!currentCreditLine.payments || currentCreditLine.payments.length === 0) ? (
                            <div className="p-6 text-center bg-white border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                              Aucun versement enregistré pour cette ligne de crédit. Cliquez sur "Enregistrer versement" ci-dessus.
                            </div>
                          ) : (
                            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                  <tr>
                                    <th className="py-2.5 px-3">Paiement n°</th>
                                    <th className="py-2.5 px-3">Date et heure</th>
                                    <th className="py-2.5 px-3 text-right">Montant</th>
                                    <th className="py-2.5 px-3 text-right">Reste à payer</th>
                                    <th className="py-2.5 px-3">Opérateur (Saisie)</th>
                                    <th className="py-2.5 px-3 text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {currentCreditLine.payments.map((p, idx) => (
                                    <tr key={p.id || idx} className="hover:bg-slate-50/70 transition-colors">
                                      <td className="py-2.5 px-3 font-semibold text-blue-900">
                                        <div className="flex items-center gap-1.5">
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                          <span>{p.paymentNumber}</span>
                                        </div>
                                        {p.reference && (
                                          <span className="text-[10px] text-slate-400 font-mono block pl-5">{p.reference}</span>
                                        )}
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                        {p.date}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                                        +{formatFCFA(p.amount)}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-bold text-slate-700">
                                        {formatFCFA(p.remainingAmount)}
                                      </td>
                                      <td className="py-2.5 px-3 font-medium text-slate-700">
                                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-semibold">
                                          {p.operator}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3">
                                        <div className="flex items-center justify-end gap-1">
                                          {currentCreditLine.status !== 'Soldé' && (
                                            <button
                                              type="button"
                                              onClick={() => openEditPayment(p)}
                                              title="Modifier ce versement"
                                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-colors"
                                            >
                                              <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => handlePrintPayment(p, currentCreditLine)}
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
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="p-8 text-center text-slate-400">
                        Sélectionnez une ligne de crédit à gauche.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LIGNE DES AVOIRS */}
          {activeTab === 'avoirs' && (
            <div className="space-y-4">
              {avoirLines.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-400 space-y-3">
                  <RotateCcw className="w-8 h-8 text-slate-300 mx-auto" />
                  <div>
                    <p className="font-bold text-slate-700 text-sm">Aucun avoir client pour le moment</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Les avoirs sont créés suite aux retours de marchandise, gestes commerciaux ou trop-perçus.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewAvoirAmount(0);
                      setNewAvoirReason('');
                      setNewAvoirSourceRef('');
                      setIsAddAvoirLineOpen(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ajouter un avoir</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Master List of Avoir Lines (Left) */}
                  <div className="lg:col-span-5 space-y-2">
                    <div className="flex items-center justify-between pb-1">
                      <span className="font-bold text-slate-800 text-xs">
                        Ligne des avoirs ({avoirLines.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setNewAvoirAmount(0);
                          setNewAvoirReason('');
                          setNewAvoirSourceRef('');
                          setIsAddAvoirLineOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Ajouter un avoir</span>
                      </button>
                    </div>

                    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                      {avoirLines.map((line) => {
                        const isSelected = currentAvoirLine?.id === line.id;
                        return (
                          <div
                            key={line.id}
                            onClick={() => setSelectedAvoirId(line.id)}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-emerald-50/70 border-emerald-500 shadow-xs ring-1 ring-emerald-400'
                                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-xs text-emerald-900 flex items-center gap-1">
                                <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                                {line.avoirNumber}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                line.status === 'Totalement remboursé'
                                  ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}>
                                {line.status}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-700 mt-1 line-clamp-1 font-medium">
                              {line.reason}
                            </p>

                            <div className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-between">
                              <span>Source: {line.sourceRef}</span>
                              <span>{line.date}</span>
                            </div>

                            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                              <div>
                                <span className="text-[10px] text-slate-400 block">Montant avoir</span>
                                <span className="font-semibold text-slate-700">{formatFCFA(line.totalAmount)}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-slate-400 block">Solde restant</span>
                                <span className={`font-bold ${line.remainingBalance > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                                  {formatFCFA(line.remainingBalance)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Detail Panel: Refund History of Selected Avoir Line (Right) */}
                  <div className="lg:col-span-7 bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3.5">
                    {currentAvoirLine ? (
                      <>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-800 text-sm">
                                {currentAvoirLine.avoirNumber}
                              </h4>
                              <span className="font-mono text-[11px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                                Réf: {currentAvoirLine.sourceRef}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 mt-0.5 font-medium">
                              Motif : {currentAvoirLine.reason}
                            </p>
                          </div>

                          {currentAvoirLine.remainingBalance > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRefundId(null);
                                setRefundAmount(currentAvoirLine.remainingBalance);
                                setIsAddRefundOpen(true);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Enregistrer remboursement</span>
                            </button>
                          )}
                        </div>

                        {/* Avoir Line Summary */}
                        <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Montant de l'avoir</span>
                            <span className="font-bold text-slate-800 text-xs block mt-0.5">{formatFCFA(currentAvoirLine.totalAmount)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Déjà remboursé / déduit</span>
                            <span className="font-bold text-blue-700 text-xs block mt-0.5">{formatFCFA(currentAvoirLine.refundedAmount)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-emerald-600 uppercase font-bold block">Solde restant disponible</span>
                            <span className="font-black text-emerald-700 text-xs block mt-0.5">{formatFCFA(currentAvoirLine.remainingBalance)}</span>
                          </div>
                        </div>

                        {/* Historical Refunds Table */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                              <History className="w-3.5 h-3.5 text-emerald-600" />
                              Historique des remboursements ({currentAvoirLine.refunds?.length || 0})
                            </span>
                            {(currentAvoirLine.refunds?.length || 0) > 0 && (
                              <button
                                type="button"
                                onClick={() => handlePrintRefundsList(currentAvoirLine)}
                                title="Imprimer l'ensemble des remboursements de cette ligne"
                                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-[11px] flex items-center gap-1 transition-colors"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Imprimer la liste</span>
                              </button>
                            )}
                          </div>

                          {(!currentAvoirLine.refunds || currentAvoirLine.refunds.length === 0) ? (
                            <div className="p-6 text-center bg-white border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                              Aucun remboursement ou utilisation enregistré pour cet avoir.
                            </div>
                          ) : (
                            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                  <tr>
                                    <th className="py-2.5 px-3">Remboursement n°</th>
                                    <th className="py-2.5 px-3">Date et heure</th>
                                    <th className="py-2.5 px-3 text-right">Montant</th>
                                    <th className="py-2.5 px-3 text-right">Solde restant</th>
                                    <th className="py-2.5 px-3">Opérateur (Saisie)</th>
                                    <th className="py-2.5 px-3 text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {currentAvoirLine.refunds.map((r, idx) => (
                                    <tr key={r.id || idx} className="hover:bg-slate-50/70 transition-colors">
                                      <td className="py-2.5 px-3 font-semibold text-emerald-900">
                                        <div className="flex items-center gap-1.5">
                                          <RotateCcw className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                          <span>{r.refundNumber}</span>
                                        </div>
                                        {r.refundMethod && (
                                          <span className="text-[10px] text-slate-400 block pl-5">{r.refundMethod}</span>
                                        )}
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                        {r.date}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-bold text-red-600">
                                        -{formatFCFA(r.amount)}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                                        {formatFCFA(r.remainingBalance)}
                                      </td>
                                      <td className="py-2.5 px-3 font-medium text-slate-700">
                                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-semibold">
                                          {r.operator}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3">
                                        <div className="flex items-center justify-end gap-1">
                                          {currentAvoirLine.status !== 'Totalement remboursé' && (
                                            <button
                                              type="button"
                                              onClick={() => openEditRefund(r)}
                                              title="Modifier ce remboursement"
                                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-colors"
                                            >
                                              <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => handlePrintRefund(r, currentAvoirLine)}
                                            title="Imprimer le reçu de remboursement"
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
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="p-8 text-center text-slate-400">
                        Sélectionnez une ligne d'avoir à gauche.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SUB-MODAL: Formulaire de Versement Crédit */}
        {isAddPaymentOpen && currentCreditLine && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  {editingPayment ? <Edit3 className="w-4 h-4 text-amber-600" /> : <Plus className="w-4 h-4 text-emerald-600" />}
                  <span>{editingPayment ? `Modifier le versement ${editingPayment.paymentNumber}` : `Enregistrer un versement (Crédit ${currentCreditLine.creditNumber})`}</span>
                </h4>
                <button
                  type="button"
                  onClick={() => { setEditingPaymentId(null); setIsAddPaymentOpen(false); }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddPaymentSubmit} className="p-5 space-y-3.5 text-xs">
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-red-700 font-semibold">Reste à payer actuel :</span>
                  <strong className="text-red-800 font-black text-sm">{formatFCFA(currentCreditLine.remainingAmount)}</strong>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Montant du versement (FCFA) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={editingPayment ? currentCreditLine.remainingAmount + editingPayment.amount : currentCreditLine.remainingAmount}
                    required
                    value={paymentAmount || ''}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    placeholder="ex: 15000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-emerald-700 font-bold text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Celui qui a fait la saisie (Opérateur) *
                  </label>
                  <input
                    type="text"
                    required
                    value={paymentOperator}
                    onChange={(e) => setPaymentOperator(e.target.value)}
                    placeholder="Nom de l'opérateur ou caissier"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Mode de règlement
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:border-blue-500"
                    >
                      <option value="Espèces">Espèces</option>
                      <option value="Mobile Money">Mobile Money</option>
                      <option value="Chèque">Chèque</option>
                      <option value="Virement bancaire">Virement bancaire</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Réf / N° Reçu
                    </label>
                    <input
                      type="text"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      placeholder="ex: REC-1045"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setEditingPaymentId(null); setIsAddPaymentOpen(false); }}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  >
                    {editingPayment ? 'Enregistrer les modifications' : 'Valider le versement'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SUB-MODAL: Formulaire de Remboursement Avoir */}
        {isAddRefundOpen && currentAvoirLine && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  {editingRefund ? <Edit3 className="w-4 h-4 text-amber-600" /> : <RotateCcw className="w-4 h-4 text-blue-600" />}
                  <span>{editingRefund ? `Modifier le remboursement ${editingRefund.refundNumber}` : `Enregistrer remboursement (Avoir ${currentAvoirLine.avoirNumber})`}</span>
                </h4>
                <button
                  type="button"
                  onClick={() => { setEditingRefundId(null); setIsAddRefundOpen(false); }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddRefundSubmit} className="p-5 space-y-3.5 text-xs">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-emerald-800 font-semibold">Solde d'avoir disponible :</span>
                  <strong className="text-emerald-900 font-black text-sm">{formatFCFA(currentAvoirLine.remainingBalance)}</strong>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Montant remboursé ou déduit (FCFA) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={editingRefund ? currentAvoirLine.remainingBalance + editingRefund.amount : currentAvoirLine.remainingBalance}
                    required
                    value={refundAmount || ''}
                    onChange={(e) => setRefundAmount(Number(e.target.value))}
                    placeholder="ex: 5000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-blue-700 font-bold text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Opérateur ayant fait la saisie *
                  </label>
                  <input
                    type="text"
                    required
                    value={refundOperator}
                    onChange={(e) => setRefundOperator(e.target.value)}
                    placeholder="Nom de l'opérateur"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mode de remboursement / déduction
                  </label>
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:border-blue-500"
                  >
                    <option value="Espèces">Espèces remboursées en caisse</option>
                    <option value="Avoir sur vente">Déduction sur ticket de caisse</option>
                    <option value="Mobile Money">Remboursement Mobile Money</option>
                    <option value="Virement bancaire">Virement bancaire</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Motif / Note complémentaire
                  </label>
                  <input
                    type="text"
                    value={refundNote}
                    onChange={(e) => setRefundNote(e.target.value)}
                    placeholder="ex: Déduit sur vente du jour"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setEditingRefundId(null); setIsAddRefundOpen(false); }}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#001F3F] hover:bg-blue-900 text-white font-bold"
                  >
                    {editingRefund ? 'Enregistrer les modifications' : 'Valider le remboursement'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* SUB-MODAL: Formulaire Ajouter une dette */}
        {isAddDebtOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-red-600" />
                  <span>Ajouter une dette (Ligne de crédit)</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAddDebtOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddDebtSubmit} className="p-5 space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Montant de la dette (FCFA) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={debtAmount || ''}
                    onChange={(e) => setDebtAmount(Number(e.target.value))}
                    placeholder="ex: 50000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-red-600 font-bold text-sm focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Référence Facture / Commande
                  </label>
                  <input
                    type="text"
                    value={debtInvoiceRef}
                    onChange={(e) => setDebtInvoiceRef(e.target.value)}
                    placeholder="ex: FAC-2026-0042"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Date de la dette
                  </label>
                  <input
                    type="datetime-local"
                    value={debtDate}
                    onChange={(e) => setDebtDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Motif / Note complémentaire
                  </label>
                  <input
                    type="text"
                    value={debtNotes}
                    onChange={(e) => setDebtNotes(e.target.value)}
                    placeholder="ex: Achat à crédit farine et levure"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddDebtOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
                  >
                    Valider la dette
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SUB-MODAL: Formulaire Ajouter un avoir */}
        {isAddAvoirLineOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-emerald-600" />
                  <span>Ajouter un avoir (Ligne des avoirs)</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAddAvoirLineOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddAvoirSubmit} className="p-5 space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Montant de l'avoir (FCFA) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newAvoirAmount || ''}
                    onChange={(e) => setNewAvoirAmount(Number(e.target.value))}
                    placeholder="ex: 20000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-emerald-700 font-bold text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Motif de l'avoir *
                  </label>
                  <input
                    type="text"
                    required
                    value={newAvoirReason}
                    onChange={(e) => setNewAvoirReason(e.target.value)}
                    placeholder="ex: Retour sacs farine avariés ou geste commercial"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Référence source / Commande
                  </label>
                  <input
                    type="text"
                    value={newAvoirSourceRef}
                    onChange={(e) => setNewAvoirSourceRef(e.target.value)}
                    placeholder="ex: CMD-2026-0012 ou RET-005"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Date de l'avoir
                  </label>
                  <input
                    type="datetime-local"
                    value={newAvoirDate}
                    onChange={(e) => setNewAvoirDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddAvoirLineOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  >
                    Valider l'avoir
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
