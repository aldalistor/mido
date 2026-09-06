const db = require('./db');
(async () => {
  try {
    try { await db.createModernContact({ code: 'C-001', name: 'عميل تجريبي', phone: '0000000000' }); } catch (error) { if (!String(error.message).includes('unique')) throw error; }
    try { await db.createModernItem({ code: 'I-001', name: 'صنف تجريبي', unit: 'قطعة', quantity: 10, cost: 25 }); } catch (error) { if (!String(error.message).includes('unique')) throw error; }
    console.log(JSON.stringify({ contacts: await db.modernContacts('C-001'), items: await db.modernItems('I-001') }));
  } finally { await db.close(); }
})().catch(error => { console.error(error.message); process.exit(1); });
