export async function encryptData(data: string, keyBase64: string, ivBase64: string): Promise<{ encrypted: string; iv: string }> {
  const key = await crypto.subtle.importKey('raw', Buffer.from(keyBase64, 'base64'), { name: 'AES-GCM' }, false, ['encrypt']);

  const iv = Buffer.from(ivBase64, 'base64');
  const encodedData = new TextEncoder().encode(data);

  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encodedData);

  return {
    encrypted: Buffer.from(encrypted).toString('base64'),
    iv: ivBase64,
  };
}

export async function decryptData(encryptedDataBase64: string, keyBase64: string, ivBase64: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', Buffer.from(keyBase64, 'base64'), { name: 'AES-GCM' }, false, ['decrypt']);

  const iv = Buffer.from(ivBase64, 'base64');
  const encryptedData = Buffer.from(encryptedDataBase64, 'base64');

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encryptedData);

  return new TextDecoder().decode(decrypted);
}
