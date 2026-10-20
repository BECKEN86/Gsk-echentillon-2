import { describe, it, expect } from 'vitest';
import { formatAppDate, formatAppDateTime, parseAppDate } from './dateUtils';

describe('formatAppDate', () => {
  it('formate en YYYY-MM-DD heure locale', () => {
    expect(formatAppDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('formatAppDateTime', () => {
  it('formate en YYYY-MM-DD HH:mm heure locale', () => {
    expect(formatAppDateTime(new Date(2026, 11, 31, 9, 5))).toBe('2026-12-31 09:05');
  });
});

describe('parseAppDate (compatibilité Safari)', () => {
  it('parse une date simple', () => {
    const d = parseAppDate('2026-10-18');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(18);
  });

  it('parse un datetime avec espace (format interne, invalide dans Safari)', () => {
    const d = parseAppDate('2026-10-18 14:30');
    expect(isNaN(d.getTime())).toBe(false);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
  });

  it('parse un ISO datetime', () => {
    const d = parseAppDate('2026-10-18T14:30:00');
    expect(isNaN(d.getTime())).toBe(false);
  });

  it('retourne Invalid Date pour une entrée vide ou absurde', () => {
    expect(isNaN(parseAppDate('').getTime())).toBe(true);
    expect(isNaN(parseAppDate(undefined).getTime())).toBe(true);
    expect(isNaN(parseAppDate('pas une date').getTime())).toBe(true);
  });
});
