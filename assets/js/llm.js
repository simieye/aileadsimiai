/**
 * Global Eagle · 大模型接入层（真实 HTTP 调用，OpenAI 兼容协议）
 * 支持：OpenAI / DeepSeek / 通义千问 / 智谱 / Kimi / Ollama / 任意 OpenAI 兼容端点
 * 未配置或调用失败时，Agent 自动回退到本地确定性生成，不会中断业务链路。
 */
import { get, set } from './store.js';
import { emit } from './bus.js';

export const PRESETS = [
  { id: 'openai', name: 'OpenAI', baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { id: 'deepseek', name: 'DeepSeek 深度求索', baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { id: 'qwen', name: '阿里通义千问', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { id: 'zhipu', name: '智谱 GLM', baseURL: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { id: 'moonshot', name: '月之暗面 Kimi', baseURL: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { id: 'ollama', name: '本地 Ollama', baseURL: 'http://127.0.0.1:11434/v1', model: 'qwen2.5:7b' },
  { id: 'openclaw', name: 'OpenClaw 本地网关', baseURL: 'http://127.0.0.1:18789/v1', model: 'openclaw-agent' },
];

export function getConfig() {
  return get('llm.config', null) || { provider: '', baseURL: '', apiKey: '', model: '', temperature: 0.7, maxTokens: 2048, enabled: false };
}

export function saveConfig(cfg) {
  set('llm.config', { ...getConfig(), ...cfg });
  emit('llm:config', getConfig());
  return getConfig();
}

export function isConfigured() {
  const c = getConfig();
  return !!(c.enabled && c.baseURL && c.model);
}

/** 核心：OpenAI 兼容 Chat Completions（真实网络请求） */
export async function chat(messages, opts = {}) {
  const c = getConfig();
  if (!isConfigured()) throw new Error('LLM_NOT_CONFIGURED');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeout || 60000);
  try {
    const res = await fetch(`${c.baseURL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(c.apiKey ? { Authorization: `Bearer ${c.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: c.model,
        messages,
        temperature: opts.temperature ?? c.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? c.maxTokens ?? 2048,
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`LLM_HTTP_${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('LLM_EMPTY_RESPONSE');
    set('llm.stats', { calls: (get('llm.stats', { calls: 0 }).calls || 0) + 1, last_at: new Date().toISOString() });
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

/** 单轮生成：失败时返回 null（调用方回退本地模板） */
export async function complete(prompt, system = '你是全球鹰 Global Eagle 外贸 AI 获客专家，输出简洁、专业、可执行。', opts = {}) {
  try {
    return await chat([{ role: 'system', content: system }, { role: 'user', content: prompt }], opts);
  } catch (e) {
    console.warn('[llm] 调用失败，回退本地生成：', e.message);
    emit('llm:error', e.message);
    return null;
  }
}

/** 连接测试（真实请求） */
export async function testConnection(cfg = null) {
  const backup = getConfig();
  if (cfg) saveConfig({ ...cfg, enabled: true });
  try {
    const t0 = Date.now();
    const out = await chat([{ role: 'user', content: '回复"连接成功"四个字' }], { maxTokens: 20, timeout: 20000 });
    return { ok: true, latency: Date.now() - t0, sample: out.slice(0, 80) };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    if (cfg) saveConfig(backup); // 还原原配置（测试不落库失败配置）
  }
}

/** JSON 生成：让 Agent 拿到结构化输出 */
export async function completeJSON(prompt, system = '') {
  const text = await complete(`${prompt}\n\n严格要求：只输出合法 JSON，不要任何解释文字或代码块标记。`, system || '你是结构化数据引擎，只输出 JSON。', { temperature: 0.3 });
  if (!text) return null;
  const m = text.match(/[[{][\s\S]*[\]}]/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (_) { return null; }
}

export default { PRESETS, getConfig, saveConfig, isConfigured, chat, complete, completeJSON, testConnection };
