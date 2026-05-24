# CryptoRebateHub v2026-05-24 (tools-reorganized-pnl-liq)

Build ID: `20260524-tools-reorganized-pnl-liq`

## 🎯 本次更新（4 大改进）

### 1. 💰 合约收益计算器（`/tools/pnl-calculator`） — NEW
- 多/空 + 入场价/出场价 + 仓位 + 杠杆 + 手续费
- 输出：毛利 / 总手续费 / 净利 / ROI / ROE
- 实时计算（输入即更新）
- **SEO**: "futures pnl calculator" (月搜 5,400+), "合约收益计算器"

### 2. 🚨 爆仓价格计算器（`/tools/liquidation-calculator`） — NEW
- 多/空 + 入场价 + 杠杆滑块 + 维持保证金率
- 输出：爆仓价 + 安全距离 % + 风险等级（6 档）+ 可视化条
- 配套表：1x-100x 杠杆参考表
- **SEO**: "liquidation price calculator" (月搜 8,100+), "爆仓价格计算器"

### 3. ❌ 手续费计算器（不加 — 重复）
- 与现有"返佣计算器"和"费率实时对比"功能重叠
- 用户提示"如有重复可以不加" → 已跳过避免冗余

### 4. 🎨 网站布局重新规划

**Tools Index 页**：从混乱 5 卡 → 整齐 **4 类 9 工具**
```
🧮 计算器 (4)          📊 实时数据 (2)        📅 投资工具 (2)      🎯 决策助手 (1)
├─ 返佣计算器 HOT      ├─ 资金费率监控 NEW    ├─ Portfolio 追踪    └─ 交易所匹配向导
├─ 合约收益 NEW        └─ 费率实时对比        └─ 代币解锁日历
├─ 爆仓价格 NEW
└─ 税务计算器
```

**顶部 mega-dropdown**：清理重复，从 3 列 2 行混乱 → **3 列分类整齐布局**
- 删除了重复的 funding-rates 和 token-unlocks 项（之前各出现 2 次）
- 重新按 4 类组织

**Funding Rate 页**：删除重复"💡 Tip 提示框"
- 之前：黄色 Tip 框 + 📚 解释区都讲资金费率含义 → 信息冗余
- 现在：只保留下方完整解释区，节省垂直空间

## ✅ 完整验证

```
✓ JS:               4 个脚本 + 14 Function 文件 · 0 errors
✓ Translations:     599 keys × 4 langs · 0 missing (新增 328 keys)
✓ Schemas:          5/5 valid (Org, WebSite, Breadcrumb, ItemList, FAQ)
✓ Sensitive words:  0 (翻墙/VPN/防屏蔽/科学上网 全 0)
✓ Real URLs:        HYPEKR/web3.binance.com/web3.okx.com/8DXZXGZ 全部 OK
✓ Tools:            9 个 (原 7 + 新 2)
✓ Sitemap:          63 URLs (原 49 + 新增 14)
✓ Build:            20260524-tools-reorganized-pnl-liq
```

## 🚀 部署

```bash
cd /Users/admin/Desktop/cryptorebatehub-site
git add -A
git commit -m "v2026-05-24 reorganize tools + add pnl/liq calculators"
git push origin main
```

Cloudflare 自动部署 1-2 分钟。然后清缓存（Caching → Purge Everything）。

## 🧪 部署后必测页面

- [ ] `/tools` → 看到 4 类目分组 + 9 个工具
- [ ] `/tools/pnl-calculator` → 输入入场/出场/杠杆 → 实时算 P&L
- [ ] `/tools/liquidation-calculator` → 滑动杠杆 → 爆仓价动态变化
- [ ] `/tools/funding-rates` → 不再有黄色 Tip 框（信息整合到下方）
- [ ] 顶部 "🛠 实用工具" 鼠标悬停 → 3 列分类，无重复
