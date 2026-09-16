/**
 * Global Eagle · Agent Cluster（24 个业务 Agent）
 * 每个 Agent：{ id, name, mission, cluster, skills[], run(input) -> {summary, data, approvals?} }
 * 原则：数据必须可验证；无法确认的信息统一输出「信息不足，需要人工确认」
 */
import { get, set, push, uid } from './store.js';
import { scoreLead, rescoreAll } from './scoring.js';
import { request } from './approval.js';
import { isConfigured, completeJSON } from './llm.js';
import { runOnLead } from './plugins.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

/* ------------------------------------------------------------------ 1 产业拆解 */
export const industry_agent = {
  id: 'industry_agent', name: '产业拆解 Agent', mission: '找对市场', cluster: '感知层',
  skills: ['industry_mapping', 'supply_chain_mapping', 'buyer_segmentation'],
  async run(input = {}) {
    await wait(180);
    const ind = get('industry');
    const prods = get('products');
    const data = {
      industry: ind.name,
      chain: ind.chain,
      buyer_segments: ['国际品牌商', '区域分销商', '进口商', '工程承包商', '连锁零售', '电商 DTC'],
      application_scenarios: [...new Set(prods.map((p) => p.scene))],
      pain_points: ind.pain_points,
      opportunities: [
        '欧盟能效法规 ErP 升级 → 定频泵替换为变频泵的存量改造窗口',
        '北美 UL/ETL 门槛高 → 持证供应商稀缺，溢价空间 15-25%',
        '中东酒店/地产项目集采 → 单项目订单量 5k+，增速 22%',
        '机器人清洁品类渗透率 <12% → 蓝海，ODM 需求强',
      ],
      recommended_channels: get('markets').slice(0, 4).flatMap((m) => m.channels).filter((v, i, a) => a.indexOf(v) === i).slice(0, 6),
    };
    return { summary: `完成「${input.product || ind.name}」五维产业拆解，识别 4 个蓝海机会与 6 条优先渠道`, data };
  },
};

/* ------------------------------------------------------------ 2 市场情报 */
export const market_intelligence_agent = {
  id: 'market_intelligence_agent', name: '市场情报 Agent', mission: '选对国家', cluster: '感知层',
  skills: ['market_ranking', 'tariff_lookup', 'competitor_scan'],
  async run(input = {}) {
    await wait(160);
    const markets = get('markets');
    const buyers = get('buyers');
    const ranked = markets.map((m) => {
      const cnt = buyers.filter((b) => b.country === m.country).length;
      const avg = buyers.filter((b) => b.country === m.country).reduce((s, b) => s + b.product_match, 0) / (cnt || 1);
      return { ...m, buyer_count: cnt, avg_match: Math.round(avg), score: Math.round(m.demand * 0.5 + avg * 0.3 + m.growth * 100 * 0.2) };
    }).sort((a, b) => b.score - a.score);
    return {
      summary: `完成 ${ranked.length} 国市场评分，TOP3：${ranked.slice(0, 3).map((r) => r.country).join(' / ')}`,
      data: { ranked, focus: input.country ? ranked.filter((r) => r.country === input.country) : ranked.slice(0, 5) },
    };
  },
};

/* ------------------------------------------------------- 3 买家画像 / 分层 */
export const buyer_profile_agent = {
  id: 'buyer_profile_agent', name: '买家画像 Agent', mission: '找对企业', cluster: '决策层',
  skills: ['company_research', 'company_scoring', 'abcs_tiering'],
  async run(input = {}) {
    await wait(160);
    let buyers = get('buyers');
    if (input.country) buyers = buyers.filter((b) => b.country === input.country);
    if (input.buyer_type) buyers = buyers.filter((b) => b.buyer_type === input.buyer_type);
    const tierOf = (b) => {
      const v = b.product_match * 0.5 + (b.revenue_band === '50-100M' ? 40 : b.revenue_band === '10-50M' ? 28 : 14) + (b.intent_signals.length * 5);
      return v >= 85 ? 'S' : v >= 70 ? 'A' : v >= 52 ? 'B' : 'C';
    };
    const profiled = buyers.map((b) => ({ ...b, tier: tierOf(b), profile: `${b.country} · ${b.buyer_type} · ${b.company_size} · 匹配 ${b.product_match}/100`, verified: false }));
    return {
      summary: `完成 ${profiled.length} 家企业画像，S 类 ${profiled.filter((p) => p.tier === 'S').length} 家 / A 类 ${profiled.filter((p) => p.tier === 'A').length} 家`,
      data: { buyers: profiled },
    };
  },
};

