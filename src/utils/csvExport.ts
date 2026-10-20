/** Export CSV générique (séparateur ';', BOM UTF-8 pour Excel). */
export function exportToCsv(
  filename: string,
  headers: (string | number)[],
  rows: (string | number | null | undefined)[][]
) {
  const esc = (v: string | number | null | undefined) =>
    `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = '﻿' + [headers.map(esc).join(';'), ...rows.map(r => r.map(esc).join(';'))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}
