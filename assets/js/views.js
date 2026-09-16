/**
 * Global Eagle · SaaS 视图层
 */
import { state, get } from './store.js';
import { esc, money, pct, card, kpi, table, bars, ring, section, chip, tierBadge, riskBadge, code } from './ui.js';
import { PIPELINE } from './agents.js';
import { WORKFLOWS } from './orchestrator.js';
import { APPROVAL_TYPES } from './approval.js';
import { SKILL_REGISTRY, TOOL_REGISTRY, AGENT_REGISTRY, ROLES, ROLE_PERMISSIONS } from './registry.js';

const RUN_BTN = (wf, label, cls = 'primary') =>
  `<button class="btn ${cls}" data-act="run-wf" data-wf="${wf}">${label}</button>`;

/* ============================================================ Dashboard */
export const dashboard = {
  id: 'dashboard', name: '作战大屏', icon: '◈', group: '总览',
  render() {
    const leads = get('leads', []);
    const opps = get('opportunities', []);
    const t = (x) => leads.filter((l) => l.tier === x).length;
    const replied = leads.filter((l) => (l.behavior?.replied || 0) > 0).length;
    const byCountry = [...new Set(leads.map((l) => l.country))].map((c) => ({
      label: c, value: leads.filter((l) => l.country === c).length, display: `${leads.filter((l) => l.country === c).length} 条`,
    })).sort((a, b) => b.value - a.value).slice(0, 8);
    const funnel = PIPELINE.map((s) => ({ label: s, value: leads.filter((l) => (l.stage || '新线索') === s).length, display: `${leads.filter((l) => (l.stage || '新线索') === s).length}` }));

    return `
    ${section('全球鹰作战大屏', 'AI 找市场 → 找企业 → 找决策人 → 生成内容 → 精准触达 → 跟进 → 成交 → 资产沉淀')}
    <div class="hero">
      <div class="hero-l">
        <div class="hero-tag">GLOBAL EAGLE · OpenClaw Agent Cluster</div>
        <h1>输入一个产品，AI 跑完外贸增长全链路</h1>
        <p>产业知识图谱 × 24 个 Agent × 全球买家数据 × 多渠道触达 × CRM × 供应链 × GEO × 数据资产</p>
        <div class="hero-btns">
          ${RUN_BTN('golden-path', '▶ 运行 Golden Path 全链路')}
          ${RUN_BTN('find-buyers', '找买家', 'ghost')}
          ${RUN_BTN('campaign', '30 天获客战役', 'ghost')}
        </div>
      </div>
      <div class="hero-r">
        ${ring(leads.length ? Math.round(leads.reduce((s, l) => s + l.lead_score, 0) / leads.length) : 0, leads.length ? 'AVG' : '-')}
        <div class="hero-meta">线索池平均分 / ${leads.length} 条线索</div>
      </div>
    </div>

    <div class="kpis">
      ${kpi('线索总数', leads.length || '—', '全域拓客 Agent', 18)}
      ${kpi('S 类战略客户', t('S'), '建议高管直跟', 12)}
      ${kpi('A 类高价值', t('A'), '进入商机池', 9)}
      ${kpi('商机管道', money(opps.reduce((s, o) => s + o.value, 0)), `${opps.length} 个商机`, 22)}
      ${kpi('RFQ / 报价', `${get('rfqs').length} / ${get('quotations').length}`, '含人工审批', 6)}
      ${kpi('回复率', leads.length ? pct(replied / leads.length * 100) : '—', `${replied} 家已回复`, -2)}
    </div>

    <div class="grid-2">
      ${card('国家线索分布', bars(byCountry.length ? byCountry : [{ label: '暂无数据', value: 1, display: '0' }]), { right: RUN_BTN('find-buyers', '挖掘', 'ghost sm') })}
      ${card('CRM 管道分布', bars(funnel), { right: RUN_BTN('analytics', '复盘', 'ghost sm') })}
    </div>

    <div class="grid-2">
      ${card('TOP 高价值线索', table(['企业', '国家', '决策人', '角色', '评分'], [...leads].sort((a, b) => b.lead_score - a.lead_score).slice(0, 6).map((l) => [
        esc(l.company), esc(l.country), esc(l.decision_maker), esc(l.role), `${l.lead_score} ${tierBadge(l.tier)}`,
      ]), { empty: '尚未挖掘线索，点击「运行 Golden Path」' }), { right: RUN_BTN('golden-path', '全链路', 'ghost sm') })}
      ${card('待人工审批', table(['事项', '类型', '风险'], get('approvals').filter((a) => a.status === 'pending').slice(0, 5).map((a) => [
        esc(a.title), esc(APPROVAL_TYPES[a.type] || a.type), riskBadge(a.risk),
      ]), { empty: '暂无待审批事项' }), { right: `<button class="btn ghost sm" data-act="nav" data-view="approval">前往</button>` })}
    </div>

    ${card('实时 Agent 事件流', `<div class="timeline" id="dash-timeline">${(get('workflows').slice(-1)[0]?.steps || []).slice(-8).map((s) => `<div class="tl-item"><b>${esc(s.name)}</b><span>${esc(s.summary || '执行中…')}</span></div>`).join('') || '<div class="empty">尚未执行工作流</div>'}</div>`)}
    `;
  },
};

