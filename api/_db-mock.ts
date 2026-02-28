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

interface MockAccount {
  id: string
  user_id: string
  name: string
  type: string
  balance: number
  created_at: string
}

interface MockTransaction {
  id: string
  user_id: string
  account_id: string
  category_id: string | null
  type: 'income' | 'expense'
  amount: number
  description: string | null
  date: string
  created_at: string
}

interface MockCategory {
  id: string
  user_id: string
  name: string
  created_at: string
}

interface MockAIInsight {
  id: string
  user_id: string
  type: 'anomaly' | 'coaching' | 'kudo'
  title: string
  description: string
  category?: string
  amount?: number
  date?: string
  is_dismissed?: boolean
  created_at?: string
}

// In-memory mock database
const mockUsers = new Map<string, MockUser>()
const mockProfiles = new Map<string, MockProfile>()
const mockAccounts = new Map<string, MockAccount>()
const mockTransactions = new Map<string, MockTransaction>()
const mockCategories = new Map<string, MockCategory>()
const mockAIInsights = new Map<string, MockAIInsight>()

// Initialize with sample data
function initializeSampleData() {
  const userId = 'sample-user-123'
  const profileId = 'sample-profile-123'
  
  // Create sample user
  const sampleUser: MockUser = {
    id: userId,
    email: 'demo@example.com',
    encrypted_password: 'mock_hash_password',
    full_name: 'Demo User',
    avatar_url: null,
    created_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString()
  }
  mockUsers.set(userId, sampleUser)
  
  // Create user's test account
  const userUserId = 'user-sunil-123'
  const userSampleUser: MockUser = {
    id: userUserId,
    email: 'sunilgumatimath38@gmail.com',
    encrypted_password: 'mock_hash_Sunil@081120',
    full_name: 'Sunil Gumatimath',
    avatar_url: null,
    created_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString()
  }
  mockUsers.set(userUserId, userSampleUser)
  
  // Create sample profile
  const sampleProfile: MockProfile = {
    id: profileId,
    user_id: userId,
    full_name: 'Demo User',
    currency: 'USD',
    preferences: { geminiApiKey: 'demo-key' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  mockProfiles.set(profileId, sampleProfile)
  
  // Create user's profile
  const userProfileId = 'user-profile-sunil-123'
  const userSampleProfile: MockProfile = {
    id: userProfileId,
    user_id: userUserId,
    full_name: 'Sunil Gumatimath',
    currency: 'INR',
    preferences: { geminiApiKey: '' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  mockProfiles.set(userProfileId, userSampleProfile)
  
  // Create sample categories
  const categories = [
    { id: 'cat-food', name: 'Food & Dining' },
    { id: 'cat-transport', name: 'Transportation' },
    { id: 'cat-shopping', name: 'Shopping' },
    { id: 'cat-salary', name: 'Salary' },
    { id: 'cat-entertainment', name: 'Entertainment' }
  ]
  
  categories.forEach(cat => {
    const category: MockCategory = {
      id: cat.id,
      user_id: userId,
      name: cat.name,
      created_at: new Date().toISOString()
    }
    mockCategories.set(cat.id, category)
  })
  
  // Create sample accounts
  const accounts = [
    { id: 'acc-checking', name: 'Checking Account', type: 'checking', balance: 5000 },
    { id: 'acc-savings', name: 'Savings Account', type: 'savings', balance: 10000 }
  ]
  
  accounts.forEach(acc => {
    const account: MockAccount = {
      id: acc.id,
      user_id: userId,
      name: acc.name,
      type: acc.type,
      balance: acc.balance,
      created_at: new Date().toISOString()
    }
    mockAccounts.set(acc.id, account)
  })
  
  // Create sample transactions for this month
  const now = new Date()
  const transactions = [
    // Income
    { id: 'tx-salary', account_id: 'acc-checking', category_id: 'cat-salary', type: 'income' as const, amount: 5000, description: 'Monthly Salary', date: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0] },
    
    // Expenses
    { id: 'tx-groceries', account_id: 'acc-checking', category_id: 'cat-food', type: 'expense' as const, amount: 450, description: 'Grocery Shopping', date: new Date(now.getFullYear(), now.getMonth(), 5).toISOString().split('T')[0] },
    { id: 'tx-restaurant', account_id: 'acc-checking', category_id: 'cat-food', type: 'expense' as const, amount: 85, description: 'Restaurant Dinner', date: new Date(now.getFullYear(), now.getMonth(), 8).toISOString().split('T')[0] },
    { id: 'tx-gas', account_id: 'acc-checking', category_id: 'cat-transport', type: 'expense' as const, amount: 60, description: 'Gas Station', date: new Date(now.getFullYear(), now.getMonth(), 10).toISOString().split('T')[0] },
    { id: 'tx-shopping', account_id: 'acc-checking', category_id: 'cat-shopping', type: 'expense' as const, amount: 120, description: 'Clothing Store', date: new Date(now.getFullYear(), now.getMonth(), 12).toISOString().split('T')[0] },
    { id: 'tx-netflix', account_id: 'acc-checking', category_id: 'cat-entertainment', type: 'expense' as const, amount: 15, description: 'Netflix Subscription', date: new Date(now.getFullYear(), now.getMonth(), 15).toISOString().split('T')[0] }
  ]
  
  transactions.forEach(tx => {
    const transaction: MockTransaction = {
      id: tx.id,
      user_id: userId,
      account_id: tx.account_id,
      category_id: tx.category_id,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      date: tx.date,
      created_at: new Date().toISOString()
    }
    mockTransactions.set(tx.id, transaction)
  })
}

// Initialize sample data on first import
initializeSampleData()

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
  
  // Debug AI insights queries
  if (queryText.includes('ai_insights')) {
    console.log('🔍 DEBUG: AI insights query detected:', queryText)
  }
  
  // AI Insights queries - more specific pattern matching
  if (queryText.includes('SELECT * FROM ai_insights') && queryText.includes('WHERE user_id')) {
    const userId = params?.[0] as string
    console.log('🔍 DEBUG: Looking for insights for user:', userId)
    console.log('🔍 DEBUG: All insights:', Array.from(mockAIInsights.values()))
    const insights = Array.from(mockAIInsights.values()).filter(i => 
      i.user_id === userId && 
      !i.is_dismissed && 
      i.created_at
    )
    console.log('🔍 DEBUG: Filtered insights:', insights)
    // For mock purposes, return all non-dismissed insights (ignore 7-day filter)
    return { rows: insights as T[], rowCount: insights.length }
  }
  if (queryText.includes('SELECT id FROM users WHERE email')) {
    const email = params?.[0] as string
    const user = Array.from(mockUsers.values()).find(u => u.email === email)
    return { rows: user ? [{ id: user.id }] as T[] : [], rowCount: user ? 1 : 0 }
  }
  
  if (queryText.includes('SELECT * FROM users WHERE email')) {
    const email = params?.[0] as string
    console.log('🔍 DEBUG: Looking for user with email:', email)
    console.log('🔍 DEBUG: All users in mock DB:', Array.from(mockUsers.values()).map(u => ({ id: u.id, email: u.email, name: u.full_name })))
    const user = Array.from(mockUsers.values()).find(u => u.email === email)
    console.log('🔍 DEBUG: Found user:', user ? { id: user.id, email: user.email, name: user.full_name } : 'NOT FOUND')
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
  
  // Profile queries
  if (queryText.includes('SELECT preferences, currency FROM profiles WHERE user_id')) {
    const userId = params?.[0] as string
    const profile = Array.from(mockProfiles.values()).find(p => p.user_id === userId)
    return { rows: profile ? [profile as T] : [], rowCount: profile ? 1 : 0 }
  }
  
  if (queryText.includes('UPDATE profiles SET preferences =')) {
    const [preferencesJson, currency, userId] = params as [string, string | null, string]
    const profile = Array.from(mockProfiles.values()).find(p => p.user_id === userId)
    if (profile) {
      profile.preferences = JSON.parse(preferencesJson)
      if (currency) profile.currency = currency
      profile.updated_at = new Date().toISOString()
      mockProfiles.set(profile.id, profile)
    }
    return { rows: [{ user_id: userId } as T], rowCount: 1 }
  }
  
  // Account queries
  if (queryText.includes('SELECT name, balance, type FROM accounts WHERE user_id')) {
    const userId = params?.[0] as string
    const accounts = Array.from(mockAccounts.values()).filter(a => a.user_id === userId)
    return { rows: accounts as T[], rowCount: accounts.length }
  }
  
  // Transaction queries
  if (queryText.includes('SELECT t.type, t.amount, t.date, t.description, c.name as category_name FROM transactions t LEFT JOIN categories c ON t.category_id = c.id WHERE t.user_id')) {
    const userId = params?.[0] as string
    const transactions = Array.from(mockTransactions.values()).filter(t => t.user_id === userId)
    
    // Join with categories
    const transactionsWithCategories = transactions.map(t => {
      const category = mockCategories.get(t.category_id || '')
      return {
        type: t.type,
        amount: t.amount,
        date: t.date,
        description: t.description,
        category_name: category?.name || null
      }
    })
    
    // Filter by timeframe if needed
    let filteredTransactions = transactionsWithCategories
    if (queryText.includes('DATE_TRUNC(\'month\', CURRENT_DATE)')) {
      // Filter for current month
      const now = new Date()
      const currentMonth = now.getMonth()
      const currentYear = now.getFullYear()
      filteredTransactions = transactionsWithCategories.filter(t => {
        const txDate = new Date(t.date)
        return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear
      })
    }
    
    return { rows: filteredTransactions as T[], rowCount: filteredTransactions.length }
  }
  
  // Category queries
  if (queryText.includes('SELECT * FROM categories WHERE user_id')) {
    const userId = params?.[0] as string
    const categories = Array.from(mockCategories.values()).filter(c => c.user_id === userId)
    return { rows: categories as T[], rowCount: categories.length }
  }
  
  // Budget queries (return empty for now)
  if (queryText.includes('SELECT b.amount, b.period, c.name as category_name FROM budgets b LEFT JOIN categories c ON b.category_id = c.id WHERE b.user_id')) {
    return { rows: [], rowCount: 0 }
  }
  
  // Goals queries (return empty for now)
  if (queryText.includes('SELECT name, target_amount, current_amount, deadline FROM goals WHERE user_id')) {
    return { rows: [], rowCount: 0 }
  }
  
  // Debts queries (return empty for now)
  if (queryText.includes('SELECT name, current_balance, interest_rate, minimum_payment FROM debts WHERE user_id')) {
    return { rows: [], rowCount: 0 }
  }
  
  if (queryText.includes('INSERT INTO ai_insights')) {
    const [userId, type, title, description, category, amount, date] = params as [string, string, string, string, string | null, number | null, string | null]
    const newInsight: MockAIInsight = {
      id: generateUUID(),
      user_id: userId,
      type: type as 'anomaly' | 'coaching' | 'kudo',
      title,
      description,
      category: category || undefined,
      amount: amount || undefined,
      date: date || undefined,
      is_dismissed: false,
      created_at: new Date().toISOString()
    }
    mockAIInsights.set(newInsight.id, newInsight)
    return { rows: [newInsight as T], rowCount: 1 }
  }
  
  if (queryText.includes('UPDATE ai_insights SET is_dismissed = true WHERE id')) {
    const [id] = params as [string]
    const insight = mockAIInsights.get(id)
    if (insight) {
      insight.is_dismissed = true
      mockAIInsights.set(id, insight)
    }
    return { rows: [], rowCount: 1 }
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
