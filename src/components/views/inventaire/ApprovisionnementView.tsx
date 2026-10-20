import React, { useState, useMemo, useEffect } from 'react';
import {
  PackagePlus,
  Plus,
  Search,
  Filter,
  Calendar,
  User,
  ReceiptText,
  Building2,
  Store,
  Layers,
  ArrowUpDown,
  Printer,
  Eye,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Barcode,
  PackageCheck,
  MapPin,
  ChevronRight,
  X,
  FileSpreadsheet
} from 'lucide-react';
import {
  ApprovisionnementRecord,
  ApprovisionnementItem,
  GoodsReception,
  Product,
  CompanyConfig,
  UserAccount,
  StockMovement,
  StorageSite
} from '../../../types';
import { formatFCFA, INITIAL_STORAGE_SITES } from '../../../data/initialData';
import { formatAppDate, formatAppDateTime } from '../../../utils/dateUtils';
import { ApprovisionnementDetailModal } from '../../modals/ApprovisionnementDetailModal';

interface ApprovisionnementViewProps {
  approvisionnements?: ApprovisionnementRecord[];
  receptions?: GoodsReception[];
  products: Product[];
  companyConfig?: CompanyConfig | null;
  currentUser?: UserAccount | null;
  movements?: StockMovement[];
  storageSites?: StorageSite[];
  onAddApprovisionnement?: (
    appro: Omit<ApprovisionnementRecord, 'id'>
  ) => boolean | void;
  onDeleteApprovisionnement?: (id: string) => void;
  initialReceptionIdToOpen?: string | null;
  onClearInitialReceptionId?: () => void;
}

const DESTINATION_SUGGESTIONS = [
  { type: 'Magasin', label: 'Magasin Central - Allée Principale' },
  { type: 'Magasin', label: 'Magasin Central - Zone Palettes' },
  { type: 'Magasin', label: 'Réserve Générale Magasinier' },
  { type: 'Rayon', label: 'Rayon Épicerie Sèche' },
  { type: 'Rayon', label: 'Rayon Boissons & Eaux' },
  { type: 'Rayon', label: 'Rayon Frais & Produits Vivriers' },
  { type: 'Rayon', label: 'Rayon Hygiène & Entretien' },
  { type: 'Rayon', label: 'Comptoir Vente Directe' }
];

