import { describe, expect, it } from 'vitest';
import { getAuditSuccessMessage } from './toast';

describe('getAuditSuccessMessage', () => {
  it('formats audited creation actions in French', () => {
    expect(getAuditSuccessMessage('storage-site.create', 'storageSites'))
      .toBe('Le site de stockage a été créé avec succès.');
  });

  it('formats multiple deletions in plural', () => {
    expect(getAuditSuccessMessage('purchaseOrder.deleteMultiple', 'purchaseOrders'))
      .toBe('Les bons de commande ont été supprimés avec succès.');
  });

  it('uses a specific message for stock losses', () => {
    expect(getAuditSuccessMessage('loss.destock', 'stockLosses'))
      .toBe('Le stock a été déstocké avec succès.');
  });

  it('has a generic success message for unknown audit actions', () => {
    expect(getAuditSuccessMessage('unknown.action', 'unknown'))
      .toBe('Action effectuée avec succès.');
  });
});
