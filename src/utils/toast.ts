export type ToastKind = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  message: string;
  kind: ToastKind;
}

let nextToastId = 0;

export function showToast(message: string, kind: ToastKind = 'success'): void {
  if (typeof window === 'undefined') return;

  const toast: ToastMessage = {
    id: ++nextToastId,
    message,
    kind
  };
  window.dispatchEvent(new CustomEvent<ToastMessage>('gestock:toast', { detail: toast }));
}

const auditedEntities: Record<string, { label: string; feminine: boolean }> = {
  purchaseOrders: { label: 'Le bon de commande', feminine: false },
  receptions: { label: 'La réception', feminine: true },
  approvisionnements: { label: 'L’approvisionnement', feminine: false },
  storageSites: { label: 'Le site de stockage', feminine: false },
  valuations: { label: 'La valorisation de stock', feminine: true },
  physicalInventories: { label: 'L’inventaire physique', feminine: false },
  stockAdjustments: { label: 'L’ajustement de stock', feminine: false },
  stockTransfers: { label: 'Le transfert de stock', feminine: false },
  stockLosses: { label: 'La déclaration de perte ou casse', feminine: true },
  customerReturns: { label: 'Le retour client', feminine: false },
  supplierReturns: { label: 'Le retour fournisseur', feminine: false },
  saleOrders: { label: 'La vente', feminine: true },
  users: { label: 'Le compte utilisateur', feminine: false },
  companyConfig: { label: 'La configuration de la société', feminine: true },
  transactions: { label: 'La transaction', feminine: true },
  treasuryMovements: { label: 'Le mouvement de trésorerie', feminine: false },
  database: { label: 'L’export des données', feminine: false },
  system: { label: 'La base de données', feminine: true }
};

const auditedVerbs: Record<string, { singular: string; plural?: string }> = {
  create: { singular: 'créé', plural: 'créés' },
  update: { singular: 'modifié', plural: 'modifiés' },
  delete: { singular: 'supprimé', plural: 'supprimés' },
  deleteMultiple: { singular: 'supprimés', plural: 'supprimés' },
  validate: { singular: 'validé', plural: 'validés' },
  close: { singular: 'clôturé', plural: 'clôturés' },
  cancel: { singular: 'annulé', plural: 'annulés' },
  receive: { singular: 'réceptionné', plural: 'réceptionnés' },
  apply: { singular: 'appliqué', plural: 'appliqués' },
  declare: { singular: 'déclaré', plural: 'déclarés' },
  destock: { singular: 'déstocké', plural: 'déstockés' },
  activate: { singular: 'activé', plural: 'activés' },
  deactivate: { singular: 'désactivé', plural: 'désactivés' },
  resetPassword: { singular: 'réinitialisé' },
  duplicate: { singular: 'dupliqué', plural: 'dupliqués' },
  recette: { singular: 'enregistrée', plural: 'enregistrées' },
  depense: { singular: 'enregistrée', plural: 'enregistrées' },
  movement: { singular: 'enregistré', plural: 'enregistrés' },
  export: { singular: 'effectué', plural: 'effectués' },
  reset: { singular: 'réinitialisée', plural: 'réinitialisées' }
};

const auditedMessages: Record<string, string> = {
  'loss.declare': 'La déclaration de perte ou casse a été enregistrée avec succès.',
  'loss.destock': 'Le stock a été déstocké avec succès.',
  'loss.delete': 'La déclaration de perte ou casse a été supprimée avec succès.',
  'approvisionnement.create': 'L’approvisionnement a été enregistré avec succès.',
  'approvisionnement.delete': 'L’approvisionnement a été supprimé avec succès.',
  'inventory.adjust': 'Les écarts d’inventaire ont été appliqués au stock avec succès.'
};

export function getAuditSuccessMessage(action: string, entity: string): string {
  if (auditedMessages[action]) return auditedMessages[action];
  if (action === 'transaction.recette') return 'La recette a été enregistrée avec succès.';
  if (action === 'transaction.depense') return 'La dépense a été enregistrée avec succès.';
  if (action === 'user.resetPassword') return 'Le mot de passe a été réinitialisé avec succès.';
  if (action === 'data.export') return 'L’export des données a été effectué avec succès.';

  const entityInfo = auditedEntities[entity];
  const verb = auditedVerbs[action.split('.').pop() || ''];
  if (!entityInfo || !verb) return 'Action effectuée avec succès.';

  const ending = entityInfo.feminine ? 'e' : '';
  const isPluralAction = action.endsWith('.deleteMultiple');
  const actionVerb = isPluralAction ? verb.plural || verb.singular : `${verb.singular}${ending}`;
  const label = isPluralAction && entity === 'purchaseOrders' ? 'Les bons de commande' : entityInfo.label;
  const conjugation = isPluralAction ? 'ont été' : 'a été';

  return `${label} ${conjugation} ${actionVerb} avec succès.`;
}

export function showAuditSuccess(action: string, entity: string): void {
  showToast(getAuditSuccessMessage(action, entity));
}
