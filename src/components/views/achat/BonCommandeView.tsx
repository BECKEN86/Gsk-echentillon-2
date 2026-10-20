import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ClipboardCheck, 
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
  PackageCheck,
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
  ReceiptText,
  Copy
} from 'lucide-react';
import { 
  PurchaseOrder, 
  PurchaseOrderItem, 
  PurchaseOrderSupplierSettlement,
  Supplier, 
  Product, 
  PriceInquiry, 
  OperationalUnit,
  STORAGE_CONTAINER_UNITS,
  UserAccount,
  CompanyConfig
} from '../../../types';
import { formatFCFA } from '../../../data/initialData';
import { purchaseLineQty } from '../../../utils/purchaseCalc';
import { BonCommandeDetailModal } from '../../modals/BonCommandeDetailModal';
import { PurchaseOrderPaymentModal } from '../../modals/PurchaseOrderPaymentModal';

interface BonCommandeViewProps {
  purchaseOrders: PurchaseOrder[];
  inquiries: PriceInquiry[];
  suppliers: Supplier[];
  products: Product[];
  onAddPurchaseOrder: (po: Omit<PurchaseOrder, 'id'>, sourceInquiryId?: string) => void;
  onUpdatePurchaseOrder?: (po: PurchaseOrder) => void;
  onDuplicatePurchaseOrder?: (po: PurchaseOrder) => void;
  onUpdatePurchaseOrderStatus?: (id: string, status: 'En cours' | 'Validé') => void;
  onValidatePurchaseOrderWithSettlements?: (poId: string, settlements: PurchaseOrderSupplierSettlement[]) => void;
  onDeletePurchaseOrder?: (id: string) => void;
  onDeleteMultiplePurchaseOrders?: (ids: string[]) => void;
  onReceiveGoods: (po: PurchaseOrder) => void;
  onAddProduct?: (product: Omit<Product, 'id'>) => void;
  onUpdateProduct?: (product: Product) => void;
  onNavigateToDemandePrix?: () => void;
  initialPOToOpen?: PurchaseOrder | null;
  onClearInitialPO?: () => void;
  currentUser?: UserAccount | null;
  companyConfig?: CompanyConfig | null;
}

interface NewPOItemForm {
  supplierId: string;
  productId: string;
  barcode: string;
  productName: string;
  uoa: string;
  qta: number | string;
  baseUnitQty: number;
  baseUnitPrice: number;
  requestedQty: number | string; // Quantité totale
  estimatedPrice: number | string; // Prix unitaire
  vatRate: number | string;
}

