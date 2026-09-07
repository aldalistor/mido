'use strict';
const assert = require('node:assert/strict');
const { calculateInvoice } = require('./commercial-invoice-core');
const { buildStockMovement, MOVEMENT_TYPES } = require('./business-operations-core');

const purchase = calculateInvoice({ type: 'PURCHASE', currency: 'YER', paymentMethod: 'CREDIT', lines: [{ itemCode: 'I-001', quantity: 5, unitPrice: 100, unitCost: 100 }] });
assert.equal(purchase.total, 500);
const inbound = buildStockMovement({ itemCode: 'I-001', warehouseCode: 'WH-001', movementType: MOVEMENT_TYPES.PURCHASE, quantity: 5, unitCost: 100 });
assert.equal(inbound.signedQuantity, 5);
const sale = calculateInvoice({ type: 'SALE', currency: 'YER', paymentMethod: 'CASH', lines: [{ itemCode: 'I-001', quantity: 2, unitPrice: 150, unitCost: 100 }] });
assert.equal(sale.total, 300);
const outbound = buildStockMovement({ itemCode: 'I-001', warehouseCode: 'WH-001', movementType: MOVEMENT_TYPES.SALE, quantity: 2, unitCost: 100, availableQuantity: 5 });
assert.equal(outbound.signedQuantity, -2);
assert.throws(() => buildStockMovement({ itemCode: 'I-001', warehouseCode: 'WH-001', movementType: MOVEMENT_TYPES.SALE, quantity: 6, unitCost: 100, availableQuantity: 5 }), /غير كاف/);
console.log('stage7 inventory and invoice tests passed');
