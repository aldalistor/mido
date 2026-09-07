const { validateJournal, EPSILON } = require('./accounting-core');

function amount(value, name) { const n = Number(value || 0); if (!Number.isFinite(n) || n < 0) throw new Error(`${name} غير صالح.`); return n; }

function buildInvoicePosting(payload = {}) {
  const type = payload.type === 'PURCHASE' ? 'PURCHASE' : 'SALE';
  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  if (!lines.length) throw new Error('الفاتورة تحتاج إلى صنف واحد على الأقل.');
  const resolved = lines.map((line, index) => {
    const quantity = amount(line.quantity, `كمية السطر ${index + 1}`);
    const unitPrice = amount(line.unitPrice, `سعر السطر ${index + 1}`);
    const unitCost = amount(line.unitCost == null ? line.costPrice : line.unitCost, `تكلفة السطر ${index + 1}`);
    if (quantity <= EPSILON) throw new Error(`كمية السطر ${index + 1} يجب أن تكون أكبر من صفر.`);
    if (!String(line.itemCode || '').trim()) throw new Error(`الصنف مطلوب في السطر ${index + 1}.`);
    return { itemCode: String(line.itemCode).trim(), quantity, unitPrice, unitCost, lineTotal: quantity * unitPrice, costTotal: quantity * unitCost };
  });
  const subtotal = resolved.reduce((sum, line) => sum + line.lineTotal, 0);
  const costTotal = resolved.reduce((sum, line) => sum + line.costTotal, 0);
  const tax = amount(payload.taxAmount, 'الضريبة');
  const total = subtotal + tax;
  const partyAccount = payload.partyAccountCode || (type === 'SALE' ? '1201' : '2101');
  const inventoryAccount = payload.inventoryAccountCode || '1301';
  const revenueAccount = payload.revenueAccountCode || '4101';
  const cogsAccount = payload.cogsAccountCode || '5102';
  const taxAccount = payload.taxAccountCode || '2201';
  const journalLines = [];
  if (type === 'SALE') {
    journalLines.push({ accountCode: partyAccount, debit: total, credit: 0, description: 'ذمم العميل من فاتورة مبيعات' });
    journalLines.push({ accountCode: revenueAccount, debit: 0, credit: subtotal, description: 'إيراد المبيعات' });
    if (tax > EPSILON) journalLines.push({ accountCode: taxAccount, debit: 0, credit: tax, description: 'ضريبة المبيعات' });
    journalLines.push({ accountCode: cogsAccount, debit: costTotal, credit: 0, description: 'تكلفة البضاعة المباعة' });
    journalLines.push({ accountCode: inventoryAccount, debit: 0, credit: costTotal, description: 'إخراج البضاعة من المخزون' });
  } else {
    journalLines.push({ accountCode: inventoryAccount, debit: subtotal, credit: 0, description: 'إدخال المشتريات إلى المخزون' });
    if (tax > EPSILON) journalLines.push({ accountCode: taxAccount, debit: tax, credit: 0, description: 'ضريبة المشتريات' });
    journalLines.push({ accountCode: partyAccount, debit: 0, credit: total, description: 'ذمم المورد من فاتورة مشتريات' });
  }
  const journal = validateJournal({ description: payload.description || (type === 'SALE' ? 'ترحيل فاتورة مبيعات' : 'ترحيل فاتورة مشتريات'), source: type === 'SALE' ? 'SALE_INVOICE' : 'PURCHASE_INVOICE', currency: payload.currency || 'SAR', lines: journalLines });
  const stockMovements = resolved.map(line => ({ itemCode: line.itemCode, quantity: type === 'SALE' ? -line.quantity : line.quantity, unitCost: type === 'SALE' ? line.unitCost : line.unitPrice, movementType: type === 'SALE' ? 'SALE' : 'PURCHASE' }));
  return { type, lines: resolved, subtotal, tax, total, costTotal, journal, stockMovements };
}

function postInvoice(repository, payload) {
  const posting = buildInvoicePosting(payload);
  if (!repository || typeof repository.begin !== 'function') throw new Error('مستودع الفاتورة غير مهيأ.');
  const transaction = repository.begin();
  try {
    const invoice = transaction.insertInvoice({ ...payload, status: 'POSTED', subtotal: posting.subtotal, tax: posting.tax, total: posting.total });
    const journal = transaction.insertJournal(posting.journal);
    for (const movement of posting.stockMovements) transaction.insertStockMovement({ ...movement, invoiceId: invoice.invoiceId });
    transaction.commit();
    return { invoice, journal, stockMovements: posting.stockMovements, total: posting.total };
  } catch (error) { if (typeof transaction.rollback === 'function') transaction.rollback(); throw error; }
}

module.exports = { buildInvoicePosting, postInvoice };
