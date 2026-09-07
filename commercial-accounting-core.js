'use strict';

const { calculateInvoice, TYPES, PAYMENT_METHODS } = require('./commercial-invoice-core');
const { validateJournal, EPSILON } = require('./accounting-core');
const { canPostDate } = require('./session-context');
const { assertCan } = require('./commercial-permissions-core');
const { enforceEntitlement } = require('./commercial-license-core');

function accountCode(value, fallback) { return String(value || fallback).trim(); }

function buildInvoiceJournal(invoice, payload = {}) {
  const isSale = invoice.type === TYPES.SALE || invoice.type === TYPES.SALES_RETURN;
  const isReturn = invoice.type === TYPES.SALES_RETURN || invoice.type === TYPES.PURCHASE_RETURN;
  const partyAccount = accountCode(payload.partyAccountCode, isSale ? '1201' : '2101');
  const cashAccount = accountCode(payload.cashAccountCode, '1101');
  const inventoryAccount = accountCode(payload.inventoryAccountCode, '1301');
  const revenueAccount = accountCode(payload.revenueAccountCode, '4101');
  const cogsAccount = accountCode(payload.cogsAccountCode, '5102');
  const taxAccount = accountCode(payload.taxAccountCode, '2201');
  const lines = [];
  const debit = (account, amount, description) => { if (amount > EPSILON) lines.push({ accountCode: account, debit: amount, credit: 0, description }); };
  const credit = (account, amount, description) => { if (amount > EPSILON) lines.push({ accountCode: account, debit: 0, credit: amount, description }); };
  const cashPaid = invoice.paidAmount;
  const outstanding = invoice.outstandingAmount;
  if (invoice.type === TYPES.SALE) {
    debit(cashAccount, cashPaid, 'النقدية المحصلة من فاتورة المبيعات'); debit(partyAccount, outstanding, 'ذمم العميل من فاتورة المبيعات');
    credit(revenueAccount, invoice.taxableAmount, 'إيراد المبيعات'); credit(taxAccount, invoice.taxAmount, 'ضريبة المبيعات');
    debit(cogsAccount, invoice.costTotal, 'تكلفة البضاعة المباعة'); credit(inventoryAccount, invoice.costTotal, 'إخراج البضاعة من المخزون');
  } else if (invoice.type === TYPES.PURCHASE) {
    debit(inventoryAccount, invoice.taxableAmount, 'إدخال المشتريات إلى المخزون'); debit(taxAccount, invoice.taxAmount, 'ضريبة المشتريات');
    credit(cashAccount, cashPaid, 'النقدية المدفوعة للمورد'); credit(partyAccount, outstanding, 'ذمم المورد من فاتورة المشتريات');
  } else if (invoice.type === TYPES.SALES_RETURN) {
    debit(revenueAccount, invoice.taxableAmount, 'عكس مبيعات المرتجع'); debit(taxAccount, invoice.taxAmount, 'عكس ضريبة المبيعات');
    credit(cashAccount, cashPaid, 'رد النقدية للعميل'); credit(partyAccount, outstanding, 'رصيد مرتجع العميل');
    debit(inventoryAccount, invoice.costTotal, 'إعادة البضاعة إلى المخزون'); credit(cogsAccount, invoice.costTotal, 'عكس تكلفة البضاعة المرتجعة');
  } else if (invoice.type === TYPES.PURCHASE_RETURN) {
    debit(cashAccount, cashPaid, 'المبلغ المسترد من المورد'); debit(partyAccount, outstanding, 'رصيد مرتجع المورد');
    credit(inventoryAccount, invoice.taxableAmount, 'إخراج مشتريات المرتجع'); credit(taxAccount, invoice.taxAmount, 'عكس ضريبة المشتريات');
  }
  return validateJournal({ description: payload.description || `ترحيل ${invoice.type}`, source: `${invoice.type}_INVOICE`, currency: invoice.currency, status: 'POSTED', lines });
}

function validatePeriodForPosting({ period, businessDate, postDate, permissions = [] } = {}) {
  if (!period) throw new Error('الفترة المالية مطلوبة قبل الترحيل.');
  const result = canPostDate({ businessDate, postDate, periodStatus: period.status, periodStart: period.startDate, periodEnd: period.endDate, allowBackdate: period.allowBackdate, backdateDaysLimit: period.backdateDaysLimit, allowFutureDate: period.allowFutureDate, permissions });
  if (!result.allowed) throw new Error(`لا يمكن الترحيل في هذه الفترة: ${result.reason}.`);
  return result;
}

