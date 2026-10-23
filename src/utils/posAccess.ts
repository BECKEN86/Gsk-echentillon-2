import { PointDeVente, SaleOrder, UserAccount, UserRole } from '../types';

export function canOpenMultipleCashRegisters(role: UserRole | undefined): boolean {
  return role === 'Administrateur' || role === 'Responsable Agence';
}

export function hasOpenCashRegister(session: PointDeVente | undefined): boolean {
  return session?.status === 'En cours';
}

export function canUseCashRegister(
  session: PointDeVente | undefined,
  user: UserAccount | null
): boolean {
  return hasOpenCashRegister(session) &&
    (!session?.occupiedBy || session.occupiedBy === user?.id);
}

export function filterCashierOrders(
  orders: SaleOrder[],
  user: UserAccount | null,
  sessions: PointDeVente[]
): SaleOrder[] {
  if (!user || user.role !== 'Caissier') return orders;

  const names = new Set([user.name, user.username].filter(Boolean));
  const ownSessions = sessions.filter(session =>
    session.occupiedBy === user.id ||
    (!session.occupiedBy &&
      (session.operator === user.name || session.operator === user.username))
  );
  const ownSessionIds = new Set(ownSessions.map(session => session.id));
  const ownSessionCodes = new Set(ownSessions.map(session => session.code));

  return orders.filter(order => {
    if (order.pointDeVenteId || order.pointDeVenteCode) {
      return Boolean(
        (order.pointDeVenteId && ownSessionIds.has(order.pointDeVenteId)) ||
        (order.pointDeVenteCode && ownSessionCodes.has(order.pointDeVenteCode))
      );
    }
    return Boolean(order.sellerName && names.has(order.sellerName));
  });
}
