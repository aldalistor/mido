'use strict';
const fs = require('fs');
const path = require('path');
const dbFile = path.join('/tmp', `onyx-sqlite-${process.pid}.sqlite`);
process.env.ONYX_SQLITE_PATH = dbFile;
const db = require('./access-db');
(async () => {
  try {
    const initialized = await db.initialize({ engine: 'sqlite', companyCode: 'TEST', companyName: 'شركة اختبار SQLite', branchCode: 'MAIN', branchName: 'الفرع الرئيسي', fiscalYear: 2026, adminUsername: 'ADMIN', adminName: 'مدير النظام', adminPassword: 'StrongPass123!', includeDemoData: false });
    if (initialized.engine !== 'sqlite' || !fs.existsSync(dbFile)) throw new Error('SQLite database was not created.');
    const status = await db.test();
    if (status.engine !== 'sqlite') throw new Error('SQLite engine was not selected.');
    const settings = await db.organizationSettings();
    if (settings.company.COMPANY_CODE !== 'TEST') throw new Error('Company settings were not seeded.');
    const session = await db.authenticate('ADMIN', 'StrongPass123!');
    if (session.company.FISCAL_YEAR !== 2026) throw new Error('Authentication context was not created.');
    try { await db.authenticate('ADMIN', 'wrong-password'); throw new Error('Wrong password was accepted.'); } catch (error) { if (!/كلمة المرور غير صحيحة/.test(error.message)) throw error; }
    await db.updateOrganizationSettings({ companyName: 'شركة اختبار محدثة', companyCode: 'TEST2', branchName: 'فرع محدث', branchCode: 'BR2', fiscalYear: 2027, currency: 'SAR' });
    const updated = await db.organizationSettings();
    if (updated.branch.BRANCH_CODE !== 'BR2' || Number(updated.fiscalYear.FISCAL_YEAR) !== 2027) throw new Error('SQLite settings update failed.');
    console.log('sqlite fallback tests passed');
  } finally {
    await db.close();
    try { fs.unlinkSync(dbFile); } catch (_) {}
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
