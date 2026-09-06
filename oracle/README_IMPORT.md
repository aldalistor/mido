# استيراد قاعدة Oracle القديمة إلى مشروع أونكس

## الحالة الحالية

الملف `02-09-202612-05-45(3)` هو Oracle Data Pump Export، ويظهر أنه صادر عن Oracle Data Pump `V11.01.00` للمخطط `RUSERS`. لا يوجد في بيئة التطوير الحالية عميل Oracle (`impdp`/`sqlplus`) أو خادم Oracle، ولذلك تم تجهيز سكربتات الاستيراد ولم يتم تنفيذ استيراد فعلي.

## سياسة الأمان

يجب تنفيذ العملية أولًا على قاعدة تجريبية منفصلة. لا تستخدم Schema الإنتاج، ولا تستورد إلى `SYS`، ولا ترسل كلمات مرور الاتصال إلى المستودع أو المحادثة. احتفظ بالملف الأصلي كما هو، واعمل على نسخة منه عند الحاجة.

## الخطوة الأولى: استخراج SQL دون تنفيذ

انسخ ملف الـ Dump إلى Oracle Directory على الخادم، ثم نفذ:

```bash
impdp system/*****@ORCL \
  directory=DATA_PUMP_DIR \
  dumpfile=02-09-202612-05-45.dmp \
  sqlfile=onyx_metadata.sql \
  schemas=RUSERS \
  logfile=onyx_metadata.log
```

هذه الخطوة تنتج ملف DDL للمراجعة دون إنشاء الجداول أو إدخال البيانات.

## الخطوة الثانية: إنشاء Schema تجريبي

ينفذها مسؤول Oracle في قاعدة اختبار فقط:

```sql
CREATE USER ONYX_LEGACY_STAGE IDENTIFIED BY "ضع_كلمة_مرور_خارج_المستودع";
GRANT CREATE SESSION, RESOURCE TO ONYX_LEGACY_STAGE;
ALTER USER ONYX_LEGACY_STAGE QUOTA UNLIMITED ON USERS;
```

قد تحتاج بعض البيئات إلى منح امتيازات إضافية بحسب محتوى التصدير. لا تمنح `DBA` للحساب التطبيقي.

## الخطوة الثالثة: الاستيراد التجريبي

```bash
impdp system/*****@ORCL \
  directory=DATA_PUMP_DIR \
  dumpfile=02-09-202612-05-45.dmp \
  remap_schema=RUSERS:ONYX_LEGACY_STAGE \
  logfile=onyx_stage_import.log \
  exclude=USER,GRANT
```

إذا كان الملف يحتوي على أكثر من Schema، نحدد `include` أو `schemas` بعد مراجعة ملف Metadata. وإذا كان اسم الملف الفعلي يحتوي على أحرف خاصة، يفضل إعادة تسميته إلى اسم بسيط مثل `onyx_legacy.dmp` داخل Oracle Directory.

## الخطوة الرابعة: التحقق

بعد الاستيراد، نفذ الاستعلامات الموجودة في `verify_stage.sql`. يجب مقارنة عدد الجداول والـ Views والـ Sequences، ثم اختبار الجداول الأساسية مثل `ACCOUNT` و`CUSTOMER` و`VENDOR` وجداول المخزون والفروع والصلاحيات.

## الخطوة الخامسة: ربط التطبيق

بعد نجاح الاستيراد التجريبي، ينشئ التطبيق اتصالًا بحساب قراءة/تشغيل منفصل، ولا يستخدم حساب `SYSTEM`. طبقة التحويل ستربط شاشة الدخول بسياق الشركة والفرع والسنة واللغة، ثم تربط الوحدات المحاسبية بالجداول القديمة بعد مراجعة العلاقات.
