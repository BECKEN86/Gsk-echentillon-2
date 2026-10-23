import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  Plus, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  X, 
  Barcode,
  FolderPlus,
  Layers,
  ChevronDown,
  Download,
  Upload,
  Image as ImageIcon,
  ShoppingBag,
  Truck,
  CheckSquare,
  Square,
  FileText,
  Boxes,
  LayoutGrid,
  List,
  Eye,
  Printer,
  Camera
} from 'lucide-react';
import { CompanyConfig, Product, ProductCategory, StockMovement, OperationalUnit, OperationalUnitType, STORAGE_CONTAINER_UNITS, MEASUREMENT_UNITS } from '../../../types';
import { formatFCFA } from '../../../data/initialData';
import { printList } from '../../../utils/printList';
import { CategoryModal } from '../../modals/CategoryModal';
import { UnitsManagerModal } from '../../modals/UnitsManagerModal';
import { OperationalUnitsModal } from '../../modals/OperationalUnitsModal';
import { ImportProductsModal } from '../../modals/ImportProductsModal';
import { ProductDetailModal } from '../../modals/ProductDetailModal';
import { ProductKanbanView } from './ProductKanbanView';
import { QrScannerModal } from '../../modals/QrScannerModal';
import { showToast } from '../../../utils/toast';

interface ProduitsViewProps {
  products: Product[];
  categories: ProductCategory[];
  companyConfig?: CompanyConfig | null;
  movements?: StockMovement[];
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onBatchAddProducts?: (products: Product[]) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onAddCategory: (category: Omit<ProductCategory, 'id'>) => void;
  onUpdateCategory: (category: ProductCategory) => void;
  onDeleteCategory: (id: string) => void;
}

