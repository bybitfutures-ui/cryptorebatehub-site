// /api/admin/campaigns
// GET   → list all campaigns
// POST  → create new draft campaign
// Protected by X-Admin-Key

import { requireAdmin, genId, json, CORS } from '../../_lib.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ request, env }) {
  const guard = requireAdmin(request, env);
  if (guard) return guard;
  const db = env.DB;
  if (!db) return json({ error: 'database_not_configured' }, 503);

  const u = new URL(request.url);
  const status = u.searchParams.get('status') || '';
  const where = status ? 'WHERE status = ?' : '';
  const args = status ? [status] : [];

  const rows = await db.prepare(
    `SELECT id, name, status, subject_zh, subject_en,
            recipients_total, recipients_sent, recipients_failed, recipients_skipped,
            created_at, updated_at, started_at, finished_at
     FROM campaigns ${where} ORDER BY created_at DESC LIMIT 100`
  ).bind(...args).all();
  return json({ ok: true, rows: rows.results || [] });
}

export async function onRequestPost({ request, env }) {
  const guard = requireAdmin(request, env);
  if (guard) return guard;
  const db = env.DB;
  if (!db) return json({ error: 'database_not_configured' }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }

  const id = genId();
  const now = Date.now();
  await db.prepare(
    `INSERT INTO campaigns
     (id, name, status, subject_zh, body_zh, subject_zh_tw, body_zh_tw,
      subject_en, body_en, subject_ko, body_ko,
      from_name, from_email, reply_to, target_status, target_tags, fallback_lang,
      created_at, updated_at)
     VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.name || 'Untitled campaign',
    body.subject_zh || null, body.body_zh || null,
    body.subject_zh_tw || null, body.body_zh_tw || null,
    body.subject_en || null, body.body_en || null,
    body.subject_ko || null, body.body_ko || null,
    body.from_name || null, body.from_email || null, body.reply_to || null,
    body.target_status || 'active',
    body.target_tags || null,
    body.fallback_lang || '',
    now, now
  ).run();
  return json({ ok: true, id });
}
