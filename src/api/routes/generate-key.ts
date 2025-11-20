import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { z } from 'zod';

export const generateKey = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  try {
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
