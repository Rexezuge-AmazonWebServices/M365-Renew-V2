import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { z } from 'zod';

const GenerateKeySchema = z.object({
  admin_key: z.string(),
});

export const generateKey = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { admin_key } = GenerateKeySchema.parse(body);

    // Validate admin key (you should set this as an environment variable)
    const expectedAdminKey = process.env.ADMIN_KEY;
    if (!expectedAdminKey || admin_key !== expectedAdminKey) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    // Generate a new AES key
    const key = crypto.getRandomValues(new Uint8Array(32));
    const keyBase64 = Buffer.from(key).toString('base64');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        key: keyBase64,
        message: 'Set this as your AES_ENCRYPTION_KEY environment variable',
      }),
    };
  } catch (error) {
    console.error('Generate key error:', error);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid request' }),
    };
  }
};
