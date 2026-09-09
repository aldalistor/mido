const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;

function pagination(input = {}) {
  const page = Math.max(Number.parseInt(input.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(Number.parseInt(input.pageSize ?? input.limit, 10) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function pageResult(rows, page, pageSize, total = null) {
  return { rows, page, pageSize, total: total == null ? rows.length : Number(total), hasMore: total == null ? rows.length === pageSize : page * pageSize < Number(total) };
}

function debounce(fn, wait = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    return new Promise((resolve, reject) => {
      timer = setTimeout(() => Promise.resolve(fn(...args)).then(resolve, reject), wait);
    });
  };
}

class TTLCache {
  constructor(ttlMs = 30_000) { this.ttlMs = ttlMs; this.values = new Map(); }
  get(key) {
    const hit = this.values.get(key);
    if (!hit || hit.expiresAt <= Date.now()) { this.values.delete(key); return undefined; }
    return hit.value;
  }
  set(key, value, ttlMs = this.ttlMs) { this.values.set(key, { value, expiresAt: Date.now() + ttlMs }); return value; }
  invalidate(prefix = '') { for (const key of this.values.keys()) if (!prefix || key.startsWith(prefix)) this.values.delete(key); }
  clear() { this.values.clear(); }
}

async function timed(label, operation, logger = console.debug) {
  const started = Date.now();
  try { return await operation(); }
  finally { logger(`[PERF] ${label} ${Date.now() - started}ms`); }
}

module.exports = { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, pagination, pageResult, debounce, TTLCache, timed };
