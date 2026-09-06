const db = require('./db');
(async () => {
  try {
    try { await db.createModernAccount({ code: '2000', name: 'الحساب المقابل', type: 'GENERAL' }); } catch (error) { if (!String(error.message).includes('unique')) throw error; }
    const result = await db.createModernJournal({ description: 'اختبار قيد متوازن', lines: [{ accountCode: '1000', debit: 100, credit: 0 }, { accountCode: '2000', debit: 0, credit: 100 }] });
    console.log(JSON.stringify(result));
  } finally { await db.close(); }
})().catch(error => { console.error(error.message); process.exit(1); });
