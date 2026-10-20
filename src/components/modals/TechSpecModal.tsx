import React from 'react';
import { X, Database, Layers, Smartphone, Server, Sparkles } from 'lucide-react';

interface TechSpecModalProps {
  onClose: () => void;
}

export const TechSpecModal: React.FC<TechSpecModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-xl overflow-hidden text-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#001F3F] flex items-center justify-center text-white shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#001F3F] flex items-center gap-1.5">
                Spécifications Techniques <span className="text-blue-600">GeStock Pro</span>
              </h3>
              <p className="text-xs text-slate-500">Architecture Front-end Flutter & Back-end Python / PostgreSQL</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs leading-relaxed">
          {/* Architecture Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-blue-700">
                <Smartphone className="w-4 h-4" />
                <span>Front-End</span>
              </div>
              <div className="text-[#001F3F] font-bold text-sm">Flutter 3.x</div>
              <p className="text-[11px] text-slate-500">Application multiplateforme (Android, iOS & Desktop Caisse).</p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-700">
                <Server className="w-4 h-4" />
                <span>Back-End</span>
              </div>
              <div className="text-[#001F3F] font-bold text-sm">Python (FastAPI)</div>
              <p className="text-[11px] text-slate-500">API RESTful haute vitesse avec ORM SQLAlchemy / Pydantic.</p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-purple-700">
                <Database className="w-4 h-4" />
                <span>Base de données</span>
              </div>
              <div className="text-[#001F3F] font-bold text-sm">PostgreSQL 16</div>
              <p className="text-[11px] text-slate-500">Base relationnelle robuste avec transactions ACID pour le stock.</p>
            </div>
          </div>

          {/* Color & Theme Spec */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
            <h4 className="font-bold text-[#001F3F] text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              Palette Graphique Claire & Professionnelle Validée
            </h4>
            <div className="flex items-center gap-3 pt-1">
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                <div className="w-4 h-4 rounded-full bg-[#001F3F]" />
                <span className="font-mono text-slate-700">Bleu Marine (#001F3F)</span>
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                <div className="w-4 h-4 rounded-full bg-blue-600" />
                <span className="font-mono text-slate-700">Bleu Accent (#2563EB)</span>
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                <div className="w-4 h-4 rounded-full bg-slate-50 border border-slate-300" />
                <span className="font-mono text-slate-700">Fond Pro (#F8FAFC)</span>
              </div>
            </div>
          </div>

          {/* Sliding Menu Navigation Schema Map */}
          <div className="space-y-3">
            <h4 className="font-bold text-[#001F3F] text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              Arborescence du Menu Coulissant
            </h4>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2 font-mono text-[11px]">
              <div className="text-blue-700 font-bold">├── 1. Accueil (Tableau de bord & indicateurs clés)</div>
              <div className="text-blue-900 font-bold">├── 2. Inventaire (Sous-menu)</div>
              <div className="text-slate-600 pl-6">│   ├── Approvisionnement (Historique & Entrées)</div>
              <div className="text-slate-600 pl-6">│   └── Produits (Catalogue, Prix, Alertes Stock)</div>
              <div className="text-indigo-700 font-bold">├── 3. Acteurs commercial (Sous-menu)</div>
              <div className="text-slate-600 pl-6">│   ├── Clients (Fichier client, Solde de crédit)</div>
              <div className="text-slate-600 pl-6">│   └── Fournisseur (Répertoire des grossistes)</div>
              <div className="text-purple-700 font-bold">├── 4. Achat (Sous-menu)</div>
              <div className="text-slate-600 pl-6">│   ├── Demande de prix (Demandes de cotation / RFQ)</div>
              <div className="text-slate-600 pl-6">│   ├── Bon Commandes (Bons d'achat fournisseur)</div>
              <div className="text-slate-600 pl-6">│   └── Reception (Bordereaux de livraison & maj stock)</div>
              <div className="text-emerald-700 font-bold">└── 5. Vente (Sous-menu)</div>
              <div className="text-slate-600 pl-6">    ├── Point de Vente (POS Caisse enregistreuse)</div>
              <div className="text-slate-600 pl-6">    └── Commande (Historique des ventes & factures)</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs shadow-xs"
          >
            Fermer le guide technique
          </button>
        </div>
      </div>
    </div>
  );
};
