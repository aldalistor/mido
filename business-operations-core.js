'use strict';

const EPSILON = 0.000001;
const MOVEMENT_TYPES = Object.freeze({ PURCHASE: 'PURCHASE', SALE: 'SALE', SALES_RETURN: 'SALES_RETURN', PURCHASE_RETURN: 'PURCHASE_RETURN', ADJUSTMENT_IN: 'ADJUSTMENT_IN', ADJUSTMENT_OUT: 'ADJUSTMENT_OUT', TRANSFER_OUT: 'TRANSFER_OUT', TRANSFER_IN: 'TRANSFER_IN' });
const VOUCHER_TYPES = Object.freeze({ RECEIPT: 'RECEIPT', PAYMENT: 'PAYMENT', TRANSFER: 'TRANSFER' });

function amount(value, label, allowNegative = false) {
  const result = Number(value == null || value === '' ? 0 : value);
  if (!Number.isFinite(result) || (!allowNegative && result < 0)) throw new Error(`${label} غير صالح.`);
  return result;
}
function required(value, label) { const text = String(value || '').trim(); if (!text) throw new Error(`${label} مطلوب.`); return text; }

function buildStockMovement(payload = {}) {
  const type = String(payload.movementType || '').toUpperCase();
  if (!Object.values(MOVEMENT_TYPES).includes(type)) throw new Error('نوع حركة المخزون غير مدعوم.');
  const quantity = amount(payload.quantity, 'كمية الحركة');
  if (quantity <= EPSILON) throw new Error('كمية الحركة يجب أن تكون أكبر من صفر.');
  const sign = [MOVEMENT_TYPES.SALE, MOVEMENT_TYPES.PURCHASE_RETURN, MOVEMENT_TYPES.ADJUSTMENT_OUT, MOVEMENT_TYPES.TRANSFER_OUT].includes(type) ? -1 : 1;
  const unitCost = amount(payload.unitCost, 'تكلفة الوحدة');
  const movement = { itemCode: required(payload.itemCode, 'الصنف'), warehouseCode: required(payload.warehouseCode, 'المستودع'), movementType: type, quantity, signedQuantity: sign * quantity, unitCost, totalCost: quantity * unitCost, referenceType: payload.referenceType ? String(payload.referenceType) : null, referenceId: payload.referenceId == null ? null : String(payload.referenceId) };
  if (payload.availableQuantity != null && movement.signedQuantity < 0 && Number(payload.availableQuantity) + movement.signedQuantity < -EPSILON) throw new Error(`الرصيد المخزني غير كاف للصنف ${movement.itemCode}.`);
  return movement;
}

function buildStockTransfer(payload = {}) {
  if (String(payload.fromWarehouseCode || '').trim() === String(payload.toWarehouseCode || '').trim()) throw new Error('المستودع المصدر والوجهة يجب أن يكونا مختلفين.');
  const quantity = amount(payload.quantity, 'كمية التحويل');
  const common = { itemCode: payload.itemCode, unitCost: payload.unitCost, referenceType: 'STOCK_TRANSFER', referenceId: payload.transferId };
  return { transferId: payload.transferId || null, from: buildStockMovement({ ...common, warehouseCode: payload.fromWarehouseCode, movementType: MOVEMENT_TYPES.TRANSFER_OUT, quantity, availableQuantity: payload.availableQuantity }), to: buildStockMovement({ ...common, warehouseCode: payload.toWarehouseCode, movementType: MOVEMENT_TYPES.TRANSFER_IN, quantity }) };
}

function buildVoucher(payload = {}) {
  const type = String(payload.voucherType || '').toUpperCase();
  if (!Object.values(VOUCHER_TYPES).includes(type)) throw new Error('نوع السند غير مدعوم.');
  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  if (!lines.length) throw new Error('السند يحتاج إلى سطر واحد على الأقل.');
  const normalized = lines.map((line, index) => ({ accountCode: required(line.accountCode, `الحساب في السطر ${index + 1}`), description: String(line.description || '').trim(), amount: amount(line.amount, `مبلغ السطر ${index + 1}`) })).filter(line => line.amount > EPSILON);
  const total = normalized.reduce((sum, line) => sum + line.amount, 0);
  if (total <= EPSILON) throw new Error('إجمالي السند يجب أن يكون أكبر من صفر.');
  const cashAccount = required(payload.cashAccountCode, 'حساب الصندوق أو البنك');
  const debit = type === VOUCHER_TYPES.RECEIPT ? [{ accountCode: cashAccount, amount: total, description: 'استلام نقدي أو بنكي' }] : [{ accountCode: cashAccount, amount: total, description: 'صرف نقدي أو بنكي' }];
  const credit = type === VOUCHER_TYPES.RECEIPT ? normalized : normalized;
  const journalLines = type === VOUCHER_TYPES.RECEIPT ? [...debit.map(line => ({ ...line, debit: line.amount, credit: 0 })), ...credit.map(line => ({ ...line, debit: 0, credit: line.amount }))] : [...credit.map(line => ({ ...line, debit: 0, credit: line.amount })), ...debit.map(line => ({ ...line, debit: line.amount, credit: 0 }))];
  return { voucherType: type, voucherNo: payload.voucherNo ? String(payload.voucherNo) : null, cashAccountCode: cashAccount, total, lines: normalized, journal: { description: payload.description || (type === VOUCHER_TYPES.RECEIPT ? 'سند قبض' : 'سند صرف'), source: `${type}_VOUCHER`, totalDebit: total, totalCredit: total, lines: journalLines } };
}

