// Mock database for development when NEON_DATABASE_URL is not set
interface MockUser {
  id: string
  email: string
  encrypted_password: string
  full_name: string
  avatar_url: string | null
  created_at: string
  last_sign_in_at: string | null
}

interface MockProfile {
  id: string
  user_id: string
  full_name: string
  currency: string
  preferences: Record<string, unknown>
  created_at: string
  updated_at: string
}

// In-memory mock database
const mockUsers = new Map<string, MockUser>()
const mockProfiles = new Map<string, MockProfile>()

// Helper to generate UUID
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// Helper to hash password (simple mock for development)
async function mockHashPassword(password: string): Promise<string> {
  // In development, we'll use a simple hash (NOT FOR PRODUCTION)
  return `mock_hash_${password}`
}

// Helper to verify password
async function mockVerifyPassword(password: string, hash: string): Promise<boolean> {
  if (hash.startsWith('mock_hash_')) {
    return hash === `mock_hash_${password}`
  }
  return password === hash // Fallback for testing
}

export async function query<T = unknown>(
  queryText: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  console.log(`🔧 MOCK DB Query: ${queryText}`, params)
  
  // Parse common queries
  if (queryText.includes('SELECT id FROM users WHERE email')) {
    const email = params?.[0] as string
    const user = Array.from(mockUsers.values()).find(u => u.email === email)
    return { rows: user ? [{ id: user.id }] as T[] : [], rowCount: user ? 1 : 0 }
  }
  
  if (queryText.includes('SELECT * FROM users WHERE email')) {
    const email = params?.[0] as string
    const user = Array.from(mockUsers.values()).find(u => u.email === email)
    return { rows: user ? [user as T] : [], rowCount: user ? 1 : 0 }
  }
  
  if (queryText.includes('INSERT INTO users')) {
    const [email, hashedPassword, fullName] = params as [string, string, string]
    const newUser: MockUser = {
      id: generateUUID(),
      email,
      encrypted_password: hashedPassword,
      full_name: fullName,
      avatar_url: null,
      created_at: new Date().toISOString(),
      last_sign_in_at: null
    }
    mockUsers.set(newUser.id, newUser)
    return { rows: [newUser as T], rowCount: 1 }
  }
  
  if (queryText.includes('INSERT INTO profiles')) {
    const [userId, fullName, currency] = params as [string, string, string]
    const newProfile: MockProfile = {
      id: generateUUID(),
      user_id: userId,
      full_name: fullName,
      currency,
      preferences: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    mockProfiles.set(newProfile.id, newProfile)
    return { rows: [{ user_id: userId } as T], rowCount: 1 }
  }
  
  if (queryText.includes('UPDATE users SET encrypted_password')) {
    const [newHash, userId] = params as [string, string]
    const user = mockUsers.get(userId)
    if (user) {
      user.encrypted_password = newHash
      mockUsers.set(userId, user)
    }
    return { rows: [{ id: userId } as T], rowCount: 1 }
  }
  
  if (queryText.includes('UPDATE users SET last_sign_in_at')) {
    const [userId] = params as [string]
    const user = mockUsers.get(userId)
    if (user) {
      user.last_sign_in_at = new Date().toISOString()
      mockUsers.set(userId, user)
    }
    return { rows: [{ id: userId } as T], rowCount: 1 }
  }
  
  // Default empty response for unsupported queries
  return { rows: [], rowCount: 0 }
}

export async function queryOne<T = unknown>(
  queryText: string,
  params?: unknown[],
): Promise<T | null> {
  const { rows } = await query<T>(queryText, params)
  return rows[0] || null
}

export async function transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
  // Mock transaction - just execute the callback
  return await callback(null)
}

// Export mock helpers for auth
export { mockHashPassword as hashPassword, mockVerifyPassword as verifyPassword }
