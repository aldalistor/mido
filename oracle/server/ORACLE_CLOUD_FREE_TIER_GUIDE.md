# نشر خادم أونكس على Oracle Cloud Free Tier

هذا الدليل ينشر خادم Ubuntu مجانيًا طويل الأجل لتشغيل Docker وOracle وقاعدة بيانات أونكس. يجب اعتبار الخادم بيئة اختبار/تشغيل صغيرة، وليس بديلًا عن بنية إنتاجية عالية التوافر.

## 1. إنشاء حساب Oracle Cloud

افتح [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/) وأنشئ حسابًا واحدًا باسمك الحقيقي. Oracle تطلب عادةً وسيلة دفع للتحقق من الهوية، ولا يعني ذلك أن الموارد الموسومة Always Free ستتحول تلقائيًا إلى مدفوعة. لا تنشئ أكثر من حساب مجاني واحد.

اختر **Home Region** بعناية؛ موارد Always Free، وخصوصًا Compute وBlock Volume، ترتبط بها. قد تظهر رسالة `Out of host capacity` عند عدم توفر السعة في المنطقة أو Availability Domain، وفي هذه الحالة جرّب Availability Domain آخر أو انتظر.

## 2. إنشاء Compute Instance

من Console اختر `Compute` ثم `Instances` ثم `Create instance`.

استخدم القيم التالية:

| الحقل | القيمة المقترحة |
|---|---|
| Name | `onyx-oracle-server` |
| Image | Ubuntu 24.04 LTS 64-bit، ويجب أن تكون موسومة Always Free Eligible |
| Shape | يفضل `VM.Standard.A1.Flex` بواقع 2 OCPU و12 GB RAM إذا كانت السعة متاحة |
| Boot volume | 50 GB مبدئيًا، وهو ضمن حد Block Volume المجاني |
| VCN | Create new VCN with Internet Connectivity |
| Subnet | Public subnet |
| Public IPv4 | Assign public IPv4 address |
| SSH key | ارفع Public Key الخاص بك، ولا تعتمد على كلمة مرور |

موارد Oracle الحالية توضح أن حساب Always Free يتيح إجماليًا يصل إلى 2 OCPU و12 GB RAM لـ Ampere A1، مع حدود تخزين مجانية يجب ألا تتجاوزها. تحقق من شاشة الإنشاء نفسها قبل التأكيد لأن السعة والمتاح قد يتغيران.

> **تنبيه توافق الصورة:** خادم Ampere A1 يستخدم ARM64. استخدم صورة Oracle Free أو صورة Oracle/Container متوافقة مع ARM64. إذا استخدمت صورة XE قديمة غير متوافقة، سيفشل Docker قبل تشغيل قاعدة البيانات. تحقق من معمارية الصورة قبل التشغيل.

## 3. فتح الشبكة بأقل صلاحيات

في VCN، افتح Subnet ثم Security List أو Network Security Group. أضف فقط:

| المنفذ | البروتوكول | المصدر | الاستخدام |
|---:|---|---|---|
| 22 | TCP | عنوان IP الخاص بك فقط `/32` | SSH |

لا تفتح المنفذ 1521 على الإنترنت العام. قاعدة Oracle يجب أن تبقى خاصة، والتطبيق أو نفق SSH فقط هو الذي يصل إليها. إذا كان لديك API أو واجهة ويب لاحقًا، افتح 443 فقط عبر Reverse Proxy مع TLS، وليس 1521.

Oracle توضح أن Security Lists تعمل كجدار ناري افتراضي على مستوى الشبكة، وأن قواعد Ingress يجب ضبطها صراحةً. تذكّر أن فتح المنفذ في OCI لا يكفي؛ يجب أيضًا فتحه في UFW داخل Ubuntu عند الحاجة.

## 4. الاتصال عبر SSH

على جهازك المحلي:

```bash
chmod 600 ~/.ssh/onyx_oracle.key
ssh -i ~/.ssh/onyx_oracle.key ubuntu@PUBLIC_IP
```

بعد الدخول:

```bash
sudo apt update && sudo apt -y upgrade
sudo timedatectl set-timezone Asia/Riyadh
```

استبدل المنطقة الزمنية بما يناسب شركتك. لا تستخدم `root` لتشغيل التطبيق.

## 5. تثبيت Docker

ارفع مجلد `oracle/server` من المشروع إلى الخادم. يمكن استخدام GitHub:

```bash
sudo apt install -y git
cd /opt
git clone https://github.com/aldalistor/mido.git onyx-project
cd /opt/onyx-project/oracle/server
sudo bash install_ubuntu.sh
```

إذا لم يكن المستودع متاحًا، ارفع ملف ZIP ثم فك الضغط:

```bash
sudo mkdir -p /opt/onyx-project
sudo unzip OnyxAccountingDesktop-v0.5.0-free-oracle-server.zip -d /opt/onyx-project
cd /opt/onyx-project/oracle/server
sudo bash install_ubuntu.sh
```

تحقق من Docker:

```bash
docker version
docker compose version
sudo systemctl enable --now docker
```

## 6. إعداد الأسرار

```bash
cd /opt/onyx-server
sudo cp .env.example .env
sudo nano .env
sudo chmod 600 .env
```

استخدم كلمات مرور طويلة وعشوائية. لا تضع `.env` في Git أو ترسله في المحادثة. إذا استُخدمت صورة Oracle الرسمية، سجّل الدخول إلى Oracle Container Registry أولًا حسب تعليمات Oracle، ثم عدّل `ORACLE_IMAGE` إلى الصورة المتوافقة مع ARM64.

## 7. تشغيل قاعدة Oracle

```bash
cd /opt/onyx-server
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker logs -f onyx-oracle
```

