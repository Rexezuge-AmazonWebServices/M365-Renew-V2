import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { UserProcessingLog } from '@/models/User';

export class ProcessingLogDAO {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.client = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = process.env.PROCESSING_LOG_TABLE || 'processing-log';
  }

  async createLog(userId: string, status: 'success' | 'failure' | 'skipped', message?: string): Promise<void> {
    const { v4: uuidv4 } = await import('uuid');
    const now = new Date().toISOString();
    const fiveYearsFromNow = Math.floor(Date.now() / 1000) + 5 * 365 * 24 * 60 * 60;

    const log: UserProcessingLog = {
      logId: uuidv4(),
      userId,
      processedAt: now,
      processStatus: status,
      message,
      updatedAt: now,
      dynamoTTL: fiveYearsFromNow,
    };

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: log,
      }),
    );
  }
}
