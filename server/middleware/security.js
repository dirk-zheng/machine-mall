const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

function allowedOrigins() {
  const configured = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return new Set(process.env.NODE_ENV === 'production' ? configured : [...configured, ...DEFAULT_DEV_ORIGINS]);
}

function corsOptions() {
  const origins = allowedOrigins();
  return {
    origin(origin, callback) {
      if (!origin || origins.has(origin.replace(/\/$/, ''))) return callback(null, true);
      const error = new Error('Origin is not allowed');
      error.status = 403;
      return callback(error);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Visitor-Id'],
    maxAge: 86400,
  };
}

function isOriginAllowed(origin) {
  if (!origin) return process.env.NODE_ENV !== 'production';
  return allowedOrigins().has(String(origin).replace(/\/$/, ''));
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "form-action 'self'",
    "img-src 'self' data: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'self' ws: wss:",
  ].join('; '));
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

function rateLimit({ windowMs, max, message = 'Too many requests. Please try again later.' }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.ip}:${req.baseUrl || req.path}`;
    const current = hits.get(key);
    const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    entry.count += 1;
    hits.set(key, entry);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ code: 429, message });
    }
    if (hits.size > 10000) {
      for (const [storedKey, value] of hits) if (value.resetAt <= now) hits.delete(storedKey);
    }
    return next();
  };
}

function assertProductionSecurityConfig() {
  if (process.env.NODE_ENV !== 'production') return;
  if (!String(process.env.CORS_ORIGINS || '').trim()) throw new Error('CORS_ORIGINS is required in production');
  if (String(process.env.JWT_SECRET || '').length < 32) throw new Error('JWT_SECRET must be at least 32 characters in production');
}

module.exports = { corsOptions, securityHeaders, rateLimit, assertProductionSecurityConfig, isOriginAllowed };
