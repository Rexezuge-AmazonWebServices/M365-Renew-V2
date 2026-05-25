import type { NotificationMessage } from './NotificationMessage.js';

export interface MaintenanceNotificationInput {
  userId: string;
  logId: string;
  status: 'success' | 'failure';
  message: string;
  executionDate?: Date;
}

export function formatMaintenanceNotification(input: MaintenanceNotificationInput): NotificationMessage {
  const executionTime = (input.executionDate ?? new Date()).toISOString().replace('T', ' ').replace('Z', ' UTC');
  const result = input.status === 'success' ? 'Completed' : 'Failed';
  const additionalInformation = input.status === 'success' ? 'No irregularities were observed during the execution.' : input.message;

  return {
    subject: `${result} - Maintenance Log: M365 Renew Task`,
    text: [
      'Hello Boss Davis,',
      '',
      'This message serves as a formal record of the routine maintenance activity performed today. The operational details are listed below for documentation purposes.',
      '',
      `- User ID: ${input.userId}`,
      `- Log ID: ${input.logId}`,
      `- Execution Time: ${executionTime}`,
      `- Outcome: ${result}`,
      `- Additional Information: ${additionalInformation}`,
      '',
      'This log will be stored for future reference. Further entries of the same category will follow this format.',
      '',
      'Thank you.',
      'John Doe',
      'John.Doe.1000@example.com',
      '',
      '1249 Evergreen Ridge Cir',
      'Northvale, CA 95248, USA',
    ].join('\r\n'),
  };
}
