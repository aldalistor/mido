'use strict';
const assert = require('node:assert/strict');
const { PAYMENT_TYPES, buildPayment, agingBucket } = require('./receivables-core');

const receipt = buildPayment({ paymentType: PAYMENT_TYPES.RECEIPT, contactCode: 'C-001', cashAccountCode: '1101', amount: 1000, allocations: [{ invoiceNo: 'INV-1', amount: 700 }] });
assert.equal(receipt.unappliedAmount, 300);
assert.equal(receipt.allocations.length, 1);
assert.throws(() => buildPayment({ paymentType: 'RECEIPT', amount: 100, allocations: [{ invoiceNo: 'INV-1', amount: 101 }] }), /أكبر/);
assert.throws(() => buildPayment({ paymentType: 'RECEIPT', amount: 200, allocations: [{ invoiceNo: 'INV-1', amount: 100 }, { invoiceNo: 'INV-1', amount: 50 }] }), /مكررة/);
assert.equal(agingBucket('2024-09-01', '2024-09-01'), 'CURRENT');
assert.equal(agingBucket('2024-08-01', '2024-09-01'), 'DAYS_31_60');
assert.equal(agingBucket('2024-01-01', '2024-09-01'), 'DAYS_90_PLUS');
console.log('receivables core tests passed');
