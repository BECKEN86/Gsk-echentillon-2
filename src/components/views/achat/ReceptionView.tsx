import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ReceiptText, 
  Plus, 
  Search, 
  X, 
  FileText,
  Calendar,
  Clock,
  User,
  Building2,
  DollarSign,
  CheckCircle2,
  MoreVertical,
  Printer,
  Download,
  Trash2,
  CheckSquare,
  Square,
  ArrowRight,
  Layers,
  Barcode,
  Package,
  Edit,
  Check,
  AlertCircle,
  ShieldCheck,
  ClipboardCheck,
  AlertTriangle,
  Hourglass,
  ShieldAlert,
  Ban
} from 'lucide-react';
import { 
  GoodsReception, 
  GoodsReceptionItem, 
  PurchaseOrder, 
  Supplier, 
  Product, 
  OperationalUnit,
  ApprovisionnementRecord,
  STORAGE_CONTAINER_UNITS 
} from '../../../types';
import { formatFCFA } from '../../../data/initialData';
import { purchaseUnitPrice } from '../../../utils/purchaseCalc';
import { ReceptionDetailModal } from '../../modals/ReceptionDetailModal';

export type ExpiryStatus = 'EXPIRED' | 'EXPIRING_SOON' | 'VALID' | 'NONE';

export interface ExpiryAnalysis {
  status: ExpiryStatus;
  daysRemaining: number | null;
  label: string;
  badgeClass: string;
}

export const getExpiryAnalysis = (dateStr?: string, refDate: Date = new Date()): ExpiryAnalysis => {
  if (!dateStr || !dateStr.trim()) {
    return {
      status: 'NONE',
      daysRemaining: null,
      label: 'Non renseignée',
      badgeClass: 'bg-slate-100 text-slate-500 border-slate-200'
    };
  }

  const expDate = new Date(dateStr);
  if (isNaN(expDate.getTime())) {
    return {
      status: 'NONE',
      daysRemaining: null,
      label: 'Date invalide',
      badgeClass: 'bg-slate-100 text-slate-500 border-slate-200'
    };
  }

  const today = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const target = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const daysAgo = Math.abs(diffDays);
    return {
      status: 'EXPIRED',
      daysRemaining: diffDays,
      label: daysAgo === 0 ? "Périmé aujourd'hui" : `Périmé (depuis ${daysAgo} j)`,
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold'
    };
  } else if (diffDays <= 30) {
    return {
      status: 'EXPIRING_SOON',
      daysRemaining: diffDays,
      label: diffDays === 0 ? "Expire aujourd'hui" : `Expire dans ${diffDays} j`,
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
    };
  } else {
    return {
      status: 'VALID',
      daysRemaining: diffDays,
      label: `Valide (${diffDays} j)`,
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-medium'
    };
  }
};

export const getReceptionExpirySummary = (reception: GoodsReception) => {
  let expiredCount = 0;
  let expiringSoonCount = 0;
  let validCount = 0;
  let withoutDateCount = 0;

  reception.items.forEach(item => {
    const info = getExpiryAnalysis(item.expirationDate);
    if (info.status === 'EXPIRED') expiredCount++;
    else if (info.status === 'EXPIRING_SOON') expiringSoonCount++;
    else if (info.status === 'VALID') validCount++;
    else withoutDateCount++;
  });

  return {
    expiredCount,
    expiringSoonCount,
    validCount,
    withoutDateCount,
    hasExpired: expiredCount > 0,
    hasExpiringSoon: expiringSoonCount > 0,
    hasAlert: expiredCount > 0 || expiringSoonCount > 0
  };
};

interface ReceptionViewProps {
  receptions: GoodsReception[];
  purchaseOrders: PurchaseOrder[];
  products: Product[];
  suppliers: Supplier[];
  onValidateReception: (receptionId: string) => void;
  onAddDirectReception: (reception: Omit<GoodsReception, 'id'>) => void;
  onDeleteReception?: (id: string) => void;
  onDeleteMultipleReceptions?: (ids: string[]) => void;
  onNavigateToBonCommande?: () => void;
  approvisionnements?: ApprovisionnementRecord[];
  onCancelReception?: (receptionId: string) => void;
  initialPurchaseOrder?: PurchaseOrder | null;
  onClearInitialPurchaseOrder?: () => void;
}

interface NewReceptionItemForm {
  supplierId?: string;
  productId: string;
  barcode: string;
  productName: string;
  orderedQty: number | string;
  receivedQty: number | string;
  acceptedQty: number | string;
  expirationDate: string;
  unitPrice?: number | string;
}

