# الحزمة التجارية الأولى لنظام mido

## ما تم تنفيذه

أضيفت نواة تجارية مستقلة يمكن استخدامها من طبقة Electron أو طبقة الخادم دون وضع أسرار الترخيص داخل الواجهة. تتضمن النواة ما يلي:

| المجال | التنفيذ |
|---|---|
| الترخيص | ترخيص موقّع بـ RSA-SHA256 وقابل للتحقق بالمفتاح العام |
| دورة الترخيص | نشط، فترة سماح، منتهٍ، ملغى، غير صالح |
| الخطط | تجريبي، أساسي، احترافي، مؤسسي |
| الحدود | عدد المستخدمين والفروع حسب الترخيص |
| الميزات | أهلية المبيعات والمشتريات والمخزون والتقارير والمرتجعات وسجل التدقيق |
| الصلاحيات | مدير، محاسب، مبيعات، مشتريات، مشاهد |
| المبيعات والمشتريات | كميات، أسعار، خصومات، ضريبة، عملة، نقدي، آجل، جزئي |
| الأرصدة | المبلغ المدفوع والمتبقي |
| المرتجعات | مرتجع مبيعات أو مشتريات مع منع تجاوز كمية الفاتورة الأصلية |
| الجودة | اختبارات وحدة مضافة ومربوطة بـ `npm test` |

## أمثلة استخدام

```js
const { evaluateLicense, enforceEntitlement } = require('./commercial-license-core');
const { buildUserPermissions, assertCan } = require('./commercial-permissions-core');
const { calculateInvoice, TYPES, PAYMENT_METHODS } = require('./commercial-invoice-core');

const state = evaluateLicense(license, { today: '2026-09-07', publicKey });
enforceEntitlement({ license, feature: 'INVOICING', currentUsers: 3, currentBranches: 1, options: { today: '2026-09-07', publicKey } });

const permissions = buildUserPermissions({ roles: ['ACCOUNTANT'] });
assertCan(permissions, 'INVOICE_POST');

const invoice = calculateInvoice({
  type: TYPES.SALE,
  paymentMethod: PAYMENT_METHODS.PARTIAL,
  paidAmount: 200,
  taxRate: 15,
  currency: 'YER',
  lines: [{ itemCode: 'ITEM-1', quantity: 2, unitPrice: 100, discountAmount: 10, unitCost: 60 }]
});
```

## شرط مهم قبل البيع

هذه الحزمة هي **أساس تجاري قابل للدمج** وليست اعتمادًا نهائيًا لبيع النظام دون اختبار ميداني. يجب ربط `enforceEntitlement` فعليًا بمعالجات تسجيل الدخول والترحيل وواجهات الإدارة، وربط `calculateInvoice` بقاعدة البيانات والمعاملة التي تحفظ الفاتورة والقيد وحركة المخزون معًا.

قبل تسليم نسخة لعميل يجب تنفيذ اختبار قبول على Windows وقاعدة Oracle فعلية، ومراجعة التقارير مع محاسب، والتحقق من النسخ الاحتياطي والاستعادة، والتأكد من أن المفتاح الخاص بالتوقيع محفوظ خارج التطبيق وخارج GitHub. بعد الدمج يمكن تحويل انتهاء الترخيص إلى وضع قراءة فقط بدل حذف أو إتلاف بيانات العميل.

## التحقق

```bash
npm test
```

ينبغي ألا يُعلن النظام بديلًا كاملاً لأي منافس قبل اجتياز بوابة الاعتماد في `PRODUCT_RELEASE_PLAN.md` واختبار الفواتير والمرتجعات والصلاحيات مع منشآت حقيقية.
