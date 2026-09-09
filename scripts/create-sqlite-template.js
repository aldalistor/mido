'use strict';
const fs = require('fs');
const path = require('path');
const target = path.resolve(process.argv[2] || path.join(__dirname, '..', 'resources', 'onyx-template.sqlite'));
fs.mkdirSync(path.dirname(target), { recursive: true });
try { fs.unlinkSync(target); } catch (_) {}
process.env.ONYX_SQLITE_PATH = target;
process.env.ONYX_DB_PATH = target;
const db = require('../access-db');
(async () => {
  await db.initialize({ engine: 'sqlite', template: true, includeDemoData: false });
  await db.close();
  console.log(`SQLite template created: ${target}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