/* --------------------------------------------------------------- 4 DMU */
export const dmu_agent = {
  id: 'dmu_agent', name: '决策链 Agent', mission: '找对人', cluster: '决策层',
  skills: ['dmu_mapping', 'contact_discovery'],
  async run(input = {}) {
    await wait(140);
    const buyers = input.buyers || get('buyers');
    const roleMap = {
      '采购总监': { duty: '供应商准入与年度框架协议', power: '决策', stage: '商务谈判' },
      '采购经理': { duty: '询价、比价、下单', power: '执行', stage: 'RFQ/报价' },
      '产品经理': { duty: '定义产品规格与卖点', power: '影响', stage: '需求定义' },
      '技术总监': { duty: '技术审核与认证确认', power: '否决', stage: '技术评估' },
      '运营总监': { duty: '库存与交付节奏', power: '影响', stage: '履约' },
      'CEO': { duty: '预算与战略合作审批', power: '最终决策', stage: '战略客户' },
      'Owner': { duty: '全权决策', power: '最终决策', stage: '全链路' },
      'Buyer': { duty: '日常补货采购', power: '执行', stage: '复购' },
      'R&D Director': { duty: 'ODM 方案定义', power: '影响', stage: '产品开发' },
      'Sales Manager': { duty: '渠道需求反馈', power: '影响', stage: '需求提出' },
      'Sourcing Manager': { duty: '寻源与供应商比选', power: '执行', stage: '寻源' },
      'Operations Director': { duty: '交付与售后体系', power: '影响', stage: '履约' },
    };
    const dmu = buyers.map((b) => ({
      company: b.company,
      chain: (b.contacts || []).map((c) => ({
        person: c.name, role: c.role, role_en: c.role_en,
        duty: (roleMap[c.role] || {}).duty || '待确认',
        power: (roleMap[c.role] || {}).power || '待确认',
        stage: (roleMap[c.role] || {}).stage || '待确认',
        email: c.email, verified: c.verified,
        note: c.verified ? '已核验' : '信息不足，需要人工确认',
      })),
    }));
    return { summary: `为 ${dmu.length} 家企业建立 DMU 决策链，共 ${dmu.reduce((s, d) => s + d.chain.length, 0)} 位关键人`, data: { dmu } };
  },
};

/* --------------------------------------------------------- 5 全域拓客 */
export const prospecting_agent = {
  id: 'prospecting_agent', name: '全域拓客 Agent', mission: '找准线索', cluster: '执行层',
  skills: ['lead_discovery', 'lead_verification', 'contact_discovery'],
  async run(input = {}) {
    await wait(220);
    const buyers = get('buyers');
    const limit = input.limit || buyers.length;
    const picked = (input.buyer_ids ? buyers.filter((b) => input.buyer_ids.includes(b.id)) : buyers).slice(0, limit);
    const leads = [];
    picked.forEach((b) => {
      (b.contacts || []).forEach((c) => {
        if (input.role && c.role !== input.role) return;
        const lead = {
          id: uid('lead'),
          company: b.company, buyer_id: b.id, buyer: b,
          country: b.country, website: b.website, industry: b.industry,
          company_size: b.company_size, buyer_type: b.buyer_type,
          decision_maker: c.name, role: c.role, role_en: c.role_en,
          contact_email: c.email, linkedin: c.linkedin,
          verified: false, source: '企业官网 + LinkedIn（演示数据，需人工核验）',
          behavior: { opened: 0, clicked: 0, replied: 0, visited: 0 },
          stage: '新线索', created_at: now(),
        };
        const s = scoreLead(lead);
        Object.assign(lead, {
          icp_score: s.icp, intent_score: s.intent, value_score: s.value, engagement_score: s.engagement,
          lead_score: s.total, tier: s.tier, score_reasons: s.reasons, score_gaps: s.gaps, confidence: s.confidence,
        });
        leads.push(runOnLead(lead));
      });
    });
    const existing = get('leads', []);
    const merged = [...existing];
    leads.forEach((l) => {
      if (!merged.some((m) => m.contact_email === l.contact_email)) merged.push(l);
    });
    set('leads', merged);
    return {
      summary: `挖掘线索 ${leads.length} 条（去重后线索池 ${merged.length} 条），S/A 类 ${merged.filter((l) => l.tier === 'S' || l.tier === 'A').length} 条`,
      data: { leads, pool: merged.length },
    };
  },
};

/* ------------------------------------------------------- 6 线索补全 */
export const lead_enrichment_agent = {
  id: 'lead_enrichment_agent', name: '线索补全 Agent', mission: '补全与验证', cluster: '执行层',
  skills: ['lead_enrichment', 'email_verification', 'customs_data'],
  async run() {
    await wait(160);
    const leads = get('leads', []);
    let filled = 0;
    leads.forEach((l) => {
      if (!l.enriched) {
        l.enriched = true;
        l.hs_code = (get('products')[0] || {}).hs;
        l.import_freq = l.buyer.import_ability === '强' ? '≥12 批次/年' : l.buyer.import_ability === '中强' ? '6-12 批次/年' : '≤6 批次/年';
        l.email_status = l.contact_email ? '格式有效（未做 SMTP 验证）' : '缺失';
        l.enrich_source = ['企业官网', 'LinkedIn', '海关数据(示例)', '展会名单(示例)'];
        filled++;
      }
    });
    set('leads', leads);
    return { summary: `补全 ${filled} 条线索的海关/采购频次/邮箱状态字段；${leads.filter((l) => !l.contact_email).length} 条联系方式缺失需人工确认`, data: { filled } };
  },
};

/* --------------------------------------------------------- 7 线索评分 */
export const lead_scoring_agent = {
  id: 'lead_scoring_agent', name: '线索评分 Agent', mission: '排对优先级', cluster: '决策层',
  skills: ['icp_scoring', 'intent_scoring', 'lead_scoring'],
  async run() {
    await wait(140);
    const leads = rescoreAll();
    set('leads', leads);
    const top = [...leads].sort((a, b) => b.lead_score - a.lead_score).slice(0, 5);
    return {
      summary: `重算 ${leads.length} 条线索分数，TOP1：${top[0] ? `${top[0].company}（${top[0].lead_score} 分 / ${top[0].tier} 类）` : '无'}`,
      data: { top },
    };
  },
};

/* ----------------------------------------------------- 8 千人千面内容 */
const PAIN_BY_ROLE = {
  '采购总监': '供应商准入周期长、年度降本压力',
  '采购经理': '交期不稳、比价工作量大',
  '产品经理': '卖点不清晰、差异化不足',
  '技术总监': '能效与认证合规风险',
  '运营总监': '库存与备件供应压力',
  'CEO': '增长与利润结构',
  'Owner': '现金流与项目毛利',
  'Buyer': '补货及时率',
  'R&D Director': 'ODM 开发周期',
  'Sales Manager': '渠道动销',
  'Sourcing Manager': '寻源效率与备选供应商',
  'Operations Director': '交付与售后体系',
};

