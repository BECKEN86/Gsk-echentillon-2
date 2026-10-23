import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from './db.mjs';

describe('SQLite cash-register reservation', () => {
  let dataDir;
  let store;

  beforeAll(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'gestock-register-test-'));
    process.env.GESTOCK_DATA_DIR = dataDir;
    store = await createStore();
  });

  beforeEach(async () => {
    await store.reset();
    await store.save({
      pointsDeVente: [
        { id: 'pv1', code: 'PV0001', operator: 'Caisse', status: 'En cours' }
      ]
    });
  });

  afterAll(() => {
    store?.close();
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
    delete process.env.GESTOCK_DATA_DIR;
  });

  it('grants the open register to only one user', async () => {
    const [first, second] = await Promise.all([
      store.claimCashRegister('pv1', 'cashier-1'),
      store.claimCashRegister('pv1', 'cashier-2')
    ]);

    expect([first.ok, second.ok].filter(Boolean)).toHaveLength(1);
    expect((await store.load()).pointsDeVente[0].occupiedBy)
      .toBe(first.ok ? 'cashier-1' : 'cashier-2');
  });

  it('does not allow ordinary entity sync to steal a reservation', async () => {
    await store.claimCashRegister('pv1', 'cashier-1');
    await store.upsert('pointsDeVente', 'pv1', {
      id: 'pv1',
      code: 'PV0001',
      operator: 'Caisse',
      status: 'En cours',
      occupiedBy: 'cashier-2'
    });

    expect((await store.load()).pointsDeVente[0].occupiedBy).toBe('cashier-1');
  });

  it('allows release by its owner and rejects release by another user', async () => {
    await store.claimCashRegister('pv1', 'cashier-1');
    expect((await store.releaseCashRegister('pv1', 'cashier-2')).ok).toBe(false);
    expect((await store.releaseCashRegister('pv1', 'cashier-1')).ok).toBe(true);
    expect((await store.load()).pointsDeVente[0].occupiedBy).toBeUndefined();
  });
});
