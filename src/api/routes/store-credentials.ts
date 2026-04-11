import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { UserDAO } from '../../dao/UserDAO.js';
import { encryptData } from '../../crypto/aes-gcm.js';

export const storeCredentials = async (event: APIGatewayProxyEvent, _context: Context): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email_address, password, totp_key } = body;

    if (!email_address || !password || !totp_key) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

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

    // Check for duplicate user
    const userDAO = new UserDAO();
    const userId = await UserDAO.generateUserId(email_address);
    const existingUser = await userDAO.getUser(userId);
    if (existingUser) {
      return {
        statusCode: 409,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'User with this email already exists', user_id: userId }),
      };
    }

    // Store in DynamoDB
    await userDAO.createUser(userId, encryptedEmail.encrypted, encryptedPassword.encrypted, encryptedTotpKey.encrypted, ivBase64);

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
