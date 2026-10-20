import {
  Product,
  StockMovement,
  ApprovisionnementRecord,
  GoodsReception,
  SaleOrder,
  PhysicalInventory,
  StockAdjustment,
  StockTransfer,
  CustomerReturn,
  SupplierReturn,
  ValuationMethod,
  StockValuationLine
} from '../types';
import { parseAppDate } from './dateUtils';

export const VALUATION_METHOD_LABELS: Record<ValuationMethod, string> = {
  CUMP_PERPETUEL: 'CUMP après chaque entrée',
  CUMP_PERIODIQUE: 'CUMP périodique (mensuel)',
  FIFO: 'FIFO / PEPS'
};

export interface ValuationInput {
  products: Product[];
  movements: StockMovement[];
  approvisionnements: ApprovisionnementRecord[];
  receptions: GoodsReception[];
  saleOrders: SaleOrder[];
  /** Inventaires physiques — coût des entrées de régularisation (référence = code INV) */
  inventories?: PhysicalInventory[];
  /** Ajustements de stock — coût des entrées de régularisation (référence = code ADJ) */
  stockAdjustments?: StockAdjustment[];
  /** Transferts inter-dépôts — les entrées de réception reprennent le CUMP d'expédition (référence = code TRF) */
  stockTransfers?: StockTransfer[];
  /** Retours clients — les réintégrations reprennent le coût d'achat figé sur la vente (référence = code RC) */
  customerReturns?: CustomerReturn[];
  /** Annulations de retours fournisseurs — les réintégrations reprennent le prix du retour (référence = code RF) */
  supplierReturns?: SupplierReturn[];
  valuationDate: string; // YYYY-MM-DD — fin de journée incluse
  method: ValuationMethod;
}

const round = (n: number) => Math.round(n); // FCFA : arrondi à l'unité

/** Signe du mouvement : Entrée +, Sortie/Périmé −, Ajustement = delta signé */
const movementDelta = (m: StockMovement): number => {
  if (m.type === 'Entrée') return Math.abs(m.quantity);
  if (m.type === 'Ajustement') return m.quantity; // peut être négatif
  return -Math.abs(m.quantity);
};

/**
 * Coût unitaire d'entrée d'un mouvement :
 *  1. approvisionnement référencé (item.unitPrice)
 *  2. réception référencée (item.unitPrice)
 *  3. entrée de régularisation d'inventaire (coût unitaire figé sur la ligne)
 *  4. annulation de vente (coût d'origine figé sur la ligne de vente)
 *  5. retour client (coût d'achat figé sur la ligne du retour) et
 *     annulation de retour fournisseur (prix d'achat de la ligne retour)
 *  6. repli : prix d'achat de la fiche produit → coût estimé (flagué)
 */
function resolveEntryCost(
  mv: StockMovement,
  product: Product,
  approByRef: Map<string, ApprovisionnementRecord>,
  receptionByCode: Map<string, GoodsReception>,
  inventoryByCode: Map<string, PhysicalInventory>,
  adjustmentByCode: Map<string, StockAdjustment>,
  transferByCode: Map<string, StockTransfer>,
  saleByCode: Map<string, SaleOrder>,
  customerReturnByCode: Map<string, CustomerReturn>,
  supplierReturnByCode: Map<string, SupplierReturn>
): { cost: number; estimated: boolean } {
  const appro = approByRef.get(mv.reference);
  if (appro) {
    const it = appro.items.find(i => i.productId === mv.productId);
    if (it?.unitPrice != null) return { cost: it.unitPrice, estimated: false };
  }
  const rec = receptionByCode.get(mv.reference);
  if (rec) {
    const it = rec.items.find(i => i.productId === mv.productId);
    if (it?.unitPrice != null) return { cost: it.unitPrice, estimated: false };
  }
  const inv = inventoryByCode.get(mv.reference); // régularisation d'inventaire : coût de la ligne
  if (inv) {
    const it = inv.items.find(i => i.productId === mv.productId);
    if (it != null && it.unitPrice > 0) return { cost: it.unitPrice, estimated: false };
  }
  const adj = adjustmentByCode.get(mv.reference); // ajustement de stock : coût de la ligne
  if (adj) {
    const it = adj.lines.find(l => l.productId === mv.productId);
    if (it != null && it.unitPrice > 0) return { cost: it.unitPrice, estimated: false };
  }
  const trf = transferByCode.get(mv.reference); // réception de transfert : CUMP figé à l'expédition
  if (trf) {
    const it = trf.items.find(i => i.productId === mv.productId);
    if (it?.unitPrice != null && it.unitPrice > 0) return { cost: it.unitPrice, estimated: false };
  }
  const sale = saleByCode.get(mv.reference); // retour client / annulation : coût d'origine
  if (sale) {
    const it = sale.items.find(i => i.productId === mv.productId);
    if (it?.buyPrice != null) return { cost: it.buyPrice, estimated: false };
  }
  const cret = customerReturnByCode.get(mv.reference); // retour client : coût d'achat figé
  if (cret) {
    const it = cret.items.find(i => i.productId === mv.productId);
    if (it?.buyPrice != null && it.buyPrice > 0) return { cost: it.buyPrice, estimated: false };
  }
  const sret = supplierReturnByCode.get(mv.reference); // annulation retour fournisseur : prix du retour
  if (sret) {
    const it = sret.items.find(i => i.productId === mv.productId);
    if (it?.unitPrice != null && it.unitPrice > 0) return { cost: it.unitPrice, estimated: false };
  }
  return { cost: product.buyPrice || 0, estimated: true };
}

