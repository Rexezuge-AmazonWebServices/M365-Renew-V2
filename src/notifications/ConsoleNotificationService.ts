import type { NotificationMessage } from './NotificationMessage.js';
import type { NotificationService } from './NotificationService.js';

export class ConsoleNotificationService implements NotificationService {
  async send(message: NotificationMessage): Promise<void> {
    console.log('Notification subject:', message.subject);
    console.log('Notification body:', message.text);
  }
}
