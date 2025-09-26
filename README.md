

### Mishkah v5.5: مكتبة الواجهات الأمامية المنهجية

الإصدار النهائي المستقر، موجه لبناء واجهات عالية الأداء على فلسفة **الحقيقة الواحدة + الكيانات الجراحية**.

-----

## لماذا Mishkah؟ بيان ضد التعقيد الزائف

في عالم تسيطر عليه أطر عمل ضخمة بُنيت لفرق عمل متعددة الجنسيات، فُرض على المبرمج الفردي والفرق الصغيرة "ضريبة" لم يطلبوها. فوضى hooks المتناثرة في React، والهياكل الهرمية الصارمة في Angular، كلها حلول لمشاكل لا تواجهها غالبية المشاريع. إنها أدوات كبلت المبرمج بقيود هندسية معقدة، وحولت متعة الإنجاز السريع إلى معاناة مع طبقات من الوسائط والكهنوت البرمجي.

`Mishkah v5.5` هي عودة إلى المبادئ الأولى. إنها ليست مجرد مكتبة، بل هي بيئة منعزلة تفرض قوانينها الخاصة لمنع الفوضى، مع الحفاظ على البساطة والسرعة. هي ترفض فكرة أن القوة تأتي من التعقيد، وتقدم مسارًا واضحًا مبنيًا على فلسفة صارمة.

-----

## فلسفة مشكاة: ثلاثة أركان للحكم

تتكون فلسفة مشكاة من ثلاثة أركان أساسية تعمل معًا بتناغم:

**1. الحقيقة العليا الواحدة (The Single Truth)**

في `Mishkah`، هناك مصدر واحد فقط للحقيقة: `app.truth`. هو "اللوح المحفوظ" الذي يحتوي على حالة التطبيق بأكملها. لا توجد حالة محلية، لا توجد فوضى. أي تغيير يجب أن يمر عبر هذا المصدر المركزي من خلال الأوامر (`commands`)، مما يضمن نظامًا مطلقًا يمكن التنبؤ به.

**2. التحديث الجراحي للكيانات (Surgical Entity Updates)**

بدلاً من إعادة بناء "كون" افتراضي كامل (VDOM) ومقارنته بالواقع لتحديد التغييرات، تعتمد `Mishkah` على نموذج أكثر دقة. الواجهة عبارة عن مجموعة من الكيانات (`Entities`) المسجلة والمستقلة. عندما تتغير "الحقيقة العليا"، لا نعيد بناء كل شيء. بل نرسل أمرًا مباشرًا ودقيقًا للكيان المتأثر فقط: `app.truth.mark('#entity-key')`. هذا هو التحديث الجراحي، فعال، سريع، وبدون وسائط.

**3. الرقيب الدائم والحارس الأمين (Guardian & Auditor)**

تتركك الأطر الأخرى لتكتشف مشاكل الأداء بنفسك بعد فوات الأوان. `Mishkah` تأتي مع "رقيب" مدمج. الـ `Guardian` يفرض سياسات الأداء، والـ `Auditor` يسجل كل عملية. يمكنك تحديد "ميزانية زمنية" لكل كيان، وإذا تجاوزها، يُصدر "الرقيب" تحذيرًا. هذا ليس رفاهية، بل هو جزء لا يتجزأ من النظام لضمان بقاء التطبيق سريعًا.

-----

## مقارنة شاملة (Mishkah v5.5)

| المفهوم | Mishkah v5.5 | React | Angular |
| :--- | :--- | :--- | :--- |
| **مصدر الحقيقة** | حقيقة عليا واحدة (`app.truth`) | متحكمات مشرذمة متنازعة (`useState`, `useContext`...) | بيروقراطية متغولة متشعبة (Services, DI, RxJS) |
| **آلية التحديث** | أمر مباشر وجراحي (`mark`, `rebuild`) | VDOM Diffing (مكلف وغير مباشر) | Change Detection (معقد ومرتبط بـ Zones) |
| **إدارة الأداء** | رقيب دائم وحارس أمين (مدمج) | أدوات خارجية (Profiler) تحتاج تفعيلًا يدويًا | أدوات خارجية وتحتاج خبرة عميقة |
| **التعامل مع الأحداث** | تفويض مباشر ووصفي (`data-onclick`) | تعريف يدوي لكل مكون (`onClick={fn}`) | تعريف يدوي وربط معقد |
| **بيئة العمل** | واعية باللغة والثيم (RTL/Theme-aware) | تتطلب مكتبات إضافية وجهدًا يدويًا | تتطلب إعدادات معقدة ومكتبات إضافية |
| **مثالي لـ** | المبرمج الفردي والفرق الصغيرة والمتوسطة | بني لخدمة فرق مختلفة في شركات ضخمة | بني بفكر شركات تفرض طبقات إدارية وبيروقراطية |

