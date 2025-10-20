# Mishkah Quick Access

> **ثوانٍ قليلة تكفي لتشغيل واجهة HTMLx كاملة مع الثيمات، الترجمة، والبيانات المرئية.** هذا الدليل موجّه للمطورين الذين يريدون الانطلاق بسرعة دون الغوص في التفاصيل التقنية العميقة.

## 1. ما الذي تحصل عليه تلقائيًا؟
- 🚀 **إقلاع HTMLx ذاتي**: يكفي تضمين `mishkah.js` مع `data-htmlx` وسيقوم المحرك بتشغيل الصفحة دون أي نداء يدوي لـ `Mishkah.auto.make()`.
- 🎨 **Tailwind مدمج**: جميع التوكنز في `mishkah-ui.js` تضبط الألوان والمسافات تلقائيًا، لذا لا حاجة لكتابة CSS أساسي.
- 🌐 **الترجمة وبيئة التشغيل**: استخدم `data-path="env"` و`data-path="i18n.strings"` لتغذية الحالة واللغة عبر JSON صريح.
- 📊 **رسوم بيانية بلا جافاسكربت**: ضع `data-chart-auto` مع قيمك وسيقوم الجسر الجديد بتحويلها إلى مخطط Chart.js كامل.
- ⏱️ **عدّ تنازلي جاهز**: العنصر الذي يحمل `data-countdown` يبدأ تلقائيًا ويعرض الوقت بصيغة ودودة، ويُصدر حدث `countdown:finished` عند النهاية.

## 2. خطوات بدء صفحة HTMLx في أقل من عشر أسطر
1. **حمّل نواة مشكاة** (وواجهة UI عند الحاجة):
   ```html
   <script src="./mishkah.js" data-htmlx></script>
   <script src="./mishkah-ui.js"></script>
   ```
2. **هيّئ البيانات والبيئة عبر `data-path`** (لا حاجة لـ `data-m-data` بعد اليوم).
3. **اكتب القالب داخل `<template id="...">`** واستدعِ المكونات الجاهزة عبر `<comp name="...">`.
4. **أضف السمات التلقائية** مثل `data-chart-auto` أو `data-countdown` لتمكين الرسوم والمؤقّتات دون كود إضافي.

## 3. نموذج Dashboard مصغّر
الشفرة التالية تبيّن كيف تبني لوحة قيادة بترجمة ثنائية، رسم بياني، ومؤقّت تنازلي باستعمال السمات الجديدة فقط.

```html
<!DOCTYPE html>
<html lang="ar" dir="rtl" data-htmlx="quick-dashboard">
  <head>
    <meta charset="utf-8" />
    <title>Mishkah Quick Dashboard</title>
    <script src="./mishkah.js" data-htmlx></script>
    <script src="./mishkah-ui.js"></script>
  </head>
  <body>
    <template id="quick-dashboard">
      <script type="application/json" data-path="env">
        { "lang": "ar", "theme": "auto" }
      </script>
      <script type="application/json" data-path="i18n.strings">
        {
          "quick.title": { "ar": "لوحة سريعة", "en": "Quick Dashboard" },
          "quick.revenue": { "ar": "الإيراد", "en": "Revenue" },
          "quick.orders": { "ar": "الطلبات", "en": "Orders" },
          "quick.trend": { "ar": "أداء الأسبوع", "en": "Weekly trend" },
          "quick.timer": { "ar": "الوقت المتبقي", "en": "Time left" }
        }
      </script>
      <script type="application/json" data-path="data">
        {
          "metrics": { "revenue": "12.8K", "orders": 54 },
          "timer": { "seconds": 45 }
        }
      </script>

      <section data-m-scope="quick-dashboard" class="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 bg-[var(--background)] p-6">
        <header class="flex flex-wrap items-center justify-between gap-3">
          <h1 class="text-2xl font-semibold">{trans('quick.title')}</h1>
          <div class="flex items-center gap-2">
            <comp name="ui.language-switch" lang="{state.env.lang}"></comp>
            <comp name="ui.theme-toggle-icon" theme="{state.env.theme}" gkey="ui:theme-toggle"></comp>
          </div>
        </header>

        <div class="grid gap-4 sm:grid-cols-2">
          <section class="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow)]">
            <p class="text-sm text-[var(--muted-foreground)]">{trans('quick.revenue')}</p>
            <strong class="text-3xl font-bold">{state.data.metrics.revenue}</strong>
          </section>
          <section class="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow)]">
            <p class="text-sm text-[var(--muted-foreground)]">{trans('quick.orders')}</p>
            <strong class="text-3xl font-bold">{state.data.metrics.orders}</strong>
          </section>
        </div>

        <figure class="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow)]">
          <figcaption class="mb-3 text-sm text-[var(--muted-foreground)]">{trans('quick.trend')}</figcaption>
          <canvas
            data-chart-auto
            data-chart-type="line"
            data-chart-values="18,22,25,28,35,31,29"
            data-chart-labels="Mon,Tue,Wed,Thu,Fri,Sat,Sun"
            data-chart-height="260"
          ></canvas>
        </figure>

        <div class="flex items-center justify-between rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow)]">
          <span class="text-sm text-[var(--muted-foreground)]">{trans('quick.timer')}</span>
          <strong class="text-2xl font-semibold" data-countdown="45" data-countdown-template="⏱️ {{time}}"></strong>
        </div>
      </section>
    </template>
  </body>
</html>
```

