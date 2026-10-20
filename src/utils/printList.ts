import { CompanyConfig } from '../types';

interface PrintListOptions {
  title: string;
  subtitle?: string;
  company?: CompanyConfig | null;
  columns: string[];
  rows: string[][];
}

const esc = (s?: string) =>
  (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** État de liste générique A4 — même mécanique iframe que les états existants. */
export function printList({ title, subtitle, company, columns, rows }: PrintListOptions) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(title)}</title>
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #1e293b; font-size: 11px; margin: 0; padding: 15px; }
      .header { border-bottom: 2px solid #001F3F; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end; }
      .title { font-size: 17px; font-weight: 800; color: #001F3F; margin: 0; }
      .subtitle { font-size: 11px; color: #64748b; margin-top: 3px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th { background: #001F3F; color: #fff; padding: 7px 9px; text-align: left; font-size: 10px; text-transform: uppercase; }
      td { border-bottom: 1px solid #e2e8f0; padding: 7px 9px; }
      tr:nth-child(even) { background: #f8fafc; }
    </style></head><body>
    <div class="header">
      <div>
        <h1 class="title">${esc(company?.name || 'GESTOCK')} — ${esc(title)}</h1>
        ${subtitle ? `<p class="subtitle">${esc(subtitle)}</p>` : ''}
      </div>
      <div style="text-align:right;font-size:10px;color:#64748b">Édité le ${new Date().toLocaleString('fr-FR')}<br/>${rows.length} ligne(s)</div>
    </div>
    <table>
      <thead><tr>${columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </body></html>`;

  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);
  const doc = frame.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  frame.contentWindow?.focus();
  setTimeout(() => {
    frame.contentWindow?.print();
    setTimeout(() => document.body.removeChild(frame), 1000);
  }, 250);
}
