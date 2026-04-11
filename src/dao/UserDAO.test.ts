import { describe, it, expect } from 'vitest';
import { UserDAO } from './UserDAO.js';

describe('UserDAO.generateUserId', () => {
  it('should return a deterministic ID for the same email', async () => {
    const id1 = await UserDAO.generateUserId('test@example.com');
    const id2 = await UserDAO.generateUserId('test@example.com');

    expect(id1).toBe(id2);
  });

  it('should normalize email to lowercase', async () => {
    const lower = await UserDAO.generateUserId('test@example.com');
    const upper = await UserDAO.generateUserId('TEST@EXAMPLE.COM');
    const mixed = await UserDAO.generateUserId('Test@Example.Com');

    expect(lower).toBe(upper);
    expect(lower).toBe(mixed);
  });

  it('should trim whitespace from email', async () => {
    const normal = await UserDAO.generateUserId('test@example.com');
    const padded = await UserDAO.generateUserId('  test@example.com  ');
    const tabbed = await UserDAO.generateUserId('\ttest@example.com\t');

    expect(normal).toBe(padded);
    expect(normal).toBe(tabbed);
  });

  it('should produce different IDs for different emails', async () => {
    const id1 = await UserDAO.generateUserId('alice@example.com');
    const id2 = await UserDAO.generateUserId('bob@example.com');

    expect(id1).not.toBe(id2);
  });

  it('should return a UUID-like formatted string (8-4-4-4-12)', async () => {
    const id = await UserDAO.generateUserId('test@example.com');

    // Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('should use all lowercase hex characters', async () => {
    const id = await UserDAO.generateUserId('test@example.com');
    const hexPart = id.replace(/-/g, '');

    expect(hexPart).toMatch(/^[0-9a-f]+$/);
  });

  it('should produce a 36-character string (32 hex + 4 dashes)', async () => {
    const id = await UserDAO.generateUserId('any@email.com');

    expect(id.length).toBe(36);
  });
});
