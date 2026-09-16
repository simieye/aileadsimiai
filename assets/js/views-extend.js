/**
 * Global Eagle · 扩展视图：认证 / 租户管理 / 系统设置（模型·插件·技能·MCP·OpenClaw）
 */
import { state, get } from './store.js';
import { esc, card, table, chip, section, toast } from './ui.js';
import * as auth from './auth.js';
import * as llm from './llm.js';
import * as plugins from './plugins.js';
import * as skills from './skills.js';
import * as mcp from './connectors.js';
import { WORKFLOWS } from './orchestrator.js';

/* ============================================================ 登录 / 注册 */
export const authView = {
  id: 'auth', name: '登录', icon: '⇥', group: 'auth',
  render() {
    const tab = state.ui?.authTab || 'login';
    const first = auth.listUsers().length === 0;
    return `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="brand-logo" style="margin:0 auto 14px">GE</div>
        <h2 class="auth-title">全球鹰 Global Eagle</h2>
        <p class="sub" style="text-align:center">AI 外贸增长操作系统 · 多租户平台</p>
        <div class="tabs">
          <button class="tab ${tab === 'login' ? 'on' : ''}" data-act="auth-tab" data-tab="login">登录</button>
          <button class="tab ${tab === 'reg' ? 'on' : ''}" data-act="auth-tab" data-tab="reg">注册企业</button>
        </div>
        ${tab === 'login' ? `
        <div class="form">
          <label>邮箱<input class="input w100" data-f="email" type="email" placeholder="you@company.com" /></label>
          <label>密码<input class="input w100" data-f="password" type="password" placeholder="••••••" /></label>
          <button class="btn primary w100" data-act="auth-login">登 录</button>
        </div>` : `
        <div class="form">
          ${first ? '<div class="hint">👑 系统首个注册账号将自动成为<b>平台管理员</b></div>' : ''}
          <label>企业名称<input class="input w100" data-f="orgName" placeholder="上海某某泳池设备有限公司" /></label>
          <label>您的姓名<input class="input w100" data-f="name" placeholder="张三" /></label>
          <label>邮箱<input class="input w100" data-f="email" type="email" placeholder="you@company.com" /></label>
          <label>密码<input class="input w100" data-f="password" type="password" placeholder="至少 6 位" /></label>
          <button class="btn primary w100" data-act="auth-register">创建企业账户</button>
        </div>`}
        <div class="sub" style="text-align:center;margin-top:14px">数据全部存储于本机浏览器 · 企业间数据完全隔离</div>
      </div>
    </div>`;
  },
};

