# دليل اختبار موصل GitHub في مشروع mido

تم اختبار موصل GitHub على مستودع [`aldalistor/mido`](https://github.com/aldalistor/mido) باستخدام الحساب المتصل `aldalistor`.

## ما تم التحقق منه

| الميزة | طريقة الاختبار | النتيجة |
|---|---|---|
| المصادقة | `gh auth status` و`gh api user` | الحساب متصل بنجاح |
| استعراض المستودعات | `gh repo list aldalistor` | ظهر مستودع `aldalistor/mido` |
| استنساخ المشروع | `gh repo clone aldalistor/mido` | تم الاستنساخ دون أخطاء |
| قراءة السجل | `gh api repos/aldalistor/mido/commits` | ظهرت الالتزامات الأخيرة |
| قراءة المشكلات | `gh issue list` و`gh issue view 1` | تمت قراءة المشكلة رقم 1 |
| الفروع | `gh api repos/aldalistor/mido/branches` | الفرع `main` موجود |
| التحقق الآلي | GitHub Actions في `.github/workflows/ci.yml` | يختبر `npm test` عند الدفع وطلبات السحب |

## التحديث المحاسبي

أضيف تحقق صارم من التاريخ في `session-context.js`. يقبل النظام الآن تاريخًا بصيغة `YYYY-MM-DD` ويتحقق من صحة اليوم فعليًا، ويرفض الفترة المالية إذا كانت بدايتها بعد نهايتها أو إذا كان تاريخها غير صالح. كما يمنع الترحيل خارج حدود الفترة المحددة ويُبقي أسباب الرفض قابلة للمعالجة برمجيًا:

- `INVALID_DATE`: تاريخ العمل أو الترحيل غير صالح.
- `INVALID_PERIOD`: بداية/نهاية الفترة غير صالحة أو معكوسة.
- `OUTSIDE_FISCAL_YEAR`: تاريخ الترحيل خارج الفترة.
- `PERIOD_CLOSED`: الفترة مقفلة.

أضيفت اختبارات تغطي التاريخ الكبيس، الأيام غير الموجودة، حدود السنة المالية، والفترة المعكوسة.

## أوامر العمل المعتادة

```bash
# التحقق من تسجيل الدخول
gh auth status

# قراءة حالة المستودع
gh repo view aldalistor/mido

# إنشاء فرع للتغيير
git switch -c feat/my-change

# تشغيل الاختبارات محليًا
npm test

# رفع الفرع إلى GitHub
git push -u origin feat/my-change

# إنشاء طلب سحب بعد الرفع
gh pr create --base main --head feat/my-change --title "عنوان التغيير" --body "وصف مختصر للاختبارات والتغيير"

# متابعة فحوصات GitHub Actions
gh run list --repo aldalistor/mido
```

لا تُحفظ كلمات مرور Oracle أو مفاتيح سرية في المستودع. تُضاف الأسرار المطلوبة لاحقًا من إعدادات GitHub Actions، وتظل صلاحيات سير العمل في هذا التحديث للقراءة فقط للمحتوى.
