// Create a test authentication token
import { createToken } from './api/_auth.ts'

const testToken = createToken({
  sub: 'sample-user-123',
  email: 'demo@example.com'
})

console.log('Test Authentication Token:')
console.log(testToken)
console.log('\nUse this token in your browser cookies as "finance_token"')
