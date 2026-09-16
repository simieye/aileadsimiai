# 全球鹰 Global Eagle

> 基于 **OpenClaw Agent Cluster** 架构构建的 AI 驱动精准外贸获客运营智能体平台。
>
> 产业知识图谱 × 24 个 Agent × 全球买家数据 × 多渠道触达 × CRM × 供应链 × GEO × 数据资产

## 快速开始

```bash
python3 -m http.server 8123
# 浏览器打开 http://localhost:8123
```

零依赖、零构建：纯 ES Module + 原生 CSS，本地数据持久化在 `localStorage`。

首页点击 **▶ Golden Path 全链路**，系统会自动跑通：

```
产业拆解 → 市场情报 → 知识图谱 → 买家画像 → 全域拓客 → 线索补全 → 四维评分
→ DMU 决策链 → 千人千面内容 → 邮件序列 → 自动跟进 → CRM → RFQ 解析
→ 阶梯报价 → 数据复盘 → 资产沉淀
```

## 架构

```
Global Eagle Orchestrator（自然语言 → 意图识别 → Agent 编排）
        │
   感知层                决策层                执行层
Industry / Market /    Buyer / DMU /         Prospecting / Content / Email /
Knowledge Graph       Scoring / CRM /        LinkedIn / Social / Website /
                      Campaign / Analytics / RFQ / Quotation / Supply Chain
                      Approval               / Compliance / GEO
        │
  Shared Context（企业 / 产品 / 市场 / 买家 / 线索 / 商机 / 内容 / SOP / 资产）
        │
   Human-in-the-Loop（审批队列 + Audit Log + RBAC）
```

## 目录

```
index.html
assets/css/main.css
assets/js/
├── bus.js            Event Bus（Agent 间通信 + 事件流）
├── store.js          Shared Context（状态 + 持久化 + 可验证性校验）
├── seed.js           演示数据（全部标记未核验）
├── scoring.js        四维 Lead Score（ICP / Intent / Value / Engagement）
├── agents.js         24 个业务 Agent
├── registry.js       Skill / Tool / Agent / RBAC Registry
├── approval.js       Human Approval Queue + Audit Log
├── orchestrator.js   自然语言意图识别 + 工作流编排
├── ui.js             基础组件
├── views.js          14 个业务视图
└── app.js            路由 / 动作总线 / Copilot
```

## 六大 Agent Cluster

| Agent | 使命 |
|---|---|
| `industry_agent` | 找对市场：产业链五维拆解 |
| `buyer_profile_agent` | 找对企业：A/B/C/S 分层 |
| `prospecting_agent` | 找准线索：挖掘 + 验证 |
| `content_personalization_agent` | 打动客户：千人千面内容 |
| `supply_chain_agent` | 让商机落地：RFQ → 报价 → 履约风控 |
| `asset_compounding_agent` | 一次成交变长期资产：SOP 沉淀 |

另含 Market Intelligence、DMU、Lead Enrichment、Lead Scoring、Email、LinkedIn、Social、Website Sales、Campaign、Follow-up、CRM、RFQ、Quotation、Compliance、Analytics、GEO/SEO、Knowledge Graph、Human Approval 共 **24 个 Agent**。

## 核心原则

1. **AI 负责效率，人负责最终决策** —— 报价/合同/付款/认证声明/大额订单进入 `Human Approval Queue`。
2. **数据必须可验证，禁止虚构** —— 演示数据中企业、联系人、认证均标记 `verified:false`；字段缺失时输出「信息不足，需要人工确认」。
3. **评分必须有依据** —— 每条 Lead Score 都可展开查看加分依据与数据缺口。
4. **每次执行都沉淀资产** —— 客户资产 / 内容资产 / 数据资产 / SOP 四类复利。

> ⚠️ 内置数据为演示数据，对外使用前必须完成人工核验。
