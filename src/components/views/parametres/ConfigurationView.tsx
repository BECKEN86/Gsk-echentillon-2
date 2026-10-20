import React, { useRef, useState } from 'react';
import {
  Building2,
  Upload,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  ImageOff,
  AlertTriangle,
  DatabaseBackup
} from 'lucide-react';
import { CompanyConfig } from '../../../types';
import { formatAppDateTime } from '../../../utils/dateUtils';

interface ConfigurationViewProps {
  config: CompanyConfig | null;
  onSave: (config: CompanyConfig) => void;
  /** Remise à zéro — réservée aux administrateurs (bouton masqué sinon) */
  canResetDatabase?: boolean;
  onResetDatabase?: () => Promise<boolean> | boolean;
}

const MAX_LOGO_BYTES = 500 * 1024; // 500 Ko — raisonnable pour une data URL persistée en local

const EMPTY_CONFIG: CompanyConfig = {
  name: '',
  address: '',
  phone: '',
  email: '',
  logo: undefined,
  rccm: '',
  ncc: ''
};

export const ConfigurationView: React.FC<ConfigurationViewProps> = ({
  config,
  onSave,
  canResetDatabase = false,
  onResetDatabase
}) => {
  const [form, setForm] = useState<CompanyConfig>(config || EMPTY_CONFIG);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resetArmed, setResetArmed] = useState(false);
  const [resetText, setResetText] = useState('');
  const [resetBusy, setResetBusy] = useState(false);

  const set = (patch: Partial<CompanyConfig>) => setForm(prev => ({ ...prev, ...patch }));

  const handleLogoFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', text: 'Le fichier doit être une image (PNG, JPG, SVG…).' });
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setFeedback({ type: 'error', text: 'Logo trop lourd : 500 Ko maximum.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      set({ logo: typeof reader.result === 'string' ? reader.result : undefined });
      setFeedback(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFeedback({ type: 'error', text: 'La raison sociale / le nom commercial est requis.' });
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setFeedback({ type: 'error', text: "L'adresse email est invalide." });
      return;
    }
    onSave({ ...form, name: form.name.trim(), updatedAt: formatAppDateTime() });
    setFeedback({ type: 'success', text: 'Configuration de la société enregistrée.' });
    setTimeout(() => setFeedback(null), 4000);
  };

  const inputCls =
    'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none transition-all';
  const labelCls = 'block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">
            <Building2 className="w-5 h-5 text-slate-700" />
          </div>
          Configuration Société
        </h1>
        <p className="text-xs text-slate-500 mt-1.5">
          Identité de l'entreprise utilisée sur les tickets, documents et exports
          {config?.updatedAt && <span className="text-slate-400"> — dernière mise à jour : {config.updatedAt}</span>}
        </p>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success'
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span className="font-medium">{feedback.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Logo */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">Logo</h2>

          <div className="aspect-square max-h-48 w-full rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
            {form.logo ? (
              <img src={form.logo} alt="Logo de la société" className="max-w-full max-h-full object-contain p-3" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <ImageOff className="w-8 h-8" />
                <span className="text-[10px] font-semibold">Aucun logo</span>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              handleLogoFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              {form.logo ? 'Remplacer' : 'Choisir un logo'}
            </button>
            {form.logo && (
              <button
                type="button"
                onClick={() => set({ logo: undefined })}
                title="Supprimer le logo"
                className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Image carrée recommandée, 500 Ko maximum. Le logo apparaît sur les tickets de caisse.
          </p>
        </div>

        {/* Company fields */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">Informations de la société</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Nom / Raison sociale *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => set({ name: e.target.value })}
                placeholder="Ex : GeStock Commerce SARL"
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Siège / Adresse</label>
              <input
                type="text"
                value={form.address}
                onChange={e => set({ address: e.target.value })}
                placeholder="Ex : Abidjan, Cocody Marché"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Contact téléphonique</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => set({ phone: e.target.value })}
                placeholder="Ex : +225 07 00 11 22 33"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => set({ email: e.target.value })}
                placeholder="contact@entreprise.ci"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>N° Registre de Commerce (RCCM)</label>
              <input
                type="text"
                value={form.rccm}
                onChange={e => set({ rccm: e.target.value })}
                placeholder="Ex : CI-ABJ-2024-B-12345"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>N° Compte Contribuable (NCC)</label>
              <input
                type="text"
                value={form.ncc}
                onChange={e => set({ ncc: e.target.value })}
                placeholder="Ex : 1234567A"
                className={inputCls}
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-colors"
            >
              <Save className="w-4 h-4" />
              Enregistrer la configuration
            </button>
          </div>
        </div>
      </form>

      {/* Zone de danger — remise à zéro (administrateurs uniquement) */}
      {canResetDatabase && onResetDatabase && (
        <div className="bg-white rounded-2xl border-2 border-rose-200 shadow-2xs p-5 space-y-3">
          <h2 className="text-xs font-black text-rose-700 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Zone de danger
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
            <span className="font-bold text-slate-800">Vider la base de données</span> supprime
            définitivement toutes les données métier : articles, stocks, mouvements, clients,
            fournisseurs, demandes de prix, bons de commande, réceptions, ventes, sessions de
            caisse, trésorerie, retours, inventaires et journal d'audit.{' '}
            <span className="font-semibold text-emerald-700">
              Les comptes utilisateurs (dont le compte de test) et la configuration société sont
              conservés.
            </span>{' '}
            Pensez à exporter une sauvegarde via « Savegarder » avant de continuer.
          </p>

          {!resetArmed ? (
            <button
              type="button"
              onClick={() => setResetArmed(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors"
            >
              <DatabaseBackup className="w-4 h-4" />
              Vider la base de données…
            </button>
          ) : (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 space-y-3 max-w-xl">
              <p className="text-xs font-bold text-rose-800">
                Action irréversible. Pour confirmer, tapez <span className="font-mono">VIDER</span> :
              </p>
              <input
                type="text"
                value={resetText}
                onChange={e => setResetText(e.target.value.toUpperCase())}
                placeholder="VIDER"
                className="w-full max-w-48 px-3 py-2 bg-white border border-rose-300 rounded-lg text-xs font-mono font-bold text-rose-800 focus:outline-none focus:border-rose-500"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={resetText !== 'VIDER' || resetBusy}
                  onClick={async () => {
                    setResetBusy(true);
                    try {
                      const ok = await onResetDatabase();
                      if (ok) {
                        setResetArmed(false);
                        setResetText('');
                      }
                    } finally {
                      setResetBusy(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-xs font-bold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {resetBusy ? 'Purge en cours…' : 'Confirmer la purge'}
                </button>
                <button
                  type="button"
                  disabled={resetBusy}
                  onClick={() => {
                    setResetArmed(false);
                    setResetText('');
                  }}
                  className="px-4 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors"
                >
                  Abandonner
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
