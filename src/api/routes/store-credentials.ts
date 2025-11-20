import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { z } from 'zod';
import { UserDAO } from '../../dao/UserDAO';
import { encryptData } from '../../crypto/aes-gcm';

const StoreCredentialsSchema = z.object({
  email_address: z.string().email(),
  password: z.string(),
  totp_key: z.string(),
});

export const storeCredentials = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email_address, password, totp_key } = StoreCredentialsSchema.parse(body);

    const key = process.env.AES_ENCRYPTION_KEY;
    if (!key) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'AES key not configured' }),
      };
    }

    // Generate IV for encryption
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ivBase64 = Buffer.from(iv).toString('base64');

    // Encrypt credentials
    const encryptedEmail = await encryptData(email_address, key, ivBase64);
    const encryptedPassword = await encryptData(password, key, ivBase64);
    const encryptedTotpKey = await encryptData(totp_key, key, ivBase64);

    // Store in DynamoDB
    const userDAO = new UserDAO();
    const userId = await userDAO.createUser(encryptedEmail.encrypted, encryptedPassword.encrypted, encryptedTotpKey.encrypted, ivBase64);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        user_id: userId,
      }),
    };
  } catch (error) {
    console.error('Store credentials error:', error);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid request' }),
    };
  }
};
