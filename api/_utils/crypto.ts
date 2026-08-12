import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto'

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const ENCRYPTION_PREFIX = 'enc:aes256gcm:';

function getEncryptionKey(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.USE_MOCK_DB === 'true' && process.env.NODE_ENV !== 'production') {
      return createHash('sha256').update('mock-development-encryption-key').digest();
    }
    throw new Error('API_KEY_ENCRYPTION_SECRET or AUTH_SECRET must be configured');
  }
  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error('Encryption secret must contain at least 32 characters in production');
  }
  return createHash('sha256').update(secret).digest();
}

function encrypt(text: string): string {
  if (!text) return '';
  const iv = randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const key = getEncryptionKey();
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data. The encryption key may have changed or the data is corrupted.');
  }
}

function encryptPreferenceValue(value: string | undefined): string | undefined {
  if (!value || typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (trimmed === 'demo-key' || trimmed.startsWith('test-real-key') || trimmed.startsWith(ENCRYPTION_PREFIX)) {
    return trimmed;
  }
  return `${ENCRYPTION_PREFIX}${encrypt(trimmed)}`;
}

function decryptPreferenceValue(value: string | undefined): string | undefined {
  if (!value || typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed.startsWith(ENCRYPTION_PREFIX)) {
    const cipherText = trimmed.slice(ENCRYPTION_PREFIX.length);
    return decrypt(cipherText);
  }
  return trimmed;
}

export function encryptPreferences(prefs: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!prefs) return null;
  const encrypted = { ...prefs };
  if (typeof encrypted.kilocodeApiKey === 'string') {
    encrypted.kilocodeApiKey = encryptPreferenceValue(encrypted.kilocodeApiKey);
  }
  return encrypted;
}

export function decryptPreferences(prefs: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!prefs) return null;
  const decrypted = { ...prefs };
  if (typeof decrypted.kilocodeApiKey === 'string') {
    decrypted.kilocodeApiKey = decryptPreferenceValue(decrypted.kilocodeApiKey);
  }
  return decrypted;
}

export function sanitizePreferencesForClient(
  prefs: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!prefs) return null;
  const sanitized = { ...prefs };
  const kiloKey = sanitized.kilocodeApiKey;
  delete sanitized.kilocodeApiKey;
  sanitized.kilocodeApiKeyConfigured =
    typeof kiloKey === 'string' && kiloKey.trim().length > 0;
  return sanitized;
}

