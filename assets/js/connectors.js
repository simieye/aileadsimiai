/**
 * Global Eagle · 连接器层
 * 1) MCP Connector：MCP Streamable HTTP 客户端（JSON-RPC 2.0，真实 initialize / tools/list / tools/call）
 * 2) OpenClaw Connector：本地 OpenClaw 网关（WebSocket + OpenAI 兼容 HTTP 双通道）
 */
import { get, set, uid } from './store.js';
import { emit } from './bus.js';

/* ================================================================ MCP */
const MCP_PROTOCOL = '2025-03-26';

export function listMCP() { return get('mcp.connections', []); }

function saveMCP(list) { set('mcp.connections', list); emit('mcp:change', list); }

function rpcResult(res) {
  // Streamable HTTP 可能返回 application/json 或 text/event-stream
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('text/event-stream')) {
    return res.text().then((body) => {
      let last = null;
      for (const line of body.split('\n')) {
        const m = line.match(/^data:\s*(.+)$/);
        if (m) { try { last = JSON.parse(m[1]); } catch (_) { /* skip */ } }
      }
      if (last && last.error) throw new Error(last.error.message || 'MCP error');
      return last;
    });
  }
  return res.json().then((json) => {
    if (json.error) throw new Error(json.error.message || 'MCP error');
    return json;
  });
}

async function rpc(conn, method, params) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), conn.timeout || 15000);
  try {
    const res = await fetch(conn.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(conn.token ? { Authorization: `Bearer ${conn.token}` } : {}),
        ...(conn.sessionId ? { 'Mcp-Session-Id': conn.sessionId } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: Math.floor(Math.random() * 1e6), method, ...(params ? { params } : {}) }),
      signal: controller.signal,
    });
    const sid = res.headers.get('mcp-session-id');
    if (sid) conn.sessionId = sid;
    return await rpcResult(res);
  } finally {
    clearTimeout(timeout);
  }
}

/** 连接 MCP Server（真实握手：initialize → initialized → tools/list） */
export async function connectMCP({ name, url, token }) {
  const conn = { id: uid('mcp'), name: name || url, url, token: token || '', status: 'connecting', tools: [], sessionId: '', connected_at: '' };
  const list = listMCP();
  list.push(conn); saveMCP(list);
  try {
    await rpc(conn, 'initialize', {
      protocolVersion: MCP_PROTOCOL,
      capabilities: {},
      clientInfo: { name: 'Global Eagle', version: '1.0.0' },
    });
    await rpc(conn, 'notifications/initialized').catch(() => null);
    const r = await rpc(conn, 'tools/list');
    conn.tools = (r?.result?.tools || []).map((t) => ({ name: t.name, desc: t.description || '' }));
    conn.status = 'connected';
    conn.connected_at = new Date().toISOString();
    saveMCP(list);
    return { ok: true, tools: conn.tools.length };
  } catch (e) {
    conn.status = 'error';
    conn.error = e.message;
    saveMCP(list);
    return { ok: false, error: e.message };
  }
}

export function disconnectMCP(id) { saveMCP(listMCP().filter((c) => c.id !== id)); }

export async function refreshMCP(id) {
  const list = listMCP();
  const conn = list.find((c) => c.id === id);
  if (!conn) return { ok: false, error: '连接不存在' };
  try {
    const r = await rpc(conn, 'tools/list');
    conn.tools = (r?.result?.tools || []).map((t) => ({ name: t.name, desc: t.description || '' }));
    conn.status = 'connected'; conn.error = '';
    saveMCP(list);
    return { ok: true, tools: conn.tools.length };
  } catch (e) {
    conn.status = 'error'; conn.error = e.message;
    saveMCP(list);
    return { ok: false, error: e.message };
  }
}

/** 调用 MCP 工具（真实 tools/call） */
export async function callMCP(id, toolName, args) {
  const conn = listMCP().find((c) => c.id === id);
  if (!conn) throw new Error('MCP 连接不存在');
  const r = await rpc(conn, 'tools/call', { name: toolName, arguments: args || {} });
  const content = r?.result?.content;
  return {
    ok: !r?.result?.isError,
    output: Array.isArray(content) ? content.map((c) => c.text || JSON.stringify(c)).join('\n') : JSON.stringify(r?.result ?? r, null, 2),
  };
}

