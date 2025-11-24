import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { User } from '@/models/User';

export class UserDAO {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.client = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = process.env.USERS_TABLE || 'users';
  }

  async createUser(encryptedEmail: string, encryptedPassword: string, encryptedTotpKey: string, salt: string): Promise<string> {
    const uuid = await import('uuid');
    const uuidv4 = uuid.v4;
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
    // Get all active users
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

    const activeUsers = (result.Items as User[]) || [];
    if (activeUsers.length === 0) {
      return null;
    }

    // Get processing states for all users
    const processingStateDAO = new (await import('./ProcessingStateDAO')).ProcessingStateDAO();
    const userStates = await Promise.all(
      activeUsers.map(async (user) => ({
        user,
        state: await processingStateDAO.getState(user.userId),
      })),
    );

    // Filter users based on processing criteria
    const now = new Date();
    const minIntervalHours = parseInt(process.env.MIN_PROCESSING_INTERVAL_HOURS || '25');

    const eligibleUsers = userStates.filter(({ user: _user, state }) => {
      // If never processed, user is eligible
      if (!state?.lastProcessedAt) {
        return true;
      }

      // Check if enough time has passed since last processing
      const lastProcessed = new Date(state.lastProcessedAt);
      const hoursSinceLastProcessing = (now.getTime() - lastProcessed.getTime()) / (1000 * 60 * 60);

      return hoursSinceLastProcessing >= minIntervalHours;
    });

    if (eligibleUsers.length === 0) {
      return null;
    }

    // Sort by priority: never processed first, then by oldest last processed
    eligibleUsers.sort((a, b) => {
      // Never processed users get highest priority
      if (!a.state?.lastProcessedAt && b.state?.lastProcessedAt) return -1;
      if (a.state?.lastProcessedAt && !b.state?.lastProcessedAt) return 1;

      // If both have been processed, prioritize oldest
      if (a.state?.lastProcessedAt && b.state?.lastProcessedAt) {
        return new Date(a.state.lastProcessedAt).getTime() - new Date(b.state.lastProcessedAt).getTime();
      }

      // If neither processed, sort by creation date (oldest first)
      return new Date(a.user.createdAt).getTime() - new Date(b.user.createdAt).getTime();
    });

    return eligibleUsers[0].user;
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
