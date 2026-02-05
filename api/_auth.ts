import { createHmac, timingSafeEqual } from 'crypto'
import { queryOne } from './_db.js'

const TOKEN_COOKIE = 'finance_token'
const ONE_DAY_SECONDS = 60 * 60 * 24

type TokenPayload = {
  sub: string
  email?: string
  iat: number
  exp: number
}

const base64url = (input: string | Buffer) =>
  Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

const decodeBase64Url = (input: string) => {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=')
  return Buffer.from(padded, 'base64').toString('utf8')
}

const base64urlJson = (obj: object) => base64url(JSON.stringify(obj))

const sign = (data: string, secret: string) =>
  base64url(createHmac('sha256', secret).update(data).digest())

export function createToken(payload: Omit<TokenPayload, 'iat' | 'exp'>) {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set')

  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + ONE_DAY_SECONDS
  const header = { alg: 'HS256', typ: 'JWT' }
  const fullPayload: TokenPayload = { ...payload, iat, exp }
  const tokenBase = `${base64urlJson(header)}.${base64urlJson(fullPayload)}`
  const signature = sign(tokenBase, secret)
  return `${tokenBase}.${signature}`
}

export function verifyToken(token: string): TokenPayload | null {
  const secret = process.env.AUTH_SECRET
  if (!secret) return null

  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, payload, signature] = parts
  const tokenBase = `${header}.${payload}`
  const expected = sign(tokenBase, secret)
  try {
    const sigOk = timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    if (!sigOk) return null
  } catch {
    return null
  }

  try {
    const json = decodeBase64Url(payload)
    const parsed = JSON.parse(json) as TokenPayload
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null
    return parsed
  } catch {
    return null
  }
}

export function getCookie(req: { headers?: { cookie?: string } }, name: string) {
  const cookieHeader = req.headers?.cookie
  if (!cookieHeader) return undefined
  const parts = cookieHeader.split(';').map(p => p.trim())
  for (const part of parts) {
    if (part.startsWith(`${name}=`)) {
      return decodeURIComponent(part.slice(name.length + 1))
    }
  }
  return undefined
}

export function setAuthCookie(res: { setHeader: (k: string, v: string | string[]) => void }, token: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  const cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ONE_DAY_SECONDS}${secure}`
  res.setHeader('Set-Cookie', cookie)
}

export function clearAuthCookie(res: { setHeader: (k: string, v: string | string[]) => void }) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  const cookie = `${TOKEN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
  res.setHeader('Set-Cookie', cookie)
}

export async function getAuthedUserId(req: { headers?: { cookie?: string } }): Promise<string | null> {
  const token = getCookie(req, TOKEN_COOKIE)
  if (!token) return null
  const payload = verifyToken(token)
  return payload?.sub || null
}

export type AuthedUser = {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  created_at: string
}

export async function getAuthedUser(req: { headers?: { cookie?: string } }): Promise<AuthedUser | null> {
  const userId = await getAuthedUserId(req)
  if (!userId) return null
  return queryOne<AuthedUser>(
    'SELECT id, email, full_name, avatar_url, created_at FROM users WHERE id = $1',
    [userId],
  )
}
