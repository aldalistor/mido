# تشغيل نسخة أونكس ERP على Windows

## الطريقة الصحيحة

لا تنسخ ملف `أونكس المحاسبي.exe` وحده. يجب نقل **مجلد `win-unpacked` كاملًا** إلى جهاز Windows، ثم تشغيل الملف الموجود داخله:

```text
win-unpacked\أونكس المحاسبي.exe
```

يجب أن تبقى الملفات التالية بجوار الملف التنفيذي:

- `resources\app.asar`
- `resources\app.asar.unpacked\node_modules\odbc`
- `resources\app.asar.unpacked\node_modules\oracledb`
- ملفات Electron وملفات `locales`

## متطلبات قاعدة Access

لتشغيل قاعدة Access الفعلية، ثبّت على Windows:

```text
Microsoft Access Database Engine 2016 Redistributable 64-bit
```

بعدها شغّل التطبيق، وستظهر شاشة إنشاء ملف `onyx-erp.accdb` والتهيئة الأولى.

## بيانات الدخول الأولية

```text
المستخدم: admin
كلمة المرور: demo123
```

## إذا لم يفتح التطبيق

شغّله من PowerShell داخل مجلد `win-unpacked`، ثم أرسل رسالة الخطأ الظاهرة:

```powershell
.\أونكس المحاسبي.exe
```

لا تحذف مجلد `resources` ولا تعيد تسمية `app.asar`.
