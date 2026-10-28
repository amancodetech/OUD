import { describe, it, expect } from 'vitest';
import { getSystemNotifications } from '../src/services/notification.service';

describe('Notification Service', () => {
  it('should return system notifications and calculated counts', async () => {
    const res = await getSystemNotifications();
    expect(res).toBeDefined();
    expect(Array.isArray(res.notifications)).toBe(true);
    expect(res.counts).toBeDefined();
    expect(typeof res.counts.total).toBe('number');
    expect(typeof res.counts.critical).toBe('number');
    expect(typeof res.counts.warning).toBe('number');
    expect(typeof res.counts.info).toBe('number');
    expect(res.counts.byCategory).toBeDefined();
  });

  it('every notification should have required fields and valid actionUrl', async () => {
    const res = await getSystemNotifications();
    for (const notif of res.notifications) {
      expect(notif.id).toBeTruthy();
      expect(['INVENTORY', 'DEBTS', 'DRIVERS', 'FINANCIAL', 'SETUP']).toContain(notif.category);
      expect(['CRITICAL', 'WARNING', 'INFO']).toContain(notif.severity);
      expect(notif.titleAr).toBeTruthy();
      expect(notif.descriptionAr).toBeTruthy();
      expect(notif.actionUrl).toBeTruthy();
      expect(notif.actionUrl.startsWith('/')).toBe(true);
      expect(notif.actionLabelAr).toBeTruthy();
    }
  });
});
