import React, { useState, useRef } from 'react';
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  X,
  FileCode,
  ShieldCheck,
  Server,
  Package,
  Users,
  Store,
  DollarSign
} from 'lucide-react';
import { AppDatabase, downloadBackupFile, importDatabaseJSON, getDefaultDatabase, saveDatabase, getDatabaseStats } from '../../services/storageService';

interface DatabaseManagerModalProps {
  currentDatabase: AppDatabase;
  onDatabaseRestored: (newDb: AppDatabase) => void;
  onClose: () => void;
}

export const DatabaseManagerModal: React.FC<DatabaseManagerModalProps> = ({
  currentDatabase,
  onDatabaseRestored,
  onClose
}) => {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = getDatabaseStats(currentDatabase);

  const handleExport = () => {
    try {
      downloadBackupFile(currentDatabase);
      setSuccessMessage('Base de données sauvegardée et téléchargée sur votre machine avec succès !');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch {
      setErrorMessage('Erreur lors du téléchargement de la sauvegarde.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importDatabaseJSON(content);
      if (res.success && res.data) {
        onDatabaseRestored(res.data);
        setSuccessMessage('Base de données locale restaurée avec succès !');
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setErrorMessage(res.error || 'Erreur lors de la lecture du fichier de sauvegarde.');
      }
    };
    reader.onerror = () => {
      setErrorMessage('Impossible de lire le fichier sélectionné.');
    };
    reader.readAsText(file);
    // Reset file input value so same file can be reloaded
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleResetToFactory = () => {
    const defaults = getDefaultDatabase();
    saveDatabase(defaults);
    onDatabaseRestored(defaults);
    setIsResetConfirmOpen(false);
    setSuccessMessage('Données réinitialisées aux valeurs initiales d\'usine avec succès.');
    setTimeout(() => setSuccessMessage(null), 4000);
  };



  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#001F3F] text-white px-6 py-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 rounded-xl text-blue-300 border border-blue-400/30">
              <Database className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Base de Données Locale (Local Database)
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Active & Persistante
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Toutes vos données sont enregistrées en temps réel dans la base SQLite locale.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Notifications */}
          {successMessage && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Machine & Local Storage Info Card */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
            <div className="flex items-start gap-3">
              <HardDrive className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">
                  Stockage local sécurisé sur votre poste
                </p>
                <p>
                  L'application utilise une <strong className="text-slate-800">base de données SQLite locale autonome et persistante</strong> — aucune donnée ne quitte votre poste.
                </p>
                <p className="text-slate-500 text-[11px]">
                  Vos créations, ventes, caisses et modifications ne sont plus perdues lors de la fermeture ou du rafraîchissement de la page.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <Server className="w-3.5 h-3.5 text-blue-600" />
                <span>Enregistrements</span>
              </div>
              <div className="text-xl font-bold text-[#001F3F]">{stats.totalRecords}</div>
              <div className="text-[10px] text-slate-400">Total entités</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
                <span>Taille Stockée</span>
              </div>
              <div className="text-xl font-bold text-emerald-700">{stats.sizeInKB} Ko</div>
              <div className="text-[10px] text-slate-400">Navigateur local</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <Store className="w-3.5 h-3.5 text-purple-600" />
                <span>Sessions & Ventes</span>
              </div>
              <div className="text-xl font-bold text-purple-700">
                {stats.counts.pointsDeVente} / {stats.counts.saleOrders}
              </div>
              <div className="text-[10px] text-slate-400">PV / Ventes</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                <span>Finance & Mvts</span>
              </div>
              <div className="text-xl font-bold text-amber-700">{stats.counts.transactions}</div>
              <div className="text-[10px] text-slate-400">Transactions</div>
            </div>
          </div>

          {/* Breakdown table list */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 border-b border-slate-200 flex justify-between">
              <span>Tables de la Base de Données</span>
              <span>Nombre d'enregistrements</span>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="px-4 py-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-700">
                  <Package className="w-3.5 h-3.5 text-blue-500" />
                  Produits du catalogue
                </span>
                <span className="font-semibold text-slate-900">{stats.counts.products}</span>
              </div>
              <div className="px-4 py-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-700">
                  <Users className="w-3.5 h-3.5 text-indigo-500" />
                  Clients & Fournisseurs
                </span>
                <span className="font-semibold text-slate-900">
                  {stats.counts.clients} clients, {stats.counts.suppliers} fournisseurs
                </span>
              </div>
              <div className="px-4 py-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-700">
                  <FileCode className="w-3.5 h-3.5 text-purple-500" />
                  Achats (Demandes de prix, Bons de commande, Réceptions)
                </span>
                <span className="font-semibold text-slate-900">
                  {stats.counts.inquiries + stats.counts.purchaseOrders + stats.counts.receptions}
                </span>
              </div>
              <div className="px-4 py-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-700">
                  <Store className="w-3.5 h-3.5 text-emerald-500" />
                  Points de Vente & Sessions de caisse
                </span>
                <span className="font-semibold text-slate-900">{stats.counts.pointsDeVente}</span>
              </div>
            </div>
          </div>

          {/* Actions & Backup */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Sauvegarde et Restauration
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Export Button */}
              <button
                type="button"
                onClick={handleExport}
                className="flex items-center justify-center gap-2.5 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger la Sauvegarde (JSON)</span>
              </button>

              {/* Import Button */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".json,application/json"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-xs transition-colors"
                >
                  <Upload className="w-4 h-4 text-slate-600" />
                  <span>Restaurer depuis un Fichier JSON</span>
                </button>
              </div>
            </div>
          </div>

          {/* Reset confirmation */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            {!isResetConfirmOpen ? (
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(true)}
                className="text-xs text-rose-600 hover:text-rose-800 font-medium flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Réinitialiser aux données d'usine (Défaut)</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                <span className="text-xs text-rose-800 font-medium">Confirmer la réinitialisation ?</span>
                <button
                  type="button"
                  onClick={handleResetToFactory}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-md"
                >
                  Oui, réinitialiser
                </button>
                <button
                  type="button"
                  onClick={() => setIsResetConfirmOpen(false)}
                  className="px-2.5 py-1 bg-slate-200 text-slate-700 text-xs font-medium rounded-md hover:bg-slate-300"
                >
                  Annuler
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-medium transition-colors ml-auto"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
