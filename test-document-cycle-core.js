const assert = require('node:assert/strict');
const { TYPES, buildTradeDocument, validateTransition, validateFulfillment, stockEffect } = require('./document-cycle-core');

const order = buildTradeDocument({ documentType: TYPES.SALES_ORDER, documentNo: 'SO-1', lines: [{ itemCode: 'I-1', quantity: 5, unitPrice: 20, taxAmount: 2 }] });
assert.equal(order.subtotal, 100);
assert.equal(order.totalAmount, 102);
assert.equal(order.statusCode, 'DRAFT');
assert.equal(validateTransition('DRAFT', 'APPROVED'), true);
assert.throws(() => validateTransition('POSTED', 'DRAFT'), /لا يمكن نقل/);

const delivery = buildTradeDocument({ documentType: TYPES.DELIVERY_NOTE, sourceDocumentId: 1, lines: [{ itemCode: 'I-1', quantity: 3, unitPrice: 20 }] });
delivery.lines[0].fulfilledQuantity = 0;
assert.equal(validateFulfillment(order, delivery), true);
assert.equal(stockEffect(TYPES.DELIVERY_NOTE, 3), -3);
assert.equal(stockEffect(TYPES.PURCHASE_RETURN, 2), 2);
assert.throws(() => validateFulfillment(order, buildTradeDocument({ documentType: TYPES.DELIVERY_NOTE, lines: [{ itemCode: 'I-1', quantity: 6 }] })), /تتجاوز/);
assert.throws(() => buildTradeDocument({ documentType: TYPES.SALES_ORDER, lines: [] }), /بند واحد/);
console.log('document-cycle-core tests passed');
