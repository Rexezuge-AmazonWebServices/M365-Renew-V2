import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsoleNotificationService } from './ConsoleNotificationService.js';

describe('ConsoleNotificationService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs the notification', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const service = new ConsoleNotificationService();

    await expect(service.send({ subject: 'Subject', text: 'Body' })).resolves.toBeUndefined();

    expect(logSpy).toHaveBeenCalledWith('Notification subject:', 'Subject');
    expect(logSpy).toHaveBeenCalledWith('Notification body:', 'Body');
  });
});
