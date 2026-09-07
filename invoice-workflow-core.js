'use strict';

const STATUSES = Object.freeze({ DRAFT: 'DRAFT', PENDING_APPROVAL: 'PENDING_APPROVAL', APPROVED: 'APPROVED', POSTED: 'POSTED', PARTIALLY_PAID: 'PARTIALLY_PAID', PAID: 'PAID', RETURNED: 'RETURNED', VOID: 'VOID' });

function positive(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} يجب أن يكون أكبر من صفر.`);
  return number;
}

function transition(invoice, nextStatus, permissions = []) {
  const current = String(invoice?.status || STATUSES.DRAFT).toUpperCase();
  const next = String(nextStatus || '').toUpperCase();
  const allowed = { DRAFT: ['PENDING_APPROVAL', 'VOID'], PENDING_APPROVAL: ['APPROVED', 'VOID'], APPROVED: ['POSTED', 'VOID'], POSTED: ['PARTIALLY_PAID', 'PAID', 'RETURNED', 'VOID'], PARTIALLY_PAID: ['PAID', 'RETURNED'], PAID: ['RETURNED'], RETURNED: [], VOID: [] };
  if (!allowed[current]?.includes(next)) throw new Error(`لا يمكن نقل الفاتورة من ${current} إلى ${next}.`);
  const granted = new Set(permissions.map(value => String(value).toUpperCase()));
  if (next === STATUSES.PENDING_APPROVAL && !granted.has('SUBMIT_INVOICES') && !granted.has('ALL')) throw new Error('لا تملك صلاحية إرسال الفاتورة للاعتماد.');
  if (next === STATUSES.APPROVED && !granted.has('APPROVE_INVOICES') && !granted.has('ALL')) throw new Error('لا تملك صلاحية اعتماد الفاتورة.');
  if (next === STATUSES.POSTED && !granted.has('POST_JOURNALS') && !granted.has('ALL')) throw new Error('لا تملك صلاحية ترحيل الفاتورة.');
  return { ...invoice, status: next };
}

function recordPayment(invoice, payment, permissions = []) {
  const current = String(invoice?.status || '').toUpperCase();
  if (!['POSTED', 'PARTIALLY_PAID'].includes(current)) throw new Error('لا يمكن تسجيل دفعة قبل ترحيل الفاتورة.');
  if (!permissions.map(value => String(value).toUpperCase()).some(value => ['RECORD_PAYMENTS', 'ALL'].includes(value))) throw new Error('لا تملك صلاحية تسجيل الدفعات.');
  const total = positive(invoice.total, 'إجمالي الفاتورة');
  const alreadyPaid = Number(invoice.paidAmount || 0);
  const amount = positive(payment.amount, 'مبلغ الدفعة');
  if (alreadyPaid + amount > total + 0.0005) throw new Error('مجموع الدفعات يتجاوز إجمالي الفاتورة.');
  const paidAmount = alreadyPaid + amount;
  return { ...invoice, paidAmount, balanceDue: Math.max(0, total - paidAmount), status: paidAmount >= total - 0.0005 ? STATUSES.PAID : STATUSES.PARTIALLY_PAID, lastPayment: { amount, method: String(payment.method || 'CASH').toUpperCase(), reference: payment.reference ? String(payment.reference).trim() : null } };
}

function buildReturn(invoice, lines, permissions = []) {
  const current = String(invoice?.status || '').toUpperCase();
  if (!['POSTED', 'PARTIALLY_PAID', 'PAID'].includes(current)) throw new Error('لا يمكن إنشاء مرتجع قبل ترحيل الفاتورة.');
  if (!permissions.map(value => String(value).toUpperCase()).some(value => ['CREATE_RETURNS', 'ALL'].includes(value))) throw new Error('لا تملك صلاحية إنشاء المرتجعات.');
  const sourceLines = new Map((invoice.lines || []).map(line => [String(line.itemCode), Number(line.quantity)]));
  const returnedLines = (Array.isArray(lines) ? lines : []).map(line => {
    const quantity = positive(line.quantity, 'كمية المرتجع');
    const itemCode = String(line.itemCode || '').trim();
    if (!sourceLines.has(itemCode)) throw new Error(`الصنف غير موجود في الفاتورة: ${itemCode}`);
    if (quantity > sourceLines.get(itemCode)) throw new Error(`كمية المرتجع تتجاوز كمية الفاتورة للصنف ${itemCode}.`);
    return { itemCode, quantity, unitPrice: Number(line.unitPrice || 0), reason: String(line.reason || '').trim() };
  });
  if (!returnedLines.length) throw new Error('المرتجع يحتاج إلى صنف واحد على الأقل.');
  return { sourceInvoiceId: invoice.invoiceId, type: invoice.type === 'SALE' ? 'SALES_RETURN' : 'PURCHASE_RETURN', currency: invoice.currency || 'SAR', lines: returnedLines, status: STATUSES.DRAFT };
}

function isReadOnlyLicense(license) {
  return !license || license.valid !== true || new Date(`${license.expiresAt}T23:59:59.999Z`) < new Date();
}

module.exports = { STATUSES, transition, recordPayment, buildReturn, isReadOnlyLicense };
