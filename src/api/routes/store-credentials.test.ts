import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

const mockGetUser = vi.fn().mockResolvedValue(null);
const mockCreateUser = vi.fn().mockResolvedValue('mock-user-id');

// Mock UserDAO to avoid DynamoDB calls — must use class for `new UserDAO()`
vi.mock('../../dao/UserDAO.js', () => ({
  UserDAO: class MockUserDAO {
    static generateUserId = vi.fn().mockResolvedValue('mock-user-id');
    getUser = mockGetUser;
    createUser = mockCreateUser;
  },
}));

import { storeCredentials } from './store-credentials.js';

const mockContext = {} as Context;

function makeEvent(body: Record<string, unknown> | null): APIGatewayProxyEvent {
  return {
    body: body ? JSON.stringify(body) : null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/api/credentials/store',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '',
    requestContext: {} as APIGatewayProxyEvent['requestContext'],
  };
}

describe('storeCredentials', () => {
  beforeEach(() => {
    vi.stubEnv('AES_ENCRYPTION_KEY', Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'));
    mockGetUser.mockResolvedValue(null);
  });

  describe('validation', () => {
    it('should return 400 when body is empty', async () => {
      const event = makeEvent(null);
      const result = await storeCredentials(event, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toBe('Missing required fields');
    });

    it('should return 400 when email_address is missing', async () => {
      const event = makeEvent({ password: 'pass', totp_key: 'key' });
      const result = await storeCredentials(event, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toBe('Missing required fields');
    });

    it('should return 400 when password is missing', async () => {
      const event = makeEvent({ email_address: 'test@example.com', totp_key: 'key' });
      const result = await storeCredentials(event, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toBe('Missing required fields');
    });

    it('should return 400 when totp_key is missing', async () => {
      const event = makeEvent({ email_address: 'test@example.com', password: 'pass' });
      const result = await storeCredentials(event, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toBe('Missing required fields');
    });
  });

  describe('AES key configuration', () => {
    it('should return 500 when AES_ENCRYPTION_KEY is not set', async () => {
      vi.stubEnv('AES_ENCRYPTION_KEY', '');
      const event = makeEvent({ email_address: 'test@example.com', password: 'pass', totp_key: 'key' });
      const result = await storeCredentials(event, mockContext);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).error).toBe('AES key not configured');
    });
  });

  describe('duplicate detection', () => {
    it('should return 409 when user already exists', async () => {
      mockGetUser.mockResolvedValue({ userId: 'mock-user-id' });

      const event = makeEvent({ email_address: 'test@example.com', password: 'pass', totp_key: 'key' });
      const result = await storeCredentials(event, mockContext);

      expect(result.statusCode).toBe(409);
      expect(JSON.parse(result.body).error).toContain('already exists');
    });
  });

  describe('success', () => {
    it('should return 200 with user_id on success', async () => {
      const event = makeEvent({ email_address: 'test@example.com', password: 'pass', totp_key: 'key' });
      const result = await storeCredentials(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.user_id).toBeDefined();
    });
  });
});
