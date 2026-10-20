import React, { useMemo, useRef, useState } from 'react';
import {
  FileSpreadsheet,
  CheckSquare,
  Square,
  Download,
  FolderOpen,
  Play,
  Ban,
  CheckCircle2,
  AlertTriangle,
  X,
  ShieldAlert,
  Database,
  Filter,
  Loader2
} from 'lucide-react';
import { AppDatabase } from '../../../services/storageService';
import { CompanyConfig, UserAccount } from '../../../types';
import { EXPORT_PARTS, ExportFilters, depotOptions } from '../../../utils/dataExport';
import { buildXlsx, buildZip, downloadFile, XLSX_MIME, ZIP_MIME, XCell } from '../../../utils/xlsxWriter';
import { formatAppDate } from '../../../utils/dateUtils';

interface ExportDonneesViewProps {
  db: AppDatabase;
  companyConfig: CompanyConfig | null;
  currentUser: UserAccount | null;
  /** Journal d'audit : (action, entityRef, details) */
  onAudit?: (entityRef: string, details: string) => void;
}

type ExportMode = 'workbook' | 'files';
type PartStatus = 'pending' | 'running' | 'done' | 'error' | 'cancelled';

interface PartResult {
  id: string;
  label: string;
  target: string; // nom de feuille ou de fichier
  rows: number;
  status: PartStatus;
  error?: string;
}

interface DirectoryHandleLike {
  getFileHandle: (name: string, opts: { create: boolean }) => Promise<{ createWritable: () => Promise<{ write: (d: unknown) => Promise<void>; close: () => Promise<void> }> }>;
}

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<DirectoryHandleLike>;
  }
}

const today = formatAppDate();