function postCommercialInvoice(repository, payload = {}, context = {}) {
  assertCan(context.permissions || [], payload.type === TYPES.PURCHASE || payload.type === TYPES.PURCHASE_RETURN ? 'PURCHASE_CREATE' : 'INVOICE_CREATE');
  enforceEntitlement({ license: context.license, feature: payload.type === TYPES.PURCHASE || payload.type === TYPES.PURCHASE_RETURN ? 'PURCHASES' : 'INVOICING', currentUsers: context.currentUsers, currentBranches: context.currentBranches, options: { today: context.today, publicKey: context.publicKey } });
  validatePeriodForPosting({ period: context.period, businessDate: context.businessDate, postDate: context.postDate, permissions: context.permissions });
  const invoice = calculateInvoice(payload);
  const journal = buildInvoiceJournal(invoice, payload);
  if (!repository || typeof repository.begin !== 'function') throw new Error('مستودع الترحيل غير مهيأ.');
  const transaction = repository.begin();
  try {
    const savedInvoice = transaction.insertInvoice({ ...payload, ...invoice, status: 'POSTED' });
    const savedJournal = transaction.insertJournal({ ...journal, invoiceId: savedInvoice.invoiceId });
    const stockMovements = invoice.lines.map(line => ({ invoiceId: savedInvoice.invoiceId, itemCode: line.itemCode, quantity: [TYPES.SALE, TYPES.PURCHASE_RETURN].includes(invoice.type) ? -line.quantity : line.quantity, unitCost: line.unitCost || line.unitPrice, movementType: invoice.type }));
    for (const movement of stockMovements) transaction.insertStockMovement(movement);
    if (invoice.paidAmount > EPSILON && typeof transaction.insertPayment === 'function') transaction.insertPayment({ invoiceId: savedInvoice.invoiceId, amount: invoice.paidAmount, currency: invoice.currency, paymentMethod: invoice.paymentMethod });
    if (typeof transaction.insertAudit === 'function') transaction.insertAudit({ actionCode: 'POST_INVOICE', entityType: 'INVOICE', entityId: savedInvoice.invoiceId, afterValue: invoice });
    transaction.commit();
    return { invoice: savedInvoice, journal: savedJournal, stockMovements, paymentAmount: invoice.paidAmount };
  } catch (error) {
    if (typeof transaction.rollback === 'function') transaction.rollback();
    throw error;
  }
}

function buildTrialBalance(journals = [], options = {}) {
  const balances = new Map();
  for (const journal of journals) {
    if (options.fromDate && String(journal.date || '').slice(0, 10) < String(options.fromDate).slice(0, 10)) continue;
    if (options.toDate && String(journal.date || '').slice(0, 10) > String(options.toDate).slice(0, 10)) continue;
    for (const line of journal.lines || []) {
      const code = String(line.accountCode || line.accountId || '').trim();
      if (!code) continue;
      const current = balances.get(code) || { accountCode: code, debit: 0, credit: 0 };
      current.debit += Number(line.debit || 0); current.credit += Number(line.credit || 0);
      balances.set(code, current);
    }
  }
  const rows = [...balances.values()].map(row => ({ ...row, balance: row.debit - row.credit }));
  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);
  return { rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) <= EPSILON };
}

function buildAccountStatement(accountCodeValue, journals = []) {
  const code = String(accountCodeValue || '').trim();
  if (!code) throw new Error('الحساب مطلوب لإعداد كشف الحساب.');
  let runningBalance = 0;
  const rows = [];
  for (const journal of journals) for (const line of journal.lines || []) if (String(line.accountCode || line.accountId || '') === code) {
    const debit = Number(line.debit || 0); const credit = Number(line.credit || 0); runningBalance += debit - credit;
    rows.push({ date: journal.date || null, description: line.description || journal.description || '', debit, credit, balance: runningBalance, journalId: journal.journalId || null });
  }
  return { accountCode: code, rows, closingBalance: runningBalance };
}

module.exports = { buildInvoiceJournal, validatePeriodForPosting, postCommercialInvoice, buildTrialBalance, buildAccountStatement };
