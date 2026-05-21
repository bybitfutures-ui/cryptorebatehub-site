// GET /u/[token]
// One-click unsubscribe via emailed token. Works with no auth.
// Shows a confirmation page; POST to actually unsub (to avoid email scanners triggering it).
//
// GET  → render confirmation page with "Unsubscribe" button
// POST → mark subscriber as 'unsubscribed', then show success page

import { html, logEvent } from '../_lib.js';

export async function onRequestGet({ params, env, request }) {
  return handle(params, env, request, false);
}

export async function onRequestPost({ params, env, request }) {
  return handle(params, env, request, true);
}

async function handle(params, env, request, doUnsub) {
  const db = env.DB;
  const token = params.token;
  if (!db || !token) return html(page('error', 'Invalid request'), 400);

  const row = await db.prepare(
    'SELECT id, email, status FROM subscribers WHERE unsub_token=?'
  ).bind(token).first();

  if (!row) return html(page('notfound', 'This link is invalid or already used.'), 404);

  if (row.status === 'unsubscribed') {
    return html(page('already', row.email, token, 'You have already unsubscribed.'));
  }

  if (doUnsub) {
    await db.prepare(
      'UPDATE subscribers SET status=?, unsubscribed_at=? WHERE id=?'
    ).bind('unsubscribed', Date.now(), row.id).run();
    const ip = request.headers.get('cf-connecting-ip') || '';
    await logEvent(db, 'unsubscribe', row.id, row.email, ip);
    return html(page('done', row.email, token));
  }

  // GET: show confirmation page
  return html(page('confirm', row.email, token));
}

function page(kind, emailOrMsg, token, msg) {
  const isError = ['error', 'notfound'].includes(kind);
  const tokenSafe = (token || '').replace(/[<>'"]/g, '');
  const emailSafe = String(emailOrMsg || '').replace(/[<>'"]/g, '');

  let body = '';
  if (kind === 'confirm') {
    body = `
<div class="em">📬</div>
<h1>Unsubscribe from CryptoRebateHub?</h1>
<p>You're about to unsubscribe <strong>${emailSafe}</strong> from CryptoRebateHub newsletters.</p>
<form method="post" style="margin-top:24px">
  <button type="submit" class="bt bt-r">Yes, unsubscribe</button>
</form>
<p style="margin-top:18px;font-size:13px;color:#6f7588">
  Changed your mind? <a href="/" style="color:#2ecf90">Stay subscribed →</a>
</p>`;
  } else if (kind === 'done') {
    body = `
<div class="em">👋</div>
<h1>You've unsubscribed</h1>
<p>${emailSafe} has been removed from our newsletter.</p>
<p>Sorry to see you go. If you ever want to come back:</p>
<a href="/" class="bt">Visit CryptoRebateHub</a>`;
  } else if (kind === 'already') {
    body = `
<div class="em">✓</div>
<h1>Already unsubscribed</h1>
<p>${emailSafe} is no longer subscribed.</p>
<a href="/" class="bt">Back to CryptoRebateHub</a>`;
  } else {
    body = `
<div class="em">⚠</div>
<h1>${kind === 'notfound' ? 'Link not valid' : 'Error'}</h1>
<p>${emailOrMsg || 'This link is invalid or has expired.'}</p>
<a href="/" class="bt">Back to CryptoRebateHub</a>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Unsubscribe · CryptoRebateHub</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#0a0c14;color:#ecedf2;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.box{max-width:480px;background:#11141d;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:48px 32px;text-align:center}
.em{font-size:54px;margin-bottom:12px}
h1{margin:0 0 12px;font-size:22px;color:#ecedf2}
p{color:#a3a9bb;line-height:1.65;margin:0 0 12px}
.bt{display:inline-block;padding:11px 24px;background:#2ecf90;color:#0a0c14;border-radius:10px;font-weight:700;text-decoration:none;border:none;cursor:pointer;font-size:14px;font-family:inherit}
.bt-r{background:#f6536a;color:#fff}
form{margin:0}
</style></head><body><div class="box">${body}</div></body></html>`;
}
