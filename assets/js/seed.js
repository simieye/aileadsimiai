/**
 * Global Eagle · 种子数据（演示数据）
 * ⚠️ 全部为演示/示例数据：企业、联系人、认证均标记 verified:false，
 *    按系统原则「数据必须可验证，禁止虚构」，对外使用前必须进入 Human Approval 人工核验。
 */

export const company = {
  name: '深圳市蓝池智能装备有限公司',
  brand: 'BluePool / 蓝池',
  founded: 2016,
  factory: '广东深圳 + 浙江台州（2 大生产基地）',
  capacity: '年产水泵 28 万台 / 过滤器 12 万台 / 机器人 6 万台',
  employees: 320,
  rnd: 38,
  moq: '泵/灯 200 pcs，机器人 100 pcs（可议）',
  leadTime: '标准品 15-25 天，OEM 30-45 天',
  oem: true,
  odm: true,
  incoterms: ['EXW', 'FOB', 'CIF', 'DDP'],
  payment: ['T/T 30% 定金 + 70% 见提单副本', 'L/C at sight（≥5 万美金）', 'PayPal（样品）'],
  certifications: [
    { name: 'CE (EMC/LVD)', market: '欧盟', verified: false },
    { name: 'RoHS / REACH', market: '欧盟', verified: false },
    { name: 'ISO 9001:2015', market: '全球', verified: false },
    { name: 'IP68 防护等级', market: '全球', verified: false },
    { name: 'UL / ETL', market: '北美', verified: false, status: '办理中' },
  ],
  markets: ['德国', '法国', '西班牙', '波兰', '美国', '澳大利亚', '阿联酋', '巴西'],
};

export const products = [
  { id: 'P1', name: '变频泳池泵 VSP-300', hs: '8413.70', power: '0.75-2.2kW', price: 128, moq: 200, cert: ['CE', 'RoHS'], scene: '别墅泳池/酒店/水上乐园', margin: 0.32 },
  { id: 'P2', name: '顶装砂滤器 SF-750', hs: '8421.21', size: '750mm / 25m³/h', price: 96, moq: 200, cert: ['CE'], scene: '泳池水循环系统', margin: 0.28 },
  { id: 'P3', name: 'LED 水下灯 UL-18W RGBW', hs: '9405.40', power: '18W / 12V', price: 34, moq: 300, cert: ['CE', 'IP68'], scene: '泳池灯光改造/新建', margin: 0.41 },
  { id: 'P4', name: '盐氯发生器 SCG-25', hs: '8543.30', cap: '25g/h / 90m³', price: 215, moq: 100, cert: ['CE'], scene: '消毒系统', margin: 0.36 },
  { id: 'P5', name: '泳池清洁机器人 RC-400', hs: '8479.89', spec: '无线 / 4h 续航', price: 268, moq: 100, cert: ['CE', 'IP68'], scene: '泳池运维', margin: 0.38 },
];

