import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  X, 
  Check, 
  AlertCircle, 
  Download, 
  FileText,
  Info,
  CheckCircle2
} from 'lucide-react';
import { Product, ProductCategory } from '../../types';
import { generateUniqueId } from '../../utils/idGenerator';
import { formatFCFA } from '../../data/initialData';

interface ImportProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ProductCategory[];
  onImportProducts: (products: Product[]) => void;
}

interface ParsedProductRow {
  code: string;
  barcode: string;
  name: string;
  category: string;
  buyPrice: number;
  sellPrice: number;
  vatPurchase: number;
  vatSale: number;
  unit: string;
  isStockable: boolean;
  availableInPOS: boolean;
  uovName: string;
  uovQty: number;
  uovPrice: number;
  uoaName: string;
  uoaQty: number;
  uoaPrice: number;
  isValid: boolean;
  errors: string[];
}

export const ImportProductsModal: React.FC<ImportProductsModalProps> = ({
  isOpen,
  onClose,
  categories,
  onImportProducts
}) => {
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Generate Sample CSV for users to download
  const handleDownloadTemplate = () => {
    const headers = [
      'Code SKU',
      'Code Barres',
      'Nom Produit',
      'Categorie',
      'Prix Achat FCFA',
      'Prix Vente FCFA',
      'TVA Achat %',
      'TVA Vente %',
      'Unite',
      'Stockable (OUI/NON)',
      'Disponible PV (OUI/NON)',
      'UOV Nom',
      'UOV Quantite',
      'UOV Prix FCFA',
      'UOA Nom',
      'UOA Quantite',
      'UOA Prix FCFA'
    ];

    const sampleRow = [
      'PRD-901',
      '6181100999011',
      'Lait Bonnet Rouge 410g',
      'Epicerie',
      '650',
      '800',
      '18',
      '18',
      'Boîte',
      'OUI',
      'OUI',
      'Boîte unitaire',
      '1',
      '800',
      'Carton 48 boîtes',
      '48',
      '31200'
    ];

    const sampleRow2 = [
      'PRD-902',
      '6181100999028',
      'Jus d\'Orange Ivoire 1L',
      'Boissons',
      '1200',
      '1500',
      '18',
      '18',
      'Bouteille',
      'OUI',
      'OUI',
      'Pack de 6',
      '6',
      '9000',
      'Palette 120 packs',
      '120',
      '144000'
    ];

    const csvContent = '\uFEFF' + [
      headers.join(';'),
      sampleRow.join(';'),
      sampleRow2.join(';')
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'modele_import_produits_gestock.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCsvText = (text: string) => {
    setErrorMessage('');
    const lines = text.split(/\r\n|\n|\r/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      setErrorMessage('Le fichier ne contient aucune ligne de données exploitable.');
      return;
    }

    // Detect separator (; or , or \t)
    const firstLine = lines[0];
    let separator = ';';
    if (firstLine.includes(';') && (firstLine.match(/;/g) || []).length > 2) {
      separator = ';';
    } else if (firstLine.includes(',') && (firstLine.match(/,/g) || []).length > 2) {
      separator = ',';
    } else if (firstLine.includes('\t')) {
      separator = '\t';
    }

    const dataLines = lines.slice(1);
    const parsed: ParsedProductRow[] = [];

    dataLines.forEach((line) => {
      const cols = line.split(separator).map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 3 || cols.every(c => c === '')) return;

      const code = cols[0] || `PRD-${Math.floor(1000 + Math.random() * 9000)}`;
      const barcode = cols[1] || '';
      const name = cols[2] || '';
      const category = cols[3] || 'Alimentation';
      const buyPrice = Number(cols[4]?.replace(/[^\d.-]/g, '')) || 0;
      const sellPrice = Number(cols[5]?.replace(/[^\d.-]/g, '')) || 0;
      const vatPurchase = cols[6] !== undefined ? Number(cols[6]?.replace(/[^\d.-]/g, '')) || 0 : 18;
      const vatSale = cols[7] !== undefined ? Number(cols[7]?.replace(/[^\d.-]/g, '')) || 0 : 18;
      const unit = cols[8] || 'Unité';
      const isStockableStr = cols[9]?.toUpperCase() || 'OUI';
      const availableInPOSStr = cols[10]?.toUpperCase() || 'OUI';

      const isStockable = isStockableStr.startsWith('O') || isStockableStr === 'TRUE' || isStockableStr === '1';
      const availableInPOS = availableInPOSStr.startsWith('O') || availableInPOSStr === 'TRUE' || availableInPOSStr === '1';

      const uovName = cols[11] || unit;
      const uovQty = Number(cols[12]?.replace(/[^\d.-]/g, '')) || 1;
      const uovPrice = Number(cols[13]?.replace(/[^\d.-]/g, '')) || sellPrice;

      const uoaName = cols[14] || 'Conditionnement Achat';
      const uoaQty = Number(cols[15]?.replace(/[^\d.-]/g, '')) || 1;
      const uoaPrice = Number(cols[16]?.replace(/[^\d.-]/g, '')) || buyPrice;

      const errors: string[] = [];
      if (!name) errors.push('Nom manquant');
      if (sellPrice < 0) errors.push('Prix vente négatif');

      parsed.push({
        code,
        barcode,
        name,
        category,
        buyPrice,
        sellPrice,
        vatPurchase,
        vatSale,
        unit,
        isStockable,
        availableInPOS,
        uovName,
        uovQty,
        uovPrice,
        uoaName,
        uoaQty,
        uoaPrice,
        isValid: errors.length === 0,
        errors
      });
    });

    if (parsed.length === 0) {
      setErrorMessage('Aucun produit n\'a pu être extrait. Vérifiez le format.');
    } else {
      setParsedRows(parsed);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      parseCsvText(content);
      setIsProcessing(false);
    };
    reader.onerror = () => {
      setErrorMessage('Erreur lors de la lecture du fichier.');
      setIsProcessing(false);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleConfirmImport = () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      setErrorMessage('Aucune ligne valide à importer.');
      return;
    }

    const newProducts: Product[] = validRows.map(row => {
      const matchedCat = categories.find(c => c.name.toLowerCase() === row.category.toLowerCase());
      return {
        id: generateUniqueId('p'),
        code: row.code,
        barcode: row.barcode || `EAN-${Math.floor(100000000000 + Math.random() * 900000000000)}`,
        name: row.name,
        category: matchedCat ? matchedCat.name : row.category,
        categoryId: matchedCat?.id,
        buyPrice: row.buyPrice,
        sellPrice: row.sellPrice,
        vatPurchase: row.vatPurchase,
        vatSale: row.vatSale,
        stock: 0, // Stock initial supprimé : démarre à 0
        minStock: 5,
        unit: row.unit || 'sac',
        storageUnit: row.unit || 'sac',
        measurementUnit: 'kilogramme',
        isStockable: row.isStockable,
        availableInPOS: row.availableInPOS,
        operationalUnits: [
          {
            id: generateUniqueId('uov'),
            label: row.uovName,
            type: 'UOV',
            quantity: row.uovQty,
            price: row.uovPrice
          },
          {
            id: generateUniqueId('uoa'),
            label: row.uoaName,
            type: 'UOA',
            quantity: row.uoaQty,
            price: row.uoaPrice
          }
        ],
        uov: {
          label: row.uovName,
          type: 'UOV',
          quantity: row.uovQty,
          price: row.uovPrice
        },
        uoa: {
          label: row.uoaName,
          type: 'UOA',
          quantity: row.uoaQty,
          price: row.uoaPrice
        },
        lastRestocked: new Date().toISOString().split('T')[0]
      };
    });

    onImportProducts(newProducts);
    setSuccessMessage(`${newProducts.length} produit(s) importé(s) avec succès dans la base de données !`);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-[#001F3F] text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Importer des Produits (Excel / CSV)</h2>
              <p className="text-xs text-blue-200">
                Chargez un fichier tableur pour intégrer vos articles en masse dans la base de données.
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Banner with Download Template */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50/70 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-900">
                <p className="font-bold">Format recommandé : Excel CSV standard (séparateur point-virgule)</p>
                <p className="text-emerald-700 mt-0.5 text-[11px]">
                  Les colonnes incluent : Code, Barcode, Nom, Catégorie, Prix Achat, Prix Vente, TVA, Stockable, Disponible PV, UOV et UOA.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-2 shrink-0 transition-colors shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Télécharger Modèle Excel</span>
            </button>
          </div>

          {/* File Upload Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-blue-50/30"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2 animate-bounce" />
            <p className="text-sm font-bold text-slate-800">
              {fileName ? fileName : 'Cliquez pour sélectionner votre fichier Excel ou CSV'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Prend en charge les fichiers .CSV exportés depuis Microsoft Excel, LibreOffice ou Google Sheets.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-500" />
                  Aperçu des données détectées ({parsedRows.length} lignes)
                </h3>
                <span className="text-xs text-emerald-700 font-semibold">
                  {parsedRows.filter(r => r.isValid).length} ligne(s) valide(s)
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Statut</th>
                      <th className="py-2.5 px-3">Code / Barcode</th>
                      <th className="py-2.5 px-3">Désignation</th>
                      <th className="py-2.5 px-3">Catégorie</th>
                      <th className="py-2.5 px-3 text-right">P. Achat</th>
                      <th className="py-2.5 px-3 text-right">P. Vente</th>
                      <th className="py-2.5 px-3 text-center">Dispo PV</th>
                      <th className="py-2.5 px-3 text-center">Stockable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} className={row.isValid ? 'hover:bg-slate-50' : 'bg-red-50/50'}>
                        <td className="py-2 px-3">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                              <Check className="w-3.5 h-3.5" /> Prêt
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600" title={row.errors.join(', ')}>
                              <AlertCircle className="w-3.5 h-3.5" /> Invalide
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px]">
                          <div>{row.code}</div>
                          {row.barcode && <div className="text-slate-400 text-[10px]">{row.barcode}</div>}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-800">
                          {row.name}
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {row.category}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-slate-600">
                          {formatFCFA(row.buyPrice)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-700">
                          {formatFCFA(row.sellPrice)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.availableInPOS ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                            {row.availableInPOS ? 'OUI' : 'NON'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.isStockable ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'}`}>
                            {row.isStockable ? 'OUI' : 'NON'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg text-xs transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={parsedRows.filter(r => r.isValid).length === 0 || isProcessing}
            onClick={handleConfirmImport}
            className="px-5 py-2.5 bg-[#001F3F] hover:bg-blue-900 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-2 shadow-xs transition-colors"
          >
            <Check className="w-4 h-4" />
            <span>
              Confirmer l'importation ({parsedRows.filter(r => r.isValid).length} produits)
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
