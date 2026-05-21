-- CryptoRebateHub Newsletter — Cloudflare D1 schema (v2: campaigns)
-- Run with: wrangler d1 execute crh-newsletter --file=db/schema.sql --remote

-- ─── Subscribers (existing) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT,
  lang TEXT,
  route TEXT,
  region TEXT,
  ip_hash TEXT,
  ua_hash TEXT,
  confirm_token TEXT,
  unsub_token TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  confirmed_at INTEGER,
  unsubscribed_at INTEGER,
  bounced_at INTEGER,
  last_sent_at INTEGER,
  tags TEXT,
  notes TEXT,
  meta TEXT
);
CREATE INDEX IF NOT EXISTS idx_email      ON subscribers(email);
CREATE INDEX IF NOT EXISTS idx_status     ON subscribers(status);
CREATE INDEX IF NOT EXISTS idx_created    ON subscribers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unsub      ON subscribers(unsub_token);
CREATE INDEX IF NOT EXISTS idx_confirm    ON subscribers(confirm_token);
CREATE INDEX IF NOT EXISTS idx_lang       ON subscribers(lang);
CREATE INDEX IF NOT EXISTS idx_ip_hash    ON subscribers(ip_hash);

-- ─── Rate limits (existing) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limits (
  ip_hash TEXT NOT NULL,
  action TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  window_start INTEGER NOT NULL,
  PRIMARY KEY (ip_hash, action, window_start)
);
CREATE INDEX IF NOT EXISTS idx_rl_window ON rate_limits(window_start);

-- ─── Activity log (existing) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  event TEXT NOT NULL,
  subscriber_id TEXT,
  email TEXT,
  ip_hash TEXT,
  meta TEXT
);
CREATE INDEX IF NOT EXISTS idx_log_ts    ON activity_log(ts DESC);
CREATE INDEX IF NOT EXISTS idx_log_event ON activity_log(event);
CREATE INDEX IF NOT EXISTS idx_log_email ON activity_log(email);

-- ═════════════════════════════════════════════════════════════
-- 📨 CAMPAIGNS — multi-language broadcast newsletters
-- ═════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                       -- internal name (admin only)
  status TEXT NOT NULL DEFAULT 'draft',     -- draft | sending | sent | paused | failed
  -- Per-language content (NULL if that language version not yet written)
  subject_zh    TEXT,  body_zh    TEXT,
  subject_zh_tw TEXT,  body_zh_tw TEXT,
  subject_en    TEXT,  body_en    TEXT,
  subject_ko    TEXT,  body_ko    TEXT,
  -- Sender override (defaults to env.FROM_EMAIL)
  from_name  TEXT,
  from_email TEXT,
  reply_to   TEXT,
  -- Targeting filters
  target_status   TEXT DEFAULT 'active',    -- which subscriber.status to include
  target_tags     TEXT,                     -- optional: only send to subscribers with one of these tags
  fallback_lang   TEXT,                     -- if subscriber's lang has no content, use this lang ('' = skip)
  -- Stats
  recipients_total   INTEGER DEFAULT 0,
  recipients_sent    INTEGER DEFAULT 0,
  recipients_failed  INTEGER DEFAULT 0,
  recipients_skipped INTEGER DEFAULT 0,
  -- Timestamps
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER,
  started_at  INTEGER,
  finished_at INTEGER,
  meta TEXT
);
CREATE INDEX IF NOT EXISTS idx_camp_status  ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_camp_created ON campaigns(created_at DESC);

-- ─── Per-recipient send records (one row per subscriber per campaign) ────
CREATE TABLE IF NOT EXISTS campaign_sends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id   TEXT NOT NULL,
  subscriber_id TEXT NOT NULL,
  email         TEXT NOT NULL,
  lang          TEXT,
  status        TEXT NOT NULL,    -- queued | sent | failed | skipped | bounced
  sent_at       INTEGER,
  error         TEXT,
  external_id   TEXT,             -- ESP message ID (Resend response.id)
  UNIQUE(campaign_id, subscriber_id)
);
CREATE INDEX IF NOT EXISTS idx_cs_campaign ON campaign_sends(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_cs_email    ON campaign_sends(email);