-----

## البدء السريع (نموذج الكيانات والمكوّنات)

شاهد كيف تترجم الفلسفة النقية إلى كود أبسط وأكثر قوة.

**1. هيكل HTML (أبسط ما يمكن):**

```html
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Mishkah App</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 text-gray-900">
    <div id="app"></div>

    <script src="./mishkah-utils-v5.js"></script>
    <script src="./mishkah-dsl-v5.js"></script>
    <script src="./mishkah-comp-v5.js"></script>
    <script src="./mishkah-core-v5.5.js"></script>
    <script src="./app.js"></script>
</body>
</html>
```

**2. تهيئة التطبيق (ملف `app.js`):**

```javascript
const { Core, Comp: C, Atoms: A } = window.Mishkah;

// 1. تعريف المكونات
C.define('Header', (A, state, app) => {
    return A.header({ tw: 'p-4 bg-white shadow' }, {
        default: [ `مرحباً، ${state.user.name}` ]
    });
});

C.define('Counter', (A, state, app) => {
    return A.main({ tw: 'p-8 text-center' }, {
        default: [
            A.h1({ tw: 'text-6xl font-bold text-blue-600' }, { default: [state.counter] }),
            A.Button({ 
                'data-onclick': 'increment',
                tw: 'mt-6 px-6 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600'
            }, { default: [ 'زيادة +1' ] })
        ]
    });
});

// المكون الجذري الذي يجمع الكيانات
C.define('AppRoot', (A, state, app) => {
    return A.Div({ tw: 'max-w-md mx-auto mt-10' }, {
        default: [
            // 2. استدعاء المكونات وتسجيلها ككيانات
            C.call('Header', { uniqueKey: 'main-header' }),
            C.call('Counter', { uniqueKey: 'main-counter' })
        ]
    });
});

// 3. إنشاء التطبيق
const app = Core.createApp({
  mount: '#app',
  rootComponent: 'AppRoot',
  initial: {
    user: { name: 'Sultan' },
    counter: 0
  },
  commands: {
    increment: ({ truth }) => {
      truth.batch(() => {
          const currentCounter = truth.get().counter;
          truth.set(s => ({ ...s, counter: currentCounter + 1 }));
          truth.mark('#main-counter');
      });
    }
  }
});
```

-----

## المفاهيم الأساسية لـ v5.5

  * **Truth (الحقيقة):** حالة مركزية لا تتغير إلا عبر الأوامر (`commands`). استخدم `truth.batch()` لتجميع عدة تغييرات في تحديث واحد.
  * **Entity (الكيان):** أي مكوّن (`Component`) يتم استدعاؤه مع خاصية `uniqueKey` يصبح كيانًا مسجلاً ومعروفًا لدى النواة، ويمكن مخاطبته مباشرة عبر `mark` أو `rebuild`.
  * **Attribute Delegation (التفويض):** استخدم `data-onclick="commandName"` في عناصر HTML داخل المكونات لربط الأحداث بالأوامر بشكل وصفي.
  * **Devtools (أدوات المطور):** استخدم `app.devtools.printSummary()` في أي وقت لطباعة تقرير أداء مفصل عن كل كيان.

-----

## أفضل الممارسات في v5.5

  * **فكّر بالكيانات:** قسّم واجهتك إلى مكونات مستقلة، وسجّل تلك التي تحتاج إلى تحديثات مستقلة ككيانات عبر `uniqueKey`.
  * **استخدم `Comp` أولاً:** اعتمد على مكتبة المكونات الجاهزة (`mishkah-comp-v5.js`) قدر الإمكان. لا تستخدم `Atoms` إلا لبناء الهياكل الأساسية داخل المكونات.
  * **اجعل `buildFn` غبية:** يجب أن تقتصر دالة بناء المكون على وصف الواجهة بناءً على الحالة الحالية. كل المنطق يجب أن يكون في `commands`.
  * **علّم أصغر نطاق:** بعد كل تغيير في `truth`، استهدف أصغر عدد ممكن من الكيانات عبر `truth.mark()`.

-----

## ترتيب تحميل الملفات

للتشغيل بدون أدوات بناء (bundlers)، تأكد من تحميل الملفات بهذا الترتيب في ملف HTML:

1.  `mishkah-utils-v5.js`
2.  `mishkah-dsl-v5.js` (يوفر Atoms)
3.  `mishkah-comp-v5.js`
4.  `mishkah-core-v5.5.js` (أو أحدث إصدار مستقر)

-----

*هذا المشروع متاح للاستخدام العام بشرط ذكر المصدر.*
*© 2025 ماس للبرمجيات (MAS for Programming)*

-----


