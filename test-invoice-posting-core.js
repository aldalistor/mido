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

const commercialSale = buildInvoicePosting({ type: 'SALE', invoiceDate: '2026-09-07', dueDate: '2026-10-07', paymentMethod: 'CREDIT', paymentStatus: 'UNPAID', currency: 'YER', exchangeRate: 250, discountAmount: 10, lines: [{ itemCode: 'I-003', quantity: 2, unitPrice: 100, unitCost: 50, discountPercent: 5, taxAmount: 18 }] });
assert.equal(commercialSale.subtotal, 190);
assert.equal(commercialSale.discountTotal, 20);
assert.equal(commercialSale.total, 198);
assert.equal(commercialSale.payment.dueDate, '2026-10-07');
assert.equal(commercialSale.currency, 'YER');
assert.equal(commercialSale.exchangeRate, 250);
assert.equal(commercialSale.journal.totalDebit, commercialSale.journal.totalCredit);

const paidSale = buildInvoicePosting({ type: 'SALE', paymentMethod: 'CASH', lines: [{ itemCode: 'I-004', quantity: 1, unitPrice: 50, unitCost: 20 }] });
assert.equal(paidSale.payment.paymentStatus, 'PAID');
assert.equal(paidSale.journal.lines[0].accountCode, '1101');

assert.throws(() => buildInvoicePosting({ type: 'SALE', lines: [{ itemCode: 'I-001', quantity: 0, unitPrice: 10, unitCost: 5 }] }), /أكبر من صفر/);
assert.throws(() => buildInvoicePosting({ type: 'SALE', invoiceDate: '2026-09-07', dueDate: '2026-09-01', lines: [{ itemCode: 'I-001', quantity: 1, unitPrice: 10, unitCost: 5 }] }), /لا يسبق/);
assert.throws(() => buildInvoicePosting({ type: 'SALE', lines: [{ itemCode: 'I-001', quantity: 1, unitPrice: 10, unitCost: 5, discountPercent: 101 }] }), /لا تتجاوز/);

const repository = { committed: false, rolledBack: false, begin() { const self = this; return { insertInvoice: data => ({ invoiceId: 7, ...data }), insertJournal: data => ({ entryId: 8, ...data }), insertStockMovement: () => true, commit: () => { self.committed = true; }, rollback: () => { self.rolledBack = true; } }; } };
const posted = postInvoice(repository, { type: 'SALE', lines: [{ itemCode: 'I-001', quantity: 1, unitPrice: 100, unitCost: 60 }] });
assert.equal(posted.invoice.invoiceId, 7);
assert.equal(repository.committed, true);
assert.equal(repository.rolledBack, false);
console.log('invoice-posting-core tests passed');