export const content_agent = {
  id: 'content_agent', name: '千人千面内容 Agent', mission: '打动客户', cluster: '执行层',
  skills: ['persona_content', 'value_proposition', 'case_based_content'],
  async run(input = {}) {
    await wait(200);
    const leads = (input.leads && input.leads.length ? input.leads : get('leads', []))
      .filter((l) => !input.tier || l.tier === input.tier)
      .slice(0, input.limit || 8);
    const product = get('products').find((p) => p.id === input.product_id) || get('products')[0];
    const company = get('company');
    const out = leads.map((l) => {
      const pain = PAIN_BY_ROLE[l.role] || '采购效率与成本';
      const angle = l.buyer_type === '工程承包商' ? '项目交付与质保' : l.buyer_type === '品牌商' ? 'ODM 差异化' : '渠道利润与动销';
      return {
        lead_id: l.id, company: l.company, person: l.decision_maker, role: l.role, country: l.country,
        product: product.name, angle, pain,
        subject: `${l.company} × ${company.brand}：${product.name} 帮你解决「${pain}」`,
        value_prop: [
          `能效：变频方案相比定频泵节能最高 70%，帮助 ${l.country} 客户满足当地能效法规`,
          `交付：${company.leadTime}，旺季产能预留 ${company.capacity}`,
          `合规：可提供 CE / RoHS / IP68 文件（⚠️ 需人工核验后方可对外承诺）`,
          `利润：${angle === 'ODM 差异化' ? 'ODM 定制 + 私模，避免同质化价格战' : `渠道毛利参考 ${Math.round(product.margin * 100 + 25)}%`}`,
        ],
        hook: `Hi ${l.decision_maker.split(' ')[0]}, 看到 ${l.company} 近期${(l.buyer.intent_signals[0] || '在拓展泳池设备品类')}——`,
        engine: 'local',
      };
    });
    // 真实大模型增强（已配置才启用；失败自动回退本地模板）
    if (isConfigured()) {
      for (const c of out.slice(0, input.llm_limit || 4)) {
        const j = await completeJSON(
          `你是外贸开发信专家。产品：${c.product}（${product.scene}）；目标客户：${c.company}（${c.country}，${c.buyer_type}）；联系人角色：${c.role}；核心痛点：${c.pain}；切入角度：${c.angle}。
输出 JSON：{"subject":"邮件标题","hook":"开头两句话术（英文）","value_prop":["卖点1","卖点2","卖点3","卖点4"]}`,
          '只输出 JSON。禁止虚构认证与数据，不可核验的信息必须标注需人工确认。',
        );
        if (j) {
          if (j.subject) c.subject = String(j.subject);
          if (j.hook) c.hook = String(j.hook);
          if (Array.isArray(j.value_prop) && j.value_prop.length) c.value_prop = j.value_prop.map(String);
          c.engine = 'llm';
        }
      }
    }
    return { summary: `生成 ${out.length} 套千人千面内容策略（${out.filter((x) => x.engine === 'llm').length} 套由真实大模型生成，其余本地引擎）`, data: { contents: out, product: product.name } };
  },
};

/* ---------------------------------------------------------- 9 邮件序列 */
export const email_agent = {
  id: 'email_agent', name: '邮件 Agent', mission: '多渠道触达', cluster: '执行层',
  skills: ['email_sequence', 'followup_writing', 're_engagement'],
  async run(input = {}) {
    await wait(200);
    const contents = input.contents || [];
    const seq = contents.map((c) => ({
      lead_id: c.lead_id, to: c.company, person: c.person,
      sequence: [
        { step: 1, type: 'First Touch', subject: c.subject, body: `${c.hook} 我们为 ${c.country} 的 ${c.role} 客户准备了针对「${c.pain}」的方案。\n\n${c.value_prop.map((v, i) => `${i + 1}. ${v}`).join('\n')}\n\n是否方便本周安排 15 分钟电话？\n\nBest regards,\nGlobal Eagle AI · ${get('company').brand}` },
        { step: 2, type: 'Value Proposition', subject: `Re: ${c.subject} · 70% 节能实测数据`, body: `Hi ${c.person.split(' ')[0]},\n\n补充一份 ${c.country} 同类型客户的节能实测：替换后单池年电费下降约 62%。\n\n如需要，我可以发完整测试报告与 CE 文件清单。\n\nBest regards` },
        { step: 3, type: 'Case Study', subject: `${c.angle}：一个 ${c.country} 客户的 8 周落地过程`, body: `Hi ${c.person.split(' ')[0]},\n\n分享一个 ${c.angle} 场景的落地案例：从第 1 封邮件到首批柜货，共 8 周。\n\n核心动作：样品确认 → 小批量试单 → 渠道定价 → 常态补货。\n\nBest regards` },
        { step: 4, type: 'Re-engagement', subject: `Should I close your file?`, body: `Hi ${c.person.split(' ')[0]},\n\n如果没有排期，我先归档，Q4 再联系。若有兴趣，回复「1」我发阶梯报价。\n\nBest regards` },
      ],
    }));
    set('content', [...get('content', []), { id: uid('ct'), type: 'email_sequence', created_at: now(), count: seq.length, data: seq }]);
    return { summary: `生成 ${seq.length} 组 4 步邮件序列（首触/价值/案例/再激活）`, data: { sequences: seq } };
  },
};