function buildExpense(payload = {}) {
  const total = amount(payload.amount, 'مبلغ المصروف');
  if (total <= EPSILON) throw new Error('مبلغ المصروف يجب أن يكون أكبر من صفر.');
  const cashAccount = required(payload.cashAccountCode, 'حساب الصندوق أو البنك');
  const expenseAccount = required(payload.expenseAccountCode, 'حساب المصروف');
  return { type: 'EXPENSE', description: required(payload.description, 'بيان المصروف'), total, journal: { source: 'EXPENSE', description: payload.description, totalDebit: total, totalCredit: total, lines: [{ accountCode: expenseAccount, debit: total, credit: 0, description: payload.description }, { accountCode: cashAccount, debit: 0, credit: total, description: 'دفع المصروف' }] } };
}

function buildIncome(payload = {}) {
  const total = amount(payload.amount, 'مبلغ الإيراد');
  if (total <= EPSILON) throw new Error('مبلغ الإيراد يجب أن يكون أكبر من صفر.');
  const cashAccount = required(payload.cashAccountCode, 'حساب الصندوق أو البنك');
  const incomeAccount = required(payload.incomeAccountCode, 'حساب الإيراد');
  return { type: 'INCOME', description: required(payload.description, 'بيان الإيراد'), total, journal: { source: 'INCOME', description: payload.description, totalDebit: total, totalCredit: total, lines: [{ accountCode: cashAccount, debit: total, credit: 0, description: 'تحصيل الإيراد' }, { accountCode: incomeAccount, debit: 0, credit: total, description: payload.description }] } };
}

function registerAsset(payload = {}) {
  const cost = amount(payload.cost, 'تكلفة الأصل');
  if (cost <= EPSILON) throw new Error('تكلفة الأصل يجب أن تكون أكبر من صفر.');
  const usefulLifeMonths = Math.floor(amount(payload.usefulLifeMonths, 'العمر الإنتاجي بالأشهر'));
  if (usefulLifeMonths <= 0) throw new Error('العمر الإنتاجي يجب أن يكون أكبر من صفر.');
  const salvageValue = amount(payload.salvageValue, 'القيمة التخريدية');
  if (salvageValue > cost) throw new Error('القيمة التخريدية لا يمكن أن تتجاوز التكلفة.');
  return { assetCode: required(payload.assetCode, 'رمز الأصل'), name: required(payload.name, 'اسم الأصل'), cost, salvageValue, usefulLifeMonths, monthlyDepreciation: (cost - salvageValue) / usefulLifeMonths, assetAccountCode: required(payload.assetAccountCode, 'حساب الأصل'), cashAccountCode: required(payload.cashAccountCode, 'حساب الدفع') };
}

function calculateDepreciation(asset, months = 1) {
  const count = Math.floor(amount(months, 'عدد أشهر الإهلاك'));
  if (!asset || count <= 0) throw new Error('الأصل وعدد الأشهر مطلوبان.');
  const accumulatedBefore = amount(asset.accumulatedDepreciation, 'الإهلاك المتراكم');
  const depreciable = Math.max(0, Number(asset.cost) - Number(asset.salvageValue || 0) - accumulatedBefore);
  const expense = Math.min(depreciable, Number(asset.monthlyDepreciation) * count);
  return { assetCode: asset.assetCode, months: count, expense, accumulatedAfter: accumulatedBefore + expense, netBookValue: Number(asset.cost) - accumulatedBefore - expense, journal: { source: 'DEPRECIATION', description: `إهلاك الأصل ${asset.assetCode}`, totalDebit: expense, totalCredit: expense, lines: [{ accountCode: asset.depreciationExpenseAccountCode || '5203', debit: expense, credit: 0, description: 'مصروف إهلاك' }, { accountCode: asset.accumulatedDepreciationAccountCode || '1501', debit: 0, credit: expense, description: 'الإهلاك المتراكم' }] } };
}

module.exports = { EPSILON, MOVEMENT_TYPES, VOUCHER_TYPES, buildStockMovement, buildStockTransfer, buildVoucher, buildExpense, buildIncome, registerAsset, calculateDepreciation };