/** 买家行：[名称, 国家, 城市, 域名, 细分, 类型, 规模, 员工, 营收带, 产品匹配度, 意向信号, [[角色,名,姓]] */
const ROWS = [
  ['Nordpool Technik GmbH', '德国', '汉堡', 'nordpool-technik.de', '泳池设备分销', '分销商', '中型', 140, '10-50M', 88, ['招聘采购经理', '官网新增变频泵品类'], [['采购总监', 'Anna', 'Bergmann'], ['产品经理', 'Lukas', 'Weber']]],
  ['Aqualine Vertrieb AG', '德国', '慕尼黑', 'aqualine-ag.de', '泳池工程承包商', '工程承包商', '中型', 95, '10-50M', 84, ['中标公共泳池项目', 'LinkedIn 发布项目动态'], [['技术总监', 'Michael', 'Kraus'], ['采购经理', 'Sabine', 'Hoffmann']]],
  ['Euro Pool Systems BV', '荷兰', '鹿特丹', 'europoolsystems.nl', '泳池系统集成', '进口商', '中型', 110, '10-50M', 80, ['海关进口记录增加', '参加 Spoga+Gafa'], [['采购总监', 'Jeroen', 'Visser'], ['运营总监', 'Emma', 'de Boer']]],
  ['ClearBlue Distribution SARL', '法国', '里昂', 'clearblue-dist.fr', '泳池耗材分销', '分销商', '中型', 76, '5-10M', 78, ['官网新增经销商招募页'], [['采购经理', 'Julien', 'Moreau'], ['CEO', 'Claire', 'Dubois']]],
  ['Piscine Pro France', '法国', '马赛', 'piscinepro-fr.fr', '泳池建造商', '工程承包商', '小型', 42, '5-10M', 71, ['Instagram 高频发项目'], [['Owner', 'Pierre', 'Roux']]],
  ['PoolTech Iberia SL', '西班牙', '巴塞罗那', 'pooltech-iberia.es', '泳池设备分销', '分销商', '中型', 88, '10-50M', 82, ['发布 LED 改造案例'], [['采购经理', 'Carlos', 'Navarro'], ['技术总监', 'Marta', 'Serrano']]],
  ['Med Pool Trading SRL', '意大利', '米兰', 'medpool-trading.it', '泳池设备进口', '进口商', '中型', 64, '5-10M', 76, ['海关进口 12 批次/年'], [['采购总监', 'Marco', 'Ferrari']]],
  ['Aqua UK Supplies Ltd', '英国', '曼彻斯特', 'aquauksupplies.co.uk', '园艺泳池渠道', '批发商', '中型', 120, '10-50M', 74, ['开拓 LED 水下灯线'], [['Buyer', 'Oliver', 'Bennett'], ['采购经理', 'Chloe', 'Ward']]],
  ['Sunbelt Pool Supply Inc', '美国', '凤凰城', 'sunbeltpoolsupply.com', '泳池耗材分销', '分销商', '大型', 340, '50-100M', 90, ['UL 认证供应商寻源', 'RFQ 平台发布需求'], [['采购总监', 'David', 'Mitchell'], ['Sourcing Manager', 'Emily', 'Carter']]],
  ['HydroPro USA LLC', '美国', '奥兰多', 'hydropro-usa.com', '泳池设备品牌', '品牌商', '中型', 160, '10-50M', 86, ['寻找 ODM 机器人'], [['Product Manager', 'Jason', 'Reyes'], ['CEO', 'Amanda', 'Brooks']]],
  ['Pacific Pool Group', '澳大利亚', '悉尼', 'pacificpoolgroup.com.au', '泳池渠道龙头', '渠道商', '大型', 280, '50-100M', 91, ['发布年度采购计划'], [['采购总监', 'Liam', 'Thompson'], ['Operations Director', 'Sophie', 'Clark']]],
  ['Oz Leisure Pools Pty', '澳大利亚', '布里斯班', 'ozleisurepools.au', '泳池建造', '工程承包商', '中型', 130, '10-50M', 79, ['招聘 technician'], [['采购经理', 'Jack', 'Wilson']]],
  ['Gulf Aqua Trading LLC', '阿联酋', '迪拜', 'gulfaquatrading.ae', '泳池设备进口', '进口商', '中型', 70, '10-50M', 83, ['酒店项目集采询盘'], [['采购总监', 'Ahmed', 'Al-Farsi'], ['Sales Manager', 'Rania', 'Hassan']]],
  ['Emirates Poolscape', '阿联酋', '阿布扎比', 'emiratespoolscape.ae', '景观泳池工程', '工程承包商', '中型', 150, '10-50M', 81, ['参与市政项目投标'], [['技术总监', 'Omar', 'Rashid']]],
  ['Samba Pool Comercio', '巴西', '圣保罗', 'sambapool.com.br', '泳池零售连锁', '零售商', '中型', 210, '10-50M', 72, ['门店扩张 12 家'], [['采购经理', 'Rafael', 'Oliveira']]],
  ['Vitta Piscinas Ltda', '巴西', '里约', 'vittapiscinas.com.br', '泳池建造商', '工程承包商', '小型', 55, '5-10M', 66, ['Instagram 案例更新'], [['Owner', 'Beatriz', 'Lima']]],
  ['Baltic Pool Systems', '波兰', '华沙', 'balticpool.pl', '泳池设备分销', '分销商', '小型', 48, '5-10M', 70, ['官网扩建品类'], [['采购经理', 'Piotr', 'Nowak']]],
  ['Alpine Wellness AG', '瑞士', '苏黎世', 'alpinewellness.ch', '水疗泳池设备', '品牌商', '中型', 90, '10-50M', 77, ['高端 ODM 需求'], [['R&D Director', 'Nina', 'Frei'], ['采购总监', 'Thomas', 'Steiner']]],
];