interface Layer { qty: number; cost: number }
interface EngineState { qty: number; value: number; lastCost: number; layers: Layer[]; notes: string[]; estimated: boolean }

/** Rejoue les mouvements jusqu'à `limit` (inclus) et retourne l'état du stock selon la méthode */
function replay(
  product: Product,
  mvts: StockMovement[],
  limit: Date,
  method: ValuationMethod,
  costOf: (m: StockMovement) => { cost: number; estimated: boolean }
): EngineState {
  const st: EngineState = { qty: 0, value: 0, lastCost: product.buyPrice || 0, layers: [], notes: [], estimated: false };

  for (const m of mvts) {
    const d = parseAppDate(m.date);
    if (isNaN(d.getTime()) || d > limit) continue;
    const delta = movementDelta(m);

    if (delta > 0) {
      // --- Entrée (ou ajustement positif) ---
      const { cost, estimated } = costOf(m);
      if (estimated) st.estimated = true;
      if (method === 'FIFO') {
        st.layers.push({ qty: delta, cost });
        st.qty += delta;
        st.value += delta * cost;
      } else {
        // CUMP : nouvelle valeur = valeur stock + valeur entrée
        st.qty += delta;
        st.value += delta * cost;
        st.lastCost = st.qty > 0 ? st.value / st.qty : cost;
      }
    } else if (delta < 0) {
      // --- Sortie / casse / ajustement négatif ---
      const out = -delta;
      if (method === 'FIFO') {
        let remaining = out;
        while (remaining > 0 && st.layers.length > 0) {
          const layer = st.layers[0];
          const take = Math.min(layer.qty, remaining);
          layer.qty -= take;
          st.value -= take * layer.cost;
          remaining -= take;
          st.qty -= take;
          if (layer.qty <= 0) st.layers.shift();
        }
        if (remaining > 0) {
          st.qty -= remaining;
          st.value -= remaining * st.lastCost;
          st.notes.push(`Sortie de ${remaining} u sans couche FIFO disponible (${m.reference || m.date})`);
        }
      } else {
        const cump = st.qty > 0 ? st.value / st.qty : st.lastCost;
        if (st.qty <= 0) {
          st.notes.push(`Sortie de ${out} u alors que le stock était épuisé (${m.reference || m.date})`);
        }
        st.qty -= out;
        st.value -= out * cump;
        st.lastCost = cump;
      }
    }
  }

  // Cohérence : quantité nulle → valeur nulle ; quantité négative → anomalie
  if (st.qty === 0) { st.value = 0; st.layers = []; }
  if (st.qty < 0) st.notes.push('Stock négatif reconstitué — données insuffisantes');
  if (st.qty > 0 && st.value < 0) { st.value = 0; st.notes.push('Valeur résiduelle négative ramenée à 0'); }

  return st;
}

