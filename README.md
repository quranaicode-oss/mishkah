بسم الله نبدأ.

# Mishkah.js — إطار عمل النور والنظام

*بنية برمجية (Software Architecture) ذات 7 أركان مستوحاة من أفضل الممارسات البرمجية*

| Build Status | Version | License |
| :---: | :---: | :---: |
| [![CI](https://github.com/USER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/USER/REPO/actions/workflows/ci.yml) | [![Version](https://img.shields.io/badge/version-v1.0.0-blue.svg)](https://github.com/USER/REPO/releases/tag/v1.0.0) | [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE) |


-----

> **إلى من تاه في أودية `React` و `Angular`...**
>
> نعلم أنك قد سئمت. سئمت من فوضى `React` التي تجعلك تجمع جيشًا من المكتبات المتناحرة لتبني كوخًا، وسئمت من بيروقراطية `Angular` التي تجبرك على استصدار ثلاثة تصاريح لتضع حجرًا واحدًا.
>
> لقد بُنيت هذه الأطر لتدير فوضى جيوش المبرمجين في الشركات الضخمة، فكانت النتيجة إما فوضى مُدارة أو نظام مُعقّد. لكن "مشكاة" تطرح سؤالًا جذريًا: **لماذا ندير الفوضى، بينما يمكننا منعها من الأساس؟**
>
> "مشكاة" ليست طريقًا ثالثًا، بل هي عودة إلى الصراط المستقيم. هي منظومة متكاملة مبنية على سنن إلهية ثابتة، هدفها تمكينك من بناء أنظمة مضيئة كنور الله الذي ضرب به المثل.

-----

## الأركان المعمارية السبعة لنظام "مشكاة"

### 1\. مركزية الحالة (State Centralization): العقل المدبر للنظام

**المبدأ:** في أي نظام معقد، الفوضى تبدأ عندما تتعدد مصادر القرار. لهذا، تفرض "مشكاة" مبدأ **المركزية المطلقة للحالة**. كل معلومة يحتاجها تطبيقك، من هوية المستخدم ولغة الواجهة، إلى محتوى المقالات وبيانات النماذج، يجب أن توجد في مكان واحد فقط: كائن `database`. هذا الكائن ليس مجرد مخزن بيانات، بل هو **النموذج الكامل لعالم التطبيق (World Model)** في أي لحظة زمنية.

**لماذا هذا المبدأ صارم؟** لأن الحالة الموزعة (مثل `useState` المنتشر في مكونات React) تخلق كابوسًا من الأسئلة: أي حالة هي الصحيحة الآن؟ لماذا لم يتم تحديث هذا المكون مع ذاك؟ تتبع الأخطاء يصبح عملية تنقيب مضنية.

في "مشكاة"، واجهة المستخدم هي انعكاس بصري مباشر وصادق للحقيقة الموجودة في `database`. لا مجال للكذب أو عدم التزامن. هذا يفتح الباب لتقنيات متقدمة مثل **التصحيح عبر السفر الزمني (Time-Travel Debugging)**، حيث يمكن تسجيل سلسلة من الحالات والتنقل بينها لفهم كيف تطور النظام.

#### التطبيق التقني:

تصبح عمليات التحديث شفافة ويمكن التنبؤ بها. كل تغيير هو مجرد دالة تأخذ الحالة القديمة وتعيد الحالة الجديدة.

```javascript
// `database`: هو العقل الذي يحتوي على كل حقائق النظام.
const database = {
  env: { theme: 'dark', lang: 'ar' },
  user: { name: 'زائر', loggedIn: false, visits: 1 },
  cart: { items: [], total: 0 }
};

// أي مكون هو مجرد قارئ أمين لهذه الحقائق.
function Navbar(db) {
  const userName = db.user.name;
  const cartCount = db.cart.items.length;
  // ... يعرض واجهة مبنية على هذه البيانات
}

// التغييرات لا تحدث عشوائيًا، بل عبر "أوامر" مركزية ومنظمة.
// تخيل أن هذا الأمر يتم استدعاؤه عند تسجيل الدخول.
function handleLogin(currentUser) {
  // لا نعدل الحالة مباشرة، بل نصف التغيير المطلوب.
  // إطار العمل يتولى تحديث الـ `database` وإعادة التصيير.
  app.setState(currentState => {
    return {
      ...currentState, // ننسخ الحالة القديمة
      user: { // ونحدث فقط الجزء الخاص بالمستخدم
        ...currentUser,
        loggedIn: true,
        visits: currentState.user.visits + 1
      }
    };
  });
}
```

بهذه الطريقة، يصبح تدفق البيانات في التطبيق واضحًا وسهل التتبع كنهر يجري في مسار واحد.

-----

### 2\. لغة تعريفية مُحكَمة (A Constrained DSL): عقد بَنّاء وآمن

**المبدأ:** لغات القوالب التقليدية (مثل JSX) تمنح حرية خطيرة، فهي تسمح بخلط منطق العرض مع منطق العمل والوصول للبيانات في مكان واحد، مما ينتج عنه مكونات هجينة ومعقدة. "مشكاة" تقدم بديلاً: **لغة تعريفية خاصة (DSL) تعمل كعقد صارم**.

هذا العقد يفرض **فصلًا قاطعًا بين بنية المكون (`attributes`) وسلوكه (`events`)**. أنت لا تكتب خليطًا من HTML و JavaScript، بل تصف بنية واجهتك باستخدام مفردات محددة وواضحة تمنعك من ارتكاب الأخطاء. يتم ربط السلوك (ماذا يحدث عند النقر) بشكل غير مباشر عبر مفاتيح (`gkeys`)، مما يبقي منطق العمل مركزيًا ومنظمًا في ملف `orders`.

#### التطبيق التقني:

لاحظ كيف تفصل اللغة بين "شكل" الزر و"وظيفة" الزر.

```javascript
const D = Mishkah.DSL;

// 1. تعريف الشكل (في ملف المكون)
// هذا الكود يصف "ما هو" الزر، ولا علاقة له بما "يفعله".
function CloseButton() {
  return D.Forms.Button({
    attrs: {
      class: 'btn btn-danger',
      'aria-label': 'إغلاق',
      'data-m-gkey': 'ui:window-close' // مفتاح يربط الزر بوظيفته
    }
  }, ['X']);
}

// 2. تعريف الوظيفة (في ملف الأوامر `orders.js`)
// هذا الكود يصف "ماذا يحدث" عندما يُستدعى المفتاح `ui:window-close`.
const orders = {
  'ui.window.close': { // لاحظ كيف يطابق المفتاح `gkey` مع تعديل بسيط
    on: ['click'],
    gkeys: ['ui:window-close'],
    handler: (event, context) => {
      // منطق إغلاق النافذة يكتب هنا
      console.log('Window is closing...');
      // يمكنه أيضًا تحديث الحالة
      context.setState(s => ({ ...s, windowOpen: false }));
    }
  }
};
```

هذا الفصل ليس خيارًا، بل هو إجبار يضمن أن مكوناتك تبقى بسيطة، قابلة لإعادة الاستخدام، وسهلة الاختبار.

-----

### 3\. التصنيف الوظيفي للذرات (Functional Atom Classification): وحدات بناء ذكية

**المبدأ:** التعامل المباشر مع وسوم HTML يشبه التعامل مع الطوب والأسمنت الخام. إنه ممكن، لكنه عرضة للأخطاء. "مشكاة" تقدم **"ذرات" (`Atoms`)**: وهي أغلفة ذكية حول وسوم HTML، مصنفة في فئات وظيفية (`Forms`, `Text`, `Containers`, `Media`).

كل ذرة ليست مجرد اسم بديل للوسم، بل هي **وحدة بنائية تفهم سياقها وقواعدها**. الذرة `D.Forms.Textarea` تعرف أنها تتطلب خاصية `value` وليس `text`. الذرة `D.Media.Image` يمكن برمجتها لرفض الإنشاء إذا لم يتم تزويدها بخاصية `alt` الضرورية لإمكانية الوصول. هذا يحول عملية البناء من عمل يدوي معرض للخطأ إلى عملية تركيب **وحدات ذكية وآمنة**.

#### التطبيق التقني:

الذرات تفرض أفضل الممارسات وتحميك من الأخطاء البديهية.

```javascript
const D = Mishkah.DSL;

// مثال 1: ذرة الصورة تفرض إمكانية الوصول
// هذا الكود قد يفشل في الإنشاء إذا لم توفر `alt` (حسب الإعدادات)
const profilePicture = D.Media.Image({
  attrs: {
    src: '/path/to/image.jpg',
    alt: 'صورة المستخدم عبد الله' // خاصية إجبارية
  }
});

// مثال 2: ذرة الرابط تحمي من الثغرات الأمنية
// هذه الذرة تضيف تلقائيًا `rel="noopener noreferrer"` عند استخدام `target="_blank"`
const externalLink = D.Text.A({
  attrs: {
    href: 'https://example.com',
    target: '_blank'
  }
}, ['رابط خارجي آمن']);
```

-----

### 4\. مكتبة مكونات قابلة للتركيب (Composable Component Library): تسريع وتوحيد البناء

**المبدأ:** إذا كانت "الذرات" هي الطوب، فإن **مكونات `mishkah-ui`** هي الجدران والأعمدة الجاهزة. فبدلاً من بناء "بطاقة" (`Card`) في كل مرة من ذرات `div` و `h2` و `p`، تستخدم `UI.Card` الذي يغلف كل هذا التعقيد ويوفر واجهة بسيطة.

هذه المكتبة تضمن **الاتساق البصري والوظيفي** عبر التطبيق بأكمله، وتطبق أفضل الممارسات في إمكانية الوصول والأداء بشكل مدمج. إنها تجسيد حقيقي لمبدأ **"لا تكرر نفسك" (DRY)**.

#### التطبيق التقني:

بناء واجهات معقدة يصبح عملية تجميع سريعة وممتعة.

```javascript
const UI = Mishkah.UI;
const D = Mishkah.DSL;

// بناء مربع حوار (Dialog) معقد بسطرين
// هذا المكون يعالج تلقائيًا أمورًا مثل:
// - إدارة التركيز (Focus Trapping) داخل الحوار
// - إغلاق الحوار عند الضغط على زر Escape
// - السمات البصرية المتوافقة مع النظام
const confirmationDialog = UI.Dialog({
  trigger: UI.Button({}, ['حذف العنصر']),
  title: 'تأكيد الحذف',
  description: 'هل أنت متأكد من رغبتك في حذف هذا العنصر؟ لا يمكن التراجع عن هذا الإجراء.',
  footer: D.Containers.Div({ class: 'hstack' }, [
    UI.Button({ variant: 'secondary' }, ['إلغاء']),
    UI.Button({ variant: 'danger' }, ['نعم، احذف'])
  ])
});
```

-----

### 5\. بيئة عالمية متكاملة (Integrated Global Environment): جاهزية فطرية للعالمية

**المبدأ:** الميزات العالمية مثل تعدد اللغات والسمات ليست رفاهية، بل هي جزء من بنية التطبيق الأساسية. في "مشكاة"، هذه الميزات ليست مكتبات يتم تركيبها لاحقًا، بل هي **خصائص فطرية في النواة**، تُدار مباشرة من `database`.

  * **التدويل (i18n):** تغيير قيمة `database.env.lang` هو كل ما يلزم لترجمة الواجهة بالكامل.
  * **السمات (Theming):** تغيير `database.env.theme` يغير تلقائيًا كل الألوان والأنماط في التطبيق.
  * **اتجاه النص (RTL/LTR):** يتغير تلقائيًا مع اللغة، مما يضمن تجربة مستخدم أصيلة.

#### التطبيق التقني:

تصبح إدارة هذه الميزات جزءًا طبيعيًا من إدارة الحالة.

```javascript
// 1. الحالة تعرف كل شيء
const database = {
  env: { theme: 'light', lang: 'en', dir: 'ltr' },
  i18n: {
    // قواميس الترجمة
    en: { greeting: 'Hello' },
    ar: { greeting: 'مرحباً' }
  }
  // ... باقي الحالة
};

// 2. المكون يستخدم الترجمة
function Greeting(db) {
  const message = db.i18n[db.env.lang]?.greeting || 'Welcome';
  return D.Text.H1({}, [message]);
}

// 3. أمر بسيط يغير اللغة والاتجاه
const orders = {
  'lang.switchToArabic': {
    on: ['click'], gkeys: ['lang-ar-btn'],
    handler: (e, ctx) => {
      ctx.setState(s => ({
        ...s,
        env: { ...s.env, lang: 'ar', dir: 'rtl' }
      }));
    }
  }
};
```

-----

### 6\. أدوات مساعدة معيارية (Standardized Utilities): صندوق أدوات موحد

**المبدأ:** لضمان الاتساق ومنع فوضى الاعتماديات، توفر "مشكاة" مكتبة أدوات مساعدة (`Mishkah.utils`) تغطي المهام الشائعة. فبدلاً من أن يستخدم كل مطور مكتبته المفضلة للتعامل مع `localStorage` أو `fetch`، توفر "مشكاة" واجهة موحدة.

هذا يقلل من حجم التطبيق، ويوحد طريقة كتابة الكود، ويجعل الصيانة أسهل بكثير.

#### التطبيق التقني:

التعامل مع واجهات المتصفح يصبح منظمًا وموحدًا.

```javascript
const U = Mishkah.utils;

const orders = {
  'user.fetchProfile': {
    // ...
    handler: async (e, ctx) => {
      try {
        // استخدام الأداة الموحدة للشبكة بدلاً من fetch مباشرة
        const userProfile = await U.Net.get('/api/user/profile');
        ctx.setState(s => ({ ...s, user: userProfile }));

        // استخدام الأداة الموحدة للتخزين المحلي
        U.Storage.local.set('user-profile', userProfile, { ttl: 3600 });
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      }
    }
  }
};
```

-----

### 7\. ثلاثية الحوكمة (The Governance Triad): جهاز المناعة للنظام

**المبدأ:** لضمان بقاء النظام صحيًا ومتينًا على المدى الطويل، توفر "مشكاة" نظام حوكمة آلي متكامل من ثلاثة أجزاء، يعمل كجهاز مناعة للتطبيق.

  * **أ. الحارس (Guardian): الدفاع الوقائي:**
    يعمل كجدار ناري يمنع الأخطاء والثغرات الأمنية **قبل وقوعها**. يفرض قوانين صارمة على مستوى الـ VDOM، مثل منع الوسوم الخطيرة أو فرض خصائص أمان معينة. إنه يمثل **الوقاية** خير من العلاج.

  * **ب. الرقيب (Auditor): المراقبة والتشخيص:**
    يعمل كطبيب يسجل كل الأعراض والسلوكيات في التطبيق. يراقب أداء المكونات، ويلتزم بأفضل الممارسات، ويسجل أي انحراف عن المعايير في سجل دقيق، مع إعطاء تقييم كمي (درجة من -7 إلى +7) لكل حدث. إنه يمثل **التشخيص** الدقيق للمشاكل.

  * **ج. أدوات المطور (DevTools): الحكم والعلاج:**
    تعمل كهيئة قضائية تحلل سجلات "الرقيب" وتصدر أحكامًا آلية. المكونات ذات السجل الممتاز تتم ترقيتها، بينما المكونات ذات السجل السيء يتم عزلها ووضعها في قائمة المراجعة الإجبارية. إنه يمثل **العلاج** المبني على بيانات.

#### التطبيق التقني (مُجمّع):

```javascript
// 1. الحارس يمنع خطأً أمنيًا بشكل استباقي
// لن يتم تصيير هذا الرابط أبدًا لأنه يخالف قواعد الأمان
const maliciousLink = D.Text.A({ attrs: { href: 'javascript:alert("XSS")' } });

// 2. الرقيب يسجل مخالفة لجودة تجربة المستخدم
function CountrySelector(db) {
  if (db.countries.length > 50) {
    // سيتم تسجيل درجة "-3" في سجل هذا المكون
    Mishkah.Auditor.grade('-3', 'CountrySelector', 'Too many options in dropdown');
  }
  // ...
}

// 3. أدوات المطور تصدر حكمًا بناءً على البيانات المتراكمة
// بعد فترة، قد يظهر هذا التقرير في وحدة التحكم:
// | component       | verdict   | score | notes                              |
// |-----------------|-----------|-------|------------------------------------|
// | 'CountrySelector' | HELL      | -65   | Consistent UX violations           |
```


-----

# Mishkah.js — The Framework of Light and Order

*A 7-Pillar Software Architecture Inspired by First Principles*



| Build Status | Version | License |
| :---: | :---: | :---: |
| [](https://github.com/USER/REPO/actions/workflows/ci.yml) | [](https://github.com/USER/REPO/releases/tag/v1.0.0) | [](https://www.google.com/search?q=./LICENSE) |

-----

> **To those lost in the valleys of `React` and `Angular`...**
>
> We know you're tired. Tired of the chaos of `React`, which requires an army of warring libraries just to build a simple hut. Tired of the bureaucracy of `Angular`, which demands three permits just to lay a single brick.
>
> Those frameworks were built to manage the chaos of massive teams in huge corporations. The result was either managed chaos or managed complexity. But Mishkah asks a radical question: **Why manage chaos when you can prevent it from ever taking root?**
>
> Mishkah isn't a third way; it is a return to the straight path. It is a complete, integrated system built on immutable, foundational principles, designed to empower you to build applications as luminous as the light in the parable.

## The 7 Architectural Pillars of Mishkah

-----

### 1\. State Centralization: The Single Source of Truth

**Principle:** In any complex system, chaos begins when there are multiple sources of truth. Mishkah, therefore, enforces the principle of **absolute state centralization**. Every piece of information your application needs—from user identity and UI language to article content and form data—must exist in one and only one place: the `database` object. This object is not merely a data store; it is the **complete World Model** of your application at any given moment.

**Why is this principle so strict?** Because distributed state (like the proliferation of `useState` in React components) creates a nightmare of questions: Which state is the correct one now? Why didn't this component update with that one? Debugging becomes a painful archeological dig.

In Mishkah, the UI is a direct, honest, and visual reflection of the truth held in the `database`. There is no room for lies or desynchronization. This unlocks advanced capabilities like **Time-Travel Debugging**, where a series of states can be recorded and traversed to understand precisely how the system evolved.

#### Technical Implementation:

State updates become transparent and predictable. Every change is merely a function that takes the old state and returns the new state.

```javascript
// The `database` is the mind that contains all system facts.
const database = {
  env: { theme: 'dark', lang: 'en' },
  user: { name: 'Guest', loggedIn: false, visits: 1 },
  cart: { items: [], total: 0 }
};

// Any component is just a faithful reader of these facts.
function Navbar(db) {
  const userName = db.user.name;
  const cartCount = db.cart.items.length;
  // ...renders a UI based on this data
}

// Changes don't happen randomly, but through centralized, organized "orders".
// Imagine this order is called upon login.
function handleLogin(currentUser) {
  // We don't mutate the state directly; we describe the desired change.
  // The framework handles updating the `database` and re-rendering.
  app.setState(currentState => {
    return {
      ...currentState, // Copy the old state
      user: {          // And update only the user slice
        ...currentUser,
        loggedIn: true,
        visits: currentState.user.visits + 1
      }
    };
  });
}
```

With this approach, the data flow in your application becomes as clear and easy to follow as a river in a single channel.

-----

### 2\. A Constrained DSL: A Secure and Constructive Contract

**Principle:** Traditional template languages (like JSX) grant a dangerous amount of freedom. They allow you to mix display logic, business logic, and data access in one place, resulting in hybrid, complex components. Mishkah offers an alternative: a **Domain-Specific Language (DSL) that acts as a strict contract**.

This contract enforces a **clean separation between a component's structure (`attributes`) and its behavior (`events`)**. You don't write a mix of HTML and JavaScript; you describe your UI's structure using a specific and clear vocabulary that prevents you from making mistakes. Behavior (what happens on click) is linked indirectly via keys (`gkeys`), keeping the business logic centralized and organized in the `orders` file.

#### Technical Implementation:

Notice how the language separates the "form" of the button from its "function."

```javascript
const D = Mishkah.DSL;

// 1. Define the Form (in the component file)
// This code describes "what" the button is, not what it "does".
function CloseButton() {
  return D.Forms.Button({
    attrs: {
      class: 'btn btn-danger',
      'aria-label': 'Close',
      'data-m-gkey': 'ui:window-close' // A key that links the button to its function
    }
  }, ['X']);
}

// 2. Define the Function (in the `orders.js` file)
// This code describes "what happens" when the 'ui:window-close' key is invoked.
const orders = {
  'ui.window.close': { // Note how the key matches the gkey with a minor change
    on: ['click'],
    gkeys: ['ui:window-close'],
    handler: (event, context) => {
      // The logic for closing the window is written here
      console.log('Window is closing...');
      // It can also update the state
      context.setState(s => ({ ...s, windowOpen: false }));
    }
  }
};
```

This separation isn't a choice; it's an enforcement that guarantees your components remain simple, reusable, and easy to test.

-----

### 3\. Functional Atom Classification: Intelligent Building Blocks

**Principle:** Interacting directly with HTML tags is like working with raw bricks and mortar. It's possible, but it's prone to error. Mishkah introduces **"Atoms"**: intelligent wrappers around HTML tags, classified into functional categories (`Forms`, `Text`, `Containers`, `Media`).

Each Atom is not just an alias for a tag; it is a **building block that understands its context and rules**. The `D.Forms.Textarea` Atom knows it requires a `value` property, not `text`. The `D.Media.Image` Atom can be programmed to refuse creation if it's not provided with an `alt` property, which is essential for accessibility. This transforms development from an error-prone manual process into an assembly of **smart, safe units**.

#### Technical Implementation:

Atoms enforce best practices and protect you from common mistakes.

```javascript
const D = Mishkah.DSL;

// Example 1: The Image atom enforces accessibility
// This code may fail to build if `alt` is not provided (depending on settings)
const profilePicture = D.Media.Image({
  attrs: {
    src: '/path/to/image.jpg',
    alt: 'User profile picture of Abdullah' // Mandatory property
  }
});

// Example 2: The Anchor atom protects against security vulnerabilities
// This atom automatically adds `rel="noopener noreferrer"` when `target="_blank"` is used
const externalLink = D.Text.A({
  attrs: {
    href: 'https://example.com',
    target: '_blank'
  }
}, ['A Safe External Link']);
```

-----

### 4\. Composable Component Library: Accelerate and Unify Development

**Principle:** If Atoms are the bricks, then **`mishkah-ui` components** are the prefabricated walls and columns. Instead of building a `Card` every time from `div`, `h2`, and `p` Atoms, you use `UI.Card`, which encapsulates all that complexity behind a simple interface.

This library ensures **visual and functional consistency** across the entire application and implements accessibility and performance best practices by default. It is a true embodiment of the **"Don't Repeat Yourself" (DRY)** principle.

#### Technical Implementation:

Building complex interfaces becomes a fast and enjoyable assembly process.

```javascript
const UI = Mishkah.UI;
const D = Mishkah.DSL;

// Build a complex Dialog with two lines of code
// This component automatically handles things like:
// - Focus Trapping within the dialog
// - Closing the dialog on 'Escape' key press
// - System-compatible visual themes
const confirmationDialog = UI.Dialog({
  trigger: UI.Button({}, ['Delete Item']),
  title: 'Confirm Deletion',
  description: 'Are you sure you want to delete this item? This action cannot be undone.',
  footer: D.Containers.Div({ class: 'hstack' }, [
    UI.Button({ variant: 'secondary' }, ['Cancel']),
    UI.Button({ variant: 'danger' }, ['Yes, Delete'])
  ])
});
```

-----

### 5\. Integrated Global Environment: Natively Global-Ready

**Principle:** Global features like multi-language support and theming are not afterthoughts; they are part of the application's core architecture. In Mishkah, these features are not libraries to be installed later, but **innate properties of the kernel**, managed directly from the `database`.

  * **Internationalization (i18n):** Changing `database.env.lang` is all it takes to translate the entire UI.
  * **Theming:** Changing `database.env.theme` automatically alters all colors and styles in the application.
  * **Text Direction (RTL/LTR):** Changes automatically with the language, ensuring an authentic user experience.

#### Technical Implementation:

Managing these features becomes a natural part of state management.

```javascript
// 1. The state knows everything
const database = {
  env: { theme: 'light', lang: 'en', dir: 'ltr' },
  i18n: {
    // Translation dictionaries
    en: { greeting: 'Hello' },
    ar: { greeting: 'مرحباً' }
  }
  // ...rest of state
};

// 2. The component uses the translation
function Greeting(db) {
  const message = db.i18n[db.env.lang]?.greeting || 'Welcome';
  return D.Text.H1({}, [message]);
}

// 3. A simple order changes the language and direction
const orders = {
  'lang.switchToArabic': {
    on: ['click'], gkeys: ['lang-ar-btn'],
    handler: (e, ctx) => {
      ctx.setState(s => ({
        ...s,
        env: { ...s.env, lang: 'ar', dir: 'rtl' }
      }));
    }
  }
};
```

-----

### 6\. Standardized Utilities: A Unified Toolbox

**Principle:** To ensure consistency and prevent dependency chaos, Mishkah provides a utility library (`Mishkah.utils`) covering common tasks. Instead of each developer using their favorite library for `localStorage` or `fetch`, Mishkah offers a unified interface.

This reduces the application's bundle size, standardizes coding patterns, and makes maintenance significantly easier.

#### Technical Implementation:

Interacting with browser APIs becomes organized and uniform.

```javascript
const U = Mishkah.utils;

const orders = {
  'user.fetchProfile': {
    // ...
    handler: async (e, ctx) => {
      try {
        // Use the unified network utility instead of fetch directly
        const userProfile = await U.Net.get('/api/user/profile');
        ctx.setState(s => ({ ...s, user: userProfile }));

        // Use the unified storage utility
        U.Storage.local.set('user-profile', userProfile, { ttl: 3600 });
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      }
    }
  }
};
```

-----

### 7\. The Governance Triad: The System's Immune System

**Principle:** To ensure the system remains healthy and robust over the long term, Mishkah provides an integrated, three-part automated governance system that acts as the application's immune system.

  * **A. The Guardian: Proactive Defense:**
    Acts as a firewall that prevents errors and security vulnerabilities **before they happen**. It enforces strict rules at the VDOM level, such as blocking dangerous tags or enforcing specific security attributes. It embodies **prevention** over cure.

  * **B. The Auditor: Monitoring and Diagnosis:**
    Acts as a doctor that logs all symptoms and behaviors in the application. It monitors component performance, adheres to best practices, and records any deviation from standards in a detailed log, assigning a quantitative score (-7 to +7) to each event. It represents precise **diagnosis** of problems.

  * **C. The DevTools: Judgment and Treatment:**
    Acts as a judicial body that analyzes the Auditor's logs and issues automated verdicts. Components with excellent records are promoted, while those with poor records are isolated and placed on a mandatory review list. It represents data-driven **treatment**.

#### Technical Implementation (Aggregated):

```javascript
// 1. The Guardian proactively prevents a security error
// This link will never be rendered because it violates security rules
const maliciousLink = D.Text.A({ attrs: { href: 'javascript:alert("XSS")' } });

// 2. The Auditor logs a UX quality violation
function CountrySelector(db) {
  if (db.countries.length > 50) {
    // A score of "-3" will be logged for this component's record
    Mishkah.Auditor.grade('-3', 'CountrySelector', 'Too many options in dropdown');
  }
  // ...
}

// 3. The DevTools issues a verdict based on accumulated data
// After some time, this report might appear in the console:
// | component       | verdict   | score | notes                      |
// |-----------------|-----------|-------|----------------------------|
// | 'CountrySelector' | HELL      | -65   | Consistent UX violations   |
```

