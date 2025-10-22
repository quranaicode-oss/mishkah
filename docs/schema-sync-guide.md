# مزامنة مخططات POS وKDS

يوضح هذا الدليل كيفية تحميل مخططات قاعدة البيانات الموروثة لكلٍ من الـ POS و KDS ضمن بيئة Mishkah، وكيفية التأكد من بقاء تعريفات الخادم والمتصفح متزامنة.

## تحميل المخططات من الوحدة الجديدة

- توجد وحدة التحميل في `ws2/src/schema/legacy-loader.js`.
- تقوم الدالة `loadLegacySchemas()` بقراءة ملفي `schema-pos.js` و`schema-kds.js` ضمن الجذر وتشغيلهما في سياق معزول قبل إعادة كائنات JSON نقية.
- يمكن توليد بيانات وصفية خفيفة الوزن عبر `buildSchemaManifest()` أو `loadLegacyManifest()`، وهي مثالية لتغذية الواجهات أو سكربتات التحقق.

### مثال سريع

```js
import { loadLegacyManifest } from '../ws2/src/schema/legacy-loader.js';

const manifest = await loadLegacyManifest();
console.log(manifest.schemas.pos.tables.length);
```

## استهلاك المخطط داخل الواجهات

- يقوم كل من `pos.html` و `kds.html` بتحميل الملف `schema-manifest.json` أثناء Bootstrap الأولي.
- تتوفر النتيجة في `window.MishkahSchemaManifest`، كما يمكن انتظار `window.MishkahSchemaManifestPromise` قبل استخدام الجداول داخل تطبيقات Mishkah.

## ملف manifest الجاهز

- يتم حفظ قائمة الجداول والإصدارات في `schema-manifest.json` داخل جذر المستودع.
- يحتوي الملف على خصائص `version`، و`generatedAt`، وقسم `schemas` الذي يحصي الجداول لكل نظام.

## سكربت التحقق من التزامن

- يوجد سكربت Node في `ws2/scripts/check-schema-sync.js`.
- للتشغيل:

```bash
node ws2/scripts/check-schema-sync.js
```

- يتحقق السكربت من أن `schema-manifest.json` يعكس آخر تعريفات POS/KDS في ملفات المصدر. سيطبع تقريرًا موجزًا ويعيد رمز خروج 0 عند النجاح، أو 1 عند وجود اختلاف.
