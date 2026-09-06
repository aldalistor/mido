# حاوية تطوير Mido

يفتح GitHub Codespaces هذا المستودع داخل حاوية Node.js 22 مخصصة للتطوير. عند إنشاء الحاوية تُثبت تبعيات المشروع تلقائيًا عبر `npm ci`.

## التحقق السريع

```bash
npm test
```

هذا الأمر يتحقق من صحة بناء ملفات JavaScript دون الحاجة إلى اتصال Oracle.

## تشغيل واجهة Electron

```bash
xvfb-run -a npm start
```

## تشغيل Oracle اختياريًا

خدمة Oracle منفصلة عن حاوية التطوير، وتُشغّل فقط عند الحاجة من المسار:

```bash
cd oracle/server
cp .env.example .env
# عدّل الأسرار محليًا ولا تحفظ الملف في Git
docker compose up -d
```

لا تُستخدم الحاوية أو مساحة Codespaces كبيئة إنتاج دائمة، ولا تُضمّن ملفات Data Pump أو كلمات المرور داخل المستودع.
