# 📧 Cloudflare D1 Newsletter + Multi-Language Campaign System

完整自主邮件订阅 + 群发系统 — Cloudflare Workers + D1 + Pages Functions + Resend.com

## 0. 系统能力总览

| 模块 | 状态 | 说明 |
|---|---|---|
| 订阅收集 | ✅ | 前台表单 POST `/api/subscribe` → 写入 D1 |
| 订阅管理（CRUD）| ✅ | 后台「📧 订阅管理」子页面 |
| 退订流程 | ✅ | 一键退订 `/u/[token]`，GDPR/CAN-SPAM 合规 |
| 双重确认（可选）| ✅ | `AUTO_CONFIRM=false` 时启用 |
| 速率限制 | ✅ | 每 IP 每小时 5 次 |
| **多语言群发** | ✅ | **后台「📨 邮件群发」子页面** |
| **测试邮件** | ✅ | 群发前发给自己确认 |
| **按语言精准推送** | ✅ | 订阅者 `lang` 自动匹配版本 |
| **进度追踪** | ✅ | 批量发送，每批 25-50 |
| CSV 导出 | ✅ | UTF-8 BOM，Excel 友好 |

## 1. 部署步骤（~15 分钟）

### 1.1 Wrangler
```bash
npm install -g wrangler
wrangler login
```

### 1.2 创建 D1
```bash
cd /Users/admin/Desktop/cryptorebatehub-site
wrangler d1 create crh-newsletter
```

### 1.3 初始化 5 张表
```bash
wrangler d1 execute crh-newsletter --file=db/schema.sql --remote
```

## 2. Cloudflare Pages 配置

进入 Pages 项目 → **Settings → Functions**

### 2.1 D1 绑定
- Variable name: `DB`（硬编码）
- D1 database: 选 `crh-newsletter`

### 2.2 环境变量（Production）

| 变量 | 必需 | 示例 |
|---|---|---|
| `ADMIN_KEY` | ✅ | `crh-admin-Xk9mQ2Lp7VnR3jWt` |
| `HASH_SALT` | ✅ | `salt-2026-crh-d8jK3Lp` |
| `AUTO_CONFIRM` | ✅ | `true` |
| `RESEND_API_KEY` | 群发必需 | `re_XXXXXXXX` |
| `FROM_EMAIL` | 群发必需 | `newsletter@cryptorebatehub.com` |
| `FROM_NAME` | 推荐 | `CryptoRebateHub` |

强密码：`openssl rand -base64 24`

## 3. Resend.com 配置（群发必需）

### 3.1 注册 + API Key
1. https://resend.com → Sign Up
2. Dashboard → API Keys → Create
3. `re_XXX` 填入 Cloudflare 的 `RESEND_API_KEY`

### 3.2 验证域名（必做！）
1. Resend → Domains → Add Domain → `cryptorebatehub.com`
2. 复制 3 条 DNS 记录到 Cloudflare DNS：
   - MX record
   - TXT (SPF)
   - TXT (DKIM)
3. 等 5-15 分钟 → 点 Verify

### 3.3 免费额度
- 3000 封/月 + 100 封/天
- 超出 $20/月（50,000 封）

## 4. 使用流程：多语言群发

### 4.1 工作流
```
新建邮件 → 编辑 4 语言版本 → 发测试邮件 → 立即群发
```

### 4.2 详细步骤

1. **后台 `/mgr-7a9f3c2e` → 「📨 邮件群发」**

2. **点「+ 新建邮件」** → 输入内部名称

3. **编辑 4 语言版本**（顶部标签页切换）
   - 🇨🇳 简中 / 🇹🇼 繁中 / 🇬🇧 EN / 🇰🇷 한국어
   - 每个语言：标题 + 正文（Markdown 或 HTML）
   - ✓ = 已撰写，○ = 未撰写

4. **顶部预览收件人**
   - 显示每种语言订阅者数量
   - 「将收到：N 人 · 跳过：M 人」

