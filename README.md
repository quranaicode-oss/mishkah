

# Mishkah.js — إطار عمل النور والنظام

*بنية برمجية (Software Architecture) ذات 7 أركان مستوحاة من أفضل الممارسات البرمجية*

| Build Status | Version | License |
| :---: | :---: | :---: |
| [![CI](https://github.com/USER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/USER/REPO/actions/workflows/ci.yml) | [![Version](https://img.shields.io/badge/version-v1.0.0-blue.svg)](https://github.com/USER/REPO/releases/tag/v1.0.0) | [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE) |


-----

> **إلى مطور الـ `React` و `Angular`...**
>
> نعلم أنك قد تتردد في ترك العالم المألوف الذي اعتدت عليه. لكن اسأل نفسك بصدق:
>
> **ألم تسأم من فوضى `React` وتشتت حالته (state) عبر عشرات المكتبات والأنماط التي لا تنتهي؟**
>
> **ألم تملّ من بيروقراطية `Angular` الهرمية، وبنيته المعقدة التي تبطئ وتيرة إنجازك؟**
>
> تقدم "مشكاة" طريقًا ثالثًا، صراطًا مستقيمًا: **قوة النظام دون تعقيد، وبساطة التحكم دون فوضى.** إنها ليست مجرد إطار عمل، بل هي منظومة متكاملة (Ecosystem) قائمة على 7 أركان هندسية مصممة لحل هذه المشاكل من جذورها.

## الأركان السبعة لمعمارية "مشكاة"

### 1\. لغة التصوير الواضحة (The Expressive DSL)

**"الزجاجة" التي تحمي شعلة المحرك.**
بدلاً من بناء الواجهة بكائنات مختلطة أو سلاسل نصية، تقدم "مشكاة" لغة تعريفية (DSL) صارمة تفصل بوضوح بين **السمات (`attrs`)** و**الأحداث (`events`)**.

```javascript
// بنية DSL في مشكاة: h.Type({ attrs: {...}, events: {...} }, [children])

// مثال صحيح:
h.Containers.Div(
  {
    attrs: { class: 'card', 'data-id': 123 },
    events: { click: handleCardClick }
  },
  [ h.Text.H1({ attrs: { class: 'title' } }, ['مرحباً']) ]
);
```

هذه "الزجاجة" الصافية تفرض بنية سليمة، تمنع تضارب الخصائص، وتجعل الكود مقروءًا بشكل لا يصدق. إنها تفصل بين "ما هو الشيء" و "كيف يتصرف".

### 2\. الذرات المصنفة (Classified Atoms)

**"وَاللَّهُ خَلَقَ كُلَّ دَابَّةٍ مِنْ مَاءٍ ۖ فَمِنْهُمْ مَنْ يَمْشِي عَلَىٰ بَطْنِهِ..."**
كما صنف الخالق الكائنات، تصنف "مشكاة" مكوناتها الأساسية (Atoms) إلى فصائل منطقية:

  * `h.Containers`: للعناصر الهيكلية مثل `Div`, `Section`.
  * `h.Forms`: لعناصر النماذج مثل `Form`, `Button`.
  * `h.Text`: للعناصر النصية مثل `P`, `Span`.

هذا التصنيف المنهجي (`Classification`) يفرض بنية سليمة على الواجهة.

### 3\. المنظومة الإبداعية المتكاملة (The Intelligent UI Ecosystem)

المكونات في "مشكاة" ذكية "تقوم بأدوارها  بدقة كوظائف و ألوان وأشكال" بفضل التكامل العميق مع `mishkah-ui`:

  * **ثيمات تلقائية (`Theming`):** تنتقل الواجهة بين الوضع الليلي والنهاري بسلاسة كإيلاج الليل في النهار.
  * **دعم عالمي (`i18n`):** دعم كامل للغات المتعددة وتخطيط اليمين لليسار (`RTL`) تلقائيًا.
  * **مكتبة مكونات جاهزة:** عشرات المكونات (`Card`, `Modal`) جاهزة للاستخدام، موفرة مئات الساعات من العمل.

### 4\. محرك إعادة البناء الحكيم (The Wise Rebuild Engine)

**"النية" و "الحكمة" في التحديث.**
هو الركن الذي يضمن الأداء الفائق. "مشكاة" لا تحدث الواجهة تلقائيًا، بل تنتظر أمرًا صريحًا منك (`ctx.rebuild()`). وعندما يصدر الأمر، تستخدم خوارزميات ذكية (VDOM Diffing & LIS) لتطبيق أقل عدد ممكن من التغييرات على الـ DOM.

### 5\. الحارس (`Guardian`): منفذ القوانين الفيزيائية

طبقة حماية تفرض قوانين فيزيائية ثابتة لمنع انهيار النظام (مثل الحماية من XSS ومنع السمات الخطيرة)، تمامًا كالسُنن الكونية التي لا يمكن خرقها.

### 6\. الرقيب (`Auditor`): ميزان الجودة والأداء

يراقب جودة الأداء ويقدم النصح. يسجل المقاييس (`Performance Metrics`)، ويحذر من الممارسات السيئة (`bad practices`)، ويمنح كل مكون درجة (`score`) بناءً على سلوكه.

### 7\. أدوات المطور (`Devtools`): يوم الحساب للمكونات

نظام متطور للبصيرة والمحاسبة. يجمع بيانات الرقيب (`Auditor`) بمرور الوقت ويصدر "حكمًا" على المكونات، مصنفًا إياها إلى "جنة" (عالية الجودة) أو "نار" (تحتاج لإعادة صياغة)، مما يقدم بصيرة واضحة عن جودة عمل المطورين.
-----

### الترخيص والمساهمة

**رخصة المشروع (License)**
"مشكاة" مفتوحة المصدر بالكامل تحت رخصة **MIT**. هذا يعني أنه يمكنك استخدامها، تعديلها، وتوزيعها بحرية تامة، سواء في مشاريع شخصية أو تجارية، بشرط واحد وهو الإبقاء على ذكر المصدر الأصلي وحقوق النشر.

**دعوة للمساهمة**
إن "مشكاة" ليست مجرد كود، بل هي فكرة. وإن كنت قد اقتنعت بهذه الفكرة، فإن مساهمتك ليست مجرد خيار، بل هي جزء من إتمام هذا النور. فالأفكار العظيمة لا تكتمل بجهد فردي، بل بعمل جماعي لتصير كوكبًا دريًا يضيء للجميع.

نرحب بكل مساهمة، سواء كانت بالكود، أو بالتوثيق، أو حتى بنشر الفكرة لمن حولك.

-----

### **English Version (Complete & Corrected)**

# Mishkah.js — The Framework of Light & Order

*A 7-Pillar Software Architecture Inspired by Universal Laws*

| Build Status | Version | License |
| :---: | :---: | :---: |
| [![CI](https://github.com/USER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/USER/REPO/actions/workflows/ci.yml) | [![Version](https://img.shields.io/badge/version-v1.0.0-blue.svg)](https://github.com/USER/REPO/releases/tag/v1.0.0) | [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE) |


-----

> **A Word to the `React` & `Angular` Developer...**
>
> We get it. Leaving a familiar ecosystem is a big step. But ask yourself honestly:
>
> **Aren't you tired of React's chaos?** The fragmented state management, the endless debates over libraries, the analysis paralysis that comes with too much freedom?
>
> **Aren't you weary of Angular's bureaucracy?** The rigid, hierarchical structure, the steep learning curve, the boilerplate that slows you down?
>
> Mishkah offers a third path—a Straight Path. It’s **the power of order without the complexity, and the simplicity of control without the chaos.** It’s not just another framework; it's a complete ecosystem built on 7 engineering pillars designed to solve these problems at their root.

## The 7 Pillars of Mishkah's Architecture

### 1\. The Expressive DSL

**The "Glass Bottle" that protects the engine's flame.**
Instead of building a UI with mixed-concern objects or strings, Mishkah provides a strict Domain-Specific Language (DSL) that cleanly separates **attributes (`attrs`)** from **events (`events`)**.

```javascript
// The Mishkah DSL structure: h.Type({ attrs: {...}, events: {...} }, [children])

// Correct Example:
h.Containers.Div(
  {
    attrs: { class: 'card', 'data-id': 123 },
    events: { click: handleCardClick }
  },
  [ h.Text.H1({ attrs: { class: 'title' } }, ['Hello']) ]
);
```

This crystal-clear "glass bottle" enforces a sound structure, prevents property collisions, and makes the code incredibly readable. It separates "what a thing is" from "how a thing behaves."

### 2\. Classified Atoms

**"And Allah has created every animal from water. Of them are some that creep on their bellies..."**
Just as creatures are classified, Mishkah’s foundational components (`Atoms`) are organized into logical families (`h.Containers`, `h.Forms`, `h.Text`, etc.). This systematic classification enforces a sound and predictable UI architecture.

### 3\. The Intelligent UI Ecosystem

**"Each one has known its prayer and its praise..."**
Components in Mishkah are intelligent entities that "know their purpose" thanks to deep integration with `mishkah-ui`:

  * **Automatic Theming:** Seamlessly switch between light and dark modes, like the "intertwining of night and day."
  * **Global Support (i18n):** Full internationalization and right-to-left (`RTL`) support, automated out of the box.
  * **Rich Component Library:** A vast library of ready-to-use components (`Card`, `Modal`) that save hundreds of hours of development.

### 4\. The Wise Rebuild Engine

**"Intent" and "Wisdom" in every update.**
This pillar guarantees hyper-performance. Mishkah does not update the UI automatically. It waits for your explicit command (`ctx.rebuild()`). When commanded, it uses smart algorithms (VDOM Diffing & LIS) to apply the absolute minimum number of changes to the DOM.

### 5\. The Guardian: The Enforcer of Physical Laws

A protection layer that enforces immutable "physical laws" to prevent system failure (e.g., XSS protection, blocking dangerous attributes), just like the unbreakable laws of the universe.

### 6\. The Auditor: The Quality & Performance Monitor

This system monitors the quality of your code in runtime. It logs performance metrics, warns against bad practices, and assigns a score to each component based on its behavior.

### 7\. The Devtools: The Judgment Engine


An advanced system for insight and accountability. It aggregates data from the Auditor over time and renders a "judgment" on components, classifying them as "Heaven" (high-quality, reusable) or "Hell" (needs refactoring). This provides clear, actionable insights into code quality and developer performance.


-----

### License & Contribution

**License**
Mishkah is fully open-source under the **MIT License**. This means you are free to use, modify, and distribute it for any purpose, personal or commercial, with the single condition of including the original copyright notice.

**A Call to Contribute**
Mishkah is more than just code; it's an idea. If this idea resonates with you, then your contribution is not just an option—it's part of completing this light. Great ideas do not reach their full potential through individual effort, but through collective work, becoming a "brilliant star" that illuminates the way for all.

We welcome all forms of contribution, whether through code, documentation, or simply by spreading the word.
