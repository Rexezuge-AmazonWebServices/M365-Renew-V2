import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

const mockGetUser = vi.fn().mockResolvedValue(null);

// Mock UserDAO to avoid DynamoDB calls — must use class for `new UserDAO()`
vi.mock('../../dao/UserDAO.js', () => ({
  UserDAO: class MockUserDAO {
    getUser = mockGetUser;
  },
}));

import { getCredentials } from './get-credentials.js';

const mockContext = {} as Context;

function makeEvent(path: string, overrides?: Record<string, unknown>): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path,
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '',
    requestContext: {} as APIGatewayProxyEvent['requestContext'],
    ...overrides,
  } as APIGatewayProxyEvent;
}

describe('getCredentials', () => {
  beforeEach(() => {
    vi.stubEnv('AES_ENCRYPTION_KEY', Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'));
    mockGetUser.mockResolvedValue(null);
  });

  describe('path parsing', () => {
    it('should extract userId from API Gateway path', async () => {
      const event = makeEvent('/api/internal/credentials/abc-123');
      const result = await getCredentials(event, mockContext);

      // Should attempt to look up the user (gets 404 since mock returns null)
      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body).error).toBe('User not found');
    });

    it('should extract userId from Lambda Function URL rawPath', async () => {
      const event = makeEvent('', { rawPath: '/api/internal/credentials/abc-123' });
      const result = await getCredentials(event, mockContext);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body).error).toBe('User not found');
    });

    it('should prefer rawPath over path when both are present', async () => {
      const event = makeEvent('/wrong/path', { rawPath: '/api/internal/credentials/correct-id' });
      const result = await getCredentials(event, mockContext);

      // Should reach the user lookup (404), not fail on path parsing
      expect(result.statusCode).toBe(404);
    });
  });

  describe('AES key configuration', () => {
    it('should return 500 when AES_ENCRYPTION_KEY is not set', async () => {
      vi.stubEnv('AES_ENCRYPTION_KEY', '');
      const event = makeEvent('/api/internal/credentials/abc-123');
      const result = await getCredentials(event, mockContext);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).error).toBe('AES key not configured');
    });
  });
});
