# دليل إدارة قنوات الفروع (Branch Channel)

> بسم الله الرحمن الرحيم — هذا الدليل يشرح كيفية التحكم في قنوات الاتصال بين شاشة نقطة البيع (POS) وشاشة المطبخ (KDS)، وكيفية تشخيص الأعطال المرتبطة بتزامن الطلبات.

## 1. ما هي قناة الفرع؟

* كل فرع يملك قناة معرفّة (`branch-channel`) تستخدم كجزء من أسماء موضوعات الـ WebSocket بحيث لا تختلط طلبات الفروع المختلفة.
* مثال على موضوع نشر الطلبات: `branch-main:pos:kds:orders` حيث `branch-main` هو معرف الفرع، و `pos:kds:orders` هو اسم الحدث.【F:pos.js†L2177-L2183】【F:kds.js†L1621-L1687】
* يتم تعيين القناة افتراضيًا من إعدادات الموك (`settings.sync.channel`) ثم تُطبَّع وتُخزَّن في `window.MishkahBranchChannel` داخل POS و `window.MishkahKdsChannel` داخل KDS لسهولة التبديل اليدوي.【F:pos.js†L293-L312】【F:kds.js†L1203-L1214】

## 2. مصادر البيانات المشتركة بين POS و KDS

* ملف `pos-mock-data.js` يعرّف القوائم، الأقسام، التصنيفات… إلخ ويحقنها في `window.database`.
* ملف `kds-mock-data.js` ينسخ نفس البيانات إلى `kdsDatabase.master` ويغذي KDS بها حتى عند العمل دون خادم حقيقي، مع الحفاظ على القناة والإعدادات المتطابقة.【F:kds-mock-data.js†L1-L150】【F:kds-mock-data.js†L200-L244】
* صفحة `kds.html` تحمل الآن `pos-mock-data.js` قبل `kds-mock-data.js` لضمان أن المصدرين يشتركان في نفس الموك قبل بدء التشغيل.【F:kds.html†L17-L23】

## 3. كيفية تغيير القناة عند تجهيز نسخة فرع جديدة

1. عدّل قيمة `settings.sync.channel` داخل `pos-mock-data.js`، أو التقط القيمة من إعدادات الفرع في قاعدة البيانات في حال تشغيل التطبيق مع API فعلي.【F:pos-mock-data.js†L23-L40】
2. عند الحاجة إلى تعديل سريع دون بناء جديد، يمكنك إسناد `window.MishkahBranchChannel = 'branch-east';` في شاشة POS، و `window.MishkahKdsChannel = 'branch-east';` في شاشة KDS، ثم إعادة تحميل الصفحتين.
3. تأكد من أن إعدادات الـ WebSocket (`settings.sync.ws_endpoint`) تشير إلى نفس الخادم في الفرعين.

> ملاحظة: أي فرع جديد يجب أن يحمل قناة فريدة وخالية من الفراغات؛ الدالة `normalizeChannelName` في كلا التطبيقين تحول القناة إلى حروف إنجليزية صغيرة مع استبدال المسافات بشرطة لضمان سلامة العناوين.【F:pos.js†L302-L306】【F:kds.js†L44-L52】

## 4. مسار الأحداث بين POS و KDS

| المصدر | الوسيط | نوع الرسالة | الوصف |
|--------|--------|-------------|-------|
| POS → KDS | WebSocket + BroadcastChannel | `orders:payload` | نشر الطلب الجديد وجداول `jobOrders` مع بيانات الماستر المحدثة. عند غياب الخادم يتم الاكتفاء بـ BroadcastChannel المحلي. |【F:pos.js†L2109-L2295】【F:kds.js†L1498-L1685】
| POS ↔︎ KDS | BroadcastChannel `mishkah-pos-kds-sync` | `job:update`, `handoff:update`, `delivery:update` | تحديثات الحالة اللحظية بين الصفحتين عند العمل في المتصفح نفسه. |【F:pos.js†L2883-L2917】【F:kds.js†L1308-L1356】【F:kds.js†L1373-L1474】
| KDS → POS | BroadcastChannel | نفس الرسائل أعلاه | تسمح بإرجاع حالة خطوط التحضير إلى شاشة POS بدون انتظار الخادم. |【F:kds.js†L1308-L1356】

## 5. لماذا توقفت الطلبات عن الظهور في شاشة المطبخ؟

* في التحديث السابق تم حذف `mock jobOrders` من `kds-mock-data.js` للاعتماد على المزامنة الحية، لكن لم يكن هناك مسار احتياطي عندما يكون الخادم غير متوفر، فبقيت KDS بلا أوامر.
* الإصلاح الحالي يعتمد على مسارين:
  1. مشاركة نفس بيانات الماستر بين POS و KDS عبر الموك الموحد والمُعرّف في `kdsDatabase.master`.
  2. قناة محلية (`BroadcastChannel`) تنشر كل الطلبات والتحديثات فورًا، وتستقبلها KDS حتى في حالة عدم وجود WebSocket فعال.【F:pos.js†L2883-L2917】【F:kds.js†L1308-L1356】

## 6. قائمة الرسائل المحلية (BroadcastChannel)

* `type: 'orders:payload'` — يحمل هيكل الطلب الكامل (`jobOrders`, `master`, `deliveries`).
* `type: 'job:update'` — تحديث حالة Job واحد (بدء، جاهز، مكتمل).
* `type: 'handoff:update'` — تغيير حالة التسليم/التجميع.
* `type: 'delivery:update'` — تخصيص سائق أو تسوية طلب دليفري.

> جميع الرسائل ترسل مع `meta.channel` و`meta.publishedAt` لتوضيح الفرع وطابع الزمن، ويمكن رصدها وتعديلها بسهولة من خلال `emitLocalKdsMessage` في POS أو `emitSync` في KDS.【F:pos.js†L2109-L2295】【F:kds.js†L1340-L1685】

## 7. نصائح تشخيص سريعة

1. **تحقق من القناة:** افتح Console واكتب `window.MishkahBranchChannel` و `window.MishkahKdsChannel`، يجب أن تكون القيم متطابقة.
2. **اختبر القناة المحلية:** افتح نافذتين للمتصفح على نفس الجهاز، أنشئ طلبًا في POS، ثم راقب `BroadcastChannel` من خلال `localStorage` أو أدوات DevTools (tab Application → BroadcastChannel).
3. **تأكيد وصول الماستر:** في KDS استخدم `window.database.kds.master` للتحقق من أن الأقسام، التصنيفات، الأصناف تم تحميلها من نفس المصدر.【F:kds-mock-data.js†L200-L244】

باتباع هذا الدليل يمكن التحكم في قنوات الفروع وضمان عمل التزامن بين POS و KDS حتى في بيئات التطوير بدون خادم فعلي.
