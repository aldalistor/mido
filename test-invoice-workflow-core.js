'use strict';

const assert = require('node:assert/strict');
const { STATUSES, transition, recordPayment, buildReturn, isReadOnlyLicense } = require('./invoice-workflow-core');

let invoice = { invoiceId: 10, type: 'SALE', status: STATUSES.DRAFT, total: 100, currency: 'YER', lines: [{ itemCode: 'I-1', quantity: 5, unitPrice: 20 }] };
invoice = transition(invoice, STATUSES.PENDING_APPROVAL, ['SUBMIT_INVOICES']);
invoice = transition(invoice, STATUSES.APPROVED, ['APPROVE_INVOICES']);
invoice = transition(invoice, STATUSES.POSTED, ['POST_JOURNALS']);
invoice = recordPayment(invoice, { amount: 40, method: 'BANK', reference: 'RC-1' }, ['RECORD_PAYMENTS']);
assert.equal(invoice.status, STATUSES.PARTIALLY_PAID);
assert.equal(invoice.balanceDue, 60);
invoice = recordPayment(invoice, { amount: 60, method: 'CASH' }, ['RECORD_PAYMENTS']);
assert.equal(invoice.status, STATUSES.PAID);
const returned = buildReturn(invoice, [{ itemCode: 'I-1', quantity: 2, unitPrice: 20, reason: 'تالف' }], ['CREATE_RETURNS']);
assert.equal(returned.type, 'SALES_RETURN');
assert.equal(returned.lines[0].quantity, 2);
assert.throws(() => buildReturn(invoice, [{ itemCode: 'I-1', quantity: 6 }], ['CREATE_RETURNS']), /تتجاوز/);
assert.equal(isReadOnlyLicense({ valid: false, expiresAt: '2099-01-01' }), true);
assert.equal(isReadOnlyLicense({ valid: true, expiresAt: '2099-01-01' }), false);
assert.throws(() => transition({ status: STATUSES.DRAFT }, STATUSES.POSTED, ['POST_JOURNALS']), /لا يمكن نقل/);
console.log('invoice-workflow-core tests passed');
