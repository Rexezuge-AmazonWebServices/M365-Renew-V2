import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { z } from 'zod';
import { M365LoginUtil } from '../../utils/M365LoginUtil';

const LoginSchema = z.object({
  email_address: z.string().email(),
  password: z.string(),
  totp_key: z.string(),
});

export const login = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email_address, password, totp_key } = LoginSchema.parse(body);

    const success = await M365LoginUtil.login(email_address, password, totp_key);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success,
        message: success ? 'Login successful' : 'Login failed',
      }),
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
