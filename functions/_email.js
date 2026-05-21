// Email sender — uses Resend.com (recommended, free 3000/mo, 100/day)
// Set env.RESEND_API_KEY = "re_..." in Cloudflare Pages settings
// Set env.FROM_EMAIL = "newsletter@cryptorebatehub.com" (must be verified domain in Resend)
// Set env.FROM_NAME  = "CryptoRebateHub"
//
// Why Resend: simplest API, generous free tier, transactional + marketing combined.
// To switch to Mailgun/SendGrid/SES: replace sendEmail() body.

export async function sendEmail({ to, subject, html, text, from, fromName, replyTo, headers }, env) {
  if (!env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured — see db/README.md section 8');
  }
  const fromAddr = from || env.FROM_EMAIL || 'newsletter@cryptorebatehub.com';
  const fromN = fromName || env.FROM_NAME || 'CryptoRebateHub';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + env.RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${fromN} <${fromAddr}>`,
      to: [to],
      subject,
      html,
      text: text || stripHtml(html),
      reply_to: replyTo,
      headers: headers || {}
    })
  });
  if (!r.ok) {
    const errBody = await r.text();
    throw new Error(`Resend HTTP ${r.status}: ${errBody.slice(0, 240)}`);
  }
  return await r.json();
}

// ─── Strip HTML for text fallback (improves deliverability) ─────
export function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── Responsive HTML email template ─────────────────────────────
// Inline CSS only (email clients strip <style>). Uses a centered 600px max-width layout.
// Compatible with Gmail / Outlook / Apple Mail / Yahoo.
export function renderEmailTemplate({ subject, bodyHtml, unsubUrl, lang, brandUrl, year }) {
  const L = (en, zh, tw, ko) => lang === 'en' ? en : lang === 'zh-TW' ? tw : lang === 'ko' ? ko : zh;
  const footUnsub = L(
    "If you no longer wish to receive these emails, you can",
    "如果你不想再收到这些邮件，可以",
    "如果你不想再收到這些郵件，可以",
    "이 이메일을 더 이상 받지 않으려면"
  );
  const footUnsubLink = L("unsubscribe here", "点此退订", "點此退訂", "여기서 구독 취소");
  const footWhy = L(
    "You are receiving this because you subscribed to CryptoRebateHub.",
    "你收到此邮件是因为订阅了 CryptoRebateHub。",
    "你收到此郵件是因為訂閱了 CryptoRebateHub。",
    "CryptoRebateHub에 구독하셨기 때문에 이 이메일을 받았습니다."
  );
  const tagline = L(
    "Crypto exchange rebates · transparent comparisons",
    "加密交易所返佣 · 真实评测",
    "加密交易所返佣 · 真實評測",
    "암호화폐 거래소 리베이트 · 투명한 비교"
  );

  // The HTML below uses table-based layout (best for email clients)
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${escHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f7f8fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',Arial,sans-serif;line-height:1.6;color:#0a0e1a;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f7f8fb;">
<tr><td align="center" style="padding:24px 12px;">

<!-- Card -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(10,14,26,.06);">

<!-- Header -->
<tr><td style="padding:24px 28px 20px;background:linear-gradient(135deg,#0a0c14 0%,#11141d 100%);">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td style="vertical-align:middle;">
<a href="${brandUrl}" style="text-decoration:none;color:#ffffff;font-weight:800;font-size:18px;letter-spacing:-.3px;">
<span style="display:inline-block;width:30px;height:30px;background:linear-gradient(135deg,#2ecf90,#1fb377);color:#0a0c14;text-align:center;line-height:30px;border-radius:7px;margin-right:9px;vertical-align:middle;font-weight:900;">R</span>CryptoRebateHub
</a>
<div style="color:#a3a9bb;font-size:12px;margin-top:4px;letter-spacing:.4px;">${escHtml(tagline)}</div>
</td>
</tr>
</table>
</td></tr>

<!-- Body -->
<tr><td style="padding:32px 28px 24px;color:#0a0e1a;font-size:15.5px;line-height:1.7;">
${bodyHtml}
</td></tr>

<!-- Footer -->
<tr><td style="padding:20px 28px 28px;border-top:1px solid #eef1f7;background:#fafbfd;">
<p style="margin:0 0 8px;font-size:12px;color:#6a7385;line-height:1.6;">
${escHtml(footWhy)}
</p>
<p style="margin:0 0 8px;font-size:12px;color:#6a7385;line-height:1.6;">
${escHtml(footUnsub)} <a href="${unsubUrl}" style="color:#2ecf90;text-decoration:underline;">${escHtml(footUnsubLink)}</a>.
</p>
<p style="margin:0;font-size:11px;color:#9ba2b3;line-height:1.5;">
© ${year} CryptoRebateHub · <a href="${brandUrl}/disclosure" style="color:#9ba2b3;text-decoration:underline;">Disclosure</a> · <a href="${brandUrl}/about" style="color:#9ba2b3;text-decoration:underline;">About</a>
</p>
</td></tr>

</table>
<!-- /Card -->

<p style="margin:18px 0 0;font-size:11px;color:#9ba2b3;text-align:center;">CryptoRebateHub.com · Independent crypto exchange information hub</p>

</td></tr>
</table>
</body>
</html>`;
}

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
