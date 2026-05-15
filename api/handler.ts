import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ApiRequest, ApiResponse } from './_types.js';
import { checkRateLimit } from './_rate-limiter.js';

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

const HSTS_HEADER: Record<string, string> =
  process.env.NODE_ENV === 'production'
    ? { 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload' }
    : {};

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://personal-finance-tracker-ted.vercel.app',
];

const RATE_LIMITED_PREFIXES = ['/api/ai/chat', '/api/ai/insights'];

const ROUTES: Record<string, string> = {
  auth: './_handler-auth.js',
  profile: './_handler-profile.js',
  accounts: './_handler-accounts.js',
  categories: './_handler-categories.js',
  transactions: './_handler-transactions.js',
  budgets: './_handler-budgets.js',
  goals: './_handler-goals.js',
  debts: './_handler-debts.js',
  notifications: './_handler-notifications.js',
  'ai/chat': './ai/_handler-chat.js',
  'ai/insights': './ai/_handler-insights.js',
};

function resolveRoute(apiPath: string): string | null {
  if (ROUTES[apiPath]) return ROUTES[apiPath];

  const parts = apiPath.split('/');
  if (parts.length > 1) {
    const parent = parts.slice(0, -1).join('/');
    if (ROUTES[parent]) return ROUTES[parent];
  }

  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url!, `https://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (!pathname.startsWith('/api/')) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  const apiPath = pathname.replace(/^\/api\//, '');
  const routeFile = resolveRoute(apiPath);

  if (!routeFile) {
    res.status(404).json({ error: `Route ${pathname} not found` });
    return;
  }

  const origin = (req.headers.origin as string) || '';
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    res.status(403).json({ error: 'Forbidden - origin not allowed' });
    return;
  }

  const corsOrigin = origin || ALLOWED_ORIGINS[0];
  const corsHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cookie, Authorization',
  };

  for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...HSTS_HEADER, ...corsHeaders })) {
    res.setHeader(k, v);
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const isRateLimited = RATE_LIMITED_PREFIXES.some(prefix => pathname.startsWith(prefix));
  if (isRateLimited) {
    const clientId = (req.headers['x-forwarded-for'] as string) || (req.headers['x-real-ip'] as string) || 'unknown';
    const isAuth = pathname.startsWith('/api/auth');
    const { allowed, retryAfter } = checkRateLimit(clientId, pathname, isAuth);
    if (!allowed) {
      res.setHeader('Retry-After', String(retryAfter ?? 60));
      res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
      return;
    }
  }

  let body: Record<string, unknown> = {};
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    body = req.body as Record<string, unknown>;
  }

  const apiReq: ApiRequest = {
    method: req.method,
    body,
    headers: Object.fromEntries(
      Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : (v || '')]),
    ) as ApiRequest['headers'],
    query: Object.fromEntries(
      Object.entries(req.query).map(([k, v]) => [k, Array.isArray(v) ? v[0] : (v || '')]),
    ) as ApiRequest['query'],
  };

  let responseStatus = 200;
  const apiRes: ApiResponse = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(data) {
      res.status(responseStatus).json(data);
      return this;
    },
    setHeader(k, v) {
      res.setHeader(k, Array.isArray(v) ? v.join(', ') : v);
      return this;
    },
    end(data) {
      res.status(responseStatus).send(typeof data === 'string' ? data : data == null ? '' : String(data));
      return this;
    },
  };

  try {
    const module = await import(routeFile);
    const handlerFn = module.default;
    if (typeof handlerFn !== 'function') {
      throw new Error(`Default export in ${routeFile} is not a function`);
    }
    await handlerFn(apiReq, apiRes);
  } catch (error) {
    console.error(`Error in ${pathname}:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
