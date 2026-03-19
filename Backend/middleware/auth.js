const authService = require('../services/authService');

// ── JWT verification ──────────────────────────────────────────────────────────

const requireAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication token is required' });
  }

  const token = header.split(' ')[1];
  try {
    req.user = authService.verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token. Please log in again.' });
  }
};

// ── Role guards ───────────────────────────────────────────────────────────────

/** Admin-only — finance, analytics, year reset, user management */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden', message: 'Admin privileges required' });
  }
  next();
};

/** HR or Admin — student CRUD */
const requireHR = (req, res, next) => {
  if (!req.user || !['admin', 'hr'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden', message: 'HR or Admin access required' });
  }
  next();
};

// ── Rate limiting ─────────────────────────────────────────────────────────────

const rateLimitMap = new Map();

const rateLimit = (maxRequests = 10, windowMs = 60000) => {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    for (const [key, value] of rateLimitMap.entries()) {
      if (now - value.windowStart > windowMs) rateLimitMap.delete(key);
    }

    const record = rateLimitMap.get(ip);
    if (!record) {
      rateLimitMap.set(ip, { count: 1, windowStart: now });
      next();
    } else if (now - record.windowStart > windowMs) {
      rateLimitMap.set(ip, { count: 1, windowStart: now });
      next();
    } else if (record.count < maxRequests) {
      record.count++;
      next();
    } else {
      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again in ${Math.ceil((windowMs - (now - record.windowStart)) / 1000)} seconds.`
      });
    }
  };
};

// ── Audit logging ─────────────────────────────────────────────────────────────

const auditLog = (action) => {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      console.log(`[AUDIT] ${action}:`, {
        timestamp: new Date().toISOString(),
        ip: req.ip || req.connection.remoteAddress,
        user: req.user?.username || 'unauthenticated',
        role: req.user?.role || 'none',
        action,
        params: req.params,
        success: data.success || false,
        error: data.error || null
      });
      return originalJson(data);
    };
    next();
  };
};

module.exports = { requireAuth, requireAdmin, requireHR, rateLimit, auditLog };
