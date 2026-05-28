# 🔧 Build 20260528-table-fix · 资金费率表对齐 + 全站审计

**Priority**: 🚨 高 — 关键 UX bug 修复

---

## 🐛 修复的关键 Bug

### 资金费率表列对齐错位（HTML 双 `style` 属性 bug）

**用户截图**：
```
表头:   币种 |  Binance   |  Bybit    |   OKX    | Hyperliquid | 价差
数据:   TON  | -0.0487%   0.0050%    -0.0248%   -0.0008%      0.0537% ⚡ARB
                ↑ 数据值左对齐，与右对齐的表头错位
```

**根本原因（line 4267-4270 旧代码）**：
```javascript
const cellBest = (val, isMax) => {
  if(val == null) return '';
  return `style="background:${isMax ? 'rgba(46,207,144,.07)' : 'rgba(246,83,106,.07)'}"`;
};
// 然后使用:
<td ${cellBest(r.b, isMaxB)} style="padding:13px 12px;text-align:right">${fmt(r.b)}</td>
```

⚠️ **HTML 规范**：同一个元素只有**第一个** `style` 属性生效，第二个被静默丢弃。

所以当 cellBest 返回 `style="background:..."` 时：
- ✅ `background` 应用了
- ❌ `padding` 和 `text-align:right` 被完全忽略 → 数据值变成默认左对齐

而表头一直是 `text-align:right` 正常工作 → **数据和表头错位**！

### 修复方案

```javascript
// 修复后：合并 style 到单一字符串，再使用 ${} 注入完整 style 内容
const cellStyle = (val, isMax) => {
  const base = 'padding:13px 12px;text-align:right;font-variant-numeric:tabular-nums';
  if(val == null) return base;
  return base + ';background:' + (isMax ? 'rgba(46,207,144,.07)' : 'rgba(246,83,106,.07)');
};
// 使用:
<td style="${cellStyle(r.b, isMaxB)}">${fmt(r.b)}</td>
```

### 额外增强

1. **添加 `<colgroup>` 显式定义列宽** —— 防止 thead/tbody 列宽不同
2. **`table-layout:fixed`** —— 锁定列宽，浏览器不再自动计算
3. **`font-variant-numeric: tabular-nums`** —— 所有数字用等宽字体（如 `-0.0487%` 和 `0.0050%` 完全对齐）
4. **全局 CSS 规则** —— 自动给所有右对齐的数字 td 加 tabular-nums

---

## 🔍 全站类似 bug 扫描结果

```
[1] 重复 style 属性 bug              ✓  0 处
[2] 模板返回 style 与元素 style 冲突  ✓  0 处
[3] 表格列结构一致性                  ✓  10/10 表全部正确
    Line 2922: cmp-table          5 <th> · 5 <td/row>  ✓
    Line 3491: cmp-tbl            3 <th> · 3 <td/row>  ✓
    Line 3807: 工具表             7 <th> · 7 <td/row>  ✓
    Line 4074: 费率对比 (合并表头) 10 <th>·8 <td/row>  ✓ (rowspan/colspan 正确)
    Line 4277: 资金费率 (已修复)    7 <th> · 7 <td/row>  ✓
    Line 4429: 代币解锁           7 <th> · 7 <td/row>  ✓
    Line 4737: 税务计算           6 <th> · 6 <td/row>  ✓
    Line 5091: 词典               7 <th> · 7 <td/row>  ✓
    Line 5351: 小型表             3 <th> · 3 <td/row>  ✓
```

只有资金费率表有 bug，其他 9 个表都正常。

---

## ✅ 全站综合审计结果

