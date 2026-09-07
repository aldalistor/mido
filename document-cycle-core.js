const TYPES = Object.freeze({
  SALES_ORDER: 'SALES_ORDER',
  PURCHASE_ORDER: 'PURCHASE_ORDER',
  DELIVERY_NOTE: 'DELIVERY_NOTE',
  RECEIPT_NOTE: 'RECEIPT_NOTE',
  SALES_INVOICE: 'SALES_INVOICE',
  PURCHASE_INVOICE: 'PURCHASE_INVOICE',
  SALES_RETURN: 'SALES_RETURN',
  PURCHASE_RETURN: 'PURCHASE_RETURN'
});

const TRANSITIONS = Object.freeze({
  DRAFT: ['APPROVED', 'VOID'],
  APPROVED: ['PARTIALLY_FULFILLED', 'FULFILLED', 'POSTED', 'VOID'],
  PARTIALLY_FULFILLED: ['PARTIALLY_FULFILLED', 'FULFILLED', 'VOID'],
  FULFILLED: ['POSTED', 'VOID'],
  POSTED: ['RETURNED'],
  RETURNED: [],
  VOID: []
});

const FULFILLED_TYPES = new Set([TYPES.SALES_ORDER, TYPES.PURCHASE_ORDER]);
const STOCK_TYPES = new Set([TYPES.DELIVERY_NOTE, TYPES.RECEIPT_NOTE, TYPES.SALES_RETURN, TYPES.PURCHASE_RETURN]);

function positive(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} يجب أن يكون أكبر من صفر.`);
  return number;
}

function validateDocumentType(type) {
  if (!Object.values(TYPES).includes(type)) throw new Error(`نوع المستند غير مدعوم: ${type}`);
  return type;
}

function validateTransition(current, next) {
  const allowed = TRANSITIONS[current] || [];
  if (!allowed.includes(next)) throw new Error(`لا يمكن نقل المستند من ${current} إلى ${next}.`);
  return true;
}

function normalizeLines(lines = []) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error('المستند يحتاج إلى بند واحد على الأقل.');
  return lines.map((line, index) => ({
    itemCode: String(line.itemCode || '').trim() || (() => { throw new Error(`الصنف مطلوب في السطر ${index + 1}.`); })(),
    quantity: positive(line.quantity, `كمية السطر ${index + 1}`),
    unitPrice: Math.max(0, Number(line.unitPrice || 0)),
    taxAmount: Math.max(0, Number(line.taxAmount || 0)),
    sourceLineId: line.sourceLineId == null ? null : Number(line.sourceLineId)
  }));
}

function buildTradeDocument(payload = {}) {
  const type = validateDocumentType(payload.documentType);
  const lines = normalizeLines(payload.lines);
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const taxAmount = lines.reduce((sum, line) => sum + line.taxAmount, 0);
  return {
    documentType: type,
    statusCode: payload.statusCode || 'DRAFT',
    documentNo: String(payload.documentNo || '').trim(),
    contactCode: payload.contactCode ? String(payload.contactCode).trim() : null,
    warehouseCode: payload.warehouseCode ? String(payload.warehouseCode).trim() : null,
    sourceDocumentId: payload.sourceDocumentId == null ? null : Number(payload.sourceDocumentId),
    currencyCode: payload.currencyCode || 'SAR',
    exchangeRate: Number(payload.exchangeRate || 1),
    lines,
    subtotal,
    taxAmount,
    totalAmount: subtotal + taxAmount
  };
}

function validateFulfillment(source, child) {
  if (!source || !child) throw new Error('المستند المصدر والتابع مطلوبان.');
  if (!FULFILLED_TYPES.has(source.documentType)) throw new Error('نوع المستند المصدر لا يسمح بالتنفيذ الجزئي.');
  const sourceByItem = new Map((source.lines || []).map(line => [line.itemCode, Number(line.quantity)]));
  for (const line of child.lines || []) {
    const ordered = sourceByItem.get(line.itemCode) || 0;
    const fulfilled = Number(line.fulfilledQuantity || 0);
    if (Number(line.quantity) + fulfilled > ordered) throw new Error(`الكمية المنفذة تتجاوز الكمية الأصلية للصنف ${line.itemCode}.`);
  }
  return true;
}

function stockEffect(documentType, quantity) {
  const value = positive(quantity, 'الكمية');
  if (!STOCK_TYPES.has(documentType)) return 0;
  return [TYPES.DELIVERY_NOTE, TYPES.SALES_RETURN].includes(documentType) ? -value : value;
}

module.exports = { TYPES, TRANSITIONS, FULFILLED_TYPES, STOCK_TYPES, validateTransition, normalizeLines, buildTradeDocument, validateFulfillment, stockEffect };
