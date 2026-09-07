'use strict';
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { issueTestLicense } = require('./commercial-license-core');
const { postCommercialInvoice, buildTrialBalance, buildAccountStatement } = require('./commercial-accounting-core');
const { TYPES, PAYMENT_METHODS } = require('./commercial-invoice-core');

const keyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const license = issueTestLicense({ issuedAt: '2026-01-01', expiresAt: '2026-12-31', keyPair });
const records = { invoices: [], journals: [], stock: [], payments: [], audits: [], committed: 0 };
const repository = { begin() {
  const pending = { invoices: [], journals: [], stock: [], payments: [], audits: [] };
  return {
    insertInvoice(value) { const row = { ...value, invoiceId: `INV-${records.invoices.length + pending.invoices.length + 1}` }; pending.invoices.push(row); return row; },
    insertJournal(value) { const row = { ...value, journalId: `JV-${records.journals.length + pending.journals.length + 1}` }; pending.journals.push(row); return row; },
    insertStockMovement(value) { pending.stock.push(value); return value; },
    insertPayment(value) { pending.payments.push(value); return value; },
    insertAudit(value) { pending.audits.push(value); return value; },
    commit() { for (const key of Object.keys(pending)) records[key].push(...pending[key]); records.committed += 1; },
    rollback() { pending.invoices.length = 0; }
  };
} };
const context = { license, publicKey: keyPair.publicKey, today: '2026-09-07', currentUsers: 2, currentBranches: 1, permissions: ['INVOICE_CREATE', 'PURCHASE_CREATE'], businessDate: '2026-09-07', postDate: '2026-09-07', period: { status: 'OPEN', startDate: '2026-01-01', endDate: '2026-12-31' } };
const sale = postCommercialInvoice(repository, { type: TYPES.SALE, paymentMethod: PAYMENT_METHODS.CASH, taxRate: 0, lines: [{ itemCode: 'I-1', quantity: 2, unitPrice: 100, unitCost: 60 }] }, context);
assert.equal(sale.invoice.status, 'POSTED');
assert.equal(sale.journal.status, 'POSTED');
assert.equal(sale.stockMovements[0].quantity, -2);
assert.equal(records.payments.length, 1);
assert.equal(records.committed, 1);
const purchase = postCommercialInvoice(repository, { type: TYPES.PURCHASE, paymentMethod: PAYMENT_METHODS.CREDIT, taxRate: 0, lines: [{ itemCode: 'I-2', quantity: 1, unitPrice: 50, unitCost: 50 }] }, context);
assert.equal(purchase.invoice.status, 'POSTED');
assert.equal(purchase.journal.totalDebit, purchase.journal.totalCredit);
assert.equal(purchase.stockMovements[0].quantity, 1);
assert.throws(() => postCommercialInvoice(repository, { type: TYPES.PURCHASE, paymentMethod: PAYMENT_METHODS.CREDIT, lines: [{ itemCode: 'I-2', quantity: 1, unitPrice: 50 }] }, { ...context, period: { ...context.period, status: 'CLOSED' } }), /PERIOD_CLOSED/);
const trial = buildTrialBalance(records.journals);
assert.equal(trial.balanced, true);
assert.equal(buildAccountStatement('4101', records.journals).closingBalance, -200);
console.log('commercial-accounting tests passed');
