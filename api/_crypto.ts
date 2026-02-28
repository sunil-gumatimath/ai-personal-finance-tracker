import { webcrypto } from 'crypto'

const subtle = webcrypto.subtle
const encoder = new TextEncoder()

export async function hashPassword(password: string): Promise<string> {
  // Check if we're in mock mode (no database URL)
  if (!process.env.NEON_DATABASE_URL) {
    return `mock_hash_${password}`
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
    return storedHash === `mock_hash_${password}`
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
