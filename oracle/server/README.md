# خادم Oracle التجريبي لأونكس

هذا المجلد يجهز Oracle XE 21c محليًا عبر Docker Compose مع Volume دائم، PDB باسم `XEPDB1`، وSchema منفصل للتطبيق والاستيراد المرحلي.

## المتطلبات

يحتاج التشغيل إلى جهاز أو خادم يحتوي على Docker Desktop أو Docker Engine وذاكرة مناسبة لقاعدة Oracle. البيئة الحالية لا تحتوي على Docker أو Oracle Client، لذلك تم تجهيز الملفات دون تشغيل الخادم داخل مساحة العمل المؤقتة.

## التشغيل

```bash
cp .env.example .env
# عدّل كلمات المرور داخل .env
mkdir -p imports
# ضع نسخة ملف Data Pump داخل imports باسم onyx_legacy.dmp
docker compose up -d

docker compose ps
docker logs -f onyx-oracle
```

انتظر ظهور رسالة جاهزية قاعدة البيانات. اتصال التطبيق يكون عادةً:

```text
localhost:1521/XEPDB1
```

## استخراج Metadata دون تنفيذ

```bash
docker exec -it onyx-oracle bash -lc \
  'impdp system/$ORACLE_PASSWORD@XEPDB1 directory=DATA_PUMP_DIR dumpfile=onyx_legacy.dmp schemas=RUSERS sqlfile=/tmp/onyx_metadata.sql logfile=/tmp/onyx_metadata.log'
```

في حال عدم ظهور الملف داخل Oracle Directory، انسخه أولًا إلى المسار الخاص بـ Data Pump داخل الحاوية أو استخدم إجراء الاستيراد المرحلي الموجود في `oracle/import`.

## الاستيراد التجريبي

لا تنفذ الاستيراد قبل مراجعة ملف Metadata. بعد ذلك:

```bash
docker exec -it onyx-oracle bash -lc \
  'impdp system/$ORACLE_PASSWORD@XEPDB1 directory=DATA_PUMP_DIR dumpfile=onyx_legacy.dmp remap_schema=RUSERS:ONYX_LEGACY_STAGE exclude=USER,GRANT logfile=/tmp/onyx_import.log'
```

## ملاحظات مهمة

الـ Volume `onyx_oracle_data` يحفظ البيانات عند إعادة تشغيل الحاوية. احفظ نسخة احتياطية قبل أي استيراد كبير. لا تستخدم كلمات المرور الموجودة داخل سكربت التهيئة في بيئة الإنتاج؛ غيّرها بعد الإقلاع الأول، واستبدل صورة المجتمع `gvenzl/oracle-xe` بصورة Oracle الرسمية أو صورة مؤسستك عند الحاجة إلى دعم رسمي.

للاستخدام الإنتاجي، انقل الخادم إلى جهاز دائم أو Cloud Computer/خادم مؤسسي؛ لا تعتمد على مساحة عمل مؤقتة لخدمة قاعدة بيانات طويلة الأجل.
