# Mishkah POS/KDS Central Sync Playbook

> **هدف المستند:** شرح آلية المزامنة المركزية الجديدة بالتفصيل للمطورين (Developers) ولمديري الفروع/المستخدمين (Operators). المستند ثنائي اللغة، وكل قسم يحوي شرحًا بالعربية والإنجليزية لضمان وضوح كامل.

## 1. نظرة عامة · Overview

**العربية:**
نظام المزامنة المركزي يجعل نسخة قاعدة بيانات الـ POS/KDS الوحيدة موجودة على خادم WebSocket. كل جهاز (POS أو KDS) يقوم بتحميل نسخة محدثة من البيانات عند التشغيل، ثم يُرسل أي تغيير إلى الخادم ليعيد توزيعه على بقية الأجهزة. لا توجد كتابة مباشرة محلية دون المرور بالمخدم، ما يمنع تكرار أرقام الفواتير أو اختلاف الحالات بين الأجهزة.

**English:**
The central sync service promotes the WebSocket server to the single source of truth for POS/KDS state. Each client fetches a fresh snapshot when it starts, then streams every mutation through the server. The server queues the writes, persists the latest snapshot to disk, and broadcasts the new state back to every online device so that all IndexedDB replicas stay byte-identical.

## 2. المكونات الرئيسية · Core Components

| Role | Description |
| --- | --- |
| **POS/KDS Clients** | Export and import IndexedDB snapshots using the Mishkah adapter, and only mutate through the central sync runner.【F:pos.js†L2361-L2709】 |
| **WebSocket Gateway** | Validates publishes to topics that match `pos:sync:<branch>`, persists snapshots, and re-broadcasts `apply` payloads with version numbers.【F:ws/src/index.js†L540-L618】 |
| **PosSyncStore** | File-backed store that keeps the latest live snapshot per branch and archives every previous version for auditing.【F:ws/src/services/pos-sync-store.js†L1-L109】【F:ws/src/services/pos-sync-store.js†L118-L194】 |

## 3. تهيئة الخادم · Server Setup

- **مجلدات التخزين:** يمكن ضبط المسارات عبر المتغيرات البيئية `POS_SYNC_LIVE_DIR` و`POS_SYNC_HISTORY_DIR`. يتم إنشاء المجلدين تلقائيًا ويحفظان أحدث نسخة وأرشيفًا بتاريخ/نسخة لكل فرع.【F:ws/src/index.js†L24-L60】【F:ws/src/services/pos-sync-store.js†L23-L63】
- **تهيئة الذاكرة:** عند الإقلاع يقوم `PosSyncStore.init()` بقراءة جميع ملفات الـ JSON الموجودة في مجلد `live` لإعادة تحميل الإصدارات الحالية إلى الذاكرة.【F:ws/src/services/pos-sync-store.js†L31-L62】
- **واجهات HTTP:**
  - `GET /api/pos-sync/:branch` لإعادة أحدث نسخة (تُستخدم في المزامنة الأولية).
  - `POST /api/pos-sync/:branch/snapshot` لتخزين نسخة صريحة قادمة من نظام خارجي.
  - `POST /api/pos-sync/:branch/clear` لمسح البيانات مع أرشفتها تلقائيًا.【F:ws/src/index.js†L854-L908】
- **مجلد التاريخ:** كل عملية `snapshot` مع خيار `archive` أو أي `destroy` تُنتج ملف JSON جديدًا في `history/<branch>/<version>-<timestamp>.json` يمكن استعادته يدويًا عند الحاجة.【F:ws/src/services/pos-sync-store.js†L64-L111】【F:ws/src/services/pos-sync-store.js†L144-L193】

## 4. تدفق العمل على الخادم · Server Mutation Flow

