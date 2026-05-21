// /api/admin/subscribers — protected by X-Admin-Key header
// GET    ?page=1&limit=50&q=search&status=active&lang=zh&sort=created_desc → list with pagination
// POST   { email, lang, source, tags, notes } → add manually (auto active, no confirm email)
// PATCH  { id, status?, tags?, notes? } → update fields
// DELETE { id } or { ids: [...] } → permanent delete (hard delete, not unsub)

import { requireAdmin, validateEmail, sha256, genToken, genId, json, CORS, logEvent } from '../../_lib.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

// ─────────────── GET (list) ───────────────
export async function onRequestGet({ request, env }) {
  const guard = requireAdmin(request, env);
  if (guard) return guard;

  const db = env.DB;
  if (!db) return json({ error: 'database_not_configured' }, 503);

  const u = new URL(request.url);
  const page = Math.max(1, parseInt(u.searchParams.get('page') || '1', 10));
  const limit = Math.min(200, Math.max(1, parseInt(u.searchParams.get('limit') || '50', 10)));
  const offset = (page - 1) * limit;
  const q = (u.searchParams.get('q') || '').trim().toLowerCase();
  const status = u.searchParams.get('status') || '';
  const lang = u.searchParams.get('lang') || '';
  const source = u.searchParams.get('source') || '';
  const sort = u.searchParams.get('sort') || 'created_desc'; // created_desc | created_asc | email_asc

  // Build WHERE clauses
  const where = [];
  const args = [];
  if (q) { where.push('email LIKE ?'); args.push('%' + q + '%'); }
  if (status) { where.push('status = ?'); args.push(status); }
  if (lang) { where.push('lang = ?'); args.push(lang); }
  if (source) { where.push('source = ?'); args.push(source); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  // Sort
  const orderBy = sort === 'created_asc' ? 'created_at ASC' :
                  sort === 'email_asc'   ? 'email COLLATE NOCASE ASC' :
                                           'created_at DESC';

  // Count total
  const totalRow = await db.prepare(`SELECT COUNT(*) as n FROM subscribers ${whereSql}`).bind(...args).first();
  const total = totalRow?.n || 0;

  // Fetch page
  const rows = await db.prepare(
    `SELECT id, email, status, source, lang, route, region, created_at, confirmed_at,
            unsubscribed_at, bounced_at, last_sent_at, tags, notes, unsub_token
     FROM subscribers ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
  ).bind(...args, limit, offset).all();

  return json({
    ok: true,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
    rows: rows.results || []
  });
}

// ─────────────── POST (add manually) ───────────────
export async function onRequestPost({ request, env }) {
  const guard = requireAdmin(request, env);
  if (guard) return guard;

  const db = env.DB;
  if (!db) return json({ error: 'database_not_configured' }, 503);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'invalid_json' }, 400); }

  const email = validateEmail(body.email);
  if (!email) return json({ error: 'invalid_email' }, 400);

  // Conflict check
  const existing = await db.prepare('SELECT id, status FROM subscribers WHERE email=?').bind(email).first();
  if (existing) return json({ error: 'already_exists', subscriber: existing }, 409);

  const id = genId();
  const unsubToken = genToken();
  const now = Date.now();
  await db.prepare(
    `INSERT INTO subscribers
     (id, email, status, source, lang, route, region, ip_hash, ua_hash, unsub_token, created_at, confirmed_at, tags, notes)
     VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, email,
    body.source || 'manual',
    body.lang || null,
    body.route || null,
    body.region || null,
    'admin', 'admin',
    unsubToken, now, now,
    body.tags || null,
    body.notes || null
  ).run();

  await logEvent(db, 'admin_add', id, email, 'admin', { by: 'admin' });
  return json({ ok: true, id, unsubToken });
}

// ─────────────── PATCH (update) ───────────────
export async function onRequestPatch({ request, env }) {
  const guard = requireAdmin(request, env);
  if (guard) return guard;

  const db = env.DB;
  if (!db) return json({ error: 'database_not_configured' }, 503);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'invalid_json' }, 400); }

  if (!body.id) return json({ error: 'missing_id' }, 400);

  // Build SET clause from allowed fields
  const allowed = ['status', 'tags', 'notes', 'lang'];
  const updates = [];
  const args = [];
  for (const k of allowed) {
    if (k in body) {
      updates.push(`${k} = ?`);
      args.push(body[k]);
    }
  }
  // Special: status transitions update timestamps
  if (body.status === 'unsubscribed') {
    updates.push('unsubscribed_at = ?'); args.push(Date.now());
  } else if (body.status === 'active') {
    updates.push('unsubscribed_at = NULL', 'confirmed_at = COALESCE(confirmed_at, ?)'); args.push(Date.now());
  } else if (body.status === 'bounced') {
    updates.push('bounced_at = ?'); args.push(Date.now());
  }

  if (!updates.length) return json({ error: 'no_changes' }, 400);

  args.push(body.id);
  await db.prepare(`UPDATE subscribers SET ${updates.join(', ')} WHERE id = ?`).bind(...args).run();
  await logEvent(db, 'admin_update', body.id, body.email || '', 'admin', body);
  return json({ ok: true });
}

// ─────────────── DELETE (hard delete) ───────────────
export async function onRequestDelete({ request, env }) {
  const guard = requireAdmin(request, env);
  if (guard) return guard;

  const db = env.DB;
  if (!db) return json({ error: 'database_not_configured' }, 503);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'invalid_json' }, 400); }

  const ids = body.ids || (body.id ? [body.id] : []);
  if (!ids.length) return json({ error: 'missing_id' }, 400);

  // Fetch emails for audit log before delete
  const placeholders = ids.map(() => '?').join(',');
  const toDelete = await db.prepare(`SELECT id, email FROM subscribers WHERE id IN (${placeholders})`).bind(...ids).all();

  await db.prepare(`DELETE FROM subscribers WHERE id IN (${placeholders})`).bind(...ids).run();

  // Log each deletion (denormalised email preserved)
  for (const r of toDelete.results || []) {
    await logEvent(db, 'admin_delete', r.id, r.email, 'admin', null);
  }
  return json({ ok: true, deleted: (toDelete.results || []).length });
}
