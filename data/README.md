# قاعدة بيانات Access التجريبية

ينشئ السكربت `scripts/create-access-demo.ps1` الملف `data/mido-demo.accdb` على Windows باستخدام Microsoft Access Database Engine.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create-access-demo.ps1
```

بيانات الدخول التجريبية:

```text
المستخدم: admin
كلمة المرور: demo1234
```

لا يُحفظ ملف `.accdb` الناتج في Git افتراضيًا؛ شغّل السكربت بعد استنساخ المشروع أو أدرج الملف في حزمة داخلية خاصة إذا كانت سياسة التوزيع تسمح بذلك.
