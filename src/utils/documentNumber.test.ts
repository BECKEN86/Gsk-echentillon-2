import { describe, it, expect } from 'vitest';
import { nextDocumentCode, nextApproReference } from './documentNumber';

describe('nextDocumentCode', () => {
  const now = new Date(2026, 4, 15); // 15 mai 2026

  it('génère le format PREFIX-YYYYMM-NNNN', () => {
    const { code } = nextDocumentCode({}, 'VTE', now);
    expect(code).toBe('VTE-202605-0001');
  });

  it('incrémente le compteur mensuel', () => {
    const r1 = nextDocumentCode({}, 'VTE', now);
    const r2 = nextDocumentCode(r1.counters, 'VTE', now);
    const r3 = nextDocumentCode(r2.counters, 'VTE', now);
    expect(r2.code).toBe('VTE-202605-0002');
    expect(r3.code).toBe('VTE-202605-0003');
  });

  it('les préfixes sont indépendants', () => {
    const r1 = nextDocumentCode({}, 'VTE', now);
    const r2 = nextDocumentCode(r1.counters, 'BC', now);
    expect(r2.code).toBe('BC-202605-0001');
  });

  it('le compteur redémarre le mois suivant', () => {
    const r1 = nextDocumentCode({}, 'VTE', new Date(2026, 4, 31));
    const r2 = nextDocumentCode(r1.counters, 'VTE', new Date(2026, 5, 1));
    expect(r2.code).toBe('VTE-202606-0001');
  });

  it('jamais de doublon même après suppression (compteur monotone)', () => {
    // Simule : 3 docs créés, 1 supprimé → le prochain est 0004, pas 0003
    let counters: Record<string, number> = {};
    let codes: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = nextDocumentCode(counters, 'VTE', now);
      counters = r.counters;
      codes.push(r.code);
    }
    codes.pop(); // "suppression" du dernier doc
    const r4 = nextDocumentCode(counters, 'VTE', now);
    expect(r4.code).toBe('VTE-202605-0004'); // pas 0003 malgré la suppression
    expect(codes).not.toContain(r4.code);
    expect(new Set([...codes, r4.code]).size).toBe(codes.length + 1);
  });
});

describe('nextApproReference', () => {
  const now = new Date(2026, 4, 15);

  it('génère le format APP-YYYY-NNN (ex: APP-2026-001)', () => {
    const { reference } = nextApproReference({}, now);
    expect(reference).toBe('APP-2026-001');
  });

  it('incrémente le compteur annuel séquentiellement', () => {
    const r1 = nextApproReference({}, now);
    const r2 = nextApproReference(r1.counters, now);
    expect(r1.reference).toBe('APP-2026-001');
    expect(r2.reference).toBe('APP-2026-002');
  });
});