# دليل مثال متقدم
إعطاءك خطوات واضحة وقابلة للتنفيذ لاستخدام **Mishkah v5** لبناء واجهة تعمل فورًا. لا تفاصيل داخلية—فقط ما يلزمك لتشغيل، ربط أحداث، وتحديث أجزاء الواجهة بدقة.

---

## المتطلبات السريعة
1) ملف HTML بسيط يحوي:
   - حاوية: `<div id="app"></div>`
   - مكتبات مشكاة: `mishkah-utils-v5.js`, `mishkah-dsl-v5.js`, `mishkah-comp-v5.js`, `mishkah-core-v5.js` (و/أو ما يقابلها ببيئتك)
   - Tailwind أو CSS الخاص بك (اختياري لكن مُستحسن)

2) مصدر بيانات أولي (إن لزم)، مثل `window.database = { ... }`.

---

## إنشاء التطبيق
استخدم `Core.createApp` مرة واحدة:
```js
const { Core, Comp: C } = window.Mishkah

const app = Core.createApp({
  mount: '#app',            // أين تُركِّب التطبيق
  rootComponent: 'AppRoot', // اسم المكوّن الجذر عندك
  locale: 'ar', dir: 'auto', theme: 'auto', persistEnv: true,
  dictionaries: {
    app: { title: { ar: 'تطبيقي', en: 'My App' } },
    ui:  { add:   { ar: 'إضافة', en: 'Add' } }
  },
  initial: { env: { }, /* حالتك الأولية */ },
  commands: { /* ستضيف أوامرك هنا */ }
})
```

> ملاحظة: الترجمة عبر `app.i18n.t(key)` واللغة الحالية من `app.env.getLocale()`.

---

## بناء الواجهة (Comp فقط قدر الإمكان)
- عرّف مكوناتك عبر `C.define('Name', (A, state, app, props)=>{ ... })`.
- عند **استدعاء** أي مكوّن وتريد تحديثه بالاسم لاحقًا—**سَجِّله** بمفتاح **`id`**:

```js
C.call('Header',   { id: 'pos-header' })
C.call('MenuGrid', { id: 'menu-panel' })
C.call('Order',    { id: 'order-panel' })
C.call('Footer',   { id: 'footer-bar' })
```

- لو لديك مكوّنات أبناء داخل أب، ببساطة **استدعِ الابن داخل بناء الأب**:
```js
C.define('Content', (A, s, app) => {
  return A.Div({}, { default: [
    /* ... */
    C.call('Order', { id: 'order-panel' }), // سيظهر هنا ويستمر عبر تحديثات الأب
    /* ... */
  ]})
})
```

- يمكنك تصنيف كيانات متعددة معًا بـ `groupKey` لاستهدافها دفعة واحدة:
```js
C.call('SideWidget', { id:'w1', groupKey:'right-side' })
C.call('SideWidget', { id:'w2', groupKey:'right-side' })
```

---

## ربط الأحداث
ضع الحدث على **العنصر القابل للنقر** عبر أي من الطريقتين:

1) سمات مباشرة:
```js
C.call('Button', { 'data-onclick':'addToOrder', text:'+' })
```

2) Props مريحة تُحوَّل تلقائيًا:
```js
C.call('Button', { onClick:'addToOrder', text:'+' })
C.call('Input',  { onInput:'setSearch',  placeholder:'ابحث...' })
```

> في الأمر، استخرج البيانات من `element.dataset` أو `getAttribute('data-...')`.

---

## أوامر (Commands) — القالب القياسي
كل تعديل للحالة يتم عبر أمر. بعد التعديل، **علِّم أصغر نطاق متأثِّر**.

### قالب عام
```js
const commands = {
  someAction: ({ truth }, e, el) => {
    truth.batch(() => {
      truth.set(s => ({ ...s, /* عدّل حالتك هنا */ }))
      truth.mark('#target-entity') // أو مصفوفة مفاتيح
    })
  }
}
```

### أدوات التعليم
- `truth.mark(selectors, { except })` تحديث سريع للكيانات المستهدفة.
- `truth.rebuild(selectors, { except })` إعادة بناء كاملة.
- `truth.rebuildAll()` يستعمل عادة تلقائيًا عند تغيير اللغة/الثيم.
- `truth.rebuildAllExcept(list)` لإعادة بناء عامة مع استثناءات محددة.

> `selectors` تقبل: `'#id'`, `'id'`, أو `'.group'` (مجموعة).

---

## البيئة (Env) واللغة/الثيم
- اللغة الحالية: `app.env.getLocale()`
- تغيير اللغة: `app.env.setLocale('en')` (تنعكس تلقائيًا على النصوص)
- تبديل الثيم: `app.env.toggleTheme()`
- ترجمة نص: `app.i18n.t('app.title')`

