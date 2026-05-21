// GET /api/admin/export — CSV download
// Protected by X-Admin-Key
// Query: status=active (default 'all')

import { requireAdmin } from '../../_lib.js';

export async function onRequestGet({ request, env }) {
  const guard = requireAdmin(request, env);
  if (guard) return guard;

  const db = env.DB;
  if (!db) return new Response('database_not_configured', { status: 503 });

  const u = new URL(request.url);
  const status = u.searchParams.get('status') || '';

  const where = status ? 'WHERE status = ?' : '';
  const args = status ? [status] : [];

  const rows = await db.prepare(
    `SELECT email, status, source, lang, route, region, created_at, confirmed_at, unsubscribed_at, tags, notes
     FROM subscribers ${where} ORDER BY created_at DESC`
  ).bind(...args).all();

  const headers = ['email', 'status', 'source', 'lang', 'route', 'region', 'created_at', 'confirmed_at', 'unsubscribed_at', 'tags', 'notes'];
  const csvEsc = v => {
    if (v == null) return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const fmtDate = ts => ts ? new Date(ts).toISOString() : '';

  const lines = [headers.join(',')];
  for (const r of rows.results || []) {
    lines.push([
      csvEsc(r.email),
      csvEsc(r.status),
      csvEsc(r.source),
      csvEsc(r.lang),
      csvEsc(r.route),
      csvEsc(r.region),
      csvEsc(fmtDate(r.created_at)),
      csvEsc(fmtDate(r.confirmed_at)),
      csvEsc(fmtDate(r.unsubscribed_at)),
      csvEsc(r.tags),
      csvEsc(r.notes)
    ].join(','));
  }
  // BOM for Excel UTF-8 compatibility
  const csv = '\uFEFF' + lines.join('\r\n');
  const filename = `crh-subscribers-${new Date().toISOString().slice(0, 10)}${status ? '-' + status : ''}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store'
    }
  });
}
