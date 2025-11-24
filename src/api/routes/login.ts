import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { M365LoginUtil } from '../../utils/M365LoginUtil';

export const login = async (event: APIGatewayProxyEvent, _context: Context): Promise<APIGatewayProxyResult> => {
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

    const result = await M365LoginUtil.login(email_address, password, totp_key);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: result.success,
        message: result.success ? 'Login successful' : result.errorMessage || 'Login failed',
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
