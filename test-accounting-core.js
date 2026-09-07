const assert = require('node:assert/strict');
const core = require('./accounting-core');

const balanced = core.validateJournal({ description: 'قيد اختبار', source: 'TEST', lines: [{ accountCode: '1101', debit: 125.5 }, { accountCode: '4101', credit: 125.5 }] });
assert.equal(balanced.totalDebit, 125.5);
assert.equal(balanced.totalCredit, 125.5);
assert.throws(() => core.validateJournal({ description: 'غير متوازن', lines: [{ accountCode: '1101', debit: 100 }, { accountCode: '4101', credit: 90 }] }), /غير متوازن/);
assert.throws(() => core.validateJournal({ description: 'سطر مزدوج', lines: [{ accountCode: '1101', debit: 100, credit: 1 }, { accountCode: '4101', credit: 99 }] }), /معاً/);
assert.throws(() => core.validateJournal({ description: 'فارغ', lines: [{ accountCode: '1101' }, { accountCode: '4101', credit: 1 }] }), /يجب أن يحتوي/);

const close = core.closeFiscalYear({ revenue: 1000, expenses: 250, openingYear: 2025 });
assert.equal(close.source, 'YEAR_CLOSE');
assert.equal(close.totalDebit, close.totalCredit);
assert.equal(close.lines.at(-1).credit, 750);

const repository = { records: [], begin() { let committed = false; return { insertJournal: journal => { this.pending = journal; return { entryNo: 'JV-1' }; }, commit: () => { committed = true; repository.records.push(this.pending); }, rollback: () => { this.pending = null; } }; } };
const posted = core.postJournal(repository, { description: 'ترحيل ذري', lines: [{ accountCode: '1101', debit: 50 }, { accountCode: '4101', credit: 50 }] });
assert.equal(posted.status, 'POSTED');
assert.equal(repository.records.length, 1);
console.log('accounting-core tests passed');
