// Shared helpers used by both /test and /send endpoints.
// Note: ES module re-exports work in Cloudflare Pages Functions.

// Pick which language version to use for a given subscriber
// Returns { subject, body, lang } or null if no usable content
export function pickLangContent(campaign, subscriberLang) {
  const langMap = {
    'zh':    { s: 'subject_zh',    b: 'body_zh' },
    'zh-TW': { s: 'subject_zh_tw', b: 'body_zh_tw' },
    'en':    { s: 'subject_en',    b: 'body_en' },
    'ko':    { s: 'subject_ko',    b: 'body_ko' }
  };

  // Try subscriber's lang first
  const tryLang = (l) => {
    const m = langMap[l];
    if (!m) return null;
    const subject = campaign[m.s];
    const body = campaign[m.b];
    if (subject && body) return { subject, body, lang: l };
    return null;
  };

  return tryLang(subscriberLang)
      || tryLang(campaign.fallback_lang)
      || tryLang('en')  // global fallback chain
      || tryLang('zh');
}

// Wrap raw body content into email-safe HTML.
// Supports both: (a) raw HTML (passes through with light sanitization)
//                (b) markdown-lite (## headers, **bold**, lists, links)
export function wrapBodyHtml(rawBody, { lang }) {
  if (!rawBody) return '';
  const trimmed = rawBody.trim();
  const looksLikeHtml = trimmed.startsWith('<') &&
    /<(h[1-6]|p|div|ul|ol|table|blockquote|pre)\b/i.test(trimmed);

  let html;
  if (looksLikeHtml) {
    // Sanitize: strip dangerous tags + event handlers
    html = rawBody
      .replace(/<(script|style|iframe|object|embed|svg|form|input|button)[\s\S]*?<\/\s*\1\s*>/gi, '')
      .replace(/<(script|style|iframe|object|embed|svg|form|input|button)\b[^>]*\/?>/gi, '')
      .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/(href|src)\s*=\s*("|')\s*(javascript|data|vbscript):/gi, '$1=$2#blocked-');
  } else {
    // Lightweight markdown → HTML
    html = mdLite(rawBody);
  }

  // Inline-style helpers (email clients ignore <style>; need style="" attrs)
  // Replace bare tags with styled versions
  html = html
    .replace(/<h2(?=[\s>])/gi, '<h2 style="margin:24px 0 12px;font-size:22px;font-weight:700;color:#0a0e1a;line-height:1.3"')
    .replace(/<h3(?=[\s>])/gi, '<h3 style="margin:20px 0 10px;font-size:18px;font-weight:700;color:#0a0e1a;line-height:1.35"')
    .replace(/<h4(?=[\s>])/gi, '<h4 style="margin:18px 0 8px;font-size:16px;font-weight:700;color:#0a0e1a"')
    .replace(/<p(?=[\s>])/gi, '<p style="margin:0 0 14px;color:#3d4659;line-height:1.7;font-size:15.5px"')
    .replace(/<ul(?=[\s>])/gi, '<ul style="margin:0 0 14px;padding-left:22px;color:#3d4659"')
    .replace(/<ol(?=[\s>])/gi, '<ol style="margin:0 0 14px;padding-left:22px;color:#3d4659"')
    .replace(/<li(?=[\s>])/gi, '<li style="margin:6px 0;line-height:1.65"')
    .replace(/<blockquote(?=[\s>])/gi, '<blockquote style="margin:14px 0;padding:12px 18px;border-left:3px solid #2ecf90;background:#f4faf7;color:#3d4659;border-radius:6px"')
    .replace(/<table(?=[\s>])/gi, '<table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:14px 0;font-size:14px"')
    .replace(/<th(?=[\s>])/gi, '<th style="background:#eef1f7;color:#0a0e1a;padding:10px 12px;text-align:left;font-weight:700;border:1px solid #e0e5ee;font-size:13px"')
    .replace(/<td(?=[\s>])/gi, '<td style="padding:10px 12px;border:1px solid #e0e5ee;color:#3d4659"')
    .replace(/<code(?=[\s>])/gi, '<code style="background:#eef1f7;color:#0a0e1a;padding:2px 6px;border-radius:4px;font-family:Menlo,Consolas,monospace;font-size:13px"')
    .replace(/<a (?![^>]*style=)/gi, '<a style="color:#2ecf90;text-decoration:underline;font-weight:600" ')
    // First tag: force no top margin so it hugs the header
    .replace(/(<(?:h[1-6]|p)[^>]*) style="margin:[\d ]+(px;)/i, '$1 style="margin:0 0 14px;$2');

  // Make affiliate links open in new tab (most email apps open external links anyway, harmless)
  html = html.replace(/<a ([^>]*?href="https?:\/\/[^"]*"[^>]*?)>/gi, (m, attrs) => {
    if (/target=/i.test(attrs)) return m;
    return `<a ${attrs} target="_blank" rel="noopener noreferrer nofollow">`;
  });

  return html;
}

// Minimal markdown → HTML (handles the common cases)
function mdLite(md) {
  // Escape HTML first to prevent injection
  let h = md.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // Headers
  h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  h = h.replace(/^# (.+)$/gm, '<h2>$1</h2>');

  // Bold + italic
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

  // Links [text](url)
  h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Inline code `code`
  h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // Lists (group consecutive - lines)
  h = h.replace(/((?:^- .+\n?)+)/gm, (m) => {
    const items = m.trim().split('\n').map(l => '<li>' + l.replace(/^- /, '') + '</li>').join('');
    return '<ul>' + items + '</ul>\n';
  });
  h = h.replace(/((?:^\d+\. .+\n?)+)/gm, (m) => {
    const items = m.trim().split('\n').map(l => '<li>' + l.replace(/^\d+\. /, '') + '</li>').join('');
    return '<ol>' + items + '</ol>\n';
  });

  // Paragraphs (lines separated by blank lines, not already in tag)
  h = h.split(/\n{2,}/).map(block => {
    block = block.trim();
    if (!block) return '';
    if (/^<(h[1-6]|ul|ol|blockquote|pre|table)/i.test(block)) return block;
    return '<p>' + block.replace(/\n/g, '<br>') + '</p>';
  }).join('\n');

  return h;
}
