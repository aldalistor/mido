'use strict';

const { validateJournal, EPSILON } = require('./accounting-core');

function amount(value, name) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${name} غير صالح.`);
  return number;
}

function positiveRate(value, name) {
  const number = Number(value == null ? 1 : value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${name} يجب أن يكون أكبر من صفر.`);
  return number;
}

function normalizeDate(value, name) {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error(`${name} غير صالح.`);
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) throw new Error(`${name} غير صالح.`);
  return raw;
}

function normalizePayment(payload, invoiceDate) {
  const method = String(payload.paymentMethod || 'CREDIT').trim().toUpperCase();
  const allowedMethods = new Set(['CASH', 'BANK', 'CARD', 'E_WALLET', 'CREDIT']);
  if (!allowedMethods.has(method)) throw new Error('طريقة الدفع غير مدعومة.');
  const paymentStatus = String(payload.paymentStatus || (method === 'CREDIT' ? 'UNPAID' : 'PAID')).trim().toUpperCase();
  if (!new Set(['PAID', 'PARTIAL', 'UNPAID']).has(paymentStatus)) throw new Error('حالة السداد غير مدعومة.');
  const dueDate = normalizeDate(payload.dueDate, 'تاريخ الاستحقاق');
  if (method === 'CREDIT' && dueDate && invoiceDate && dueDate < invoiceDate) throw new Error('تاريخ الاستحقاق لا يسبق تاريخ الفاتورة.');
  if (paymentStatus === 'PAID' && method === 'CREDIT') throw new Error('الفاتورة الائتمانية لا تكون مدفوعة بالكامل دون تحديد طريقة سداد.');
  return { paymentMethod: method, paymentStatus, dueDate, paidAmount: amount(payload.paidAmount, 'المبلغ المسدد') };
}

function resolveLine(line, index) {
  const quantity = amount(line.quantity, `كمية السطر ${index + 1}`);
  const unitPrice = amount(line.unitPrice, `سعر السطر ${index + 1}`);
  const unitCost = amount(line.unitCost == null ? line.costPrice : line.unitCost, `تكلفة السطر ${index + 1}`);
  const discountPercent = amount(line.discountPercent, `نسبة خصم السطر ${index + 1}`);
  if (discountPercent > 100) throw new Error(`نسبة خصم السطر ${index + 1} لا تتجاوز 100%.`);
  if (quantity <= EPSILON) throw new Error(`كمية السطر ${index + 1} يجب أن تكون أكبر من صفر.`);
  if (!String(line.itemCode || '').trim()) throw new Error(`الصنف مطلوب في السطر ${index + 1}.`);
  const grossTotal = quantity * unitPrice;
  const requestedDiscount = amount(line.discountAmount, `خصم السطر ${index + 1}`);
  const discountAmount = requestedDiscount > EPSILON ? requestedDiscount : grossTotal * discountPercent / 100;
  if (discountAmount - grossTotal > EPSILON) throw new Error(`خصم السطر ${index + 1} لا يتجاوز إجماليه.`);
  const netTotal = grossTotal - discountAmount;
  const taxAmount = amount(line.taxAmount, `ضريبة السطر ${index + 1}`);
  return {
    itemCode: String(line.itemCode).trim(),
    description: String(line.description || '').trim(),
    quantity,
    unitPrice,
    unitCost,
    grossTotal,
    discountPercent,
    discountAmount,
    lineTotal: netTotal,
    taxAmount,
    costTotal: quantity * unitCost,
  };
}

