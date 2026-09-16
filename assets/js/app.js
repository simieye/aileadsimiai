/**
 * Global Eagle · 应用入口：认证门禁 / 路由 / 动作总线 / Copilot / 实时编排追踪
 */
import { state, get, set, reset as resetStore } from './store.js';
import { VIEWS, VIEW_MAP } from './views.js';
import { authView, adminView, settingsView } from './views-extend.js';
import { runWorkflow, ask, detectIntent, WORKFLOWS } from './orchestrator.js';
import { decide, audit, setActor } from './approval.js';
import { toast, esc } from './ui.js';
import { on } from './bus.js';
import * as auth from './auth.js';
import * as llm from './llm.js';
import * as plugins from './plugins.js';
import * as skills from './skills.js';
import * as mcp from './connectors.js';

const ALL_VIEWS = { ...VIEW_MAP, auth: authView, admin: adminView, settings: settingsView };

const root = () => document.getElementById('view');

/* ------------------------------------------------------------ 导航 */
const GROUPS = {
  总览: ['dashboard', 'copilot'],
  感知层: ['industry', 'graph'],
  决策层: ['buyers', 'crm', 'campaign', 'analytics'],
  执行层: ['prospecting', 'marketing', 'deal'],
  治理: ['approval', 'assets', 'system'],
  管理: ['admin', 'settings'],
};

function navFor(user) {
  const groups = { ...GROUPS };
  if (!user || !['super_admin', 'org_admin'].includes(user.role)) groups.管理 = ['settings'];
  if (!user || user.role !== 'super_admin') groups.管理 = groups.管理.filter((v) => v === 'settings');
  return groups;
}

function renderNav(user) {
  const el = document.getElementById('nav');
  el.innerHTML = Object.entries(navFor(user)).map(([g, ids]) => `
    <div class="nav-group">
      <div class="nav-g-title">${g}</div>
      ${ids.map((id) => {
    const v = ALL_VIEWS[id];
    if (!v) return '';
    return `<a class="nav-item" data-act="nav" data-view="${id}" href="#${id}">
          <span class="nav-ico">${v.icon}</span><span>${v.name}</span></a>`;
  }).join('')}
    </div>`).join('');
}

function currentView() {
  return (location.hash || '#dashboard').replace('#', '') || 'dashboard';
}

function renderUserChip(user) {
  const el = document.getElementById('user-chip');
  if (!el) return;
  if (!user) { el.innerHTML = ''; return; }
  el.innerHTML = `<span class="chip">${esc(auth.ROLE_LABEL[user.role])}</span>
    <b>${esc(user.name)}</b><span class="sub">${esc(user.email)}</span>
    <button class="btn ghost xs" data-act="logout">退出</button>`;
}

function render() {
  const user = auth.currentUser();
  const app = document.querySelector('.app');
  if (!user) {
    app.classList.add('no-auth');
    document.getElementById('page-title').textContent = '登录 · 全球鹰';
    root().innerHTML = authView.render();
    document.getElementById('nav').innerHTML = '';
    renderUserChip(null);
    return;
  }
  app.classList.remove('no-auth');
  setActor(user.name);
  const id = currentView();
  const v = ALL_VIEWS[id] || ALL_VIEWS.dashboard;
  document.getElementById('page-title').textContent = v.name;
  renderNav(user);
  root().innerHTML = v.render();
  if (v.mount) v.mount(root());
  document.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('active', a.dataset.view === id));
  if (id === 'copilot') renderChat();
  if (id === 'copilot' || id === 'dashboard') renderTrace();
  if (id === 'settings' && state.ui.settingsTab === 'openclaw') renderOcLogs();
  renderUserChip(user);
  root().scrollTop = 0;
}

function go(id) { location.hash = `#${id}`; }

/* --------------------------------------------------- 通用表单读取 */
function form(scope = document) {
  const o = {};
  scope.querySelectorAll('[data-f]').forEach((el) => { o[el.dataset.f] = el.value.trim(); });
  return o;
}

/* --------------------------------------------------- 工作流执行器 */
async function execute(key, extra = {}) {
  toast(`工作流已启动：${WORKFLOWS[key].name}`, 'info');
  const run = await runWorkflow(key, extra, { delay: 130 });
  plugins.runOnWorkflowDone(run);
  toast(`完成：${WORKFLOWS[key].name}（${run.steps.length} 步）`, 'ok');
  render();
  return run;
}

