// SPA fallback via Cloudflare Pages Functions
// - Admin path → admin HTML
// - /api/* and /u/* → handled by their own Function files (skip via passthrough)
// - Files with extension → serve as-is (static asset)
// - All other paths → index.html (SPA takes over routing)

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Admin path (with or without .html) → serve admin HTML
  if (path === '/mgr-7a9f3c2e' || path === '/mgr-7a9f3c2e.html') {
    return env.ASSETS.fetch(new URL('/mgr-7a9f3c2e.html', request.url));
  }

  // API endpoints + unsubscribe pages → let their own Functions handle
  if (path.startsWith('/api/') || path.startsWith('/u/')) {
    return next();
  }

  // Files with extension → serve as-is (let static handler take over)
  if (/\.[a-zA-Z0-9]+$/.test(path)) {
    return next();
  }

  // All other paths → serve index.html (SPA takes over routing)
  return env.ASSETS.fetch(new URL('/index.html', request.url));
}