### ملاحظات حول المثال
- كل البيانات (البيئة، الترجمة، الحالة) تمت عبر `data-path`، ويمكنك تقسيمها كما تشاء إلى `data`, `content`, أو غيرها.
- الرسم البياني يعتمد على `data-chart-auto` وسمات `data-chart-values`/`data-chart-labels`. يمكنك أيضًا تمرير JSON كامل عبر `data-chart-datasets` أو `data-chart-options` عند الحاجة.
- عنصر العدّاد يستعمل `data-countdown` فقط. غيّر القيمة في أي وقت (يدويًا أو عبر الأوامر) وسيتم إعادة ضبط المؤقّت تلقائيًا.
- جميع الأنماط تأتي من التوكنز (surface, card, border…) داخل `mishkah-ui.js`، لذا لا حاجة لـ CSS إضافي.

## 4. مرجع السمات المبسّطة
| السمة | الاستخدام السريع |
| --- | --- |
| `data-path="env"` | تعيين اللغة والثيم الافتراضي (`{"lang":"ar","theme":"auto"}`). |
| `data-path="i18n.strings"` | ضخ مفاتيح الترجمة واستدعاؤها عبر `trans('key')`. |
| `data-chart-auto` | إنشاء مخطط Chart.js دون كود — يدعم `data-chart-values`, `data-chart-labels`, `data-chart-datasets`, `data-chart-options`, `data-chart-type`, `data-chart-height`. |
| `data-countdown` | تفعيل عدّاد تنازلي تلقائي؛ يدعم `data-countdown-format`, `data-countdown-template`, `data-countdown-finished-template`, و`data-countdown-autostart="false"` لإيقاف التشغيل التلقائي. |

## 5. ماذا بعد؟
- لمزيد من التفاصيل المعمارية والشرح المتعمّق ارجع إلى `readme-tec.md` (النسخة التقنية الكاملة السابقة).
- إن احتجت إلى إنشاء مكوّنات UI خاصة، استخدم `mishkah-ui.js` واستفد من الـ DSL المتوفر هناك.
- أرسل أمثلة إضافية في `docs/` لتوسيع مكتبة Quick Access؛ الهدف أن يبقى onboarding للمطورين الجدد مسألة دقائق.

> **قاعدة ذهبية:** إذا احتجت إلى كتابة أكثر من بضع خصائص أو دوال في HTMLx، فكر أولًا إن كان يمكنك تحويلها إلى سمة بيانات (`data-*`) يتعامل معها Mishkah تلقائيًا.