/* ============================================================ 产业拆解 */
export const industryView = {
  id: 'industry', name: '产业拆解', icon: '⬡', group: '感知层',
  render() {
    const ind = get('industry');
    const markets = get('markets');
    const last = get('workflows').slice().reverse().find((w) => w.steps.some((s) => s.id === 'market_intelligence_agent'));
    const step = last?.steps.find((s) => s.id === 'market_intelligence_agent' || s.id === 'industry_agent');
    return `
    ${section('五维产业链拆解引擎', 'Dimension 01 产业链结构 · 02 采购决策链 · 03 获客渠道')}
    <div class="toolbar">${RUN_BTN('industry', '▶ 运行产业拆解 Agent')}<button class="btn ghost" data-act="run-wf" data-wf="geo">GEO/SEO 页面规划</button></div>

    <div class="grid-2">
      ${card('产业链结构', ind.chain.map((c) => `<div class="chain-row"><span class="chain-layer">${esc(c.layer)}</span><div>${c.items.map((i) => chip(i)).join('')}</div></div>`).join(''))}
      ${card('目标国家市场评分', bars(markets.map((m) => ({ label: `${m.country} · 需求${m.demand}`, value: m.demand, display: m.growth ? `+${(m.growth * 100).toFixed(0)}%` : '' }))))}
    </div>

    ${card('国家市场情报', table(['国家', '需求', '竞争', '增速', '关税', '优先渠道', '洞察'], markets.map((m) => [
      `<b>${esc(m.country)}</b>`, m.demand, m.competition, `+${(m.growth * 100).toFixed(0)}%`, esc(m.tariff),
      m.channels.map((c) => chip(c)).join(''), esc(m.note),
    ])))}

    ${card('DMU 决策角色库', `<div>${ind.dmu.map((d) => chip(d)).join('')}</div>
      <div class="mt">${table(['角色', '职责', '决策权', '介入阶段'], [
  ['CEO / Owner', '预算与战略审批', '最终决策', '战略客户'],
  ['Procurement Director', '供应商准入与年度框架', '决策', '商务谈判'],
  ['Purchasing Manager', '询价、比价、下单', '执行', 'RFQ / 报价'],
  ['Technical Director', '技术审核与认证确认', '否决', '技术评估'],
  ['Product Manager', '定义规格与卖点', '影响', '需求定义'],
  ['Operations Director', '库存与交付节奏', '影响', '履约'],
])}</div>`)}

    ${card('Agent 输出', step ? code(JSON.stringify(step.data, null, 2).slice(0, 1600)) : '<div class="empty">运行 Agent 后在此查看结构化输出</div>')}
    `;
  },
};

/* ============================================================ 买家画像 */
export const buyersView = {
  id: 'buyers', name: '买家画像', icon: '◎', group: '决策层',
  render() {
    const buyers = get('buyers');
    const dmuStep = get('workflows').slice().reverse().find((w) => w.steps.some((s) => s.id === 'dmu_agent'))?.steps.find((s) => s.id === 'dmu_agent');
    const filter = state.ui?.buyerCountry || '';
    const list = filter ? buyers.filter((b) => b.country === filter) : buyers;
    return `
    ${section('买家画像与决策链（DMU）', '找对企业 → 找对人 → 看清采购能力')}
    <div class="toolbar">
      <select data-act="filter-buyer-country">${['', ...new Set(buyers.map((b) => b.country))].map((c) => `<option value="${c}" ${filter === c ? 'selected' : ''}>${c || '全部国家'}</option>`).join('')}</select>
      ${RUN_BTN('find-buyers', '▶ 运行买家画像 + DMU')}
    </div>

    ${card('企业画像库', table(['企业', '国家', '类型', '规模', '营收', '匹配度', '进口能力', '意向信号'], list.map((b) => [
      `<b>${esc(b.company)}</b><div class="sub">${esc(b.website)}</div>`, esc(b.country), chip(b.buyer_type), esc(b.company_size),
      esc(b.revenue_band), `${b.product_match}/100`, esc(b.import_ability), b.intent_signals.map((s) => chip(s, 'sig')).join(''),
    ])))}

    ${card('决策链 DMU 图谱', dmuStep ? table(['企业', '决策人', '角色', '职责', '决策权', '邮箱状态'], dmuStep.data.dmu.flatMap((d) => d.chain.map((c, i) => [
      i === 0 ? `<b>${esc(d.company)}</b>` : '', esc(c.person), `${esc(c.role)}<div class="sub">${esc(c.role_en)}</div>`,
      esc(c.duty), esc(c.power), c.verified ? '已核验' : `<span class="warn">${esc(c.note)}</span>`,
    ]))) : '<div class="empty">运行「买家画像 + DMU」后生成</div>')}
    `;
  },
};

