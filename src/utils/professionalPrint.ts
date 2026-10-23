import { CompanyConfig } from '../types';

const escapeHtml = (value: string | number | undefined | null): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const isSafeLogo = (logo?: string): logo is string =>
  !!logo && /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z\d+/=\s]+$/i.test(logo);

export function withProfessionalPrintBranding(
  html: string,
  company?: CompanyConfig | null,
  layout: 'a4' | 'receipt' = 'a4'
): string {
  const companyName = company?.name?.trim() || 'GeStock';
  const logo = isSafeLogo(company?.logo)
    ? `<img class="professional-print-logo" src="${escapeHtml(company.logo)}" alt="Logo ${escapeHtml(companyName)}">`
    : '';
  const details = [
    company?.address,
    company?.phone && `Tél. : ${company.phone}`,
    company?.email,
    company?.rccm && `RCCM : ${company.rccm}`,
    company?.ncc && `NCC : ${company.ncc}`
  ].filter(Boolean);
  const brand = `<header class="professional-print-brand">
    ${logo}
    <div class="professional-print-company">
      <strong>${escapeHtml(companyName)}</strong>
      ${details.map(detail => `<span>${escapeHtml(detail)}</span>`).join('')}
    </div>
    <div class="professional-print-label">DOCUMENT OFFICIEL</div>
  </header>`;
  const styles = `
    * { box-sizing: border-box; }
    body { color: #172033; font-family: Arial, "Segoe UI", sans-serif; }
    .professional-print-brand {
      display: flex; align-items: center; gap: 12px; margin: 0 0 16px; padding: 0 0 10px;
      border-bottom: 2px solid #001F3F; color: #001F3F;
    }
    .professional-print-logo { display: block; width: 22mm; height: 17mm; object-fit: contain; }
    .professional-print-company { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; font-size: 9pt; }
    .professional-print-company strong { font-size: 13pt; color: #001F3F; }
    .professional-print-company span { color: #526174; }
    .professional-print-label { align-self: flex-start; color: #2563EB; font-size: 7pt; font-weight: 700; letter-spacing: .08em; }
    h1, h2, h3 { color: #001F3F; }
    table { border-collapse: collapse; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th { background-color: #001F3F; color: #fff; }
    td { vertical-align: top; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .professional-print-brand { break-inside: avoid; }
    }
  `;
  const layoutStyles = layout === 'receipt' ? `
    .professional-print-brand { gap: 5px; margin-bottom: 8px; padding-bottom: 6px; }
    .professional-print-logo { width: 12mm; height: 10mm; }
    .professional-print-company { font-size: 7pt; }
    .professional-print-company strong { font-size: 9pt; }
    .professional-print-company span { overflow-wrap: anywhere; }
    .professional-print-label { display: none; }
  ` : '';
  const styleTag = `<style>${styles}${layoutStyles}</style>`;
  const styledHtml = /<\/head>/i.test(html)
    ? html.replace(/<\/head>/i, `${styleTag}</head>`)
    : html.replace(/<html[^>]*>/i, match => `${match}<head><meta charset="utf-8">${styleTag}</head>`);

  if (!/<body[^>]*>/i.test(styledHtml)) return styledHtml;
  const hasLogo = /<img[^>]*class=["'][^"']*(?:company-logo|professional-print-logo)/i.test(styledHtml);
  const companyElement = /<(?:div|header|section)[^>]*class=["'][^"']*\b(?:company|brand|big)\b[^"']*["'][^>]*>/i;
  const existingCompany = companyElement.exec(styledHtml);

  if (hasLogo) return styledHtml;
  if (existingCompany && logo) {
    return styledHtml.replace(existingCompany[0], `${existingCompany[0]}${logo}`);
  }
  if (existingCompany) return styledHtml;
  return styledHtml.replace(/<body[^>]*>/i, match => `${match}${brand}`);
}
