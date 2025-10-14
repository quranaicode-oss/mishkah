(function (global) {
  const PLATFORM_SLUG = 'socialbnw';
  const PLATFORM_NAME = { ar: 'مسوقات الأعمال', en: 'Business Promoters Network' };
  const PLATFORM_SHORT = { ar: 'مسوقات', en: 'SocialBNW' };

  const designTokens = {
    light: {
      'background': '#f8fafc',
      'foreground': '#0f172a',
      'muted': '#e2e8f0',
      'muted-foreground': '#475569',
      'primary': '#2563eb',
      'primary-foreground': '#f8fafc',
      'secondary': '#f97316',
      'secondary-foreground': '#0f172a',
      'accent': '#14b8a6',
      'accent-foreground': '#042f2e',
      'border': '#cbd5f5',
      'card': '#ffffff',
      'card-foreground': '#0f172a'
    },
    dark: {
      'background': '#020617',
      'foreground': '#e2e8f0',
      'muted': '#1e293b',
      'muted-foreground': '#94a3b8',
      'primary': '#60a5fa',
      'primary-foreground': '#020617',
      'secondary': '#fb923c',
      'secondary-foreground': '#1f2937',
      'accent': '#34d399',
      'accent-foreground': '#022c22',
      'border': '#1e293b',
      'card': '#0f172a',
      'card-foreground': '#e2e8f0'
    }
  };

  const now = new Date();
  const iso = (minutesAgo) => new Date(now.getTime() - minutesAgo * 60000).toISOString();

  const mockData = {
    brand: {
      id: PLATFORM_SLUG,
      name: PLATFORM_NAME,
      shortName: PLATFORM_SHORT,
      tagline: {
        ar: 'شبكة تسويق اجتماعي تربط مسوقات الأعمال بخطوط إنتاج متنوعة وتجار التجزئة.',
        en: 'A social business network connecting marketers with production lines and retail partners.'
      },
      hero: {
        highlight: {
          ar: 'خطط إطلاق رقمية، تنشيط معارض، وعقود B2B تُدار من مكان واحد.',
          en: 'Digital launches, retail activations, and B2B sourcing orchestrated from one hub.'
        },
        supporting: {
          ar: 'من خلال قصص مصورة، عروض الأسعار الفورية، ولوحات متابعة الأداء يستطيع العميل رؤية الأثر مباشرة.',
          en: 'Story-driven showcases, instant quotations, and live performance dashboards keep every client aligned.'
        },
        ctaPrimary: { ar: 'ابدأ حملة جديدة', en: 'Start a campaign' },
        ctaSecondary: { ar: 'انضم كشريك', en: 'Join as partner' }
      },
      stats: [
        { id: 'marketers', value: '380+', label: { ar: 'مسوقة معتمدة', en: 'Certified marketers' } },
        { id: 'campaigns', value: '1.8K', label: { ar: 'حملة ناجحة', en: 'Campaigns launched' } },
        { id: 'roi', value: '212%', label: { ar: 'متوسط العائد', en: 'Average ROI uplift' } }
      ],
      contact: {
        email: 'partnerships@socialbnw.io',
        phone: '+966920000123'
      },
      install: {
        message: {
          ar: 'ثبّت المنصة لتصل إلى ملفات المسوقات وتقارير الأداء دون اتصال.',
          en: 'Install the app to access marketer files and live scorecards offline.'
        },
        helper: {
          ar: 'يمكنك تحديث ملفات التثبيت أو مسح التخزين المؤقت من لوحة التحكم في الأسفل.',
          en: 'Use the control center below to refresh the worker or clear cached assets.'
        }
      }
    },
    palette: designTokens,
    features: [
      {
        id: 'cross-channel',
        icon: '📊',
        title: {
          ar: 'إدارة حملات متكاملة',
          en: 'Cross-channel orchestration'
        },
        description: {
          ar: 'خطط إطلاق تتضمن الإعلانات الرقمية، المحتوى المرئي القصير، ورسائل البيع B2B في لوحة واحدة.',
          en: 'Launch plans blending paid media, snackable reels, and B2B sales kits from a single board.'
        }
      },
      {
        id: 'insights',
        icon: '📈',
        title: {
          ar: 'لوحات قياس فورية',
          en: 'Realtime performance insights'
        },
        description: {
          ar: 'مؤشرات KPIs مرتبطة بالمتجر أو خط الإنتاج مع تنبيهات لحظية عبر PWA.',
          en: 'KPI dashboards mapped to retail and production partners with instant PWA alerts.'
        }
      },
      {
        id: 'network',
        icon: '🤝',
        title: {
          ar: 'شبكة شركاء موسعة',
          en: 'Expanded partner network'
        },
        description: {
          ar: 'وصول مباشر لمصانع، مطابع، ومنصات توصيل لضمان تكامل سلسلة القيمة للحملة.',
          en: 'Direct reach to factories, printers, and logistics hubs to complete every campaign cycle.'
        }
      }
    ],
    categories: [
      {
        id: 'digital-launches',
        kind: 'service',
        icon: '🚀',
        title: { ar: 'إطلاقات رقمية', en: 'Digital Launches' },
        description: {
          ar: 'حملات إعلانات، محتوى مرئي، وتهيئة قنوات التواصل للمشاريع الجديدة.',
          en: 'Paid ads, video storytelling, and social setup for upcoming product drops.'
        },
        palette: '#2563eb',
        children: [
          { id: 'performance-ads', title: { ar: 'حملات أداء', en: 'Performance ads' } },
          { id: 'creator-stories', title: { ar: 'قصص صناع المحتوى', en: 'Creator stories' } }
        ]
      },
      {
        id: 'retail-activations',
        kind: 'product',
        icon: '🛍️',
        title: { ar: 'تنشيط تجزئة', en: 'Retail Activations' },
        description: {
          ar: 'تصميم واجهات عرض، تجارب داخل المتجر، وتغطية محتوى مباشر.',
          en: 'In-store storytelling, visual merchandising, and on-ground content coverage.'
        },
        palette: '#f97316',
        children: [
          { id: 'pop-up', title: { ar: 'معارض منبثقة', en: 'Pop-up shops' } },
          { id: 'visual-merch', title: { ar: 'تصميم واجهات', en: 'Visual merchandising' } }
        ]
      },
      {
        id: 'industrial-b2b',
        kind: 'service',
        icon: '🏭',
        title: { ar: 'شراكات صناعية', en: 'Industrial Partnerships' },
        description: {
          ar: 'ربط خطوط الإنتاج بالموزعين عبر حملات B2B موثقة وقصص نجاح.',
          en: 'Link production lines with distributors through proof-based B2B campaigns.'
        },
        palette: '#14b8a6',
        children: [
          { id: 'trade-missions', title: { ar: 'بعثات تجارية', en: 'Trade missions' } },
          { id: 'technical-demos', title: { ar: 'عروض تقنية', en: 'Technical demos' } }
        ]
      }
    ],
    creators: [
      {
        id: 'creator-sara',
        userId: 'user-sara',
        displayName: { ar: 'سارة النعيم', en: 'Sara AlNaeem' },
        username: 'saralaunchlab',
        phone: '+966500111222',
        rating: 4.94,
        city: { ar: 'الرياض', en: 'Riyadh' },
        headline: {
          ar: 'تقود استديو إطلاقات رقمية للشركات التقنية سريعة النمو.',
          en: 'Runs a digital launch studio for fast-scaling tech ventures.'
        },
        badges: ['verified', 'growth'],
        social: {
          instagram: 'https://www.instagram.com/',
          linkedin: 'https://www.linkedin.com/',
          whatsapp: 'https://wa.me/966500111222'
        },
        highlights: {
          services: ['service-digital-blueprint', 'service-performance-ads'],
          products: ['product-launch-playbook']
        }
      },
      {
        id: 'creator-maya',
        userId: 'user-maya',
        displayName: { ar: 'مايا الخباز', en: 'Maya AlKhabbaz' },
        username: 'mayaretailstudio',
        phone: '+966540777333',
        rating: 4.88,
        city: { ar: 'جدة', en: 'Jeddah' },
        headline: {
          ar: 'تصمم تجارب بيع بالتجزئة مدعومة بالمحتوى المرئي المباشر.',
          en: 'Designs content-rich retail activations for lifestyle brands.'
        },
        badges: ['verified', 'retail-pro'],
        social: {
          instagram: 'https://www.instagram.com/',
          behance: 'https://www.behance.net/',
          whatsapp: 'https://wa.me/966540777333'
        },
        highlights: {
          services: ['service-retail-experience'],
          products: ['product-activation-kit', 'product-visual-kit']
        }
      },
      {
        id: 'creator-lina',
        userId: 'user-lina',
        displayName: { ar: 'لينا الكيلاني', en: 'Lina AlKeilani' },
        username: 'linab2b',
        phone: '+971505554321',
        rating: 4.97,
        city: { ar: 'دبي', en: 'Dubai' },
        headline: {
          ar: 'تبني عروض قيمة صناعية مدعومة بأدلة أداء ومحتوى توثيقي.',
          en: 'Crafts industrial value propositions backed by data storytelling.'
        },
        badges: ['verified', 'b2b'],
        social: {
          linkedin: 'https://www.linkedin.com/',
          youtube: 'https://www.youtube.com/',
          whatsapp: 'https://wa.me/971505554321'
        },
        highlights: {
          services: ['service-b2b-roadmap', 'service-trade-mission'],
          products: ['product-industrial-dossier']
        }
      }
    ],
    profiles: [
      {
        creatorId: 'creator-sara',
        coverImage: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80',
        about: {
          ar: 'تؤمن سارة بأن إطلاق المنتج رحلة تراكمية تبدأ من الإنصات للعميل وتنتهي بمنظومة محتوى متكاملة تديرها أدوات ذكية.',
          en: 'Sara treats every launch as a cumulative journey from listening tours to automated content ecosystems.'
        },
        specialties: [
          { ar: 'خرائط رحلة العميل', en: 'Customer journey maps' },
          { ar: 'محتوى تسويقي قصير', en: 'Short-form marketing content' },
          { ar: 'متابعة أداء لحظية', en: 'Realtime performance follow-up' }
        ],
        metrics: [
          { id: 'avg-cpa', value: '18.4 SAR', label: { ar: 'متوسط تكلفة الاكتساب', en: 'Average CPA' } },
          { id: 'launch-speed', value: '14 يوم', label: { ar: 'سرعة الإطلاق', en: 'Launch speed' } }
        ],
        testimonials: [
          {
            client: { ar: 'منصة سداد الرقمية', en: 'Sdad Digital' },
            quote: {
              ar: 'تم تحويل موادنا إلى قصص مرئية تفاعلية رفعت التحويلات بنسبة 230%.',
              en: 'Our assets became interactive stories that lifted conversions by 230%.'
            }
          }
        ],
        portfolio: [
          {
            title: { ar: 'حملة تطبيق مصرفي', en: 'Banking app launch' },
            media: 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=1400&q=80'
          },
          {
            title: { ar: 'مركز إعلامي للمستثمرين', en: 'Investor media center' },
            media: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=1400&q=80'
          }
        ]
      },
      {
        creatorId: 'creator-maya',
        coverImage: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=1600&q=80',
        about: {
          ar: 'مايا تحول المساحات الفارغة إلى مسرح قصصي يُحفز الشراء ويخلق محتوى اجتماعي لحظي.',
          en: 'Maya transforms retail spaces into narrative stages that drive purchases and live social content.'
        },
        specialties: [
          { ar: 'تصميم واجهات عرض', en: 'Window design' },
          { ar: 'إدارة الإنتاج الميداني', en: 'On-ground production' },
          { ar: 'بث مباشر للمتجر', en: 'In-store live streaming' }
        ],
        metrics: [
          { id: 'footfall', value: '+48%', label: { ar: 'زيادة زيارات الفروع', en: 'Footfall uplift' } },
          { id: 'sell-through', value: '62%', label: { ar: 'نسبة تصريف المخزون', en: 'Sell-through rate' } }
        ],
        testimonials: [
          {
            client: { ar: 'علامة نمط حياة محلية', en: 'Local lifestyle label' },
            quote: {
              ar: 'التجربة التفاعلية داخل المتجر صنعت محتوى عضوي تخطى 2.4 مليون مشاهدة.',
              en: 'Her in-store experience created organic content exceeding 2.4M views.'
            }
          }
        ],
        portfolio: [
          {
            title: { ar: 'متجر موسمي منبثق', en: 'Seasonal pop-up' },
            media: 'https://images.unsplash.com/photo-1525182008055-f88b95ff7980?auto=format&fit=crop&w=1400&q=80'
          },
          {
            title: { ar: 'جناح تجربة عطور', en: 'Fragrance experience booth' },
            media: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80'
          }
        ]
      },
      {
        creatorId: 'creator-lina',
        coverImage: 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=1600&q=80',
        about: {
          ar: 'لينا تبني جسورًا بين المصانع والموزعين عبر محتوى وثائقي ولقاءات مورّدين مدروسة.',
          en: 'Lina builds bridges between factories and distributors using documentary content and curated sourcing meets.'
        },
        specialties: [
          { ar: 'حملات B2B موثقة', en: 'Documented B2B campaigns' },
          { ar: 'جولات داخل خطوط الإنتاج', en: 'Factory walk-throughs' },
          { ar: 'عقود توريد مهيكلة', en: 'Structured supply contracts' }
        ],
        metrics: [
          { id: 'pipeline', value: '24 صفقة', label: { ar: 'صفقات في خط الأنابيب', en: 'Deals in pipeline' } },
          { id: 'conversion', value: '37%', label: { ar: 'تحويل من الاجتماعات', en: 'Meeting conversion' } }
        ],
        testimonials: [
          {
            client: { ar: 'مصنع ألمنيوم خليجي', en: 'Gulf aluminium plant' },
            quote: {
              ar: 'وثائقي سلسلة الإنتاج أقنع ثلاثة موزعين كبار بالتوقيع خلال أسبوع.',
              en: 'The production documentary convinced three major distributors within a week.'
            }
          }
        ],
        portfolio: [
          {
            title: { ar: 'رحلة إنتاج الألمنيوم', en: 'Aluminium production journey' },
            media: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80'
          },
          {
            title: { ar: 'دليل مشتري للمقاولات', en: 'Contractor buyer guide' },
            media: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1400&q=80'
          }
        ]
      }
    ],
    services: [
      {
        id: 'service-digital-blueprint',
        creatorId: 'creator-sara',
        categoryId: 'digital-launches',
        title: { ar: 'خريطة إطلاق رقمية', en: 'Digital launch blueprint' },
        summary: {
          ar: 'تحليل السوق، شخصيات العملاء، وخطة محتوى من 90 قطعة خلال أول 6 أسابيع.',
          en: 'Market analysis, buyer personas, and a 90-asset content plan for the first six weeks.'
        },
        packages: [
          {
            id: 'starter',
            title: { ar: 'باقة مبتدئة', en: 'Starter' },
            price: 7800,
            currency: 'SAR',
            perks: [
              { ar: 'تحليل بحثي سريع', en: 'Express research study' },
              { ar: '20 قطعة محتوى قصيرة', en: '20 short-form assets' }
            ]
          },
          {
            id: 'scale',
            title: { ar: 'باقة النمو', en: 'Scale' },
            price: 14200,
            currency: 'SAR',
            perks: [
              { ar: 'استراتيجية قنوات متكاملة', en: 'Full funnel strategy' },
              { ar: 'لوحة قياس لحظية', en: 'Realtime dashboard' }
            ]
          }
        ],
        media: [
          {
            type: 'image',
            url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1400&q=80',
            aspectRatio: '4:3'
          }
        ]
      },
      {
        id: 'service-performance-ads',
        creatorId: 'creator-sara',
        categoryId: 'digital-launches',
        title: { ar: 'إدارة إعلانات أداء', en: 'Performance ads management' },
        summary: {
          ar: 'إعداد الحملات، تتبع التحويلات، وتحديث المحتوى اليومي.',
          en: 'Campaign setup, conversion tracking, and daily creative refreshes.'
        },
        packages: [
          {
            id: 'retainer',
            title: { ar: 'إدارة مستمرة', en: 'Ongoing retainer' },
            price: 6200,
            currency: 'SAR'
          }
        ],
        media: [
          {
            type: 'image',
            url: 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1400&q=80',
            aspectRatio: '16:9'
          }
        ]
      },
      {
        id: 'service-retail-experience',
        creatorId: 'creator-maya',
        categoryId: 'retail-activations',
        title: { ar: 'تجربة تجزئة متكاملة', en: 'Integrated retail experience' },
        summary: {
          ar: 'تصميم مخطط المعرض، إنتاج المكونات، وجدولة فريق المحتوى الميداني.',
          en: 'Design the activation map, produce fixtures, and orchestrate on-site content crews.'
        },
        packages: [
          {
            id: 'boutique',
            title: { ar: 'بوتيك', en: 'Boutique' },
            price: 9600,
            currency: 'SAR'
          },
          {
            id: 'flagship',
            title: { ar: 'متجر رئيسي', en: 'Flagship' },
            price: 18400,
            currency: 'SAR'
          }
        ],
        media: [
          {
            type: 'image',
            url: 'https://images.unsplash.com/photo-1524580470433-87f3f2d19d8f?auto=format&fit=crop&w=1400&q=80',
            aspectRatio: '3:4'
          }
        ]
      },
      {
        id: 'service-b2b-roadmap',
        creatorId: 'creator-lina',
        categoryId: 'industrial-b2b',
        title: { ar: 'خارطة طريق B2B', en: 'B2B go-to-market roadmap' },
        summary: {
          ar: 'تحليل سلسلة القيمة، عروض الشرائح، وجلسات توجيه للمبيعات التقنية.',
          en: 'Value chain analysis, pitch decks, and technical sales coaching sessions.'
        },
        packages: [
          {
            id: 'expansion',
            title: { ar: 'توسّع إقليمي', en: 'Regional expansion' },
            price: 21500,
            currency: 'SAR'
          }
        ],
        media: [
          {
            type: 'image',
            url: 'https://images.unsplash.com/photo-1581090700227-1e37b190418e?auto=format&fit=crop&w=1400&q=80',
            aspectRatio: '16:9'
          }
        ]
      },
      {
        id: 'service-trade-mission',
        creatorId: 'creator-lina',
        categoryId: 'industrial-b2b',
        title: { ar: 'بعثة تجارية قطاعية', en: 'Sector trade mission' },
        summary: {
          ar: 'تنسيق لقاءات الموردين، إنتاج فيديوهات توثيقية، وتسهيل اتفاقيات التوزيع.',
          en: 'Coordinating supplier meetings, documentary filming, and facilitating distribution MoUs.'
        },
        packages: [
          {
            id: 'executive',
            title: { ar: 'تنفيذي', en: 'Executive' },
            price: 32800,
            currency: 'SAR'
          }
        ],
        media: [
          {
            type: 'image',
            url: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1400&q=80',
            aspectRatio: '4:3'
          }
        ]
      }
    ],
    products: [
      {
        id: 'product-launch-playbook',
        creatorId: 'creator-sara',
        categoryId: 'digital-launches',
        title: { ar: 'دليل إطلاق SaaS', en: 'SaaS launch playbook' },
        description: {
          ar: 'قوالب بريد، لوحات جاهزة، ومكتبة محتوى لحملات الاشتراك.',
          en: 'Email cadences, ready-to-use boards, and content library for subscription funnels.'
        },
        priceRange: { min: 3200, max: 5200, currency: 'SAR' },
        media: [
          {
            type: 'image',
            url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80',
            aspectRatio: '4:3'
          }
        ]
      },
      {
        id: 'product-activation-kit',
        creatorId: 'creator-maya',
        categoryId: 'retail-activations',
        title: { ar: 'عدة تنشيط متجر', en: 'Store activation kit' },
        description: {
          ar: 'مجموعة تصميمات قابلة للتخصيص، لوحة إضاءة، ونصوص تصوير فوري.',
          en: 'Customisable fixture designs, lighting grid, and live content scripts.'
        },
        priceRange: { min: 5400, max: 9600, currency: 'SAR' },
        media: [
          {
            type: 'image',
            url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80',
            aspectRatio: '1:1'
          }
        ]
      },
      {
        id: 'product-visual-kit',
        creatorId: 'creator-maya',
        categoryId: 'retail-activations',
        title: { ar: 'مجموعة واجهات عرض', en: 'Visual merchandising kit' },
        description: {
          ar: 'ملفات ثلاثية الأبعاد، تعليمات تركيب، وقوالب محتوى للعرض المباشر.',
          en: '3D renders, installation guides, and live show content templates.'
        },
        priceRange: { min: 4100, max: 7200, currency: 'SAR' },
        media: [
          {
            type: 'image',
            url: 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=1200&q=80',
            aspectRatio: '3:2'
          }
        ]
      },
      {
        id: 'product-industrial-dossier',
        creatorId: 'creator-lina',
        categoryId: 'industrial-b2b',
        title: { ar: 'ملف صناعي موثق', en: 'Documented industrial dossier' },
        description: {
          ar: 'أوراق اعتماد تقنية، قصص نجاح، ودلائل فحص الجودة.',
          en: 'Technical credential sheets, success stories, and QA validation guides.'
        },
        priceRange: { min: 8800, max: 13800, currency: 'SAR' },
        media: [
          {
            type: 'image',
            url: 'https://images.unsplash.com/photo-1581090700227-1e37b190418e?auto=format&fit=crop&w=1200&q=80',
            aspectRatio: '16:9'
          }
        ]
      }
    ],
    posts: [
      {
        id: 'post-sara-reel',
        creatorId: 'creator-sara',
        categoryId: 'digital-launches',
        type: 'reel',
        title: { ar: 'لقطات من مختبر الإطلاق', en: 'Inside the launch lab' },
        caption: {
          ar: 'منصات الاختبار A/B الجاهزة لدينا تقلل وقت التحضير للحملات بنسبة 40٪.',
          en: 'Pre-built A/B test rigs cut campaign prep time by 40%.'
        },
        media: {
          type: 'video',
          url: 'https://assets.mixkit.co/videos/preview/mixkit-team-of-business-people-in-a-meeting-3801-large.mp4',
          poster: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80',
          aspectRatio: '9:16',
          duration: 21
        },
        tags: ['launch', 'paid-media'],
        pricing: {
          label: {
            ar: 'الباقة تبدأ من 7,800 ر.س',
            en: 'Packages from SAR 7,800'
          }
        },
        cta: { label: { ar: 'احجز جلسة تعريفية', en: 'Book a discovery call' }, link: 'https://cal.com/' },
        publishedAt: iso(90)
      },
      {
        id: 'post-maya-store',
        creatorId: 'creator-maya',
        categoryId: 'retail-activations',
        type: 'post',
        title: { ar: 'تنشيط متجر الرياض', en: 'Riyadh flagship activation' },
        caption: {
          ar: 'تجربة عطور مكونة من أربع محطات مع بث مباشر وصندوق صور ثلاثي الأبعاد.',
          en: 'Four-station fragrance journey with live streaming and a 3D photo booth.'
        },
        media: {
          type: 'image',
          url: 'https://images.unsplash.com/photo-1525182008055-f88b95ff7980?auto=format&fit=crop&w=1100&q=80',
          aspectRatio: '4:5'
        },
        tags: ['retail', 'experience'],
        pricing: {
          label: {
            ar: 'التنفيذ يبدأ من 9,600 ر.س',
            en: 'Execution from SAR 9,600'
          }
        },
        productId: 'product-activation-kit',
        publishedAt: iso(210)
      },
      {
        id: 'post-lina-case',
        creatorId: 'creator-lina',
        categoryId: 'industrial-b2b',
        type: 'post',
        title: { ar: 'جولة مصنع الألمنيوم', en: 'Aluminium plant tour' },
        caption: {
          ar: 'تغطية وثائقية بثلاث لغات مع ملف تسويق جاهز للتوزيع على الوكلاء.',
          en: 'Three-language documentary coverage with ready-to-share dealer dossier.'
        },
        media: {
          type: 'image',
          url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
          aspectRatio: '16:9'
        },
        tags: ['industrial', 'b2b'],
        pricing: {
          label: {
            ar: 'الباقات من 21,500 ر.س',
            en: 'Packages from SAR 21,500'
          }
        },
        serviceId: 'service-b2b-roadmap',
        publishedAt: iso(320)
      },
      {
        id: 'post-maya-reel',
        creatorId: 'creator-maya',
        categoryId: 'retail-activations',
        type: 'reel',
        title: { ar: 'إعادة تصميم واجهة عرض', en: 'Window refresh reel' },
        caption: {
          ar: 'إضاءة ديناميكية وتوثيق مرئي مدته 15 ثانية يضاعف نسبة التفاعل.',
          en: 'Dynamic lighting with 15s reel that doubled engagement.'
        },
        media: {
          type: 'video',
          url: 'https://assets.mixkit.co/videos/preview/mixkit-woman-working-with-graphics-tablet-840-large.mp4',
          poster: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=900&q=80',
          aspectRatio: '9:16',
          duration: 15
        },
        tags: ['visual', 'content'],
        publishedAt: iso(50)
      },
      {
        id: 'post-sara-report',
        creatorId: 'creator-sara',
        categoryId: 'digital-launches',
        type: 'post',
        title: { ar: 'تقرير أداء أسبوعي', en: 'Weekly performance snapshot' },
        caption: {
          ar: 'ملخص تفاعلي للإنفاق والعائد يرسل عبر إشعار PWA كل يوم اثنين.',
          en: 'Interactive spend vs. return summary pushed via PWA notification every Monday.'
        },
        media: {
          type: 'image',
          url: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=1200&q=80',
          aspectRatio: '4:3'
        },
        tags: ['insights', 'analytics'],
        publishedAt: iso(15)
      }
    ],
    collections: [
      {
        id: 'collection-tech',
        title: { ar: 'أدوات إطلاق التقنية', en: 'Tech launch toolkit' },
        description: {
          ar: 'باقة متكاملة لمنتجات SaaS تشمل خدمات سارة الرقمية ومواد الدعم.',
          en: 'Full-stack kit for SaaS products featuring Sara’s services and toolkits.'
        },
        items: ['service-digital-blueprint', 'service-performance-ads', 'product-launch-playbook'],
        heroImage: 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1400&q=80'
      },
      {
        id: 'collection-industrial',
        title: { ar: 'شراكات صناعية فورية', en: 'Instant industrial partnerships' },
        description: {
          ar: 'وثائق ومحتوى حيوي لجذب موزعي القطاعات الثقيلة.',
          en: 'Compelling dossiers and live coverage to engage heavy-industry distributors.'
        },
        items: ['service-b2b-roadmap', 'service-trade-mission', 'product-industrial-dossier'],
        heroImage: 'https://images.unsplash.com/photo-1581093588401-22f636c1f3b0?auto=format&fit=crop&w=1400&q=80'
      }
    ]
  };

  global.SocialBNW = Object.assign({}, global.SocialBNW || {}, {
    brandName: PLATFORM_NAME,
    brandSlug: PLATFORM_SLUG,
    designTokens,
    mockData
  });
})(typeof window !== 'undefined' ? window : globalThis);
