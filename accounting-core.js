const EPSILON = 0.000001;

function number(value, field) {
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error(`${field || 'القيمة'} يجب أن تكون رقمية.`);
  return result;
}

function normalizeLine(line, index) {
  const debit = number(line.debit || 0, `مدين السطر ${index + 1}`);
  const credit = number(line.credit || 0, `دائن السطر ${index + 1}`);
  if (debit < 0 || credit < 0) throw new Error(`لا يسمح بقيم سالبة في السطر ${index + 1}.`);
  if (debit > EPSILON && credit > EPSILON) throw new Error(`السطر ${index + 1} لا يمكن أن يكون مديناً ودائناً معاً.`);
  if (debit <= EPSILON && credit <= EPSILON) throw new Error(`السطر ${index + 1} يجب أن يحتوي على مبلغ.`);
  const accountCode = String(line.accountCode || '').trim();
  const accountId = line.accountId == null ? null : number(line.accountId, `معرف الحساب ${index + 1}`);
  if (!accountCode && !accountId) throw new Error(`الحساب مطلوب في السطر ${index + 1}.`);
  return { accountCode: accountCode || null, accountId, description: String(line.description || '').trim(), debit, credit, currency: line.currency || null, foreignAmount: line.foreignAmount == null ? null : number(line.foreignAmount, `المبلغ الأجنبي ${index + 1}`), exchangeRate: line.exchangeRate == null ? null : number(line.exchangeRate, `سعر الصرف ${index + 1}`) };
}

function validateJournal(payload = {}) {
  const description = String(payload.description || '').trim();
  if (!description) throw new Error('بيان القيد مطلوب.');
  const rawLines = Array.isArray(payload.lines) ? payload.lines : [];
  if (rawLines.length < 2) throw new Error('القيد يحتاج إلى سطرين على الأقل.');
  const lines = rawLines.map(normalizeLine);
  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > EPSILON) throw new Error(`القيد غير متوازن: المدين ${totalDebit} والدائن ${totalCredit}.`);
  return { description, lines, totalDebit, totalCredit, currency: payload.currency || 'SAR', source: payload.source || 'MANUAL', status: payload.status || 'DRAFT' };
}

function postJournal(repository, payload = {}) {
  const journal = validateJournal({ ...payload, status: 'POSTED' });
  if (!repository || typeof repository.begin !== 'function') throw new Error('مستودع الترحيل غير مهيأ.');
  const transaction = repository.begin();
  try {
    const result = transaction.insertJournal(journal);
    transaction.commit();
    return { ...result, ...journal };
  } catch (error) {
    if (typeof transaction.rollback === 'function') transaction.rollback();
    throw error;
  }
}

function closeFiscalYear({ revenue = 0, expenses = 0, retainedEarningsAccount = '3201', date, openingYear }) {
  revenue = number(revenue, 'الإيرادات'); expenses = number(expenses, 'المصروفات');
  if (revenue < 0 || expenses < 0) throw new Error('لا يمكن أن تكون الإيرادات أو المصروفات سالبة.');
  const net = revenue - expenses;
  const lines = [
    { accountCode: '4101', debit: revenue, credit: 0, description: 'إقفال حسابات الإيرادات' },
    { accountCode: '3900', debit: 0, credit: revenue, description: 'ترحيل الإيرادات إلى ملخص الدخل' },
    { accountCode: '3900', debit: expenses, credit: 0, description: 'إقفال ملخص الدخل بالمصروفات' },
    { accountCode: '5101', debit: 0, credit: expenses, description: 'إقفال حسابات المصروفات' }
  ];
  if (net >= 0) { lines.push({ accountCode: '3900', debit: net, credit: 0, description: 'إقفال صافي الربح من ملخص الدخل' }); lines.push({ accountCode: retainedEarningsAccount, debit: 0, credit: net, description: 'ترحيل صافي ربح العام' }); }
  else { lines.push({ accountCode: retainedEarningsAccount, debit: Math.abs(net), credit: 0, description: 'ترحيل صافي خسارة العام' }); lines.push({ accountCode: '3900', debit: 0, credit: Math.abs(net), description: 'إقفال صافي الخسارة من ملخص الدخل' }); }
  return validateJournal({ description: `إقفال السنة المالية وترحيل نتيجة العام إلى ${openingYear || ''}`.trim(), date, source: 'YEAR_CLOSE', lines });
}

function buildOpeningBalances(accounts = []) {
  const lines = accounts.filter(account => !['إيراد', 'مصروف', 'REVENUE', 'EXPENSE'].includes(account.type) && Math.abs(Number(account.balance || 0)) > EPSILON).map(account => {
    const balance = number(account.balance, `رصيد الحساب ${account.code}`);
    return balance >= 0 ? { accountCode: account.code, debit: balance, credit: 0, description: 'رصيد افتتاحي' } : { accountCode: account.code, debit: 0, credit: Math.abs(balance), description: 'رصيد افتتاحي' };
  });
  const debit = lines.reduce((sum, line) => sum + line.debit, 0); const credit = lines.reduce((sum, line) => sum + line.credit, 0);
  if (Math.abs(debit - credit) > EPSILON) throw new Error('الأرصدة الافتتاحية غير متوازنة؛ راجع حساب الأرباح المحتجزة أو الحساب المقابل.');
  return validateJournal({ description: 'ترحيل الأرصدة الافتتاحية', source: 'OPENING_BALANCE', lines });
}

module.exports = { EPSILON, validateJournal, postJournal, closeFiscalYear, buildOpeningBalances };