1. يستقبل الخادم رسالة WebSocket من أي جهاز على قناة `pos:sync:<branch>`.
2. يتم التحقق من الحمولة (إما `snapshot` أو `destroy`) عبر مخطط Zod. في حالة `snapshot` يتم التأكد من رقم الإصدار الأساسي لمنع تضارب الإصدارات.【F:ws/src/index.js†L568-L607】
3. `PosSyncStore` يضع التغيير في طابور متسلسل خاص بالفرع (`enqueue`) لضمان تنفيذ العمليات واحدة تلو الأخرى حتى لو وصلت من عدة أجهزة في نفس اللحظة.【F:ws/src/services/pos-sync-store.js†L92-L117】
4. عند نجاح الكتابة يتم بث رسالة `apply` مع `version` و`snapshot` إلى كل المشتركين في الفرع نفسه، ويُرسل تأكيد (`ack`) للجهاز الذي طلب العملية.【F:ws/src/index.js†L600-L618】
5. إذا فشل التحقق أو حدث تضارب، يُرسل الخادم خطأ برمز `pos_sync_conflict` مع النسخة الحالية ليتعامل العميل مع إعادة التحميل.【F:ws/src/index.js†L588-L599】

## 5. دورة حياة العميل · Client Lifecycle

### 5.1 المزامنة الأولية · Initial Sync

- كل POS يبدأ باستدعاء `centralSync.ensureInitialSync()` التي تتصل بـ `GET /api/pos-sync/:branch` ثم تستورد النسخة إلى IndexedDB قبل السماح لأي عمليات محلية.【F:pos.js†L2412-L2444】【F:pos.js†L2455-L2498】
- حالة الاتصال تُبث إلى الواجهة لعرض شارة "مزامنة مركزية" مع وقت آخر تحديث، وتظهر رسالة خطأ إذا كان الخادم غير متاح.【F:pos.js†L2656-L2686】【F:pos.js†L4660-L4675】

### 5.2 طابور الحفظ · Mutation Queue

- أي تعديل لقاعدة البيانات (حفظ طلب، إغلاق وردية، إلخ) يُغلف بواسطة `centralSync.run(...)`.
- `run` ينتظر انتهاء المزامنة الأولية، ويتأكد أن الاتصال قائم، ثم ينفذ العملية المحلية ويقوم فورًا بإرسال Snapshot للخادم.
- الطلبات تُنفذ بالتسلسل باستخدام Promise queue بحيث ينتظر كل استدعاء انتهاء ما قبله قبل بدء الجديد، محققًا "الطابور" المطلوب.【F:pos.js†L2510-L2576】【F:pos.js†L2598-L2645】

### 5.3 استقبال التحديثات · Handling Broadcasts

- عند استقبال رسالة `apply` من الخادم، يستورد العميل الـ snapshot الجديدة ويحدّث رقم الإصدار والوقت الأخير للمزامنة. يتم أيضًا حل أي عملية "حفظ" كانت تنتظر التأكيد عبر `mutationId` لضمان عدم تكرار التنفيذ.【F:pos.js†L2486-L2524】

### 5.4 مسح البيانات · Destroy/Reset

- عند تنفيذ `posDB.resetAll()` يقوم النظام بإرسال رسالة `destroy` إلى الخادم، الذي بدوره يمسح نسخة الفرع ويُبث `cleared: true` لبقية الأجهزة، ثم يضبط قاعدة بيانات كل جهاز على الحالة الفارغة نفسها.【F:pos.js†L2578-L2637】【F:ws/src/index.js†L568-L584】

### 5.5 التعامل مع انقطاع الاتصال · Offline Handling

- إذا فقد WebSocket الاتصال أو تعذر الوصول إلى الخادم، يتم رفض أي طلب حفظ بخطأ `POS_SYNC_OFFLINE` وتظهر Toast واضحة للمستخدم، مما يمنع إنشاء طلبات غير متزامنة.【F:pos.js†L2528-L2576】【F:pos.js†L4660-L4675】

## 6. تكامل KDS · KDS Integration

- رسائل الـ KDS ما تزال تُرسل عبر قنواتها (`pos:kds:orders`, إلخ) لكن كل أوامر POS يتم حفظها بعد التأكد من تأكيد الخادم. هذا يضمن أن أي شاشة KDS مرتبطة بنفس الفرع تستقبل نسخة متسقة لأن جميع الطلبات تم اعتمادها مركزيًا قبل البث.【F:pos.js†L2723-L3058】

## 7. إرشادات للمطورين · Developer Checklist

