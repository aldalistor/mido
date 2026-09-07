'use strict';

const EPSILON = 0.000001;
const TYPES = Object.freeze({ SALE: 'SALE', PURCHASE: 'PURCHASE', SALES_RETURN: 'SALES_RETURN', PURCHASE_RETURN: 'PURCHASE_RETURN' });
const PAYMENT_METHODS = Object.freeze({ CASH: 'CASH', CREDIT: 'CREDIT', PARTIAL: 'PARTIAL' });

function nonNegative(value, label) {
  const number = Number(value == null || value === '' ? 0 : value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label} غير صالح.`);
  return number;
}

function positive(value, label) {
  const number = nonNegative(value, label);
  if (number <= EPSILON) throw new Error(`${label} يجب أن يكون أكبر من صفر.`);
  return number;
}

function calculateInvoice(payload = {}) {
  const type = String(payload.type || '').toUpperCase();
  if (!Object.values(TYPES).includes(type)) throw new Error('نوع الفاتورة غير مدعوم.');
  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  if (!lines.length) throw new Error('الفاتورة تحتاج إلى صنف واحد على الأقل.');
  const normalized = lines.map((line, index) => {
    const itemCode = String(line.itemCode || '').trim();
    if (!itemCode) throw new Error(`الصنف مطلوب في السطر ${index + 1}.`);
    const quantity = positive(line.quantity, `كمية السطر ${index + 1}`);
    const unitPrice = nonNegative(line.unitPrice, `سعر السطر ${index + 1}`);
    const discount = nonNegative(line.discountAmount, `خصم السطر ${index + 1}`);
    const gross = quantity * unitPrice;
    if (discount - gross > EPSILON) throw new Error(`خصم السطر ${index + 1} لا يمكن أن يتجاوز إجماليه.`);
    const net = gross - discount;
    return { itemCode, quantity, unitPrice, discountAmount: discount, netAmount: net, unitCost: nonNegative(line.unitCost, `تكلفة السطر ${index + 1}`) };
  });
  const subtotal = normalized.reduce((sum, line) => sum + line.netAmount, 0);
  const invoiceDiscount = nonNegative(payload.discountAmount, 'خصم الفاتورة');
  if (invoiceDiscount - subtotal > EPSILON) throw new Error('خصم الفاتورة لا يمكن أن يتجاوز صافي الفاتورة.');
  const taxableAmount = subtotal - invoiceDiscount;
  const taxRate = nonNegative(payload.taxRate, 'نسبة الضريبة');
  const taxAmount = payload.taxAmount == null ? taxableAmount * taxRate / 100 : nonNegative(payload.taxAmount, 'الضريبة');
  const total = taxableAmount + taxAmount;
  const paymentMethod = String(payload.paymentMethod || PAYMENT_METHODS.CREDIT).toUpperCase();
  if (!Object.values(PAYMENT_METHODS).includes(paymentMethod)) throw new Error('طريقة الدفع غير مدعومة.');
  const paidAmount = payload.paidAmount == null ? (paymentMethod === PAYMENT_METHODS.CASH ? total : 0) : nonNegative(payload.paidAmount, 'المبلغ المدفوع');
  if (paidAmount - total > EPSILON) throw new Error('المبلغ المدفوع لا يمكن أن يتجاوز الإجمالي.');
  if (paymentMethod === PAYMENT_METHODS.CREDIT && paidAmount > EPSILON) throw new Error('استخدم طريقة الدفع الجزئي عند تسجيل دفعة جزئية.');
  if (paymentMethod === PAYMENT_METHODS.CASH && Math.abs(paidAmount - total) > EPSILON) throw new Error('الفاتورة النقدية يجب أن تكون مدفوعة بالكامل.');
  const costTotal = normalized.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
  return { type, lines: normalized, subtotal, invoiceDiscount, taxableAmount, taxRate, taxAmount, total, paymentMethod, paidAmount, outstandingAmount: total - paidAmount, costTotal, currency: String(payload.currency || 'YER').toUpperCase() };
}

function buildReturn(original, returnedLines, type) {
  if (!original || ![TYPES.SALE, TYPES.PURCHASE].includes(original.type)) throw new Error('الفاتورة الأصلية غير صالحة للمرتجع.');
  const returnType = type || (original.type === TYPES.SALE ? TYPES.SALES_RETURN : TYPES.PURCHASE_RETURN);
  const quantities = new Map((original.lines || []).map(line => [line.itemCode, line.quantity]));
  for (const line of returnedLines || []) {
    const quantity = positive(line.quantity, 'كمية المرتجع');
    if (!quantities.has(line.itemCode) || quantity - quantities.get(line.itemCode) > EPSILON) throw new Error(`كمية المرتجع تتجاوز الفاتورة للصنف ${line.itemCode}.`);
  }
  return calculateInvoice({ type: returnType, paymentMethod: PAYMENT_METHODS.CREDIT, lines: returnedLines.map(line => ({ ...line, unitPrice: line.unitPrice == null ? original.lines.find(item => item.itemCode === line.itemCode).unitPrice : line.unitPrice, unitCost: line.unitCost == null ? original.lines.find(item => item.itemCode === line.itemCode).unitCost : line.unitCost })) });
}

module.exports = { EPSILON, TYPES, PAYMENT_METHODS, calculateInvoice, buildReturn };