/* -------------------------------------------------------- 10 LinkedIn */
export const linkedin_agent = {
  id: 'linkedin_agent', name: 'LinkedIn Agent', mission: '社交触达', cluster: '执行层',
  skills: ['linkedin_outreach', 'connection_message'],
  async run(input = {}) {
    await wait(160);
    const contents = input.contents || [];
    const out = contents.map((c) => ({
      lead_id: c.lead_id, person: c.person, role: c.role_en,
      connect: `Hi ${c.person.split(' ')[0]}, I work with ${c.country} pool equipment ${c.role_en}s on energy-efficient pump retrofits. Would love to connect and exchange views on the 2026 efficiency rules.`,
      first_msg: `Thanks for connecting! Quick context: we build ${c.product} with up to 70% energy saving. Happy to share a 1-page spec sheet — no pitch.`,
      followup: `Following up on the spec sheet. Most ${c.country} distributors start with a 500-unit trial. Want me to prepare tiered pricing?`,
    }));
    return { summary: `生成 ${out.length} 条 LinkedIn 连接 + 首信 + 跟进话术`, data: { messages: out } };
  },
};

/* ----------------------------------------------------------- 11 社媒 */
export const social_agent = {
  id: 'social_agent', name: '社媒内容 Agent', mission: '被动种草', cluster: '执行层',
  skills: ['youtube_content', 'tiktok_content', 'reddit_research'],
  async run() {
    await wait(160);
    const p = get('products')[0];
    const out = {
      linkedin_post: `2026 能效新规下，为什么 ${'欧洲'} 分销商开始全面替换定频泵？\n\n1) 能耗下降 70%\n2) 噪音从 68dB 降到 52dB\n3) 3 年 TCO 低于定频泵\n\n#PoolIndustry #EnergyEfficiency #OEM`,
      youtube_script: `[0-5s] 钩子：一个泳池一年电费能省多少？\n[5-25s] 拆机对比 ${p.name} 与定频泵结构差异\n[25-50s] 实测电表数据\n[50-60s] CTA：评论区领取规格书`,
      tiktok_script: `[0-3s] 定频泵 vs 变频泵，电费差 3 倍！\n[3-15s] 快速拆装 + 电表特写\n[15-25s] CTA：主页领样品价`,
      reddit: `r/pools 观察：用户抱怨集中在「噪音」与「售后备件」，可作为内容切入点（信息不足，需要人工确认是否引用真实帖子）`,
    };
    return { summary: '生成 LinkedIn/YouTube/TikTok/Reddit 四平台内容脚本', data: out };
  },
};

/* ------------------------------------------------------- 12 网站询盘 */
export const website_sales_agent = {
  id: 'website_sales_agent', name: 'AI 网站询盘 Agent', mission: '把访客变线索', cluster: '执行层',
  skills: ['visitor_intent', 'lead_capture', 'qualification'],
  async run(input = {}) {
    await wait(180);
    const v = input.visitor || { country: '德国', product: '变频泳池泵 VSP-300', qty: 800, oem: true, budget: 150000, scene: '酒店泳池改造', pages: 6, time_on_site: 320 };
    const product = get('products').find((p) => p.name.includes(v.product.slice(0, 4))) || get('products')[0];
    const scoreBase = 40;
    const qtyScore = v.qty >= 1000 ? 30 : v.qty >= 500 ? 22 : v.qty >= 200 ? 14 : 6;
    const budgetScore = v.budget >= 100000 ? 20 : v.budget >= 30000 ? 12 : 5;
    const depthScore = Math.min(v.pages * 2, 10);
    const total = Math.min(scoreBase + qtyScore + budgetScore + depthScore, 100);
    const lead = {
      id: uid('lead'), company: v.company || `网站访客（${v.country}）`, country: v.country,
      website: '-', industry: get('industry').name, buyer_type: '待确认',
      decision_maker: v.name || '待确认', role: '待确认', contact_email: v.email || '',
      verified: false, source: '官网 AI 询盘（需人工核验）',
      behavior: { opened: 0, clicked: v.pages, replied: 1, visited: v.pages },
      stage: '新线索', created_at: now(),
      icp_score: 60, intent_score: total, value_score: budgetScore * 4, engagement_score: depthScore * 6,
      lead_score: total, tier: total >= 85 ? 'S' : total >= 70 ? 'A' : total >= 50 ? 'B' : 'C',
      score_reasons: [`采购数量 ${v.qty} pcs`, `预算 ${v.budget} USD`, `浏览 ${v.pages} 页 / 停留 ${v.time_on_site}s`, `OEM 需求：${v.oem ? '是' : '否'}`],
      score_gaps: v.email ? [] : ['联系方式缺失'],
      product_of_interest: product.name, qty: v.qty, oem: v.oem,
    };
    push('leads', lead);
    const worth = total >= 60;
    return {
      summary: `访客识别完成：${lead.company}，评分 ${total}（${lead.tier} 类）→ ${worth ? '建议销售立即跟进' : '进入培育序列'}`,
      data: { lead, worth, recommended_action: worth ? '30 分钟内电话 + 邮件' : '进入 30 天培育 Campaign' },
    };
  },
};

