/**
 * Global Eagle · Human-in-the-Loop
 * Human Approval Queue + Audit Log
 * 最终报价 / 合同 / 付款条件 / 认证声明 / 大额订单 / 战略客户 → 必须人工审批
 */
import { get, push, set, uid, save } from './store.js';
import { emit } from './bus.js';

export const APPROVAL_TYPES = {
  quotation: '最终报价',
  contract: '合同',
  payment: '付款条件',
  discount: '重大折扣',
  certification: '认证声明',
  compliance: '法规判断',
  big_order: '大额订单（≥50,000 USD）',
  strategic: '战略客户',
  outreach: '批量外发',
};

export function request({ type, title, payload, reason, risk = '中', amount = 0 }) {
  const item = {
    id: uid('apr'),
    type,
    title,
    payload,
    reason,
    risk,
    amount,
    status: 'pending',
    created_at: Date.now(),
    created_by: 'AI Agent Cluster',
  };
  push('approvals', item);
  audit('approval.request', `提交审批：${title}`, { type, risk });
  emit('approval:new', item);
  return item;
}

export function decide(id, approve, by = '当前用户') {
  const list = get('approvals', []);
  const i = list.findIndex((a) => a.id === id);
  if (i < 0) return null;
  list[i].status = approve ? 'approved' : 'rejected';
  list[i].decided_by = by;
  list[i].decided_at = Date.now();
  set('approvals', list);
  audit(approve ? 'approval.approve' : 'approval.reject', `${list[i].title} → ${approve ? '已批准' : '已驳回'}`, { id });
  emit('approval:decided', list[i]);
  return list[i];
}

export function pending() {
  return get('approvals', []).filter((a) => a.status === 'pending');
}

let actor = 'Company Admin';
export function setActor(a) { actor = a; }
export function currentActor() { return actor; }

export function audit(action, detail, meta = {}) {
  const entry = {
    id: uid('log'),
    who: actor,
    action,
    detail,
    meta,
    when: Date.now(),
  };
  push('audit', entry);
  const arr = get('audit', []);
  if (arr.length > 400) set('audit', arr.slice(-200));
  save();
  emit('audit', entry);
  return entry;
}

export default { request, decide, pending, audit, APPROVAL_TYPES, setActor, currentActor };
