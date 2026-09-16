/**
 * Global Eagle · OpenClaw Orchestrator
 * 自然语言 → 意图识别 → 目标拆解 → Agent 编排 → 执行 → 质量检查 → CRM 回写 → 资产沉淀 → 复盘
 */
import { get, push, set, uid } from './store.js';
import { AGENT_MAP } from './agents.js';
import { emit } from './bus.js';
import { audit } from './approval.js';

export const WORKFLOWS = {
  'industry': { name: '产业与市场拆解', agents: ['industry_agent', 'market_intelligence_agent', 'knowledge_agent'] },
  'find-buyers': { name: '精准找买家', agents: ['industry_agent', 'market_intelligence_agent', 'buyer_profile_agent', 'dmu_agent', 'prospecting_agent', 'lead_enrichment_agent', 'lead_scoring_agent', 'crm_agent'] },
  'score': { name: '线索评分与优先级', agents: ['lead_scoring_agent', 'crm_agent'] },
  'content': { name: '千人千面内容生产', agents: ['content_agent', 'email_agent', 'linkedin_agent', 'social_agent'] },
  'campaign': { name: '30 天获客战役', agents: ['market_intelligence_agent', 'campaign_agent', 'buyer_profile_agent', 'prospecting_agent', 'content_agent', 'email_agent', 'crm_agent'] },
  'followup': { name: '自动跟进', agents: ['followup_agent', 'lead_scoring_agent', 'crm_agent'] },
  'rfq': { name: 'RFQ 解析与报价', agents: ['rfq_agent', 'quotation_agent', 'supply_chain_agent', 'compliance_agent', 'approval_agent'] },
  'analytics': { name: '数据复盘', agents: ['analytics_agent', 'asset_compounding_agent'] },
  'geo': { name: 'GEO/SEO 内容引擎', agents: ['geo_agent', 'knowledge_agent'] },
  'golden-path': {
    name: 'Golden Path 全链路',
    agents: ['industry_agent', 'market_intelligence_agent', 'knowledge_agent', 'buyer_profile_agent',
      'prospecting_agent', 'lead_enrichment_agent', 'lead_scoring_agent', 'dmu_agent', 'content_agent',
      'email_agent', 'followup_agent', 'crm_agent', 'rfq_agent', 'quotation_agent', 'analytics_agent',
      'asset_compounding_agent'],
  },
};

/* --------------------------------------------- 自然语言意图识别 */
const INTENT_RULES = [
  { re: /(产业|产业链|行业|市场拆解|industry)/i, wf: 'industry' },
  { re: /(找.*(采购商|买家|客户|经销商)|开发.*(客户|市场)|拓客|线索)/i, wf: 'find-buyers' },
  { re: /(评分|打分|筛选.*a类|a类客户|优先级)/i, wf: 'score' },
  { re: /(开发信|内容|话术|邮件|千人千面|文案)/i, wf: 'content' },
  { re: /(campaign|战役|获客计划|30天)/i, wf: 'campaign' },
  { re: /(跟进|follow ?up|未回复|再激活)/i, wf: 'followup' },
  { re: /(rfq|询盘|报价|阶梯|quotation)/i, wf: 'rfq' },
  { re: /(复盘|分析|roi|日报|数据)/i, wf: 'analytics' },
  { re: /(geo|seo|独立站|官网内容)/i, wf: 'geo' },
  { re: /(全链路|golden|一键|端到端|完整流程)/i, wf: 'golden-path' },
];

export function detectIntent(text) {
  for (const r of INTENT_RULES) if (r.re.test(text)) return r.wf;
  return 'find-buyers';
}

/** 从自然语言中抽取参数 */
export function extractParams(text) {
  const countries = get('markets').map((m) => m.country);
  const types = ['分销商', '进口商', '品牌商', '渠道商', '工程承包商', '批发商', '零售商'];
  const p = {};
  const c = countries.find((x) => text.includes(x));
  if (c) p.country = c;
  const t = types.find((x) => text.includes(x));
  if (t) p.buyer_type = t;
  const n = text.match(/(\d+)\s*(个|家|条)/);
  if (n) p.limit = Math.min(Number(n[1]), 60);
  const tier = (text.match(/\b([SABC])\s*类/) || [])[1];
  if (tier) p.tier = tier;
  return p;
}

/* ---------------------------------------------------------- 执行 */
export async function runWorkflow(key, params = {}, opts = {}) {
  const wf = WORKFLOWS[key];
  if (!wf) throw new Error(`未知工作流：${key}`);
  const run = {
    id: uid('wf'), key, name: wf.name, params,
    status: 'running', started_at: Date.now(), steps: [],
  };
  push('workflows', run);
  audit('workflow.start', `启动工作流：${wf.name}`, { params });
  emit('wf:start', run);

  let ctx = { ...params };
  for (const id of wf.agents) {
    const agent = AGENT_MAP[id];
    const step = { id, name: agent.name, mission: agent.mission, status: 'running', started_at: Date.now() };
    run.steps.push(step);
    emit('wf:step', { run, step });
    if (opts.delay !== false) await new Promise((r) => setTimeout(r, opts.delay ?? 150));
    try {
      const out = await agent.run(ctx);
      step.status = 'done';
      step.summary = out.summary;
      step.data = out.data;
      step.finished_at = Date.now();
      // Agent 间通过 Shared Context 传递结果
      ctx = { ...ctx, ...params, [id]: out.data };
      if (id === 'content_agent') ctx.contents = out.data.contents;
      if (id === 'buyer_profile_agent') ctx.buyers = out.data.buyers;
      if (id === 'prospecting_agent') ctx.leads = out.data.leads;
      audit('agent.run', `${agent.name}：${out.summary}`, { agent: id });
    } catch (err) {
      step.status = 'error';
      step.summary = `执行失败：${err.message} → 已升级至 Human Approval（信息不足，需要人工确认）`;
      audit('agent.error', `${agent.name} 执行失败：${err.message}`, { agent: id });
    }
    emit('wf:step', { run, step });
  }
  run.status = 'done';
  run.finished_at = Date.now();
  run.duration = run.finished_at - run.started_at;
  const idx = get('workflows').findIndex((w) => w.id === run.id);
  set(`workflows[${idx}]`, run);
  audit('workflow.done', `工作流完成：${wf.name}`, { steps: run.steps.length });
  emit('wf:done', run);
  return run;
}

/** 自然语言直接执行 */
export async function ask(text, opts = {}) {
  const key = detectIntent(text);
  const params = extractParams(text);
  return runWorkflow(key, { ...params, raw: text }, opts);
}

export default { WORKFLOWS, detectIntent, extractParams, runWorkflow, ask };
