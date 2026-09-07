const assert = require('node:assert/strict');
const { buildInvoicePosting, postInvoice } = require('./invoice-posting-core');

const sale = buildInvoicePosting({ type: 'SALE', contactCode: 'C-001', lines: [{ itemCode: 'I-001', quantity: 2, unitPrice: 100, unitCost: 60 }] });
assert.equal(sale.subtotal, 200);
assert.equal(sale.total, 200);
assert.equal(sale.journal.totalDebit, sale.journal.totalCredit);
assert.deepEqual(sale.stockMovements[0], { itemCode: 'I-001', quantity: -2, unitCost: 60, movementType: 'SALE' });
assert.equal(sale.journal.lines.some(line => line.accountCode === '5102' && line.debit === 120), true);

const purchase = buildInvoicePosting({ type: 'PURCHASE', lines: [{ itemCode: 'I-002', quantity: 3, unitPrice: 25, unitCost: 25 }], taxAmount: 5 });
assert.equal(purchase.total, 80);
assert.equal(purchase.journal.totalDebit, purchase.journal.totalCredit);
assert.equal(purchase.stockMovements[0].quantity, 3);
assert.throws(() => buildInvoicePosting({ type: 'SALE', lines: [{ itemCode: 'I-001', quantity: 0, unitPrice: 10, unitCost: 5 }] }), /أكبر من صفر/);

const repository = { committed: false, rolledBack: false, begin() { const self = this; return { insertInvoice: data => ({ invoiceId: 7, ...data }), insertJournal: data => ({ entryId: 8, ...data }), insertStockMovement: () => true, commit: () => { self.committed = true; }, rollback: () => { self.rolledBack = true; } }; } };
const posted = postInvoice(repository, { type: 'SALE', lines: [{ itemCode: 'I-001', quantity: 1, unitPrice: 100, unitCost: 60 }] });
assert.equal(posted.invoice.invoiceId, 7);
assert.equal(repository.committed, true);
assert.equal(repository.rolledBack, false);
console.log('invoice-posting-core tests passed');
