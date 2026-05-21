// POST /api/subscribe
// Body: { email, lang?, source?, route? }
// Returns: { ok: true, message } or { error }
//
// Behavior:
//   - Validate email format
//   - Hash IP for abuse detection (rate-limited: 5 attempts/hour/IP)
//   - Generate unsub_token (always) and confirm_token (if double-opt-in enabled)
//   - If AUTO_CONFIRM env var === 'true', mark as 'active' immediately
//   - Otherwise mark 'pending' and return token for confirmation flow
//   - If email already exists:
//     · active → return ok (idempotent)
//     · unsubscribed → reactivate to 'pending', generate new confirm_token
//     · pending → regenerate confirm_token, return ok

import { validateEmail, sha256, genToken, genId, json, CORS, checkRateLimit, logEvent } from '../_lib.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  const db = env.DB;
  if (!db) return json({ error: 'database_not_configured' }, 503);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'invalid_json' }, 400); }

  const email = validateEmail(body.email);
  if (!email) return json({ error: 'invalid_email' }, 400);

  // Hash IP for abuse detection
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '0.0.0.0';
  const ipHash = await sha256(ip + (env.HASH_SALT || 'crh-default-salt'));
  const uaHash = await sha256((request.headers.get('user-agent') || '').slice(0, 200));
  const region = request.cf?.country || body.region || null;

  // Rate limit: max 5 subscribe attempts per IP per hour
  const ok = await checkRateLimit(db, ipHash, 'subscribe', 5);
  if (!ok) return json({ error: 'rate_limited', message: 'Too many attempts, please try again later' }, 429);

  const now = Date.now();
  const autoConfirm = (env.AUTO_CONFIRM || 'true') === 'true';
  const initialStatus = autoConfirm ? 'active' : 'pending';
  const unsubToken = genToken();
  const confirmToken = autoConfirm ? null : genToken();
  const id = genId();

  // Check if email already exists
  const existing = await db.prepare('SELECT id, status, unsub_token FROM subscribers WHERE email=?')
    .bind(email).first();

  if (existing) {
    if (existing.status === 'active') {
      // Already subscribed — be friendly, return ok
      await logEvent(db, 'subscribe_duplicate', existing.id, email, ipHash, null);
      return json({ ok: true, message: 'already_subscribed', already: true });
    }
    // Reactivate: clear unsubscribed_at, optionally re-issue confirm token
    await db.prepare(
      `UPDATE subscribers SET status=?, confirm_token=?, unsubscribed_at=NULL,
       lang=COALESCE(?, lang), source=COALESCE(?, source), route=COALESCE(?, route),
       region=COALESCE(?, region) WHERE id=?`
    ).bind(initialStatus, confirmToken, body.lang || null, body.source || null, body.route || null, region, existing.id).run();
    await logEvent(db, 'resubscribe', existing.id, email, ipHash, { autoConfirm });
    return json({
      ok: true,
      message: autoConfirm ? 'reactivated' : 'pending_confirmation',
      confirmRequired: !autoConfirm
    });
  }

  // New subscriber
  await db.prepare(
    `INSERT INTO subscribers
     (id, email, status, source, lang, route, region, ip_hash, ua_hash, confirm_token, unsub_token, created_at, confirmed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, email, initialStatus,
    body.source || 'web', body.lang || null, body.route || null, region,
    ipHash, uaHash, confirmToken, unsubToken, now,
    autoConfirm ? now : null
  ).run();

  await logEvent(db, autoConfirm ? 'subscribe_auto' : 'subscribe_pending', id, email, ipHash, { lang: body.lang, source: body.source });

  // TODO: when double opt-in is enabled, send confirmation email here.
  // Stub: integrate Resend.com / Cloudflare Email Workers via env.RESEND_KEY etc.
  // const confirmUrl = `${new URL(request.url).origin}/api/confirm/${confirmToken}`;
  // await sendConfirmationEmail(email, confirmUrl, body.lang);

  return json({
    ok: true,
    message: autoConfirm ? 'subscribed' : 'pending_confirmation',
    confirmRequired: !autoConfirm
  });
}
