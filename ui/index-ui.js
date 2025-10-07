(function (window) {
  'use strict';

  const M = window.Mishkah = window.Mishkah || {};
  const Apps = M.apps = M.apps || {};
  const IndexApp = Apps.index = Apps.index || {};

  const D = M.DSL;
  const UI = M.UI;
  const U = M.utils;
  const { tw, cx } = U.twcss;

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
    'footer.text': { ar: 'مشكاة — بناء التطبيقات بنور منظم.', en: 'Mishkah — build luminous applications with order.' }
  };

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

  const INITIAL_GAME_STATE = {
    proverb: null,
    guessed: {},
    triesMax: 5,
    triesLeft: 5,
    status: 'idle',
    timerOn: true,
    timerSec: 35,
    timeLeft: 35,
    intervalId: null,
    revealSolution: false,
    feedback: null,
    musicOn: true,
    audioIdx: 0,
    audioList: MUSIC_TRACKS,
    soundStamp: 0
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

  function computeTimeLeft(game) {
    if (!game || !game.timerOn) return null;
    if (game.status === 'running') {
      const raw = typeof game.timeLeft === 'number' ? game.timeLeft : game.timerSec;
      return Math.max(0, raw);
    }
    return game.status === 'lost' ? 0 : game.timerSec;
  }

  /* ------------------------------------------------------------------ */
  /* Components                                                          */
  /* ------------------------------------------------------------------ */

  function HeaderComp(db) {
    const { TL, lang } = makeLangLookup(db);

    const langControls = ['ar', 'en'].map((code) => UI.Button({
      attrs: {
        gkey: 'ui:lang',
        'data-lang': code,
        class: cx(
          tw`rounded-full px-3 py-1 text-sm font-semibold transition`,
          lang === code
            ? tw`bg-[var(--primary)] text-[var(--primary-foreground)]`
            : tw`bg-[color-mix(in_oklab,var(--surface-1)85%,transparent)] text-[var(--foreground)] hover:bg-[color-mix(in_oklab,var(--primary)15%,transparent)]`
        )
      },
      variant: 'ghost',
      size: 'xs'
    }, [code === 'ar' ? `ع ${TL('header.lang.ar')}` : `EN ${TL('header.lang.en')}`]));

    const langGroup = D.Containers.Div({ attrs: { class: tw`flex items-center gap-2` } }, langControls);

    const themeButton = UI.Button({
      attrs: {
        gkey: 'ui:theme:toggle',
        class: tw`rounded-full px-3 py-1 text-sm font-semibold bg-[color-mix(in_oklab,var(--surface-1)85%,transparent)] hover:bg-[color-mix(in_oklab,var(--primary)15%,transparent)]`
      },
      variant: 'ghost',
      size: 'xs'
    }, ['🌓 ', TL('header.theme.toggle')]);

    return D.Containers.Div({
      attrs: {
        class: tw`mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6`
      }
    }, [
      D.Containers.Div({
        attrs: {
          class: tw`flex flex-col gap-2`
        }
      }, [
        D.Text.H1({ attrs: { class: tw`text-3xl font-bold` } }, [TL('app.title')]),
        D.Text.P({ attrs: { class: tw`text-sm text-[var(--muted-foreground)]` } }, [TL('header.subtitle')])
      ]),
      D.Containers.Div({
        attrs: {
          class: tw`flex flex-col gap-3 md:flex-row md:items-center md:justify-end`
        }
      }, [
        D.Containers.Div({ attrs: { class: tw`flex items-center justify-start gap-2 md:justify-end` } }, [themeButton, langGroup])
      ])
    ]);
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

    return UI.Card({
      title: TL('game.title'),
      content: D.Containers.Div({ attrs: { class: tw`space-y-6` } }, [
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

    const numbersNodes = (sequence ? sequence.numbers : []).map((num, idx) => (
      D.Containers.Div({
        attrs: {
          key: `seq-${idx}`,
          class: tw`grid h-12 w-12 place-items-center rounded-2xl border border-[color-mix(in_oklab,var(--border)55%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)92%,transparent)] text-xl font-semibold`
        }
      }, [String(num)])
    ));
    numbersNodes.push(
      D.Containers.Div({
        attrs: {
          key: 'seq-next',
          class: tw`grid h-12 w-12 place-items-center rounded-2xl border border-dashed border-[color-mix(in_oklab,var(--primary)45%,transparent)] bg-[color-mix(in_oklab,var(--surface-1)90%,transparent)] text-xl font-semibold`
        }
      }, ['?'])
    );

    const board = D.Containers.Div({ attrs: { class: tw`space-y-3` } }, [
      D.Text.P({ attrs: { class: tw`text-center text-sm text-[var(--muted-foreground)]` } }, [TL('sequence.prompt')]),
      D.Containers.Div({ attrs: { class: tw`flex flex-wrap items-center justify-center gap-3` } }, numbersNodes)
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
    CounterComp,
    SequenceGameComp,
    ProverbsGameComp,
    ReadmeCompTec,
    ReadmeCompBase
  };

  IndexApp.pages = [
    { key: 'sequence', order: 1, icon: '🧮', label: { ar: 'لعبة المتواليات', en: 'Sequence Game' }, comp: 'SequenceGameComp' },
    { key: 'proverbs', order: 2, icon: '🎮', label: { ar: 'لعبة الأمثال', en: 'Proverbs' }, comp: 'ProverbsGameComp' },
    { key: 'counter', order: 3, icon: '🔢', label: { ar: 'العداد', en: 'Counter' }, comp: 'CounterComp' },
    { key: 'readme:tec', order: 4, icon: '📘', label: { ar: 'الوثيقة التقنية', en: 'Technical Read Me' }, comp: 'ReadmeCompTec' },
    { key: 'readme:base', order: 5, icon: '📗', label: { ar: 'الوثيقة الأساسية', en: 'Base Read Me' }, comp: 'ReadmeCompBase' }

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

  IndexApp.buildDatabase = function buildDatabase() {
    return {
      head: { title: dict['app.title'].ar },
      env: { theme: 'dark', lang: 'ar', dir: 'rtl' },
      i18n: { lang: 'ar', fallback: 'en', dict },
      data: {
        pages: IndexApp.pages,
        active: 'sequence',
        counter: 0,
        game: { ...INITIAL_GAME_STATE },
        sequenceGame: { ...INITIAL_SEQUENCE_STATE },
        docs: loadDocs(),
        slots: {
          header: 'HeaderComp',
          footer: 'FooterComp'
        }
      },
      registry: IndexApp.registry
    };
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
        const baseGame = {
          ...INITIAL_GAME_STATE,
          proverb,
          status: 'running',
          guessed: {},
          triesLeft: INITIAL_GAME_STATE.triesMax,
          timeLeft: INITIAL_GAME_STATE.timerSec,
          soundStamp: Date.now()
        };
        stopTimer(state.data.game || {});
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
        let feedbackType = hasLetter ? 'correct' : 'wrong';
        if (status === 'won') feedbackType = 'win';
        if (status === 'lost') feedbackType = 'lose';
        const feedback = feedbackType ? { type: feedbackType, stamp: Date.now() } : null;
        context.setState((prev) => withGame(prev, () => ({
          ...game,
          guessed,
          triesLeft,
          status,
          timeLeft: game.timerOn ? (status === 'lost' ? 0 : (typeof game.timeLeft === 'number' ? game.timeLeft : game.timerSec)) : 0,
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
    'ui:lang': {
      on: ['click'],
      gkeys: ['ui:lang'],
      handler: (event, context) => {
        const btn = event.target.closest && event.target.closest('[data-lang]');
        if (!btn) return;
        const lang = btn.getAttribute('data-lang');
        if (!lang) return;
        context.setState((prev) => ({
          ...prev,
          env: {
            ...prev.env,
            lang,
            dir: lang === 'ar' ? 'rtl' : 'ltr'
          },
          i18n: {
            ...prev.i18n,
            lang
          }
        }));
        context.rebuild();
      }
    },
    'ui:theme:toggle': {
      on: ['click'],
      gkeys: ['ui:theme:toggle'],
      handler: (event, context) => {
        context.setState((prev) => ({
          ...prev,
          env: {
            ...prev.env,
            theme: prev.env.theme === 'dark' ? 'light' : 'dark'
          }
        }));
        context.rebuild();
      }
    }
  };

  IndexApp.makeLangLookup = makeLangLookup;

})(typeof window !== 'undefined' ? window : this);

