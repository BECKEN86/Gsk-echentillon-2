import React, { useState } from 'react';
import { BookOpen, FileDown, ChevronRight, ListChecks, Info } from 'lucide-react';
import { CompanyConfig } from '../../../types';
import { GUIDE_CHAPTERS, GUIDE_SOFTWARE, GUIDE_VERSION, printUserGuide } from '../../../utils/userGuide';

interface GuideUtilisateurViewProps {
  companyConfig: CompanyConfig | null;
}

export const GuideUtilisateurView: React.FC<GuideUtilisateurViewProps> = ({ companyConfig }) => {
  const [openChapter, setOpenChapter] = useState<string | null>(GUIDE_CHAPTERS[0]?.id ?? null);

  return (
    <div className="space-y-4 pb-10">
      {/* En-tête + téléchargement */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#001F3F] border border-blue-200 flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#001F3F]">Guide utilisateur</h2>
            <p className="text-xs text-slate-500">{GUIDE_SOFTWARE} — {GUIDE_VERSION}</p>
          </div>
        </div>
        <button
          onClick={() => printUserGuide(companyConfig)}
          className="px-5 py-2.5 rounded-xl bg-[#001F3F] hover:bg-blue-900 text-white font-bold text-xs flex items-center gap-2 shadow-sm active:scale-95 transition-all shrink-0"
        >
          <FileDown className="w-4 h-4" /> Télécharger en PDF
        </button>
      </div>

      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-[11px] text-blue-800">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Le bouton « Télécharger en PDF » ouvre la boîte d'impression : choisissez la destination
          <strong> « Enregistrer au format PDF »</strong> pour obtenir le fichier. Le document comprend une page de garde,
          un sommaire et l'ensemble des chapitres ci-dessous.
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sommaire */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 h-fit lg:sticky lg:top-4">
          <h3 className="text-xs font-black text-slate-500 uppercase flex items-center gap-1.5 mb-3">
            <ListChecks className="w-3.5 h-3.5" /> Sommaire
          </h3>
          <nav className="space-y-1">
            {GUIDE_CHAPTERS.map(c => (
              <button
                key={c.id}
                onClick={() => {
                  setOpenChapter(c.id);
                  document.getElementById(`guide-${c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between transition-colors ${
                  openChapter === c.id ? 'bg-blue-50 text-[#001F3F]' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {c.title}
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            ))}
          </nav>
        </div>

        {/* Contenu */}
        <div className="lg:col-span-3 space-y-4">
          {GUIDE_CHAPTERS.map(c => (
            <section key={c.id} id={`guide-${c.id}`} className="bg-white rounded-xl border border-slate-200 overflow-hidden scroll-mt-4">
              <button
                onClick={() => setOpenChapter(openChapter === c.id ? null : c.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
              >
                <div className="text-left">
                  <h3 className="text-sm font-black text-[#001F3F]">{c.title}</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">{c.intro}</p>
                </div>
                <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${openChapter === c.id ? 'rotate-90' : ''}`} />
              </button>
              {openChapter === c.id && (
                <div className="px-5 pb-5 space-y-4 border-t border-slate-100">
                  {c.sections.map(s => (
                    <div key={s.title} className="pt-3">
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wide mb-1.5">{s.title}</h4>
                      <ul className="space-y-1.5">
                        {s.points.map((p, i) => (
                          <li key={i} className="text-xs text-slate-600 leading-relaxed flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};
