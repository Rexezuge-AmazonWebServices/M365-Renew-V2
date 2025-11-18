import { ScheduledEvent, Context } from 'aws-lambda';
import { UserDAO } from '../dao/UserDAO';
import { ProcessingStateDAO } from '../dao/ProcessingStateDAO';
import { ProcessingLogDAO } from '../dao/ProcessingLogDAO';
import { decryptData } from '../crypto/aes-gcm';
import { M365LoginUtil } from '../utils/M365LoginUtil';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

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

    // Send notification email
    await sendNotificationEmail(user.userId, status, resultMessage);

    console.log(`✅ Processed user ${user.userId}: ${status} - ${resultMessage}`);

  } catch (error) {
    console.error('❌ Error processing users:', error);
  }
};

async function sendNotificationEmail(userId: string, status: string, message: string): Promise<void> {
  const notificationEmail = process.env.NOTIFICATION_EMAIL;
  if (!notificationEmail) {
    console.log('⚠️ No notification email configured');
    return;
  }

  try {
    const sesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
    
    const command = new SendEmailCommand({
      Source: notificationEmail,
      Destination: {
        ToAddresses: [notificationEmail],
      },
      Message: {
        Subject: {
          Data: `[M365 Renew] ${new Date().toISOString()}: ${status}`,
        },
        Body: {
          Text: {
            Data: `User: ${userId}\nStatus: ${status}\nMessage: ${message}`,
          },
        },
      },
    });

    await sesClient.send(command);
    console.log('📧 Notification email sent');
  } catch (error) {
    console.error('❌ Failed to send notification email:', error);
  }
}
