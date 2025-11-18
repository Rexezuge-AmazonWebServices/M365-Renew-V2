import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { UserDAO } from '../../dao/UserDAO';
import { decryptData } from '../../crypto/aes-gcm';

export const getCredentials = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract user_id from path: /api/internal/credentials/{user_id}
    const path = event.rawPath || event.path;
    const pathParts = path.split('/');
    const userId = pathParts[pathParts.length - 1];
    
    if (!userId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'User ID required' }),
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

    const userDAO = new UserDAO();
    const user = await userDAO.getUser(userId);
    
    if (!user) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'User not found' }),
      };
    }

    // Decrypt credentials
    const emailAddress = await decryptData(user.encryptedEmailAddress, key, user.salt);
    const password = await decryptData(user.encryptedPassword, key, user.salt);
    const totpKey = await decryptData(user.encryptedTotpKey, key, user.salt);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email_address: emailAddress,
        password: password,
        totp_key: totpKey,
      }),
    };
  } catch (error) {
    console.error('Get credentials error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