1. **استخدام المحول الرسمي:** تأكد أن أي عميل جديد يستخدم adapter يدعم `exportSnapshot` و`importSnapshot`. بدون ذلك سيتحول النظام إلى وضع `disabled`.【F:pos.js†L2361-L2381】
2. **مواضيع الفروع:** استخدم أسماء فروع منسقة (`normalizeChannelName`) حتى لا تتعارض المواضيع بين الفروع المختلفة.【F:pos.js†L2369-L2380】【F:ws/src/index.js†L560-L567】
3. **التعامل مع الأخطاء:** التقط أخطاء `POS_SYNC_TIMEOUT` أو `POS_SYNC_OFFLINE` لإرشاد المستخدمين لإعادة الاتصال قبل إعادة المحاولة.【F:pos.js†L2416-L2444】【F:pos.js†L2528-L2576】
4. **الأرشفة:** عند عمليات استيراد ضخمة أو تنظيف مجدول استخدم `archive: true` حتى يتم حفظ النسخة السابقة في مجلد التاريخ تلقائيًا.【F:ws/src/services/pos-sync-store.js†L144-L193】

## 8. إرشادات للمستخدمين ومديري الفروع · Operator Playbook

- **مؤشر الحالة:** ابحث عن شارة "المزامنة المركزية" في شاشة POS. اللون الأخضر يعني اتصال نشط، الرمادي يعني انتظار الاتصال، والأحمر يعني أن النظام لن يسمح بالحفظ حتى يعود الاتصال.【F:pos.js†L2656-L2686】【F:pos.js†L4660-L4675】
- **التزامن الفوري:** عند حفظ طلب كبير قد تلاحظ تأخيرًا بسيطًا، هذا طبيعي لأنه ينتظر تأكيد الخادم لضمان تتابع الفواتير.
- **انقطاع الشبكة:** إذا ظهرت رسالة "الخادم المركزي غير متصل" فلا يمكن إدخال طلبات جديدة. تحقق من الاتصال أو تواصل مع الدعم لإعادة تشغيل خدمة الـ WS.
- **استرجاع نسخة قديمة:** يمكن لفريق الدعم أخذ ملف JSON من مجلد `history/<branch>/...` وإرساله إلى الخادم عبر واجهة `POST /api/pos-sync/:branch/snapshot` لإعادة تحميل أي نسخة محفوظة تاريخيًا.【F:ws/src/services/pos-sync-store.js†L64-L111】【F:ws/src/index.js†L876-L908】

## 9. استكشاف الأخطاء · Troubleshooting

| Symptom | Likely Cause | Resolution |
| --- | --- | --- |
| Toast `تعذر حفظ الطلب` مع تنبيه الانقطاع | WebSocket غير متصل | تحقق من اتصال الإنترنت، ثم أعد تحميل الشاشة بعد التأكد من عمل الخادم.【F:pos.js†L2528-L2576】【F:pos.js†L4660-L4675】 |
| تظهر رسالة تضارب نسخة (HTTP 409) | جهاز يعمل على نسخة أقدم من قاعدة البيانات | أعد تشغيل الجهاز لإعادة تحميل snapshot من الخادم.【F:ws/src/index.js†L588-L599】 |
| ملفات `live` لا تتحدث | فشل عملية `persistLive` | تحقق من صلاحيات الكتابة للمجلد المحدد في `POS_SYNC_LIVE_DIR`. سجل الخادم سيحوي رسالة `POS sync branch mutation failed`.【F:ws/src/services/pos-sync-store.js†L92-L117】 |

## 10. روابط سريعة · Quick References

- WebSocket Topic Pattern: `pos:sync:<branch>`
- HTTP Base: `/api/pos-sync`
- Error Codes: `POS_SYNC_OFFLINE`, `POS_SYNC_TIMEOUT`, `pos_sync_conflict`
- Storage Structure: `live/<branch>.json`, `history/<branch>/<version>-<timestamp>.json`

> **ملاحظات ختامية:**
> - يُنصح بتشغيل خدمة الـ WS مع مراقبة للملفات (log rotation) لضمان عدم امتلاء مجلد التاريخ.
> - تأكد من عمل Redis عند النشر الأفقي حتى يصل البث لكل نسخ الخادم.【F:ws/src/index.js†L780-L828】

