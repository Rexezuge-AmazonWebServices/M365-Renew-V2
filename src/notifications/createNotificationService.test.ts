import { describe, expect, it } from 'vitest';
import { ConsoleNotificationService } from './ConsoleNotificationService.js';
import { createNotificationService } from './createNotificationService.js';
import { MailMeowNotificationService } from './MailMeowNotificationService.js';
import { SnsNotificationService } from './SnsNotificationService.js';

describe('createNotificationService', () => {
  it('creates the console notification service', () => {
    expect(createNotificationService('console')).toBeInstanceOf(ConsoleNotificationService);
  });

  it('creates the SNS notification service', () => {
    expect(createNotificationService('sns')).toBeInstanceOf(SnsNotificationService);
  });

  it('creates the MailMeow notification service', () => {
    expect(createNotificationService('mailmeow')).toBeInstanceOf(MailMeowNotificationService);
  });

  it('defaults to SNS for unknown providers', () => {
    expect(createNotificationService('unknown')).toBeInstanceOf(SnsNotificationService);
  });
});
