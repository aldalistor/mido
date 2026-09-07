'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const checks = [];
function add(name, ok, detail, fix = '') { checks.push({ name, ok, detail, fix }); }
function command(command, args) {
  try { return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (_) { return ''; }
}

add('نظام التشغيل', process.platform === 'win32', `${process.platform} ${os.arch()}`, 'شغّل هذا الفحص على Windows للتأكد من تعريف Access.');
add('إصدار Node.js', Number(process.versions.node.split('.')[0]) >= 18, process.version, 'ثبّت Node.js 22 LTS أو إصدارًا أحدث متوافقًا.');
add('Electron', fs.existsSync(path.join(__dirname, '..', 'node_modules', 'electron')), 'node_modules/electron', 'نفّذ npm ci داخل مجلد المشروع.');

let odbcLoaded = false;
try { require('odbc'); odbcLoaded = true; } catch (error) { add('موصل ODBC', false, error.message, 'أعد npm ci وثبّت Access Database Engine المطابق لمعمارية التطبيق.'); }
if (odbcLoaded) add('موصل ODBC', true, 'تم تحميل حزمة odbc بنجاح');

if (process.platform === 'win32') {
  const drivers = command('reg', ['query', 'HKLM\\SOFTWARE\\ODBC\\ODBCINST.INI', '/s']);
  const hasAccess = /Microsoft Access Driver|Microsoft Access Database Engine/i.test(drivers);
  add('تعريف Microsoft Access', hasAccess, hasAccess ? 'تم العثور على تعريف Access' : 'لم يتم العثور على تعريف Access في سجل Windows', 'ثبّت Microsoft Access Database Engine 2016 Runtime بنفس معمارية Node/Electron.');
  const powershell = command('powershell.exe', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()']);
  add('PowerShell', Boolean(powershell), powershell || 'غير متاح', 'فعّل Windows PowerShell لتشغيل create-mdb.ps1.');
}

const dbPath = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Onyx Accounting', 'onyx-local.mdb');
add('مسار قاعدة البيانات', true, dbPath + (fs.existsSync(dbPath) ? ' — الملف موجود' : ' — الملف غير موجود، وسيُنشأ في التأسيس الأول'));

console.log('\nفحص بيئة أونكس المحاسبي\n');
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} | ${check.name}: ${check.detail}`);
  if (!check.ok && check.fix) console.log(`       الحل: ${check.fix}`);
}
const failed = checks.filter(check => !check.ok);
console.log(`\nالنتيجة: ${checks.length - failed.length}/${checks.length} فحوصات ناجحة.`);
process.exitCode = failed.length ? 1 : 0;