export const BonCommandeView: React.FC<BonCommandeViewProps> = ({
  purchaseOrders,
  inquiries,
  suppliers,
  products,
  onAddPurchaseOrder,
  onUpdatePurchaseOrder,
  onDuplicatePurchaseOrder,
  onUpdatePurchaseOrderStatus,
  onValidatePurchaseOrderWithSettlements,
  onDeletePurchaseOrder,
  onDeleteMultiplePurchaseOrders,
  onReceiveGoods,
  onAddProduct,
  onUpdateProduct,
  onNavigateToDemandePrix,
  initialPOToOpen,
  onClearInitialPO,
  currentUser,
  companyConfig
}) => {
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');

  // Selected POs for batch actions
  const [selectedPOIds, setSelectedPOIds] = useState<string[]>([]);
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);

  // Modals state
  const [selectedPODetail, setSelectedPODetail] = useState<PurchaseOrder | null>(null);
  const [poForPayment, setPoForPayment] = useState<PurchaseOrder | null>(null);
  const [isSelectInquiryModalOpen, setIsSelectInquiryModalOpen] = useState(false);
  const [isCreatePOModalOpen, setIsCreatePOModalOpen] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [selectedSourceInquiry, setSelectedSourceInquiry] = useState<PriceInquiry | null>(null);
  const [inquirySearchTerm, setInquirySearchTerm] = useState('');
  const [actionWarning, setActionWarning] = useState<string | null>(null);

  // Delete confirmations
  const [poToDelete, setPoToDelete] = useState<PurchaseOrder | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // Enchaînement workflow : la fiche du bon nouvellement créé s'ouvre automatiquement
  useEffect(() => {
    if (initialPOToOpen) {
      setSelectedPODetail(initialPOToOpen);
      if (onClearInitialPO) {
        onClearInitialPO();
      }
    }
  }, [initialPOToOpen]);

  // Form state for creating a new Purchase Order
  const [formBuyer, setFormBuyer] = useState(currentUser?.name || '');
  const [formMainSupplierId, setFormMainSupplierId] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formDeadline, setFormDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [formNotes, setFormNotes] = useState('');
  const [formVatRate, setFormVatRate] = useState<number>(18);
  const [formItems, setFormItems] = useState<NewPOItemForm[]>([]);

  // Product Autocomplete popup state
  const [activePopup, setActivePopup] = useState<{
    rowIndex: number;
    field: 'barcode' | 'productName';
  } | null>(null);

  // Quick Product Create / Edit modal state from within the popup
  const [productModalState, setProductModalState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    targetRowIndex: number;
    productToEdit?: Product;
    name: string;
    barcode: string;
    buyPrice: number;
    sellPrice: number;
    vatPurchase: number;
    category: string;
  }>({
    isOpen: false,
    mode: 'create',
    targetRowIndex: 0,
    name: '',
    barcode: '',
    buyPrice: 0,
    sellPrice: 0,
    vatPurchase: 18,
    category: 'Général'
  });

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

  // Filter inquiries that are "En cours" (not yet validated)
  const pendingInquiries = useMemo(() => {
    return inquiries.filter(i => i.status === 'En cours');
  }, [inquiries]);

  const filteredPendingInquiries = useMemo(() => {
    if (!inquirySearchTerm.trim()) return pendingInquiries;
    const term = inquirySearchTerm.toLowerCase();
    return pendingInquiries.filter(i => 
      i.code.toLowerCase().includes(term) ||
      i.supplierName.toLowerCase().includes(term) ||
      (i.buyer && i.buyer.toLowerCase().includes(term))
    );
  }, [pendingInquiries, inquirySearchTerm]);

  // Filter Purchase Orders for Dashboard Table
  const filteredPOs = useMemo(() => {
    return purchaseOrders.filter(po => {
      const matchSearch =
        po.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (po.buyer && po.buyer.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (po.inquiryCode && po.inquiryCode.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus = statusFilter === 'ALL' || po.status === statusFilter;
      const matchSupplier = supplierFilter === 'ALL' || po.supplierId === supplierFilter;

      return matchSearch && matchStatus && matchSupplier;
    });
  }, [purchaseOrders, searchTerm, statusFilter, supplierFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = purchaseOrders.length;
    const inProgress = purchaseOrders.filter(p => p.status === 'En cours').length;
    const validated = purchaseOrders.filter(p => p.status === 'Validé').length;
    const totalAmount = purchaseOrders.reduce((sum, p) => sum + (p.totalTTC || p.totalAmount || 0), 0);

    return { total, inProgress, validated, totalAmount };
  }, [purchaseOrders]);

  // Helper for numeric inputs
  const numVal = (v: number | string): number => {
    if (typeof v === 'number') return v;
    if (!v || v === '') return 0;
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  };

  // Base de calcul du montant HT (règle partagée, cf. utils/purchaseCalc) :
  // Qta > 0 → Qta × prix par UOA ; sinon → Quantité × prix unitaire.
  const lineAmountQty = purchaseLineQty;

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
  const allFilteredSelected = filteredPOs.length > 0 && selectedPOIds.length === filteredPOs.length;

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedPOIds([]);
    } else {
      setSelectedPOIds(filteredPOs.map(p => p.id));
    }
  };

  const handleToggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPOIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Open the inquiry selection modal
  const handleOpenNewPO = () => {
    setInquirySearchTerm('');
    setIsSelectInquiryModalOpen(true);
  };

  // User chooses an inquiry in progress
  const handleSelectInquiryForPO = (inquiry: PriceInquiry) => {
    setSelectedSourceInquiry(inquiry);
    setFormBuyer(inquiry.buyer || currentUser?.name || '');
    setFormMainSupplierId(inquiry.supplierId || '');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormDeadline(inquiry.orderDeadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setFormVatRate(inquiry.vatRate ?? 18);
    setFormNotes(inquiry.notes ? `Issu de la demande de prix ${inquiry.code}. ${inquiry.notes}` : `Issu de la demande de prix ${inquiry.code}`);

    // Map items from the inquiry
    const mappedItems: NewPOItemForm[] = inquiry.items.map(item => {
      const p = products.find(prod => prod.id === item.productId) ||
                products.find(prod => prod.name === item.productName) ||
                products.find(prod => prod.barcode && prod.barcode === item.barcode);

      const uoaList = getProductUoaList(p);
      const matchedUoa = uoaList.find(u => u.label === item.uoa) || uoaList[0];

      const baseQty = (matchedUoa && matchedUoa.quantity > 0)
        ? matchedUoa.quantity
        : (item.qta && item.qta > 0 ? Math.max(1, Math.round(item.requestedQty / item.qta)) : 1);
      
      const basePrice = (matchedUoa && matchedUoa.price > 0)
        ? matchedUoa.price
        : item.estimatedPrice;

      return {
        supplierId: item.supplierId || inquiry.supplierId,
        productId: item.productId,
        barcode: item.barcode || p?.barcode || '',
        productName: item.productName,
        uoa: item.uoa || matchedUoa?.label || p?.storageUnit || p?.unit || '',
        qta: item.qta ?? 1,
        baseUnitQty: baseQty,
        baseUnitPrice: basePrice,
        requestedQty: item.requestedQty,
        estimatedPrice: item.estimatedPrice,
        vatRate: item.vatRate !== undefined ? item.vatRate : 18
      };
    });

    setFormItems(mappedItems.length > 0 ? mappedItems : [
      {
        supplierId: inquiry.supplierId || '',
        productId: '',
        barcode: '',
        productName: '',
        uoa: '',
        qta: '',
        baseUnitQty: 1,
        baseUnitPrice: 0,
        requestedQty: '',
        estimatedPrice: '',
        vatRate: ''
      }
    ]);

    setIsSelectInquiryModalOpen(false);
    setIsCreatePOModalOpen(true);
  };

  // Add empty item row
  const handleAddProductRow = () => {
    setFormItems(prev => [
      ...prev,
      {
        supplierId: formMainSupplierId || '',
        productId: '',
        barcode: '',
        productName: '',
        uoa: '',
        qta: '',
        baseUnitQty: 1,
        baseUnitPrice: 0,
        requestedQty: '',
        estimatedPrice: '',
        vatRate: ''
      }
    ]);
  };

  // Remove item row
  const handleRemoveItemRow = (index: number) => {
    setFormItems(formItems.filter((_, idx) => idx !== index));
    if (activePopup?.rowIndex === index) {
      setActivePopup(null);
    }
  };

  // Item form field change with UOA and Qta reactive calculation
  const handleFormItemChange = (index: number, field: keyof NewPOItemForm, value: any) => {
    setFormItems(prev => {
      const next = [...prev];
      const current = { ...next[index] };

      if (field === 'uoa') {
        const chosenUoaLabel = String(value);
        current.uoa = chosenUoaLabel;

        const currentProd = products.find(p => p.id === current.productId) || 
                            products.find(p => p.name === current.productName) || 
                            products.find(p => p.barcode && p.barcode === current.barcode);
        
        const availableUoas = getProductUoaList(currentProd);
        const matchedUoa = availableUoas.find(u => u.label === chosenUoaLabel);

        if (matchedUoa) {
          const qtaVal = 1;
          const baseQty = matchedUoa.quantity && matchedUoa.quantity > 0 ? matchedUoa.quantity : 1;
          const basePrice = matchedUoa.price && matchedUoa.price > 0 ? matchedUoa.price : (currentProd?.buyPrice || 0);

          current.qta = qtaVal;
          current.baseUnitQty = baseQty;
          current.baseUnitPrice = basePrice;
          current.requestedQty = qtaVal * baseQty;
          current.estimatedPrice = basePrice; // Prix PAR UOA — le montant est calculé Qta × prix
        } else if (!chosenUoaLabel) {
          current.qta = '';
          current.baseUnitQty = 1;
          current.baseUnitPrice = currentProd?.buyPrice || 0;
          current.requestedQty = '';
          current.estimatedPrice = currentProd?.buyPrice || '';
        }
      } else if (field === 'qta') {
        // Qta pilote la quantité totale (Qta × contenance UOA) ; le prix
        // reste le prix PAR UOA et le montant est recalculé Qta × prix.
        current.qta = value;
        const qtaNum = numVal(value);
        const baseQty = current.baseUnitQty || 1;

        if (value === '' || isNaN(qtaNum)) {
          current.requestedQty = '';
        } else if (qtaNum > 0) {
          current.requestedQty = qtaNum * baseQty;
        }
        // Qta = 0 → mode manuel : la quantité saisie est conservée
      } else {
        (current as any)[field] = value;
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
    const uoaList = getProductUoaList(product);
    const firstUoa = uoaList[0];

    const uoaLabel = firstUoa ? firstUoa.label : (product.storageUnit || product.unit || '');
    const baseQty = firstUoa?.quantity && firstUoa.quantity > 0 ? firstUoa.quantity : 1;
    const basePrice = firstUoa?.price && firstUoa.price > 0 ? firstUoa.price : (product.buyPrice || 0);

    const initialQta = 1;
    const initialRequestedQty = initialQta * baseQty;
    const initialEstimatedPrice = basePrice;

    setFormItems(prev => {
      const next = [...prev];
      next[rowIndex] = {
        ...next[rowIndex],
        productId: product.id,
        productName: product.name,
        barcode: product.barcode || '',
        uoa: uoaLabel,
        qta: initialQta,
        baseUnitQty: baseQty,
        baseUnitPrice: basePrice,
        requestedQty: initialRequestedQty,
        estimatedPrice: initialEstimatedPrice,
        vatRate: product.vatPurchase !== undefined ? product.vatPurchase : (next[rowIndex].vatRate !== '' ? next[rowIndex].vatRate : formVatRate),
        supplierId: formMainSupplierId || next[rowIndex].supplierId || ''
      };
      return next;
    });
    setActivePopup(null);
  };

  // Open modal to create / edit product
  const handleOpenProductModal = (rowIndex: number, mode: 'create' | 'edit', existingProduct?: Product) => {
    const currentRow = formItems[rowIndex];
    if (mode === 'create') {
      setProductModalState({
        isOpen: true,
        mode: 'create',
        targetRowIndex: rowIndex,
        name: currentRow?.productName || '',
        barcode: currentRow?.barcode || '',
        buyPrice: numVal(currentRow?.estimatedPrice) || 0,
        sellPrice: numVal(currentRow?.estimatedPrice) ? Math.round(numVal(currentRow?.estimatedPrice) * 1.25) : 0,
        vatPurchase: typeof currentRow?.vatRate === 'number' ? currentRow.vatRate : formVatRate,
        category: 'Général'
      });
    } else if (existingProduct) {
      setProductModalState({
        isOpen: true,
        mode: 'edit',
        targetRowIndex: rowIndex,
        productToEdit: existingProduct,
        name: existingProduct.name,
        barcode: existingProduct.barcode || '',
        buyPrice: existingProduct.buyPrice,
        sellPrice: existingProduct.sellPrice,
        vatPurchase: existingProduct.vatPurchase ?? 18,
        category: existingProduct.category
      });
    }
    setActivePopup(null);
  };

  const handleSaveProductFromModal = (e: React.FormEvent) => {
    e.preventDefault();
    const { mode, targetRowIndex, productToEdit, name, barcode, buyPrice, sellPrice, vatPurchase, category } = productModalState;

    if (mode === 'create') {
      const newProd: Product = {
        id: `prod_${Date.now()}`,
        code: `PRD-${Math.floor(100 + Math.random() * 900)}`,
        name,
        barcode,
        buyPrice: Number(buyPrice) || 0,
        sellPrice: Number(sellPrice) || 0,
        vatPurchase: Number(vatPurchase) || 0,
        vatSale: Number(vatPurchase) || 0,
        category: category || 'Général',
        stock: 0,
        minStock: 5,
        unit: 'pièce',
        availableInPOS: true,
        isStockable: true
      };

      if (onAddProduct) {
        onAddProduct(newProd);
      }
      handleSelectProductFromPopup(targetRowIndex, newProd);
    } else if (mode === 'edit' && productToEdit) {
      const updated: Product = {
        ...productToEdit,
        name,
        barcode,
        buyPrice: Number(buyPrice) || 0,
        sellPrice: Number(sellPrice) || 0,
        vatPurchase: Number(vatPurchase) || 0,
        category
      };

      if (onUpdateProduct) {
        onUpdateProduct(updated);
      }
      handleSelectProductFromPopup(targetRowIndex, updated);
    }

    setProductModalState(prev => ({ ...prev, isOpen: false }));
  };

  // Form totals
  const formTotalHT = useMemo(() => {
    return formItems.reduce((sum, item) => {
      return sum + lineAmountQty(item) * numVal(item.estimatedPrice);
    }, 0);
  }, [formItems]);

  const formTotalVAT = useMemo(() => {
    return formItems.reduce((sum, item) => {
      const p = numVal(item.estimatedPrice);
      const lineHT = lineAmountQty(item) * p;
      const vRate = typeof item.vatRate === 'number' || (typeof item.vatRate === 'string' && item.vatRate !== '') 
        ? numVal(item.vatRate) 
        : formVatRate;
      return sum + Math.round(lineHT * (vRate / 100));
    }, 0);
  }, [formItems, formVatRate]);

  const formTotalTTC = formTotalHT + formTotalVAT;

  // Ouvrir la modification d'un bon de commande (uniquement si En cours)
  const handleOpenEditPO = (po: PurchaseOrder) => {
    if (po.status !== 'En cours') {
      setActionWarning("Seuls les bons de commande avec le statut 'En cours' peuvent être modifiés.");
      return;
    }
    setEditingPO(po);
    setFormDate(po.date || new Date().toISOString().split('T')[0]);
    setFormDeadline(po.expectedDate || po.orderDeadline || new Date().toISOString().split('T')[0]);
    setFormBuyer(po.buyer || currentUser?.name || '');
    setFormMainSupplierId(po.supplierId || '');
    setFormVatRate(po.vatRate ?? 18);
    setFormNotes(po.notes || '');

    if (po.items && po.items.length > 0) {
      setFormItems(po.items.map(it => {
        const prod = products.find(p => p.id === it.productId || p.barcode === it.barcode);
        return {
          supplierId: it.supplierId || po.supplierId,
          productId: it.productId,
          barcode: it.barcode || prod?.barcode || '',
          productName: it.productName,
          uoa: it.uoa || '',
          qta: it.qta ?? '',
          baseUnitQty: 1,
          baseUnitPrice: it.unitPrice,
          requestedQty: it.quantity,
          estimatedPrice: it.unitPrice,
          vatRate: it.vatRate ?? (po.vatRate ?? 18)
        };
      }));
    } else {
      setFormItems([]);
    }
    setIsCreatePOModalOpen(true);
  };

  // Dupliquer un bon de commande (uniquement si Validé)
  const handleDuplicatePOClick = (po: PurchaseOrder) => {
    if (po.status !== 'Validé') {
      setActionWarning("Seuls les bons de commande déjà validés peuvent être dupliqués.");
      return;
    }
    if (onDuplicatePurchaseOrder) {
      onDuplicatePurchaseOrder(po);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mainSupplier = suppliers.find(s => s.id === formMainSupplierId) || suppliers[0];
    if (!mainSupplier) return;

    // Filter valid items
    const validItems = formItems.filter(i => (i.productName && i.productName.trim() !== '') || (i.barcode && i.barcode.trim() !== ''));

    const items: PurchaseOrderItem[] = (validItems.length > 0 ? validItems : formItems).map(item => {
      const supp = suppliers.find(s => s.id === item.supplierId) || mainSupplier;
      const q = numVal(item.requestedQty) || numVal(item.qta) || 1;
      const p = numVal(item.estimatedPrice) || 0;
      const vRate = typeof item.vatRate === 'number' || (typeof item.vatRate === 'string' && item.vatRate !== '') ? numVal(item.vatRate) : formVatRate;
      const lineHT = lineAmountQty(item) * p;
      const lineVat = Math.round(lineHT * (vRate / 100));
      const lineTTC = lineHT + lineVat;

      return {
        productId: item.productId || `prod_custom_${Date.now()}`,
        barcode: item.barcode,
        productName: item.productName || 'Article',
        uoa: item.uoa || undefined,
        qta: numVal(item.qta),
        supplierId: supp.id,
        supplierName: supp.name,
        quantity: q,
        unitPrice: p,
        vatRate: vRate,
        vatAmount: lineVat,
        total: lineTTC
      };
    });

    if (editingPO) {
      // Modification du bon de commande en cours
      if (onUpdatePurchaseOrder) {
        onUpdatePurchaseOrder({
          ...editingPO,
          date: formDate,
          buyer: formBuyer,
          orderDeadline: formDeadline,
          expectedDate: formDeadline,
          supplierId: mainSupplier.id,
          supplierName: mainSupplier.name,
          items,
          totalHT: formTotalHT,
          vatRate: formVatRate,
          totalVAT: formTotalVAT,
          totalTTC: formTotalTTC,
          totalAmount: formTotalTTC,
          notes: formNotes
        });
      }
    } else {
      // Nouveau bon de commande
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const seq = String(purchaseOrders.length + 1).padStart(4, '0');
      const newReference = `BC-${yearMonth}-${seq}`;

      onAddPurchaseOrder({
        code: newReference,
        inquiryId: selectedSourceInquiry?.id,
        inquiryCode: selectedSourceInquiry?.code,
        date: formDate,
        buyer: formBuyer,
        orderDeadline: formDeadline,
        expectedDate: formDeadline,
        supplierId: mainSupplier.id,
        supplierName: mainSupplier.name,
        items,
        totalHT: formTotalHT,
        vatRate: formVatRate,
        totalVAT: formTotalVAT,
        totalTTC: formTotalTTC,
        totalAmount: formTotalTTC,
        status: 'En cours',
        paymentStatus: 'Non payé',
        notes: formNotes
      }, selectedSourceInquiry?.id);
    }

    setIsCreatePOModalOpen(false);
    setSelectedSourceInquiry(null);
    setEditingPO(null);
    setFormNotes('');
  };

  // Actions Dropdown: Print Selected POs via hidden iframe
  const handlePrintSelectedPOs = () => {
    setIsActionsDropdownOpen(false);
    const posToPrint = selectedPOIds.length > 0
      ? filteredPOs.filter(p => selectedPOIds.includes(p.id))
      : filteredPOs;

    if (posToPrint.length === 0) return;

    const printDate = new Date().toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const totalCumule = posToPrint.reduce((acc, p) => acc + (p.totalTTC || p.totalAmount || 0), 0);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Liste des Bons de Commande</title>
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
              border-bottom: 2px solid #001F3F;
              padding-bottom: 12px;
              margin-bottom: 20px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .title {
              font-size: 18px;
              font-weight: 800;
              color: #001F3F;
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
              background-color: #001F3F;
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
            .badge-recu {
              background-color: #dbeafe;
              color: #1e40af;
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
              <div class="title">BONS DE COMMANDE GROSSISTE</div>
              <div class="subtitle">GeStock - État récapitulatif • ${posToPrint.length} document(s)</div>
            </div>
            <div style="text-align: right; font-size: 10px; color: #64748b;">
              Édité le : <strong>${printDate}</strong>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 110px;">Référence</th>
                <th style="width: 100px;">Devis lié</th>
                <th style="width: 80px;">Date</th>
                <th>Fournisseur</th>
                <th>Acheteur</th>
                <th style="width: 85px;">Échéance</th>
                <th class="text-right" style="width: 110px;">Total TTC</th>
                <th class="text-center" style="width: 80px;">Statut</th>
              </tr>
            </thead>
            <tbody>
              ${posToPrint.map(p => `
                <tr>
                  <td style="font-family: monospace; font-weight: bold; color: #1e40af;">${p.code}</td>
                  <td style="font-family: monospace; color: #64748b;">${p.inquiryCode || '-'}</td>
                  <td>${p.date}</td>
                  <td><strong>${p.supplierName}</strong></td>
                  <td>${p.buyer || 'Non assigné'}</td>
                  <td>${p.expectedDate || p.orderDeadline || '-'}</td>
                  <td class="text-right" style="font-weight: bold; color: #001F3F;">
                    ${(p.totalTTC || p.totalAmount || 0).toLocaleString('fr-FR')} FCFA
                  </td>
                  <td class="text-center">
                    <span class="badge ${p.status === 'Validé' ? 'badge-valide' : p.status === 'Reçu' ? 'badge-recu' : 'badge-encours'}">
                      ${p.status}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer-summary">
            <div>Total sélectionné : <strong>${posToPrint.length} bon(s) de commande</strong></div>
            <div>Montant cumulé : <strong>${totalCumule.toLocaleString('fr-FR')} FCFA</strong></div>
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
    const listToExport = selectedPOIds.length > 0 
      ? filteredPOs.filter(p => selectedPOIds.includes(p.id)) 
      : filteredPOs;

    if (listToExport.length === 0) return;

    const headers = ['Référence', 'Devis Source', 'Date', 'Acheteur', 'Fournisseur', 'Échéance', 'Total TTC', 'Statut'];
    const rows = listToExport.map(p => [
      `"${p.code}"`,
      `"${p.inquiryCode || ''}"`,
      `"${p.date}"`,
      `"${p.buyer || ''}"`,
      `"${p.supplierName.replace(/"/g, '""')}"`,
      `"${p.expectedDate || p.orderDeadline || ''}"`,
      `"${p.totalTTC || p.totalAmount || 0}"`,
      `"${p.status}"`
    ]);

    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bons_de_commande_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsActionsDropdownOpen(false);
  };

  // Delete handlers
  const handleBulkDelete = () => {
    if (selectedPOIds.length === 0) return;
    if (onDeleteMultiplePurchaseOrders) {
      onDeleteMultiplePurchaseOrders(selectedPOIds);
    } else if (onDeletePurchaseOrder) {
      selectedPOIds.forEach(id => onDeletePurchaseOrder(id));
    }
    setSelectedPOIds([]);
    setConfirmBulkDelete(false);
    setIsActionsDropdownOpen(false);
  };

  const handleDeleteSingle = (po: PurchaseOrder) => {
    if (onDeletePurchaseOrder) {
      onDeletePurchaseOrder(po.id);
    }
    setPoToDelete(null);
    setSelectedPOIds(prev => prev.filter(id => id !== po.id));
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-[#001F3F]">Bons de Commande Fournisseur</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gérez vos commandes d'approvisionnement créées à partir des demandes de prix en cours.
          </p>
        </div>

        <button
          onClick={handleOpenNewPO}
          className="px-4 py-2.5 rounded-xl bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau Bon de Commande</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Bons</span>
            <ClipboardCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-[#001F3F]">{stats.total}</div>
          <p className="text-[11px] text-slate-400 mt-1">Bons de commande émis</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">En cours</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-amber-600">{stats.inProgress}</div>
          <p className="text-[11px] text-slate-400 mt-1">En attente de validation</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Validés</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{stats.validated}</div>
          <p className="text-[11px] text-slate-400 mt-1">Prêts pour réception</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Montant Engagé</span>
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="text-xl font-black text-[#001F3F] truncate">
            {formatFCFA(stats.totalAmount)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Total TTC des commandes</p>
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
              placeholder="Rechercher par Référence, Devis, Fournisseur..."
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
            <option value="Validé">Validé</option>
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
              disabled={filteredPOs.length === 0}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
                selectedPOIds.length > 0 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>Actions</span>
              {selectedPOIds.length > 0 && (
                <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px] font-extrabold">
                  {selectedPOIds.length}
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
                    {selectedPOIds.length > 0 
                      ? `${selectedPOIds.length} sélectionné(s)` 
                      : 'Tous les bons de commande'}
                  </div>

                  {selectedPOIds.length === 1 && (() => {
                    const targetPO = purchaseOrders.find(p => p.id === selectedPOIds[0]);
                    if (!targetPO) return null;
                    if (targetPO.status === 'En cours') {
                      return (
                        <>
                          <button
                            onClick={() => {
                              setIsActionsDropdownOpen(false);
                              setPoForPayment(targetPO);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-emerald-50 flex items-center gap-2 text-emerald-700 font-bold transition-colors border-b border-slate-100"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Valider & Régler le bon</span>
                          </button>
                          <button
                            onClick={() => {
                              setIsActionsDropdownOpen(false);
                              handleOpenEditPO(targetPO);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2 text-blue-700 font-medium transition-colors border-b border-slate-100"
                          >
                            <Edit className="w-4 h-4 text-blue-600" />
                            <span>Modifier ce bon (En cours)</span>
                          </button>
                        </>
                      );
                    } else if (targetPO.status === 'Validé') {
                      return (
                        <button
                          onClick={() => {
                            setIsActionsDropdownOpen(false);
                            handleDuplicatePOClick(targetPO);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-purple-50 flex items-center gap-2 text-purple-700 font-medium transition-colors border-b border-slate-100"
                        >
                          <Copy className="w-4 h-4 text-purple-600" />
                          <span>Dupliquer ce bon (Validé)</span>
                        </button>
                      );
                    }
                    return null;
                  })()}

                  <button
                    onClick={handlePrintSelectedPOs}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium transition-colors"
                  >
                    <Printer className="w-4 h-4 text-purple-600" />
                    <span>Imprimer {selectedPOIds.length > 0 ? `(${selectedPOIds.length})` : ''}</span>
                  </button>

                  <button
                    onClick={handleExportSelectedCSV}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium transition-colors"
                  >
                    <Download className="w-4 h-4 text-emerald-600" />
                    <span>Exporter en CSV</span>
                  </button>

                  {onDeleteMultiplePurchaseOrders && (
                    <button
                      disabled={selectedPOIds.length === 0}
                      onClick={() => {
                        setIsActionsDropdownOpen(false);
                        setConfirmBulkDelete(true);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center gap-2 font-medium transition-colors ${
                        selectedPOIds.length === 0 
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
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </th>

                <th className="py-3.5 px-4 font-bold text-slate-700">Reference</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Date</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Acheteur</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Echéance de commande</th>
                <th className="py-3.5 px-4 font-bold text-slate-700 text-right">Total</th>
                <th className="py-3.5 px-4 font-bold text-slate-700 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredPOs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ClipboardCheck className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-500 text-sm">Aucun bon de commande trouvé</p>
                      <p className="text-xs text-slate-400">
                        Cliquez sur "Nouveau Bon de Commande" pour sélectionner une demande de prix en cours.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPOs.map((po) => {
                  const isSelected = selectedPOIds.includes(po.id);
                  const totalTTC = po.totalTTC || po.totalAmount;

                  return (
                    <tr 
                      key={po.id}
                      onClick={() => setSelectedPODetail(po)}
                      className={`hover:bg-blue-50/40 transition-colors cursor-pointer ${
                        isSelected ? 'bg-blue-50/60' : ''
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <td 
                        className="py-3.5 px-3 text-center"
                        onClick={(e) => handleToggleSelectOne(po.id, e)}
                      >
                        <button className="p-1 rounded text-slate-500 hover:text-[#001F3F]">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </td>

                      {/* Reference (ex: BC-202610-0001) */}
                      <td className="py-3.5 px-4 font-semibold">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 w-fit">
                            {po.code}
                          </span>
                          {po.inquiryCode && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              Devis: {po.inquiryCode}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-slate-600 font-medium whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {po.date}
                        </span>
                      </td>

                      {/* Acheteur */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-bold text-slate-800">
                            {po.buyer || 'Non assigné'}
                          </span>
                        </div>
                      </td>

                      {/* Echéance de commande */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="flex items-center gap-1.5 font-medium text-amber-900 bg-amber-50/80 px-2.5 py-0.5 rounded-md border border-amber-200/80 w-fit">
                          <Clock className="w-3 h-3 text-amber-600" />
                          {po.expectedDate || po.orderDeadline || 'Non définie'}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-black text-[#001F3F] text-sm">
                          {formatFCFA(totalTTC)}
                        </span>
                      </td>

                      {/* Statut (En cours, Validé ou Reçu) */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          po.status === 'Validé'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : po.status === 'Reçu'
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : 'bg-amber-100 text-amber-800 border-amber-200'
                        }`}>
                          {po.status === 'Validé' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : po.status === 'Reçu' ? (
                            <PackageCheck className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                          )}
                          <span>{po.status}</span>
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
            Affichage de <strong>{filteredPOs.length}</strong> sur <strong>{purchaseOrders.length}</strong> bon(s) de commande
            {selectedPOIds.length > 0 && (
              <span className="ml-2 font-semibold text-blue-700">
                • {selectedPOIds.length} sélectionné(s)
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span>
              Total cumulé : <strong className="text-slate-900">{formatFCFA(stats.totalAmount)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* MODAL 1 : Sélectionner une demande de prix en cours */}
      {isSelectInquiryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 my-4">
            <div className="flex items-center justify-between p-4 bg-[#001F3F] text-white">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-300" />
                <h3 className="text-base font-bold">Sélectionner une Demande de Prix en cours</h3>
              </div>
              <button
                onClick={() => setIsSelectInquiryModalOpen(false)}
                className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600">
                Pour créer un bon de commande, sélectionnez la demande de prix en cours concernée. 
                Ses articles seront automatiquement importés et vous pourrez les modifier avant validation.
              </p>

              {/* Search bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher par N° Devis, Fournisseur, Acheteur..."
                  value={inquirySearchTerm}
                  onChange={(e) => setInquirySearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 text-slate-800 placeholder-slate-400 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* List of pending inquiries */}
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {filteredPendingInquiries.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 space-y-3">
                    <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                    <p className="font-bold text-slate-700">Aucune demande de prix en cours disponible</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Toutes les demandes de prix sont déjà validées ou aucune n'a été créée. 
                      Veuillez d'abord créer une demande de prix pour pouvoir générer un bon de commande.
                    </p>
                    {onNavigateToDemandePrix && (
                      <button
                        onClick={() => {
                          setIsSelectInquiryModalOpen(false);
                          onNavigateToDemandePrix();
                        }}
                        className="px-4 py-2 rounded-xl bg-[#001F3F] text-white font-bold hover:bg-blue-900 transition-colors inline-flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Créer une Demande de Prix</span>
                      </button>
                    )}
                  </div>
                ) : (
                  filteredPendingInquiries.map((inq) => {
                    const totalTTC = inq.totalTTC || (inq.totalHT ? inq.totalHT + (inq.totalVAT || 0) : 0);
                    return (
                      <div
                        key={inq.id}
                        onClick={() => handleSelectInquiryForPO(inq)}
                        className="p-4 hover:bg-blue-50/50 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {inq.code}
                            </span>
                            <span className="font-bold text-slate-900 text-sm">
                              {inq.supplierName}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-3">
                            <span>Date: {inq.date}</span>
                            <span>•</span>
                            <span>Acheteur: {inq.buyer || '—'}</span>
                            <span>•</span>
                            <span>Échéance: {inq.orderDeadline || 'Non définie'}</span>
                            <span>•</span>
                            <span>{inq.items.length} article(s)</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 justify-between sm:justify-end">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Total estimé</span>
                            <span className="font-black text-[#001F3F] text-sm">
                              {formatFCFA(totalTTC)}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs"
                          >
                            <span>Choisir</span>
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
                onClick={() => setIsSelectInquiryModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2 : Fiche Nouveau Bon de Commande (conçue exactement comme la demande de prix) */}
      {isCreatePOModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-[96vw] 2xl:max-w-[1550px] shadow-2xl overflow-hidden my-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-[#001F3F] text-white">
              <div className="flex items-center gap-3">
                <ClipboardCheck className="w-5 h-5 text-blue-300" />
                <h3 className="text-base font-bold">
                  {editingPO ? `Modifier le Bon de Commande : ${editingPO.code}` : 'Nouveau Bon de Commande'}
                </h3>
                {editingPO && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                    Statut : En cours
                  </span>
                )}
                {selectedSourceInquiry && !editingPO && (
                  <span className="font-mono text-xs bg-blue-500/30 text-blue-200 px-2.5 py-0.5 rounded-md border border-blue-400/30">
                    Issu de la demande de prix: {selectedSourceInquiry.code}
                  </span>
                )}
              </div>
              <button 
                onClick={() => {
                  setIsCreatePOModalOpen(false);
                  setEditingPO(null);
                }} 
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-5 text-xs max-h-[85vh] overflow-y-auto">
              
              {/* Notice informative sur le devis source et la modification */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-blue-900 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    {editingPO
                      ? "Vous modifiez ce bon de commande actuellement en cours. Vous pouvez ajuster les quantités, prix, articles et dates avant de le valider."
                      : "Vous pouvez modifier les quantités, les UOA, les prix, et ajouter ou retirer des articles. À l'enregistrement, ce bon de commande sera créé au statut 'En cours'."}
                  </span>
                </div>
              </div>

              {/* Entête : Acheteur & Fournisseur unique à gauche, Date et Échéance à droite */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {/* Gauche : Acheteur & Fournisseur unique */}
                <div className="space-y-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      Acheteur Responsable *
                    </label>
                    <input
                      type="text"
                      required
                      value={formBuyer}
                      onChange={(e) => setFormBuyer(e.target.value)}
                      placeholder="Nom de l'acheteur"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      Fournisseur unique
                    </label>
                    <select
                      value={formMainSupplierId}
                      onChange={(e) => {
                        const newSuppId = e.target.value;
                        setFormMainSupplierId(newSuppId);
                        setFormItems(prev => prev.map(item => ({ ...item, supplierId: newSuppId })));
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- Sélectionner un fournisseur --</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.contactPerson})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Droite : Date et Échéance */}
                <div className="space-y-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" /> Date du Bon *
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
                      <Clock className="w-3.5 h-3.5 text-amber-600" /> Échéance de livraison *
                    </label>
                    <input
                      type="date"
                      required
                      value={formDeadline}
                      onChange={(e) => setFormDeadline(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Tableau : Liste articles */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-purple-600" />
                    Liste articles à commander
                  </label>
                </div>

                <div className="overflow-x-visible border border-slate-200 rounded-xl shadow-2xs bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                        <th className="py-2.5 px-3">Fournisseur</th>
                        <th className="py-2.5 px-3">Code barre</th>
                        <th className="py-2.5 px-3">Désignation</th>
                        <th className="py-2.5 px-2.5 text-center">UOA</th>
                        <th className="py-2.5 px-2.5 text-center">Qta</th>
                        <th className="py-2.5 px-3 text-center">Quantité</th>
                        <th className="py-2.5 px-3 text-right">Prix unitaire</th>
                        <th className="py-2.5 px-3 text-center">TVA (%)</th>
                        <th className="py-2.5 px-3 text-right">Montant</th>
                        <th className="py-2.5 px-2 text-center w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formItems.map((item, index) => {
                        const p = numVal(item.estimatedPrice);
                        const vRate = typeof item.vatRate === 'number' || (typeof item.vatRate === 'string' && item.vatRate !== '')
                          ? numVal(item.vatRate)
                          : formVatRate;
                        const lineHT = lineAmountQty(item) * p;
                        const lineVat = Math.round(lineHT * (vRate / 100));
                        const lineTTC = lineHT + lineVat;

                        const rowProduct = products.find(prod => prod.id === item.productId) ||
                                           products.find(prod => prod.name === item.productName) ||
                                           products.find(prod => prod.barcode && prod.barcode === item.barcode);
                        const productUoaOptions = getProductUoaList(rowProduct);

                        const isBarcodePopupActive = activePopup?.rowIndex === index && activePopup?.field === 'barcode';
                        const isNamePopupActive = activePopup?.rowIndex === index && activePopup?.field === 'productName';

                        const barcodeFilterValue = (item.barcode || '').trim().toLowerCase();
                        const nameFilterValue = (item.productName || '').trim().toLowerCase();

                        const filteredProductsForBarcode = products.filter(prod => {
                          if (!barcodeFilterValue) return true;
                          return (prod.barcode && prod.barcode.toLowerCase().includes(barcodeFilterValue)) ||
                                 prod.name.toLowerCase().includes(barcodeFilterValue);
                        });

                        const filteredProductsForName = products.filter(prod => {
                          if (!nameFilterValue) return true;
                          return prod.name.toLowerCase().includes(nameFilterValue) ||
                                 (prod.barcode && prod.barcode.toLowerCase().includes(nameFilterValue));
                        });

                        return (
                          <tr key={index} className="hover:bg-slate-50 relative">
                            {/* Fournisseur */}
                            <td className="py-2.5 px-2.5">
                              <select
                                value={item.supplierId || formMainSupplierId}
                                onChange={(e) => handleFormItemChange(index, 'supplierId', e.target.value)}
                                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium text-xs max-w-[160px]"
                              >
                                <option value="">-- Fournisseur --</option>
                                {suppliers.map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            </td>

                            {/* Code barre avec Popup */}
                            <td className="py-2.5 px-2.5 relative">
                              <input
                                type="text"
                                value={item.barcode}
                                onChange={(e) => handleFormItemChange(index, 'barcode', e.target.value)}
                                onFocus={() => setActivePopup({ rowIndex: index, field: 'barcode' })}
                                placeholder="Code barre"
                                className="w-32 px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-mono text-[11px] text-slate-700 focus:outline-none focus:border-blue-500"
                              />

                              {isBarcodePopupActive && (
                                <div 
                                  ref={popupRef}
                                  className="absolute left-2.5 top-full mt-1 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-2 text-xs animate-in fade-in zoom-in-95"
                                >
                                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 text-[11px] font-bold text-slate-500">
                                    <span className="flex items-center gap-1">
                                      <Barcode className="w-3.5 h-3.5 text-blue-600" />
                                      Produits correspondants
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      {filteredProductsForBarcode.length} résultat(s)
                                    </span>
                                  </div>

                                  <div className="max-h-48 overflow-y-auto space-y-1">
                                    {filteredProductsForBarcode.length === 0 ? (
                                      <p className="text-center py-2 text-slate-400 text-xs">Aucun produit trouvé</p>
                                    ) : (
                                      filteredProductsForBarcode.map(prod => (
                                        <div
                                          key={prod.id}
                                          className="flex items-center justify-between p-1.5 hover:bg-blue-50 rounded-lg group"
                                        >
                                          <button
                                            type="button"
                                            onClick={() => handleSelectProductFromPopup(index, prod)}
                                            className="flex-1 text-left"
                                          >
                                            <div className="font-bold text-slate-800 text-xs group-hover:text-blue-700">
                                              {prod.name}
                                            </div>
                                            <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                              <span className="font-mono">{prod.barcode || 'Sans code'}</span>
                                              <span>•</span>
                                              <span className="font-semibold text-blue-700">{formatFCFA(prod.buyPrice)}</span>
                                            </div>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenProductModal(index, 'edit', prod);
                                            }}
                                            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-white"
                                            title="Modifier ce produit"
                                          >
                                            <Edit className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ))
                                    )}
                                  </div>

                                  <div className="pt-2 mt-1 border-t border-slate-100">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenProductModal(index, 'create')}
                                      className="w-full py-1.5 px-2.5 rounded-lg bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Créer "{item.barcode ? item.barcode : 'Nouveau produit'}"</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* Désignation avec Popup */}
                            <td className="py-2.5 px-2.5 relative">
                              <input
                                type="text"
                                value={item.productName}
                                onChange={(e) => handleFormItemChange(index, 'productName', e.target.value)}
                                onFocus={() => setActivePopup({ rowIndex: index, field: 'productName' })}
                                placeholder="Désignation de l'article"
                                className="w-48 sm:w-64 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
                              />

                              {isNamePopupActive && (
                                <div 
                                  ref={popupRef}
                                  className="absolute left-2.5 top-full mt-1 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-2 text-xs animate-in fade-in zoom-in-95"
                                >
                                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 text-[11px] font-bold text-slate-500">
                                    <span className="flex items-center gap-1">
                                      <Package className="w-3.5 h-3.5 text-blue-600" />
                                      Articles trouvés
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      {filteredProductsForName.length} résultat(s)
                                    </span>
                                  </div>

                                  <div className="max-h-48 overflow-y-auto space-y-1">
                                    {filteredProductsForName.length === 0 ? (
                                      <p className="text-center py-2 text-slate-400 text-xs">Aucun article trouvé</p>
                                    ) : (
                                      filteredProductsForName.map(prod => (
                                        <div
                                          key={prod.id}
                                          className="flex items-center justify-between p-1.5 hover:bg-blue-50 rounded-lg group"
                                        >
                                          <button
                                            type="button"
                                            onClick={() => handleSelectProductFromPopup(index, prod)}
                                            className="flex-1 text-left"
                                          >
                                            <div className="font-bold text-slate-800 text-xs group-hover:text-blue-700">
                                              {prod.name}
                                            </div>
                                            <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                              <span className="font-semibold text-blue-700">{formatFCFA(prod.buyPrice)}</span>
                                              <span>•</span>
                                              <span className="text-slate-400">{prod.category}</span>
                                            </div>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenProductModal(index, 'edit', prod);
                                            }}
                                            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-white"
                                            title="Modifier ce produit"
                                          >
                                            <Edit className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ))
                                    )}
                                  </div>

                                  <div className="pt-2 mt-1 border-t border-slate-100">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenProductModal(index, 'create')}
                                      className="w-full py-1.5 px-2.5 rounded-lg bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Créer "{item.productName ? item.productName : 'Nouveau produit'}"</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* UOA */}
                            <td className="py-2.5 px-2.5 text-center">
                              <select
                                value={item.uoa}
                                onChange={(e) => handleFormItemChange(index, 'uoa', e.target.value)}
                                className="w-28 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold text-xs text-center focus:outline-none focus:border-blue-500"
                              >
                                <option value="">-- UOA --</option>
                                {productUoaOptions.length > 0 ? (
                                  productUoaOptions.map(u => (
                                    <option key={u.id || u.label} value={u.label}>
                                      {u.label} (qté {u.quantity})
                                    </option>
                                  ))
                                ) : (
                                  STORAGE_CONTAINER_UNITS.map(u => (
                                    <option key={u} value={u}>{u}</option>
                                  ))
                                )}
                              </select>
                            </td>

                            {/* Qta */}
                            <td className="py-2.5 px-2 text-center">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={item.qta}
                                onChange={(e) => handleFormItemChange(index, 'qta', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                                placeholder="1"
                                className="w-16 px-2 py-1.5 bg-blue-50/50 border border-blue-200 rounded-lg text-blue-900 font-black text-center text-xs focus:outline-none focus:border-blue-500"
                                title="Quantité d'UOA (Qta)"
                              />
                            </td>

                            {/* Quantité */}
                            <td className="py-2.5 px-2.5 text-center">
                              <input
                                type="number"
                                min="0"
                                value={item.requestedQty}
                                onChange={(e) => handleFormItemChange(index, 'requestedQty', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                                placeholder="0"
                                className="w-20 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-bold text-center text-xs focus:outline-none focus:border-blue-500"
                              />
                            </td>

                            {/* Prix unitaire */}
                            <td className="py-2.5 px-2.5 text-right">
                              <input
                                type="number"
                                min="0"
                                value={item.estimatedPrice}
                                onChange={(e) => handleFormItemChange(index, 'estimatedPrice', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                                placeholder="0"
                                className="w-28 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-semibold text-right text-xs focus:outline-none focus:border-blue-500"
                              />
                            </td>

                            {/* TVA (%) */}
                            <td className="py-2.5 px-2.5 text-center">
                              <div className="inline-flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.5"
                                  placeholder="0"
                                  value={item.vatRate}
                                  onChange={(e) => {
                                    handleFormItemChange(index, 'vatRate', e.target.value === '' ? '' : Number(e.target.value));
                                  }}
                                  className="w-16 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-bold text-xs text-center focus:outline-none focus:border-blue-500"
                                />
                                <span className="text-slate-400 font-bold">%</span>
                              </div>
                            </td>

                            {/* Montant */}
                            <td className="py-2.5 px-2.5 text-right font-black text-slate-900 whitespace-nowrap">
                              {formatFCFA(lineTTC)}
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
                      {/* Total HT - Bouton Ajouter un produit sur la même ligne */}
                      <tr className="bg-slate-50 font-bold border-t border-slate-200">
                        <td colSpan={7} className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={handleAddProductRow}
                            className="px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs inline-flex items-center gap-1.5 transition-all border border-blue-200 shadow-2xs hover:shadow-xs active:scale-95"
                          >
                            <Plus className="w-4 h-4 text-blue-600" />
                            <span>Ajouter un produit</span>
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-right uppercase text-[10px] text-slate-500 whitespace-nowrap">
                          Total HT :
                        </td>
                        <td className="py-2.5 px-3 text-right text-sm font-black text-blue-900 whitespace-nowrap">
                          {formatFCFA(formTotalHT)}
                        </td>
                        <td></td>
                      </tr>

                      {/* Taux TVA (%) : somme des taxes */}
                      <tr className="bg-slate-50 font-bold border-t border-slate-100">
                        <td colSpan={7} className="py-2 px-3"></td>
                        <td className="py-2 px-3 text-right uppercase text-[10px] text-slate-500 whitespace-nowrap">
                          Taux TVA (%) :
                        </td>
                        <td className="py-2 px-3 text-right text-sm font-black text-purple-900 whitespace-nowrap">
                          {formatFCFA(formTotalVAT)}
                        </td>
                        <td></td>
                      </tr>

                      {/* Total TTC */}
                      <tr className="bg-slate-50 font-bold border-t border-slate-200">
                        <td colSpan={7} className="py-2.5 px-3"></td>
                        <td className="py-2.5 px-3 text-right uppercase text-[10px] text-slate-600 whitespace-nowrap">
                          Total TTC :
                        </td>
                        <td className="py-2.5 px-3 text-right text-base font-black text-emerald-900 whitespace-nowrap">
                          {formatFCFA(formTotalTTC)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Remarques */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Remarques & Consignes de livraison
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Instructions de livraison ou commentaires..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatePOModalOpen(false);
                    setEditingPO(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#001F3F] hover:bg-blue-900 text-white font-bold transition-all shadow-sm flex items-center gap-2 active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{editingPO ? 'Enregistrer les modifications' : 'Enregistrer le Bon de Commande'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3 : Fiche Détail de Bon de Commande */}
      {selectedPODetail && (
        <BonCommandeDetailModal
          po={selectedPODetail}
          supplier={suppliers.find(s => s.id === selectedPODetail.supplierId)}
          inquiry={inquiries.find(i => i.id === selectedPODetail.inquiryId || i.code === selectedPODetail.inquiryCode)}
          companyConfig={companyConfig}
          onClose={() => setSelectedPODetail(null)}
          onValidatePO={(poToVal) => {
            // Ouvrir la fiche de règlement et mode de paiement
            setPoForPayment(poToVal);
          }}
          onReceiveGoods={(poToRec) => {
            setSelectedPODetail(null);
            onReceiveGoods(poToRec);
          }}
          onEdit={(poToEdit) => {
            setSelectedPODetail(null);
            handleOpenEditPO(poToEdit);
          }}
          onDuplicate={(poToDup) => {
            setSelectedPODetail(null);
            handleDuplicatePOClick(poToDup);
          }}
        />
      )}

      {/* MODAL 4 : Fiche de Règlement & Mode de Paiement Fournisseurs lors de la validation */}
      {poForPayment && (
        <PurchaseOrderPaymentModal
          po={poForPayment}
          suppliers={suppliers}
          onClose={() => setPoForPayment(null)}
          onConfirmValidation={(validatedPO, settlements) => {
            if (onValidatePurchaseOrderWithSettlements) {
              onValidatePurchaseOrderWithSettlements(validatedPO.id, settlements);
            } else if (onUpdatePurchaseOrderStatus) {
              onUpdatePurchaseOrderStatus(validatedPO.id, 'Validé');
            }

            let totalPaid = 0;
            let totalCredit = 0;
            settlements.forEach(s => {
              totalPaid += s.paidAmount;
              totalCredit += s.creditAmount;
            });
            const pStatus: 'Payé' | 'Payé partiellement' | 'Non payé' =
              totalPaid === 0 && totalCredit > 0 ? 'Non payé' : totalPaid > 0 && totalCredit > 0 ? 'Payé partiellement' : 'Payé';

            // Mettre à jour la fiche détail ouverte si c'est ce bon
            setSelectedPODetail(prev => (prev && prev.id === validatedPO.id) ? {
              ...prev,
              status: 'Validé',
              paymentStatus: pStatus,
              settlements
            } : prev);

            setPoForPayment(null);
          }}
        />
      )}

      {/* MODAL PRODUIT (Créer / Modifier déclenché depuis le popup) */}
      {productModalState.isOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-[#001F3F] text-white">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-300" />
                {productModalState.mode === 'create' ? 'Créer un nouveau produit' : 'Modifier le produit'}
              </h4>
              <button
                type="button"
                onClick={() => setProductModalState(prev => ({ ...prev, isOpen: false }))}
                className="p-1 rounded text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProductFromModal} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Désignation du produit *</label>
                <input
                  type="text"
                  required
                  value={productModalState.name}
                  onChange={(e) => setProductModalState(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="ex: Bière Blonde 50cl"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Code barre / Réf</label>
                <input
                  type="text"
                  value={productModalState.barcode}
                  onChange={(e) => setProductModalState(prev => ({ ...prev, barcode: e.target.value }))}
                  placeholder="ex: 6181100234512"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Prix d'achat (FCFA)</label>
                  <input
                    type="number"
                    min="0"
                    value={productModalState.buyPrice}
                    onChange={(e) => setProductModalState(prev => ({ ...prev, buyPrice: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Prix de vente (FCFA)</label>
                  <input
                    type="number"
                    min="0"
                    value={productModalState.sellPrice}
                    onChange={(e) => setProductModalState(prev => ({ ...prev, sellPrice: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">TVA (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={productModalState.vatPurchase}
                    onChange={(e) => setProductModalState(prev => ({ ...prev, vatPurchase: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Catégorie</label>
                  <input
                    type="text"
                    value={productModalState.category}
                    onChange={(e) => setProductModalState(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="Alimentation, Boissons..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setProductModalState(prev => ({ ...prev, isOpen: false }))}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#001F3F] hover:bg-blue-900 text-white font-bold flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{productModalState.mode === 'create' ? 'Enregistrer le produit' : 'Mettre à jour'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Supprimer un bon de commande */}
      {poToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Supprimer le bon de commande ?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Êtes-vous sûr de vouloir supprimer le bon de commande <strong>{poToDelete.code}</strong> ?
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPoToDelete(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSingle(poToDelete)}
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
              <h3 className="font-bold text-slate-900 text-base">Supprimer les bons sélectionnés ?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Êtes-vous sûr de vouloir supprimer <strong>{selectedPOIds.length}</strong> bon(s) de commande sélectionné(s) ? Cette action est irréversible.
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

    </div>
  );
};
