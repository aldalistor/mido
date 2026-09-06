const db = require('./db');
(async () => {
  try {
    const info = await db.test();
    console.log(JSON.stringify(info));
    const dashboard = await db.dashboard();
    console.log(JSON.stringify(dashboard));
  } finally {
    await db.close();
  }
})().catch(error => { console.error(error.message); process.exit(1); });