/** Met en majuscule la première lettre de la chaîne saisie */
export function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Calcule le prochain code produit auto-incrémenté (ex: PRD-0001, PRD-0002...) */
export function generateNextProductCode(productsList: Product[]): string {
  let maxNumber = 0;
  for (const p of productsList) {
    if (!p.code) continue;
    const match = p.code.trim().match(/PRD[-_]?(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }
  const nextNum = maxNumber + 1;
  return `PRD-${String(nextNum).padStart(4, '0')}`;
}

export const ProduitsView: React.FC<ProduitsViewProps> = ({
  products,
  categories,
  companyConfig,
  movements = [],
  onAddProduct,
  onBatchAddProducts,
  onUpdateProduct,
  onDeleteProduct,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tous');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  // Selection state for products
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isUnitsModalOpen, setIsUnitsModalOpen] = useState(false);
  const [isUnitsManagerModalOpen, setIsUnitsManagerModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Listes d'unités de stockage et de mesure (extensibles par l'utilisateur via le bouton "+")
  const [storageUnits, setStorageUnits] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('gestock_custom_storage_units');
      const custom: string[] = saved ? JSON.parse(saved) : [];
      const fromProducts = products.map(p => p.storageUnit).filter(Boolean) as string[];
      return Array.from(new Set([...STORAGE_CONTAINER_UNITS, ...fromProducts, ...custom]));
    } catch {
      return [...STORAGE_CONTAINER_UNITS];
    }
  });

  const [measurementUnits, setMeasurementUnits] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('gestock_custom_measurement_units');
      const custom: string[] = saved ? JSON.parse(saved) : [];
      const fromProducts = products.map(p => p.measurementUnit).filter(Boolean) as string[];
      return Array.from(new Set([...MEASUREMENT_UNITS, ...fromProducts, ...custom]));
    } catch {
      return [...MEASUREMENT_UNITS];
    }
  });

  // Modal d'ajout rapide d'une unité de stockage ou de mesure
  const [newUnitModalType, setNewUnitModalType] = useState<'storage' | 'measurement' | null>(null);
  const [newUnitInputValue, setNewUnitInputValue] = useState('');

  const handleAddNewUnit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newUnitInputValue.trim().toLowerCase();
    if (!trimmed || !newUnitModalType) return;

    if (newUnitModalType === 'storage') {
      setStorageUnits(prev => {
        const next = prev.includes(trimmed) ? prev : [...prev, trimmed];
        try {
          localStorage.setItem('gestock_custom_storage_units', JSON.stringify(next));
        } catch { /* ignore */ }
        return next;
      });
      setFormData(prev => ({
        ...prev,
        storageUnit: trimmed,
        unit: trimmed
      }));
    } else {
      setMeasurementUnits(prev => {
        const next = prev.includes(trimmed) ? prev : [...prev, trimmed];
        try {
          localStorage.setItem('gestock_custom_measurement_units', JSON.stringify(next));
        } catch { /* ignore */ }
        return next;
      });
      setFormData(prev => ({
        ...prev,
        measurementUnit: trimmed
      }));
    }

    setNewUnitInputValue('');
    setNewUnitModalType(null);
  };

  // Detail Modal state (voir les détails avant de modifier)
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const handleOpenDetail = (product: Product) => {
    setDetailProduct(product);
    setIsDetailModalOpen(true);
  };

  // Close actions dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setIsActionsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Product Modal Active Tab: 'general' | 'uoa_uov' | 'inventory'
  const [activeProductTab, setActiveProductTab] = useState<'general' | 'uoa_uov' | 'inventory'>('general');

  // Form state for Product Creation / Edition
  const [formData, setFormData] = useState<{
    code: string;
    barcode: string;
    name: string;
    category: string;
    imageUrl: string;
    buyPrice: number;
    sellPrice: number;
    vatPurchase: number;
    vatSale: number;
    minStock: number;
    unit: string;
    storageUnit: string;
    measurementUnit: string;
    availableInPOS: boolean;
    isStockable: boolean;
    operationalUnits: OperationalUnit[];
  }>({
    code: generateNextProductCode(products),
    barcode: '',
    name: '',
    category: categories[0]?.name || 'Alimentation',
    imageUrl: '',
    buyPrice: 0,
    sellPrice: 0,
    vatPurchase: 0, // Les tva sont à 0 par défaut
    vatSale: 0,     // Les tva sont à 0 par défaut
    minStock: 5,
    unit: 'sac',
    storageUnit: 'sac',
    measurementUnit: 'kilogramme',
    availableInPOS: true,
    isStockable: true,
    operationalUnits: []
  });

  // Local state for creating / editing UOA & UOV in Product Modal
  const [newUnitLabel, setNewUnitLabel] = useState('');
  const [newUnitType, setNewUnitType] = useState<OperationalUnitType>('UOV');
  const [newUnitQty, setNewUnitQty] = useState<number>(1);
  const [newUnitPrice, setNewUnitPrice] = useState<number>(0);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);

  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Tous' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleQrScan = (value: string) => {
    const scanned = value.trim();
    setSearchTerm(scanned);
    setSelectedCategory('Tous');
    setIsQrScannerOpen(false);
    const normalized = scanned.toLocaleLowerCase();
    const found = products.some(product =>
      [product.name, product.code, product.barcode || '', product.category]
        .some(field => field.toLocaleLowerCase().includes(normalized))
    );
    showToast(
      found ? 'QR code lu : recherche du produit lancée.' : 'Aucun produit correspondant à ce QR code.',
      found ? 'success' : 'error'
    );
  };

  // Handle open Add Product Modal: Titre "Nouveau Produit" et TVA à 0
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setActiveProductTab('general');
    const nextCode = generateNextProductCode(products);
    setFormData({
      code: nextCode,
      barcode: '',
      name: '',
      category: categories[0]?.name || 'Alimentation',
      imageUrl: '',
      buyPrice: 0,
      sellPrice: 0,
      vatPurchase: 0, // TVA Achat = 0
      vatSale: 0,     // TVA Vente = 0
      minStock: 5,
      unit: 'sac',
      storageUnit: 'sac',
      measurementUnit: 'kilogramme',
      availableInPOS: true,
      isStockable: true,
      operationalUnits: []
    });
    setNewUnitLabel('');
    setNewUnitType('UOV');
    setNewUnitQty(1);
    setNewUnitPrice(0);
    setEditingUnitId(null);
    setIsProductModalOpen(true);
  };

  // Handle open Edit Product Modal
  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setActiveProductTab('general');

    const existingUnits: OperationalUnit[] = product.operationalUnits && product.operationalUnits.length > 0
      ? product.operationalUnits
      : [
          ...(product.uov ? [{
            id: 'legacy_uov',
            label: product.uov.label || product.uov.name || 'Unité Vente',
            type: 'UOV' as OperationalUnitType,
            quantity: product.uov.quantity || 1,
            price: product.uov.price || product.sellPrice
          }] : []),
          ...(product.uoa ? [{
            id: 'legacy_uoa',
            label: product.uoa.label || product.uoa.name || 'Conditionnement Achat',
            type: 'UOA' as OperationalUnitType,
            quantity: product.uoa.quantity || 1,
            price: product.uoa.price || product.buyPrice
          }] : [])
        ];

    const storageUnit = product.storageUnit || product.unit || 'sac';
    const measurementUnit = product.measurementUnit || 'kilogramme';

    if (storageUnit && !storageUnits.includes(storageUnit)) {
      setStorageUnits(prev => Array.from(new Set([...prev, storageUnit])));
    }
    if (measurementUnit && !measurementUnits.includes(measurementUnit)) {
      setMeasurementUnits(prev => Array.from(new Set([...prev, measurementUnit])));
    }

    setFormData({
      code: product.code,
      barcode: product.barcode || '',
      name: product.name,
      category: product.category,
      imageUrl: product.imageUrl || '',
      buyPrice: product.buyPrice,
      sellPrice: product.sellPrice,
      vatPurchase: product.vatPurchase !== undefined ? product.vatPurchase : 0,
      vatSale: product.vatSale !== undefined ? product.vatSale : 0,
      minStock: product.minStock,
      unit: storageUnit,
      storageUnit: storageUnit,
      measurementUnit: measurementUnit,
      availableInPOS: product.availableInPOS !== false,
      isStockable: product.isStockable !== false,
      operationalUnits: existingUnits
    });
    setNewUnitLabel('');
    setNewUnitType('UOV');
    setNewUnitQty(1);
    setNewUnitPrice(0);
    setEditingUnitId(null);
    setIsProductModalOpen(true);
  };

  // Handler for adding/updating UOA & UOV in product modal
  const handleAddOrUpdateUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitLabel.trim()) return;

    if (editingUnitId) {
      setFormData(prev => ({
        ...prev,
        operationalUnits: prev.operationalUnits.map(u => {
          const uid = u.id || `${u.label}_${u.type}`;
          if (uid === editingUnitId) {
            return {
              ...u,
              label: newUnitLabel.trim(),
              type: newUnitType,
              quantity: Math.max(0.001, Number(newUnitQty) || 1),
              price: Math.max(0, Number(newUnitPrice) || 0)
            };
          }
          return u;
        })
      }));
    } else {
      const newUnit: OperationalUnit = {
        id: `u_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        label: newUnitLabel.trim(),
        type: newUnitType,
        quantity: Math.max(0.001, Number(newUnitQty) || 1),
        price: Math.max(0, Number(newUnitPrice) || 0)
      };
      setFormData(prev => ({
        ...prev,
        operationalUnits: [...prev.operationalUnits, newUnit]
      }));
    }

    setNewUnitLabel('');
    setNewUnitType('UOV');
    setNewUnitQty(1);
    setNewUnitPrice(0);
    setEditingUnitId(null);
  };

  const handleStartEditUnit = (unit: OperationalUnit) => {
    setEditingUnitId(unit.id || `${unit.label}_${unit.type}`);
    setNewUnitLabel(unit.label || unit.name || '');
    setNewUnitType(unit.type);
    setNewUnitQty(unit.quantity);
    setNewUnitPrice(unit.price);
  };

  const handleRemoveUnit = (unitToRemove: OperationalUnit) => {
    const uidToRemove = unitToRemove.id || `${unitToRemove.label}_${unitToRemove.type}`;
    setFormData(prev => ({
      ...prev,
      operationalUnits: prev.operationalUnits.filter(u => {
        const uid = u.id || `${u.label}_${u.type}`;
        return uid !== uidToRemove;
      })
    }));
    if (editingUnitId === uidToRemove) {
      setNewUnitLabel('');
      setEditingUnitId(null);
    }
  };

  // Handle image upload from file
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setFormData(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit product creation/edition
  const handleSubmitProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const categoryObj = categories.find(c => c.name === formData.category);

    const primaryUov = formData.operationalUnits.find(u => u.type === 'UOV');
    const primaryUoa = formData.operationalUnits.find(u => u.type === 'UOA');

    const productPayload = {
      code: (formData.code.trim() || generateNextProductCode(products)).toUpperCase(),
      barcode: capitalizeFirst(formData.barcode.trim()),
      name: capitalizeFirst(formData.name.trim()),
      category: formData.category,
      categoryId: categoryObj?.id,
      imageUrl: formData.imageUrl.trim() || undefined,
      buyPrice: Number(formData.buyPrice) || 0,
      sellPrice: Number(formData.sellPrice) || 0,
      vatPurchase: Number(formData.vatPurchase) || 0,
      vatSale: Number(formData.vatSale) || 0,
      minStock: Number(formData.minStock) || 5,
      unit: formData.storageUnit || formData.unit,
      storageUnit: formData.storageUnit || 'sac',
      measurementUnit: formData.measurementUnit || 'kilogramme',
      availableInPOS: formData.availableInPOS,
      isStockable: formData.isStockable,
      operationalUnits: formData.operationalUnits,
      uov: primaryUov || {
        label: formData.storageUnit || formData.unit,
        type: 'UOV' as OperationalUnitType,
        quantity: 1,
        price: Number(formData.sellPrice) || 0
      },
      uoa: primaryUoa || {
        label: 'Achat',
        type: 'UOA' as OperationalUnitType,
        quantity: 1,
        price: Number(formData.buyPrice) || 0
      }
    };

    if (editingProduct) {
      onUpdateProduct({
        ...editingProduct,
        ...productPayload
      });
    } else {
      onAddProduct({
        ...productPayload,
        stock: 0, // Stock initial supprimé : initialisé à 0
        lastRestocked: new Date().toISOString().split('T')[0]
      });
    }
    setIsProductModalOpen(false);
  };

  // Toggle selection
  const handleToggleSelectProduct = (id: string) => {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedProductIds.length === filteredProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map(p => p.id));
    }
  };

  // Export to Excel / CSV
  const handleExportExcel = () => {
    setIsActionsMenuOpen(false);
    const targetProducts = selectedProductIds.length > 0
      ? products.filter(p => selectedProductIds.includes(p.id))
      : filteredProducts;

    if (targetProducts.length === 0) {
      alert('Aucun produit à exporter.');
      return;
    }

    const headers = [
      'Code SKU',
      'Code Barres / QR',
      'Désignation',
      'Catégorie',
      'Prix Achat FCFA',
      'Prix Vente FCFA',
      'TVA Achat %',
      'TVA Vente %',
      'Stock Actuel',
      'Seuil Alerte',
      'Unité',
      'Disponible PV',
      'Stockable',
      'UOV Nom',
      'UOV Quantité',
      'UOV Prix FCFA',
      'UOA Nom',
      'UOA Quantité',
      'UOA Prix FCFA'
    ];

    const rows = targetProducts.map(p => [
      `"${p.code}"`,
      `"${p.barcode || ''}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.category}"`,
      p.buyPrice,
      p.sellPrice,
      p.vatPurchase ?? 18,
      p.vatSale ?? 18,
      p.stock,
      p.minStock,
      `"${p.unit}"`,
      p.availableInPOS !== false ? 'OUI' : 'NON',
      p.isStockable !== false ? 'OUI' : 'NON',
      `"${p.uov?.name || p.unit}"`,
      p.uov?.quantity || 1,
      p.uov?.price || p.sellPrice,
      `"${p.uoa?.name || 'Achat'}"`,
      p.uoa?.quantity || 1,
      p.uoa?.price || p.buyPrice
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(';'),
      ...rows.map(r => r.join(';'))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `Catalogue_Produits_GeStock_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintProductList = () => {
    setIsActionsMenuOpen(false);
    const targetProducts = selectedProductIds.length > 0
      ? products.filter(product => selectedProductIds.includes(product.id))
      : filteredProducts;

    if (targetProducts.length === 0) {
      alert('Aucun produit à imprimer.');
      return;
    }

    const columns = [
      'Code produit',
      'Code-barres',
      'Désignation',
      'Catégorie',
      'Unité',
      'Prix achat',
      'Prix vente',
      'Stock',
      'Seuil',
      'Statut'
    ];
    const rows = targetProducts.map(product => [
      product.code,
      product.barcode || '—',
      product.name,
      product.category,
      product.storageUnit || product.unit || '—',
      formatFCFA(product.buyPrice),
      formatFCFA(product.sellPrice),
      String(product.stock),
      String(product.minStock),
      product.stock <= product.minStock ? 'Stock faible' : 'Disponible'
    ]);
    const scope = selectedProductIds.length > 0
      ? `${targetProducts.length} produit(s) sélectionné(s)`
      : `${targetProducts.length} produit(s) — ${selectedCategory === 'Tous' ? 'toutes catégories' : selectedCategory}`;

    printList({
      title: 'Catalogue des produits',
      subtitle: scope,
      company: companyConfig,
      professionalBranding: true,
      columns,
      rows
    });
  };

  const handleOpenImport = () => {
    setIsActionsMenuOpen(false);
    setIsImportModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Main Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#001F3F]">Gestion des Produits & Catalogue</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Centralisez vos articles, conditionnements UOV/UOA, catégories, TVA et stocks.
              </p>
            </div>
          </div>
        </div>

        {/* Dashboard Top Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Button: Fiche de catégorie de produit */}
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-[#001F3F] font-bold text-xs flex items-center gap-1.5 transition-colors border border-slate-200"
            title="Ouvrir la fiche de création et gestion des catégories"
          >
            <FolderPlus className="w-4 h-4 text-blue-600" />
            <span>Fiche Catégories</span>
          </button>

          {/* Button: Référentiel des Unités (Stockage & Mesure) */}
          <button
            onClick={() => setIsUnitsManagerModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-[#001F3F] font-bold text-xs flex items-center gap-1.5 transition-colors border border-slate-200"
            title="Ouvrir la gestion des unités de stockage et de mesure"
          >
            <Boxes className="w-4 h-4 text-purple-600" />
            <span>Unités</span>
          </button>

          {/* Button: Fiche pour les UOV et UOA */}
          <button
            onClick={() => setIsUnitsModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-[#001F3F] font-bold text-xs flex items-center gap-1.5 transition-colors border border-slate-200"
            title="Ouvrir la fiche des Unités Opérationnelles UOV et UOA"
          >
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>Fiche UOV / UOA</span>
          </button>

          {/* Button: Nouveau Produit */}
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Produit</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar: Catégorie (dropdown), Actions, Vue (Kanban ou Liste) */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        {/* Search input */}
        <div className="relative flex flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, SKU, code-barres..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-12 py-2 bg-slate-50 text-slate-800 placeholder-slate-400 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            type="button"
            onClick={() => setIsQrScannerOpen(true)}
            className="absolute right-1 top-1 rounded-md p-1.5 text-[#001F3F] transition hover:bg-blue-100"
            title="Scanner un QR code produit"
            aria-label="Scanner un QR code produit"
          >
            <Camera className="h-4 w-4" />
          </button>
        </div>

        {/* Group: Catégorie (liste déroulante) + Boutons Actions & Vue */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Catégorie: (toutes les catégories dans une liste déroulante) */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">Catégorie:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-slate-800 font-bold text-xs focus:outline-none cursor-pointer pr-1"
            >
              <option value="Tous">Toutes les catégories ({products.length})</option>
              {categories.map(cat => {
                const count = products.filter(p => p.category === cat.name || p.categoryId === cat.id).length;
                return (
                  <option key={cat.id} value={cat.name}>
                    {cat.name} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Menu d'action nommé "Actions" (Exporter CSV/Excel / Importer) */}
          <div className="relative" ref={actionsMenuRef}>
            <button
              onClick={() => setIsActionsMenuOpen(!isActionsMenuOpen)}
              className="px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1.5 transition-colors border border-emerald-200 shadow-2xs"
              title="Menu d'actions (Exporter CSV/Excel / Importer)"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Exporter / Importer</span>
              <ChevronDown className="w-3 h-3 text-emerald-600" />
            </button>

            {isActionsMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1.5 text-xs animate-in fade-in duration-100">
                <button
                  onClick={handleExportExcel}
                  className="w-full px-4 py-2.5 text-left text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-2.5 transition-colors"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <div>
                    <div className="font-bold">Exporter l'Inventaire (CSV / Excel)</div>
                    <div className="text-[10px] text-slate-400">
                      {selectedProductIds.length > 0
                        ? `Exporter ${selectedProductIds.length} produit(s) sélectionné(s)`
                        : 'Exporter tous les produits de stock (.csv)'}
                    </div>
                  </div>
                </button>

                <button
                  onClick={handlePrintProductList}
                  className="w-full px-4 py-2.5 text-left text-slate-700 hover:bg-blue-50 hover:text-blue-800 flex items-center gap-2.5 transition-colors border-t border-slate-100"
                >
                  <Printer className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="font-bold">Imprimer la liste des produits</div>
                    <div className="text-[10px] text-slate-400">
                      {selectedProductIds.length > 0
                        ? `Imprimer ${selectedProductIds.length} produit(s) sélectionné(s)`
                        : 'Imprimer les produits correspondant aux filtres'}
                    </div>
                  </div>
                </button>

                <button
                  onClick={handleOpenImport}
                  className="w-full px-4 py-2.5 text-left text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2.5 transition-colors border-t border-slate-100"
                >
                  <Upload className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="font-bold">Importer un fichier Excel</div>
                    <div className="text-[10px] text-slate-400">
                      Ajouter des produits en masse depuis un tableur
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Vue (qui change la vue de la liste de produit en Kanban ou en liste) */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-[#001F3F] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Afficher la vue en Liste (tableau)"
            >
              <List className="w-3.5 h-3.5" />
              <span>Liste</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'kanban'
                  ? 'bg-white text-[#001F3F] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Afficher la vue en Kanban (colonnes)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
          </div>
        </div>
      </div>

      {/* Selection Action Bar (when rows are checked) */}
      {selectedProductIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex items-center justify-between gap-3 text-xs text-blue-900">
          <div className="flex items-center gap-2">
            <span className="font-bold">{selectedProductIds.length} produit(s) sélectionné(s)</span>
            <span className="text-blue-500">|</span>
            <button
              onClick={() => setSelectedProductIds([])}
              className="text-blue-700 hover:underline font-semibold"
            >
              Tout désélectionner
            </button>
          </div>

          <button
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-[#001F3F] text-white font-bold rounded-lg flex items-center gap-1.5 hover:bg-blue-900 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter la sélection ({selectedProductIds.length})</span>
          </button>
        </div>
      )}

      {/* CONTENT: Kanban View OR List (Table) View */}
      {viewMode === 'kanban' ? (
        <ProductKanbanView
          products={filteredProducts}
          categories={categories}
          selectedCategory={selectedCategory}
          selectedProductIds={selectedProductIds}
          onToggleSelectProduct={handleToggleSelectProduct}
          onEditProduct={handleOpenEdit}
          onDeleteProduct={(prod) => onDeleteProduct(prod.id)}
          onViewProductDetail={handleOpenDetail}
        />
      ) : (
        /* Products Table */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-3 text-center w-10">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="p-1 hover:text-slate-900"
                      title="Tout sélectionner / désélectionner"
                    >
                      {selectedProductIds.length > 0 && selectedProductIds.length === filteredProducts.length ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-3">Article & Image</th>
                  <th className="py-3 px-3">Code / Barcode</th>
                  <th className="py-3 px-3">Catégorie</th>
                  <th className="py-3 px-3 text-right">Prix Achat</th>
                  <th className="py-3 px-3 text-right">Prix Vente</th>
                  <th className="py-3 px-3 text-center">Stock</th>
                  <th className="py-3 px-3 text-center">Statut</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      Aucun produit ne correspond à vos critères de recherche.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product, idx) => {
                    const isSelected = selectedProductIds.includes(product.id);
                    const isLowStock = product.stock <= product.minStock;
                    const storageUnit = product.storageUnit || product.unit || 'sac';
                    const measurementUnit = product.measurementUnit || 'kg';

                    return (
                      <tr
                        key={product.id ? `${product.id}_${idx}` : `p_${idx}`}
                        onClick={() => handleOpenDetail(product)}
                        className={`transition-colors cursor-pointer ${
                          isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50/70 text-slate-700'
                        }`}
                        title="Cliquer pour afficher la fiche détaillée du produit"
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleToggleSelectProduct(product.id)}
                            className="p-1"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                            )}
                          </button>
                        </td>

                        {/* Article with Image */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                />
                              ) : (
                                <span className="font-bold text-[10px] text-slate-500">
                                  {product.name.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-[#001F3F] leading-snug">
                                {product.name}
                              </div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                <span>Stockage : <strong className="text-slate-600">{storageUnit}</strong></span>
                                <span>•</span>
                                <span>Mesure : <strong className="text-slate-600">{measurementUnit}</strong></span>
                                {product.availableInPOS !== false && (
                                  <span className="ml-1 px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 text-[9px] font-bold border border-emerald-200" title="Disponible au point de vente (caisse)">
                                    PV
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Code / Barcode */}
                        <td className="py-3 px-3 font-mono text-[11px]">
                          <div className="font-semibold text-blue-700 flex items-center gap-1">
                            <Barcode className="w-3.5 h-3.5 text-slate-400" />
                            {product.code}
                          </div>
                          {product.barcode && (
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              {product.barcode}
                            </div>
                          )}
                        </td>

                        {/* Catégorie */}
                        <td className="py-3 px-3">
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium whitespace-nowrap">
                            {product.category}
                          </span>
                        </td>

                        {/* Prix Achat */}
                        <td className="py-3 px-3 text-right font-medium text-slate-600">
                          <div>{formatFCFA(product.buyPrice)}</div>
                          <div className="text-[10px] text-slate-400">TVA: {product.vatPurchase ?? 18}%</div>
                        </td>

                        {/* Prix Vente */}
                        <td className="py-3 px-3 text-right font-bold text-emerald-700">
                          <div>{formatFCFA(product.sellPrice)}</div>
                          <div className="text-[10px] text-slate-400 font-normal">TVA: {product.vatSale ?? 18}%</div>
                        </td>

                        {/* Stock */}
                        <td className="py-3 px-3 text-center font-bold text-xs">
                          {product.isStockable !== false ? (
                            <span className={isLowStock ? 'text-red-600 font-extrabold' : 'text-slate-800'}>
                              {product.stock} {storageUnit}s
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">N/A</span>
                          )}
                        </td>

                        {/* Statut */}
                        <td className="py-3 px-3 text-center">
                          {product.isStockable === false ? (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">
                              Service
                            </span>
                          ) : product.stock === 0 ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold">
                              Rupture
                            </span>
                          ) : isLowStock ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center justify-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              Stock Faible
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold flex items-center justify-center gap-1">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              En Stock
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-right space-x-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenDetail(product)}
                            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors"
                            title="Voir les détails du produit"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(product)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-blue-700 transition-colors"
                            title="Modifier ce produit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteProduct(product.id)}
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                            title="Supprimer ce produit"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Fiche de Produit (Ajout & Modification) */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header: Titre "Nouveau Produit" à chaque création */}
            <div className="flex items-center justify-between p-4 px-6 border-b border-slate-100 bg-[#001F3F] text-white">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Box className="w-5 h-5 text-blue-300" />
                {editingProduct ? 'Modifier le Produit' : 'Nouveau Produit'}
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Onglets / Boutons : Informations Générales, UOA et UOV, Inventaire */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-2 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setActiveProductTab('general')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  activeProductTab === 'general'
                    ? 'bg-white text-[#001F3F] shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Informations Générales</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveProductTab('uoa_uov')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  activeProductTab === 'uoa_uov'
                    ? 'bg-white text-[#001F3F] shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>UOA et UOV</span>
                {formData.operationalUnits.length > 0 && (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded-full">
                    {formData.operationalUnits.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveProductTab('inventory')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  activeProductTab === 'inventory'
                    ? 'bg-white text-[#001F3F] shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Boxes className="w-4 h-4 text-amber-600" />
                <span>Inventaire</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitProduct} className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
              {/* ONGLET 1 : Informations Générales */}
              {activeProductTab === 'general' && (
                <div className="space-y-4">
                  {/* Row 1: Code SKU & Code-barres ou QR Code (Sans bouton Générer EAN) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-semibold text-slate-700">
                          Code / SKU *
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium">
                          Auto-incrémenté (non modifiable)
                        </span>
                      </div>
                      <input
                        type="text"
                        readOnly
                        tabIndex={-1}
                        value={formData.code}
                        title="Code SKU généré automatiquement et non modifiable"
                        className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-mono font-bold cursor-not-allowed select-none focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <Barcode className="w-3.5 h-3.5 text-slate-500" />
                        Code-barres ou QR code
                      </label>
                      <input
                        type="text"
                        value={formData.barcode}
                        placeholder="ex: 6181100234512"
                        onChange={(e) => setFormData({ ...formData, barcode: capitalizeFirst(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono focus:border-blue-500 focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Row 2: Désignation & Catégorie */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">
                        Désignation du produit *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Nom du produit"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: capitalizeFirst(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none text-sm font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Catégorie *
                      </label>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          className="flex-1 min-w-0 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none font-medium text-xs"
                        >
                          {categories.map(c => (
                            <option key={c.id} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setIsCategoryModalOpen(true)}
                          title="Créer ou gérer les catégories"
                          className="p-2 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 border border-slate-200 hover:border-blue-300 rounded-lg transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Image du produit */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Image du produit
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                        {formData.imageUrl ? (
                          <img
                            src={formData.imageUrl}
                            alt="Aperçu"
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <label className="cursor-pointer text-xs text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors">
                            <Upload className="w-3.5 h-3.5" />
                            <span>Charger une photo depuis l'ordinateur</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageFileChange}
                              className="hidden"
                            />
                          </label>
                          {formData.imageUrl && (
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, imageUrl: '' })}
                              className="text-xs text-red-600 hover:underline font-semibold"
                            >
                              Supprimer l'image
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Format PNG, JPG ou WebP supporté.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Row 4: Prix et TVA (Prix Achat, TVA Achat, Prix Vente, TVA Vente) */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Prix d'Achat (FCFA)
                        </label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={formData.buyPrice}
                          onChange={(e) => setFormData({ ...formData, buyPrice: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-blue-500 focus:outline-none font-medium"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          TVA sur Achat (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={formData.vatPurchase}
                          onChange={(e) => setFormData({ ...formData, vatPurchase: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Prix de Vente (FCFA)
                        </label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={formData.sellPrice}
                          onChange={(e) => setFormData({ ...formData, sellPrice: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-emerald-700 font-bold focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          TVA sur Vente (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={formData.vatSale}
                          onChange={(e) => setFormData({ ...formData, vatSale: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Row 5: Case à cocher Disponible dans le point de vente (Disponible PV) */}
                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:border-emerald-300 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.availableInPOS}
                      onChange={(e) => setFormData({ ...formData, availableInPOS: e.target.checked })}
                      className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-slate-800 block text-xs">
                        Disponible dans le point de vente (Disponible PV)
                      </span>
                      <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                        Si le produit est disponible dans le point de vente, il peut être vendu directement en caisse.
                      </span>
                    </div>
                  </label>
                </div>
              )}

              {/* ONGLET 2 : UOA et UOV (Plusieurs UOA et UOV possibles) */}
              {activeProductTab === 'uoa_uov' && (
                <div className="space-y-4">
                  {/* Formulaire de création / modification UOA ou UOV */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5 text-blue-600" />
                        {editingUnitId ? 'Modifier l\'unité opérationnelle' : 'Ajouter une unité opérationnelle (UOA ou UOV)'}
                      </span>
                      {editingUnitId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUnitId(null);
                            setNewUnitLabel('');
                            setNewUnitPrice(0);
                          }}
                          className="text-[11px] text-slate-500 hover:text-slate-800 underline"
                        >
                          Annuler
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Libellé */}
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Libellé *
                        </label>
                        <input
                          type="text"
                          placeholder="ex: Carton de 12"
                          value={newUnitLabel}
                          onChange={(e) => setNewUnitLabel(capitalizeFirst(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      {/* Type: UOA ou UOV */}
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Type : UOA ou UOV *
                        </label>
                        <select
                          value={newUnitType}
                          onChange={(e) => setNewUnitType(e.target.value as OperationalUnitType)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs font-bold focus:border-blue-500 focus:outline-none"
                        >
                          <option value="UOV">UOV (Vente)</option>
                          <option value="UOA">UOA (Achat)</option>
                        </select>
                      </div>

                      {/* Quantité */}
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Quantité *
                        </label>
                        <input
                          type="number"
                          min="0.001"
                          step="any"
                          value={newUnitQty}
                          onChange={(e) => setNewUnitQty(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs font-bold focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      {/* Prix */}
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Prix (FCFA) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={newUnitPrice}
                          onChange={(e) => setNewUnitPrice(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs font-bold focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={handleAddOrUpdateUnit}
                        className="px-3 py-1.5 rounded-lg bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{editingUnitId ? 'Enregistrer l\'unité' : 'Ajouter l\'unité'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Tableau des UOA et UOV configurées */}
                  <div>
                    <div className="font-bold text-slate-800 text-xs mb-2 flex items-center justify-between">
                      <span>Unités enregistrées ({formData.operationalUnits.length})</span>
                      <span className="text-[11px] text-slate-500 font-normal">
                        {formData.operationalUnits.filter(u => u.type === 'UOV').length} UOV | {formData.operationalUnits.filter(u => u.type === 'UOA').length} UOA
                      </span>
                    </div>

                    {formData.operationalUnits.length === 0 ? (
                      <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                        Aucune UOA ou UOV enregistrée pour ce produit. Ajoutez-en via le formulaire ci-dessus.
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                            <tr>
                              <th className="py-2 px-3">Type</th>
                              <th className="py-2 px-3">Libellé</th>
                              <th className="py-2 px-3 text-right">Quantité</th>
                              <th className="py-2 px-3 text-right">Prix</th>
                              <th className="py-2 px-3 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {formData.operationalUnits.map((unit, idx) => {
                              const isUOV = unit.type === 'UOV';
                              return (
                                <tr key={unit.id || idx} className="hover:bg-slate-50">
                                  <td className="py-2 px-3">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      isUOV ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                    }`}>
                                      {isUOV ? <ShoppingBag className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                                      {unit.type}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 font-semibold text-slate-800">
                                    {unit.label || unit.name}
                                  </td>
                                  <td className="py-2 px-3 text-right font-bold text-slate-700">
                                    {unit.quantity}
                                  </td>
                                  <td className={`py-2 px-3 text-right font-bold ${
                                    isUOV ? 'text-emerald-700' : 'text-amber-700'
                                  }`}>
                                    {formatFCFA(unit.price)}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditUnit(unit)}
                                        className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                        title="Modifier"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveUnit(unit)}
                                        className="p-1 rounded text-slate-500 hover:text-red-600 hover:bg-red-50"
                                        title="Supprimer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ONGLET 3 : Inventaire */}
              {activeProductTab === 'inventory' && (
                <div className="space-y-4">
                  {/* Case à cocher Stockable */}
                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:border-blue-300 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.isStockable}
                      onChange={(e) => setFormData({ ...formData, isStockable: e.target.checked })}
                      className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-slate-800 block text-xs">
                        Stockable
                      </span>
                      <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                        Si le produit est stockable, il peut être inventorié, suivi dans ses mouvements (entrées et sorties).
                      </span>
                    </div>
                  </label>

                  {/* Deux types d'unités : Unité de stockage et Unité de mesure */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* 1. Unité de stockage (sac, boite, bidon...) */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 text-xs">
                        Unité de stockage *
                      </label>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={formData.storageUnit}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            storageUnit: e.target.value,
                            unit: e.target.value
                          })}
                          className="flex-1 min-w-0 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none font-medium capitalize text-xs"
                        >
                          {storageUnits.map(unitOption => (
                            <option key={unitOption} value={unitOption}>
                              {unitOption}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setNewUnitModalType('storage');
                            setNewUnitInputValue('');
                          }}
                          title="Créer une nouvelle unité de stockage"
                          className="p-2 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 border border-slate-200 hover:border-blue-300 rounded-lg transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-1">
                        Contenant physique pour le conditionnement et la manutention (sac, boîte, bidon, carton...).
                      </span>
                    </div>

                    {/* 2. Unité de mesure (litre, mètre, kg...) */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 text-xs">
                        Unité de mesure *
                      </label>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={formData.measurementUnit}
                          onChange={(e) => setFormData({ ...formData, measurementUnit: e.target.value })}
                          className="flex-1 min-w-0 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none font-medium capitalize text-xs"
                        >
                          {measurementUnits.map(unitOption => (
                            <option key={unitOption} value={unitOption}>
                              {unitOption}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setNewUnitModalType('measurement');
                            setNewUnitInputValue('');
                          }}
                          title="Créer une nouvelle unité de mesure"
                          className="p-2 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 border border-slate-200 hover:border-blue-300 rounded-lg transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-1">
                        Unité métrique physique pour le dosage et les dimensions (litre, mètre, kg...).
                      </span>
                    </div>
                  </div>

                  {/* Seuil d'Alerte Stock */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1 text-xs">
                      Seuil d'Alerte Stock *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.minStock}
                      onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-amber-700 font-bold focus:border-blue-500 focus:bg-white focus:outline-none text-xs"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Alerte déclenchée lorsque le niveau de stock passe sous ce seuil.
                    </span>
                  </div>

                  {/* Stock actuel informatif (Pas de champ Stock Initial) */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Niveau de Stock Actuel</span>
                      <span className="text-[11px] text-slate-500 block">
                        {editingProduct
                          ? `Quantité en réserve : ${editingProduct.stock} ${formData.storageUnit}s (mesuré en ${formData.measurementUnit})`
                          : 'Le stock initial s\'alimente via les approvisionnements, réceptions ou inventaires physiques.'}
                      </span>
                    </div>
                    {editingProduct && (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        editingProduct.stock <= editingProduct.minStock
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {editingProduct.stock} {formData.storageUnit}s
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Form Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="text-[11px] text-slate-400">
                  {activeProductTab === 'general' && 'Étape 1/3 : Informations Générales'}
                  {activeProductTab === 'uoa_uov' && 'Étape 2/3 : Unités UOA & UOV'}
                  {activeProductTab === 'inventory' && 'Étape 3/3 : Paramètres d\'Inventaire'}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsProductModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#001F3F] hover:bg-blue-900 text-white font-bold shadow-xs transition-colors"
                  >
                    {editingProduct ? 'Enregistrer les modifications' : 'Créer le produit'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Fiche de Création de Catégorie de Produit */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
        products={products}
        onAddCategory={onAddCategory}
        onUpdateCategory={onUpdateCategory}
        onDeleteCategory={onDeleteCategory}
      />

      {/* MODAL: Fiche UOV / UOA */}
      <OperationalUnitsModal
        isOpen={isUnitsModalOpen}
        onClose={() => setIsUnitsModalOpen(false)}
        products={products}
        onUpdateProduct={onUpdateProduct}
      />

      {/* MODAL: Référentiel des Unités de stockage et de mesure */}
      <UnitsManagerModal
        isOpen={isUnitsManagerModalOpen}
        onClose={() => setIsUnitsManagerModalOpen(false)}
        storageUnits={storageUnits}
        measurementUnits={measurementUnits}
        products={products}
        onUpdateStorageUnits={(updated) => setStorageUnits(updated)}
        onUpdateMeasurementUnits={(updated) => setMeasurementUnits(updated)}
        onUpdateProduct={onUpdateProduct}
      />

      {/* MODAL: Importer Fichier Excel */}
      <ImportProductsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        categories={categories}
        onImportProducts={(imported) => {
          if (onBatchAddProducts) {
            onBatchAddProducts(imported);
          } else {
            imported.forEach(p => onAddProduct(p));
          }
        }}
      />

      {/* MODAL: Fiche Détail du Produit (avant modification) */}
      <ProductDetailModal
        isOpen={isDetailModalOpen}
        product={detailProduct}
        movements={movements}
        onClose={() => setIsDetailModalOpen(false)}
        onEdit={(prod) => {
          setIsDetailModalOpen(false);
          handleOpenEdit(prod);
        }}
      />

      {isQrScannerOpen && (
        <QrScannerModal
          onClose={() => setIsQrScannerOpen(false)}
          onScan={handleQrScan}
        />
      )}

      {/* MODAL: Création rapide d'une unité de stockage ou de mesure */}
      {newUnitModalType && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 px-5 border-b border-slate-100 bg-[#001F3F] text-white">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white/10 rounded-lg">
                  <Plus className="w-4 h-4 text-blue-300" />
                </div>
                <h3 className="text-sm font-bold">
                  {newUnitModalType === 'storage' 
                    ? 'Nouvelle unité de stockage' 
                    : 'Nouvelle unité de mesure'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewUnitModalType(null);
                  setNewUnitInputValue('');
                }}
                className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewUnit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {newUnitModalType === 'storage' 
                    ? 'Nom du conditionnement / unité de stockage *' 
                    : 'Nom de l\'unité métrique / de mesure *'}
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder={newUnitModalType === 'storage' ? 'ex: baril, cartouche, fardeau...' : 'ex: milligramme, paire, mètre linéaire...'}
                  value={newUnitInputValue}
                  onChange={(e) => setNewUnitInputValue(capitalizeFirst(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs font-medium focus:border-blue-500 focus:bg-white focus:outline-none"
                />
                <span className="text-[11px] text-slate-500 block mt-1.5">
                  {newUnitModalType === 'storage'
                    ? 'Cette unité sera ajoutée à votre liste de contenants et immédiatement sélectionnée.'
                    : 'Cette unité métrique sera ajoutée à votre liste de mesures et immédiatement sélectionnée.'}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setNewUnitModalType(null);
                    setNewUnitInputValue('');
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#001F3F] hover:bg-blue-900 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter l'unité</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
