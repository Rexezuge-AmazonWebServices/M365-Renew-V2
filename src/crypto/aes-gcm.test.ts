import { describe, it, expect } from 'vitest';
import { encryptData, decryptData } from './aes-gcm.js';

// Generate a valid AES-256 key (32 bytes) as base64
async function generateTestKey(): Promise<string> {
  const key = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(key).toString('base64');
}

// Generate a valid IV (12 bytes) as base64
function generateTestIv(): string {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return Buffer.from(iv).toString('base64');
}

describe('aes-gcm', () => {
  describe('encryptData / decryptData roundtrip', () => {
    it('should encrypt and decrypt back to the original plaintext', async () => {
      const key = await generateTestKey();
      const iv = generateTestIv();
      const plaintext = 'hello@example.com';

      const { encrypted } = await encryptData(plaintext, key, iv);
      const decrypted = await decryptData(encrypted, key, iv);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty string', async () => {
      const key = await generateTestKey();
      const iv = generateTestIv();

      const { encrypted } = await encryptData('', key, iv);
      const decrypted = await decryptData(encrypted, key, iv);

      expect(decrypted).toBe('');
    });

    it('should handle unicode characters', async () => {
      const key = await generateTestKey();
      const iv = generateTestIv();
      const plaintext = 'pässwörd-日本語-🔑';

      const { encrypted } = await encryptData(plaintext, key, iv);
      const decrypted = await decryptData(encrypted, key, iv);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', async () => {
      const key = await generateTestKey();
      const iv = generateTestIv();
      const plaintext = 'a'.repeat(10000);

      const { encrypted } = await encryptData(plaintext, key, iv);
      const decrypted = await decryptData(encrypted, key, iv);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('encryptData', () => {
    it('should return base64-encoded ciphertext', async () => {
      const key = await generateTestKey();
      const iv = generateTestIv();

      const { encrypted } = await encryptData('test', key, iv);

      // Should be valid base64
      expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
      expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('should return the same IV that was passed in', async () => {
      const key = await generateTestKey();
      const iv = generateTestIv();

      const result = await encryptData('test', key, iv);

      expect(result.iv).toBe(iv);
    });

    it('should produce different ciphertext for different plaintexts', async () => {
      const key = await generateTestKey();
      const iv = generateTestIv();

      const { encrypted: e1 } = await encryptData('plaintext-one', key, iv);
      const { encrypted: e2 } = await encryptData('plaintext-two', key, iv);

      expect(e1).not.toBe(e2);
    });

    it('should produce different ciphertext with different keys', async () => {
      const key1 = await generateTestKey();
      const key2 = await generateTestKey();
      const iv = generateTestIv();

      const { encrypted: e1 } = await encryptData('same-plaintext', key1, iv);
      const { encrypted: e2 } = await encryptData('same-plaintext', key2, iv);

      expect(e1).not.toBe(e2);
    });
  });

  describe('decryptData', () => {
    it('should fail to decrypt with the wrong key', async () => {
      const key1 = await generateTestKey();
      const key2 = await generateTestKey();
      const iv = generateTestIv();

      const { encrypted } = await encryptData('secret', key1, iv);

      await expect(decryptData(encrypted, key2, iv)).rejects.toThrow();
    });

    it('should fail to decrypt with the wrong IV', async () => {
      const key = await generateTestKey();
      const iv1 = generateTestIv();
      const iv2 = generateTestIv();

      const { encrypted } = await encryptData('secret', key, iv1);

      await expect(decryptData(encrypted, key, iv2)).rejects.toThrow();
    });

    it('should fail to decrypt corrupted ciphertext', async () => {
      const key = await generateTestKey();
      const iv = generateTestIv();

      const { encrypted } = await encryptData('secret', key, iv);
      const corrupted = Buffer.from(encrypted, 'base64');
      corrupted[0] ^= 0xff;
      const corruptedBase64 = corrupted.toString('base64');

      await expect(decryptData(corruptedBase64, key, iv)).rejects.toThrow();
    });
  });
});