لا تحتاج إلى أي تعليم يدوي عند تغيير اللغة/الثيم—سيُعاد التحديث تلقائيًا.

---

## أنماط جاهزة (نسخ-لصق)

### 1) بحث يحدّث قائمة
```js
setSearch: ({ truth }, e) => {
  const q = e?.target?.value || ''
  truth.batch(() => {
    truth.set(s => ({ ...s, env:{ ...s.env, search:q } }))
    truth.mark('#menu-panel')
  })
}
```

### 2) اختيار تصنيف
```js
selectCategory: ({ truth }, e, el) => {
  const id = el?.getAttribute('data-id') || 'all'
  truth.batch(() => {
    truth.set(s => ({ ...s, env:{ ...s.env, category:id } }))
    truth.mark('#menu-panel')
  })
}
```

### 3) إضافة إلى الطلب
```js
addToOrder: ({ truth, env }, e, el) => {
  const itemId = +(el?.dataset?.itemid || 0)
  if (!itemId) return
  const item = (window.database?.items||[]).find(x => +x.id === itemId)
  if (!item) return
  const loc = (env.getLocale()||'ar').split('-')[0]

  truth.batch(() => {
    truth.set(s => {
      const o = s.order || { id:'o1', type:'dine_in', status:'new', lines:[], totals:{ sub:0, service:0, vat:0, grand:0 } }
      const name = item.translations?.[loc]?.name || item.translations?.en?.name || String(item.id)
      const ex = o.lines.find(l => l.item_id === itemId)
      const lines = ex ? o.lines.map(l => l===ex ? { ...l, qty:l.qty+1 } : l)
                       : [...o.lines, { id: Date.now()+'' , item_id:itemId, title:name, qty:1, price:+item.price||0, modDelta:0 }]
      const totals = computeTotals(lines, o.type)
      return { ...s, order:{ ...o, lines, totals } }
    })
    truth.mark(['#order-panel','#footer-bar'])
  })
}
```

> اجعل `computeTotals` دالة نقية ترجع `{ sub, service, vat, grand }`.

---

## أفضل الممارسات
- استخدم **Comp الجاهزة** أولًا (Button, Input, Chip, Badge, ...). قلّل استخدام Atoms للضرورة فقط.
- **سجّل الكيان بـ `id` عند الاستدعاء** وليس داخل المكوّن.
- بعد كل تعديل مؤثر على الواجهة: **علِّم فقط الكيانات المتأثرة**.
- لا تعدّل الحالة خارج الأوامر.
- عند النصوص، استخدم دائمًا `i18n.t(...)`.

---

## قائمة فحص سريعة
- [ ] هل الكيان الذي تريد تحديثه مسجَّل بـ `id` عند استدعائه؟
- [ ] هل الحدث موجود على العنصر القابل للنقر (`onClick` أو `data-onclick` مباشرة)؟
- [ ] هل أعدت من `truth.set` كائن حالة جديد؟
- [ ] هل علّمت أصغر نطاق متأثّر عبر `truth.mark(...)`؟
- [ ] للّغة/الثيم استخدم `env`—لا تعليم يدوي مطلوب.

---

## مثال جذر مختصر
```html
<div id="app"></div>
<script>
  const { Core, Comp: C } = window.Mishkah

  C.define('Header', (A, s, app) => A.Div({ tw:'p-3 font-bold' }, { default:[ app.i18n.t('app.title') ] }))
  C.define('MenuGrid', (A, s, app) => A.Div({ }, { default:[/* عناصر */] }))
  C.define('Order', (A, s, app) => A.Div({}, { default:[/* سلة */] }))
  C.define('Footer', (A, s, app) => A.Div({ tw:'p-3' }, { default:[ '...' ] }))
  C.define('AppRoot', (A, s, app) => A.Div({}, { default:[
    C.call('Header', { id:'pos-header' }),
    C.call('MenuGrid', { id:'menu-panel' }),
    C.call('Order', { id:'order-panel' }),
    C.call('Footer', { id:'footer-bar' })
  ]}))

  function computeTotals(lines){
    const sub = (lines||[]).reduce((a,l)=> a + ((+l.price||0)+(+l.modDelta||0))*((+l.qty)||0), 0)
    const service = sub * (+window.database?.settings?.service_charge_rate||0)
    const vat = (sub + service) * (+window.database?.settings?.tax_rate||0)
    return { sub:+sub, service:+service, vat:+vat, grand: +(sub+service+vat) }
  }

  const app = Core.createApp({
    mount:'#app', rootComponent:'AppRoot', locale:'ar', persistEnv:true,
    dictionaries:{ app:{ title:{ ar:'تجربة مشكاة', en:'Mishkah Demo' } } },
    initial:{ env:{}, order:{ id:'o1', type:'dine_in', status:'new', lines:[], totals:{ sub:0, service:0, vat:0, grand:0 } } },
    commands:{ /* أوامرك هنا */ }
  })
</script>
```

