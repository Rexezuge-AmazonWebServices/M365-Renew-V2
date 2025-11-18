import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { User } from '../models/User';
import { v4 as uuidv4 } from 'uuid';

export class UserDAO {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.client = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = process.env.USERS_TABLE || 'users';
  }

  async createUser(
    encryptedEmail: string,
    encryptedPassword: string,
    encryptedTotpKey: string,
    salt: string
  ): Promise<string> {
    const userId = uuidv4();
    const now = new Date().toISOString();

    const user: User = {
      userId,
      encryptedEmailAddress: encryptedEmail,
      encryptedPassword,
      encryptedTotpKey,
      salt,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: user,
    }));

    return userId;
  }

  async getUser(userId: string): Promise<User | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { userId },
    }));

    return result.Item as User || null;
  }

  async getNextUserForProcessing(): Promise<User | null> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'StatusIndex',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'active',
      },
      Limit: 1,
    }));

    return result.Items?.[0] as User || null;
  }

  async updateUserStatus(userId: string, status: 'active' | 'disabled' | 'locked'): Promise<void> {
    await this.client.send(new UpdateCommand({
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
    }));
  }
}