const ROLE_LABEL = {
  采购总监: 'Procurement Director',
  采购经理: 'Purchasing Manager',
  产品经理: 'Product Manager',
  技术总监: 'Technical Director',
  运营总监: 'Operations Director',
  CEO: 'CEO',
  Owner: 'Owner',
  Buyer: 'Buyer',
  'R&D Director': 'R&D Director',
  'Sales Manager': 'Sales Manager',
  'Sourcing Manager': 'Sourcing Manager',
  'Operations Director': 'Operations Director',
};

export const buyers = ROWS.map((r, i) => {
  const [name, country, city, domain, segment, type, size, employees, revenue, match, signals, people] = r;
  return {
    id: `B${String(i + 1).padStart(3, '0')}`,
    company: name,
    country,
    city,
    website: `https://www.${domain}`,
    domain,
    industry: '泳池设备 / Pool Equipment',
    segment,
    buyer_type: type,
    company_size: size,
    employees,
    revenue_band: revenue,
    product_match: match,
    intent_signals: signals,
    import_ability: revenue.includes('50-100M') ? '强' : revenue.includes('10-50M') ? '中强' : '中',
    verified: false,
    source: '演示数据 / 需人工核验',
    contacts: people.map((p, j) => {
      const [role, first, last] = p;
      return {
        id: `C${String(i + 1).padStart(3, '0')}${j}`,
        name: `${first} ${last}`,
        first,
        last,
        role,
        role_en: ROLE_LABEL[role] || role,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`,
        linkedin: `https://www.linkedin.com/in/${first.toLowerCase()}-${last.toLowerCase()}-${domain.split('.')[0]}`,
        verified: false,
        source: '演示数据 / 需人工核验',
      };
    }),
  };
});

export const markets = [
  { country: '德国', demand: 92, competition: '高', growth: 0.14, tariff: 'EU 共同关税 2.7%', channels: ['LinkedIn', '展会', 'Google', '海关数据'], note: '欧洲最大泳池市场，能效标准严苛，变频泵替代空间大' },
  { country: '美国', demand: 95, competition: '极高', growth: 0.18, tariff: '301 关税（部分品类）', channels: ['LinkedIn', 'RFQ 平台', 'Google', '展会'], note: '需 UL/ETL 认证，泳池保有量全球第一' },
  { country: '法国', demand: 88, competition: '高', growth: 0.12, tariff: 'EU 共同关税 2.7%', channels: ['Google', '展会', 'LinkedIn'], note: '私家庭院泳池密度欧洲第一' },
  { country: '西班牙', demand: 84, competition: '中', growth: 0.15, tariff: 'EU 共同关税 2.7%', channels: ['Google', 'LinkedIn'], note: '酒店泳池改造需求旺盛' },
  { country: '澳大利亚', demand: 86, competition: '中', growth: 0.16, tariff: '中澳 FTA 0%', channels: ['LinkedIn', 'Google', '展会'], note: '零关税 + 高渗透率，A 类客户密度最高' },
  { country: '阿联酋', demand: 74, competition: '中', growth: 0.22, tariff: 'GCC 5%', channels: ['展会', 'LinkedIn', 'WhatsApp'], note: '酒店与地产项目驱动，增速最快' },
  { country: '巴西', demand: 66, competition: '低', growth: 0.19, tariff: '高（约 18%）', channels: ['WhatsApp', 'Instagram', 'Google'], note: '关税高，建议 CIF + 本地合作' },
  { country: '波兰', demand: 62, competition: '低', growth: 0.21, tariff: 'EU 共同关税 2.7%', channels: ['Google', 'LinkedIn'], note: '新兴蓝海，竞争度低' },
];