---

## خاتمة
اتّبع الخطوات كما هي: سجّل الكيانات بـ`id` عند الاستدعاء، اربط الأحداث بـ`onClick`/`data-on*`، عدّل الحالة عبر أووامر فقط، وعلّم أصغر نطاق متأثّر. بهذه الطريقة ستحصل على واجهة مستقرة، سريعة، وسهلة الصيانة.



---

## دليل عملي مركّز (تنفيذ بلا تشتيت)

### 1) ربط الأحداث — طريقة واحدة فقط (الموصى بها)
> استخدم **Props مريحة** دائمًا؛ لا تخلط مع `data-on*` يدويًا.

```js
// ✅ المعيار
C.call('Button', { onClick: 'addToOrder', text: '+' })
C.call('Input',  { onInput: 'setSearch',  placeholder: 'ابحث...' })

// إن احتجت نقل بيانات مع الحدث:
C.call('Button', { onClick: 'addToOrder', text: '+', 'data-itemid': '42' })
```

داخل الأمر، احصل على القيم من `el.dataset` أو `el.getAttribute('data-...')`:
```js
addToOrder: ({ truth }, e, el) => {
  const id = +(el?.dataset?.itemid || 0)
  // ... تابع منطقك
}
```

---

### 2) ما هي (A, s, app) داخل المكوّن؟
- **A**: الذرّات (Atoms) لبناء هياكل DOM الأساسية (`A.Div`, `A.Span`, …). استخدمها عند الحاجة؛ والأولوية دومًا لمكوّنات **Comp** الجاهزة.
- **s**: لقطة الحالة الحالية للتطبيق (نفس `app.truth.get()`)، تقرأ منها فقط داخل البناء.
- **app**: كائن خدمات التطبيق، يهمّك منه أساسًا:
  - `app.i18n.t(key)`: ترجمة النصوص.
  - `app.env.getLocale()`, `app.env.toggleTheme()`: لغة وثيم.
  - `C.call(...)`: لاستدعاء مكوّنات أخرى وتسجيلها بـ`id`.

مثال سريع:
```js
C.define('Header', (A, s, app) => {
  return A.Div({ tw:'p-3 font-bold' }, { default: [ app.i18n.t('app.title') ] })
})
```

---

### 3) ما هي ({ truth }, e, el) داخل الأمر؟
- **truth**: بوابتك الوحيدة لتعديل الحالة وتعليم الواجهة (`set`, `batch`, `mark`, `rebuild`).
- **e**: الحدث الأصلي (اختياري الاستخدام).
- **el**: العنصر الذي نُقرَ عليه — استخرج منه البيانات `el.dataset.*`.

قالب موحّد:
```js
someAction: ({ truth }, e, el) => {
  truth.batch(() => {
    truth.set(s => ({ ...s, /* تعديلاتك */ }))
    truth.mark('#target-entity')
  })
}
```

---

### 4) الفرق بين mark و rebuild
- **mark**: تحديث قياسي سريع للكيانات المستهدفة.
- **rebuild**: إعادة بناء كاملة للكيانات المستهدفة (استخدمه فقط عند الحاجة، مثل تبديل layout جذري).

> لا تحتاج أي "تصريح" إضافي؛ بعد `set` و`mark` أو `rebuild` يتم التحديث تلقائيًا في نفس الدورة.

#### مثال: عدّة تعليمات ثم تحديث واحد
```js
truth.batch(() => {
  truth.set(s => ({ ...s, env:{ ...s.env, search:'قهوة' } }))
  truth.mark(['#menu-panel', '#footer-bar'])
  truth.mark('#pos-header')
})
// بفضل batch: سيُنفّذ كل ذلك كتحديث واحد على الواجهة
```

> يمكنك أيضًا استخدام `{ except }` مع `mark` و`rebuild`:
```js
truth.rebuild(['#content'], { except: ['#order-panel'] })
```

---

### 5) كتالوج مختصر لمكوّنات Comp الشائعة
> الأسماء قد تختلف حسب حزمتك، هذه الأكثر شيوعًا في المشاريع:

- **Button**
  - أهم Props: `text`, `onClick`, `variant` ('solid' | 'outline' | 'ghost'), `size` ('sm'|'md'|'lg'), `intent` ('primary'|'success'|'danger').
  - مثال: `C.call('Button', { onClick:'saveOrder', text:'حفظ', intent:'success' })`

- **Input**
  - أهم Props: `value`, `placeholder`, `onInput`.
  - مثال: `C.call('Input', { value: s.env.search||'', onInput:'setSearch', placeholder:'ابحث...' })`

