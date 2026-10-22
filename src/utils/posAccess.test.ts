import { describe, expect, it } from 'vitest';
import { PointDeVente, SaleOrder, UserAccount } from '../types';
import { canOpenMultipleCashRegisters, canUseCashRegister, filterCashierOrders, hasOpenCashRegister } from './posAccess';

const cashier = {
  id: 'u1',
  username: 'cashier1',
  name: 'Caissier Un',
  role: 'Caissier'
} as UserAccount;

const sessions = [
  { id: 'pv1', code: 'PV0001', operator: 'Caissier Un' },
  { id: 'pv2', code: 'PV0002', operator: 'Caissier Deux' }
] as PointDeVente[];

const orders = [
  { id: 'o1', sellerName: 'Caissier Un', pointDeVenteId: 'pv1' },
  { id: 'o2', sellerName: 'Caissier Deux', pointDeVenteId: 'pv2' },
  { id: 'o3', pointDeVenteCode: 'PV0001' }
] as SaleOrder[];

describe('POS access helpers', () => {
  it('allows only agency managers and administrators to open multiple cash registers', () => {
    expect(canOpenMultipleCashRegisters('Administrateur')).toBe(true);
    expect(canOpenMultipleCashRegisters('Responsable Agence')).toBe(true);
    expect(canOpenMultipleCashRegisters('Caissier')).toBe(false);
    expect(canOpenMultipleCashRegisters('Gérant')).toBe(false);
  });

  it('limits cashiers to their own orders and their legacy session orders', () => {
    expect(filterCashierOrders(orders, cashier, sessions).map(order => order.id))
      .toEqual(['o1', 'o3']);
  });

  it('uses register ownership before matching cashier display names', () => {
    const assignedSessions = [
      { ...sessions[0], operator: 'Opérateur', occupiedBy: 'u1' },
      { ...sessions[1], operator: 'Caissier Un', occupiedBy: 'u2' }
    ] as PointDeVente[];
    const assignedOrders = [
      { id: 'own', sellerName: 'Caissier Un', pointDeVenteId: 'pv1' },
      { id: 'other', sellerName: 'Caissier Un', pointDeVenteId: 'pv2' }
    ] as SaleOrder[];
    expect(filterCashierOrders(assignedOrders, cashier, assignedSessions).map(order => order.id))
      .toEqual(['own']);
  });

  it('does not restrict other roles orders', () => {
    const manager = { ...cashier, role: 'Administrateur' } as UserAccount;
    expect(filterCashierOrders(orders, manager, sessions)).toBe(orders);
  });

  it('allows checkout only when a cash register session is open', () => {
    expect(hasOpenCashRegister({ ...sessions[0], status: 'En cours' })).toBe(true);
    expect(hasOpenCashRegister({ ...sessions[0], status: 'Fermé' })).toBe(false);
    expect(hasOpenCashRegister(undefined)).toBe(false);
  });

  it('prevents another account from using a register already reserved by a cashier', () => {
    const occupied = { ...sessions[0], status: 'En cours', occupiedBy: 'u2' } as PointDeVente;
    expect(canUseCashRegister(occupied, cashier)).toBe(false);
    expect(canUseCashRegister(occupied, { ...cashier, id: 'u2' })).toBe(true);
    expect(canUseCashRegister({ ...occupied, occupiedBy: undefined }, cashier)).toBe(true);
  });
});
