import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { User } from '../models/User.js';

export class UserDAO {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1', maxAttempts: 8 });
    this.client = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = process.env.USERS_TABLE || 'users';
  }

  static async generateUserId(email: string): Promise<string> {
    const normalized = email.toLowerCase().trim();
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
    const hex = Buffer.from(hash).toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

  async createUser(
    userId: string,
    encryptedEmail: string,
    encryptedPassword: string,
    encryptedTotpKey: string,
    salt: string,
  ): Promise<string> {
    const now = new Date().toISOString();

    const user: User = {
      userId,
      encryptedEmailAddress: encryptedEmail,
      encryptedPassword,
      encryptedTotpKey,
      salt,
      status: 'active',
      nextProcessingAfter: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: user,
      }),
    );

    return userId;
  }

  async getUser(userId: string): Promise<User | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { userId },
      }),
    );

    return (result.Item as User) || null;
  }

  async getNextUserForProcessing(): Promise<User | null> {
    const nowEpoch = Math.floor(Date.now() / 1000);

    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'StatusNextProcessingIndex',
        KeyConditionExpression: '#status = :status AND #nextProcessingAfter <= :now',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#nextProcessingAfter': 'nextProcessingAfter',
        },
        ExpressionAttributeValues: {
          ':status': 'active',
          ':now': nowEpoch,
        },
        ScanIndexForward: true,
        Limit: 1,
      }),
    );

    const users = (result.Items as User[]) || [];
    return users.length > 0 ? users[0] : null;
  }

  async updateNextProcessingAfter(userId: string, nextProcessingAfter: number): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression: 'SET #nextProcessingAfter = :nextProcessingAfter, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#nextProcessingAfter': 'nextProcessingAfter',
        },
        ExpressionAttributeValues: {
          ':nextProcessingAfter': nextProcessingAfter,
          ':updatedAt': new Date().toISOString(),
        },
      }),
    );
  }

  async getAllActiveUsers(): Promise<User[]> {
    const result = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'active',
        },
      }),
    );

    return (result.Items as User[]) || [];
  }

  async deleteUser(userId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { userId },
      }),
    );
  }

  async updateUserStatus(userId: string, status: 'active' | 'disabled' | 'locked'): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': status,
          ':updatedAt': new Date().toISOString(),
        },
      }),
    );
  }
}