- **Chip**
  - أهم Props: `label`, `active`, `onClick`, مع إرفاق بيانات كـ `data-id`.
  - مثال: `C.call('Chip', { label:'الكل', active:true, onClick:'selectCategory', 'data-id':'all' })`

- **Badge**
  - أهم Props: `children`, وأحيانًا `bg` للّون.
  - مثال: `C.call('Badge', { children:['وردية #', String(s.session?.shift?.no||1)] })`

> استخدم هذه أولًا قبل التفكير في بناء مكوّن جديد.

---

### 6) أدوات مساعدة مفيدة (Utils)
- **i18n**: `app.i18n.t('namespace.key')` — الترجمة.
- **Env**: `app.env.getLocale()`, `app.env.setLocale('en')`, `app.env.toggleTheme()`.
- **DevTools**: إن توفرت `app.devtools.printSummary()` لطباعة أداء الكيانات.

---

### 7) أمثلة جاهزة سريعة

#### بحث يُحدث شبكة العناصر
```js
setSearch: ({ truth }, e) => {
  const q = e?.target?.value || ''
  truth.batch(() => {
    truth.set(s => ({ ...s, env:{ ...s.env, search:q } }))
    truth.mark('#menu-panel')
  })
}
```

#### اختيار تصنيف
```js
selectCategory: ({ truth }, e, el) => {
  const id = el?.getAttribute('data-id') || 'all'
  truth.batch(() => {
    truth.set(s => ({ ...s, env:{ ...s.env, category:id } }))
    truth.mark('#menu-panel')
  })
}
```

#### إضافة عنصر
```js
addToOrder: ({ truth, env }, e, el) => {
  const itemId = +(el?.dataset?.itemid || 0)
  if (!itemId) return
  const item = (window.database?.items||[]).find(x => +x.id === itemId)
  if (!item) return
  const loc = (env.getLocale()||'ar').split('-')[0]

  truth.batch(() => {
    truth.set(s => {
      const o = s.order || { id:'o1', type:'dine_in', status:'new', lines:[], totals:{ sub:0, service:0, vat:0, grand:0 } }
      const name = item.translations?.[loc]?.name || item.translations?.en?.name || String(item.id)
      const ex = o.lines.find(l => l.item_id === itemId)
      const lines = ex ? o.lines.map(l => l===ex ? { ...l, qty:l.qty+1 } : l)
                       : [...o.lines, { id: Date.now()+'', item_id:itemId, title:name, qty:1, price:+item.price||0, modDelta:0 }]
      const sub = lines.reduce((a,l)=> a + ((+l.price||0)+(+l.modDelta||0))*((+l.qty)||0), 0)
      const service = sub * (+window.database?.settings?.service_charge_rate||0)
      const vat = (sub + service) * (+window.database?.settings?.tax_rate||0)
      const totals = { sub:+sub, service:+service, vat:+vat, grand:+(sub+service+vat) }
      return { ...s, order:{ ...o, lines, totals } }
    })
    truth.mark(['#order-panel','#footer-bar'])
  })
}
```




#اداوات المطور 
تمام — هذا هو **الدليل العملي لمكوّنات مكتبة `mishkah-comp`** (أسماء، وظائف، أهم الخصائص، وأبسط استخدام). اتّبع “الأسهل دائمًا”: **اربط الأحداث عبر Props مثل `onClick` و`onChange`**؛ لا تخلطها مع `data-on*`.

> تريد لائحة بالأسماء الموجودة لديك الآن؟ نفّذ محليًا:
>
> ```js
> console.log(Mishkah.Comp.list())
> ```
>
> هذا يسترجع كل المكوّنات المسجّلة في المكتبة 

---

# الفلسفة المختصرة للاستخدام

* **استدعاء المكوّن:** `C.call('ComponentName', props, slots)`
* **الأحداث:** `onClick`, `onInput`, `onChange`, `onClose`, … (حسب المكوّن) — كلها Props مريحة مدعومة مباشرة في تعريفات المكوّنات (انظر أمثلة داخل `DataTablePro`, `DatePicker`, إلخ)  
* **التجميع:** المكوّنات مبنية على **Tokens** و CSS Vars موحّدة للألوان والحواف إلخ (مثل `--primary`, `--radius-lg`) لضمان التوافق Light/Dark و RTL/LTR بدون تعقيد 

---

# 1) Primitives & Basics

### Icon

رمز خفيف (Unicode/SVG) لعنونة أو توضيح دلالي.
خصائص مهمة: `char`, `label`, `color`, `size`.
مثال:

```js
C.call('Icon', { char:'⭐', label:'star', color:'#f59e0b' })
```



### Dot

نقطة زينة/فاصل (•) مع القدرة على تغيير الحجم واللون.