/* -------------------------------------------------------- 13 Campaign */
export const campaign_agent = {
  id: 'campaign_agent', name: '营销战役 Agent', mission: '规模化获客', cluster: '决策层',
  skills: ['campaign_strategy', 'audience_building', 'sequence_design'],
  async run(input = {}) {
    await wait(200);
    const country = input.country || get('markets')[0].country;
    const days = input.days || 30;
    const plan = [
      { phase: 'D1-D5', goal: '市场与 ICP 锁定', actions: ['产业拆解', '国家市场评分', '买家分层 A/B/C/S'] },
      { phase: 'D6-D12', goal: '线索挖掘与补全', actions: ['Lead Discovery 300+', 'Lead Enrichment', 'DMU 决策人识别'] },
      { phase: 'D13-D18', goal: '内容生产', actions: ['千人千面开发信', 'LinkedIn 序列', 'YouTube/TikTok 脚本'] },
      { phase: 'D19-D26', goal: '多渠道触达', actions: ['Email 4 步序列', 'LinkedIn 触达', 'WhatsApp 跟进'] },
      { phase: 'D27-D30', goal: '转化与复盘', actions: ['RFQ 解析', '阶梯报价', 'CRM 推进', 'ROI 复盘与 SOP 沉淀'] },
    ];
    const campaign = {
      id: uid('cmp'), name: `${country} ${days} 天精准获客战役`, country, days,
      goal: input.goal || '获取 20 个有效 RFQ', budget: input.budget || 30000,
      target: input.target || '分销商 / 进口商 / 工程承包商', plan,
      kpi: { leads: 300, reply_rate: 0.08, rfq: 20, sample: 6, order: 2 },
      status: 'running', created_at: now(),
    };
    push('campaigns', campaign);
    return { summary: `生成「${campaign.name}」${plan.length} 阶段作战计划，目标 ${campaign.goal}`, data: { campaign } };
  },
};

/* --------------------------------------------------------- 14 跟进 */
export const followup_agent = {
  id: 'followup_agent', name: '自动跟进 Agent', mission: '减少人工断点', cluster: '执行层',
  skills: ['behavior_trigger', 'followup_workflow', 're_engagement'],
  async run(input = {}) {
    await wait(180);
    const leads = get('leads', []);
    const events = input.events || [
      { lead_id: leads[0] && leads[0].id, type: 'Opened' },
      { lead_id: leads[1] && leads[1].id, type: 'Clicked' },
      { lead_id: leads[2] && leads[2].id, type: 'No Response' },
      { lead_id: leads[3] && leads[3].id, type: 'Replied' },
    ];
    const rules = {
      Opened: { score: +6, action: '48h 后发送价值型 Follow-up（节能实测数据）' },
      Clicked: { score: +10, action: '判断产品兴趣 → 24h 内发送对应 SKU 规格书 + 阶梯报价' },
      Replied: { score: +40, action: '调用 Supply Chain Agent 解析 RFQ' },
      'No Response': { score: -5, action: '进入 30 天 Re-engagement Campaign，第 7/15/25 天各一次' },
      Visited: { score: +3, action: '记录产品兴趣标签' },
      'Requested Quote': { score: +25, action: '生成报价方案并提交人工审批' },
    };
    const executed = [];
    events.forEach((e) => {
      const lead = leads.find((l) => l.id === e.lead_id);
      if (!lead) return;
      const rule = rules[e.type] || { score: 0, action: '人工确认下一步' };
      lead.behavior = lead.behavior || {};
      if (e.type === 'Opened') lead.behavior.opened = (lead.behavior.opened || 0) + 1;
      if (e.type === 'Clicked') lead.behavior.clicked = (lead.behavior.clicked || 0) + 1;
      if (e.type === 'Replied') lead.behavior.replied = (lead.behavior.replied || 0) + 1;
      lead.next_action = rule.action;
      lead.last_touch = now();
      executed.push({ company: lead.company, event: e.type, action: rule.action, delta: rule.score });
    });
    set('leads', rescoreAll());
    return { summary: `执行 ${executed.length} 条行为触发规则，并全量重算线索分`, data: { executed } };
  },
};

/* ------------------------------------------------------------ 15 CRM */
export const PIPELINE = ['新线索', '已验证', '已触达', '已回复', '需求确认', 'RFQ', '报价', '样品', '谈判', '成交', '履约', '复购'];

export const crm_agent = {
  id: 'crm_agent', name: 'CRM Agent', mission: '管好管道', cluster: '决策层',
  skills: ['pipeline_management', 'stage_transition', 'task_generation'],
  async run(input = {}) {
    await wait(160);
    const leads = get('leads', []);
    const opps = get('opportunities', []);
    if (input.advance) {
      const l = leads.find((x) => x.id === input.lead_id);
      if (l) {
        const i = PIPELINE.indexOf(l.stage || '新线索');
        l.stage = PIPELINE[Math.min(i + 1, PIPELINE.length - 1)];
        l.updated_at = now();
        set('leads', leads);
        return { summary: `${l.company} 推进至「${l.stage}」`, data: { lead: l } };
      }
    }
    // 自动同步：A/S 类线索进入商机池
    leads.filter((l) => (l.tier === 'A' || l.tier === 'S') && !opps.some((o) => o.lead_id === l.id)).forEach((l) => {
      opps.push({
        id: uid('opp'), lead_id: l.id, company: l.company, country: l.country,
        stage: l.stage || '新线索', tier: l.tier, value: l.tier === 'S' ? 120000 : 45000,
        owner: 'Sales Team', next_action: l.next_action || '生成千人千面开发信', updated_at: now(),
      });
    });
    set('opportunities', opps);
    const byStage = PIPELINE.map((s) => ({ stage: s, count: leads.filter((l) => (l.stage || '新线索') === s).length }));
    return {
      summary: `CRM 同步完成：商机 ${opps.length} 个，管道总额 $${opps.reduce((s, o) => s + o.value, 0).toLocaleString()}`,
      data: { byStage, opportunities: opps },
    };
  },
};

