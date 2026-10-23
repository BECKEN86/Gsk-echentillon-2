import React, { useState } from 'react';
import { 
  UserCheck, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  Edit3, 
  Trash2, 
  X,
  Building2,
  User,
  List,
  LayoutGrid,
  Eye,
  Download,
  Upload,
  ChevronDown,
  CheckSquare,
  Square,
  MoreVertical,
  AlertTriangle} from 'lucide-react';
import { Client, CompanyConfig } from '../../../types';
import { formatFCFA } from '../../../data/initialData';
import { ClientDetailModal } from '../../modals/ClientDetailModal';
import { ClientKanbanView } from './ClientKanbanView';

interface ClientsViewProps {
  clients: Client[];
  companyConfig?: CompanyConfig | null;
  onAddClient: (client: Omit<Client, 'id' | 'totalPurchases'>) => void;
  onUpdateClient: (client: Client) => void;
  onDeleteClient: (id: string) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  companyConfig,
  onAddClient,
  onUpdateClient,
  onDeleteClient
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'Tous' | 'Particulier' | 'Entreprise'>('Tous');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  // Multi-selection state
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  // Actions dropdown menu
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  // Import modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  // Delete confirmation modal state
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Client Detail Modal state (Fiche Client complète)
  const [selectedDetailClient, setSelectedDetailClient] = useState<Client | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    type: 'Particulier' as 'Particulier' | 'Entreprise',
    creditBalance: 0
  });

  const filteredClients = clients.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      c.address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'Tous' || c.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalCreditOwed = clients.reduce((sum, c) => sum + (c.creditBalance || 0), 0);
  const clientsWithCredit = clients.filter(c => (c.creditBalance || 0) > 0).length;

  // Toggle selection for a single client
  const handleToggleSelect = (id: string) => {
    setSelectedClientIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Toggle selection for all filtered clients
  const handleToggleSelectAll = () => {
    if (selectedClientIds.length === filteredClients.length) {
      setSelectedClientIds([]);
    } else {
      setSelectedClientIds(filteredClients.map(c => c.id));
    }
  };

  const isAllSelected = filteredClients.length > 0 && selectedClientIds.length === filteredClients.length;

  // Action: Export selected clients (or all if none selected)
  const handleExportClients = () => {
    const clientsToExport = selectedClientIds.length > 0
      ? clients.filter(c => selectedClientIds.includes(c.id))
      : filteredClients;

    if (clientsToExport.length === 0) return;

    const headers = ['Nom', 'Type', 'Téléphone', 'Email', 'Adresse', 'Crédit (FCFA)', 'Achats (FCFA)'];
    const rows = clientsToExport.map(c => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.type}"`,
      `"${c.phone}"`,
      `"${c.email || ''}"`,
      `"${(c.address || '').replace(/"/g, '""')}"`,
      c.creditBalance || 0,
      c.totalPurchases || 0
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `clients_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Action: Delete selected clients
  const handleDeleteSelectedPrompt = () => {
    if (selectedClientIds.length === 0) {
      alert("Veuillez d'abord cocher les clients que vous souhaitez supprimer.");
      return;
    }
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDeleteSelected = () => {
    selectedClientIds.forEach(id => {
      onDeleteClient(id);
    });
    setSelectedClientIds([]);
    setIsDeleteConfirmOpen(false);
  };

  // Action: Import clients from CSV
  const handleProcessImport = () => {
    setImportError('');
    if (!importText.trim()) {
      setImportError('Veuillez coller ou importer des données textuelles/CSV.');
      return;
    }

    try {
      const lines = importText.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length === 0) {
        setImportError('Aucune ligne trouvée.');
        return;
      }

      const firstLine = lines[0].toLowerCase();
      const hasHeader = firstLine.includes('nom') || firstLine.includes('name') || firstLine.includes('téléphone') || firstLine.includes('type');
      const dataLines = hasHeader ? lines.slice(1) : lines;

      let count = 0;
      dataLines.forEach(line => {
        const delimiter = line.includes(';') ? ';' : line.includes('\t') ? '\t' : ',';
        const cols = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
        if (cols.length >= 1 && cols[0]) {
          const name = cols[0];
          const type = (cols[1] && (cols[1].toLowerCase().includes('entr') || cols[1].toLowerCase().includes('b2b') || cols[1].toLowerCase().includes('société')))
            ? 'Entreprise' 
            : 'Particulier';
          const phone = cols[2] || '+225 07 00 00 00 00';
          const email = cols[3] || '';
          const address = cols[4] || 'Abidjan';
          const creditBalance = cols[5] ? Number(cols[5].replace(/[^0-9.-]/g, '')) || 0 : 0;

          onAddClient({
            name,
            type,
            phone,
            email,
            address,
            creditBalance
          });
          count++;
        }
      });

      if (count === 0) {
        setImportError('Aucun client valide n\'a pu être analysé.');
        return;
      }

      setIsImportModalOpen(false);
      setImportText('');
    } catch (err: any) {
      setImportError(err.message || 'Erreur lors de l\'analyse des données');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportText(content);
      }
    };
    reader.readAsText(file);
  };

  const handleOpenAdd = () => {
    setEditingClient(null);
    setFormData({
      name: '',
      phone: '+225 ',
      email: '',
      address: 'Abidjan',
      type: 'Particulier',
      creditBalance: 0
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      phone: client.phone,
      email: client.email,
      address: client.address,
      type: client.type,
      creditBalance: client.creditBalance
    });
    setIsModalOpen(true);
  };

  const handleOpenDetail = (client: Client) => {
    setSelectedDetailClient(client);
    setIsDetailModalOpen(true);
  };

  const handleUpdateClientInDetail = (updatedClient: Client) => {
    onUpdateClient(updatedClient);
    setSelectedDetailClient(updatedClient);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingClient) {
      onUpdateClient({
        ...editingClient,
        ...formData
      });
    } else {
      onAddClient(formData);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-[#001F3F]">Gestion des Clients</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gérez votre répertoire client, les lignes de crédit avec historique de versements, et les avoirs avec historique de remboursements.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 rounded-lg bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-colors active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau Client</span>
        </button>
      </div>

      {/* Stats KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold uppercase">Total Clients</div>
          <div className="text-2xl font-bold text-[#001F3F] mt-1">{clients.length}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-red-600 font-semibold uppercase">Total Crédits Client (Dettes)</div>
          <div className="text-2xl font-bold text-red-700 mt-1">{formatFCFA(totalCreditOwed)}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold uppercase">Clients avec crédit ouvert</div>
          <div className="text-2xl font-bold text-[#001F3F] mt-1">
            {clientsWithCredit}
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
              placeholder="Rechercher par nom, téléphone, commune..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 text-slate-800 placeholder-slate-400 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <span className="text-xs text-slate-500 font-semibold">Type :</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'Tous' | 'Particulier' | 'Entreprise')}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="Tous">Tous ({clients.length})</option>
              <option value="Particulier">Particuliers ({clients.filter(c => c.type === 'Particulier').length})</option>
              <option value="Entreprise">Entreprises ({clients.filter(c => c.type === 'Entreprise').length})</option>
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
              {selectedClientIds.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px]">
                  {selectedClientIds.length}
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
                  onClick={handleExportClients}
                  className="w-full px-4 py-2.5 text-left text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2.5 transition-colors"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <div>
                    <div className="font-bold">Exporter</div>
                    <div className="text-[10px] text-slate-400">
                      {selectedClientIds.length > 0
                        ? `Exporter ${selectedClientIds.length} client(s) sélectionné(s)`
                        : 'Exporter tous les clients (.csv)'}
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
                      Importer des clients (fichier CSV)
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
                      {selectedClientIds.length > 0
                        ? `Supprimer les ${selectedClientIds.length} client(s) sélectionné(s)`
                        : 'Sélectionnez des clients'}
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
              {filteredClients.length}
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
      {selectedClientIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex items-center justify-between gap-3 text-xs text-blue-900 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-blue-600" />
            <span className="font-bold">{selectedClientIds.length} client(s) sélectionné(s)</span>
            <button
              type="button"
              onClick={() => setSelectedClientIds([])}
              className="text-[11px] text-blue-600 hover:underline ml-2"
            >
              Désélectionner tout
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportClients}
              className="px-3 py-1.5 rounded-lg bg-white border border-blue-200 hover:bg-blue-100 text-blue-700 font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Exporter ({selectedClientIds.length})</span>
            </button>
            <button
              type="button"
              onClick={handleDeleteSelectedPrompt}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Supprimer ({selectedClientIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* MAIN VIEW: VUE LISTE (TABLEAU DÉTAILLÉ) OU VUE KANBAN */}
      {viewMode === 'list' ? (
        /* Tableau Détaillé des Clients */
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
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-3">Contact</th>
                  <th className="py-3 px-3">Adresse</th>
                  <th className="py-3 px-3 text-right">Crédit</th>
                  <th className="py-3 px-3 text-right">Achats</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Aucun client trouvé pour cette recherche.
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client, idx) => {
                    const hasDebt = (client.creditBalance || 0) > 0;
                    const isSelected = selectedClientIds.includes(client.id);

                    return (
                      <tr
                        key={client.id ? `${client.id}_${idx}` : `c_${idx}`}
                        onClick={() => handleOpenDetail(client)}
                        className={`hover:bg-blue-50/40 transition-colors cursor-pointer group ${
                          isSelected ? 'bg-blue-50/30' : ''
                        }`}
                        title="Cliquer pour ouvrir la fiche client détaillée"
                      >
                        {/* Checkbox sélection */}
                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleToggleSelect(client.id)}
                            className="text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* Client Identity & Type */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white shrink-0 ${
                              client.type === 'Entreprise' ? 'bg-[#001F3F]' : 'bg-blue-600'
                            }`}>
                              {client.type === 'Entreprise' ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                            </div>
                            <div>
                              <div className="font-bold text-[#001F3F] text-sm group-hover:text-blue-700 leading-snug">
                                {client.name}
                              </div>
                              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                {client.type}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-700 flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-blue-600" />
                            <span>{client.phone}</span>
                          </div>
                          {client.email && (
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate max-w-[180px]">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span className="truncate">{client.email}</span>
                            </div>
                          )}
                        </td>

                        {/* Adresse (Localisation renommée) */}
                        <td className="py-3 px-3 text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[180px]">{client.address || 'Non spécifiée'}</span>
                          </div>
                        </td>

                        {/* Crédit (Solde Dû renommé) */}
                        <td className="py-3 px-3 text-right">
                          <div className={`font-black text-sm ${hasDebt ? 'text-red-600' : 'text-emerald-700'}`}>
                            {formatFCFA(client.creditBalance || 0)}
                          </div>
                          {hasDebt && (
                            <span className="text-[10px] text-red-500 font-semibold block">
                              En attente
                            </span>
                          )}
                        </td>

                        {/* Achats (Total Achats renommé) */}
                        <td className="py-3 px-3 text-right font-bold text-slate-700">
                          {formatFCFA(client.totalPurchases || 0)}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(client)}
                            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors"
                            title="Consulter la fiche client complète"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(client)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-slate-100 transition-colors"
                            title="Modifier ce client"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteClient(client.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-slate-100 transition-colors"
                            title="Supprimer ce client"
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
      ) : (
        /* Vue Kanban des Clients */
        <ClientKanbanView
          clients={filteredClients}
          onViewClientDetail={handleOpenDetail}
          onEditClient={handleOpenEdit}
          onDeleteClient={onDeleteClient}
          selectedClientIds={selectedClientIds}
          onToggleSelectClient={handleToggleSelect}
        />
      )}

      {/* MODAL: Fiche Client Complète (Information générale, Ligne de crédit, Ligne des avoirs) */}
      <ClientDetailModal
        isOpen={isDetailModalOpen}
        client={selectedDetailClient}
        companyConfig={companyConfig}
        onClose={() => setIsDetailModalOpen(false)}
        onUpdateClient={handleUpdateClientInDetail}
      />

      {/* MODAL: Formulaire de Création / Modification Rapide Client */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-[#001F3F] flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                {editingClient ? 'Modifier le Client' : 'Nouveau Client'}
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
                <label className="block font-semibold text-slate-700 mb-1">Nom Complet / Raison Sociale *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Type de Client *</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Particulier', 'Entreprise'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormData({ ...formData, type: t })}
                      className={`py-2 rounded-lg text-xs font-bold border transition-colors ${
                        formData.type === t
                          ? 'bg-blue-50 text-blue-900 border-blue-500'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Téléphone *</label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contact@exemple.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Adresse / Commune</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Solde Crédit Initial (FCFA)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.creditBalance}
                  onChange={(e) => setFormData({ ...formData, creditBalance: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-red-600 font-bold focus:outline-none focus:border-blue-500"
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

      {/* MODAL: Importation de Clients */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-[#001F3F] flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                <span>Importer des clients</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportError('');
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 text-[11px] leading-relaxed">
                <p className="font-bold mb-1">Format accepté : CSV avec séparateur virgule, point-virgule ou tabulation.</p>
                <p className="font-mono text-[10px] text-blue-800 bg-white/80 p-2 rounded border border-blue-200">
                  Nom, Type, Téléphone, Email, Adresse, Crédit
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Charger un fichier (.csv, .txt)
                </label>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#001F3F] file:text-white hover:file:bg-blue-900 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">
                    Ou collez les données directement :
                  </label>
                </div>
                <textarea
                  rows={5}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Collez vos lignes CSV ici..."
                  className="w-full p-3 font-mono text-[11px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>

              {importError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
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
                  className="px-4 py-2 rounded-xl bg-[#001F3F] hover:bg-blue-900 text-white font-bold flex items-center gap-1.5"
                >
                  <Upload className="w-4 h-4" />
                  <span>Importer les clients</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirmation de suppression groupée */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                Supprimer {selectedClientIds.length} client(s) ?
              </h3>
              <p className="text-xs text-slate-500">
                Cette action supprimera définitivement les clients sélectionnés de votre base de données.
              </p>

              <div className="max-h-36 overflow-y-auto text-left bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                {clients
                  .filter(c => selectedClientIds.includes(c.id))
                  .map(c => (
                    <div key={c.id} className="text-xs text-slate-700 font-medium truncate flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                      <span className="font-bold">{c.name}</span>
                      <span className="text-[10px] text-slate-400">({c.type})</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-xs"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSelected}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirmer la suppression</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
