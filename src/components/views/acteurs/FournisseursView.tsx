import React, { useState } from 'react';
import { 
  Truck, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  Edit3, 
  Trash2, 
  X,
  Building2,
  Tag,
  List,
  LayoutGrid,
  Eye,
  Download,
  Upload,
  ChevronDown,
  CheckSquare,
  Square,
  MoreVertical,
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';
import { Supplier } from '../../../types';
import { formatFCFA } from '../../../data/initialData';
import { SupplierDetailModal } from '../../modals/SupplierDetailModal';
import { SupplierKanbanView } from './SupplierKanbanView';

interface FournisseursViewProps {
  suppliers: Supplier[];
  onAddSupplier: (supplier: Omit<Supplier, 'id' | 'balance'>) => void;
  onUpdateSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (id: string) => void;
}

export const FournisseursView: React.FC<FournisseursViewProps> = ({
  suppliers,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('Toutes');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  // Multi-selection state
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  // Actions dropdown menu
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  // Import modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  // Delete confirmation modal state
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Edit / Add modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Supplier Detail Modal state (Fiche Fournisseur complète)
  const [selectedDetailSupplier, setSelectedDetailSupplier] = useState<Supplier | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    categories: ['Alimentation'],
    balance: 0,
    totalPurchases: 0
  });

  // Extract all categories for filtering
  const allCategories = ['Toutes', ...Array.from(new Set(suppliers.flatMap(s => s.categories || [])))];

  const filteredSuppliers = suppliers.filter(s => {
    const matchesSearch = 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.phone.includes(searchTerm) ||
      (s.address && s.address.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = categoryFilter === 'Toutes' || (s.categories && s.categories.includes(categoryFilter));
    return matchesSearch && matchesCat;
  });

  const totalDebtOwed = suppliers.reduce((sum, s) => sum + (s.balance || 0), 0);
  const suppliersWithDebt = suppliers.filter(s => (s.balance || 0) > 0).length;

  // Toggle selection for a single supplier
  const handleToggleSelect = (id: string) => {
    setSelectedSupplierIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Toggle selection for all filtered suppliers
  const handleToggleSelectAll = () => {
    if (selectedSupplierIds.length === filteredSuppliers.length) {
      setSelectedSupplierIds([]);
    } else {
      setSelectedSupplierIds(filteredSuppliers.map(s => s.id));
    }
  };

  const isAllSelected = filteredSuppliers.length > 0 && selectedSupplierIds.length === filteredSuppliers.length;

  // Action: Export selected suppliers (or all if none selected)
  const handleExportSuppliers = () => {
    const suppliersToExport = selectedSupplierIds.length > 0
      ? suppliers.filter(s => selectedSupplierIds.includes(s.id))
      : filteredSuppliers;

    if (suppliersToExport.length === 0) return;

    const headers = ['Société', 'Commercial', 'Téléphone', 'Email', 'Adresse', 'Catégories', 'Crédit (Dette FCFA)', 'Achats (FCFA)'];
    const rows = suppliersToExport.map(s => [
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.contactPerson.replace(/"/g, '""')}"`,
      `"${s.phone}"`,
      `"${s.email || ''}"`,
      `"${(s.address || '').replace(/"/g, '""')}"`,
      `"${(s.categories || []).join('; ')}"`,
      s.balance || 0,
      s.totalPurchases || 0
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `fournisseurs_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Action: Delete selected suppliers
  const handleDeleteSelectedPrompt = () => {
    if (selectedSupplierIds.length === 0) {
      alert("Veuillez d'abord cocher les fournisseurs que vous souhaitez supprimer.");
      return;
    }
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDeleteSelected = () => {
    selectedSupplierIds.forEach(id => {
      onDeleteSupplier(id);
    });
    setSelectedSupplierIds([]);
    setIsDeleteConfirmOpen(false);
  };

  // Action: Import suppliers from CSV
  const handleProcessImport = () => {
    setImportError('');
    if (!importText.trim()) {
      setImportError('Veuillez coller ou importer des données textuelles/CSV.');
      return;
    }

    try {
      const lines = importText.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) {
        setImportError('Le fichier doit contenir au moins un en-tête et une ligne de données.');
        return;
      }

      const headers = lines[0].split(/[;,\t]/).map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const nameIdx = headers.findIndex(h => h.includes('societe') || h.includes('nom') || h.includes('fournisseur'));
      const contactIdx = headers.findIndex(h => h.includes('commercial') || h.includes('contact') || h.includes('interlocuteur'));
      const phoneIdx = headers.findIndex(h => h.includes('tel') || h.includes('phone') || h.includes('mobile'));
      const emailIdx = headers.findIndex(h => h.includes('mail'));
      const addressIdx = headers.findIndex(h => h.includes('adresse') || h.includes('ville') || h.includes('localisation'));
      const catIdx = headers.findIndex(h => h.includes('cat') || h.includes('secteur'));
      const debtIdx = headers.findIndex(h => h.includes('credit') || h.includes('dette') || h.includes('solde'));

      let importedCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(/[;,\t]/).map(c => c.trim().replace(/^"|"$/g, ''));
        const name = nameIdx !== -1 && row[nameIdx] ? row[nameIdx] : `Fournisseur Import ${i}`;
        const contactPerson = contactIdx !== -1 && row[contactIdx] ? row[contactIdx] : 'Responsable Commercial';
        const phone = phoneIdx !== -1 && row[phoneIdx] ? row[phoneIdx] : '+225 00 00 00 00';
        const email = emailIdx !== -1 && row[emailIdx] ? row[emailIdx] : '';
        const address = addressIdx !== -1 && row[addressIdx] ? row[addressIdx] : 'Abidjan';
        const categories = catIdx !== -1 && row[catIdx] ? row[catIdx].split(/[,/]/).map(c => c.trim()) : ['Alimentation'];
        const balance = debtIdx !== -1 && !isNaN(Number(row[debtIdx])) ? Number(row[debtIdx]) : 0;

        onAddSupplier({
          name,
          contactPerson,
          phone,
          email,
          address,
          categories,
          totalPurchases: 0
        });
        importedCount++;
      }

      setIsImportModalOpen(false);
      setImportText('');
    } catch {
      setImportError('Erreur de lecture du format CSV. Veuillez vérifier vos données.');
    }
  };

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setFormData({
      name: '',
      contactPerson: '',
      phone: '+225 ',
      email: '',
      address: 'Zone Industrielle',
      categories: ['Alimentation'],
      balance: 0,
      totalPurchases: 0
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      categories: supplier.categories || ['Alimentation'],
      balance: supplier.balance || 0,
      totalPurchases: supplier.totalPurchases || 0
    });
    setIsModalOpen(true);
  };

  // Open full detailed modal (Fiche Fournisseur)
  const handleOpenDetail = (supplier: Supplier) => {
    setSelectedDetailSupplier(supplier);
    setIsDetailModalOpen(true);
  };

  const handleUpdateSupplierInDetail = (updatedSupplier: Supplier) => {
    onUpdateSupplier(updatedSupplier);
    setSelectedDetailSupplier(updatedSupplier);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingSupplier) {
      onUpdateSupplier({
        ...editingSupplier,
        ...formData
      });
    } else {
      onAddSupplier(formData);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-[#001F3F]">Gestion des Fournisseurs</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gérez votre répertoire grossiste, les lignes de crédit fournisseur avec historique de versements, et les avoirs.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 rounded-lg bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-colors active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau Fournisseur</span>
        </button>
      </div>

      {/* Stats KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold uppercase">Total Fournisseurs</div>
          <div className="text-2xl font-bold text-[#001F3F] mt-1">{suppliers.length}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-red-600 font-semibold uppercase">Total Dettes Fournisseurs (Crédit)</div>
          <div className="text-2xl font-bold text-red-700 mt-1">{formatFCFA(totalDebtOwed)}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold uppercase">Fournisseurs avec solde dû</div>
          <div className="text-2xl font-bold text-[#001F3F] mt-1">
            {suppliersWithDebt}
          </div>
        </div>
      </div>

      {/* Toolbar: Search, Filters, Actions Dropdown & 2 Ergonomic View Buttons */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* Search Bar */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par société, commercial, téléphone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 text-slate-800 placeholder-slate-400 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <span className="text-xs text-slate-500 font-semibold">Secteur :</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
            >
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'Toutes' ? `Tous les secteurs (${suppliers.length})` : cat}
                </option>
              ))}
            </select>
          </div>

          {/* Bouton "Actions" avec liste déroulante (Exporter, Importer, Supprimer) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsActionsMenuOpen(!isActionsMenuOpen)}
              className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <MoreVertical className="w-3.5 h-3.5 text-slate-500" />
              <span>Actions</span>
              {selectedSupplierIds.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px]">
                  {selectedSupplierIds.length}
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isActionsMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isActionsMenuOpen && (
              <div 
                className="absolute left-0 mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1.5 text-xs animate-in fade-in zoom-in-95"
                onClick={() => setIsActionsMenuOpen(false)}
              >
                {/* Exporter */}
                <button
                  type="button"
                  onClick={handleExportSuppliers}
                  className="w-full px-4 py-2.5 text-left text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2.5 transition-colors"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <div>
                    <div className="font-bold">Exporter</div>
                    <div className="text-[10px] text-slate-400">
                      {selectedSupplierIds.length > 0
                        ? `Exporter ${selectedSupplierIds.length} fournisseur(s) sélectionné(s)`
                        : 'Exporter tous les fournisseurs (.csv)'}
                    </div>
                  </div>
                </button>

                {/* Importer */}
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="w-full px-4 py-2.5 text-left text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2.5 transition-colors border-t border-slate-100"
                >
                  <Upload className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="font-bold">Importer</div>
                    <div className="text-[10px] text-slate-400">
                      Importer des fournisseurs (fichier CSV)
                    </div>
                  </div>
                </button>

                {/* Supprimer */}
                <button
                  type="button"
                  onClick={handleDeleteSelectedPrompt}
                  className="w-full px-4 py-2.5 text-left text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors border-t border-slate-100"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                  <div>
                    <div className="font-bold">Supprimer</div>
                    <div className="text-[10px] text-red-400">
                      {selectedSupplierIds.length > 0
                        ? `Supprimer les ${selectedSupplierIds.length} fournisseur(s) sélectionné(s)`
                        : 'Sélectionnez des fournisseurs'}
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Deux Boutons Ergonomiques: Basculer instantanément entre Vue Liste et Vue Kanban */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 self-end md:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              viewMode === 'list'
                ? 'bg-white text-[#001F3F] shadow-xs ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
            title="Afficher la Vue Liste (tableau détaillé)"
          >
            <List className="w-4 h-4 text-blue-600" />
            <span>Vue Liste</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-semibold">
              {filteredSuppliers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              viewMode === 'kanban'
                ? 'bg-white text-[#001F3F] shadow-xs ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
            title="Afficher la Vue Kanban"
          >
            <LayoutGrid className="w-4 h-4 text-blue-600" />
            <span>Vue Kanban</span>
          </button>
        </div>
      </div>

      {/* Barre de sélection active */}
      {selectedSupplierIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex items-center justify-between gap-3 text-xs text-blue-900 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-blue-600" />
            <span className="font-bold">{selectedSupplierIds.length} fournisseur(s) sélectionné(s)</span>
            <button
              type="button"
              onClick={() => setSelectedSupplierIds([])}
              className="text-[11px] text-blue-600 hover:underline ml-2"
            >
              Désélectionner tout
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportSuppliers}
              className="px-3 py-1.5 rounded-lg bg-white border border-blue-200 hover:bg-blue-100 text-blue-700 font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Exporter ({selectedSupplierIds.length})</span>
            </button>
            <button
              type="button"
              onClick={handleDeleteSelectedPrompt}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Supprimer ({selectedSupplierIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* MAIN VIEW: VUE LISTE (TABLEAU DÉTAILLÉ) OU VUE KANBAN */}
      {viewMode === 'list' ? (
        /* Tableau Détaillé des Fournisseurs:
           - Retiré : Lignes Crédit & Avoirs, Statut
           - Renommé : Crédit, Achats, Adresse
        */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-slate-400 hover:text-blue-600 transition-colors"
                      title={isAllSelected ? "Tout désélectionner" : "Tout sélectionner"}
                    >
                      {isAllSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">Fournisseur</th>
                  <th className="py-3 px-3">Contact</th>
                  <th className="py-3 px-3">Adresse</th>
                  <th className="py-3 px-3 text-right">Crédit</th>
                  <th className="py-3 px-3 text-right">Achats</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Aucun fournisseur trouvé pour cette recherche.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((supplier, idx) => {
                    const hasDebt = (supplier.balance || 0) > 0;
                    const isSelected = selectedSupplierIds.includes(supplier.id);

                    return (
                      <tr
                        key={supplier.id ? `${supplier.id}_${idx}` : `s_${idx}`}
                        onClick={() => handleOpenDetail(supplier)}
                        className={`hover:bg-blue-50/40 transition-colors cursor-pointer group ${
                          isSelected ? 'bg-blue-50/30' : ''
                        }`}
                        title="Cliquer pour ouvrir la fiche fournisseur détaillée"
                      >
                        {/* Checkbox sélection */}
                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleToggleSelect(supplier.id)}
                            className="text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* Fournisseur Identity & Secteurs */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#001F3F] text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
                              <Truck className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                                {supplier.name}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                <span className="text-[11px] text-blue-700 font-semibold">
                                  {supplier.contactPerson}
                                </span>
                                {supplier.categories && supplier.categories.length > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                                    {supplier.categories[0]}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="py-3 px-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-mono text-slate-800 font-medium">
                              <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>{supplier.phone}</span>
                            </div>
                            {supplier.email && (
                              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] truncate max-w-[170px]">
                                <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{supplier.email}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Adresse (Renommé depuis Localisation) */}
                        <td className="py-3 px-3 text-slate-600 max-w-[190px]">
                          <div className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                            <span className="truncate" title={supplier.address}>
                              {supplier.address || '—'}
                            </span>
                          </div>
                        </td>

                        {/* Crédit (Renommé depuis Solde Dû (Crédit)) */}
                        <td className="py-3 px-3 text-right">
                          <div className={`font-bold font-mono text-xs ${hasDebt ? 'text-red-700' : 'text-emerald-700'}`}>
                            {formatFCFA(supplier.balance || 0)}
                          </div>
                          {hasDebt && (
                            <div className="text-[10px] text-red-600 font-medium">Dette ouverte</div>
                          )}
                        </td>

                        {/* Achats (Renommé depuis Total Achats) */}
                        <td className="py-3 px-3 text-right">
                          <span className="font-bold font-mono text-slate-800">
                            {formatFCFA(supplier.totalPurchases || 0)}
                          </span>
                        </td>

                        {/* Row Actions */}
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(supplier)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                              title="Consulter la fiche fournisseur"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(supplier)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-slate-100 transition-colors"
                              title="Modifier"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteSupplier(supplier.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Vue Kanban des Fournisseurs */
        <SupplierKanbanView
          suppliers={filteredSuppliers}
          onViewSupplierDetail={handleOpenDetail}
          onEditSupplier={handleOpenEdit}
          onDeleteSupplier={onDeleteSupplier}
          selectedSupplierIds={selectedSupplierIds}
          onToggleSelectSupplier={handleToggleSelect}
        />
      )}

      {/* Fiche Fournisseur Complète (Detail Modal) */}
      {isDetailModalOpen && selectedDetailSupplier && (
        <SupplierDetailModal
          supplier={selectedDetailSupplier}
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedDetailSupplier(null);
          }}
          onEditSupplier={handleOpenEdit}
          onUpdateSupplier={handleUpdateSupplierInDetail}
        />
      )}

      {/* Modale d'Import Fournisseurs CSV */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-[#001F3F] text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Importer des fournisseurs (CSV)</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600">
                Collez vos données CSV ou texte avec séparateur virgule, point-virgule ou tabulation. Colonnes prises en charge : <strong>Société, Commercial, Téléphone, Email, Adresse, Catégories, Crédit</strong>.
              </p>

              <div>
                <textarea
                  rows={7}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`Société;Commercial;Téléphone;Email;Adresse;Catégories;Crédit\nSANIA Distribution;M. Bakayoko;+225 27 21 35 40;commandes@sania.ci;Vridi;Alimentation;150000\nSOLIBRA SA;M. Koffi;+225 27 21 21 88;ventes@solibra.ci;Treichville;Boissons;85000`}
                  className="w-full p-3 font-mono text-[11px] bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              {importError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{importError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleProcessImport}
                  className="px-4 py-2 rounded-xl bg-[#001F3F] hover:bg-blue-900 text-white font-bold flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Lancer l'importation</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modale de Confirmation de Suppression Multi-Fournisseurs */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-bold text-slate-900 text-base">Supprimer {selectedSupplierIds.length} fournisseur(s) ?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Êtes-vous sûr de vouloir supprimer les fournisseurs sélectionnés ? Cette opération est irréversible.
              </p>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold text-xs"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSelected}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirmer la suppression</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'Ajout / Modification Fournisseur */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-[#001F3F] flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                {editingSupplier ? 'Modifier le Fournisseur' : 'Nouveau Fournisseur'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nom de la Société Grossiste</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nom du Commercial / Interlocuteur</label>
                <input
                  type="text"
                  required
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Téléphone</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Adresse / Siège Social</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Secteur / Catégories de produits (séparées par des virgules)</label>
                <input
                  type="text"
                  value={formData.categories.join(', ')}
                  onChange={(e) => setFormData({ ...formData, categories: e.target.value.split(',').map(c => c.trim()).filter(Boolean) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#001F3F] hover:bg-blue-900 text-white font-bold"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