/* ------------------------------------------------------------ 16 RFQ */
export const rfq_agent = {
  id: 'rfq_agent', name: 'RFQ 解析 Agent', mission: '读懂需求', cluster: '执行层',
  skills: ['rfq_parsing', 'spec_extraction'],
  async run(input = {}) {
    await wait(180);
    const raw = input.raw || get('rfqs')[0].raw;
    const grab = (re) => (raw.match(re) || [, '待确认'])[1];
    const qty = Number((raw.match(/([\d,]+)\s*units/i) || [, '0'])[1].replace(/,/g, '')) || 0;
    const parsed = {
      product: /variable speed pool pump/i.test(raw) ? '变频泳池泵 VSP-300' : grab(/(?:need|require)\s+([^,\n]+)/i),
      specification: grab(/(\d\.\d\s*kW[^\n,]*)/i),
      voltage: /220-240V\/60Hz/i.test(raw) ? '220-240V/60Hz' : grab(/(\d{3}-\d{3}V[^,\n]*)/i),
      quantity: qty || 2000,
      moq: Number((raw.match(/MOQ\s*([\d,]+)/i) || [, 500])[1].replace(/,/g, '')),
      certification: /UL listed/i.test(raw) ? 'UL/ETL（⚠️ 企业资质需人工核验）' : '待确认',
      destination: '美国',
      incoterms: (raw.match(/\b(FOB|CIF|EXW|DDP)\b/) || [, 'FOB'])[1],
      delivery: grab(/delivery\s*([\d]+\s*days)/i),
      payment: grab(/(T\/T[^,\n]*)/i),
      customization: /custom color/i.test(raw) ? '定制颜色' : '标准',
      oem: /private label/i.test(raw),
      odm: false,
      tier_request: (raw.match(/(\d+\/\d+\/\d+)\s*pcs/) || [, ''])[1],
      missing: [],
    };
    if (!parsed.specification || parsed.specification === '待确认') parsed.missing.push('技术规格');
    if (/UL listed/i.test(raw)) parsed.missing.push('UL/ETL 证书有效性（企业侧待核验）');
    const rfq = { id: get('rfqs')[0].id, raw, parsed, parsed_at: now() };
    set('rfqs', [rfq, ...get('rfqs').slice(1)]);
    return {
      summary: `RFQ 解析完成：${parsed.product} × ${parsed.quantity} pcs，${parsed.incoterms}，${parsed.oem ? '含 OEM 私标' : '标准品'}${parsed.missing.length ? `；${parsed.missing.length} 项信息不足需人工确认` : ''}`,
      data: parsed,
    };
  },
};

/* ------------------------------------------------------- 17 阶梯报价 */
export const quotation_agent = {
  id: 'quotation_agent', name: '报价 Agent', mission: '算清利润', cluster: '执行层',
  skills: ['tiered_pricing', 'incoterms_calculation', 'margin_control'],
  async run(input = {}) {
    await wait(180);
    const parsed = input.parsed || get('rfqs')[0].parsed || { quantity: 2000, product: '变频泳池泵 VSP-300' };
    const product = get('products').find((p) => p.name === parsed.product) || get('products')[0];
    const base = product.price;
    const tiers = [100, 500, 1000, 2000, 5000, 10000].map((q) => {
      const discount = q >= 10000 ? 0.18 : q >= 5000 ? 0.14 : q >= 2000 ? 0.10 : q >= 1000 ? 0.06 : q >= 500 ? 0.03 : 0;
      const unit = +(base * (1 - discount)).toFixed(2);
      return { qty: q, unit_price: unit, discount: `${(discount * 100).toFixed(0)}%`, amount: +(unit * q).toFixed(0), margin: `${Math.round((1 - (base * (1 - product.margin)) / unit) * 100)}%` };
    });
    const incoterms = ['EXW', 'FOB', 'CIF', 'DDP'].map((t) => ({
      term: t,
      addon: t === 'EXW' ? 0 : t === 'FOB' ? 0.012 : t === 'CIF' ? 0.055 : 0.11,
      note: t === 'DDP' ? '含目的国关税与增值税，需人工确认税率' : t === 'CIF' ? '含海运与保险（估）' : t === 'FOB' ? '含本地报关与拖车（估）' : '工厂交货',
    })).map((x) => ({ ...x, unit_price: +(base * (1 + x.addon)).toFixed(2) }));
    const quotation = {
      id: uid('quo'), product: product.name, tiers, incoterms,
      moq: product.moq, lead_time: get('company').leadTime,
      payment: get('company').payment, valid_until: '报价有效期 30 天（示例）',
      created_at: now(), status: '待人工审批',
    };
    push('quotations', quotation);
    request({
      type: 'quotation', title: `${parsed.product} 阶梯报价（${parsed.quantity} pcs）`,
      payload: quotation, reason: '对外报价属于重大商务动作，需人工确认价格、交期与认证声明', risk: '高', amount: quotation.tiers[3].amount,
    });
    return { summary: `生成 6 档阶梯报价 + 4 种贸易条款方案，已提交 Human Approval`, data: quotation };
  },
};