/* ============================================================ 全域拓客 */
export const prospectingView = {
  id: 'prospecting', name: 'AI 拓客', icon: '⌖', group: '执行层',
  render() {
    const leads = get('leads', []);
    const tf = state.ui?.tierFilter || '';
    const list = tf ? leads.filter((l) => l.tier === tf) : leads;
    return `
    ${section('全域拓客与四维 Lead Score', 'Lead Score = ICP Match + Purchase Intent + Company Value + Engagement')}
    <div class="toolbar">
      ${['', 'S', 'A', 'B', 'C'].map((t) => `<button class="btn ${tf === t ? 'primary' : 'ghost'} sm" data-act="filter-tier" data-tier="${t}">${t || '全部'}${t ? ' 类' : ''}</button>`).join('')}
      <span class="spacer"></span>
      <input id="prospect-q" class="input" placeholder="输入自然语言：帮我找 20 个德国泳池设备分销商" value="${esc(state.ui?.prospectQuery || '')}" />
      <button class="btn" data-act="nl-run">执行</button>
      ${RUN_BTN('find-buyers', '▶ 重新挖掘', 'ghost')}
      ${RUN_BTN('score', '重算评分', 'ghost')}
    </div>

    ${card('线索池', table(['企业', '国家', '决策人 / 角色', '邮箱', 'ICP', '意向', '价值', '互动', '总分', '置信', '依据'], list.map((l) => [
      `<b>${esc(l.company)}</b><div class="sub">${esc(l.buyer_type || '-')} · ${esc(l.source || '')}</div>`, esc(l.country),
      `${esc(l.decision_maker)}<div class="sub">${esc(l.role)}</div>`,
      l.contact_email ? esc(l.contact_email) : '<span class="warn">缺失</span>',
      l.icp_score, l.intent_score, l.value_score, l.engagement_score,
      `<b>${l.lead_score}</b> ${tierBadge(l.tier)}`,
      l.confidence === '低' ? '<span class="warn">低</span>' : esc(l.confidence),
      `<button class="btn ghost xs" data-act="show-reasons" data-id="${l.id}">查看</button>`,
    ])), { right: `<span class="sub">${list.length} 条</span>` })}

    <div id="reason-panel"></div>

    ${card('意向信号与真实性约束', `<ul class="list">
      <li>所有企业/联系人标记为<b>未核验</b>，来源为演示数据 —— 对外使用前必须人工核验。</li>
      <li>评分依据来自：客户类型、产品匹配、员工规模、意向信号、进口能力、互动行为；缺失字段会拉低置信度。</li>
      <li>禁止无依据给分：任何字段缺失均输出「信息不足，需要人工确认」。</li>
    </ul>`)}
    `;
  },
};

