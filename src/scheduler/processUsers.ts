import { ScheduledEvent, Context } from 'aws-lambda';
import { isIP } from 'node:net';
import { UserDAO } from '../dao/UserDAO.js';
import { ProcessingLogDAO } from '../dao/ProcessingLogDAO.js';
import { decryptData } from '../crypto/aes-gcm.js';
import { M365LoginUtil } from '../utils/M365LoginUtil.js';
import { createNotificationService } from '../notifications/createNotificationService.js';
import { formatMaintenanceNotification } from '../notifications/formatMaintenanceNotification.js';

export const processUsers = async (_event: ScheduledEvent, _context: Context): Promise<void> => {
  console.log('🔄 Starting user processing...');

  const userDAO = new UserDAO();
  const logDAO = new ProcessingLogDAO();

  try {
    // Get next user for processing
    const user = await userDAO.getNextUserForProcessing();
    if (!user) {
      console.log('ℹ️ No users to process');
      return;
    }

    console.log('👉 Processing user:', user.userId);
    const lambdaExternalIpAddress = await getLambdaExternalIpAddress();

    const key = process.env.AES_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('AES encryption key not configured');
    }

    let status: 'success' | 'failure';
    let resultMessage: string;
    let logId: string;

    try {
      // Decrypt credentials
      const emailAddress = await decryptData(user.encryptedEmailAddress, key, user.salt);
      const password = await decryptData(user.encryptedPassword, key, user.salt);
      const totpKey = await decryptData(user.encryptedTotpKey, key, user.salt);

      // Attempt login
      const loginResult = await M365LoginUtil.login(emailAddress, password, totpKey);

      status = loginResult.success ? 'success' : 'failure';
      resultMessage = loginResult.success ? 'Login successful' : loginResult.errorMessage || 'Login failed';

      logId = await logDAO.createLog(user.userId, status, resultMessage, loginResult.screenshotBase64, lambdaExternalIpAddress);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      status = 'failure';
      resultMessage = errorMessage;

      logId = await logDAO.createLog(user.userId, 'failure', errorMessage, undefined, lambdaExternalIpAddress);
    }

    // Schedule next processing: normal interval on success, exponential backoff on failure
    const minIntervalHours = parseInt(process.env.MIN_PROCESSING_INTERVAL_HOURS || '25');
    const nowEpoch = Math.floor(Date.now() / 1000);

    if (status === 'success') {
      await userDAO.updateProcessingSchedule(user.userId, nowEpoch + minIntervalHours * 3600, 0);
    } else {
      const failures = (user.consecutiveFailures || 0) + 1;
      const baseCooldownSeconds = 3600;
      const maxCooldownSeconds = minIntervalHours * 3600;
      const cooldownSeconds = Math.min(baseCooldownSeconds * Math.pow(2, failures - 1), maxCooldownSeconds);
      await userDAO.updateProcessingSchedule(user.userId, nowEpoch + cooldownSeconds, failures);
    }

    const notification = formatMaintenanceNotification({
      userId: user.userId,
      logId,
      status,
      message: resultMessage,
      lambdaExternalIpAddress,
    });
    await createNotificationService().send(notification);

    console.log(`✅ Processed user ${user.userId}: ${status} - ${resultMessage}`);
  } catch (error) {
    console.error('❌ Error processing users:', error);
    throw error;
  }
};

async function getLambdaExternalIpAddress(): Promise<string | null> {
  const url = process.env.EXTERNAL_IP_LOOKUP_URL?.trim();
  if (!url) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return null;
    }

    const ipAddress = (await response.text()).trim();
    return isIP(ipAddress) === 0 ? null : ipAddress;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
