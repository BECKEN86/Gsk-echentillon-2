import React, { useEffect, useRef, useState } from 'react';
import {
  Package,
  Search,
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  CreditCard, 
  Smartphone, 
  Banknote, 
  UserCheck, 
  Receipt, 
  X,
  Lock,
  Camera
} from 'lucide-react';
import { Product, Client, CartItem, SaleOrder, PointDeVente, UserAccount } from '../../../types';
import { formatFCFA } from '../../../data/initialData';
import { formatAppDateTime } from '../../../utils/dateUtils';
import { PointDeVenteOpenModal, PointDeVenteCloseModal } from '../../modals/PointDeVenteModal';
import { PosOrdersModal } from '../../modals/PosOrdersModal';
import { QrScannerModal } from '../../modals/QrScannerModal';
import { showToast } from '../../../utils/toast';
import { canUseCashRegister, hasOpenCashRegister } from '../../../utils/posAccess';

interface PointDeVenteViewProps {
  products: Product[];
  clients: Client[];
  onAddClient?: (clientData: Omit<Client, 'id' | 'totalPurchases'>) => Client | void;
  activePointDeVente?: PointDeVente;
  openCashRegisters?: PointDeVente[];
  onSelectCashRegister?: (registerId: string) => Promise<boolean>;
  saleOrders?: SaleOrder[];
  onNavigateToSessions?: () => void;
  onCompleteSale: (sale: Omit<SaleOrder, 'id' | 'code'>, cartItems: CartItem[]) => SaleOrder | false;
  onOpenReceipt: (sale: SaleOrder) => void;
  /** Enregistre le panier en commande "En cours" (brouillon, sans impact stock) */
  onParkOrder?: (sale: Omit<SaleOrder, 'id' | 'code'>) => void;
  /** Retire un brouillon "En cours" repris dans le panier */
  onResumePendingOrder?: (orderId: string) => void;
  currentUser?: UserAccount | null;
  nextSessionCode?: string;
  onOpenPointDeVente?: (data: {
    code: string;
    date: string;
    operator: string;
    openingAmount: number;
    openedAt: string;
    notes?: string;
  }) => boolean | void;
  onClosePointDeVente?: (pvId: string, closingAmount: number, closedAt: string, notes?: string) => void;
}

