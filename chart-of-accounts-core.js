'use strict';

const ACCOUNT_TYPES = Object.freeze({ ASSET: 'ASSET', LIABILITY: 'LIABILITY', EQUITY: 'EQUITY', REVENUE: 'REVENUE', EXPENSE: 'EXPENSE' });
const NORMAL_BALANCES = Object.freeze({ ASSET: 'DEBIT', LIABILITY: 'CREDIT', EQUITY: 'CREDIT', REVENUE: 'CREDIT', EXPENSE: 'DEBIT' });

function normalizeAccount(account = {}) {
  const code = String(account.code || '').trim();
  const name = String(account.name || '').trim();
  const type = String(account.type || '').toUpperCase();
  if (!/^\d{2,20}$/.test(code)) throw new Error('رمز الحساب يجب أن يتكون من أرقام فقط وبطول لا يقل عن رقمين.');
  if (!name) throw new Error(`اسم الحساب ${code} مطلوب.`);
  if (!Object.values(ACCOUNT_TYPES).includes(type)) throw new Error(`نوع الحساب غير مدعوم: ${type}.`);
  const parentCode = account.parentCode == null || account.parentCode === '' ? null : String(account.parentCode).trim();
  if (parentCode === code) throw new Error(`الحساب ${code} لا يمكن أن يكون أبًا لنفسه.`);
  return { code, name, nameEn: account.nameEn ? String(account.nameEn).trim() : null, type, parentCode, isPostable: account.isPostable !== false, normalBalance: NORMAL_BALANCES[type], active: account.active !== false };
}

function validateChart(accounts = []) {
  if (!Array.isArray(accounts) || !accounts.length) throw new Error('دليل الحسابات لا يمكن أن يكون فارغًا.');
  const normalized = accounts.map(normalizeAccount);
  const byCode = new Map();
  for (const account of normalized) {
    if (byCode.has(account.code)) throw new Error(`رمز الحساب مكرر: ${account.code}.`);
    byCode.set(account.code, account);
  }
  for (const account of normalized) if (account.parentCode && !byCode.has(account.parentCode)) throw new Error(`الأب ${account.parentCode} غير موجود للحساب ${account.code}.`);
  for (const account of normalized) {
    const seen = new Set([account.code]);
    let current = account;
    while (current.parentCode) {
      if (seen.has(current.parentCode)) throw new Error(`حلقة في تسلسل الحساب ${account.code}.`);
      seen.add(current.parentCode);
      current = byCode.get(current.parentCode);
    }
  }
  const parentCodes = new Set(normalized.map(account => account.parentCode).filter(Boolean));
  for (const account of normalized) if (parentCodes.has(account.code) && account.isPostable) throw new Error(`الحساب التجميعي ${account.code} لا يجب أن يكون قابلاً للترحيل.`);
  return normalized;
}

function addAccount(accounts, account) {
  return validateChart([...(accounts || []), account]);
}

function buildDefaultChart() {
  return validateChart([
    { code: '11', name: 'الأصول', type: 'ASSET', isPostable: false },
    { code: '1101', name: 'الصندوق الرئيسي', type: 'ASSET', parentCode: '11' },
    { code: '1102', name: 'البنوك', type: 'ASSET', parentCode: '11' },
    { code: '1201', name: 'العملاء', type: 'ASSET', parentCode: '11' },
    { code: '1301', name: 'المخزون', type: 'ASSET', parentCode: '11' },
    { code: '21', name: 'الالتزامات', type: 'LIABILITY', isPostable: false },
    { code: '2101', name: 'الموردون', type: 'LIABILITY', parentCode: '21' },
    { code: '2201', name: 'ضريبة القيمة المضافة', type: 'LIABILITY', parentCode: '21' },
    { code: '31', name: 'حقوق الملكية', type: 'EQUITY', isPostable: false },
    { code: '3101', name: 'رأس المال', type: 'EQUITY', parentCode: '31' },
    { code: '3201', name: 'الأرباح المحتجزة', type: 'EQUITY', parentCode: '31' },
    { code: '41', name: 'الإيرادات', type: 'REVENUE', isPostable: false },
    { code: '4101', name: 'مبيعات البضائع', type: 'REVENUE', parentCode: '41' },
    { code: '51', name: 'تكلفة المبيعات', type: 'EXPENSE', isPostable: false },
    { code: '5102', name: 'تكلفة البضاعة المباعة', type: 'EXPENSE', parentCode: '51' },
    { code: '52', name: 'المصروفات التشغيلية', type: 'EXPENSE', isPostable: false },
    { code: '5201', name: 'مصروفات عمومية وإدارية', type: 'EXPENSE', parentCode: '52' },
    { code: '5202', name: 'مصروفات نقل وشحن', type: 'EXPENSE', parentCode: '52' }
  ]);
}

function getChildren(accounts, parentCode) { return validateChart(accounts).filter(account => account.parentCode === String(parentCode)); }
function getPostableAccounts(accounts) { return validateChart(accounts).filter(account => account.isPostable && account.active); }

module.exports = { ACCOUNT_TYPES, NORMAL_BALANCES, normalizeAccount, validateChart, addAccount, buildDefaultChart, getChildren, getPostableAccounts };