export const ExportDonneesView: React.FC<ExportDonneesViewProps> = ({
  db,
  companyConfig,
  currentUser,
  onAudit
}) => {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(EXPORT_PARTS.filter(p => p.id !== 'audit').map(p => p.id))
  );
  const [mode, setMode] = useState<ExportMode>('workbook');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [depot, setDepot] = useState('');
  const [clientId, setClientId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [dirHandle, setDirHandle] = useState<DirectoryHandleLike | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, currentLabel: '', rows: 0 });
  const [results, setResults] = useState<PartResult[] | null>(null);
  const [outputPath, setOutputPath] = useState('');
  const cancelRef = useRef(false);

  const filters: ExportFilters = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
      depot: depot || undefined,
      clientId: clientId || undefined,
      supplierId: supplierId || undefined
    }),
    [from, to, depot, clientId, supplierId]
  );

  const hasFilters = Boolean(from || to || depot || clientId || supplierId);
  const depots = useMemo(() => depotOptions(db), [db]);

  // Nombre d'enregistrements par partie avec les filtres courants
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    EXPORT_PARTS.forEach(p => {
      try {
        map.set(p.id, p.buildRows(db, filters).length);
      } catch {
        map.set(p.id, -1);
      }
    });
    return map;
  }, [db, filters]);

  const totalSelectedRows = useMemo(
    () => EXPORT_PARTS.filter(p => selected.has(p.id)).reduce((s, p) => s + Math.max(0, counts.get(p.id) ?? 0), 0),
    [selected, counts]
  );

  const toggleAll = (value: boolean) =>
    setSelected(value ? new Set(EXPORT_PARTS.map(p => p.id)) : new Set());

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const pickDirectory = async () => {
    if (!window.showDirectoryPicker) {
      alert("Votre navigateur ne permet pas de choisir un dossier (API non disponible). L'export sera téléchargé dans le dossier Téléchargements.");
      return;
    }
    try {
      setDirHandle(await window.showDirectoryPicker());
    } catch {
      /* utilisateur a annulé le sélecteur */
    }
  };

  const supports: Record<string, string> = {
    period: 'Période',
    depot: 'Dépôt',
    client: 'Client',
    supplier: 'Fournisseur'
  };

  const writeToDirectory = async (name: string, data: Uint8Array, mime: string): Promise<boolean> => {
    if (!dirHandle) return false;
    const fh = await dirHandle.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(new Blob([data as BlobPart], { type: mime }));
    await w.close();
    return true;
  };

  const buildInfoSheet = (results: PartResult[]): { name: string; rows: XCell[][] } => ({
    name: 'Informations',
    rows: [
      ['Champ', 'Valeur'],
      ['Logiciel', 'GeStock — Gestion Commerciale & POS'],
      ['Entreprise', companyConfig?.name || ''],
      ['Date et heure de l\'export', new Date().toLocaleString('fr-FR')],
      ['Exporté par', currentUser?.name || ''],
      ['Mode', mode === 'workbook' ? 'Classeur unique' : 'Un fichier par partie'],
      ['Période', from || to ? `du ${from || '…'} au ${to || '…'}` : 'Toutes dates'],
      ['Dépôt', depot || 'Tous'],
      ['Client', clientId ? db.clients.find(c => c.id === clientId)?.name || clientId : 'Tous'],
      ['Fournisseur', supplierId ? db.suppliers.find(s => s.id === supplierId)?.name || supplierId : 'Tous'],
      ['Total lignes exportées', results.filter(r => r.status === 'done').reduce((s, r) => s + r.rows, 0)],
      [],
      ['Partie', 'Cible', 'Lignes', 'Résultat', 'Erreur'],
      ...results.map(r => [r.label, r.target, r.rows, r.status === 'done' ? 'OK' : r.status === 'error' ? 'ÉCHEC' : 'ANNULÉ', r.error || ''] as XCell[])
    ]
  });

  const runExport = async () => {
    const parts = EXPORT_PARTS.filter(p => selected.has(p.id));
    if (parts.length === 0) return;
    setConfirmOpen(false);
    setRunning(true);
    setResults(null);
    cancelRef.current = false;
    setProgress({ done: 0, total: parts.length, currentLabel: '', rows: 0 });

    const res: PartResult[] = [];
    const sheets: { name: string; rows: XCell[][] }[] = [];
    const fileEntries: { name: string; data: Uint8Array }[] = [];
    const stamp = formatAppDate();
    const baseName = `Export_Complet_Gestion_Commerciale_${stamp}`;

    for (const part of parts) {
      if (cancelRef.current) {
        res.push({ id: part.id, label: part.label, target: '—', rows: 0, status: 'cancelled' });
        continue;
      }
      setProgress(p => ({ ...p, currentLabel: part.label }));
      await new Promise(r => setTimeout(r, 0)); // laisse respirer l'UI
      const target = mode === 'workbook' ? `Feuille « ${part.sheetName} »` : `${part.sheetName}.xlsx`;
      try {
        const rows = part.buildRows(db, filters);
        const rowsWithHeader: XCell[][] = [part.columns, ...rows];
        if (mode === 'workbook') {
          sheets.push({ name: part.sheetName, rows: rowsWithHeader });
        } else {
          fileEntries.push({ name: `${part.sheetName}.xlsx`, data: buildXlsx([{ name: part.sheetName, rows: rowsWithHeader }]) });
        }
        res.push({ id: part.id, label: part.label, target, rows: rows.length, status: 'done' });
        setProgress(p => ({ ...p, rows: p.rows + rows.length }));
      } catch (err) {
        res.push({
          id: part.id, label: part.label, target, rows: 0, status: 'error',
          error: err instanceof Error ? err.message : String(err)
        });
      }
      setProgress(p => ({ ...p, done: p.done + 1 }));
    }

    // Écriture du/des fichiers finaux (uniquement si non annulé)
    const cancelled = cancelRef.current;
    const okResults = res.filter(r => r.status === 'done');
    let path = '';

    if (!cancelled && okResults.length > 0) {
      try {
        if (mode === 'workbook') {
          const xlsx = buildXlsx([buildInfoSheet(res), ...sheets]);
          const fileName = `${baseName}.xlsx`;
          if (await writeToDirectory(fileName, xlsx, XLSX_MIME)) {
            path = `${fileName} (dossier choisi)`;
          } else {
            downloadFile(fileName, xlsx, XLSX_MIME);
            path = `${fileName} (Téléchargements)`;
          }
        } else {
          // README + un classeur par partie, regroupés dans un ZIP (ou dans le dossier choisi)
          fileEntries.unshift({
            name: 'README_Export.xlsx',
            data: buildXlsx([buildInfoSheet(res)])
          });
          if (dirHandle) {
            for (const e of fileEntries) {
              await writeToDirectory(e.name, e.data, XLSX_MIME);
            }
            path = `${fileEntries.length} fichiers .xlsx (dossier choisi)`;
          } else {
            const zip = buildZip(fileEntries);
            const fileName = `${baseName}.zip`;
            downloadFile(fileName, zip, ZIP_MIME);
            path = `${fileName} (Téléchargements)`;
          }
        }
      } catch (err) {
        res.push({ id: '__file', label: 'Écriture du fichier', target: '—', rows: 0, status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    }

    setOutputPath(path);
    setResults(res);
    setRunning(false);

    const totalRows = res.filter(r => r.status === 'done').reduce((s, r) => s + r.rows, 0);
    const failures = res.filter(r => r.status === 'error').length;
    onAudit?.(
      cancelled ? 'annulé' : fileNameOrDefault(baseName, mode),
      `${cancelled ? 'ANNULÉ — ' : ''}${okResults.length}/${parts.length} partie(s), ${totalRows} ligne(s)${failures ? `, ${failures} échec(s)` : ''} — mode ${mode}${hasFilters ? ' — filtres: ' + JSON.stringify(filters) : ''}`
    );
  };

  const fileNameOrDefault = (base: string, m: ExportMode) => (m === 'workbook' ? `${base}.xlsx` : `${base}.zip`);

  const allOk = results?.every(r => r.status === 'done') ?? false;

  return (
    <div className="space-y-4 pb-10">
      {/* En-tête */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#001F3F]">Exportation des données</h2>
            <p className="text-xs text-slate-500">Export Excel (.xlsx) — lecture seule, aucune modification des données</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          Données commerciales sensibles — mots de passe et secrets exclus de l'export
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Colonne gauche : filtres + options */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h3 className="text-xs font-black text-slate-500 uppercase flex items-center gap-1.5"><Filter className="w-3.5 h-3.5" /> Filtres</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Du</label>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Au</label>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">Dépôt</label>
              <select value={depot} onChange={e => setDepot(e.target.value)} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs">
                <option value="">Tous les dépôts</option>
                {depots.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">Client</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs">
                <option value="">Tous les clients</option>
                {db.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">Fournisseur</label>
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs">
                <option value="">Tous les fournisseurs</option>
                {db.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {hasFilters && (
              <button onClick={() => { setFrom(''); setTo(''); setDepot(''); setClientId(''); setSupplierId(''); }} className="text-[11px] font-bold text-rose-600 hover:underline">
                Réinitialiser les filtres
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h3 className="text-xs font-black text-slate-500 uppercase">Mode d'exportation</h3>
            <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${mode === 'workbook' ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input type="radio" name="exportMode" checked={mode === 'workbook'} onChange={() => setMode('workbook')} className="mt-0.5" />
              <div>
                <div className="text-xs font-bold text-[#001F3F]">Classeur unique</div>
                <div className="text-[11px] text-slate-500">Un fichier .xlsx avec une feuille par partie + feuille « Informations »</div>
              </div>
            </label>
            <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${mode === 'files' ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input type="radio" name="exportMode" checked={mode === 'files'} onChange={() => setMode('files')} className="mt-0.5" />
              <div>
                <div className="text-xs font-bold text-[#001F3F]">Un fichier par partie</div>
                <div className="text-[11px] text-slate-500">Articles.xlsx, Clients.xlsx… regroupés dans un .zip (ou écrits dans le dossier choisi)</div>
              </div>
            </label>
            <button
              onClick={pickDirectory}
              className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-slate-50"
            >
              <FolderOpen className="w-4 h-4" />
              {dirHandle ? 'Dossier choisi ✓' : 'Choisir le dossier de destination'}
            </button>
            <p className="text-[10px] text-slate-400">
              {dirHandle
                ? 'Les fichiers seront écrits directement dans le dossier sélectionné.'
                : 'Sans dossier choisi, l\'export est téléchargé : Export_Complet_Gestion_Commerciale_AAAA-MM-JJ.' + (mode === 'workbook' ? 'xlsx' : 'zip')}
            </p>
          </div>
        </div>

        {/* Colonne droite : liste des parties */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="text-xs font-black text-slate-500 uppercase flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" /> Parties disponibles ({EXPORT_PARTS.length})
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleAll(true)} className="text-[11px] font-bold text-blue-700 hover:underline">Tout sélectionner</button>
                <span className="text-slate-300">|</span>
                <button onClick={() => toggleAll(false)} className="text-[11px] font-bold text-slate-500 hover:underline">Tout désélectionner</button>
              </div>
            </div>
            <div className="max-h-[52vh] overflow-y-auto divide-y divide-slate-100">
              {EXPORT_PARTS.map(p => {
                const n = counts.get(p.id);
                const checked = selected.has(p.id);
                return (
                  <label key={p.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${checked ? 'bg-emerald-50/40' : 'hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggle(p.id)} className="sr-only" />
                    {checked ? <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">{p.label}</div>
                      {p.description && <div className="text-[10px] text-slate-400 truncate">{p.description}</div>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {p.supports && Object.keys(p.supports).map(k => (
                        <span key={k} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">{supports[k]}</span>
                      ))}
                      <span className={`ml-1 text-[11px] font-black min-w-14 text-right ${n === 0 ? 'text-slate-300' : 'text-[#001F3F]'}`}>
                        {n === undefined ? '…' : n < 0 ? 'err.' : `${n.toLocaleString('fr-FR')} lig.`}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs text-slate-600">
                <span className="font-black text-[#001F3F]">{selected.size}</span> partie(s) — <span className="font-black text-[#001F3F]">{totalSelectedRows.toLocaleString('fr-FR')}</span> lignes estimées
              </div>
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={selected.size === 0 || running}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm disabled:opacity-40 active:scale-95 transition-all"
              >
                <Play className="w-4 h-4" /> Lancer l'exportation
              </button>
            </div>
          </div>

          {/* Progression */}
          {running && (
            <div className="bg-white rounded-xl border border-blue-200 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#001F3F] flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  {progress.currentLabel || 'Préparation…'}
                </span>
                <span className="text-slate-500">{progress.done}/{progress.total} parties — {progress.rows.toLocaleString('fr-FR')} lignes</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
              </div>
              <button onClick={() => { cancelRef.current = true; }} className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1">
                <Ban className="w-3.5 h-3.5" /> Annuler l'exportation
              </button>
            </div>
          )}

          {/* Résultats */}
          {results && (
            <div className={`bg-white rounded-xl border p-4 space-y-3 ${allOk ? 'border-emerald-300' : 'border-amber-300'}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-[#001F3F] flex items-center gap-2">
                  {allOk ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-amber-500" />}
                  {allOk ? 'Exportation terminée' : 'Exportation terminée avec des incidents'}
                </h3>
                {outputPath && <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1"><Download className="w-3.5 h-3.5" />{outputPath}</span>}
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 text-left">Partie</th>
                      <th className="py-2 px-3 text-left">Cible</th>
                      <th className="py-2 px-3 text-right">Lignes</th>
                      <th className="py-2 px-3 text-center">Résultat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {results.map(r => (
                      <tr key={r.id}>
                        <td className="py-2 px-3 font-medium">{r.label}</td>
                        <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{r.target}</td>
                        <td className="py-2 px-3 text-right font-bold">{r.rows.toLocaleString('fr-FR')}</td>
                        <td className="py-2 px-3 text-center">
                          {r.status === 'done' && <span className="text-emerald-600 font-bold">OK</span>}
                          {r.status === 'error' && <span className="text-rose-600 font-bold" title={r.error}>ÉCHEC</span>}
                          {r.status === 'cancelled' && <span className="text-slate-400 font-bold">ANNULÉ</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!allOk && (
                <p className="text-[11px] text-amber-700">Certaines parties ont échoué ou ont été annulées — vérifiez les lignes « ÉCHEC » ci-dessus. Le fichier produit ne couvre que les parties réussies.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation avant export */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-[#001F3F]">Confirmer l'exportation ?</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {selected.size} partie(s) — environ {totalSelectedRows.toLocaleString('fr-FR')} lignes.
                  Le fichier contiendra des données commerciales, financières et personnelles sensibles.
                </p>
                {hasFilters && (
                  <p className="text-[11px] text-blue-700 mt-2 font-semibold">
                    Filtres actifs : {[
                      from && `du ${from}`, to && `au ${to}`, depot && `dépôt « ${depot} »`,
                      clientId && `client « ${db.clients.find(c => c.id === clientId)?.name} »`,
                      supplierId && `fournisseur « ${db.suppliers.find(s => s.id === supplierId)?.name} »`
                    ].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => setConfirmOpen(false)} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5">
                <X className="w-3.5 h-3.5" /> Annuler
              </button>
              <button onClick={runExport} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4" /> Exporter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
