// Shared utilities for Cloudflare Pages Functions
// Imported by every endpoint via dynamic import or copy-paste.

// ───── Crypto helpers ─────
export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// URL-safe random token (32 bytes → 43 chars base64url)
export function genToken(bytes = 32) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function genId() {
  return genToken(12); // 16-char id
}

// ───── Email validation ─────
const EMAIL_RE = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i;
export function validateEmail(e) {
  if (!e || typeof e !== 'string') return null;
  e = e.trim().toLowerCase();
  if (e.length < 5 || e.length > 254) return null;
  if (!EMAIL_RE.test(e)) return null;
  // Reject obvious spam
  if (/(test|abuse|admin|noreply|postmaster|root)@/i.test(e)) return null;
  return e;
}

// ───── CORS / JSON response helpers ─────
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
  'Access-Control-Max-Age': '86400'
};

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...extra }
  });
}

export function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// ───── Admin authentication ─────
// Admin must include X-Admin-Key header matching env.ADMIN_KEY
export function requireAdmin(request, env) {
  const key = request.headers.get('X-Admin-Key');
  if (!key || !env.ADMIN_KEY || key !== env.ADMIN_KEY) {
    return json({ error: 'unauthorized' }, 401);
  }
  return null; // means OK
}

// ───── Rate limiting (per IP, per hour) ─────
export async function checkRateLimit(db, ipHash, action, maxPerHour) {
  const hour = Math.floor(Date.now() / 3_600_000) * 3_600_000;
  const row = await db.prepare(
    'SELECT count FROM rate_limits WHERE ip_hash=? AND action=? AND window_start=?'
  ).bind(ipHash, action, hour).first();
  const count = row?.count || 0;
  if (count >= maxPerHour) return false;
  await db.prepare(
    `INSERT INTO rate_limits (ip_hash, action, count, window_start)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(ip_hash, action, window_start) DO UPDATE SET count = count + 1`
  ).bind(ipHash, action, hour).run();
  return true;
}

// ───── Activity log ─────
export async function logEvent(db, event, subscriberId, email, ipHash, meta) {
  try {
    await db.prepare(
      'INSERT INTO activity_log (ts, event, subscriber_id, email, ip_hash, meta) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(Date.now(), event, subscriberId, email, ipHash, meta ? JSON.stringify(meta) : null).run();
  } catch (e) {
    // Logging should never block the main flow
    console.warn('logEvent failed', e);
  }
}

// ───── HTML escape ─────
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
