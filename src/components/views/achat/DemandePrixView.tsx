import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  ArrowRight, 
  X,
  CheckSquare,
  Square,
  Eye,
  Trash2,
  Download,
  Building2,
  Calendar,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  DollarSign,
  User,
  Barcode,
  Percent,
  Package,
  Edit,
  Check,
  Printer,
  Copy,
  AlertTriangle
} from 'lucide-react';
import { PriceInquiry, PriceInquiryItem, Supplier, Product, OperationalUnit, STORAGE_CONTAINER_UNITS, UserAccount } from '../../../types';
import { formatFCFA } from '../../../data/initialData';
import { purchaseLineQty } from '../../../utils/purchaseCalc';
import { DemandePrixDetailModal } from '../../modals/DemandePrixDetailModal';

interface DemandePrixViewProps {
  inquiries: PriceInquiry[];
  suppliers: Supplier[];
  products: Product[];
  onAddInquiry: (inquiry: Omit<PriceInquiry, 'id'>) => void;
  onUpdateInquiry?: (inquiry: PriceInquiry) => void;
  onDuplicateInquiry?: (inquiry: PriceInquiry) => void;
  onConvertToPurchaseOrder: (inquiry: PriceInquiry) => void;
  onDeleteInquiry?: (id: string) => void;
  onDeleteMultipleInquiries?: (ids: string[]) => void;
  onUpdateInquiryStatus?: (id: string, status: PriceInquiry['status']) => void;
  onAddProduct?: (product: Omit<Product, 'id'>) => void;
  onUpdateProduct?: (product: Product) => void;
  currentUser?: UserAccount | null;
}

interface NewInquiryItemForm {
  supplierId: string;
  productId: string;
  barcode: string;
  productName: string;
  uoa: string; // Unité Opérationnelle d'Achat sélectionnée
  qta: number | string; // Nombre d'UOA (Qta)
  baseUnitQty: number; // Quantité unitaire de l'UOA (ex: 6 pour Demi-casier, 12 pour Casier)
  baseUnitPrice: number; // Prix d'achat de base de l'UOA
  requestedQty: number | string; // Quantité totale (Qta * baseUnitQty)
  estimatedPrice: number | string; // Prix unitaire (Qta * baseUnitPrice)
  vatRate: number | string;
}

