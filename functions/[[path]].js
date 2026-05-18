// SPA fallback via Cloudflare Pages Functions
// Catches all routes, serves index.html for unknown paths.
// Static assets (.html, .json, .xml, .txt, .js, .css, images) pass through.
// Admin paths serve the admin HTML directly.

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Admin path (with or without .html) → serve admin HTML
  if (path === '/mgr-7a9f3c2e' || path === '/mgr-7a9f3c2e.html') {
    return env.ASSETS.fetch(new URL('/mgr-7a9f3c2e.html', request.url));
  }

  // Files with extension → serve as-is (let static handler take over)
  if (/\.[a-zA-Z0-9]+$/.test(path)) {
    return next();
  }

  // All other paths → serve index.html (SPA takes over routing)
  return env.ASSETS.fetch(new URL('/index.html', request.url));
}
