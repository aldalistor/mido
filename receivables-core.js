'use strict';

const PAYMENT_TYPES = Object.freeze({ RECEIPT: 'RECEIPT', PAYMENT: 'PAYMENT' });
const EPSILON = 0.000001;

function positive(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${name} يجب أن يكون أكبر من صفر.`);
  return Math.round(number * 1000) / 1000;
}

function buildPayment(payload = {}) {
  const paymentType = String(payload.paymentType || '').toUpperCase();
  if (!Object.values(PAYMENT_TYPES).includes(paymentType)) throw new Error('نوع الدفعة غير صالح.');
  const allocations = Array.isArray(payload.allocations) ? payload.allocations.map(item => ({
    invoiceNo: String(item.invoiceNo || '').trim(),
    amount: positive(item.amount, 'مبلغ التخصيص'),
  })).filter(item => item.invoiceNo) : [];
  const amount = positive(payload.amount, 'مبلغ الدفعة');
  const allocatedAmount = allocations.reduce((sum, item) => sum + item.amount, 0);
  if (allocatedAmount - amount > EPSILON) throw new Error('إجمالي التخصيصات أكبر من مبلغ الدفعة.');
  const duplicate = new Set();
  for (const allocation of allocations) {
    if (duplicate.has(allocation.invoiceNo)) throw new Error(`الفاتورة مكررة في التخصيص: ${allocation.invoiceNo}`);
    duplicate.add(allocation.invoiceNo);
  }
  return Object.freeze({
    paymentType,
    paymentNo: String(payload.paymentNo || '').trim() || `${paymentType.slice(0, 3)}-${Date.now()}`,
    contactCode: String(payload.contactCode || '').trim(),
    cashAccountCode: String(payload.cashAccountCode || '').trim(),
    paymentDate: String(payload.paymentDate || new Date().toISOString().slice(0, 10)),
    description: String(payload.description || '').trim(),
    amount,
    allocations: Object.freeze(allocations),
    unappliedAmount: Math.round((amount - allocatedAmount) * 1000) / 1000,
  });
}

function agingBucket(dueDate, asOfDate) {
  if (!dueDate) return 'NOT_DUE_DATE';
  const due = new Date(`${String(dueDate).slice(0, 10)}T00:00:00Z`);
  const asOf = new Date(`${String(asOfDate).slice(0, 10)}T00:00:00Z`);
  const days = Math.floor((asOf - due) / 86400000);
  if (days <= 0) return 'CURRENT';
  if (days <= 30) return 'DAYS_1_30';
  if (days <= 60) return 'DAYS_31_60';
  if (days <= 90) return 'DAYS_61_90';
  return 'DAYS_90_PLUS';
}

module.exports = { PAYMENT_TYPES, buildPayment, agingBucket };