function collectParams(key) {
  const p = {};
  const country = document.getElementById('camp-country')?.value;
  if (country) p.country = country;
  const goal = document.getElementById('camp-goal')?.value;
  if (goal) p.goal = goal;
  const tier = document.getElementById('content-tier')?.value;
  if (tier) p.tier = tier;
  const product = document.getElementById('content-product')?.value;
  if (product) p.product_id = product;
  return p;
}

/* ------------------------------------------------------------ Copilot */
let chat = [];
function renderChat() {
  const log = document.getElementById('chat-log');
  if (!log) return;
  log.innerHTML = chat.map((m) => `<div class="chat-msg ${m.role}">
    <div class="chat-bubble">${esc(m.text)}</div>
    ${m.steps ? `<div class="chat-steps">${m.steps.map((s) => `<div class="cs"><b>${esc(s.name)}</b>：${esc(s.summary || '')}</div>`).join('')}</div>` : ''}
  </div>`).join('') || '<div class="empty">输入自然语言指令，Orchestrator 会自动编排 Agent 集群</div>';
  log.scrollTop = log.scrollHeight;
}

async function handleAsk(text) {
  chat.push({ role: 'user', text });
  renderChat();
  const key = detectIntent(text);
  const viaLLM = llm.isConfigured() ? '（大模型参与编排）' : '';
  toast(`意图识别：${WORKFLOWS[key].name}${viaLLM}`, 'info');
  const run = await ask(text, { delay: 130 });
  plugins.runOnWorkflowDone(run);
  chat.push({ role: 'ai', text: `已执行「${run.name}」，共 ${run.steps.length} 个 Agent 参与协作。${viaLLM}`, steps: run.steps });
  renderChat();
  renderTrace(run);
  render();
}

function renderTrace(run) {
  const el = document.getElementById('wf-trace') || document.getElementById('dash-timeline');
  if (!el) return;
  const r = run || get('workflows').slice(-1)[0];
  if (!r) return;
  el.innerHTML = `<div class="tl-head">${esc(r.name)} · ${r.steps.length} 步 · ${r.status === 'done' ? '已完成' : '执行中'}</div>` +
    r.steps.map((s) => `<div class="tl-item ${s.status}">
      <b>${esc(s.name)}</b><span>${esc(s.summary || '执行中…')}</span></div>`).join('');
}

/* --------------------------------------------------- OpenClaw 日志渲染 */
function renderOcLogs() {
  const el = document.getElementById('oc-logs');
  if (!el) return;
  const st = mcp.openclawStatus();
  el.innerHTML = (st.logs || []).map((l) => `<div class="tl-item ${l.level}"><b>${esc(l.t)}</b><span>${esc(l.msg)}</span></div>`).join('') || '<div class="empty">暂无日志</div>';
}

