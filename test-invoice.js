const db = require('./db');
(async () => {
  try {
    const result = await db.createModernInvoice({ type: 'SALE', contactCode: 'C-001', lines: [{ itemCode: 'I-001', quantity: 2, unitPrice: 40 }] });
    console.log(JSON.stringify(result));
  } finally { await db.close(); }
})().catch(error => { console.error(error.message); process.exit(1); });
