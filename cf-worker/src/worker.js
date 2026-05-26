/**
 * CryptoRebateHub · IndexNow Auto-Push Worker
 * Endpoints: GET /trigger, GET /status, GET /history
 * Cron: weekly Monday 09:00 UTC
 * Reports to: Logs, KV, Webhook, GA4
 */

const DOMAIN = 'cryptorebatehub.com';
const API_KEY = 'j38dduk5szf1eqf77h39j39lv1c39sew';
const SITEMAP_URL = `https://${DOMAIN}/sitemap.xml`;
const KEY_LOCATION = `https://${DOMAIN}/${API_KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const BATCH_SIZE = 10000;
const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const WORKER_CLIENT_ID = 'cf-worker-indexnow-cron';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Trigger-Key, X-Trigger-Source',
};

export default {
  async scheduled(controller, env, ctx) {
    console.log(`[cron] ${controller.cron} @ ${new Date(controller.scheduledTime).toISOString()}`);
    ctx.waitUntil(pushToIndexNow(env, 'scheduled'));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    if (url.pathname === '/status') {
      const last = await env.INDEXNOW_KV?.get('last_run', 'json');
      return Response.json(last || { message: 'No runs yet' }, {
        headers: { 'Cache-Control': 'no-store', ...CORS },
      });
    }

    if (url.pathname === '/history') {
      const history = await env.INDEXNOW_KV?.get('history', 'json');
      return Response.json(Array.isArray(history) ? history : [], {
        headers: { 'Cache-Control': 'no-store', ...CORS },
      });
    }

    if (url.pathname === '/' || url.pathname === '/trigger') {
      const providedKey = url.searchParams.get('key') || request.headers.get('X-Trigger-Key');
      if (env.TRIGGER_SECRET && providedKey !== env.TRIGGER_SECRET) {
        return new Response('Forbidden', { status: 403, headers: CORS });
      }
      const isCI = request.headers.get('X-Trigger-Source') === 'github-action' ||
                   (request.headers.get('User-Agent') || '').includes('GitHub-Actions');
      const triggerType = isCI ? 'post_deploy' : 'manual';
      const result = await pushToIndexNow(env, triggerType);
      return Response.json(result, {
        headers: { 'Cache-Control': 'no-store', ...CORS },
      });
    }

    return new Response('IndexNow Worker — see /status /history /trigger', {
      headers: { 'Content-Type': 'text/plain', ...CORS },
    });
  },
};

async function pushToIndexNow(env, triggerType) {
  const startTime = Date.now();
  const result = {
    triggerType, timestamp: new Date().toISOString(),
    success: false, urlCount: 0, batchCount: 0, durationMs: 0,
    error: null, httpStatuses: [],
  };

  try {
    const keyResp = await fetch(KEY_LOCATION, { cf: { cacheTtl: 0 } });
    if (!keyResp.ok) throw new Error(`Key file HTTP ${keyResp.status}`);
    const keyContent = (await keyResp.text()).trim();
    if (keyContent !== API_KEY) throw new Error('Key content mismatch');

    const smResp = await fetch(SITEMAP_URL, { cf: { cacheTtl: 0 } });
    if (!smResp.ok) throw new Error(`Sitemap HTTP ${smResp.status}`);
    const smXml = await smResp.text();
    const urls = [...smXml.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g)]
      .map(m => m[1]).filter(u => u.includes(DOMAIN));
    const uniqueUrls = [...new Set(urls)];
    result.urlCount = uniqueUrls.length;
    if (!uniqueUrls.length) throw new Error('Empty sitemap');

    const batches = [];
    for (let i = 0; i < uniqueUrls.length; i += BATCH_SIZE) {
      batches.push(uniqueUrls.slice(i, i + BATCH_SIZE));
    }
    result.batchCount = batches.length;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const resp = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host: DOMAIN, key: API_KEY, keyLocation: KEY_LOCATION, urlList: batch,
        }),
      });
      const status = resp.status;
      const bodyText = await resp.text().catch(() => '');
      result.httpStatuses.push({ batch: i + 1, urls: batch.length, status, body: bodyText.slice(0, 200) });
      console.log(`[submit] batch ${i + 1}: HTTP ${status}`);
    }

    result.success = result.httpStatuses.every(s => s.status === 200 || s.status === 202);
    result.durationMs = Date.now() - startTime;
  } catch (err) {
    result.error = err.message || String(err);
    result.durationMs = Date.now() - startTime;
    console.error(`[error] ${result.error}`);
  }

  if (env.INDEXNOW_KV) {
    await env.INDEXNOW_KV.put('last_run', JSON.stringify(result), { expirationTtl: 86400 * 30 });
    try {
      const histRaw = await env.INDEXNOW_KV.get('history', 'json');
      const history = Array.isArray(histRaw) ? histRaw : [];
      history.unshift({
        timestamp: result.timestamp, triggerType: result.triggerType,
        success: result.success, urlCount: result.urlCount,
        durationMs: result.durationMs, error: result.error,
      });
      await env.INDEXNOW_KV.put('history', JSON.stringify(history.slice(0, 30)), { expirationTtl: 86400 * 365 });
    } catch (e) { console.warn('[kv] history failed:', e.message); }
  }

  if (!result.success && env.NOTIFY_WEBHOOK) {
    await fetch(env.NOTIFY_WEBHOOK, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `🚨 IndexNow FAILED\n\`\`\`${JSON.stringify(result, null, 2).slice(0, 1800)}\`\`\`` }),
    }).catch(e => console.error('[notify]', e));
  }

  if (env.GA4_MEASUREMENT_ID && env.GA4_API_SECRET) {
    await reportToGA4(env, result).catch(e => console.error('[ga4]', e));
  }

  console.log(`[done] success=${result.success} ${result.durationMs}ms`);
  return result;
}

async function reportToGA4(env, result) {
  const url = `${GA4_ENDPOINT}?measurement_id=${env.GA4_MEASUREMENT_ID}&api_secret=${env.GA4_API_SECRET}`;
  const payload = {
    client_id: WORKER_CLIENT_ID,
    non_personalized_ads: true,
    events: [{
      name: 'indexnow_push',
      params: {
        trigger_type: result.triggerType,
        push_success: result.success ? 'true' : 'false',
        url_count: result.urlCount,
        batch_count: result.batchCount,
        duration_ms: result.durationMs,
        error_message: result.error ? String(result.error).slice(0, 100) : '',
        engagement_time_msec: 100,
        session_id: Math.floor(Date.now() / 1000),
      },
    }],
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (resp.ok) console.log(`[ga4] HTTP ${resp.status}`);
}
