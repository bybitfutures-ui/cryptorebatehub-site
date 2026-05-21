// POST /api/admin/campaigns/[id]/test
// Body: { email: "admin@example.com", lang: "zh" }
// Sends ONE test email (with simulated unsub link) so admin can preview before bulk send.
// Protected by X-Admin-Key

import { requireAdmin, validateEmail, json, CORS } from '../../../../_lib.js';
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

  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }

  const to = validateEmail(body.email);
  if (!to) return json({ error: 'invalid_email' }, 400);
  const lang = body.lang || 'zh';

  const c = await db.prepare('SELECT * FROM campaigns WHERE id = ?').bind(params.id).first();
  if (!c) return json({ error: 'campaign_not_found' }, 404);

  // Pick content for requested lang (with fallback)
  const picked = pickLangContent(c, lang);
  if (!picked) return json({ error: 'no_content_for_lang', lang }, 400);

  const origin = new URL(request.url).origin;
  const unsubUrl = `${origin}/u/TEST_TOKEN_PREVIEW`;
  const bodyHtml = wrapBodyHtml(picked.body, { lang: picked.lang });

  const html = renderEmailTemplate({
    subject: '[TEST] ' + picked.subject,
    bodyHtml,
    unsubUrl,
    lang: picked.lang,
    brandUrl: origin,
    year: new Date().getFullYear()
  });

  try {
    const result = await sendEmail({
      to,
      subject: '[TEST] ' + picked.subject,
      html,
      replyTo: c.reply_to || undefined,
      from: c.from_email || undefined,
      fromName: c.from_name || undefined,
      headers: { 'X-Entity-Ref-ID': 'test-' + c.id }
    }, env);
    return json({ ok: true, message: 'test_sent', externalId: result.id, lang: picked.lang });
  } catch (e) {
    return json({ error: 'send_failed', detail: e.message }, 502);
  }
}
