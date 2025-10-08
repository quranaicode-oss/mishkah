# طبقة HTMLx فوق DSL مشكاة

> وثيقة هندسية تقترح طبقة تحويل عالية المستوى (HTMLx) تبني فوق DSL "مشكاة" الرسمية وتبسط على المطورين بناء المكوّنات، مع الحفاظ على صرامة التصنيف الذرّي والأوامر.

## 1. الأهداف التصميمية

1. **إدخال مألوف**: تمكين المطور من كتابة هيكل يشبه HTML/JSX مع دعم التعبيرات (`{...}`) والتوجيهات (`x-if`، `x-for`).
2. **صرامة مشكاة**: تتحول كل عقدة إلى استدعاء للذرة الصحيحة في DSL من خلال محرك تحويل واحد موثوق.
3. **الاستخدام الموحد للأحداث**: تعريف أسماء أحداث معيارية (`on:click`, `on:submit`) تُحوّل تلقائيًا إلى `gkeys` وأوامر مشكاة.
4. **إدارة `key` و CSS**: توليد مفاتيح (`gkey`) وفضاءات CSS محلية تلقائيًا دون إلزام المطور بالتصريح اليدوي.
5. **قابلية التطوير**: إمكانية استدعاء المكوّنات العامة (من `UI`) أو المكوّنات المضافة في مشروع معيّن، بالإضافة إلى دعم علامات HTML الأصلية كخيار أخير.

## 2. بناء اللغة المقترحة

```html
<style>
:host {
  display: grid;
}
</style>

<template>
  <Card on:click="orders.counter.inc">
    <h2>{state.data.title}</h2>
    <Button on:click="orders.counter.inc">+1</Button>
    <ul>
      <li x-for="item, idx in state.data.items" key="item.id">
        <span x-if="item.done">✅</span>
        <span>{item.label}</span>
      </li>
    </ul>
  </Card>
</template>

<orders>
  counter.inc = (event, { getState, setState, rebuild }) => {
    setState(s => ({
      ...s,
      data: {
        ...s.data,
        count: s.data.count + 1
      }
    }));
    rebuild();
  }
</orders>
```

- **`<style>`**: يتم حقنه في نطاق المكوّن فقط؛ يترجم إلى إدخال في `database.styles[autoKey]`.
- **`<template>`**: الجسد التحويلي الذي يشبه JSX ويُحوّل إلى DSL.
- **`<orders>`**: تعريف أوامر بنفس صيغة مشكاة، مع إمكانية الإشارة المباشرة إلى الأوامر العامة باستخدام `extends`.

## 3. مراحل التحويل

| المرحلة | الوصف |
| --- | --- |
| 1. Parsing | تحليل خفيف لـ HTMLx باستخدام `@xmldom/xmldom` أو Parser داخلي، مع دعم `x-if`, `x-for`, `{expr}`. |
| 2. Normalization | تعيين العلامات إلى فئات: إذا وُجد في `components` -> مكوّن، وإلا في `atoms` -> ذرة، وإلا HTML أصلي -> `D.h`. |
| 3. Semantics | استخراج الأحداث (`on:click` → gkey + order binding)، وتوليد مفاتيح تلقائية عند غياب `key`. |
| 4. CSS Scope | إسناد selector `:host` إلى `data-m-scope="autoKey"` وحقن الأنماط مع بادئة `[data-m-scope="autoKey"]` لجميع القواعد. |
| 5. Codegen | إنتاج كود DSL جاهز للتنفيذ + تجميع الأوامر + تحديث الـ database. |

## 4. قواعد التعيين إلى DSL

1. **الحاويات**: علامات HTML مثل `div`, `section` ↦ `D.Containers.Div/Section`.
2. **النصوص**: `p`, `span`, `h1` ↦ `D.Text`.
3. **القوائم**: `ul`, `ol`, `li` ↦ `D.Lists`.
4. **النماذج**: `button`, `form`, `label` ↦ `D.Forms`.
5. **الإدخالات**: `input`, `select`, `textarea` ↦ `D.Inputs`.
6. **الوسائط**: `img`, `video` ↦ `D.Media`.
7. **مكوّنات UI**: أسماء تبدأ بحرف كبير تبحث أولًا في `UI.components` ثم في `project.components`. إذا لم توجد، يتم التحقق من كونها HTML أو إطلاق خطأ.
8. **أسماء مخصّصة**: `x-component="atoms.Badge"` لتحويل مباشر لذرة معيّنة.

## 5. إدارة الأحداث والأوامر

- `on:click="orders.counter.inc"` ↦ يضيف `data-m-gkey="counter:inc"` ويضمن وجود أمر بنفس الاسم.
- عند عدم تحديد اسم أمر، يتم توليد `auto:<hash>` وتسجيله في خريطة الأوامر.
- محرك التحويل يضمن تطابق `gkeys` مع الأوامر ويمنع الأسماء غير الموجودة.

## 6. التعبيرات والتوجيهات

- `{expr}`: تُترجم إلى دوال صغيرة تُمرر إلى DSL كمصفوفة children (مثلًا: `() => state.data.title`).
- `x-if="condition"`: تتحول إلى بناء `condition ? child : null` في children array.
- `x-for="item, idx in collection"`: تولّد حلقة `collection.map((item, idx) => /* child DSL */)`. عند غياب `key` يتم توليد `autoKey(item, idx)`.

## 7. توليد المفاتيح و CSS المحلي

- كل عقدة لها معرف داخلي ثابت (`path.join('.')`). إذا لم يقدّم المطور `key`، يستخدم المحرك هذا المسار مع `hash` لإنتاج `data-m-gkey`.
- CSS يُعاد كتابته ليصبح: `:host` ↦ `[data-m-scope="<autoKey>"]`, وكل المحددات الأخرى تُسبق بـ `[data-m-scope="<autoKey>"]`.

## 8. واجهة التنفيذ (API)

```javascript
import { compileHTMLx } from './mishkah.htmlx';

const { database, orders, component } = compileHTMLx({
  source: htmlxSource,
  namespace: 'counter',
  components: Mishkah.UI.components,
  atoms: Mishkah.DSL,
});

Mishkah.app.setBody(component);
app.setOrders({ ...orders, ...UI.orders });
```

- **`namespace`**: يُستخدم لتوليد مفاتيح فريدة عبر التطبيق.
- **`components`**: قائمة البحث للمكوّنات المعمّمة.
- **`atoms`**: مرجع الذرات الرسمية لضمان الالتزام.

## 9. خارطة الطريق

1. بناء Parser خفيف يدعم بنية HTMLx.
2. طبقة تطبيع تعتمد على جداول تحويل الذرات (تُستورد من `Mishkah.DSL`).
3. وحدة CSS Scope بالاعتماد على PostCSS.
4. التكامل مع `Mishkah.app` عبر وحدة جديدة `mishkah.htmlx.js`.
5. كتابة اختبارات تحول (input HTMLx ↦ DSL + Orders + CSS).

---

هذه الطبقة تمنح تجربة مألوفة شبيهة بـ JSX للمطورين، لكنها تحافظ على العقد الصارم للمكتبة وتمنع الانزلاق نحو منطق عرض غير منضبط.