/* ============================================================ 租户与用户管理 */
export const adminView = {
  id: 'admin', name: '租户与用户', icon: '⛁', group: 'admin',
  render() {
    const me = auth.currentUser();
    if (!me || !['super_admin', 'org_admin'].includes(me.role)) {
      return `<div class="empty">无权限访问。当前角色：${esc(auth.ROLE_LABEL[me?.role] || '企业用户')}</div>`;
    }
    const isSuper = me.role === 'super_admin';
    const orgs = isSuper ? auth.listOrgs() : auth.listOrgs().filter((o) => o.id === me.org_id);
    const users = isSuper ? auth.listUsers() : auth.listUsers(me.org_id);
    return `
    ${section(isSuper ? '平台租户管理' : '企业成员管理', isSuper ? '平台管理员可管理所有租户与用户' : '企业管理员可管理本企业成员')}
    ${isSuper ? card('租户列表', table(['租户', '套餐', '状态', '成员数', '创建时间', '操作'], orgs.map((o) => [
      `<b>${esc(o.name)}</b><div class="sub">${esc(o.id)}</div>`, esc(o.plan),
      o.status === 'active' ? '<span class="ok">正常</span>' : `<span class="warn">${esc(o.status)}</span>`,
      String(auth.listUsers(o.id).length),
      esc((o.created_at || '').slice(0, 10)),
      `<button class="btn ghost xs" data-act="org-status" data-id="${o.id}" data-v="${o.status === 'active' ? 'suspended' : 'active'}">${o.status === 'active' ? '停用' : '启用'}</button>`,
    ]))) : ''}
    ${card(`成员列表（${users.length}）`, `${!isSuper ? `<div class="add-user">
        <input class="input" data-f="name" placeholder="姓名" />
        <input class="input" data-f="email" placeholder="邮箱" />
        <input class="input" data-f="password" type="password" placeholder="初始密码(≥6位)" />
        <select data-f="role"><option value="user">企业用户</option><option value="org_admin">企业管理员</option></select>
        <button class="btn primary sm" data-act="add-user">＋ 添加成员</button>
      </div>` : ''}
      ${table(['姓名', '邮箱', '角色', '所属租户', '状态', '操作'], users.map((u) => {
    const org = auth.listOrgs().find((o) => o.id === u.org_id);
    return [
      esc(u.name), esc(u.email),
      isSuper ? `<select data-act="user-role" data-id="${u.id}">${auth.ROLE_LIST.map((r) => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${auth.ROLE_LABEL[r]}</option>`).join('')}</select>`
        : esc(auth.ROLE_LABEL[u.role]),
      esc(org?.name || u.org_id),
      u.status === 'active' ? '<span class="ok">正常</span>' : `<span class="warn">${esc(u.status)}</span>`,
      isSuper ? `<button class="btn ghost xs" data-act="user-status" data-id="${u.id}" data-v="${u.status === 'active' ? 'suspended' : 'active'}">${u.status === 'active' ? '停用' : '启用'}</button>
        <button class="btn ghost xs" data-act="user-resetpwd" data-id="${u.id}">重置密码</button>` : '—',
    ];
  }))}`, { right: isSuper ? `<span class="sub">共 ${orgs.length} 个租户</span>` : '' })}
    `;
  },
};

/* ============================================================ 系统设置 */
const TABS = [
  { id: 'model', name: '大模型设置' },
  { id: 'plugins', name: '插件库' },
  { id: 'skills', name: '技能库' },
  { id: 'mcp', name: 'MCP 连接器' },
  { id: 'openclaw', name: 'OpenClaw 本地连接' },
];

export const settingsView = {
  id: 'settings', name: '系统设置', icon: '⚙', group: 'settings',
  render() {
    const tab = state.ui?.settingsTab || 'model';
    return `
    ${section('系统设置', '真实接入大模型 · 插件生态 · 技能包 · MCP 工具协议 · 本地 OpenClaw 网关')}
    <div class="tabs left">${TABS.map((t) => `<button class="tab ${tab === t.id ? 'on' : ''}" data-act="set-tab" data-tab="${t.id}">${t.name}</button>`).join('')}</div>

    ${tab === 'model' ? renderModel() : ''}
    ${tab === 'plugins' ? renderPlugins() : ''}
    ${tab === 'skills' ? renderSkills() : ''}
    ${tab === 'mcp' ? renderMCP() : ''}
    ${tab === 'openclaw' ? renderOpenclaw() : ''}
    `;
  },
};

function renderModel() {
  const c = llm.getConfig();
  return `
  ${card('大模型接入（OpenAI 兼容协议 · 真实调用）', `
    <div class="hint">配置后，内容生成 / 邮件撰写 / Copilot 意图识别将使用真实大模型；未配置或调用失败自动回退本地引擎，不中断业务。</div>
    <div class="form grid-form">
      <label>预设服务商<select data-f="provider">${['', ...llm.PRESETS.map((p) => p.id)].map((id) => {
    const p = llm.PRESETS.find((x) => x.id === id);
    return `<option value="${id}" ${c.provider === id ? 'selected' : ''}>${p ? p.name : '自定义 / OpenAI 兼容端点'}</option>`;
  }).join('')}</select></label>
      <label>Base URL<input class="input w100" data-f="baseURL" value="${esc(c.baseURL)}" placeholder="https://api.deepseek.com/v1" /></label>
      <label>API Key<input class="input w100" data-f="apiKey" type="password" value="${esc(c.apiKey)}" placeholder="sk-…（仅存本机浏览器）" /></label>
      <label>模型名称<input class="input w100" data-f="model" value="${esc(c.model)}" placeholder="deepseek-chat" /></label>
      <label>Temperature<input class="input w100" data-f="temperature" type="number" step="0.1" min="0" max="2" value="${c.temperature}" /></label>
    </div>
    <div class="toolbar mt">
      <button class="btn primary" data-act="llm-save">保存配置</button>
      <button class="btn" data-act="llm-test">测试连接</button>
      <span id="llm-test-out" class="sub">${llm.isConfigured() ? '<span class="ok">已启用真实大模型</span>' : '<span class="warn">当前使用本地引擎（未启用）</span>'}</span>
    </div>
    <div class="mt sub">支持预设：${llm.PRESETS.map((p) => chip(p.name)).join('')}，或任意 OpenAI 兼容端点（含 vLLM / OneAPI / 本地推理）。</div>
  `)}
  ${card('接入说明（Safety & Privacy）', `<ul class="list">
    <li>API Key 仅保存在本机浏览器 localStorage，上传代码 / 换设备不会带走密钥。</li>
    <li>所有大模型输出仍遵守平台原则：认证/资质类声明必须人工核验后方可对外。</li>
    <li>用量统计：${get('llm.stats', { calls: 0 }).calls} 次调用（本租户）。</li>
  </ul>`)}
  `;
}

function renderPlugins() {
  const installed = plugins.listInstalled();
  return `
  ${card('插件市场（内置，一键安装）', table(['插件', '版本', '说明', '作者', '操作'], plugins.MARKET.map((p) => [
    `<b>${esc(p.name)}</b><div class="sub">${esc(p.id)}</div>`, esc(p.version), esc(p.desc), esc(p.author),
    installed.some((i) => i.id === p.id)
      ? '<span class="ok">已安装</span>'
      : `<button class="btn primary xs" data-act="plg-install" data-id="${p.id}">安装</button>`,
  ])))}
  ${card(`已安装插件（${installed.length}）`, table(['插件', '状态', '安装时间', '操作'], installed.map((p) => [
    `<b>${esc(p.name)}</b><div class="sub">${esc(p.id)} · ${esc(p.version || '')}</div>`,
    p.enabled ? '<span class="ok">已启用</span>' : '<span class="warn">已停用</span>',
    esc((p.installed_at || '').slice(0, 10)),
    `<button class="btn ghost xs" data-act="plg-toggle" data-id="${p.id}">${p.enabled ? '停用' : '启用'}</button>
     <button class="btn ghost xs" data-act="plg-uninstall" data-id="${p.id}">卸载</button>`,
  ])), { empty: '暂无插件，请从市场安装或导入' })}
  ${card('导入插件', `
    <div class="toolbar">
      <input class="input" data-f="plg-url" placeholder="插件 JSON 的 URL（真实 fetch）" style="min-width:320px" />
      <button class="btn" data-act="plg-url">从 URL 安装</button>
      <button class="btn ghost" data-act="plg-template">生成模板</button>
    </div>
    <textarea class="code w100" data-f="plg-json" rows="8" placeholder='粘贴插件 JSON：{"id","name","code"}'></textarea>
    <div class="toolbar mt"><button class="btn" data-act="plg-json">从 JSON 安装</button></div>
    <div class="sub">插件钩子：onLead(lead) / onWorkflowDone(run) / transform(query)</div>
  `)}
  `;
}

function renderSkills() {
  const installed = skills.listInstalled();
  return `
  ${card('技能包市场（内置）', table(['技能包', '步骤', '说明', '操作'], skills.MARKET.map((s) => [
    `<b>${esc(s.name)}</b><div class="sub">${esc(s.id)}</div>`, `${s.steps.length} 个 Agent`, esc(s.desc),
    installed.some((i) => i.id === s.id)
      ? `<button class="btn primary xs" data-act="skill-run" data-id="${s.id}">▶ 运行</button>`
      : `<button class="btn primary xs" data-act="skill-install" data-id="${s.id}">安装</button>`,
  ])))}
  ${card(`已安装技能包（${installed.length}）`, table(['技能包', 'Agent 编排', '操作'], installed.map((s) => [
    `<b>${esc(s.name)}</b><div class="sub">${esc(s.id)}</div>`,
    `<div>${s.steps.map((x) => chip(x.agent.replace('_agent', ''))).join('')}</div>`,
    `<button class="btn primary xs" data-act="skill-run" data-id="${s.id}">▶ 运行</button>
     <button class="btn ghost xs" data-act="skill-uninstall" data-id="${s.id}">卸载</button>`,
  ])), { empty: '暂无技能包' })}
  ${card('导入 / 导出技能包', `
    <div class="toolbar">
      <input class="input" data-f="skill-url" placeholder="技能包 JSON 的 URL" style="min-width:320px" />
      <button class="btn" data-act="skill-url">从 URL 安装</button>
      <button class="btn ghost" data-act="skill-template">生成模板</button>
      <button class="btn ghost" data-act="skill-export">导出系统工作流为技能包</button>
    </div>
    <textarea class="code w100" data-f="skill-json" rows="8" placeholder='粘贴技能包 JSON：{"id","name","steps":[{"agent","params"}]}'></textarea>
    <div class="toolbar mt"><button class="btn" data-act="skill-json">从 JSON 安装</button></div>
  `)}
  ${card('系统工作流（内置编排）', table(['工作流', 'Agent 编排'], Object.entries(WORKFLOWS).map(([k, v]) => [
    `<button class="btn ghost xs" data-act="run-wf" data-wf="${k}">▶ ${esc(v.name)}</button>`,
    `<div class="sub">${v.agents.map((a) => chip(a.replace('_agent', ''))).join('')}</div>`,
  ])))}
  `;
}

function renderMCP() {
  const conns = mcp.listMCP();
  return `
  ${card('MCP Server 连接（Streamable HTTP · JSON-RPC 2.0）', `
    <div class="hint">真实握手：initialize → notifications/initialized → tools/list。支持任何 MCP Streamable HTTP 服务（含本地 npx 起的 server）。</div>
    <div class="form grid-form">
      <label>名称<input class="input w100" data-f="mcp-name" placeholder="filesystem / github / 自建 server" /></label>
      <label>Endpoint URL<input class="input w100" data-f="mcp-url" placeholder="http://127.0.0.1:3000/mcp" /></label>
      <label>Token（可选）<input class="input w100" data-f="mcp-token" type="password" placeholder="Bearer Token" /></label>
    </div>
    <div class="toolbar mt"><button class="btn primary" data-act="mcp-connect">连接</button></div>
  `)}
  ${card(`已连接 Server（${conns.length}）`, conns.length ? conns.map((c) => `
    <div class="seq">
      <div class="seq-hd">${esc(c.name)} <span class="${c.status === 'connected' ? 'ok' : 'warn'}">● ${esc(c.status)}</span>
        <button class="btn ghost xs" data-act="mcp-refresh" data-id="${c.id}" style="margin-left:8px">刷新工具</button>
        <button class="btn ghost xs" data-act="mcp-disconnect" data-id="${c.id}">断开</button></div>
      ${c.error ? `<div class="warn sub">${esc(c.error)}</div>` : ''}
      ${c.tools.length ? table(['工具', '说明', '调用'], c.tools.map((t) => [
    `<b>${esc(t.name)}</b>`, esc(t.desc),
    `<button class="btn ghost xs" data-act="mcp-call" data-id="${c.id}" data-tool="${esc(t.name)}">▶ 调用</button>`,
  ])) : '<div class="sub">未获取到工具列表</div>'}
    </div>`).join('') : '<div class="empty">暂无连接。本地快速测试：npx -y @modelcontextprotocol/server-filesystem /tmp 起一个 MCP server 后，用其 HTTP 端点连接。</div>')}
  `;
}

function renderOpenclaw() {
  const cfg = mcp.openclawConfig();
  const st = mcp.openclawStatus();
  return `
  ${card('本地 OpenClaw 网关', `
    <div class="hint">连接本机运行的 OpenClaw 网关（WebSocket + OpenAI 兼容 HTTP 双通道），让全球鹰 Agent 直接调用本地 OpenClaw 的模型与技能。</div>
    <div class="form grid-form">
      <label>WebSocket URL<input class="input w100" data-f="oc-ws" value="${esc(cfg.wsURL)}" placeholder="ws://127.0.0.1:18789" /></label>
      <label>HTTP URL<input class="input w100" data-f="oc-http" value="${esc(cfg.httpURL)}" placeholder="http://127.0.0.1:18789" /></label>
      <label>Agent ID<input class="input w100" data-f="oc-agent" value="${esc(cfg.agentId)}" placeholder="main" /></label>
      <label>Token（可选）<input class="input w100" data-f="oc-token" type="password" value="${esc(cfg.token)}" /></label>
    </div>
    <div class="toolbar mt">
      <button class="btn" data-act="oc-save">保存配置</button>
      <button class="btn primary" data-act="oc-connect">${st.state === 'connected' ? '重连' : '连接'}</button>
      <button class="btn ghost" data-act="oc-disconnect">断开</button>
      <button class="btn ghost" data-act="oc-health">HTTP 健康探测</button>
      <span id="oc-health-out" class="sub">${st.state === 'connected' ? '<span class="ok">● 已连接</span>' : st.state === 'connecting' ? '<span class="warn">● 连接中</span>' : `<span class="warn">● ${esc(st.state)}</span>`}</span>
    </div>
    <div class="mt sub">本地启动 OpenClaw 网关后（默认端口 18789），此处即可真实连上；断线自动重连 3 次。</div>
  `)}
  ${card('网关日志（实时）', `<div class="timeline" id="oc-logs">${(st.logs || []).map((l) => `<div class="tl-item ${l.level}"><b>${esc(l.t)}</b><span>${esc(l.msg)}</span></div>`).join('') || '<div class="empty">暂无日志</div>'}</div>`)}
  ${card('向本地 OpenClaw 发送指令', `
    <div class="toolbar"><input class="input" id="oc-msg" placeholder="例如：帮我列出本地技能清单" style="min-width:360px" /><button class="btn" data-act="oc-send">发送</button><button class="btn ghost" data-act="oc-ai">AI 通道发送</button></div>
    <div id="oc-out"></div>
  `)}
  `;
}