/* ====================================================== OpenClaw 本地网关 */
export function openclawConfig() {
  return get('openclaw.config', null) || {
    wsURL: 'ws://127.0.0.1:18789', httpURL: 'http://127.0.0.1:18789',
    token: '', agentId: 'main', autoConnect: false,
  };
}

export function saveOpenclawConfig(cfg) {
  const next = { ...openclawConfig(), ...cfg };
  set('openclaw.config', next);
  emit('openclaw:config', next);
  return next;
}

let ws = null;
export function openclawStatus() { return get('openclaw.status', { state: 'disconnected', logs: [] }); }

function logOC(msg, level = 'info') {
  const s = openclawStatus();
  s.logs = [{ t: new Date().toLocaleTimeString('zh-CN'), msg, level }, ...(s.logs || [])].slice(0, 50);
  set('openclaw.status', s);
  emit('openclaw:log', s);
}

/** 连接本地 OpenClaw 网关（真实 WebSocket，断线自动重连 ×3） */
export function connectOpenclaw() {
  const cfg = openclawConfig();
  if (ws) { try { ws.close(); } catch (_) { /* noop */ } }
  set('openclaw.status', { ...openclawStatus(), state: 'connecting' });
  let retries = 0;
  const open = () => {
    logOC(`正在连接 ${cfg.wsURL} …`);
    try { ws = new WebSocket(cfg.wsURL); } catch (e) { logOC(`连接失败：${e.message}`, 'error'); set('openclaw.status', { ...openclawStatus(), state: 'error', error: e.message }); return; }
    ws.onopen = () => {
      retries = 0;
      set('openclaw.status', { ...openclawStatus(), state: 'connected', error: '' });
      logOC('OpenClaw 网关已连接');
      sendOpenclaw({ type: 'hello', client: 'global-eagle', agentId: cfg.agentId, ...(cfg.token ? { token: cfg.token } : {}) });
    };
    ws.onmessage = (ev) => {
      let data = ev.data;
      try { data = JSON.parse(ev.data); } catch (_) { /* 纯文本 */ }
      logOC(`← ${typeof data === 'string' ? data : JSON.stringify(data).slice(0, 200)}`);
      emit('openclaw:message', data);
    };
    ws.onerror = () => logOC('WebSocket 错误', 'error');
    ws.onclose = () => {
      set('openclaw.status', { ...openclawStatus(), state: retries < 3 ? 'connecting' : 'disconnected' });
      if (retries < 3) { retries += 1; logOC(`连接断开，${retries}s 后重试（${retries}/3）`, 'warn'); setTimeout(open, retries * 1000); }
      else logOC('已断开连接', 'warn');
    };
  };
  open();
}

export function disconnectOpenclaw() {
  if (ws) { try { ws.close(); } catch (_) { /* noop */ } ws = null; }
  set('openclaw.status', { ...openclawStatus(), state: 'disconnected' });
  logOC('手动断开');
}

export function sendOpenclaw(payload) {
  if (!ws || ws.readyState !== 1) return { ok: false, error: 'OpenClaw 未连接' };
  ws.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
  logOC(`→ ${typeof payload === 'string' ? payload.slice(0, 200) : JSON.stringify(payload).slice(0, 200)}`);
  return { ok: true };
}

/** 通过本地 OpenClaw 的 OpenAI 兼容通道发起对话（真实 HTTP） */
export async function openclawChat(prompt) {
  const cfg = openclawConfig();
  const res = await fetch(`${cfg.httpURL.replace(/\/$/, '')}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}) },
    body: JSON.stringify({ model: cfg.agentId, messages: [{ role: 'user', content: prompt }], stream: false }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '(空响应)';
}

/** HTTP 健康探测（真实 fetch） */
export async function openclawHealth() {
  const cfg = openclawConfig();
  for (const path of ['/health', '/v1/models', '/']) {
    try {
      const res = await fetch(`${cfg.httpURL.replace(/\/$/, '')}${path}`, { signal: AbortSignal.timeout(4000) });
      if (res.ok || res.status === 401) return { ok: true, path, status: res.status };
    } catch (_) { /* try next */ }
  }
  return { ok: false };
}