export const PointDeVenteView: React.FC<PointDeVenteViewProps> = ({
  products,
  clients,
  onAddClient,
  activePointDeVente,
  openCashRegisters = [],
  onSelectCashRegister,
  saleOrders = [],
  onCompleteSale,
  onOpenReceipt,
  onParkOrder,
  onResumePendingOrder,
  currentUser,
  nextSessionCode = 'PV0001',
  onOpenPointDeVente,
  onClosePointDeVente
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tous');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [newClientData, setNewClientData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    type: 'Particulier' as 'Particulier' | 'Entreprise',
    creditBalance: 0
  });
  const [paymentMethod, setPaymentMethod] = useState<'Espèces' | 'Mobile Money' | 'Carte' | 'Crédit'>('Espèces');
  const [cashGiven, setCashGiven] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
  // UOV choisie par ligne de panier (index dans les UOV du produit, -1/absent = unité de base)
  const [cartUnits, setCartUnits] = useState<Record<string, number>>({});
  // Compteur interne pour l'identifiant unique de chaque ligne du panier
  const lineSeq = useRef(0);
  const nextLineId = () => `L${++lineSeq.current}`;

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientData.name.trim()) return;

    const payload: Omit<Client, 'id' | 'totalPurchases'> = {
      name: newClientData.name.trim(),
      phone: newClientData.phone.trim(),
      email: newClientData.email.trim(),
      address: newClientData.address.trim(),
      type: newClientData.type,
      creditBalance: Number(newClientData.creditBalance) || 0
    };

    if (onAddClient) {
      const created = onAddClient(payload);
      if (created && 'id' in created && created.id) {
        setSelectedClientId(created.id);
      }
    }

    setNewClientData({
      name: '',
      phone: '',
      email: '',
      address: '',
      type: 'Particulier',
      creditBalance: 0
    });
    setIsAddClientModalOpen(false);
  };

  // Filtered orders relevant for this cashier or point de vente
  const sessionOrders = saleOrders.filter(o => {
    if (!activePointDeVente) return true;
    return (
      o.pointDeVenteId === activePointDeVente.id ||
      o.pointDeVenteCode === activePointDeVente.code ||
      o.sellerName === activePointDeVente.operator
    );
  });
  const relevantOrdersCount = sessionOrders.length > 0 ? sessionOrders.length : saleOrders.length;

  const posProducts = products.filter(p => p.availableInPOS !== false);
  const categories = ['Tous', ...Array.from(new Set(posProducts.map(p => p.category)))];

  const filteredProducts = posProducts.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = selectedCategory === 'Tous' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const handleQrScan = (value: string) => {
    const scanned = value.trim();
    setSearchTerm(scanned);
    setSelectedCategory('Tous');
    setIsQrScannerOpen(false);
    const normalized = scanned.toLocaleLowerCase();
    const found = posProducts.some(product =>
      [product.name, product.code, product.barcode || '']
        .some(field => field.toLocaleLowerCase().includes(normalized))
    );
    showToast(
      found ? 'QR code lu : recherche du produit lancée.' : 'Aucun produit correspondant à ce QR code.',
      found ? 'success' : 'error'
    );
  };

  // UOV disponibles pour un produit (liste + rétro-compatibilité champ uov)
  const getUovUnits = (p: Product) => {
    const fromList = (p.operationalUnits || []).filter(u => u.type === 'UOV');
    if (fromList.length > 0) return fromList;
    return p.uov ? [p.uov] : [];
  };

  const getItemUnit = (item: CartItem) => {
    const idx = cartUnits[item.lineId || item.product.id];
    return idx !== undefined && idx >= 0 ? getUovUnits(item.product)[idx] : undefined;
  };

  const getItemUnitPrice = (item: CartItem) => getItemUnit(item)?.price ?? item.product.sellPrice;

  const buildSaleItems = () =>
    cart.map(item => {
      const uov = getItemUnit(item);
      const price = getItemUnitPrice(item);
      return {
        productId: item.product.id,
        productName: uov ? `${item.product.name} (${uov.label})` : item.product.name,
        quantity: item.quantity,
        unitPrice: price,
        unitName: uov?.label,
        unitQuantity: uov?.quantity,
        total: price * item.quantity
      };
    });

  const handleAddToCart = (product: Product) => {
    if (product.stock <= 0) return;
    // Chaque sélection crée une NOUVELLE ligne panier (qté + UOV indépendantes)
    setCart(prev => [
      ...prev,
      { product, quantity: 1, discount: 0, lineId: nextLineId() }
    ]);
  };

  const handleUpdateQuantity = (lineId: string, delta: number) => {
    setCart(prev =>
      prev
        .map(item => {
          if ((item.lineId || item.product.id) === lineId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            const factor = getItemUnit(item)?.quantity || 1;
            if (newQty * factor > item.product.stock) return item;
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveFromCart = (lineId: string) => {
    setCart(prev => prev.filter(item => (item.lineId || item.product.id) !== lineId));
    setCartUnits(prev => {
      const next = { ...prev };
      delete next[lineId];
      return next;
    });
  };

  const handleCancelOrder = () => {
    if (cart.length === 0) return;
    if (!window.confirm('Annuler cette commande ? Le panier sera vidé.')) return;
    setCart([]);
    setCartUnits({});
    setSelectedClientId('');
    setDiscountPercent(0);
    setCashGiven(0);
    setPaymentMethod('Espèces');
  };

  const subtotal = cart.reduce((sum, item) => sum + getItemUnitPrice(item) * item.quantity, 0);
  const discountAmount = Math.round((subtotal * discountPercent) / 100);
  const finalAmount = Math.max(0, subtotal - discountAmount);
  const changeOwed = paymentMethod === 'Espèces' && cashGiven > finalAmount ? cashGiven - finalAmount : 0;

  const handleCheckout = () => {
    if (cart.length === 0) return;
    if (!canUseCashRegister(activePointDeVente, currentUser || null)) {
      showToast('Sélectionnez une caisse ouverte et disponible avant de procéder à un encaissement.', 'error');
      return;
    }
    const client = clients.find(c => c.id === selectedClientId);

    if (paymentMethod === 'Crédit' && !client) {
      alert('Veuillez sélectionner un client pour enregistrer une vente à crédit.');
      return;
    }

    const saleItems = buildSaleItems();

    const newSale: Omit<SaleOrder, 'id' | 'code'> = {
      date: formatAppDateTime(),
      clientId: client?.id,
      clientName: client ? client.name : 'Client Comptoir',
      items: saleItems,
      totalAmount: subtotal,
      discount: discountAmount,
      tax: 0,
      finalAmount,
      paymentMethod,
      status: 'Validé',
      sellerName: currentUser?.name || activePointDeVente?.operator || 'Caissier',
      pointDeVenteId: activePointDeVente?.id,
      pointDeVenteCode: activePointDeVente?.code
    };

    // Quantités converties en unité de base : la déduction du stock applique
    // la contenance de l'UOV choisie (ex: 2 cartons de 12 -> 24 unités retirées)
    const stockCartItems = cart.map(item => ({
      ...item,
      quantity: item.quantity * (getItemUnit(item)?.quantity || 1)
    }));
    const created = onCompleteSale(newSale, stockCartItems);
    if (!created) return; // encaissement refusé (ex: stock insuffisant)

    setCart([]);
    setCartUnits({});
    setShowCheckoutModal(false);
    setDiscountPercent(0);
    setCashGiven(0);

    // Open receipt modal with the persisted sale entity (code séquentiel inclus)
    onOpenReceipt(created);
  };

  // Référence vers l'état courant du panier : à la sortie de la page (démontage
  // du composant), une commande non terminée est enregistrée en "En cours".
  const parkRef = useRef<() => void>(() => {});
  parkRef.current = () => {
    if (cart.length === 0 || !onParkOrder) return;
    const client = clients.find(c => c.id === selectedClientId);
    onParkOrder({
      date: formatAppDateTime(),
      clientId: client?.id,
      clientName: client ? client.name : 'Client Comptoir',
      items: buildSaleItems(),
      totalAmount: subtotal,
      discount: discountAmount,
      tax: 0,
      finalAmount,
      paymentMethod,
      status: 'En cours',
      sellerName: currentUser?.name || activePointDeVente?.operator || 'Caissier',
      pointDeVenteId: activePointDeVente?.id,
      pointDeVenteCode: activePointDeVente?.code
    });
  };

  useEffect(() => {
    return () => parkRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reprend une commande "En cours" : recharge le panier puis retire le brouillon
  const handleResumeOrder = (order: SaleOrder) => {
    const newCart: CartItem[] = [];
    const newUnits: Record<string, number> = {};
    order.items.forEach(it => {
      const product = products.find(p => p.id === it.productId);
      if (!product) return;
      const lineId = nextLineId();
      newCart.push({ product, quantity: it.quantity, discount: 0, lineId });
      if (it.unitName) {
        const idx = getUovUnits(product).findIndex(u => u.label === it.unitName);
        if (idx >= 0) newUnits[lineId] = idx;
      }
    });
    setCart(newCart);
    setCartUnits(newUnits);
    setSelectedClientId(order.clientId || '');
    setDiscountPercent(
      order.totalAmount > 0 ? Math.round(((order.discount || 0) / order.totalAmount) * 100) : 0
    );
    onResumePendingOrder?.(order.id);
    setIsOrdersModalOpen(false);
  };

  return (
    <div className="space-y-4 pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Product Catalog & Search */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search & Category Tabs */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            {/* Recherche + actions de session sur la même ligne */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Scanner ou rechercher un produit par nom..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-12 py-2 bg-slate-50 text-slate-800 placeholder-slate-400 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500"
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

              {currentUser?.role === 'Caissier' && openCashRegisters.length > 0 && (
                <select
                  value={activePointDeVente?.id || ''}
                  onChange={event => {
                    if (event.target.value) void onSelectCashRegister?.(event.target.value);
                  }}
                  className="max-w-48 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:outline-none"
                  aria-label="Sélectionner une caisse disponible"
                >
                  <option value="">Choisir une caisse…</option>
                  {openCashRegisters.map(register => {
                    const occupiedByOther = !!register.occupiedBy && register.occupiedBy !== currentUser.id;
                    return (
                      <option
                        key={register.id}
                        value={register.id}
                        disabled={occupiedByOther}
                      >
                        {register.code} — {occupiedByOther ? 'Occupée' : register.operator}
                      </option>
                    );
                  })}
                </select>
              )}

              <button
                type="button"
                onClick={() => setIsOrdersModalOpen(true)}
                className="px-3.5 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all shrink-0 whitespace-nowrap"
                title="Consulter la liste des commandes et tickets de caisse"
              >
                <Receipt className="w-3.5 h-3.5 text-blue-600" />
                <span>Liste de commandes</span>
                {saleOrders.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white leading-none">
                    {relevantOrdersCount}
                  </span>
                )}
              </button>

              {!activePointDeVente && onOpenPointDeVente &&
                (currentUser?.role !== 'Caissier' || openCashRegisters.length === 0) && (
                <button
                  type="button"
                  onClick={() => setIsOpenModalOpen(true)}
                  className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors shrink-0 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ouvrir ma caisse</span>
                </button>
              )}

              {activePointDeVente && onClosePointDeVente && (
                <button
                  type="button"
                  onClick={() => setIsCloseModalOpen(true)}
                  className="px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs flex items-center gap-1.5 transition-colors shrink-0 whitespace-nowrap"
                  title="Clôturer ma session de caisse"
                >
                  <Lock className="w-3.5 h-3.5 text-rose-600" />
                  <span>Clôturer ma caisse</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? 'bg-[#001F3F] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredProducts.map(product => {
              const inCartQty = cart
                .filter(c => c.product.id === product.id)
                .reduce((s, c) => s + c.quantity, 0);
              const isOutOfStock = product.stock <= 0;

              return (
                <button
                  key={product.id}
                  disabled={isOutOfStock}
                  onClick={() => handleAddToCart(product)}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all relative overflow-hidden group ${
                    isOutOfStock
                      ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                      : inCartQty > 0
                      ? 'bg-blue-50/60 border-blue-500 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-xs'
                  }`}
                >
                  {inCartQty > 0 && (
                    <span className="absolute top-2 right-2 min-w-5 h-5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-extrabold flex items-center justify-center shadow-xs">
                      {inCartQty}
                    </span>
                  )}

                  <div>
                    <div className="w-full h-16 mb-2 rounded-lg bg-slate-100 border border-slate-100 overflow-hidden flex items-center justify-center">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="w-6 h-6 text-slate-300" />
                      )}
                    </div>
                    <h3 className="font-bold text-[#001F3F] text-xs mt-0.5 line-clamp-2 leading-tight">
                      {product.name}
                    </h3>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-extrabold text-emerald-700">
                      {formatFCFA(product.sellPrice)}
                    </span>
                    <span className={`text-[10px] font-semibold ${
                      product.stock <= product.minStock ? 'text-red-600 font-bold' : 'text-slate-500'
                    }`}>
                      {product.stock} {product.unit}s
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Cart & Checkout Register */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                <h2 className="font-bold text-[#001F3F] text-base">Panier de Vente</h2>
              </div>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {cart.reduce((s, i) => s + i.quantity, 0)} article(s)
              </span>
            </div>

            {/* Select Client */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Client</label>
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs font-medium focus:outline-none focus:border-blue-500"
                >
                  <option value="">Client Comptoir (Anonyme)</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.creditBalance > 0 ? `(Dette: ${formatFCFA(c.creditBalance)})` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsAddClientModalOpen(true)}
                  title="Créer un nouveau client"
                  className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-900 border border-blue-200 rounded-lg font-bold text-xs flex items-center justify-center transition-colors shrink-0 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Cart Items List */}
            <div className="space-y-2 min-h-40 max-h-[55vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <ShoppingCart className="w-8 h-8 opacity-40 text-slate-400" />
                  <span>Le panier est vide. Cliquez sur un produit pour l'ajouter.</span>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.lineId || item.product.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex-1 pr-2">
                      <div className="font-bold text-[#001F3F] truncate">{item.product.name}</div>
                      {getUovUnits(item.product).length > 0 ? (
                        <select
                          value={cartUnits[item.lineId || item.product.id] ?? -1}
                          onChange={(e) => {
                            const newIdx = Number(e.target.value);
                            const lineKey = item.lineId || item.product.id;
                            setCartUnits(prev => ({ ...prev, [lineKey]: newIdx }));
                            // Plafonne la quantité selon la contenance de l'UOV choisie
                            const factor = newIdx >= 0
                              ? (getUovUnits(item.product)[newIdx]?.quantity || 1)
                              : 1;
                            const maxQty = Math.max(1, Math.floor(item.product.stock / factor));
                            setCart(prev =>
                              prev.map(ci =>
                                (ci.lineId || ci.product.id) === lineKey
                                  ? { ...ci, quantity: Math.min(ci.quantity, maxQty) }
                                  : ci
                              )
                            );
                          }}
                          className="mt-1 w-full px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-medium text-slate-700 focus:outline-none focus:border-blue-500"
                          title="Choisir l'unité de vente (UOV)"
                        >
                          <option value={-1}>
                            {item.product.unit} — {formatFCFA(item.product.sellPrice)}
                          </option>
                          {getUovUnits(item.product).map((u, i) => (
                            <option key={i} value={i}>
                              {u.label} — {formatFCFA(u.price)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-[10px] text-slate-500">
                          {formatFCFA(item.product.sellPrice)} / {item.product.unit}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-white rounded-md p-0.5 border border-slate-200 shadow-xs">
                        <button
                          onClick={() => handleUpdateQuantity(item.lineId || item.product.id, -1)}
                          className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-bold text-[#001F3F]">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(item.lineId || item.product.id, 1)}
                          className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="font-bold text-emerald-700 text-right w-16">
                        {formatFCFA(getItemUnitPrice(item) * item.quantity)}
                      </div>

                      <button
                        onClick={() => handleRemoveFromCart(item.lineId || item.product.id)}
                        className="p-1 rounded text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Totals & Checkout Trigger */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Sous-total HT</span>
                <span className="font-semibold text-slate-900">{formatFCFA(subtotal)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span>Remise (%)</span>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Math.min(50, Math.max(0, Number(e.target.value))))}
                  className="w-14 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-right font-bold text-amber-700 text-xs"
                />
              </div>

              <div className="flex justify-between text-base font-extrabold text-[#001F3F] pt-2 border-t border-slate-100">
                <span>Total Net à Payer</span>
                <span className="text-emerald-700">{formatFCFA(finalAmount)}</span>
              </div>
            </div>

            <div className="flex items-stretch gap-2">
              <button
                disabled={cart.length === 0 || !canUseCashRegister(activePointDeVente, currentUser || null)}
                onClick={() => {
                  if (!canUseCashRegister(activePointDeVente, currentUser || null)) {
                    showToast('Sélectionnez une caisse ouverte et disponible avant de procéder à un encaissement.', 'error');
                    return;
                  }
                  setShowCheckoutModal(true);
                }}
                className="flex-1 py-3 rounded-lg bg-[#001F3F] hover:bg-blue-900 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-sm shadow-xs transition-colors flex items-center justify-center gap-2"
                title={!canUseCashRegister(activePointDeVente, currentUser || null) ? 'Sélectionnez une caisse ouverte et disponible avant d’encaisser' : undefined}
              >
                <span>Encaisser</span>
              </button>
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={handleCancelOrder}
                title="Annuler la commande en cours"
                className="px-4 py-3 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-sm transition-colors flex items-center justify-center gap-1.5"
              >
                <X className="w-4 h-4" />
                <span>Annuler</span>
              </button>
            </div>
            {!hasOpenCashRegister(activePointDeVente) && openCashRegisters.length === 0 && (
              <p className="text-center text-xs font-semibold text-amber-700">
                Ouvrez une caisse pour pouvoir encaisser cette commande.
              </p>
            )}
            {!hasOpenCashRegister(activePointDeVente) && openCashRegisters.length > 0 && (
              <p className="text-center text-xs font-semibold text-amber-700">
                {openCashRegisters.some(register => !register.occupiedBy || register.occupiedBy === currentUser?.id)
                  ? 'Sélectionnez une caisse disponible pour pouvoir encaisser.'
                  : 'Toutes les caisses ouvertes sont occupées. Contactez un responsable.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Payment Confirmation Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-[#001F3F] flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                Règlement de la Vente
              </h3>
              <button onClick={() => setShowCheckoutModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-center">
                <div className="text-slate-500 uppercase font-semibold text-[10px]">Montant à Encaisser</div>
                <div className="text-2xl font-extrabold text-emerald-700 mt-0.5">{formatFCFA(finalAmount)}</div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-2">Mode de Paiement</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'Espèces', label: 'Espèces', icon: <Banknote className="w-4 h-4 text-emerald-600" /> },
                    { id: 'Mobile Money', label: 'Mobile Money', icon: <Smartphone className="w-4 h-4 text-amber-600" /> },
                    { id: 'Carte', label: 'Carte Bancaire', icon: <CreditCard className="w-4 h-4 text-blue-600" /> },
                    { id: 'Crédit', label: 'Crédit Client', icon: <UserCheck className="w-4 h-4 text-indigo-600" /> }
                  ].map(method => (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id as any)}
                      className={`p-2.5 rounded-lg font-bold flex items-center justify-center gap-2 border transition-colors ${
                        paymentMethod === method.id
                          ? 'bg-blue-50 text-blue-900 border-blue-500'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {method.icon}
                      <span>{method.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'Espèces' && (
                <div className="space-y-2">
                  <label className="block font-semibold text-slate-700">Montant Reçu (Espèces)</label>
                  <input
                    type="number"
                    value={cashGiven || ''}
                    onChange={(e) => setCashGiven(Number(e.target.value))}
                    placeholder="Montant remis par le client..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold text-sm focus:outline-none focus:border-blue-500"
                  />
                  {cashGiven >= finalAmount && (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex justify-between items-center font-bold text-emerald-800 text-sm">
                      <span>Monnaie à rendre :</span>
                      <span>{formatFCFA(changeOwed)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleCheckout}
                  className="px-5 py-2.5 rounded-lg bg-[#001F3F] hover:bg-blue-900 text-white font-extrabold shadow-xs"
                >
                  Valider & Imprimer Reçu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Open Cashier Session Modal */}
      {isOpenModalOpen && onOpenPointDeVente && (
        <PointDeVenteOpenModal
          isOpen={isOpenModalOpen}
          onClose={() => setIsOpenModalOpen(false)}
          nextCode={nextSessionCode}
          defaultOperator={currentUser?.name || 'Opérateur'}
          lockOperator={currentUser?.role === 'Caissier'}
          onConfirmOpen={(data) => {
            const opened = onOpenPointDeVente(data);
            if (opened !== false) {
              setIsOpenModalOpen(false);
            }
          }}
        />
      )}

      {/* Close Cashier Session Modal */}
      {isCloseModalOpen && onClosePointDeVente && activePointDeVente && (
        <PointDeVenteCloseModal
          isOpen={isCloseModalOpen}
          onClose={() => setIsCloseModalOpen(false)}
          pv={activePointDeVente}
          onConfirmClose={(pvId, closingAmount, closedAt, notes) => {
            onClosePointDeVente(pvId, closingAmount, closedAt, notes);
            setIsCloseModalOpen(false);
          }}
        />
      )}

      {/* Cashier Orders List Modal */}
      {isOrdersModalOpen && (
        <PosOrdersModal
          isOpen={isOrdersModalOpen}
          onClose={() => setIsOrdersModalOpen(false)}
          saleOrders={saleOrders}
          activePointDeVente={activePointDeVente}
          cashierMode={currentUser?.role === 'Caissier'}
          onOpenReceipt={onOpenReceipt}
          onResumeOrder={handleResumeOrder}
        />
      )}

      {isQrScannerOpen && (
        <QrScannerModal
          onClose={() => setIsQrScannerOpen(false)}
          onScan={handleQrScan}
        />
      )}

      {/* Modal Création Rapide de Client */}
      {isAddClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-[#001F3F] flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                Nouveau Client
              </h3>
              <button
                type="button"
                onClick={() => setIsAddClientModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nom Complet / Raison Sociale <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ex: M. Kouamé, ETS Bâtiment..."
                  value={newClientData.name}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 text-xs font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Type de Client</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Particulier', 'Entreprise'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewClientData(prev => ({ ...prev, type: t }))}
                      className={`py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        newClientData.type === t
                          ? 'bg-blue-50 text-blue-900 border-blue-500'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Téléphone</label>
                  <input
                    type="tel"
                    placeholder="07 00 00 00 00"
                    value={newClientData.phone}
                    onChange={(e) => setNewClientData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Solde Crédit Initial</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 FCFA"
                    value={newClientData.creditBalance || ''}
                    onChange={(e) => setNewClientData(prev => ({ ...prev, creditBalance: Number(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="client@mail.com"
                    value={newClientData.email}
                    onChange={(e) => setNewClientData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Adresse / Commune</label>
                  <input
                    type="text"
                    placeholder="Ex: Cocody, Abidjan"
                    value={newClientData.address}
                    onChange={(e) => setNewClientData(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddClientModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Enregistrer le client</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
