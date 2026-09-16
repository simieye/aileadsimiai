# 全球鹰 Global Eagle

> 基于 **OpenClaw Agent Cluster** 架构构建的 AI 驱动精准外贸获客运营智能体平台。
>
> 产业知识图谱 × 24 个 Agent × 全球买家数据 × 多渠道触达 × CRM × 供应链 × GEO × 数据资产

## 快速开始

```bash
python3 -m http.server 8123
# 浏览器打开 http://localhost:8123
```

### 桌面版（macOS DMG 安装包）

```bash
npm install          # 安装 electron + electron-builder
npm run dist:mac     # 生成 release/Global Eagle-1.0.0-arm64.dmg（Intel 机器会同时产出 x64）
```

Electron 壳内置零依赖静态服务器，双击 DMG → 拖入 Applications 即用，与浏览器版数据互通（同一 localStorage 规则）。

## 多租户与账号体系（真实注册/登录）

| 角色 | 能力 |
|---|---|
| 平台管理员（系统首个注册账号自动成为） | 管理全部租户与用户：启停租户、变更角色、重置密码 |
| 企业管理员 | 管理本企业成员（添加成员 / 分配角色） |
| 企业用户 | 业务操作（拓客 / 内容 / CRM / 报价审批） |

- 注册企业 → 创建独立租户 → 每个租户拥有完全隔离的 Shared Context
- 密码 SHA-256 + 随机盐哈希存储，会话 7 天有效
- 审批日志记录真实操作人

## 大模型自定义设置

系统设置 → 大模型设置：OpenAI 兼容协议，内置预设（OpenAI / DeepSeek / 通义千问 / 智谱 / Kimi / Ollama / OpenClaw 本地网关），也可填任意兼容端点。

- 配置后：千人千面内容 / 开发信 / Copilot 使用真实大模型生成（自动回退本地引擎，不中断业务）
- API Key 仅存本机浏览器；每次调用计数留痕
- 「测试连接」发起真实请求并显示延迟

## 插件库 / 技能库 / MCP 连接器 / OpenClaw 连接

- **插件库**：内置市场一键安装（Tier Booster / CN Clean / Workflow Audit），支持 URL / JSON 导入；钩子 `onLead` / `onWorkflowDone` / `transform` 真实介入 Agent 执行链
- **技能库**：技能包 = 可分发的 Agent 编排（内置中东工程商 / 北美品牌商 ODM / 沉默客户再激活包），支持导入导出、一键运行
- **MCP 连接器**：MCP Streamable HTTP 客户端（JSON-RPC 2.0），真实 `initialize → tools/list → tools/call`，可挂任意 MCP Server
- **OpenClaw 本地连接**：WebSocket + OpenAI 兼容 HTTP 双通道连接本机 OpenClaw 网关（默认 `ws://127.0.0.1:18789`），断线自动重连，实时日志

## 架构

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