/* ============================================================ 内容工厂 */
export const marketingView = {
  id: 'marketing', name: '内容工厂', icon: '✎', group: '执行层',
  render() {
    const contents = (get('workflows').slice().reverse().find((w) => w.steps.some((s) => s.id === 'content_agent'))?.steps.find((s) => s.id === 'content_agent')?.data.contents) || [];
    const seqs = (get('workflows').slice().reverse().find((w) => w.steps.some((s) => s.id === 'email_agent'))?.steps.find((s) => s.id === 'email_agent')?.data.sequences) || [];
    const li = (get('workflows').slice().reverse().find((w) => w.steps.some((s) => s.id === 'linkedin_agent'))?.steps.find((s) => s.id === 'linkedin_agent')?.data.messages) || [];
    const social = (get('workflows').slice().reverse().find((w) => w.steps.some((s) => s.id === 'social_agent'))?.steps.find((s) => s.id === 'social_agent')?.data) || null;
    return `
    ${section('千人千面内容工厂', '千人千角色 · 千人千痛点 · 千人千话术')}
    <div class="toolbar">
      <select id="content-tier"><option value="">全部线索</option>${['S', 'A', 'B'].map((t) => `<option value="${t}">${t} 类</option>`).join('')}</select>
      <select id="content-product">${get('products').map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>
      ${RUN_BTN('content', '▶ 生成内容 + 邮件 + LinkedIn + 社媒')}
    </div>

    ${card('内容策略（角色痛点 × 客户类型 × 国别）', table(['企业', '决策人 / 角色', '产品', '切入角度', '核心痛点', '价值主张'], contents.map((c) => [
      esc(c.company), `${esc(c.person)}<div class="sub">${esc(c.role)}</div>`, esc(c.product), chip(c.angle),
      esc(c.pain), `<ul class="mini">${c.value_prop.map((v) => `<li>${esc(v)}</li>`).join('')}</ul>`,
    ])), { empty: '运行内容 Agent 后生成' })}

    ${card('邮件序列（4 步）', seqs.length ? seqs.slice(0, 4).map((s) => `<div class="seq">
      <div class="seq-hd">${esc(s.to)} → ${esc(s.person)}</div>
      ${s.sequence.map((m) => `<div class="seq-item"><span class="seq-step">${m.step}</span><b>${esc(m.type)}</b>
        <div class="sub">${esc(m.subject)}</div><pre class="mail">${esc(m.body)}</pre></div>`).join('')}
    </div>`).join('') : '<div class="empty">运行邮件 Agent 后生成</div>')}

    ${card('LinkedIn 话术', li.length ? table(['对象', '角色', '连接请求', '首信', '跟进'], li.map((m) => [
      esc(m.person), esc(m.role), esc(m.connect), esc(m.first_msg), esc(m.followup),
    ])) : '<div class="empty">运行 LinkedIn Agent 后生成</div>')}

    ${card('社媒内容脚本', social ? `
      <div class="grid-2">
        <div><h4>LinkedIn Post</h4><pre class="mail">${esc(social.linkedin_post)}</pre></div>
        <div><h4>YouTube Script</h4><pre class="mail">${esc(social.youtube_script)}</pre></div>
        <div><h4>TikTok Script</h4><pre class="mail">${esc(social.tiktok_script)}</pre></div>
        <div><h4>Reddit 洞察</h4><pre class="mail">${esc(social.reddit)}</pre></div>
      </div>` : '<div class="empty">运行社媒 Agent 后生成</div>')}
    `;
  },
};

/* ============================================================ CRM */
export const crmView = {
  id: 'crm', name: 'CRM 管道', icon: '▤', group: '决策层',
  render() {
    const leads = get('leads', []);
    const opps = get('opportunities', []);
    return `
    ${section('CRM 全生命周期管道', PIPELINE.join(' → '))}
    <div class="toolbar">${RUN_BTN('crm', '▶ 同步 CRM')}<span class="sub">管道总额 ${money(opps.reduce((s, o) => s + o.value, 0))}</span></div>
    <div class="kanban">
      ${PIPELINE.map((st) => `<div class="kb-col">
        <div class="kb-hd">${esc(st)}<span>${leads.filter((l) => (l.stage || '新线索') === st).length}</span></div>
        ${leads.filter((l) => (l.stage || '新线索') === st).slice(0, 12).map((l) => `<div class="kb-card">
          <div class="kb-t">${esc(l.company)}</div>
          <div class="sub">${esc(l.decision_maker)} · ${esc(l.country)}</div>
          <div class="kb-f"><span>${l.lead_score} 分</span> ${tierBadge(l.tier)}
            <button class="btn ghost xs" data-act="advance" data-id="${l.id}">推进 ▶</button></div>
        </div>`).join('') || '<div class="kb-empty">—</div>'}
      </div>`).join('')}
    </div>
    ${card('商机池', table(['企业', '国家', '阶段', '等级', '预估金额', '负责人', '下一步动作'], opps.map((o) => [
      esc(o.company), esc(o.country), esc(o.stage), tierBadge(o.tier), money(o.value), esc(o.owner), esc(o.next_action),
    ])), { empty: '运行 CRM Agent 同步 A/S 类线索' })}
    `;
  },
};