```js
C.call('Dot', { char:'•' })
```



### Spinner

مؤشر تحميل دائري بسيط، `size` للتحكم في القطر.

```js
C.call('Spinner', { size:20 })
```



### Skeleton

قالب تحميل متلألئ للسطور أو البطاقات؛ `w`, `h`.

```js
C.call('Skeleton', { w:'100%', h:'1.25rem' })
```



### Badge

شارة صغيرة للوسوم/الحالات.

```js
C.call('Badge', { }, { default:['Active'] })
```



### Textarea

حقل متعدد الأسطر مع نمط موحّد.

```js
C.call('Textarea', { rows:4, onInput:e=>... })
```



---

# 2) Inputs

### Button

زر غني مع حالات `intent:'primary|success|danger|neutral'`, و `variant:'solid|outline|ghost'`, وأحجام `sm|md|lg|icon`، و`loading`.
يدعم `iconLeft`/`iconRight` ونص عبر `text` أو Slot افتراضي.

```js
C.call('Button', { intent:'primary', variant:'solid', text:'حفظ', onClick:save })
```



### Input

حقل إدخال قياسي. يدعم `onInput` و/أو `onChange`.

```js
C.call('Input', { placeholder:'ابحث...', onInput:e => setQ(e.target.value) })
```



### NumberInput (صغير مركّب)

حقل أرقام مع أزرار +/− مضمنة.

```js
C.call('NumberInput', { step:1, value:5, onChange:v => ... })
```



### PasswordInput

إظهار/إخفاء كلمة المرور بزر مدمج.

```js
C.call('PasswordInput', { value:'', onInput:e=>... })
```



### TagInput

إدخال وسوم (Enter أو فاصلة لإضافة) مع عرض الوسوم وإزالتها.

```js
C.call('TagInput', { value:['hot','new'], onChange:tags => ... })
```



### PhoneInput / TimeInput

مكوّنات إدخال هاتف/وقت بصياغات ودوال مساعدة.

```js
C.call('PhoneInput', { value:'+2010...', onChange:v=>... })
C.call('TimeInput',  { value:'12:30',  onChange:v=>... })
```



### Switch

مفتاح تشغيل/إيقاف.

```js
C.call('Switch', { checked:true, onChange:(val)=>... })
```



### Checkbox

مربع اختيار قياسي.

```js
C.call('Checkbox', { checked:false, onChange:(val)=>... })
```



### Chip / Pill / Avatar / Kbd / Progress

لبنات UI صغيرة لوسوم تفاعلية، حبوب حالة، صور مختصرة، كبسة لوحة مفاتيح، ومؤشر تقدم.

```js
C.call('Chip', { label:'Snacks', active:true, onClick:()=>... })
C.call('Avatar', { src:'/u.png', alt:'User' })
C.call('Kbd', { }, { default:['⌘K'] })
C.call('Progress', { value:60 })
```



---

# 3) Pickers

### DatePicker

منتقي تاريخ بسيط مع عرض شهر وتحديد يوم؛ يعيد `onChange(isoDate)`.

```js
C.call('DatePicker', { value:'2025-09-25', onChange:iso => ... })
```



### DateRange

مدى تاريخين (من/إلى) مع نفس فلسفة الأحداث.

```js
C.call('DateRange', { from:'2025-09-01', to:'2025-09-30', onChange:range => ... })
```



---

# 4) Files

### FileUpload

رفع ملفات بالسحب-والإفلات/اختيار، مع `onFiles`, `onProgress`, `onDone`, `onError`، ودعم POST تلقائي عند تمرير `url`.

```js
C.call('FileUpload', { url:'/upload', multiple:true, onDone:txt=>... })
```



---

# 5) Overlays & Portal

### Portal

يحقن العناصر داخل حاوية ثابتة في `body` (مثل modals/toasts).

```js
C.call('Portal', { target:'mishkah-portal-root' }, { default:[ /* أي محتوى */ ] })
```



### Popover

لوحة منبثقة خفيفة عبر `Portal`؛ خصائص: `open`, `anchor`, `placement`, `align`, `onClose`.

```js
C.call('Popover', { open, anchor:'#btn', onClose:()=> setOpen(false) }, { default:['Hello'] })
```



### Modal

حوار مركزي مع زر إغلاق و ESC و Click-outside و trap للفوكس (يعتمد على Utilities داخل المكتبة). يدعم أحجامًا وإغلاقًا مبرمجًا.

```js
C.call('Modal', { open, title:'Confirm', onClose:()=>setOpen(false) }, { default:['...'] })
```



### Sheet

لوح جانبي/سفلي (Drawer) للسياقات العميقة.

```js
C.call('Sheet', { open, side:'right', onClose:()=>setOpen(false) }, { default:['...'] })
```