export const DemandePrixView: React.FC<DemandePrixViewProps> = ({
  inquiries,
  suppliers,
  products,
  onAddInquiry,
  onUpdateInquiry,
  onDuplicateInquiry,
  onConvertToPurchaseOrder,
  onDeleteInquiry,
  onDeleteMultipleInquiries,
  onUpdateInquiryStatus,
  onAddProduct,
  onUpdateProduct,
  currentUser
}) => {
  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');

  // Selected inquiries for batch actions
  const [selectedInquiryIds, setSelectedInquiryIds] = useState<string[]>([]);
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);

  // Modals state
  const [detailInquiry, setDetailInquiry] = useState<PriceInquiry | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingInquiry, setEditingInquiry] = useState<PriceInquiry | null>(null);
  const [inquiryToDelete, setInquiryToDelete] = useState<PriceInquiry | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [actionWarning, setActionWarning] = useState<string | null>(null);

  // Suggestion de réapprovisionnement (produits sous seuil)
  const [isReapproOpen, setIsReapproOpen] = useState(false);
  const [reapproSupplierId, setReapproSupplierId] = useState('');
  const [reapproRows, setReapproRows] = useState<{
    product: Product;
    suggestedQty: number;
    qty: number;
    selected: boolean;
  }[]>([]);

  // Form state for creating/editing an inquiry
  const [formDate, setFormDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [formDeadline, setFormDeadline] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [formBuyer, setFormBuyer] = useState<string>(currentUser?.name || '');
  // Le champ "Fournisseur unique" doit être vide lors de l'ouverture
  const [formMainSupplierId, setFormMainSupplierId] = useState<string>('');
  const [formVatRate, setFormVatRate] = useState<number>(18);
  const [formNotes, setFormNotes] = useState<string>('');

  // Initial form items - start with empty values or one empty row
  const [formItems, setFormItems] = useState<NewInquiryItemForm[]>([
    {
      supplierId: '',
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

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setActivePopup(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper calculation for numbers
  const numVal = (v: number | string | undefined): number => {
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    if (!v) return 0;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  };

  // Base de calcul du montant HT (règle partagée, cf. utils/purchaseCalc) :
  // Qta > 0 → Qta × prix par UOA ; sinon → Quantité × prix unitaire.
  const lineAmountQty = purchaseLineQty;

  // Calculations for form items
  const formTotalHT = useMemo(() => {
    return formItems.reduce((sum, item) => {
      return sum + lineAmountQty(item) * numVal(item.estimatedPrice);
    }, 0);
  }, [formItems]);

  const formTotalVAT = useMemo(() => {
    return formItems.reduce((sum, item) => {
      const ht = lineAmountQty(item) * numVal(item.estimatedPrice);
      const v = typeof item.vatRate === 'number' || (typeof item.vatRate === 'string' && item.vatRate !== '')
        ? numVal(item.vatRate)
        : formVatRate;
      return sum + Math.round(ht * (v / 100));
    }, 0);
  }, [formItems, formVatRate]);

  const formTotalTTC = useMemo(() => {
    return formTotalHT + formTotalVAT;
  }, [formTotalHT, formTotalVAT]);

  // Statistics
  const stats = useMemo(() => {
    const total = inquiries.length;
    const encours = inquiries.filter(i => i.status === 'En cours').length;
    const valides = inquiries.filter(i => i.status === 'Validé').length;
    const totalEstimated = inquiries.reduce((sum, inquiry) => {
      if (inquiry.totalTTC) return sum + inquiry.totalTTC;
      const inquiryTotal = inquiry.items.reduce(
        (sub, item) => sub + lineAmountQty(item) * numVal(item.estimatedPrice),
        0
      );
      return sum + inquiryTotal;
    }, 0);

    return { total, encours, valides, totalEstimated };
  }, [inquiries]);

  // Filter inquiries
  const filteredInquiries = useMemo(() => {
    return inquiries.filter(inquiry => {
      const matchesSearch = 
        inquiry.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inquiry.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inquiry.buyer && inquiry.buyer.toLowerCase().includes(searchTerm.toLowerCase())) ||
        inquiry.items.some(it => it.productName.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === 'ALL' || inquiry.status === statusFilter;
      const matchesSupplier = supplierFilter === 'ALL' || inquiry.supplierId === supplierFilter;

      return matchesSearch && matchesStatus && matchesSupplier;
    });
  }, [inquiries, searchTerm, statusFilter, supplierFilter]);

  // Selection handling
  const allFilteredSelected = 
    filteredInquiries.length > 0 && 
    filteredInquiries.every(i => selectedInquiryIds.includes(i.id));

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedInquiryIds([]);
    } else {
      setSelectedInquiryIds(filteredInquiries.map(i => i.id));
    }
  };

  const handleToggleSelectOne = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedInquiryIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Helper calculation for total TTC of an inquiry
  const getInquiryTotalTTC = (inquiry: PriceInquiry) => {
    if (inquiry.totalTTC) return inquiry.totalTTC;
    const ht = inquiry.totalHT ?? inquiry.items.reduce((sum, item) => sum + lineAmountQty(item) * numVal(item.estimatedPrice), 0);
    const vat = inquiry.totalVAT ?? Math.round(ht * ((inquiry.vatRate ?? 18) / 100));
    return ht + vat;
  };

  // Status Badge Helper : En cours ou Validé
  const renderStatusBadge = (status: PriceInquiry['status']) => {
    switch (status) {
      case 'Validé':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Validé
          </span>
        );
      case 'En cours':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            En cours
          </span>
        );
    }
  };

  // Batch actions
  const handleExportSelectedCSV = () => {
    const listToExport = inquiries.filter(i => 
      selectedInquiryIds.length > 0 ? selectedInquiryIds.includes(i.id) : true
    );

    const headers = ['Reference', 'Date', 'Acheteur', 'Echeance de commande', 'Total TTC FCFA', 'Statut', 'Fournisseur'];
    const rows = listToExport.map(i => {
      return [
        `"${i.code}"`,
        `"${i.date}"`,
        `"${i.buyer || ''}"`,
        `"${i.orderDeadline || ''}"`,
        getInquiryTotalTTC(i),
        `"${i.status}"`,
        `"${i.supplierName}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `demandes_de_prix_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsActionsDropdownOpen(false);
  };

  const handleBulkDelete = () => {
    if (selectedInquiryIds.length === 0) return;
    const canDeleteIds = selectedInquiryIds.filter(id => {
      const inq = inquiries.find(i => i.id === id);
      return inq?.status !== 'Validé';
    });
    const hasValidated = canDeleteIds.length < selectedInquiryIds.length;
    if (hasValidated) {
      setActionWarning("Certaines demandes sélectionnées sont au statut 'Validé' et ne peuvent pas être supprimées car elles sont déjà associées à un bon de commande.");
    }
    if (canDeleteIds.length > 0) {
      if (onDeleteMultipleInquiries) {
        onDeleteMultipleInquiries(canDeleteIds);
      } else if (onDeleteInquiry) {
        canDeleteIds.forEach(id => onDeleteInquiry(id));
      }
    }
    setSelectedInquiryIds([]);
    setConfirmBulkDelete(false);
    setIsActionsDropdownOpen(false);
  };

  const handleDeleteSingle = (inquiry: PriceInquiry) => {
    if (inquiry.status === 'Validé') {
      setActionWarning(`La demande de prix ${inquiry.code} est validée et associée à un bon de commande. Elle ne peut plus être modifiée ni supprimée.`);
      setInquiryToDelete(null);
      return;
    }
    if (onDeleteInquiry) {
      onDeleteInquiry(inquiry.id);
    }
    setInquiryToDelete(null);
    setSelectedInquiryIds(prev => prev.filter(id => id !== inquiry.id));
  };

  // Ajouter un produit : nouvelle ligne complètement VIDE
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

  const handleRemoveItemRow = (index: number) => {
    setFormItems(formItems.filter((_, idx) => idx !== index));
    if (activePopup?.rowIndex === index) {
      setActivePopup(null);
    }
  };

  // Obtenir la liste des UOA disponibles pour un produit
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
    // Si aucune UOA formelle, utiliser storageUnit ou unit si disponible
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

  const handleFormItemChange = (index: number, field: keyof NewInquiryItemForm, value: any) => {
    setFormItems(prev => {
      const next = [...prev];
      const current = { ...next[index] };

      if (field === 'uoa') {
        // Changement de l'UOA souhaitée pour ce produit
        const chosenUoaLabel = String(value);
        current.uoa = chosenUoaLabel;

        // Trouver le produit associé à la ligne
        const currentProd = products.find(p => p.id === current.productId) || 
                            products.find(p => p.name === current.productName) || 
                            products.find(p => p.barcode && p.barcode === current.barcode);
        
        const availableUoas = getProductUoaList(currentProd);
        const matchedUoa = availableUoas.find(u => u.label === chosenUoaLabel);

        if (matchedUoa) {
          // Quand on sélectionne la valeur UOA souhaitée alors la valeur de Qta devient 1
          const qtaVal = 1;
          const baseQty = matchedUoa.quantity && matchedUoa.quantity > 0 ? matchedUoa.quantity : 1;
          const basePrice = matchedUoa.price && matchedUoa.price > 0 ? matchedUoa.price : (currentProd?.buyPrice || 0);

          current.qta = qtaVal;
          current.baseUnitQty = baseQty;
          current.baseUnitPrice = basePrice;
          current.requestedQty = qtaVal * baseQty; // La quantité du produit selon l'UOA (ex: 6 pour Demi-casier)
          current.estimatedPrice = basePrice; // Prix PAR UOA — le montant est calculé Qta × prix
        } else if (!chosenUoaLabel) {
          // Vide
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

    // If typing in barcode or productName, activate popup
    if (field === 'barcode' || field === 'productName') {
      setActivePopup({ rowIndex: index, field });
    }
  };

  // Sélection d'un produit depuis le popup
  const handleSelectProductFromPopup = (rowIndex: number, product: Product) => {
    // Liste des UOA disponibles pour ce produit
    const uoaList = getProductUoaList(product);
    // Première UOA du produit ou défaut
    const firstUoa = uoaList[0];

    const uoaLabel = firstUoa ? firstUoa.label : (product.storageUnit || product.unit || '');
    const baseQty = firstUoa?.quantity && firstUoa.quantity > 0 ? firstUoa.quantity : 1;
    const basePrice = firstUoa?.price && firstUoa.price > 0 ? firstUoa.price : (product.buyPrice || 0);

    // Qta initialisé à 1 dès la sélection de l'UOA
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
        qta: initialQta, // Valeur de Qta devient 1
        baseUnitQty: baseQty,
        baseUnitPrice: basePrice,
        requestedQty: initialRequestedQty, // Valeur de la Quantité de l'UOA (ex: 6 pour Demi-casier)
        estimatedPrice: initialEstimatedPrice, // Prix unitaire de l'UOA
        vatRate: product.vatPurchase !== undefined ? product.vatPurchase : (next[rowIndex].vatRate !== '' ? next[rowIndex].vatRate : formVatRate),
        supplierId: formMainSupplierId || next[rowIndex].supplierId || ''
      };
      return next;
    });
    // Fermer le popup
    setActivePopup(null);
  };

  // Ouvrir modal de création / modification d'un produit
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

  // Sauvegarder produit créé / modifié
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

      // Auto-remplir la ligne
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

      // Auto-remplir la ligne
      handleSelectProductFromPopup(targetRowIndex, updated);
    }

    setProductModalState(prev => ({ ...prev, isOpen: false }));
  };

  // Ouvrir le formulaire de modification (uniquement pour les demandes "En cours")
  const handleOpenEditInquiry = (inquiry: PriceInquiry) => {
    if (inquiry.status !== 'En cours') {
      setActionWarning("Seules les demandes de prix avec le statut 'En cours' peuvent être modifiées.");
      return;
    }
    setEditingInquiry(inquiry);
    setFormDate(inquiry.date || new Date().toISOString().split('T')[0]);
    setFormDeadline(inquiry.orderDeadline || new Date().toISOString().split('T')[0]);
    setFormBuyer(inquiry.buyer || currentUser?.name || '');
    setFormMainSupplierId(inquiry.supplierId || '');
    setFormVatRate(inquiry.vatRate ?? 18);
    setFormNotes(inquiry.notes || '');

    // Map existing items to form items
    if (inquiry.items && inquiry.items.length > 0) {
      setFormItems(inquiry.items.map(it => {
        const prod = products.find(p => p.id === it.productId || p.barcode === it.barcode);
        return {
          supplierId: it.supplierId || inquiry.supplierId || '',
          productId: it.productId,
          barcode: it.barcode || prod?.barcode || '',
          productName: it.productName,
          uoa: it.uoa || '',
          qta: it.qta ?? '',
          baseUnitQty: 1,
          baseUnitPrice: it.estimatedPrice,
          requestedQty: it.requestedQty,
          estimatedPrice: it.estimatedPrice,
          vatRate: it.vatRate ?? (inquiry.vatRate ?? 18)
        };
      }));
    } else {
      setFormItems([{
        supplierId: '',
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
      }]);
    }
    setIsCreateModalOpen(true);
  };

  // Dupliquer une demande de prix (autorisé pour les demandes déjà validées)
  const handleDuplicateInquiryClick = (inquiry: PriceInquiry) => {
    if (inquiry.status !== 'Validé') {
      setActionWarning("Seules les demandes de prix déjà validées peuvent être dupliquées.");
      return;
    }
    if (onDuplicateInquiry) {
      onDuplicateInquiry(inquiry);
    }
  };

  // Ouvre la suggestion de réappro : produits stockables au/sous le seuil d'alerte
  const openReapproModal = () => {
    const low = products
      .filter(p => p.isStockable !== false && p.stock <= p.minStock)
      .sort((a, b) => (a.stock - a.minStock) - (b.stock - b.minStock));
    if (low.length === 0) {
      setActionWarning('Aucun produit sous le seuil d\'alerte — le stock est sain.');
      return;
    }
    setReapproRows(low.map(p => ({
      product: p,
      // cible : reconstituer à 2× le seuil (au moins 1 unité)
      suggestedQty: Math.max(1, p.minStock * 2 - p.stock),
      qty: Math.max(1, p.minStock * 2 - p.stock),
      selected: true
    })));
    setReapproSupplierId('');
    setIsReapproOpen(true);
  };

  // Pré-remplit le formulaire de DP avec les produits sélectionnés
  const applyReapproToForm = () => {
    const rows = reapproRows.filter(r => r.selected && r.qty > 0);
    if (rows.length === 0) {
      setActionWarning('Sélectionnez au moins un produit avec une quantité > 0.');
      return;
    }
    setEditingInquiry(null);
    setFormMainSupplierId(reapproSupplierId);
    setFormItems(rows.map(r => ({
      supplierId: reapproSupplierId,
      productId: r.product.id,
      barcode: r.product.barcode || '',
      productName: r.product.name,
      uoa: r.product.storageUnit || '',
      qta: r.qty,
      baseUnitQty: 1,
      baseUnitPrice: r.product.buyPrice || 0,
      requestedQty: r.qty,
      estimatedPrice: r.product.buyPrice || 0,
      vatRate: formVatRate
    })));
    setFormNotes(`Réapprovisionnement automatique — ${rows.length} article(s) sous seuil d'alerte`);
    setIsReapproOpen(false);
    setIsCreateModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mainSupplier = suppliers.find(s => s.id === formMainSupplierId) || suppliers[0];
    if (!mainSupplier) return;

    // Filter valid items that have at least a designation or product
    const validItems = formItems.filter(i => (i.productName && i.productName.trim() !== '') || (i.barcode && i.barcode.trim() !== ''));

    const items: PriceInquiryItem[] = (validItems.length > 0 ? validItems : formItems).map(item => {
      const supp = suppliers.find(s => s.id === item.supplierId) || (formMainSupplierId ? suppliers.find(s => s.id === formMainSupplierId) : undefined) || suppliers[0];
      const q = numVal(item.requestedQty) || numVal(item.qta) || 1;
      const p = numVal(item.estimatedPrice) || 0;
      const lineHT = lineAmountQty(item) * p;
      const vRate = typeof item.vatRate === 'number' || (typeof item.vatRate === 'string' && item.vatRate !== '') ? numVal(item.vatRate) : formVatRate;
      const vAmount = Math.round(lineHT * (vRate / 100));
      const tAmount = lineHT + vAmount;
      return {
        productId: item.productId || `prod_${Date.now()}`,
        barcode: item.barcode,
        productName: item.productName || 'Article',
        uoa: item.uoa || undefined,
        qta: numVal(item.qta),
        supplierId: supp?.id,
        supplierName: supp?.name || '',
        requestedQty: q,
        estimatedPrice: p,
        vatRate: vRate,
        vatAmount: vAmount,
        totalAmount: tAmount
      };
    });

    if (editingInquiry) {
      // Modification de la demande de prix existante (statut En cours)
      if (onUpdateInquiry) {
        onUpdateInquiry({
          ...editingInquiry,
          date: formDate,
          buyer: formBuyer,
          orderDeadline: formDeadline,
          supplierId: mainSupplier?.id || '',
          supplierName: mainSupplier?.name || 'Fournisseurs multiples',
          items,
          vatRate: formVatRate,
          totalHT: formTotalHT,
          totalVAT: formTotalVAT,
          totalTTC: formTotalTTC,
          notes: formNotes
        });
      }
    } else {
      // Création d'une nouvelle demande de prix
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const seq = String(inquiries.length + 1).padStart(4, '0');
      const newReference = `DEV-${yearMonth}-${seq}`;

      onAddInquiry({
        code: newReference,
        date: formDate,
        buyer: formBuyer,
        orderDeadline: formDeadline,
        supplierId: mainSupplier?.id || '',
        supplierName: mainSupplier?.name || 'Fournisseurs multiples',
        items,
        vatRate: formVatRate,
        totalHT: formTotalHT,
        totalVAT: formTotalVAT,
        totalTTC: formTotalTTC,
        status: 'En cours',
        notes: formNotes
      });
    }

    setIsCreateModalOpen(false);
    setEditingInquiry(null);
    setFormNotes('');
  };

  // Impression de la liste des demandes de prix sélectionnées (depuis le menu Actions)
  const handlePrintSelectedInquiries = () => {
    setIsActionsDropdownOpen(false);
    const inquiriesToPrint = selectedInquiryIds.length > 0
      ? filteredInquiries.filter(i => selectedInquiryIds.includes(i.id))
      : filteredInquiries;

    if (inquiriesToPrint.length === 0) return;

    const totalBudget = inquiriesToPrint.reduce((acc, inq) => acc + getInquiryTotalTTC(inq), 0);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Liste des Demandes de Prix</title>
          <meta charset="utf-8" />
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 15px;
              font-size: 11px;
              line-height: 1.4;
            }
            .header-bar {
              border-bottom: 2px solid #001F3F;
              padding-bottom: 12px;
              margin-bottom: 15px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .title {
              font-size: 18px;
              font-weight: 800;
              color: #001F3F;
              margin: 0 0 3px 0;
              text-transform: uppercase;
            }
            .subtitle {
              color: #64748b;
              font-size: 11px;
              margin: 0;
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
            tr:nth-child(even) { background-color: #f8fafc; }
            .badge {
              display: inline-block;
              padding: 3px 8px;
              border-radius: 4px;
              font-weight: bold;
              font-size: 10px;
            }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .footer-totals {
              margin-top: 15px;
              float: right;
              font-size: 12px;
              background: #f1f5f9;
              padding: 8px 15px;
              border-radius: 6px;
              font-weight: bold;
              border: 1px solid #cbd5e1;
            }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div>
              <h1 class="title">Tableau de Bord — Demandes de Prix</h1>
              <p class="subtitle">Liste des cotations et consultations sélectionnées (${inquiriesToPrint.length} document(s))</p>
            </div>
            <div style="text-align: right; font-size: 10px; color: #64748b;">
              Date d'impression : <strong>${new Date().toLocaleDateString('fr-FR')}</strong>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 18%;">Référence</th>
                <th style="width: 12%;">Date</th>
                <th style="width: 18%;">Acheteur</th>
                <th style="width: 20%;">Fournisseur</th>
                <th style="width: 14%;">Échéance</th>
                <th class="text-right" style="width: 10%;">Total TTC</th>
                <th class="text-center" style="width: 8%;">Statut</th>
              </tr>
            </thead>
            <tbody>
              ${inquiriesToPrint.map(inq => {
                const total = getInquiryTotalTTC(inq);
                return `
                  <tr>
                    <td><strong>${inq.code}</strong></td>
                    <td>${inq.date}</td>
                    <td>${inq.buyer || '—'}</td>
                    <td>${inq.supplierName || '—'}</td>
                    <td>${inq.orderDeadline || '—'}</td>
                    <td class="text-right"><strong>${total.toLocaleString('fr-FR')} F CFA</strong></td>
                    <td class="text-center">${inq.status}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="footer-totals">
            Total des demandes sélectionnées : <strong>${totalBudget.toLocaleString('fr-FR')} F CFA</strong>
          </div>
        </body>
      </html>
    `;

    const printIframe = document.createElement('iframe');
    printIframe.setAttribute('style', 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;');
    document.body.appendChild(printIframe);
    const printDoc = printIframe.contentWindow?.document;
    if (printDoc) {
      printDoc.open();
      printDoc.write(htmlContent);
      printDoc.close();
      setTimeout(() => {
        try {
          printIframe.contentWindow?.focus();
          printIframe.contentWindow?.print();
        } catch {
          window.print();
        }
        setTimeout(() => {
          if (document.body.contains(printIframe)) {
            document.body.removeChild(printIframe);
          }
        }, 1500);
      }, 350);
    }
  };

  return (
    <div className="space-y-6 pb-14">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#001F3F] tracking-tight">
                Tableau de Bord des Demandes de Prix
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Consultez, comparez et suivez vos cotations tarifaires en liste synthétique.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
        <button
          onClick={openReapproModal}
          title="Génère une demande de prix pré-remplie avec les produits sous seuil d'alerte"
          className="px-4 py-2.5 rounded-xl bg-white hover:bg-amber-50 text-amber-700 border border-amber-300 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Réappro auto</span>
        </button>
        <button
          onClick={() => {
            // Le champ Fournisseur unique doit être vide lors de l'ouverture
            setFormMainSupplierId('');
            // Reset items to empty row on open
            setFormItems([
              {
                supplierId: '',
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
            setIsCreateModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-[#001F3F] hover:bg-blue-950 text-white font-bold text-xs shadow-md shadow-blue-950/10 flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Créer une Demande de Prix</span>
        </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Demandes</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-black text-[#001F3F]">{stats.total}</div>
          <span className="text-[10px] text-slate-400">Toutes références</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">En cours</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-amber-700">{stats.encours}</div>
          <span className="text-[10px] text-amber-600 font-medium">Cotations à traiter</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Validées</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-emerald-700">{stats.valides}</div>
          <span className="text-[10px] text-emerald-600 font-medium">Converties en commande</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Budget Estimé (TTC)</span>
            <DollarSign className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-lg font-black text-slate-900 truncate">
            {formatFCFA(stats.totalEstimated)}
          </div>
          <span className="text-[10px] text-slate-400">Total consultations</span>
        </div>
      </div>

      {/* Toolbar: Search, Filters, Batch Actions */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left: Search & filters */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[240px] max-w-sm flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par Référence, Acheteur, Fournisseur..."
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
              disabled={filteredInquiries.length === 0}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
                selectedInquiryIds.length > 0 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>Actions</span>
              {selectedInquiryIds.length > 0 && (
                <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px] font-extrabold">
                  {selectedInquiryIds.length}
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
                    {selectedInquiryIds.length > 0 
                      ? `${selectedInquiryIds.length} sélectionnée(s)` 
                      : 'Toutes les demandes'}
                  </div>

                  {selectedInquiryIds.length === 1 && (() => {
                    const targetInq = inquiries.find(i => i.id === selectedInquiryIds[0]);
                    if (!targetInq) return null;
                    if (targetInq.status === 'En cours') {
                      return (
                        <button
                          onClick={() => {
                            setIsActionsDropdownOpen(false);
                            handleOpenEditInquiry(targetInq);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2 text-blue-700 font-medium transition-colors border-b border-slate-100"
                        >
                          <Edit className="w-4 h-4 text-blue-600" />
                          <span>Modifier cette demande (En cours)</span>
                        </button>
                      );
                    } else if (targetInq.status === 'Validé') {
                      return (
                        <button
                          onClick={() => {
                            setIsActionsDropdownOpen(false);
                            handleDuplicateInquiryClick(targetInq);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-purple-50 flex items-center gap-2 text-purple-700 font-medium transition-colors border-b border-slate-100"
                        >
                          <Copy className="w-4 h-4 text-purple-600" />
                          <span>Dupliquer cette demande (Validée)</span>
                        </button>
                      );
                    }
                    return null;
                  })()}

                  <button
                    onClick={handlePrintSelectedInquiries}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium transition-colors"
                  >
                    <Printer className="w-4 h-4 text-purple-600" />
                    <span>Imprimer {selectedInquiryIds.length > 0 ? `(${selectedInquiryIds.length})` : ''}</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsActionsDropdownOpen(false);
                      handleExportSelectedCSV();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium transition-colors"
                  >
                    <Download className="w-4 h-4 text-emerald-600" />
                    <span>Exporter en CSV</span>
                  </button>

                  {onDeleteMultipleInquiries && (
                    <button
                      disabled={selectedInquiryIds.length === 0}
                      onClick={() => {
                        setIsActionsDropdownOpen(false);
                        setConfirmBulkDelete(true);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center gap-2 font-medium transition-colors ${
                        selectedInquiryIds.length === 0 
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
              {filteredInquiries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-500 text-sm">Aucune demande de prix trouvée</p>
                      <p className="text-xs text-slate-400">
                        Modifiez votre recherche ou créez une nouvelle demande de prix.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInquiries.map((inquiry) => {
                  const isSelected = selectedInquiryIds.includes(inquiry.id);
                  const totalTTC = getInquiryTotalTTC(inquiry);

                  return (
                    <tr 
                      key={inquiry.id}
                      onClick={() => setDetailInquiry(inquiry)}
                      className={`hover:bg-blue-50/40 transition-colors cursor-pointer ${
                        isSelected ? 'bg-blue-50/60' : ''
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <td 
                        className="py-3.5 px-3 text-center"
                        onClick={(e) => handleToggleSelectOne(inquiry.id, e)}
                      >
                        <button className="p-1 rounded text-slate-500 hover:text-[#001F3F]">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </td>

                      {/* Reference (ex: DEV-202610-0001) */}
                      <td className="py-3.5 px-4 font-semibold">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                            {inquiry.code}
                          </span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-slate-600 font-medium whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {inquiry.date}
                        </span>
                      </td>

                      {/* Acheteur */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-bold text-slate-800">
                            {inquiry.buyer || 'Non assigné'}
                          </span>
                        </div>
                      </td>

                      {/* Echéance de commande */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="flex items-center gap-1.5 font-medium text-amber-900 bg-amber-50/80 px-2.5 py-0.5 rounded-md border border-amber-200/80 w-fit">
                          <Clock className="w-3 h-3 text-amber-600" />
                          {inquiry.orderDeadline || 'Non définie'}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-black text-[#001F3F] text-sm">
                          {formatFCFA(totalTTC)}
                        </span>
                      </td>

                      {/* Statut */}
                      <td className="py-3.5 px-4 text-center">
                        {renderStatusBadge(inquiry.status)}
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
            Affichage de <strong>{filteredInquiries.length}</strong> sur <strong>{inquiries.length}</strong> demande(s) de prix
            {selectedInquiryIds.length > 0 && (
              <span className="ml-2 font-semibold text-blue-700">
                • {selectedInquiryIds.length} sélectionnée(s)
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span>
              Total cumulé : <strong className="text-slate-900">{formatFCFA(stats.totalEstimated)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Modal Fiche Détail de Demande de Prix */}
      {detailInquiry && (
        <DemandePrixDetailModal
          inquiry={detailInquiry}
          supplier={suppliers.find(s => s.id === detailInquiry.supplierId)}
          onClose={() => setDetailInquiry(null)}
          onConvertToPurchaseOrder={(inquiry) => {
            setDetailInquiry(null);
            onConvertToPurchaseOrder(inquiry);
          }}
          onEdit={(inquiry) => {
            setDetailInquiry(null);
            handleOpenEditInquiry(inquiry);
          }}
          onDuplicate={(inquiry) => {
            setDetailInquiry(null);
            handleDuplicateInquiryClick(inquiry);
          }}
        />
      )}

      {/* Modal Créer une Demande de Prix */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-[96vw] 2xl:max-w-[1550px] shadow-2xl overflow-hidden my-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-[#001F3F] text-white">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-300" />
                  {editingInquiry ? `Modifier la Demande de Prix : ${editingInquiry.code}` : 'Nouvelle Demande de Prix'}
                </h3>
                {editingInquiry && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                    Statut : En cours
                  </span>
                )}
              </div>
              <button 
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingInquiry(null);
                }} 
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-5 text-xs max-h-[85vh] overflow-y-auto">
              
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
                        // Lors de la sélection d'un fournisseur unique, il s'applique à tous les champs fournisseurs des lignes
                        setFormItems(prev => prev.map(item => ({ ...item, supplierId: newSuppId })));
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- Sélectionner un fournisseur (optionnel) --</option>
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
                      <Calendar className="w-3.5 h-3.5 text-slate-400" /> Date *
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
                      <Clock className="w-3.5 h-3.5 text-amber-600" /> Échéance *
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
                    Liste articles
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
                        const vRate = typeof item.vatRate === 'number' || (typeof item.vatRate === 'string' && item.vatRate !== '') ? numVal(item.vatRate) : formVatRate;
                        const lineHT = lineAmountQty(item) * p;
                        const lineVat = Math.round(lineHT * (vRate / 100));
                        const lineTTC = lineHT + lineVat;

                        // Trouver le produit sélectionné pour cette ligne pour charger ses UOA spécifiques
                        const rowProduct = products.find(prod => prod.id === item.productId) ||
                                           products.find(prod => prod.name === item.productName) ||
                                           products.find(prod => prod.barcode && prod.barcode === item.barcode);
                        const productUoaOptions = getProductUoaList(rowProduct);

                        // Filter products for this row's active popup
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

                              {/* POPUP RECHERCHE & CREATION / MODIFICATION PRODUIT (CODE BARRE) */}
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
                                      <div className="p-3 text-center text-slate-400 text-xs">
                                        <Package className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                                        <p>Aucun produit avec ce code barre</p>
                                      </div>
                                    ) : (
                                      filteredProductsForBarcode.map(prod => {
                                        const prodUoaObj = prod.operationalUnits?.find(u => u.type === 'UOA') || prod.uoa;
                                        const prodUoaLabel = prodUoaObj?.label || prodUoaObj?.name || prod.storageUnit || prod.unit;
                                        const prodPrice = prodUoaObj?.price && prodUoaObj.price > 0 ? prodUoaObj.price : prod.buyPrice;
                                        const prodQty = prodUoaObj?.quantity && prodUoaObj.quantity > 0 ? prodUoaObj.quantity : 1;

                                        return (
                                          <div
                                            key={prod.id}
                                            className="p-2 rounded-lg hover:bg-blue-50/80 flex items-center justify-between group transition-colors border border-transparent hover:border-blue-200"
                                          >
                                            <button
                                              type="button"
                                              onClick={() => handleSelectProductFromPopup(index, prod)}
                                              className="text-left flex-1"
                                            >
                                              <div className="font-bold text-slate-900 group-hover:text-blue-700">
                                                {prod.name}
                                              </div>
                                              <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                                                <span className="font-mono bg-slate-100 px-1 py-0.2 rounded">
                                                  {prod.barcode || 'Sans code'}
                                                </span>
                                                <span>•</span>
                                                <span className="font-bold text-emerald-700">
                                                  {formatFCFA(prodPrice)}
                                                </span>
                                                {prodUoaLabel && (
                                                  <>
                                                    <span>•</span>
                                                    <span className="px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 font-semibold border border-purple-200 text-[10px]">
                                                      UOA: {prodUoaLabel} (qté {prodQty})
                                                    </span>
                                                  </>
                                                )}
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
                                        );
                                      })
                                    )}
                                  </div>

                                  {/* Bouton Créer / Modifier produit */}
                                  <div className="pt-2 mt-1 border-t border-slate-100">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenProductModal(index, 'create')}
                                      className="w-full py-1.5 px-2.5 rounded-lg bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>
                                        Créer "{item.barcode ? item.barcode : 'Nouveau produit'}"
                                      </span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* Désignation avec Popup */}
                            <td className="py-2.5 px-2.5 min-w-[220px] relative">
                              <input
                                type="text"
                                value={item.productName}
                                onChange={(e) => handleFormItemChange(index, 'productName', e.target.value)}
                                onFocus={() => setActivePopup({ rowIndex: index, field: 'productName' })}
                                placeholder="Désignation de l'article"
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold text-xs focus:outline-none focus:border-blue-500"
                              />

                              {/* POPUP RECHERCHE & CREATION / MODIFICATION PRODUIT (DESIGNATION) */}
                              {isNamePopupActive && (
                                <div 
                                  ref={popupRef}
                                  className="absolute left-2.5 top-full mt-1 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-2 text-xs animate-in fade-in zoom-in-95"
                                >
                                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 text-[11px] font-bold text-slate-500">
                                    <span className="flex items-center gap-1">
                                      <Package className="w-3.5 h-3.5 text-blue-600" />
                                      Sélectionner un produit existant
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      {filteredProductsForName.length} disponible(s)
                                    </span>
                                  </div>

                                  <div className="max-h-48 overflow-y-auto space-y-1">
                                    {filteredProductsForName.length === 0 ? (
                                      <div className="p-3 text-center text-slate-400 text-xs">
                                        <Package className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                                        <p>Aucun produit ne correspond à cette désignation</p>
                                      </div>
                                    ) : (
                                      filteredProductsForName.map(prod => {
                                        const prodUoaObj = prod.operationalUnits?.find(u => u.type === 'UOA') || prod.uoa;
                                        const prodUoaLabel = prodUoaObj?.label || prodUoaObj?.name || prod.storageUnit || prod.unit;
                                        const prodPrice = prodUoaObj?.price && prodUoaObj.price > 0 ? prodUoaObj.price : prod.buyPrice;
                                        const prodQty = prodUoaObj?.quantity && prodUoaObj.quantity > 0 ? prodUoaObj.quantity : 1;

                                        return (
                                          <div
                                            key={prod.id}
                                            className="p-2 rounded-lg hover:bg-blue-50/80 flex items-center justify-between group transition-colors border border-transparent hover:border-blue-200"
                                          >
                                            <button
                                              type="button"
                                              onClick={() => handleSelectProductFromPopup(index, prod)}
                                              className="text-left flex-1"
                                            >
                                              <div className="font-bold text-slate-900 group-hover:text-blue-700">
                                                {prod.name}
                                              </div>
                                              <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                                                <span className="font-mono bg-slate-100 px-1 py-0.2 rounded">
                                                  {prod.barcode || 'Sans code barre'}
                                                </span>
                                                <span>•</span>
                                                <span className="font-bold text-emerald-700">
                                                  {formatFCFA(prodPrice)}
                                                </span>
                                                {prodUoaLabel && (
                                                  <>
                                                    <span>•</span>
                                                    <span className="px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 font-semibold border border-purple-200 text-[10px]">
                                                      UOA: {prodUoaLabel} (qté {prodQty})
                                                    </span>
                                                  </>
                                                )}
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
                                        );
                                      })
                                    )}
                                  </div>

                                  {/* Bouton Créer / Modifier produit */}
                                  <div className="pt-2 mt-1 border-t border-slate-100">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenProductModal(index, 'create')}
                                      className="w-full py-1.5 px-2.5 rounded-lg bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>
                                        Créer "{item.productName ? item.productName : 'Nouveau produit'}"
                                      </span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* UOA (rempli avec les UOA du produit concerné) */}
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

                            {/* Qta (quantité d'UOA commandée, ex: 1, 2, 3...) */}
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

                            {/* Quantité (Qta * Quantité de l'UOA) */}
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

                            {/* Prix unitaire (Qta * Prix de base de l'UOA) */}
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

                            {/* TVA (champ de saisie numérique libre) */}
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
                      {/* Total HT - Avec le bouton 'Ajouter un produit' sur la même ligne à gauche */}
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

                      {/* Taux TVA (%) : la somme du montant des taxes */}
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

                      {/* Total TTC - sous Taux TVA (%) avec le même style aligné du haut vers le bas */}
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

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingInquiry(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#001F3F] hover:bg-blue-900 text-white font-bold transition-all shadow-sm flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingInquiry ? 'Enregistrer les modifications' : 'Créer la Demande de Prix'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Créer / Modifier Produit (déclenché depuis le popup de saisie) */}
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
                  placeholder="ex: Riz Parfumé 25kg"
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
                  <label className="block font-bold text-slate-700 mb-1">Prix d'achat (FCFA) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={productModalState.buyPrice}
                    onChange={(e) => setProductModalState(prev => ({ ...prev, buyPrice: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Prix de vente estimé</label>
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
                    placeholder="Alimentation, Hygiène..."
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

      {/* Confirmation Supprimer une demande */}
      {inquiryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Supprimer la demande ?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Êtes-vous sûr de vouloir supprimer la demande de prix <strong>{inquiryToDelete.code}</strong> ?
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setInquiryToDelete(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSingle(inquiryToDelete)}
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
              <h3 className="font-bold text-slate-900 text-base">Supprimer les demandes sélectionnées ?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Êtes-vous sûr de vouloir supprimer <strong>{selectedInquiryIds.length}</strong> demande(s) de prix sélectionnée(s) ? Cette action est irréversible.
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

      {/* Modal Suggestion de réapprovisionnement */}
      {isReapproOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl shadow-2xl max-h-[88vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-black text-[#001F3F] flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Suggestion de réapprovisionnement
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {reapproRows.length} article(s) au niveau ou sous le seuil d'alerte — quantités proposées pour reconstituer à 2× le seuil
                </p>
              </div>
              <button onClick={() => setIsReapproOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Fournisseur cible *</label>
                <select
                  value={reapproSupplierId}
                  onChange={e => setReapproSupplierId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="">— Sélectionner un fournisseur —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500">
                    <tr>
                      <th className="py-2 px-2.5 text-center w-10">
                        <button
                          type="button"
                          onClick={() => setReapproRows(prev => {
                            const all = prev.every(r => r.selected);
                            return prev.map(r => ({ ...r, selected: !all }));
                          })}
                          className="text-slate-500 hover:text-[#001F3F]"
                        >
                          {reapproRows.every(r => r.selected) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        </button>
                      </th>
                      <th className="py-2 px-2.5 text-left">Article</th>
                      <th className="py-2 px-2.5 text-center">Stock</th>
                      <th className="py-2 px-2.5 text-center">Seuil</th>
                      <th className="py-2 px-2.5 text-center">Suggéré</th>
                      <th className="py-2 px-2.5 text-center w-28">Quantité</th>
                      <th className="py-2 px-2.5 text-right">Prix achat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reapproRows.map(r => (
                      <tr key={r.product.id} className={r.product.stock <= 0 ? 'bg-red-50/50' : 'bg-amber-50/30'}>
                        <td className="py-2 px-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => setReapproRows(prev => prev.map(x => x.product.id === r.product.id ? { ...x, selected: !x.selected } : x))}
                            className="text-slate-500 hover:text-[#001F3F]"
                          >
                            {r.selected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="py-2 px-2.5 font-medium">{r.product.name}<div className="text-[10px] text-slate-400 font-mono">{r.product.code}</div></td>
                        <td className={`py-2 px-2.5 text-center font-black ${r.product.stock <= 0 ? 'text-red-600' : 'text-amber-600'}`}>{r.product.stock}</td>
                        <td className="py-2 px-2.5 text-center text-slate-500">{r.product.minStock}</td>
                        <td className="py-2 px-2.5 text-center text-slate-500">{r.suggestedQty}</td>
                        <td className="py-2 px-2.5 text-center">
                          <input
                            type="number"
                            min={0}
                            value={r.qty}
                            onChange={e => setReapproRows(prev => prev.map(x => x.product.id === r.product.id ? { ...x, qty: Math.max(0, Number(e.target.value)) } : x))}
                            className="w-20 px-2 py-1 border border-slate-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                          />
                        </td>
                        <td className="py-2 px-2.5 text-right">{formatFCFA(r.product.buyPrice || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs text-slate-600">
                <span className="font-bold">{reapproRows.filter(r => r.selected && r.qty > 0).length}</span> article(s) — montant estimé{' '}
                <span className="font-black text-[#001F3F]">{formatFCFA(reapproRows.filter(r => r.selected).reduce((s, r) => s + r.qty * (r.product.buyPrice || 0), 0))}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setIsReapproOpen(false)} className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold">
                  Annuler
                </button>
                <button
                  onClick={applyReapproToForm}
                  disabled={!reapproSupplierId || reapproRows.every(r => !r.selected || r.qty <= 0)}
                  className="px-4 py-2 rounded-lg bg-[#001F3F] text-white text-xs font-bold disabled:opacity-40"
                >
                  Préparer la demande de prix
                </button>
              </div>
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
