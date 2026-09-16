/**
 * Global Eagle · Event Bus
 * Agent 集群之间唯一的异步通信通道（感知层 → 决策层 → 执行层）
 */
const map = new Map();

export function on(evt, fn) {
  if (!map.has(evt)) map.set(evt, new Set());
  map.get(evt).add(fn);
  return () => map.get(evt).delete(fn);
}

export function off(evt, fn) {
  if (map.has(evt)) map.get(evt).delete(fn);
}

export function emit(evt, payload) {
  (map.get(evt) || []).forEach((f) => {
    try { f(payload); } catch (e) { console.error('[bus]', evt, e); }
  });
  (map.get('*') || []).forEach((f) => {
    try { f({ evt, payload }); } catch (e) { console.error('[bus:*]', e); }
  });
}

/** 全局事件流（Audit / 时间线 / 调试用） */
export const stream = [];
export function record(evt, payload) {
  stream.push({ evt, payload, t: Date.now() });
  if (stream.length > 500) stream.shift();
  emit(evt, payload);
}

export default { on, off, emit, record, stream };
