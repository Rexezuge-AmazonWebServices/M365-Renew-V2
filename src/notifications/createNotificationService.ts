import { ConsoleNotificationService } from './ConsoleNotificationService.js';
import { MailMeowNotificationService } from './MailMeowNotificationService.js';
import type { NotificationService } from './NotificationService.js';
import { SnsNotificationService } from './SnsNotificationService.js';

export type NotificationProvider = 'console' | 'sns' | 'mailmeow';

export function createNotificationService(provider = process.env.NOTIFICATION_PROVIDER || 'sns'): NotificationService {
  const normalizedProvider = provider.toLowerCase();

  switch (normalizedProvider) {
    case 'console':
      return new ConsoleNotificationService();
    case 'mailmeow':
      return new MailMeowNotificationService();
    case 'sns':
      return new SnsNotificationService();
    default:
      console.log(`Unknown notification provider "${provider}", falling back to SNS`);
      return new SnsNotificationService();
  }
}
