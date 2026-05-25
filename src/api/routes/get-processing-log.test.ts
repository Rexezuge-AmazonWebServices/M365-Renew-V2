import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

const mockGetLog = vi.fn().mockResolvedValue(null);

vi.mock('../../dao/ProcessingLogDAO.js', () => ({
  ProcessingLogDAO: class MockProcessingLogDAO {
    getLog = mockGetLog;
  },
}));

import { getProcessingLog } from './get-processing-log.js';

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

describe('getProcessingLog', () => {
  beforeEach(() => {
    mockGetLog.mockReset();
    mockGetLog.mockResolvedValue(null);
  });

  describe('path parsing', () => {
    it('should extract logId from API Gateway path', async () => {
      const event = makeEvent('/api/internal/processing-logs/log-123');
      const result = await getProcessingLog(event, mockContext);

      expect(mockGetLog).toHaveBeenCalledWith('log-123');
      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body).error).toBe('Log not found');
    });

    it('should extract logId from Lambda Function URL rawPath', async () => {
      const event = makeEvent('', { rawPath: '/api/internal/processing-logs/raw-log-123' });
      const result = await getProcessingLog(event, mockContext);

      expect(mockGetLog).toHaveBeenCalledWith('raw-log-123');
      expect(result.statusCode).toBe(404);
    });

    it('should prefer rawPath over path when both are present', async () => {
      const event = makeEvent('/api/internal/processing-logs/wrong-log', { rawPath: '/api/internal/processing-logs/correct-log' });
      const result = await getProcessingLog(event, mockContext);

      expect(mockGetLog).toHaveBeenCalledWith('correct-log');
      expect(result.statusCode).toBe(404);
    });
  });

  describe('rendering', () => {
    it('should render log details and error image when screenshot is present', async () => {
      mockGetLog.mockResolvedValue({
        logId: 'log-123',
        userId: 'user-123',
        processedAt: '2026-05-25T12:00:00.000Z',
        processStatus: 'failure',
        message: 'Login failed <invalid>',
        screenshotBase64: 'aW1hZ2U=',
        updatedAt: '2026-05-25T12:00:00.000Z',
        dynamoTTL: 1937476800,
      });

      const event = makeEvent('/api/internal/processing-logs/log-123');
      const result = await getProcessingLog(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Content-Type']).toBe('text/html');
      expect(result.body).toContain('Processing Log Detail');
      expect(result.body).toContain('log-123');
      expect(result.body).toContain('user-123');
      expect(result.body).toContain('failure');
      expect(result.body).toContain('Login failed &lt;invalid&gt;');
      expect(result.body).toContain('src="data:image/png;base64,aW1hZ2U="');
    });

    it('should render a no-image message when screenshot is absent', async () => {
      mockGetLog.mockResolvedValue({
        logId: 'log-456',
        userId: 'user-456',
        processedAt: '2026-05-25T12:00:00.000Z',
        processStatus: 'success',
        message: 'Login successful',
        updatedAt: '2026-05-25T12:00:00.000Z',
        dynamoTTL: 1937476800,
      });

      const event = makeEvent('/api/internal/processing-logs/log-456');
      const result = await getProcessingLog(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.body).toContain('No error image available.');
      expect(result.body).not.toContain('data:image/png;base64');
    });
  });
});