/** Valorisation au `valuationDate` pour l'ensemble des produits stockables */
export function computeStockValuation(input: ValuationInput): StockValuationLine[] {
  const { products, movements, approvisionnements, receptions, saleOrders, inventories, stockAdjustments, stockTransfers, customerReturns, supplierReturns, valuationDate, method } = input;

  const limit = parseAppDate(`${valuationDate} 23:59`);
  if (isNaN(limit.getTime())) return [];

  const approByRef = new Map(approvisionnements.map(a => [a.reference, a]));
  const receptionByCode = new Map(receptions.map(r => [r.code, r]));
  const inventoryByCode = new Map((inventories || []).map(i => [i.code, i]));
  const adjustmentByCode = new Map((stockAdjustments || []).map(a => [a.code, a]));
  const transferByCode = new Map((stockTransfers || []).map(t => [t.code, t]));
  const saleByCode = new Map(saleOrders.map(s => [s.code, s]));
  const customerReturnByCode = new Map((customerReturns || []).map(r => [r.code, r]));
  const supplierReturnByCode = new Map((supplierReturns || []).map(r => [r.code, r]));
  const productCost = new Map(products.map(p => [p.id, p.buyPrice || 0]));

  const mvtsByProduct = new Map<string, StockMovement[]>();
  movements.forEach(m => {
    const list = mvtsByProduct.get(m.productId) || [];
    list.push(m);
    mvtsByProduct.set(m.productId, list);
  });
  mvtsByProduct.forEach(list =>
    list.sort((a, b) => parseAppDate(a.date).getTime() - parseAppDate(b.date).getTime())
  );

  const lines: StockValuationLine[] = [];

  products
    .filter(p => p.isStockable !== false)
    .forEach(p => {
      const mvts = mvtsByProduct.get(p.id) || [];
      const depot = p.location || 'Non affecté';
      const categoryName = p.category || 'Sans famille';
      const unit = p.storageUnit || p.unit || 'pièce';
      const lastMv = mvts.length > 0
        ? mvts.filter(m => {
            const d = parseAppDate(m.date);
            return !isNaN(d.getTime()) && d <= limit;
          }).at(-1)?.date
        : undefined;

      const costOf = (m: StockMovement) =>
        resolveEntryCost(m, p, approByRef, receptionByCode, inventoryByCode, adjustmentByCode, transferByCode, saleByCode, customerReturnByCode, supplierReturnByCode);

      let qty = 0, value = 0, unitCost = 0;
      const notes: string[] = [];
      let estimated = false;

      if (mvts.length === 0) {
        // Aucun historique : stock actuel traité comme stock initial au prix d'achat
        qty = p.stock;
        unitCost = p.buyPrice || 0;
        value = qty * unitCost;
        estimated = true;
        if (qty > 0) notes.push('Aucun mouvement enregistré — stock actuel valorisé au prix d\'achat de la fiche');
      } else if (method === 'CUMP_PERIODIQUE') {
        // Période = mois calendaire de la date de valorisation
        const ref = parseAppDate(`${valuationDate} 00:00`);
        const periodStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
        const opening = replay(p, mvts, periodStart, 'CUMP_PERPETUEL', costOf);

        let inQty = 0, inValue = 0, outQty = 0;
        for (const m of mvts) {
          const d = parseAppDate(m.date);
          if (isNaN(d.getTime()) || d <= periodStart || d > limit) continue;
          const delta = movementDelta(m);
          if (delta > 0) {
            const { cost, estimated: est } = costOf(m);
            inQty += delta;
            inValue += delta * cost;
            if (est) estimated = true;
          } else {
            outQty += -delta;
          }
        }
        const denom = opening.qty + inQty;
        unitCost = denom > 0 ? (opening.value + inValue) / denom : (productCost.get(p.id) || 0);
        qty = opening.qty + inQty - outQty;
        value = qty > 0 ? qty * unitCost : 0;
        notes.push(...opening.notes);
        estimated = estimated || opening.estimated;
        if (qty < 0) notes.push('Stock négatif reconstitué — données insuffisantes');
      } else {
        const st = replay(p, mvts, limit, method, costOf);
        qty = st.qty;
        value = st.value;
        unitCost = qty > 0 ? value / qty : st.lastCost;
        notes.push(...st.notes);
        estimated = st.estimated;
      }

      if (!p.buyPrice) notes.push('Prix d\'achat non renseigné sur la fiche produit');

      lines.push({
        productId: p.id,
        productCode: p.code,
        productName: p.name,
        category: categoryName,
        depot,
        unit,
        quantity: qty,
        unitCost: round(unitCost),
        totalValue: round(Math.max(0, value)),
        lastMovementDate: lastMv,
        method,
        costEstimated: estimated || undefined,
        hasAnomaly: qty < 0 || notes.length > 0 || undefined,
        anomalyNote: notes.length > 0 ? notes.join(' • ') : undefined
      });
    });

  return lines;
}
