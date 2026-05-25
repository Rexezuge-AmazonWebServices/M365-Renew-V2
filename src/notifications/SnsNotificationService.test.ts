import { PublishCommand } from '@aws-sdk/client-sns';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SnsNotificationService } from './SnsNotificationService.js';

describe('SnsNotificationService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not send when the topic ARN is missing', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const send = vi.fn(async (_command: PublishCommand) => undefined);
    const service = new SnsNotificationService('', 'us-east-2', { send });

    await service.send({ subject: 'Subject', text: 'Body' });

    expect(send).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('No SNS topic ARN configured');
  });

  it('publishes the notification to SNS', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const send = vi.fn(async (_command: PublishCommand) => undefined);
    const service = new SnsNotificationService('topic-arn', 'us-east-2', { send });

    await service.send({ subject: 'Subject', text: 'Body' });

    expect(send).toHaveBeenCalledOnce();
    const command = send.mock.calls[0][0];
    expect(command.input).toEqual({
      TopicArn: 'topic-arn',
      Subject: 'Subject',
      Message: 'Body',
    });
  });
});
