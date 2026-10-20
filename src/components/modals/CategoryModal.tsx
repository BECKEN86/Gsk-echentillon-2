import React, { useState } from 'react';
import { 
  FolderPlus, 
  Tag, 
  X, 
  Edit2, 
  Trash2, 
  Check, 
  Plus,
  Boxes,
  Info
} from 'lucide-react';
import { ProductCategory, Product } from '../../types';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ProductCategory[];
  products: Product[];
  onAddCategory: (category: Omit<ProductCategory, 'id'>) => void;
  onUpdateCategory: (category: ProductCategory) => void;
  onDeleteCategory: (id: string) => void;
}

const capitalizeFirst = (s: string) => (!s ? s : s.charAt(0).toUpperCase() + s.slice(1));

/** Calcule le prochain code catégorie auto-incrémenté (ex: CAT-0001, CAT-0002...) */
export function generateNextCategoryCode(categoriesList: ProductCategory[]): string {
  let maxNumber = 0;
  for (const c of categoriesList) {
    if (!c.code) continue;
    const match = c.code.trim().match(/CAT[-_]?(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }
  const nextNum = maxNumber + 1;
  return `CAT-${String(nextNum).padStart(4, '0')}`;
}

const PRESET_COLORS = [
  '#2563EB', // Blue
  '#059669', // Emerald
  '#D97706', // Amber
  '#7C3AED', // Purple
  '#DC2626', // Red
  '#DB2777', // Pink
  '#0891B2', // Cyan
  '#4B5563'  // Slate
];

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  categories,
  products,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory
}) => {
  const [editingCat, setEditingCat] = useState<ProductCategory | null>(null);
  const [formData, setFormData] = useState<{
    code: string;
    name: string;
    description: string;
    color: string;
  }>({
    code: generateNextCategoryCode(categories),
    name: '',
    description: '',
    color: '#2563EB'
  });
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setEditingCat(null);
    setFormData({
      code: generateNextCategoryCode(categories),
      name: '',
      description: '',
      color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
    });
    setErrorMsg('');
  };

  const handleStartEdit = (cat: ProductCategory) => {
    setEditingCat(cat);
    setFormData({
      code: cat.code,
      name: cat.name,
      description: cat.description || '',
      color: cat.color || '#2563EB'
    });
    setErrorMsg('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMsg('Veuillez renseigner un nom pour la catégorie.');
      return;
    }

    // Check duplicate name
    const nameExists = categories.some(
      c => c.name.toLowerCase() === formData.name.trim().toLowerCase() && (!editingCat || c.id !== editingCat.id)
    );
    if (nameExists) {
      setErrorMsg('Une catégorie avec ce nom existe déjà.');
      return;
    }

    if (editingCat) {
      onUpdateCategory({
        ...editingCat,
        ...formData,
        name: capitalizeFirst(formData.name.trim()),
        description: capitalizeFirst(formData.description.trim())
      });
    } else {
      onAddCategory({
        code: (formData.code.trim() || generateNextCategoryCode(categories)).toUpperCase(),
        name: capitalizeFirst(formData.name.trim()),
        description: capitalizeFirst(formData.description.trim()),
        color: formData.color
      });
    }

    handleStartCreate();
  };

  const handleDelete = (id: string, name: string) => {
    const productsInCat = products.filter(p => p.category === name).length;
    if (productsInCat > 0) {
      if (!confirm(`Cette catégorie contient ${productsInCat} produit(s). Êtes-vous sûr de vouloir la supprimer ?`)) {
        return;
      }
    } else {
      if (!confirm(`Supprimer la catégorie "${name}" ?`)) {
        return;
      }
    }
    onDeleteCategory(id);
    if (editingCat?.id === id) {
      handleStartCreate();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-[#001F3F] text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <FolderPlus className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Fiche de Création de Catégorie de Produit</h2>
              <p className="text-xs text-blue-200">
                Organisez vos articles par famille commerciale et personnalisez vos rayons.
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Column: Form */}
          <div className="md:col-span-5 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#001F3F] flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-600" />
                {editingCat ? 'Modifier la Catégorie' : 'Nouvelle Catégorie'}
              </h3>
              {editingCat && (
                <button
                  type="button"
                  onClick={handleStartCreate}
                  className="text-[11px] text-blue-600 hover:underline font-semibold"
                >
                  + Nouveau
                </button>
              )}
            </div>

            {errorMsg && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs flex items-center gap-1.5">
                <Info className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">Code Catégorie</label>
                  <span className="text-[10px] text-slate-400 font-medium">Auto-incrémenté (non modifiable)</span>
                </div>
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  value={formData.code}
                  title="Code catégorie généré automatiquement et non modifiable"
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-mono font-bold cursor-not-allowed select-none focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nom de la Catégorie *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: capitalizeFirst(e.target.value) })}
                  placeholder="ex: Boissons, Alimentation, etc."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: capitalizeFirst(e.target.value) })}
                  placeholder="Description des produits regroupés dans cette catégorie..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Couleur d'identification</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      style={{ backgroundColor: color }}
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform ${
                        formData.color === color ? 'scale-125 ring-2 ring-offset-2 ring-slate-400' : 'hover:scale-110'
                      }`}
                    >
                      {formData.color === color && <Check className="w-3 h-3 text-white" />}
                    </button>
                  ))}
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-7 h-7 p-0.5 rounded border border-slate-200 cursor-pointer"
                    title="Choisir une couleur personnalisée"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-[#001F3F] hover:bg-blue-900 text-white font-bold rounded-lg shadow-xs flex items-center justify-center gap-2 transition-colors"
                >
                  {editingCat ? (
                    <>
                      <Check className="w-4 h-4" />
                      Mettre à jour la catégorie
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Enregistrer la catégorie
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Existing Categories List */}
          <div className="md:col-span-7 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-slate-500" />
                Catégories Existantes ({categories.length})
              </h3>
            </div>

            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {categories.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                  Aucune catégorie pour le moment.
                </div>
              ) : (
                categories.map(cat => {
                  const count = products.filter(p => p.category === cat.name).length;
                  return (
                    <div
                      key={cat.id}
                      className="p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-200 hover:shadow-xs transition-all flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-4 h-10 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color || '#2563EB' }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-xs truncate">
                              {cat.name}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {cat.code}
                            </span>
                          </div>
                          {cat.description && (
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {cat.description}
                            </p>
                          )}
                          <span className="inline-block mt-1 text-[10px] text-blue-700 font-semibold">
                            {count} produit{count > 1 ? 's' : ''} associé{count > 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(cat)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-blue-700 transition-colors"
                          title="Modifier cette catégorie"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(cat.id, cat.name)}
                          className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                          title="Supprimer cette catégorie"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg text-xs transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