function buildInvoicePosting(payload = {}) {
  const type = payload.type === 'PURCHASE' ? 'PURCHASE' : 'SALE';
  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  if (!lines.length) throw new Error('الفاتورة تحتاج إلى صنف واحد على الأقل.');
  const resolved = lines.map(resolveLine);
  const invoiceDate = normalizeDate(payload.invoiceDate, 'تاريخ الفاتورة');
  const payment = normalizePayment(payload, invoiceDate);
  const subtotal = resolved.reduce((sum, line) => sum + line.lineTotal, 0);
  const lineTax = resolved.reduce((sum, line) => sum + line.taxAmount, 0);
  const tax = lineTax + amount(payload.taxAmount, 'الضريبة');
  const discountTotal = resolved.reduce((sum, line) => sum + line.discountAmount, 0) + amount(payload.discountAmount, 'الخصم العام');
  const total = subtotal + tax - amount(payload.discountAmount, 'الخصم العام');
  if (total < -EPSILON) throw new Error('إجمالي الفاتورة لا يمكن أن يكون سالبًا.');
  const costTotal = resolved.reduce((sum, line) => sum + line.costTotal, 0);
  const partyAccount = payload.partyAccountCode || (type === 'SALE' ? '1201' : '2101');
  const cashAccount = payload.paymentAccountCode || '1101';
  const inventoryAccount = payload.inventoryAccountCode || '1301';
  const revenueAccount = payload.revenueAccountCode || '4101';
  const cogsAccount = payload.cogsAccountCode || '5102';
  const taxAccount = payload.taxAccountCode || '2201';
  const debitAccount = payment.paymentStatus === 'PAID' ? cashAccount : partyAccount;
  const journalLines = [];
  if (type === 'SALE') {
    journalLines.push({ accountCode: debitAccount, debit: total, credit: 0, description: payment.paymentStatus === 'PAID' ? 'تحصيل فاتورة مبيعات' : 'ذمم العميل من فاتورة مبيعات' });
    journalLines.push({ accountCode: revenueAccount, debit: 0, credit: subtotal - amount(payload.discountAmount, 'الخصم العام'), description: 'إيراد المبيعات بعد الخصم' });
    if (tax > EPSILON) journalLines.push({ accountCode: taxAccount, debit: 0, credit: tax, description: 'ضريبة المبيعات' });
    journalLines.push({ accountCode: cogsAccount, debit: costTotal, credit: 0, description: 'تكلفة البضاعة المباعة' });
    journalLines.push({ accountCode: inventoryAccount, debit: 0, credit: costTotal, description: 'إخراج البضاعة من المخزون' });
  } else {
    journalLines.push({ accountCode: inventoryAccount, debit: subtotal - amount(payload.discountAmount, 'الخصم العام'), credit: 0, description: 'إدخال المشتريات إلى المخزون بعد الخصم' });
    if (tax > EPSILON) journalLines.push({ accountCode: taxAccount, debit: tax, credit: 0, description: 'ضريبة المشتريات' });
    journalLines.push({ accountCode: payment.paymentStatus === 'PAID' ? cashAccount : partyAccount, debit: 0, credit: total, description: payment.paymentStatus === 'PAID' ? 'سداد فاتورة مشتريات' : 'ذمم المورد من فاتورة مشتريات' });
  }
  const journal = validateJournal({ description: payload.description || (type === 'SALE' ? 'ترحيل فاتورة مبيعات' : 'ترحيل فاتورة مشتريات'), source: type === 'SALE' ? 'SALE_INVOICE' : 'PURCHASE_INVOICE', currency: payload.currency || 'SAR', lines: journalLines });
  const stockMovements = resolved.map(line => ({ itemCode: line.itemCode, quantity: type === 'SALE' ? -line.quantity : line.quantity, unitCost: type === 'SALE' ? line.unitCost : line.unitPrice, movementType: type === 'SALE' ? 'SALE' : 'PURCHASE' }));
  return { type, invoiceDate, payment, lines: resolved, subtotal, discountTotal, tax, total, costTotal, currency: payload.currency || 'SAR', exchangeRate: positiveRate(payload.exchangeRate, 'سعر الصرف'), journal, stockMovements };
}

function postInvoice(repository, payload) {
  const posting = buildInvoicePosting(payload);
  if (!repository || typeof repository.begin !== 'function') throw new Error('مستودع الفاتورة غير مهيأ.');
  const transaction = repository.begin();
  try {
    const invoice = transaction.insertInvoice({ ...payload, status: 'POSTED', invoiceDate: posting.invoiceDate, paymentMethod: posting.payment.paymentMethod, paymentStatus: posting.payment.paymentStatus, dueDate: posting.payment.dueDate, paidAmount: posting.payment.paidAmount, subtotal: posting.subtotal, discountTotal: posting.discountTotal, tax: posting.tax, total: posting.total, currency: posting.currency, exchangeRate: posting.exchangeRate });
    const journal = transaction.insertJournal(posting.journal);
    for (const movement of posting.stockMovements) transaction.insertStockMovement({ ...movement, invoiceId: invoice.invoiceId });
    transaction.commit();
    return { invoice, journal, stockMovements: posting.stockMovements, total: posting.total };
  } catch (error) {
    if (typeof transaction.rollback === 'function') transaction.rollback();
    throw error;
  }
}

module.exports = { buildInvoicePosting, postInvoice, normalizeDate, normalizePayment };
