# CryptoRebateHub · v2026-05-18-tools-design-bugs · 真实链接 + 增强计算器 + 设计抛光

Build ID: `20260518-tools-design-bugs`

## 🎯 本次完成 4 大改进

### 1️⃣ 真实邀请链接全部替换

| 产品 | 旧（占位） | 新（真实） |
|---|---|---|
| **Hyperliquid** | `/join/CRYPTOREBATEHUB` | ✅ `/join/HYPEKR` |
| **Binance 钱包** | `binance.com/zh-CN/web3wallet` | ✅ `web3.binance.com/referral?ref=WLFI47` |
| **OKX 钱包** | `okx.com/zh-hans/web3` | ✅ `web3.okx.com/join/DOGECOIN`（邀请码 DOGECOIN） |

**验证**：
- HYPEKR 在 index 出现 3 次（含 admin 5 次）
- DOGECOIN 在 index 出现 3 次（含 admin 5 次）
- 旧占位 `CRYPTOREBATEHUB` 出现 0 次 ✓

### 2️⃣ 返佣计算器：增加完整手续费计算功能

**之前**：只显示「能省多少」
**现在**：完整展示**毛费 / 实付 / 返佣 / 公式**

#### 新的 4 个核心数据卡：
```
毛手续费/月（删除线显示，让用户感受到原本要付的）
💸 实付手续费/月（彩色高亮，最重要的数字）
🎁 月返佣金额（绿色显示）
🎁 年返佣金额（绿色显示）
```

#### 新表格列：
| 交易所 | 费率 Taker | 返佣 | **实付/月** | **实付/年** | 年省 |
|---|---|---|---|---|---|
| 🏆 Bybit | 0.10% → 0.067% | 33% | **$6.70** | **$80** | $40 |

排序逻辑：**按年实付费用最低排序**（不再是"年省最多"），这更符合用户决策逻辑——他们关心的是"花多少"，不是"省多少"。

#### 新增「计算公式」透明展示：
```
📈 毛手续费  = 10,000 × 0.10%  = $10.00/月
🎁 返佣金额  = $10.00 × 33%    = $3.30/月
💸 实付手续费 = $10.00 - $3.30 = $6.70/月
```

每个数字都可追溯 → 用户信任 → 转化更高。

### 3️⃣ 前后台设计抛光

#### 字体（已优化）
继续使用 Inter + JetBrains Mono，全 OpenType 特性开启：
```css
font-feature-settings: "cv02","cv03","cv04","cv11","ss01","ss02","tnum","kern"
font-variant-numeric: tabular-nums
```

#### 配色（保持已精炼的）
- 主绿 `#2ecf90` → CTA 渐变 `linear-gradient(135deg, #2ecf90, #1fb377)`
- 主背景 `#0a0c14`（深黑墨）
- 文本 `#ecedf2`（高对比）

#### 新增 UX 细节
- ✅ **平滑滚动**：`html { scroll-behavior: smooth }`
- ✅ **聚焦环**：所有交互元素 `focus-visible` 用品牌色（无障碍 + 键盘导航）
- ✅ **选中色**：`::selection` 用品牌绿（视觉一致）
- ✅ **滚动条**：自定义样式（深色主题协调）
- ✅ **按钮按下反馈**：`active { transform: scale(.98) }`（触感）
- ✅ **`prefers-reduced-motion`**：尊重用户辅助设置（一些用户晕动）

### 4️⃣ Bug 修复 + SEO/GEO 优化

#### Bug 修复
- ✅ 移除重复的 `.bt-g` `.bt-o` CSS 定义（cascade 冲突）
- ✅ 验证所有路由 (`gr()`) 都有匹配的 switch case
- ✅ 验证所有 JSON-LD schema 解析正确
- ✅ 验证无 `<button>` 嵌套在 `<a>` 内（HTML 规范）
- ✅ 所有 JS 通过 `new Function()` 编译检查

#### SEO 加强
- ✅ DEX 列表页新增 **ItemList schema**（Hyperliquid 排在第一项）
- ✅ Wallets 列表页新增 **ItemList schema**（含 Binance/OKX 钱包）
- ✅ 工具页面（tools/rebate/wizard/fees）加入 **BreadcrumbList schema**
- ✅ `hreflang` alternates 每次路由跳转自动更新到当前 URL（4 语言 + x-default）
- ✅ Geo-rec banner 新增 `aria-label` 含 "sponsored, opens in new tab"

#### GEO 保持
- ✅ 15+ 地区基于时区 → 自动 GEO 推荐
- ✅ 每个地区精准映射到不同交易所

## ✅ 完整状态

```
✓ JS:              index 273KB / mgr 75KB / indexnow 9KB (0 errors)
✓ Schemas:         5 全局 + HowTo + AggregateRating + ItemList(DEX/钱包) + Compare Article
✓ Sitemap:         53 URLs · 4 语言 hreflang
✓ 真实链接:        HYPEKR / web3.binance.com / web3.okx.com DOGECOIN
✓ 计算器:          毛费 + 实付 + 返佣 + 透明公式 4 维展示
✓ 设计:            平滑滚动 + focus-visible + 按钮反馈 + 减动效支持
✓ Affiliate CTAs:  19+ 真实 <a href> + sponsored + aria-label
✓ 工具:            3 完整功能 + 4 语言 SEO
✓ Newsletter:      Formspree + localStorage 双模式
✓ 敏感词:          0
✓ Build ID:        20260518-tools-design-bugs
```

## 🚀 部署

```bash
cd /Users/admin/Desktop/cryptorebatehub-site
git add -A
git commit -m "v2026-05-18 tools-design-bugs: real URLs + enhanced calc + design polish"
git push origin main
```

部署后：
1. Cloudflare → Caching → **Purge Everything**
2. 跑 `~/indexnow-push.sh`
3. Google Search Console 重新提交 sitemap

## 🧪 验证测试

### 1. 真实链接
```bash
curl -s https://cryptorebatehub.com/exchange/hyperliquid | grep -oE "hyperliquid\.xyz/join/[A-Z]+"
# 应输出：hyperliquid.xyz/join/HYPEKR

curl -s https://cryptorebatehub.com/exchange/okx-wallet | grep -oE "web3\.okx\.com/join/[A-Z]+"
# 应输出：web3.okx.com/join/DOGECOIN
```

### 2. 返佣计算器新功能
1. 访问 `/tools/rebate-calculator`
2. 输入 10000 USDT，选「合约」
3. 应看到 4 个数据卡：
   - 毛手续费/月（删除线）
   - 实付手续费/月（高亮）
   - 月返佣（绿色）
   - 年返佣（绿色）
4. 滚到底部应看到「计算公式」透明展示

### 3. Schema 检查
访问 https://search.google.com/test/rich-results
- `/dex` → 检测到 **ItemList**（Hyperliquid 在第一项）
- `/wallets` → 检测到 **ItemList**（Binance Wallet + OKX Wallet）
- `/exchange/hyperliquid` → 检测到 **FinancialProduct + AggregateRating**

### 4. 设计细节
- 用 Tab 键依次按下 → 每个交互元素应有清晰的绿色聚焦环
- 选中任意文字 → 选中色应是品牌绿（透明）
- 在 macOS 系统偏好里开启「减少动效」→ 网站动画应自动减弱

### 5. 一致性
- 每个 CEX → `/exchanges` ✓
- Hyperliquid → `/dex` ✓
- Binance/OKX 钱包 → `/wallets` ✓
- 每个分类页顶部 Tab 切换正常