/* ============================================================ RFQ / 报价 / 履约 */
export const dealView = {
  id: 'deal', name: 'RFQ / 报价 / 履约', icon: '⛬', group: '执行层',
  render() {
    const rfq = get('rfqs')[0];
    const q = get('quotations').slice(-1)[0];
    const sc = get('workflows').slice().reverse().find((w) => w.steps.some((s) => s.id === 'supply_chain_agent'))?.steps.find((s) => s.id === 'supply_chain_agent')?.data;
    const cp = get('workflows').slice().reverse().find((w) => w.steps.some((s) => s.id === 'compliance_agent'))?.steps.find((s) => s.id === 'compliance_agent')?.data;
    return `
    ${section('RFQ 解析 · 阶梯报价 · 履约风控', 'AI 负责效率，人负责最终决策')}
    <div class="toolbar">${RUN_BTN('rfq', '▶ 解析 RFQ + 生成报价 + 风控')}</div>

    ${card('RFQ 原文', code(rfq.raw))}
    ${card('结构化解析结果', rfq.parsed ? table(['字段', '值'], Object.entries(rfq.parsed).map(([k, v]) => [
      esc(k), Array.isArray(v) ? v.map(esc).join('，') || '—' : esc(String(v)),
    ])) : '<div class="empty">运行 RFQ Agent 后生成</div>')}

    ${card('阶梯报价（已提交人工审批）', q ? `
      <div class="grid-2">
        <div>${table(['数量', '单价', '折扣', '金额', '毛利'], q.tiers.map((t) => [t.qty, money(t.unit_price), t.discount, money(t.amount), t.margin]))}</div>
        <div>${table(['贸易条款', '单价', '说明'], q.incoterms.map((i) => [i.term, money(i.unit_price), esc(i.note)]))}</div>
      </div>
      <div class="mt"><b>MOQ：</b>${esc(q.moq)} · <b>交期：</b>${esc(q.lead_time)} · <b>付款：</b>${esc(q.payment.join(' / '))} · <b>状态：</b>${esc(q.status)}</div>
    ` : '<div class="empty">运行报价 Agent 后生成</div>')}

    ${card('供应链履约方案', sc ? `
      <div class="grid-2">
        <div><h4>生产</h4><ul class="list"><li>${esc(sc.production.capacity_check)}</li><li>交期：${esc(sc.production.lead_time)}</li><li>瓶颈：${esc(sc.production.bottleneck)}</li></ul></div>
        <div><h4>物流</h4><ul class="list"><li>${esc(sc.logistics.mode)}</li><li>${esc(sc.logistics.transit)}</li><li>${esc(sc.logistics.risk)}</li></ul></div>
      </div>
      <div class="mt">${table(['风险项', '等级', '说明'], sc.risks.map((r) => [esc(r.item), riskBadge(r.level), esc(r.detail)]))}</div>
    ` : '<div class="empty">运行供应链 Agent 后生成</div>')}

    ${card('合规风控（禁止虚构认证）', cp ? table(['资质', '市场', '状态', '说明'], cp.result.map((r) => [
      esc(r.name), esc(r.market), r.verified ? '<span class="ok">可引用</span>' : `<span class="warn">${esc(r.status)}</span>`, esc(r.note),
    ])) : '<div class="empty">运行合规 Agent 后生成</div>')}
    `;
  },
};

/* ============================================================ Campaign */
export const campaignView = {
  id: 'campaign', name: '获客战役', icon: '➤', group: '决策层',
  render() {
    const camps = get('campaigns');
    return `
    ${section('30 天精准获客 Campaign', 'Campaign Strategy → 受众 → 线索 → 内容 → 邮件序列 → 社媒 → 落地页 → 跟进 → CRM → 复盘')}
    <div class="toolbar">
      <select id="camp-country">${get('markets').map((m) => `<option>${esc(m.country)}</option>`).join('')}</select>
      <input id="camp-goal" class="input" placeholder="目标：获取 20 个有效 RFQ" />
      ${RUN_BTN('campaign', '▶ 生成战役')}
    </div>
    ${camps.length ? camps.slice().reverse().map((c) => card(`${esc(c.name)} · 目标 ${esc(c.goal)}`, `
      <div class="sub">预算 ${money(c.budget)} · 受众 ${esc(c.target)} · 状态 ${esc(c.status)}</div>
      <div class="mt">${table(['阶段', '目标', '关键动作'], c.plan.map((p) => [esc(p.phase), esc(p.goal), p.actions.map((a) => chip(a)).join('')]))}</div>
      <div class="mt"><b>KPI：</b>线索 ${c.kpi.leads} · 回复率 ${(c.kpi.reply_rate * 100).toFixed(0)}% · RFQ ${c.kpi.rfq} · 样品 ${c.kpi.sample} · 订单 ${c.kpi.order}</div>
    `)).join('') : '<div class="empty">尚未创建战役</div>'}
    `;
  },
};

