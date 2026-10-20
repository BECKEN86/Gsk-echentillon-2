/**
 * Écrivain XLSX minimaliste — aucune dépendance.
 * Produit un classeur .xlsx valide : archive ZIP (entrées stockées non
 * compressées) contenant les XML Office Open XML avec chaînes inline.
 *
 * Limites gérées :
 *  - 1 048 576 lignes par feuille (limite Excel) → découpage automatique
 *    en feuilles « Nom (2) », « Nom (3) »…
 *  - noms de feuilles : ≤ 31 caractères, sans []:*?/\
 *  - cellules : chaîne (inlineStr), nombre, booléen, vide
 */

export type XCell = string | number | boolean | null | undefined;
export interface XSheet {
  name: string;
  /** Première ligne = en-têtes de colonnes. */
  rows: XCell[][];
}

const EXCEL_MAX_ROWS = 1_048_576;
const encoder = new TextEncoder();

// ---------------------------------------------------------------- CRC32
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ---------------------------------------------------------------- ZIP (stored)
export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const u16 = (n: number) => new Uint8Array([n & 255, (n >> 8) & 255]);
const u32 = (n: number) =>
  new Uint8Array([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]);

/** Construit une archive ZIP (méthode « stored », noms UTF-8). */
export function buildZip(entries: ZipEntry[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: { name: Uint8Array; crc: number; size: number; offset: number }[] = [];
  let offset = 0;
  const push = (u: Uint8Array) => {
    chunks.push(u);
    offset += u.length;
  };

  for (const e of entries) {
    const name = encoder.encode(e.name);
    const crc = crc32(e.data);
    central.push({ name, crc, size: e.data.length, offset });
    push(u32(0x04034b50)); // local file header
    push(u16(20)); // version needed
    push(u16(0x0800)); // UTF-8 filename flag
    push(u16(0)); // method: stored
    push(u16(0)); // mod time
    push(u16(0)); // mod date
    push(u32(crc));
    push(u32(e.data.length));
    push(u32(e.data.length));
    push(u16(name.length));
    push(u16(0)); // extra length
    push(name);
    push(e.data);
  }

  const cdStart = offset;
  for (const c of central) {
    push(u32(0x02014b50)); // central directory header
    push(u16(20)); // version made by
    push(u16(20)); // version needed
    push(u16(0x0800));
    push(u16(0));
    push(u16(0));
    push(u16(0));
    push(u32(c.crc));
    push(u32(c.size));
    push(u32(c.size));
    push(u16(c.name.length));
    push(u16(0)); // extra
    push(u16(0)); // comment
    push(u16(0)); // disk
    push(u16(0)); // internal attrs
    push(u32(0)); // external attrs
    push(u32(c.offset));
    push(c.name);
  }
  push(u32(0x06054b50)); // end of central directory
  push(u16(0));
  push(u16(0));
  push(u16(central.length));
  push(u16(central.length));
  push(u32(offset - cdStart));
  push(u32(cdStart));
  push(u16(0));

  const out = new Uint8Array(offset);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

// ---------------------------------------------------------------- XLSX
const xmlEsc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const colName = (i: number): string => {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

/** Nom de feuille conforme Excel (≤31 car., sans []:*?/\), dédupliqué. */
function safeSheetName(name: string, used: Set<string>): string {
  const base = (name.replace(/[\[\]\*\?\/\\:]/g, ' ').trim() || 'Feuille').slice(0, 31);
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) {
    const suffix = ` (${n++})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(candidate);
  return candidate;
}

function sheetXml(rows: XCell[][]): string {
  const parts: string[] = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
  ];
  rows.forEach((row, r) => {
    parts.push(`<row r="${r + 1}">`);
    row.forEach((cell, c) => {
      if (cell === null || cell === undefined || cell === '') return;
      const ref = `${colName(c)}${r + 1}`;
      if (typeof cell === 'number' && Number.isFinite(cell)) {
        parts.push(`<c r="${ref}"><v>${cell}</v></c>`);
      } else if (typeof cell === 'boolean') {
        parts.push(`<c r="${ref}" t="b"><v>${cell ? 1 : 0}</v></c>`);
      } else {
        parts.push(`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(String(cell))}</t></is></c>`);
      }
    });
    parts.push('</row>');
  });
  parts.push('</sheetData></worksheet>');
  return parts.join('');
}

/**
 * Construit un classeur .xlsx complet.
 * Une feuille dépassant la limite Excel est découpée en « Nom (2) », etc.
 */
export function buildXlsx(sheets: XSheet[]): Uint8Array {
  const used = new Set<string>();
  const expanded: XSheet[] = [];
  for (const s of sheets) {
    const header = s.rows[0] || [];
    const dataRows = s.rows.length;
    if (dataRows <= EXCEL_MAX_ROWS) {
      expanded.push({ name: safeSheetName(s.name, used), rows: s.rows });
      continue;
    }
    const chunk = EXCEL_MAX_ROWS - 1; // 1 ligne d'en-tête par feuille
    let part = 1;
    for (let i = 0; i < dataRows; i += chunk, part++) {
      expanded.push({
        name: safeSheetName(`${s.name} (${part})`, used),
        rows: [header, ...s.rows.slice(i, i + chunk)]
      });
    }
  }

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    expanded
      .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join('') +
    '</Types>';

  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';

  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets>' +
    expanded
      .map((s, i) => `<sheet name="${xmlEsc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('') +
    '</sheets></workbook>';

  const workbookRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    expanded
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
      )
      .join('') +
    '</Relationships>';

  return buildZip([
    { name: '[Content_Types].xml', data: encoder.encode(contentTypes) },
    { name: '_rels/.rels', data: encoder.encode(rootRels) },
    { name: 'xl/workbook.xml', data: encoder.encode(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(workbookRels) },
    ...expanded.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: encoder.encode(sheetXml(s.rows))
    }))
  ]);
}

/** Télécharge un blob (fallback universel). */
export function downloadFile(name: string, data: Uint8Array, mime: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data as BlobPart], { type: mime }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const ZIP_MIME = 'application/zip';
