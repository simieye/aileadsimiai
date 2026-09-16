/**
 * Global Eagle · UI 基础组件（无第三方依赖）
 */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = (n) => `$${Number(n || 0).toLocaleString()}`;
export const pct = (n) => `${Number(n || 0).toFixed(1)}%`;

export function toast(msg, type = 'info') {
  const wrap = document.getElementById('toast');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2800);
}

export const tierBadge = (t) => `<span class="badge tier-${String(t || 'C').toLowerCase()}">${t || 'C'} 类</span>`;
export const riskBadge = (r) => `<span class="badge risk-${({ 高: 'high', 中: 'mid', 低: 'low' })[r] || 'mid'}">${r || '中'}风险</span>`;

export function card(title, body, opts = {}) {
  return `<section class="card ${opts.cls || ''}">
    <header class="card-hd"><h3>${esc(title)}</h3>${opts.right || ''}</header>
    <div class="card-bd">${body}</div>
  </section>`;
}

export function kpi(label, value, sub = '', trend = '') {
  return `<div class="kpi">
    <div class="kpi-label">${esc(label)}</div>
    <div class="kpi-value">${value}</div>
    <div class="kpi-sub">${esc(sub)} <span class="${trend > 0 ? 'up' : trend < 0 ? 'down' : ''}">${trend > 0 ? '▲' : trend < 0 ? '▼' : ''}${trend ? Math.abs(trend) + '%' : ''}</span></div>
  </div>`;
}

export function table(headers, rows, opts = {}) {
  if (!rows.length) return `<div class="empty">${esc(opts.empty || '暂无数据，请先运行对应 Agent 工作流。')}</div>`;
  return `<div class="table-wrap"><table class="table">
    <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

export function bars(items, opts = {}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return `<div class="bars">${items.map((i) => `
    <div class="bar-row">
      <div class="bar-label">${esc(i.label)}</div>
      <div class="bar-track"><div class="bar-fill ${i.cls || ''}" style="width:${(i.value / max * 100).toFixed(1)}%"></div></div>
      <div class="bar-val">${esc(i.display ?? i.value)}</div>
    </div>`).join('')}</div>`;
}

export function ring(score, tier) {
  const c = 2 * Math.PI * 34;
  const off = c - (Math.min(score, 100) / 100) * c;
  const color = tier === 'S' ? '#ffb020' : tier === 'A' ? '#25d0a4' : tier === 'B' ? '#4aa8ff' : '#7b8794';
  return `<svg class="ring" viewBox="0 0 80 80">
    <circle cx="40" cy="40" r="34" fill="none" stroke="#1e2836" stroke-width="8"/>
    <circle cx="40" cy="40" r="34" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 40 40)"/>
    <text x="40" y="44" text-anchor="middle" class="ring-t">${score}</text>
    <text x="40" y="60" text-anchor="middle" class="ring-s">${tier}</text>
  </svg>`;
}

export function kb(items) { // kanban column
  return items;
}

export function section(title, sub = '') {
  return `<div class="sec-title"><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>`;
}

export function chip(text, cls = '') { return `<span class="chip ${cls}">${esc(text)}</span>`; }

export function code(text) {
  return `<pre class="code">${esc(text)}</pre>`;
}

export default { esc, money, pct, toast, card, kpi, table, bars, ring, section, chip, code, tierBadge, riskBadge };
