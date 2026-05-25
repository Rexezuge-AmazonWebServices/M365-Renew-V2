import { afterEach, describe, expect, it, vi } from 'vitest';
import { MailMeowNotificationService } from './MailMeowNotificationService.js';

describe('MailMeowNotificationService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts the notification to MailMeow', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fetchFn = vi.fn(async () => ({ ok: true, status: 200, statusText: 'OK' }) as Response);
    const service = new MailMeowNotificationService('https://mail-meow.example.com/', 'api-key', 'destination@example.com', fetchFn);

    await service.send({ subject: 'Subject', text: 'Meow' });

    expect(fetchFn).toHaveBeenCalledWith('https://mail-meow.example.com/api/api-key/email', {
      method: 'POST',
      headers: {
        accept: '*/*',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        to: 'destination@example.com',
        subject: 'Subject',
        text: 'Meow',
      }),
    });
  });

  it('does not send when configuration is incomplete', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fetchFn = vi.fn(async () => ({ ok: true, status: 200, statusText: 'OK' }) as Response);
    const service = new MailMeowNotificationService('', 'api-key', 'destination@example.com', fetchFn);

    await service.send({ subject: 'Subject', text: 'Meow' });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('MailMeow notification configuration is incomplete');
  });
});
