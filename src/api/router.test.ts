import { describe, it, expect, vi } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Mock all route handlers so the router tests only exercise routing logic
vi.mock('./routes/generate-key.js', () => ({
  generateKey: vi.fn().mockResolvedValue({ statusCode: 200, headers: {}, body: '{"mock":"generate-key"}' }),
}));
vi.mock('./routes/store-credentials.js', () => ({
  storeCredentials: vi.fn().mockResolvedValue({ statusCode: 200, headers: {}, body: '{"mock":"store-credentials"}' }),
}));
vi.mock('./routes/get-credentials.js', () => ({
  getCredentials: vi.fn().mockResolvedValue({ statusCode: 200, headers: {}, body: '{"mock":"get-credentials"}' }),
}));
vi.mock('./routes/login.js', () => ({
  login: vi.fn().mockResolvedValue({ statusCode: 200, headers: {}, body: '{"mock":"login"}' }),
}));
vi.mock('./swagger.js', () => ({
  swaggerSpec: { openapi: '3.0.0', info: { title: 'test', version: '1.0' }, paths: {} },
}));

import { router } from './router.js';

function makeEvent(overrides: Partial<APIGatewayProxyEvent> & Record<string, unknown>): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/',
    body: null,
    headers: {},
    multiValueHeaders: {},
    isBase64Encoded: false,
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '',
    requestContext: {} as APIGatewayProxyEvent['requestContext'],
    ...overrides,
  } as APIGatewayProxyEvent;
}

const mockContext = {} as Context;

describe('router', () => {
  describe('CORS', () => {
    it('should return 200 with CORS headers for OPTIONS requests', async () => {
      const event = makeEvent({ httpMethod: 'OPTIONS', path: '/any-path' });
      const result = await router(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers?.['Access-Control-Allow-Methods']).toContain('GET');
      expect(result.headers?.['Access-Control-Allow-Methods']).toContain('POST');
    });

    it('should include CORS headers on all responses', async () => {
      const event = makeEvent({ httpMethod: 'GET', path: '/nonexistent' });
      const result = await router(event, mockContext);

      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('route matching', () => {
    it('should route POST /api/admin/generate-key to generateKey', async () => {
      const event = makeEvent({ httpMethod: 'POST', path: '/api/admin/generate-key' });
      const result = await router(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).mock).toBe('generate-key');
    });

    it('should route POST /api/credentials/store to storeCredentials', async () => {
      const event = makeEvent({ httpMethod: 'POST', path: '/api/credentials/store' });
      const result = await router(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).mock).toBe('store-credentials');
    });

    it('should route GET /api/internal/credentials/{userId} to getCredentials', async () => {
      const event = makeEvent({ httpMethod: 'GET', path: '/api/internal/credentials/abc-123' });
      const result = await router(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).mock).toBe('get-credentials');
    });

    it('should route POST /api/auth/login to login', async () => {
      const event = makeEvent({ httpMethod: 'POST', path: '/api/auth/login' });
      const result = await router(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).mock).toBe('login');
    });

    it('should serve Swagger UI HTML at GET /docs', async () => {
      const event = makeEvent({ httpMethod: 'GET', path: '/docs' });
      const result = await router(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Content-Type']).toBe('text/html');
      expect(result.body).toContain('swagger-ui');
    });

    it('should serve Swagger JSON at GET /docs/swagger.json', async () => {
      const event = makeEvent({ httpMethod: 'GET', path: '/docs/swagger.json' });
      const result = await router(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Content-Type']).toBe('application/json');
      const body = JSON.parse(result.body);
      expect(body.openapi).toBe('3.0.0');
    });

    it('should return 404 for unknown routes', async () => {
      const event = makeEvent({ httpMethod: 'GET', path: '/unknown' });
      const result = await router(event, mockContext);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body).error).toBe('Not Found');
    });

    it('should return 404 for wrong HTTP method on valid path', async () => {
      const event = makeEvent({ httpMethod: 'GET', path: '/api/admin/generate-key' });
      const result = await router(event, mockContext);

      expect(result.statusCode).toBe(404);
    });
  });

  describe('Lambda Function URL event format', () => {
    it('should extract method and path from Lambda Function URL event structure', async () => {
      const event = makeEvent({
        httpMethod: '', // empty in Function URL
        path: '', // empty in Function URL
        rawPath: '/api/admin/generate-key',
        requestContext: {
          http: { method: 'POST' },
        } as unknown as APIGatewayProxyEvent['requestContext'],
      });
      const result = await router(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).mock).toBe('generate-key');
    });
  });

  describe('credentials path matching', () => {
    it('should match credentials path with UUID-like userId', async () => {
      const event = makeEvent({
        httpMethod: 'GET',
        path: '/api/internal/credentials/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      });
      const result = await router(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).mock).toBe('get-credentials');
    });

    it('should NOT match credentials path with trailing slash', async () => {
      const event = makeEvent({
        httpMethod: 'GET',
        path: '/api/internal/credentials/abc-123/',
      });
      const result = await router(event, mockContext);

      // The regex requires no trailing slash
      expect(result.statusCode).toBe(404);
    });

    it('should NOT match credentials path without userId', async () => {
      const event = makeEvent({
        httpMethod: 'GET',
        path: '/api/internal/credentials/',
      });
      const result = await router(event, mockContext);

      expect(result.statusCode).toBe(404);
    });
  });
});
