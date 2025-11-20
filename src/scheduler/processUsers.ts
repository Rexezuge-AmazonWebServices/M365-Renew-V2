import { ScheduledEvent, Context } from 'aws-lambda';
import { UserDAO } from '../dao/UserDAO';
import { ProcessingStateDAO } from '../dao/ProcessingStateDAO';
import { ProcessingLogDAO } from '../dao/ProcessingLogDAO';
import { decryptData } from '../crypto/aes-gcm';
import { M365LoginUtil } from '../utils/M365LoginUtil';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

export const processUsers = async (event: ScheduledEvent, context: Context): Promise<void> => {
  console.log('🔄 Starting user processing...');

  const userDAO = new UserDAO();
  const stateDAO = new ProcessingStateDAO();
  const logDAO = new ProcessingLogDAO();

  try {
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
      const loginSuccess = await M365LoginUtil.login(emailAddress, password, totpKey);

      status = loginSuccess ? 'success' : 'failure';
      resultMessage = loginSuccess ? 'Login successful' : 'Login failed';

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
      'JohnDoe@example.com',
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
