import { describe, it, expect } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { generateKey } from './generate-key.js';

const mockEvent = {} as APIGatewayProxyEvent;
const mockContext = {} as Context;

describe('generateKey', () => {
  it('should return a 200 response with a base64-encoded key', async () => {
    const result = await generateKey(mockEvent, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.key).toBeDefined();
    expect(typeof body.key).toBe('string');
  });

  it('should return a 256-bit (32-byte) key', async () => {
    const result = await generateKey(mockEvent, mockContext);
    const body = JSON.parse(result.body);

    const keyBytes = Buffer.from(body.key, 'base64');
    expect(keyBytes.length).toBe(32);
  });

  it('should return valid base64', async () => {
    const result = await generateKey(mockEvent, mockContext);
    const body = JSON.parse(result.body);

    expect(body.key).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('should generate unique keys on each call', async () => {
    const result1 = await generateKey(mockEvent, mockContext);
    const result2 = await generateKey(mockEvent, mockContext);

    const key1 = JSON.parse(result1.body).key;
    const key2 = JSON.parse(result2.body).key;

    expect(key1).not.toBe(key2);
  });

  it('should include a message about the environment variable', async () => {
    const result = await generateKey(mockEvent, mockContext);
    const body = JSON.parse(result.body);

    expect(body.message).toContain('AES_ENCRYPTION_KEY');
  });

  it('should set Content-Type to application/json', async () => {
    const result = await generateKey(mockEvent, mockContext);

    expect(result.headers?.['Content-Type']).toBe('application/json');
  });
});
