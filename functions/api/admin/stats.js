// GET /api/admin/stats — Dashboard summary numbers
// Protected by X-Admin-Key

import { requireAdmin, json, CORS } from '../../_lib.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ request, env }) {
  const guard = requireAdmin(request, env);
  if (guard) return guard;

  const db = env.DB;
  if (!db) return json({ error: 'database_not_configured' }, 503);

  const now = Date.now();
  const day = 86_400_000;

  // Aggregate stats in parallel
  const [byStatus, byLang, recent24h, recent7d, recent30d, total] = await Promise.all([
    db.prepare("SELECT status, COUNT(*) as n FROM subscribers GROUP BY status").all(),
    db.prepare("SELECT COALESCE(lang,'unknown') as lang, COUNT(*) as n FROM subscribers WHERE status='active' GROUP BY lang").all(),
    db.prepare("SELECT COUNT(*) as n FROM subscribers WHERE created_at > ?").bind(now - day).first(),
    db.prepare("SELECT COUNT(*) as n FROM subscribers WHERE created_at > ?").bind(now - day * 7).first(),
    db.prepare("SELECT COUNT(*) as n FROM subscribers WHERE created_at > ?").bind(now - day * 30).first(),
    db.prepare("SELECT COUNT(*) as n FROM subscribers").first(),
  ]);

  // Daily signups for last 30 days
  const daily = await db.prepare(
    `SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') as date, COUNT(*) as n
     FROM subscribers WHERE created_at > ? GROUP BY date ORDER BY date`
  ).bind(now - day * 30).all();

  // Recent activity (last 20)
  const activity = await db.prepare(
    `SELECT ts, event, email FROM activity_log ORDER BY ts DESC LIMIT 20`
  ).all();

  return json({
    ok: true,
    total: total?.n || 0,
    last24h: recent24h?.n || 0,
    last7d: recent7d?.n || 0,
    last30d: recent30d?.n || 0,
    byStatus: (byStatus.results || []).reduce((acc, r) => { acc[r.status] = r.n; return acc; }, {}),
    byLang: (byLang.results || []).reduce((acc, r) => { acc[r.lang] = r.n; return acc; }, {}),
    daily: daily.results || [],
    activity: activity.results || []
  });
}
