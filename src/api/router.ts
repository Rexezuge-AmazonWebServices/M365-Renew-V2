import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { generateKey } from './routes/generate-key';
import { storeCredentials } from './routes/store-credentials';
import { getCredentials } from './routes/get-credentials';
import { login } from './routes/login';

export const router = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const { httpMethod, path } = event;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  };

  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    let result: APIGatewayProxyResult;

    if (httpMethod === 'POST' && path === '/api/admin/generate-key') {
      result = await generateKey(event, context);
    } else if (httpMethod === 'POST' && path === '/api/credentials/store') {
      result = await storeCredentials(event, context);
    } else if (httpMethod === 'GET' && path.match(/^\/api\/internal\/credentials\/[^\/]+$/)) {
      result = await getCredentials(event, context);
    } else if (httpMethod === 'POST' && path === '/api/auth/login') {
      result = await login(event, context);
    } else if (httpMethod === 'GET' && path === '/docs') {
      result = {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({
          openapi: '3.0.0',
          info: { title: 'M365 Renew API', version: '1.0.0' },
          paths: {
            '/api/admin/generate-key': {
              post: {
                tags: ['Admin'],
                summary: 'Generate encryption key',
                responses: { '200': { description: 'Key generated' } }
              }
            },
            '/api/credentials/store': {
              post: {
                tags: ['Credentials'],
                summary: 'Store user credentials',
                requestBody: {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          email_address: { type: 'string', format: 'email' },
                          password: { type: 'string' },
                          totp_key: { type: 'string' }
                        },
                        required: ['email_address', 'password', 'totp_key']
                      }
                    }
                  }
                },
                responses: { '200': { description: 'Credentials stored' } }
              }
            },
            '/api/auth/login': {
              post: {
                tags: ['Authentication'],
                summary: 'M365 Login',
                responses: { '200': { description: 'Login result' } }
              }
            }
          }
        })
      };
    } else {
      result = {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Not Found' }),
      };
    }

    return {
      ...result,
      headers: { ...result.headers, ...corsHeaders },
    };
  } catch (error) {
    console.error('Router error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
