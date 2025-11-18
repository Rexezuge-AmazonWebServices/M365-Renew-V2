export interface User {
  userId: string;
  encryptedEmailAddress: string;
  encryptedPassword: string;
  encryptedTotpKey: string;
  salt: string;
  status: 'active' | 'disabled' | 'locked';
  createdAt: string;
  updatedAt: string;
}

export interface UserProcessingState {
  userId: string;
  lastProcessedAt?: string;
  lastProcessStatus?: 'success' | 'failure' | 'skipped';
  lastMessage?: string;
  updatedAt: string;
}

export interface UserProcessingLog {
  logId: string;
  userId: string;
  processedAt: string;
  processStatus: 'success' | 'failure' | 'skipped';
  message?: string;
  updatedAt: string;
}
