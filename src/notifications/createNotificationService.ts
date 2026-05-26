import { ConsoleNotificationService } from './ConsoleNotificationService.js';
import { MailMeowNotificationService } from './MailMeowNotificationService.js';
import type { NotificationService } from './NotificationService.js';
import { SnsNotificationService } from './SnsNotificationService.js';

export type NotificationProvider = 'console' | 'sns' | 'mailmeow';

export function createNotificationService(provider = process.env.NOTIFICATION_PROVIDER || 'sns'): NotificationService {
  switch (provider) {
    case 'console':
      return new ConsoleNotificationService();
    case 'mailmeow':
      return new MailMeowNotificationService();
    case 'sns':
      return new SnsNotificationService();
    default:
      throw new Error(`Unknown notification provider "${provider}". Expected one of: console, sns, mailmeow.`);
  }
}
