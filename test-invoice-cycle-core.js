'use strict';
const assert = require('node:assert/strict');
const { STATUSES, transitionStatus, stockDelta, validateInvoiceBalance } = require('./invoice-cycle-core');

assert.equal(transitionStatus(STATUSES.DRAFT, 'APPROVE'), STATUSES.APPROVED);
assert.equal(transitionStatus(STATUSES.APPROVED, 'POST'), STATUSES.POSTED);
assert.equal(transitionStatus(STATUSES.POSTED, 'VOID'), STATUSES.VOID);
assert.throws(() => transitionStatus(STATUSES.DRAFT, 'POST'), /لا يمكن تنفيذ/);
assert.equal(stockDelta('SALE', 3, 'POST'), -3);
assert.equal(stockDelta('PURCHASE', 3, 'POST'), 3);
assert.equal(stockDelta('SALE', 3, 'VOID'), 3);
assert.equal(stockDelta('PURCHASE', 3, 'VOID'), -3);
assert.equal(validateInvoiceBalance(100, 25, 75), true);
assert.throws(() => validateInvoiceBalance(100, 25, 70), /لا يساوي/);
console.log('invoice-cycle-core tests passed');
