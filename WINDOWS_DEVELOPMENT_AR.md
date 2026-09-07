# تطوير أونكس المحاسبي على Windows

المشروع تطبيق مكتبي حقيقي مبني باستخدام **Electron**، وليس موقعًا يعمل داخل المتصفح. يمكن تطويره وتشغيله وبناء مثبت Windows من خلال Visual Studio Code وPowerShell.

## المتطلبات

| المتطلب | الغرض |
|---|---|
| Windows 10 أو Windows 11 بنواة 64-bit | تشغيل التطبيق وبناء نسخة Windows |
| Node.js 22 LTS أو إصدار حديث متوافق | تشغيل Electron وأوامر npm |
| Git | تنزيل المشروع وإدارة التغييرات |
| Visual Studio Code | بيئة التطوير المقترحة |
| Microsoft Access Database Engine 2016 Runtime x64 | إنشاء ملف MDB وتشغيل موصل Access |

يجب تثبيت نسخة Access Database Engine الموافقة لمعمارية Node/Electron. إذا كان Microsoft Office مثبتًا بنواة 32-bit فقد يحدث تعارض مع نسخة x64. في هذه الحالة استخدم مكونات متوافقة أو ثبّت Office وAccess Database Engine بنفس المعمارية.

## تنزيل المشروع

افتح PowerShell ونفّذ:

```powershell
git clone --branch development https://github.com/aldalistor/mido.git
cd mido
npm ci
```

يستخدم `npm ci` ملف `package-lock.json` لتثبيت الإصدارات المعتمدة نفسها الموجودة في المشروع.

## تشغيل نسخة التطوير

```powershell
npm run dev
```

أو:

```powershell
npm start
```

عند أول تشغيل، تظهر شاشة **التأسيس الأول للنظام**. أدخل اسم الشركة ورمزها والفرع والسنة المالية وبيانات المدير، ثم اضغط **إنشاء قاعدة البيانات وبدء النظام**.

ينشئ النظام ملف قاعدة البيانات تلقائيًا في المسار الافتراضي التالي:

```text
%APPDATA%\Onyx Accounting\onyx-local.mdb
```

بعد الإنشاء يتم تجهيز الجداول ودليل الحسابات والشركة والفرع والسنة المالية والمستخدم الإداري. لا تُضاف بيانات تجريبية تلقائيًا.

## اختبار المشروع

```powershell
npm test
```

يشمل الاختبار فحص صياغة ملفات JavaScript واختبارات النواة المحاسبية ودورة الفواتير والجلسات والفترات المالية.

## بناء مثبت Windows

```powershell
npm run build:win
```

تظهر المخرجات في مجلد `dist`. ينتج الأمر عادةً مثبت NSIS ونسخة تشغيل غير مثبتة داخل:

```text
dist\win-unpacked
```

لتشغيل نسخة غير مثبتة أثناء الاختبار:

```powershell
npm run build:win -- --dir
```

## إذا فشل إنشاء ملف MDB

تحقق من النقاط التالية:

1. ثبّت Microsoft Access Database Engine 2016 Runtime.
2. تأكد من توافق المعمارية بين Office وAccess Database Engine وNode/Electron.
3. شغّل PowerShell وVisual Studio Code بصلاحيات تسمح بالكتابة في `%APPDATA%`.
4. أغلق أي ملف MDB مفتوح في Microsoft Access.
5. احذف ملف قاعدة البيانات فقط بعد أخذ نسخة احتياطية، ثم شغّل التطبيق لإعادة التأسيس.
6. راجع رسالة الخطأ الظاهرة في شاشة التأسيس بدل تخطيها إلى الوضع التجريبي.

## تطوير الكود

- `main.js`: العملية الرئيسية ونافذة Electron ومعالجات IPC.
- `preload.js`: الجسر الآمن بين الواجهة والعملية الرئيسية.
- `renderer.js`: التنقل والواجهات وعمليات المستخدم.
- `access-db.js`: قاعدة Access المحلية وعمليات CRUD.
- `accounting-core.js`: قواعد التوازن المحاسبي.
- `create-mdb.ps1`: إنشاء ملف MDB عند أول تشغيل Windows.
- `index.html` و`styles.css`: واجهة النظام وتصميمه.

بعد تعديل الكود، شغّل `npm test` ثم `npm run dev`. لا تعدّل ملف `package-lock.json` يدويًا، ولا تضع كلمات المرور أو ملفات قواعد البيانات أو مفاتيح الترخيص داخل Git.

## إعداد GitHub

لرفع التعديلات إلى فرع التطوير:

```powershell
git status
git add .
git commit -m "وصف التعديل"
git push origin development
```

ينبغي تنفيذ العمل اليومي على فرع `development`، ثم إنشاء فرع مستقل للميزات الكبيرة قبل دمجها في فرع الإصدار.

## ملاحظة عن Oracle وSQL Server

يدعم المشروع مسارات اتصال إضافية إلى Oracle وSQL Server، لكنها تحتاج إلى إعداد خادم وقاعدة بيانات وبيانات اعتماد صحيحة. للتطوير المحلي على Windows، ابدأ بمسار Access MDB، ثم انتقل إلى Oracle أو SQL Server عند تجهيز بيئة خادم فعلية.