5. **高级设置**（可选）
   - 发件人 / Reply-To / 备用语言

6. **预览**（新窗口）

7. **发测试邮件**（强烈推荐）
   - 输入你自己邮箱 → 检查渲染

8. **立即群发**
   - 每批 25-50，自动连续发送
   - 进度：✓ 已发 / ✗ 失败 / ⊘ 跳过

### 4.3 多语言精准匹配

```
订阅者 A（lang=zh）→ 发中文版
订阅者 B（lang=ko）→ 发韩文版
订阅者 C（lang=es，无西语版）→
  - 若设 fallback_lang=en → 发英文版
  - 否则 → 跳过（不会乱发）
```

### 4.4 邮件包含

- ✅ 品牌深色头部（CryptoRebateHub Logo）
- ✅ 4 语言本地化页脚 + 退订链接
- ✅ List-Unsubscribe 头（RFC 8058 一键退订，Gmail 支持）
- ✅ Reply-To 可定制
- ✅ UTF-8 编码

## 5. API 端点参考

| 端点 | 方法 | 权限 |
|---|---|---|
| `/api/subscribe` | POST | 公开（IP 限流）|
| `/api/confirm/[token]` | GET | 公开 |
| `/u/[token]` | GET/POST | 公开 |
| `/api/admin/subscribers` | GET/POST/PATCH/DELETE | Admin Key |
| `/api/admin/stats` | GET | Admin Key |
| `/api/admin/export` | GET | Admin Key |
| `/api/admin/campaigns` | GET/POST | Admin Key |
| `/api/admin/campaigns/[id]` | GET/PATCH/DELETE | Admin Key |
| `/api/admin/campaigns/[id]/test` | POST | Admin Key |
| `/api/admin/campaigns/[id]/send` | POST | Admin Key |

## 6. 故障排查

| 现象 | 解决 |
|---|---|
| `database_not_configured` | D1 没绑定 → 变量名必须是 `DB` |
| `Admin Key 错误` | 检查 ADMIN_KEY 在 Production env |
| `resend_not_configured` | RESEND_API_KEY 未设置 |
| 邮件进垃圾箱 | 完成 3.2 域名验证 |
| 测试邮件没收到 | Resend 沙盒模式 → 验证域名 |
| 群发卡住 | 点「继续发送」继续下批 |

## 7. 数据备份

```bash
# 全量备份
wrangler d1 export crh-newsletter --output=backup.sql --remote

# 按语言统计活跃订阅
wrangler d1 execute crh-newsletter --remote \
  --command="SELECT lang, COUNT(*) FROM subscribers WHERE status='active' GROUP BY lang"

# 最近 20 条活动
wrangler d1 execute crh-newsletter --remote \
  --command="SELECT * FROM activity_log ORDER BY ts DESC LIMIT 20"
```

## 8. 切换其他邮件服务商

改 `functions/_email.js` 的 `sendEmail()` 函数：

### Mailgun
```javascript
const r = await fetch(`https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`, {
  method: 'POST',
  headers: { 'Authorization': 'Basic ' + btoa('api:' + env.MAILGUN_API_KEY) },
  body: new URLSearchParams({ from: fromAddr, to, subject, html, text })
});
```

### SendGrid
```javascript
const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + env.SENDGRID_API_KEY },
  body: JSON.stringify({
    personalizations: [{ to: [{ email: to }] }],
    from: { email: fromAddr, name: fromN },
    subject, content: [{ type: 'text/html', value: html }]
  })
});
```

## 9. 成本

| 服务 | 免费额度 | 成本 |
|---|---|---|
| Cloudflare D1 | 10万写/月 | $0 |
| Cloudflare Pages Functions | 100k 次/天 | $0 |
| Resend.com | 3000 封/月 | $0 |

**总计：$0/月**（10 万订阅 + 3000 封邮件/月内完全免费）
