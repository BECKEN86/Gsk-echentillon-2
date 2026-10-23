import React, { useState } from 'react';
import { 
  Layers, 
  X, 
  Trash2, 
  Check, 
  ShoppingBag, 
  Truck, 
  Plus,
  Edit2,
  PackageCheck
} from 'lucide-react';
import { Product, OperationalUnit, OperationalUnitType } from '../../types';
import { formatFCFA } from '../../data/initialData';

interface OperationalUnitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onUpdateProduct: (product: Product) => void;
  initialProductId?: string;
}

const capitalizeFirst = (s: string) => (!s ? s : s.charAt(0).toUpperCase() + s.slice(1));

export const OperationalUnitsModal: React.FC<OperationalUnitsModalProps> = ({
  isOpen,
  onClose,
  products,
  onUpdateProduct,
  initialProductId
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>(
    initialProductId || (products[0]?.id || '')
  );

  // Formulaire de création / édition d'une UOA ou UOV avec les 4 champs demandés :
  // Libellé, Type (UOA ou UOV), Quantité, Prix
  const [label, setLabel] = useState('');
  const [unitType, setUnitType] = useState<OperationalUnitType>('UOV');
  const [quantity, setQuantity] = useState<number>(1);
  const [price, setPrice] = useState<number>(0);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentProduct = products.find(p => p.id === selectedProductId) || products[0];

  // Récupérer la liste des UOA et UOV du produit sélectionné
  const operationalUnits: OperationalUnit[] = currentProduct ? (
    currentProduct.operationalUnits && currentProduct.operationalUnits.length > 0
      ? currentProduct.operationalUnits
      : [
          ...(currentProduct.uov ? [{
            id: 'legacy_uov',
            label: currentProduct.uov.label || currentProduct.uov.name || 'Unité Vente',
            type: 'UOV' as OperationalUnitType,
            quantity: currentProduct.uov.quantity || 1,
            price: currentProduct.uov.price || currentProduct.sellPrice
          }] : []),
          ...(currentProduct.uoa ? [{
            id: 'legacy_uoa',
            label: currentProduct.uoa.label || currentProduct.uoa.name || 'Conditionnement Achat',
            type: 'UOA' as OperationalUnitType,
            quantity: currentProduct.uoa.quantity || 1,
            price: currentProduct.uoa.price || currentProduct.buyPrice
          }] : [])
        ]
  ) : [];

  const handleResetForm = () => {
    setLabel('');
    setUnitType('UOV');
    setQuantity(1);
    setPrice(0);
    setEditingUnitId(null);
  };

  const handleStartEditUnit = (unit: OperationalUnit) => {
    setEditingUnitId(unit.id || `${unit.label}_${unit.type}`);
    setLabel(unit.label || unit.name || '');
    setUnitType(unit.type);
    setQuantity(unit.quantity);
    setPrice(unit.price);
  };

  const handleSaveUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct || !label.trim()) return;

    let updatedUnits: OperationalUnit[];

    if (editingUnitId) {
      // Modification
      updatedUnits = operationalUnits.map(u => {
        const uid = u.id || `${u.label}_${u.type}`;
        if (uid === editingUnitId) {
          return {
            ...u,
            label: label.trim(),
            type: unitType,
            quantity: Math.max(0.001, Number(quantity) || 1),
            price: Math.max(0, Number(price) || 0)
          };
        }
        return u;
      });
    } else {
      // Création
      const newUnit: OperationalUnit = {
        id: `unit_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        label: label.trim(),
        type: unitType,
        quantity: Math.max(0.001, Number(quantity) || 1),
        price: Math.max(0, Number(price) || 0)
      };
      updatedUnits = [...operationalUnits, newUnit];
    }

    // Mettre à jour le produit
    const updatedProduct: Product = {
      ...currentProduct,
      operationalUnits: updatedUnits,
      // Maintenir uov et uoa pour rétrocompatibilité
      uov: updatedUnits.find(u => u.type === 'UOV') || currentProduct.uov,
      uoa: updatedUnits.find(u => u.type === 'UOA') || currentProduct.uoa
    };

    onUpdateProduct(updatedProduct);
    handleResetForm();
  };

  const handleDeleteUnit = (unitToDelete: OperationalUnit) => {
    if (!currentProduct) return;
    const uidToDelete = unitToDelete.id || `${unitToDelete.label}_${unitToDelete.type}`;
    const updatedUnits = operationalUnits.filter(u => {
      const uid = u.id || `${u.label}_${u.type}`;
      return uid !== uidToDelete;
    });

    const updatedProduct: Product = {
      ...currentProduct,
      operationalUnits: updatedUnits,
      uov: updatedUnits.find(u => u.type === 'UOV'),
      uoa: updatedUnits.find(u => u.type === 'UOA')
    };

    onUpdateProduct(updatedProduct);
    if (editingUnitId === uidToDelete) {
      handleResetForm();
    }
  };

  const uovCount = operationalUnits.filter(u => u.type === 'UOV').length;
  const uoaCount = operationalUnits.filter(u => u.type === 'UOA').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-100 bg-[#001F3F] text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Layers className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Fiche des Unités Opérationnelles (UOA & UOV)
              </h2>
              <p className="text-xs text-blue-200">
                Chaque produit peut posséder plusieurs UOA (achats) et plusieurs UOV (ventes).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product selector banner */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1 max-w-md">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Produit sélectionné :
            </label>
            <select
              value={currentProduct?.id || ''}
              onChange={(e) => {
                setSelectedProductId(e.target.value);
                handleResetForm();
              }}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs font-bold focus:border-blue-500 focus:outline-none shadow-xs"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name} ({p.category})
                </option>
              ))}
            </select>
          </div>

          {currentProduct && (
            <div className="flex items-center gap-3 bg-white p-2.5 px-3 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Prix de référence</span>
                <span className="font-bold text-slate-800">
                  Achat: {formatFCFA(currentProduct.buyPrice)} | Vente: {formatFCFA(currentProduct.sellPrice)}
                </span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Unités actives</span>
                <span className="font-bold text-blue-700">
                  {uovCount} UOV / {uoaCount} UOA
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Main Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Section: Création / Modification d'une UOA ou UOV */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
              <h3 className="text-xs font-bold text-[#001F3F] flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                {editingUnitId ? 'Modifier l\'unité opérationnelle' : 'Créer une nouvelle unité (UOA ou UOV)'}
              </h3>
              {editingUnitId && (
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  Annuler la modification
                </button>
              )}
            </div>

            <form onSubmit={handleSaveUnit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {/* 1. Libellé */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Libellé *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Carton de 24, Palette 40 sacs"
                    value={label}
                    onChange={(e) => setLabel(capitalizeFirst(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:border-blue-500 focus:outline-none font-medium"
                  />
                </div>

                {/* 2. Type: UOA ou UOV */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Type : UOA ou UOV *
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/80 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setUnitType('UOV')}
                      className={`py-1.5 px-2 rounded-md font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                        unitType === 'UOV'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>UOV (Vente)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setUnitType('UOA')}
                      className={`py-1.5 px-2 rounded-md font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                        unitType === 'UOA'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>UOA (Achat)</span>
                    </button>
                  </div>
                </div>

                {/* 3. Quantité */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Quantité *
                  </label>
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    required
                    placeholder="ex: 12"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-bold focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* 4. Prix */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Prix (FCFA) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="ex: 15000"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className={`w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold focus:border-blue-500 focus:outline-none ${
                      unitType === 'UOV' ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#001F3F] hover:bg-blue-900 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
                >
                  {editingUnitId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  <span>{editingUnitId ? 'Enregistrer la modification' : 'Ajouter cette unité'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Section: Tableau des UOA et UOV pour ce produit */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-emerald-600" />
                <span>Unités Opérationnelles enregistrées pour « {currentProduct?.name} »</span>
              </h4>
              <span className="text-[11px] text-slate-500">
                {operationalUnits.length} unité(s) configurée(s)
              </span>
            </div>

            {operationalUnits.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-xs">
                <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold">Aucune unité opérationnelle configurée pour ce produit.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Utilisez les champs ci-dessus (Libellé, Type: UOA ou UOV, Quantité, Prix) pour créer les unités.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Libellé</th>
                      <th className="py-2.5 px-3 text-right">Quantité</th>
                      <th className="py-2.5 px-3 text-right">Prix</th>
                      <th className="py-2.5 px-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {operationalUnits.map((unit, index) => {
                      const isUOV = unit.type === 'UOV';
                      return (
                        <tr key={unit.id || index} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              isUOV
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}>
                              {isUOV ? <ShoppingBag className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                              <span>{unit.type}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {unit.label || unit.name}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                            {unit.quantity}
                          </td>
                          <td className={`py-2.5 px-3 text-right font-bold ${
                            isUOV ? 'text-emerald-700' : 'text-amber-700'
                          }`}>
                            {formatFCFA(unit.price)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleStartEditUnit(unit)}
                                title="Modifier"
                                className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteUnit(unit)}
                                title="Supprimer"
                                className="p-1 rounded text-slate-500 hover:text-red-600 hover:bg-red-50"
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

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Les modifications sont immédiatement sauvegardées pour le produit sélectionné.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#001F3F] text-white font-bold text-xs hover:bg-blue-900 transition-colors shadow-xs"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