export const industry = {
  name: '泳池设备 / Pool & Spa Equipment',
  chain: [
    { layer: '上游', items: ['电机/铜线', '工程塑料 PP+GF', 'LED 芯片', '钛电极', '锂电池'] },
    { layer: '中游制造', items: ['OEM 工厂', 'ODM 工厂', '部件供应商'] },
    { layer: '品牌商', items: ['国际泳池品牌', '区域强势品牌', 'DTC 新锐品牌'] },
    { layer: '渠道', items: ['分销商', '批发商', '进口商', '工程承包商', '零售商', '电商 DTC'] },
    { layer: '下游应用', items: ['别墅泳池', '酒店度假村', '公共泳池', '水上乐园', '水疗 SPA'] },
  ],
  dmu: ['CEO/Owner', '采购总监 Procurement Director', '采购经理 Purchasing Manager', 'Sourcing Manager', '产品经理 Product Manager', '技术总监 Technical Director', 'R&D Director', '运营总监 Operations Director', 'Buyer', '分销商 Distributor'],
  pain_points: ['能效法规升级，老旧泵替换成本高', '旺季交付不稳定', '认证与合规文件不全', '售后备件响应慢', 'SKU 多导致库存压力', '缺少本地化技术支持'],
};

export const rfqSeed = {
  id: 'RFQ_1001',
  buyer: 'Sunbelt Pool Supply Inc',
  country: '美国',
  raw: `We need 2,000 units variable speed pool pump 1.5kW, 220-240V/60Hz, UL listed, 
MOQ 500 first trial, FOB Shenzhen, delivery 45 days, custom color + private label, 
payment T/T 30% deposit. Please quote with tiered pricing for 500/2000/5000 pcs.`,
  parsed: null,
};

export const sopSeed = [
  { id: 'SOP1', name: '德国分销商首触开发信模板', scene: '首次触达 · 分销商 · 德国', effect: '回复率 11.4%', source: 'Campaign DE-2026Q1' },
  { id: 'SOP2', name: 'RFQ 阶梯报价结构（500/2k/5k）', scene: '报价 · 美国', effect: '样品转化率 34%', source: 'Quotation Agent' },
  { id: 'SOP3', name: 'LinkedIn 技术总监切入话术（能效 ROI）', scene: 'LinkedIn · 技术角色', effect: '连接接受率 38%', source: 'LinkedIn Agent' },
];

export function seedState() {
  return {
    company,
    products,
    industry,
    markets,
    buyers,
    contacts: buyers.flatMap((b) => b.contacts),
    leads: [],          // 由 Prospecting + Scoring Agent 生成
    opportunities: [],  // CRM Pipeline
    rfqs: [rfqSeed],
    quotations: [],
    orders: [],
    content: [],
    campaigns: [],
    sop: sopSeed,
    compliance: [],
    cases: [],
    analytics: { daily: [], snapshots: [] },
    graph: { nodes: [], edges: [] },
    approvals: [],
    audit: [],
    workflows: [],
    ui: {},             // 视图状态（标签页 / 筛选器等）
  };
}

export default seedState;
