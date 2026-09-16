/**
 * Global Eagle · 技能库（Skill Pack Registry）
 * 技能包 = 有序 Agent 编排（可导入/导出/运行），是 Orchestrator 工作流的可分发形态。
 * 安装来源：内置市场 / 本地 JSON / 远程 URL（真实 fetch）
 */
import { get, set, uid } from './store.js';
import { emit } from './bus.js';
import { WORKFLOWS } from './orchestrator.js';

/** 内置技能包市场 */
export const MARKET = [
  {
    id: 'skill-mea', name: '中东工程承包商攻坚包', version: '1.0.0',
    desc: '锁定中东高增长市场，聚焦工程承包商买家圈层，产出项目型报价内容。',
    steps: [
      { agent: 'industry_agent', params: {} },
      { agent: 'market_intelligence_agent', params: { country: '沙特阿拉伯' } },
      { agent: 'buyer_profile_agent', params: { buyer_type: '工程承包商' } },
      { agent: 'prospecting_agent', params: {} },
      { agent: 'lead_enrichment_agent', params: {} },
      { agent: 'lead_scoring_agent', params: {} },
      { agent: 'content_agent', params: {} },
      { agent: 'crm_agent', params: {} },
    ],
  },
  {
    id: 'skill-na-brand', name: '北美品牌商 ODM 包', version: '1.0.0',
    desc: '面向北美品牌商的 ODM 差异化打法：技术背书 + 合规材料 + 私模方案。',
    steps: [
      { agent: 'market_intelligence_agent', params: { country: '美国' } },
      { agent: 'buyer_profile_agent', params: { buyer_type: '品牌商' } },
      { agent: 'dmu_agent', params: {} },
      { agent: 'prospecting_agent', params: { role: '产品经理' } },
      { agent: 'content_agent', params: {} },
      { agent: 'linkedin_agent', params: {} },
      { agent: 'compliance_agent', params: {} },
    ],
  },
  {
    id: 'skill-reactivate', name: '沉默客户再激活包', version: '1.0.0',
    desc: '对 30 天无互动线索执行 Re-engagement 序列并重算优先级。',
    steps: [
      { agent: 'followup_agent', params: {} },
      { agent: 'lead_scoring_agent', params: {} },
      { agent: 'content_agent', params: {} },
      { agent: 'email_agent', params: {} },
      { agent: 'analytics_agent', params: {} },
    ],
  },
];

export function listInstalled() { return get('skills.list', []); }

export function install(idOrPack) {
  const src = typeof idOrPack === 'string' ? MARKET.find((m) => m.id === idOrPack) : idOrPack;
  if (!src) return { ok: false, error: '技能包不存在' };
  const list = listInstalled();
  if (list.some((s) => s.id === src.id)) return { ok: false, error: '技能包已安装' };
  if (!Array.isArray(src.steps) || !src.steps.length) return { ok: false, error: '技能包格式错误：steps 不能为空' };
  list.push({ ...src, installed_at: new Date().toISOString() });
  set('skills.list', list);
  emit('skills:change', list);
  return { ok: true };
}

export function uninstall(id) {
  set('skills.list', listInstalled().filter((s) => s.id !== id));
  emit('skills:change', listInstalled());
}

export async function installFromURL(url) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json = await res.json();
    return install({ ...json, source: url });
  } catch (e) { return { ok: false, error: `拉取失败：${e.message}` }; }
}

export function installFromJSON(text) {
  try { return install(JSON.parse(text)); }
  catch (e) { return { ok: false, error: `JSON 解析失败：${e.message}` }; }
}

/** 将技能包注册为可执行工作流并运行（真实走 Orchestrator） */
export async function run(packId) {
  const pack = listInstalled().find((s) => s.id === packId) || MARKET.find((m) => m.id === packId);
  if (!pack) throw new Error('技能包不存在');
  const key = `skill:${pack.id}`;
  WORKFLOWS[key] = { name: `技能包：${pack.name}`, agents: pack.steps.map((s) => s.agent) };
  const { runWorkflow } = await import('./orchestrator.js');
  return runWorkflow(key, {}, { delay: 120 });
}

/** 导出：当前所有系统工作流 → 技能包 JSON（真实可导入） */
export function exportSystemWorkflows() {
  return JSON.stringify(Object.entries(WORKFLOWS).map(([id, w]) => ({
    id: `skill-${id}`, name: w.name, version: '1.0.0', desc: `由系统工作流 ${id} 导出`,
    steps: w.agents.map((a) => ({ agent: a, params: {} })),
  })), null, 2);
}

export function newTemplate() {
  return JSON.stringify({
    id: `skill_${uid('x').slice(-6)}`, name: '自定义技能包', version: '0.1.0',
    desc: '说明这个技能包解决什么问题',
    steps: [{ agent: 'prospecting_agent', params: {} }, { agent: 'lead_scoring_agent', params: {} }],
  }, null, 2);
}