export const ApprovisionnementView: React.FC<ApprovisionnementViewProps> = ({
  approvisionnements = [],
  receptions = [],
  products,
  companyConfig,
  currentUser,
  storageSites,
  onAddApprovisionnement,
  onDeleteApprovisionnement,
  initialReceptionIdToOpen,
  onClearInitialReceptionId
}) => {
  // Sites de stockage configurés (Magasins et Rayons)
  const activeStorageSites = useMemo<StorageSite[]>(() => {
    if (storageSites && storageSites.length > 0) return storageSites;
    try {
      const saved = localStorage.getItem('gestock_storageSites');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return INITIAL_STORAGE_SITES;
  }, [storageSites]);

  // Options correspondantes dans le cas Magasin
  const magasinOptions = useMemo<string[]>(() => {
    const fromSites = activeStorageSites
      .filter(s => s.type === 'Magasin')
      .map(s => s.name);
    const defaults = [
      'Magasin Central',
      'Magasin Central - Allée 1',
      'Magasin Central - Zone Palettes',
      'Réserve Générale',
      'Réserve Générale Magasinier',
      'Dépôt Principal'
    ];
    return Array.from(new Set([...fromSites, ...defaults]));
  }, [activeStorageSites]);

  // Options correspondantes dans le cas Rayon
  const rayonOptions = useMemo<string[]>(() => {
    const fromSites = activeStorageSites
      .filter(s => s.type === 'Rayon')
      .map(s => s.name);
    const defaults = [
      'Rayon Épicerie Sèche',
      'Rayon Boissons & Eaux',
      'Rayon Frais & Produits Vivriers',
      'Rayon Hygiène & Entretien',
      'Rayon Fruits & Légumes',
      'Rayon Boucherie & Charcuterie',
      'Comptoir Vente Directe'
    ];
    return Array.from(new Set([...fromSites, ...defaults]));
  }, [activeStorageSites]);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDestination, setFilterDestination] = useState<'Tous' | 'Magasin' | 'Rayon'>('Tous');
  const [selectedApproDetail, setSelectedApproDetail] = useState<ApprovisionnementRecord | null>(null);
  const [approToDelete, setApproToDelete] = useState<ApprovisionnementRecord | null>(null);

  // New Approvisionnement Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedReceptionId, setSelectedReceptionId] = useState<string>('');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(formatAppDateTime());
  const [operator, setOperator] = useState(currentUser?.name || 'Magasinier');
  const [destinationType, setDestinationType] = useState<'Magasin' | 'Rayon'>('Magasin');
  const [targetLocation, setTargetLocation] = useState('Magasin Central');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ApprovisionnementItem[]>([]);

  const currentDestinationOptions = destinationType === 'Magasin' ? magasinOptions : rayonOptions;

  // Notifications
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Réceptions approvisionnables : ni annulées ni déjà mises en stock
  // par un approvisionnement actif (évite la double entrée en stock)
  const stockableReceptions = useMemo(() => {
    const doneIds = new Set(
      approvisionnements.filter(a => a.status !== 'Annulé').map(a => a.receptionId).filter(Boolean)
    );
    const doneCodes = new Set(
      approvisionnements.filter(a => a.status !== 'Annulé').map(a => a.receptionNumber).filter(Boolean)
    );
    return receptions.filter(
      r => r.status !== 'Annulé' && !doneIds.has(r.id) && !doneCodes.has(r.code)
    );
  }, [receptions, approvisionnements]);

  // Helper to generate the next APP-2026-XXX reference
  const generateNextReference = (): string => {
    const year = new Date().getFullYear();
    const prefix = `APP-${year}-`;
    const existingNums = approvisionnements
      .map(a => a.reference)
      .filter(ref => ref && ref.startsWith(prefix))
      .map(ref => parseInt(ref.replace(prefix, ''), 10))
      .filter(n => !isNaN(n));
    const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 0;
    return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
  };

  // Open creation modal automatically if initialReceptionIdToOpen is passed
  useEffect(() => {
    if (initialReceptionIdToOpen) {
      handleOpenCreateModal(initialReceptionIdToOpen);
      if (onClearInitialReceptionId) {
        onClearInitialReceptionId();
      }
    }
  }, [initialReceptionIdToOpen]);

  // Open Modal Handler
  const handleOpenCreateModal = (presetReceptionId?: string) => {
    const nextRef = generateNextReference();
    setReference(nextRef);
    setDate(formatAppDateTime());
    setOperator(currentUser?.name || 'Magasinier');
    setDestinationType('Magasin');
    const defaultMag = magasinOptions[0] || 'Magasin Central';
    setTargetLocation(defaultMag);
    setNotes('');

    const targetRecId = presetReceptionId || stockableReceptions[0]?.id || '';
    setSelectedReceptionId(targetRecId);

    if (targetRecId) {
      loadItemsFromReception(targetRecId, defaultMag);
    } else {
      setItems([]);
    }

    setIsCreateModalOpen(true);
  };

  // Populate items from a selected reception
  const loadItemsFromReception = (recId: string, defaultLoc: string) => {
    const rec = receptions.find(r => r.id === recId);
    if (!rec) {
      setItems([]);
      return;
    }

    const loadedItems: ApprovisionnementItem[] = rec.items.map(it => {
      const prod = products.find(p => p.id === it.productId);
      const qty = it.acceptedQty ?? it.receivedQty ?? it.orderedQty ?? 1;
      return {
        productId: it.productId,
        productCode: prod?.code || '',
        productName: it.productName || prod?.name || 'Produit',
        barcode: it.barcode || prod?.barcode,
        quantity: qty,
        unitPrice: it.unitPrice || prod?.buyPrice || 0,
        unit: prod?.unit || 'unité',
        targetLocation: prod?.location || defaultLoc,
        expirationDate: it.expirationDate || '',
        notes: ''
      };
    });

    setItems(loadedItems);
  };

  // When selected reception changes in modal
  const handleReceptionChange = (recId: string) => {
    setSelectedReceptionId(recId);
    loadItemsFromReception(recId, targetLocation);
  };

  // Calculate modal totals
  const totalModalQty = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.quantity || 0), 0);
  }, [items]);

  const totalModalValue = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.quantity || 0) * (it.unitPrice || 0), 0);
  }, [items]);

  // Submit New Approvisionnement
  const handleSubmitApprovisionnement = (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      setErrorMsg("Veuillez inclure au moins une ligne de produit dans l'approvisionnement.");
      return;
    }

    if (totalModalQty <= 0) {
      setErrorMsg("La quantité totale à approvisionner doit être supérieure à zéro.");
      return;
    }

    const selectedRec = receptions.find(r => r.id === selectedReceptionId);
    const recNumber = selectedRec ? selectedRec.code : 'REC-MANUELLE';
    const supplier = selectedRec?.supplierName || '';

    const newRecord: Omit<ApprovisionnementRecord, 'id'> = {
      reference: reference.trim() || generateNextReference(),
      date: date || formatAppDateTime(),
      operator: operator.trim() || currentUser?.name || 'Magasinier',
      receptionNumber: recNumber,
      receptionId: selectedRec?.id,
      supplierName: supplier,
      destinationType,
      targetLocation: targetLocation.trim() || (destinationType === 'Magasin' ? 'Magasin Central' : 'Rayon'),
      items: items.filter(it => it.quantity > 0),
      totalItemsCount: items.filter(it => it.quantity > 0).length,
      totalQuantity: totalModalQty,
      totalValue: totalModalValue,
      status: 'Validé',
      notes: notes.trim(),
      createdAt: new Date().toISOString()
    };

    if (onAddApprovisionnement) {
      onAddApprovisionnement(newRecord);
    }

    setIsCreateModalOpen(false);
    setSuccessMsg(`Approvisionnement ${newRecord.reference} validé ! Les produits ont été mis en stock avec succès.`);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  // Filtered list
  const filteredApprovisionnements = useMemo(() => {
    return approvisionnements.filter(app => {
      // Destination filter
      if (filterDestination !== 'Tous' && app.destinationType !== filterDestination) {
        return false;
      }

      // Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchRef = app.reference.toLowerCase().includes(q);
        const matchRec = app.receptionNumber.toLowerCase().includes(q);
        const matchOp = app.operator.toLowerCase().includes(q);
        const matchLoc = app.targetLocation.toLowerCase().includes(q);
        const matchSupp = app.supplierName?.toLowerCase().includes(q);
        const matchItem = app.items.some(
          it => it.productName.toLowerCase().includes(q) || (it.productCode && it.productCode.toLowerCase().includes(q))
        );
        return matchRef || matchRec || matchOp || matchLoc || matchSupp || matchItem;
      }

      return true;
    });
  }, [approvisionnements, filterDestination, searchTerm]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalCount = approvisionnements.length;
    const totalQty = approvisionnements.reduce((sum, a) => sum + (a.totalQuantity || 0), 0);
    const totalVal = approvisionnements.reduce((sum, a) => sum + (a.totalValue || 0), 0);
    const totalMagasin = approvisionnements.filter(a => a.destinationType === 'Magasin').length;
    const totalRayon = approvisionnements.filter(a => a.destinationType === 'Rayon').length;
    return { totalCount, totalQty, totalVal, totalMagasin, totalRayon };
  }, [approvisionnements]);

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Header & Overview */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
              <PackagePlus className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#001F3F] tracking-tight">
                Approvisionnements & Mises en Stock
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Mise en stock des marchandises après réception (affectation vers Magasin ou Rayons)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleOpenCreateModal()}
            className="px-4 py-2.5 rounded-xl bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Nouvel Approvisionnement</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-700 hover:text-rose-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <PackageCheck className="w-4 h-4 text-blue-600" /> Total Bons d'Appro
          </span>
          <div className="text-2xl font-black text-[#001F3F] mt-2">{stats.totalCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">
            {stats.totalMagasin} vers Magasin • {stats.totalRayon} vers Rayon
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-emerald-600" /> Unités Mises en Stock
          </span>
          <div className="text-2xl font-black text-emerald-700 mt-2">
            +{stats.totalQty}
          </div>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">
            Quantités cumulées entrées
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Store className="w-4 h-4 text-amber-600" /> Valeur Totale Stockée
          </span>
          <div className="text-2xl font-black text-[#001F3F] mt-2">
            {formatFCFA(stats.totalVal)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Au coût d'achat unitaire</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <ReceiptText className="w-4 h-4 text-purple-600" /> Réceptions Disponibles
          </span>
          <div className="text-2xl font-black text-purple-700 mt-2">
            {receptions.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Prêtes à être approvisionnées</p>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Filters Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par réf (APP-2026-001), réception, opérateur, rayon..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 text-xs">
              <span className="px-2 font-bold text-slate-400 uppercase text-[10px]">Destination :</span>
              {(['Tous', 'Magasin', 'Rayon'] as const).map(dest => (
                <button
                  key={dest}
                  onClick={() => setFilterDestination(dest)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    filterDestination === dest
                      ? 'bg-[#001F3F] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {dest}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold text-[10px] tracking-wider">
                <th className="py-3 px-4">Référence</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Opérateur</th>
                <th className="py-3 px-4">Réception n°</th>
                <th className="py-3 px-4">Destination (Mise en Stock)</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredApprovisionnements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <PackagePlus className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600 text-sm">Aucun approvisionnement trouvé</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Cliquez sur "Nouvel Approvisionnement" pour sélectionner une réception et mettre vos produits en stock.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredApprovisionnements.map(app => (
                  <tr
                    key={app.id}
                    className="hover:bg-blue-50/40 text-slate-700 transition-colors cursor-pointer"
                    onClick={() => setSelectedApproDetail(app)}
                  >
                    {/* Référence */}
                    <td className="py-3 px-4">
                      <span className="font-mono font-black text-[#001F3F] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-xs">
                        {app.reference}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {app.date}
                    </td>

                    {/* Opérateur */}
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {app.operator}
                    </td>

                    {/* Numéro de Réception */}
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
                        {app.receptionNumber}
                      </span>
                      {app.supplierName && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[150px] mt-0.5">
                          {app.supplierName}
                        </div>
                      )}
                    </td>

                    {/* Destination (Magasin ou Rayon) */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                            app.destinationType === 'Magasin'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {app.destinationType === 'Magasin' ? '🏢 Magasin' : '🛒 Rayon'}
                        </span>
                        <span className="font-medium text-slate-800 truncate max-w-[180px]">
                          {app.targetLocation}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td
                      className="py-3 px-4 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedApproDetail(app)}
                          title="Voir le détail et les lignes"
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {onDeleteApprovisionnement && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setApproToDelete(app);
                            }}
                            title="Supprimer l'approvisionnement"
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div>
            Affichage de <strong>{filteredApprovisionnements.length}</strong> sur <strong>{approvisionnements.length}</strong> bon(s) d'approvisionnement
          </div>
          <div>
            Total valorisé : <strong className="text-slate-900 font-bold">{formatFCFA(stats.totalVal)}</strong>
          </div>
        </div>
      </div>

      {/* MODAL : Créer un Approvisionnement */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden my-4">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-[#001F3F] to-blue-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400">
                  <PackagePlus className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-wide">
                    Nouvel Approvisionnement & Mise en Stock
                  </h2>
                  <p className="text-xs text-blue-200/80">
                    Sélectionnez une réception de marchandise pour en affecter les produits dans un magasin ou un rayon.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitApprovisionnement} className="flex flex-col flex-1 overflow-hidden text-xs">
              <div className="p-6 overflow-y-auto space-y-6">
                {/* Section 1 : Informations Principales (Entête de l'entité) */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#001F3F] flex items-center gap-2">
                    <ReceiptText className="w-4 h-4 text-blue-600" />
                    1. Entête de l'Approvisionnement
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Référence (ex: APP-2026-001) */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Référence <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={reference}
                        placeholder="ex: APP-2026-001"
                        className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-mono font-bold text-slate-500 cursor-not-allowed focus:outline-none"
                      />
                    </div>

                    {/* Date */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Date & Heure <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* Opérateur */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Opérateur <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={operator}
                        placeholder="Nom du magasinier"
                        className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-medium cursor-not-allowed focus:outline-none"
                      />
                    </div>

                    {/* Numéro de réception (Reception n°) */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Numéro de Réception (Reception n°) <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={selectedReceptionId}
                        onChange={(e) => handleReceptionChange(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
                      >
                        {stockableReceptions.length === 0 ? (
                          <option value="">Aucune réception disponible</option>
                        ) : (
                          stockableReceptions.map(rec => (
                            <option key={rec.id} value={rec.id}>
                              {rec.code} - {rec.supplierName} ({rec.items.length} articles)
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 2 : Destination (Magasin ou Rayon) */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#001F3F] flex items-center gap-2">
                    <Store className="w-4 h-4 text-emerald-600" />
                    2. Destination de la Mise en Stock (Magasin ou Rayon)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Destination Type Toggle */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Type de Destination</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDestinationType('Magasin');
                            setTargetLocation(magasinOptions[0] || 'Magasin Central');
                          }}
                          className={`p-2 rounded-lg font-bold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                            destinationType === 'Magasin'
                              ? 'bg-blue-50 text-blue-900 border-blue-500 shadow-xs'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <span>🏢 Magasin</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDestinationType('Rayon');
                            setTargetLocation(rayonOptions[0] || 'Rayon Épicerie Sèche');
                          }}
                          className={`p-2 rounded-lg font-bold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                            destinationType === 'Rayon'
                              ? 'bg-amber-50 text-amber-900 border-amber-500 shadow-xs'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <span>🛒 Rayon</span>
                        </button>
                      </div>
                    </div>

                    {/* Target Location */}
                    <div className="md:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">
                        Emplacement Précis (Nom du Magasin ou du Rayon)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          value={targetLocation}
                          onChange={(e) => setTargetLocation(e.target.value)}
                          placeholder={destinationType === 'Magasin' ? 'ex: Magasin Central' : 'ex: Rayon Épicerie Sèche'}
                          className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-blue-500"
                        />
                        <select
                          value={currentDestinationOptions.includes(targetLocation) ? targetLocation : ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              setTargetLocation(e.target.value);
                            }
                          }}
                          className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium text-xs focus:outline-none focus:border-blue-500 cursor-pointer min-w-[220px]"
                        >
                          <option value="">
                            {destinationType === 'Magasin'
                              ? '-- Choisir un magasin --'
                              : '-- Choisir un rayon --'}
                          </option>
                          {currentDestinationOptions.map((opt, idx) => (
                            <option key={idx} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3 : Lignes d'approvisionnement (produits concernés) */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#001F3F] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-600" />
                    3. Lignes d'Approvisionnement ({items.length} produit{items.length > 1 ? 's' : ''})
                  </h3>

                  {items.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl text-slate-500">
                      <p className="font-semibold">Aucun article chargé pour cette réception</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Sélectionnez une réception ci-dessus ou ajoutez des produits manuellement.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 uppercase font-semibold text-[10px]">
                              <th className="py-2.5 px-3">Produit</th>
                              <th className="py-2.5 px-3 text-center w-28">Quantité à Stocker</th>
                              <th className="py-2.5 px-3">Emplacement Spécifique</th>
                              <th className="py-2.5 px-3">Péremption</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {items.map((it, idx) => (
                              <tr key={`${it.productId}_${idx}`} className="hover:bg-slate-50">
                                {/* Produit info */}
                                <td className="py-2.5 px-3">
                                  <div className="font-bold text-slate-900">{it.productName}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {it.productCode} {it.barcode ? `• ${it.barcode}` : ''}
                                  </div>
                                </td>

                                {/* Quantité */}
                                <td className="py-2.5 px-3 text-center">
                                  <input
                                    type="number"
                                    readOnly
                                    value={it.quantity}
                                    className="w-20 px-2 py-1 bg-slate-100 border border-slate-200 rounded-lg text-center font-bold text-slate-500 text-sm cursor-not-allowed focus:outline-none"
                                  />
                                </td>

                                {/* Emplacement spécifique */}
                                <td className="py-2.5 px-3">
                                  <input
                                    type="text"
                                    readOnly
                                    value={it.targetLocation || targetLocation}
                                    placeholder={targetLocation}
                                    className="w-full px-2 py-1 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 text-xs cursor-not-allowed focus:outline-none"
                                  />
                                </td>

                                {/* Date péremption */}
                                <td className="py-2.5 px-3">
                                  <input
                                    type="date"
                                    disabled
                                    value={it.expirationDate || ''}
                                    className="px-2 py-1 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 text-xs font-mono cursor-not-allowed"
                                  />
                                </td>

                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-50 font-bold border-t-2 border-slate-200 text-slate-800">
                              <td className="py-2.5 px-3 text-slate-500 uppercase text-[10px]">
                                Total approvisionnement
                              </td>
                              <td className="py-2.5 px-3 text-center font-black text-emerald-700 text-sm">
                                +{totalModalQty} unités
                              </td>
                              <td colSpan={2}></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 4 : Observations */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Remarques / Observations de rangement
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="ex: Palettes rangées en allée 1, articles d'épicerie mis en tête de gondole..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-xs transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={items.length === 0 || totalModalQty <= 0}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all active:scale-95"
                  >
                    <PackagePlus className="w-4 h-4" />
                    <span>Valider l'Approvisionnement & Mettre en Stock</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL : Fiche Détail & Impression */}
      {selectedApproDetail && (
        <ApprovisionnementDetailModal
          appro={selectedApproDetail}
          companyConfig={companyConfig}
          onClose={() => setSelectedApproDetail(null)}
          onDeleteApprovisionnement={onDeleteApprovisionnement ? (id) => {
            const target = (approvisionnements || []).find(a => a.id === id);
            if (target) {
              setApproToDelete(target);
            } else if (onDeleteApprovisionnement) {
              onDeleteApprovisionnement(id);
              setSelectedApproDetail(null);
            }
          } : undefined}
        />
      )}

      {/* Confirmation Modal : Supprimer définitivement un approvisionnement */}
      {approToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-[#001F3F] text-base">
                  Supprimer l'approvisionnement ?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Référence : <strong className="font-mono text-slate-800">{approToDelete.reference}</strong> —{' '}
                  <span className="font-semibold text-blue-700">{approToDelete.totalQuantity} article(s)</span>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200 leading-relaxed">
              Êtes-vous sûr de vouloir supprimer définitivement cet approvisionnement ?
              Le document sera immédiatement retiré de la liste et les quantités ajoutées seront déduites du stock.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setApproToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteApprovisionnement) {
                    onDeleteApprovisionnement(approToDelete.id);
                  }
                  if (selectedApproDetail?.id === approToDelete.id) {
                    setSelectedApproDetail(null);
                  }
                  setSuccessMsg(`Approvisionnement ${approToDelete.reference} supprimé avec succès.`);
                  setTimeout(() => setSuccessMsg(''), 4000);
                  setApproToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