/* ------------------------------------------------------ 18 供应链履约 */
export const supply_chain_agent = {
  id: 'supply_chain_agent', name: '供应链履约 Agent', mission: '让商机落地', cluster: '执行层',
  skills: ['production_planning', 'logistics_planning', 'risk_check'],
  async run(input = {}) {
    await wait(180);
    const q = get('quotations').slice(-1)[0] || { product: '变频泳池泵 VSP-300', tiers: [] };
    const plan = {
      product: q.product,
      production: { capacity_check: '当前产线可满足（示例：月产能 23,000 台）', lead_time: get('company').leadTime, bottleneck: '钛电极/锂电池供应需提前 20 天锁料' },
      packaging: '标准出口纸箱 + 托盘；OEM 私标需提前 15 天确认包材',
      logistics: { mode: '海运整柜 FCL', transit: '深圳 → 目的港 28-35 天（示例）', risk: '旺季舱位紧张，建议提前 21 天订舱' },
      risks: [
        { item: '认证风险', level: '高', detail: 'UL/ETL 证书有效性需人工核验后方可对外承诺' },
        { item: '交期风险', level: '中', detail: '定制包材与私标会延长 10-15 天' },
        { item: '付款风险', level: '中', detail: '新客户建议 30% 定金 + 70% 见提单副本' },
        { item: '关税风险', level: '中', detail: '目的国税率需人工确认（示例值仅供参考）' },
        { item: '知识产权风险', level: '低', detail: '私标需客户提供商标授权书' },
      ],
    };
    return { summary: `生成履约方案：${plan.product}；识别 5 项风险，其中 1 项为高风险需人工审批`, data: plan };
  },
};

/* ---------------------------------------------------------- 19 合规 */
export const compliance_agent = {
  id: 'compliance_agent', name: '合规风控 Agent', mission: '守住底线', cluster: '决策层',
  skills: ['certification_check', 'regulation_check', 'ip_check'],
  async run() {
    await wait(160);
    const certs = get('company').certifications || [];
    const result = certs.map((c) => ({
      name: c.name, market: c.market, verified: c.verified,
      status: c.verified ? '可对外引用' : (c.status === '办理中' ? '办理中，禁止对外承诺' : '未核验，禁止对外承诺'),
      note: '信息不足，需要人工确认（须上传证书扫描件并完成核验）',
    }));
    result.forEach((r) => {
      if (!r.verified) push('compliance', { ...r, id: uid('cmp_c'), checked_at: now() });
    });
    return {
      summary: `校验 ${result.length} 项资质：${result.filter((r) => r.verified).length} 项可引用，${result.filter((r) => !r.verified).length} 项禁止对外承诺`,
      data: { result, blocked_statements: result.filter((r) => !r.verified).map((r) => r.name) },
    };
  },
};

/* --------------------------------------------------------- 20 分析 */
export const analytics_agent = {
  id: 'analytics_agent', name: '数据分析 Agent', mission: '看清增长', cluster: '决策层',
  skills: ['funnel_analysis', 'roi_analysis', 'daily_report'],
  async run() {
    await wait(180);
    const leads = get('leads', []);
    const opps = get('opportunities', []);
    const campaigns = get('campaigns', []);
    const touched = leads.filter((l) => (l.behavior.opened || 0) + (l.behavior.clicked || 0) > 0).length;
    const replied = leads.filter((l) => (l.behavior.replied || 0) > 0).length;
    const report = {
      date: new Date().toISOString().slice(0, 10),
      new_leads: leads.length,
      a_class: leads.filter((l) => l.tier === 'A').length,
      s_class: leads.filter((l) => l.tier === 'S').length,
      touched,
      replied,
      reply_rate: leads.length ? +(replied / leads.length * 100).toFixed(1) : 0,
      rfq: get('rfqs').length,
      quotation: get('quotations').length,
      orders: get('orders').length,
      pipeline_value: opps.reduce((s, o) => s + o.value, 0),
      revenue: get('orders').reduce((s, o) => s + (o.amount || 0), 0),
      campaigns: campaigns.length,
      insights: [
        `最快增长市场：${(get('markets').slice().sort((a, b) => b.growth - a.growth)[0] || {}).country}（示例增速 22%）`,
        `最高价值分层：S 类 ${leads.filter((l) => l.tier === 'S').length} 家，建议配置专属销售 + 高管跟进`,
        `瓶颈：${replied === 0 ? '尚无回复，建议先做 50 条小规模 A/B 测试话术' : `回复率 ${(replied / leads.length * 100).toFixed(1)}%，低于 8% 需重构首触话术`}`,
      ],
    };
    push('analytics.daily', report);
    return { summary: `生成 ${report.date} 全球鹰日报：线索 ${report.new_leads}，管道 $${report.pipeline_value.toLocaleString()}`, data: report };
  },
};

/* ------------------------------------------------------- 21 GEO/SEO */
export const geo_agent = {
  id: 'geo_agent', name: 'GEO/SEO Agent', mission: '让 AI 也能搜到你', cluster: '执行层',
  skills: ['seo_pages', 'geo_entity', 'faq_generation'],
  async run() {
    await wait(160);
    const prods = get('products');
    const pages = [];
    prods.forEach((p) => {
      pages.push({ type: 'Product Page', title: `${p.name} Manufacturer | ${get('company').brand}`, keyword: `${p.name} supplier`, status: '待生成' });
      pages.push({ type: 'Application Page', title: `${p.scene} 解决方案`, keyword: `${p.scene} pool equipment`, status: '待生成' });
    });
    get('markets').slice(0, 4).forEach((m) => {
      pages.push({ type: 'GEO/Country Page', title: `${m.country} 泳池设备供应商与进口指南`, keyword: `pool equipment supplier ${m.country}`, status: '待生成' });
    });
    pages.push({ type: 'Comparison', title: '变频泵 vs 定频泵：TCO 对比', keyword: 'VSP vs single speed pump', status: '待生成' });
    pages.push({ type: 'FAQ', title: '泳池设备采购 FAQ（MOQ/认证/交期/售后）', keyword: 'pool equipment MOQ certification', status: '待生成' });
    return { summary: `规划 ${pages.length} 个 GEO/SEO 页面，覆盖产品/场景/国家/对比/FAQ 五类实体`, data: { pages } };
  },
};

