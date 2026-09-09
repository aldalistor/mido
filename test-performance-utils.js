const assert = require('assert');
const { pagination, pageResult, TTLCache } = require('./performance-utils');

assert.deepStrictEqual(pagination({ page: 3, pageSize: 20 }), { page: 3, pageSize: 20, offset: 40 });
assert.strictEqual(pagination({ page: 0, pageSize: 9999 }).pageSize, 500);
const result = pageResult([{ id: 1 }], 1, 1, 3);
assert.deepStrictEqual(result, { rows: [{ id: 1 }], page: 1, pageSize: 1, total: 3, hasMore: true });
const cache = new TTLCache(50);
cache.set('dashboard:a', { value: 1 });
assert.deepStrictEqual(cache.get('dashboard:a'), { value: 1 });
cache.invalidate('dashboard:');
assert.strictEqual(cache.get('dashboard:a'), undefined);
console.log('performance utils tests passed');
