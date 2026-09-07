'use strict';
const assert = require('node:assert/strict');
const { buildDefaultChart, validateChart, addAccount, getChildren, getPostableAccounts } = require('./chart-of-accounts-core');

const chart = buildDefaultChart();
assert.equal(chart.length, 18);
assert.equal(getChildren(chart, '11').length, 4);
assert.equal(getPostableAccounts(chart).some(account => account.code === '4101'), true);
assert.throws(() => validateChart([{ code: '11', name: 'أصول', type: 'ASSET' }, { code: '11', name: 'مكرر', type: 'ASSET' }]), /مكرر/);
assert.throws(() => validateChart([{ code: '11', name: 'أصول', type: 'ASSET', parentCode: '12' }]), /غير موجود/);
assert.throws(() => validateChart([{ code: '11', name: 'أصول', type: 'ASSET', parentCode: '12' }, { code: '12', name: 'خصوم', type: 'LIABILITY', parentCode: '11' }]), /حلقة/);
assert.throws(() => validateChart([{ code: '11', name: 'أصول', type: 'ASSET', isPostable: true }, { code: '1101', name: 'صندوق', type: 'ASSET', parentCode: '11' }]), /تجميعي/);
const extended = addAccount(chart, { code: '5203', name: 'مصروف تسويق', type: 'EXPENSE', parentCode: '52' });
assert.equal(extended.some(account => account.code === '5203'), true);
console.log('chart-of-accounts tests passed');