/* ============================================================ 分析 */
export const analyticsView = {
  id: 'analytics', name: '数据复盘', icon: '◍', group: '决策层',
  render() {
    const daily = get('analytics.daily', []);
    const last = daily.slice(-1)[0] || {};
    const leads = get('leads', []);
    const byTier = ['S', 'A', 'B', 'C'].map((t) => ({ label: `${t} 类`, value: leads.filter((l) => l.tier === t).length, display: `${leads.filter((l) => l.tier === t).length}`, cls: `t-${t.toLowerCase()}` }));
    const byCountry = [...new Set(leads.map((l) => l.country))].map((c) => ({
      label: c, value: leads.filter((l) => l.country === c).reduce((s, l) => s + l.lead_score, 0),
      display: `${Math.round(leads.filter((l) => l.country === c).reduce((s, l) => s + l.lead_score, 0) / (leads.filter((l) => l.country === c).length || 1))} 均分`,
    })).sort((a, b) => b.value - a.value).slice(0, 8);
    return `
    ${section('全球鹰数据复盘', '核心不是「发了多少开发信」，而是 Revenue per Agent / per Campaign / per Market')}
    <div class="toolbar">${RUN_BTN('analytics', '▶ 生成日报 + 资产沉淀')}</div>
    <div class="kpis">
      ${kpi('新增线索', last.new_leads ?? '—', '本轮', 18)}
      ${kpi('触达', last.touched ?? '—', '已打开/点击', 12)}
      ${kpi('回复率', last.reply_rate != null ? pct(last.reply_rate) : '—', `${last.replied ?? 0} 家`, -2)}
      ${kpi('RFQ', last.rfq ?? get('rfqs').length, '询盘数', 8)}
      ${kpi('报价', last.quotation ?? get('quotations').length, '含审批', 6)}
      ${kpi('管道金额', money(last.pipeline_value || 0), '商机池', 22)}
    </div>
    <div class="grid-2">
      ${card('客户分层', bars(byTier))}
      ${card('国家质量（总分 / 均分）', bars(byCountry.length ? byCountry : [{ label: '暂无', value: 1, display: '0' }]))}
    </div>
    ${card('AI 洞察', last.insights ? `<ul class="list">${last.insights.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '<div class="empty">运行分析 Agent 后生成</div>')}
    ${card('历史日报', table(['日期', '线索', 'S/A', '回复率', 'RFQ', '报价', '管道'], daily.slice().reverse().map((d) => [
      esc(d.date), d.new_leads, `${d.s_class}/${d.a_class}`, pct(d.reply_rate), d.rfq, d.quotation, money(d.pipeline_value),
    ])), { empty: '暂无日报' })}
    `;
  },
};

/* ============================================================ 知识图谱 */
export const graphView = {
  id: 'graph', name: '知识图谱', icon: '✦', group: '感知层',
  render() {
    const g = get('graph');
    return `
    ${section('Global Eagle Knowledge Graph', 'Company → produces → Product；Buyer → purchases → Product；Person → works_at → Company')}
    <div class="toolbar">${RUN_BTN('industry', '▶ 构建图谱')}<span class="sub">${g.nodes.length} 节点 / ${g.edges.length} 关系</span></div>
    <div id="graph-canvas" class="graph-canvas">${g.nodes.length ? '' : '<div class="empty">运行知识图谱 Agent 后渲染</div>'}</div>
    ${card('核心关系定义', `<ul class="list">
      <li>Company → produces → Product</li><li>Buyer → purchases → Product</li>
      <li>Company → located_in → Country</li><li>Person → works_at → Company</li>
      <li>Person → influences → Purchase</li><li>Product → classified_as → HSCode</li>
      <li>Market → targets → Country</li>
    </ul>`)}
    `;
  },
  mount(root) {
    const g = get('graph');
    const el = root.querySelector('#graph-canvas');
    if (!el || !g.nodes.length) return;
    const W = el.clientWidth || 900, H = 520;
    const groups = [...new Set(g.nodes.map((n) => n.group))];
    const cx = W / 2, cy = H / 2;
    const pos = {};
    g.nodes.forEach((n, i) => {
      const gi = groups.indexOf(n.group);
      const a = (gi / groups.length) * Math.PI * 2;
      const r = n.group === 'self' ? 0 : n.group === 'product' ? 90 : n.group === 'market' ? 200 : 150;
      const spread = (i % 7) * 0.32;
      pos[n.id] = n.group === 'self'
        ? { x: cx, y: cy }
        : { x: cx + Math.cos(a + spread) * r * (n.group === 'market' ? 1 : 1) + (i % 5) * 6, y: cy + Math.sin(a + spread) * r + (i % 3) * 8 };
    });
    const color = { self: '#ffb020', product: '#25d0a4', buyer: '#4aa8ff', person: '#a78bfa', country: '#7b8794', market: '#f472b6', hs: '#94a3b8' };
    const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" class="graph-svg">
      ${g.edges.map((e) => {
    const a = pos[e.from], b = pos[e.to];
    if (!a || !b) return '';
    return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="#1e2836" stroke-width="1"/>`;
  }).join('')}
      ${g.nodes.map((n) => {
    const p = pos[n.id]; if (!p) return '';
    const r = n.group === 'self' ? 12 : n.group === 'product' ? 7 : 4;
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="${color[n.group] || '#64748b'}" opacity="0.9"><title>${esc(n.label)}（${esc(n.type)}）</title></circle>
            ${n.group === 'self' || n.group === 'product' ? `<text x="${(p.x + r + 4).toFixed(1)}" y="${(p.y + 4).toFixed(1)}" class="g-label">${esc(n.label)}</text>` : ''}`;
  }).join('')}
    </svg>`;
    el.innerHTML = svg;
  },
};

/* ============================================================ 审批 */
export const approvalView = {
  id: 'approval', name: '人工审批', icon: '⚑', group: '治理',
  render() {
    const list = get('approvals', []);
    const audit = get('audit', []).slice().reverse().slice(0, 60);
    return `
    ${section('Human-in-the-Loop 人类最终控制', '最终报价 / 合同 / 付款条件 / 认证声明 / 大额订单 / 战略客户 → 必须人工审批')}
    <div class="toolbar">${RUN_BTN('rfq', '▶ 生成一条待审批报价')}</div>
    ${card('审批队列', table(['事项', '类型', '风险', '金额', 'AI 理由', '状态', '操作'], list.slice().reverse().map((a) => [
      esc(a.title), esc(APPROVAL_TYPES[a.type] || a.type), riskBadge(a.risk), money(a.amount), esc(a.reason),
      a.status === 'pending' ? '<span class="warn">待审批</span>' : a.status === 'approved' ? '<span class="ok">已批准</span>' : '<span class="warn">已驳回',
      a.status === 'pending' ? `<button class="btn sm" data-act="approve" data-id="${a.id}">批准</button><button class="btn ghost sm" data-act="reject" data-id="${a.id}">驳回</button>` : esc(a.decided_by || ''),
    ])), { empty: '暂无审批事项' })}
    ${card('Audit Log（Who / What / When）', table(['时间', '操作人', '动作', '详情'], audit.map((a) => [
      new Date(a.when).toLocaleString('zh-CN'), esc(a.who), esc(a.action), esc(a.detail),
    ])), { empty: '暂无日志' })}
    `;
  },
};

/* ============================================================ 资产 */
export const assetView = {
  id: 'assets', name: '资产沉淀', icon: '❖', group: '治理',
  render() {
    const sops = get('sop', []);
    const contents = get('content', []);
    const leads = get('leads', []);
    const company = get('company');
    return `
    ${section('数字资产复利模型', '一次开发→客户资产；一次沟通→需求数据；一次报价→价格数据；一次成功→SOP')}
    <div class="kpis">
      ${kpi('客户资产', leads.length, '线索 + 联系人', 18)}
      ${kpi('内容资产', contents.length, '邮件/脚本/文章', 12)}
      ${kpi('SOP 资产', sops.length, '成功路径沉淀', 9)}
      ${kpi('数据资产', get('analytics.daily').length, '日报快照', 6)}
    </div>
    ${card('SOP 资产库', table(['名称', '场景', '效果', '来源'], sops.map((s) => [esc(s.name), esc(s.scene), esc(s.effect), esc(s.source)])), { right: RUN_BTN('analytics', '沉淀本轮 SOP', 'ghost sm') })}
    ${card('内容资产库', table(['类型', '数量', '生成时间'], contents.map((c) => [esc(c.type), c.count, esc(c.created_at)])), { empty: '暂无内容资产' })}
    ${card('企业知识库（Shared Context）', `
      <div class="grid-2">
        <div><h4>公司</h4><ul class="list">
          <li>${esc(company.name)} · ${esc(company.brand)}</li>
          <li>产能：${esc(company.capacity)}</li><li>MOQ：${esc(company.moq)}</li>
          <li>交期：${esc(company.leadTime)}</li><li>员工 ${company.employees} 人 / 研发 ${company.rnd} 人</li>
        </ul></div>
        <div><h4>产品</h4>${table(['产品', 'HS', '参考价', 'MOQ'], get('products').map((p) => [esc(p.name), esc(p.hs), money(p.price), p.moq]))}</div>
      </div>
      <div class="mt"><h4>认证（⚠️ 未核验，禁止对外承诺）</h4>${table(['认证', '市场', '状态'], company.certifications.map((c) => [
      esc(c.name), esc(c.market), c.verified ? '<span class="ok">已核验</span>' : `<span class="warn">${esc(c.status || '未核验')}</span>`,
    ]))}</div>`)}
    `;
  },
};

/* ============================================================ Copilot */
export const copilotView = {
  id: 'copilot', name: 'AI Copilot', icon: '✦', group: '总览',
  render() {
    return `
    ${section('Global Eagle AI Copilot', '自然语言驱动整个 Agent Cluster')}
    <div class="grid-2">
      <div>
        ${card('对话式指令', `
          <div id="chat-log" class="chat-log"></div>
          <div class="chat-input">
            <input id="chat-text" class="input" placeholder="例：帮我开发德国泳池设备分销商" />
            <button class="btn" data-act="chat-send">发送</button>
          </div>
          <div class="mt">${['帮我找 20 个德国泳池设备分销商', '分析欧洲泳池设备市场', '帮我给 A 类客户生成千人千面开发信', '帮我处理这个 RFQ', '给我做一个 30 天海外获客 Campaign', '告诉我本月哪个市场 ROI 最高', '运行全链路']
        .map((q) => `<button class="btn ghost xs" data-act="chat-quick" data-q="${esc(q)}">${esc(q)}</button>`).join(' ')}</div>`)}
      </div>
      <div>
        ${card('工作流编排追踪', `<div id="wf-trace" class="timeline"><div class="empty">执行指令后在此查看 Agent 编排链路</div></div>`)}
        ${card('可用工作流', table(['工作流', 'Agent 编排'], Object.entries(WORKFLOWS).map(([k, v]) => [
          `<button class="btn ghost xs" data-act="run-wf" data-wf="${k}">▶ ${esc(v.name)}</button>`,
          `<div class="sub">${v.agents.map((a) => chip(a.replace('_agent', ''))).join('')}</div>`,
        ])))}
      </div>
    </div>`;
  },
};

/* ============================================================ 系统 */
export const systemView = {
  id: 'system', name: 'Agent 集群', icon: '⚙', group: '治理',
  render() {
    const role = state.ui?.role || 'Company Admin';
    return `
    ${section('OpenClaw Agent Cluster / Skill / Tool / 权限', '系统不是单 Agent，而是 Agent Cluster')}
    <div class="toolbar">
      <span class="sub">当前角色</span>
      <select data-act="set-role">${ROLES.map((r) => `<option ${r === role ? 'selected' : ''}>${r}</option>`).join('')}</select>
      <span class="spacer"></span>
      <button class="btn ghost" data-act="reset-data">重置演示数据</button>
    </div>
    ${card('Agent Registry（24）', table(['Agent', '使命', '层级', 'Skills'], AGENT_REGISTRY.map((a) => [
      `<b>${esc(a.name)}</b><div class="sub">${esc(a.id)}</div>`, esc(a.mission), chip(a.cluster), a.skills.map((s) => chip(s, 'sig')).join(''),
    ])))}
    ${card('Skill Registry', Object.entries(SKILL_REGISTRY).map(([k, v]) => `<div class="chain-row"><span class="chain-layer">${esc(k)}</span><div>${v.map((s) => chip(s)).join('')}</div></div>`).join(''))}
    ${card('Tool Registry', table(['Tool', '名称', '权限', '说明'], TOOL_REGISTRY.map((t) => [esc(t.id), esc(t.name), chip(t.perm), esc(t.desc)])))}
    ${card('RBAC 权限矩阵', table(['角色', '权限'], Object.entries(ROLE_PERMISSIONS).map(([r, p]) => [`${r === role ? '● ' : ''}${esc(r)}`, p.map((x) => chip(x)).join('')])))}
    `;
  },
};

export const VIEWS = [dashboard, industryView, buyersView, prospectingView, marketingView, crmView, dealView, campaignView, analyticsView, graphView, approvalView, assetView, copilotView, systemView];
export const VIEW_MAP = Object.fromEntries(VIEWS.map((v) => [v.id, v]));
export default VIEWS;