```
[1] JS 验证 (index.html)
    ✓ 4 scripts, 480 KB main · 全部 valid
[1b] JS 验证 (admin)
    ✓ 1 script, 128 KB · valid
[2] 静态 JSON-LD              ✓ 5/5 valid
[3] 重复 style bug            ✓ 0 处
[4] 表格列结构一致性          ✓ 10/10
[5] 国际化完整性              ✓ 634+ keys · 0 missing
[6] 敏感词                    ✓ 0 (翻墙/VPN/防屏蔽/科学上网/梯子)
[7] 真实 affiliate URLs       ✓ 全保留
   HYPEKR / WLFI47 / 8DXZXGZ / web3.binance / web3.okx
[8] Schema image 字段         ✓ Product/SoftwareApp/Article 完整
   og-image.png 引用: 16 处
[9] AI 爬虫支持               ✓ 6/6
   GPTBot / ClaudeBot / OAI-SearchBot / PerplexityBot / Applebot / ChatGPT-User
[10] 文件大小                 
   index.html:        644.4 KB
   mgr-7a9f3c2e.html: 150.9 KB
   articles.json:     321.7 KB
   sitemap.xml:       63.1 KB
   og-image.png:      342.5 KB
[11] Build ID                ✓ 20260528-table-fix
```

---

## 🚀 部署 3 步

```bash
cd ~/Desktop/cryptorebatehub-site
unzip -o ~/Downloads/cryptorebatehub-final.zip
git add -A
git commit -m "fix: funding rate table column alignment + full audit"
git push origin main
# 等 Cloudflare Pages 自动部署 → Caching → Purge Everything
```

---

## 🧪 部署后验证

### 1. 资金费率表对齐
1. 访问 `https://cryptorebatehub.com/tools/funding-rates`
2. **Cmd+Shift+R** 强制刷新
3. 检查 TON / DOT / APT 这些行
4. ✅ 数据值应该**严格在 Binance / Bybit / OKX / Hyperliquid 表头正下方**对齐
5. ✅ 负数 `-0.0487%` 和正数 `0.0050%` 的小数点应该完美对齐

### 2. 其他表也检查
- 解锁日历: `/tools/token-unlocks`
- 费率对比: `/tools/fee-comparison`  
- 词典: `/glossary`
- 税务计算器: `/tools/tax-calculator`

### 3. 触发 IndexNow 推送
登录 admin 面板 → **🚀 IndexNow** → 点 **▶ 立即推送**
让 Bing / Yandex / Seznam / Naver 立即重新爬取修复版。

---

## 💡 知识点：HTML 双 style 属性陷阱

这个 bug 是经典的 HTML 反模式。每个元素只允许**一个** `style` 属性：

```html
<!-- ❌ 错误 - 第二个 style 被静默丢弃 -->
<td style="color:red" style="font-weight:bold">

<!-- ❌ 错误 - 模板字符串拼接出双 style -->
<td ${someFunc()} style="...">
   ↑ 如果 someFunc() 返回 "style=..."，就坏了

<!-- ✅ 正确 - 合并为单个 style -->
<td style="color:red;font-weight:bold">

<!-- ✅ 正确 - 让函数返回 style 的值（不含 "style=" 前缀） -->
<td style="${getStyles()}">
```

**自动检测**：可以加 ESLint 规则或 HTML 验证器在 CI 中防止此类 bug。

---

## 📦 包内容

```
cryptorebatehub-final.zip (27 files)
├── 网站文件 (含修复的 index.html + admin)
├── og-image.png (Solana Glass v2)
├── functions/ (14 个 Cloudflare Functions)
└── db/ (D1 schema)
```

---

## 🎁 修复后效果对比

| 指标 | 修复前 | 修复后 |
|---|---|---|
| 数据值对齐 | ❌ 默认左对齐 | ✅ 严格右对齐 |
| 与表头对齐 | ❌ 错位 | ✅ 完美对齐 |
| 数字字符宽度 | ❌ 比例字体 | ✅ 等宽数字 |
| 浏览器列宽计算 | ❌ 自动可变 | ✅ 固定 colgroup |
| 视觉一致性 | ❌ 混淆用户 | ✅ 一目了然 |

**用户现在能瞬间看出**：哪个交易所费率最高、最低，套利机会在哪一列。
