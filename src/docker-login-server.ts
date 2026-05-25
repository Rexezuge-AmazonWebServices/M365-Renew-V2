import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { login } from './api/routes/login.js';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

const port = Number(process.env.PORT || 3000);
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

const readBody = async (request: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  let byteLength = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    byteLength += buffer.byteLength;

    if (byteLength > 1024 * 1024) {
      throw new Error('Request body exceeds 1 MiB limit');
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString('utf8');
};

const writeJson = (response: ServerResponse, statusCode: number, body: unknown): void => {
  response.writeHead(statusCode, { 'Content-Type': 'application/json', ...corsHeaders });
  response.end(JSON.stringify(body));
};

const handleRequest = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'OPTIONS' && url.pathname === '/api/auth/login') {
    response.writeHead(204, corsHeaders);
    response.end();
    return;
  }

  if (request.method !== 'POST' || url.pathname !== '/api/auth/login') {
    writeJson(response, 404, { error: 'Not Found' });
    return;
  }

  try {
    const body = await readBody(request);
    const event = {
      body,
      headers: request.headers,
      httpMethod: request.method,
      path: url.pathname,
      rawPath: url.pathname,
    } as unknown as APIGatewayProxyEvent;

    const result = await login(event, {} as Context);
    const headers = { ...result.headers, ...corsHeaders };

    for (const [key, value] of Object.entries(headers)) {
      if (value !== undefined) {
        response.setHeader(key, String(value));
      }
    }

    response.statusCode = result.statusCode;
    response.end(result.body || '');
  } catch (error) {
    console.error('Docker login server error:', error);
    writeJson(response, 500, { error: error instanceof Error ? error.message : 'Internal Server Error' });
  }
};

http.createServer((request, response) => {
  void handleRequest(request, response);
}).listen(port, '0.0.0.0', () => {
  console.log(`M365 login server listening on port ${port}`);
});
