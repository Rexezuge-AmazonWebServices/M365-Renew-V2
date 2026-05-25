import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import type { NotificationMessage } from './NotificationMessage.js';
import type { NotificationService } from './NotificationService.js';

type SnsClientLike = {
  send(command: PublishCommand): Promise<unknown>;
};

export class SnsNotificationService implements NotificationService {
  private readonly topicArn?: string;
  private readonly region: string;
  private snsClient?: SnsClientLike;

  constructor(topicArn = process.env.SNS_TOPIC_ARN, region = process.env.AWS_REGION || 'us-east-2', snsClient?: SnsClientLike) {
    this.topicArn = topicArn;
    this.region = region;
    this.snsClient = snsClient;
  }

  async send(message: NotificationMessage): Promise<void> {
    if (!this.topicArn) {
      console.log('No SNS topic ARN configured');
      return;
    }

    try {
      const command = new PublishCommand({
        TopicArn: this.topicArn,
        Subject: message.subject,
        Message: message.text,
      });

      await this.getClient().send(command);
      console.log('Notification sent via SNS');
    } catch (error) {
      console.error('Failed to send SNS notification:', error);
    }
  }

  private getClient(): SnsClientLike {
    this.snsClient ??= new SNSClient({ region: this.region });
    return this.snsClient;
  }
}
