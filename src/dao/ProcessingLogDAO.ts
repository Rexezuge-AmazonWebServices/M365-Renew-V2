import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { UserProcessingLog } from '../models/User';
import { v4 as uuidv4 } from 'uuid';

export class ProcessingLogDAO {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.client = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = process.env.PROCESSING_LOG_TABLE || 'processing-log';
  }

  async createLog(
    userId: string,
    status: 'success' | 'failure' | 'skipped',
    message?: string
  ): Promise<void> {
    const now = new Date().toISOString();

    const log: UserProcessingLog = {
      logId: uuidv4(),
      userId,
      processedAt: now,
      processStatus: status,
      message,
      updatedAt: now,
    };

    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: log,
    }));
  }
}
