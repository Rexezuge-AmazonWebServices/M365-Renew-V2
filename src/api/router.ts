import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { generateKey } from './routes/generate-key';
import { storeCredentials } from './routes/store-credentials';
import { getCredentials } from './routes/get-credentials';
import { login } from './routes/login';
import { swaggerSpec } from './swagger';

export const router = async (
  event: any,
  context: Context
): Promise<APIGatewayProxyResult> => {
  // Lambda Function URL uses different event structure than API Gateway
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;
  const path = event.rawPath || event.path;
  console.log('Request:', { httpMethod, path });
  
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
      const swaggerUiHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>M365 Renew API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/docs/swagger.json',
      dom_id: '#swagger-ui',
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.presets.standalone
      ]
    });
  </script>
</body>
</html>`;
      result = {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html', ...corsHeaders },
        body: swaggerUiHtml
      };
    } else if (httpMethod === 'GET' && path === '/docs/swagger.json') {
      result = {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify(swaggerSpec)
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
