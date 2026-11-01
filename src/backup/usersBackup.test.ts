import { createDecipheriv } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { createBackupPayload, encryptBackupPayload } from './usersBackup.js';

describe('users backup', () => {
  it('sorts records and encrypts compressed backup content', () => {
    const key = Buffer.alloc(32, 7).toString('base64');
    const payload = createBackupPayload(
      'users',
      [
        { userId: 'b', status: 'active' },
        { userId: 'a', status: 'disabled' },
      ],
      '2026-01-01T00:00:00.000Z',
    );
    const envelope = encryptBackupPayload(payload, key);
    const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'base64'), Buffer.from(envelope.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
    const restored = JSON.parse(
      gunzipSync(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()])).toString(),
    );

    expect(envelope.algorithm).toBe('aes-256-gcm');
    expect(restored.items.map((item: { userId: string }) => item.userId)).toEqual(['a', 'b']);
  });

  it('rejects keys that are not 256 bits', () => {
    expect(() => encryptBackupPayload(Buffer.from('payload'), Buffer.alloc(16).toString('base64'))).toThrow(
      'BACKUP_ENCRYPTION_KEY must be a base64-encoded 256-bit key',
    );
  });
});