انتظر حتى تظهر رسالة جاهزية قاعدة البيانات. قد يستغرق الإنشاء الأول وقتًا طويلًا بسبب حجم الصورة وتهيئة ملفات البيانات.

فحص الحالة:

```bash
sudo docker inspect --format='{{.State.Health.Status}}' onyx-oracle
sudo docker exec -it onyx-oracle healthcheck.sh
```

## 8. رفع ملف Data Pump

من جهازك المحلي، انسخ الملف إلى الخادم باستخدام `scp`:

```bash
scp -i ~/.ssh/onyx_oracle.key \
  '02-09-202612-05-45(3)' \
  ubuntu@PUBLIC_IP:/tmp/onyx_legacy.dmp
```

ثم على الخادم:

```bash
sudo mkdir -p /opt/onyx-server/imports
sudo mv /tmp/onyx_legacy.dmp /opt/onyx-server/imports/onyx_legacy.dmp
sudo sha256sum /opt/onyx-server/imports/onyx_legacy.dmp
```

قارن البصمة مع البصمة الأصلية المحفوظة في `oracle/inventory/source_dump.sha256` قبل الاستيراد.

## 9. استخراج Metadata ثم الاستيراد

نفذ:

```bash
sudo /opt/onyx-server/import_legacy.sh onyx_legacy.dmp
```

سيتم أولًا إنشاء `onyx_metadata.sql` وسجل Metadata داخل مجلد `imports`. راجع الملف وابحث عن:

```bash
grep -Ei 'CREATE (USER|TABLESPACE)|GRANT DBA|ALTER USER|DIRECTORY|DB LINK' \
  /opt/onyx-server/imports/onyx_metadata.sql
```

إذا ظهر إنشاء مستخدمين أو امتيازات غير مطلوبة، أوقف العملية وعدّل معلمات `impdp`. لا تكتب `IMPORT` إلا بعد المراجعة. عند التأكيد سيُستخدم `REMAP_SCHEMA=RUSERS:ONYX_LEGACY_STAGE` لتجنب الكتابة في مخطط الإنتاج أو مخطط التطبيق.

بعد الاستيراد، شغّل استعلامات التحقق الموجودة في:

```text
oracle/verify_stage.sql
```

وتحقق من الجداول `ACCOUNT` و`CUSTOMER` و`VENDOR` و`ITEM_MOVEMENT` وجداول الفروع والصلاحيات.

## 10. تأمين Ubuntu

فعّل UFW بحيث يسمح بـ SSH فقط من عنوانك، ولا تسمح بالوصول العام إلى Oracle:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from YOUR_PUBLIC_IP/32 to any port 22 proto tcp
sudo ufw enable
sudo ufw status verbose
```

إذا تغيّر عنوان IP لديك، حدّث قاعدة SSH قبل حذف القاعدة القديمة حتى لا تفقد الوصول. لا تنفذ `ufw allow 1521` إلا إذا كان هناك سبب واضح، والأفضل استخدام SSH Tunnel:

```bash
ssh -i ~/.ssh/onyx_oracle.key \
  -L 1521:127.0.0.1:1521 \
  ubuntu@PUBLIC_IP
```

بعد تشغيل النفق، اتصل من جهازك بعنوان `localhost:1521/XEPDB1`.

## 11. النسخ الاحتياطي

فعّل مؤقت النسخ الاحتياطي:

```bash
cd /opt/onyx-server
sudo bash install_backup_timer.sh
sudo systemctl status onyx-oracle-backup.timer
sudo systemctl start onyx-oracle-backup.service
ls -lh /opt/onyx-server/backups
```

لا تحفظ النسخ الاحتياطية على نفس Boot Volume فقط. انسخها دوريًا إلى Object Storage أو إلى جهاز محلي مشفّر. احتفظ بحد أقصى مناسب لسعة Always Free، وتحقق من نجاح الاستعادة على قاعدة اختبار.

## 12. تشغيل الخادم بعد إعادة التشغيل

تأكد من التشغيل التلقائي:

```bash
sudo systemctl enable docker
sudo docker compose -f /opt/onyx-server/docker-compose.yml up -d
sudo docker compose -f /opt/onyx-server/docker-compose.yml ps
```

يمكن إضافة Unit مستقل إذا كان Compose لا يبدأ تلقائيًا في بيئتك، لكن `restart: unless-stopped` في ملف Compose يغطي إعادة تشغيل الحاوية بعد بدء Docker.

## 13. حدود ومخاطر Always Free

موارد Always Free ليست ضمان سعة دائمًا؛ قد تواجه نقصًا مؤقتًا في سعة A1. كما قد تعتبر Oracle الآلة الخاملة غير نشطة وتعيد حجزها وفق سياساتها، لذلك راقب CPU والشبكة والذاكرة وسجل الدخول دوريًا. الحساب المجاني يتطلب معلومات تحقق صحيحة، وقد تطلب Oracle بطاقة للتحقق، كما أن الموارد خارج حدود Always Free قد تسبب تكلفة.

## المراجع

[1]: https://www.oracle.com/cloud/free/ Oracle Cloud Free Tier
[2]: https://docs.oracle.com/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm Oracle Always Free Resources
[3]: https://docs.oracle.com/iaas/Content/Compute/Tasks/launchinginstance.htm Oracle Creating an Instance
[4]: https://docs.oracle.com/iaas/Content/Network/Concepts/securitylists.htm Oracle Security Lists
[5]: https://docs.docker.com/engine/install/ubuntu/ Docker Engine on Ubuntu
[6]: https://docs.docker.com/compose/install/linux/ Docker Compose on Linux
[7]: https://www.oracle.com/database/free/ Oracle AI Database Free
