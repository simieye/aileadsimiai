/**
 * Global Eagle · 插件库（Plugin Registry）
 * 插件 = 可安装/启停/执行的 JS 模块，支持钩子：
 *   onLead(lead)           → 线索加工
 *   onWorkflowDone(run)    → 工作流后处理
 *   transform(query)       → 输入改写
 * 安装来源：内置市场 / 本地 JSON / 远程 URL（真实 fetch）
 */
import { get, set, uid } from './store.js';
import { emit } from './bus.js';
import { toast } from './ui.js';

/** 内置插件市场（随系统分发，可一键安装） */
export const MARKET = [
  {
    id: 'plg-tier-boost', name: 'Tier Booster · 高意图加权', version: '1.0.0', author: 'Global Eagle Core',
    desc: '对含「Requested Quote / Clicked」行为的线索自动加权 5 分，让高意图线索更快进入商机池。',
    code: `({ hooks: {
  onLead(lead) {
    const b = lead.behavior || {};
    if (b.clicked > 0 || lead.stage === 'RFQ') lead.lead_score = Math.min(100, (lead.lead_score||0) + 5);
    return lead;
  }
} })`,
  },
  {
    id: 'plg-cn-clean', name: 'CN Clean · 企业名标准化', version: '1.0.0', author: 'Global Eagle Core',
    desc: '统一企业名大小写与后缀（Ltd/Co., Ltd/Inc），提升线索去重命中率。',
    code: `({ hooks: {
  onLead(lead) {
    if (lead.company) lead.company = lead.company.replace(/\\s*Co\\.?,?\\s*Ltd\\.?$/i,' Ltd').replace(/\\s+/g,' ').trim();
    return lead;
  }
} })`,
  },
  {
    id: 'plg-wf-audit', name: 'Workflow Audit · 运行留痕', version: '1.0.0', author: 'Global Eagle Core',
    desc: '每次工作流完成后，将 Agent 摘要写入内容资产库，供复盘与 SOP 沉淀。',
    code: `({ hooks: {
  onWorkflowDone(run, store) {
    store.push('content', { id: 'ct_' + Date.now().toString(36), type: 'workflow_report:' + run.key, created_at: new Date().toISOString(), count: run.steps.length, data: run.steps.map(s => ({ name: s.name, summary: s.summary })) });
  }
} })`,
  },
];

export function listInstalled() { return get('plugins.list', []); }

/** 执行插件代码：真实 new Function 沙箱（仅暴露 hooks 约定与 ctx） */
function compile(plugin) {
  try {
    const ctx = {
      store: { get: (p, d) => get(p, d), push: (p, i) => set(p, [...get(p, []), i]) },
      console,
    };
    const val = new Function('ctx', `"use strict"; return (${plugin.code});`)(ctx);
    // 兼容两种插件形态：直接返回 {hooks}，或返回 (ctx)=>({hooks}) 工厂
    const inst = typeof val === 'function' ? val(ctx) : val;
    return { ok: true, hooks: inst?.hooks || {} };
  } catch (e) {
    return { ok: false, error: e.message, hooks: {} };
  }
}

export function install(idOrPlugin) {
  const src = typeof idOrPlugin === 'string' ? MARKET.find((m) => m.id === idOrPlugin) : idOrPlugin;
  if (!src) return { ok: false, error: '插件不存在' };
  const list = listInstalled();
  if (list.some((p) => p.id === src.id)) return { ok: false, error: '插件已安装' };
  const plugin = { ...src, installed_at: new Date().toISOString(), enabled: true };
  const c = compile(plugin);
  if (!c.ok) return { ok: false, error: `插件编译失败：${c.error}` };
  list.push(plugin);
  set('plugins.list', list);
  emit('plugins:change', list);
  return { ok: true, plugin };
}

export function uninstall(id) {
  set('plugins.list', listInstalled().filter((p) => p.id !== id));
  emit('plugins:change', listInstalled());
}

export function toggle(id) {
  const list = listInstalled();
  const p = list.find((x) => x.id === id);
  if (p) { p.enabled = !p.enabled; set('plugins.list', list); emit('plugins:change', list); }
}

/** 从 URL 安装（真实 fetch，返回 JSON：{id,name,version,desc,code}） */
export async function installFromURL(url) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json = await res.json();
    if (!json.code || !json.id) return { ok: false, error: '插件格式错误：需要 {id,name,code}' };
    return install({ ...json, author: json.author || url, source: url });
  } catch (e) {
    return { ok: false, error: `拉取失败：${e.message}` };
  }
}

export function installFromJSON(text) {
  try {
    const json = JSON.parse(text);
    if (!json.code || !json.id) return { ok: false, error: '插件格式错误：需要 {id,name,code}' };
    return install(json);
  } catch (e) { return { ok: false, error: `JSON 解析失败：${e.message}` }; }
}

/* ------------------------------------------------------- 钩子执行 */
function activeHooks() {
  const out = [];
  listInstalled().forEach((p) => {
    if (!p.enabled) return;
    const c = compile(p);
    if (c.ok) out.push({ plugin: p, hooks: c.hooks });
    else toast(`插件 ${p.name} 执行失败：${c.error}`, 'warn');
  });
  return out;
}

export function runOnLead(lead) {
  let l = lead;
  activeHooks().forEach(({ hooks }) => {
    try { if (hooks.onLead) l = hooks.onLead(l) || l; } catch (e) { console.warn('[plugin] onLead', e); }
  });
  return l;
}

export function runOnWorkflowDone(run) {
  activeHooks().forEach(({ hooks }) => {
    try { if (hooks.onWorkflowDone) hooks.onWorkflowDone(run, { get, push }); } catch (e) { console.warn('[plugin] onWorkflowDone', e); }
  });
}

export function runTransform(query) {
  let q = query;
  activeHooks().forEach(({ hooks }) => {
    try { if (hooks.transform) q = hooks.transform(q) ?? q; } catch (_) { /* noop */ }
  });
  return q;
}

export function newTemplate() {
  return JSON.stringify({
    id: `plg_${uid('x').slice(-6)}`, name: '自定义插件', version: '0.1.0', author: 'local',
    desc: '说明这个插件做什么',
    code: `({ hooks: {\n  onLead(lead) {\n    // 加工线索，返回修改后的 lead\n    return lead;\n  }\n} })`,
  }, null, 2);
}
