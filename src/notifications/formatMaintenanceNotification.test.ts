import { describe, expect, it } from 'vitest';
import { formatMaintenanceNotification } from './formatMaintenanceNotification.js';

describe('formatMaintenanceNotification', () => {
  it('formats a successful maintenance notification', () => {
    const notification = formatMaintenanceNotification({
      userId: 'user-123',
      logId: 'log-456',
      status: 'success',
      message: 'ignored on success',
      executionDate: new Date('2026-05-25T12:34:56.000Z'),
    });

    expect(notification.subject).toBe('Completed - Maintenance Log: M365 Renew Task');
    expect(notification.text).toContain('- User ID: user-123');
    expect(notification.text).toContain('- Log ID: log-456');
    expect(notification.text).toContain('- Execution Time: 2026-05-25 12:34:56.000 UTC');
    expect(notification.text).toContain('- Outcome: Completed');
    expect(notification.text).toContain('- Additional Information: No irregularities were observed during the execution.');
  });

  it('formats a failed maintenance notification with the error message', () => {
    const notification = formatMaintenanceNotification({
      userId: 'user-123',
      logId: 'log-456',
      status: 'failure',
      message: 'Login failed',
      executionDate: new Date('2026-05-25T12:34:56.000Z'),
    });

    expect(notification.subject).toBe('Failed - Maintenance Log: M365 Renew Task');
    expect(notification.text).toContain('- Outcome: Failed');
    expect(notification.text).toContain('- Additional Information: Login failed');
  });
});