export const ReceptionView: React.FC<ReceptionViewProps> = ({
  receptions,
  purchaseOrders,
  products,
  suppliers,
  onValidateReception,
  onAddDirectReception,
  onDeleteReception,
  onDeleteMultipleReceptions,
  onNavigateToBonCommande,
  approvisionnements = [],
  onCancelReception,
  initialPurchaseOrder,
  onClearInitialPurchaseOrder
}) => {
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [expiryFilter, setExpiryFilter] = useState<'ALL' | 'EXPIRED' | 'EXPIRING_SOON' | 'ALERTS' | 'VALID'>('ALL');

  // Selected Receptions for batch actions
  const [selectedRecIds, setSelectedRecIds] = useState<string[]>([]);
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);

  // Modals state
  const [selectedRecDetail, setSelectedRecDetail] = useState<GoodsReception | null>(null);
  const [isSelectPOModalOpen, setIsSelectPOModalOpen] = useState(false);
  const [isCreateRecModalOpen, setIsCreateRecModalOpen] = useState(false);
  const [selectedSourcePO, setSelectedSourcePO] = useState<PurchaseOrder | null>(null);
  const [poSearchTerm, setPoSearchTerm] = useState('');

  // Delete confirmations & warnings
  const [recToDelete, setRecToDelete] = useState<GoodsReception | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [actionWarning, setActionWarning] = useState<string | null>(null);

  // Form state for creating a new Reception
  const [formReceiver, setFormReceiver] = useState('Kouassi Marc (Magasinier)');
  const [formMainSupplierId, setFormMainSupplierId] = useState('');

  // Une réception est annulable tant qu'elle n'a pas servi à un approvisionnement
  const isReceptionUsedInAppro = (rec: GoodsReception) =>
    approvisionnements.some(a => a.receptionId === rec.id || a.receptionNumber === rec.code);
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState('Livraison conforme sans réserves');
  const [formVatRate, setFormVatRate] = useState<number>(18);
  const [formItems, setFormItems] = useState<NewReceptionItemForm[]>([]);

  // Product Autocomplete popup state
  const [activePopup, setActivePopup] = useState<{
    rowIndex: number;
    field: 'barcode' | 'productName';
  } | null>(null);

  const popupRef = useRef<HTMLDivElement>(null);

  // Close popup on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setActivePopup(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter Purchase Orders eligible for reception (not already fully received)
  const eligiblePOs = useMemo(() => {
    return purchaseOrders.filter(po => (po as any).status !== 'Reçu');
  }, [purchaseOrders]);

  const filteredEligiblePOs = useMemo(() => {
    if (!poSearchTerm.trim()) return eligiblePOs;
    const term = poSearchTerm.toLowerCase();
    return eligiblePOs.filter(po => 
      po.code.toLowerCase().includes(term) ||
      po.supplierName.toLowerCase().includes(term) ||
      (po.buyer && po.buyer.toLowerCase().includes(term))
    );
  }, [eligiblePOs, poSearchTerm]);

  // Statistics of expiration alerts
  const expiryStats = useMemo(() => {
    let totalExpiredItems = 0;
    let totalExpiringSoonItems = 0;
    let recsWithExpired = 0;
    let recsWithExpiringSoon = 0;

    receptions.forEach(rec => {
      const s = getReceptionExpirySummary(rec);
      totalExpiredItems += s.expiredCount;
      totalExpiringSoonItems += s.expiringSoonCount;
      if (s.hasExpired) recsWithExpired++;
      if (s.hasExpiringSoon) recsWithExpiringSoon++;
    });

    return {
      totalExpiredItems,
      totalExpiringSoonItems,
      recsWithExpired,
      recsWithExpiringSoon,
      totalAlerts: totalExpiredItems + totalExpiringSoonItems
    };
  }, [receptions]);

  // Filter Receptions for Dashboard Table
  const filteredReceptions = useMemo(() => {
    return receptions.filter(rec => {
      const matchSearch =
        rec.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (rec.receiverName && rec.receiverName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (rec.purchaseOrderCode && rec.purchaseOrderCode.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus = statusFilter === 'ALL' || rec.status === statusFilter;
      const matchSupplier = supplierFilter === 'ALL' || 
        suppliers.find(s => s.name === rec.supplierName)?.id === supplierFilter ||
        rec.supplierId === supplierFilter;

      // Expiry filter
      let matchExpiry = true;
      if (expiryFilter !== 'ALL') {
        const expSum = getReceptionExpirySummary(rec);
        if (expiryFilter === 'EXPIRED') {
          matchExpiry = expSum.hasExpired;
        } else if (expiryFilter === 'EXPIRING_SOON') {
          matchExpiry = expSum.hasExpiringSoon;
        } else if (expiryFilter === 'ALERTS') {
          matchExpiry = expSum.hasAlert;
        } else if (expiryFilter === 'VALID') {
          matchExpiry = !expSum.hasAlert && expSum.validCount > 0;
        }
      }

      return matchSearch && matchStatus && matchSupplier && matchExpiry;
    });
  }, [receptions, searchTerm, statusFilter, supplierFilter, expiryFilter, suppliers]);

  // Statistics
  const stats = useMemo(() => {
    const total = receptions.length;
    const inProgress = receptions.filter(r => r.status === 'En cours' || r.status === 'En attente').length;
    const validated = receptions.filter(r => r.status === 'Validé').length;
    const totalAmount = receptions.reduce((sum, r) => sum + (r.totalTTC || r.totalAmount || 0), 0);

    return { total, inProgress, validated, totalAmount };
  }, [receptions]);

  // Helper for numeric inputs
  const numVal = (v: number | string): number => {
    if (typeof v === 'number') return v;
    if (!v || v === '') return 0;
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  };

  // Helper: Obtenir la liste des UOA disponibles pour un produit
  const getProductUoaList = (product: Product | undefined): OperationalUnit[] => {
    if (!product) return [];
    const list: OperationalUnit[] = [];
    if (product.operationalUnits && product.operationalUnits.length > 0) {
      product.operationalUnits
        .filter(u => u.type === 'UOA')
        .forEach(u => list.push(u));
    }
    if (product.uoa && !list.some(u => u.label === product.uoa?.label || u.label === product.uoa?.name)) {
      list.push({
        id: 'legacy_uoa',
        label: product.uoa.label || product.uoa.name || 'Conditionnement Achat',
        type: 'UOA',
        quantity: product.uoa.quantity || 1,
        price: product.uoa.price || product.buyPrice || 0
      });
    }
    if (list.length === 0 && (product.storageUnit || product.unit)) {
      const uName = product.storageUnit || product.unit || 'Unité';
      list.push({
        id: 'def_uoa',
        label: uName,
        type: 'UOA',
        quantity: 1,
        price: product.buyPrice || 0
      });
    }
    return list;
  };

  // Selection handlers
  const allFilteredSelected = filteredReceptions.length > 0 && selectedRecIds.length === filteredReceptions.length;

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedRecIds([]);
    } else {
      setSelectedRecIds(filteredReceptions.map(r => r.id));
    }
  };

  const handleToggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedRecIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Open the PO selection modal
  const handleOpenNewReception = () => {
    setPoSearchTerm('');
    setIsSelectPOModalOpen(true);
  };

  // User chooses a Purchase Order
  const handleSelectPOForReception = (po: PurchaseOrder) => {
    setSelectedSourcePO(po);
    setFormMainSupplierId(po.supplierId || '');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormVatRate(po.vatRate ?? 18);
    setFormNotes(`Livraison conforme selon le bon de commande ${po.code}.`);

    // Map items from the PO
    const mappedItems: NewReceptionItemForm[] = po.items.map(item => {
      const p = products.find(prod => prod.id === item.productId) ||
                products.find(prod => prod.name === item.productName) ||
                products.find(prod => prod.barcode && prod.barcode === item.barcode);

      // Prix par unité produit = montant HT de la ligne / quantité produit
      // (si Qta > 0, item.unitPrice est le prix PAR UOA : HT = Qta × prix UOA)
      const perUnitPrice = purchaseUnitPrice(item);

      return {
        supplierId: item.supplierId || po.supplierId,
        productId: item.productId,
        barcode: item.barcode || p?.barcode || '',
        productName: item.productName,
        orderedQty: item.quantity,
        receivedQty: item.quantity,
        acceptedQty: item.quantity,
        expirationDate: '',
        unitPrice: perUnitPrice
      };
    });

    setFormItems(mappedItems.length > 0 ? mappedItems : [
      {
        supplierId: po.supplierId || '',
        productId: '',
        barcode: '',
        productName: '',
        orderedQty: 0,
        receivedQty: 0,
        acceptedQty: 0,
        expirationDate: '',
        unitPrice: 0
      }
    ]);

    setIsSelectPOModalOpen(false);
    setIsCreateRecModalOpen(true);
  };

  // Ouverture automatique de la fiche de réception quand on arrive depuis "Réceptionner la commande"
  useEffect(() => {
    if (initialPurchaseOrder) {
      handleSelectPOForReception(initialPurchaseOrder);
      if (onClearInitialPurchaseOrder) {
        onClearInitialPurchaseOrder();
      }
    }
  }, [initialPurchaseOrder]);

  // Remove item row
  const handleRemoveItemRow = (index: number) => {
    setFormItems(formItems.filter((_, idx) => idx !== index));
    if (activePopup?.rowIndex === index) {
      setActivePopup(null);
    }
  };

  // Item form field change
  const handleFormItemChange = (index: number, field: keyof NewReceptionItemForm, value: any) => {
    setFormItems(prev => {
      const next = [...prev];
      const current = { ...next[index] };

      (current as any)[field] = value;

      // Auto update acceptedQty if receivedQty changes and accepted was equal or empty
      if (field === 'receivedQty' && (current.acceptedQty === '' || current.acceptedQty === current.orderedQty)) {
        current.acceptedQty = value;
      }

      next[index] = current;
      return next;
    });

    if (field === 'barcode' || field === 'productName') {
      setActivePopup({ rowIndex: index, field });
    }
  };

  // Select product from popup
  const handleSelectProductFromPopup = (rowIndex: number, product: Product) => {
    setFormItems(prev => {
      const next = [...prev];
      next[rowIndex] = {
        ...next[rowIndex],
        productId: product.id,
        productName: product.name,
        barcode: product.barcode || '',
        orderedQty: 0,
        receivedQty: 1,
        acceptedQty: 1,
        expirationDate: '',
        unitPrice: product.buyPrice || 0,
        supplierId: formMainSupplierId || next[rowIndex].supplierId || ''
      };
      return next;
    });
    setActivePopup(null);
  };

  // Form quantity totals
  const formTotalOrdered = useMemo(() => {
    return formItems.reduce((sum, item) => sum + numVal(item.orderedQty), 0);
  }, [formItems]);

  const formTotalReceived = useMemo(() => {
    return formItems.reduce((sum, item) => sum + numVal(item.receivedQty), 0);
  }, [formItems]);

  const formTotalAccepted = useMemo(() => {
    return formItems.reduce((sum, item) => sum + numVal(item.acceptedQty), 0);
  }, [formItems]);

  // Form totals for background record
  const formTotalHT = useMemo(() => {
    return formItems.reduce((sum, item) => {
      const q = numVal(item.acceptedQty);
      const p = numVal(item.unitPrice || 0);
      return sum + q * p;
    }, 0);
  }, [formItems]);

  const formTotalVAT = useMemo(() => {
    return Math.round(formTotalHT * (formVatRate / 100));
  }, [formTotalHT, formVatRate]);

  const formTotalTTC = formTotalHT + formTotalVAT;

  // Submit and create reception
  const handleFormSubmit = (e: React.FormEvent, validateNow = true) => {
    e.preventDefault();
    const mainSupplier = (selectedSourcePO ? suppliers.find(s => s.name === selectedSourcePO.supplierName || s.id === selectedSourcePO.supplierId) : undefined) ||
                         suppliers.find(s => s.id === formMainSupplierId) || 
                         suppliers[0];
    if (!mainSupplier) return;

    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const seq = String(receptions.length + 1).padStart(4, '0');
    const newReference = `REC-${yearMonth}-${seq}`;

    const validItems = formItems.filter(i => (i.productName && i.productName.trim() !== '') || (i.barcode && i.barcode.trim() !== ''));

    const items: GoodsReceptionItem[] = (validItems.length > 0 ? validItems : formItems).map(item => {
      const supp = suppliers.find(s => s.id === item.supplierId) || mainSupplier;
      const oQty = numVal(item.orderedQty);
      const rQty = numVal(item.receivedQty);
      const aQty = numVal(item.acceptedQty);
      const p = numVal(item.unitPrice || 0);
      const lineHT = aQty * p;
      const lineVat = Math.round(lineHT * (formVatRate / 100));
      const lineTTC = lineHT + lineVat;

      return {
        productId: item.productId || `prod_rec_${Date.now()}`,
        barcode: item.barcode,
        productName: item.productName || 'Article',
        supplierId: supp.id,
        supplierName: supp.name,
        orderedQty: oQty,
        receivedQty: rQty,
        acceptedQty: aQty,
        expirationDate: item.expirationDate ? String(item.expirationDate) : undefined,
        unitPrice: p,
        vatRate: formVatRate,
        vatAmount: lineVat,
        total: lineTTC
      };
    });

    onAddDirectReception({
      code: newReference,
      purchaseOrderId: selectedSourcePO?.id,
      purchaseOrderCode: selectedSourcePO?.code,
      date: formDate,
      supplierId: mainSupplier.id,
      supplierName: mainSupplier.name,
      items,
      receiverName: formReceiver,
      totalHT: formTotalHT,
      vatRate: formVatRate,
      totalVAT: formTotalVAT,
      totalTTC: formTotalTTC,
      totalAmount: formTotalTTC,
      status: validateNow ? 'Validé' : 'En cours',
      notes: formNotes
    });

    setIsCreateRecModalOpen(false);
    setSelectedSourcePO(null);
  };

  // Actions Dropdown: Print Selected Receptions via hidden iframe
  const handlePrintSelectedReceptions = () => {
    setIsActionsDropdownOpen(false);
    const recsToPrint = selectedRecIds.length > 0
      ? filteredReceptions.filter(r => selectedRecIds.includes(r.id))
      : filteredReceptions;

    if (recsToPrint.length === 0) return;

    const printDate = new Date().toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const totalCumule = recsToPrint.reduce((acc, r) => acc + (r.totalTTC || r.totalAmount || 0), 0);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Liste des Bordereaux de Réception</title>
          <meta charset="utf-8" />
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 15px;
              font-size: 11px;
            }
            .header-bar {
              border-bottom: 2px solid #0f766e;
              padding-bottom: 12px;
              margin-bottom: 20px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .title {
              font-size: 18px;
              font-weight: 800;
              color: #0f766e;
              margin: 0;
            }
            .subtitle {
              font-size: 11px;
              color: #64748b;
              margin-top: 3px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th {
              background-color: #0f766e;
              color: #ffffff;
              font-weight: 700;
              text-align: left;
              padding: 8px 10px;
              font-size: 10px;
              text-transform: uppercase;
            }
            td {
              border-bottom: 1px solid #e2e8f0;
              padding: 8px 10px;
              font-size: 11px;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .badge {
              display: inline-block;
              padding: 2px 6px;
              border-radius: 4px;
              font-weight: 700;
              font-size: 9px;
              text-transform: uppercase;
            }
            .badge-encours {
              background-color: #fef3c7;
              color: #92400e;
            }
            .badge-valide {
              background-color: #dcfce7;
              color: #166534;
            }
            .footer-summary {
              margin-top: 20px;
              display: flex;
              justify-content: space-between;
              font-size: 11px;
              border-top: 1px solid #cbd5e1;
              padding-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div>
              <div class="title">BORDEREAUX DE RÉCEPTION FOURNISSEUR</div>
              <div class="subtitle">GeStock - État récapitulatif des livraisons • ${recsToPrint.length} document(s)</div>
            </div>
            <div style="text-align: right; font-size: 10px; color: #64748b;">
              Édité le : <strong>${printDate}</strong>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 110px;">Référence</th>
                <th style="width: 100px;">Bon Commande</th>
                <th style="width: 80px;">Date</th>
                <th>Fournisseur</th>
                <th>Réceptionnaire</th>
                <th class="text-right" style="width: 110px;">Valeur Entrée</th>
                <th class="text-center" style="width: 80px;">Statut</th>
              </tr>
            </thead>
            <tbody>
              ${recsToPrint.map(r => `
                <tr>
                  <td style="font-family: monospace; font-weight: bold; color: #0f766e;">${r.code}</td>
                  <td style="font-family: monospace; color: #64748b;">${r.purchaseOrderCode || 'Direct'}</td>
                  <td>${r.date}</td>
                  <td><strong>${r.supplierName}</strong></td>
                  <td>${r.receiverName || 'Kouassi Marc'}</td>
                  <td class="text-right" style="font-weight: bold; color: #0f766e;">
                    ${(r.totalTTC || r.totalAmount || 0).toLocaleString('fr-FR')} FCFA
                  </td>
                  <td class="text-center">
                    <span class="badge ${r.status === 'Validé' ? 'badge-valide' : 'badge-encours'}">
                      ${r.status}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer-summary">
            <div>Total sélectionné : <strong>${recsToPrint.length} bordereau(x)</strong></div>
            <div>Montant cumulé entré en stock : <strong>${totalCumule.toLocaleString('fr-FR')} FCFA</strong></div>
          </div>
        </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error("Erreur lors de l'impression :", e);
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 1000);
        }
      }, 500);
    }
  };

  // Actions Dropdown: Export CSV
  const handleExportSelectedCSV = () => {
    const listToExport = selectedRecIds.length > 0 
      ? filteredReceptions.filter(r => selectedRecIds.includes(r.id)) 
      : filteredReceptions;

    if (listToExport.length === 0) return;

    const headers = ['Référence', 'Bon de Commande', 'Date', 'Fournisseur', 'Réceptionnaire', 'Total TTC', 'Statut'];
    const rows = listToExport.map(r => [
      `"${r.code}"`,
      `"${r.purchaseOrderCode || ''}"`,
      `"${r.date}"`,
      `"${r.supplierName.replace(/"/g, '""')}"`,
      `"${r.receiverName || ''}"`,
      `"${r.totalTTC || r.totalAmount || 0}"`,
      `"${r.status}"`
    ]);

    const csvContent = [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `receptions_fournisseurs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsActionsDropdownOpen(false);
  };

  // Delete handlers
  const handleBulkDelete = () => {
    if (selectedRecIds.length === 0) return;
    const canDeleteIds = selectedRecIds.filter(id => {
      const rec = receptions.find(r => r.id === id);
      return rec?.status !== 'Validé';
    });
    if (canDeleteIds.length < selectedRecIds.length) {
      setActionWarning("Certains bordereaux sélectionnés sont validés avec entrée en stock effectuée et ne peuvent pas être supprimés.");
    }
    if (canDeleteIds.length > 0) {
      if (onDeleteMultipleReceptions) {
        onDeleteMultipleReceptions(canDeleteIds);
      } else if (onDeleteReception) {
        canDeleteIds.forEach(id => onDeleteReception(id));
      }
    }
    setSelectedRecIds([]);
    setConfirmBulkDelete(false);
    setIsActionsDropdownOpen(false);
  };

  const handleDeleteSingle = (rec: GoodsReception) => {
    if (rec.status === 'Validé') {
      setActionWarning(`Le bordereau ${rec.code} est validé avec mouvements de stock enregistrés. Il ne peut plus être supprimé.`);
      setRecToDelete(null);
      return;
    }
    if (onDeleteReception) {
      onDeleteReception(rec.id);
    }
    setRecToDelete(null);
    setSelectedRecIds(prev => prev.filter(id => id !== rec.id));
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-teal-600" />
            <h1 className="text-xl font-bold text-[#001F3F]">Bordereaux de Réception Fournisseur</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Contrôle à la livraison, validation de conformité, surveillance des dates d'expiration et mise à jour des stocks.
          </p>
        </div>

        <button
          onClick={handleOpenNewReception}
          className="px-4 py-2.5 rounded-xl bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau Bon de Réception</span>
        </button>
      </div>

      {/* NOTIFICATION VISUELLE D'ALERTE EXPIRATION / DLC */}
      {expiryStats.totalAlerts > 0 && (
        <div className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all shadow-xs ${
          expiryStats.totalExpiredItems > 0
            ? 'bg-rose-50/90 border-rose-200 text-rose-950'
            : 'bg-amber-50/90 border-amber-200 text-amber-950'
        }`}>
          <div className="flex items-start sm:items-center gap-3">
            <div className={`p-2.5 rounded-xl text-white shrink-0 ${
              expiryStats.totalExpiredItems > 0 ? 'bg-rose-600 shadow-sm animate-pulse' : 'bg-amber-600 shadow-sm'
            }`}>
              {expiryStats.totalExpiredItems > 0 ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <Hourglass className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm">
                  {expiryStats.totalExpiredItems > 0
                    ? "Attention : Produits avec date d'expiration critique identifiés"
                    : "Surveillance : Produits à date d'expiration proche (≤ 30 jours)"}
                </h3>
                {expiryStats.totalExpiredItems > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-200/90 text-rose-900 border border-rose-300 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-700" />
                    {expiryStats.totalExpiredItems} produit(s) périmé(s)
                  </span>
                )}
                {expiryStats.totalExpiringSoonItems > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-200/90 text-amber-900 border border-amber-300 flex items-center gap-1">
                    <Hourglass className="w-3 h-3 text-amber-700" />
                    {expiryStats.totalExpiringSoonItems} à échéance imminente
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Utilisez les filtres rapides pour isoler les bordereaux concernés et organiser les retours fournisseurs ou déclassements.
              </p>
            </div>
          </div>

          {/* Boutons d'action / Filtrage rapide */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {expiryStats.totalExpiredItems > 0 && (
              <button
                type="button"
                onClick={() => setExpiryFilter(expiryFilter === 'EXPIRED' ? 'ALL' : 'EXPIRED')}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                  expiryFilter === 'EXPIRED'
                    ? 'bg-rose-700 text-white shadow-sm ring-2 ring-rose-400'
                    : 'bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Périmés ({expiryStats.recsWithExpired})</span>
              </button>
            )}

            {expiryStats.totalExpiringSoonItems > 0 && (
              <button
                type="button"
                onClick={() => setExpiryFilter(expiryFilter === 'EXPIRING_SOON' ? 'ALL' : 'EXPIRING_SOON')}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                  expiryFilter === 'EXPIRING_SOON'
                    ? 'bg-amber-700 text-white shadow-sm ring-2 ring-amber-400'
                    : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                }`}
              >
                <Hourglass className="w-3.5 h-3.5" />
                <span>Proches ≤ 30j ({expiryStats.recsWithExpiringSoon})</span>
              </button>
            )}

            {expiryFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setExpiryFilter('ALL')}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-300 transition-colors"
              >
                Tout réinitialiser
              </button>
            )}
          </div>
        </div>
      )}

      {/* KPI Stats Cards - 5 Colonnes avec contrôle de péremption */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Réceptions</span>
            <ReceiptText className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-[#001F3F]">{stats.total}</div>
          <p className="text-[11px] text-slate-400 mt-1">Bordereaux enregistrés</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">En attente</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-amber-600">{stats.inProgress}</div>
          <p className="text-[11px] text-slate-400 mt-1">En attente de validation</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Validées</span>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{stats.validated}</div>
          <p className="text-[11px] text-slate-400 mt-1">Stock magasin incrémenté</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-teal-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Valeur Entrée</span>
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="text-xl font-black text-[#001F3F] truncate">
            {formatFCFA(stats.totalAmount)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Valeur totale acceptée</p>
        </div>

        {/* 5ème Carte : Alertes Péremption / DLC */}
        <div 
          onClick={() => setExpiryFilter(prev => prev === 'ALERTS' ? 'ALL' : 'ALERTS')}
          className={`p-4 rounded-2xl border shadow-xs cursor-pointer transition-all hover:scale-[1.02] ${
            expiryStats.totalExpiredItems > 0
              ? 'bg-rose-50/70 border-rose-200 hover:bg-rose-50'
              : expiryStats.totalExpiringSoonItems > 0
              ? 'bg-amber-50/70 border-amber-200 hover:bg-amber-50'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
          title="Cliquer pour filtrer les bordereaux en alerte"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Contrôle DLC</span>
            {expiryStats.totalExpiredItems > 0 ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 animate-pulse" />
            ) : expiryStats.totalExpiringSoonItems > 0 ? (
              <Hourglass className="w-4 h-4 text-amber-600" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            )}
          </div>
          <div className={`text-2xl font-black ${
            expiryStats.totalExpiredItems > 0 
              ? 'text-rose-700' 
              : expiryStats.totalExpiringSoonItems > 0 
              ? 'text-amber-700' 
              : 'text-emerald-700'
          }`}>
            {expiryStats.totalAlerts > 0 ? expiryStats.totalAlerts : '0'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span className={expiryStats.totalExpiredItems > 0 ? 'font-bold text-rose-600' : ''}>
              {expiryStats.totalExpiredItems} périmé(s)
            </span>
            <span>•</span>
            <span className={expiryStats.totalExpiringSoonItems > 0 ? 'font-bold text-amber-700' : ''}>
              {expiryStats.totalExpiringSoonItems} proche(s)
            </span>
          </p>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto flex-1">
          {/* Search bar */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par Réception, Commande, Fournisseur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 text-slate-800 placeholder-slate-400 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 text-slate-700 font-medium text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="En cours">En cours</option>
            <option value="En attente">En attente</option>
            <option value="Validé">Validé</option>
            <option value="Annulé">Annulé</option>
          </select>

          {/* Expiry filter dropdown */}
          <select
            value={expiryFilter}
            onChange={(e) => setExpiryFilter(e.target.value as any)}
            className={`px-3 py-2 font-bold text-xs rounded-xl border focus:outline-none transition-colors ${
              expiryFilter === 'EXPIRED'
                ? 'bg-rose-100 text-rose-800 border-rose-300'
                : expiryFilter === 'EXPIRING_SOON'
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : expiryFilter === 'ALERTS'
                ? 'bg-red-50 text-red-700 border-red-300'
                : 'bg-slate-50 text-slate-700 border-slate-200 focus:border-blue-500'
            }`}
          >
            <option value="ALL">Contrôle DLC (Tous)</option>
            <option value="ALERTS">⚠️ Toutes les alertes (Périmés & Proches)</option>
            <option value="EXPIRED">🛑 Produits périmés uniquement</option>
            <option value="EXPIRING_SOON">⏳ Échéance proche (≤ 30 jours)</option>
            <option value="VALID">✅ Produits valides</option>
          </select>

          {/* Supplier filter */}
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 text-slate-700 font-medium text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 max-w-[200px] truncate"
          >
            <option value="ALL">Tous les fournisseurs</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Bouton déroulant ACTIONS avec option Imprimer */}
          <div className="relative">
            <button
              onClick={() => setIsActionsDropdownOpen(!isActionsDropdownOpen)}
              disabled={filteredReceptions.length === 0}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
                selectedRecIds.length > 0 
                  ? 'bg-teal-700 text-white border-teal-700 shadow-sm' 
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>Actions</span>
              {selectedRecIds.length > 0 && (
                <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px] font-extrabold">
                  {selectedRecIds.length}
                </span>
              )}
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {isActionsDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-20" 
                  onClick={() => setIsActionsDropdownOpen(false)} 
                />
                <div className="absolute left-0 mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-slate-200 z-30 py-1.5 text-xs animate-in fade-in duration-100">
                  <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
                    {selectedRecIds.length > 0 
                      ? `${selectedRecIds.length} sélectionné(s)` 
                      : 'Tous les bordereaux'}
                  </div>

                  <button
                    onClick={handlePrintSelectedReceptions}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium transition-colors"
                  >
                    <Printer className="w-4 h-4 text-purple-600" />
                    <span>Imprimer {selectedRecIds.length > 0 ? `(${selectedRecIds.length})` : ''}</span>
                  </button>

                  <button
                    onClick={handleExportSelectedCSV}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium transition-colors"
                  >
                    <Download className="w-4 h-4 text-emerald-600" />
                    <span>Exporter en CSV</span>
                  </button>

                  {onDeleteMultipleReceptions && (
                    <button
                      disabled={selectedRecIds.length === 0}
                      onClick={() => {
                        setIsActionsDropdownOpen(false);
                        setConfirmBulkDelete(true);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center gap-2 font-medium transition-colors ${
                        selectedRecIds.length === 0 
                          ? 'text-slate-300 cursor-not-allowed' 
                          : 'text-red-600 hover:bg-red-50'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Supprimer la sélection</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area - Table List View */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 uppercase font-bold tracking-wider text-[11px] border-b border-slate-200">
                <th className="py-3.5 px-3 w-10 text-center">
                  <button
                    onClick={handleToggleSelectAll}
                    className="p-1 rounded text-slate-500 hover:text-[#001F3F] transition-colors"
                    title={allFilteredSelected ? "Désélectionner tout" : "Sélectionner tout"}
                  >
                    {allFilteredSelected ? (
                      <CheckSquare className="w-4 h-4 text-teal-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </th>

                <th className="py-3.5 px-4 font-bold text-slate-700">Reference</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Date</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Réceptionnaire</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Fournisseur</th>
                <th className="py-3.5 px-4 font-bold text-slate-700 text-center">Expiration / DLC</th>
                <th className="py-3.5 px-4 font-bold text-slate-700 text-right">Total Validé</th>
                <th className="py-3.5 px-4 font-bold text-slate-700 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredReceptions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ReceiptText className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-500 text-sm">Aucun bordereau de réception trouvé</p>
                      <p className="text-xs text-slate-400">
                        {expiryFilter !== 'ALL'
                          ? "Aucun bordereau ne correspond aux critères de filtre d'expiration sélectionnés."
                          : 'Cliquez sur "Nouveau Bon de Réception" pour réceptionner un bon de commande.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredReceptions.map((rec) => {
                  const isSelected = selectedRecIds.includes(rec.id);
                  const totalTTC = rec.totalTTC || rec.totalAmount || rec.items.reduce((s, i) => s + ((i.acceptedQty || 0) * (i.unitPrice || 0)), 0);
                  const expSum = getReceptionExpirySummary(rec);

                  return (
                    <tr 
                      key={rec.id}
                      onClick={() => setSelectedRecDetail(rec)}
                      className={`hover:bg-teal-50/40 transition-colors cursor-pointer ${
                        isSelected ? 'bg-teal-50/60' : ''
                      } ${
                        expSum.hasExpired 
                          ? 'bg-rose-50/20' 
                          : expSum.hasExpiringSoon 
                          ? 'bg-amber-50/20' 
                          : ''
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <td 
                        className="py-3.5 px-3 text-center"
                        onClick={(e) => handleToggleSelectOne(rec.id, e)}
                      >
                        <button className="p-1 rounded text-slate-500 hover:text-[#001F3F]">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-teal-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </td>

                      {/* Reference (ex: REC-202610-0001) */}
                      <td className="py-3.5 px-4 font-semibold">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200 w-fit">
                            {rec.code}
                          </span>
                          {rec.purchaseOrderCode && (
                            <span className="text-[10px] text-blue-600 font-mono">
                              BC: {rec.purchaseOrderCode}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Date avec pastille visuelle si date d'expiration proche ou dépassée */}
                      <td className="py-3.5 px-4 text-slate-600 font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {rec.date}
                          </span>
                          {expSum.hasExpired ? (
                            <span 
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs animate-pulse" 
                              title={`Attention: ${expSum.expiredCount} produit(s) dont la date d'expiration est dépassée`}
                            >
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              <span>Périmé</span>
                            </span>
                          ) : expSum.hasExpiringSoon ? (
                            <span 
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs" 
                              title={`Attention: ${expSum.expiringSoonCount} produit(s) dont l'échéance d'expiration est à ≤ 30 jours`}
                            >
                              <Hourglass className="w-3 h-3 text-amber-600" />
                              <span>≤ 30j</span>
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Réceptionnaire */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-bold text-slate-800">
                            {rec.receiverName || 'Kouassi Marc'}
                          </span>
                        </div>
                      </td>

                      {/* Fournisseur */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-slate-700">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{rec.supplierName}</span>
                        </div>
                      </td>

                      {/* Expiration / DLC Visual Indicator */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {expSum.hasExpired ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
                            <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                            <span>{expSum.expiredCount} Périmé{expSum.expiredCount > 1 ? 's' : ''}</span>
                          </span>
                        ) : expSum.hasExpiringSoon ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                            <Hourglass className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>{expSum.expiringSoonCount} Échéance proche</span>
                          </span>
                        ) : expSum.validCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>Conforme</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Non renseignée</span>
                        )}
                      </td>

                      {/* Total Validé */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-black text-[#001F3F] text-sm">
                          {formatFCFA(totalTTC)}
                        </span>
                      </td>

                      {/* Statut */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          rec.status === 'Validé'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : rec.status === 'Annulé'
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : 'bg-amber-100 text-amber-800 border-amber-200'
                        }`}>
                          {rec.status === 'Validé' ? (
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          ) : rec.status === 'Annulé' ? (
                            <Ban className="w-3.5 h-3.5 text-rose-600" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                          )}
                          <span>{rec.status}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer summary table info */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
          <div>
            Affichage de <strong>{filteredReceptions.length}</strong> sur <strong>{receptions.length}</strong> bordereau(x) de réception
            {selectedRecIds.length > 0 && (
              <span className="ml-2 font-semibold text-teal-700">
                • {selectedRecIds.length} sélectionné(s)
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span>
              Total valeur validée : <strong className="text-slate-900">{formatFCFA(stats.totalAmount)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* MODAL 1 : Sélectionner un Bon de Commande pour réception */}
      {isSelectPOModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 my-4">
            <div className="flex items-center justify-between p-4 bg-[#001F3F] text-white">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-teal-300" />
                <h3 className="text-base font-bold">Sélectionner un Bon de Commande à Réceptionner</h3>
              </div>
              <button
                onClick={() => setIsSelectPOModalOpen(false)}
                className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600">
                Pour créer un bordereau de réception, sélectionnez le bon de commande en cours de livraison. 
                Ses articles commandés seront pré-remplis afin de contrôler les quantités reçues et acceptées.
              </p>

              {/* Search bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher par N° Bon de Commande, Fournisseur, Acheteur..."
                  value={poSearchTerm}
                  onChange={(e) => setPoSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 text-slate-800 placeholder-slate-400 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* List of eligible POs */}
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {filteredEligiblePOs.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 space-y-3">
                    <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                    <p className="font-bold text-slate-700">Aucun bon de commande en attente de livraison</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Tous les bons de commande ont déjà été réceptionnés ou aucun n'a été créé.
                    </p>
                    {onNavigateToBonCommande && (
                      <button
                        onClick={() => {
                          setIsSelectPOModalOpen(false);
                          onNavigateToBonCommande();
                        }}
                        className="px-4 py-2 rounded-xl bg-[#001F3F] text-white font-bold hover:bg-blue-900 transition-colors inline-flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Créer un Bon de Commande</span>
                      </button>
                    )}
                  </div>
                ) : (
                  filteredEligiblePOs.map((po) => {
                    const totalTTC = po.totalTTC || po.totalAmount;
                    return (
                      <div
                        key={po.id}
                        onClick={() => handleSelectPOForReception(po)}
                        className="p-4 hover:bg-teal-50/50 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {po.code}
                            </span>
                            <span className="font-bold text-slate-900 text-sm">
                              {po.supplierName}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              po.status === 'Validé' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {po.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-3">
                            <span>Émis le: {po.date}</span>
                            <span>•</span>
                            <span>Acheteur: {po.buyer || '—'}</span>
                            <span>•</span>
                            <span>Livraison prév.: {po.expectedDate || po.orderDeadline || '-'}</span>
                            <span>•</span>
                            <span>{po.items.length} article(s)</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 justify-between sm:justify-end">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Bon</span>
                            <span className="font-black text-[#001F3F] text-sm">
                              {formatFCFA(totalTTC)}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs flex items-center gap-1 shadow-xs"
                          >
                            <span>Réceptionner</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSelectPOModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2 : Fiche Nouveau Bon de Réception (conçue exactement comme la commande et demande de prix) */}
      {isCreateRecModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-[96vw] 2xl:max-w-[1550px] shadow-2xl overflow-hidden my-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-[#001F3F] text-white">
              <div className="flex items-center gap-3">
                <ReceiptText className="w-5 h-5 text-teal-300" />
                <h3 className="text-base font-bold">Nouveau Bordereau de Réception</h3>
                {selectedSourcePO && (
                  <span className="font-mono text-xs bg-teal-500/30 text-teal-200 px-2.5 py-0.5 rounded-md border border-teal-400/30">
                    Commande source: {selectedSourcePO.code}
                  </span>
                )}
              </div>
              <button 
                onClick={() => setIsCreateRecModalOpen(false)} 
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => handleFormSubmit(e, true)} className="p-6 space-y-5 text-xs max-h-[85vh] overflow-y-auto">
              
              {/* Notice informative */}
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-teal-900 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>
                    Contrôlez les quantités reçues et acceptées. À la validation, le stock en magasin sera automatiquement incrémenté et les mouvements d'entrée seront enregistrés.
                  </span>
                </div>
              </div>

              {/* Entête : Réceptionnaire à gauche, Date et Bon de Commande à droite (Fournisseur Livreur retiré) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Réceptionnaire / Magasinier Responsable *
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={formReceiver}
                    placeholder="Nom du magasinier"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold cursor-not-allowed select-none focus:outline-none"
                    title="Champ verrouillé"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> Date de réception effective *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <ReceiptText className="w-3.5 h-3.5 text-blue-600" /> Bon de commande associé
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={selectedSourcePO ? `${selectedSourcePO.code} - ${selectedSourcePO.supplierName}` : 'Réception directe'}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Tableau : Liste articles contrôlés avec contrôle physique et Date d'expiration */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-teal-600" />
                    Articles livrés et contrôle de conformité
                  </label>
                </div>

                <div className="overflow-x-visible border border-slate-200 rounded-xl shadow-2xs bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                        <th className="py-2.5 px-3">Code barre</th>
                        <th className="py-2.5 px-3">Désignation</th>
                        <th className="py-2.5 px-3 text-center">Qté Commandée</th>
                        <th className="py-2.5 px-3 text-center">Qté Reçue</th>
                        <th className="py-2.5 px-3 text-center text-teal-800 font-black">Qté Acceptée</th>
                        <th className="py-2.5 px-3 text-center">Date d'expiration</th>
                        <th className="py-2.5 px-2 text-center w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formItems.map((item, index) => {
                        return (
                          <tr key={index} className="hover:bg-slate-50 relative">
                            {/* Code barre */}
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                readOnly
                                value={item.barcode}
                                placeholder="Code barre"
                                className="w-28 px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-mono text-[11px] text-slate-700 cursor-not-allowed select-none focus:outline-none"
                                title="Code barre verrouillé"
                              />
                            </td>

                            {/* Désignation */}
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                readOnly
                                value={item.productName}
                                placeholder="Désignation article"
                                className="w-56 sm:w-64 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold cursor-not-allowed select-none focus:outline-none"
                                title="Désignation article verrouillée"
                              />
                            </td>

                            {/* Qté Commandée */}
                            <td className="py-2.5 px-3 text-center font-bold text-slate-500">
                              {item.orderedQty}
                            </td>

                            {/* Qté Reçue */}
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="number"
                                min="0"
                                value={item.receivedQty}
                                onChange={(e) => handleFormItemChange(index, 'receivedQty', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                                placeholder="0"
                                className="w-20 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-bold text-center text-xs focus:outline-none focus:border-blue-500"
                              />
                            </td>

                            {/* Qté Acceptée (celle qui entre en stock) */}
                            <td className="py-2.5 px-3 text-center bg-teal-50/50">
                              <input
                                type="number"
                                min="0"
                                value={item.acceptedQty}
                                onChange={(e) => handleFormItemChange(index, 'acceptedQty', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                                placeholder="0"
                                className="w-20 px-2 py-1.5 bg-white border-2 border-teal-500 rounded-lg text-teal-900 font-black text-center text-xs focus:outline-none focus:border-teal-700"
                                title="Quantité validée pour entrée en stock"
                              />
                            </td>

                            {/* Date d'expiration (champ expiration ajouté avec prévisualisation du statut) */}
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <div className="inline-flex items-center gap-1.5 justify-center">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <input
                                    type="date"
                                    value={item.expirationDate || ''}
                                    onChange={(e) => handleFormItemChange(index, 'expirationDate', e.target.value)}
                                    className={`w-36 px-2 py-1.5 bg-white rounded-lg font-semibold text-xs text-center border focus:outline-none ${
                                      item.expirationDate
                                        ? (() => {
                                            const inf = getExpiryAnalysis(item.expirationDate);
                                            return inf.status === 'EXPIRED'
                                              ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:border-rose-600'
                                              : inf.status === 'EXPIRING_SOON'
                                              ? 'border-amber-400 bg-amber-50/50 text-amber-900 focus:border-amber-600'
                                              : 'border-emerald-300 bg-emerald-50/30 text-emerald-900 focus:border-emerald-500';
                                          })()
                                        : 'border-slate-200 text-slate-800 focus:border-blue-500'
                                    }`}
                                    title="Date d'expiration du produit réceptionné"
                                  />
                                </div>
                                {item.expirationDate && (() => {
                                  const inf = getExpiryAnalysis(item.expirationDate);
                                  return (
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] border flex items-center gap-1 ${inf.badgeClass}`}>
                                      {inf.status === 'EXPIRED' ? (
                                        <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                                      ) : inf.status === 'EXPIRING_SOON' ? (
                                        <Hourglass className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                      ) : (
                                        <ShieldCheck className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                      )}
                                      {inf.label}
                                    </span>
                                  );
                                })()}
                              </div>
                            </td>

                            {/* Supprimer la ligne */}
                            <td className="py-2.5 px-1 text-center">
                              {formItems.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemRow(index)}
                                  className="p-1 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                                  title="Supprimer la ligne"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      {/* Synthèse physique des quantités acceptées pour entrée en stock */}
                      <tr className="bg-slate-50 font-bold border-t border-slate-200 text-slate-700">
                        <td colSpan={2} className="py-3 px-4">
                          Total : <span className="text-[#001F3F] font-bold">{formItems.length} article(s)</span>
                        </td>
                        <td className="py-3 px-3 text-center text-slate-500 font-bold">
                          {formTotalOrdered}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-800 font-bold">
                          {formTotalReceived}
                        </td>
                        <td className="py-3 px-3 text-center text-teal-900 font-black text-sm bg-teal-100/50">
                          {formTotalAccepted}
                        </td>
                        <td colSpan={2} className="py-3 px-3 text-center text-slate-500 text-xs">
                          Unités acceptées pour entrée en stock
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Remarques & Observations */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Observations de conformité & Emballage
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="État des colis, anomalies constatées..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateRecModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={(e) => handleFormSubmit(e, false)}
                  className="px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold transition-all"
                >
                  Enregistrer en attente
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold transition-all shadow-sm flex items-center gap-2 active:scale-95"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-300" />
                  <span>Valider la réception (Entrée en Stock)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3 : Fiche Détail de Réception */}
      {selectedRecDetail && (
        <ReceptionDetailModal
          reception={selectedRecDetail}
          supplier={suppliers.find(s => s.name === selectedRecDetail.supplierName || s.id === selectedRecDetail.supplierId)}
          purchaseOrder={purchaseOrders.find(p => p.id === selectedRecDetail.purchaseOrderId || p.code === selectedRecDetail.purchaseOrderCode)}
          onClose={() => setSelectedRecDetail(null)}
          onValidateReception={(recId) => {
            onValidateReception(recId);
            setSelectedRecDetail(prev => prev ? { ...prev, status: 'Validé' } : null);
          }}
          canCancelReception={!isReceptionUsedInAppro(selectedRecDetail)}
          onCancelReception={onCancelReception}
        />
      )}

      {/* Confirmation Supprimer un bordereau */}
      {recToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Supprimer le bordereau de réception ?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Êtes-vous sûr de vouloir supprimer le bordereau <strong>{recToDelete.code}</strong> ?
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRecToDelete(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSingle(recToDelete)}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Suppression multiple */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Supprimer les bordereaux sélectionnés ?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Êtes-vous sûr de vouloir supprimer <strong>{selectedRecIds.length}</strong> bordereau(x) de réception sélectionné(s) ?
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmBulkDelete(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alerte / Action impossible modal */}
      {actionWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Action impossible</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {actionWarning}
              </p>
            </div>
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActionWarning(null)}
                className="px-4 py-2 rounded-xl bg-[#001F3F] text-white font-bold text-xs hover:bg-blue-900 transition-colors"
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
