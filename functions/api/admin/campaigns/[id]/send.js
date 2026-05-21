// POST /api/admin/campaigns/[id]/send
// Body: { batchSize: 50, dryRun: false }
//
// Behavior:
//   1. Locks campaign with status='sending'
//   2. Picks next `batchSize` active subscribers NOT yet in campaign_sends for this campaign
//   3. For each:
//      - Pick lang content (with fallback)
//      - Render HTML template w/ subscriber's unsub_token
//      - Send via Resend (sequential, ~10/sec)
//      - Insert campaign_sends row
//      - Update subscribers.last_sent_at
//   4. Updates campaign counters
//   5. Returns { sent, failed, skipped, remaining }
//
// Admin clicks "Continue" if remaining > 0 (CF Functions have CPU limits).
// Protected by X-Admin-Key.

import { requireAdmin, json, CORS, logEvent } from '../../../../_lib.js';
import { sendEmail, renderEmailTemplate } from '../../../../_email.js';
import { wrapBodyHtml, pickLangContent } from './_shared.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost({ request, env, params }) {
  const guard = requireAdmin(request, env);
  if (guard) return guard;
  const db = env.DB;
  if (!db) return json({ error: 'database_not_configured' }, 503);

  let body = {};
  try { body = await request.json(); } catch {}
  const batchSize = Math.min(100, Math.max(1, parseInt(body.batchSize, 10) || 50));
  const dryRun = body.dryRun === true;

  const c = await db.prepare('SELECT * FROM campaigns WHERE id = ?').bind(params.id).first();
  if (!c) return json({ error: 'campaign_not_found' }, 404);

  // Make sure at least one language has content
  const hasContent = !!((c.subject_zh && c.body_zh) || (c.subject_zh_tw && c.body_zh_tw) ||
                       (c.subject_en && c.body_en) || (c.subject_ko && c.body_ko));
  if (!hasContent) return json({ error: 'no_content', message: 'Write subject + body in at least one language' }, 400);

  if (!dryRun && !env.RESEND_API_KEY) {
    return json({ error: 'resend_not_configured', message: 'Set RESEND_API_KEY env var. See db/README.md section 8.' }, 503);
  }

  const origin = new URL(request.url).origin;
  const year = new Date().getFullYear();
  const now = Date.now();

  // Mark campaign as sending (if not already)
  if (c.status !== 'sending') {
    await db.prepare(
      "UPDATE campaigns SET status='sending', started_at=COALESCE(started_at, ?) WHERE id=?"
    ).bind(now, params.id).run();
  }

  // Fetch next batch of subscribers who haven't been sent this campaign yet
  const targetStatus = c.target_status || 'active';
  // Use NOT EXISTS to skip already-sent
  const recipients = await db.prepare(`
    SELECT s.id, s.email, s.lang, s.unsub_token
    FROM subscribers s
    WHERE s.status = ?
      AND NOT EXISTS (
        SELECT 1 FROM campaign_sends cs
        WHERE cs.campaign_id = ? AND cs.subscriber_id = s.id
      )
    ORDER BY s.id
    LIMIT ?
  `).bind(targetStatus, params.id, batchSize).all();

  const recipientList = recipients.results || [];

  let sent = 0, failed = 0, skipped = 0;
  const errors = [];

  for (const r of recipientList) {
    const picked = pickLangContent(c, r.lang);
    if (!picked) {
      // No content for this lang (and no fallback) → skip
      skipped++;
      await db.prepare(
        `INSERT OR IGNORE INTO campaign_sends (campaign_id, subscriber_id, email, lang, status, sent_at, error)
         VALUES (?, ?, ?, ?, 'skipped', ?, ?)`
      ).bind(params.id, r.id, r.email, r.lang, Date.now(), 'no_content_for_lang').run();
      continue;
    }

    if (dryRun) {
      sent++;
      continue;
    }

    const unsubUrl = `${origin}/u/${r.unsub_token}`;
    const bodyHtml = wrapBodyHtml(picked.body, { lang: picked.lang });
    const html = renderEmailTemplate({
      subject: picked.subject,
      bodyHtml,
      unsubUrl,
      lang: picked.lang,
      brandUrl: origin,
      year
    });

    try {
      const result = await sendEmail({
        to: r.email,
        subject: picked.subject,
        html,
        replyTo: c.reply_to || undefined,
        from: c.from_email || undefined,
        fromName: c.from_name || undefined,
        headers: {
          'X-Entity-Ref-ID': params.id + '-' + r.id,
          'List-Unsubscribe': `<${unsubUrl}>, <mailto:${env.FROM_EMAIL || 'unsubscribe@cryptorebatehub.com'}?subject=unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
        }
      }, env);

      sent++;
      const ts = Date.now();
      await db.batch([
        db.prepare(
          `INSERT INTO campaign_sends (campaign_id, subscriber_id, email, lang, status, sent_at, external_id)
           VALUES (?, ?, ?, ?, 'sent', ?, ?)`
        ).bind(params.id, r.id, r.email, picked.lang, ts, result.id || null),
        db.prepare('UPDATE subscribers SET last_sent_at = ? WHERE id = ?').bind(ts, r.id)
      ]);

      // Small delay to stay under Resend's 10/sec burst limit
      await new Promise(res => setTimeout(res, 110));
    } catch (e) {
      failed++;
      errors.push({ email: r.email, error: e.message.slice(0, 200) });
      await db.prepare(
        `INSERT INTO campaign_sends (campaign_id, subscriber_id, email, lang, status, sent_at, error)
         VALUES (?, ?, ?, ?, 'failed', ?, ?)`
      ).bind(params.id, r.id, r.email, picked.lang, Date.now(), e.message.slice(0, 500)).run();
    }
  }

  // Update campaign counters
  await db.prepare(`
    UPDATE campaigns SET
      recipients_sent    = (SELECT COUNT(*) FROM campaign_sends WHERE campaign_id = ? AND status = 'sent'),
      recipients_failed  = (SELECT COUNT(*) FROM campaign_sends WHERE campaign_id = ? AND status = 'failed'),
      recipients_skipped = (SELECT COUNT(*) FROM campaign_sends WHERE campaign_id = ? AND status = 'skipped')
    WHERE id = ?
  `).bind(params.id, params.id, params.id, params.id).run();

  // Count remaining
  const remRow = await db.prepare(`
    SELECT COUNT(*) as n FROM subscribers s
    WHERE s.status = ? AND NOT EXISTS (
      SELECT 1 FROM campaign_sends cs WHERE cs.campaign_id = ? AND cs.subscriber_id = s.id
    )
  `).bind(targetStatus, params.id).first();
  const remaining = remRow?.n || 0;

  // If nothing remains, mark as sent
  if (remaining === 0) {
    await db.prepare(
      "UPDATE campaigns SET status='sent', finished_at=? WHERE id=?"
    ).bind(Date.now(), params.id).run();
    await logEvent(db, 'campaign_finished', null, params.id, 'admin', { sent, failed, skipped });
  }

  return json({
    ok: true,
    batch: { sent, failed, skipped, errors: errors.slice(0, 10) },
    remaining,
    finished: remaining === 0,
    dryRun
  });
}
