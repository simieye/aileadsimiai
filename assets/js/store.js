/**
 * Global Eagle · Shared Context Layer（多租户作用域版）
 * - 每个租户（企业）拥有独立的 Shared Context 命名空间
 * - 所有 Agent 共享当前租户的上下文（企业/产品/市场/买家/线索/商机/内容/资产）
 */
import { seedState } from './seed.js';
import { emit } from './bus.js';

const KEY = 'global-eagle.ctx.v1';
const SCOPE_KEY = 'global-eagle.scope.v1';

function clone(o) { return JSON.parse(JSON.stringify(o)); }

let scope = localStorage.getItem(SCOPE_KEY) || '';
export const getScope = () => scope;

function storageKey(org = scope) { return org ? `${KEY}:${org}` : KEY; }

function loadSync(org = scope) {
  try {
    const raw = localStorage.getItem(storageKey(org));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.state ? parsed.state : null;
  } catch (e) {
    console.warn('[store] 读取失败，使用种子数据', e);
    return null;
  }
}

export const state = loadSync() || clone(seedState());

let timer = null;
function flush() {
  try {
    localStorage.setItem(storageKey(), JSON.stringify({ v: 1, state }));
  } catch (e) { console.warn('[store] 持久化失败', e); }
}

export function save() {
  clearTimeout(timer);
  timer = setTimeout(flush, 120);
  emit('ctx:update', state);
}

/** 切换租户作用域：持久化当前上下文 → 加载目标租户上下文（无则播种） */
export function setScope(orgId) {
  clearTimeout(timer);
  flush();
  scope = orgId || '';
  localStorage.setItem(SCOPE_KEY, scope);
  const next = loadSync();
  state.length = 0; // 保留引用
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, next || clone(seedState()));
  save();
  emit('ctx:scope', scope);
  return state;
}

function parts(path) {
  return String(path).split('.').flatMap((p) => {
    const m = p.match(/^\[(\d+)\]$/);
    return m ? [Number(m[1])] : p.split(/[\[\]]/).filter(Boolean);
  });
}

export function get(path, def = undefined) {
  let cur = state;
  for (const k of parts(path)) {
    if (cur == null) return def;
    cur = cur[k];
  }
  return cur === undefined ? def : cur;
}

export function set(path, value) {
  const ps = parts(path);
  const last = ps.pop();
  let cur = state;
  for (const k of ps) {
    if (cur[k] == null) cur[k] = typeof k === 'number' ? [] : {};
    cur = cur[k];
  }
  cur[last] = value;
  save();
  return value;
}

export function push(path, item) {
  const arr = get(path, []);
  arr.push(item);
  set(path, arr);
  return item;
}

export function update(path, fn) {
  const cur = get(path);
  const next = fn(cur);
  set(path, next);
  return next;
}

export function upsert(path, item, key = 'id') {
  const arr = get(path, []);
  const i = arr.findIndex((x) => x[key] === item[key]);
  if (i >= 0) arr[i] = { ...arr[i], ...item };
  else arr.push(item);
  set(path, arr);
  return item;
}

let seq = Number(localStorage.getItem('global-eagle.seq') || 1000);
export function uid(prefix = 'id') {
  seq += 1;
  localStorage.setItem('global-eagle.seq', String(seq));
  return `${prefix}_${seq.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

/** 重置当前租户数据 */
export function reset() {
  localStorage.removeItem(storageKey());
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, clone(seedState()));
  save();
}

/** 关键：数据可验证性标记 */
export function confidence(item) {
  const missing = [];
  if (!item.email) missing.push('联系方式');
  if (item.verified === false) missing.push('来源未核验');
  if (!item.source) missing.push('数据来源');
  return missing.length ? { level: '低', missing, note: '信息不足，需要人工确认。' } : { level: '高', missing: [], note: '字段完整。' };
}

export default { state, get, set, push, update, upsert, save, uid, reset, confidence, setScope, getScope };
