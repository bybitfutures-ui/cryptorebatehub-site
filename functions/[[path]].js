// SPA fallback via Cloudflare Pages Functions
// Catches all routes, serves index.html for unknown paths
// Static assets (.html, .json, .xml, .txt, .js, .css, images) pass through

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Files with extension → serve as-is (let static handler take over)
  if (/\.[a-zA-Z0-9]+$/.test(path)) {
    return next();
  }

  // Admin path → serve admin HTML directly
  if (path.startsWith('/mgr-')) {
    return next();
  }

  // All other paths → serve index.html (SPA takes over routing)
  return env.ASSETS.fetch(new URL('/index.html', request.url));
}
