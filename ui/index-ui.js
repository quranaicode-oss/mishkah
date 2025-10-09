(function (window) {
  'use strict';

  const M = window.Mishkah = window.Mishkah || {};
  const Apps = M.apps = M.apps || {};
  const IndexApp = Apps.index = Apps.index || {};
  const Templates = M.templates = M.templates || {};

  const D = M.DSL;
  const UI = M.UI;
  const U = M.utils;
  const { tw, cx, setTheme, setDir } = U.twcss;

  const ensureDict = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
  const ensureArray = (value) => (Array.isArray(value) ? value : []);

  const DEFAULT_LANG_OPTIONS = [
    { code: 'ar', label: { ar: 'العربية', en: 'Arabic' } },
    { code: 'en', label: { ar: 'الإنجليزية', en: 'English' } }
  ];

  const LANGUAGE_DECOR = {
    ar: { emoji: '🕌', short: 'AR' },
    en: { emoji: '🌍', short: 'EN' }
  };

  /* ------------------------------------------------------------------ */
  /* i18n helpers                                                        */
  /* ------------------------------------------------------------------ */

  const dict = {
    'app.title': { ar: 'مشكاة —  إطار عمل النور والنظام  ', en: 'Mishkah — Lighthouse Docs ' },
    'header.subtitle': {
      ar: 'مرجع النور يجمع الوثائق، الإعدادات، ولعبة الأمثال    .',
      en: 'A radiant hub that unifies the docs, controls, and the Proverbs game in one canvas.'
    },
    'header.lang.ar': { ar: 'العربية', en: 'Arabic' },
    'header.lang.en': { ar: 'الإنجليزية', en: 'English' },
    'header.theme.toggle': { ar: 'تبديل الثيم', en: 'Toggle theme' },
    'header.theme.label': { ar: 'الثيم الجاهز', en: 'Theme preset' },
    'header.theme.lab': { ar: 'فتح معمل الثيم المتقدم', en: 'Open advanced theme lab' },
    'header.menu.close': { ar: 'إغلاق القائمة', en: 'Close menu' },
    'header.search.placeholder': { ar: 'ابحث في الصفحات وفلسفة مشكاة...', en: 'Search pages and Mishkah philosophy...' },
    'header.search.results': { ar: 'نتائج البحث', en: 'Search results' },
    'header.search.noResults': { ar: 'لا توجد نتائج مطابقة.', en: 'No matching results yet.' },
    'header.templates.label': { ar: 'قوالب العرض', en: 'Display templates' },
    'designLab.openButton': { ar: 'مختبر الألوان المتقدم', en: 'Advanced theme lab' },
    'designLab.title': { ar: 'مختبر تنسيق الواجهة', en: 'Interface Design Lab' },
    'designLab.subtitle': { ar: 'تحكم في متغيرات CSS ورؤية التغييرات مباشرة.', en: 'Control every CSS variable and preview instantly.' },
    'designLab.themeTitle': { ar: 'حزم الثيم السريعة', en: 'Theme presets' },
    'designLab.modeHint': { ar: 'اختر حزمة، ثم عدّل التفاصيل أدناه.', en: 'Pick a preset, then fine-tune every detail below.' },
    'designLab.resetAll': { ar: 'إرجاع قيم الحزمة', en: 'Reset to preset values' },
    'designLab.resetVar': { ar: 'إرجاع القيمة الافتراضية', en: 'Revert to default' },
    'designLab.currentValue': { ar: 'القيمة الحالية', en: 'Current value' },
    'designLab.defaultValue': { ar: 'قيمة الحزمة', en: 'Preset value' },
    'designLab.close': { ar: 'إغلاق المعمل', en: 'Close lab' },
    'designLab.group.core': { ar: 'ألوان جوهرية', en: 'Core palette' },
    'designLab.group.coreHint': { ar: 'لون الخلفية والنصوص الرئيسية والعناصر البارزة.', en: 'Background, text, and primary accent colors.' },
    'designLab.group.surface': { ar: 'طبقات السطح والخلفيات', en: 'Surface layers & backgrounds' },
    'designLab.group.surfaceHint': { ar: 'تحكم في البطاقات والسطوح والزجاجيات والحدود.', en: 'Tune cards, surfaces, glass panels, and borders.' },
    'designLab.group.effects': { ar: 'التأثيرات البصرية', en: 'Visual effects' },
    'designLab.group.effectsHint': { ar: 'تعديل الظلال والتوهجات الدقيقة.', en: 'Adjust shadows and subtle glows.' },
    'designLab.group.typography': { ar: 'منظومة الخطوط', en: 'Typography system' },
    'designLab.group.typographyHint': { ar: 'ضبط أحجام العناوين والنصوص التفصيلية.', en: 'Set heading and micro typography scales.' },
    'designLab.group.sizing': { ar: 'أحجام العناصر', en: 'Element sizing' },
    'designLab.group.sizingHint': { ar: 'تحكم في أبعاد البلاطات ومقياس الخط العام.', en: 'Control tile dimensions and global font scale.' },
    'designLab.var.background': { ar: 'لون الخلفية', en: 'Background color' },
    'designLab.var.foreground': { ar: 'لون النص الأساسي', en: 'Foreground text color' },
    'designLab.var.mutedBase': { ar: 'لون النص الثانوي', en: 'Muted base color' },
    'designLab.var.muted': { ar: 'لون النص الثانوي المتباين', en: 'Muted foreground' },
    'designLab.var.primary': { ar: 'لون التمييز الرئيسي', en: 'Primary accent color' },
    'designLab.var.primaryForeground': { ar: 'نص فوق التمييز', en: 'Text on primary' },
    'designLab.var.accent': { ar: 'لون مساند', en: 'Accent color' },
    'designLab.var.accentForeground': { ar: 'نص اللون المساند', en: 'Accent foreground' },
    'designLab.var.ring': { ar: 'لون الحلقة البارزة', en: 'Ring color' },
    'designLab.var.accentRing': { ar: 'وهج الحواف', en: 'Accent ring glow' },
    'designLab.var.card': { ar: 'لون البطاقة', en: 'Card background' },
    'designLab.var.cardForeground': { ar: 'نص البطاقة', en: 'Card foreground' },
    'designLab.var.surface1': { ar: 'السطح الأول', en: 'Surface layer 1' },
    'designLab.var.surface2': { ar: 'السطح الثاني', en: 'Surface layer 2' },
    'designLab.var.surface3': { ar: 'السطح الثالث', en: 'Surface layer 3' },
    'designLab.var.border': { ar: 'لون الحدود', en: 'Border color' },
    'designLab.var.input': { ar: 'حدود المدخلات', en: 'Input border' },
    'designLab.var.shadow': { ar: 'الظل الرئيسي', en: 'Primary shadow' },
    'designLab.var.radius': { ar: 'انحناء الزوايا', en: 'Border radius' },
    'designLab.var.gradient': { ar: 'تدرج الخلفية', en: 'Page gradient' },
    'designLab.var.overlay1': { ar: 'طبقة ضوئية أولى', en: 'Overlay layer 1' },
    'designLab.var.overlay2': { ar: 'طبقة ضوئية ثانية', en: 'Overlay layer 2' },
    'designLab.var.panelGlass': { ar: 'وهج اللوح الزجاجي', en: 'Glass panel tint' },
    'designLab.var.panelBorder': { ar: 'حدود اللوح', en: 'Panel border' },
    'designLab.var.tileBg': { ar: 'خلفية البلاطات', en: 'Tile background' },
    'designLab.var.tileRevealed': { ar: 'خلفية البلاطات المكشوفة', en: 'Revealed tile background' },
    'designLab.var.tileBorder': { ar: 'حدود البلاطات', en: 'Tile border' },
    'designLab.var.lettersShadow': { ar: 'ظل الأزرار', en: 'Letter shadow' },
    'designLab.var.lettersHover': { ar: 'تأثير التحويم', en: 'Letter hover effect' },
    'designLab.var.tileSize': { ar: 'حجم البلاطات', en: 'Tile size' },
    'designLab.var.font.body': { ar: 'نص الفقرات', en: 'Body text size' },
    'designLab.var.font.h1': { ar: 'عنوان ١', en: 'Heading 1 size' },
    'designLab.var.font.h2': { ar: 'عنوان ٢', en: 'Heading 2 size' },
    'designLab.var.font.h3': { ar: 'عنوان ٣', en: 'Heading 3 size' },
    'designLab.var.font.scale3xl': { ar: 'عنوان عرضي (3XL)', en: 'Display heading (3XL)' },
    'designLab.var.font.scale2xl': { ar: 'عنوان بارز (2XL)', en: 'Hero heading (2XL)' },
    'designLab.var.font.scaleXl': { ar: 'عنوان فرعي (XL)', en: 'Sub heading (XL)' },
    'designLab.var.font.scaleLg': { ar: 'نص كبير (LG)', en: 'Large text (LG)' },
    'designLab.var.font.scaleMd': { ar: 'نص أساسي (MD)', en: 'Body scale (MD)' },
    'designLab.var.font.scaleSm': { ar: 'نص صغير (SM)', en: 'Small text (SM)' },
    'designLab.var.font.scaleXs': { ar: 'تفاصيل دقيقة (XS)', en: 'Micro text (XS)' },
    'designLab.var.font.sidebar': { ar: 'نص القائمة الجانبية', en: 'Sidebar label size' },
    'designLab.var.font.quote': { ar: 'نص الاقتباس', en: 'Blockquote size' },
    'designLab.var.font.info': { ar: 'نص اللوحات التوضيحية', en: 'Info panel text size' },
    'designLab.var.font.letter': { ar: 'حجم حروف اللعب', en: 'Letter button size' },
    'designLab.var.font.status': { ar: 'حجم شريط الحالة', en: 'Status strip size' },
    'designLab.var.fontScale': { ar: 'مقياس الخط العام', en: 'Global font scale' },
    'header.theme.presets.modern-dark': { ar: 'ليل مشكاة', en: 'Mishkah Midnight' },
    'header.theme.presets.modern-light': { ar: 'نهار مشكاة', en: 'Mishkah Dawn' },
    'header.theme.presets.amber-dusk': { ar: 'شفق عنبري', en: 'Amber Dusk' },
    'header.theme.presets.aurora-night': { ar: 'ليل الشفق', en: 'Aurora Night' },
    'header.theme.presets.sahara-sunrise': { ar: 'فجر الصحراء', en: 'Sahara Sunrise' },
    'header.theme.presets.emerald-oasis': { ar: 'واحة الزمرد', en: 'Emerald Oasis' },
    'header.theme.presets.rose-mist': { ar: 'ضباب الورد', en: 'Rose Mist' },
    'header.lang.label': { ar: 'اللغة', en: 'Language' },
    'nav.counter': { ar: 'العداد', en: 'Counter' },
    'nav.proverbs': { ar: 'لعبة الأمثال', en: 'Proverbs Game' },
    'nav.sequence': { ar: 'لعبة المتواليات', en: 'Sequence Game' },
    'nav.readme': { ar: 'اقرأ الوثيقة', en: 'Read Me' },
    'counter.title': { ar: 'عداد بسيط', en: 'Simple Counter' },
    'counter.reset': { ar: 'إعادة', en: 'Reset' },
    'game.title': { ar: 'لعبة الأمثال والحكم', en: 'Proverbs & Wisdom Game' },
    'game.start': { ar: 'ابدأ اللعبة', en: 'Start Game' },
    'game.new': { ar: 'مثل جديد', en: 'New Proverb' },
    'game.tries': { ar: 'المحاولات المتبقية', en: 'Tries left' },
    'game.timeLabel': { ar: 'الوقت المتبقي', en: 'Time left' },
    'game.statusLabel': { ar: 'حالة اللعبة', en: 'Game status' },
    'game.status.idle': { ar: 'جاهزة', en: 'Ready' },
    'game.status.running': { ar: 'قيد اللعب', en: 'In progress' },
    'game.status.won': { ar: 'انتصار', en: 'Victory' },
    'game.status.lost': { ar: 'خسارة', en: 'Defeat' },
    'game.settings.title': { ar: 'إعدادات اللعبة', en: 'Game settings' },
    'game.settings.subtitle': { ar: 'اضبط زمن الجولة والمكافأة عند الإجابة الصحيحة.', en: 'Adjust the round timer and the correct-answer reward.' },
    'game.settings.timePerChoice': { ar: 'عدد الثواني لكل اختيار', en: 'Seconds per choice' },
    'game.settings.timePerChoiceHint': { ar: 'يُعاد ضبط المؤقّت إلى هذا العدد مع كل محاولة جديدة.', en: 'The timer resets to this value on each new attempt.' },
    'game.settings.bonusLabel': { ar: 'مكافأة الوقت للإجابة الصحيحة', en: 'Time bonus for correct answer' },
    'game.settings.bonusHint': { ar: 'تُضاف هذه الثواني عند اختيار حرف صحيح (بحد أقصى ٢٠ ثانية).', en: 'Add these seconds after each correct letter (capped at 20 seconds).' },
    'game.feedback.correct': { ar: 'أحسنت! حرف صحيح يقترب بك من الحكمة.', en: 'Great job! The wisdom is closer.' },
    'game.feedback.wrong': { ar: 'هذه المحاولة لم تصب الهدف، جرّب مرة أخرى.', en: 'That guess missed—try again.' },
    'game.feedback.win': { ar: 'إبداع! اكتملت الحكمة بالكامل.', en: 'Brilliant! The proverb is complete.' },
    'game.feedback.lose': { ar: 'انتهت المحاولات، لكن الحكمة ما زالت بانتظارك.', en: 'Tries are over, but the wisdom remains.' },
    'game.hintTitle': { ar: 'التلميح التعليمي', en: 'Educational hint' },
    'game.solution': { ar: 'الحل الكامل', en: 'Full solution' },
    'game.reveal': { ar: 'اكتشف الحكمة', en: 'Reveal wisdom' },
    'game.explanation': { ar: 'شرح المثل', en: 'Explanation' },
    'game.lesson': { ar: 'ما نتعلمه', en: 'Lesson' },
    'game.source': { ar: 'المصدر', en: 'Source' },
    'game.letters': { ar: 'الأحرف المتاحة', en: 'Available letters' },
    'game.lastMove': { ar: 'ردة فعل فورية', en: 'Instant feedback' },
    'game.playAgain': { ar: 'العب مرة أخرى', en: 'Play again' },
    'game.tryAgain': { ar: 'حاول مجددًا', en: 'Try again' },
    'game.revealPrompt': { ar: 'انقر لاكتشاف الحكمة كاملة بعد نهاية الجولة.', en: 'Tap to reveal the full wisdom after the round.' },
    'readme.title': { ar: 'وثيقة مشكاة', en: 'Mishkah Readme' },
    'readme.hint': { ar: 'بدّل اللغة من الأعلى لقراءة الوثيقة بلغتك المفضلة.', en: 'Switch language from the header to read in your preferred language.' },
    'readme.section.tec': { ar: 'الوثيقة التقنية', en: 'Technical Document' },
    'readme.section.base': { ar: 'الوثيقة الأساسية', en: 'Foundational Document' },
    'sequence.title': { ar: 'لعبة تخمين المتواليات العددية', en: 'Number Sequence Challenge' },
    'sequence.description': { ar: 'حلّل النمط وتوقّع الرقم التالي في المتوالية.', en: 'Analyze the pattern and predict the next number in the sequence.' },
    'sequence.start': { ar: 'ابدأ التحدي', en: 'Start challenge' },
    'sequence.new': { ar: 'متوالية جديدة', en: 'New sequence' },
    'sequence.submit': { ar: 'تحقّق من الإجابة', en: 'Check answer' },
    'sequence.inputLabel': { ar: 'توقع الرقم التالي', en: 'Guess the next number' },
    'sequence.tries': { ar: 'المحاولات المتبقية', en: 'Tries left' },
    'sequence.statusLabel': { ar: 'حالة اللعبة', en: 'Game status' },
    'sequence.status.idle': { ar: 'جاهزة للبدء', en: 'Ready to start' },
    'sequence.status.running': { ar: 'قيد اللعب', en: 'In progress' },
    'sequence.status.won': { ar: 'انتصار', en: 'Victory' },
    'sequence.status.lost': { ar: 'خسارة', en: 'Defeat' },
    'sequence.feedback.correct': { ar: 'توقع صحيح! استمر في التحليل.', en: 'Great prediction! Keep reading the pattern.' },
    'sequence.feedback.wrong': { ar: 'المتوالية تشير لرقم مختلف، حاول مجددًا.', en: 'The sequence points elsewhere—try again.' },
    'sequence.feedback.win': { ar: 'إجابة مذهلة! اكتشفت النمط الكامل.', en: 'Brilliant! You uncovered the full pattern.' },
    'sequence.feedback.lose': { ar: 'انتهت المحاولات، فلنتعلّم من النمط.', en: 'Out of tries—let’s learn from the pattern.' },
    'sequence.hintTitle': { ar: 'تلميح عن النمط', en: 'Pattern hint' },
    'sequence.rule': { ar: 'قاعدة المتوالية', en: 'Sequence rule' },
    'sequence.answer': { ar: 'الإجابة الصحيحة', en: 'Correct answer' },
    'sequence.lesson': { ar: 'ما نتعلمه', en: 'Lesson' },
    'sequence.prompt': { ar: 'ما هو الرقم التالي؟', en: 'What is the next number?' },
    'sequence.historyTitle': { ar: 'سجل المحاولات', en: 'Attempt history' },
    'sequence.history.empty': { ar: 'ابدأ اللعب لتظهر محاولاتك هنا.', en: 'Start playing to see your attempts here.' },
    'sequence.reveal': { ar: 'اكتشف الحل', en: 'Reveal solution' },
    'sequence.revealPrompt': { ar: 'انقر لاكتشاف شرح النمط بعد انتهاء الجولة.', en: 'Tap to reveal the pattern explanation after the round.' },
    'sequence.tryAgain': { ar: 'حاول مرة أخرى', en: 'Try again' },
    'footer.text': { ar: 'مشكاة — بناء التطبيقات بنور منظم.', en: 'Mishkah — build luminous applications with order.' },
    'about.team.title': { ar: 'فريق مشكاة', en: 'The Mishkah Team' },
    'about.team.subtitle': { ar: 'مجموعة من البنائين تجمع بين الفلسفة والتصميم والهندسة.', en: 'A guild of builders blending philosophy, design, and engineering.' },
    'about.team.architect.title': { ar: 'المهندس المعماري', en: 'Architect' },
    'about.team.architect.desc': { ar: 'يحوّل فلسفة مشكاة إلى خرائط تطبيقية واضحة ويضمن الانسجام بين المكونات.', en: 'Translates Mishkah’s philosophy into precise application blueprints and keeps components in harmony.' },
    'about.team.strategist.title': { ar: 'الراوي الاستراتيجي', en: 'Strategist' },
    'about.team.strategist.desc': { ar: 'يربط بين رؤية المنصة وحاجات المطور ويقود دليل التصميم والـ SDK.', en: 'Connects the platform vision with developer needs and curates the design/SDK narrative.' },
    'about.team.designer.title': { ar: 'مصمم التجربة', en: 'Experience Designer' },
    'about.team.designer.desc': { ar: 'ينحت الواجهات والتمبلتس لتبقى مضيئة وقابلة للتخصيص.', en: 'Shapes templates and layouts to stay luminous and customizable.' },
    'about.team.engineer.title': { ar: 'مهندس التنفيذ', en: 'Implementation Engineer' },
    'about.team.engineer.desc': { ar: 'يبني الأوامر والـ DSL ويضمن أن التطبيق ينبض بالحياة بترتيب.', en: 'Builds the orders and DSL so the application comes alive with order.' },
    'about.goals.title': { ar: 'أهداف إطار مشكاة', en: 'Goals of the Mishkah framework' },
    'about.goals.subtitle': { ar: 'مسار واضح يخدم المطور أولًا ويعيد الفرح للحرفة.', en: 'A clear path that serves the developer first and restores joy to the craft.' },
    'about.goals.devJoy': { ar: 'تقديم أدوات ترفع عن المطور عبء التشتت وتمنحه متعة البناء.', en: 'Deliver tools that remove fragmentation and give developers the joy of building.' },
    'about.goals.playfulDocs': { ar: 'دمج الوثائق مع الألعاب التفاعلية كي يتحول التعلم إلى تجربة مرحة.', en: 'Blend documentation with interactive games so learning becomes playful.' },
    'about.goals.holistic': { ar: 'توحيد الثيمات، القوالب، والـ DSL في مصدر واحد يمكن تطويره واستعراضه فورًا.', en: 'Unify themes, templates, and DSL in a single source that can be evolved and previewed instantly.' },
    'about.goals.openCraft': { ar: 'صياغة إطار يخدم الفرق الصغيرة والمستقلين قبل المؤسسات الضخمة.', en: 'Craft a framework that empowers small teams and independents before large corporations.' },
    'ui.components.title': { ar: 'دليل مكونات الواجهة', en: 'UI component guide' },
    'ui.components.subtitle': { ar: 'عرض حي لأهم مكونات Mishkah UI مع وصف ثنائي اللغة ومعاينات تطبيقية.', en: 'Live tour of Mishkah UI essentials with bilingual explanations and hands-on previews.' },
    'ui.components.core': { ar: 'المكونات الجوهرية', en: 'Core components' },
    'ui.components.patterns': { ar: 'أنماط الواجهات', en: 'Interface patterns' },
    'ui.components.story': { ar: 'كل عنصر يأتي مع قصة استخدام في الدليل التطبيقي.', en: 'Each element ships with usage stories in the application guide.' },
    'ui.components.previewLabel': { ar: 'المعاينة الحية', en: 'Live preview' },
    'ui.components.exampleLabel': { ar: 'مثال تطبيقي', en: 'Practical example' },
    'utils.title': { ar: 'مكتبة الأدوات', en: 'Utilities library' },
    'utils.subtitle': { ar: 'تعرف على طبقات Mishkah.utils الفعلية مع شرح ثنائي اللغة وأمثلة جاهزة.', en: 'Explore Mishkah.utils groups with bilingual explanations and ready-to-run snippets.' },
    'utils.functionLabel': { ar: 'الدوال الأساسية', en: 'Key helpers' },
    'utils.exampleLabel': { ar: 'لقطة كود', en: 'Code snippet' },
    'sdk.title': { ar: 'دليل الـ SDK', en: 'SDK guide' },
    'sdk.subtitle': { ar: 'كيف تستخدم Pages.create لتوليد تطبيقات متعددة القوالب من مصدر واحد.', en: 'Use Pages.create to generate multi-template apps from a single source of truth.' },
    'sdk.point.bootstrap': { ar: 'تهيئة واحدة تجمع البيانات، الأوامر، والـ slots ثم تترك القوالب تتكفل بالباقي.', en: 'Single bootstrap that wires data, orders, and slots, letting templates handle the rest.' },
    'sdk.point.templates': { ar: 'تبديل فوري بين القوالب لمعاينة نفس المحتوى في سياقات مختلفة.', en: 'Instantly swap templates to preview the same content in multiple contexts.' },
    'sdk.point.extensibility': { ar: 'قابلية توسعة عبر pageClasses لتوزيع الصفحات على أقسام مرنة.', en: 'Extend via pageClasses to distribute pages into flexible sections.' },
    'ui.pos.title': { ar: 'واجهات نقاط البيع POS', en: 'POS interface patterns' },
    'ui.pos.subtitle': { ar: 'تصميم يعزز سرعة الطلبات ويُظهِر حالة الطاولات والطلبات في لحظة.', en: 'Design focused on rapid ordering with instant table and order status awareness.' },
    'ui.pos.point.orders': { ar: 'لوحة أوامر بصرية تدعم البحث السريع والاختصارات.', en: 'Visual order board supporting quick search and shortcuts.' },
    'ui.pos.point.tickets': { ar: 'تدفق تذاكر متزامن مع الطهاة وخط الإعداد.', en: 'Synchronized ticket flow connecting chefs and prep stations.' },
    'ui.pos.point.analytics': { ar: 'إحصائيات فورية للمبيعات والمخزون قابلة للتخصيص.', en: 'Instant analytics for sales and inventory with customizable views.' },
    'ui.kds.title': { ar: 'لوحات عرض المطابخ KDS', en: 'Kitchen display systems' },
    'ui.kds.subtitle': { ar: 'عرض تتابعي للطلبات يمكّن الفريق من رؤية الأولويات بوضوح.', en: 'Sequential ticket view that lets teams see priorities at a glance.' },
    'ui.kds.point.timing': { ar: 'مؤقتات مرئية وتنبيهات ألوان لتتبع تقدم الأطباق.', en: 'Visual timers and color alerts to track dish progress.' },
    'ui.kds.point.sync': { ar: 'تحديث لحظي مع الـ POS لضمان عدم فقدان أي طلب.', en: 'Real-time sync with POS to ensure no ticket is missed.' },
    'ui.kds.point.modes': { ar: 'أوضاع عرض مختلفة (تحضير / تقديم) قابلة للتبديل بسهولة.', en: 'Switchable modes (prep/service) tailored to kitchen rhythms.' }
  };

  const THEME_DECOR = {
    'modern-dark': { emoji: '🌌' },
    'modern-light': { emoji: '🌅' },
    'amber-dusk': { emoji: '🌇' },
    'aurora-night': { emoji: '🧭' },
    'sahara-sunrise': { emoji: '🏜️' },
    'emerald-oasis': { emoji: '🌿' },
    'rose-mist': { emoji: '🌸' }
  };

  const DEFAULT_THEME_PRESETS = [
    {
      key: 'modern-dark',
      mode: 'dark',
      label: dict['header.theme.presets.modern-dark'],
      overrides: {
        '--background': 'hsl(222 47% 9%)',
        '--foreground': 'hsl(214 32% 96%)',
        '--primary': 'hsl(220 90% 66%)',
        '--primary-foreground': '#0f172a',
        '--accent': 'hsl(199 89% 48%)',
        '--accent-foreground': '#011c33',
        '--muted': 'hsl(222 34% 18%)',
        '--border': 'hsl(219 28% 26%)',
        '--surface-1': 'color-mix(in oklab, var(--background) 82%, black)',
        '--surface-2': 'color-mix(in oklab, var(--background) 76%, black)',
        '--surface-3': 'color-mix(in oklab, var(--background) 68%, black)'
      }
    },
    {
      key: 'modern-light',
      mode: 'light',
      label: dict['header.theme.presets.modern-light'],
      overrides: {
        '--background': 'hsl(214 55% 98%)',
        '--foreground': 'hsl(222 47% 14%)',
        '--primary': 'hsl(221 83% 53%)',
        '--primary-foreground': '#ffffff',
        '--accent': 'hsl(199 92% 47%)',
        '--accent-foreground': '#06283d',
        '--muted': 'hsl(213 32% 92%)',
        '--border': 'hsl(216 33% 85%)',
        '--surface-1': 'color-mix(in oklab, var(--background) 96%, white)',
        '--surface-2': 'color-mix(in oklab, var(--background) 92%, white)',
        '--surface-3': 'color-mix(in oklab, var(--background) 88%, white)'
      }
    },
    {
      key: 'amber-dusk',
      mode: 'dark',
      label: dict['header.theme.presets.amber-dusk'],
      overrides: {
        '--background': 'hsl(26 38% 12%)',
        '--foreground': 'hsl(33 80% 94%)',
        '--primary': 'hsl(18 86% 62%)',
        '--primary-foreground': '#2d0a02',
        '--accent': 'hsl(43 90% 55%)',
        '--accent-foreground': '#2a1800',
        '--muted': 'hsl(28 30% 24%)',
        '--border': 'hsl(28 26% 32%)',
        '--surface-1': 'color-mix(in oklab, var(--background) 74%, black)',
        '--surface-2': 'color-mix(in oklab, var(--background) 68%, black)',
        '--surface-3': 'color-mix(in oklab, var(--background) 60%, black)'
      }
    },
    {
      key: 'aurora-night',
      mode: 'dark',
      label: dict['header.theme.presets.aurora-night'],
      overrides: {
        '--background': 'hsl(229 64% 12%)',
        '--foreground': 'hsl(214 70% 94%)',
        '--primary': 'hsl(266 83% 72%)',
        '--primary-foreground': '#1e0933',
        '--accent': 'hsl(193 88% 54%)',
        '--accent-foreground': '#01131f',
        '--muted': 'hsl(231 36% 22%)',
        '--border': 'hsl(231 28% 32%)',
        '--surface-1': 'color-mix(in oklab, var(--background) 78%, black)',
        '--surface-2': 'color-mix(in oklab, var(--background) 72%, black)',
        '--surface-3': 'color-mix(in oklab, var(--background) 64%, black)'
      }
    },
    {
      key: 'sahara-sunrise',
      mode: 'light',
      label: dict['header.theme.presets.sahara-sunrise'],
      overrides: {
        '--background': 'hsl(38 92% 95%)',
        '--foreground': 'hsl(27 64% 24%)',
        '--primary': 'hsl(18 84% 58%)',
        '--primary-foreground': '#2e0a02',
        '--accent': 'hsl(43 100% 68%)',
        '--accent-foreground': '#2c1a00',
        '--muted': 'hsl(33 60% 88%)',
        '--border': 'hsl(30 45% 78%)',
        '--surface-1': 'color-mix(in oklab, var(--background) 94%, white)',
        '--surface-2': 'color-mix(in oklab, var(--background) 90%, white)',
        '--surface-3': 'color-mix(in oklab, var(--background) 86%, white)'
      }
    },
    {
      key: 'emerald-oasis',
      mode: 'light',
      label: dict['header.theme.presets.emerald-oasis'],
      overrides: {
        '--background': 'hsl(156 44% 94%)',
        '--foreground': 'hsl(163 44% 18%)',
        '--primary': 'hsl(161 78% 40%)',
        '--primary-foreground': '#e7fff5',
        '--accent': 'hsl(189 67% 52%)',
        '--accent-foreground': '#012c32',
        '--muted': 'hsl(156 36% 88%)',
        '--border': 'hsl(158 32% 76%)',
        '--surface-1': 'color-mix(in oklab, var(--background) 95%, white)',
        '--surface-2': 'color-mix(in oklab, var(--background) 90%, white)',
        '--surface-3': 'color-mix(in oklab, var(--background) 85%, white)'
      }
    },
    {
      key: 'rose-mist',
      mode: 'light',
      label: dict['header.theme.presets.rose-mist'],
      overrides: {
        '--background': 'hsl(332 64% 97%)',
        '--foreground': 'hsl(333 36% 20%)',
        '--primary': 'hsl(337 80% 72%)',
        '--primary-foreground': '#3d0013',
        '--accent': 'hsl(280 76% 74%)',
        '--accent-foreground': '#220029',
        '--muted': 'hsl(318 52% 90%)',
        '--border': 'hsl(320 36% 82%)',
        '--surface-1': 'color-mix(in oklab, var(--background) 95%, white)',
        '--surface-2': 'color-mix(in oklab, var(--background) 92%, white)',
        '--surface-3': 'color-mix(in oklab, var(--background) 88%, white)'
      }
    }
  ];

  const DESIGN_LAB_VARIABLES = [
    { name: '--background', labelKey: 'designLab.var.background', type: 'color', default: 'hsl(214 55% 98%)', group: 'core' },
    { name: '--foreground', labelKey: 'designLab.var.foreground', type: 'color', default: 'hsl(222 47% 14%)', group: 'core' },
    {
      name: '--muted',
      labelKey: 'designLab.var.mutedBase',
      type: 'color',
      default: 'hsl(213 32% 92%)',
      darkDefault: 'hsl(222 34% 18%)',
      group: 'core'
    },
    {
      name: '--muted-foreground',
      labelKey: 'designLab.var.muted',
      type: 'color',
      default: 'hsl(215 20% 42%)',
      darkDefault: 'hsl(215 18% 72%)',
      group: 'core'
    },
    { name: '--primary', labelKey: 'designLab.var.primary', type: 'color', default: 'hsl(221 83% 53%)', group: 'core' },
    { name: '--primary-foreground', labelKey: 'designLab.var.primaryForeground', type: 'color', default: '#ffffff', group: 'core' },
    { name: '--accent', labelKey: 'designLab.var.accent', type: 'color', default: 'hsl(199 92% 47%)', group: 'core' },
    { name: '--accent-foreground', labelKey: 'designLab.var.accentForeground', type: 'color', default: '#06283d', group: 'core' },
    {
      name: '--ring',
      labelKey: 'designLab.var.ring',
      type: 'color',
      default: 'hsl(221 83% 53%)',
      darkDefault: 'hsl(220 90% 66%)',
      group: 'core'
    },
    {
      name: '--accent-ring',
      labelKey: 'designLab.var.accentRing',
      type: 'color',
      default: 'rgba(99, 102, 241, 0.35)',
      darkDefault: 'rgba(129, 140, 248, 0.35)',
      group: 'core'
    },
    {
      name: '--card',
      labelKey: 'designLab.var.card',
      type: 'color',
      default: 'hsl(0 0% 100%)',
      darkDefault: 'hsl(222 42% 12%)',
      group: 'surface'
    },
    {
      name: '--card-foreground',
      labelKey: 'designLab.var.cardForeground',
      type: 'color',
      default: 'hsl(222 47% 14%)',
      darkDefault: 'hsl(214 32% 96%)',
      group: 'surface'
    },
    { name: '--surface-1', labelKey: 'designLab.var.surface1', type: 'text', default: 'color-mix(in oklab, var(--background) 96%, white)', group: 'surface' },
    { name: '--surface-2', labelKey: 'designLab.var.surface2', type: 'text', default: 'color-mix(in oklab, var(--background) 92%, white)', group: 'surface' },
    { name: '--surface-3', labelKey: 'designLab.var.surface3', type: 'text', default: 'color-mix(in oklab, var(--background) 88%, white)', group: 'surface' },
    { name: '--border', labelKey: 'designLab.var.border', type: 'color', default: 'hsl(216 33% 85%)', group: 'surface' },
    {
      name: '--input',
      labelKey: 'designLab.var.input',
      type: 'color',
      default: 'hsl(216 33% 85%)',
      darkDefault: 'hsl(217 24% 28%)',
      group: 'surface'
    },
    {
      name: '--shadow',
      labelKey: 'designLab.var.shadow',
      type: 'text',
      default: '0 12px 36px rgba(15, 23, 42, 0.12)',
      darkDefault: '0 20px 48px rgba(2, 6, 23, 0.55)',
      group: 'surface'
    },
    { name: '--radius', labelKey: 'designLab.var.radius', type: 'text', default: '1rem', group: 'surface' },
    {
      name: '--page-gradient',
      labelKey: 'designLab.var.gradient',
      type: 'text',
      default: 'linear-gradient(160deg, #f8f9ff 0%, #e8ecff 100%)',
      darkDefault: 'linear-gradient(160deg, #0d1224 0%, #111c3d 100%)',
      group: 'surface'
    },
    {
      name: '--page-overlay-1',
      labelKey: 'designLab.var.overlay1',
      type: 'text',
      default: 'radial-gradient(circle at 20% 25%, rgba(79, 70, 229, 0.18), transparent 55%)',
      darkDefault: 'radial-gradient(circle at 80% 30%, rgba(168, 85, 247, 0.22), transparent 55%)',
      group: 'surface'
    },
    {
      name: '--page-overlay-2',
      labelKey: 'designLab.var.overlay2',
      type: 'text',
      default: 'radial-gradient(circle at 80% 70%, rgba(14, 165, 233, 0.18), transparent 50%)',
      darkDefault: 'radial-gradient(circle at 15% 80%, rgba(56, 189, 248, 0.18), transparent 55%)',
      group: 'surface'
    },
    {
      name: '--panel-glass',
      labelKey: 'designLab.var.panelGlass',
      type: 'text',
      default: 'rgba(255, 255, 255, 0.78)',
      darkDefault: 'rgba(17, 25, 40, 0.75)',
      group: 'surface'
    },
    {
      name: '--panel-border',
      labelKey: 'designLab.var.panelBorder',
      type: 'text',
      default: 'rgba(99, 102, 241, 0.12)',
      darkDefault: 'rgba(148, 163, 184, 0.32)',
      group: 'surface'
    },
    {
      name: '--tile-bg',
      labelKey: 'designLab.var.tileBg',
      type: 'text',
      default: 'linear-gradient(160deg, rgba(255, 255, 255, 0.95), rgba(241, 245, 249, 0.85))',
      darkDefault: 'linear-gradient(160deg, rgba(30, 41, 59, 0.78), rgba(15, 23, 42, 0.92))',
      group: 'surface'
    },
    {
      name: '--tile-bg-revealed',
      labelKey: 'designLab.var.tileRevealed',
      type: 'text',
      default: 'linear-gradient(160deg, rgba(129, 140, 248, 0.75), rgba(79, 70, 229, 0.65))',
      darkDefault: 'linear-gradient(160deg, rgba(99, 102, 241, 0.55), rgba(79, 70, 229, 0.38))',
      group: 'surface'
    },
    {
      name: '--tile-border',
      labelKey: 'designLab.var.tileBorder',
      type: 'text',
      default: 'rgba(99, 102, 241, 0.25)',
      darkDefault: 'rgba(148, 163, 184, 0.35)',
      group: 'surface'
    },
    {
      name: '--letters-shadow',
      labelKey: 'designLab.var.lettersShadow',
      type: 'text',
      default: '0 18px 45px -24px rgba(15, 23, 42, 0.35)',
      darkDefault: '0 20px 40px -18px rgba(148, 163, 184, 0.35)',
      group: 'effects'
    },
    {
      name: '--letters-hover',
      labelKey: 'designLab.var.lettersHover',
      type: 'text',
      default: '0 25px 50px -20px rgba(99, 102, 241, 0.45)',
      darkDefault: '0 28px 60px -20px rgba(99, 102, 241, 0.6)',
      group: 'effects'
    },
    { name: '--tile-size', labelKey: 'designLab.var.tileSize', type: 'range', min: 2.6, max: 4, step: 0.05, unit: 'rem', default: '3.1rem', group: 'sizing' },
    { name: '--font-size-body', labelKey: 'designLab.var.font.body', type: 'range', min: 0.85, max: 1.35, step: 0.01, unit: 'rem', default: '1rem', group: 'typography' },
    { name: '--font-size-heading-1', labelKey: 'designLab.var.font.h1', type: 'range', min: 2.1, max: 3.4, step: 0.05, unit: 'rem', default: '2.6rem', group: 'typography' },
    { name: '--font-size-heading-2', labelKey: 'designLab.var.font.h2', type: 'range', min: 1.7, max: 2.6, step: 0.05, unit: 'rem', default: '2.05rem', group: 'typography' },
    { name: '--font-size-heading-3', labelKey: 'designLab.var.font.h3', type: 'range', min: 1.3, max: 2.2, step: 0.05, unit: 'rem', default: '1.62rem', group: 'typography' },
    { name: '--font-size-scale-3xl', labelKey: 'designLab.var.font.scale3xl', type: 'range', min: 1.7, max: 3.1, step: 0.05, unit: 'rem', default: '2.35rem', group: 'typography' },
    { name: '--font-size-scale-2xl', labelKey: 'designLab.var.font.scale2xl', type: 'range', min: 1.4, max: 2.6, step: 0.05, unit: 'rem', default: '1.8rem', group: 'typography' },
    { name: '--font-size-scale-xl', labelKey: 'designLab.var.font.scaleXl', type: 'range', min: 1.1, max: 2.1, step: 0.05, unit: 'rem', default: '1.38rem', group: 'typography' },
    { name: '--font-size-scale-lg', labelKey: 'designLab.var.font.scaleLg', type: 'range', min: 1, max: 1.9, step: 0.03, unit: 'rem', default: '1.18rem', group: 'typography' },
    { name: '--font-size-scale-md', labelKey: 'designLab.var.font.scaleMd', type: 'range', min: 0.85, max: 1.6, step: 0.02, unit: 'rem', default: '1rem', group: 'typography' },
    { name: '--font-size-scale-sm', labelKey: 'designLab.var.font.scaleSm', type: 'range', min: 0.75, max: 1.4, step: 0.02, unit: 'rem', default: '0.9rem', group: 'typography' },
    { name: '--font-size-scale-xs', labelKey: 'designLab.var.font.scaleXs', type: 'range', min: 0.6, max: 1.2, step: 0.02, unit: 'rem', default: '0.78rem', group: 'typography' },
    { name: '--font-size-sidebar', labelKey: 'designLab.var.font.sidebar', type: 'range', min: 0.9, max: 1.6, step: 0.02, unit: 'rem', default: '1.05rem', group: 'typography' },
    { name: '--font-size-quote', labelKey: 'designLab.var.font.quote', type: 'range', min: 1, max: 1.8, step: 0.02, unit: 'rem', default: '1.18rem', group: 'typography' },
    { name: '--font-size-info', labelKey: 'designLab.var.font.info', type: 'range', min: 1.05, max: 1.9, step: 0.02, unit: 'rem', default: '1.22rem', group: 'typography' },
    { name: '--font-size-letter', labelKey: 'designLab.var.font.letter', type: 'range', min: 1.1, max: 1.9, step: 0.02, unit: 'rem', default: '1.35rem', group: 'typography' },
    { name: '--font-size-status', labelKey: 'designLab.var.font.status', type: 'range', min: 1, max: 1.95, step: 0.02, unit: 'rem', default: '1.22rem', group: 'typography' },
    { name: '--user-font-scale', labelKey: 'designLab.var.fontScale', type: 'range', min: 90, max: 130, step: 2, default: '100', group: 'typography', prefKey: 'fontScale' }
  ];

  const DESIGN_LAB_VAR_MAP = DESIGN_LAB_VARIABLES.reduce((acc, item) => {
    acc[item.name] = item;
    return acc;
  }, {});

  const DESIGN_LAB_GROUPS = [
    { id: 'core', labelKey: 'designLab.group.core', hintKey: 'designLab.group.coreHint', vars: ['--background', '--foreground', '--muted', '--muted-foreground', '--primary', '--primary-foreground', '--accent', '--accent-foreground', '--ring', '--accent-ring'] },
    { id: 'surface', labelKey: 'designLab.group.surface', hintKey: 'designLab.group.surfaceHint', vars: ['--card', '--card-foreground', '--surface-1', '--surface-2', '--surface-3', '--border', '--input', '--shadow', '--radius', '--page-gradient', '--page-overlay-1', '--page-overlay-2', '--panel-glass', '--panel-border', '--tile-bg', '--tile-bg-revealed', '--tile-border'] },
    { id: 'effects', labelKey: 'designLab.group.effects', hintKey: 'designLab.group.effectsHint', vars: ['--letters-shadow', '--letters-hover'] },
    { id: 'typography', labelKey: 'designLab.group.typography', hintKey: 'designLab.group.typographyHint', vars: ['--font-size-heading-1', '--font-size-heading-2', '--font-size-heading-3', '--font-size-scale-3xl', '--font-size-scale-2xl', '--font-size-scale-xl', '--font-size-scale-lg', '--font-size-scale-md', '--font-size-scale-sm', '--font-size-scale-xs', '--font-size-body', '--font-size-sidebar', '--font-size-quote', '--font-size-info', '--font-size-letter', '--font-size-status', '--user-font-scale'] },
    { id: 'sizing', labelKey: 'designLab.group.sizing', hintKey: 'designLab.group.sizingHint', vars: ['--tile-size'] }
  ];

  const DESIGN_LAB_DEFAULTS_BY_MODE = DESIGN_LAB_VARIABLES.reduce((acc, item) => {
    const lightValue = item.default;
    const darkValue = Object.prototype.hasOwnProperty.call(item, 'darkDefault')
      ? item.darkDefault
      : item.default;
    acc.light[item.name] = lightValue;
    acc.dark[item.name] = darkValue;
    return acc;
  }, { light: {}, dark: {} });

  function getDesignLabDefaults(mode) {
    return mode === 'dark' ? DESIGN_LAB_DEFAULTS_BY_MODE.dark : DESIGN_LAB_DEFAULTS_BY_MODE.light;
  }

  function getDesignLabDefaultValue(name, mode) {
    const defaults = getDesignLabDefaults(mode);
    if (Object.prototype.hasOwnProperty.call(defaults, name)) {
      return defaults[name];
    }
    const lightDefaults = DESIGN_LAB_DEFAULTS_BY_MODE.light;
    return Object.prototype.hasOwnProperty.call(lightDefaults, name) ? lightDefaults[name] : '';
  }

  function valuesEqual(a, b) {
    return String(a == null ? '' : a).trim() === String(b == null ? '' : b).trim();
  }

  function parseNumericValue(value, unit) {
    if (value == null) return NaN;
    const str = String(value).trim();
    if (!str) return NaN;
    if (unit && str.endsWith(unit)) {
      return Number(str.slice(0, -unit.length));
    }
    const cleaned = unit === '%' ? str.replace(/%/g, '') : str;
    const numeric = Number(cleaned);
    return Number.isFinite(numeric) ? numeric : NaN;
  }

  function readComputedCssVar(name, fallback) {
    if (typeof window === 'undefined' || !window.getComputedStyle) return fallback || '';
    const root = window.document && window.document.documentElement;
    if (!root) return fallback || '';
    const value = window.getComputedStyle(root).getPropertyValue(name);
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed || fallback || '';
  }

  function getActiveThemePreset(state) {
    const presets = resolveThemePresets(state.data && state.data.themePresets);
    const key = state.data && state.data.activeThemePreset;
    return presets.find((preset) => preset && preset.key === key) || presets[0] || null;
  }

  function getThemeOverrides(state) {
    const data = ensureDict(state.data);
    return ensureDict(data.themeOverrides);
  }

  function getThemeLabBaseline(state, name) {
    const preset = getActiveThemePreset(state);
    const presetOverrides = ensureDict(preset && preset.overrides);
    if (presetOverrides[name] != null && String(presetOverrides[name]).trim() !== '') {
      return presetOverrides[name];
    }
    return getDesignLabDefaultValue(name, preset && preset.mode);
  }

  function normalizeThemeLabValue(raw, meta) {
    const { type, unit, defaultValue, min, max, step, prefKey } = meta;
    if (type === 'color') {
      if (U && U.Color && typeof U.Color.toHex === 'function') {
        const hex = U.Color.toHex(raw);
        if (hex) return hex;
      }
      const value = String(raw || '').trim();
      return value || defaultValue || '';
    }
    if (prefKey === 'fontScale') {
      let numeric = parseNumericValue(raw, '');
      if (!Number.isFinite(numeric)) {
        numeric = parseNumericValue(defaultValue, '');
      }
      const safeMin = Number.isFinite(min) ? min : 90;
      const safeMax = Number.isFinite(max) ? max : 130;
      numeric = Math.min(safeMax, Math.max(safeMin, Math.round(numeric || safeMin)));
      return String(numeric);
    }
    if (type === 'range' || type === 'number') {
      let numeric = parseNumericValue(raw, unit);
      if (!Number.isFinite(numeric)) {
        numeric = parseNumericValue(defaultValue, unit);
      }
      if (Number.isFinite(min)) numeric = Math.max(min, numeric);
      if (Number.isFinite(max)) numeric = Math.min(max, numeric);
      if (Number.isFinite(step) && step > 0) {
        const decimals = String(step).includes('.') ? String(step).split('.')[1].length : 0;
        numeric = Number(numeric.toFixed(decimals));
      }
      if (type === 'number' && !unit) {
        return String(numeric);
      }
      if (unit === '%') {
        return `${Math.round(numeric)}`;
      }
      return unit ? `${numeric}${unit}` : String(numeric);
    }
    const textValue = String(raw || '').trim();
    return textValue || (typeof defaultValue === 'string' ? defaultValue : '');
  }

  function cloneThemeOverrides(overrides) {
    const src = ensureDict(overrides);
    return Object.keys(src).reduce((acc, key) => {
      acc[key] = src[key];
      return acc;
    }, {});
  }

  function normalizeThemePreset(entry) {
    const base = ensureDict(entry);
    const key = typeof base.key === 'string' ? base.key : '';
    if (!key) return null;
    let label = base.label;
    if (!label) {
      label = { ar: key, en: key };
    } else if (typeof label === 'string') {
      label = { ar: label, en: label };
    }
    const mode = typeof base.mode === 'string'
      ? base.mode
      : (typeof base.theme === 'string' ? base.theme : 'light');
    return {
      key,
      mode: mode === 'dark' ? 'dark' : 'light',
      label,
      overrides: cloneThemeOverrides(base.overrides)
    };
  }

  function resolveThemePresets(list) {
    const normalized = Array.isArray(list)
      ? list.map(normalizeThemePreset).filter(Boolean)
      : [];
    if (normalized.length) return normalized;
    return DEFAULT_THEME_PRESETS.map(normalizeThemePreset).filter(Boolean);
  }

  function normalizeLanguageEntry(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') {
      return { code: entry, label: { ar: entry, en: entry } };
    }
    const base = ensureDict(entry);
    const code = typeof base.code === 'string'
      ? base.code
      : (typeof base.value === 'string' ? base.value : '');
    if (!code) return null;
    let label = base.label;
    if (!label) {
      label = { ar: code, en: code };
    } else if (typeof label === 'string') {
      label = { ar: label, en: label };
    }
    return { code, label };
  }

  function resolveLanguageOptions(list) {
    const normalized = Array.isArray(list)
      ? list.map(normalizeLanguageEntry).filter(Boolean)
      : [];
    if (normalized.length) return normalized;
    return DEFAULT_LANG_OPTIONS.map(normalizeLanguageEntry).filter(Boolean);
  }

  function makeLangLookup(db) {
    const lang = (db.env && db.env.lang) || 'ar';
    const fallback = (db.i18n && db.i18n.fallback) || 'en';
    const store = (db.i18n && db.i18n.dict) || dict;
    const TL = (key, vars) => {
      const entry = store[key] || {};
      let text = entry[lang] || entry[fallback] || key;
      if (vars && typeof vars === 'object') {
        text = text.replace(/\{(.*?)\}/g, (_, token) => {
          if (Object.prototype.hasOwnProperty.call(vars, token)) {
            return String(vars[token]);
          }
          return `{${token}}`;
        });
      }
      return text;
    };
    return { TL, lang };
  }

  function localize(entry, lang, fallback) {
    if (!entry) return '';
    if (typeof entry === 'string') return entry;
    if (entry[lang]) return entry[lang];
    return entry[fallback] || '';
  }

  /* ------------------------------------------------------------------ */
  /* Game data                                                           */
  /* ------------------------------------------------------------------ */

  const AR_ALPHA = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'.split('');

  const PROVERBS = [
    {
      t: 'رجع بخفي حنين',
      hint: 'يُقال لمن عاد بلا نتيجة.',
      explanation: 'تحكي القصة عن رجل فشل في مفاوضة إسكافي فعاد خالي الوفاض وقد فقد نعليه، فصار مثلاً عن الخيبة بعد مشقة.',
      lesson: 'التخطيط والمرونة في التفاوض يحميان من ضياع الجهد بلا ثمر.',
      source: 'مثل عربي قديم'
    },
    {
      t: 'الي اختشوا ماتوا',
      hint: 'يُنتقد فيه ذهاب الحياء.',
      explanation: 'نشأ في مصر زمن الحريق حين فضلت بعض النساء المحافظة على حيائهن فمُتن، فصار كناية عن تبدل الأحوال وغياب الخجل.',
      lesson: 'حياء المجتمع ينعكس على سلوكه واستقراره.',
      source: 'مثل مصري شعبي'
    },
    {
      t: 'الوقت كالسيف إن لم تقطعه قطعك',
      hint: 'مثل عن قيمة الزمن.',
      explanation: 'يحذر من ضياع الوقت وأن الحزم في استثماره هو السبيل للنجاة.',
      lesson: 'إدارة الوقت بحكمة تصنع الفارق في كل مشروع.',
      source: 'حكمة عربية'
    },
    {
      t: 'على قدر أهل العزم تأتي العزائم',
      hint: 'مدح لأهل الهمة العالية.',
      explanation: 'بيت من شعر المتنبي يمتدح فيه سيف الدولة ويعظم شأن أهل الإرادة.',
      lesson: 'الطموح المرتفع يصنع إنجازات مرتفعة.',
      source: 'المتنبي'
    }
  ];

  const SEQUENCE_BANK = [
    {
      numbers: [2, 4, 6, 8],
      answer: 10,
      hint: { ar: 'كل رقم يزيد بمقدار ثابت.', en: 'Each number increases by the same fixed amount.' },
      rule: { ar: 'نضيف ٢ في كل خطوة.', en: 'Add 2 at every step.' },
      lesson: { ar: 'راقب الفروق الثابتة لاكتشاف الأنماط البسيطة.', en: 'Watch fixed differences to spot simple patterns.' }
    },
    {
      numbers: [3, 9, 27],
      answer: 81,
      hint: { ar: 'تضاعف سريع لكل عنصر.', en: 'A rapid multiplication for every entry.' },
      rule: { ar: 'نضرب في ٣ في كل مرة.', en: 'Multiply by 3 each time.' },
      lesson: { ar: 'الأساسات الأسية تكشف عن نمو متسارع.', en: 'Exponential bases expose accelerating growth.' }
    },
    {
      numbers: [1, 1, 2, 3, 5],
      answer: 8,
      hint: { ar: 'الرقم التالي يعتمد على مجموع رقمين سابقين.', en: 'Each term depends on the sum of two previous terms.' },
      rule: { ar: 'كل رقم هو مجموع الرقمين السابقين.', en: 'Each number is the sum of the previous two.' },
      lesson: { ar: 'التراكم المرحلي يبني أنماطًا غنية.', en: 'Stepwise accumulation builds rich patterns.' }
    },
    {
      numbers: [5, 10, 20, 40],
      answer: 80,
      hint: { ar: 'النسبة تتضاعف.', en: 'The ratio doubles every time.' },
      rule: { ar: 'نضرب في ٢ في كل انتقال.', en: 'Multiply by 2 at every transition.' },
      lesson: { ar: 'تتبع معاملات الضرب يكشف المتواليات الهندسية.', en: 'Tracking multiplication factors reveals geometric sequences.' }
    }
  ];

  const SOUND_EFFECTS = {
    correct: 'https://cdn.mishkah.dev/audio/correct.mp3',
    wrong: 'https://cdn.mishkah.dev/audio/wrong.mp3',
    win: 'https://cdn.mishkah.dev/audio/win.mp3',
    lose: 'https://cdn.mishkah.dev/audio/lose.mp3'
  };

  const MUSIC_TRACKS = [
    {
      name: 'Ghost Stories',
      url: 'https://www.fesliyanstudios.com/musicfiles/2020-10-26_-_Ghost_Stories_-_www.FesliyanStudios.com_Steve_Oxen/2020-10-26_-_Ghost_Stories_-_www.FesliyanStudios.com_Steve_Oxen.mp3'
    },
    {
      name: 'The Unsolved Mystery',
      url: 'https://www.fesliyanstudios.com/musicfiles/2018-07-22_-_The_Unsolved_Murder_-_David_Fesliyan.mp3'
    }
  ];

  const DEFAULT_GAME_SETTINGS = {
    perChoiceSeconds: 35,
    bonusSeconds: 5
  };

  const GAME_SETTING_LIMITS = {
    perChoiceMin: 10,
    perChoiceMax: 120,
    bonusMin: 0,
    bonusMax: 20
  };

  const clampNumber = (value, min, max) => {
    const clampFn = U.Num && typeof U.Num.clamp === 'function'
      ? U.Num.clamp
      : (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const numeric = Number(value);
    return clampFn(Number.isFinite(numeric) ? numeric : min, min, max);
  };

  function ensureGameSettings(settings) {
    const raw = ensureDict(settings);
    const perChoice = clampNumber(
      raw.perChoiceSeconds != null ? raw.perChoiceSeconds : DEFAULT_GAME_SETTINGS.perChoiceSeconds,
      GAME_SETTING_LIMITS.perChoiceMin,
      GAME_SETTING_LIMITS.perChoiceMax
    );
    const bonusBase = clampNumber(
      raw.bonusSeconds != null ? raw.bonusSeconds : DEFAULT_GAME_SETTINGS.bonusSeconds,
      GAME_SETTING_LIMITS.bonusMin,
      GAME_SETTING_LIMITS.bonusMax
    );
    const bonus = clampNumber(
      bonusBase,
      GAME_SETTING_LIMITS.bonusMin,
      Math.min(GAME_SETTING_LIMITS.bonusMax, perChoice)
    );
    return {
      perChoiceSeconds: perChoice,
      bonusSeconds: bonus
    };
  }

  const INITIAL_GAME_STATE = {
    proverb: null,
    guessed: {},
    triesMax: 5,
    triesLeft: 5,
    status: 'idle',
    timerOn: true,
    timerSec: DEFAULT_GAME_SETTINGS.perChoiceSeconds,
    timeLeft: DEFAULT_GAME_SETTINGS.perChoiceSeconds,
    intervalId: null,
    revealSolution: false,
    feedback: null,
    musicOn: true,
    audioIdx: 0,
    audioList: MUSIC_TRACKS,
    soundStamp: 0,
    settings: { ...DEFAULT_GAME_SETTINGS }
  };

  const INITIAL_SEQUENCE_STATE = {
    sequence: null,
    status: 'idle',
    guess: '',
    triesMax: 3,
    triesLeft: 3,
    feedback: null,
    history: [],
    reveal: false
  };

  function norm(ch) {
    return ch
      .replace(/[أإآا]/g, 'ا')
      .replace(/[يى]/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[ءؤئ]/g, 'ء')
      .trim();
  }

  const SEARCH_MAX_RESULTS = 10;

  function normalizeSearchString(value) {
    if (value == null) return '';
    const raw = String(value).toLowerCase();
    const normalized = typeof raw.normalize === 'function'
      ? raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      : raw;
    return norm(normalized)
      .replace(/[^a-z0-9\u0600-\u06FF]+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function buildClassLookup(classes) {
    const lookup = {};
    ensureArray(classes).forEach((cls) => {
      if (!cls || !cls.key || lookup[cls.key]) return;
      lookup[cls.key] = cls;
    });
    return lookup;
  }

  function buildSearchIndex(pages, classes) {
    const lookup = buildClassLookup(classes);
    return ensureArray(pages).map((page) => {
      if (!page || !page.key) return null;
      const label = ensureDict(page.label);
      const desc = ensureDict(page.desc);
      const keywords = ensureArray(page.keywords);
      const classInfo = lookup[page.classKey] || null;
      const classLabel = classInfo ? ensureDict(classInfo.label) : {};
      const labelText = normalizeSearchString(`${label.ar || ''} ${label.en || ''}`);
      const descText = normalizeSearchString(`${desc.ar || ''} ${desc.en || ''}`);
      const keywordsText = normalizeSearchString(keywords.join(' '));
      const classText = normalizeSearchString(`${classLabel.ar || ''} ${classLabel.en || ''}`);
      const combined = [labelText, descText, keywordsText, classText, normalizeSearchString(page.key || '')]
        .filter(Boolean)
        .join(' ');
      return {
        key: page.key,
        icon: page.icon || '',
        classKey: page.classKey || null,
        label,
        desc,
        classLabel,
        keywords,
        searchTokens: {
          label: labelText,
          desc: descText,
          keywords: keywordsText,
          classText,
          combined
        }
      };
    }).filter(Boolean);
  }

  function runSearch(index, query) {
    const normalized = normalizeSearchString(query);
    if (!normalized) return [];
    const terms = normalized.split(' ').filter(Boolean);
    if (!terms.length) return [];
    return ensureArray(index).map((entry) => {
      if (!entry || !entry.key) return null;
      const tokens = ensureDict(entry.searchTokens);
      const combined = tokens.combined || '';
      if (!terms.every((term) => combined.includes(term))) return null;
      let score = 0;
      terms.forEach((term) => {
        if ((tokens.label || '').includes(term)) score += 6;
        if ((tokens.keywords || '').includes(term)) score += 3;
        if ((tokens.desc || '').includes(term)) score += 2;
        if ((tokens.classText || '').includes(term)) score += 1;
      });
      return {
        key: entry.key,
        icon: entry.icon,
        classKey: entry.classKey,
        label: entry.label,
        desc: entry.desc,
        classLabel: entry.classLabel,
        score
      };
    }).filter(Boolean)
      .sort((a, b) => (b.score === a.score
        ? (a.label?.ar || a.label?.en || '').localeCompare(b.label?.ar || b.label?.en || '')
        : b.score - a.score))
      .slice(0, SEARCH_MAX_RESULTS);
  }

  function computeTimeLeft(game) {
    if (!game || !game.timerOn) return null;
    const settings = ensureGameSettings(game.settings);
    const cap = settings.perChoiceSeconds;
    if (game.status === 'running') {
      const raw = typeof game.timeLeft === 'number' ? game.timeLeft : game.timerSec;
      return Math.max(0, Math.min(cap, raw));
    }
    if (game.status === 'lost') return 0;
    const standby = typeof game.timerSec === 'number' ? game.timerSec : settings.perChoiceSeconds;
    return Math.max(0, Math.min(cap, standby));
  }

  /* ------------------------------------------------------------------ */
  /* Components                                                          */
  /* ------------------------------------------------------------------ */

  function ThemeLabPanel(db) {
    const uiState = ensureDict(db.ui);
    const shellUi = ensureDict(uiState.pagesShell);
    const themeLabUi = ensureDict(shellUi.themeLab);
    if (!themeLabUi.open) return null;

    const { TL, lang } = makeLangLookup(db);
    const fallbackLang = lang === 'ar' ? 'en' : 'ar';
    const data = ensureDict(db.data);
    const presets = resolveThemePresets(data.themePresets);
    const activePresetKey = data.activeThemePreset;
    const activePreset = presets.find((preset) => preset && preset.key === activePresetKey) || presets[0] || null;
    const overrides = ensureDict(data.themeOverrides);
    const draft = ensureDict(themeLabUi.draft);
    const presetOverrides = ensureDict(activePreset && activePreset.overrides);
    const activeMode = activePreset && activePreset.mode;

    const quickButtons = presets.map((preset, idx) => {
      const key = preset.key || `preset-${idx}`;
      const label = localize(preset.label, lang, fallbackLang) || key;
      const decor = THEME_DECOR[key] || {};
      const isActive = activePreset && key === activePreset.key;
      const baseClass = tw`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition`;
      const idleClass = tw`bg-[color-mix(in_oklab,var(--surface-1)90%,transparent)] text-[var(--foreground)] hover:bg-[color-mix(in_oklab,var(--primary)18%,transparent)]`;
      const activeClass = tw`bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_16px_36px_-22px_rgba(79,70,229,0.45)]`;
      return UI.Button({
        attrs: {
          gkey: 'ui:theme:select',
          'data-theme-select': 'true',
          'data-theme-value': key,
          class: cx(baseClass, isActive ? activeClass : idleClass)
        },
        variant: 'ghost',
        size: 'sm'
      }, [`${decor.emoji || (preset.mode === 'dark' ? '🌙' : '🌞')} ${label}`]);
    });

    const sectionNodes = DESIGN_LAB_GROUPS.map((group) => {
      const rows = group.vars.map((name) => {
        const def = DESIGN_LAB_VAR_MAP[name];
        if (!def) return null;
        const baseline = presetOverrides[name] != null && String(presetOverrides[name]).trim() !== ''
          ? presetOverrides[name]
          : getDesignLabDefaultValue(name, activeMode);
        const draftValue = draft[name];
        const overrideValue = overrides[name];
        let currentValue = draftValue != null ? draftValue : (overrideValue != null ? overrideValue : baseline);
        if (currentValue == null || String(currentValue).trim() === '') currentValue = baseline;
        const appliedValue = readComputedCssVar(name, currentValue);
        const isCustom = !valuesEqual(currentValue, baseline);

        const metaValue = (value) => {
          if (def.type === 'color' && U && U.Color && typeof U.Color.toHex === 'function') {
            return U.Color.toHex(value) || value || '';
          }
          return value || '';
        };

        const normalizedBaseline = metaValue(baseline);
        const normalizedApplied = metaValue(appliedValue);

        const rowAttrs = {
          key: `${group.id}-${name}`,
          class: 'design-lab-row',
          'data-type': def.type,
          'data-custom': isCustom ? 'true' : 'false'
        };

        const labelNode = D.Containers.Div({ attrs: { class: 'design-lab-label' } }, [
          D.Text.Strong({}, [TL(def.labelKey)]),
          D.Text.Span({ attrs: { class: 'design-lab-meta' } }, [TL('designLab.defaultValue'), ': ', normalizedBaseline || '—']),
          D.Text.Span({ attrs: { class: 'design-lab-meta' } }, [TL('designLab.currentValue'), ': ', normalizedApplied || '—'])
        ]);

        const resetButton = D.Forms.Button({
          attrs: {
            type: 'button',
            gkey: 'index:themeLab:varReset',
            'data-css-var': name,
            class: 'design-lab-reset',
            disabled: isCustom ? undefined : 'disabled',
            title: TL('designLab.resetVar'),
            'aria-label': TL('designLab.resetVar')
          }
        }, ['↺']);

        const baseAttrs = {
          'data-css-var': name,
          'data-css-type': def.type,
          'data-css-unit': def.unit || '',
          'data-css-default': baseline,
          'data-css-min': def.min != null ? String(def.min) : undefined,
          'data-css-max': def.max != null ? String(def.max) : undefined,
          'data-css-step': def.step != null ? String(def.step) : undefined,
          'data-css-pref': def.prefKey || ''
        };

        if (def.type === 'color') {
          const colorValue = metaValue(currentValue) || '#6366f1';
          return D.Containers.Div({ attrs: rowAttrs }, [
            labelNode,
            D.Containers.Div({ attrs: { class: 'design-lab-color-chip', style: `background:${colorValue}` } }),
            D.Inputs.Input({ attrs: Object.assign({
              type: 'color',
              value: colorValue,
              gkey: 'index:themeLab:varUpdate'
            }, baseAttrs, { class: 'design-lab-color-input' }) }),
            D.Inputs.Input({ attrs: Object.assign({
              type: 'text',
              value: currentValue || '',
              gkey: 'index:themeLab:varUpdate',
              class: 'design-lab-value-input',
              dir: 'ltr'
            }, baseAttrs) }),
            resetButton
          ]);
        }

        if (def.type === 'range') {
          const numericValue = parseNumericValue(currentValue, def.unit);
          const sliderValue = Number.isFinite(numericValue) ? numericValue : (Number.isFinite(def.min) ? def.min : 0);
          const decimals = def.step && String(def.step).includes('.') ? String(def.step).split('.')[1].length : 0;
          const numberValue = Number(sliderValue).toFixed(decimals);
          const previewStyle = def.prefKey === 'fontScale'
            ? `font-size: calc(var(--font-size-body) * ${sliderValue} / 100);`
            : `font-size: ${sliderValue}${def.unit || ''};`;
          const previewText = def.prefKey === 'fontScale'
            ? `× ${(sliderValue / 100).toFixed(2)}`
            : 'Aa أب';
          return D.Containers.Div({ attrs: rowAttrs }, [
            labelNode,
            D.Text.Span({ attrs: { class: 'design-lab-font-preview', style: previewStyle } }, [previewText]),
            D.Inputs.Input({ attrs: Object.assign({
              type: 'range',
              min: def.min != null ? String(def.min) : undefined,
              max: def.max != null ? String(def.max) : undefined,
              step: def.step != null ? String(def.step) : undefined,
              value: String(sliderValue),
              gkey: 'index:themeLab:varUpdate',
              class: 'design-lab-slider'
            }, baseAttrs, { 'data-css-editor': 'range' }) }),
            D.Inputs.Input({ attrs: Object.assign({
              type: 'number',
              min: def.min != null ? String(def.min) : undefined,
              max: def.max != null ? String(def.max) : undefined,
              step: def.step != null ? String(def.step) : undefined,
              value: numberValue,
              gkey: 'index:themeLab:varUpdate',
              class: 'design-lab-number-input'
            }, baseAttrs, { 'data-css-editor': 'number' }) }),
            resetButton
          ]);
        }

        return D.Containers.Div({ attrs: rowAttrs }, [
          labelNode,
          D.Inputs.Input({ attrs: Object.assign({
            type: 'text',
            value: currentValue || '',
            gkey: 'index:themeLab:varUpdate',
            class: 'design-lab-value-input',
            dir: 'ltr'
          }, baseAttrs, { 'data-css-editor': 'text' }) }),
          resetButton
        ]);
      }).filter(Boolean);

      if (!rows.length) return null;

      return D.Containers.Div({ attrs: { key: `group-${group.id}`, class: tw`space-y-3` } }, [
        D.Containers.Div({ attrs: { class: tw`space-y-1` } }, [
          D.Text.H4({ attrs: { class: tw`text-base font-semibold` } }, [TL(group.labelKey)]),
          D.Text.Span({ attrs: { class: tw`text-xs uppercase tracking-[0.3em] text-[var(--muted-foreground)]` } }, [TL(group.hintKey)])
        ]),
        D.Containers.Div({ attrs: { class: 'design-lab-grid' } }, rows)
      ]);
    }).filter(Boolean);

    const contentChildren = [];
    if (quickButtons.length) {
      contentChildren.push(
        D.Containers.Div({ attrs: { class: tw`space-y-3` } }, [
          D.Text.H4({ attrs: { class: tw`text-base font-semibold` } }, [TL('designLab.themeTitle')]),
          D.Text.Span({ attrs: { class: tw`text-sm text-[var(--muted-foreground)]` } }, [TL('designLab.modeHint')]),
          D.Containers.Div({ attrs: { class: tw`flex flex-wrap items-center gap-3` } }, quickButtons)
        ])
      );
    }
    contentChildren.push(...sectionNodes);

    const actions = [
      UI.Button({
        attrs: { gkey: 'index:themeLab:resetAll', class: tw`w-full sm:w-auto` },
        variant: 'ghost',
        size: 'sm'
      }, [`↺ ${TL('designLab.resetAll')}`]),
      UI.Button({
        attrs: { gkey: 'index:themeLab:close', class: tw`w-full sm:w-auto` },
        variant: 'soft',
        size: 'sm'
      }, [TL('designLab.close')])
    ];

    return UI.Modal({
      open: true,
      title: TL('designLab.title'),
      description: TL('designLab.subtitle'),
      size: 'xl',
      closeGkey: 'index:themeLab:close',
      content: D.Containers.Div({ attrs: { class: tw`space-y-6` } }, contentChildren),
      actions
    });
  }

  function HeaderComp(db) {
    const { TL, lang } = makeLangLookup(db);
    const fallbackLang = lang === 'ar' ? 'en' : 'ar';
    const data = ensureDict(db.data);

    const presets = resolveThemePresets(data.themePresets);
    const activePresetKey = data.activeThemePreset || (presets[0] && presets[0].key) || '';
    const themeOptions = presets.map((preset, idx) => {
      const key = preset.key || `theme-${idx}`;
      const decor = THEME_DECOR[key] || {};
      return {
        value: key,
        label: localize(preset.label, lang, fallbackLang) || key || `Theme ${idx + 1}`,
        emoji: decor.emoji || (preset.mode === 'dark' ? '🌙' : '🌞'),
        mode: preset.mode === 'dark' ? 'dark' : 'light'
      };
    });
    const activeTheme = themeOptions.find((option) => option.value === activePresetKey) || themeOptions[0] || null;

    const languages = resolveLanguageOptions(data.languages);
    const langOptions = languages.map((entry, idx) => {
      const value = entry.code || `lang-${idx}`;
      const decor = LANGUAGE_DECOR[value] || {};
      return {
        value,
        label: localize(entry.label, lang, fallbackLang) || value || `Lang ${idx + 1}`,
        emoji: decor.emoji || '🌐',
        short: decor.short || value.toUpperCase()
      };
    });
    const activeLang = langOptions.find((entry) => entry.value === lang) || langOptions[0] || null;

    const triggerBaseClass = tw`flex h-11 items-center gap-2 rounded-full border border-[color-mix(in_oklab,var(--border)55%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)88%,transparent)] px-4 text-sm font-semibold text-[color-mix(in_oklab,var(--foreground)92%,transparent)] shadow-[0_16px_36px_-26px_rgba(15,23,42,0.45)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_24px_48px_-30px_rgba(79,70,229,0.55)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_oklab,var(--accent)65%,transparent)]`;
    const triggerActiveClass = tw`border-[color-mix(in_oklab,var(--accent)55%,transparent)] shadow-[0_24px_48px_-28px_rgba(79,70,229,0.55)]`;
    const triggerIconClass = tw`text-xl leading-none`;
    const triggerMetaClass = tw`text-[0.65rem] uppercase tracking-[0.35em] text-[color-mix(in_oklab,var(--muted-foreground)80%,transparent)]`;
    const triggerLabelClass = tw`text-xs font-semibold leading-tight text-[color-mix(in_oklab,var(--foreground)82%,transparent)]`;
    const panelBaseClass = tw`absolute end-0 z-50 mt-3 w-64 origin-top-right rounded-3xl border border-[color-mix(in_oklab,var(--border)60%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)92%,transparent)] p-3 shadow-[0_28px_64px_-30px_rgba(15,23,42,0.45)] backdrop-blur-xl transition-all duration-200 transform`;
    const panelOpenClass = tw`pointer-events-auto scale-100 opacity-100 translate-y-0`;
    const panelClosedClass = tw`pointer-events-none scale-95 opacity-0 translate-y-1.5`;
    const closeButtonClass = tw`inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color-mix(in_oklab,var(--border)60%,transparent)] text-sm font-semibold text-[color-mix(in_oklab,var(--muted-foreground)80%,transparent)] transition hover:bg-[color-mix(in_oklab,var(--surface-2)85%,transparent)] hover:text-[color-mix(in_oklab,var(--foreground)90%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_oklab,var(--accent)60%,transparent)]`;

    const uiState = ensureDict(db.ui);
    const shellUi = ensureDict(uiState.pagesShell);
    const headerMenusUi = ensureDict(shellUi.headerMenus);
    const themeLabUi = ensureDict(shellUi.themeLab);
    const themeLabOpen = !!themeLabUi.open;
    const langOpen = !!headerMenusUi.langOpen;
    const themeOpen = !!headerMenusUi.themeOpen;
    const templateOpen = !!headerMenusUi.templateOpen;

    const optionBaseClass = tw`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]`;
    const optionActiveClass = tw`bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_18px_38px_-22px_rgba(79,70,229,0.55)]`;
    const optionInactiveClass = tw`text-[color-mix(in_oklab,var(--foreground)78%,transparent)] hover:bg-[color-mix(in_oklab,var(--surface-2)85%,transparent)]`;

    const langMenu = D.Containers.Div({
      attrs: {
        class: tw`relative inline-flex`,
        'data-menu-container': 'lang'
      }
    }, [
      D.Forms.Button({
        attrs: {
          type: 'button',
          class: cx(triggerBaseClass, langOpen ? triggerActiveClass : ''),
          title: TL('header.lang.label'),
          'aria-haspopup': 'listbox',
          'aria-expanded': langOpen ? 'true' : 'false',
          'data-menu-toggle': 'lang',
          gkey: 'ui:header:menuToggle'
        }
      }, [
        D.Text.Span({ attrs: { class: triggerIconClass } }, [activeLang ? activeLang.emoji : '🌐']),
        D.Containers.Div({ attrs: { class: tw`flex flex-col text-start` } }, [
          D.Text.Span({ attrs: { class: triggerLabelClass } }, [activeLang ? activeLang.label : TL('header.lang.label')]),
          D.Text.Span({ attrs: { class: triggerMetaClass } }, [activeLang ? activeLang.short : lang.toUpperCase()])
        ])
      ]),
      D.Containers.Div({
        attrs: {
          class: cx(panelBaseClass, langOpen ? panelOpenClass : panelClosedClass),
          'data-menu-panel': 'lang'
        }
      }, [
        D.Containers.Div({ attrs: { class: tw`flex items-center justify-between gap-2 px-2` } }, [
          D.Text.Span({ attrs: { class: tw`text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[var(--muted-foreground)]` } }, [TL('header.lang.label')]),
          D.Forms.Button({
            attrs: {
              type: 'button',
              class: closeButtonClass,
              gkey: 'ui:header:menuClose',
              'data-menu-close': 'lang',
              'aria-label': TL('header.menu.close')
            }
          }, ['✕'])
        ]),
        D.Containers.Div({ attrs: { class: tw`mt-3 grid gap-1.5` } }, langOptions.map((option) => D.Forms.Button({
          attrs: {
            type: 'button',
            gkey: 'ui:lang:select',
            'data-lang-select': 'true',
            'data-lang-value': option.value,
            value: option.value,
            class: cx(optionBaseClass, option.value === lang ? optionActiveClass : optionInactiveClass)
          }
        }, [
          D.Text.Span({ attrs: { class: tw`text-lg leading-none` } }, [option.emoji]),
          D.Containers.Div({ attrs: { class: tw`flex flex-col text-start` } }, [
            D.Text.Span({ attrs: { class: tw`font-semibold` } }, [option.label]),
            D.Text.Span({ attrs: { class: triggerMetaClass } }, [option.short])
          ])
        ])))
      ])
    ]);

    const themeMenu = D.Containers.Div({
      attrs: {
        class: tw`relative inline-flex`,
        'data-menu-container': 'theme'
      }
    }, [
      D.Forms.Button({
        attrs: {
          type: 'button',
          class: cx(triggerBaseClass, themeOpen ? triggerActiveClass : ''),
          title: TL('header.theme.label'),
          'aria-haspopup': 'listbox',
          'aria-expanded': themeOpen ? 'true' : 'false',
          'data-menu-toggle': 'theme',
          gkey: 'ui:header:menuToggle'
        }
      }, [
        D.Text.Span({ attrs: { class: triggerIconClass } }, [activeTheme ? activeTheme.emoji : '🎨']),
        D.Text.Span({ attrs: { class: triggerLabelClass } }, [activeTheme ? activeTheme.label : TL('header.theme.label')])
      ]),
      D.Containers.Div({
        attrs: {
          class: cx(panelBaseClass, themeOpen ? panelOpenClass : panelClosedClass),
          'data-menu-panel': 'theme'
        }
      }, [
        D.Containers.Div({ attrs: { class: tw`flex items-center justify-between gap-2 px-2` } }, [
          D.Text.Span({ attrs: { class: tw`text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[var(--muted-foreground)]` } }, [TL('header.theme.label')]),
          D.Forms.Button({
            attrs: {
              type: 'button',
              class: closeButtonClass,
              gkey: 'ui:header:menuClose',
              'data-menu-close': 'theme',
              'aria-label': TL('header.menu.close')
            }
          }, ['✕'])
        ]),
        D.Containers.Div({ attrs: { class: tw`mt-3 grid gap-1.5` } }, themeOptions.map((option) => {
          const isActive = option.value === activePresetKey;
          const badge = option.mode === 'dark'
            ? (lang === 'ar' ? 'ليل' : 'Dark')
            : (lang === 'ar' ? 'نهار' : 'Light');
          return D.Forms.Button({
            attrs: {
              type: 'button',
              gkey: 'ui:theme:select',
              'data-theme-select': 'true',
              'data-theme-value': option.value,
              value: option.value,
              class: cx(optionBaseClass, isActive ? optionActiveClass : optionInactiveClass)
            }
          }, [
            D.Text.Span({ attrs: { class: tw`text-lg leading-none` } }, [option.emoji]),
            D.Containers.Div({ attrs: { class: tw`flex flex-col text-start` } }, [
              D.Text.Span({ attrs: { class: tw`font-semibold` } }, [option.label]),
              D.Text.Span({ attrs: { class: triggerMetaClass } }, [badge])
            ])
          ]);
        }))
      ])
    ]);

    let templateMenu = null;

    const iconCircleClass = tw`flex h-11 w-11 items-center justify-center rounded-full border border-[color-mix(in_oklab,var(--border)55%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)88%,transparent)] text-xl transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_24px_48px_-28px_rgba(79,70,229,0.55)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_oklab,var(--accent)65%,transparent)]`;
    const themeLabButton = UI.Button({
      attrs: {
        gkey: 'index:themeLab:open',
        'data-theme-lab': 'open',
        title: TL('header.theme.lab'),
        'aria-label': TL('header.theme.lab'),
        type: 'button',
        class: cx(iconCircleClass, themeLabOpen ? tw`bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_18px_38px_-20px_rgba(79,70,229,0.55)]` : '')
      },
      variant: 'ghost',
      size: 'sm'
    }, ['🎛️']);

    const templateState = ensureDict(db.ui && db.ui.templates);
    const templateSource = ensureArray(templateState.available);
    const templateFallback = M.Pages && typeof M.Pages.listTemplates === 'function' ? M.Pages.listTemplates() : [];
    const templateDefs = (templateSource.length ? templateSource : templateFallback).map((entry) => (typeof entry === 'string' ? { id: entry } : entry)).filter((entry) => entry && (entry.id || entry.name));
    const currentTemplate = db?.env?.template || (templateDefs[0] && (templateDefs[0].id || templateDefs[0].name)) || 'PagesShell';
    const templateOptions = templateDefs.map((tpl) => {
      const id = tpl.id || tpl.name || 'PagesShell';
      const labelEntry = ensureDict(tpl.label);
      const label = localize(labelEntry, lang, fallbackLang) || tpl.title || id;
      const emoji = tpl.icon || '🧩';
      return {
        value: id,
        label,
        emoji
      };
    });
    const activeTemplate = templateOptions.find((option) => option.value === currentTemplate) || templateOptions[0] || null;
    if (templateOptions.length > 1) {
      templateMenu = D.Containers.Div({
        attrs: {
          class: tw`relative inline-flex`,
          'data-menu-container': 'template'
        }
      }, [
        D.Forms.Button({
          attrs: {
            type: 'button',
            class: cx(triggerBaseClass, templateOpen ? triggerActiveClass : ''),
            title: TL('header.templates.label'),
            'aria-haspopup': 'listbox',
            'aria-expanded': templateOpen ? 'true' : 'false',
            'data-menu-toggle': 'template',
            gkey: 'ui:header:menuToggle'
          }
        }, [
          D.Text.Span({ attrs: { class: triggerIconClass } }, [activeTemplate ? activeTemplate.emoji : '🧩']),
          D.Containers.Div({ attrs: { class: tw`flex flex-col text-start` } }, [
            D.Text.Span({ attrs: { class: triggerLabelClass } }, [activeTemplate ? activeTemplate.label : TL('header.templates.label')]),
            D.Text.Span({ attrs: { class: triggerMetaClass } }, [TL('header.templates.label')])
          ])
        ]),
        D.Containers.Div({
          attrs: {
            class: cx(panelBaseClass, templateOpen ? panelOpenClass : panelClosedClass),
            'data-menu-panel': 'template'
          }
        }, [
          D.Containers.Div({ attrs: { class: tw`flex items-center justify-between gap-2 px-2` } }, [
            D.Text.Span({ attrs: { class: tw`text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[var(--muted-foreground)]` } }, [TL('header.templates.label')]),
            D.Forms.Button({
              attrs: {
                type: 'button',
                class: closeButtonClass,
                gkey: 'ui:header:menuClose',
                'data-menu-close': 'template',
                'aria-label': TL('header.menu.close')
              }
            }, ['✕'])
          ]),
          D.Containers.Div({ attrs: { class: tw`mt-3 grid gap-1.5` } }, templateOptions.map((option) => D.Forms.Button({
            attrs: {
              type: 'button',
              gkey: 'ui:template:set',
              'data-template': option.value,
              value: option.value,
              class: cx(optionBaseClass, option.value === currentTemplate ? optionActiveClass : optionInactiveClass)
            }
          }, [
            D.Text.Span({ attrs: { class: tw`text-lg leading-none` } }, [option.emoji]),
            D.Containers.Div({ attrs: { class: tw`flex flex-col text-start` } }, [
              D.Text.Span({ attrs: { class: tw`font-semibold` } }, [option.label])
            ])
          ])))
        ])
      ]);
    }

    const headerControls = [langMenu, themeMenu, templateMenu, themeLabButton].filter(Boolean);

    const searchState = ensureDict(data.search);
    const searchQuery = typeof searchState.query === 'string' ? searchState.query : '';
    const searchResults = ensureArray(searchState.results);
    const hasQuery = searchQuery.trim().length > 0;

    const searchResultList = hasQuery
      ? D.Containers.Div({
          attrs: {
            class: tw`absolute z-50 mt-3 w-full rounded-3xl border border-[color-mix(in_oklab,var(--border)55%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)96%,transparent)] p-3 shadow-[0_28px_64px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl`
          }
        }, [
          D.Text.Span({ attrs: { class: tw`text-xs font-semibold uppercase tracking-[0.35em] text-[var(--muted-foreground)]` } }, [TL('header.search.results')]),
          searchResults.length
            ? D.Lists.Ul({ attrs: { class: tw`mt-2 space-y-2` } }, searchResults.map((result) => {
                const label = localize(result.label || {}, lang, fallbackLang) || result.key;
                const description = localize(result.desc || {}, lang, fallbackLang);
                const classLabel = localize(result.classLabel || {}, lang, fallbackLang);
                return D.Lists.Li({ attrs: { key: `search-${result.key}` } }, [
                  D.Forms.Button({
                    attrs: {
                      type: 'button',
                      gkey: 'index:search:pick',
                      'data-search-key': result.key,
                      class: tw`w-full rounded-2xl border border-transparent px-3 py-2 text-start transition hover:bg-[color-mix(in_oklab,var(--surface-2)85%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_oklab,var(--accent)60%,transparent)]`
                    }
                  }, [
                    D.Containers.Div({ attrs: { class: tw`flex items-center gap-2` } }, [
                      result.icon ? D.Text.Span({ attrs: { class: tw`text-lg` } }, [result.icon]) : null,
                      D.Containers.Div({ attrs: { class: tw`flex-1` } }, [
                        D.Text.Span({ attrs: { class: tw`block text-sm font-semibold` } }, [label]),
                        classLabel ? D.Text.Span({ attrs: { class: tw`text-xs text-[var(--muted-foreground)]` } }, [classLabel]) : null,
                        description ? D.Text.Span({ attrs: { class: tw`block text-xs text-[var(--muted-foreground)]` } }, [description]) : null
                      ].filter(Boolean))
                    ].filter(Boolean))
                  ])
                ]);
              }))
            : D.Text.P({ attrs: { class: tw`mt-2 text-sm text-[var(--muted-foreground)]` } }, [TL('header.search.noResults')])
        ])
      : null;

    const searchInput = D.Inputs.Input({
      attrs: {
        type: 'search',
        value: searchQuery,
        placeholder: TL('header.search.placeholder'),
        class: tw`w-full rounded-full border border-[color-mix(in_oklab,var(--border)55%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)96%,transparent)] px-5 py-3 text-sm shadow-[0_18px_38px_-32px_rgba(15,23,42,0.45)] outline-none transition focus:border-[color-mix(in_oklab,var(--primary)55%,transparent)] focus:shadow-[0_24px_48px_-32px_rgba(79,70,229,0.4)]`,
        'data-search-field': 'query',
        gkey: 'index:search:update',
        dir: lang === 'ar' ? 'rtl' : 'ltr'
      }
    });

    const clearButton = hasQuery
      ? D.Forms.Button({
          attrs: {
            type: 'button',
            gkey: 'index:search:clear',
            class: cx(
              tw`absolute top-1/2 -translate-y-1/2 h-8 w-8 rounded-full border border-[color-mix(in_oklab,var(--border)55%,transparent)] bg-[color-mix(in_oklab,var(--surface-2)90%,transparent)] text-sm text-[color-mix(in_oklab,var(--muted-foreground)80%,transparent)] transition hover:bg-[color-mix(in_oklab,var(--surface-2)96%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_oklab,var(--accent)60%,transparent)]`,
              lang === 'ar' ? tw`left-2` : tw`right-2`
            )
          }
        }, ['✕'])
      : null;

    const searchBox = D.Containers.Div({ attrs: { class: tw`relative flex-1` } }, [searchInput, clearButton, searchResultList].filter(Boolean));

    const overlay = (langOpen || themeOpen || templateOpen)
      ? D.Containers.Div({
          attrs: {
            class: tw`fixed inset-0 z-20 bg-black/10 backdrop-blur-[1px]`,
            'data-menu-overlay': 'true',
            gkey: 'ui:header:menuClose'
          }
        })
      : null;

    const searchRow = D.Containers.Div({
      attrs: { class: tw`mt-4 flex w-full flex-col gap-3 lg:flex-row lg:items-start` }
    }, [
      D.Containers.Div({ attrs: { class: tw`flex w-full flex-col gap-2` } }, [searchBox])
    ]);

    return D.Containers.Header({
      attrs: {
        class: cx(tw`relative border-b border-[color-mix(in_oklab,var(--border)50%,transparent)]`, (langOpen || themeOpen || templateOpen) ? tw`z-30` : ''),
        gkey: 'ui:header:menuMaybeClose'
      }
    }, [
      overlay,
      D.Containers.Div({
        attrs: {
          class: tw`mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6`
        }
      }, [
        D.Containers.Div({
          attrs: {
            class: tw`flex flex-wrap items-center justify-between gap-4`
          }
        }, [
          D.Containers.Div({
            attrs: {
              class: tw`flex min-w-[240px] flex-col gap-1`
            }
          }, [
            D.Text.H1({ attrs: { class: tw`text-3xl font-bold leading-tight` } }, [TL('app.title')]),
            D.Text.P({ attrs: { class: tw`text-sm text-[var(--muted-foreground)]` } }, [TL('header.subtitle')])
          ]),
          headerControls.length
            ? D.Containers.Div({
                attrs: {
                  class: tw`flex flex-wrap items-center justify-end gap-2`
                }
              }, headerControls)
            : null
        ].filter(Boolean)),
        searchRow
      ])
    ].filter(Boolean));
  }

  function FooterComp(db) {
    const { TL } = makeLangLookup(db);
    return D.Containers.Div({
      attrs: {
        class: tw`mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-4 py-6 text-center`
      }
    }, [
      D.Text.Span({ attrs: { class: tw`text-sm text-[var(--muted-foreground)]` } }, [TL('footer.text')])
    ]);
  }

  function TeamComp(db) {
    const { TL } = makeLangLookup(db);
    const members = [
      { key: 'architect', icon: '🧠', titleKey: 'about.team.architect.title', descKey: 'about.team.architect.desc' },
      { key: 'strategist', icon: '🧭', titleKey: 'about.team.strategist.title', descKey: 'about.team.strategist.desc' },
      { key: 'designer', icon: '🎨', titleKey: 'about.team.designer.title', descKey: 'about.team.designer.desc' },
      { key: 'engineer', icon: '🛠️', titleKey: 'about.team.engineer.title', descKey: 'about.team.engineer.desc' }
    ];
    const grid = D.Containers.Div({
      attrs: { class: tw`grid gap-4 md:grid-cols-2` }
    }, members.map((member) => D.Containers.Div({
      attrs: {
        key: `team-${member.key}`,
        class: tw`flex h-full flex-col gap-2 rounded-3xl border border-[color-mix(in_oklab,var(--border)60%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)92%,transparent)] p-4 shadow-[0_18px_38px_-32px_rgba(15,23,42,0.45)]`
      }
    }, [
      D.Text.Span({ attrs: { class: tw`text-2xl` } }, [member.icon]),
      D.Text.H3({ attrs: { class: tw`text-lg font-semibold` } }, [TL(member.titleKey)]),
      D.Text.P({ attrs: { class: tw`text-sm text-[var(--muted-foreground)]` } }, [TL(member.descKey)])
    ])));

    return UI.Card({
      title: TL('about.team.title'),
      description: TL('about.team.subtitle'),
      content: grid
    });
  }

  function FrameworkGoalsComp(db) {
    const { TL } = makeLangLookup(db);
    const goals = [
      { key: 'devJoy', icon: '💡' },
      { key: 'playfulDocs', icon: '🎲' },
      { key: 'holistic', icon: '🔄' },
      { key: 'openCraft', icon: '🤝' }
    ];
    const list = D.Lists.Ul({
      attrs: { class: tw`space-y-3` }
    }, goals.map((goal) => D.Lists.Li({
      attrs: { class: tw`flex items-start gap-3 rounded-3xl border border-[color-mix(in_oklab,var(--border)55%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)94%,transparent)] p-4` }
    }, [
      D.Text.Span({ attrs: { class: tw`text-xl` } }, [goal.icon]),
      D.Containers.Div({ attrs: { class: tw`space-y-1` } }, [
        D.Text.Span({ attrs: { class: tw`text-sm font-semibold` } }, [TL(`about.goals.${goal.key}`)])
      ])
    ])));

    return UI.Card({
      title: TL('about.goals.title'),
      description: TL('about.goals.subtitle'),
      content: list
    });
  }

  function UIShowcaseComp(db) {
    const { TL, lang } = makeLangLookup(db);
    const fallbackLang = lang === 'ar' ? 'en' : 'ar';
    const languageLabel = (code) => (code === 'ar' ? 'العربية' : 'English');
    const labelForLocale = (key, locale) => localize(dict[key] || {}, locale, locale === 'ar' ? 'en' : 'ar');

    const buttonPreview = D.Containers.Div({
      attrs: { class: tw`flex flex-wrap items-center gap-2` }
    }, [
      UI.Button({ attrs: { class: tw`min-w-[110px] font-semibold` }, variant: 'solid', size: 'md' }, [lang === 'ar' ? 'نفّذ' : 'Execute']),
      UI.Button({ attrs: { class: tw`min-w-[110px] font-semibold` }, variant: 'soft', size: 'md' }, [lang === 'ar' ? 'خيار ثانوي' : 'Secondary']),
      UI.Button({ attrs: { class: tw`min-w-[110px] font-semibold` }, variant: 'ghost', size: 'md' }, [lang === 'ar' ? 'رابط' : 'Link'])
    ]);

    const cardPreview = UI.Card({
      variant: 'card/soft-1',
      title: lang === 'ar' ? 'بطاقة حالة الطلب' : 'Order status card',
      description: lang === 'ar' ? 'تعرض ملخصاً سريعاً مع شارة حالة.' : 'Shows a quick ticket summary with a status badge.',
      content: D.Containers.Div({ attrs: { class: tw`space-y-2` } }, [
        D.Text.P({ attrs: { class: tw`text-sm` } }, [lang === 'ar' ? 'آخر تحديث قبل دقيقة واحدة.' : 'Updated one minute ago.']),
        UI.Badge({ text: lang === 'ar' ? 'جاهز للتسليم' : 'Ready to serve' })
      ])
    });

    const toolbarPreview = UI.Toolbar({
      left: [
        UI.ToolbarGroup({ label: lang === 'ar' ? 'التنقل' : 'Navigation' }, [
          UI.Button({ attrs: { class: tw`!h-9`, gkey: 'nav:home' }, variant: 'ghost', size: 'sm' }, [lang === 'ar' ? 'الرئيسية' : 'Home']),
          UI.Button({ attrs: { class: tw`!h-9`, gkey: 'nav:reports' }, variant: 'ghost', size: 'sm' }, [lang === 'ar' ? 'التقارير' : 'Reports'])
        ])
      ],
      right: [
        UI.ThemeToggleIcon({ theme: 'light', attrs: { class: tw`!w-9 !h-9` } }),
        UI.LanguageSwitch({ lang })
      ]
    });

    const emptyStatePreview = UI.EmptyState({
      icon: '📂',
      title: lang === 'ar' ? 'لا توجد بيانات بعد' : 'No data yet',
      description: lang === 'ar' ? 'ابدأ بإضافة عنصر جديد ليظهر هنا.' : 'Add your first record to populate the view.',
      actions: [
        UI.Button({ attrs: { class: tw`mt-1` }, variant: 'solid', size: 'sm' }, [lang === 'ar' ? 'إنشاء عنصر' : 'Create item'])
      ]
    });

    const statCardPreview = UI.StatCard({
      title: lang === 'ar' ? 'صافي المبيعات' : 'Net sales',
      value: lang === 'ar' ? '٢٤٬٣٠٠ ر.س' : 'SAR 24,300',
      meta: lang === 'ar' ? '↑ 12% عن الأمس' : '↑ 12% vs yesterday',
      footer: [
        UI.Badge({ variant: 'badge', text: lang === 'ar' ? 'مزامنة تلقائية' : 'Auto-sync' })
      ]
    });

    const buttonCode = {
      ar: `const { UI } = Mishkah;
// زر موحد يطلق أمر gkey
UI.Button({
  attrs: { gkey: 'orders:create' },
  variant: 'solid',
  size: 'md'
}, ['إرسال الطلب']);`,
      en: `const { UI } = Mishkah;
// Command-driven button wired with a gkey
UI.Button({
  attrs: { gkey: 'orders:create' },
  variant: 'solid',
  size: 'md'
}, ['Submit order']);`
    };

    const cardCode = {
      ar: `const { UI, DSL: D } = Mishkah;
UI.Card({
  title: 'ملخص الطلب',
  description: 'عرض سريع للحالة الحالية.',
  content: D.Text.P({}, ['طاولة ٧ جاهزة للتقديم خلال ٥ دقائق'])
});`,
      en: `const { UI, DSL: D } = Mishkah;
UI.Card({
  title: 'Order summary',
  description: 'Compact view for the current ticket.',
  content: D.Text.P({}, ['Serve table 7 within 5 minutes'])
});`
    };

    const toolbarCode = {
      ar: `const { UI } = Mishkah;
UI.Toolbar({
  left: [
    UI.ToolbarGroup({ label: 'التنقل' }, [
      UI.Button({ attrs: { gkey: 'nav:home' }, variant: 'ghost', size: 'sm' }, ['الرئيسية']),
      UI.Button({ attrs: { gkey: 'nav:reports' }, variant: 'ghost', size: 'sm' }, ['التقارير'])
    ])
  ],
  right: [UI.ThemeToggleIcon({ theme: 'light' }), UI.LanguageSwitch({ lang: 'ar' })]
});`,
      en: `const { UI } = Mishkah;
UI.Toolbar({
  left: [
    UI.ToolbarGroup({ label: 'Navigation' }, [
      UI.Button({ attrs: { gkey: 'nav:home' }, variant: 'ghost', size: 'sm' }, ['Home']),
      UI.Button({ attrs: { gkey: 'nav:reports' }, variant: 'ghost', size: 'sm' }, ['Reports'])
    ])
  ],
  right: [UI.ThemeToggleIcon({ theme: 'light' }), UI.LanguageSwitch({ lang: 'en' })]
});`
    };

    const emptyStateCode = {
      ar: `const { UI } = Mishkah;
UI.EmptyState({
  icon: '📂',
  title: 'لا توجد عناصر',
  description: 'أضف أول عنصر لتبدأ الرحلة.',
  actions: [UI.Button({ variant: 'solid', size: 'sm' }, ['إنشاء عنصر'])]
});`,
      en: `const { UI } = Mishkah;
UI.EmptyState({
  icon: '📂',
  title: 'Nothing here yet',
  description: 'Create the first record to start the flow.',
  actions: [UI.Button({ variant: 'solid', size: 'sm' }, ['Create item'])]
});`
    };

    const statCardCode = {
      ar: `const { UI } = Mishkah;
UI.StatCard({
  title: 'صافي المبيعات',
  value: '٢٤٬٣٠٠ ر.س',
  meta: '↑ 12% عن الأمس',
  footer: [UI.Badge({ variant: 'badge', text: 'مزامنة تلقائية' })]
});`,
      en: `const { UI } = Mishkah;
UI.StatCard({
  title: 'Net sales',
  value: 'SAR 24,300',
  meta: '↑ 12% vs yesterday',
  footer: [UI.Badge({ variant: 'badge', text: 'Auto-sync' })]
});`
    };

    const componentCatalog = [
      {
        key: 'button',
        icon: '🔘',
        title: { ar: 'UI.Button — زر الأوامر', en: 'UI.Button — Command button' },
        desc: {
          ar: 'زر موحد يعتمد على gkey لربط الواجهة بالأوامر مع إعدادات الحجم والثيم المضمنة.',
          en: 'Unified button that wires UI to orders via gkeys while respecting Mishkah token sizing and themes.'
        },
        preview: buttonPreview,
        code: buttonCode
      },
      {
        key: 'card',
        icon: '🪪',
        title: { ar: 'UI.Card — بطاقات المحتوى', en: 'UI.Card — Content card' },
        desc: {
          ar: 'غلاف جاهز للعناوين والوصف والمحتوى يبني بطاقات منسجمة مع نظام التصميم دون تكرار الأنماط.',
          en: 'Ready-made wrapper for titles, descriptions, and body content that keeps cards aligned with the design system.'
        },
        preview: cardPreview,
        code: cardCode
      },
      {
        key: 'toolbar',
        icon: '🧭',
        title: { ar: 'UI.Toolbar — الشريط العلوي', en: 'UI.Toolbar — Top bar' },
        desc: {
          ar: 'شريط Sticky يجمع مجموعات الأزرار وعناصر التحكم العالمية مثل تبديل الثيم واللغة.',
          en: 'Sticky top bar that organises grouped controls and global actions such as theme or language toggles.'
        },
        preview: toolbarPreview,
        code: toolbarCode
      },
      {
        key: 'empty',
        icon: '📭',
        title: { ar: 'UI.EmptyState — حالة الفراغ', en: 'UI.EmptyState — Empty state' },
        desc: {
          ar: 'مكون جاهز لحالات عدم وجود بيانات مع رمز ورسالة وزر دعوة للفعل متسق مع اللغة.',
          en: 'Drop-in empty state with icon, message, and call-to-action that adapts to the active locale.'
        },
        preview: emptyStatePreview,
        code: emptyStateCode
      },
      {
        key: 'stat',
        icon: '📊',
        title: { ar: 'UI.StatCard — بطاقة إحصائية', en: 'UI.StatCard — Metric card' },
        desc: {
          ar: 'بطاقة مضيئة لإبراز الأرقام الحية مع مساحة للهوامش والشارات في التذييل.',
          en: 'Luminous metric card to highlight live numbers with room for contextual badges in the footer.'
        },
        preview: statCardPreview,
        code: statCardCode
      }
    ];

    const cards = componentCatalog.map((item) => {
      const primaryTitle = localize(item.title, lang, fallbackLang);
      const secondaryTitle = localize(item.title, fallbackLang, lang);
      const primaryDesc = localize(item.desc, lang, fallbackLang);
      const secondaryDesc = localize(item.desc, fallbackLang, lang);

      const descriptionBlock = D.Containers.Div({
        attrs: { class: cx('sdk-card-copy', tw`space-y-2`) }
      }, [
        primaryDesc ? D.Text.P({ attrs: { class: tw`text-sm leading-relaxed` } }, [primaryDesc]) : null,
        secondaryDesc && secondaryDesc !== primaryDesc
          ? D.Text.P({ attrs: { class: tw`text-xs leading-relaxed text-[var(--muted-foreground)]` } }, [secondaryDesc])
          : null
      ].filter(Boolean));

      const previewNodes = item.preview
        ? D.Containers.Div({
            attrs: { class: cx('sdk-preview', tw`space-y-3`) }
          }, [
            D.Text.Strong({ attrs: { class: tw`text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]` } }, [
              `${labelForLocale('ui.components.previewLabel', lang)} · ${languageLabel(lang)}`
            ]),
            ...(Array.isArray(item.preview) ? item.preview : [item.preview])
          ])
        : null;

      const snippetPrimary = localize(item.code, lang, fallbackLang);
      const snippetSecondary = localize(item.code, fallbackLang, lang);

      const makeSnippet = (text, locale) => {
        if (!text) return null;
        return D.Containers.Div({ attrs: { class: cx('sdk-snippet-wrapper', tw`space-y-2`) } }, [
          D.Text.Strong({ attrs: { class: tw`text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]` } }, [
            `${labelForLocale('ui.components.exampleLabel', locale)} · ${languageLabel(locale)}`
          ]),
          D.Text.Pre({ attrs: { class: cx('sdk-snippet', tw`whitespace-pre-wrap`) } }, [
            D.Text.Code({ attrs: { class: tw`block` } }, [text])
          ])
        ]);
      };

      const snippetBlockNodes = [];
      if (snippetPrimary) snippetBlockNodes.push(makeSnippet(snippetPrimary, lang));
      if (snippetSecondary && snippetSecondary !== snippetPrimary) {
        snippetBlockNodes.push(makeSnippet(snippetSecondary, fallbackLang));
      }
      const snippetBlock = snippetBlockNodes.length
        ? D.Containers.Div({ attrs: { class: tw`space-y-3` } }, snippetBlockNodes)
        : null;

      const contentChildren = [descriptionBlock, previewNodes, snippetBlock].filter(Boolean);

      return UI.Card({
        attrs: { key: `ui-sec-${item.key}` },
        title: `${item.icon} ${primaryTitle}`,
        description: secondaryTitle && secondaryTitle !== primaryTitle ? secondaryTitle : null,
        content: D.Containers.Div({ attrs: { class: cx('sdk-card-body', tw`space-y-4`) } }, contentChildren)
      });
    });

    const grid = D.Containers.Div({ attrs: { class: cx('sdk-showcase-grid', tw`mt-2`) } }, cards);

    return UI.Card({
      title: TL('ui.components.title'),
      description: TL('ui.components.subtitle'),
      content: grid
    });
  }

  function UtilsShowcaseComp(db) {
    const { TL, lang } = makeLangLookup(db);
    const fallbackLang = lang === 'ar' ? 'en' : 'ar';
    const languageLabel = (code) => (code === 'ar' ? 'العربية' : 'English');
    const labelForLocale = (key, locale) => localize(dict[key] || {}, locale, locale === 'ar' ? 'en' : 'ar');

    const typeCode = {
      ar: `const { Type } = Mishkah.utils;
// تحقق من الحمولة قبل دمجها في الحالة
if (Type.isObj(payload) && Type.isStr(payload.id)) {
  context.setState((state) => ({
    ...state,
    data: { ...state.data, activeTicket: payload }
  }));
}`,
      en: `const { Type } = Mishkah.utils;
// Validate the payload before committing it
if (Type.isObj(payload) && Type.isStr(payload.id)) {
  context.setState((state) => ({
    ...state,
    data: { ...state.data, activeTicket: payload }
  }));
}`
    };

    const numCode = {
      ar: `const { Num } = Mishkah.utils;
// اضبط عداد الضيوف ضمن الحدود المنطقية
const guests = Num.clamp(state.guests + step, 1, 12);
context.setState((s) => ({ ...s, data: { ...s.data, guests } }));`,
      en: `const { Num } = Mishkah.utils;
// Keep the guest counter within a sane range
const guests = Num.clamp(state.guests + step, 1, 12);
context.setState((s) => ({ ...s, data: { ...s.data, guests } }));`
    };

    const timeCode = {
      ar: `const { Time } = Mishkah.utils;
await Time.sleep(500);
const stamp = Time.fmt(Time.now(), { hour: '2-digit', minute: '2-digit' });
console.log('آخر تحديث', stamp);`,
      en: `const { Time } = Mishkah.utils;
await Time.sleep(500);
const stamp = Time.fmt(Time.now(), { hour: '2-digit', minute: '2-digit' });
console.log('Last update', stamp);`
    };

    const controlCode = {
      ar: `const { Control } = Mishkah.utils;
const saveDraft = Control.debounce((draft) => persistDraft(draft), 400);
saveDraft(context.getState().data.form);`,
      en: `const { Control } = Mishkah.utils;
const saveDraft = Control.debounce((draft) => persistDraft(draft), 400);
saveDraft(context.getState().data.form);`
    };

    const dataCode = {
      ar: `const { Data } = Mishkah.utils;
const lines = Data.getPath(state, 'order.lines', []);
const merged = Data.deepMerge(defaultOrder, incoming);
context.setState((s) => ({ ...s, data: { ...s.data, order: merged, lines } }));`,
      en: `const { Data } = Mishkah.utils;
const lines = Data.getPath(state, 'order.lines', []);
const merged = Data.deepMerge(defaultOrder, incoming);
context.setState((s) => ({ ...s, data: { ...s.data, order: merged, lines } }));`
    };

    const storageCode = {
      ar: `const { Storage, JSON: JsonUtils } = Mishkah.utils;
const cache = Storage.local('pos');
cache.set('draft', JsonUtils.stableStringify(order));
cache.on('change', ({ key }) => console.info('تغير المفتاح', key));`,
      en: `const { Storage, JSON: JsonUtils } = Mishkah.utils;
const cache = Storage.local('pos');
cache.set('draft', JsonUtils.stableStringify(order));
cache.on('change', ({ key }) => console.info('Key changed', key));`
    };

    const netCode = {
      ar: `const { Net } = Mishkah.utils;
const api = Net.client('/api', { 'X-App': 'mishkah' });
const tickets = await api.get('tickets', { query: { status: 'open' } });`,
      en: `const { Net } = Mishkah.utils;
const api = Net.client('/api', { 'X-App': 'mishkah' });
const tickets = await api.get('tickets', { query: { status: 'open' } });`
    };

    const utilsCatalog = [
      {
        key: 'type',
        icon: '🧪',
        title: { ar: 'Type — حراس الأنواع', en: 'Type — Type guards' },
        desc: {
          ar: 'واجهات تحقق خفيفة تبقي أوامر Mishkah محمية من البيانات المكسورة قبل الدمج.',
          en: 'Lightweight guards that keep Mishkah orders safe from malformed payloads before merging.'
        },
        functions: [
          { name: 'Type.isObj(value)', desc: { ar: 'يتأكد أن القيمة كائن بسيط قبل التعامل مع المسارات المتداخلة.', en: 'Verifies the value is a plain object before reading nested paths.' } },
          { name: 'Type.isArr(value)', desc: { ar: 'يضمن أن البيانات مصفوفة قبل التكرار أو التجزئة.', en: 'Ensures data is an array before iterating or chunking.' } },
          { name: 'Type.isStr(value)', desc: { ar: 'يحرس السلاسل النصية لتفادي أخطاء gkey أو العرض.', en: 'Guards string values to avoid gkey and rendering issues.' } }
        ],
        code: typeCode
      },
      {
        key: 'num',
        icon: '🧮',
        title: { ar: 'Num — أدوات الأعداد', en: 'Num — Number helpers' },
        desc: {
          ar: 'تجهيزات رياضية سريعة لضبط الحدود وتوليد القيم العشوائية وعرض النتائج.',
          en: 'Quick math helpers for bounding values, generating integers, and formatting outputs.'
        },
        functions: [
          { name: 'Num.clamp(value, min, max)', desc: { ar: 'يحصر القيمة داخل نطاق محدد لضمان الثبات.', en: 'Clamps a value inside an inclusive range to keep state stable.' } },
          { name: 'Num.randomInt(min, max)', desc: { ar: 'ينتج رقمًا صحيحًا عشوائيًا لتجارب الواجهة أو البيانات الوهمية.', en: 'Generates a random integer for demos and seeded defaults.' } },
          { name: 'Num.round(value, precision)', desc: { ar: 'يقرب القيم لعرض مالي أو إحصائي نظيف.', en: 'Rounds figures for neat financial or analytics displays.' } }
        ],
        code: numCode
      },
      {
        key: 'time',
        icon: '⏱️',
        title: { ar: 'Time — الزمن والتنسيق', en: 'Time — Timing & formatting' },
        desc: {
          ar: 'مجموعة تعطي طوابع زمنية وتنسيقات جاهزة وتأخيرًا قائمًا على Promise.',
          en: 'Collection that provides timestamps, friendly formatting, and Promise-based delays.'
        },
        functions: [
          { name: 'Time.now()', desc: { ar: 'يمنح طابعًا زمنيًا سريعًا للأحداث والأوامر.', en: 'Delivers an instant timestamp for events and orders.' } },
          { name: 'Time.fmt(date, options)', desc: { ar: 'يغلف Intl.DateTimeFormat لإخراج أنيق بلغات متعددة.', en: 'Wraps Intl.DateTimeFormat for multilingual, polished output.' } },
          { name: 'Time.sleep(ms)', desc: { ar: 'يقدم Promise لتأخير التنفيذ أو بناء المؤقتات.', en: 'Offers a Promise to delay execution or stage timers.' } }
        ],
        code: timeCode
      },
      {
        key: 'control',
        icon: '🎛️',
        title: { ar: 'Control — التحكم في التدفق', en: 'Control — Flow control' },
        desc: {
          ar: 'أدوات تنظيم التنفيذ مثل debounce و throttle و retry للحفاظ على الأداء.',
          en: 'Execution organisers such as debounce, throttle, and retry to keep interactions responsive.'
        },
        functions: [
          { name: 'Control.debounce(fn, wait)', desc: { ar: 'يؤخر التنفيذ حتى يهدأ الإدخال المتكرر.', en: 'Delays execution until rapid input settles.' } },
          { name: 'Control.throttle(fn, wait)', desc: { ar: 'يضمن تشغيل الدالة مرة واحدة خلال فترة محددة.', en: 'Ensures a handler runs at most once during a window.' } },
          { name: 'Control.retry(fn, options)', desc: { ar: 'يعيد المحاولة تلقائيًا مع تزايد زمني وجيتّر اختياري.', en: 'Retries async logic with exponential backoff and optional jitter.' } }
        ],
        code: controlCode
      },
      {
        key: 'data',
        icon: '🗂️',
        title: { ar: 'Data — بنى البيانات', en: 'Data — Data structures' },
        desc: {
          ar: 'وظائف للتعامل مع المسارات العميقة والدمج اللطيف وتحويل القيم إلى مصفوفات.',
          en: 'Helpers for deep paths, gentle merging, and normalising values into arrays.'
        },
        functions: [
          { name: 'Data.getPath(obj, path, fallback)', desc: { ar: 'قراءة المسارات المتداخلة بأمان مع قيمة افتراضية.', en: 'Safely reads nested paths with a fallback value.' } },
          { name: 'Data.deepMerge(target, source)', desc: { ar: 'يدمج الكائنات دون خسارة الفروع الموجودة.', en: 'Merges objects without dropping existing branches.' } },
          { name: 'Data.ensureArray(value)', desc: { ar: 'يوحد المدخلات إلى مصفوفة لعمليات التكرار.', en: 'Normalises input to an array for consistent iteration.' } }
        ],
        code: dataCode
      },
      {
        key: 'storage',
        icon: '💾',
        title: { ar: 'Storage — التخزين الموحّد', en: 'Storage — Namespaced storage' },
        desc: {
          ar: 'طبقة وصول إلى LocalStorage و SessionStorage مع أحداث change ومساحات أسماء.',
          en: 'Unified access to LocalStorage and SessionStorage with namespaces and change events.'
        },
        functions: [
          { name: 'Storage.local(namespace)', desc: { ar: 'يبني مساحة أسماء في LocalStorage مع واجهة كائنية.', en: 'Builds a namespaced LocalStorage client with a clean API.' } },
          { name: 'Storage.session(namespace)', desc: { ar: 'نفس الواجهة لكن للجلسة الحالية.', en: 'SessionStorage variant for per-session state.' } },
          { name: "Storage.on('change', handler)", desc: { ar: 'يتيح الاستماع لأي تغيير يحدث داخل جميع المساحات.', en: 'Allows subscribing to every storage change across namespaces.' } }
        ],
        code: storageCode
      },
      {
        key: 'net',
        icon: '🌐',
        title: { ar: 'Net — الشبكات والواجهات', en: 'Net — Networking toolkit' },
        desc: {
          ar: 'مغلفات Fetch مع مهلات وإعادة محاولات وبناء عملاء REST جاهزين.',
          en: 'Fetch wrappers with timeouts, retries, and ready-made REST clients.'
        },
        functions: [
          { name: 'Net.ajax(url, options)', desc: { ar: 'استدعاء مرن يدعم JSON والمهلات ومعالجة الأخطاء.', en: 'Flexible request helper with JSON, timeout, and error handling support.' } },
          { name: 'Net.client(base, headers)', desc: { ar: 'ينشئ عميلاً يقدم دوال get/post/... تلقائياً.', en: 'Creates a client exposing get/post/... methods automatically.' } },
          { name: 'Net.form(data)', desc: { ar: 'يحّول الكائنات إلى FormData مع دعم الملفات والمصفوفات.', en: 'Turns objects into FormData with array and file support.' } }
        ],
        code: netCode
      }
    ];

    const cards = utilsCatalog.map((item) => {
      const primaryTitle = localize(item.title, lang, fallbackLang);
      const secondaryTitle = localize(item.title, fallbackLang, lang);
      const primaryDesc = localize(item.desc, lang, fallbackLang);
      const secondaryDesc = localize(item.desc, fallbackLang, lang);

      const descriptionBlock = D.Containers.Div({
        attrs: { class: cx('sdk-card-copy', tw`space-y-2`) }
      }, [
        primaryDesc ? D.Text.P({ attrs: { class: tw`text-sm leading-relaxed` } }, [primaryDesc]) : null,
        secondaryDesc && secondaryDesc !== primaryDesc
          ? D.Text.P({ attrs: { class: tw`text-xs leading-relaxed text-[var(--muted-foreground)]` } }, [secondaryDesc])
          : null
      ].filter(Boolean));

      const functionItems = (item.functions || []).map((fn) => {
        const primaryFnDesc = localize(fn.desc, lang, fallbackLang);
        const secondaryFnDesc = localize(fn.desc, fallbackLang, lang);
        return D.Lists.Li({
          attrs: { key: `fn-${item.key}-${fn.name}`, class: cx('sdk-function-item', tw`space-y-2`) }
        }, [
          D.Text.Span({ attrs: { class: tw`text-sm font-semibold` } }, [fn.name]),
          primaryFnDesc ? D.Text.P({ attrs: { class: tw`text-sm leading-relaxed` } }, [primaryFnDesc]) : null,
          secondaryFnDesc && secondaryFnDesc !== primaryFnDesc
            ? D.Text.P({ attrs: { class: tw`text-xs leading-relaxed text-[var(--muted-foreground)]` } }, [secondaryFnDesc])
            : null
        ].filter(Boolean));
      });

      const functionList = functionItems.length
        ? D.Containers.Div({ attrs: { class: tw`space-y-2` } }, [
            D.Containers.Div({ attrs: { class: tw`flex flex-col gap-1` } }, [
              D.Text.Strong({ attrs: { class: tw`text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]` } }, [
                labelForLocale('utils.functionLabel', lang)
              ]),
              labelForLocale('utils.functionLabel', fallbackLang) !== labelForLocale('utils.functionLabel', lang)
                ? D.Text.Span({ attrs: { class: tw`text-[10px] uppercase tracking-[0.28em] text-[var(--muted-foreground)]/70` } }, [
                    labelForLocale('utils.functionLabel', fallbackLang)
                  ])
                : null
            ].filter(Boolean)),
            D.Lists.Ul({ attrs: { class: cx('sdk-function-list', tw`space-y-2`) } }, functionItems)
          ])
        : null;

      const snippetPrimary = localize(item.code, lang, fallbackLang);
      const snippetSecondary = localize(item.code, fallbackLang, lang);

      const makeSnippet = (text, locale) => {
        if (!text) return null;
        return D.Containers.Div({ attrs: { class: cx('sdk-snippet-wrapper', tw`space-y-2`) } }, [
          D.Text.Strong({ attrs: { class: tw`text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]` } }, [
            `${labelForLocale('utils.exampleLabel', locale)} · ${languageLabel(locale)}`
          ]),
          D.Text.Pre({ attrs: { class: cx('sdk-snippet', tw`whitespace-pre-wrap`) } }, [
            D.Text.Code({ attrs: { class: tw`block` } }, [text])
          ])
        ]);
      };

      const snippetBlockNodes = [];
      if (snippetPrimary) snippetBlockNodes.push(makeSnippet(snippetPrimary, lang));
      if (snippetSecondary && snippetSecondary !== snippetPrimary) {
        snippetBlockNodes.push(makeSnippet(snippetSecondary, fallbackLang));
      }
      const snippetBlock = snippetBlockNodes.length
        ? D.Containers.Div({ attrs: { class: tw`space-y-3` } }, snippetBlockNodes)
        : null;

      const contentChildren = [descriptionBlock, functionList, snippetBlock].filter(Boolean);

      return UI.Card({
        attrs: { key: `utils-${item.key}` },
        title: `${item.icon} ${primaryTitle}`,
        description: secondaryTitle && secondaryTitle !== primaryTitle ? secondaryTitle : null,
        content: D.Containers.Div({ attrs: { class: cx('sdk-card-body', tw`space-y-4`) } }, contentChildren)
      });
    });

    const grid = D.Containers.Div({ attrs: { class: cx('sdk-showcase-grid', tw`mt-2`) } }, cards);

    return UI.Card({
      title: TL('utils.title'),
      description: TL('utils.subtitle'),
      content: grid
    });
  }

  function SDKShowcaseComp(db) {
    const { TL } = makeLangLookup(db);
    const steps = [
      { key: 'bootstrap', icon: '1️⃣' },
      { key: 'templates', icon: '2️⃣' },
      { key: 'extensibility', icon: '3️⃣' }
    ];
    const list = D.Lists.Ol({ attrs: { class: tw`space-y-3` } }, steps.map((step) => D.Lists.Li({
      attrs: { class: tw`flex items-start gap-3 rounded-3xl border border-[color-mix(in_oklab,var(--border)60%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)95%,transparent)] p-4` }
    }, [
      D.Text.Span({ attrs: { class: tw`text-lg` } }, [step.icon]),
      D.Text.Span({ attrs: { class: tw`text-sm text-[var(--muted-foreground)]` } }, [TL(`sdk.point.${step.key}`)])
    ])));

    return UI.Card({
      title: TL('sdk.title'),
      description: TL('sdk.subtitle'),
      content: list
    });
  }

  function PosShowcaseComp(db) {
    const { TL } = makeLangLookup(db);
    const highlights = [
      { key: 'orders', icon: '🧾' },
      { key: 'tickets', icon: '🍽️' },
      { key: 'analytics', icon: '📊' }
    ];
    const list = D.Lists.Ul({ attrs: { class: tw`space-y-3` } }, highlights.map((item) => D.Lists.Li({
      attrs: { class: tw`flex items-start gap-3 rounded-3xl border border-[color-mix(in_oklab,var(--border)55%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)92%,transparent)] p-4` }
    }, [
      D.Text.Span({ attrs: { class: tw`text-xl` } }, [item.icon]),
      D.Text.Span({ attrs: { class: tw`text-sm text-[var(--muted-foreground)]` } }, [TL(`ui.pos.point.${item.key}`)])
    ])));

    return UI.Card({
      title: TL('ui.pos.title'),
      description: TL('ui.pos.subtitle'),
      content: list
    });
  }

  function KdsShowcaseComp(db) {
    const { TL } = makeLangLookup(db);
    const highlights = [
      { key: 'timing', icon: '⏳' },
      { key: 'sync', icon: '🔗' },
      { key: 'modes', icon: '🌓' }
    ];
    const list = D.Lists.Ul({ attrs: { class: tw`space-y-3` } }, highlights.map((item) => D.Lists.Li({
      attrs: { class: tw`flex items-start gap-3 rounded-3xl border border-[color-mix(in_oklab,var(--border)55%,transparent)] bg-[color-mix(in_oklab,var(--surface-2)90%,transparent)] p-4` }
    }, [
      D.Text.Span({ attrs: { class: tw`text-xl` } }, [item.icon]),
      D.Text.Span({ attrs: { class: tw`text-sm text-[var(--muted-foreground)]` } }, [TL(`ui.kds.point.${item.key}`)])
    ])));

    return UI.Card({
      title: TL('ui.kds.title'),
      description: TL('ui.kds.subtitle'),
      content: list
    });
  }

  function CounterComp(db) {
    const { TL } = makeLangLookup(db);
    return UI.Card({
      title: TL('counter.title'),
      content: D.Containers.Div({ attrs: { class: tw`flex items-center justify-center gap-3 py-6` } }, [
        UI.Button({ attrs: { gkey: 'counter:dec' }, variant: 'soft', size: 'lg' }, ['−']),
        D.Text.Span({ attrs: { class: tw`text-3xl font-semibold` } }, [String(db.data.counter)]),
        UI.Button({ attrs: { gkey: 'counter:inc' }, variant: 'soft', size: 'lg' }, ['+']),
        UI.Button({ attrs: { gkey: 'counter:reset', class: tw`ms-4` }, variant: 'ghost', size: 'sm' }, [TL('counter.reset')])
      ])
    });
  }

  function buildGameBoard(db) {
    const { TL } = makeLangLookup(db);
    const game = db.data.game;
    const showSolution = game.revealSolution || game.status === 'won';
    const proverb = game.proverb ? game.proverb.t : '';
    const feedbackType = (game.feedback && game.feedback.type) || 'idle';

    const tiles = proverb.split('').map((raw, idx) => {
      if (raw === ' ') {
        return D.Containers.Div({ attrs: { key: `space-${idx}`, class: tw`w-10` } });
      }
      const normalized = norm(raw);
      const revealed = !!game.guessed[normalized];
      return D.Containers.Div({
        attrs: {
          key: `tile-${idx}`,
          class: cx(
            tw`grid h-12 w-10 place-items-center rounded-xl border text-xl font-semibold transition`,
            revealed
              ? tw`bg-[color-mix(in_oklab,var(--primary)25%,transparent)] border-[color-mix(in_oklab,var(--primary)35%,transparent)]`
              : tw`bg-[color-mix(in_oklab,var(--surface-1)90%,transparent)] border-[color-mix(in_oklab,var(--border)60%,transparent)]`
          )
        }
      }, [revealed ? raw : '']);
    });

    const letters = D.Containers.Div({
      attrs: {
        class: tw`grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-10`
      }
    }, AR_ALPHA.map((letter, idx) => UI.Button({
      attrs: {
        key: `letter-${idx}`,
        gkey: 'game:guess',
        'data-ch': letter,
        disabled: game.status !== 'running' || !!game.guessed[letter],
        class: tw`text-lg font-extrabold`
      },
      variant: 'soft',
      size: 'lg'
    }, [letter])));

    const feedbackMessages = {
      correct: TL('game.feedback.correct'),
      wrong: TL('game.feedback.wrong'),
      win: TL('game.feedback.win'),
      lose: TL('game.feedback.lose')
    };

    const infoTiles = [];
    if (feedbackType && feedbackType !== 'idle' && feedbackMessages[feedbackType]) {
      infoTiles.push(
        UI.Card({
          tone: feedbackType === 'wrong' ? 'warning' : feedbackType === 'lose' ? 'danger' : 'success',
          icon: feedbackType === 'correct' ? '✅' : feedbackType === 'wrong' ? '⚠️' : feedbackType === 'win' ? '🏆' : '💔',
          title: TL('game.lastMove'),
          description: feedbackMessages[feedbackType]
        })
      );
    }

    if (game.proverb) {
      infoTiles.push(
        UI.Card({
          icon: '💡',
          title: TL('game.hintTitle'),
          description: game.proverb.hint
        })
      );
    }

    if (showSolution && game.proverb) {
      infoTiles.push(
        UI.Card({
          icon: '📜',
          title: TL('game.solution'),
          description: D.Containers.Div({ attrs: { class: tw`space-y-2` } }, [
            D.Text.P({ attrs: { class: tw`font-semibold` } }, [game.proverb.t]),
            D.Text.P({}, [TL('game.explanation'), ': ', game.proverb.explanation]),
            D.Text.P({}, [TL('game.lesson'), ': ', game.proverb.lesson]),
            D.Text.P({ attrs: { class: tw`text-xs text-[var(--muted-foreground)]` } }, [TL('game.source'), ': ', game.proverb.source])
          ])
        })
      );
    }

    const audioNode = game.musicOn && game.status === 'running'
      ? D.Media.Audio({ attrs: { autoplay: true, loop: true, src: game.audioList[game.audioIdx].url, class: tw`hidden` } })
      : null;

    const cueNode = feedbackType && feedbackType !== 'idle' && SOUND_EFFECTS[feedbackType]
      ? D.Media.Audio({ attrs: { autoplay: true, src: SOUND_EFFECTS[feedbackType], class: tw`hidden` } })
      : null;

    const shouldShowReveal = !!(game.proverb && (game.status === 'won' || game.status === 'lost') && !game.revealSolution);

    const revealSection = shouldShowReveal
      ? D.Containers.Div({ attrs: { class: tw`space-y-3 text-center` } }, [
        D.Text.P({ attrs: { class: tw`text-sm text-[var(--muted-foreground)]` } }, [TL('game.revealPrompt')]),
        UI.Button({
          attrs: {
            gkey: 'game:reveal',
            class: cx(
              tw`w-full rounded-full py-3 font-semibold transition-shadow`,
              tw`shadow-[0_0_28px_rgba(250,204,21,0.55)] animate-pulse hover:shadow-none focus-visible:shadow-none`
            )
          },
          variant: 'soft',
          size: 'lg'
        }, [TL('game.reveal')])
      ])
      : null;

    return D.Containers.Div({ attrs: { class: tw`space-y-6` } }, [
      D.Containers.Div({ attrs: { class: tw`space-y-4 rounded-3xl border border-[color-mix(in_oklab,var(--border)50%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)92%,transparent)] p-6 shadow-md` } }, [
        D.Containers.Div({ attrs: { class: tw`flex flex-wrap justify-center gap-2` } }, tiles),
        UI.Divider(),
        D.Containers.Div({ attrs: { class: tw`space-y-2` } }, [
          D.Text.Strong({ attrs: { class: tw`text-sm text-[var(--muted-foreground)]` } }, [TL('game.letters')]),
          letters
        ])
      ]),
      infoTiles.length
        ? D.Containers.Div({ attrs: { class: tw`grid gap-4 md:grid-cols-2` } }, infoTiles)
        : null,
      revealSection,
      audioNode,
      cueNode
    ].filter(Boolean));
  }

  function ProverbsGameComp(db) {
    const { TL } = makeLangLookup(db);
    const game = db.data.game || INITIAL_GAME_STATE;
    const settings = ensureGameSettings(game.settings);
    const timeLeft = computeTimeLeft(game);
    const hearts = Array.from({ length: game.triesMax }, (_, idx) => (
      D.Text.Span({
        attrs: {
          key: `heart-${idx}`,
          class: cx(tw`text-lg`, idx < game.triesLeft ? '' : tw`opacity-40`)
        }
      }, [idx < game.triesLeft ? '❤️' : '💔'])
    ));

    const statusStrip = D.Containers.Div({
      attrs: {
        class: tw`flex flex-wrap items-center gap-3 rounded-full border border-[color-mix(in_oklab,var(--border)55%,transparent)] bg-[color-mix(in_oklab,var(--surface-2)75%,transparent)] px-4 py-2 shadow-sm`
      }
    }, [
      D.Containers.Div({ attrs: { class: tw`flex items-center gap-2` } }, [
        D.Text.Span({ attrs: { class: tw`text-sm text-[var(--muted-foreground)]` } }, ['⏳ ', TL('game.timeLabel')]),
        D.Text.Span({ attrs: { class: tw`text-base font-semibold` } }, [timeLeft != null ? String(timeLeft) : '—'])
      ]),
      D.Containers.Div({ attrs: { class: tw`flex items-center gap-2` } }, [
        D.Text.Span({ attrs: { class: tw`text-sm text-[var(--muted-foreground)]` } }, ['❤️ ', TL('game.tries')]),
        D.Containers.Div({ attrs: { class: tw`flex items-center gap-1` } }, hearts),
        D.Text.Span({ attrs: { class: tw`text-xs text-[var(--muted-foreground)]` } }, [`/ ${game.triesMax}`])
      ]),
      D.Containers.Div({ attrs: { class: tw`flex items-center gap-2` } }, [
        D.Text.Span({ attrs: { class: tw`text-sm text-[var(--muted-foreground)]` } }, ['🎯 ', TL('game.statusLabel')]),
        D.Text.Span({ attrs: { class: tw`text-base font-semibold` } }, [TL(`game.status.${game.status}`)])
      ])
    ]);

    const startButton = UI.Button({
      attrs: {
        gkey: 'game:start',
        class: tw`rounded-full px-5 py-2 text-sm font-semibold`
      },
      variant: 'soft',
      size: 'sm'
    }, [game.status === 'running' ? TL('game.new') : TL('game.start')]);

    const controlStrip = D.Containers.Div({
      attrs: {
        class: tw`flex flex-col gap-3 md:flex-row md:items-center md:justify-between`
      }
    }, [
      statusStrip,
      D.Containers.Div({ attrs: { class: tw`flex items-center justify-end gap-3` } }, [startButton])
    ]);

    const timeFieldId = 'proverbs-setting-time';
    const bonusFieldId = 'proverbs-setting-bonus';
    const perChoiceField = UI.Field({
      id: timeFieldId,
      label: TL('game.settings.timePerChoice'),
      control: UI.Input({
        attrs: {
          id: timeFieldId,
          type: 'number',
          inputmode: 'numeric',
          min: String(GAME_SETTING_LIMITS.perChoiceMin),
          max: String(GAME_SETTING_LIMITS.perChoiceMax),
          step: '1',
          value: String(settings.perChoiceSeconds),
          dir: 'ltr',
          gkey: 'game:settings:update',
          'data-game-setting': 'perChoiceSeconds'
        }
      }),
      helper: TL('game.settings.timePerChoiceHint')
    });

    const bonusField = UI.Field({
      id: bonusFieldId,
      label: TL('game.settings.bonusLabel'),
      control: UI.Input({
        attrs: {
          id: bonusFieldId,
          type: 'number',
          inputmode: 'numeric',
          min: String(GAME_SETTING_LIMITS.bonusMin),
          max: String(GAME_SETTING_LIMITS.bonusMax),
          step: '1',
          value: String(settings.bonusSeconds),
          dir: 'ltr',
          gkey: 'game:settings:update',
          'data-game-setting': 'bonusSeconds'
        }
      }),
      helper: TL('game.settings.bonusHint')
    });

    const settingsPanel = D.Containers.Div({
      attrs: {
        class: tw`rounded-3xl border border-[color-mix(in_oklab,var(--border)60%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)92%,transparent)] p-4 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.4)]`
      }
    }, [
      D.Containers.Div({
        attrs: { class: tw`flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between` }
      }, [
        D.Text.Span({ attrs: { class: tw`text-base font-semibold` } }, [TL('game.settings.title')]),
        D.Text.Span({ attrs: { class: tw`text-xs text-[var(--muted-foreground)]` } }, [TL('game.settings.subtitle')])
      ]),
      D.Containers.Div({ attrs: { class: tw`mt-4 grid gap-4 sm:grid-cols-2` } }, [perChoiceField, bonusField])
    ]);

    return UI.Card({
      title: TL('game.title'),
      content: D.Containers.Div({ attrs: { class: tw`space-y-6` } }, [
        settingsPanel,
        controlStrip,
        buildGameBoard(db)
      ])
    });
  }

  function SequenceGameComp(db) {
    const { TL, lang } = makeLangLookup(db);
    const fallbackLang = lang === 'ar' ? 'en' : 'ar';
    const state = db.data.sequenceGame || INITIAL_SEQUENCE_STATE;
    const sequence = state.sequence;
    const status = state.status || 'idle';
    const triesLeft = typeof state.triesLeft === 'number' ? state.triesLeft : state.triesMax;
    const guessValue = typeof state.guess === 'string' ? state.guess : '';
    const canSubmit = status === 'running' && guessValue.trim() !== '';

    const startLabel = status === 'running' ? TL('sequence.new') : status === 'idle' ? TL('sequence.start') : TL('sequence.tryAgain');

    const startButton = UI.Button({
      attrs: {
        gkey: 'sequence:start',
        class: tw`rounded-full px-4 py-2 text-sm font-semibold`
      },
      variant: 'soft',
      size: 'sm'
    }, [startLabel]);

    const summaryStrip = D.Containers.Div({
      attrs: {
        class: tw`flex flex-wrap items-center justify-between gap-3 rounded-full border border-[color-mix(in_oklab,var(--border)55%,transparent)] bg-[color-mix(in_oklab,var(--surface-2)75%,transparent)] px-4 py-2 shadow-sm`
      }
    }, [
      D.Containers.Div({ attrs: { class: tw`flex items-center gap-2` } }, [
        D.Text.Span({ attrs: { class: tw`text-sm text-[var(--muted-foreground)]` } }, ['🎯 ', TL('sequence.statusLabel')]),
        D.Text.Span({ attrs: { class: tw`text-base font-semibold` } }, [TL(`sequence.status.${status}`)])
      ]),
      D.Containers.Div({ attrs: { class: tw`flex items-center gap-2` } }, [
        D.Text.Span({ attrs: { class: tw`text-sm text-[var(--muted-foreground)]` } }, ['❤️ ', TL('sequence.tries')]),
        D.Text.Span({ attrs: { class: tw`text-base font-semibold` } }, [`${triesLeft}/${state.triesMax}`])
      ]),
      startButton
    ]);

  // اتجاه الواجهة (يفضَّل أخذه من db.env.dir)
const isRTL = (db?.env?.dir || document?.documentElement?.dir || 'rtl') === 'rtl';

// 1) بناء عقد الأرقام
const numbersNodes = (sequence?.numbers ?? []).map((num, idx) =>
  D.Containers.Div({
    attrs: {
      key: `seq-${idx}`,
      class: tw`grid h-12 w-12 place-items-center rounded-2xl border border-[color-mix(in_oklab,var(--border)55%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)92%,transparent)] text-xl font-semibold`
    }
  }, [String(num)])
);

// 2) إضافة خانة "الرقم التالي"
numbersNodes.push(
  D.Containers.Div({
    attrs: {
      key: 'seq-next',
      class: tw`grid h-12 w-12 place-items-center rounded-2xl border border-dashed border-[color-mix(in_oklab,var(--primary)45%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)90%,transparent)] text-xl font-semibold`
    }
  }, ['?'])
);

// 3) اللوح: نجعل صف الأرقام يتبع اتجاه الصفحة، مع عزل الـBiDi
const board = D.Containers.Div({ attrs: { class: tw`space-y-3` } }, [
  D.Text.P({ attrs: { class: tw`text-center text-sm text-[var(--muted-foreground)]` } }, [TL('sequence.prompt')]),
  D.Containers.Div({
    attrs: {
      class: tw`flex flex-wrap items-center justify-center gap-3`,
      dir: isRTL ? 'rtl' : 'ltr',
      // يمنع تأثير اتجاه الآباء ويضمن ترتيبًا بصريًا ثابتًا
      style: 'unicode-bidi:isolate-override;'
    }
  }, numbersNodes)
]);

    const guessFieldId = 'sequence-guess-field';
    const guessField = UI.Field({
      id: guessFieldId,
      label: TL('sequence.inputLabel'),
      control: UI.Input({
        attrs: {
          id: guessFieldId,
          type: 'number',
          inputmode: 'numeric',
          value: guessValue,
          placeholder: TL('sequence.prompt'),
          gkey: 'sequence:update',
          'data-field': 'guess'
        }
      })
    });

    const submitButton = UI.Button({
      attrs: {
        gkey: 'sequence:submit',
        class: tw`md:self-end`,
        disabled: !canSubmit
      },
      variant: 'soft',
      size: 'md'
    }, [TL('sequence.submit')]);

    const formRow = D.Containers.Div({ attrs: { class: tw`grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]` } }, [guessField, submitButton]);

    const revealPrompt = sequence && (status === 'won' || status === 'lost') && !state.reveal
      ? D.Containers.Div({ attrs: { class: tw`space-y-3 text-center` } }, [
        D.Text.P({ attrs: { class: tw`text-sm text-[var(--muted-foreground)]` } }, [TL('sequence.revealPrompt')]),
        UI.Button({
          attrs: { gkey: 'sequence:reveal', class: tw`w-full rounded-full py-3 font-semibold` },
          variant: 'soft',
          size: 'lg'
        }, [TL('sequence.reveal')])
      ])
      : null;

    const feedbackMessages = {
      correct: TL('sequence.feedback.correct'),
      wrong: TL('sequence.feedback.wrong'),
      win: TL('sequence.feedback.win'),
      lose: TL('sequence.feedback.lose')
    };

    const infoTiles = [];
    const feedbackType = state.feedback && state.feedback.type;
    if (feedbackType && feedbackMessages[feedbackType]) {
      infoTiles.push(
        UI.Card({
          tone: feedbackType === 'wrong' ? 'warning' : feedbackType === 'lose' ? 'danger' : 'success',
          icon: feedbackType === 'correct' ? '✅' : feedbackType === 'wrong' ? '⚠️' : feedbackType === 'win' ? '🏆' : '💔',
          title: TL('sequence.statusLabel'),
          description: feedbackMessages[feedbackType]
        })
      );
    }

    if (sequence) {
      infoTiles.push(
        UI.Card({
          icon: '💡',
          title: TL('sequence.hintTitle'),
          description: localize(sequence.hint, lang, fallbackLang)
        })
      );
    }

    if (sequence && state.reveal) {
      infoTiles.push(
        UI.Card({
          icon: '🧠',
          title: TL('sequence.rule'),
          description: D.Containers.Div({ attrs: { class: tw`space-y-2` } }, [
            D.Text.P({ attrs: { class: tw`font-semibold` } }, [TL('sequence.answer'), ': ', String(sequence.answer)]),
            D.Text.P({}, [TL('sequence.rule'), ': ', localize(sequence.rule, lang, fallbackLang)]),
            D.Text.P({}, [TL('sequence.lesson'), ': ', localize(sequence.lesson, lang, fallbackLang)])
          ])
        })
      );
    }

    const infoSection = infoTiles.length
      ? D.Containers.Div({ attrs: { class: tw`grid gap-4 md:grid-cols-2` } }, infoTiles)
      : null;

    const historyItems = (state.history || []).map((entry, idx) => (
      D.Lists.Li({
        attrs: {
          key: `history-${idx}`,
          class: tw`flex items-center justify-between rounded-lg border border-[color-mix(in_oklab,var(--border)50%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)95%,transparent)] px-3 py-2`
        }
      }, [
        D.Text.Span({ attrs: { class: tw`text-sm font-medium` } }, [entry.guess != null && entry.guess !== '' ? String(entry.guess) : '—']),
        D.Text.Span({
          attrs: {
            class: cx(
              tw`text-xs font-semibold`,
              entry.result === 'correct'
                ? tw`text-emerald-600 dark:text-emerald-400`
                : tw`text-amber-600 dark:text-amber-400`
            )
          }
        }, [TL(`sequence.feedback.${entry.result === 'correct' ? 'correct' : 'wrong'}`)])
      ])
    ));

    const historyContent = historyItems.length
      ? D.Lists.Ul({ attrs: { class: tw`space-y-2` } }, historyItems)
      : D.Text.P({ attrs: { class: tw`text-sm text-[var(--muted-foreground)]` } }, [TL('sequence.history.empty')]);

    const historyCard = UI.Card({
      title: TL('sequence.historyTitle'),
      content: D.Containers.Div({ attrs: { class: tw`space-y-2` } }, [historyContent])
    });

    return UI.Card({
      title: TL('sequence.title'),
      description: TL('sequence.description'),
      content: D.Containers.Div({ attrs: { class: tw`space-y-6` } }, [
        summaryStrip,
        board,
        formRow,
        revealPrompt,
        infoSection,
        historyCard
      ].filter(Boolean))
    });
  }

  function ReadmeCompTec(db) {
    const { TL, lang } = makeLangLookup(db);
    const docs = db.data.docs || {};
    const fallbackLang = lang === 'ar' ? 'en' : 'ar';
    const pack = docs[lang] || {};
    const fallbackPack = docs[fallbackLang] || {};
    const techDoc = (pack.tec && pack.tec.trim()) || (fallbackPack.tec && fallbackPack.tec.trim()) || '';

    const content = techDoc
      ? UI.Markdown({ content: techDoc, className: tw`prose max-w-none` })
      : UI.EmptyState({ icon: '📄', title: TL('readme.section.tec'), message: TL('readme.hint') });

    return UI.Card({
      title: TL('readme.section.tec'),
      description: TL('readme.hint'),
      content: D.Containers.Div({ attrs: { class: tw`space-y-4` } }, [content])
    });
  }

  function ReadmeCompBase(db) {
    const { TL, lang } = makeLangLookup(db);
    const docs = db.data.docs || {};
    const fallbackLang = lang === 'ar' ? 'en' : 'ar';
    const pack = docs[lang] || {};
    const fallbackPack = docs[fallbackLang] || {};
    const baseDoc = (pack.base && pack.base.trim()) || (fallbackPack.base && fallbackPack.base.trim()) || '';

    const content = baseDoc
      ? UI.Markdown({ content: baseDoc, className: tw`prose max-w-none` })
      : UI.EmptyState({ icon: '📄', title: TL('readme.section.base'), message: TL('readme.hint') });

    return UI.Card({
      title: TL('readme.section.base'),
      description: TL('readme.hint'),
      content: D.Containers.Div({ attrs: { class: tw`space-y-4` } }, [content])
    });
  }
  IndexApp.registry = {
    HeaderComp,
    FooterComp,
    TeamComp,
    FrameworkGoalsComp,
    UIShowcaseComp,
    UtilsShowcaseComp,
    SDKShowcaseComp,
    PosShowcaseComp,
    KdsShowcaseComp,
    CounterComp,
    SequenceGameComp,
    ProverbsGameComp,
    ReadmeCompTec,
    ReadmeCompBase,
    ThemeLabPanel
  };

  IndexApp.pageClasses = [
    {
      key: 'about',
      parent: null,
      sort: 1,
      icon: '🌟',
      label: { ar: 'عن مشكاة', en: 'About Mishkah' },
      desc: { ar: 'رؤية الإطار وفريقه.', en: 'Framework vision and team.' }
    },
    {
      key: 'about.docs',
      parent: 'about',
      sort: 1,
      icon: '📚',
      label: { ar: 'الوثائق', en: 'Documentation' },
      desc: { ar: 'الوثيقة التقنية والوثيقة الأساسية.', en: 'Technical and foundational documentation.' }
    },
    {
      key: 'about.team',
      parent: 'about',
      sort: 2,
      icon: '🤝',
      label: { ar: 'فريق العمل', en: 'Team' },
      desc: { ar: 'تعرف على أدوار البنائين.', en: 'Meet the builders behind Mishkah.' }
    },
    {
      key: 'about.goals',
      parent: 'about',
      sort: 3,
      icon: '🎯',
      label: { ar: 'الأهداف', en: 'Goals' },
      desc: { ar: 'غايات الإطار وفلسفته.', en: 'Framework goals and philosophy.' }
    },
    {
      key: 'sdk',
      parent: null,
      sort: 2,
      icon: '🧰',
      label: { ar: 'دليل SDK', en: 'SDK Guide' },
      desc: { ar: 'طبقة Pages.create ومبدل القوالب.', en: 'Pages.create layer with template switcher.' }
    },
    {
      key: 'ui',
      parent: null,
      sort: 3,
      icon: '🎨',
      label: { ar: 'الواجهة', en: 'UI' },
      desc: { ar: 'مكتبة المكونات وأنماط التخصص.', en: 'Component library and specialised patterns.' }
    },
    {
      key: 'ui.core',
      parent: 'ui',
      sort: 1,
      icon: '🧩',
      label: { ar: 'المكونات الأساسية', en: 'Core components' },
      desc: { ar: 'الأزرار، البطاقات، والتبويبات.', en: 'Buttons, cards, tabs.' }
    },
    {
      key: 'ui.special',
      parent: 'ui',
      sort: 2,
      icon: '🏪',
      label: { ar: 'واجهات متخصصة', en: 'Specialised UIs' },
      desc: { ar: 'POS و KDS وغيرها.', en: 'POS, KDS, and beyond.' }
    },
    {
      key: 'ui.special.pos',
      parent: 'ui.special',
      sort: 1,
      icon: '🛒',
      label: { ar: 'نقاط البيع POS', en: 'POS systems' },
      desc: { ar: 'تجربة الطلب والدفع.', en: 'Ordering and checkout experience.' }
    },
    {
      key: 'ui.special.kds',
      parent: 'ui.special',
      sort: 2,
      icon: '🍳',
      label: { ar: 'لوحات المطابخ KDS', en: 'Kitchen displays' },
      desc: { ar: 'تدفق المطبخ اللحظي.', en: 'Real-time kitchen flow.' }
    },
    {
      key: 'utils',
      parent: null,
      sort: 4,
      icon: '🧮',
      label: { ar: 'الأدوات', en: 'Utilities' },
      desc: { ar: 'طبقات التخزين، الوقت، الشبكات.', en: 'Storage, time, and networking utilities.' }
    },
    {
      key: 'games',
      parent: null,
      sort: 5,
      icon: '🎮',
      label: { ar: 'ألعاب مشكاة', en: 'Mishkah games' },
      desc: { ar: 'تعلم عبر التحديات.', en: 'Learning through challenges.' }
    },
    {
      key: 'games.words',
      parent: 'games',
      sort: 1,
      icon: '🔤',
      label: { ar: 'ألعاب الكلمات', en: 'Word games' },
      desc: { ar: 'لعبة الأمثال.', en: 'Proverbs challenge.' }
    },
    {
      key: 'games.math',
      parent: 'games',
      sort: 2,
      icon: '🧮',
      label: { ar: 'ألعاب الأرقام', en: 'Number games' },
      desc: { ar: 'المتواليات الذكية.', en: 'Smart sequences.' }
    }
  ];

  IndexApp.pages = [
    {
      key: 'readme:tec',
      order: 1,
      icon: '📘',
      label: { ar: 'الوثيقة التقنية', en: 'Technical Read Me' },
      desc: { ar: 'شرح معمق لطبقات الإطار ومكوناته.', en: 'Deep dive into framework layers and components.' },
      classKey: 'about.docs',
      comp: 'ReadmeCompTec'
    },
    {
      key: 'readme:base',
      order: 2,
      icon: '📗',
      label: { ar: 'الوثيقة الأساسية', en: 'Base Read Me' },
      desc: { ar: 'روح مشكاة وأسسها التصورية.', en: 'The spirit and foundational principles of Mishkah.' },
      classKey: 'about.docs',
      comp: 'ReadmeCompBase'
    },
    {
      key: 'about:team',
      order: 3,
      icon: '🤝',
      label: { ar: 'فريق مشكاة', en: 'Mishkah Team' },
      desc: { ar: 'تعرف على المعماري، الاستراتيجي، المصمم، والمهندس.', en: 'Meet the architect, strategist, designer, and engineer.' },
      classKey: 'about.team',
      comp: 'TeamComp'
    },
    {
      key: 'about:goals',
      order: 4,
      icon: '🎯',
      label: { ar: 'أهداف الإطار', en: 'Framework Goals' },
      desc: { ar: 'لماذا بُنيت مشكاة؟ وما الذي تعد به؟', en: 'Why Mishkah exists and what it promises.' },
      classKey: 'about.goals',
      comp: 'FrameworkGoalsComp'
    },
    {
      key: 'sdk:guide',
      order: 5,
      icon: '🧰',
      label: { ar: 'دليل Pages.create', en: 'Pages.create Guide' },
      desc: { ar: 'خطوات تفعيل القوالب المتعددة من مصدر واحد.', en: 'Steps to activate multi-template experiences from one source.' },
      classKey: 'sdk',
      comp: 'SDKShowcaseComp'
    },
    {
      key: 'ui:components',
      order: 6,
      icon: '🎨',
      label: { ar: 'مكتبة الواجهة', en: 'UI Library' },
      desc: { ar: 'بطاقات وأزرار وتبويبات مضيئة قابلة للتخصيص.', en: 'Luminous cards, buttons, and tabs ready to customise.' },
      classKey: 'ui.core',
      comp: 'UIShowcaseComp'
    },
    {
      key: 'ui:pos',
      order: 7,
      icon: '🛒',
      label: { ar: 'أنماط POS', en: 'POS Patterns' },
      desc: { ar: 'واجهات نقاط البيع المتكاملة مع الطلبات.', en: 'Integrated POS experiences for rapid ordering.' },
      classKey: 'ui.special.pos',
      comp: 'PosShowcaseComp'
    },
    {
      key: 'ui:kds',
      order: 8,
      icon: '🍳',
      label: { ar: 'لوحات KDS', en: 'KDS Dashboards' },
      desc: { ar: 'منظومة المطابخ المتزامنة مع POS.', en: 'Kitchen dashboards synchronised with POS.' },
      classKey: 'ui.special.kds',
      comp: 'KdsShowcaseComp'
    },
    {
      key: 'utils:library',
      order: 9,
      icon: '🧮',
      label: { ar: 'دليل الأدوات', en: 'Utilities Guide' },
      desc: { ar: 'واجهات مشتركة للتخزين والوقت والشبكات.', en: 'Shared APIs for storage, time, and networking.' },
      classKey: 'utils',
      comp: 'UtilsShowcaseComp'
    },
    {
      key: 'counter',
      order: 10,
      icon: '🔢',
      label: { ar: 'العداد', en: 'Counter' },
      desc: { ar: 'مثال بسيط على إدارة الحالة بالأوامر.', en: 'Simple example of state management with orders.' },
      classKey: 'ui.core',
      comp: 'CounterComp'
    },
    {
      key: 'proverbs',
      order: 11,
      icon: '🎮',
      label: { ar: 'لعبة الأمثال', en: 'Proverbs Game' },
      desc: { ar: 'تعلم اللغة عبر استكشاف الحكمة.', en: 'Learn language through wisdom discovery.' },
      classKey: 'games.words',
      comp: 'ProverbsGameComp'
    },
    {
      key: 'sequence',
      order: 12,
      icon: '🧮',
      label: { ar: 'لعبة المتواليات', en: 'Sequence Game' },
      desc: { ar: 'تدريب على التحليل الرقمي والتنبؤ.', en: 'Practice numerical analysis and prediction.' },
      classKey: 'games.math',
      comp: 'SequenceGameComp'
    }
  ];

  function loadDocs() {
    const store = M.readme || {};
    const base = store.base || {};
    const tec = store.tec || {};
    const pack = (lang) => ({
      base: (base[lang] || '').trim(),
      tec: (tec[lang] || '').trim()
    });
    return {
      ar: pack('ar'),
      en: pack('en')
    };
  }

  IndexApp.buildConfig = function buildConfig() {
    const themePresets = resolveThemePresets(DEFAULT_THEME_PRESETS);
    const defaultPreset = themePresets[0] || null;
    const languageOptions = resolveLanguageOptions(DEFAULT_LANG_OPTIONS);
    const baseOverrides = defaultPreset ? cloneThemeOverrides(defaultPreset.overrides) : {};
    const defaultsForMode = getDesignLabDefaults(defaultPreset && defaultPreset.mode);
    Object.keys(defaultsForMode).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(baseOverrides, key)) {
        baseOverrides[key] = defaultsForMode[key];
      }
    });

    const pagesSorted = ensureArray(IndexApp.pages).slice().sort((a, b) => {
      const orderA = Number.isFinite(a?.order) ? a.order : 0;
      const orderB = Number.isFinite(b?.order) ? b.order : 0;
      return orderA - orderB;
    });
    const classesSorted = ensureArray(IndexApp.pageClasses).slice().sort((a, b) => {
      const orderA = Number.isFinite(a?.sort) ? a.sort : 0;
      const orderB = Number.isFinite(b?.sort) ? b.sort : 0;
      return orderA - orderB;
    });

    const classMap = {};
    pagesSorted.forEach((page) => {
      if (!page || !page.key || !page.classKey) return;
      if (!classMap[page.classKey]) {
        classMap[page.classKey] = [];
      }
      classMap[page.classKey].push(page.key);
    });

    const searchIndex = buildSearchIndex(pagesSorted, classesSorted);

    const data = {
      pages: pagesSorted,
      active: 'readme:tec',
      counter: 0,
      game: { ...INITIAL_GAME_STATE },
      sequenceGame: { ...INITIAL_SEQUENCE_STATE },
      docs: loadDocs(),
      themePresets,
      activeThemePreset: defaultPreset ? defaultPreset.key : '',
      themeOverrides: baseOverrides,
      themeLab: { enabled: false },
      languages: languageOptions,
      pageClasses: classesSorted,
      classMap,
      searchIndex,
      search: { query: '', results: [], activeIndex: -1 },
      slots: {
        header: 'HeaderComp',
        footer: 'FooterComp',
        themeLab: 'ThemeLabPanel'
      }
    };

    Object.keys(classMap).forEach((classKey) => {
      data[classKey] = classMap[classKey].slice();
    });

    return {
      template: 'PagesShell',
      title: dict['app.title'].ar,
      env: { lang: 'ar', dir: 'rtl', theme: defaultPreset && defaultPreset.mode === 'dark' ? 'dark' : 'light' },
      pages: pagesSorted,
      registry: IndexApp.registry,
      slots: { header: 'HeaderComp', footer: 'FooterComp', themeLab: 'ThemeLabPanel' },
      data,
      orders: IndexApp.orders,
      autoHeader: false,
      mount: '#app'
    };
  };

  IndexApp.buildDatabase = function buildDatabase() {
    const cfg = IndexApp.buildConfig();
    const MPages = (M && M.Pages) || {};
    if (MPages && typeof MPages.buildDB === 'function') {
      return MPages.buildDB(cfg);
    }

    const themeOverrides = ensureDict(cfg.data && cfg.data.themeOverrides);
    const fallbackTheme = cfg.env && cfg.env.theme ? cfg.env.theme : 'light';
    const lang = cfg.env && cfg.env.lang ? cfg.env.lang : 'ar';
    const dir = cfg.env && cfg.env.dir ? cfg.env.dir : (lang === 'ar' ? 'rtl' : 'ltr');

    const database = {
      head: { title: cfg.title || dict['app.title'].ar },
      env: Object.assign({ theme: fallbackTheme, lang, dir }, ensureDict(cfg.env)),
      i18n: { lang, fallback: lang === 'ar' ? 'en' : 'ar', dict },
      data: Object.assign({}, ensureDict(cfg.data), { pages: ensureArray(cfg.pages) }),
      registry: cfg.registry,
      slots: ensureDict(cfg.slots),
      ui: {
        pagesShell: {
          headerMenus: { langOpen: false, themeOpen: false, templateOpen: false },
          themeLab: {
            showButton: false,
            open: false,
            draft: cloneThemeOverrides(themeOverrides)
          }
        }
      }
    };

    database.data.slots = Object.assign({}, ensureDict(cfg.data && cfg.data.slots), ensureDict(cfg.slots));
    return database;
  };

  function withGame(state, updater) {
    const current = state.data.game || { ...INITIAL_GAME_STATE };
    const next = typeof updater === 'function' ? updater(current) : current;
    return {
      ...state,
      data: {
        ...state.data,
        game: next
      }
    };
  }

  function withSequence(state, updater) {
    const current = state.data.sequenceGame || { ...INITIAL_SEQUENCE_STATE };
    const next = typeof updater === 'function' ? updater(current) : current;
    return {
      ...state,
      data: {
        ...state.data,
        sequenceGame: next
      }
    };
  }

  function stopTimer(game) {
    if (game.intervalId) {
      try { window.clearInterval(game.intervalId); } catch (err) { /* noop */ }
    }
  }

  function startTimer(context, baseGame) {
    if (!baseGame.timerOn) return baseGame;
    const iid = window.setInterval(() => {
      const state = context.getState();
      const game = state.data.game;
      if (!game || game.status !== 'running') {
        window.clearInterval(iid);
        return;
      }
      let timeLeft = typeof game.timeLeft === 'number' ? game.timeLeft - 1 : game.timerSec - 1;
      let triesLeft = game.triesLeft;
      let status = game.status;
      let feedback = game.feedback;
      if (timeLeft <= 0) {
        triesLeft = Math.max(0, triesLeft - 1);
        if (triesLeft === 0) {
          status = 'lost';
          timeLeft = 0;
          feedback = { type: 'lose', stamp: Date.now() };
          stopTimer(game);
          window.clearInterval(iid);
        } else {
          timeLeft = game.timerSec;
          feedback = { type: 'wrong', stamp: Date.now() };
        }
      }
      context.setState((prev) => withGame(prev, () => ({
        ...game,
        timeLeft,
        triesLeft,
        status,
        feedback,
        revealSolution: status === 'won' ? true : game.revealSolution
      })));
      context.rebuild();
    }, 1000);
    return { ...baseGame, intervalId: iid };
  }

  function selectRandomProverb() {
    return PROVERBS[Math.floor(Math.random() * PROVERBS.length)];
  }

  function selectRandomSequence() {
    if (!SEQUENCE_BANK.length) return null;
    const hasRandomInt = U && U.Num && typeof U.Num.randomInt === 'function';
    const idx = hasRandomInt
      ? U.Num.randomInt(0, SEQUENCE_BANK.length - 1)
      : Math.floor(Math.random() * SEQUENCE_BANK.length);
    return SEQUENCE_BANK[idx];
  }

  IndexApp.orders = {
    'counter:inc': {
      on: ['click'],
      gkeys: ['counter:inc'],
      handler: (event, context) => {
        context.setState((prev) => ({
          ...prev,
          data: { ...prev.data, counter: prev.data.counter + 1 }
        }));
        context.rebuild();
      }
    },
    'counter:dec': {
      on: ['click'],
      gkeys: ['counter:dec'],
      handler: (event, context) => {
        context.setState((prev) => ({
          ...prev,
          data: { ...prev.data, counter: prev.data.counter - 1 }
        }));
        context.rebuild();
      }
    },
    'counter:reset': {
      on: ['click'],
      gkeys: ['counter:reset'],
      handler: (event, context) => {
        context.setState((prev) => ({
          ...prev,
          data: { ...prev.data, counter: 0 }
        }));
        context.rebuild();
      }
    },
    'index:themeLab:open': {
      on: ['click'],
      gkeys: ['index:themeLab:open'],
      handler: (_event, context) => {
        context.setState((prev) => {
          const prevUi = ensureDict(prev.ui);
          const prevShell = ensureDict(prevUi.pagesShell);
          const prevThemeLab = ensureDict(prevShell.themeLab);
          if (prevThemeLab.open) return prev;
          return {
            ...prev,
            ui: Object.assign({}, prevUi, {
              pagesShell: Object.assign({}, prevShell, {
                themeLab: Object.assign({}, prevThemeLab, { open: true })
              })
            })
          };
        });
        context.rebuild();
      }
    },
    'index:themeLab:close': {
      on: ['click'],
      gkeys: ['index:themeLab:close'],
      handler: (_event, context) => {
        context.setState((prev) => {
          const prevUi = ensureDict(prev.ui);
          const prevShell = ensureDict(prevUi.pagesShell);
          const prevThemeLab = ensureDict(prevShell.themeLab);
          if (!prevThemeLab.open) return prev;
          return {
            ...prev,
            ui: Object.assign({}, prevUi, {
              pagesShell: Object.assign({}, prevShell, {
                themeLab: Object.assign({}, prevThemeLab, { open: false })
              })
            })
          };
        });
        context.rebuild();
      }
    },
    'index:themeLab:resetAll': {
      on: ['click'],
      gkeys: ['index:themeLab:resetAll'],
      handler: (_event, context) => {
        const state = context.getState();
        const preset = getActiveThemePreset(state);
        const baseOverrides = cloneThemeOverrides(preset && preset.overrides);
        const defaultsForMode = getDesignLabDefaults(preset && preset.mode);
        Object.keys(defaultsForMode).forEach((key) => {
          if (!Object.prototype.hasOwnProperty.call(baseOverrides, key)) {
            baseOverrides[key] = defaultsForMode[key];
          }
        });
        let appliedOverrides = baseOverrides;
        context.setState((prev) => {
          const prevUi = ensureDict(prev.ui);
          const prevShell = ensureDict(prevUi.pagesShell);
          const prevThemeLab = ensureDict(prevShell.themeLab);
          return {
            ...prev,
            data: Object.assign({}, prev.data || {}, { themeOverrides: baseOverrides }),
            ui: Object.assign({}, prevUi, {
              pagesShell: Object.assign({}, prevShell, {
                themeLab: Object.assign({}, prevThemeLab, {
                  draft: cloneThemeOverrides(baseOverrides)
                })
              })
            })
          };
        });
        const shell = M.templates && M.templates.PagesShell;
        if (shell && typeof shell.applyThemeOverrides === 'function') {
          shell.applyThemeOverrides(appliedOverrides || {});
        }
        context.rebuild();
      }
    },
    'index:themeLab:varUpdate': {
      on: ['input', 'change'],
      gkeys: ['index:themeLab:varUpdate'],
      handler: (event, context) => {
        const target = event.target && event.target.closest ? event.target.closest('[data-css-var]') : null;
        if (!target) return;
        const name = target.getAttribute('data-css-var');
        if (!name) return;
        const state = context.getState();
        const def = DESIGN_LAB_VAR_MAP[name] || {};
        const baseline = getThemeLabBaseline(state, name);
        const raw = typeof target.value === 'string' ? target.value : (target.getAttribute('value') || '');
        const normalized = normalizeThemeLabValue(raw, {
          type: def.type || 'text',
          unit: def.unit || '',
          defaultValue: baseline,
          min: def.min,
          max: def.max,
          step: def.step,
          prefKey: def.prefKey
        });
        let appliedOverrides = null;
        context.setState((prev) => {
          const prevData = ensureDict(prev.data);
          const prevOverrides = ensureDict(prevData.themeOverrides);
          const nextOverrides = Object.assign({}, prevOverrides, { [name]: normalized });
          const prevUi = ensureDict(prev.ui);
          const prevShell = ensureDict(prevUi.pagesShell);
          const prevThemeLab = ensureDict(prevShell.themeLab);
          const nextDraft = Object.assign({}, ensureDict(prevThemeLab.draft), { [name]: normalized });
          appliedOverrides = nextOverrides;
          return {
            ...prev,
            data: Object.assign({}, prevData, { themeOverrides: nextOverrides }),
            ui: Object.assign({}, prevUi, {
              pagesShell: Object.assign({}, prevShell, {
                themeLab: Object.assign({}, prevThemeLab, { draft: nextDraft })
              })
            })
          };
        });
        const shell = M.templates && M.templates.PagesShell;
        if (shell && typeof shell.applyThemeOverrides === 'function') {
          shell.applyThemeOverrides(appliedOverrides || {});
        }
        context.rebuild();
      }
    },
    'index:themeLab:varReset': {
      on: ['click'],
      gkeys: ['index:themeLab:varReset'],
      handler: (event, context) => {
        const btn = event.target && event.target.closest ? event.target.closest('[data-css-var]') : null;
        if (!btn) return;
        const name = btn.getAttribute('data-css-var');
        if (!name) return;
        const state = context.getState();
        const def = DESIGN_LAB_VAR_MAP[name] || {};
        const baseline = getThemeLabBaseline(state, name);
        const normalized = normalizeThemeLabValue(baseline, {
          type: def.type || 'text',
          unit: def.unit || '',
          defaultValue: baseline,
          min: def.min,
          max: def.max,
          step: def.step,
          prefKey: def.prefKey
        });
        let appliedOverrides = null;
        context.setState((prev) => {
          const prevData = ensureDict(prev.data);
          const prevOverrides = ensureDict(prevData.themeOverrides);
          const nextOverrides = Object.assign({}, prevOverrides, { [name]: normalized });
          const prevUi = ensureDict(prev.ui);
          const prevShell = ensureDict(prevUi.pagesShell);
          const prevThemeLab = ensureDict(prevShell.themeLab);
          const nextDraft = Object.assign({}, ensureDict(prevThemeLab.draft), { [name]: normalized });
          appliedOverrides = nextOverrides;
          return {
            ...prev,
            data: Object.assign({}, prevData, { themeOverrides: nextOverrides }),
            ui: Object.assign({}, prevUi, {
              pagesShell: Object.assign({}, prevShell, {
                themeLab: Object.assign({}, prevThemeLab, { draft: nextDraft })
              })
            })
          };
        });
        const shell = M.templates && M.templates.PagesShell;
        if (shell && typeof shell.applyThemeOverrides === 'function') {
          shell.applyThemeOverrides(appliedOverrides || {});
        }
        context.rebuild();
      }
    },
    'sequence:start': {
      on: ['click'],
      gkeys: ['sequence:start'],
      handler: (event, context) => {
        const sequence = selectRandomSequence();
        if (!sequence) return;
        context.setState((prev) => withSequence(prev, () => ({
          ...INITIAL_SEQUENCE_STATE,
          sequence,
          status: 'running',
          triesLeft: INITIAL_SEQUENCE_STATE.triesMax,
          feedback: null,
          history: []
        })));
        context.rebuild();
      }
    },
    'sequence:update': {
      on: ['input'],
      gkeys: ['sequence:update'],
      handler: (event, context) => {
        const field = event.target.closest ? event.target.closest('[data-field]') : event.target;
        if (!field || field.getAttribute('data-field') !== 'guess') return;
        const value = typeof field.value === 'string' ? field.value : '';
        context.setState((prev) => withSequence(prev, (seq) => ({
          ...seq,
          guess: value
        })));
        context.rebuild();
      }
    },
    'sequence:submit': {
      on: ['click'],
      gkeys: ['sequence:submit'],
      handler: (event, context) => {
        const state = context.getState();
        const seqGame = state.data.sequenceGame;
        if (!seqGame || seqGame.status !== 'running' || !seqGame.sequence) return;
        const rawGuess = typeof seqGame.guess === 'string' ? seqGame.guess : '';
        const trimmed = rawGuess.trim();
        if (!trimmed) return;
        const guessNumber = Number(trimmed);
        const isCorrect = Number.isFinite(guessNumber) && guessNumber === seqGame.sequence.answer;
        let triesLeft = typeof seqGame.triesLeft === 'number' ? seqGame.triesLeft : seqGame.triesMax;
        let status = seqGame.status;
        let reveal = seqGame.reveal;
        let result = 'wrong';
        if (isCorrect) {
          status = 'won';
          reveal = true;
          result = 'correct';
        } else {
          triesLeft = Math.max(0, triesLeft - 1);
          if (triesLeft === 0) {
            status = 'lost';
            reveal = true;
          }
        }
        const history = Array.isArray(seqGame.history) ? seqGame.history.slice() : [];
        history.push({ guess: trimmed, result });
        let feedbackType = result;
        if (status === 'won') feedbackType = 'win';
        if (status === 'lost') feedbackType = 'lose';
        context.setState((prev) => withSequence(prev, () => ({
          ...seqGame,
          status,
          triesLeft,
          guess: '',
          reveal,
          history,
          feedback: feedbackType ? { type: feedbackType, stamp: Date.now() } : null
        })));
        context.rebuild();
      }
    },
    'sequence:reveal': {
      on: ['click'],
      gkeys: ['sequence:reveal'],
      handler: (event, context) => {
        context.setState((prev) => withSequence(prev, (seq) => ({
          ...seq,
          reveal: true
        })));
        context.rebuild();
      }
    },
    'game:start': {
      on: ['click'],
      gkeys: ['game:start'],
      handler: (event, context) => {
        const state = context.getState();
        const proverb = selectRandomProverb();
        const previousGame = ensureDict(state.data && state.data.game);
        const settings = ensureGameSettings(previousGame.settings);
        const timerSec = settings.perChoiceSeconds;
        const triesMax = typeof previousGame.triesMax === 'number' ? previousGame.triesMax : INITIAL_GAME_STATE.triesMax;
        const baseGame = {
          ...INITIAL_GAME_STATE,
          proverb,
          status: 'running',
          guessed: {},
          triesMax,
          triesLeft: triesMax,
          timerOn: previousGame.timerOn != null ? previousGame.timerOn : INITIAL_GAME_STATE.timerOn,
          timerSec,
          timeLeft: timerSec,
          intervalId: null,
          revealSolution: false,
          feedback: null,
          musicOn: previousGame.musicOn != null ? previousGame.musicOn : INITIAL_GAME_STATE.musicOn,
          audioIdx: typeof previousGame.audioIdx === 'number' ? previousGame.audioIdx : INITIAL_GAME_STATE.audioIdx,
          audioList: Array.isArray(previousGame.audioList) && previousGame.audioList.length ? previousGame.audioList : MUSIC_TRACKS,
          settings,
          soundStamp: Date.now()
        };
        stopTimer(previousGame);
        const withTimer = startTimer(context, baseGame);
        context.setState((prev) => withGame(prev, () => withTimer));
        context.rebuild();
      }
    },
    'game:guess': {
      on: ['click'],
      gkeys: ['game:guess'],
      handler: (event, context) => {
        const btn = event.target.closest && event.target.closest('[data-ch]');
        if (!btn) return;
        const letter = btn.getAttribute('data-ch');
        if (!letter) return;
        const state = context.getState();
        const game = state.data.game;
        if (!game || game.status !== 'running' || !game.proverb) return;
        const guessed = { ...game.guessed, [letter]: true };
        const target = game.proverb.t;
        const hasLetter = target.split('').some((raw) => norm(raw) === letter);
        let triesLeft = game.triesLeft;
        let status = game.status;
        if (!hasLetter) {
          triesLeft = Math.max(0, triesLeft - 1);
          if (triesLeft === 0) {
            status = 'lost';
            stopTimer(game);
          }
        } else {
          const letters = new Set(target.split('').map(norm).filter((ch) => ch.trim() !== ''));
          const all = Array.from(letters).every((key) => guessed[key]);
          if (all) {
            status = 'won';
            stopTimer(game);
          }
        }
        const settings = ensureGameSettings(game.settings);
        const timerCap = settings.perChoiceSeconds;
        let nextTimeLeft = typeof game.timeLeft === 'number' ? game.timeLeft : timerCap;
        let feedbackType = hasLetter ? 'correct' : 'wrong';
        if (status === 'won') feedbackType = 'win';
        if (status === 'lost') feedbackType = 'lose';
        if (hasLetter && status === 'running' && game.timerOn) {
          const bonus = clampNumber(settings.bonusSeconds, GAME_SETTING_LIMITS.bonusMin, GAME_SETTING_LIMITS.bonusMax);
          if (bonus > 0) {
            nextTimeLeft = Math.min(timerCap, nextTimeLeft + bonus);
          }
        }
        if (!game.timerOn) {
          nextTimeLeft = timerCap;
        } else if (status === 'lost') {
          nextTimeLeft = 0;
        } else if (status !== 'running') {
          nextTimeLeft = Math.min(timerCap, nextTimeLeft);
        } else {
          nextTimeLeft = Math.min(timerCap, Math.max(0, nextTimeLeft));
        }
        const feedback = feedbackType ? { type: feedbackType, stamp: Date.now() } : null;
        context.setState((prev) => withGame(prev, () => ({
          ...game,
          guessed,
          triesLeft,
          status,
          timerSec: timerCap,
          settings,
          timeLeft: game.timerOn ? nextTimeLeft : timerCap,
          revealSolution: status === 'won' ? true : game.revealSolution,
          feedback
        })));
        context.rebuild();
      }
    },
    'game:reveal': {
      on: ['click'],
      gkeys: ['game:reveal'],
      handler: (event, context) => {
        context.setState((prev) => withGame(prev, (game) => ({
          ...game,
          revealSolution: true
        })));
        context.rebuild();
      }
    },
    'game:settings:update': {
      on: ['input', 'change'],
      gkeys: ['game:settings:update'],
      handler: (event, context) => {
        const control = event.target.closest ? event.target.closest('[data-game-setting]') : event.target;
        if (!control) return;
        const key = control.getAttribute('data-game-setting');
        if (!key) return;
        const value = Number(control.value);
        if (!Number.isFinite(value)) return;
        context.setState((prev) => withGame(prev, (game) => {
          const currentSettings = ensureGameSettings(game.settings);
          const nextSettings = { ...currentSettings };
          if (key === 'perChoiceSeconds') {
            nextSettings.perChoiceSeconds = clampNumber(value, GAME_SETTING_LIMITS.perChoiceMin, GAME_SETTING_LIMITS.perChoiceMax);
          } else if (key === 'bonusSeconds') {
            nextSettings.bonusSeconds = clampNumber(value, GAME_SETTING_LIMITS.bonusMin, GAME_SETTING_LIMITS.bonusMax);
          } else {
            return game;
          }
          const normalizedSettings = ensureGameSettings(nextSettings);
          const nextTimerSec = normalizedSettings.perChoiceSeconds;
          let nextTimeLeft = typeof game.timeLeft === 'number' ? game.timeLeft : game.timerSec;
          if (game.status === 'running' && game.timerOn) {
            nextTimeLeft = Math.min(nextTimerSec, Math.max(0, nextTimeLeft));
          } else {
            nextTimeLeft = nextTimerSec;
          }
          return {
            ...game,
            settings: normalizedSettings,
            timerSec: nextTimerSec,
            timeLeft: game.timerOn ? nextTimeLeft : nextTimerSec
          };
        }));
        context.rebuild();
      }
    },
    'ui:lang:select': {
      on: ['change', 'click'],
      gkeys: ['ui:lang:select'],
      handler: (event, context) => {
        const select = event.target.closest && event.target.closest('[data-lang-select]');
        if (!select) return;
        const lang = select.value || select.getAttribute('data-lang-value');
        if (!lang) return;
        const dir = lang === 'ar' ? 'rtl' : 'ltr';
        context.setState((prev) => {
          const prevUi = ensureDict(prev.ui);
          const prevShell = ensureDict(prevUi.pagesShell);
          const prevMenus = ensureDict(prevShell.headerMenus);
          return {
            ...prev,
            env: {
              ...prev.env,
              lang,
              dir
            },
            i18n: {
              ...prev.i18n,
              lang
            },
            ui: Object.assign({}, prevUi, {
              pagesShell: Object.assign({}, prevShell, {
                headerMenus: Object.assign({}, prevMenus, { langOpen: false, themeOpen: false, templateOpen: false })
              })
            })
          };
        });
        setDir(dir);
        context.rebuild();
      }
    },
    'ui:theme:select': {
      on: ['change', 'click'],
      gkeys: ['ui:theme:select'],
      handler: (event, context) => {
        const select = event.target.closest && event.target.closest('[data-theme-select]');
        if (!select) return;
        const key = select.value || select.getAttribute('data-theme-value');
        const state = context.getState();
        const presets = resolveThemePresets(state.data && state.data.themePresets);
        const fallback = presets[0];
        const selected = presets.find((preset) => preset.key === key) || fallback;
        if (!selected) return;
        const overrides = cloneThemeOverrides(selected.overrides);
        const nextTheme = selected.mode === 'dark' ? 'dark' : 'light';
        context.setState((prev) => {
          const prevUi = ensureDict(prev.ui);
          const prevShell = ensureDict(prevUi.pagesShell);
          const prevThemeLab = ensureDict(prevShell.themeLab);
          const prevMenus = ensureDict(prevShell.headerMenus);
          return {
            ...prev,
            env: {
              ...prev.env,
              theme: nextTheme
            },
            data: {
              ...(prev.data || {}),
              themePresets: presets,
              activeThemePreset: selected.key,
              themeOverrides: overrides
            },
            ui: Object.assign({}, prevUi, {
              pagesShell: Object.assign({}, prevShell, {
                headerMenus: Object.assign({}, prevMenus, { langOpen: false, themeOpen: false, templateOpen: false }),
                themeLab: Object.assign({}, prevThemeLab, {
                  draft: Object.assign({}, overrides)
                })
              })
            })
          };
        });
        setTheme(nextTheme);
        context.rebuild();
      }
    },
    'ui:header:menuToggle': {
      on: ['click'],
      gkeys: ['ui:header:menuToggle'],
      handler: (event, context) => {
        const toggle = event.target.closest ? event.target.closest('[data-menu-toggle]') : event.target;
        if (!toggle) return;
        const target = toggle.getAttribute('data-menu-toggle');
        if (!target) return;
        context.setState((prev) => {
          const prevUi = ensureDict(prev.ui);
          const prevShell = ensureDict(prevUi.pagesShell);
          const prevMenus = ensureDict(prevShell.headerMenus);
          const nextMenus = Object.assign({}, prevMenus, {
            langOpen: target === 'lang' ? !prevMenus.langOpen : false,
            themeOpen: target === 'theme' ? !prevMenus.themeOpen : false,
            templateOpen: target === 'template' ? !prevMenus.templateOpen : false
          });
          if (target === 'lang') {
            nextMenus.themeOpen = false;
            nextMenus.templateOpen = false;
          }
          if (target === 'theme') {
            nextMenus.langOpen = false;
            nextMenus.templateOpen = false;
          }
          if (target === 'template') {
            nextMenus.langOpen = false;
            nextMenus.themeOpen = false;
          }
          return {
            ...prev,
            ui: Object.assign({}, prevUi, {
              pagesShell: Object.assign({}, prevShell, {
                headerMenus: nextMenus
              })
            })
          };
        });
        context.rebuild();
      }
    },
    'ui:header:menuClose': {
      on: ['click'],
      gkeys: ['ui:header:menuClose'],
      handler: (event, context) => {
        const control = event.target.closest ? event.target.closest('[data-menu-close],[data-menu-overlay]') : event.target;
        if (!control) return;
        const scope = control.getAttribute('data-menu-close') || 'all';
        let changed = false;
        context.setState((prev) => {
          const prevUi = ensureDict(prev.ui);
          const prevShell = ensureDict(prevUi.pagesShell);
          const prevMenus = ensureDict(prevShell.headerMenus);
          const nextMenus = Object.assign({}, prevMenus);
          if (scope === 'lang' || scope === 'all') {
            if (nextMenus.langOpen) changed = true;
            nextMenus.langOpen = false;
          }
          if (scope === 'theme' || scope === 'all') {
            if (nextMenus.themeOpen) changed = true;
            nextMenus.themeOpen = false;
          }
          if (scope === 'template' || scope === 'all') {
            if (nextMenus.templateOpen) changed = true;
            nextMenus.templateOpen = false;
          }
          if (!changed) return prev;
          return {
            ...prev,
            ui: Object.assign({}, prevUi, {
              pagesShell: Object.assign({}, prevShell, {
                headerMenus: nextMenus
              })
            })
          };
        });
        if (changed) context.rebuild();
      }
    },
    'ui:header:menuMaybeClose': {
      on: ['click'],
      gkeys: ['ui:header:menuMaybeClose'],
      handler: (event, context) => {
        const target = event.target;
        if (!target) return;
        if (target.closest('[data-menu-panel]')) return;
        if (target.closest('[data-menu-toggle]')) return;
        if (target.closest('[data-menu-overlay]')) return;
        if (target.closest('[data-menu-close]')) return;
        const state = context.getState();
        const prevUi = ensureDict(state.ui);
        const prevShell = ensureDict(prevUi.pagesShell);
        const prevMenus = ensureDict(prevShell.headerMenus);
        if (!prevMenus.langOpen && !prevMenus.themeOpen && !prevMenus.templateOpen) return;
        let changed = false;
        context.setState((prev) => {
          const prevUiState = ensureDict(prev.ui);
          const prevShellState = ensureDict(prevUiState.pagesShell);
          const prevMenuState = ensureDict(prevShellState.headerMenus);
          if (!prevMenuState.langOpen && !prevMenuState.themeOpen && !prevMenuState.templateOpen) return prev;
          changed = true;
          return {
            ...prev,
            ui: Object.assign({}, prevUiState, {
              pagesShell: Object.assign({}, prevShellState, {
                headerMenus: Object.assign({}, prevMenuState, { langOpen: false, themeOpen: false, templateOpen: false })
              })
            })
          };
        });
        if (changed) context.rebuild();
      }
    },
    'index:search:update': {
      on: ['input', 'change'],
      gkeys: ['index:search:update'],
      handler: (event, context) => {
        const field = event.target.closest ? event.target.closest('[data-search-field]') : event.target;
        if (!field) return;
        const query = typeof field.value === 'string' ? field.value : '';
        context.setState((prev) => {
          const prevData = ensureDict(prev.data);
          const prevSearch = ensureDict(prevData.search);
          const index = ensureArray(prevData.searchIndex);
          const results = runSearch(index, query);
          return {
            ...prev,
            data: Object.assign({}, prevData, {
              search: Object.assign({}, prevSearch, {
                query,
                results,
                activeIndex: results.length ? 0 : -1
              })
            })
          };
        });
        context.rebuild();
      }
    },
    'index:search:clear': {
      on: ['click'],
      gkeys: ['index:search:clear'],
      handler: (_event, context) => {
        context.setState((prev) => {
          const prevData = ensureDict(prev.data);
          const prevSearch = ensureDict(prevData.search);
          if (!prevSearch.query && !ensureArray(prevSearch.results).length) return prev;
          return {
            ...prev,
            data: Object.assign({}, prevData, {
              search: Object.assign({}, prevSearch, { query: '', results: [], activeIndex: -1 })
            })
          };
        });
        context.rebuild();
      }
    },
    'index:search:pick': {
      on: ['click'],
      gkeys: ['index:search:pick'],
      handler: (event, context) => {
        const target = event.target.closest ? event.target.closest('[data-search-key]') : event.target;
        if (!target) return;
        const pageKey = target.getAttribute('data-search-key');
        if (!pageKey) return;
        context.setState((prev) => {
          const prevData = ensureDict(prev.data);
          const prevSearch = ensureDict(prevData.search);
          return {
            ...prev,
            data: Object.assign({}, prevData, {
              active: pageKey,
              search: Object.assign({}, prevSearch, { query: '', results: [], activeIndex: -1 })
            })
          };
        });
        context.rebuild();
      }
    },
    'index:class:activate': {
      on: ['click'],
      gkeys: ['index:class:activate'],
      handler: (event, context) => {
        const trigger = event.target.closest ? event.target.closest('[data-class-key]') : event.target;
        if (!trigger) return;
        const classKey = trigger.getAttribute('data-class-key');
        const fallbackPage = trigger.getAttribute('data-class-first');
        context.setState((prev) => {
          const prevData = ensureDict(prev.data);
          const map = ensureDict(prevData.classMap);
          const list = ensureArray(map[classKey]);
          const nextActive = fallbackPage || list[0] || prevData.active;
          if (!nextActive || nextActive === prevData.active) return prev;
          return {
            ...prev,
            data: Object.assign({}, prevData, { active: nextActive })
          };
        });
        context.rebuild();
      }
    }
  };

  IndexApp.makeLangLookup = makeLangLookup;

})(typeof window !== 'undefined' ? window : this);

