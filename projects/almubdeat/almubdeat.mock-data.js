(function (global) {
  const now = new Date();
  const iso = (minutesAgo) => new Date(now.getTime() - minutesAgo * 60000).toISOString();

  const AlmubdeatMockData = {
    brand: {
      name: { ar: 'منصة المبدعات', en: 'Almubdeat Collective' },
      tagline: {
        ar: 'سوق إلكتروني فاخر ومجتمع تواصل للمبدعات السعوديات والعربيات.',
        en: 'A boutique social marketplace celebrating creative Arab women.'
      },
      hero: {
        highlight: {
          ar: 'حرفيات، مصممات، وخبيرات يقدمّن منتجات وخدمات بمعايير عالمية.',
          en: 'Craftswomen, designers, and experts offering world-class creations.'
        },
        ctaPrimary: { ar: 'استكشف المبدعات', en: 'Explore Creators' },
        ctaSecondary: { ar: 'انضم كمبدعة', en: 'Join as Creator' }
      },
      stats: [
        { id: 'creators', value: '1.2K+', label: { ar: 'مبدعة معتمدة', en: 'Certified creators' } },
        { id: 'collections', value: '320', label: { ar: 'مجموعات حصرية', en: 'Curated collections' } },
        { id: 'satisfaction', value: '97%', label: { ar: 'رضا العملاء', en: 'Customer satisfaction' } }
      ]
    },
    categories: [
      {
        id: 'artisan-delights',
        kind: 'product',
        icon: '🧁',
        title: { ar: 'المأكولات الراقية', en: 'Artisan Delights' },
        description: {
          ar: 'حلويات فاخرة، موالح مبتكرة، وعلب ضيافة مخصصة للمناسبات الملكية.',
          en: 'Gourmet desserts, savoury bites, and bespoke hospitality boxes.'
        },
        palette: '#f59e0b',
        children: [
          { id: 'royal-desserts', title: { ar: 'حلويات ملكية', en: 'Royal Desserts' } },
          { id: 'signature-savories', title: { ar: 'مقبلات توقيع', en: 'Signature Savories' } }
        ]
      },
      {
        id: 'atelier-fashion',
        kind: 'product',
        icon: '👗',
        title: { ar: 'أزياء الأتيليه', en: 'Atelier Couture' },
        description: {
          ar: 'فساتين مصممة حسب الطلب مع خامات عالمية ولمسات سعودية معاصرة.',
          en: 'Made-to-measure couture with global fabrics and Saudi finesse.'
        },
        palette: '#8b5cf6',
        children: [
          { id: 'evening-gowns', title: { ar: 'فساتين السهرة', en: 'Evening gowns' } },
          { id: 'abaya-stories', title: { ar: 'عبايات القصص', en: 'Storytelling abayas' } }
        ]
      },
      {
        id: 'experience-services',
        kind: 'service',
        icon: '🎨',
        title: { ar: 'تجارب وخدمات فنية', en: 'Artful Experiences' },
        description: {
          ar: 'ورش خاصة، تنظيم حفلات، وخدمات تصميم داخلي برؤية إبداعية.',
          en: 'Private workshops, event styling, and creative interior experiences.'
        },
        palette: '#0ea5e9',
        children: [
          { id: 'wellness-retreat', title: { ar: 'استرخاء وإلهام', en: 'Wellness retreats' } },
          { id: 'masterclass-series', title: { ar: 'سلسلة ماستر كلاس', en: 'Masterclass series' } }
        ]
      }
    ],
    creators: [
      {
        id: 'creator-lulua',
        userId: 'user-lulua',
        displayName: { ar: 'لولوة الفهد', en: 'Lulwa AlFahad' },
        username: 'lulwaatelier',
        phone: '+966500123456',
        rating: 4.9,
        city: { ar: 'الرياض', en: 'Riyadh' },
        headline: {
          ar: 'مصممة أتيليه تقدم فساتين تحكي قصة كل مناسبة.',
          en: 'Atelier designer crafting gowns that narrate every occasion.'
        },
        badges: ['verified', 'top-rated'],
        avatarUrl:
          'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=640&q=80',
        coverUrl:
          'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1400&q=80',
        social: {
          instagram: 'https://instagram.com/lulwaatelier',
          tiktok: 'https://www.tiktok.com/@lulwaatelier',
          whatsapp: 'https://wa.me/966500123456'
        },
        highlights: {
          services: ['service-atelier-consult'],
          products: ['product-royal-gown', 'product-mint-abaya']
        }
      },
      {
        id: 'creator-nesma',
        userId: 'user-nesma',
        displayName: { ar: 'نسمة الماجد', en: 'Nesma AlMajed' },
        username: 'nesmasweetstudio',
        phone: '+966540998877',
        rating: 4.8,
        city: { ar: 'جدة', en: 'Jeddah' },
        headline: {
          ar: 'شيف حلويات تصنع تجارب ضيافة فاخرة للمناسبات الخاصة.',
          en: 'Pastry chef designing luxurious hospitality experiences.'
        },
        badges: ['verified', 'artisan'],
        avatarUrl:
          'https://images.unsplash.com/photo-1543353071-873f17a7a088?auto=format&fit=crop&w=640&q=80',
        coverUrl:
          'https://images.unsplash.com/photo-1504753793650-d4a2b783c15e?auto=format&fit=crop&w=1400&q=80',
        social: {
          instagram: 'https://instagram.com/nesmasweetstudio',
          snapchat: 'https://snapchat.com/add/nesmasweets',
          whatsapp: 'https://wa.me/966540998877'
        },
        highlights: {
          services: ['service-dessert-tasting'],
          products: ['product-saffron-tart', 'product-velvet-box']
        }
      },
      {
        id: 'creator-dana',
        userId: 'user-dana',
        displayName: { ar: 'دانة الحربي', en: 'Dana AlHarbi' },
        username: 'danainteriors',
        phone: '+966555221144',
        rating: 4.95,
        city: { ar: 'الخبر', en: 'AlKhobar' },
        headline: {
          ar: 'مصممة تجارب داخلية تنسج قصصاً من الألوان والحرف المحلية.',
          en: 'Experience designer weaving spaces with local artistry.'
        },
        badges: ['verified', 'experience-guru'],
        avatarUrl:
          'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=640&q=80',
        coverUrl:
          'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80',
        social: {
          instagram: 'https://instagram.com/danainteriors',
          linkedin: 'https://linkedin.com/in/danainteriors',
          whatsapp: 'https://wa.me/966555221144'
        },
        highlights: {
          services: ['service-interior-suite'],
          products: []
        }
      }
    ],
    products: [
      {
        id: 'product-royal-gown',
        creatorId: 'creator-lulua',
        categoryId: 'atelier-fashion',
        title: { ar: 'فستان ملكي مطرز باللؤلؤ', en: 'Pearl Embroidered Royal Gown' },
        description: {
          ar: 'تصميم حصري مع 120 ساعة تطريز يدوي وخيارات لون مخصصة.',
          en: 'Exclusive pattern with 120 hours of hand embroidery and bespoke colour palette.'
        },
        priceRange: { min: 6800, max: 12800, currency: 'SAR' },
        media: [
          {
            type: 'image',
            url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1080&q=80',
            aspectRatio: '3:4'
          }
        ]
      },
      {
        id: 'product-mint-abaya',
        creatorId: 'creator-lulua',
        categoryId: 'atelier-fashion',
        title: { ar: 'عباية فيروزية بتطريز ليزري', en: 'Mint Laser Embroidered Abaya' },
        description: {
          ar: 'عباية يومية فاخرة مع خامة صديقة للمناخ وشال متناسق.',
          en: 'Luxury everyday abaya with climate-friendly fabric and matching shawl.'
        },
        priceRange: { min: 1200, max: 1950, currency: 'SAR' },
        media: [
          {
            type: 'image',
            url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1080&q=80',
            aspectRatio: '2:3'
          }
        ]
      },
      {
        id: 'product-saffron-tart',
        creatorId: 'creator-nesma',
        categoryId: 'artisan-delights',
        title: { ar: 'تارت الزعفران والورد', en: 'Saffron & Rose Tart' },
        description: {
          ar: 'قاعدة مقرمشة مع كريمة زعفران فاخرة وتزيين ورد عضوي.',
          en: 'Buttery crust topped with saffron cream and organic rose petals.'
        },
        priceRange: { min: 320, max: 480, currency: 'SAR' },
        media: [
          {
            type: 'image',
            url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1080&q=80',
            aspectRatio: '1:1'
          },
          {
            type: 'video',
            url: 'https://cdn.coverr.co/videos/coverr-cake-decoration-4225/1080p.mp4',
            aspectRatio: '9:16',
            duration: 18
          }
        ]
      },
      {
        id: 'product-velvet-box',
        creatorId: 'creator-nesma',
        categoryId: 'artisan-delights',
        title: { ar: 'صندوق مخملي للضيافة', en: 'Velvet Hospitality Box' },
        description: {
          ar: '12 قطعة مختارة من الحلو والمالح مع بطاقات تهنئة شخصية.',
          en: '12 curated sweet & savoury pieces with personalised greeting cards.'
        },
        priceRange: { min: 540, max: 790, currency: 'SAR' },
        media: [
          {
            type: 'image',
            url: 'https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=1080&q=80',
            aspectRatio: '4:3'
          }
        ]
      }
    ],
    services: [
      {
        id: 'service-atelier-consult',
        creatorId: 'creator-lulua',
        categoryId: 'atelier-fashion',
        title: { ar: 'جلسة تصميم فستان حلمك', en: 'Design Your Dream Gown' },
        summary: {
          ar: 'جلسة استشارية مع المصممة لتخطيط القصة والخامات والتجربة.',
          en: 'Consultation to storyboard the gown, fabrics, and ceremony experience.'
        },
        packages: [
          { id: 'lite', name: { ar: 'جلسة تعريفية', en: 'Discovery' }, price: 550, duration: 60 },
          { id: 'premium', name: { ar: 'جلسة شاملة', en: 'Signature' }, price: 1250, duration: 120 }
        ],
        serviceArea: { ar: 'الرياض، افتراضياً', en: 'Riyadh & Virtual' },
        isVirtual: true
      },
      {
        id: 'service-dessert-tasting',
        creatorId: 'creator-nesma',
        categoryId: 'artisan-delights',
        title: { ar: 'تجربة تذوق خاصة للحلويات', en: 'Private Dessert Tasting' },
        summary: {
          ar: 'جلسة تذوق لحلويات موسمية مع إعداد قائمة مخصصة لمناسبتك.',
          en: 'Seasonal tasting session with bespoke menu curation for your occasion.'
        },
        packages: [
          { id: 'intimate', name: { ar: 'جلسة ناعمة', en: 'Intimate' }, price: 750, duration: 90 },
          { id: 'royal', name: { ar: 'جلسة ملكية', en: 'Royal' }, price: 1550, duration: 150 }
        ],
        serviceArea: { ar: 'جدة وما حولها', en: 'Jeddah & Surroundings' },
        isVirtual: false
      },
      {
        id: 'service-interior-suite',
        creatorId: 'creator-dana',
        categoryId: 'experience-services',
        title: { ar: 'برنامج تصميم داخلي متكامل', en: 'Immersive Interior Suite' },
        summary: {
          ar: 'خدمة تصميم شاملة للمنازل الفاخرة تجمع بين الفن والحرف اليدوية المحلية.',
          en: 'End-to-end interior design weaving art with local craftsmanship.'
        },
        packages: [
          { id: 'signature', name: { ar: 'باقة التوقيع', en: 'Signature' }, price: 9800, duration: 30 },
          { id: 'grand', name: { ar: 'باقة جراند', en: 'Grand' }, price: 18200, duration: 45 }
        ],
        serviceArea: { ar: 'الساحل الشرقي والسعودية كاملة افتراضيًا', en: 'Eastern Province & virtual nationwide' },
        isVirtual: true
      }
    ],
    posts: [
      {
        id: 'post-gown-reel',
        creatorId: 'creator-lulua',
        type: 'reel',
        title: { ar: 'تفاصيل التطريز الملكي', en: 'Royal Embroidery Details' },
        caption: {
          ar: 'لقطات خلف الكواليس من خيوط اللؤلؤ اللامعة لفساتين الزفاف.',
          en: 'Behind-the-scenes shimmer from pearl threads adorning our bridal line.'
        },
        categoryId: 'atelier-fashion',
        productId: 'product-royal-gown',
        media: {
          url: 'https://cdn.coverr.co/videos/coverr-fashion-designer-working-on-dress-0159/1080p.mp4',
          type: 'video',
          duration: 22,
          aspectRatio: '9:16'
        },
        pricing: { label: { ar: 'ابتداءً من 6,800 ر.س', en: 'From 6,800 SAR' } },
        cta: {
          label: { ar: 'احجزي استشارة تصميم', en: 'Book design consult' },
          link: 'https://wa.me/966500123456?text=ارغب+في+جلسة+تصميم'
        },
        engagement: { likes: 1860, saves: 540, shares: 240, views: 12200 },
        tags: ['couture', 'bridal'],
        publishedAt: iso(55)
      },
      {
        id: 'post-dessert-post',
        creatorId: 'creator-nesma',
        type: 'post',
        title: { ar: 'علبة الضيافة المخملية', en: 'Velvet Hospitality Box' },
        caption: {
          ar: 'علبة تجمع نكهات الزعفران والفستق مع خدمة توصيل مبرد.',
          en: 'A box blending saffron & pistachio with chilled delivery service.'
        },
        categoryId: 'artisan-delights',
        productId: 'product-velvet-box',
        media: {
          url: 'https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=1080&q=80',
          type: 'image',
          aspectRatio: '4:3'
        },
        pricing: { label: { ar: '540 - 790 ر.س', en: '540 - 790 SAR' } },
        cta: {
          label: { ar: 'اطلب الآن', en: 'Order now' },
          link: 'https://wa.me/966540998877?text=ارغب+في+طلب+صندوق+ضيافة'
        },
        engagement: { likes: 980, saves: 410, shares: 95, views: 5300 },
        tags: ['hospitality', 'luxury-gifting'],
        publishedAt: iso(180)
      },
      {
        id: 'post-masterclass',
        creatorId: 'creator-dana',
        type: 'reel',
        title: { ar: 'ماستر كلاس تصميم الألوان', en: 'Colour Story Masterclass' },
        caption: {
          ar: 'سلسلة افتراضية تعلمك مزج الألوان مع الحرف السعودية المعاصرة.',
          en: 'Virtual series teaching colour harmony rooted in Saudi craft.'
        },
        categoryId: 'experience-services',
        serviceId: 'service-interior-suite',
        media: {
          url: 'https://cdn.coverr.co/videos/coverr-interior-design-team-discussing-2511/1080p.mp4',
          type: 'video',
          duration: 28,
          aspectRatio: '9:16'
        },
        pricing: { label: { ar: 'جلسة جماعية بـ 980 ر.س', en: 'Group session 980 SAR' } },
        cta: {
          label: { ar: 'احجز مقعدك', en: 'Reserve your seat' },
          link: 'https://danainteriors.com/masterclass'
        },
        engagement: { likes: 2100, saves: 870, shares: 410, views: 18900 },
        tags: ['masterclass', 'interior-design'],
        publishedAt: iso(15)
      },
      {
        id: 'post-dessert-story',
        creatorId: 'creator-nesma',
        type: 'post',
        title: { ar: 'تارت الزعفران الموسمية', en: 'Seasonal Saffron Tart' },
        caption: {
          ar: 'إصدار محدود مع توصيل خلال 24 ساعة داخل جدة.',
          en: 'Limited edition with 24-hour delivery within Jeddah.'
        },
        categoryId: 'artisan-delights',
        productId: 'product-saffron-tart',
        media: {
          url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1080&q=80',
          type: 'image',
          aspectRatio: '1:1'
        },
        pricing: { label: { ar: 'ابتداءً من 320 ر.س', en: 'From 320 SAR' } },
        cta: {
          label: { ar: 'احجز التذوق', en: 'Schedule tasting' },
          link: 'https://wa.me/966540998877?text=ارغب+في+تذوق+التارت'
        },
        engagement: { likes: 1570, saves: 620, shares: 220, views: 9900 },
        tags: ['dessert', 'limited'],
        publishedAt: iso(310)
      }
    ],
    features: [
      {
        id: 'feature-dual-experience',
        icon: '⚡️',
        title: { ar: 'سوق + منصة اجتماعية', en: 'Marketplace + Social Layer' },
        description: {
          ar: 'كل بروفايل هو متجر مستقل وتايملاين مرئي غني بالقصص والإعلانات.',
          en: 'Every profile acts as a full storefront with a rich storytelling timeline.'
        }
      },
      {
        id: 'feature-intelligent-catalog',
        icon: '🌿',
        title: { ar: 'كتالوج ذكي', en: 'Intelligent Catalogue' },
        description: {
          ar: 'تصنيفات ديناميكية تستوعب المنتجات والخدمات والمجموعات المشتركة.',
          en: 'Dynamic categories covering products, services, and bundled experiences.'
        }
      },
      {
        id: 'feature-seamless-orders',
        icon: '🤝',
        title: { ar: 'طلب وتواصل سلس', en: 'Seamless Conversion' },
        description: {
          ar: 'روابط مباشرة للواتساب والحجز عبر المنصة مع نظام مراجعات موثوق.',
          en: 'Direct WhatsApp & booking handoffs backed by trusted reviews.'
        }
      }
    ],
    collections: [
      {
        id: 'collection-luxury-weddings',
        title: { ar: 'أعراس فاخرة', en: 'Luxury Weddings' },
        items: ['post-gown-reel', 'post-dessert-post']
      },
      {
        id: 'collection-immersive-experiences',
        title: { ar: 'تجارب غامرة', en: 'Immersive Experiences' },
        items: ['post-masterclass', 'post-dessert-story']
      }
    ]
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AlmubdeatMockData;
  }

  global.AlmubdeatMockData = AlmubdeatMockData;
})(typeof window !== 'undefined' ? window : globalThis);
