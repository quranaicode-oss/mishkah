/**
 * بسم الله الرحمن الرحيم
 * FILE: kds-mock-data.js
 *
 * هذا الملف يقدم قاعدة بيانات تجريبية متكاملة لشاشة المطبخ (KDS).
 * يمثل كيفية انقسام طلبات الـ POS إلى Job Orders لكل محطة تحضير
 * مع محاكاة للمزامنة الثنائية عبر WebSockets.
 */

const kdsDatabase = {
  metadata: {
    generatedAt: '2024-05-09T12:10:00Z',
    source: 'mock',
    description: 'Sample KDS data illustrating job order headers, details and expo aggregation.',
    posSnapshotVersion: '2024.05.09-rc1',
    sync: {
      channel: 'websocket',
      lastSyncAt: '2024-05-09T12:10:05Z',
      pendingEvents: 0
    }
  },

  stations: [
    {
      id: 'hot_line',
      code: 'HOT',
      nameAr: 'خط السخن',
      nameEn: 'Hot Line',
      stationType: 'prep',
      isExpo: false,
      sequence: 1,
      themeColor: '#fb7185',
      autoRouteRules: [
        { type: 'category', value: 'sandwiches' },
        { type: 'category', value: 'hawawshi' },
        { type: 'category', value: 'combo_meals' }
      ],
      displayConfig: { layout: 'tabs', tab: 'hot_line', columns: 2 },
      createdAt: '2024-05-01T08:00:00Z',
      updatedAt: '2024-05-09T11:50:00Z'
    },
    {
      id: 'grill_line',
      code: 'GRILL',
      nameAr: 'خط المشاوي',
      nameEn: 'Grill Station',
      stationType: 'prep',
      isExpo: false,
      sequence: 2,
      themeColor: '#f97316',
      autoRouteRules: [
        { type: 'category', value: 'kilo_grills' },
        { type: 'category', value: 'grill_plates' }
      ],
      displayConfig: { layout: 'tabs', tab: 'grill_line', columns: 1 },
      createdAt: '2024-05-01T08:00:00Z',
      updatedAt: '2024-05-09T11:50:00Z'
    },
    {
      id: 'mandi_line',
      code: 'MANDI',
      nameAr: 'خط المندي',
      nameEn: 'Mandi & Kabsa',
      stationType: 'prep',
      isExpo: false,
      sequence: 3,
      themeColor: '#22d3ee',
      autoRouteRules: [
        { type: 'category', value: 'mandi' },
        { type: 'category', value: 'kabsa' }
      ],
      displayConfig: { layout: 'tabs', tab: 'mandi_line', columns: 1 },
      createdAt: '2024-05-01T08:00:00Z',
      updatedAt: '2024-05-09T11:50:00Z'
    },
    {
      id: 'dessert_bar',
      code: 'DESS',
      nameAr: 'خط الحلويات والمشروبات',
      nameEn: 'Dessert & Drinks',
      stationType: 'prep',
      isExpo: false,
      sequence: 4,
      themeColor: '#a855f7',
      autoRouteRules: [
        { type: 'category', value: 'desserts' },
        { type: 'category', value: 'beverages' }
      ],
      displayConfig: { layout: 'tabs', tab: 'dessert_bar', columns: 2 },
      createdAt: '2024-05-01T08:00:00Z',
      updatedAt: '2024-05-09T11:50:00Z'
    },
    {
      id: 'expo_pass',
      code: 'EXPO',
      nameAr: 'شاشة التسليم',
      nameEn: 'Expo Pass',
      stationType: 'expo',
      isExpo: true,
      sequence: 99,
      themeColor: '#38bdf8',
      autoRouteRules: [],
      displayConfig: { layout: 'aggregated', tab: 'expo', columns: 3 },
      createdAt: '2024-05-01T08:00:00Z',
      updatedAt: '2024-05-09T11:50:00Z'
    }
  ],

  stationCategoryRoutes: [
    {
      id: 'route-001',
      categoryId: 'sandwiches',
      stationId: 'hot_line',
      priority: 1,
      isActive: true,
      createdAt: '2024-05-01T08:00:00Z',
      updatedAt: '2024-05-09T11:45:00Z'
    },
    {
      id: 'route-002',
      categoryId: 'hawawshi',
      stationId: 'hot_line',
      priority: 1,
      isActive: true,
      createdAt: '2024-05-01T08:00:00Z',
      updatedAt: '2024-05-09T11:45:00Z'
    },
    {
      id: 'route-003',
      categoryId: 'combo_meals',
      stationId: 'hot_line',
      priority: 2,
      isActive: true,
      createdAt: '2024-05-01T08:00:00Z',
      updatedAt: '2024-05-09T11:45:00Z'
    },
    {
      id: 'route-010',
      categoryId: 'kilo_grills',
      stationId: 'grill_line',
      priority: 1,
      isActive: true,
      createdAt: '2024-05-01T08:00:00Z',
      updatedAt: '2024-05-09T11:45:00Z'
    },
    {
      id: 'route-011',
      categoryId: 'grill_plates',
      stationId: 'grill_line',
      priority: 1,
      isActive: true,
      createdAt: '2024-05-01T08:00:00Z',
      updatedAt: '2024-05-09T11:45:00Z'
    },
    {
      id: 'route-020',
      categoryId: 'mandi',
      stationId: 'mandi_line',
      priority: 1,
      isActive: true,
      createdAt: '2024-05-01T08:00:00Z',
      updatedAt: '2024-05-09T11:45:00Z'
    },
    {
      id: 'route-021',
      categoryId: 'kabsa',
      stationId: 'mandi_line',
      priority: 1,
      isActive: true,
      createdAt: '2024-05-01T08:00:00Z',
      updatedAt: '2024-05-09T11:45:00Z'
    },
    {
      id: 'route-030',
      categoryId: 'desserts',
      stationId: 'dessert_bar',
      priority: 1,
      isActive: true,
      createdAt: '2024-05-01T08:00:00Z',
      updatedAt: '2024-05-09T11:45:00Z'
    },
    {
      id: 'route-031',
      categoryId: 'beverages',
      stationId: 'dessert_bar',
      priority: 1,
      isActive: true,
      createdAt: '2024-05-01T08:00:00Z',
      updatedAt: '2024-05-09T11:45:00Z'
    }
  ],

  jobOrders: {
    headers: [
      {
        id: 'JO-1001-HOT',
        orderId: 'ORD-1001',
        orderNumber: '1001',
        posRevision: 'ORD-1001@3',
        orderTypeId: 'dine_in',
        serviceMode: 'dine_in',
        stationId: 'hot_line',
        stationCode: 'HOT',
        status: 'in_progress',
        progressState: 'cooking',
        totalItems: 1,
        completedItems: 0,
        remainingItems: 1,
        hasAlerts: true,
        isExpedite: false,
        tableLabel: 'T12',
        customerName: 'Table 12',
        dueAt: '2024-05-09T12:05:00Z',
        acceptedAt: '2024-05-09T11:58:10Z',
        startedAt: '2024-05-09T11:59:00Z',
        readyAt: null,
        completedAt: null,
        expoAt: null,
        syncChecksum: 'c74a7d88',
        notes: 'بدون بصل على الحواوشي.',
        meta: {
          orderSource: 'pos',
          seat: 'A',
          kdsTab: 'hot_line'
        },
        createdAt: '2024-05-09T11:58:10Z',
        updatedAt: '2024-05-09T12:01:45Z'
      },
      {
        id: 'JO-1001-MANDI',
        orderId: 'ORD-1001',
        orderNumber: '1001',
        posRevision: 'ORD-1001@3',
        orderTypeId: 'dine_in',
        serviceMode: 'dine_in',
        stationId: 'mandi_line',
        stationCode: 'MANDI',
        status: 'queued',
        progressState: 'awaiting',
        totalItems: 1,
        completedItems: 0,
        remainingItems: 1,
        hasAlerts: false,
        isExpedite: false,
        tableLabel: 'T12',
        customerName: 'Table 12',
        dueAt: '2024-05-09T12:15:00Z',
        acceptedAt: null,
        startedAt: null,
        readyAt: null,
        completedAt: null,
        expoAt: null,
        syncChecksum: '9f48a1b0',
        notes: null,
        meta: {
          orderSource: 'pos',
          seat: 'A',
          kdsTab: 'mandi_line'
        },
        createdAt: '2024-05-09T11:58:10Z',
        updatedAt: '2024-05-09T11:58:10Z'
      },
      {
        id: 'JO-1001-DESS',
        orderId: 'ORD-1001',
        orderNumber: '1001',
        posRevision: 'ORD-1001@3',
        orderTypeId: 'dine_in',
        serviceMode: 'dine_in',
        stationId: 'dessert_bar',
        stationCode: 'DESS',
        status: 'in_progress',
        progressState: 'plating',
        totalItems: 2,
        completedItems: 1,
        remainingItems: 1,
        hasAlerts: false,
        isExpedite: true,
        tableLabel: 'T12',
        customerName: 'Table 12',
        dueAt: '2024-05-09T12:02:00Z',
        acceptedAt: '2024-05-09T11:58:12Z',
        startedAt: '2024-05-09T11:58:30Z',
        readyAt: '2024-05-09T12:00:10Z',
        completedAt: null,
        expoAt: null,
        syncChecksum: '4b32d9e1',
        notes: 'المشروب بدون سكر.',
        meta: {
          orderSource: 'pos',
          expediteReason: 'Beverage delay',
          kdsTab: 'dessert_bar'
        },
        createdAt: '2024-05-09T11:58:10Z',
        updatedAt: '2024-05-09T12:01:10Z'
      },
      {
        id: 'JO-1002-GRILL',
        orderId: 'ORD-1002',
        orderNumber: '1002',
        posRevision: 'ORD-1002@1',
        orderTypeId: 'delivery',
        serviceMode: 'delivery',
        stationId: 'grill_line',
        stationCode: 'GRILL',
        status: 'in_progress',
        progressState: 'cooking',
        totalItems: 1,
        completedItems: 0,
        remainingItems: 1,
        hasAlerts: false,
        isExpedite: false,
        tableLabel: null,
        customerName: 'Omar',
        dueAt: '2024-05-09T12:25:00Z',
        acceptedAt: '2024-05-09T12:05:22Z',
        startedAt: '2024-05-09T12:06:00Z',
        readyAt: null,
        completedAt: null,
        expoAt: null,
        syncChecksum: 'aa1227f6',
        notes: null,
        meta: {
          orderSource: 'aggregator',
          aggregator: 'HungerStation',
          deliveryEta: '2024-05-09T12:40:00Z',
          kdsTab: 'grill_line'
        },
        createdAt: '2024-05-09T12:05:22Z',
        updatedAt: '2024-05-09T12:06:45Z'
      },
      {
        id: 'JO-1002-MANDI',
        orderId: 'ORD-1002',
        orderNumber: '1002',
        posRevision: 'ORD-1002@1',
        orderTypeId: 'delivery',
        serviceMode: 'delivery',
        stationId: 'mandi_line',
        stationCode: 'MANDI',
        status: 'queued',
        progressState: 'awaiting',
        totalItems: 1,
        completedItems: 0,
        remainingItems: 1,
        hasAlerts: false,
        isExpedite: false,
        tableLabel: null,
        customerName: 'Omar',
        dueAt: '2024-05-09T12:25:00Z',
        acceptedAt: null,
        startedAt: null,
        readyAt: null,
        completedAt: null,
        expoAt: null,
        syncChecksum: 'bc45f610',
        notes: null,
        meta: {
          orderSource: 'aggregator',
          aggregator: 'HungerStation',
          deliveryEta: '2024-05-09T12:40:00Z',
          kdsTab: 'mandi_line'
        },
        createdAt: '2024-05-09T12:05:22Z',
        updatedAt: '2024-05-09T12:05:22Z'
      },
      {
        id: 'JO-1002-DESS',
        orderId: 'ORD-1002',
        orderNumber: '1002',
        posRevision: 'ORD-1002@1',
        orderTypeId: 'delivery',
        serviceMode: 'delivery',
        stationId: 'dessert_bar',
        stationCode: 'DESS',
        status: 'queued',
        progressState: 'awaiting',
        totalItems: 1,
        completedItems: 0,
        remainingItems: 1,
        hasAlerts: false,
        isExpedite: false,
        tableLabel: null,
        customerName: 'Omar',
        dueAt: '2024-05-09T12:25:00Z',
        acceptedAt: null,
        startedAt: null,
        readyAt: null,
        completedAt: null,
        expoAt: null,
        syncChecksum: 'fe8013aa',
        notes: null,
        meta: {
          orderSource: 'aggregator',
          aggregator: 'HungerStation',
          deliveryEta: '2024-05-09T12:40:00Z',
          kdsTab: 'dessert_bar'
        },
        createdAt: '2024-05-09T12:05:22Z',
        updatedAt: '2024-05-09T12:05:22Z'
      }
    ],

    details: [
      {
        id: 'JOD-1001-01',
        jobOrderId: 'JO-1001-HOT',
        orderLineId: 'OL-1001-01',
        posLineRevision: 'OL-1001-01@2',
        itemId: 'hawawshi_classic',
        itemSku: 'HW-001',
        itemNameAr: 'حواوشي لحمة',
        itemNameEn: 'Classic Hawawshi',
        categoryId: 'hawawshi',
        quantity: 1,
        unit: 'portion',
        status: 'cooking',
        priority: 2,
        prepNotes: 'بدون بصل، سبايسي وسط',
        allergens: ['gluten'],
        startAt: '2024-05-09T11:59:00Z',
        finishAt: null,
        lastActionBy: 'cook-adel',
        meta: {
          spiceLevel: 'medium',
          temperatureTarget: '85C'
        },
        createdAt: '2024-05-09T11:58:12Z',
        updatedAt: '2024-05-09T12:01:45Z'
      },
      {
        id: 'JOD-1001-02',
        jobOrderId: 'JO-1001-MANDI',
        orderLineId: 'OL-1001-02',
        posLineRevision: 'OL-1001-02@1',
        itemId: 'lamb_mandi_tray',
        itemSku: 'MD-201',
        itemNameAr: 'صينية مندي لحم',
        itemNameEn: 'Lamb Mandi Tray',
        categoryId: 'mandi',
        quantity: 1,
        unit: 'tray',
        status: 'queued',
        priority: 1,
        prepNotes: null,
        allergens: [],
        startAt: null,
        finishAt: null,
        lastActionBy: null,
        meta: {
          riceType: 'basmati',
          broth: 'rich'
        },
        createdAt: '2024-05-09T11:58:12Z',
        updatedAt: '2024-05-09T11:58:12Z'
      },
      {
        id: 'JOD-1001-03',
        jobOrderId: 'JO-1001-DESS',
        orderLineId: 'OL-1001-03',
        posLineRevision: 'OL-1001-03@1',
        itemId: 'kunafa_cream',
        itemSku: 'DS-110',
        itemNameAr: 'كنافة قشطة',
        itemNameEn: 'Cream Kunafa',
        categoryId: 'desserts',
        quantity: 1,
        unit: 'slice',
        status: 'ready',
        priority: 1,
        prepNotes: 'زيادة فستق',
        allergens: ['dairy', 'nuts'],
        startAt: '2024-05-09T11:58:40Z',
        finishAt: '2024-05-09T11:59:50Z',
        lastActionBy: 'pastry-lamia',
        meta: {
          garnish: 'pistachio',
          plating: 'dessert_plate_01'
        },
        createdAt: '2024-05-09T11:58:15Z',
        updatedAt: '2024-05-09T12:00:10Z'
      },
      {
        id: 'JOD-1001-04',
        jobOrderId: 'JO-1001-DESS',
        orderLineId: 'OL-1001-04',
        posLineRevision: 'OL-1001-04@1',
        itemId: 'mint_lemonade',
        itemSku: 'BV-015',
        itemNameAr: 'ليمون نعناع',
        itemNameEn: 'Mint Lemonade',
        categoryId: 'beverages',
        quantity: 1,
        unit: 'glass',
        status: 'plating',
        priority: 2,
        prepNotes: 'بدون سكر',
        allergens: [],
        startAt: '2024-05-09T11:58:42Z',
        finishAt: null,
        lastActionBy: 'bar-nour',
        meta: {
          sweetness: 'zero',
          ice: 'light'
        },
        createdAt: '2024-05-09T11:58:16Z',
        updatedAt: '2024-05-09T12:01:10Z'
      },
      {
        id: 'JOD-1002-01',
        jobOrderId: 'JO-1002-GRILL',
        orderLineId: 'OL-1002-01',
        posLineRevision: 'OL-1002-01@1',
        itemId: 'mixed_grill_kilo',
        itemSku: 'GR-500',
        itemNameAr: 'كيلو مشكل مشاوي',
        itemNameEn: 'Mixed Grill Kilo',
        categoryId: 'kilo_grills',
        quantity: 1,
        unit: 'kilo',
        status: 'cooking',
        priority: 3,
        prepNotes: 'اضافة ريش',
        allergens: [],
        startAt: '2024-05-09T12:06:00Z',
        finishAt: null,
        lastActionBy: 'grill-samir',
        meta: {
          fireType: 'charcoal',
          marinade: 'traditional'
        },
        createdAt: '2024-05-09T12:05:25Z',
        updatedAt: '2024-05-09T12:06:45Z'
      },
      {
        id: 'JOD-1002-02',
        jobOrderId: 'JO-1002-MANDI',
        orderLineId: 'OL-1002-02',
        posLineRevision: 'OL-1002-02@1',
        itemId: 'mandi_chicken_half',
        itemSku: 'MD-102',
        itemNameAr: 'نصف دجاج مندي',
        itemNameEn: 'Half Chicken Mandi',
        categoryId: 'mandi',
        quantity: 1,
        unit: 'half',
        status: 'queued',
        priority: 1,
        prepNotes: 'ارز زيادة',
        allergens: [],
        startAt: null,
        finishAt: null,
        lastActionBy: null,
        meta: {
          riceExtra: true,
          sauce: 'red'
        },
        createdAt: '2024-05-09T12:05:25Z',
        updatedAt: '2024-05-09T12:05:25Z'
      },
      {
        id: 'JOD-1002-03',
        jobOrderId: 'JO-1002-DESS',
        orderLineId: 'OL-1002-03',
        posLineRevision: 'OL-1002-03@1',
        itemId: 'date_pudding',
        itemSku: 'DS-220',
        itemNameAr: 'كيكة تمر',
        itemNameEn: 'Date Pudding',
        categoryId: 'desserts',
        quantity: 1,
        unit: 'slice',
        status: 'queued',
        priority: 1,
        prepNotes: null,
        allergens: ['gluten', 'eggs'],
        startAt: null,
        finishAt: null,
        lastActionBy: null,
        meta: {
          sauce: 'caramel',
          packaging: 'to-go'
        },
        createdAt: '2024-05-09T12:05:25Z',
        updatedAt: '2024-05-09T12:05:25Z'
      }
    ],

    modifiers: [
      {
        id: 'MOD-1001-01A',
        detailId: 'JOD-1001-01',
        modifierType: 'remove',
        nameAr: 'بدون بصل',
        nameEn: 'No onions',
        quantity: 1,
        isRequired: true,
        notes: null,
        meta: { source: 'guest_note' },
        createdAt: '2024-05-09T11:58:13Z'
      },
      {
        id: 'MOD-1001-01B',
        detailId: 'JOD-1001-01',
        modifierType: 'add',
        nameAr: 'جبنة زيادة',
        nameEn: 'Extra cheese',
        quantity: 1,
        isRequired: false,
        notes: 'استبدال الجبنة الشيدر',
        meta: { cheeseType: 'mozzarella' },
        createdAt: '2024-05-09T11:58:13Z'
      },
      {
        id: 'MOD-1001-03A',
        detailId: 'JOD-1001-03',
        modifierType: 'add',
        nameAr: 'فستق مجروش',
        nameEn: 'Crushed pistachio',
        quantity: 1,
        isRequired: false,
        notes: null,
        meta: { },
        createdAt: '2024-05-09T11:58:16Z'
      },
      {
        id: 'MOD-1002-02A',
        detailId: 'JOD-1002-02',
        modifierType: 'add',
        nameAr: 'أرز إضافي',
        nameEn: 'Extra rice',
        quantity: 1,
        isRequired: false,
        notes: null,
        meta: { source: 'call_center' },
        createdAt: '2024-05-09T12:05:26Z'
      }
    ],

    statusHistory: [
      {
        id: 'HIS-1001-HOT-1',
        jobOrderId: 'JO-1001-HOT',
        status: 'queued',
        reason: null,
        actorId: 'pos-system',
        actorName: 'POS Sync',
        actorRole: 'system',
        changedAt: '2024-05-09T11:58:10Z',
        meta: { source: 'pos', version: 'ORD-1001@3' }
      },
      {
        id: 'HIS-1001-HOT-2',
        jobOrderId: 'JO-1001-HOT',
        status: 'accepted',
        reason: null,
        actorId: 'chef-omar',
        actorName: 'الشيف عمر',
        actorRole: 'line_chef',
        changedAt: '2024-05-09T11:58:55Z',
        meta: { station: 'hot_line' }
      },
      {
        id: 'HIS-1001-HOT-3',
        jobOrderId: 'JO-1001-HOT',
        status: 'in_progress',
        reason: null,
        actorId: 'chef-omar',
        actorName: 'الشيف عمر',
        actorRole: 'line_chef',
        changedAt: '2024-05-09T11:59:00Z',
        meta: { station: 'hot_line' }
      },
      {
        id: 'HIS-1001-DESS-1',
        jobOrderId: 'JO-1001-DESS',
        status: 'queued',
        reason: null,
        actorId: 'pos-system',
        actorName: 'POS Sync',
        actorRole: 'system',
        changedAt: '2024-05-09T11:58:10Z',
        meta: { source: 'pos', version: 'ORD-1001@3' }
      },
      {
        id: 'HIS-1001-DESS-2',
        jobOrderId: 'JO-1001-DESS',
        status: 'in_progress',
        reason: 'Auto start beverage prep',
        actorId: 'bar-nour',
        actorName: 'نور',
        actorRole: 'barista',
        changedAt: '2024-05-09T11:58:35Z',
        meta: { expedite: true }
      },
      {
        id: 'HIS-1002-GRILL-1',
        jobOrderId: 'JO-1002-GRILL',
        status: 'queued',
        reason: null,
        actorId: 'pos-system',
        actorName: 'POS Sync',
        actorRole: 'system',
        changedAt: '2024-05-09T12:05:22Z',
        meta: { source: 'pos', version: 'ORD-1002@1' }
      },
      {
        id: 'HIS-1002-GRILL-2',
        jobOrderId: 'JO-1002-GRILL',
        status: 'in_progress',
        reason: null,
        actorId: 'chef-samir',
        actorName: 'سامر',
        actorRole: 'grill_master',
        changedAt: '2024-05-09T12:06:00Z',
        meta: { station: 'grill_line' }
      }
    ],

    expoPassTickets: [
      {
        id: 'EXPO-1001',
        orderId: 'ORD-1001',
        orderNumber: '1001',
        jobOrderIds: ['JO-1001-HOT', 'JO-1001-MANDI', 'JO-1001-DESS'],
        status: 'awaiting',
        readyItems: 1,
        totalItems: 4,
        holdReason: null,
        runnerId: null,
        runnerName: null,
        callAt: null,
        deliveredAt: null,
        meta: {
          serviceMode: 'dine_in',
          tableLabel: 'T12',
          alert: 'Awaiting mandi tray'
        },
        createdAt: '2024-05-09T11:58:10Z',
        updatedAt: '2024-05-09T12:01:10Z'
      },
      {
        id: 'EXPO-1002',
        orderId: 'ORD-1002',
        orderNumber: '1002',
        jobOrderIds: ['JO-1002-GRILL', 'JO-1002-MANDI', 'JO-1002-DESS'],
        status: 'awaiting',
        readyItems: 0,
        totalItems: 3,
        holdReason: null,
        runnerId: 'runner-05',
        runnerName: 'Fahad',
        callAt: null,
        deliveredAt: null,
        meta: {
          serviceMode: 'delivery',
          deliveryEta: '2024-05-09T12:40:00Z',
          aggregator: 'HungerStation'
        },
        createdAt: '2024-05-09T12:05:22Z',
        updatedAt: '2024-05-09T12:05:22Z'
      }
    ]
  }
};

const root = typeof window !== 'undefined' ? window
  : (typeof globalThis !== 'undefined' ? globalThis
    : (typeof global !== 'undefined' ? global : this));

if (root && typeof root === 'object') {
  root.kdsDatabase = kdsDatabase;
  const baseDatabase = root.database && typeof root.database === 'object' ? root.database : null;
  if (baseDatabase) {
    baseDatabase.kds = kdsDatabase;
  }
}
