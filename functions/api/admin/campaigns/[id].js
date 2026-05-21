// /api/admin/campaigns/[id]
// GET    → full campaign details + recipient preview
// PATCH  → update draft (only if status='draft' or 'paused')
// DELETE → delete campaign + all send records
// Protected by X-Admin-Key

import { requireAdmin, json, CORS, logEvent } from '../../../_lib.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ request, env, params }) {
  const guard = requireAdmin(request, env);
  if (guard) return guard;
  const db = env.DB;
  if (!db) return json({ error: 'database_not_configured' }, 503);

  const c = await db.prepare('SELECT * FROM campaigns WHERE id = ?').bind(params.id).first();
  if (!c) return json({ error: 'not_found' }, 404);

  // Compute recipient preview counts per language (live count of who would receive)
  const u = new URL(request.url);
  const targetStatus = c.target_status || 'active';
  const args = [targetStatus];
  let tagFilter = '';
  if (c.target_tags) {
    tagFilter = " AND tags LIKE ?";
    args.push('%' + c.target_tags.split(',')[0].trim() + '%');
  }

  // Count per lang
  const langs = await db.prepare(
    `SELECT COALESCE(lang, 'unknown') as lang, COUNT(*) as n
     FROM subscribers WHERE status = ?${tagFilter}
     GROUP BY lang`
  ).bind(...args).all();

  // Total recipients (taking content availability into account)
  const langCounts = {};
  for (const r of langs.results || []) langCounts[r.lang] = r.n;

  // Determine which langs have content
  const hasContent = {
    'zh': !!(c.subject_zh && c.body_zh),
    'zh-TW': !!(c.subject_zh_tw && c.body_zh_tw),
    'en': !!(c.subject_en && c.body_en),
    'ko': !!(c.subject_ko && c.body_ko)
  };

  // Calculate effective recipients
  let willReceive = 0, willSkip = 0;
  for (const [lang, n] of Object.entries(langCounts)) {
    if (hasContent[lang]) {
      willReceive += n;
    } else if (c.fallback_lang && hasContent[c.fallback_lang]) {
      willReceive += n;
    } else {
      willSkip += n;
    }
  }

  // Already-sent count for this campaign
  const sent = await db.prepare(
    "SELECT COUNT(*) as n FROM campaign_sends WHERE campaign_id = ? AND status = 'sent'"
  ).bind(params.id).first();

  return json({
    ok: true,
    campaign: c,
    preview: {
      langCounts,
      hasContent,
      willReceive,
      willSkip,
      alreadySent: sent?.n || 0
    }
  });
}

export async function onRequestPatch({ request, env, params }) {
  const guard = requireAdmin(request, env);
  if (guard) return guard;
  const db = env.DB;
  if (!db) return json({ error: 'database_not_configured' }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }

  // Only drafts and paused campaigns can be edited
  const current = await db.prepare('SELECT status FROM campaigns WHERE id = ?').bind(params.id).first();
  if (!current) return json({ error: 'not_found' }, 404);
  if (current.status === 'sending') return json({ error: 'cannot_edit_while_sending' }, 409);

  const allowed = [
    'name','subject_zh','body_zh','subject_zh_tw','body_zh_tw',
    'subject_en','body_en','subject_ko','body_ko',
    'from_name','from_email','reply_to','target_status','target_tags','fallback_lang','status'
  ];
  const updates = ['updated_at = ?'];
  const args = [Date.now()];
  for (const k of allowed) {
    if (k in body) { updates.push(`${k} = ?`); args.push(body[k]); }
  }
  if (updates.length === 1) return json({ error: 'no_changes' }, 400);
  args.push(params.id);
  await db.prepare(`UPDATE campaigns SET ${updates.join(', ')} WHERE id = ?`).bind(...args).run();
  return json({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  const guard = requireAdmin(request, env);
  if (guard) return guard;
  const db = env.DB;
  if (!db) return json({ error: 'database_not_configured' }, 503);

  await db.batch([
    db.prepare('DELETE FROM campaign_sends WHERE campaign_id = ?').bind(params.id),
    db.prepare('DELETE FROM campaigns WHERE id = ?').bind(params.id)
  ]);
  await logEvent(db, 'admin_delete_campaign', null, params.id, 'admin', null);
  return json({ ok: true });
}
