export interface User {
  userId: string;
  encryptedEmailAddress: string;
  encryptedPassword: string;
  encryptedTotpKey: string;
  salt: string;
  status: 'active' | 'disabled' | 'locked';
  nextProcessingAfter?: number;
  consecutiveFailures?: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserProcessingLog {
  logId: string;
  userId: string;
  processedAt: string;
  processStatus: 'success' | 'failure' | 'skipped';
  message?: string;
  updatedAt: string;
  dynamoTTL: number;
}
