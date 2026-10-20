/**
 * Numérotation persistante des documents : PREFIX-YYYYMM-NNNN.
 * Le compteur est mensuel et conservé dans `counters` (persisté en base).
 * Pur — sans effet de bord — pour être testable.
 */
export function nextDocumentCode(
  counters: Record<string, number>,
  prefix: string,
  now: Date = new Date()
): { code: string; counters: Record<string, number> } {
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const key = `${prefix}-${ym}`;
  const n = (counters[key] || 0) + 1;
  return {
    code: `${prefix}-${ym}-${String(n).padStart(4, '0')}`,
    counters: { ...counters, [key]: n }
  };
}

/**
 * Numérotation standard pour les approvisionnements : APP-YYYY-NNN (ex: APP-2026-001).
 * Le compteur est annuel et monotone.
 */
export function nextApproReference(
  counters: Record<string, number>,
  now: Date = new Date()
): { reference: string; counters: Record<string, number> } {
  const year = now.getFullYear();
  const key = `APP-${year}`;
  const n = (counters[key] || 0) + 1;
  return {
    reference: `APP-${year}-${String(n).padStart(3, '0')}`,
    counters: { ...counters, [key]: n }
  };
}

