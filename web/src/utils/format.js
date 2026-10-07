// 时间格式化：后端返回 UTC 文本 'YYYY-MM-DD HH:MM:SS'
export function formatDate(value) {
  if (!value) return '';
  const normalized = typeof value === 'string' && !value.includes('T')
    ? value.replace(' ', 'T') + 'Z'
    : value;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function excerpt(text, len = 160) {
  if (!text) return '';
  const flat = String(text).replace(/\s+/g, ' ').trim();
  return flat.length > len ? `${flat.slice(0, len)}…` : flat;
}
