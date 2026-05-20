# CryptoRebateHub · v2026-05-18-html-articles-fix · 关键 Bug 修复

Build ID: `20260518-html-articles-fix`

## 🚨 修复严重 Bug：5 月文章显示原始 HTML 代码

### 问题诊断

用户反馈：3 篇 5 月新发文章（OKX/Binance/Bybit 注册教程）在所有 4 种语言下都显示**原始 HTML 代码**而非渲染后的内容：
```
<h2>📌 一图看懂...</h2>
<table>
<tr><th>对比项</th>...
```

### 根本原因（代码层）

文章 render 函数 `rArt()` 第 4163 行调用 `md2h(c)` 处理内容：
```js
<div class="apb">${md2h(c)}</div>
```

而 `md2h()` 第一行就是：
```js
m = es(m);  // ← BUG! 把 < > " 全部转义成 &lt; &gt; &quot;
```

这个函数原本是 markdown → HTML 转换器，先 `es()` 转义是为了防 XSS。但 3 月之后的新文章我们直接写了 HTML（而非 markdown），结果所有 HTML 标签都被转义成文本显示。

**影响范围**：3 篇文章 × 4 语言 = **12 处全部显示错误**（已验证）

### 修复方案

为 `md2h()` 增加智能检测层：

```js
function md2h(m){
  if(!m) return '';
  
  // 智能检测：内容是 HTML 还是 Markdown
  const htmlBlockPattern = /<(h[1-6]|p|div|table|ul|ol|blockquote|pre|...)\b/i;
  if (m.trim().startsWith('<') && htmlBlockPattern.test(m.trim())) {
    // HTML 路径：直接 pass-through + XSS 清洗 + 链接处理
    let h = m
      .replace(/<\s*(script|style|iframe|object|embed|form|input|button|svg).../gi, '')  // 移除危险标签
      .replace(/\s+on[a-z]+\s*=.../gi, '')  // 移除 onclick/onerror 等事件
      .replace(/(href|src)\s*=\s*["']\s*(javascript|data|vbscript):/gi, '$1=$2#blocked-');  // 阻止 js: data: URI
    // 内部链接自动添加 SPA 路由
    h = h.replace(/<a\s+([^>]*?)href=["'](\/[^"']*)["']/gi, '...go(...)...');
    // 外部链接自动 target=_blank + rel
    h = h.replace(/<a\s+...href=["'](https?:\/\/[^"']*)["']/gi, '...target=_blank rel=...');
    return h;
  }
  
  // Markdown 路径：保留原有逻辑（向后兼容）
  m = es(m);
  // ... 其余 markdown 处理
}
```

### 安全保障

修复同时增加了 XSS 防护：
- ❌ 阻止 `<script>` / `<iframe>` / `<object>` / `<embed>` / `<form>` / `<svg>` 标签
- ❌ 阻止所有 `on*=` 事件属性（`onclick`, `onerror`, `onload`...）
- ❌ 阻止 `href="javascript:..."` / `href="data:..."` / `href="vbscript:..."`
- ✅ 自动给内部链接 `/access-urls` 添加 SPA 路由
- ✅ 自动给外部链接添加 `target="_blank" rel="noopener noreferrer nofollow"`

### 验证测试（实际运行）

```
=== Test 1: HTML input ===
✓ Has <h2>:           true
✓ Has <table>:        true
✓ Has SPA onclick:    true (内部链接自动 SPA 化)
✓ NO escaped &lt;:    true (不再转义)

=== Test 2: Markdown input (legacy) ===
✓ Has <h2>:           true (## Header → <h2>Header</h2>)
✓ Has <strong>:       true (**bold** → <strong>bold</strong>)
✓ Has <ul>:           true (- item → <ul><li>item</li></ul>)

=== Test 3: XSS prevention ===
✓ NO <script>:        true
✓ NO onerror:         true
✓ Has <h2>:           true (合法 HTML 保留)
```

### 向后兼容

- ✅ 旧的 markdown 文章（用 `## 标题` `**粗体**` `- 列表`）仍然正常工作
- ✅ 新的 HTML 文章（用 `<h2>` `<table>` `<strong>`）现在正常渲染
- ✅ 混合内容（HTML 开头）按 HTML 处理

## 📊 影响范围（修复前 vs 修复后）

| 文章 | 修复前 | 修复后 |
|---|---|---|
| #3016 OKX 教程 (zh/zh-TW/en/ko) | ❌ 显示 `<h2>` 文本 | ✅ 渲染为标题 |
| #3017 Binance 教程 (zh/zh-TW/en/ko) | ❌ 显示 `<table>` 文本 | ✅ 渲染为表格 |
| #3018 Bybit 教程 (zh/zh-TW/en/ko) | ❌ 显示 `<p>` 文本 | ✅ 渲染为段落 |

## ✅ 完整状态

```
✓ JS:                 index 303KB / mgr 81KB (0 errors)
✓ 关键 Bug 修复:       md2h() 智能 HTML/Markdown 检测
✓ XSS 防护:            script/iframe/onclick/javascript: 全部拦截
✓ 翻译:               0 missing · 49 dropdown keys × 4 langs
✓ data-t attrs:       0 missing
✓ Schemas:            5/5 valid
✓ 真实链接:           HYPEKR / web3.binance.com / web3.okx.com DOGECOIN 全部 OK
✓ Build ID:           20260518-html-articles-fix
```

## 🚀 部署

```bash
cd /Users/admin/Desktop/cryptorebatehub-site
git add -A
git commit -m "v2026-05-18 html-articles-fix: critical bug — render HTML articles correctly"
git push origin main
```

部署后：
1. Cloudflare → **Purge Everything**（必须！否则旧版 JS 缓存仍在）
2. 跑 `~/indexnow-push.sh /article/okx-register-tutorial-2026-step-by-step /article/binance-register-tutorial-2026-step-by-step /article/bybit-register-tutorial-2026-step-by-step`

## 🧪 立即验证

部署完成 + 清缓存后，访问 3 篇文章的 4 种语言版本：

| URL | 应看到 |
|---|---|
| `/article/okx-register-tutorial-2026-step-by-step` | 渲染后的对比表、步骤标题、列表（不再是代码） |
| 切到英文 | 完整英文渲染版（4288 chars 内容） |
| 切到韩文 | 完整韩文渲染版（2897 chars 内容） |
| 切到繁中 | 完整繁体版（2707 chars 内容） |

每篇文章应看到：
- 📌 对比表（gross fee vs net fee）
- 🎯 适合人群列表
- 📋 5 步开户流程（带 h3 小标题）
- 🎁 返佣说明
- ❓ FAQ 折叠区
- 🚀 底部 CTA 注册按钮

文中所有内部链接（如 `/access-urls`）应能正常 SPA 跳转。
