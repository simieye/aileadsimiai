/**
 * Global Eagle · 四维 Lead Score 引擎
 * Lead Score = ICP Match + Purchase Intent + Company Value + Engagement
 * 原则：每分必须有依据；数据缺失时降低置信度并输出「信息不足，需要人工确认」
 */
import { get } from './store.js';

const TIER_TARGETS = ['分销商', '进口商', '品牌商', '渠道商', '工程承包商', '批发商'];
const HIGH_VALUE_COUNTRIES = ['德国', '美国', '澳大利亚', '阿联酋'];

export function scoreLead(lead) {
  const reasons = [];
  const gaps = [];

  // 1) ICP Match（0-100）
  let icp = 0;
  const b = lead.buyer || {};
  if (TIER_TARGETS.includes(b.buyer_type)) { icp += 35; reasons.push(`客户类型「${b.buyer_type}」属于目标 ICP 画像（+35）`); }
  else { icp += 12; reasons.push(`客户类型「${b.buyer_type || '未知'}」非核心 ICP（+12）`); }
  icp += Math.round((b.product_match || 50) * 0.45);
  reasons.push(`产品匹配度 ${b.product_match || 50}/100（+${Math.round((b.product_match || 50) * 0.45)}）`);
  if ((b.employees || 0) >= 80) { icp += 18; reasons.push(`员工规模 ${b.employees} 人，具备稳定采购组织（+18）`); }
  else if (b.employees) { icp += 8; reasons.push(`员工规模 ${b.employees} 人，采购组织偏小（+8）`); }
  else gaps.push('企业规模未知');

  // 2) Purchase Intent（0-100）
  let intent = 0;
  const signals = b.intent_signals || [];
  intent += Math.min(signals.length * 18, 54);
  if (signals.length) reasons.push(`捕获 ${signals.length} 条意向信号：${signals.join('、')}（+${Math.min(signals.length * 18, 54)}）`);
  else { gaps.push('未捕获意向信号'); reasons.push('无公开意向信号（+0）'); }
  const impMap = { 强: 30, 中强: 22, 中: 14 };
  intent += impMap[b.import_ability] || 10;
  reasons.push(`进口/采购能力「${b.import_ability || '未知'}」（+${impMap[b.import_ability] || 10}）`);
  if (lead.behavior) {
    const { opened = 0, clicked = 0, replied = 0, visited = 0 } = lead.behavior;
    intent += Math.min(visited * 3 + clicked * 4, 16);
    if (replied) intent += 10;
  }

  // 3) Company Value（0-100）
  const bandMap = { '50-100M': 85, '10-50M': 68, '5-10M': 48 };
  let value = bandMap[b.revenue_band] || 40;
  reasons.push(`营收带 ${b.revenue_band || '未知'} → 企业价值 ${value}`);
  if (HIGH_VALUE_COUNTRIES.includes(b.country)) { value += 10; reasons.push(`位于高价值市场 ${b.country}（+10）`); }
  value += Math.min(Math.round((b.employees || 0) / 12), 12);

  // 4) Engagement（0-100）
  let eng = 0;
  const beh = lead.behavior || {};
  if (beh.opened) { eng += Math.min(beh.opened * 6, 30); reasons.push(`邮件打开 ${beh.opened} 次（+${Math.min(beh.opened * 6, 30)}）`); }
  if (beh.clicked) { eng += Math.min(beh.clicked * 10, 30); reasons.push(`点击 ${beh.clicked} 次（+${Math.min(beh.clicked * 10, 30)}）`); }
  if (beh.replied) { eng += 40; reasons.push(`已产生回复 ${beh.replied} 次（+40）`); }
  if (!beh.opened && !beh.clicked && !beh.replied) { eng = 5; reasons.push('尚无互动行为（+5，基线）'); }

  const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
  icp = clamp(icp); intent = clamp(intent); value = clamp(value); eng = clamp(eng);

  const total = Math.round(icp * 0.3 + intent * 0.3 + value * 0.25 + eng * 0.15);
  const tier = total >= 82 ? 'S' : total >= 66 ? 'A' : total >= 50 ? 'B' : 'C';

  // 置信度
  if (!lead.contact_email) gaps.push('决策人邮箱未验证');
  if (b.verified === false) gaps.push('企业信息未核验');
  const confidence = gaps.length >= 2 ? '低' : gaps.length === 1 ? '中' : '高';

  return {
    icp, intent, value, engagement: eng, total, tier, confidence,
    reasons,
    gaps,
    note: gaps.length ? '信息不足，需要人工确认。' : '评分依据完整，可用于外发优先级排序。',
  };
}

/** 依据 CRM 阶段与行为推进，重新计算全量线索分 */
export function rescoreAll() {
  const leads = get('leads', []);
  leads.forEach((l) => {
    const s = scoreLead(l);
    Object.assign(l, {
      icp_score: s.icp,
      intent_score: s.intent,
      value_score: s.value,
      engagement_score: s.engagement,
      lead_score: s.total,
      tier: s.tier,
      score_reasons: s.reasons,
      score_gaps: s.gaps,
      confidence: s.confidence,
    });
  });
  return leads;
}

export function tierStats() {
  const leads = get('leads', []);
  return {
    total: leads.length,
    S: leads.filter((l) => l.tier === 'S').length,
    A: leads.filter((l) => l.tier === 'A').length,
    B: leads.filter((l) => l.tier === 'B').length,
    C: leads.filter((l) => l.tier === 'C').length,
  };
}

export default { scoreLead, rescoreAll, tierStats };
