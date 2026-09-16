/**
 * Global Eagle · 多租户认证与组织管理
 * - 平台管理员（super_admin）：管理所有租户/用户
 * - 企业管理员（org_admin）：管理本租户成员
 * - 企业用户（user）：业务操作
 * 密码使用 WebCrypto SHA-256 + 随机盐存储（本地演示级安全，生产请接服务端）
 */
import { setScope, getScope } from './store.js';
import { emit } from './bus.js';

const PKEY = 'global-eagle.platform.v1';
const SESSION_KEY = 'global-eagle.session.v1';
const SESSION_TTL = 1000 * 60 * 60 * 24 * 7; // 7 天

function platform() {
  try {
    const raw = localStorage.getItem(PKEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* ignore */ }
  const init = { orgs: [], users: [], created_at: new Date().toISOString() };
  localStorage.setItem(PKEY, JSON.stringify(init));
  return init;
}
function savePlatform(p) { localStorage.setItem(PKEY, JSON.stringify(p)); }

export async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}::${password}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const uidp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/* ------------------------------------------------------------- 会话 */
export function currentUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (Date.now() > s.expires_at) { logout(false); return null; }
    const u = platform().users.find((x) => x.id === s.user_id);
    return u || null;
  } catch (_) { return null; }
}

export function login(email, password) {
  const p = platform();
  const u = p.users.find((x) => x.email.toLowerCase() === String(email).toLowerCase().trim());
  if (!u) return { ok: false, error: '账号不存在' };
  if (u.status !== 'active') return { ok: false, error: '账号已被停用，请联系管理员' };
  return hashPassword(password, u.salt).then((h) => {
    if (h !== u.password_hash) return { ok: false, error: '密码错误' };
    const session = { user_id: u.id, org_id: u.org_id, issued_at: Date.now(), expires_at: Date.now() + SESSION_TTL };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setScope(u.org_id);
    emit('auth:login', u);
    return { ok: true, user: u };
  });
}

export function logout(reload = true) {
  localStorage.removeItem(SESSION_KEY);
  emit('auth:logout');
  if (reload) location.reload();
}

/* ------------------------------------------------------------- 注册 */
/** 企业租户注册：创建组织 + 企业管理员；首个账号自动成为平台管理员 */
export async function registerOrg({ orgName, name, email, password }) {
  const p = platform();
  email = String(email).toLowerCase().trim();
  if (!orgName?.trim() || !name?.trim() || !email || password?.length < 6) {
    return { ok: false, error: '请填写完整信息，密码至少 6 位' };
  }
  if (p.users.some((x) => x.email === email)) return { ok: false, error: '该邮箱已注册' };
  const isFirst = p.users.length === 0;
  const org = {
    id: `org_${uidp()}`, name: orgName.trim(), plan: isFirst ? 'platform' : 'standard',
    status: 'active', created_at: new Date().toISOString(), owner: email,
  };
  const salt = uidp() + uidp();
  const user = {
    id: `usr_${uidp()}`, org_id: org.id, name: name.trim(), email,
    salt, password_hash: await hashPassword(password, salt),
    role: isFirst ? 'super_admin' : 'org_admin', status: 'active', created_at: new Date().toISOString(),
  };
  p.orgs.push(org); p.users.push(user); savePlatform(p);
  setScope(org.id); // 初始化该租户上下文（播种）
  return { ok: true, user, org, isFirst };
}

/** 企业管理员在本租户内添加成员 */
export async function addUser({ name, email, password, role = 'user', orgId }) {
  const me = currentUser();
  if (!me || !['super_admin', 'org_admin'].includes(me.role)) return { ok: false, error: '无权限：仅管理员可添加成员' };
  const targetOrg = me.role === 'super_admin' ? (orgId || me.org_id) : me.org_id;
  const p = platform();
  email = String(email).toLowerCase().trim();
  if (p.users.some((x) => x.email === email)) return { ok: false, error: '该邮箱已注册' };
  if (password?.length < 6) return { ok: false, error: '密码至少 6 位' };
  const salt = uidp() + uidp();
  const user = {
    id: `usr_${uidp()}`, org_id: targetOrg, name: name.trim(), email,
    salt, password_hash: await hashPassword(password, salt),
    role, status: 'active', created_at: new Date().toISOString(),
  };
  p.users.push(user); savePlatform(p);
  return { ok: true, user };
}

export function listUsers(orgId = null) {
  const p = platform();
  return orgId ? p.users.filter((u) => u.org_id === orgId) : p.users;
}
export function listOrgs() { return platform().orgs; }

export function setUserStatus(userId, status) {
  const me = currentUser();
  if (!me || me.role !== 'super_admin') return { ok: false, error: '仅平台管理员可操作' };
  const p = platform();
  const u = p.users.find((x) => x.id === userId);
  if (!u) return { ok: false, error: '用户不存在' };
  if (u.id === me.id) return { ok: false, error: '不能停用自己' };
  u.status = status; savePlatform(p);
  return { ok: true };
}

export function setUserRole(userId, role) {
  const me = currentUser();
  if (!me || me.role !== 'super_admin') return { ok: false, error: '仅平台管理员可操作' };
  const p = platform();
  const u = p.users.find((x) => x.id === userId);
  if (!u) return { ok: false, error: '用户不存在' };
  u.role = role; savePlatform(p);
  return { ok: true };
}

export function setOrgStatus(orgId, status) {
  const me = currentUser();
  if (!me || me.role !== 'super_admin') return { ok: false, error: '仅平台管理员可操作' };
  const p = platform();
  const o = p.orgs.find((x) => x.id === orgId);
  if (!o) return { ok: false, error: '租户不存在' };
  o.status = status; savePlatform(p);
  return { ok: true };
}

export function resetPassword(userId, newPassword) {
  const me = currentUser();
  if (!me || me.role !== 'super_admin') return Promise.resolve({ ok: false, error: '仅平台管理员可操作' });
  const p = platform();
  const u = p.users.find((x) => x.id === userId);
  if (!u) return Promise.resolve({ ok: false, error: '用户不存在' });
  const salt = uidp() + uidp();
  return hashPassword(newPassword, salt).then((h) => {
    u.salt = salt; u.password_hash = h; savePlatform(p);
    return { ok: true };
  });
}

export const ROLE_LABEL = { super_admin: '平台管理员', org_admin: '企业管理员', user: '企业用户' };
export const ROLE_LIST = ['user', 'org_admin', 'super_admin'];
