'use strict';

const STATUSES = Object.freeze({ DRAFT: 'DRAFT', APPROVED: 'APPROVED', POSTED: 'POSTED', VOID: 'VOID' });
const TRANSITIONS = Object.freeze({
  APPROVE: [STATUSES.DRAFT, STATUSES.APPROVED],
  POST: [STATUSES.APPROVED, STATUSES.POSTED],
  VOID: [STATUSES.POSTED, STATUSES.VOID]
});

function transitionStatus(current, action) {
  const transition = TRANSITIONS[action];
  if (!transition || transition[0] !== current) throw new Error(`لا يمكن تنفيذ الإجراء ${action} على فاتورة بحالة ${current}.`);
  return transition[1];
}

function stockDelta(invoiceType, quantity, action) {
  const amount = Number(quantity || 0);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('كمية المخزون يجب أن تكون أكبر من صفر.');
  const sign = invoiceType === 'SALE' ? -1 : 1;
  return action === 'VOID' ? -sign * amount : sign * amount;
}

function validateInvoiceBalance(total, paid, outstanding) {
  const expected = Number(total || 0) - Number(paid || 0);
  if (Math.abs(expected - Number(outstanding || 0)) > 0.001) throw new Error('إجمالي الفاتورة لا يساوي المدفوع زائد المتبقي.');
  return true;
}

module.exports = { STATUSES, TRANSITIONS, transitionStatus, stockDelta, validateInvoiceBalance };
