import React, { useState } from 'react';
import { 
  Boxes, 
  Scale, 
  X, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  Search, 
  AlertTriangle,
  Package,
  Layers,
  Info
} from 'lucide-react';
import { Product } from '../../types';

interface UnitsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  storageUnits: string[];
  measurementUnits: string[];
  products: Product[];
  onUpdateStorageUnits: (units: string[]) => void;
  onUpdateMeasurementUnits: (units: string[]) => void;
  onUpdateProduct?: (product: Product) => void;
}

const capitalizeFirst = (s: string) => (!s ? s : s.charAt(0).toUpperCase() + s.slice(1));

export const UnitsManagerModal: React.FC<UnitsManagerModalProps> = ({
  isOpen,
  onClose,
  storageUnits,
  measurementUnits,
  products,
  onUpdateStorageUnits,
  onUpdateMeasurementUnits,
  onUpdateProduct
}) => {
  const [activeTab, setActiveTab] = useState<'storage' | 'measurement'>('storage');
  const [searchTerm, setSearchTerm] = useState('');

  // Formulaire de création
  const [newUnitName, setNewUnitName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Édition d'une unité existante
  const [editingUnit, setEditingUnit] = useState<{ original: string; current: string; type: 'storage' | 'measurement' } | null>(null);

  // Confirmation de suppression
  const [deleteConfirmUnit, setDeleteConfirmUnit] = useState<{ name: string; type: 'storage' | 'measurement'; count: number } | null>(null);

  if (!isOpen) return null;

  // Calcul du nombre de produits par unité
  const getProductCountForStorageUnit = (unitName: string) => {
    const target = unitName.toLowerCase();
    return products.filter(
      p => (p.storageUnit || p.unit || '').toLowerCase() === target
    ).length;
  };

  const getProductCountForMeasurementUnit = (unitName: string) => {
    const target = unitName.toLowerCase();
    return products.filter(
      p => (p.measurementUnit || '').toLowerCase() === target
    ).length;
  };

  // Filtrage selon la recherche
  const filteredStorageUnits = storageUnits.filter(u =>
    u.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMeasurementUnits = measurementUnits.filter(u =>
    u.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Gestion de la création
  const handleCreateUnit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newUnitName.trim().toLowerCase();
    if (!trimmed) {
      setErrorMsg('Veuillez saisir un nom d\'unité.');
      return;
    }

    if (activeTab === 'storage') {
      if (storageUnits.some(u => u.toLowerCase() === trimmed)) {
        setErrorMsg(`L'unité de stockage "${trimmed}" existe déjà.`);
        return;
      }
      const updated = [...storageUnits, trimmed];
      onUpdateStorageUnits(updated);
      try {
        localStorage.setItem('gestock_custom_storage_units', JSON.stringify(updated));
      } catch { /* ignore */ }
    } else {
      if (measurementUnits.some(u => u.toLowerCase() === trimmed)) {
        setErrorMsg(`L'unité de mesure "${trimmed}" existe déjà.`);
        return;
      }
      const updated = [...measurementUnits, trimmed];
      onUpdateMeasurementUnits(updated);
      try {
        localStorage.setItem('gestock_custom_measurement_units', JSON.stringify(updated));
      } catch { /* ignore */ }
    }

    setNewUnitName('');
    setErrorMsg('');
  };

  // Gestion de la modification
  const handleStartEdit = (unit: string, type: 'storage' | 'measurement') => {
    setEditingUnit({ original: unit, current: unit, type });
    setErrorMsg('');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUnit) return;
    const trimmed = editingUnit.current.trim().toLowerCase();
    if (!trimmed) {
      setErrorMsg('Le nom ne peut pas être vide.');
      return;
    }

    const { original, type } = editingUnit;

    if (type === 'storage') {
      if (trimmed !== original.toLowerCase() && storageUnits.some(u => u.toLowerCase() === trimmed)) {
        setErrorMsg(`L'unité "${trimmed}" existe déjà.`);
        return;
      }
      const updated = storageUnits.map(u => (u.toLowerCase() === original.toLowerCase() ? trimmed : u));
      onUpdateStorageUnits(updated);
      try {
        localStorage.setItem('gestock_custom_storage_units', JSON.stringify(updated));
      } catch { /* ignore */ }

      // Mettre à jour les produits associés si le callback est disponible
      if (onUpdateProduct) {
        products.forEach(p => {
          if ((p.storageUnit || '').toLowerCase() === original.toLowerCase() || (p.unit || '').toLowerCase() === original.toLowerCase()) {
            onUpdateProduct({
              ...p,
              storageUnit: trimmed,
              unit: (p.unit || '').toLowerCase() === original.toLowerCase() ? trimmed : p.unit
            });
          }
        });
      }
    } else {
      if (trimmed !== original.toLowerCase() && measurementUnits.some(u => u.toLowerCase() === trimmed)) {
        setErrorMsg(`L'unité "${trimmed}" existe déjà.`);
        return;
      }
      const updated = measurementUnits.map(u => (u.toLowerCase() === original.toLowerCase() ? trimmed : u));
      onUpdateMeasurementUnits(updated);
      try {
        localStorage.setItem('gestock_custom_measurement_units', JSON.stringify(updated));
      } catch { /* ignore */ }

      // Mettre à jour les produits associés
      if (onUpdateProduct) {
        products.forEach(p => {
          if ((p.measurementUnit || '').toLowerCase() === original.toLowerCase()) {
            onUpdateProduct({
              ...p,
              measurementUnit: trimmed
            });
          }
        });
      }
    }

    setEditingUnit(null);
    setErrorMsg('');
  };

  // Demande de suppression
  const handlePromptDelete = (unit: string, type: 'storage' | 'measurement') => {
    const count = type === 'storage' 
      ? getProductCountForStorageUnit(unit) 
      : getProductCountForMeasurementUnit(unit);
    setDeleteConfirmUnit({ name: unit, type, count });
  };

  // Exécution de la suppression
  const handleConfirmDelete = () => {
    if (!deleteConfirmUnit) return;
    const { name, type } = deleteConfirmUnit;

    if (type === 'storage') {
      const updated = storageUnits.filter(u => u.toLowerCase() !== name.toLowerCase());
      onUpdateStorageUnits(updated);
      try {
        localStorage.setItem('gestock_custom_storage_units', JSON.stringify(updated));
      } catch { /* ignore */ }
    } else {
      const updated = measurementUnits.filter(u => u.toLowerCase() !== name.toLowerCase());
      onUpdateMeasurementUnits(updated);
      try {
        localStorage.setItem('gestock_custom_measurement_units', JSON.stringify(updated));
      } catch { /* ignore */ }
    }

    setDeleteConfirmUnit(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-100 bg-[#001F3F] text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Boxes className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Référentiel des Unités (Stockage & Mesure)
              </h2>
              <p className="text-xs text-blue-200">
                Gérez les contenants physiques de stockage et les unités métriques de mesure de vos articles.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher & Search Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-2 bg-slate-200/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setActiveTab('storage');
                setEditingUnit(null);
                setErrorMsg('');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'storage'
                  ? 'bg-white text-[#001F3F] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-4 h-4 text-blue-600" />
              <span>Unités de stockage</span>
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-semibold ${
                activeTab === 'storage' ? 'bg-blue-100 text-blue-800' : 'bg-slate-300/80 text-slate-700'
              }`}>
                {storageUnits.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('measurement');
                setEditingUnit(null);
                setErrorMsg('');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'measurement'
                  ? 'bg-white text-[#001F3F] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Scale className="w-4 h-4 text-emerald-600" />
              <span>Unités de mesure</span>
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-semibold ${
                activeTab === 'measurement' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-300/80 text-slate-700'
              }`}>
                {measurementUnits.length}
              </span>
            </button>
          </div>

          {/* Search */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={`Rechercher une unité (${activeTab === 'storage' ? 'sac, carton...' : 'litre, kg...'})`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Section Création d'une nouvelle unité */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-xs">
            <h3 className="text-xs font-bold text-[#001F3F] mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600" />
              <span>
                {activeTab === 'storage'
                  ? 'Créer une nouvelle unité de stockage (conditionnement physique)'
                  : 'Créer une nouvelle unité de mesure (grandeur physique)'}
              </span>
            </h3>

            <form onSubmit={handleCreateUnit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder={
                    activeTab === 'storage'
                      ? 'ex: baril, cartouche, palette, fardeau, pack...'
                      : 'ex: milligramme, paire, mètre carré, mètre linéaire...'
                  }
                  value={newUnitName}
                  onChange={(e) => {
                    setNewUnitName(capitalizeFirst(e.target.value));
                    if (errorMsg) setErrorMsg('');
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs font-medium focus:border-blue-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="px-4 py-2 bg-[#001F3F] hover:bg-blue-900 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Créer l'unité</span>
              </button>
            </form>

            {errorMsg && (
              <p className="text-xs text-red-600 mt-2 flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </p>
            )}

            <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>
                {activeTab === 'storage'
                  ? 'Les unités de stockage définissent le conditionnement pour la manutention et les mouvements (sac, bidon, carton, boîte).'
                  : 'Les unités de mesure permettent d\'exprimer les dimensions et dosages physiques métriques (kg, litre, mètre).'}
              </span>
            </p>
          </div>

          {/* Tableau des unités */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                {activeTab === 'storage' ? (
                  <>
                    <Package className="w-4 h-4 text-blue-600" />
                    <span>Tableau des Unités de Stockage ({filteredStorageUnits.length})</span>
                  </>
                ) : (
                  <>
                    <Scale className="w-4 h-4 text-emerald-600" />
                    <span>Tableau des Unités de Mesure ({filteredMeasurementUnits.length})</span>
                  </>
                )}
              </h4>
              <span className="text-[11px] text-slate-500">
                {activeTab === 'storage'
                  ? `${storageUnits.length} unité(s) au total`
                  : `${measurementUnits.length} unité(s) au total`}
              </span>
            </div>

            {/* Modal / zone d'édition en cours */}
            {editingUnit && (
              <div className="mb-4 p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <span className="text-[11px] font-bold text-blue-900 block mb-1">
                    Modification de l'unité « {editingUnit.original} » :
                  </span>
                  <input
                    type="text"
                    autoFocus
                    value={editingUnit.current}
                    onChange={(e) => setEditingUnit({ ...editingUnit, current: capitalizeFirst(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingUnit(null);
                      setErrorMsg('');
                    }}
                    className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Enregistrer</span>
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4 w-12 text-center">#</th>
                    <th className="py-2.5 px-4">Nom de l'unité</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4 text-center">Articles associés</th>
                    <th className="py-2.5 px-4 text-center w-32">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeTab === 'storage' ? (
                    filteredStorageUnits.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          Aucune unité de stockage trouvée.
                        </td>
                      </tr>
                    ) : (
                      filteredStorageUnits.map((unit, index) => {
                        const count = getProductCountForStorageUnit(unit);
                        return (
                          <tr key={unit} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-4 text-center text-slate-400 font-mono text-[11px]">
                              {index + 1}
                            </td>
                            <td className="py-2.5 px-4 font-bold text-slate-800 capitalize">
                              {unit}
                            </td>
                            <td className="py-2.5 px-4">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                                <Package className="w-3 h-3" />
                                <span>Conditionnement stockage</span>
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                count > 0 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                  : 'bg-slate-100 text-slate-500'
                              }`}>
                                {count} produit{count > 1 ? 's' : ''}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(unit, 'storage')}
                                  title="Modifier cette unité"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePromptDelete(unit, 'storage')}
                                  title="Supprimer cette unité"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )
                  ) : (
                    filteredMeasurementUnits.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          Aucune unité de mesure trouvée.
                        </td>
                      </tr>
                    ) : (
                      filteredMeasurementUnits.map((unit, index) => {
                        const count = getProductCountForMeasurementUnit(unit);
                        return (
                          <tr key={unit} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-4 text-center text-slate-400 font-mono text-[11px]">
                              {index + 1}
                            </td>
                            <td className="py-2.5 px-4 font-bold text-slate-800 capitalize">
                              {unit}
                            </td>
                            <td className="py-2.5 px-4">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <Scale className="w-3 h-3" />
                                <span>Grandeur métrique</span>
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                count > 0 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                  : 'bg-slate-100 text-slate-500'
                              }`}>
                                {count} produit{count > 1 ? 's' : ''}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(unit, 'measurement')}
                                  title="Modifier cette unité"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePromptDelete(unit, 'measurement')}
                                  title="Supprimer cette unité"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Les unités configurées sont directement accessibles dans tous les formulaires d'articles.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#001F3F] text-white font-bold text-xs hover:bg-blue-900 transition-colors shadow-xs cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>

      {/* Confirmation Dialog de suppression */}
      {deleteConfirmUnit && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-100 text-red-600 rounded-xl shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Supprimer l'unité « {deleteConfirmUnit.name} » ?
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {deleteConfirmUnit.count > 0 ? (
                    <span className="text-amber-700 font-semibold block">
                      Attention : {deleteConfirmUnit.count} article(s) utilisent actuellement cette unité.
                    </span>
                  ) : null}
                  Cette unité sera retirée de la liste des choix de votre catalogue.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmUnit(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirmer la suppression</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
