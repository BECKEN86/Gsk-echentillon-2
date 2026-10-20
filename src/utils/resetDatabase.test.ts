import { describe, it, expect } from 'vitest';
import { buildWipedDatabase } from './resetDatabase';
import { getDefaultDatabase, AppDatabase } from '../services/storageService';

const BUSINESS_KEYS: (keyof AppDatabase)[] = [
  'products',
  'categories',
  'movements',
  'clients',
  'suppliers',
  'inquiries',
  'purchaseOrders',
  'receptions',
  'approvisionnements',
  'storageSites',
  'saleOrders',
  'pointsDeVente',
  'transactions',
  'treasuryAccounts',
  'treasuryMovements',
  'auditLogs',
  'valuations',
  'physicalInventories',
  'stockAdjustments',
  'stockTransfers',
  'stockLosses',
  'customerReturns',
  'supplierReturns'
];

describe('remise à zéro de la base', () => {
  const db = getDefaultDatabase();
  const wiped = buildWipedDatabase(db);

  it('vide toutes les collections métier', () => {
    BUSINESS_KEYS.forEach(key => {
      expect(wiped[key], key).toEqual([]);
    });
  });

  it('conserve les comptes utilisateurs (dont l\'utilisateur de test)', () => {
    expect(wiped.users).toEqual(db.users);
    expect(wiped.users.length).toBeGreaterThan(0);
    expect(wiped.users.some(u => u.username === 'admin')).toBe(true);
  });

  it('conserve la configuration société', () => {
    const withConfig: AppDatabase = {
      ...db,
      companyConfig: { name: 'Maison SARL', address: '', phone: '', email: '', rccm: '', ncc: '' }
    };
    expect(buildWipedDatabase(withConfig).companyConfig?.name).toBe('Maison SARL');
    expect(wiped.companyConfig).toBeNull();
  });

  it('remet les compteurs de numérotation à zéro', () => {
    const withCounters: AppDatabase = { ...db, counters: { 'VTE-202605': 12, 'BC-202605': 4 } };
    expect(buildWipedDatabase(withCounters).counters).toEqual({});
  });

  it('garde un schéma AppDatabase complet (aucune clé manquante)', () => {
    Object.keys(db).forEach(key => {
      expect(wiped, key).toHaveProperty(key);
    });
  });
});
