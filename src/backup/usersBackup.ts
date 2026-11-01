import { createCipheriv, randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

export interface UsersBackupEnvelope {
  format: 'm365-renew-v2-users-backup';
  version: 1;
  algorithm: 'aes-256-gcm';
  compression: 'gzip';
  iv: string;
  authTag: string;
  ciphertext: string;
}

export function createBackupPayload(tableName: string, items: Record<string, unknown>[], exportedAt = new Date().toISOString()): Buffer {
  const sortedItems = [...items].sort((left, right) => String(left.userId).localeCompare(String(right.userId)));
  return gzipSync(
    JSON.stringify({
      format: 'm365-renew-v2-users',
      version: 1,
      tableName,
      exportedAt,
      items: sortedItems,
    }),
  );
}

export function encryptBackupPayload(payload: Buffer, keyBase64: string): UsersBackupEnvelope {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error('BACKUP_ENCRYPTION_KEY must be a base64-encoded 256-bit key');
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);

  return {
    format: 'm365-renew-v2-users-backup',
    version: 1,
    algorithm: 'aes-256-gcm',
    compression: 'gzip',
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

async function scanUsersTable(client: DynamoDBDocumentClient, tableName: string): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const result = await client.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );
    items.push(...((result.Items as Record<string, unknown>[] | undefined) ?? []));
    exclusiveStartKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);

  return items;
}

export async function writeUsersBackup(
  tableName: string,
  keyBase64: string,
  outputFile: string,
  region = process.env.AWS_REGION || 'us-east-2',
): Promise<number> {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region, maxAttempts: 8 }));
  const items = await scanUsersTable(client, tableName);
  const payload = createBackupPayload(tableName, items);
  const envelope = encryptBackupPayload(payload, keyBase64);
  await writeFile(outputFile, JSON.stringify(envelope));
  return items.length;
}

async function main(): Promise<void> {
  const tableName = process.env.USERS_TABLE;
  const key = process.env.BACKUP_ENCRYPTION_KEY;
  const outputFile = process.env.BACKUP_OUTPUT_FILE;

  if (!tableName) {
    throw new Error('USERS_TABLE is required');
  }
  if (!key) {
    throw new Error('BACKUP_ENCRYPTION_KEY is required');
  }
  if (!outputFile) {
    throw new Error('BACKUP_OUTPUT_FILE is required');
  }

  const itemCount = await writeUsersBackup(tableName, key, outputFile);
  console.log(`Encrypted ${itemCount} user records to ${outputFile}`);
}

if (process.argv[1]?.endsWith('usersBackup.js')) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
