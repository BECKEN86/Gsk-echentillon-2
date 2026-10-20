import React, { useState, useMemo } from 'react';
import {
  Store,
  Layers,
  Plus,
  Search,
  MapPin,
  Trash2,
  X,
  Package,
  Warehouse,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { StorageSite, UserAccount } from '../../../types';

interface MagasinsViewProps {
  storageSites: StorageSite[];
  currentUser?: UserAccount | null;
  onAddStorageSite?: (site: Omit<StorageSite, 'id' | 'createdAt'>) => boolean | void;
  onDeleteStorageSite?: (id: string) => void;
}

export const MagasinsView: React.FC<MagasinsViewProps> = ({
  storageSites = [],
  onAddStorageSite,
  onDeleteStorageSite
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [siteToDelete, setSiteToDelete] = useState<StorageSite | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Create form state
  const [formType, setFormType] = useState<'Magasin' | 'Rayon'>('Magasin');
  const [formName, setFormName] = useState('');
  const [formCapacity, setFormCapacity] = useState<number | ''>('');
  const [formShelfCount, setFormShelfCount] = useState<number | ''>('');
  const [formMagasinId, setFormMagasinId] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formDescription, setFormDescription] = useState('');

  const magasins = useMemo(() => storageSites.filter(s => s.type === 'Magasin'), [storageSites]);
  const rayons = useMemo(() => storageSites.filter(s => s.type === 'Rayon'), [storageSites]);

  const stats = useMemo(() => ({
    magasinCount: magasins.length,
    rayonCount: rayons.length,
    totalCapacity: magasins.reduce((sum, m) => sum + (m.capacity || 0), 0),
    totalShelves: rayons.reduce((sum, r) => sum + (r.shelfCount || 0), 0)
  }), [magasins, rayons]);

  const query = searchTerm.trim().toLowerCase();
  const filteredMagasins = useMemo(
    () => magasins.filter(m => !query || m.name.toLowerCase().includes(query) || (m.location || '').toLowerCase().includes(query)),
    [magasins, query]
  );
  const filteredRayons = useMemo(
    () => rayons.filter(r => !query || r.name.toLowerCase().includes(query) || (r.location || '').toLowerCase().includes(query)),
    [rayons, query]
  );

  const magasinName = (id?: string) => magasins.find(m => m.id === id)?.name || '—';
  const rayonsCountFor = (magasinId: string) => rayons.filter(r => r.magasinId === magasinId).length;

  const resetForm = () => {
    setFormType('Magasin');
    setFormName('');
    setFormCapacity('');
    setFormShelfCount('');
    setFormMagasinId('');
    setFormLocation('');
    setFormDescription('');
    setErrorMsg('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = formName.trim();
    if (!name) {
      setErrorMsg('Le nom de l\'emplacement est obligatoire.');
      return;
    }
    if (formType === 'Magasin' && (formCapacity === '' || formCapacity < 0)) {
      setErrorMsg('Renseignez la capacité de stockage du magasin.');
      return;
    }
    if (formType === 'Rayon' && (formShelfCount === '' || formShelfCount < 0)) {
      setErrorMsg('Renseignez le nombre d\'étagères du rayon.');
      return;
    }

    onAddStorageSite?.({
      name,
      type: formType,
      capacity: formType === 'Magasin' ? Number(formCapacity) : undefined,
      shelfCount: formType === 'Rayon' ? Number(formShelfCount) : undefined,
      magasinId: formType === 'Rayon' && formMagasinId ? formMagasinId : undefined,
      location: formLocation.trim() || undefined,
      description: formDescription.trim() || undefined
    });

    setIsCreateModalOpen(false);
    resetForm();
  };

  const statCards = [
    { label: 'Magasins', value: stats.magasinCount, icon: Warehouse, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
    { label: 'Rayons', value: stats.rayonCount, icon: Layers, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
    { label: 'Capacité totale', value: `${stats.totalCapacity.toLocaleString('fr-FR')} u`, icon: Package, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
    { label: 'Étagères totales', value: stats.totalShelves, icon: Layers, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' }
  ];

  const renderSiteRow = (site: StorageSite, isMagasin: boolean) => (
    <tr key={site.id} className="hover:bg-blue-50/40 text-slate-700 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${isMagasin ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
            {isMagasin ? <Store className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
          </span>
          <div>
            <p className="font-bold text-slate-900">{site.name}</p>
            {site.description && <p className="text-[10px] text-slate-400 truncate max-w-[220px]">{site.description}</p>}
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-slate-600">
        {site.location ? (
          <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" />{site.location}</span>
        ) : '—'}
      </td>
      {isMagasin ? (
        <>
          <td className="py-3 px-4 text-center font-black text-[#001F3F]">
            {(site.capacity ?? 0).toLocaleString('fr-FR')} u
          </td>
          <td className="py-3 px-4 text-center">
            <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700">
              {rayonsCountFor(site.id)} rayon{rayonsCountFor(site.id) > 1 ? 's' : ''}
            </span>
          </td>
        </>
      ) : (
        <>
          <td className="py-3 px-4 text-slate-600">{magasinName(site.magasinId)}</td>
          <td className="py-3 px-4 text-center font-black text-[#001F3F]">
            {site.shelfCount ?? 0} étagère{(site.shelfCount ?? 0) > 1 ? 's' : ''}
          </td>
        </>
      )}
      <td className="py-3 px-4 text-right">
        {onDeleteStorageSite && (
          <button
            onClick={() => setSiteToDelete(site)}
            title="Supprimer"
            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </td>
    </tr>
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#001F3F] tracking-tight">Magasins & Rayons</h1>
          <p className="text-sm text-slate-500 mt-1">Emplacements de stockage : entrepôts, magasins et rayons de vente</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsCreateModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/25 transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          Nouvel Emplacement
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <div key={card.label} className={`rounded-2xl border p-4 ${card.bg}`}>
            <div className="flex items-center justify-between">
              <card.icon className={`w-5 h-5 ${card.color}`} />
              <span className={`text-xl font-black ${card.color}`}>{card.value}</span>
            </div>
            <p className="text-xs font-semibold text-slate-600 mt-2">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Rechercher un magasin ou un rayon..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all"
        />
      </div>

      {/* Table Magasins */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
          <Warehouse className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-800">Magasins <span className="text-slate-400 font-medium">({filteredMagasins.length})</span></h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold text-[10px] tracking-wider">
                <th className="py-3 px-4">Nom</th>
                <th className="py-3 px-4">Localisation</th>
                <th className="py-3 px-4 text-center">Capacité de stockage</th>
                <th className="py-3 px-4 text-center">Rayons rattachés</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMagasins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    <Warehouse className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600 text-sm">Aucun magasin trouvé</p>
                  </td>
                </tr>
              ) : filteredMagasins.map(m => renderSiteRow(m, true))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table Rayons */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
          <Layers className="w-4 h-4 text-amber-600" />
          <h2 className="text-sm font-bold text-slate-800">Rayons <span className="text-slate-400 font-medium">({filteredRayons.length})</span></h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold text-[10px] tracking-wider">
                <th className="py-3 px-4">Nom</th>
                <th className="py-3 px-4">Localisation</th>
                <th className="py-3 px-4">Magasin de rattachement</th>
                <th className="py-3 px-4 text-center">Nombre d'étagères</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRayons.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600 text-sm">Aucun rayon trouvé</p>
                  </td>
                </tr>
              ) : filteredRayons.map(r => renderSiteRow(r, false))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal : créer un emplacement */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-[#001F3F] to-blue-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base">Nouvel Emplacement</h3>
                  <p className="text-[11px] text-blue-200">Magasin ou rayon de stockage</p>
                </div>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-medium">{errorMsg}</span>
                </div>
              )}

              {/* Type selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Type d'emplacement</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['Magasin', 'Rayon'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setFormType(t); setErrorMsg(''); }}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold transition-all ${
                        formType === t
                          ? t === 'Magasin'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {t === 'Magasin' ? <Warehouse className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nom */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Nom <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder={formType === 'Magasin' ? 'Ex : Magasin Central' : 'Ex : Rayon Boissons'}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all"
                />
              </div>

              {/* Capacité (Magasin) ou Étagères (Rayon) */}
              {formType === 'Magasin' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Capacité de stockage (unités) <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    min={0}
                    value={formCapacity}
                    onChange={e => setFormCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ex : 5000"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Nombre d'étagères <span className="text-rose-500">*</span></label>
                    <input
                      type="number"
                      min={0}
                      value={formShelfCount}
                      onChange={e => setFormShelfCount(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Ex : 10"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 focus:outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Magasin de rattachement</label>
                    <select
                      value={formMagasinId}
                      onChange={e => setFormMagasinId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 focus:outline-none transition-all"
                    >
                      <option value="">— Aucun (rayon autonome) —</option>
                      {magasins.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Localisation */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Localisation</label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={e => setFormLocation(e.target.value)}
                  placeholder="Ex : Zone industrielle, Allée B..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Description</label>
                <textarea
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  rows={2}
                  placeholder="Notes ou précisions sur cet emplacement..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-bold shadow-lg shadow-blue-600/25 transition-all active:scale-[0.98]"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal : confirmation suppression */}
      {siteToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6">
            <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-4">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="font-black text-slate-900">Supprimer cet emplacement ?</h3>
            <p className="text-xs text-slate-500 mt-1.5">
              <strong>{siteToDelete.name}</strong> ({siteToDelete.type}) sera définitivement supprimé.
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setSiteToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => { onDeleteStorageSite?.(siteToDelete.id); setSiteToDelete(null); }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
