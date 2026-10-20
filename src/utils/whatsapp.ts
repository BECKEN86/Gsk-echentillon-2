import { CompanyConfig, PurchaseOrder, SaleOrder } from '../types';
import { formatFCFA } from '../data/initialData';
import { purchaseLineQty } from './purchaseCalc';

/**
 * Envoi de documents via WhatsApp — wa.me ne permet que le texte :
 * le reçu/bon est composé en texte brut puis envoyé au destinataire
 * dans un nouvel onglet (l'utilisateur valide l'envoi dans WhatsApp).
 */

/** Indicatif par défaut (Côte d'Ivoire — contexte FCFA / RCCM-NCC). */
const DEFAULT_COUNTRY_CODE = '225';

/**
 * Normalise un numéro vers le format international attendu par wa.me.
 * Accepte : +225 07…, 00225…, 07…, ou numéro déjà international.
 */
export function normalizePhoneForWhatsApp(phone: string | undefined | null): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  // Numéro local ivoirien : commence par 0 (07/05/01…) ou 10 chiffres locaux
  if (digits.startsWith('0')) digits = DEFAULT_COUNTRY_CODE + digits.slice(1);
  else if (digits.length === 10 && !digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    digits = DEFAULT_COUNTRY_CODE + digits;
  }
  return digits;
}

/** Ouvre WhatsApp (web/app) avec le message pré-rempli. */
export function sendWhatsApp(phone: string | undefined | null, message: string): boolean {
  const digits = normalizePhoneForWhatsApp(phone);
  if (!digits) return false;
  window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  return true;
}

// ------------------------------------------------------------------ Vente
/** Texte du ticket de caisse pour envoi WhatsApp au client. */
export function saleReceiptText(sale: SaleOrder, company?: CompanyConfig | null): string {
  const lines: string[] = [
    `*${company?.name || 'GESTOCK'}*`,
    `${company?.address || ''}${company?.phone ? ` — Tél: ${company.phone}` : ''}`.trim(),
    `——————————————`,
    `TICKET N° ${sale.code}`,
    `Date : ${sale.date}`,
    `Client : ${sale.clientName}`,
    `Paiement : ${sale.paymentMethod}`,
    `——————————————`,
    ...sale.items.map(
      i => `${i.productName}\n   ${i.quantity} × ${formatFCFA(i.unitPrice)} = ${formatFCFA(i.total)}`
    ),
    `——————————————`,
    `Sous-total : ${formatFCFA(sale.totalAmount)}`,
    ...(sale.discount > 0 ? [`Remise : -${formatFCFA(sale.discount)}`] : []),
    `*NET À PAYER : ${formatFCFA(sale.finalAmount)}*`,
    `——————————————`,
    `Merci de votre confiance !`
  ];
  return lines.join('\n');
}

// ------------------------------------------------------------------ Achat
/** Texte du bon de commande pour envoi WhatsApp au fournisseur. */
export function purchaseOrderText(po: PurchaseOrder, company?: CompanyConfig | null): string {
  const totalTTC = po.totalTTC ?? po.totalAmount ?? 0;
  const lines: string[] = [
    `*${company?.name || 'GESTOCK'}*`,
    `${company?.phone ? `Tél: ${company.phone}` : ''}`.trim(),
    `——————————————`,
    `BON DE COMMANDE N° ${po.code}`,
    `Date : ${po.date}`,
    `Fournisseur : ${po.supplierName}`,
    ...(po.expectedDate ? [`Livraison prévue : ${po.expectedDate}`] : []),
    `——————————————`,
    ...po.items.map(
      // Qta > 0 → le prix est par UOA : on affiche Qta × prix UOA
      i => `${i.productName}\n   ${purchaseLineQty(i)} × ${formatFCFA(i.unitPrice)} = ${formatFCFA(i.total)}`
    ),
    `——————————————`,
    `*TOTAL TTC : ${formatFCFA(totalTTC)}*`,
    `——————————————`,
    `Merci de confirmer la réception de cette commande.`
  ];
  return lines.join('\n');
}
