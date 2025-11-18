import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { UserProcessingState } from '../models/User';

export class ProcessingStateDAO {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.client = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = process.env.PROCESSING_STATE_TABLE || 'processing-state';
  }

  async upsertState(
    userId: string,
    status: 'success' | 'failure' | 'skipped',
    message?: string
  ): Promise<void> {
    const now = new Date().toISOString();

    const state: UserProcessingState = {
      userId,
      lastProcessedAt: now,
      lastProcessStatus: status,
      lastMessage: message,
      updatedAt: now,
    };

    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: state,
    }));
  }

  async getState(userId: string): Promise<UserProcessingState | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { userId },
    }));

    return result.Item as UserProcessingState || null;
  }
}
