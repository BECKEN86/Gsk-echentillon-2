/**
 * Règle de calcul des montants des lignes d'achat (demande de prix / bon de
 * commande) — partagée par les formulaires, les fiches de détail, la
 * conversion DP→BC et la réception.
 *
 * - Si Qta > 0 : le prix saisi est le prix PAR UOA → HT = Qta × prix.
 * - Sinon (Qta = 0 ou vide) : prix unitaire produit → HT = Quantité × prix.
 * La TVA s'applique ensuite sur le HT dans les deux cas.
 */

const toNum = (v: number | string | undefined | null): number => {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  if (!v) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

/** Quantité multiplicatrice du montant HT : Qta si > 0, sinon la quantité produit. */
export const purchaseLineQty = (item: {
  qta?: number | string | null;
  requestedQty?: number | string | null;
  quantity?: number | string | null;
}): number => {
  const qta = toNum(item.qta);
  if (qta > 0) return qta;
  return toNum(item.requestedQty ?? item.quantity);
};

/** Montant HT de la ligne (avant TVA). */
export const purchaseLineHT = (item: {
  qta?: number | string | null;
  requestedQty?: number | string | null;
  quantity?: number | string | null;
}, price: number | string | undefined | null): number =>
  purchaseLineQty(item) * toNum(price);

/** Prix ramené à l'unité produit (pour la réception / la valorisation du stock). */
export const purchaseUnitPrice = (item: {
  qta?: number | string | null;
  requestedQty?: number | string | null;
  quantity?: number | string | null;
  unitPrice?: number | string | null;
  estimatedPrice?: number | string | null;
}): number => {
  const qty = toNum(item.requestedQty ?? item.quantity);
  if (qty <= 0) return toNum(item.unitPrice ?? item.estimatedPrice);
  return purchaseLineHT(item, item.unitPrice ?? item.estimatedPrice) / qty;
};