### ConfirmDialog

تأكيد قياسي مبني فوق Modal (أزرار Confirm/Cancel مع callbacks).

```js
C.call('ConfirmDialog', { open, text:'Are you sure?', onConfirm:ok, onCancel:cancel })
```



### ToastStack (+ Toast)

عرض رسائل قصيرة مع مكدّس بالموقع `top-start|top-end|bottom-start|bottom-end`.
أرسل عناصر `{ id, title, description, intent, onClose }`.

```js
C.call('ToastStack', { position:'top-end', items:[{ id:1, title:'Saved' }] })
```

(الـ Toast يُستدعى داخليًا من الـ Stack) 

---

# 6) Context & Menus

### ContextMenu

قائمة سياقية عبر النقر يمينًا على محتوى ممرّر بالـ Slot.

```js
C.call('ContextMenu', {}, { default:[ C.call('Button',{text:'Right click me'}) ] })
```



---

# 7) Data Display

### Pagination

مقسّم صفحات بسيط، ينادي `onPage(pageIndex)`.

````js
C.call('Pagination', { page:1, pages:10, onPage:i=>... })
``>
:contentReference[oaicite:29]{index=29}

### DescriptionList
عرض أزواج عنوان/قيمة (تعريفات) لحقلّيات سريعة.  
```js
C.call('DescriptionList', { items:[{ term:'Name', desc:'Alice' }] })
````



### DataTablePro

جدول احترافي مع: ترشيح نصي، فرز، اختيار صفوف، أدوات تصدير (CSV/Excel/Print)، وإخفاء أعمدة.
أحداث: `onPage`, `onSort`, `onPick`, … حسب التفعيل.

```js
C.call('DataTablePro', {
  columns:[{ key:'name', title:'Name' }, { key:'price', title:'Price' }],
  rows: data,
  page:1, size:10,
  onPage:i=>..., onSort:(key,dir)=>...
})
```

 

### AutocompleteTable

مدخل بحث مع جدول اقتراحات يُنتقى منه صف (يدعم `onPick`).

```js
C.call('AutocompleteTable', { columns:[...], endpoint:{ url:'/api' }, onPick:row=>... })
```



---

# 8) Utilities مرفقة عبر Comp.util (سريعة الذكر)

* **DataSource.fetch**: جلب بيانات (يتطلب `utils.ajax`) مع `map` اختياري لتحويل النتيجة.

  ```js
  const res = await Mishkah.Comp.util.get('DataSource').fetch({ url:'/api' })
  ```

  (الواجهات مُعرّفة ضمن نفس الملف مع تصدير مباشر عبر Comp) 

* **Exporter (CSV/XLS/Print)**: موجود ومُستخدم داخل `DataTablePro` (أزرار تصدير/طباعة). 

* **PortalRoot / FocusTrap / Hotkeys**: مرافق لإدارة الـ Portals، حبس التركيز في الـ Modal، وتعريف اختصارات لوحة المفاتيح.
  (انظر تسجيل الأدوات مثل FocusTrap/Hotkeys ضمن `Comp.util.register`) 

---

## أنماط ربط الأحداث (الموصى بها – “واحد فقط”)

* استخدم دومًا **Props مريحة**:

  ```js
  C.call('Button', { text:'إضافة', onClick:()=> dispatch('addToCart') })
  C.call('Input',  { onInput:e=> update(e.target.value) })
  ```
* معظم المكوّنات الموجودة تدعم هذه الواجهة مباشرة (ستجدها داخل التعريفات تستمع لـ `onClick`/`onInput`/`onChange`) كما في `DataTablePro`, `DatePicker`, `NumberInput`, إلخ.   

---

## ملاحظات سريعة للمطوّر

* **لا تعيد اختراع العجلة**: قبل أن تكتب Atoms، ابحث عن بديل جاهز في `mishkah-comp`. التوجيه الرسمي يوصي باستخدام Comp أولًا وإبقاء Atoms “للضرورة القصوى” .
* **تعدد اللغات/الاتجاه**: صِيَغ الألوان/الحواف/الخلفيات مبنية على CSS Vars. كل شيء يعمل تلقائيًا مع `env.setLocale()` و`env.toggleTheme()` من النواة. 
* **الطباعة والتصدير**: استخدم أزرار التصدير المدمجة في `DataTablePro` بدل تخصيص يدوي (CSV/Excel/Print جاهزة) .
* **اكتشاف كل المكوّنات**: `Mishkah.Comp.list()` لطباعة الأسماء، و `Mishkah.Comp.util.list()` للأدوات المسجلة. 

---




*هذا المشروع متاح للاستخدام العام بشرط ذكر المصدر.*
*© 2025 ماس للبرمجيات (MAS for Programming)*

```
```
