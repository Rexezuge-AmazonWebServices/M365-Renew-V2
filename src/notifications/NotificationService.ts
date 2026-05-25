import type { NotificationMessage } from './NotificationMessage.js';

export interface NotificationService {
  send(message: NotificationMessage): Promise<void>;
}
