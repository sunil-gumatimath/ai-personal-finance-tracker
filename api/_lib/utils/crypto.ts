import { webcrypto, createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto'

const subtle = webcrypto.subtle
const encoder = new TextEncoder()

/**
 * Deterministic mock hash for development mode.
 * Uses SHA-256 so passwords are NEVER stored in plaintext,
 * even when running without a database.
 */
function mockHash(password: string): string {
  return createHash('sha256').update(`mock_dev_salt_v1_${password}`).digest('hex')
}

export async function hashPassword(password: string): Promise<string> {
  // Check if we're in mock mode (no database URL)
  if (!process.env.NEON_DATABASE_URL) {
    return `mock_hash_${mockHash(password)}`
  }

  const salt = webcrypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  )

  const derivedBits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  )

  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  const hashHex = Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return `$pbkdf2$100000$${saltHex}$${hashHex}`
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // Check if we're in mock mode
  if (!process.env.NEON_DATABASE_URL) {
    return storedHash === `mock_hash_${mockHash(password)}`
  }

  if (!storedHash.startsWith('$pbkdf2$')) return false
  const parts = storedHash.split('$')
  if (parts.length !== 5) return false

  const iterations = parseInt(parts[2], 10)
  const saltHex = parts[3]
  const originalHashHex = parts[4]

  const saltMatch = saltHex.match(/.{1,2}/g)
  if (!saltMatch) return false
  const salt = new Uint8Array(saltMatch.map(byte => parseInt(byte, 16)))

  const keyMaterial = await subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  )

  const derivedBits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  )

  const hashHex = Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return hashHex === originalHashHex
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
export const ENCRYPTION_PREFIX = 'enc:aes256gcm:';

function getEncryptionKey(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET || process.env.AUTH_SECRET || 'fallback-local-encryption-key-secret-12345';
  return createHash('sha256').update(secret).digest();
}

export function encrypt(text: string): string {
  if (!text) return '';
  const iv = randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
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

export function encryptPreferenceValue(value: string | undefined): string | undefined {
  if (!value || typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (trimmed === 'demo-key' || trimmed.startsWith('test-real-key') || trimmed.startsWith(ENCRYPTION_PREFIX)) {
    return trimmed;
  }
  return `${ENCRYPTION_PREFIX}${encrypt(trimmed)}`;
}

export function decryptPreferenceValue(value: string | undefined): string | undefined {
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
  if (typeof encrypted.geminiApiKey === 'string') {
    encrypted.geminiApiKey = encryptPreferenceValue(encrypted.geminiApiKey);
  }
  if (typeof encrypted.openrouterApiKey === 'string') {
    encrypted.openrouterApiKey = encryptPreferenceValue(encrypted.openrouterApiKey);
  }
  return encrypted;
}

export function decryptPreferences(prefs: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!prefs) return null;
  const decrypted = { ...prefs };
  if (typeof decrypted.geminiApiKey === 'string') {
    decrypted.geminiApiKey = decryptPreferenceValue(decrypted.geminiApiKey);
  }
  if (typeof decrypted.openrouterApiKey === 'string') {
    decrypted.openrouterApiKey = decryptPreferenceValue(decrypted.openrouterApiKey);
  }
  return decrypted;
}

