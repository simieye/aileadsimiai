/**
 * Global Eagle · Registry
 * Skill Registry / Tool Registry / Agent Registry / RBAC 权限体系
 */
import { AGENTS } from './agents.js';

export const SKILL_REGISTRY = {
  industry: ['industry_mapping', 'supply_chain_mapping', 'buyer_segmentation', 'market_ranking', 'tariff_lookup'],
  buyer: ['company_research', 'company_scoring', 'abcs_tiering', 'dmu_mapping'],
  prospecting: ['lead_discovery', 'lead_verification', 'contact_discovery', 'google_research'],
  enrichment: ['lead_enrichment', 'email_verification', 'customs_data'],
  scoring: ['icp_scoring', 'intent_scoring', 'lead_scoring'],
  email: ['email_sequence', 'followup_writing', 're_engagement', 'email_outreach'],
  linkedin: ['linkedin_outreach', 'connection_message'],
  social: ['youtube_content', 'tiktok_content', 'reddit_research', 'whatsapp_followup'],
  content: ['persona_content', 'value_proposition', 'case_based_content'],
  video: ['factory_video', 'product_video', 'case_video'],
  crm: ['pipeline_management', 'stage_transition', 'task_generation'],
  rfq: ['rfq_parsing', 'spec_extraction'],
  quotation: ['tiered_pricing', 'incoterms_calculation', 'margin_control'],
  'supply-chain': ['production_planning', 'logistics_planning', 'risk_check'],
  compliance: ['certification_check', 'regulation_check', 'ip_check'],
  analytics: ['funnel_analysis', 'roi_analysis', 'daily_report'],
  reporting: ['daily_report', 'campaign_report'],
  knowledge: ['graph_building', 'relation_inference'],
  memory: ['shared_context_read', 'shared_context_write'],
  automation: ['behavior_trigger', 'followup_workflow', 'approval_queue'],
};

export const TOOL_REGISTRY = [
  { id: 'google_search', name: 'Google 搜索', perm: 'read', desc: '企业/产品/新闻检索' },
  { id: 'linkedin_lookup', name: 'LinkedIn 查询', perm: 'read', desc: '决策人与职位识别' },
  { id: 'company_site_crawl', name: '企业官网解析', perm: 'read', desc: '品类/SKU/渠道分析' },
  { id: 'customs_data', name: '海关数据', perm: 'read', desc: '进口频次与供应链溯源' },
  { id: 'hscode_lookup', name: 'HS Code 查询', perm: 'read', desc: '税则与关税匹配' },
  { id: 'email_verify', name: '邮箱验证', perm: 'read', desc: 'SMTP 有效性校验' },
  { id: 'email_send', name: '邮件发送', perm: 'write', desc: '需 Human Approval' },
  { id: 'crm_write', name: 'CRM 写入', perm: 'write', desc: '管道与商机更新' },
  { id: 'llm_generate', name: 'LLM 内容生成', perm: 'write', desc: '千人千面内容' },
  { id: 'quotation_calc', name: '报价计算', perm: 'write', desc: '阶梯报价与贸易条款' },
];

export const AGENT_REGISTRY = AGENTS.map((a) => ({
  id: a.id, name: a.name, mission: a.mission, cluster: a.cluster, skills: a.skills,
}));

export const ROLES = ['Super Admin', 'Company Admin', 'Sales Manager', 'Sales', 'Marketing', 'Supply Chain', 'Finance', 'Partner', 'Agent'];

export const ROLE_PERMISSIONS = {
  'Super Admin': ['*'],
  'Company Admin': ['read:*', 'write:crm', 'write:content', 'approve:*'],
  'Sales Manager': ['read:*', 'write:crm', 'approve:quotation'],
  'Sales': ['read:leads', 'read:buyers', 'write:crm'],
  'Marketing': ['read:leads', 'write:content', 'write:campaign'],
  'Supply Chain': ['read:rfq', 'write:quotation', 'write:supply-chain'],
  'Finance': ['read:quotation', 'read:orders', 'approve:payment'],
  'Partner': ['read:leads'],
  'Agent': ['read:context', 'write:suggestion'],
};

export function can(role, perm) {
  const list = ROLE_PERMISSIONS[role] || [];
  return list.includes('*') || list.includes(perm) || list.includes(perm.split(':')[0] + ':*');
}

export default { SKILL_REGISTRY, TOOL_REGISTRY, AGENT_REGISTRY, ROLES, ROLE_PERMISSIONS, can };