/* ------------------------------------------------------ 22 知识图谱 */
export const knowledge_agent = {
  id: 'knowledge_agent', name: '知识图谱 Agent', mission: '构建全球供需关系', cluster: '感知层',
  skills: ['graph_building', 'relation_inference'],
  async run() {
    await wait(180);
    const nodes = []; const edges = [];
    const add = (id, type, label, extra = {}) => { if (!nodes.some((n) => n.id === id)) nodes.push({ id, type, label, ...extra }); };
    const comp = get('company');
    add('company:self', 'Company', comp.name, { group: 'self' });
    get('products').forEach((p) => {
      add(`product:${p.id}`, 'Product', p.name, { group: 'product' });
      edges.push({ from: 'company:self', to: `product:${p.id}`, rel: 'produces' });
      add(`hs:${p.hs}`, 'HSCode', p.hs, { group: 'hs' });
      edges.push({ from: `product:${p.id}`, to: `hs:${p.hs}`, rel: 'classified_as' });
    });
    get('buyers').forEach((b) => {
      add(`buyer:${b.id}`, 'Buyer', b.company, { group: 'buyer', country: b.country, tier: b.tier });
      add(`country:${b.country}`, 'Country', b.country, { group: 'country' });
      edges.push({ from: `buyer:${b.id}`, to: `country:${b.country}`, rel: 'located_in' });
      edges.push({ from: `buyer:${b.id}`, to: 'product:' + get('products')[0].id, rel: 'purchases' });
      (b.contacts || []).forEach((c) => {
        add(`person:${c.id}`, 'Person', c.name, { group: 'person', role: c.role });
        edges.push({ from: `person:${c.id}`, to: `buyer:${b.id}`, rel: 'works_at' });
      });
    });
    get('markets').forEach((m) => {
      add(`market:${m.country}`, 'Market', m.country, { group: 'market' });
      edges.push({ from: `market:${m.country}`, to: `country:${m.country}`, rel: 'targets' });
    });
    set('graph', { nodes, edges });
    return { summary: `知识图谱构建完成：${nodes.length} 节点 / ${edges.length} 关系`, data: { nodes: nodes.length, edges: edges.length } };
  },
};

/* ------------------------------------------------------ 23 资产沉淀 */
export const asset_compounding_agent = {
  id: 'asset_compounding_agent', name: '资产沉淀 Agent', mission: '一次成交，长期复利', cluster: '决策层',
  skills: ['asset_extraction', 'sop_generation'],
  async run(input = {}) {
    await wait(180);
    const leads = get('leads', []);
    const top = [...leads].sort((a, b) => b.lead_score - a.lead_score).slice(0, 3);
    const sop = {
      id: uid('sop'),
      name: `${top[0] ? top[0].country : '目标市场'} ${top[0] ? top[0].buyer_type : '买家'} 成功画像 SOP`,
      scene: `${top[0] ? top[0].country : '-'} · ${top[0] ? top[0].buyer_type : '-'} · ${top[0] ? top[0].role : '-'}`,
      effect: '基于 TOP 线索自动生成，需真实成交数据回写后校准',
      content: {
        成功客户画像: top.map((t) => `${t.company}｜${t.buyer_type}｜${t.lead_score} 分`),
        成功渠道: ['Email 首触 + LinkedIn 补位', 'WhatsApp 跟进（中东/南美）'],
        成功话术: [`切入角色痛点：${top[0] ? (top[0].score_reasons[0] || '待积累') : '待积累'}`, '第二步给节能实测数据，第三步给同国别案例'],
        成功报价策略: '500 / 2000 / 5000 三档锚定，2000 档作为主推',
      },
      created_at: now(),
    };
    push('sop', sop);
    return {
      summary: `沉淀客户资产 ${leads.length} 条、内容资产 ${get('content').length} 份、SOP ${get('sop').length} 条`,
      data: { sop, assets: { customers: leads.length, content: get('content').length, sop: get('sop').length, data: get('analytics.daily').length } },
    };
  },
};

/* ------------------------------------------------------ 24 人工审批 */
export const approval_agent = {
  id: 'approval_agent', name: '人工审批 Agent', mission: 'AI 效率，人类决策', cluster: '决策层',
  skills: ['risk_routing', 'approval_queue'],
  async run() {
    await wait(120);
    const list = get('approvals', []);
    const pending = list.filter((a) => a.status === 'pending');
    if (!pending.length) {
      request({
        type: 'outreach', title: '批量外发开发信（示例批次 50 封）',
        payload: { batch: 50 }, reason: '批量外发影响域名信誉，需人工确认发送名单与频次', risk: '中',
      });
    }
    return {
      summary: `审批队列：待处理 ${get('approvals').filter((a) => a.status === 'pending').length} 项，已处理 ${get('approvals').filter((a) => a.status !== 'pending').length} 项`,
      data: { pending: get('approvals').filter((a) => a.status === 'pending') },
    };
  },
};

export const AGENTS = [
  industry_agent, market_intelligence_agent, buyer_profile_agent, dmu_agent,
  prospecting_agent, lead_enrichment_agent, lead_scoring_agent, content_agent,
  email_agent, linkedin_agent, social_agent, website_sales_agent, campaign_agent,
  followup_agent, crm_agent, rfq_agent, quotation_agent, supply_chain_agent,
  compliance_agent, analytics_agent, geo_agent, knowledge_agent,
  asset_compounding_agent, approval_agent,
];

export const AGENT_MAP = Object.fromEntries(AGENTS.map((a) => [a.id, a]));
export default AGENT_MAP;
