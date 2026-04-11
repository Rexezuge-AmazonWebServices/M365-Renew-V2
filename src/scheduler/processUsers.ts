import { ScheduledEvent, Context } from 'aws-lambda';
import { UserDAO } from '../dao/UserDAO.js';
import { ProcessingStateDAO } from '../dao/ProcessingStateDAO.js';
import { ProcessingLogDAO } from '../dao/ProcessingLogDAO.js';
import { decryptData } from '../crypto/aes-gcm.js';
import { M365LoginUtil } from '../utils/M365LoginUtil.js';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

async function migrateOldSchemaUsers(userDAO: UserDAO, stateDAO: ProcessingStateDAO): Promise<void> {
  const key = process.env.AES_ENCRYPTION_KEY;
  if (!key) return;

  const users = await userDAO.getAllActiveUsers();

  for (const user of users) {
    const email = await decryptData(user.encryptedEmailAddress, key, user.salt);
    const expectedId = await UserDAO.generateUserId(email);

    if (user.userId === expectedId) continue;

    console.log(`🔄 Migrating user ${user.userId} → ${expectedId}`);

    // Create new record with the deterministic ID
    await userDAO.createUser(expectedId, user.encryptedEmailAddress, user.encryptedPassword, user.encryptedTotpKey, user.salt);

    // Migrate processing state
    const oldState = await stateDAO.getState(user.userId);
    if (oldState?.lastProcessedAt && oldState.lastProcessStatus) {
      await stateDAO.upsertState(expectedId, oldState.lastProcessStatus, oldState.lastMessage);
    }

    // Delete old record
    await userDAO.deleteUser(user.userId);

    console.log(`✅ Migrated user ${user.userId} → ${expectedId}`);
  }
}

export const processUsers = async (_event: ScheduledEvent, _context: Context): Promise<void> => {
  console.log('🔄 Starting user processing...');

  const userDAO = new UserDAO();
  const stateDAO = new ProcessingStateDAO();
  const logDAO = new ProcessingLogDAO();

  try {
    // Migrate any old-schema users (random UUID → deterministic hash)
    await migrateOldSchemaUsers(userDAO, stateDAO);

    // Get next user for processing
    const user = await userDAO.getNextUserForProcessing();
    if (!user) {
      console.log('ℹ️ No users to process');
      return;
    }

    console.log('👉 Processing user:', user.userId);

    const key = process.env.AES_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('AES encryption key not configured');
    }

    let status: 'success' | 'failure';
    let resultMessage: string;

    try {
      // Decrypt credentials
      const emailAddress = await decryptData(user.encryptedEmailAddress, key, user.salt);
      const password = await decryptData(user.encryptedPassword, key, user.salt);
      const totpKey = await decryptData(user.encryptedTotpKey, key, user.salt);

      // Attempt login
      const loginResult = await M365LoginUtil.login(emailAddress, password, totpKey);

      status = loginResult.success ? 'success' : 'failure';
      resultMessage = loginResult.success ? 'Login successful' : loginResult.errorMessage || 'Login failed';

      // Update processing state and log
      await stateDAO.upsertState(user.userId, status, resultMessage);
      await logDAO.createLog(user.userId, status, resultMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      status = 'failure';
      resultMessage = errorMessage;

      await stateDAO.upsertState(user.userId, 'failure', errorMessage);
      await logDAO.createLog(user.userId, 'failure', errorMessage);
    }

    // Send notification via SNS
    await sendNotificationMessage(user.userId, status, resultMessage);

    console.log(`✅ Processed user ${user.userId}: ${status} - ${resultMessage}`);
  } catch (error) {
    console.error('❌ Error processing users:', error);
  }
};

async function sendNotificationMessage(userId: string, status: 'success' | 'failure', message: string): Promise<void> {
  const topicArn = process.env.SNS_TOPIC_ARN;
  if (!topicArn) {
    console.log('⚠️ No SNS topic ARN configured');
    return;
  }

  try {
    const snsClient: SNSClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-2' });

    const executionTime: string = new Date().toISOString().replace('T', ' ').replace('Z', ' UTC');
    const result: string = status === 'success' ? 'Completed' : 'Failed';
    const additionalInformation: string = status === 'success' ? 'No irregularities were observed during the execution.' : message;
    const messageBody: string = [
      'Hello Boss Davis,',
      '',
      'This message serves as a formal record of the routine maintenance activity performed today. The operational details are listed below for documentation purposes.',
      '',
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
    ].join('\r\n');
    const subject: string = `${result} - Maintenance Log: M365 Renew Task`;
    const command: PublishCommand = new PublishCommand({
      TopicArn: topicArn,
      Subject: subject,
      Message: messageBody,
    });

    await snsClient.send(command);
    console.log('📧 Notification sent via SNS');
  } catch (error) {
    console.error('❌ Failed to send SNS notification:', error);
  }
}
