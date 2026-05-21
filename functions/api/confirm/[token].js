// GET /api/confirm/[token]
// Public — verifies confirm_token, marks subscriber as 'active', clears the token.
// Returns a friendly HTML landing page.

import { html, logEvent } from '../../_lib.js';

export async function onRequestGet({ params, env, request }) {
  const db = env.DB;
  const token = params.token;
  if (!db || !token) return html(page('error', 'Invalid request'), 400);

  const row = await db.prepare(
    'SELECT id, email, status FROM subscribers WHERE confirm_token=?'
  ).bind(token).first();

  if (!row) return html(page('expired', 'This confirmation link has expired or already been used.'), 410);

  if (row.status === 'active') {
    return html(page('already', 'Your email is already confirmed. Thanks!'));
  }

  await db.prepare(
    'UPDATE subscribers SET status=?, confirmed_at=?, confirm_token=NULL WHERE id=?'
  ).bind('active', Date.now(), row.id).run();

  const ip = request.headers.get('cf-connecting-ip') || '';
  await logEvent(db, 'confirm', row.id, row.email, ip);

  return html(page('ok', 'Subscription confirmed! Thanks for joining.'));
}

function page(kind, msg) {
  const isOk = kind === 'ok' || kind === 'already';
  const color = isOk ? '#2ecf90' : '#f6536a';
  const emoji = kind === 'ok' ? '🎉' : kind === 'already' ? '✓' : '⚠';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${isOk ? 'Confirmed' : 'Confirmation'} · CryptoRebateHub</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#0a0c14;color:#ecedf2;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.box{max-width:480px;background:#11141d;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:48px 32px;text-align:center}
.em{font-size:60px;margin-bottom:18px}
h1{margin:0 0 12px;font-size:24px;color:${color}}p{color:#a3a9bb;line-height:1.6;margin:0 0 28px}
.bt{display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#2ecf90,#1fb377);color:#0a0c14;border-radius:10px;font-weight:700;text-decoration:none}
.bt:hover{filter:brightness(1.1)}
</style></head><body>
<div class="box">
<div class="em">${emoji}</div>
<h1>${kind === 'ok' ? '🎉 Confirmed' : kind === 'already' ? 'Already Confirmed' : 'Oops'}</h1>
<p>${msg}</p>
<a href="/" class="bt">← Back to CryptoRebateHub</a>
</div>
</body></html>`;
}
