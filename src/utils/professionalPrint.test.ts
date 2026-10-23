import { describe, expect, it } from 'vitest';
import { withProfessionalPrintBranding } from './professionalPrint';

describe('withProfessionalPrintBranding', () => {
  it('adds configured company identity, safe logo, and professional print styles', () => {
    const html = withProfessionalPrintBranding('<html><head></head><body><h1>Rapport</h1></body></html>', {
      name: 'Société & Fils',
      address: 'Abidjan',
      phone: '01020304',
      email: 'contact@example.com',
      rccm: 'CI-123',
      ncc: '456',
      logo: 'data:image/png;base64,aGVsbG8='
    });

    expect(html).toContain('src="data:image/png;base64,aGVsbG8="');
    expect(html).toContain('Société &amp; Fils');
    expect(html).toContain('Abidjan');
    expect(html).toContain('background-color: #001F3F');
    expect(html).toContain('border-bottom: 2px solid #001F3F');
    expect(html).toContain('DOCUMENT OFFICIEL');
  });

  it('does not render unsafe logo URLs or trust company text as markup', () => {
    const html = withProfessionalPrintBranding('<html><head></head><body></body></html>', {
      name: '<img src=x onerror=alert(1)>',
      address: '',
      phone: '',
      email: '',
      rccm: '',
      ncc: '',
      logo: 'https://example.com/logo.png'
    });

    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x onerror');
    expect(html).not.toContain('https://example.com/logo.png');
  });

  it('uses compact branding for narrow receipts', () => {
    const html = withProfessionalPrintBranding('<html><head></head><body></body></html>', undefined, 'receipt');

    expect(html).toContain('.professional-print-logo { width: 12mm');
    expect(html).toContain('.professional-print-label { display: none; }');
  });

  it('adds a logo to existing company headings without duplicating the company header', () => {
    const html = withProfessionalPrintBranding(
      '<html><head></head><body><div class="company">Company name</div></body></html>',
      {
        name: 'Ma société',
        address: '',
        phone: '',
        email: '',
        rccm: '',
        ncc: '',
        logo: 'data:image/png;base64,aGVsbG8='
      }
    );

    expect(html.match(/professional-print-logo/g)).toHaveLength(2);
    expect(html).not.toContain('<header class="professional-print-brand">');
  });
});
