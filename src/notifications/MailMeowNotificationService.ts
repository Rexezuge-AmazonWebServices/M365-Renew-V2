import type { NotificationMessage } from './NotificationMessage.js';
import type { NotificationService } from './NotificationService.js';

type FetchLike = typeof fetch;

export class MailMeowNotificationService implements NotificationService {
  private readonly baseUrl?: string;
  private readonly apiKey?: string;
  private readonly to?: string;
  private readonly fetchFn: FetchLike;

  constructor(
    baseUrl = process.env.MAIL_MEOW_BASE_URL,
    apiKey = process.env.MAIL_MEOW_API_KEY,
    to = process.env.NOTIFICATION_EMAIL,
    fetchFn: FetchLike = fetch,
  ) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.to = to;
    this.fetchFn = fetchFn;
  }

  async send(message: NotificationMessage): Promise<void> {
    if (!this.baseUrl || !this.apiKey || !this.to) {
      console.log('MailMeow notification configuration is incomplete');
      return;
    }

    try {
      const url = `${this.baseUrl.replace(/\/$/, '')}/api/${encodeURIComponent(this.apiKey)}/email`;
      const response = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          accept: '*/*',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          to: this.to,
          subject: message.subject,
          text: message.text,
        }),
      });

      if (!response.ok) {
        throw new Error(`MailMeow returned ${response.status}: ${response.statusText}`);
      }

      console.log('Notification sent via MailMeow');
    } catch (error) {
      console.error('Failed to send MailMeow notification:', error);
    }
  }
}
