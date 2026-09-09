# تشغيل Mido على Microsoft Access

## الحالة الحالية

أضيف محرك Access فعلي لمسارات التشغيل الأساسية: اختبار الاتصال، لوحة التحكم، الحسابات، العملاء، الأصناف، الفواتير، البحث الشامل، المستخدمون، سجل التدقيق، والترقيم. يختار التطبيق المحرك من المتغير:

```text
MIDO_DB_ENGINE=access
```

إذا لم يُضبط المتغير، يبقى Oracle هو المحرك الافتراضي.

## إنشاء قاعدة البيانات التجريبية

يتطلب إنشاء ملف `.accdb` على Windows وجود Microsoft Access Database Engine أو Microsoft Access مثبتًا. من PowerShell داخل جذر المشروع:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create-access-demo.ps1
```

ينتج الملف:

```text
data\mido-demo.accdb
```

وبيانات الدخول:

```text
admin / demo1234
```

## تشغيل التطبيق على Access

```powershell
$env:MIDO_DB_ENGINE = "access"
$env:MIDO_ACCESS_FILE = "$PWD\data\mido-demo.accdb"
npm start
```

يمكن ضبط سلسلة ODBC يدويًا عند الحاجة:

```powershell
$env:MIDO_ACCESS_CONNECTION_STRING = "Driver={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=$PWD\data\mido-demo.accdb;"
```

## المتطلبات

- Windows 10 أو Windows 11 بنواة 64-bit.
- Node.js 22 بنفس بنية برنامج تشغيل Access.
- Microsoft Access Database Engine 2016 أو أحدث.
- توافق معماري موحد: لا تخلط ACE 32-bit مع Node/Electron 64-bit.
- حزمة `odbc` المثبتة عبر `npm ci`.

## الاختبار

```powershell
npm ci
npm test
$env:MIDO_DB_ENGINE = "access"
$env:MIDO_ACCESS_FILE = "$PWD\data\mido-demo.accdb"
npm start
```

اختبر إنشاء مستخدم، فتح لوحة التحكم، البحث، إنشاء عميل وصنف، وإنشاء فاتورة.

## ملاحظة عن التغطية

بعض الوحدات المتقدمة التي تعتمد على مخطط Oracle الكامل، مثل التقارير المالية المتقدمة، إدارة الإقفال، سندات القبض والصرف، وبعض عمليات الترحيل المخزني، تظل غير متاحة في محول Access الحالي حتى يتم تحويل مخططها واستعلاماتها واختبارها على ODBC. عند محاولة استخدامها تظهر رسالة واضحة بدل تنفيذ استعلام Oracle غير متوافق.

لتحويل هذه الوحدات بالكامل، يجب إضافة جداول Access المقابلة واستبدال صيغ Oracle مثل `TO_DATE` و`SYSDATE` و`FETCH FIRST` و`RETURNING INTO` باستعلامات Access/ODBC مع اختبارات تكامل على Windows.
