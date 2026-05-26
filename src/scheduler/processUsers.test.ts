import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Context, ScheduledEvent } from 'aws-lambda';
import type { User } from '../models/User.js';

const mocks = vi.hoisted(() => ({
  getNextUserForProcessing: vi.fn(),
  updateProcessingSchedule: vi.fn(),
  createLog: vi.fn(),
  decryptData: vi.fn(),
  login: vi.fn(),
  sendNotification: vi.fn(),
  formatMaintenanceNotification: vi.fn(),
}));

vi.mock('../dao/UserDAO.js', () => ({
  UserDAO: class MockUserDAO {
    getNextUserForProcessing = mocks.getNextUserForProcessing;
    updateProcessingSchedule = mocks.updateProcessingSchedule;
  },
}));

vi.mock('../dao/ProcessingLogDAO.js', () => ({
  ProcessingLogDAO: class MockProcessingLogDAO {
    createLog = mocks.createLog;
  },
}));

vi.mock('../crypto/aes-gcm.js', () => ({
  decryptData: mocks.decryptData,
}));

vi.mock('../utils/M365LoginUtil.js', () => ({
  M365LoginUtil: {
    login: mocks.login,
  },
}));

vi.mock('../notifications/createNotificationService.js', () => ({
  createNotificationService: () => ({ send: mocks.sendNotification }),
}));

vi.mock('../notifications/formatMaintenanceNotification.js', () => ({
  formatMaintenanceNotification: mocks.formatMaintenanceNotification,
}));

import { processUsers } from './processUsers.js';

const event = {} as ScheduledEvent;
const context = {} as Context;

const user: User = {
  userId: 'user-1',
  encryptedEmailAddress: 'encrypted-email',
  encryptedPassword: 'encrypted-password',
  encryptedTotpKey: 'encrypted-totp',
  salt: 'salt',
  status: 'active',
  consecutiveFailures: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('processUsers', () => {
  beforeEach(() => {
    vi.stubEnv('AES_ENCRYPTION_KEY', 'test-key');
    vi.stubEnv('MIN_PROCESSING_INTERVAL_HOURS', '25');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    mocks.getNextUserForProcessing.mockReset();
    mocks.updateProcessingSchedule.mockReset().mockResolvedValue(undefined);
    mocks.createLog.mockReset().mockResolvedValue('log-1');
    mocks.decryptData.mockReset().mockImplementation(async (value: string) => value.replace('encrypted-', ''));
    mocks.login.mockReset();
    mocks.sendNotification.mockReset().mockResolvedValue(undefined);
    mocks.formatMaintenanceNotification.mockReset().mockReturnValue({ subject: 'subject', text: 'text' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not fail the Lambda execution for a handled sign-in failure', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    mocks.getNextUserForProcessing.mockResolvedValue(user);
    mocks.login.mockResolvedValue({ success: false, errorMessage: 'Login failed', screenshotBase64: 'screenshot' });

    await expect(processUsers(event, context)).resolves.toBeUndefined();

    expect(mocks.createLog).toHaveBeenCalledWith('user-1', 'failure', 'Login failed', 'screenshot');
    expect(mocks.updateProcessingSchedule).toHaveBeenCalledWith('user-1', 1767225600 + 7200, 2);
    expect(mocks.formatMaintenanceNotification).toHaveBeenCalledWith({
      userId: 'user-1',
      logId: 'log-1',
      status: 'failure',
      message: 'Login failed',
    });
    expect(mocks.sendNotification).toHaveBeenCalledWith({ subject: 'subject', text: 'text' });
  });

  it('fails the Lambda execution for unhandled system errors', async () => {
    const error = new Error('DynamoDB unavailable');
    mocks.getNextUserForProcessing.mockRejectedValue(error);

    await expect(processUsers(event, context)).rejects.toThrow('DynamoDB unavailable');
  });
});