/* ------------------------------------------------------------ 动作 */
const ACTIONS = {
  nav: (el) => go(el.dataset.view),
  'run-wf': async (el) => execute(el.dataset.wf, collectParams(el.dataset.wf)),
  'nl-run': async () => {
    const q = document.getElementById('prospect-q')?.value?.trim();
    if (!q) return toast('请输入自然语言指令', 'warn');
    state.ui.prospectQuery = q;
    go('copilot');
    setTimeout(() => handleAsk(plugins.runTransform(q)), 60);
  },
  'chat-send': () => {
    const i = document.getElementById('chat-text');
    const t = i.value.trim();
    if (!t) return;
    i.value = ''; handleAsk(plugins.runTransform(t));
  },
  'chat-quick': (el) => handleAsk(plugins.runTransform(el.dataset.q)),
  'filter-tier': (el) => { state.ui.tierFilter = el.dataset.tier; render(); },
  'filter-buyer-country': (el) => { state.ui.buyerCountry = el.value; render(); },
  'set-role': (el) => { setActor(el.value); state.ui.role = el.value; audit('rbac.switch', `切换角色为 ${el.value}`); render(); },
  'reset-data': () => { if (confirm('确认重置当前租户的业务数据？（账号不受影响）')) { resetStore(); render(); } },
  advance: async (el) => {
    const { crm_agent } = await import('./agents.js');
    const out = await crm_agent.run({ advance: true, lead_id: el.dataset.id });
    toast(out.summary, 'ok'); render();
  },
  approve: (el) => { decide(el.dataset.id, true, auth.currentUser()?.name || 'Admin'); toast('已批准', 'ok'); render(); },
  reject: (el) => { decide(el.dataset.id, false, auth.currentUser()?.name || 'Admin'); toast('已驳回', 'warn'); render(); },
  'show-reasons': (el) => {
    const l = get('leads').find((x) => x.id === el.dataset.id);
    const p = document.getElementById('reason-panel');
    if (!l || !p) return;
    p.innerHTML = `<section class="card"><header class="card-hd"><h3>${esc(l.company)} · 评分依据</h3>
      <span class="sub">置信度：${esc(l.confidence)}</span></header><div class="card-bd">
      <div class="grid-2"><div>
        <div class="score-row"><span>ICP Match</span><b>${l.icp_score}</b></div>
        <div class="score-row"><span>Purchase Intent</span><b>${l.intent_score}</b></div>
        <div class="score-row"><span>Company Value</span><b>${l.value_score}</b></div>
        <div class="score-row"><span>Engagement</span><b>${l.engagement_score}</b></div>
        <div class="score-row total"><span>Lead Score</span><b>${l.lead_score}（${l.tier} 类）</b></div>
      </div><div>
        <h4>加分依据</h4><ul class="list">${l.score_reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
        ${l.score_gaps?.length ? `<h4>数据缺口</h4><ul class="list warn">${l.score_gaps.map((r) => `<li>${esc(r)}</li>`).join('')}</ul><div class="warn mt">信息不足，需要人工确认。</div>` : ''}
      </div></div></div></section>`;
    p.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  /* ---------- 认证 ---------- */
  'auth-tab': (el) => { state.ui.authTab = el.dataset.tab; render(); },
  'auth-login': async () => {
    const f = form();
    const r = await auth.login(f.email, f.password);
    if (!r.ok) return toast(r.error, 'warn');
    toast(`欢迎回来，${r.user.name}`, 'ok');
    go('dashboard'); render();
    audit('auth.login', `${r.user.email} 登录`);
  },
  'auth-register': async () => {
    const f = form();
    const r = await auth.registerOrg(f);
    if (!r.ok) return toast(r.error, 'warn');
    toast(`${r.isFirst ? '平台管理员' : '企业账户'}创建成功：${r.org.name}`, 'ok');
    go('dashboard'); render();
    audit('auth.register', `新租户 ${r.org.name} / ${r.user.email}`);
  },
  logout: () => auth.logout(),

  /* ---------- 租户/用户 ---------- */
  'add-user': async () => {
    const f = form();
    const r = await auth.addUser(f);
    if (!r.ok) return toast(r.error, 'warn');
    toast(`成员 ${r.user.name} 已添加`, 'ok'); render();
  },
  'user-status': (el) => {
    const r = auth.setUserStatus(el.dataset.id, el.dataset.v);
    toast(r.ok ? '已更新' : r.error, r.ok ? 'ok' : 'warn'); if (r.ok) render();
  },
  'user-role': (el) => {
    const r = auth.setUserRole(el.dataset.id, el.value);
    toast(r.ok ? '角色已更新' : r.error, r.ok ? 'ok' : 'warn');
  },
  'user-resetpwd': async (el) => {
    const pwd = prompt('输入新密码（至少 6 位）：');
    if (!pwd) return;
    const r = await auth.resetPassword(el.dataset.id, pwd);
    toast(r.ok ? '密码已重置' : r.error, r.ok ? 'ok' : 'warn');
  },
  'org-status': (el) => {
    const r = auth.setOrgStatus(el.dataset.id, el.dataset.v);
    toast(r.ok ? '租户状态已更新' : r.error, r.ok ? 'ok' : 'warn'); if (r.ok) render();
  },

  /* ---------- 设置页 ---------- */
  'set-tab': (el) => { state.ui.settingsTab = el.dataset.tab; render(); },
  'llm-save': () => {
    const f = form();
    const cfg = {
      provider: f.provider, baseURL: f.baseURL, apiKey: f.apiKey, model: f.model,
      temperature: Number(f.temperature) || 0.7, enabled: !!(f.baseURL && f.model),
    };
    llm.saveConfig(cfg);
    const c = llm.getConfig();
    toast(c.enabled ? `已保存并启用：${c.model}` : '已保存（未启用：缺 BaseURL/模型）', c.enabled ? 'ok' : 'warn');
    render();
  },
  'llm-test': async () => {
    const f = form();
    const out = document.getElementById('llm-test-out');
    if (out) out.innerHTML = '<span class="warn">测试中…</span>';
    const r = await llm.testConnection({ provider: f.provider, baseURL: f.baseURL, apiKey: f.apiKey, model: f.model });
    if (out) out.innerHTML = r.ok ? `<span class="ok">✓ 连接成功 · ${r.latency}ms · ${esc(r.sample)}</span>` : `<span class="warn">✗ ${esc(r.error)}</span>`;
    toast(r.ok ? '大模型连接成功' : '连接失败', r.ok ? 'ok' : 'warn');
  },

  'plg-install': (el) => { const r = plugins.install(el.dataset.id); toast(r.ok ? `插件已安装：${r.plugin.name}` : r.error, r.ok ? 'ok' : 'warn'); if (r.ok) render(); },
  'plg-uninstall': (el) => { plugins.uninstall(el.dataset.id); toast('已卸载', 'ok'); render(); },
  'plg-toggle': (el) => { plugins.toggle(el.dataset.id); render(); },
  'plg-url': async () => { const f = form(); const r = await plugins.installFromURL(f['plg-url']); toast(r.ok ? `插件已安装：${r.plugin.name}` : r.error, r.ok ? 'ok' : 'warn'); if (r.ok) render(); },
  'plg-json': () => { const f = form(); const r = plugins.installFromJSON(f['plg-json']); toast(r.ok ? `插件已安装：${r.plugin.name}` : r.error, r.ok ? 'ok' : 'warn'); if (r.ok) render(); },
  'plg-template': () => { const t = document.querySelector('[data-f="plg-json"]'); if (t) t.value = plugins.newTemplate(); },

  'skill-install': (el) => { const r = skills.install(el.dataset.id); toast(r.ok ? `技能包已安装：${r.skill?.name || ''}` : r.error, r.ok ? 'ok' : 'warn'); if (r.ok) render(); },
  'skill-uninstall': (el) => { skills.uninstall(el.dataset.id); toast('已卸载', 'ok'); render(); },
  'skill-run': async (el) => {
    toast('技能包启动', 'info');
    const r = await skills.run(el.dataset.id);
    plugins.runOnWorkflowDone(r);
    toast(`技能包执行完成（${r.steps.length} 步）`, 'ok'); render();
  },
  'skill-url': async () => { const f = form(); const r = await skills.installFromURL(f['skill-url']); toast(r.ok ? `技能包已安装：${r.skill?.name || ''}` : r.error, r.ok ? 'ok' : 'warn'); if (r.ok) render(); },
  'skill-json': () => { const f = form(); const r = skills.installFromJSON(f['skill-json']); toast(r.ok ? '技能包已安装' : r.error, r.ok ? 'ok' : 'warn'); if (r.ok) render(); },
  'skill-template': () => { const t = document.querySelector('[data-f="skill-json"]'); if (t) t.value = skills.newTemplate(); },
  'skill-export': () => {
    const t = document.querySelector('[data-f="skill-json"]');
    if (t) { t.value = skills.exportSystemWorkflows(); toast('已导出全部系统工作流为技能包 JSON', 'ok'); }
  },

  'mcp-connect': async () => {
    const f = form();
    if (!f['mcp-url']) return toast('请填写 MCP Server URL', 'warn');
    toast('正在握手 MCP Server…', 'info');
    const r = await mcp.connectMCP({ name: f['mcp-name'], url: f['mcp-url'], token: f['mcp-token'] });
    toast(r.ok ? `连接成功，发现 ${r.tools} 个工具` : `连接失败：${r.error}`, r.ok ? 'ok' : 'warn');
    render();
  },
  'mcp-disconnect': (el) => { mcp.disconnectMCP(el.dataset.id); toast('已断开', 'ok'); render(); },
  'mcp-refresh': async (el) => {
    const r = await mcp.refreshMCP(el.dataset.id);
    toast(r.ok ? `工具列表已刷新（${r.tools}）` : r.error, r.ok ? 'ok' : 'warn'); if (r.ok) render();
  },
  'mcp-call': async (el) => {
    const args = prompt(`调用工具 ${el.dataset.tool}，输入 JSON 参数（可为 {}）：`, '{}');
    if (args === null) return;
    try {
      const r = await mcp.callMCP(el.dataset.id, el.dataset.tool, JSON.parse(args || '{}'));
      document.getElementById('view')?.scrollIntoView({ behavior: 'smooth' });
      toast(r.ok ? '调用成功' : '调用返回错误', r.ok ? 'ok' : 'warn');
      const { code } = await import('./ui.js');
      document.getElementById('reason-panel')?.remove();
      const div = document.createElement('div');
      div.innerHTML = `<section class="card" style="margin-top:14px"><header class="card-hd"><h3>MCP 工具输出：${esc(el.dataset.tool)}</h3></header><div class="card-bd">${code(r.output)}</div></section>`;
      document.getElementById('view').prepend(div);
    } catch (e) { toast(`调用失败：${e.message}`, 'warn'); }
  },

  'oc-save': () => {
    const f = form();
    mcp.saveOpenclawConfig({ wsURL: f['oc-ws'], httpURL: f['oc-http'], agentId: f['oc-agent'], token: f['oc-token'] });
    toast('OpenClaw 配置已保存', 'ok'); render();
  },
  'oc-connect': () => { mcp.connectOpenclaw(); setTimeout(render, 600); },
  'oc-disconnect': () => { mcp.disconnectOpenclaw(); render(); },
  'oc-health': async () => {
    const out = document.getElementById('oc-health-out');
    if (out) out.innerHTML = '<span class="warn">探测中…</span>';
    const r = await mcp.openclawHealth();
    if (out) out.innerHTML = r.ok ? `<span class="ok">● HTTP 可达（${esc(r.path)} → ${r.status}）</span>` : '<span class="warn">● HTTP 不可达，请确认网关已启动</span>';
    toast(r.ok ? 'OpenClaw HTTP 通道正常' : 'HTTP 不可达', r.ok ? 'ok' : 'warn');
  },
  'oc-send': () => {
    const i = document.getElementById('oc-msg');
    const r = mcp.sendOpenclaw({ type: 'message', text: i?.value || '' });
    toast(r.ok ? '已发送，等待网关响应（见日志）' : r.error, r.ok ? 'ok' : 'warn');
  },
  'oc-ai': async () => {
    const i = document.getElementById('oc-msg');
    const out = document.getElementById('oc-out');
    if (!i?.value) return toast('请输入内容', 'warn');
    if (out) out.innerHTML = '<div class="sub">请求本地 OpenClaw AI 通道…</div>';
    try {
      const text = await mcp.openclawChat(i.value);
      if (out) out.innerHTML = `<pre class="code">${esc(text)}</pre>`;
    } catch (e) {
      if (out) out.innerHTML = `<div class="warn">失败：${esc(e.message)}（请确认网关提供 /v1/chat/completions）</div>`;
    }
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  Promise.resolve(fn(el));
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'chat-text') ACTIONS['chat-send']();
  if (e.key === 'Enter' && e.target.id === 'prospect-q') ACTIONS['nl-run']();
  if (e.key === 'Enter' && e.target.closest?.('.auth-card')) {
    ACTIONS[state.ui.authTab === 'reg' ? 'auth-register' : 'auth-login']();
  }
});

/* 预设服务商 → 自动填充 BaseURL / 模型 */
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset?.f === 'provider' && el.value) {
    const p = llm.PRESETS.find((x) => x.id === el.value);
    if (p) {
      const setv = (name, v) => { const i = document.querySelector(`[data-f="${name}"]`); if (i) i.value = v; };
      setv('baseURL', p.baseURL); setv('model', p.model);
      toast(`已填充 ${p.name} 预设`, 'ok');
    }
  }
});

/* ------------------------------------------------------------ 启动 */
on('wf:step', () => { if (currentView() === 'copilot' || currentView() === 'dashboard') renderTrace(); });
on('openclaw:log', () => { if (currentView() === 'settings' && state.ui.settingsTab === 'openclaw') renderOcLogs(); });
on('openclaw:message', (data) => {
  if (data && typeof data === 'object' && data.type === 'message' && currentView() === 'copilot') {
    chat.push({ role: 'ai', text: `OpenClaw → ${JSON.stringify(data).slice(0, 300)}` });
    renderChat();
  }
});
window.addEventListener('hashchange', () => render());

setActor(auth.currentUser()?.name || 'Guest');
render();
audit('system.boot', '全球鹰 Global Eagle 启动');
