
  (async function(){
    const M = Mishkah;
    const UI = M.UI;
    const U = M.utils;
    const D = M.DSL;
    const Schema = M.schema;
    const { tw, token } = U.twcss;
    const BASE_PALETTE = U.twcss?.PALETTE || {};

    const MOCK = window.database || {};
    const settings = MOCK.settings || {};
    const currencyConfig = settings.currency || {};
    const rawPosConfig = settings.pos || settings.pos_info || settings.posInfo || {};
    const fallbackPosId = typeof rawPosConfig.id === 'string' ? rawPosConfig.id
      : typeof rawPosConfig.code === 'string' ? rawPosConfig.code
      : typeof rawPosConfig.prefix === 'string' ? rawPosConfig.prefix
      : 'P001';
    const posId = String(fallbackPosId || 'P001').toUpperCase();
    const posNumberRaw = rawPosConfig.number ?? rawPosConfig.index ?? 1;
    const posNumber = Number.isFinite(Number(posNumberRaw)) ? Number(posNumberRaw) : 1;
    const posLabel = rawPosConfig.label || rawPosConfig.name || `POS ${posNumber}`;
    const posPrefix = rawPosConfig.prefix || posId;
    const POS_INFO = { id: posId, number: posNumber, label: posLabel, prefix: String(posPrefix || posId) };
    const SHIFT_TABLE = Schema.defineTable({
      name:'pos_shift',
      label:'POS Shift Session',
      comment:'Lifecycle of a POS cashier shift bound to orders and payments.',
      fields:[
        { name:'id', columnName:'shift_id', type:'string', primaryKey:true, nullable:false, maxLength:64, comment:'Unique shift identifier composed of POS id and encoded timestamp.' },
        { name:'posId', columnName:'pos_id', type:'string', nullable:false, maxLength:32, comment:'Terminal identifier hosting the shift.' },
        { name:'posLabel', columnName:'pos_label', type:'string', nullable:false, maxLength:96, comment:'Friendly terminal label for reports.' },
        { name:'posNumber', columnName:'pos_number', type:'integer', nullable:false, comment:'Numeric terminal number for invoice sequencing.' },
        { name:'openedAt', columnName:'opened_at', type:'timestamp', nullable:false, comment:'Shift opening timestamp.' },
        { name:'closedAt', columnName:'closed_at', type:'timestamp', nullable:true, comment:'Shift closing timestamp.' },
        { name:'openingFloat', columnName:'opening_float', type:'decimal', precision:12, scale:2, nullable:false, defaultValue:0, comment:'Opening cash float captured when the shift starts.' },
        { name:'closingCash', columnName:'closing_cash', type:'decimal', precision:12, scale:2, nullable:true, comment:'Closing cash drawer balance.' },
        { name:'cashierId', columnName:'cashier_id', type:'string', nullable:false, maxLength:64, comment:'Employee identifier operating the shift.' },
        { name:'cashierName', columnName:'cashier_name', type:'string', nullable:false, maxLength:128, comment:'Display name of the cashier.' },
        { name:'cashierRole', columnName:'cashier_role', type:'string', nullable:false, defaultValue:'cashier', comment:'Role assigned to the cashier during the shift.' },
        { name:'employeeId', columnName:'employee_id', type:'string', nullable:false, maxLength:64, comment:'Employee id linked to payroll records.' },
        { name:'status', columnName:'status', type:'string', nullable:false, defaultValue:'open', comment:'Shift lifecycle state.' },
        { name:'isClosed', columnName:'is_closed', type:'boolean', nullable:false, defaultValue:false, comment:'Flag signalling whether the shift is closed.' },
        { name:'totalsByType', columnName:'totals_by_type', type:'json', nullable:false, defaultValue:()=>({}), comment:'Aggregated sales totals grouped by order type.' },
        { name:'paymentsByMethod', columnName:'payments_by_method', type:'json', nullable:false, defaultValue:()=>({}), comment:'Aggregated payments grouped by method.' },
        { name:'countsByType', columnName:'counts_by_type', type:'json', nullable:false, defaultValue:()=>({}), comment:'Order counts grouped by type.' },
        { name:'ordersCount', columnName:'orders_count', type:'integer', nullable:false, defaultValue:0, comment:'Number of orders captured during the shift.' },
        { name:'orders', columnName:'orders_payload', type:'json', nullable:false, defaultValue:()=>([]), comment:'Optional persisted snapshot for audit or offline sync.' },
        { name:'totalSales', columnName:'total_sales', type:'decimal', precision:14, scale:2, nullable:false, defaultValue:0, comment:'Total sales amount for the shift.' }
      ],
      indexes:[
        { name:'idx_pos_shift_pos_status', columns:['pos_id','is_closed','opened_at'] },
        { name:'idx_pos_shift_opened_at', columns:['opened_at'] }
      ]
    });
    const SHIFT_SCHEMA_REGISTRY = new Schema.Registry({ tables:[SHIFT_TABLE] });
    const POS_SCHEMA_SOURCE = (typeof window !== 'undefined' && window.MishkahPOSSchema)
      ? window.MishkahPOSSchema
      : SHIFT_SCHEMA_REGISTRY.toJSON();
    const POS_SCHEMA_REGISTRY = Schema.Registry.fromJSON(POS_SCHEMA_SOURCE);
    const FALLBACK_CURRENCY = 'EGP';
    const normalizeCurrencyCode = (value)=>{
      if(typeof value !== 'string') return null;
      const upper = value.trim().toUpperCase();
      return /^[A-Z]{3}$/.test(upper) ? upper : null;
    };
    const currencyCode = normalizeCurrencyCode(currencyConfig.code)
      || normalizeCurrencyCode(currencyConfig.default)
      || FALLBACK_CURRENCY;
    const baseSymbols = typeof currencyConfig.symbols === 'object' && currencyConfig.symbols ? currencyConfig.symbols : {};
    const currencySymbols = {
      ar: currencyConfig.ar || baseSymbols.ar || baseSymbols['ar-EG'] || 'ج.م',
      en: currencyConfig.en || baseSymbols.en || baseSymbols['en-GB'] || 'E£',
      ...baseSymbols
    };
    if(!currencySymbols.en) currencySymbols.en = currencyCode;
    if(!currencySymbols.ar) currencySymbols.ar = currencySymbols.en;
    const currencyDisplayMode = currencyConfig.display || 'symbol';

    const ORDER_TYPE_ICON_MAP = { dine_in:'🍽️', delivery:'🚚', takeaway:'🧾', cash:'🧾' };
    const rawOrderTypes = Array.isArray(MOCK.order_types) && MOCK.order_types.length ? MOCK.order_types : [
      { id:'dine_in', type_name:{ ar:'صالة', en:'Dine-in' }, allows_save:true, allows_finalize_later:true, allows_line_additions:true, allows_returns:true, workflow:'multi-step' },
      { id:'delivery', type_name:{ ar:'دليفري', en:'Delivery' }, allows_save:false, allows_finalize_later:false, allows_line_additions:false, allows_returns:false, workflow:'single-step' },
      { id:'takeaway', type_name:{ ar:'تيك أواي', en:'Takeaway' }, allows_save:false, allows_finalize_later:false, allows_line_additions:false, allows_returns:false, workflow:'single-step' }
    ];
    const ORDER_TYPES = rawOrderTypes.map(type=>({
      id: type.id,
      icon: ORDER_TYPE_ICON_MAP[type.id] || '🧾',
      workflow: type.workflow || 'single-step',
      allowsSave: type.allows_save !== false,
      allowsFinalizeLater: !!type.allows_finalize_later,
      allowsLineAdditions: !!type.allows_line_additions,
      allowsReturns: !!type.allows_returns,
      label:{
        ar: type.type_name?.ar || type.id,
        en: type.type_name?.en || type.id
      }
    }));
    const ORDER_TYPE_IDS = new Set(ORDER_TYPES.map(type=> type.id));

    const rawPaymentMethods = Array.isArray(MOCK.payment_methods) && MOCK.payment_methods.length
      ? MOCK.payment_methods
      : [
          { id:'cash', icon:'💵', name:{ ar:'نقدي', en:'Cash' }, type:'cash' },
          { id:'card', icon:'💳', name:{ ar:'بطاقة', en:'Card' }, type:'card' }
        ];
    const PAYMENT_METHODS = rawPaymentMethods.map(method=>({
      id: method.id || method.code || String(method.name?.en || method.name?.ar || method.label?.en || method.label?.ar || 'method'),
      icon: method.icon || '💳',
      type: method.type || 'other',
      label:{
        ar: method.name?.ar || method.label?.ar || method.id || 'نقدي',
        en: method.name?.en || method.label?.en || method.id || 'Cash'
      }
    }));

    const CAIRO_DISTRICTS = [
      { id:'heliopolis', ar:'هليوبوليس', en:'Heliopolis' },
      { id:'nasr_city', ar:'مدينة نصر', en:'Nasr City' },
      { id:'maadi', ar:'المعادي', en:'Maadi' },
      { id:'zamalek', ar:'الزمالك', en:'Zamalek' },
      { id:'dokki', ar:'الدقي', en:'Dokki' },
      { id:'mohandeseen', ar:'المهندسين', en:'Mohandeseen' },
      { id:'garden_city', ar:'جاردن سيتي', en:'Garden City' },
      { id:'shoubra', ar:'شبرا', en:'Shoubra' },
      { id:'rehab', ar:'الرحاب', en:'Al Rehab' },
      { id:'fifth_settlement', ar:'التجمع الخامس', en:'Fifth Settlement' },
      { id:'october', ar:'٦ أكتوبر', en:'6th of October' }
    ];

    const SHIFT_SETTINGS = typeof MOCK.shift_settings === 'object' && MOCK.shift_settings ? MOCK.shift_settings : {};
    const SHIFT_PIN_FALLBACK = typeof SHIFT_SETTINGS.pin === 'string'
      ? SHIFT_SETTINGS.pin
      : (typeof SHIFT_SETTINGS.default_pin === 'string' ? SHIFT_SETTINGS.default_pin : '');
    let SHIFT_PIN_LENGTH = Number(SHIFT_SETTINGS.pin_length || SHIFT_SETTINGS.pinLength || (SHIFT_PIN_FALLBACK ? SHIFT_PIN_FALLBACK.length : 0)) || 0;
    if(!SHIFT_PIN_LENGTH || SHIFT_PIN_LENGTH < 4) SHIFT_PIN_LENGTH = 4;
    const SHIFT_OPEN_FLOAT_DEFAULT = Number(SHIFT_SETTINGS.opening_float ?? SHIFT_SETTINGS.openingFloat ?? 0);

    const TEXTS = {
      ar:{
        ui:{
          shift:'الوردية', cashier:'الكاشير', dine_in:'صالة', delivery:'توصيل', takeaway:'تيك أواي', cashier_mode:'كاشير',
          search:'ابحث في المنيو', favorites:'المفضلة', favorites_only:'المفضلة فقط', categories:'التصنيفات', load_more:'عرض المزيد',
          indexeddb:'قاعدة البيانات المحلية', last_sync:'آخر مزامنة', never_synced:'لم تتم', sync_now:'مزامنة الآن',
          subtotal:'الإجمالي الفرعي', service:'خدمة', vat:'ضريبة', discount:'خصم', delivery_fee:'رسوم التوصيل', total:'الإجمالي المستحق',
          cart_empty:'لم يتم إضافة أصناف بعد', choose_items:'اختر صنفًا من القائمة لإضافته إلى الطلب.', tables:'الطاولات',
          select_table:'اختر طاولة لإسناد الطلب', table_status:'حالة الطاولة', table_available:'متاحة', table_occupied:'مشغولة',
          table_reserved:'محجوزة', table_maintenance:'صيانة', payments:'المدفوعات', split_payments:'تقسيم الدفعات', paid:'المدفوع',
          remaining:'المتبقي', open_payments:'تسجيل دفعة', open_reports:'فتح التقارير', reports:'التقارير', orders_count:'عدد الطلبات',
          shift_open:'فتح وردية', shift_close:'إغلاق الوردية', shift_summary:'ملخص الوردية', shift_open_prompt:'أدخل الرقم السري لفتح الوردية',
          shift_cash_start:'رصيد أول المدة', shift_cash_end:'رصيد آخر المدة', shift_total_sales:'إجمالي المبيعات',
          shift_total_dine_in:'إجمالي طلبات الصالة', shift_total_takeaway:'إجمالي طلبات التيك أواي', shift_total_delivery:'إجمالي طلبات التوصيل',
          shift_payments:'تحصيلات الوردية', shift_history:'سجل الورديات', shift_history_empty:'لا يوجد سجل ورديات بعد',
          shift_close_confirm:'إنهاء وإغلاق الوردية', shift_current:'الوردية الحالية', shift_select_history:'اختيار وردية سابقة',
          shift_open_button:'🔓 فتح وردية', shift_close_button:'🔒 إغلاق وردية', shift_orders_count:'عدد الطلبات في الوردية',
          shift_cash_summary:'ملخص النقدية', shift_cash_collected:'إجمالي النقدي خلال الوردية',
          settings_center:'إعدادات الواجهة', settings_theme:'تخصيص الثيم', settings_light:'وضع نهاري', settings_dark:'وضع ليلي',
          settings_colors:'لوحة الألوان', settings_fonts:'الخطوط', settings_color_background:'لون الخلفية', settings_color_foreground:'لون النص',
          settings_color_primary:'اللون الرئيسي', settings_color_accent:'لون التمييز', settings_color_muted:'لون ثانوي',
          settings_font_base:'حجم الخط الأساسي', settings_reset:'إعادة الضبط الافتراضي',
          refunds:'رد المدفوعات', returns:'المرتجعات',
          order_nav_label:'التنقل بين الفواتير', order_nav_open:'اذهب إلى فاتورة', order_nav_placeholder:'رقم الفاتورة أو الترتيب',
          order_nav_total:'إجمالي الفواتير', order_nav_no_history:'لا توجد فواتير محفوظة بعد',
          customer_center:'مركز العملاء', customer_search:'ابحث عن عميل', customer_search_placeholder:'الاسم أو رقم الهاتف',
          customer_tab_search:'بحث', customer_tab_create:'تكويد جديد', customer_new:'عميل جديد', customer_name:'اسم العميل',
          customer_phones:'أرقام الهاتف', customer_add_phone:'إضافة رقم', customer_remove_phone:'حذف', customer_addresses:'عناوين العميل',
          customer_add_address:'إضافة عنوان', customer_address_title:'وصف العنوان', customer_address_line:'تفاصيل العنوان',
          customer_address_notes:'ملاحظات', customer_area:'المنطقة السكنية', customer_attach:'ربط بالطلب', customer_create:'حفظ العميل',
          customer_no_results:'لا يوجد عملاء مطابقون', customer_multi_phone_hint:'يمكنك إضافة أكثر من رقم هاتف',
          customer_multi_address_hint:'يمكنك إضافة أكثر من عنوان لنفس العميل', customer_keypad:'لوحة الأرقام',
          customer_select_address:'اختر العنوان', customer_required_delivery:'مطلوب لطلبات التوصيل', customer_delivery_required:'يرجى ربط طلب التوصيل بعميل وعنوان',
          customer_edit_action:'تعديل البيانات', customer_use_existing:'اختر من العملاء', customer_form_reset:'إعادة تعيين',
          customer_edit:'تعديل العميل', customer_remove_address:'حذف العنوان',
          avg_ticket:'متوسط الفاتورة', top_selling:'الأكثر مبيعًا', sales_today:'مبيعات اليوم', save_order:'حفظ الطلب',
          settle_and_print:'تحصيل وطباعة', print:'طباعة فقط', notes:'ملاحظات', discount_action:'خصم', clear:'مسح', new_order:'طلب جديد',
          balance_due:'المتبقي غير المسدد', exchange_due:'باقي الفكة',
          line_modifiers:'الإضافات والمنزوعات', line_modifiers_title:'تعديل الإضافات والمنزوعات', line_modifiers_addons:'الإضافات', line_modifiers_removals:'المنزوعات', line_modifiers_apply:'تطبيق التعديلات', line_modifiers_empty:'لا توجد خيارات متاحة', line_modifiers_free:'بدون رسوم', line_modifiers_missing:'السطر غير متاح', line_modifiers_unit:'السعر للوحدة',
          amount:'قيمة الدفعة', capture_payment:'تأكيد الدفع', close:'إغلاق', theme:'الثيم', light:'نهاري', dark:'ليلي', language:'اللغة',
          arabic:'عربي', english:'English', service_type:'نوع الطلب', guests:'عدد الأفراد', kds:'نظام المطبخ (KDS)',
          status_online:'متصل', status_offline:'غير متصل', status_idle:'انتظار', order_id:'طلب', last_orders:'الطلبات الأخيرة',
          connect_kds:'اتصال', reconnect:'إعادة الاتصال', print_size:'مقاس الطباعة', thermal_80:'حرارية 80مم', a5:'A5', a4:'A4',
          tables_manage:'إدارة الطاولات', tables_assign:'تخصيص الطاولات', table_lock:'قفل الطاولة', table_unlock:'فك القفل',
          table_locked:'مقفلة', table_sessions:'طلبات مرتبطة', table_no_sessions:'لا توجد طلبات', table_add:'إضافة طاولة',
          table_rename:'تعديل الاسم', table_delete:'حذف الطاولة', table_status_change:'تغيير الحالة', table_status_inactive:'معطلة',
          table_status_active:'متاحة', table_status_reserved:'محجوزة', table_status_maintenance:'صيانة', table_manage_hint:'اضغط على أي طاولة للإسناد أو استخدم أدوات الإدارة.',
          table_multi_orders:'طلبات متعددة', print_profile:'ملف الطباعة', table_confirm_unlock:'هل تريد فك قفل الطاولة؟',
          table_confirm_remove:'هل تريد حذف هذه الطاولة؟', table_confirm_release:'هل تريد فك ارتباط الطلب بالطاولة؟',
          tables_filter_all:'الكل', tables_filter_free:'متاحة', tables_filter_single:'مقفلة (طلب واحد)', tables_filter_multi:'مقفلة (متعددة)',
          tables_filter_maintenance:'صيانة', tables_search_placeholder:'ابحث باسم أو رقم الطاولة', tables_details:'تفاصيل الطاولة',
          tables_zone:'منطقة', tables_capacity:'سعة', tables_state_active:'متاحة', tables_state_disactive:'معطلة',
          tables_state_maintenance:'صيانة', tables_state_free:'حرة', tables_state_single:'طلب واحد', tables_state_multi:'طلبات متعددة',
          tables_unlock_all:'فك الجميع', tables_unlock_single:'فك عن هذا الطلب', tables_assign_to_order:'إسناد للطلب الحالي',
          tables_remove_from_order:'إزالة من الطلب الحالي', tables_orders_badge:'طلبات', tables_reservations_badge:'حجوزات',
          tables_actions:'إجراءات الطاولة', tables_longpress_hint:'اضغط مطولًا لعرض التفاصيل', tables_count_label:'إجمالي الطاولات',
          reservations:'الحجوزات', reservations_manage:'إدارة الحجوزات', reservations_filter_all:'الكل', reservations_filter_booked:'محجوز',
          reservations_filter_seated:'تم الجلوس', reservations_filter_completed:'منتهٍ', reservations_filter_cancelled:'ملغي',
          reservations_filter_noshow:'لم يحضر', reservations_new:'حجز جديد', reservations_edit:'تعديل الحجز', reservations_customer:'اسم العميل',
          reservations_phone:'الهاتف', reservations_party_size:'عدد الأفراد', reservations_time:'وقت الحجز', reservations_hold_until:'الانتظار حتى',
          reservations_tables:'الطاولات المرتبطة', reservations_note:'ملاحظات', reservations_status:'الحالة',
          reservations_status_booked:'محجوز', reservations_status_seated:'تم الجلوس', reservations_status_no_show:'لم يحضر',
          reservations_status_cancelled:'ملغي', reservations_status_completed:'مكتمل', reservations_convert:'وصل العميل',
          reservations_no_show:'لم يحضر', reservations_cancel_action:'إلغاء', reservations_save:'حفظ الحجز',
          reservations_conflict:'يوجد تعارض في الوقت المحدد مع طاولة أخرى.', reservations_conflict_maintenance:'أحد الطاولات في صيانة، يرجى اختيار طاولة مختلفة.',
          reservations_conflict_lock:'الطاولة مرتبطة بطلب آخر.', reservations_tables_required:'اختر طاولة واحدة على الأقل',
          reservations_list_empty:'لا توجد حجوزات في هذا النطاق الزمني.', reservations_hold_label:'سيتم الاحتفاظ حتى',
          tables_manage_log:'سجل التعديلات', print_doc_customer:'إيصال عميل', print_doc_summary:'ملخص الطلب', print_doc_kitchen:'إرسال للمطبخ',
          print_preview:'معاينة', print_preview_expand:'تكبير المعاينة', print_preview_collapse:'تصغير المعاينة', print_send:'إرسال للطابعة', print_save_profile:'حفظ الإعدادات', print_header_store:'اسم المتجر',
          print_header_address:'العنوان', print_header_phone:'الهاتف', print_footer_thanks:'شكرًا لزيارتكم!',
          print_footer_policy:'سياسة الاستبدال خلال 24 ساعة مع الإيصال.', print_footer_feedback:'شاركنا رأيك',
          print_payments:'المدفوعات', print_change_due:'المتبقي للعميل', print_size_label:'مقاس الطباعة',
          print_printer_default:'الطابعة الافتراضية', print_printer_inside:'طابعة الصالة / الداخل', print_printer_outside:'طابعة التوصيل / الخارج',
          print_printer_placeholder:'اكتب اسم الطابعة', print_printer_hint:'يمكنك كتابة اسم الطابعة تمامًا كما يظهر في النظام.',
          print_printers_info:'لا يستطيع المتصفح مشاركة أسماء الطابعات تلقائيًا بدون حوار الطباعة، لذا اختر الطابعة يدويًا لكل ملف.',
          print_copies:'عدد النسخ', print_duplicate_inside:'نسخة للداخل', print_duplicate_outside:'نسخة للخارج',
          print_auto_send:'إرسال مباشر للطابعة الحرارية', print_show_preview:'عرض المعاينة قبل الطباعة',
          print_show_advanced:'إظهار الإعدادات المتقدمة', print_hide_advanced:'إخفاء الإعدادات المتقدمة',
          print_manage_printers:'إدارة الطابعات', print_manage_hide:'إخفاء إدارة الطابعات', print_manage_title:'قائمة الطابعات المحفوظة',
          print_manage_add:'إضافة طابعة', print_manage_placeholder:'أدخل اسم الطابعة كما يظهر في النظام',
          print_manage_empty:'لا توجد طابعات محفوظة بعد', print_browser_preview:'طباعة عبر المتصفح',
          print_printer_select:'اختر الطابعة للطباعة السريعة', print_printers_manage_hint:'حدث قائمة الطابعات لتسهيل الوصول السريع.',
          receipt_15:'رول ‎15 سم‎', export_pdf:'تصدير PDF',
          orders_queue:'الطلبات المفتوحة', orders_queue_hint:'الطلبات المعلقة/المفتوحة', orders_queue_empty:'لا توجد طلبات في الانتظار.',
          orders_queue_open:'فتح الطلب', orders_queue_status_open:'مفتوح', orders_queue_status_held:'معلّق',
          orders_tab_all:'كل الطلبات', orders_tab_dine_in:'طلبات الصالة', orders_tab_delivery:'طلبات الدليفري', orders_tab_takeaway:'طلبات التيك أواي',
          orders_stage:'المرحلة', orders_status:'الحالة', orders_type:'نوع الطلب', orders_total:'الإجمالي', orders_updated:'آخر تحديث',
          orders_payment:'حالة الدفع', orders_line_count:'عدد الأصناف', orders_notes:'ملاحظات', orders_search_placeholder:'ابحث برقم الطلب أو الطاولة أو القسم',
          orders_refresh:'تحديث القائمة', orders_no_results:'لا توجد طلبات متاحة في هذه القائمة.',
          tables_bulk_activate:'تفعيل', tables_bulk_maintenance:'وضع صيانة'
        },
        toast:{
          item_added:'تمت إضافة الصنف', quantity_updated:'تم تحديث الكمية', cart_cleared:'تم مسح الطلب',
          order_saved:'تم حفظ الطلب محليًا', sync_complete:'تم تحديث المزامنة', payment_recorded:'تم تسجيل الدفعة',
          amount_required:'من فضلك أدخل قيمة صحيحة', indexeddb_missing:'IndexedDB غير متاحة في هذا المتصفح',
          indexeddb_error:'تعذر حفظ البيانات محليًا', print_stub:'سيتم التكامل مع الطابعة لاحقًا',
          discount_stub:'سيتم تفعيل الخصومات لاحقًا', notes_updated:'تم تحديث الملاحظات', add_note:'أدخل ملاحظة ترسل للمطبخ',
          set_qty:'أدخل الكمية الجديدة', line_actions:'سيتم فتح إجراءات السطر لاحقًا', line_modifiers_applied:'تم تحديث الإضافات والمنزوعات', confirm_clear:'هل تريد مسح الطلب الحالي؟',
          order_locked:'لا يمكن تعديل هذا الطلب بعد حفظه', line_locked:'لا يمكن تعديل هذا السطر بعد حفظه',
          order_additions_blocked:'لا يمكن إضافة أصناف جديدة لهذا النوع من الطلبات بعد الحفظ',
          order_stage_locked:'لا يمكن تعديل الأصناف في هذه المرحلة', orders_loaded:'تم تحديث قائمة الطلبات',
          orders_failed:'تعذر تحميل الطلبات',
          customer_saved:'تم حفظ بيانات العميل', customer_attach_success:'تم ربط العميل بالطلب',
          customer_missing_selection:'اختر عميلًا أولًا', customer_missing_address:'اختر عنوانًا لهذا العميل', customer_form_invalid:'أكمل الاسم ورقم الهاتف',
          new_order:'تم إنشاء طلب جديد', order_type_changed:'تم تغيير نوع الطلب', table_assigned:'تم اختيار الطاولة',
          merge_stub:'قريبًا دمج الطاولات', load_more_stub:'سيتم تحميل المزيد من الأصناف لاحقًا', indexeddb_syncing:'جاري المزامنة مع IndexedDB',
          theme_switched:'تم تغيير الثيم', lang_switched:'تم تغيير اللغة', logout_stub:'تم إنهاء الوردية افتراضيًا',
          kdsConnected:'تم الاتصال بالمطبخ', kdsClosed:'تم إغلاق الاتصال بالمطبخ', kdsFailed:'فشل الاتصال بالمطبخ',
          kdsUnavailable:'متصفحك لا يدعم WebSocket', kdsPong:'تم استقبال إشارة من المطبخ',
          table_locked_other:'الطاولة مقفلة لطلب آخر', table_locked_now:'تم قفل الطاولة على الطلب الحالي',
          table_unlocked:'تم فك قفل الطاولة', table_updated:'تم تحديث بيانات الطاولة', table_removed:'تم حذف الطاولة',
          table_added:'تم إنشاء طاولة جديدة', table_inactive_assign:'لا يمكن اختيار طاولة معطلة',
          table_sessions_cleared:'تم فك ارتباط الطلب بالطاولة', print_size_switched:'تم تحديث مقاس الطباعة',
          table_invalid_seats:'رجاء إدخال عدد مقاعد صالح', table_name_required:'يجب إدخال اسم للطاولة',
          table_has_sessions:'لا يمكن حذف طاولة عليها طلبات', table_state_updated:'تم تحديث حالة الطاولة',
          table_unlock_partial:'تم فك قفل الطاولة للطلب المحدد', reservation_created:'تم إنشاء الحجز', reservation_updated:'تم تحديث الحجز',
          reservation_cancelled:'تم إلغاء الحجز', reservation_converted:'تم تحويل الحجز إلى طلب', reservation_no_show:'تم وسم الحجز بعدم الحضور',
          print_profile_saved:'تم حفظ إعدادات الطباعة', print_sent:'تم إرسال أمر الطباعة', pdf_exported:'تم تجهيز نسخة PDF للحفظ',
          printer_added:'تمت إضافة الطابعة', printer_removed:'تمت إزالة الطابعة', printer_exists:'الطابعة موجودة بالفعل',
          printer_name_required:'يرجى إدخال اسم الطابعة', browser_popup_blocked:'يرجى السماح بالنوافذ المنبثقة لإتمام التصدير',
          browser_print_opened:'تم فتح أداة الطباعة في المتصفح', shift_open_success:'تم فتح الوردية بنجاح',
          shift_close_success:'تم إغلاق الوردية بنجاح', shift_pin_invalid:'الرقم السري غير صحيح',
          shift_required:'يجب فتح الوردية قبل حفظ الطلب', order_nav_not_found:'لم يتم العثور على فاتورة بهذا الرقم'
        }
      },
      en:{
        ui:{
          shift:'Shift', cashier:'Cashier', dine_in:'Dine-in', delivery:'Delivery', takeaway:'Takeaway', cashier_mode:'Counter',
          search:'Search menu', favorites:'Favorites', favorites_only:'Only favorites', categories:'Categories', load_more:'Load more',
          indexeddb:'Local database', last_sync:'Last sync', never_synced:'Never', sync_now:'Sync now', subtotal:'Subtotal',
          service:'Service', vat:'VAT', discount:'Discount', delivery_fee:'Delivery fee', total:'Amount due',
          cart_empty:'No items added yet', choose_items:'Pick an item from the menu to start the order.', tables:'Tables',
          select_table:'Select a table for this order', table_status:'Table status', table_available:'Available', table_occupied:'Occupied',
          table_reserved:'Reserved', table_maintenance:'Maintenance', payments:'Payments', split_payments:'Split payments', paid:'Paid',
          remaining:'Remaining', open_payments:'Add payment', open_reports:'Open reports', reports:'Reports', orders_count:'Orders',
          shift_open:'Open shift', shift_close:'Close shift', shift_summary:'Shift summary', shift_open_prompt:'Enter the PIN to open the shift',
          shift_cash_start:'Opening cash', shift_cash_end:'Closing cash', shift_total_sales:'Total sales',
          shift_total_dine_in:'Dine-in total', shift_total_takeaway:'Takeaway total', shift_total_delivery:'Delivery total',
          shift_payments:'Shift payments', shift_history:'Shift history', shift_history_empty:'No shift history yet',
          shift_close_confirm:'Finish and close shift', shift_current:'Active shift', shift_select_history:'Select a previous shift',
          shift_open_button:'🔓 Open shift', shift_close_button:'🔒 Close shift', shift_orders_count:'Orders this shift',
          shift_cash_summary:'Cash drawer summary', shift_cash_collected:'Cash collected',
          settings_center:'Settings', settings_theme:'Theme customization', settings_light:'Light mode', settings_dark:'Dark mode',
          settings_colors:'Colors', settings_fonts:'Typography', settings_color_background:'Background', settings_color_foreground:'Foreground',
          settings_color_primary:'Primary color', settings_color_accent:'Accent color', settings_color_muted:'Muted tone',
          settings_font_base:'Base font size', settings_reset:'Reset to defaults',
          refunds:'Refunds', returns:'Returns',
          order_nav_label:'Invoice navigator', order_nav_open:'Go to invoice', order_nav_placeholder:'Invoice number or index',
          order_nav_total:'Total invoices', order_nav_no_history:'No saved invoices yet',
          customer_center:'Customer hub', customer_search:'Search customers', customer_search_placeholder:'Name or phone number',
          customer_tab_search:'Search', customer_tab_create:'New customer', customer_new:'New customer', customer_name:'Customer name',
          customer_phones:'Phone numbers', customer_add_phone:'Add phone', customer_remove_phone:'Remove', customer_addresses:'Customer addresses',
          customer_add_address:'Add address', customer_address_title:'Address label', customer_address_line:'Address details',
          customer_address_notes:'Notes', customer_area:'Area', customer_attach:'Link to order', customer_create:'Save customer',
          customer_no_results:'No matching customers', customer_multi_phone_hint:'Store more than one phone per customer',
          customer_multi_address_hint:'Store multiple delivery addresses per customer', customer_keypad:'Keypad',
          customer_select_address:'Select address', customer_required_delivery:'Required for delivery orders', customer_delivery_required:'Please link delivery orders to a customer and address',
          customer_edit_action:'Edit details', customer_use_existing:'Choose an existing customer', customer_form_reset:'Reset form',
          customer_edit:'Edit customer', customer_remove_address:'Remove address',
          avg_ticket:'Average ticket', top_selling:'Top seller', sales_today:'Sales today', save_order:'Save order',
          settle_and_print:'Settle & print', print:'Print only', notes:'Notes', discount_action:'Discount', clear:'Clear',
          new_order:'New order', balance_due:'Outstanding balance', exchange_due:'Change due', line_modifiers:'Add-ons & removals', line_modifiers_title:'Customize add-ons & removals', line_modifiers_addons:'Add-ons', line_modifiers_removals:'Removals', line_modifiers_apply:'Apply changes', line_modifiers_empty:'No options available', line_modifiers_free:'No charge', line_modifiers_missing:'Line is no longer available', line_modifiers_unit:'Unit price', amount:'Payment amount', capture_payment:'Capture payment', close:'Close', theme:'Theme',
          light:'Light', dark:'Dark', language:'Language', arabic:'Arabic', english:'English', service_type:'Service type',
          guests:'Guests', kds:'Kitchen display', status_online:'Online', status_offline:'Offline', status_idle:'Idle',
          order_id:'Order', last_orders:'Recent orders', connect_kds:'Connect', reconnect:'Reconnect', print_size:'Print size',
          thermal_80:'Thermal 80mm', a5:'A5', a4:'A4', tables_manage:'Table management', tables_assign:'Assign tables',
          table_lock:'Lock table', table_unlock:'Unlock table', table_locked:'Locked', table_sessions:'Linked orders',
          table_no_sessions:'No orders yet', table_add:'Add table', table_rename:'Rename table', table_delete:'Remove table',
          table_status_change:'Change status', table_status_inactive:'Inactive', table_status_active:'Available',
          table_status_reserved:'Reserved', table_status_maintenance:'Maintenance', table_manage_hint:'Tap a table to assign it or use the tools below.',
          table_multi_orders:'Multi orders', print_profile:'Print profile', table_confirm_unlock:'Unlock this table?',
          table_confirm_remove:'Remove this table?', table_confirm_release:'Unlink the order from the table?',
          tables_filter_all:'All', tables_filter_free:'Free', tables_filter_single:'Locked (single)', tables_filter_multi:'Locked (multi)',
          tables_filter_maintenance:'Maintenance', tables_search_placeholder:'Search by table name or number', tables_details:'Table details',
          tables_zone:'Zone', tables_capacity:'Capacity', tables_state_active:'Active', tables_state_disactive:'Inactive',
          tables_state_maintenance:'Maintenance', tables_state_free:'Free', tables_state_single:'Single lock', tables_state_multi:'Multi lock',
          tables_unlock_all:'Unlock all', tables_unlock_single:'Unlock current order', tables_assign_to_order:'Assign to current order',
          tables_remove_from_order:'Remove from this order', tables_orders_badge:'Orders', tables_reservations_badge:'Reservations',
          tables_actions:'Table actions', tables_longpress_hint:'Long press to view details', tables_count_label:'Total tables',
          reservations:'Reservations', reservations_manage:'Manage reservations', reservations_filter_all:'All', reservations_filter_booked:'Booked',
          reservations_filter_seated:'Seated', reservations_filter_completed:'Completed', reservations_filter_cancelled:'Cancelled',
          reservations_filter_noshow:'No-show', reservations_new:'New reservation', reservations_edit:'Edit reservation', reservations_customer:'Customer name',
          reservations_phone:'Phone', reservations_party_size:'Party size', reservations_time:'Reservation time', reservations_hold_until:'Hold until',
          reservations_tables:'Linked tables', reservations_note:'Notes', reservations_status:'Status',
          reservations_status_booked:'Booked', reservations_status_seated:'Seated', reservations_status_no_show:'No-show',
          reservations_status_cancelled:'Cancelled', reservations_status_completed:'Completed', reservations_convert:'Guest arrived',
          reservations_no_show:'Mark no-show', reservations_cancel_action:'Cancel', reservations_save:'Save reservation',
          reservations_conflict:'Conflict detected with selected tables.', reservations_conflict_maintenance:'One of the tables is under maintenance.',
          reservations_conflict_lock:'Table currently locked by another order.', reservations_tables_required:'Select at least one table',
          reservations_list_empty:'No reservations for this time range.', reservations_hold_label:'Hold until',
          tables_manage_log:'Audit trail', print_doc_customer:'Customer receipt', print_doc_summary:'Order summary', print_doc_kitchen:'Kitchen chit',
          print_preview:'Preview', print_preview_expand:'Expand preview', print_preview_collapse:'Collapse preview', print_send:'Send to printer', print_save_profile:'Save settings', print_header_store:'Store name',
          print_header_address:'Address', print_header_phone:'Phone', print_footer_thanks:'Thanks for visiting!',
          print_footer_policy:'Exchange within 24h with receipt.', print_footer_feedback:'Share your feedback',
          print_payments:'Payments', print_change_due:'Change due', print_size_label:'Print size',
          print_printer_default:'Default printer', print_printer_inside:'Inside / dining printer', print_printer_outside:'Delivery / outside printer',
          print_printer_placeholder:'Type printer name', print_printer_hint:'Type the printer name exactly as it appears on the system.',
          print_printers_info:'Browsers only expose printer names through the print dialog. Configure the matching printer manually for each profile.',
          print_copies:'Copies', print_duplicate_inside:'Duplicate for inside', print_duplicate_outside:'Duplicate for outside',
          print_auto_send:'Auto send to thermal printer', print_show_preview:'Show preview before printing',
          print_show_advanced:'Show advanced settings', print_hide_advanced:'Hide advanced settings',
          print_manage_printers:'Manage printers', print_manage_hide:'Hide printer manager', print_manage_title:'Saved printers',
          print_manage_add:'Add printer', print_manage_placeholder:'Enter the printer name exactly as the OS shows it',
          print_manage_empty:'No saved printers yet', print_browser_preview:'Browser print dialog',
          print_printer_select:'Pick the printer for quick printing', print_printers_manage_hint:'Maintain the printer names you rely on here.',
          receipt_15:'15 cm roll', export_pdf:'Export PDF',
          orders_queue:'Open orders', orders_queue_hint:'Held / open orders in progress', orders_queue_empty:'No orders waiting.',
          orders_queue_open:'Open order', orders_queue_status_open:'Open', orders_queue_status_held:'Held',
          orders_tab_all:'All orders', orders_tab_dine_in:'Dining room', orders_tab_delivery:'Delivery', orders_tab_takeaway:'Takeaway',
          orders_stage:'Stage', orders_status:'Status', orders_type:'Order type', orders_total:'Total due', orders_updated:'Last update',
          orders_payment:'Payment state', orders_line_count:'Line items', orders_notes:'Notes', orders_search_placeholder:'Search by order, table or section',
          orders_refresh:'Refresh list', orders_no_results:'No orders match the current filters.',
          tables_bulk_activate:'Activate', tables_bulk_maintenance:'Mark maintenance'
        },
        toast:{
          item_added:'Item added to cart', quantity_updated:'Quantity updated', cart_cleared:'Cart cleared',
          order_saved:'Order stored locally', sync_complete:'Sync completed', payment_recorded:'Payment recorded',
          amount_required:'Enter a valid amount', indexeddb_missing:'IndexedDB is not available in this browser',
          indexeddb_error:'Failed to persist locally', print_stub:'Printer integration coming soon',
          discount_stub:'Discount workflow coming soon', notes_updated:'Notes updated', add_note:'Add a note for the kitchen',
          set_qty:'Enter the new quantity', line_actions:'Line actions coming soon', line_modifiers_applied:'Line modifiers updated', confirm_clear:'Clear the current order?',
          order_locked:'This order is locked after saving', line_locked:'This line can no longer be modified',
          order_additions_blocked:'Cannot add new items to this order type after saving',
          order_stage_locked:'Items cannot be modified at this stage', orders_loaded:'Orders list refreshed',
          orders_failed:'Failed to load orders',
          customer_saved:'Customer saved successfully', customer_attach_success:'Customer linked to order',
          customer_missing_selection:'Select a customer first', customer_missing_address:'Select an address for this customer', customer_form_invalid:'Please enter name and phone number',
          new_order:'New order created', order_type_changed:'Order type changed', table_assigned:'Table assigned',
          merge_stub:'Table merge coming soon', load_more_stub:'Menu pagination coming soon', indexeddb_syncing:'Syncing with IndexedDB…',
          theme_switched:'Theme updated', lang_switched:'Language updated', logout_stub:'Session ended (stub)',
          kdsConnected:'Connected to kitchen', kdsClosed:'Kitchen connection closed', kdsFailed:'Kitchen connection failed',
          kdsUnavailable:'WebSocket not supported', kdsPong:'KDS heartbeat received',
          table_locked_other:'Table is locked by another order', table_locked_now:'Table locked for this order',
          table_unlocked:'Table unlocked', table_updated:'Table details updated', table_removed:'Table removed',
          table_added:'New table added', table_inactive_assign:'Inactive tables cannot be assigned',
          table_sessions_cleared:'Order unlinked from table', print_size_switched:'Print size updated',
          table_invalid_seats:'Please enter a valid seat count', table_name_required:'Table name is required',
          table_has_sessions:'Cannot remove a table with linked orders', table_state_updated:'Table state updated',
          table_unlock_partial:'Table unlocked for the selected order', reservation_created:'Reservation created', reservation_updated:'Reservation updated',
          reservation_cancelled:'Reservation cancelled', reservation_converted:'Reservation converted to order', reservation_no_show:'Reservation marked as no-show',
          print_profile_saved:'Print profile saved', print_sent:'Print job sent', pdf_exported:'PDF export is ready',
          printer_added:'Printer added', printer_removed:'Printer removed', printer_exists:'Printer already exists',
          printer_name_required:'Please enter a printer name', browser_popup_blocked:'Allow pop-ups to finish the export',
          browser_print_opened:'Browser print dialog opened', shift_open_success:'Shift opened successfully', shift_close_success:'Shift closed successfully',
          shift_pin_invalid:'Invalid PIN', shift_required:'Please open a shift before saving the order', order_nav_not_found:'No invoice matches that number'
        }
      }
    };

    function getTexts(db){
      return TEXTS[db.env.lang] || TEXTS.ar;
    }

    function localize(value, lang){
      if(value == null) return '';
      if(typeof value === 'string') return value;
      if(typeof value === 'object'){
        return value[lang] || value.ar || value.en || Object.values(value)[0] || '';
      }
      return String(value);
    }

    function escapeHTML(value){
      if(value == null) return '';
      const map = {
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;'
      };
      map['"'] = '&quot;';
      map['\''] = '&#39;';
      return String(value).replace(/[&<>"']/g, ch=> map[ch]);
    }

    function getCurrency(db){
      return currencyCode;
    }

    function getCurrencySymbol(db){
      const lang = db.env?.lang || (db.env && db.env.lang) || document.documentElement.lang || 'ar';
      return currencySymbols[lang] || currencySymbols.en || currencyCode;
    }

    function getLocale(db){
      return db.env.lang === 'ar' ? 'ar-EG' : 'en-US';
    }

    function formatCurrencyValue(db, amount){
      try{
        return new Intl.NumberFormat(getLocale(db), { style:'currency', currency:getCurrency(db) }).format(Number(amount)||0);
      } catch(_){
        const numeric = (Number(amount)||0).toFixed(2);
        return `${numeric} ${getCurrencySymbol(db)}`;
      }
    }

    function round(value){
      return Math.round((Number(value) || 0) * 100) / 100;
    }

    function getLineUnitPrice(line){
      if(!line) return 0;
      const base = Number(line.basePrice != null ? line.basePrice : line.price) || 0;
      const modifiers = Array.isArray(line.modifiers) ? line.modifiers : [];
      const modifierDelta = modifiers.reduce((sum, mod)=> sum + (Number(mod.priceChange ?? mod.price_change ?? 0) || 0), 0);
      return round(base + modifierDelta);
    }

    function applyLinePricing(line){
      if(!line) return line;
      const unitPrice = getLineUnitPrice(line);
      const qty = Number(line.qty) || 0;
      const base = Number(line.basePrice != null ? line.basePrice : line.price) || 0;
      return {
        ...line,
        basePrice: round(base),
        price: unitPrice,
        total: round(unitPrice * qty)
      };
    }

    function updateLineWithPricing(line, updates){
      if(!line) return line;
      return applyLinePricing({ ...line, ...(updates || {}) });
    }

    function calculateTotals(lines, cfg, type){
      const subtotal = (lines || []).reduce((sum, line)=>{
        const qty = Number(line.qty) || 0;
        const unit = getLineUnitPrice(line);
        const fallbackTotal = Number(line.total);
        if(Number.isFinite(fallbackTotal)) return sum + fallbackTotal;
        return sum + qty * unit;
      }, 0);
      const serviceRate = type === 'dine_in' ? (cfg.service_charge_rate || 0) : 0;
      const service = subtotal * serviceRate;
      const vatBase = subtotal + service;
      const vat = vatBase * (cfg.tax_rate || 0);
      const deliveryFee = type === 'delivery' ? (cfg.default_delivery_fee || 0) : 0;
      const discount = 0;
      const due = subtotal + service + vat + deliveryFee - discount;
      return {
        subtotal: round(subtotal),
        service: round(service),
        vat: round(vat),
        discount: round(discount),
        deliveryFee: round(deliveryFee),
        due: round(due)
      };
    }

    function normalizeOrderTypeId(value){
      if(!value) return 'dine_in';
      const normalized = String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
      return ORDER_TYPE_IDS.has(normalized) ? normalized : normalized || 'dine_in';
    }

    function summarizeShiftOrders(history, shift){
      if(!shift) return { totalsByType:{}, paymentsByMethod:{}, totalSales:0, orders:[], ordersCount:0, countsByType:{} };
      const shiftId = shift.id;
      const historyList = Array.isArray(history) ? history : [];
      const orders = [];
      const totalsAccumulator = {};
      const paymentsAccumulator = {};
      const paymentEntries = [];
      const countsAccumulator = {};
      if(shiftId){
        historyList.forEach(order=>{
          if(!order || order.shiftId !== shiftId) return;
          const total = round(order?.totals?.due || 0);
          const typeKey = normalizeOrderTypeId(order?.type || order?.header?.type_id || 'dine_in');
          totalsAccumulator[typeKey] = round((totalsAccumulator[typeKey] || 0) + total);
          countsAccumulator[typeKey] = (countsAccumulator[typeKey] || 0) + 1;
          const payments = Array.isArray(order?.payments) ? order.payments : [];
          payments.forEach(payment=>{
            if(!payment) return;
            const methodKey = String(payment.method || payment.id || 'cash');
            const amount = round(payment.amount || 0);
            paymentsAccumulator[methodKey] = round((paymentsAccumulator[methodKey] || 0) + amount);
            paymentEntries.push({
              id: payment.id || `${order.id}-${methodKey}-${paymentEntries.length+1}`,
              method: methodKey,
              amount,
              orderId: order.id,
              capturedAt: order.savedAt || order.updatedAt || order.createdAt || Date.now()
            });
          });
          orders.push({
            id: order.id,
            total,
            savedAt: order.savedAt || order.updatedAt || order.createdAt || Date.now(),
            type: typeKey
          });
        });
      }
      if(!orders.length && Array.isArray(shift.orders) && shift.orders.length){
        shift.orders.forEach((entry, idx)=>{
          if(!entry) return;
          if(typeof entry === 'string'){
            const typeKey = 'dine_in';
            countsAccumulator[typeKey] = (countsAccumulator[typeKey] || 0) + 1;
            orders.push({
              id: entry,
              total: 0,
              savedAt: shift.closedAt || shift.openedAt || Date.now(),
              type: typeKey
            });
          } else {
            const typeKey = normalizeOrderTypeId(entry.type || entry.orderType || entry.type_id || 'dine_in');
            const total = round(entry.total || entry.amount || 0);
            totalsAccumulator[typeKey] = round((totalsAccumulator[typeKey] || 0) + total);
            countsAccumulator[typeKey] = (countsAccumulator[typeKey] || 0) + 1;
            orders.push({
              id: entry.id || entry.orderId || `order-${idx+1}`,
              total,
              savedAt: entry.savedAt || entry.updatedAt || shift.closedAt || shift.openedAt || Date.now(),
              type: typeKey
            });
          }
        });
      }
      const totalsKeys = new Set([
        ...Object.keys(shift.totalsByType || {}),
        ...Object.keys(totalsAccumulator)
      ]);
      const totalsByType = {};
      if(totalsKeys.size === 0){
        ORDER_TYPES.forEach(type=>{ totalsByType[type.id] = 0; });
      } else {
        totalsKeys.forEach(key=>{
          const typeKey = normalizeOrderTypeId(key);
          const computed = totalsAccumulator[typeKey];
          const fallback = shift.totalsByType?.[typeKey];
          if(computed != null){
            totalsByType[typeKey] = round(computed);
          } else if(fallback != null){
            totalsByType[typeKey] = round(fallback);
          }
        });
      }
      const paymentKeys = new Set([
        ...Object.keys(shift.paymentsByMethod || {}),
        ...Object.keys(paymentsAccumulator)
      ]);
      const paymentsByMethod = {};
      paymentKeys.forEach(key=>{
        const computed = paymentsAccumulator[key];
        const fallback = shift.paymentsByMethod?.[key];
        if(computed != null){
          paymentsByMethod[key] = round(computed);
        } else if(fallback != null){
          paymentsByMethod[key] = round(fallback);
        }
      });
      const countKeys = new Set([
        ...Object.keys(shift.countsByType || {}),
        ...Object.keys(countsAccumulator)
      ]);
      const countsByType = {};
      countKeys.forEach(key=>{
        const typeKey = normalizeOrderTypeId(key);
        if(countsAccumulator[typeKey] != null){
          countsByType[typeKey] = countsAccumulator[typeKey];
        } else if(shift.countsByType && shift.countsByType[typeKey] != null){
          countsByType[typeKey] = shift.countsByType[typeKey];
        }
      });
      const totalSales = orders.length
        ? round(orders.reduce((sum, entry)=> sum + (Number(entry.total)||0), 0))
        : round(shift.totalSales || 0);
      const ordersCount = orders.length
        ? orders.length
        : (typeof shift.ordersCount === 'number'
            ? shift.ordersCount
            : (Array.isArray(shift.orders) ? shift.orders.length : 0));
      const ordersList = orders.length
        ? orders
        : (Array.isArray(shift.orders)
            ? shift.orders.map(entry=> typeof entry === 'object' ? { ...entry } : { id: entry, total: 0, savedAt: shift.closedAt || shift.openedAt || Date.now(), type:'dine_in' })
            : []);
      return {
        totalsByType,
        paymentsByMethod,
        totalSales,
        orders: ordersList,
        ordersCount,
        countsByType,
        payments: paymentEntries,
        refunds: Array.isArray(shift.refunds) ? shift.refunds.map(item=> ({ ...item })) : [],
        returns: Array.isArray(shift.returns) ? shift.returns.map(item=> ({ ...item })) : []
      };
    }

    function computeRealtimeReports(db){
      const history = Array.isArray(db.data.ordersHistory) ? db.data.ordersHistory : [];
      const now = Date.now();
      const start = new Date(now);
      start.setHours(0,0,0,0);
      const startTs = start.getTime();
      const endTs = startTs + 24 * 60 * 60 * 1000;
      let salesToday = 0;
      let ordersCount = 0;
      const itemCounter = new Map();
      history.forEach(order=>{
        if(!order) return;
        const savedAt = order.savedAt || order.updatedAt || order.createdAt;
        if(savedAt == null) return;
        if(savedAt < startTs || savedAt >= endTs) return;
        const amount = Number(order?.totals?.due || order.total || 0);
        if(Number.isFinite(amount)){
          salesToday += amount;
        }
        ordersCount += 1;
        const lines = Array.isArray(order.lines) ? order.lines : [];
        lines.forEach(line=>{
          if(!line) return;
          const key = line.itemId || line.name?.en || line.name?.ar || line.name;
          if(!key) return;
          const qty = Number(line.qty) || 0;
          itemCounter.set(key, (itemCounter.get(key) || 0) + qty);
        });
      });
      let topItemId = null;
      let maxQty = 0;
      itemCounter.forEach((qty, key)=>{
        if(qty > maxQty){
          maxQty = qty;
          topItemId = key;
        }
      });
      const avgTicket = ordersCount ? salesToday / ordersCount : 0;
      return {
        salesToday: round(salesToday),
        ordersCount,
        avgTicket: round(avgTicket),
        topItemId
      };
    }

    function createOrderLine(item, qty, overrides){
      const quantity = qty || 1;
      const price = Number(item.price) || 0;
      const now = Date.now();
      const uniqueId = overrides?.id || `ln-${item.id}-${now.toString(36)}-${Math.random().toString(16).slice(2,6)}`;
      const baseLine = {
        id: uniqueId,
        itemId: item.id,
        name: item.name,
        description: item.description,
        price,
        basePrice: price,
        qty: quantity,
        total: round(price * quantity),
        modifiers: overrides?.modifiers || [],
        notes: overrides?.notes || [],
        status: overrides?.status || 'draft',
        stage: overrides?.stage || 'new',
        kitchenSection: overrides?.kitchenSection || item.kitchenSection || null,
        locked: overrides?.locked || false,
        createdAt: overrides?.createdAt || now,
        updatedAt: overrides?.updatedAt || now
      };
      return applyLinePricing(baseLine);
    }

    function filterMenu(menu, lang){
      const term = (menu.search || '').trim().toLowerCase();
      const favorites = new Set((menu.favorites || []).map(String));
      return (menu.items || []).filter(item=>{
        if(menu.showFavoritesOnly && !favorites.has(String(item.id))) return false;
        const inCategory = menu.category === 'all' || item.category === menu.category;
        if(!inCategory) return false;
        if(!term) return true;
        const name = localize(item.name, lang).toLowerCase();
        const desc = localize(item.description, lang).toLowerCase();
        return name.includes(term) || desc.includes(term);
      });
    }

    function formatSync(ts, lang){
      if(!ts) return null;
      try{
        const formatter = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
        return formatter.format(new Date(ts));
      } catch(_){
        return new Date(ts).toLocaleTimeString();
      }
    }

    function formatDateTime(ts, lang, options){
      if(!ts) return '';
      try{
        const locale = lang === 'ar' ? 'ar-EG' : 'en-GB';
        const formatter = new Intl.DateTimeFormat(locale, options || { hour:'2-digit', minute:'2-digit' });
        return formatter.format(new Date(ts));
      } catch(_){
        return new Date(ts).toLocaleString();
      }
    }

    function renderPrintableHTML(db, docType, size){
      const t = getTexts(db);
      const order = db.data.order || {};
      const lang = db.env.lang;
      const tablesNames = (order.tableIds || []).map(id=>{
        const table = (db.data.tables || []).find(tbl=> tbl.id === id);
        return table?.name || id;
      });
      const splitState = Array.isArray(db.data.payments?.split) ? db.data.payments.split : [];
      const orderPayments = Array.isArray(order.payments) ? order.payments : [];
      const payments = splitState.length ? splitState : orderPayments;
      const methodsCatalog = (db.data.payments?.methods && db.data.payments.methods.length)
        ? db.data.payments.methods
        : PAYMENT_METHODS;
      const methodsMap = new Map(methodsCatalog.map(method=> [method.id, method]));
      const totalPaid = payments.reduce((sum, entry)=> sum + (Number(entry.amount)||0), 0);
      const due = order.totals?.due || 0;
      const changeDue = Math.max(0, round(totalPaid - due));
      const totalsRows = [
        { label:t.ui.subtotal, value: order.totals?.subtotal || 0 },
        order.totals?.service ? { label:t.ui.service, value: order.totals.service } : null,
        { label:t.ui.vat, value: order.totals?.vat || 0 },
        order.totals?.deliveryFee ? { label:t.ui.delivery_fee, value: order.totals.deliveryFee } : null,
        order.totals?.discount ? { label:t.ui.discount, value: order.totals.discount } : null
      ].filter(Boolean);
      const docLabels = {
        customer: t.ui.print_doc_customer,
        summary: t.ui.print_doc_summary,
        kitchen: t.ui.print_doc_kitchen
      };
      const currentDocLabel = docLabels[docType] || t.ui.print_doc_customer;
      const lineItems = (order.lines || []).map(line=>{
        const name = `${escapeHTML(localize(line.name, lang))} × ${Number(line.qty)||0}`;
        const price = formatCurrencyValue(db, line.total);
        const modifiers = Array.isArray(line.modifiers) ? line.modifiers : [];
        const modifiersHtml = modifiers.map(mod=>{
          const delta = Number(mod.priceChange || 0) || 0;
          const priceLabel = delta ? `${delta > 0 ? '+' : '−'} ${formatCurrencyValue(db, Math.abs(delta))}` : escapeHTML(t.ui.line_modifiers_free);
          return `<div class="row sub"><span>${escapeHTML(localize(mod.label, lang))}</span><span>${priceLabel}</span></div>`;
        }).join('');
        const notes = Array.isArray(line.notes) ? line.notes.filter(Boolean).join(' • ') : (line.notes || '');
        const notesHtml = notes ? `<div class="row note"><span>📝 ${escapeHTML(notes)}</span><span></span></div>` : '';
        return `<div class="row"><span>${name}</span><span>${price}</span></div>${modifiersHtml}${notesHtml}`;
      }).join('');
      const totalsHtml = totalsRows.map(row=> {
        const price = formatCurrencyValue(db, row.value);
        return `<div class="row"><span>${escapeHTML(row.label)}</span><span>${price}</span></div>`;
      }).join('');
      const paymentsHtml = payments.map(entry=>{
        const method = methodsMap.get(entry.method);
        const label = method ? `${escapeHTML(localize(method.label, lang))}` : escapeHTML(entry.method || '');
        const price = formatCurrencyValue(db, entry.amount);
        return `<div class="row"><span>${label}</span><span>${price}</span></div>`;
      }).join('');
      const sizePresets = {
        thermal_80:{ width:'72mm', maxWidth:'72mm', padding:'18px 16px', fontSize:'13px', heading:'20px', meta:'12px', total:'16px', bodyBg:'#f4f7fb', border:'1px solid #dbeafe', radius:'20px', shadow:'0 18px 40px rgba(15,23,42,0.12)', page:'@page { size: 80mm auto; margin:4mm; }', bodyPadding:'18px' },
        receipt_15:{ width:'150mm', maxWidth:'150mm', padding:'24px 20px', fontSize:'13px', heading:'22px', meta:'13px', total:'18px', bodyBg:'#f5f8ff', border:'1px dashed #cbd5f5', radius:'28px', shadow:'0 22px 50px rgba(15,23,42,0.14)', page:'@page { size: 150mm auto; margin:6mm; }', bodyPadding:'24px' },
        a5:{ width:'100%', maxWidth:'720px', padding:'28px 32px', fontSize:'15px', heading:'26px', meta:'15px', total:'20px', bodyBg:'#f8fafc', border:'1px solid #dbe4f3', radius:'32px', shadow:'0 26px 64px rgba(15,23,42,0.18)', page:'@page { size: A5 landscape; margin:12mm; }', bodyPadding:'36px' },
        a4:{ width:'100%', maxWidth:'860px', padding:'32px 40px', fontSize:'16px', heading:'28px', meta:'16px', total:'22px', bodyBg:'#ffffff', border:'1px solid #d0dae8', radius:'36px', shadow:'0 30px 70px rgba(15,23,42,0.2)', page:'@page { size: A4 portrait; margin:18mm; }', bodyPadding:'48px' }
      };
      const preset = sizePresets[size] || sizePresets.thermal_80;
      const dirAttr = db.env.dir || (lang === 'ar' ? 'rtl' : 'ltr');
      const tablesLine = tablesNames.length ? `${escapeHTML(t.ui.tables)}: ${escapeHTML(tablesNames.join(', '))}` : '';
      const orderMeta = [
        `${escapeHTML(t.ui.order_id)} ${escapeHTML(order.id || '—')}`,
        `${escapeHTML(t.ui.guests)}: ${order.guests || 0}`,
        tablesLine,
        formatDateTime(order.updatedAt || Date.now(), lang, { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
      ].filter(Boolean).map(val=> `<p class="meta">${escapeHTML(val)}</p>`).join('');
      const noItems = `<p class="muted">${escapeHTML(t.ui.cart_empty)}</p>`;
      const changeRow = payments.length ? `<div class="row"><span>${escapeHTML(t.ui.print_change_due)}</span><span>${formatCurrencyValue(db, changeDue)}</span></div>` : '';
      const paidRow = payments.length ? `<div class="row"><span>${escapeHTML(t.ui.paid)}</span><span>${formatCurrencyValue(db, totalPaid)}</span></div>` : '';
      const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${dirAttr}">
  <head>
    <meta charset="utf-8"/>
    <title>${escapeHTML(currentDocLabel)}</title>
    <style>
      :root { color-scheme: light; font-family: 'Tajawal', 'Cairo', system-ui, sans-serif; }
      ${preset.page || ''}
      body { margin:0; background:${preset.bodyBg || '#f8fafc'}; color:#0f172a; display:flex; justify-content:center; padding:${preset.bodyPadding || '32px'}; direction:${dirAttr}; }
      .receipt { width:${preset.width}; max-width:${preset.maxWidth || preset.width}; padding:${preset.padding}; font-size:${preset.fontSize}; background:#ffffff; border:${preset.border || '1px solid #dbe4f3'}; border-radius:${preset.radius || '24px'}; box-shadow:${preset.shadow || '0 24px 60px rgba(15,23,42,0.16)'}; }
      .receipt header { text-align:center; margin-bottom:16px; }
      .receipt h1 { margin:0; font-size:${preset.heading}; font-weight:700; }
      .receipt .meta { margin:4px 0; color:#64748b; font-size:${preset.meta}; }
      .receipt .rows { margin:16px 0; }
      .receipt .row { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin:8px 0; font-size:${preset.fontSize}; }
      .receipt .row.sub { font-size:${preset.meta}; color:#64748b; padding-inline-start:16px; }
      .receipt .row.note { font-size:${preset.meta}; color:#94a3b8; padding-inline-start:16px; }
      .receipt .row span:last-child { font-weight:600; }
      .receipt .separator { height:1px; background:#e2e8f0; margin:16px 0; }
      .receipt .muted { text-align:center; color:#cbd5f5; margin:24px 0; }
      .receipt .totals strong { display:flex; justify-content:space-between; margin-top:12px; font-size:${preset.total}; }
      footer { margin-top:24px; text-align:center; color:#94a3b8; font-size:${preset.meta}; }
    </style>
    ${ "<"  +"script>"}
      window.addEventListener('load', function(){
        window.focus();
        setTimeout(function(){ try{ window.print(); } catch(_){} }, 200);
      });
    ${ "</"  +"script>"}
  </head>
  <body>
    <article class="receipt">
      <header>
        <h1>Mishkah Restaurant</h1>
        <p class="meta">${escapeHTML(t.ui.print_header_address)}: 12 Nile Street</p>
        <p class="meta">${escapeHTML(t.ui.print_header_phone)}: 0100000000</p>
        <p class="meta">${escapeHTML(currentDocLabel)}</p>
      </header>
      <section>
        ${orderMeta}
      </section>
      <div class="separator"></div>
      <section class="rows">
        ${lineItems || noItems}
      </section>
      <div class="separator"></div>
      <section class="rows totals">
        ${totalsHtml}
        <strong><span>${escapeHTML(t.ui.total)}</span><span>${formatCurrencyValue(db, due)}</span></strong>
        ${paidRow}
        ${changeRow}
        ${paymentsHtml}
      </section>
      <footer>
        <p>${escapeHTML(t.ui.print_footer_thanks)}</p>
        <p>${escapeHTML(t.ui.print_footer_policy)}</p>
        <p>${escapeHTML(t.ui.print_footer_feedback)} • QR</p>
      </footer>
    </article>
  </body>
</html>`;
      return html;
    }

    function toInputDateTime(ts){
      if(!ts) return '';
      const date = new Date(ts);
      const pad = (v)=> String(v).padStart(2, '0');
      const year = date.getFullYear();
      const month = pad(date.getMonth() + 1);
      const day = pad(date.getDate());
      const hours = pad(date.getHours());
      const minutes = pad(date.getMinutes());
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    const hasIndexedDB = !!((U && (U.IndexedDBX || U.IndexedDB)) && typeof window !== 'undefined' && window.indexedDB);

    function createIndexedDBAdapter(name, version){
      const IndexedDBX = U && (U.IndexedDBX || U.IndexedDB);
      if(!hasIndexedDB || !IndexedDBX){
        return {
          available:false,
          async saveOrder(){ return false; },
          async listOrders(){ return []; },
          async getOrder(){ return null; },
          async markSync(){ return false; },
          async bootstrap(){ return false; },
          async getActiveShift(){ return null; },
          async listShifts(){ return []; },
          async openShiftRecord(record){ return record || null; },
          async closeShiftRecord(){ return null; },
          async nextInvoiceNumber(posId, prefix){
            const base = `${prefix || posId || 'POS'}-${Date.now()}`;
            return { value: Date.now(), id: base };
          },
          async peekInvoiceCounter(){ return 0; },
          async resetAll(){ return false; }
        };
      }

      const SHIFT_STORE = 'shifts';
      const META_STORE = 'posMeta';

      const db = new IndexedDBX({
        name,
        version: Math.max(1, version|0) || 1,
        autoBumpVersion:true,
        schema:{
          stores:{
            orders:{
              keyPath:'id',
              indices:[
                { name:'by_status', keyPath:'status' },
                { name:'by_stage', keyPath:'fulfillmentStage' },
                { name:'by_type', keyPath:'type' }
              ]
            },
            orderLines:{ keyPath:'uid', indices:[{ name:'by_order', keyPath:'orderId' }] },
            orderNotes:{ keyPath:'id', indices:[{ name:'by_order', keyPath:'orderId' }] },
            orderEvents:{ keyPath:'id', indices:[{ name:'by_order', keyPath:'orderId' }] },
            syncLog:{ keyPath:'ts' },
            [SHIFT_STORE]:{
              keyPath:'id',
              indices:[
                { name:'by_pos', keyPath:['posId','openedAt'] },
                { name:'by_pos_status', keyPath:['posId','isClosed'] }
              ]
            },
            [META_STORE]:{ keyPath:'id' }
          }
        }
      });

      let readyPromise = null;
      const ensureReady = ()=>{
        if(!readyPromise){
          readyPromise = (async()=>{
            await db.open();
            await db.ensureSchema();
            return db;
          })();
        }
        return readyPromise;
      };

      function toTimestamp(value){
        if(value == null) return Date.now();
        if(typeof value === 'number') return value;
        const parsed = new Date(value).getTime();
        return Number.isFinite(parsed) ? parsed : Date.now();
      }

      function normalizeShiftRecord(record){
        if(!record) return null;
        const base = { ...record };
        base.isClosed = base.isClosed === 1 || base.isClosed === true;
        base.openedAt = base.openedAt || Date.now();
        base.closedAt = base.closedAt || null;
        base.employeeId = base.employeeId || base.cashierId || null;
        if(base.posNumber != null){
          const numericPos = Number(base.posNumber);
          base.posNumber = Number.isFinite(numericPos) ? numericPos : base.posNumber;
        }
        return base;
      }

      async function getActiveShift(posId){
        if(!posId) return null;
        await ensureReady();
        const list = await db.byIndex(SHIFT_STORE, 'by_pos_status', { only:[posId, 0] });
        return normalizeShiftRecord(list && list[0] ? list[0] : null);
      }

      async function listShifts({ posId, limit=50 }={}){
        await ensureReady();
        if(!posId){
          const all = await db.getAll(SHIFT_STORE);
          return all.map(normalizeShiftRecord).sort((a,b)=> (b.openedAt||0)-(a.openedAt||0)).slice(0, limit);
        }
        const rows = await db.byIndex(SHIFT_STORE, 'by_pos', {
          lower:[posId, 0],
          upper:[posId, Number.MAX_SAFE_INTEGER]
        }, 'prev');
        return rows.map(normalizeShiftRecord).slice(0, limit);
      }

      async function writeShift(record){
        if(!record || !record.id) throw new Error('Shift payload requires id');
        if(!record.posId) throw new Error('Shift payload requires posId');
        const payload = {
          ...record,
          isClosed: record.isClosed ? 1 : 0,
          openedAt: record.openedAt || Date.now(),
          closedAt: record.closedAt || null
        };
        await ensureReady();
        await db.put(SHIFT_STORE, payload);
        return normalizeShiftRecord(payload);
      }

      async function openShiftRecord(record){
        if(!record || !record.posId) throw new Error('Shift payload requires posId');
        const active = await getActiveShift(record.posId);
        if(active) return active;
        return writeShift({ ...record, isClosed:false, closedAt:null });
      }

      async function closeShiftRecord(id, patch={}){
        if(!id) throw new Error('Shift id is required');
        await ensureReady();
        const current = await db.get(SHIFT_STORE, id);
        if(!current) return null;
        const payload = {
          ...current,
          ...patch,
          closedAt: patch.closedAt || Date.now(),
          isClosed:true
        };
        await db.put(SHIFT_STORE, payload);
        return normalizeShiftRecord(payload);
      }

      async function ensureInvoiceCounter(posId){
        if(!posId) return { id:'default', invoiceCounter:0 };
        await ensureReady();
        const existing = await db.get(META_STORE, posId);
        if(existing && Number.isFinite(existing.invoiceCounter)) return existing;
        const base = { id: posId, invoiceCounter:0 };
        await db.put(META_STORE, base);
        return base;
      }

      async function nextInvoiceNumber(posId, prefix){
        if(!posId) throw new Error('posId required for invoice sequence');
        await ensureReady();
        const meta = await ensureInvoiceCounter(posId);
        const nextValue = Number(meta.invoiceCounter || 0) + 1;
        const updated = { ...meta, invoiceCounter: nextValue };
        await db.put(META_STORE, updated);
        const safePrefix = prefix || posId;
        return { value: nextValue, id: `${safePrefix}-${nextValue}` };
      }

      async function peekInvoiceCounter(posId){
        const meta = await ensureInvoiceCounter(posId);
        return Number(meta.invoiceCounter || 0);
      }

      async function resetAll(){
        try{
          await ensureReady();
        } catch(_){ }
        await db.destroy();
        readyPromise = null;
        return true;
      }

      function hydrateLine(record){
        return {
          id: record.id,
          itemId: record.itemId,
          name: record.name,
          description: record.description,
          qty: record.qty,
          price: record.price,
          total: record.total,
          status: record.status,
          stage: record.stage,
          kitchenSection: record.kitchenSection,
          locked: !!record.locked,
          notes: Array.isArray(record.notes) ? record.notes : [],
          createdAt: record.createdAt,
          updatedAt: record.updatedAt
        };
      }

      async function hydrateOrder(header){
        await ensureReady();
        const [linesRaw, notesRaw, eventsRaw] = await Promise.all([
          db.byIndex('orderLines', 'by_order', { only: header.id }),
          db.byIndex('orderNotes', 'by_order', { only: header.id }),
          db.byIndex('orderEvents', 'by_order', { only: header.id })
        ]);
        return {
          ...header,
          lines: linesRaw.map(hydrateLine),
          notes: notesRaw.map(note=>({
            id: note.id,
            message: note.message,
            authorId: note.authorId,
            authorName: note.authorName,
            createdAt: note.createdAt
          })),
          events: eventsRaw.map(evt=>({ id: evt.id, stage: evt.stage, status: evt.status, at: evt.at, actorId: evt.actorId }))
        };
      }

      async function saveOrder(order){
        if(!order || !order.id) throw new Error('Order payload requires an id');
        if(!order.shiftId) throw new Error('Order payload requires an active shift');
        await ensureReady();
        const now = Date.now();
        const normalizedPosId = order.posId || order.metadata?.posId || null;
        const normalizedPosLabel = order.posLabel || order.metadata?.posLabel || null;
        const normalizedPosNumber = Number.isFinite(order.posNumber)
          ? Number(order.posNumber)
          : (Number.isFinite(order.metadata?.posNumber) ? Number(order.metadata.posNumber) : null);
        const header = {
          id: order.id,
          type: order.type || 'dine_in',
          status: order.status || 'open',
          fulfillmentStage: order.fulfillmentStage || order.stage || 'new',
          paymentState: order.paymentState || 'unpaid',
          tableIds: Array.isArray(order.tableIds) ? order.tableIds.slice() : [],
          guests: order.guests || 0,
          totals: order.totals || {},
          createdAt: order.createdAt || now,
          updatedAt: order.updatedAt || now,
          savedAt: order.savedAt || now,
          allowAdditions: order.allowAdditions !== undefined ? !!order.allowAdditions : true,
          lockLineEdits: order.lockLineEdits !== undefined ? !!order.lockLineEdits : true,
          isPersisted: order.isPersisted !== undefined ? !!order.isPersisted : true,
          origin: order.origin || 'pos',
          shiftId: order.shiftId,
          posId: normalizedPosId,
          posLabel: normalizedPosLabel,
          posNumber: normalizedPosNumber,
          metadata:{
            version:2,
            linesCount: Array.isArray(order.lines) ? order.lines.length : 0,
            notesCount: Array.isArray(order.notes) ? order.notes.length : 0,
            posId: normalizedPosId,
            posLabel: normalizedPosLabel,
            posNumber: normalizedPosNumber
          }
        };

        await db.put('orders', header);

        const existingLines = await db.byIndex('orderLines', 'by_order', { only: order.id });
        if(existingLines.length){
          await db.bulkDelete('orderLines', existingLines.map(line=> line.uid));
        }
        const lines = Array.isArray(order.lines) ? order.lines : [];
        const lineRecords = lines.map(line=>({
          uid: line.uid || line.storageId || `${order.id}::${line.id || line.itemId || Math.random().toString(16).slice(2,8)}`,
          id: line.id || `${order.id}::${line.itemId || Math.random().toString(16).slice(2,8)}`,
          orderId: order.id,
          itemId: line.itemId,
          name: line.name || null,
          description: line.description || null,
          qty: Number(line.qty) || 0,
          price: Number(line.price) || 0,
          total: Number(line.total) || 0,
          status: line.status || 'draft',
          stage: line.stage || header.fulfillmentStage,
          kitchenSection: line.kitchenSection || null,
          locked: line.locked !== undefined ? !!line.locked : header.lockLineEdits,
          notes: Array.isArray(line.notes) ? line.notes.slice() : (line.notes ? [line.notes] : []),
          createdAt: line.createdAt || header.createdAt,
          updatedAt: line.updatedAt || header.updatedAt
        }));
        if(lineRecords.length){
          await db.bulkPut('orderLines', lineRecords);
        }

        const existingNotes = await db.byIndex('orderNotes', 'by_order', { only: order.id });
        if(existingNotes.length){
          await db.bulkDelete('orderNotes', existingNotes.map(note=> note.id));
        }
        const notes = Array.isArray(order.notes) ? order.notes : [];
        const noteRecords = notes.map(note=>({
          id: note.id || `${order.id}::note::${toTimestamp(note.createdAt)}`,
          orderId: order.id,
          message: note.message || '',
          authorId: note.authorId || 'system',
          authorName: note.authorName || '',
          createdAt: toTimestamp(note.createdAt)
        }));
        if(noteRecords.length){
          await db.bulkPut('orderNotes', noteRecords);
        }

        const eventRecord = {
          id: `${order.id}::event::${header.updatedAt}`,
          orderId: order.id,
          stage: header.fulfillmentStage,
          status: header.status,
          at: header.updatedAt,
          actorId: order.updatedBy || order.authorId || 'pos'
        };
        await db.put('orderEvents', eventRecord);

        return true;
      }

      async function listOrders(options={}){
        await ensureReady();
        const headers = await db.getAll('orders');
        const onlyActive = options.onlyActive !== false;
        const typeFilter = options.type;
        const stageFilter = options.stage;
        const idFilter = options.ids;
        const orders = [];
        for(const header of headers){
          const status = header.status || header.payload?.status || 'open';
          if(onlyActive && (status === 'closed')) continue;
          if(typeFilter){
            const typeId = header.type || header.payload?.type || 'dine_in';
            if(Array.isArray(typeFilter)){ if(!typeFilter.includes(typeId)) continue; }
            else if(typeId !== typeFilter) continue;
          }
          if(stageFilter){
            const stageId = header.fulfillmentStage || header.payload?.fulfillmentStage || 'new';
            if(Array.isArray(stageFilter)){ if(!stageFilter.includes(stageId)) continue; }
            else if(stageId !== stageFilter) continue;
          }
          if(idFilter && !idFilter.includes(header.id)) continue;
          if(header.payload){
            const legacy = header.payload;
            orders.push({
              ...legacy,
              id: header.id,
              updatedAt: header.updatedAt || legacy.updatedAt || toTimestamp(legacy.updatedAt)
            });
            continue;
          }
          const order = await hydrateOrder(header);
          orders.push(order);
        }
        return orders;
      }

      async function getOrder(orderId){
        if(!orderId) return null;
        await ensureReady();
        const header = await db.get('orders', orderId);
        if(!header) return null;
        if(header.payload){
          const legacy = header.payload;
          return {
            ...legacy,
            id: header.id,
            updatedAt: header.updatedAt || legacy.updatedAt || toTimestamp(legacy.updatedAt)
          };
        }
        return hydrateOrder(header);
      }

      async function markSync(){
        await ensureReady();
        await db.put('syncLog', { ts: Date.now() });
        return true;
      }

      async function bootstrap(initialOrders){
        if(!Array.isArray(initialOrders) || !initialOrders.length) return false;
        const existing = await listOrders({ onlyActive:false });
        if(existing.length) return false;
        for(const order of initialOrders){
          try { await saveOrder(order); } catch(_){ }
        }
        return true;
      }

      return {
        available:true,
        saveOrder,
        listOrders,
        getOrder,
        markSync,
        bootstrap,
        getActiveShift,
        listShifts,
        openShiftRecord,
        closeShiftRecord,
        nextInvoiceNumber,
        peekInvoiceCounter,
        resetAll
      };
    }

    function createKDSBridge(url){
      let socket = null;
      return {
        connect(ctx){
          const state = ctx.getState();
          const t = getTexts(state);
          if(socket){
            try { socket.close(); } catch(_){ }
          }
          if(!('WebSocket' in window)){
            UI.pushToast(ctx, { title:t.toast.kdsUnavailable, icon:'⚠️' });
            return;
          }
          ctx.setState(s=>({
            ...s,
            data:{
              ...s.data,
              status:{
                ...s.data.status,
                kds:{ ...(s.data.status?.kds || {}), state:'idle' }
              }
            }
          }));
          try{
            socket = new WebSocket(url);
          } catch(error){
            UI.pushToast(ctx, { title:t.toast.kdsFailed, message:String(error), icon:'🛑' });
            ctx.setState(s=>({
              ...s,
              data:{
                ...s.data,
                status:{ ...s.data.status, kds:{ ...(s.data.status?.kds || {}), state:'offline' } }
              }
            }));
            return;
          }
          socket.onopen = ()=>{
            UI.pushToast(ctx, { title:t.toast.kdsConnected, icon:'✅' });
            ctx.setState(s=>({
              ...s,
              data:{
                ...s.data,
                status:{ ...s.data.status, kds:{ ...(s.data.status?.kds || {}), state:'online' } }
              }
            }));
          };
          socket.onclose = ()=>{
            UI.pushToast(ctx, { title:t.toast.kdsClosed, icon:'ℹ️' });
            ctx.setState(s=>({
              ...s,
              data:{
                ...s.data,
                status:{ ...s.data.status, kds:{ ...(s.data.status?.kds || {}), state:'offline' } }
              }
            }));
          };
          socket.onerror = ()=>{
            UI.pushToast(ctx, { title:t.toast.kdsFailed, icon:'🛑' });
            ctx.setState(s=>({
              ...s,
              data:{
                ...s.data,
                status:{ ...s.data.status, kds:{ ...(s.data.status?.kds || {}), state:'offline' } }
              }
            }));
          };
          socket.onmessage = (event)=>{
            try{
              const payload = JSON.parse(event.data);
              if(payload && payload.type === 'pong'){
                UI.pushToast(ctx, { title:'KDS', message:t.toast.kdsPong, icon:'🍳', ttl:1600 });
              }
            } catch(_){ }
          };
        }
      };
    }

    const posDB = createIndexedDBAdapter('mishkah-pos', 3);
    const preferencesStore = U.Storage && U.Storage.local ? U.Storage.local('mishkah-pos') : null;
    const savedModalSizes = preferencesStore ? (preferencesStore.get('modalSizes', {}) || {}) : {};
    const savedThemePrefs = preferencesStore ? (preferencesStore.get('themePrefs', {}) || {}) : {};
    let invoiceSequence = 0;
    if(posDB.available){
      try {
        invoiceSequence = await posDB.peekInvoiceCounter(POS_INFO.id);
      } catch(error){
        console.warn('[Mishkah][POS] invoice peek failed', error);
        invoiceSequence = 0;
      }
    }

    async function allocateInvoiceId(){
      if(posDB.available){
        try{
          const next = await posDB.nextInvoiceNumber(POS_INFO.id, POS_INFO.prefix);
          invoiceSequence = next.value;
          return next.id;
        } catch(error){
          console.warn('[Mishkah][POS] invoice allocation failed', error);
        }
      }
      invoiceSequence += 1;
      return `${POS_INFO.prefix}-${invoiceSequence}`;
    }

    function applyThemePreferenceStyles(prefs){
      const styleId = 'pos-theme-prefs';
      let styleEl = document.getElementById(styleId);
      if(!styleEl){
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      if(!prefs || (Object.keys(prefs.light||{}).length === 0 && Object.keys(prefs.dark||{}).length === 0)){
        styleEl.textContent = '';
        return;
      }
      const segments = [];
      const light = prefs.light || {};
      const dark = prefs.dark || {};
      const makeRule = (selector, conf)=>{
        const colors = conf.colors || {};
        const fonts = conf.fonts || {};
        const declarations = [];
        Object.entries(colors).forEach(([prop,value])=>{ if(value) declarations.push(`${prop}:${value}`); });
        if(fonts.base) declarations.push(`font-size:${fonts.base}`);
        if(declarations.length) segments.push(`${selector}{${declarations.join(';')}}`);
      };
      makeRule(':root', light);
      makeRule(':root.dark', dark);
      styleEl.textContent = segments.join('\n');
    }

    applyThemePreferenceStyles(savedThemePrefs);
    const kdsBridge = createKDSBridge('wss://signal.mas.com.eg/signaldata?id=96nnVOIawRs7Wo_XpAFM0Q');

    const kitchenSections = Array.isArray(MOCK.kitchen_sections) ? MOCK.kitchen_sections.map(section=>({
      id: section.id,
      name:{ ar: section.section_name?.ar || section.id, en: section.section_name?.en || section.id },
      description: section.description || {}
    })) : [];

    const categorySections = Array.isArray(MOCK.category_sections) ? MOCK.category_sections : [];
    const categorySectionMap = new Map(categorySections.map(entry=> [entry.category_id || entry.categoryId, entry.section_id || entry.sectionId]));

    const rawCategories = Array.isArray(MOCK.categories) ? MOCK.categories.slice() : [];
    if(!rawCategories.some(cat=> cat.id === 'all')){
      rawCategories.unshift({ id:'all', category_name:{ ar:'الكل', en:'All' }, section_id:'expo' });
    }
    const categories = rawCategories.map(cat=>{
      const sectionId = cat.section_id || categorySectionMap.get(cat.id) || null;
      return {
        id: cat.id,
        sectionId,
        label:{ ar: cat.category_name?.ar || cat.id, en: cat.category_name?.en || cat.id }
      };
    });

    const menuItems = (MOCK.items || []).map(item=>{
      const categoryId = item.category_id || item.category || 'all';
      const price = item.pricing && typeof item.pricing.base !== 'undefined' ? Number(item.pricing.base) : Number(item.price) || 0;
      const kitchenSection = item.kitchen_section_id || categorySectionMap.get(categoryId) || 'expo';
      return {
        id: item.id,
        category: categoryId,
        price,
        image: item.media?.image || item.image || '',
        kitchenSection,
        name:{
          ar: item.item_name?.ar || item.item_name?.en || String(item.id),
          en: item.item_name?.en || item.item_name?.ar || String(item.id)
        },
        description:{
          ar: item.item_description?.ar || '',
          en: item.item_description?.en || item.item_description?.ar || ''
        }
      };
    });

    const menuIndex = new Map(menuItems.map(item=> [String(item.id), item]));

    const rawModifiers = typeof MOCK.modifiers === 'object' && MOCK.modifiers ? MOCK.modifiers : {};
    const normalizeModifierEntry = (entry, fallbackType)=>{
      if(!entry) return null;
      const id = entry.id ?? entry.code ?? entry.key;
      if(id == null) return null;
      const priceChange = Number(entry.price_change ?? entry.priceChange ?? entry.amount ?? 0) || 0;
      return {
        id: String(id),
        type: fallbackType,
        label:{
          ar: entry.name?.ar || entry.name?.en || String(id),
          en: entry.name?.en || entry.name?.ar || String(id)
        },
        priceChange: round(priceChange)
      };
    };
    const addOns = (Array.isArray(rawModifiers.add_ons) ? rawModifiers.add_ons : rawModifiers.addOns || []).map(entry=> normalizeModifierEntry(entry, 'add_on')).filter(Boolean);
    const removals = (Array.isArray(rawModifiers.removals) ? rawModifiers.removals : rawModifiers.remove || []).map(entry=> normalizeModifierEntry(entry, 'removal')).filter(Boolean);
    const modifiersCatalog = { addOns, removals };

    const orderStages = (Array.isArray(MOCK.order_stages) && MOCK.order_stages.length ? MOCK.order_stages : [
      { id:'new', stage_name:{ ar:'جديد', en:'New' }, sequence:1, lock_line_edits:false },
      { id:'preparing', stage_name:{ ar:'جاري التجهيز', en:'Preparing' }, sequence:2, lock_line_edits:true },
      { id:'prepared', stage_name:{ ar:'تم التجهيز', en:'Prepared' }, sequence:3, lock_line_edits:true },
      { id:'delivering', stage_name:{ ar:'جاري التسليم', en:'Delivering' }, sequence:4, lock_line_edits:true },
      { id:'delivered', stage_name:{ ar:'تم التسليم', en:'Delivered' }, sequence:5, lock_line_edits:true },
      { id:'paid', stage_name:{ ar:'تم الدفع', en:'Paid' }, sequence:6, lock_line_edits:true },
      { id:'closed', stage_name:{ ar:'تم الإغلاق', en:'Closed' }, sequence:7, lock_line_edits:true }
    ]).map(stage=>({
      id: stage.id,
      name:{ ar: stage.stage_name?.ar || stage.id, en: stage.stage_name?.en || stage.id },
      sequence: typeof stage.sequence === 'number' ? stage.sequence : 0,
      lockLineEdits: stage.lock_line_edits !== undefined ? !!stage.lock_line_edits : true,
      description: stage.description || {}
    }));
    const orderStageMap = new Map(orderStages.map(stage=> [stage.id, stage]));

    const orderStatuses = (Array.isArray(MOCK.order_statuses) && MOCK.order_statuses.length ? MOCK.order_statuses : [
      { id:'open', status_name:{ ar:'مفتوح', en:'Open' } },
      { id:'held', status_name:{ ar:'معلّق', en:'Held' } },
      { id:'finalized', status_name:{ ar:'منتهي', en:'Finalized' } },
      { id:'closed', status_name:{ ar:'مغلق', en:'Closed' } }
    ]).map(status=>({
      id: status.id,
      name:{ ar: status.status_name?.ar || status.id, en: status.status_name?.en || status.id }
    }));
    const orderStatusMap = new Map(orderStatuses.map(status=> [status.id, status]));

    const orderPaymentStates = (Array.isArray(MOCK.order_payment_states) && MOCK.order_payment_states.length ? MOCK.order_payment_states : [
      { id:'unpaid', payment_name:{ ar:'غير مدفوع', en:'Unpaid' } },
      { id:'partial', payment_name:{ ar:'مدفوع جزئيًا', en:'Partially Paid' } },
      { id:'paid', payment_name:{ ar:'مدفوع', en:'Paid' } }
    ]).map(state=>({
      id: state.id,
      name:{ ar: state.payment_name?.ar || state.id, en: state.payment_name?.en || state.id }
    }));
    const orderPaymentMap = new Map(orderPaymentStates.map(state=> [state.id, state]));

    const orderLineStatuses = (Array.isArray(MOCK.order_line_statuses) && MOCK.order_line_statuses.length ? MOCK.order_line_statuses : [
      { id:'draft', status_name:{ ar:'مسودة', en:'Draft' } },
      { id:'queued', status_name:{ ar:'بانتظار التحضير', en:'Queued' } },
      { id:'preparing', status_name:{ ar:'جاري التحضير', en:'Preparing' } },
      { id:'ready', status_name:{ ar:'جاهز', en:'Ready' } },
      { id:'served', status_name:{ ar:'مقدّم', en:'Served' } }
    ]).map(status=>({
      id: status.id,
      name:{ ar: status.status_name?.ar || status.id, en: status.status_name?.en || status.id }
    }));
    const orderLineStatusMap = new Map(orderLineStatuses.map(status=> [status.id, status]));

    function toMillis(value, fallback){
      if(!value && fallback != null) return fallback;
      if(!value) return Date.now();
      if(typeof value === 'number') return value;
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : (fallback != null ? fallback : Date.now());
    }

    function cloneName(value){
      if(!value) return { ar:'', en:'' };
      if(typeof value === 'string') return { ar:value, en:value };
      return {
        ar: value.ar || value.en || '',
        en: value.en || value.ar || ''
      };
    }

    function normalizeNote(raw, fallbackAuthor){
      if(!raw) return null;
      const message = raw.message || raw.text || '';
      if(!message) return null;
      const createdAt = toMillis(raw.created_at || raw.createdAt);
      return {
        id: raw.id || `note-${Math.random().toString(16).slice(2,8)}`,
        message,
        authorId: raw.author_id || raw.authorId || fallbackAuthor || 'system',
        authorName: raw.author_name || raw.authorName || '',
        createdAt
      };
    }

    function normalizeOrderLine(raw, context){
      if(!raw) return null;
      const itemId = raw.item_id || raw.itemId;
      const menuItem = menuIndex.get(String(itemId));
      const qty = Math.max(1, Number(raw.qty) || 1);
      const price = raw.price != null ? Number(raw.price) : menuItem?.price || 0;
      const total = raw.total != null ? Number(raw.total) : round(price * qty);
      const stageId = raw.stage_id || raw.stageId || context.stageId || 'new';
      const statusId = raw.status_id || raw.statusId || 'draft';
      const notes = Array.isArray(raw.notes) ? raw.notes.map(note=> normalizeNote(note, context.actorId)).filter(Boolean) : [];
      const kitchenSection = raw.kitchen_section_id || raw.kitchenSectionId || menuItem?.kitchenSection || context.kitchenSection || null;
      return {
        id: raw.id || `ln-${context.orderId}-${itemId || Math.random().toString(16).slice(2,8)}`,
        itemId,
        name: menuItem ? menuItem.name : cloneName(raw.name),
        description: menuItem ? menuItem.description : cloneName(raw.description),
        qty,
        price,
        total: round(total),
        status: statusId,
        stage: stageId,
        kitchenSection,
        locked: raw.locked !== undefined ? !!raw.locked : (orderStageMap.get(stageId)?.lockLineEdits ?? true),
        notes,
        createdAt: toMillis(raw.created_at || raw.createdAt, context.createdAt),
        updatedAt: toMillis(raw.updated_at || raw.updatedAt, context.updatedAt)
      };
    }

    function normalizeMockOrder(raw){
      if(!raw) return null;
      const header = raw.header || {};
      const id = raw.id || header.id || `ORD-${Date.now()}`;
      const createdAt = toMillis(header.created_at || raw.createdAt);
      const updatedAt = toMillis(header.updated_at || raw.updatedAt, createdAt);
      const typeId = header.type_id || header.typeId || raw.type || 'dine_in';
      const stageId = header.stage_id || header.stageId || raw.fulfillmentStage || 'new';
      const statusId = header.status_id || header.statusId || raw.status || 'open';
      const paymentStateId = header.payment_state_id || header.paymentStateId || raw.payment_state || 'unpaid';
      const tableIds = Array.isArray(header.table_ids) ? header.table_ids.slice() : Array.isArray(raw.tableIds) ? raw.tableIds.slice() : [];
      const guests = header.guests || raw.guests || 0;
      const allowAdditions = header.allow_line_additions !== undefined ? !!header.allow_line_additions : (ORDER_TYPES.find(t=> t.id === typeId)?.allowsLineAdditions ?? (typeId === 'dine_in'));
      const lockLineEdits = header.locked_line_edits !== undefined ? !!header.locked_line_edits : (orderStageMap.get(stageId)?.lockLineEdits ?? true);
      const lineContext = { orderId:id, stageId, createdAt, updatedAt };
      const lines = Array.isArray(raw.lines) ? raw.lines.map(line=> normalizeOrderLine(line, lineContext)).filter(Boolean) : [];
      const totals = header.totals || raw.totals || calculateTotals(lines, settings, typeId);
      const notes = Array.isArray(raw.notes) ? raw.notes.map(note=> normalizeNote(note, raw.author_id || header.author_id)).filter(Boolean) : [];
      const payments = Array.isArray(raw.payments)
        ? raw.payments.map(entry=>({
            id: entry.id || `pm-${Math.random().toString(36).slice(2,8)}`,
            method: entry.method || entry.method_id || entry.methodId || entry.type || 'cash',
            amount: round(Number(entry.amount) || 0)
          }))
        : [];
      const events = Array.isArray(raw.events) ? raw.events.map(evt=>({
        id: evt.id || `${id}::evt::${toMillis(evt.at)}`,
        stage: evt.stage_id || evt.stageId || stageId,
        status: evt.status_id || evt.statusId || statusId,
        at: toMillis(evt.at, createdAt),
        actorId: evt.actor_id || evt.actorId || 'system'
      })) : [];
      const normalizedTotals = totals && typeof totals === 'object' ? totals : calculateTotals(lines, settings, typeId);
      return {
        id,
        status: statusId,
        fulfillmentStage: stageId,
        paymentState: paymentStateId,
        type: typeId,
        tableIds,
        guests,
        totals: normalizedTotals,
        lines,
        notes,
        payments,
        events,
        createdAt,
        updatedAt,
        savedAt: updatedAt,
        isPersisted:true,
        allowAdditions,
        lockLineEdits,
        origin:'seed',
        shiftId: raw.shift_id || header.shift_id || raw.shiftId || null,
        customerId: raw.customer_id || raw.customerId || header.customer_id || header.customerId || null,
        customerAddressId: raw.address_id || raw.addressId || header.address_id || header.addressId || null,
        customerName: raw.customer_name || raw.customerName || header.customer_name || header.customerName || '',
        customerPhone: raw.customer_phone || raw.customerPhone || header.customer_phone || header.customerPhone || '',
        customerAddress: raw.customer_address || raw.customerAddress || header.customer_address || header.customerAddress || '',
        customerAreaId: raw.customer_area_id || raw.customerAreaId || header.customer_area_id || header.customerAreaId || null,
        posId: raw.pos_id || header.pos_id || raw.posId || POS_INFO.id,
        posLabel: raw.pos_label || header.pos_label || raw.posLabel || POS_INFO.label,
        posNumber: (()=>{
          const rawNumber = raw.pos_number ?? header.pos_number ?? raw.posNumber;
          return Number.isFinite(Number(rawNumber)) ? Number(rawNumber) : POS_INFO.number;
        })()
      };
    }

    function normalizeMockShift(raw){
      if(!raw) return null;
      const id = raw.id || `SHIFT-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
      const openedAt = toMillis(raw.opened_at || raw.openedAt);
      const closedAt = toMillis(raw.closed_at || raw.closedAt);
      const openingFloat = Number(raw.opening_float ?? raw.openingFloat ?? 0);
      const closingCashRaw = Number(raw.closing_cash ?? raw.closingCash ?? 0);
      const totals = raw.totals && typeof raw.totals === 'object' ? raw.totals : {};
      const payments = raw.payments && typeof raw.payments === 'object' ? raw.payments : {};
      const posId = raw.pos_id || raw.posId || POS_INFO.id;
      const posLabel = raw.pos_label || raw.posLabel || POS_INFO.label;
      const posNumberRaw = raw.pos_number ?? raw.posNumber;
      const posNumber = Number.isFinite(Number(posNumberRaw)) ? Number(posNumberRaw) : POS_INFO.number;
      const totalsByType = {
        dine_in: round(Number(totals.dine_in) || 0),
        takeaway: round(Number(totals.takeaway) || 0),
        delivery: round(Number(totals.delivery) || 0)
      };
      const paymentsByMethod = PAYMENT_METHODS.reduce((acc, method)=>{
        const value = payments[method.id] ?? payments[method.code] ?? payments[method.name] ?? 0;
        acc[method.id] = round(Number(value) || 0);
        return acc;
      }, {});
      Object.keys(payments).forEach(key=>{
        if(!(key in paymentsByMethod)){
          paymentsByMethod[key] = round(Number(payments[key]) || 0);
        }
      });
      const totalSales = round((totalsByType.dine_in || 0) + (totalsByType.takeaway || 0) + (totalsByType.delivery || 0));
      return {
        id,
        openedAt,
        closedAt,
        openingFloat: round(openingFloat),
        closingCash: closingCashRaw ? round(closingCashRaw) : null,
        totalsByType,
        paymentsByMethod,
        totalSales,
        orders: Array.isArray(raw.orders) ? raw.orders.slice() : [],
        cashierId: raw.cashier_id || raw.cashierId || '',
        cashierName: raw.cashier_name || raw.cashierName || '',
        status: closedAt ? 'closed' : 'open',
        posId,
        posLabel,
        posNumber,
        isClosed: !!closedAt
      };
    }

    function getDistrictLabel(id, lang){
      const district = CAIRO_DISTRICTS.find(area=> area.id === id);
      if(!district) return id || '';
      return lang === 'ar' ? district.ar : district.en;
    }

    function createEmptyCustomerForm(){
      return {
        id:null,
        name:'',
        phones:[''],
        addresses:[{ id:null, title:'', areaId: CAIRO_DISTRICTS[0]?.id || '', line:'', notes:'' }]
      };
    }

    function createInitialCustomers(){
      const now = Date.now().toString(36).toUpperCase();
      return [
        {
          id:`CUST-${now}-A`,
          name:'أحمد خالد',
          phones:['01000011223','01234567890'],
          addresses:[
            { id:`ADDR-${now}-1`, title:'المنزل', areaId:'nasr_city', line:'عمارات الشركة، شارع الطيران، مدينة نصر', notes:'' },
            { id:`ADDR-${now}-2`, title:'العمل', areaId:'heliopolis', line:'شارع عمر بن الخطاب، هليوبوليس', notes:'التسليم عند البوابة' }
          ]
        },
        {
          id:`CUST-${now}-B`,
          name:'سارة مصطفى',
          phones:['01055667788'],
          addresses:[
            { id:`ADDR-${now}-3`, title:'المنزل', areaId:'maadi', line:'شارع 9، المعادي الجديدة', notes:'الطابق الثالث' }
          ]
        },
        {
          id:`CUST-${now}-C`,
          name:'Mohamed Adel',
          phones:['01122334455'],
          addresses:[
            { id:`ADDR-${now}-4`, title:'Home', areaId:'fifth_settlement', line:'بيت الوطن، التجمع الخامس', notes:'' }
          ]
        }
      ];
    }

    function findCustomer(customers, id){
      if(!id) return null;
      return (Array.isArray(customers) ? customers : []).find(customer=> customer.id === id) || null;
    }

    function findCustomerAddress(customer, id){
      if(!customer || !id) return null;
      return (Array.isArray(customer.addresses) ? customer.addresses : []).find(address=> address.id === id) || null;
    }

    const seedOrders = Array.isArray(MOCK.orders) ? MOCK.orders.map(normalizeMockOrder).filter(Boolean) : [];
    const rawShifts = Array.isArray(MOCK.shifts) ? MOCK.shifts.map(normalizeMockShift).filter(Boolean) : [];
    const SHIFT_HISTORY_SEED = rawShifts.filter(shift=> shift.closedAt || shift.status === 'closed');
    const ordersHistorySeed = seedOrders.map((order, idx)=>({
      ...order,
      seq: idx + 1,
      lines: Array.isArray(order.lines) ? order.lines.map(line=> ({ ...line })) : [],
      payments: Array.isArray(order.payments) ? order.payments.map(pay=> ({ ...pay })) : []
    }));
    const baseTables = Array.isArray(MOCK.tables) ? MOCK.tables : [];
    const tables = baseTables.map((tbl, idx)=>({
      id: tbl.id || `T${idx+1}`,
      name: tbl.name || `طاولة ${idx+1}`,
      capacity: tbl.seats || tbl.capacity || 4,
      zone: tbl.zone || '',
      displayOrder: typeof tbl.displayOrder === 'number' ? tbl.displayOrder : idx + 1,
      state: tbl.state || (tbl.status === 'inactive' ? 'disactive' : tbl.status === 'maintenance' ? 'maintenance' : 'active'),
      note: tbl.note || tbl.notes || ''
    }));
    while(tables.length < 20){
      const nextIndex = tables.length + 1;
      tables.push({
        id:`T${nextIndex}`,
        name:`طاولة ${nextIndex}`,
        capacity:4,
        zone:'',
        displayOrder: nextIndex,
        state:'active',
        note:''
      });
    }
    tables.sort((a,b)=> (a.displayOrder||0) - (b.displayOrder||0));

    const tableLocks = Array.isArray(MOCK.tableLocks) ? MOCK.tableLocks.map(lock=>({
      id: lock.id || `lock-${Math.random().toString(36).slice(2,8)}`,
      tableId: lock.tableId,
      orderId: lock.orderId || null,
      reservationId: lock.reservationId || null,
      lockedBy: lock.lockedBy || 'system',
      lockedAt: lock.lockedAt ? new Date(lock.lockedAt).getTime() : Date.now(),
      source: lock.source || 'pos',
      active: lock.active !== false
    })) : [];

    const ordersQueue = seedOrders.slice();

    const reservations = Array.isArray(MOCK.reservations) ? MOCK.reservations.map(res=>({
      id: res.id || `res-${Math.random().toString(36).slice(2,6)}`,
      customerName: res.customerName || '',
      phone: res.phone || '',
      partySize: res.partySize || 2,
      scheduledAt: res.scheduledAt ? new Date(res.scheduledAt).getTime() : Date.now(),
      holdUntil: res.holdUntil ? new Date(res.holdUntil).getTime() : null,
      tableIds: Array.isArray(res.tableIds) ? res.tableIds.slice() : [],
      status: res.status || 'booked',
      note: res.note || '',
      createdAt: res.createdAt ? new Date(res.createdAt).getTime() : Date.now()
    })) : [];

    const auditTrail = Array.isArray(MOCK.auditEvents) ? MOCK.auditEvents.map(evt=>({
      id: evt.id || `audit-${Math.random().toString(36).slice(2,8)}`,
      userId: evt.userId || 'system',
      action: evt.action || 'unknown',
      refType: evt.refType || 'table',
      refId: evt.refId || '',
      at: evt.at ? new Date(evt.at).getTime() : Date.now(),
      meta: evt.meta || {}
    })) : [];
    const rawEmployees = Array.isArray(MOCK.employees) ? MOCK.employees : [];
    const employees = rawEmployees.map(emp=>{
      const pinSource = emp.pin_code ?? emp.pin ?? emp.pinCode ?? emp.passcode ?? '';
      const pin = typeof pinSource === 'number' ? String(pinSource).padStart(SHIFT_PIN_LENGTH, '0') : String(pinSource || '').trim();
      return {
        id: emp.id || emp.employee_id || `emp-${Math.random().toString(36).slice(2,8)}`,
        name: emp.full_name || emp.name || emp.display_name || emp.username || 'موظف',
        role: emp.role || 'staff',
        pin: pin.replace(/\D/g,''),
        allowedDiscountRate: typeof emp.allowed_discount_rate === 'number'
          ? emp.allowed_discount_rate
          : (typeof emp.allowedDiscountRate === 'number' ? emp.allowedDiscountRate : 0)
      };
    }).filter(emp=> emp.pin && emp.pin.length);
    const maxEmployeePinLength = employees.reduce((max, emp)=> Math.max(max, emp.pin.length), 0);
    if(maxEmployeePinLength) SHIFT_PIN_LENGTH = Math.max(SHIFT_PIN_LENGTH, maxEmployeePinLength);
    const defaultCashier = employees.find(emp=> emp.role === 'cashier') || employees[0] || {
      id:'cashier-guest',
      name:'أحمد محمود',
      role:'cashier',
      pin: (SHIFT_PIN_FALLBACK || '0000').replace(/\D/g,''),
      allowedDiscountRate:0
    };
    const cashier = defaultCashier;

    async function generateOrderId(){
      return allocateInvoiceId();
    }

    const initialTotals = calculateTotals([], settings, 'dine_in');
    const initialOrderId = await generateOrderId();
    let activeShift = null;
    let shiftHistoryFromDb = SHIFT_HISTORY_SEED.slice();
    if(posDB.available){
      try{
        activeShift = await posDB.getActiveShift(POS_INFO.id);
        if(activeShift){
          const seededHistory = ordersHistorySeed || [];
          const summary = summarizeShiftOrders(seededHistory, activeShift);
          activeShift = {
            ...activeShift,
            totalsByType: summary.totalsByType,
            paymentsByMethod: summary.paymentsByMethod,
            totalSales: summary.totalSales,
            countsByType: summary.countsByType,
            ordersCount: summary.ordersCount
          };
        }
        const listed = await posDB.listShifts({ posId: POS_INFO.id, limit: 50 });
        shiftHistoryFromDb = Array.isArray(listed) && listed.length
          ? listed.filter(shift=> !activeShift || shift.id !== activeShift.id)
          : shiftHistoryFromDb;
      } catch(error){
        console.warn('[Mishkah][POS] shift hydration failed', error);
      }
    }

    const initialTheme = 'dark';

    const posState = {
      head:{ title:'مشكاة — نقطة بيع حية' },
      env:{ theme:initialTheme, lang:'ar', dir:'rtl' },
      data:{
        settings,
        themePrefs: savedThemePrefs,
        currency:{ code: currencyCode, symbols: currencySymbols, display: currencyDisplayMode },
        pos: POS_INFO,
        user:{
          id: cashier.id || 'cashier-guest',
          name: cashier.name || cashier.full_name || 'أحمد محمود',
          role: cashier.role || 'cashier',
          allowedDiscountRate: typeof cashier.allowedDiscountRate === 'number' ? cashier.allowedDiscountRate : 0,
          shift: activeShift?.id || '—',
          shiftNo: activeShift ? activeShift.id : '#103'
        },
        status:{
          indexeddb:{ state: posDB.available ? 'idle' : 'offline', lastSync: null },
          kds:{ state:'idle', endpoint:'wss://signal.mas.com.eg/signaldata?id=96nnVOIawRs7Wo_XpAFM0Q' }
        },
        schema:{
          name: POS_SCHEMA_SOURCE?.name || 'mishkah_pos',
          version: POS_SCHEMA_SOURCE?.version || 1,
          tables: Array.isArray(POS_SCHEMA_SOURCE?.tables) ? POS_SCHEMA_SOURCE.tables : []
        },
        employees,
        menu:{
          search:'',
          category:'all',
          showFavoritesOnly:false,
          favorites:[],
          categories,
          items: menuItems
        },
        order:{
          id: initialOrderId,
          status:'open',
          fulfillmentStage:'new',
          paymentState:'unpaid',
          type:'dine_in',
          tableIds:[],
          guests:2,
          lines:[],
          notes:[],
          totals: initialTotals,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          allowAdditions:true,
          lockLineEdits:false,
          isPersisted:false,
          origin:'pos',
          shiftId: activeShift?.id || null,
          posId: POS_INFO.id,
          posLabel: POS_INFO.label,
          posNumber: POS_INFO.number,
          payments:[],
          customerId:null,
          customerAddressId:null,
          customerName:'',
          customerPhone:'',
          customerAddress:'',
          customerAreaId:null
        },
        orderStages,
        orderStatuses,
        orderPaymentStates,
        orderLineStatuses,
        kitchenSections,
        categorySections,
        tables,
        tableLocks,
        reservations,
        ordersQueue,
        auditTrail,
        payments:{
          methods: PAYMENT_METHODS,
          activeMethod: PAYMENT_METHODS[0]?.id || 'cash',
          split:[]
        },
        customers: createInitialCustomers(),
        customerAreas: CAIRO_DISTRICTS,
        modifiers: modifiersCatalog,
        print:{
          size:'thermal_80',
          docType:'customer',
          availablePrinters:[
            { id:'Thermal-80', label:'Thermal 80mm' },
            { id:'Kitchen-A5', label:'Kitchen A5' },
            { id:'Front-A4', label:'Front Office A4' }
          ],
          profiles:{
            customer:{
              size:'thermal_80',
              defaultPrinter:'Thermal-80',
              insidePrinter:'Thermal-80',
              outsidePrinter:'Front-A4',
              autoSend:true,
              preview:false,
              duplicateInside:false,
              duplicateOutside:true,
              copies:1
            },
            kitchen:{
              size:'a5',
              defaultPrinter:'Kitchen-A5',
              insidePrinter:'Kitchen-A5',
              outsidePrinter:'',
              autoSend:false,
              preview:true,
              duplicateInside:true,
              duplicateOutside:false,
              copies:1
            }
          }
        },
        reports:{ salesToday:0, ordersCount:0, avgTicket:0, topItemId:null },
        ordersHistory: ordersHistorySeed,
        shift:{
          current: activeShift,
          history: shiftHistoryFromDb,
          config:{ pinLength: SHIFT_PIN_LENGTH, openingFloat: SHIFT_OPEN_FLOAT_DEFAULT }
        }
      },
      ui:{
        modals:{ tables:false, payments:false, reports:false, print:false, reservations:false, orders:false, modifiers:false },
        modalSizes: savedModalSizes,
        drawers:{},
        settings:{ open:false, activeTheme: initialTheme },
        paymentDraft:{ amount:'' },
        tables:{ view:'assign', filter:'all', search:'', details:null },
        reservations:{ filter:'today', status:'all', editing:null, form:null },
        print:{ docType:'customer', size:'thermal_80', showPreview:false, showAdvanced:false, managePrinters:false, newPrinterName:'' },
        orders:{ tab:'all', search:'', sort:{ field:'updatedAt', direction:'desc' } },
        shift:{ showPin:false, pin:'', openingFloat: SHIFT_OPEN_FLOAT_DEFAULT, showSummary:false, viewShiftId:null, activeTab:'summary' },
        customer:{ open:false, mode:'search', search:'', keypad:'', selectedCustomerId:null, selectedAddressId:null, form:createEmptyCustomerForm() },
        orderNav:{ showPad:false, value:'' },
        lineModifiers:{ lineId:null, addOns:[], removals:[] }
      }
    };

    let appRef = null;

    async function refreshPersistentSnapshot(options={}){
      if(!posDB.available) return null;
      const { focusCurrent=false, syncOrders=true } = options;
      try{
        const [allOrders, activeShiftRaw, shiftListRaw, activeOrdersOnly] = await Promise.all([
          posDB.listOrders({ onlyActive:false }),
          posDB.getActiveShift(POS_INFO.id),
          posDB.listShifts({ posId: POS_INFO.id, limit: 100 }),
          posDB.listOrders({ onlyActive:true })
        ]);
        const historyOrders = Array.isArray(allOrders) ? allOrders.map((order, idx)=>({
          ...order,
          seq: idx + 1,
          payments: Array.isArray(order.payments) ? order.payments.map(payment=> ({ ...payment })) : [],
          lines: Array.isArray(order.lines) ? order.lines.map(line=> ({ ...line })) : []
        })) : [];
        const summarySource = historyOrders;
        let currentShift = null;
        if(activeShiftRaw){
          const sanitizedActive = SHIFT_TABLE.createRecord({
            ...activeShiftRaw,
            totalsByType: activeShiftRaw.totalsByType || {},
            paymentsByMethod: activeShiftRaw.paymentsByMethod || {},
            countsByType: activeShiftRaw.countsByType || {},
            orders: Array.isArray(activeShiftRaw.orders) ? activeShiftRaw.orders : []
          });
          const activeSummary = summarizeShiftOrders(summarySource, sanitizedActive);
          currentShift = {
            ...sanitizedActive,
            totalsByType: activeSummary.totalsByType,
            paymentsByMethod: activeSummary.paymentsByMethod,
            totalSales: activeSummary.totalSales,
            orders: activeSummary.orders,
            ordersCount: activeSummary.ordersCount,
            countsByType: activeSummary.countsByType,
            payments: activeSummary.payments,
            refunds: activeSummary.refunds,
            returns: activeSummary.returns
          };
        }
        const history = Array.isArray(shiftListRaw) ? shiftListRaw
          .filter(item=> !currentShift || item.id !== currentShift.id)
          .map(entry=>{
            const sanitized = SHIFT_TABLE.createRecord({
              ...entry,
              totalsByType: entry.totalsByType || {},
              paymentsByMethod: entry.paymentsByMethod || {},
              countsByType: entry.countsByType || {},
              orders: Array.isArray(entry.orders) ? entry.orders : []
            });
            const summary = summarizeShiftOrders(summarySource, sanitized);
            return {
              ...sanitized,
              totalsByType: summary.totalsByType,
              paymentsByMethod: summary.paymentsByMethod,
              totalSales: summary.totalSales,
              orders: summary.orders,
              ordersCount: summary.ordersCount,
              countsByType: summary.countsByType,
              payments: summary.payments,
              refunds: summary.refunds,
              returns: summary.returns
            };
          }) : [];
        const activeOrders = Array.isArray(activeOrdersOnly) ? activeOrdersOnly.slice() : [];
        const stateSource = appRef && typeof appRef.getState === 'function'
          ? appRef.getState()
          : posState;
        const previousData = stateSource?.data || {};
        const nextData = {
          ...previousData,
          ordersQueue: activeOrders,
          ordersHistory: syncOrders ? historyOrders : previousData.ordersHistory,
          shift:{
            ...(previousData.shift || {}),
            current: currentShift,
            history
          },
          user:{
            ...(previousData.user || {}),
            shift: currentShift?.id || '—',
            shiftNo: currentShift?.id || previousData.user?.shiftNo || '—'
          },
          order:{
            ...(previousData.order || {}),
            shiftId: currentShift?.id || null
          },
          status:{
            ...(previousData.status || {}),
            indexeddb:{ state:'online', lastSync: Date.now() }
          }
        };
        const nextUi = {
          ...(stateSource?.ui || {}),
          shift:{
            ...(stateSource?.ui?.shift || {}),
            viewShiftId: focusCurrent && currentShift ? currentShift.id : (stateSource?.ui?.shift?.viewShiftId || currentShift?.id || null)
          }
        };
        posState.data = nextData;
        posState.ui = nextUi;
        if(appRef && typeof appRef.setState === 'function'){
          appRef.setState(prev=>({
            ...prev,
            data: nextData,
            ui: nextUi
          }));
        }
        if(appRef && typeof appRef.flush === 'function'){
          appRef.flush({ force: true });
        }
        return { current: currentShift, history, orders: historyOrders };
      } catch(error){
        console.warn('[Mishkah][POS] refreshPersistentSnapshot failed', error);
        return null;
      }
    }

    function getOrderTypeConfig(type){
      return ORDER_TYPES.find(o=> o.id === type) || ORDER_TYPES[0];
    }

    function statusBadge(db, state, label){
      const t = getTexts(db);
      const tone = state === 'online' ? 'status/online' : state === 'offline' ? 'status/offline' : 'status/idle';
      const stateText = state === 'online' ? t.ui.status_online : state === 'offline' ? t.ui.status_offline : t.ui.status_idle;
      return UI.Badge({
        variant:'badge/status',
        attrs:{ class: tw`${token(tone)} text-xs` },
        leading: state === 'online' ? '●' : state === 'offline' ? '✖' : '…',
        text: `${label} • ${stateText}`
      });
    }

    function ThemeSwitch(db){
      const t = getTexts(db);
      return UI.Segmented({
        items:[
          { id:'light', label:`☀️ ${t.ui.light}`, attrs:{ gkey:'pos:theme:toggle', 'data-theme':'light' } },
          { id:'dark', label:`🌙 ${t.ui.dark}`, attrs:{ gkey:'pos:theme:toggle', 'data-theme':'dark' } }
        ],
        activeId: db.env.theme,
        attrs:{ class: tw`hidden xl:inline-flex` }
      });
    }

    function LangSwitch(db){
      const t = getTexts(db);
      return UI.Segmented({
        items:[
          { id:'ar', label:t.ui.arabic, attrs:{ gkey:'pos:lang:switch', 'data-lang':'ar' } },
          { id:'en', label:t.ui.english, attrs:{ gkey:'pos:lang:switch', 'data-lang':'en' } }
        ],
        activeId: db.env.lang
      });
    }

    function ShiftControls(db){
      const t = getTexts(db);
      const shiftState = db.data.shift || {};
      const current = shiftState.current;
      const historyCount = Array.isArray(shiftState.history) ? shiftState.history.length : 0;
      if(current){
        const summaryButton = UI.Button({
          attrs:{ gkey:'pos:shift:summary', class: tw`rounded-full`, title:`${t.ui.shift_current}: ${current.id}` },
          variant:'soft',
          size:'sm'
        }, [t.ui.shift_close_button]);
        const idBadge = UI.Badge({
          text: current.id,
          variant:'badge/ghost',
          attrs:{ class: tw`hidden sm:inline-flex text-xs` }
        });
        return UI.HStack({ attrs:{ class: tw`items-center gap-2` }}, [summaryButton, idBadge]);
      }
      const openButton = UI.Button({ attrs:{ gkey:'pos:shift:open', class: tw`rounded-full` }, variant:'solid', size:'sm' }, [t.ui.shift_open_button]);
      if(historyCount){
        const historyButton = UI.Button({
          attrs:{ gkey:'pos:shift:summary', class: tw`rounded-full`, title:t.ui.shift_history },
          variant:'ghost',
          size:'sm'
        }, [t.ui.shift_history]);
        return UI.HStack({ attrs:{ class: tw`items-center gap-2` }}, [openButton, historyButton]);
      }
      return openButton;
    }

    function Header(db){
      const t = getTexts(db);
      const user = db.data.user;
      const orderType = getOrderTypeConfig(db.data.order.type);
      return UI.Toolbar({
        left:[
          D.Text.Span({ attrs:{ class: tw`text-2xl font-black tracking-tight` }}, ['Mishkah POS']),
          UI.Badge({ text:`${orderType.icon} ${localize(orderType.label, db.env.lang)}`, variant:'badge/ghost', attrs:{ class: tw`text-sm` } })
        ],
        right:[
          UI.Button({ attrs:{ gkey:'pos:settings:open', title:t.ui.settings_center }, variant:'ghost', size:'md' }, [D.Text.Span({ attrs:{ class: tw`text-xl sm:text-2xl` }}, ['⚙️'])]),
          ShiftControls(db),
          ThemeSwitch(db),
          LangSwitch(db),
          UI.Button({ attrs:{ gkey:'pos:tables:open', title:t.ui.tables }, variant:'ghost', size:'md' }, [D.Text.Span({ attrs:{ class: tw`text-xl sm:text-2xl` }}, ['🪑'])]),
          UI.Button({ attrs:{ gkey:'pos:reservations:open', title:t.ui.reservations }, variant:'ghost', size:'md' }, [D.Text.Span({ attrs:{ class: tw`text-xl sm:text-2xl` }}, ['📅'])]),
          UI.Button({ attrs:{ gkey:'pos:orders:open', title:t.ui.orders_queue }, variant:'ghost', size:'md' }, [D.Text.Span({ attrs:{ class: tw`text-xl sm:text-2xl` }}, ['🧾'])]),
          UI.Badge({ text:`${t.ui.cashier}: ${user.name}`, leading:'👤', variant:'badge/ghost' }),
          UI.Button({ attrs:{ gkey:'pos:session:logout', title:'Logout' }, variant:'ghost', size:'md' }, [D.Text.Span({ attrs:{ class: tw`text-xl sm:text-2xl` }}, ['🚪'])])
        ]
      });
    }

    function MenuItemCard(db, item){
      const lang = db.env.lang;
      const menu = db.data.menu;
      const isFav = (menu.favorites || []).includes(String(item.id));
      return D.Containers.Div({
        attrs:{
          class: tw`relative flex flex-col gap-2 rounded-3xl border border-[var(--border)] bg-[var(--surface-1)] p-3 text-[var(--foreground)] transition hover:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]`,
          gkey:'pos:menu:add',
          'data-item-id': item.id,
          role:'button',
          tabindex:'0'
        }
      }, [
        UI.Button({
          attrs:{
            gkey:'pos:menu:favorite',
            'data-item-id': item.id,
            class: tw`absolute top-2 ${db.env.dir === 'rtl' ? 'left-2' : 'right-2'} rounded-full`
          },
          variant: isFav ? 'solid' : 'ghost',
          size:'sm'
        }, [isFav ? '★' : '☆']),
        D.Containers.Div({ attrs:{ class: tw`h-24 overflow-hidden rounded-2xl bg-[var(--surface-2)]` }}, [
          item.image
            ? D.Media.Img({ attrs:{ src:item.image, alt:localize(item.name, lang), class: tw`h-full w-full object-cover scale-[1.05]` }})
            : D.Containers.Div({ attrs:{ class: tw`grid h-full place-items-center text-3xl` }}, ['🍽️'])
        ]),
        D.Containers.Div({ attrs:{ class: tw`space-y-1` }}, [
          D.Text.Strong({ attrs:{ class: tw`text-sm font-semibold leading-tight` }}, [localize(item.name, lang)]),
          localize(item.description, lang)
            ? D.Text.P({ attrs:{ class: tw`text-xs ${token('muted')} line-clamp-2` }}, [localize(item.description, lang)])
            : null
        ].filter(Boolean)),
        D.Containers.Div({ attrs:{ class: tw`mt-auto flex items-center justify-between text-sm` }}, [
          UI.PriceText({ amount:item.price, currency:getCurrency(db), locale:getLocale(db) }),
          D.Text.Span({ attrs:{ class: tw`text-xl font-semibold text-[var(--primary)]` }}, ['+'])
        ])
      ]);
    }

    function MenuColumn(db){
      const t = getTexts(db);
      const lang = db.env.lang;
      const menu = db.data.menu;
      const filtered = filterMenu(menu, lang);
      const categories = Array.isArray(menu.categories) ? menu.categories : [];
      const seenCategories = new Set();
      const chips = categories.reduce((acc, cat)=>{
        if(!cat || !cat.id || seenCategories.has(cat.id)) return acc;
        seenCategories.add(cat.id);
        acc.push({
          id: cat.id,
          label: localize(cat.label, lang),
          attrs:{ gkey:'pos:menu:category', 'data-category-id':cat.id }
        });
        return acc;
      }, []).sort((a,b)=> (a.id==='all' ? -1 : b.id==='all' ? 1 : 0));
      return D.Containers.Section({ attrs:{ class: tw`flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden` }}, [
        UI.Card({
          variant:'card/soft-1',
          content: D.Containers.Div({ attrs:{ class: tw`flex flex-col gap-3` }}, [
            UI.SearchBar({
              value: menu.search,
              placeholder: t.ui.search,
              onInput:'pos:menu:search',
              trailing:[
                UI.Button({
                  attrs:{
                    gkey:'pos:menu:favorites-only',
                    class: tw`rounded-full ${menu.showFavoritesOnly ? 'bg-[var(--primary)] text-white' : ''}`
                  },
                  variant: menu.showFavoritesOnly ? 'solid' : 'ghost',
                  size:'sm'
                }, ['⭐'])
              ]
            }),
            UI.ChipGroup({ items: chips, activeId: menu.category })
          ])
        }),
        D.Containers.Section({ attrs:{ class: tw`${token('scroll-panel')} flex-1 min-h-0 w-full overflow-hidden` }}, [
          D.Containers.Div({ attrs:{ class: tw`${token('scroll-panel/head')}` }}, [
            D.Text.Strong({}, [t.ui.categories]),
            UI.Button({ attrs:{ gkey:'pos:menu:load-more' }, variant:'ghost', size:'sm' }, [t.ui.load_more])
          ]),
          UI.ScrollArea({
            attrs:{ class: tw`${token('scroll-panel/body')} h-full w-full px-3 pb-3` },
            children:[
              filtered.length
                ? D.Containers.Div({ attrs:{ class: tw`grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3` }}, filtered.map(item=> MenuItemCard(db, item)))
                : UI.EmptyState({ icon:'🍽️', title:t.ui.cart_empty, description:t.ui.choose_items })
            ]
          }),
          D.Containers.Div({ attrs:{ class: tw`${token('scroll-panel/footer')} flex flex-wrap items-center justify-between gap-3` }}, [
            statusBadge(db, db.data.status.indexeddb.state, t.ui.indexeddb),
            D.Containers.Div({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [
              D.Text.Span({}, [`${t.ui.last_sync}: ${formatSync(db.data.status.indexeddb.lastSync, lang) || t.ui.never_synced}`])
            ]),
            UI.Button({ attrs:{ gkey:'pos:indexeddb:sync' }, variant:'ghost', size:'sm' }, [t.ui.sync_now])
          ])
        ])
      ]);
    }

    function OrderLine(db, line){
      const t = getTexts(db);
      const lang = db.env.lang;
      const modifiers = Array.isArray(line.modifiers) ? line.modifiers : [];
      const notes = Array.isArray(line.notes) ? line.notes.filter(Boolean).join(' • ') : (line.notes || '');
      const modifiersRow = modifiers.length
        ? D.Containers.Div({ attrs:{ class: tw`flex flex-wrap gap-2 text-[10px] sm:text-xs text-[var(--muted-foreground)]` }}, modifiers.map(mod=>{
            const delta = Number(mod.priceChange || mod.price_change || 0) || 0;
            const priceLabel = delta ? `${delta > 0 ? '+' : '−'} ${formatCurrencyValue(db, Math.abs(delta))}` : '';
            return D.Containers.Div({ attrs:{ class: tw`rounded-full bg-[color-mix(in oklab,var(--surface-2) 92%, transparent)] px-2 py-1` }}, [
              `${localize(mod.label, lang)}${priceLabel ? ` (${priceLabel})` : ''}`
            ]);
          }))
        : null;
      const notesRow = notes
        ? D.Text.Span({ attrs:{ class: tw`text-[10px] sm:text-xs ${token('muted')}` }}, ['📝 ', notes])
        : null;
      return UI.ListItem({
        leading: D.Text.Span({ attrs:{ class: tw`text-lg` }}, ['🍲']),
        content:[
          D.Text.Strong({}, [localize(line.name, lang)]),
          modifiersRow,
          notesRow
        ].filter(Boolean),
        trailing:[
          UI.QtyStepper({ value: line.qty, gkeyDec:'pos:order:line:dec', gkeyInc:'pos:order:line:inc', gkeyEdit:'pos:order:line:qty', dataId: line.id }),
          UI.PriceText({ amount: line.total, currency:getCurrency(db), locale:getLocale(db) }),
          UI.Button({
            attrs:{
              gkey:'pos:order:line:modifiers',
              'data-line-id':line.id,
              title: t.ui.line_modifiers
            },
            variant:'ghost',
            size:'sm'
          }, [D.Text.Span({ attrs:{ class: tw`text-lg` }}, ['➕/➖'])])
        ]
      });
    }

    function TotalsSection(db){
      const t = getTexts(db);
      const totals = db.data.order.totals || {};
      const paymentsState = Array.isArray(db.data.payments?.split) ? db.data.payments.split : [];
      const orderPayments = Array.isArray(db.data.order?.payments) ? db.data.order.payments : [];
      const paymentsEntries = paymentsState.length ? paymentsState : orderPayments;
      const totalDue = round(Number(totals.due || 0));
      const totalPaid = round(paymentsEntries.reduce((sum, entry)=> sum + (Number(entry.amount) || 0), 0));
      const remaining = Math.max(0, round(totalDue - totalPaid));
      const rows = [
        { label:t.ui.subtotal, value: totals.subtotal },
        { label:t.ui.service, value: totals.service },
        { label:t.ui.vat, value: totals.vat },
        totals.deliveryFee ? { label:t.ui.delivery_fee, value: totals.deliveryFee } : null,
        totals.discount ? { label:t.ui.discount, value: totals.discount } : null
      ].filter(Boolean);
      const summaryRows = [
        paymentsEntries.length ? UI.HStack({ attrs:{ class: tw`${token('split')} text-sm` }}, [
          D.Text.Span({}, [t.ui.paid]),
          UI.PriceText({ amount: totalPaid, currency:getCurrency(db), locale:getLocale(db) })
        ]) : null,
        UI.HStack({ attrs:{ class: tw`${token('split')} text-sm font-semibold ${remaining > 0 ? 'text-[var(--accent-foreground)]' : ''}` }}, [
          D.Text.Span({}, [t.ui.balance_due]),
          UI.PriceText({ amount: remaining, currency:getCurrency(db), locale:getLocale(db) })
        ])
      ].filter(Boolean);
      return D.Containers.Div({ attrs:{ class: tw`space-y-2` }}, [
        ...rows.map(row=> UI.HStack({ attrs:{ class: tw`${token('split')} text-sm` }}, [
          D.Text.Span({ attrs:{ class: tw`${token('muted')}` }}, [row.label]),
          UI.PriceText({ amount:row.value, currency:getCurrency(db), locale:getLocale(db) })
        ])),
        UI.Divider(),
        UI.HStack({ attrs:{ class: tw`${token('split')} text-lg font-semibold` }}, [
          D.Text.Span({}, [t.ui.total]),
          UI.PriceText({ amount:totals.due, currency:getCurrency(db), locale:getLocale(db) })
        ]),
        ...summaryRows
      ]);
    }

    function CartFooter(db){
      const t = getTexts(db);
      return D.Containers.Div({ attrs:{ class: tw`shrink-0 border-t border-[var(--border)] bg-[color-mix(in oklab,var(--surface-1) 90%, transparent)] px-4 py-3 rounded-[var(--radius)] shadow-[var(--shadow)] flex flex-col gap-3` }}, [
        TotalsSection(db),
        UI.HStack({ attrs:{ class: tw`gap-2` }}, [
          UI.Button({ attrs:{ gkey:'pos:order:discount', class: tw`flex-1` }, variant:'ghost', size:'sm' }, [t.ui.discount_action]),
          UI.Button({ attrs:{ gkey:'pos:order:note', class: tw`flex-1` }, variant:'ghost', size:'sm' }, [t.ui.notes])
        ])
      ]);
    }

    function computeTableRuntime(db){
      const tables = db.data.tables || [];
      const locks = (db.data.tableLocks || []).filter(lock=> lock.active !== false);
      const reservations = db.data.reservations || [];
      const currentOrderId = db.data.order?.id;
      return tables.map(table=>{
        const activeLocks = locks.filter(lock=> lock.tableId === table.id);
        const orderLocks = activeLocks.filter(lock=> lock.orderId);
        const reservationLocks = activeLocks.filter(lock=> lock.reservationId);
        const lockState = table.state !== 'active'
          ? table.state
          : activeLocks.length === 0
            ? 'free'
            : activeLocks.length === 1
              ? 'single'
              : 'multi';
        const reservationRefs = reservationLocks.map(lock=> reservations.find(res=> res.id === lock.reservationId)).filter(Boolean);
        return {
          ...table,
          lockState,
          activeLocks,
          orderLocks,
          reservationLocks,
          reservationRefs,
          isCurrentOrder: orderLocks.some(lock=> lock.orderId === currentOrderId)
        };
      });
    }

    function tableStateLabel(t, runtime){
      if(runtime.state === 'disactive') return t.ui.tables_state_disactive;
      if(runtime.state === 'maintenance') return t.ui.tables_state_maintenance;
      if(runtime.lockState === 'free') return t.ui.tables_state_free;
      if(runtime.lockState === 'single') return t.ui.tables_state_single;
      if(runtime.lockState === 'multi') return t.ui.tables_state_multi;
      return t.ui.tables_state_active;
    }

    function tablePalette(runtime){
      if(runtime.state === 'disactive') return 'border-zinc-700 bg-zinc-800/40 text-zinc-400';
      if(runtime.state === 'maintenance') return 'border-amber-500/40 bg-amber-500/10 text-amber-400';
      if(runtime.lockState === 'free') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400';
      if(runtime.lockState === 'single') return 'border-sky-500/40 bg-sky-500/10 text-sky-400';
      if(runtime.lockState === 'multi') return 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-400';
      return 'border-[var(--border)] bg-[var(--surface-1)]';
    }

    function PaymentSummary(db){
      const t = getTexts(db);
      const splitState = Array.isArray(db.data.payments?.split) ? db.data.payments.split : [];
      const fallbackPayments = Array.isArray(db.data.order?.payments) ? db.data.order.payments : [];
      const split = splitState.length ? splitState : fallbackPayments;
      const methods = (db.data.payments?.methods && db.data.payments.methods.length)
        ? db.data.payments.methods
        : PAYMENT_METHODS;
      const due = db.data.order.totals?.due || 0;
      const totalPaid = split.reduce((sum, entry)=> sum + (Number(entry.amount)||0), 0);
      const remaining = Math.max(0, round(due - totalPaid));
      const change = Math.max(0, round(totalPaid - due));
      const balanceSummary = remaining > 0 || change > 0
        ? D.Containers.Div({ attrs:{ class: tw`space-y-2 rounded-[var(--radius)] bg-[color-mix(in oklab,var(--surface-2) 92%, transparent)] px-3 py-2 text-sm` }}, [
            remaining > 0 ? UI.HStack({ attrs:{ class: tw`${token('split')} font-semibold text-[var(--accent-foreground)]` }}, [
              D.Text.Span({}, [t.ui.balance_due]),
              UI.PriceText({ amount: remaining, currency:getCurrency(db), locale:getLocale(db) })
            ]) : null,
            change > 0 ? UI.HStack({ attrs:{ class: tw`${token('split')} text-[var(--muted-foreground)]` }}, [
              D.Text.Span({}, [t.ui.exchange_due]),
              UI.PriceText({ amount: change, currency:getCurrency(db), locale:getLocale(db) })
            ]) : null
          ].filter(Boolean))
        : null;
      return UI.Card({
        variant:'card/soft-1',
        title: t.ui.split_payments,
        content: D.Containers.Div({ attrs:{ class: tw`space-y-2` }}, [
          balanceSummary,
          ...split.map(entry=>{
            const method = methods.find(m=> m.id === entry.method);
            const label = method ? `${method.icon} ${localize(method.label, db.env.lang)}` : entry.method;
            return UI.HStack({ attrs:{ class: tw`${token('split')} text-sm` }}, [
              D.Text.Span({}, [label]),
              UI.PriceText({ amount: entry.amount, currency:getCurrency(db), locale:getLocale(db) })
            ]);
          }),
          split.length ? UI.Divider() : null,
          UI.HStack({ attrs:{ class: tw`${token('split')} text-sm font-semibold` }}, [
            D.Text.Span({}, [t.ui.paid]),
            UI.PriceText({ amount: totalPaid, currency:getCurrency(db), locale:getLocale(db) })
          ]),
          UI.Button({ attrs:{ gkey:'pos:payments:open', class: tw`w-full flex items-center justify-center gap-2` }, variant:'soft', size:'sm' }, [
            D.Text.Span({ attrs:{ class: tw`text-lg` }}, ['💳']),
            D.Text.Span({ attrs:{ class: tw`text-sm font-semibold` }}, [t.ui.open_payments])
          ])
        ].filter(Boolean))
      });
    }

    function OrderNavigator(db){
      const t = getTexts(db);
      const history = Array.isArray(db.data.ordersHistory) ? db.data.ordersHistory : [];
      if(!history.length) return UI.Card({ variant:'card/soft-1', content: UI.EmptyState({ icon:'🧾', title:t.ui.order_nav_label, description:t.ui.order_nav_no_history }) });
      const currentId = db.data.order?.id;
      const currentIndex = history.findIndex(entry=> entry.id === currentId);
      const total = history.length;
      const currentSeq = currentIndex >= 0 ? (history[currentIndex].seq || currentIndex + 1) : null;
      const label = currentSeq ? `#${currentSeq} / ${total}` : `— / ${total}`;
      const disablePrev = currentIndex <= 0;
      const disableNext = currentIndex < 0 || currentIndex >= total - 1;
      const quickActions = UI.HStack({ attrs:{ class: tw`items-center justify-between gap-3` }}, [
        D.Text.Strong({ attrs:{ class: tw`text-sm` }}, [t.ui.order_nav_label]),
        D.Text.Span({ attrs:{ class: tw`text-xs text-[var(--muted-foreground)]` }}, [`${t.ui.order_nav_total}: ${total}`])
      ]);
      const navigatorRow = UI.HStack({ attrs:{ class: tw`flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-1)] px-4 py-3 text-sm` }}, [
        UI.Button({ attrs:{ gkey:'pos:order:new', title:t.ui.new_order, class: tw`h-12 w-12 rounded-full text-xl` }, variant:'soft', size:'md' }, ['🆕']),
        UI.Button({ attrs:{ gkey:'pos:order:nav:prev', disabled:disablePrev, class: tw`h-12 w-12 rounded-full text-lg` }, variant:'soft', size:'md' }, ['⬅️']),
        D.Text.Span({ attrs:{ class: tw`text-base font-semibold` }}, [label]),
        UI.Button({ attrs:{ gkey:'pos:order:nav:pad', class: tw`h-12 w-12 rounded-full text-lg` }, variant:'soft', size:'md' },['🔢']),
        UI.Button({ attrs:{ gkey:'pos:order:nav:next', disabled:disableNext, class: tw`h-12 w-12 rounded-full text-lg` }, variant:'soft', size:'md' }, ['➡️']),
        UI.Button({ attrs:{ gkey:'pos:order:clear', title:t.ui.clear, class: tw`h-12 w-12 rounded-full text-xl` }, variant:'ghost', size:'md' }, ['🧹'])
      ]);
      const padVisible = !!db.ui.orderNav?.showPad;
      const padValue = db.ui.orderNav?.value || '';
      const pad = padVisible
        ? UI.Card({
            variant:'card/soft-2',
            title: t.ui.order_nav_open,
            content: D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, [
              UI.NumpadDecimal({
                value: padValue,
                placeholder: t.ui.order_nav_placeholder,
                gkey:'pos:order:nav:input',
                allowDecimal:false,
                confirmLabel:t.ui.order_nav_open,
                confirmAttrs:{ gkey:'pos:order:nav:confirm', variant:'solid', size:'sm', class: tw`w-full` }
              }),
              UI.Button({ attrs:{ gkey:'pos:order:nav:close', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.close])
            ])
          })
        : null;
      return D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, [quickActions, navigatorRow, pad].filter(Boolean));
    }

    function OrderCustomerPanel(db){
      const t = getTexts(db);
      const order = db.data.order || {};
      const customers = db.data.customers || [];
      const customer = findCustomer(customers, order.customerId);
      const address = customer ? findCustomerAddress(customer, order.customerAddressId) : null;
      const phone = (order.customerPhone || (customer?.phones?.[0] || '')).trim();
      const areaLabel = address ? getDistrictLabel(address.areaId, db.env.lang) : (order.customerAreaId ? getDistrictLabel(order.customerAreaId, db.env.lang) : '');
      const summaryParts = [];
      if(address?.title) summaryParts.push(address.title);
      if(areaLabel) summaryParts.push(areaLabel);
      if(address?.line) summaryParts.push(address.line);
      const summary = summaryParts.join(' • ');
      const requiresAddress = order.type === 'delivery';
      const missing = requiresAddress && (!customer || !address);
      const nameLabel = order.customerName || customer?.name || t.ui.customer_new;
      return D.Containers.Div({ attrs:{ class: tw`flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[color-mix(in oklab,var(--surface-1) 92%, transparent)] p-3` }}, [
        D.Containers.Div({ attrs:{ class: tw`flex items-center justify-between gap-2` }}, [
          D.Text.Strong({ attrs:{ class: tw`text-sm` }}, [nameLabel]),
          UI.Button({ attrs:{ gkey:'pos:customer:open', class: tw`h-9 rounded-full px-3 text-sm` }, variant:'soft', size:'sm' }, ['👤 ', t.ui.customer_attach])
        ]),
        phone ? D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [`📞 ${phone}`]) : null,
        summary ? D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [`📍 ${summary}`]) : null,
        missing ? UI.Badge({ text:t.ui.customer_required_delivery, variant:'badge' }) : null
      ].filter(Boolean));
    }

    function OrderColumn(db){
      const t = getTexts(db);
      const order = db.data.order;
      const assignedTables = (order.tableIds || []).map(tableId=>{
        const table = (db.data.tables || []).find(tbl=> tbl.id === tableId);
        return { id: tableId, name: table?.name || tableId };
      });
      const serviceSegments = ORDER_TYPES.map(type=>({
        id: type.id,
        label: `${type.icon} ${localize(type.label, db.env.lang)}`,
        attrs:{ gkey:'pos:order:type', 'data-order-type':type.id }
      }));
      return D.Containers.Section({ attrs:{ class: tw`flex h-full min-h-0 w-full flex-col overflow-hidden` }}, [
        UI.ScrollArea({
          attrs:{ class: tw`flex-1 min-h-0 w-full` },
          children:[
            D.Containers.Div({ attrs:{ class: tw`flex flex-col gap-3 pe-1 pb-4` }}, [
              UI.Card({
                variant:'card/soft-1',
                content: D.Containers.Div({ attrs:{ class: tw`flex h-full min-h-0 flex-col gap-3` }}, [
                  UI.Segmented({ items: serviceSegments, activeId: order.type }),
                  D.Containers.Div({ attrs:{ class: tw`flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm ${token('muted')}` }}, [
                    D.Text.Span({}, [`${t.ui.order_id} ${order.id}`]),
                    order.type === 'dine_in'
                      ? D.Containers.Div({ attrs:{ class: tw`flex flex-1 flex-wrap items-center gap-2` }}, [
                          assignedTables.length
                            ? D.Containers.Div({ attrs:{ class: tw`flex flex-wrap gap-2` }}, assignedTables.map(table=>
                                UI.Button({
                                  attrs:{
                                    gkey:'pos:order:table:remove',
                                    'data-table-id':table.id,
                                    class: tw`h-8 rounded-full bg-[var(--accent)] px-3 text-xs sm:text-sm flex items-center gap-2`
                                  },
                                  variant:'ghost',
                                  size:'sm'
                                }, [`🪑 ${table.name}`, '✕'])
                              ))
                            : D.Text.Span({ attrs:{ class: tw`${token('muted')}` }}, [t.ui.select_table]),
                          UI.Button({ attrs:{ gkey:'pos:tables:open', class: tw`h-8 w-8 rounded-full border border-dashed border-[var(--border)]` }, variant:'ghost', size:'sm' }, ['＋'])
                        ])
                      : D.Text.Span({}, [localize(getOrderTypeConfig(order.type).label, db.env.lang)]),
                    D.Text.Span({}, [`${t.ui.guests}: ${order.guests}`])
                  ]),
                  D.Containers.Div({ attrs:{ class: tw`flex-1 min-h-0 w-full` }}, [
                    UI.ScrollArea({
                      attrs:{ class: tw`h-full min-h-0 w-full flex-1` },
                      children:[
                        order.lines && order.lines.length
                          ? UI.List({ children: order.lines.map(line=> OrderLine(db, line)) })
                          : UI.EmptyState({ icon:'🧺', title:t.ui.cart_empty, description:t.ui.choose_items })
                      ]
                    })
                  ]),
                  CartFooter(db)
                ])
              }),
              PaymentSummary(db),
              OrderCustomerPanel(db),
              OrderNavigator(db)
            ])
          ]
        })
      ]);
    }

    function FooterBar(db){
      const t = getTexts(db);
      const reports = computeRealtimeReports(db);
      const salesToday = new Intl.NumberFormat(getLocale(db)).format(reports.salesToday || 0);
      const currencyLabel = getCurrencySymbol(db);
      const order = db.data.order || {};
      const orderType = order.type || 'dine_in';
      const isPersisted = !!order.isPersisted;
      const saveMode = (orderType === 'dine_in' && !isPersisted) ? 'save-only' : 'save-print';
      const saveLabel = (orderType === 'dine_in' && !isPersisted) ? t.ui.save_order : t.ui.settle_and_print;
      const reportsSummary = D.Containers.Div({ attrs:{ class: tw`flex flex-col items-end gap-1 text-xs text-[var(--muted-foreground)]` }}, [
        D.Text.Span({ attrs:{ class: tw`text-sm font-semibold text-[var(--foreground)]` }}, [`${t.ui.sales_today}: ${salesToday} ${currencyLabel}`]),
        D.Containers.Div({ attrs:{ class: tw`flex items-center gap-2` }}, [
          D.Text.Span({}, [`${t.ui.orders_count}: ${reports.ordersCount || 0}`]),
          UI.Button({ attrs:{ gkey:'pos:reports:toggle' }, variant:'ghost', size:'sm' }, [t.ui.open_reports])
        ])
      ]);
      const primaryActions = [];
      primaryActions.push(UI.Button({ attrs:{ gkey:'pos:order:new', class: tw`min-w-[120px] flex items-center justify-center gap-2` }, variant:'ghost', size:'md' }, [
        D.Text.Span({ attrs:{ class: tw`text-lg` }}, ['🆕']),
        D.Text.Span({ attrs:{ class: tw`text-sm font-semibold` }}, [t.ui.new_order])
      ]));
      const saveButton = UI.Button({
        attrs:{ gkey:'pos:order:save', 'data-save-mode':saveMode, class: tw`min-w-[180px] flex items-center justify-center gap-2` },
        variant:'solid',
        size:'md'
      }, [D.Text.Span({ attrs:{ class: tw`text-sm font-semibold` }}, [saveLabel])]);
      primaryActions.push(saveButton);
      primaryActions.push(UI.Button({ attrs:{ gkey:'pos:order:print', class: tw`min-w-[150px] flex items-center justify-center gap-2` }, variant:'soft', size:'md' }, [
        D.Text.Span({ attrs:{ class: tw`text-lg` }}, ['🖨️']),
        D.Text.Span({ attrs:{ class: tw`text-sm font-semibold` }}, [t.ui.print])
      ]));
      return UI.Footerbar({
        left:[
          statusBadge(db, db.data.status.kds.state, t.ui.kds),
          statusBadge(db, db.data.status.indexeddb.state, t.ui.indexeddb)
        ],
        right:[
          reportsSummary,
          ...primaryActions
        ]
      });
    }

    function TablesModal(db){
      const t = getTexts(db);
      if(!db.ui.modals.tables) return null;
      const runtimeTables = computeTableRuntime(db);
      const tablesUI = db.ui.tables || {};
      const view = tablesUI.view || 'assign';
      const filter = tablesUI.filter || 'all';
      const searchTerm = (tablesUI.search || '').trim().toLowerCase();

      const counts = runtimeTables.reduce((acc, table)=>{
        acc.all += table.state === 'disactive' ? 0 : 1;
        if(table.state === 'maintenance') acc.maintenance += 1;
        if(table.state === 'active'){
          if(table.lockState === 'free') acc.free += 1;
          if(table.lockState === 'single') acc.single += 1;
          if(table.lockState === 'multi') acc.multi += 1;
        }
        return acc;
      }, { all:0, free:0, single:0, multi:0, maintenance:0 });

      const filterItems = [
        { id:'all', label:`${t.ui.tables_filter_all} (${counts.all})` },
        { id:'free', label:`${t.ui.tables_filter_free} (${counts.free})` },
        { id:'single', label:`${t.ui.tables_filter_single} (${counts.single})` },
        { id:'multi', label:`${t.ui.tables_filter_multi} (${counts.multi})` },
        { id:'maintenance', label:`${t.ui.tables_filter_maintenance} (${counts.maintenance})` }
      ].map(item=> ({
        ...item,
        attrs:{ gkey:'pos:tables:filter', 'data-tables-filter':item.id }
      }));

      function createTableCard(runtime){
        const palette = tablePalette(runtime);
        const stateLabel = tableStateLabel(t, runtime);
        const ordersCount = runtime.orderLocks.length;
        const reservationsCount = runtime.reservationRefs.length;
        const chips = [];
        if(ordersCount){ chips.push(UI.Badge({ text:`${ordersCount} ${t.ui.tables_orders_badge}`, variant:'badge/ghost' })); }
        if(reservationsCount){ chips.push(UI.Badge({ text:`${reservationsCount} ${t.ui.tables_reservations_badge}`, variant:'badge/ghost' })); }
        if(runtime.isCurrentOrder){ chips.push(UI.Badge({ text:t.ui.table_locked, variant:'badge' })); }
        return D.Containers.Div({
          attrs:{
            class: tw`group relative flex min-h-[160px] flex-col justify-between gap-3 rounded-3xl border-2 p-4 transition hover:shadow-[var(--shadow)] ${palette}`,
            gkey:'pos:tables:card:tap',
            'data-table-id': runtime.id
          }
        }, [
          D.Containers.Div({ attrs:{ class: tw`flex items-start justify-between gap-2` }}, [
            D.Containers.Div({ attrs:{ class: tw`space-y-1.5` }}, [
              D.Text.Strong({ attrs:{ class: tw`text-xl font-semibold` }}, [runtime.name || runtime.id]),
              D.Text.Span({ attrs:{ class: tw`text-sm opacity-70` }}, [`${t.ui.tables_zone}: ${runtime.zone || '—'}`]),
              D.Text.Span({ attrs:{ class: tw`text-sm opacity-70` }}, [`${t.ui.tables_capacity}: ${runtime.capacity}`]),
              D.Text.Span({ attrs:{ class: tw`text-sm font-semibold` }}, [stateLabel])
            ]),
            D.Containers.Div({ attrs:{ class: tw`flex flex-col items-end gap-2` }}, [
              chips.length ? D.Containers.Div({ attrs:{ class: tw`flex flex-wrap justify-end gap-1` }}, chips) : null,
              UI.Button({ attrs:{ gkey:'pos:tables:details', 'data-table-id':runtime.id, class: tw`rounded-full` }, variant:'ghost', size:'sm' }, ['⋯'])
            ].filter(Boolean))
          ]),
          runtime.note
            ? D.Text.Span({ attrs:{ class: tw`text-sm opacity-75` }}, [`📝 ${runtime.note}`])
            : D.Text.Span({ attrs:{ class: tw`text-sm opacity-60` }}, [t.ui.tables_longpress_hint])
        ]);
      }

      function createDetailsPanel(){
        if(!tablesUI.details) return null;
        const runtime = runtimeTables.find(tbl=> tbl.id === tablesUI.details);
        if(!runtime) return null;
        const orderMap = new Map();
        orderMap.set(db.data.order.id, { ...db.data.order });
        (db.data.ordersQueue || []).forEach(ord=> orderMap.set(ord.id, ord));
        const lang = db.env.lang;
        const ordersList = runtime.orderLocks.length
          ? UI.List({
              children: runtime.orderLocks.map(lock=>{
                const order = orderMap.get(lock.orderId) || { id: lock.orderId, status:'open' };
                return UI.ListItem({
                  leading: D.Text.Span({ attrs:{ class: tw`text-xl` }}, ['🧾']),
                  content:[
                    D.Text.Strong({}, [`${t.ui.order_id} ${order.id}`]),
                    D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [formatDateTime(order.updatedAt || lock.lockedAt, lang, { hour:'2-digit', minute:'2-digit' })])
                  ],
                  trailing:[
                    UI.Button({ attrs:{ gkey:'pos:tables:unlock-order', 'data-table-id':runtime.id, 'data-order-id':order.id }, variant:'ghost', size:'sm' }, ['🔓'])
                  ]
                });
              })
            })
          : UI.EmptyState({ icon:'🧾', title:t.ui.table_no_sessions, description:t.ui.table_manage_hint });

        const reservationsList = runtime.reservationRefs.length
          ? UI.List({
              children: runtime.reservationRefs.map(res=> UI.ListItem({
                leading: D.Text.Span({ attrs:{ class: tw`text-xl` }}, ['📅']),
                content:[
                  D.Text.Strong({}, [res.customerName || res.id]),
                  D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [`${formatDateTime(res.scheduledAt, lang, { hour:'2-digit', minute:'2-digit' })} • ${res.partySize} ${t.ui.guests}`])
                ],
                trailing:[
                  UI.Badge({ text: localize(t.ui[`reservations_status_${res.status}`] || res.status, lang === 'ar' ? 'ar' : 'en'), variant:'badge/ghost' })
                ]
              }))
            })
          : null;

        return UI.Card({
          title: `${t.ui.tables_details} — ${runtime.name || runtime.id}`,
          description: t.ui.tables_actions,
          content: D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, [
            D.Containers.Div({ attrs:{ class: tw`flex flex-wrap gap-3 text-sm ${token('muted')}` }}, [
              D.Text.Span({}, [`${t.ui.tables_zone}: ${runtime.zone || '—'}`]),
              D.Text.Span({}, [`${t.ui.tables_capacity}: ${runtime.capacity}`]),
              D.Text.Span({}, [tableStateLabel(t, runtime)])
            ]),
            ordersList,
            reservationsList,
            UI.HStack({ attrs:{ class: tw`justify-end gap-2` }}, [
              UI.Button({ attrs:{ gkey:'pos:tables:unlock-all', 'data-table-id':runtime.id }, variant:'ghost', size:'sm' }, [t.ui.tables_unlock_all]),
              UI.Button({ attrs:{ gkey:'pos:tables:details-close' }, variant:'ghost', size:'sm' }, [t.ui.close])
            ])
          ])
        });
      }

      const assignables = runtimeTables
        .filter(table=> table.state !== 'disactive')
        .filter(table=>{
          if(!searchTerm) return true;
          const term = searchTerm.toLowerCase();
          return (table.name || '').toLowerCase().includes(term) || (table.id || '').toLowerCase().includes(term) || (table.zone || '').toLowerCase().includes(term);
        })
        .filter(table=>{
          if(filter === 'free') return table.state === 'active' && table.lockState === 'free';
          if(filter === 'single') return table.lockState === 'single';
          if(filter === 'multi') return table.lockState === 'multi';
          if(filter === 'maintenance') return table.state === 'maintenance';
          return true;
        });

      const assignView = D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [
        UI.SearchBar({
          value: tablesUI.search || '',
          placeholder: t.ui.tables_search_placeholder,
          onInput:'pos:tables:search'
        }),
        UI.ChipGroup({ items: filterItems, activeId: filter }),
        D.Containers.Div({ attrs:{ class: tw`flex flex-wrap gap-2 text-xs ${token('muted')}` }}, [
          D.Text.Span({}, [`${t.ui.tables_count_label}: ${assignables.length}`])
        ]),
        assignables.length
          ? D.Containers.Div({ attrs:{ class: tw`grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3` }}, assignables.map(createTableCard))
          : UI.EmptyState({ icon:'🪑', title:t.ui.table_no_sessions, description:t.ui.table_manage_hint }),
        createDetailsPanel()
      ].filter(Boolean));

      const manageRows = runtimeTables
        .slice()
        .sort((a,b)=> (a.displayOrder||0) - (b.displayOrder||0))
        .map(table=> UI.ListItem({
          leading: D.Text.Span({ attrs:{ class: tw`text-lg` }}, ['🪑']),
          content:[
            D.Text.Strong({}, [table.name || table.id]),
            D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [`${t.ui.tables_zone}: ${table.zone || '—'}`]),
            D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [`${t.ui.tables_capacity}: ${table.capacity}`]),
            D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [tableStateLabel(t, table)])
          ],
          trailing:[
            UI.Button({ attrs:{ gkey:'pos:tables:rename', 'data-table-id':table.id, 'data-prevent-select':'true' }, variant:'ghost', size:'sm' }, ['✏️']),
            UI.Button({ attrs:{ gkey:'pos:tables:capacity', 'data-table-id':table.id, 'data-prevent-select':'true' }, variant:'ghost', size:'sm' }, ['👥']),
            UI.Button({ attrs:{ gkey:'pos:tables:zone', 'data-table-id':table.id, 'data-prevent-select':'true' }, variant:'ghost', size:'sm' }, ['📍']),
            UI.Button({ attrs:{ gkey:'pos:tables:state', 'data-table-id':table.id, 'data-prevent-select':'true' }, variant:'ghost', size:'sm' }, ['♻️']),
            UI.Button({ attrs:{ gkey:'pos:tables:remove', 'data-table-id':table.id, 'data-prevent-select':'true' }, variant:'ghost', size:'sm' }, ['🗑️'])
          ],
          attrs:{ class: tw`cursor-default` }
        }));

      const auditEntries = (db.data.auditTrail || []).slice().sort((a,b)=> b.at - a.at).slice(0,6).map(entry=>
        UI.ListItem({
          leading: D.Text.Span({ attrs:{ class: tw`text-lg` }}, ['📝']),
          content:[
            D.Text.Strong({}, [`${entry.action} → ${entry.refId}`]),
            D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [formatDateTime(entry.at, db.env.lang, { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'short' })])
          ],
          trailing:[ D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [entry.userId]) ]
        })
      );

      const manageView = D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [
        UI.HStack({ attrs:{ class: tw`justify-between` }}, [
          UI.Button({ attrs:{ gkey:'pos:tables:add' }, variant:'solid', size:'sm' }, [`＋ ${t.ui.table_add}`]),
          D.Containers.Div({ attrs:{ class: tw`flex gap-2` }}, [
            UI.Button({ attrs:{ gkey:'pos:tables:bulk', 'data-bulk-action':'activate' }, variant:'ghost', size:'sm' }, [t.ui.tables_bulk_activate]),
            UI.Button({ attrs:{ gkey:'pos:tables:bulk', 'data-bulk-action':'maintenance' }, variant:'ghost', size:'sm' }, [t.ui.tables_bulk_maintenance])
          ])
        ]),
        UI.ScrollArea({ attrs:{ class: tw`max-h-[40vh] space-y-2` }, children: manageRows }),
        auditEntries.length ? UI.Card({ title:t.ui.tables_manage_log, content: UI.List({ children:auditEntries }) }) : null
      ].filter(Boolean));

      const viewSelector = UI.Segmented({
        items:[
          { id:'assign', label:t.ui.tables_assign, attrs:{ gkey:'pos:tables:view', 'data-tables-view':'assign' } },
          { id:'manage', label:t.ui.tables_manage, attrs:{ gkey:'pos:tables:view', 'data-tables-view':'manage' } }
        ],
        activeId:view
      });

      return UI.Modal({
        open:true,
        size: db.ui?.modalSizes?.tables || 'full',
        sizeKey:'tables',
        title:t.ui.tables,
        description: view === 'assign' ? t.ui.table_manage_hint : t.ui.tables_manage,
        content: D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [
          viewSelector,
          view === 'assign' ? assignView : manageView
        ]),
        actions:[
          UI.Button({ attrs:{ gkey:'ui:modal:close', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.close])
        ]
      });
    }

    function PrintModal(db){
      const t = getTexts(db);
      if(!db.ui.modals.print) return null;
      const order = db.data.order || {};
      const uiPrint = db.ui.print || {};
      const docType = uiPrint.docType || db.data.print?.docType || 'customer';
      const profiles = db.data.print?.profiles || {};
      const profile = profiles[docType] || {};
      const selectedSize = uiPrint.size || profile.size || db.data.print?.size || 'thermal_80';
      const showAdvanced = !!uiPrint.showAdvanced;
      const managePrinters = !!uiPrint.managePrinters;
      const previewExpanded = !!uiPrint.previewExpanded;
      const newPrinterName = uiPrint.newPrinterName || '';
      const tablesNames = (order.tableIds || []).map(id=>{
        const table = (db.data.tables || []).find(tbl=> tbl.id === id);
        return table?.name || id;
      });
      const lang = db.env.lang;
      const due = order.totals?.due || 0;
      const subtotal = order.totals?.subtotal || 0;
      const payments = db.data.payments.split || [];
      const totalPaid = payments.reduce((sum, entry)=> sum + (Number(entry.amount)||0), 0);
      const changeDue = Math.max(0, round(totalPaid - due));
      const totalsRows = [
        { label:t.ui.subtotal, value: subtotal },
        order.totals?.service ? { label:t.ui.service, value: order.totals.service } : null,
        { label:t.ui.vat, value: order.totals?.vat || 0 },
        order.totals?.deliveryFee ? { label:t.ui.delivery_fee, value: order.totals.deliveryFee } : null,
        order.totals?.discount ? { label:t.ui.discount, value: order.totals.discount } : null
      ].filter(Boolean);

      const docTypes = [
        { id:'customer', label:t.ui.print_doc_customer },
        { id:'summary', label:t.ui.print_doc_summary },
        { id:'kitchen', label:t.ui.print_doc_kitchen }
      ];

      const sizeOptions = [
        { id:'thermal_80', label:t.ui.thermal_80 },
        { id:'receipt_15', label:t.ui.receipt_15 },
        { id:'a5', label:t.ui.a5 },
        { id:'a4', label:t.ui.a4 }
      ];

      const sizePresets = {
        thermal_80:{ container:'max-w-[360px] px-5 py-6 text-[13px]', expandedContainer:'max-w-[460px] px-6 py-7 text-[13px]', heading:'text-xl', meta:'text-xs', body:'text-[13px]', total:'text-[15px]', frame:'border border-sky-200' },
        receipt_15:{ container:'max-w-[440px] px-6 py-6 text-[13px]', expandedContainer:'max-w-[600px] px-8 py-8 text-[14px]', heading:'text-2xl', meta:'text-sm', body:'text-[14px]', total:'text-[16px]', frame:'border border-dashed border-sky-200' },
        a5:{ container:'max-w-[640px] px-8 py-7 text-[15px]', expandedContainer:'max-w-[860px] px-10 py-9 text-[15px]', heading:'text-2xl', meta:'text-base', body:'text-[15px]', total:'text-[18px]', frame:'border border-neutral-200' },
        a4:{ container:'max-w-[760px] px-10 py-8 text-[16px]', expandedContainer:'max-w-[940px] px-12 py-10 text-[16px]', heading:'text-3xl', meta:'text-lg', body:'text-[16px]', total:'text-[20px]', frame:'border border-neutral-200' }
      };

      const previewPreset = sizePresets[selectedSize] || sizePresets.thermal_80;

      const previewLineClass = tw`${previewPreset.body} leading-6`;
      const previewLines = (order.lines || []).map(line=>{
        const modifiers = Array.isArray(line.modifiers) ? line.modifiers : [];
        const modifierRows = modifiers.map(mod=>{
          const delta = Number(mod.priceChange || 0) || 0;
          const priceLabel = delta ? `${delta > 0 ? '+' : '−'} ${formatCurrencyValue(db, Math.abs(delta))}` : t.ui.line_modifiers_free;
          return UI.HStack({ attrs:{ class: tw`justify-between ps-6 text-xs text-neutral-500` }}, [
            D.Text.Span({}, [localize(mod.label, lang)]),
            D.Text.Span({}, [priceLabel])
          ]);
        });
        const notes = Array.isArray(line.notes) ? line.notes.filter(Boolean).join(' • ') : (line.notes || '');
        const notesRow = notes
          ? D.Text.Span({ attrs:{ class: tw`block ps-6 text-[11px] text-neutral-400` }}, [`📝 ${notes}`])
          : null;
        return D.Containers.Div({ attrs:{ class: previewLineClass }}, [
          UI.HStack({ attrs:{ class: tw`justify-between` }}, [
            D.Text.Span({}, [`${localize(line.name, lang)} × ${line.qty}`]),
            UI.PriceText({ amount: line.total, currency:getCurrency(db), locale:getLocale(db) })
          ]),
          ...modifierRows,
          notesRow
        ].filter(Boolean));
      });

      const currentDocLabel = docTypes.find(dt=> dt.id === docType)?.label || t.ui.print_doc_customer;
      const paymentsList = payments.length
        ? D.Containers.Div({ attrs:{ class: tw`space-y-1 ${previewPreset.body} pt-2` }}, payments.map(pay=>{
            const method = (db.data.payments.methods || []).find(m=> m.id === pay.method);
            const label = method ? `${method.icon} ${localize(method.label, lang)}` : pay.method;
            return D.Containers.Div({ attrs:{ class: tw`flex items-center justify-between` }}, [
              D.Text.Span({}, [label]),
              UI.PriceText({ amount: pay.amount, currency:getCurrency(db), locale:getLocale(db) })
            ]);
          }))
        : null;

      const previewContainerBase = previewExpanded ? (previewPreset.expandedContainer || previewPreset.container) : previewPreset.container;
      const previewContainerClass = tw`mx-auto w-full ${previewContainerBase} ${previewPreset.frame || 'border border-neutral-200'} rounded-3xl bg-white text-neutral-900 shadow-[0_24px_60px_rgba(15,23,42,0.16)] dark:bg-white dark:text-neutral-900 ${previewExpanded ? 'max-w-none' : ''}`;
      const previewHeadingClass = tw`${previewPreset.heading} font-semibold tracking-wide`;
      const previewMetaClass = tw`${previewPreset.meta} text-neutral-500`;
      const previewDetailsClass = tw`space-y-1 ${previewPreset.body} leading-6`;
      const previewTotalsClass = tw`space-y-2 ${previewPreset.body}`;
      const previewTotalsRowClass = tw`flex items-center justify-between ${previewPreset.body}`;
      const previewTotalsTotalClass = tw`flex items-center justify-between ${previewPreset.total} font-semibold`;
      const previewFooterClass = tw`mt-6 space-y-1 text-center ${previewPreset.meta} text-neutral-500`;

      const previewReceipt = D.Containers.Div({ attrs:{ class: previewContainerClass, 'data-print-preview':'receipt' }}, [
        D.Containers.Div({ attrs:{ class: tw`space-y-1 text-center` }}, [
          D.Text.Strong({ attrs:{ class: previewHeadingClass }}, ['Mishkah Restaurant']),
          D.Text.Span({ attrs:{ class: previewMetaClass }}, [`${t.ui.print_header_address}: 12 Nile Street`]),
          D.Text.Span({ attrs:{ class: previewMetaClass }}, [`${t.ui.print_header_phone}: 0100000000`])
        ]),
        D.Containers.Div({ attrs:{ class: tw`mt-4 h-px bg-neutral-200` }}),
        D.Containers.Div({ attrs:{ class: previewDetailsClass }}, [
          D.Text.Span({}, [`${t.ui.order_id} ${order.id || '—'}`]),
          D.Text.Span({}, [`${t.ui.guests}: ${order.guests || 0}`]),
          tablesNames.length ? D.Text.Span({}, [`${t.ui.tables}: ${tablesNames.join(', ')}`]) : null,
          D.Text.Span({}, [formatDateTime(order.updatedAt || Date.now(), lang, { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })])
        ].filter(Boolean)),
        D.Containers.Div({ attrs:{ class: tw`mt-4 h-px bg-neutral-200` }}),
        previewLines.length
          ? D.Containers.Div({ attrs:{ class: tw`space-y-2` }}, previewLines)
          : D.Text.Span({ attrs:{ class: tw`block text-center ${previewPreset.body} text-neutral-400` }}, [t.ui.cart_empty]),
        D.Containers.Div({ attrs:{ class: tw`mt-4 h-px bg-neutral-200` }}),
        D.Containers.Div({ attrs:{ class: previewTotalsClass }}, [
          ...totalsRows.map(row=> D.Containers.Div({ attrs:{ class: previewTotalsRowClass }}, [
            D.Text.Span({}, [row.label]),
            UI.PriceText({ amount: row.value, currency:getCurrency(db), locale:getLocale(db) })
          ])),
          D.Containers.Div({ attrs:{ class: previewTotalsTotalClass }}, [
            D.Text.Span({}, [t.ui.total]),
            UI.PriceText({ amount: due, currency:getCurrency(db), locale:getLocale(db) })
          ]),
          payments.length ? D.Containers.Div({ attrs:{ class: previewTotalsRowClass }}, [
            D.Text.Span({}, [t.ui.paid]),
            UI.PriceText({ amount: totalPaid, currency:getCurrency(db), locale:getLocale(db) })
          ]) : null,
          payments.length ? D.Containers.Div({ attrs:{ class: previewTotalsRowClass }}, [
            D.Text.Span({}, [t.ui.print_change_due]),
            UI.PriceText({ amount: changeDue, currency:getCurrency(db), locale:getLocale(db) })
          ]) : null,
          paymentsList
        ].filter(Boolean)),
        D.Containers.Div({ attrs:{ class: previewFooterClass }}, [
          D.Text.Span({}, [t.ui.print_footer_thanks]),
          D.Text.Span({}, [t.ui.print_footer_policy]),
          D.Text.Span({}, [`${t.ui.print_footer_feedback} • QR`])
        ])
      ]);

      const availablePrinters = Array.isArray(db.data.print?.availablePrinters) ? db.data.print.availablePrinters : [];
      const printerOptions = [
        { value:'', label:t.ui.print_printer_placeholder },
        ...availablePrinters.map(item=> ({ value:item.id, label:item.label || item.id }))
      ];
      const printerSelectField = (fieldKey, labelText, helperText, currentValue)=>
        UI.Field({
          label: labelText,
          helper: helperText,
          control: UI.Select({
            attrs:{ value: currentValue || '', gkey:'pos:print:printer-select', 'data-print-field':fieldKey },
            options: printerOptions
          })
        });

      const printerField = printerSelectField('defaultPrinter', t.ui.print_printer_default, t.ui.print_printer_select, profile.defaultPrinter);

      const manageControls = managePrinters
        ? UI.Card({
            variant:'card/soft-2',
            title: t.ui.print_manage_title,
            description: t.ui.print_printers_manage_hint,
            content: D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, [
              UI.HStack({ attrs:{ class: tw`gap-2` }}, [
                UI.Input({ attrs:{ value: newPrinterName, placeholder: t.ui.print_manage_placeholder, gkey:'pos:print:manage-input' } }),
                UI.Button({ attrs:{ gkey:'pos:print:manage-add', class: tw`whitespace-nowrap` }, variant:'solid', size:'sm' }, [t.ui.print_manage_add])
              ]),
              availablePrinters.length
                ? UI.List({ children: availablePrinters.map(item=> UI.ListItem({
                    content: D.Text.Span({}, [item.label || item.id]),
                    trailing: UI.Button({ attrs:{ gkey:'pos:print:manage-remove', 'data-printer-id':item.id }, variant:'ghost', size:'sm' }, ['🗑️'])
                  })) })
                : UI.EmptyState({ icon:'🖨️', title:t.ui.print_manage_empty, description:'' })
            ])
          })
        : null;

      const advancedControls = showAdvanced
        ? D.Containers.Div({ attrs:{ class: tw`space-y-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-4` }}, [
            UI.Segmented({
              items: sizeOptions.map(opt=>({ id: opt.id, label: opt.label, attrs:{ gkey:'pos:print:size', 'data-print-size':opt.id } })),
              activeId: selectedSize
            }),
            printerSelectField('insidePrinter', t.ui.print_printer_inside, t.ui.print_printer_hint, profile.insidePrinter),
            printerSelectField('outsidePrinter', t.ui.print_printer_outside, t.ui.print_printer_hint, profile.outsidePrinter),
            UI.Field({
              label: t.ui.print_copies,
              control: UI.NumpadDecimal({
                value: profile.copies || 1,
                placeholder:'1',
                gkey:'pos:print:profile-field',
                inputAttrs:{ 'data-print-field':'copies' },
                allowDecimal:false,
                confirmLabel: t.ui.close,
                confirmAttrs:{ variant:'soft', size:'sm' }
              })
            }),
            UI.HStack({ attrs:{ class: tw`flex-wrap gap-2 text-xs` }}, [
              UI.Button({ attrs:{ gkey:'pos:print:toggle', 'data-print-toggle':'autoSend', class: tw`${profile.autoSend ? 'bg-[var(--primary)] text-[var(--foreground)] dark:text-[var(--primary-foreground)]' : ''}` }, variant:'ghost', size:'sm' }, [profile.autoSend ? '✅ ' : '⬜︎ ', t.ui.print_auto_send]),
              UI.Button({ attrs:{ gkey:'pos:print:toggle', 'data-print-toggle':'preview', class: tw`${profile.preview ? 'bg-[var(--primary)] text-[var(--foreground)] dark:text-[var(--primary-foreground)]' : ''}` }, variant:'ghost', size:'sm' }, [profile.preview ? '✅ ' : '⬜︎ ', t.ui.print_show_preview]),
              UI.Button({ attrs:{ gkey:'pos:print:toggle', 'data-print-toggle':'duplicateInside', class: tw`${profile.duplicateInside ? 'bg-[var(--primary)] text-[var(--foreground)] dark:text-[var(--primary-foreground)]' : ''}` }, variant:'ghost', size:'sm' }, [profile.duplicateInside ? '✅ ' : '⬜︎ ', t.ui.print_duplicate_inside]),
              UI.Button({ attrs:{ gkey:'pos:print:toggle', 'data-print-toggle':'duplicateOutside', class: tw`${profile.duplicateOutside ? 'bg-[var(--primary)] text-[var(--foreground)] dark:text-[var(--primary-foreground)]' : ''}` }, variant:'ghost', size:'sm' }, [profile.duplicateOutside ? '✅ ' : '⬜︎ ', t.ui.print_duplicate_outside])
            ]),
            D.Containers.Div({ attrs:{ class: tw`flex items-start gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-1)] px-4 py-3 text-xs` }}, [
              D.Text.Span({ attrs:{ class: tw`text-lg` }}, ['ℹ️']),
              D.Text.Span({ attrs:{ class: tw`leading-relaxed` }}, [t.ui.print_printers_info])
            ])
          ])
        : null;

      const previewCardAttrs = previewExpanded ? { class: tw`w-full` } : {};
      const preview = UI.Card({
        variant:'card/soft-2',
        attrs: previewCardAttrs,
        title: `${t.ui.print_preview} — ${currentDocLabel}`,
        content: previewReceipt
      });

      const toggleRow = UI.HStack({ attrs:{ class: tw`flex-wrap gap-2` }}, [
        UI.Button({ attrs:{ gkey:'pos:print:advanced-toggle', class: tw`${showAdvanced ? 'bg-[var(--primary)] text-[var(--foreground)] dark:text-[var(--primary-foreground)]' : ''}` }, variant:'ghost', size:'sm' }, [showAdvanced ? `⬆️ ${t.ui.print_hide_advanced}` : `⚙️ ${t.ui.print_show_advanced}`]),
        UI.Button({ attrs:{ gkey:'pos:print:manage-toggle', class: tw`${managePrinters ? 'bg-[var(--primary)] text-[var(--foreground)] dark:text-[var(--primary-foreground)]' : ''}` }, variant:'ghost', size:'sm' }, [managePrinters ? `⬆️ ${t.ui.print_manage_hide}` : `🖨️ ${t.ui.print_manage_printers}`]),
        UI.Button({ attrs:{ gkey:'pos:print:preview-expand', class: tw`${previewExpanded ? 'bg-[var(--primary)] text-[var(--foreground)] dark:text-[var(--primary-foreground)]' : ''}` }, variant:'ghost', size:'sm' }, [previewExpanded ? `🗕 ${t.ui.print_preview_collapse}` : `🗗 ${t.ui.print_preview_expand}`])
      ]);

      const modalContent = D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [
        UI.Segmented({
          items: docTypes.map(dt=>({ id: dt.id, label: dt.label, attrs:{ gkey:'pos:print:doc', 'data-doc-type':dt.id } })),
          activeId: docType
        }),
        printerField,
        toggleRow,
        manageControls,
        advancedControls,
        preview
      ].filter(Boolean));

      return UI.Modal({
        open:true,
        size: db.ui?.modalSizes?.print || 'xl',
        sizeKey:'print',
        title: t.ui.print,
        description: t.ui.print_profile,
        content: modalContent,
        actions:[
          UI.Button({ attrs:{ gkey:'pos:print:send', class: tw`w-full` }, variant:'solid', size:'sm' }, [t.ui.print_send]),
          UI.Button({ attrs:{ gkey:'pos:print:browser', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.print_browser_preview]),
          UI.Button({ attrs:{ gkey:'pos:order:export', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.export_pdf]),
          UI.Button({ attrs:{ gkey:'pos:print:save', class: tw`w-full` }, variant:'soft', size:'sm' }, [t.ui.print_save_profile]),
          UI.Button({ attrs:{ gkey:'ui:modal:close', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.close])
        ]
      });
    }

    function ReservationsModal(db){
      const t = getTexts(db);
      if(!db.ui.modals.reservations) return null;
      const reservations = db.data.reservations || [];
      const tables = db.data.tables || [];
      const uiState = db.ui.reservations || {};
      const statusFilter = uiState.status || 'all';
      const rangeFilter = uiState.filter || 'today';
      const formState = uiState.form || null;
      const lang = db.env.lang;
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const endOfToday = startOfToday + 24 * 60 * 60 * 1000;

      function inRange(res){
        if(rangeFilter === 'today') return res.scheduledAt >= startOfToday && res.scheduledAt < endOfToday;
        if(rangeFilter === 'upcoming') return res.scheduledAt >= endOfToday;
        if(rangeFilter === 'past') return res.scheduledAt < startOfToday;
        return true;
      }

      const filtered = reservations
        .filter(res=> statusFilter === 'all' ? true : res.status === statusFilter)
        .filter(inRange)
        .sort((a,b)=> a.scheduledAt - b.scheduledAt);

      const rangeItems = [
        { id:'today', label:t.ui.reservations_manage },
        { id:'upcoming', label:'⏭️' },
        { id:'all', label:t.ui.reservations_filter_all }
      ].map(item=>({ ...item, attrs:{ gkey:'pos:reservations:range', 'data-reservation-range':item.id } }));

      const statusItems = [
        { id:'all', label:t.ui.reservations_filter_all },
        { id:'booked', label:t.ui.reservations_filter_booked },
        { id:'seated', label:t.ui.reservations_filter_seated },
        { id:'completed', label:t.ui.reservations_filter_completed },
        { id:'cancelled', label:t.ui.reservations_filter_cancelled },
        { id:'no-show', label:t.ui.reservations_filter_noshow }
      ].map(item=>({ ...item, attrs:{ gkey:'pos:reservations:status', 'data-reservation-status':item.id } }));

      const formTables = tables.filter(tbl=> tbl.state === 'active');
      const selectedTables = new Set(Array.isArray(formState?.tableIds) ? formState.tableIds : []);

      const formCard = formState ? UI.Card({
        title: formState.id ? t.ui.reservations_edit : t.ui.reservations_new,
        content: D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, [
          UI.Field({ label:t.ui.reservations_customer, control: UI.Input({ attrs:{ value: formState.customerName || '', gkey:'pos:reservations:form', 'data-field':'customerName', placeholder:t.ui.reservations_customer } }) }),
          UI.Field({ label:t.ui.reservations_phone, control: UI.Input({ attrs:{ value: formState.phone || '', gkey:'pos:reservations:form', 'data-field':'phone', placeholder:'010...' } }) }),
          UI.Field({
            label:t.ui.reservations_party_size,
            control: UI.NumpadDecimal({
              value: formState.partySize || 2,
              placeholder:'0',
              gkey:'pos:reservations:form',
              inputAttrs:{ 'data-field':'partySize' },
              allowDecimal:false,
              confirmLabel: t.ui.close,
              confirmAttrs:{ variant:'soft', size:'sm' }
            })
          }),
          UI.Field({ label:t.ui.reservations_time, control: UI.Input({ attrs:{ type:'datetime-local', value: toInputDateTime(formState.scheduledAt), gkey:'pos:reservations:form', 'data-field':'scheduledAt' } }) }),
          UI.Field({ label:t.ui.reservations_hold_until, control: UI.Input({ attrs:{ type:'datetime-local', value: toInputDateTime(formState.holdUntil), gkey:'pos:reservations:form', 'data-field':'holdUntil' } }) }),
          D.Containers.Div({ attrs:{ class: tw`space-y-2` }}, [
            D.Text.Span({ attrs:{ class: tw`text-sm font-medium` }}, [t.ui.reservations_tables]),
            D.Containers.Div({ attrs:{ class: tw`flex flex-wrap gap-2` }}, formTables.map(tbl=> UI.Button({
              attrs:{
                gkey:'pos:reservations:form:table',
                'data-table-id':tbl.id,
                class: tw`rounded-full px-3 py-1 text-sm ${selectedTables.has(tbl.id) ? 'bg-[var(--primary)] text-[var(--foreground)] dark:text-[var(--primary-foreground)]' : 'bg-[var(--surface-2)]'}`
              },
              variant:'ghost',
              size:'sm'
            }, [`🪑 ${tbl.name}`])) )
          ]),
          UI.Field({ label:t.ui.reservations_note, control: UI.Textarea({ attrs:{ value: formState.note || '', rows:'2', gkey:'pos:reservations:form', 'data-field':'note' } }) })
        ]),
        footer: UI.HStack({ attrs:{ class: tw`gap-2` }}, [
          UI.Button({ attrs:{ gkey:'pos:reservations:save', class: tw`flex-1` }, variant:'solid', size:'sm' }, [t.ui.reservations_save]),
          UI.Button({ attrs:{ gkey:'pos:reservations:cancel-edit', class: tw`flex-1` }, variant:'ghost', size:'sm' }, [t.ui.close])
        ])
      }) : null;

      const listCards = filtered.length ? filtered.map(res=>{
        const tableBadges = res.tableIds.map(id=>{
          const table = tables.find(tbl=> tbl.id === id);
          return UI.Badge({ text: table?.name || id, variant:'badge/ghost' });
        });
        return UI.Card({
          title: `${res.customerName} — ${res.partySize} ${t.ui.guests}`,
          description: `${formatDateTime(res.scheduledAt, lang, { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'short' })} • ${res.phone || ''}`,
          content: D.Containers.Div({ attrs:{ class: tw`space-y-2 text-sm` }}, [
            tableBadges.length ? D.Containers.Div({ attrs:{ class: tw`flex flex-wrap gap-1` }}, tableBadges) : null,
            D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [`${t.ui.reservations_hold_label}: ${res.holdUntil ? formatDateTime(res.holdUntil, lang, { hour:'2-digit', minute:'2-digit' }) : '—'}`])
          ].filter(Boolean)),
          footer: UI.HStack({ attrs:{ class: tw`flex-wrap gap-2` }}, [
            UI.Badge({ text: t.ui[`reservations_status_${res.status}`] || res.status, variant:'badge/ghost' }),
            UI.Button({ attrs:{ gkey:'pos:reservations:edit', 'data-reservation-id':res.id }, variant:'ghost', size:'sm' }, ['✏️']),
            UI.Button({ attrs:{ gkey:'pos:reservations:convert', 'data-reservation-id':res.id }, variant:'ghost', size:'sm' }, [t.ui.reservations_convert]),
            UI.Button({ attrs:{ gkey:'pos:reservations:noshow', 'data-reservation-id':res.id }, variant:'ghost', size:'sm' }, [t.ui.reservations_no_show]),
            UI.Button({ attrs:{ gkey:'pos:reservations:cancel', 'data-reservation-id':res.id }, variant:'ghost', size:'sm' }, [t.ui.reservations_cancel_action])
          ])
        });
      }) : [UI.EmptyState({ icon:'📅', title:t.ui.reservations, description:t.ui.reservations_list_empty })];

      return UI.Modal({
        open:true,
        size: db.ui?.modalSizes?.reservations || 'full',
        sizeKey:'reservations',
        title:t.ui.reservations,
        description:t.ui.reservations_manage,
        content: D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [
          UI.HStack({ attrs:{ class: tw`justify-between` }}, [
            UI.Segmented({ items: rangeItems, activeId: rangeFilter }),
            UI.Button({ attrs:{ gkey:'pos:reservations:new' }, variant:'solid', size:'sm' }, [`＋ ${t.ui.reservations_new}`])
          ]),
          UI.ChipGroup({ items: statusItems, activeId: statusFilter }),
          formCard,
          D.Containers.Div({ attrs:{ class: tw`space-y-3 max-h-[60vh] overflow-auto pr-1` }}, listCards)
        ].filter(Boolean)),
        actions:[
          UI.Button({ attrs:{ gkey:'ui:modal:close', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.close])
        ]
      });
    }

    function OrdersQueueModal(db){
      const t = getTexts(db);
      if(!db.ui.modals.orders) return null;
      const tablesIndex = new Map((db.data.tables || []).map(tbl=> [tbl.id, tbl]));
      const ordersState = db.ui.orders || { tab:'all', search:'', sort:{ field:'updatedAt', direction:'desc' } };
      const activeTab = ordersState.tab || 'all';
      const searchTerm = (ordersState.search || '').trim().toLowerCase();
      const sortState = ordersState.sort || { field:'updatedAt', direction:'desc' };
      const mergedOrders = [];
      const seen = new Set();
      [db.data.order, ...(db.data.ordersQueue || [])].forEach(order=>{
        if(!order || !order.id || seen.has(order.id)) return;
        seen.add(order.id);
        mergedOrders.push(order);
      });

      const matchesTab = (order)=>{
        if(activeTab === 'all') return true;
        const typeId = order.type || order.orderType || 'dine_in';
        return typeId === activeTab;
      };

      const matchesSearch = (order)=>{
        if(!searchTerm) return true;
        const typeLabel = localize(getOrderTypeConfig(order.type || 'dine_in').label, db.env.lang);
        const stageLabel = localize(orderStageMap.get(order.fulfillmentStage)?.name || { ar: order.fulfillmentStage, en: order.fulfillmentStage }, db.env.lang);
        const statusLabel = localize(orderStatusMap.get(order.status)?.name || { ar: order.status, en: order.status }, db.env.lang);
        const tableNames = (order.tableIds || []).map(id=> tablesIndex.get(id)?.name || id).join(' ');
        const paymentLabel = localize(orderPaymentMap.get(order.paymentState)?.name || { ar: order.paymentState || '', en: order.paymentState || '' }, db.env.lang);
        const haystack = [order.id, typeLabel, stageLabel, statusLabel, paymentLabel, tableNames].join(' ').toLowerCase();
        return haystack.includes(searchTerm);
      };

      const filtered = mergedOrders.filter(order=> matchesTab(order) && matchesSearch(order));

      const getSortValue = (order, field)=>{
        switch(field){
          case 'order': return order.id;
          case 'type': return order.type || 'dine_in';
          case 'stage': return order.fulfillmentStage || 'new';
          case 'status': return order.status || 'open';
          case 'payment': return order.paymentState || 'unpaid';
          case 'tables': return (order.tableIds || []).join(',');
          case 'guests': return order.guests || 0;
          case 'lines': return order.lines ? order.lines.length : 0;
          case 'notes': return order.notes ? order.notes.length : 0;
          case 'total': {
            const totals = order.totals && typeof order.totals === 'object' ? order.totals : calculateTotals(order.lines || [], settings, order.type || 'dine_in');
            return Number(totals?.due || 0);
          }
          case 'updatedAt':
          default:
            return order.updatedAt || order.createdAt || 0;
        }
      };

      const sorted = filtered.slice().sort((a,b)=>{
        const field = sortState.field || 'updatedAt';
        const direction = sortState.direction === 'asc' ? 1 : -1;
        const av = getSortValue(a, field);
        const bv = getSortValue(b, field);
        if(av == null && bv == null) return 0;
        if(av == null) return -1 * direction;
        if(bv == null) return 1 * direction;
        if(typeof av === 'number' && typeof bv === 'number'){
          if(av === bv) return 0;
          return av > bv ? direction : -direction;
        }
        const as = String(av).toLowerCase();
        const bs = String(bv).toLowerCase();
        if(as === bs) return 0;
        return as > bs ? direction : -direction;
      });

      const columns = [
        { id:'order', label:t.ui.order_id, sortable:true },
        { id:'type', label:t.ui.orders_type, sortable:true },
        { id:'stage', label:t.ui.orders_stage, sortable:true },
        { id:'status', label:t.ui.orders_status, sortable:true },
        { id:'payment', label:t.ui.orders_payment, sortable:true },
        { id:'tables', label:t.ui.tables, sortable:false },
        { id:'guests', label:t.ui.guests, sortable:true },
        { id:'lines', label:t.ui.orders_line_count, sortable:true },
        { id:'notes', label:t.ui.orders_notes, sortable:true },
        { id:'total', label:t.ui.orders_total, sortable:true },
        { id:'paid', label:t.ui.paid, sortable:false },
        { id:'remaining', label:t.ui.balance_due, sortable:false },
        { id:'updatedAt', label:t.ui.orders_updated, sortable:true },
        { id:'actions', label:'', sortable:false }
      ];

      const headerRow = D.Tables.Tr({}, columns.map(col=>{
        if(!col.sortable){
          return D.Tables.Th({ attrs:{ class: tw`px-3 py-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]` }}, [col.label]);
        }
        const isActive = (sortState.field || 'updatedAt') === col.id;
        const icon = isActive ? (sortState.direction === 'asc' ? '↑' : '↓') : '↕';
        return D.Tables.Th({ attrs:{ class: tw`px-3 py-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]` }}, [
          UI.Button({ attrs:{ gkey:'pos:orders:sort', 'data-sort-field':col.id, class: tw`flex items-center gap-1 text-xs` }, variant:'ghost', size:'sm' }, [col.label, D.Text.Span({ attrs:{ class: tw`text-[var(--muted-foreground)]` }}, [icon])])
        ]);
      }));

      const rows = sorted.map(order=>{
        const typeConfig = getOrderTypeConfig(order.type || 'dine_in');
        const stageMeta = orderStageMap.get(order.fulfillmentStage) || null;
        const statusMeta = orderStatusMap.get(order.status) || null;
        const paymentMeta = orderPaymentMap.get(order.paymentState) || null;
        const totals = order.totals && typeof order.totals === 'object' ? order.totals : calculateTotals(order.lines || [], settings, order.type || 'dine_in');
        const totalDue = Number(totals?.due || 0);
        const paidAmount = round((Array.isArray(order.payments) ? order.payments : []).reduce((sum, entry)=> sum + (Number(entry.amount) || 0), 0));
        const remainingAmount = Math.max(0, round(totalDue - paidAmount));
        const tableNames = (order.tableIds || []).map(id=> tablesIndex.get(id)?.name || id).join(', ');
        const updatedStamp = order.updatedAt || order.createdAt;
        return D.Tables.Tr({ attrs:{ key:order.id, class: tw`bg-[var(--surface-1)]` }}, [
          D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-sm font-semibold` }}, [order.id]),
          D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-sm` }}, [localize(typeConfig.label, db.env.lang)]),
          D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-sm` }}, [UI.Badge({ text: localize(stageMeta?.name || { ar: order.fulfillmentStage, en: order.fulfillmentStage }, db.env.lang), variant:'badge/ghost' })]),
          D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-sm` }}, [UI.Badge({ text: localize(statusMeta?.name || { ar: order.status, en: order.status }, db.env.lang), variant:'badge/ghost' })]),
          D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-sm` }}, [localize(paymentMeta?.name || { ar: order.paymentState || '', en: order.paymentState || '' }, db.env.lang)]),
          D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-sm` }}, [tableNames || '—']),
          D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-sm text-center` }}, [String(order.guests || 0)]),
          D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-sm text-center` }}, [String(order.lines ? order.lines.length : 0)]),
          D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-sm text-center` }}, [String(order.notes ? order.notes.length : 0)]),
          D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-sm` }}, [UI.PriceText({ amount: totalDue, currency:getCurrency(db), locale:getLocale(db) })]),
          D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-sm` }}, [UI.PriceText({ amount: paidAmount, currency:getCurrency(db), locale:getLocale(db) })]),
          D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-sm` }}, [UI.PriceText({ amount: remainingAmount, currency:getCurrency(db), locale:getLocale(db) })]),
          D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-xs ${token('muted')}` }}, [formatDateTime(updatedStamp, db.env.lang, { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) || '—']),
          D.Tables.Td({ attrs:{ class: tw`px-3 py-2 text-right` }}, [UI.Button({ attrs:{ gkey:'pos:orders:open-order', 'data-order-id':order.id }, variant:'ghost', size:'sm' }, [t.ui.orders_queue_open])])
        ]);
      });

      const table = sorted.length
        ? D.Tables.Table({ attrs:{ class: tw`w-full border-separate [border-spacing:0_8px] text-sm` }}, [
            D.Tables.Thead({}, [headerRow]),
            D.Tables.Tbody({}, rows)
          ])
        : UI.EmptyState({ icon:'🧾', title:t.ui.orders_no_results, description:t.ui.orders_queue_hint });

      const tabItems = [
        { id:'all', label:t.ui.orders_tab_all },
        { id:'dine_in', label:t.ui.orders_tab_dine_in },
        { id:'delivery', label:t.ui.orders_tab_delivery },
        { id:'takeaway', label:t.ui.orders_tab_takeaway }
      ];

      return UI.Modal({
        open:true,
        size: db.ui?.modalSizes?.orders || 'full',
        sizeKey:'orders',
        title:t.ui.orders_queue,
        description:t.ui.orders_queue_hint,
        content: D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [
          UI.Tabs({ items: tabItems, activeId: activeTab, gkey:'pos:orders:tab' }),
          D.Containers.Div({ attrs:{ class: tw`flex flex-col gap-2 md:flex-row md:items-center md:justify-between` }}, [
            UI.Input({ attrs:{ type:'search', value: ordersState.search || '', placeholder:t.ui.orders_search_placeholder, gkey:'pos:orders:search' } }),
            UI.Button({ attrs:{ gkey:'pos:orders:refresh' }, variant:'ghost', size:'sm' }, ['🔄 ', t.ui.orders_refresh])
          ]),
          table
        ].filter(Boolean)),
        actions:[
          UI.Button({ attrs:{ gkey:'ui:modal:close', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.close])
        ]
      });
    }

    function activateOrder(ctx, order, options={}){
      if(!order) return;
      const typeConfig = getOrderTypeConfig(order.type || 'dine_in');
      const safeOrder = {
        ...order,
        lines: Array.isArray(order.lines) ? order.lines.map(line=> ({ ...line })) : [],
        notes: Array.isArray(order.notes) ? order.notes.map(note=> ({ ...note })) : [],
        payments: Array.isArray(order.payments) ? order.payments.map(pay=> ({ ...pay })) : []
      };
      ctx.setState(s=>{
        const data = s.data || {};
        const modals = { ...(s.ui?.modals || {}) };
        if(options.closeOrdersModal) modals.orders = false;
        const orderNavState = { ...(s.ui?.orderNav || {}) };
        if(options.hideOrderNavPad !== false) orderNavState.showPad = false;
        if(options.resetOrderNavValue) orderNavState.value = '';
        const paymentsSplit = safeOrder.payments || [];
        const nextPayments = {
          ...(data.payments || {}),
          split: paymentsSplit
        };
        if(!Array.isArray(nextPayments.methods) || !nextPayments.methods.length){
          nextPayments.methods = PAYMENT_METHODS;
        }
        const totals = safeOrder.totals && typeof safeOrder.totals === 'object'
          ? { ...safeOrder.totals }
          : calculateTotals(safeOrder.lines || [], data.settings || {}, safeOrder.type || 'dine_in');
        return {
          ...s,
          data:{
            ...data,
            order:{
              ...(data.order || {}),
              ...safeOrder,
              totals,
              allowAdditions: safeOrder.allowAdditions !== undefined ? safeOrder.allowAdditions : !!typeConfig.allowsLineAdditions,
              lockLineEdits: safeOrder.lockLineEdits !== undefined ? safeOrder.lockLineEdits : true,
              isPersisted: safeOrder.isPersisted !== undefined ? safeOrder.isPersisted : true
            },
            payments: nextPayments
          },
          ui:{
            ...(s.ui || {}),
            modals,
            shift:{ ...(s.ui?.shift || {}), showPin:false },
            orderNav: orderNavState
          }
        };
      });
    }

    function PaymentsSheet(db){
      const t = getTexts(db);
      if(!db.ui.modals.payments) return null;
      const methods = (db.data.payments?.methods && db.data.payments.methods.length)
        ? db.data.payments.methods
        : PAYMENT_METHODS;
      return UI.Drawer({
        open:true,
        side:'end',
        closeGkey:'pos:payments:close',
        panelAttrs:{ class: tw`w-[min(420px,92vw)] sm:w-[420px]` },
        header: D.Containers.Div({ attrs:{ class: tw`flex items-center justify-between gap-2` }}, [
          D.Containers.Div({ attrs:{ class: tw`space-y-1` }}, [
            D.Text.Strong({}, [t.ui.payments]),
            D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [t.ui.split_payments])
          ]),
          UI.Button({ attrs:{ gkey:'pos:payments:close' }, variant:'ghost', size:'md' }, [D.Text.Span({ attrs:{ class: tw`text-lg` }}, ['✕'])])
        ]),
        content: D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, [
          UI.ChipGroup({
            attrs:{ class: tw`text-base sm:text-lg` },
            items: methods.map(method=>({
              id: method.id,
              label: `${method.icon} ${localize(method.label, db.env.lang)}`,
              attrs:{ gkey:'pos:payments:method', 'data-method-id':method.id }
            })),
            activeId: db.data.payments.activeMethod
          }),
          UI.NumpadDecimal({
            attrs:{ class: tw`w-full` },
            value: db.ui.paymentDraft?.amount || '',
            placeholder: t.ui.amount,
            gkey:'pos:payments:amount',
            confirmLabel: t.ui.capture_payment,
            confirmAttrs:{ gkey:'pos:payments:capture', variant:'solid', size:'md', class: tw`w-full` }
          }),
          UI.Button({ attrs:{ gkey:'pos:payments:close', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.close])
        ])
      });
    }

    function LineModifiersModal(db){
      const t = getTexts(db);
      if(!db.ui.modals.modifiers) return null;
      const order = db.data.order || {};
      const state = db.ui.lineModifiers || {};
      const lineId = state.lineId;
      const line = (order.lines || []).find(entry=> entry.id === lineId);
      const lang = db.env.lang;
      const catalog = db.data.modifiers || { addOns:[], removals:[] };
      const selectedAddOns = new Set((state.addOns || []).map(String));
      const selectedRemovals = new Set((state.removals || []).map(String));
      const mapModifier = (entry)=> entry ? { id:String(entry.id), type: entry.type, label: entry.label, priceChange: Number(entry.priceChange ?? entry.price_change ?? 0) } : null;
      const selectedModifiers = [
        ...catalog.addOns.filter(entry=> selectedAddOns.has(String(entry.id))).map(mapModifier),
        ...catalog.removals.filter(entry=> selectedRemovals.has(String(entry.id))).map(mapModifier)
      ].filter(Boolean);
      const previewLine = line ? applyLinePricing({ ...line, modifiers: selectedModifiers }) : null;

      const buildModifierButtons = (items, type, selected)=>{
        if(!items.length){
          return UI.EmptyState({ icon:'ℹ️', title:t.ui.line_modifiers_empty });
        }
        return D.Containers.Div({ attrs:{ class: tw`grid grid-cols-1 gap-2 sm:grid-cols-2` }}, items.map(item=>{
          const active = selected.has(String(item.id));
          const delta = Number(item.priceChange ?? item.price_change ?? 0) || 0;
          const price = delta ? `${delta > 0 ? '+' : '−'} ${formatCurrencyValue(db, Math.abs(delta))}` : t.ui.line_modifiers_free;
          return UI.Button({
            attrs:{
              gkey:'pos:order:line:modifiers.toggle',
              'data-line-id': lineId,
              'data-mod-type':type,
              'data-mod-id':item.id,
              class: tw`justify-between`
            },
            variant: active ? 'solid' : 'ghost',
            size:'sm'
          }, [
            D.Text.Span({ attrs:{ class: tw`text-sm font-semibold` }}, [localize(item.label, lang)]),
            D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [price])
          ]);
        }));
      };

      const addOnsSection = buildModifierButtons(catalog.addOns || [], 'add_on', selectedAddOns);
      const removalsSection = buildModifierButtons(catalog.removals || [], 'removal', selectedRemovals);
      const summaryRows = line && previewLine
        ? D.Containers.Div({ attrs:{ class: tw`space-y-2 rounded-[var(--radius)] bg-[color-mix(in oklab,var(--surface-2) 90%, transparent)] px-3 py-2 text-sm` }}, [
            UI.HStack({ attrs:{ class: tw`justify-between` }}, [
              D.Text.Span({}, [t.ui.line_modifiers_unit]),
              UI.PriceText({ amount: previewLine.price, currency:getCurrency(db), locale:getLocale(db) })
            ]),
            UI.HStack({ attrs:{ class: tw`justify-between` }}, [
              D.Text.Span({}, [t.ui.total]),
              UI.PriceText({ amount: previewLine.total, currency:getCurrency(db), locale:getLocale(db) })
            ])
          ])
        : null;

      const description = line
        ? `${localize(line.name, lang)} × ${line.qty}`
        : t.ui.line_modifiers_missing;

      return UI.Modal({
        open:true,
        title: t.ui.line_modifiers_title,
        description,
        closeGkey:'pos:order:line:modifiers.close',
        content: D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [
          D.Containers.Div({ attrs:{ class: tw`space-y-2` }}, [
            D.Text.Strong({}, [t.ui.line_modifiers_addons]),
            addOnsSection
          ]),
          D.Containers.Div({ attrs:{ class: tw`space-y-2` }}, [
            D.Text.Strong({}, [t.ui.line_modifiers_removals]),
            removalsSection
          ]),
          summaryRows
        ].filter(Boolean)),
        actions:[
          UI.Button({ attrs:{ gkey:'pos:order:line:modifiers.close', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.close]),
          line ? UI.Button({ attrs:{ gkey:'pos:order:line:modifiers.apply', 'data-line-id':lineId, class: tw`w-full` }, variant:'solid', size:'sm' }, [t.ui.line_modifiers_apply]) : null
        ].filter(Boolean)
      });
    }

    function ReportsDrawer(db){
      const t = getTexts(db);
      if(!db.ui.modals.reports) return null;
      const reports = computeRealtimeReports(db);
      const topItem = reports.topItemId ? (db.data.menu.items || []).find(it=> String(it.id) === String(reports.topItemId)) : null;
      return UI.Drawer({
        open:true,
        side:'start',
        header: D.Containers.Div({ attrs:{ class: tw`flex items-center justify-between` }}, [
          D.Text.Strong({}, [t.ui.reports]),
          UI.Button({ attrs:{ gkey:'pos:reports:toggle' }, variant:'ghost', size:'sm' }, ['×'])
        ]),
        content: D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, [
          UI.StatCard({ title: t.ui.sales_today, value: `${new Intl.NumberFormat(getLocale(db)).format(reports.salesToday)} ${getCurrencySymbol(db)}` }),
          UI.StatCard({ title: t.ui.orders_count, value: String(reports.ordersCount) }),
          UI.StatCard({ title: t.ui.avg_ticket, value: `${new Intl.NumberFormat(getLocale(db)).format(reports.avgTicket)} ${getCurrencySymbol(db)}` }),
          topItem ? UI.StatCard({ title: t.ui.top_selling, value: localize(topItem.name, db.env.lang) }) : null
        ].filter(Boolean))
      });
    }

    function CustomersModal(db){
      const t = getTexts(db);
      const customerUI = db.ui.customer || {};
      if(!customerUI.open) return null;
      const mode = customerUI.mode || 'search';
      const searchValue = customerUI.search || '';
      const keypadValue = customerUI.keypad || '';
      const customers = Array.isArray(db.data.customers) ? db.data.customers : [];
      const normalizedSearch = searchValue.trim().toLowerCase();
      const filteredCustomers = normalizedSearch
        ? customers.filter(customer=>{
            const nameMatch = (customer.name || '').toLowerCase().includes(normalizedSearch);
            const phoneMatch = (customer.phones || []).some(phone=> String(phone).includes(normalizedSearch));
            return nameMatch || phoneMatch;
          })
        : customers;
      let selectedCustomerId = customerUI.selectedCustomerId || db.data.order.customerId || null;
      if(mode === 'search' && selectedCustomerId && !filteredCustomers.some(customer=> customer.id === selectedCustomerId)){
        selectedCustomerId = null;
      }
      const selectedCustomer = selectedCustomerId ? findCustomer(customers, selectedCustomerId) : null;
      let selectedAddressId = customerUI.selectedAddressId || db.data.order.customerAddressId || null;
      if(mode === 'search' && selectedCustomer){
        if(!selectedAddressId || !(selectedCustomer.addresses || []).some(address=> address.id === selectedAddressId)){
          selectedAddressId = selectedCustomer.addresses?.[0]?.id || selectedAddressId;
        }
      } else if(!selectedCustomer){
        selectedAddressId = null;
      }
      const selectedAddress = selectedCustomer ? findCustomerAddress(selectedCustomer, selectedAddressId) : null;
      const areaOptions = (db.data.customerAreas || CAIRO_DISTRICTS).map(area=> ({ value: area.id, label: db.env.lang === 'ar' ? area.ar : area.en }));
      const tabs = UI.Segmented({
        items:[
          { id:'search', label:`🔎 ${t.ui.customer_tab_search}`, attrs:{ gkey:'pos:customer:mode', 'data-mode':'search' } },
          { id:'create', label:`➕ ${t.ui.customer_tab_create}`, attrs:{ gkey:'pos:customer:mode', 'data-mode':'create' } }
        ],
        activeId: mode
      });
      const customerList = filteredCustomers.length
        ? UI.List({ children: filteredCustomers.map(customer=> UI.ListItem({
              leading:'👤',
              content:[
                D.Text.Strong({ attrs:{ class: tw`text-sm` }}, [customer.name]),
                D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [customer.phones.join(' • ')])
              ],
              trailing: customer.addresses?.length ? UI.Badge({ text:String(customer.addresses.length), variant:'badge/ghost' }) : null,
              attrs:{
                gkey:'pos:customer:select',
                'data-customer-id': customer.id,
                class: tw`${customer.id === selectedCustomerId ? 'border-[var(--primary)] bg-[color-mix(in oklab,var(--primary) 10%, var(--surface-1))]' : ''}`
              }
            })) })
        : UI.EmptyState({ icon:'🕵️‍♀️', title:t.ui.customer_no_results, description:t.ui.customer_search_placeholder });
      const addressList = selectedCustomer && selectedCustomer.addresses?.length
        ? UI.List({ children: selectedCustomer.addresses.map(address=> UI.ListItem({
            leading:'📍',
            content:[
              D.Text.Strong({ attrs:{ class: tw`text-sm` }}, [address.title || t.ui.customer_address_title]),
              D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [
                `${getDistrictLabel(address.areaId, db.env.lang)}${address.line ? ' • ' + address.line : ''}`
              ])
            ],
            trailing: UI.Button({ attrs:{ gkey:'pos:customer:address:select', 'data-address-id':address.id, class: tw`h-8 rounded-full px-3 text-xs` }, variant:'soft', size:'sm' }, [address.id === selectedAddressId ? '✅' : t.ui.customer_select_address]),
            attrs:{
              class: tw`${address.id === selectedAddressId ? 'border-[var(--primary)] bg-[color-mix(in oklab,var(--primary) 12%, var(--surface-1))]' : ''}`
            }
          })) })
        : UI.EmptyState({ icon:'📭', title:t.ui.customer_addresses, description:t.ui.customer_multi_address_hint });
      const selectedDetails = selectedCustomer
        ? UI.Card({
            variant:'card/soft-1',
            title:selectedCustomer.name,
            content: D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, [
              D.Text.Span({ attrs:{ class: tw`text-sm` }}, [`${t.ui.customer_phones}: ${selectedCustomer.phones.join(' • ')}`]),
              addressList,
              D.Containers.Div({ attrs:{ class: tw`flex flex-wrap gap-2` }}, [
                UI.Button({ attrs:{ gkey:'pos:customer:attach', class: tw`flex-1` }, variant:'solid', size:'sm' }, ['✅ ', t.ui.customer_attach]),
                UI.Button({ attrs:{ gkey:'pos:customer:edit', class: tw`flex-1` }, variant:'ghost', size:'sm' }, ['✏️ ', t.ui.customer_edit_action || t.ui.customer_create])
              ])
            ])
          })
        : UI.EmptyState({ icon:'👤', title:t.ui.customer_use_existing || t.ui.customer_tab_search, description:t.ui.customer_search_placeholder });
      const searchColumn = UI.Card({
        variant:'card/soft-1',
        title:t.ui.customer_search,
        content: D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [
          UI.Input({ attrs:{ type:'search', value: searchValue, placeholder:t.ui.customer_search_placeholder, gkey:'pos:customer:search' } }),
          UI.NumpadDecimal({
            attrs:{ class: tw`w-full` },
            value: keypadValue,
            placeholder:t.ui.customer_keypad,
            gkey:'pos:customer:keypad',
            allowDecimal:false,
            confirmLabel:t.ui.customer_search,
            confirmAttrs:{ gkey:'pos:customer:keypad:confirm', variant:'solid', size:'sm', class: tw`w-full` }
          }),
          customerList
        ])
      });
      const formState = customerUI.form || createEmptyCustomerForm();
      const formPhones = Array.isArray(formState.phones) && formState.phones.length ? formState.phones : [''];
      const formAddresses = Array.isArray(formState.addresses) && formState.addresses.length ? formState.addresses : [createEmptyCustomerForm().addresses[0]];
      const phoneFields = D.Containers.Div({ attrs:{ class: tw`space-y-2` }}, formPhones.map((phone, index)=> UI.HStack({ attrs:{ class: tw`items-center gap-2` }}, [
        UI.Input({ attrs:{ value: phone, placeholder:t.ui.customer_phone, gkey:'pos:customer:form:phone', 'data-index':index, inputmode:'tel' } }),
        formPhones.length > 1 ? UI.Button({ attrs:{ gkey:'pos:customer:form:phone:remove', 'data-index':index, class: tw`h-9 rounded-full px-3 text-xs` }, variant:'ghost', size:'sm' }, ['✕']) : null
      ].filter(Boolean))));
      const addressFields = D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, formAddresses.map((address, index)=> UI.Card({
        variant:'card/soft-2',
        content: D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, [
          UI.Field({ label:t.ui.customer_address_title, control: UI.Input({ attrs:{ value: address.title || '', gkey:'pos:customer:form:address:title', 'data-index':index, placeholder:t.ui.customer_address_title } }) }),
          UI.Field({ label:t.ui.customer_area, control: UI.Select({ attrs:{ value: address.areaId || '', gkey:'pos:customer:form:address:area', 'data-index':index }, options: areaOptions }) }),
          UI.Field({ label:t.ui.customer_address_line, control: UI.Input({ attrs:{ value: address.line || '', gkey:'pos:customer:form:address:line', 'data-index':index, placeholder:t.ui.customer_address_line } }) }),
          UI.Field({ label:t.ui.customer_address_notes, control: UI.Textarea({ attrs:{ value: address.notes || '', gkey:'pos:customer:form:address:notes', 'data-index':index, rows:2, placeholder:t.ui.customer_address_notes } }) }),
          formAddresses.length > 1 ? UI.Button({ attrs:{ gkey:'pos:customer:form:address:remove', 'data-index':index, class: tw`w-full` }, variant:'ghost', size:'sm' }, ['🗑️ ', t.ui.customer_remove_address]) : null
        ].filter(Boolean))
      })));
      const formColumn = UI.Card({
        variant:'card/soft-1',
        title: formState.id ? t.ui.customer_edit : t.ui.customer_new,
        content: D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [
          UI.Field({ label:t.ui.customer_name, control: UI.Input({ attrs:{ value: formState.name || '', gkey:'pos:customer:form:name', placeholder:t.ui.customer_name } }) }),
          D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [t.ui.customer_multi_phone_hint]),
          phoneFields,
          UI.Button({ attrs:{ gkey:'pos:customer:form:phone:add', class: tw`w-full` }, variant:'ghost', size:'sm' }, ['➕ ', t.ui.customer_add_phone]),
          UI.NumpadDecimal({
            attrs:{ class: tw`w-full` },
            value: keypadValue,
            placeholder:t.ui.customer_keypad,
            gkey:'pos:customer:keypad',
            allowDecimal:false,
            confirmLabel:t.ui.customer_add_phone,
            confirmAttrs:{ gkey:'pos:customer:form:keypad:confirm', variant:'solid', size:'sm', class: tw`w-full` }
          }),
          D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [t.ui.customer_multi_address_hint]),
          addressFields,
          UI.Button({ attrs:{ gkey:'pos:customer:form:address:add', class: tw`w-full` }, variant:'ghost', size:'sm' }, ['➕ ', t.ui.customer_add_address]),
          D.Containers.Div({ attrs:{ class: tw`flex flex-wrap gap-2` }}, [
            UI.Button({ attrs:{ gkey:'pos:customer:save', class: tw`flex-1` }, variant:'solid', size:'sm' }, ['💾 ', t.ui.customer_create]),
            UI.Button({ attrs:{ gkey:'pos:customer:form:reset', class: tw`flex-1` }, variant:'ghost', size:'sm' }, ['↺ ', t.ui.customer_form_reset || t.ui.clear])
          ])
        ])
      });
      const bodyContent = mode === 'search'
        ? D.Containers.Div({ attrs:{ class: tw`grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]` }}, [searchColumn, selectedDetails])
        : D.Containers.Div({ attrs:{ class: tw`grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]` }}, [formColumn, D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, [
            D.Text.Span({ attrs:{ class: tw`text-sm ${token('muted')}` }}, [t.ui.customer_multi_phone_hint]),
            D.Text.Span({ attrs:{ class: tw`text-sm ${token('muted')}` }}, [t.ui.customer_multi_address_hint])
          ])]);
      return UI.Modal({
        open:true,
        size: db.ui?.modalSizes?.customers || 'full',
        sizeKey:'customers',
        closeGkey:'pos:customer:close',
        title:t.ui.customer_center,
        description: mode === 'search' ? t.ui.customer_use_existing || t.ui.customer_search : t.ui.customer_new,
        content: D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [tabs, bodyContent]),
        actions:[UI.Button({ attrs:{ gkey:'pos:customer:close', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.close])]
      });
    }

    function SettingsDrawer(db){
      const t = getTexts(db);
      const uiSettings = db.ui.settings || {};
      if(!uiSettings.open) return null;
      const activeTheme = uiSettings.activeTheme || db.env.theme || 'dark';
      const themePrefs = db.data.themePrefs || {};
      const currentPrefs = themePrefs[activeTheme] || {};
      const colorPrefs = currentPrefs.colors || {};
      const fontPrefs = currentPrefs.fonts || {};
      const paletteDefaults = (BASE_PALETTE && BASE_PALETTE[activeTheme]) || {};

      const colorFields = [
        { key:'--background', label:t.ui.settings_color_background, fallback: paletteDefaults.background },
        { key:'--foreground', label:t.ui.settings_color_foreground, fallback: paletteDefaults.foreground },
        { key:'--primary', label:t.ui.settings_color_primary, fallback: paletteDefaults.primary },
        { key:'--accent', label:t.ui.settings_color_accent, fallback: paletteDefaults.accent },
        { key:'--muted', label:t.ui.settings_color_muted, fallback: paletteDefaults.muted }
      ];

      const themeTabs = UI.Segmented({
        items:[
          { id:'light', label:`☀️ ${t.ui.settings_light}`, attrs:{ gkey:'pos:settings:theme', 'data-theme':'light' } },
          { id:'dark', label:`🌙 ${t.ui.settings_dark}`, attrs:{ gkey:'pos:settings:theme', 'data-theme':'dark' } }
        ],
        activeId: activeTheme
      });

      const normalizeColor = (value, fallback)=>{
        const source = value || fallback || '#000000';
        if(!source) return '#000000';
        const trimmed = String(source).trim();
        if(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) return trimmed.length === 4
          ? '#' + trimmed.slice(1).split('').map(ch=> ch+ch).join('')
          : trimmed;
        const nums = trimmed.match(/[-]?[\d\.]+/g);
        if(!nums || nums.length < 3) return '#000000';
        if(trimmed.startsWith('rgb')){
          const [r,g,b] = nums.map(n=> Math.max(0, Math.min(255, Math.round(Number(n)))));
          return '#' + [r,g,b].map(v=> v.toString(16).padStart(2,'0')).join('');
        }
        if(trimmed.startsWith('hsl')){
          const [hRaw,sRaw,lRaw] = nums.map(Number);
          const h = ((hRaw % 360) + 360) % 360;
          const s = (sRaw > 1 ? sRaw / 100 : sRaw);
          const l = (lRaw > 1 ? lRaw / 100 : lRaw);
          const c = (1 - Math.abs(2 * l - 1)) * s;
          const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
          const m = l - c / 2;
          let r=0, g=0, b=0;
          if (h < 60) { r = c; g = x; b = 0; }
          else if (h < 120) { r = x; g = c; b = 0; }
          else if (h < 180) { r = 0; g = c; b = x; }
          else if (h < 240) { r = 0; g = x; b = c; }
          else if (h < 300) { r = x; g = 0; b = c; }
          else { r = c; g = 0; b = x; }
          const toHex = v => Math.round((v + m) * 255).toString(16).padStart(2,'0');
          return '#' + toHex(r) + toHex(g) + toHex(b);
        }
        return '#000000';
      };

      const colorControls = D.Containers.Div({ attrs:{ class: tw`space-y-3` }}, colorFields.map(field=>{
        const value = normalizeColor(colorPrefs[field.key], field.fallback);
        return UI.Field({
          label: field.label,
          control: UI.Input({ attrs:{ type:'color', value, gkey:'pos:settings:color', 'data-css-var':field.key } })
        });
      }));

      const fontSizeValue = fontPrefs.base || '16px';
      const fontControl = UI.Field({
        label: t.ui.settings_font_base,
        control: UI.Input({ attrs:{ type:'number', min:'12', max:'24', step:'0.5', value: String(parseFloat(fontSizeValue) || 16), gkey:'pos:settings:font' } })
      });

      const resetButton = UI.Button({
        attrs:{ gkey:'pos:settings:reset', class: tw`w-full` },
        variant:'ghost',
        size:'sm'
      }, [`↺ ${t.ui.settings_reset}`]);

      return UI.Drawer({
        open:true,
        side:'end',
        header: D.Containers.Div({ attrs:{ class: tw`flex items-center justify-between` }}, [
          D.Text.Strong({}, [t.ui.settings_center]),
          UI.Button({ attrs:{ gkey:'pos:settings:close' }, variant:'ghost', size:'sm' }, ['✕'])
        ]),
        content: D.Containers.Div({ attrs:{ class: tw`flex h-full flex-col gap-4` }}, [
          D.Text.Span({ attrs:{ class: tw`text-sm ${token('muted')}` }}, [t.ui.settings_theme]),
          themeTabs,
          UI.Divider(),
          D.Text.Strong({ attrs:{ class: tw`text-sm` }}, [t.ui.settings_colors]),
          colorControls,
          UI.Divider(),
          D.Text.Strong({ attrs:{ class: tw`text-sm` }}, [t.ui.settings_fonts]),
          fontControl,
          resetButton
        ])
      });
    }

    function ShiftPinDialog(db){
      const shiftUI = db.ui.shift || {};
      if(!shiftUI.showPin) return null;
      const t = getTexts(db);
      const openingFloat = shiftUI.openingFloat ?? db.data.shift?.config?.openingFloat ?? SHIFT_OPEN_FLOAT_DEFAULT;
      const pinLength = db.data.shift?.config?.pinLength || SHIFT_PIN_LENGTH;
      const pinPlaceholder = '•'.repeat(Math.max(pinLength || 0, 4));
      return UI.Modal({
        open:true,
        size: db.ui?.modalSizes?.['shift-pin'] || 'sm',
        sizeKey:'shift-pin',
        closeGkey:'pos:shift:pin:cancel',
        title:t.ui.shift_open,
        description:t.ui.shift_open_prompt,
        content: D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [
          UI.NumpadDecimal({
            value: shiftUI.pin || '',
            placeholder: pinPlaceholder,
            gkey:'pos:shift:pin',
            allowDecimal:false,
            masked:true,
            maskLength: pinLength,
            confirmLabel:t.ui.shift_open,
            confirmAttrs:{ gkey:'pos:shift:pin:confirm', variant:'solid', size:'sm', class: tw`w-full` }
          }),
          UI.Field({
            label:t.ui.shift_cash_start,
            control: UI.Input({ attrs:{ type:'number', step:'0.01', value:String(openingFloat ?? 0), gkey:'pos:shift:opening-float' } })
          })
        ]),
        actions:[
          UI.Button({ attrs:{ gkey:'pos:shift:pin:cancel', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.close])
        ]
      });
    }

    function ShiftSummaryModal(db){
      const t = getTexts(db);
      const shiftUI = db.ui.shift || {};
      if(!shiftUI.showSummary) return null;
      const shiftState = db.data.shift || {};
      const history = Array.isArray(shiftState.history) ? shiftState.history : [];
      const current = shiftState.current || null;
      const defaultViewId = shiftUI.viewShiftId || (current ? current.id : (history[history.length-1]?.id || null));
      let viewingCurrent = false;
      let shift = null;
      if(current && current.id === defaultViewId){
        shift = current;
        viewingCurrent = true;
      } else {
        shift = history.find(item=> item.id === defaultViewId) || (current || history[history.length-1] || null);
        viewingCurrent = !!(shift && current && shift.id === current.id);
      }
      if(!shift){
        return UI.Modal({
          open:true,
          size: db.ui?.modalSizes?.['shift-summary'] || 'md',
          sizeKey:'shift-summary',
          title:t.ui.shift_summary,
          description:t.ui.shift_history_empty,
          actions:[UI.Button({ attrs:{ gkey:'pos:shift:summary:close', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.close])]
        });
      }
      const lang = db.env.lang;
      const report = summarizeShiftOrders(db.data.ordersHistory, shift);
      const totalsByType = report.totalsByType || {};
      const paymentsByMethod = report.paymentsByMethod || {};
      const countsByType = report.countsByType || {};
      const dineInTotal = round(totalsByType.dine_in || 0);
      const takeawayTotal = round(totalsByType.takeaway || 0);
      const deliveryTotal = round(totalsByType.delivery || 0);
      const totalSales = report.totalSales != null ? round(report.totalSales) : round(dineInTotal + takeawayTotal + deliveryTotal);
      const paymentMethods = Array.isArray(db.data.payments?.methods) && db.data.payments.methods.length ? db.data.payments.methods : PAYMENT_METHODS;
      const paymentRows = paymentMethods.map(method=>{
        const amount = round(paymentsByMethod[method.id] || 0);
        return UI.HStack({ attrs:{ class: tw`${token('split')} text-sm` }}, [
          D.Text.Span({}, [`${method.icon || '💳'} ${localize(method.label, lang)}`]),
          UI.PriceText({ amount, currency:getCurrency(db), locale:getLocale(db) })
        ]);
      });
      Object.keys(paymentsByMethod).forEach(key=>{
        if(paymentMethods.some(method=> method.id === key)) return;
        const amount = round(paymentsByMethod[key] || 0);
        paymentRows.push(UI.HStack({ attrs:{ class: tw`${token('split')} text-sm` }}, [
          D.Text.Span({}, [key]),
          UI.PriceText({ amount, currency:getCurrency(db), locale:getLocale(db) })
        ]));
      });
      const openingFloat = round(shift.openingFloat || 0);
      const cashCollected = round(paymentsByMethod.cash || 0);
      const closingCash = shift.closingCash != null ? round(shift.closingCash) : round(openingFloat + cashCollected);
      const ordersCount = report.ordersCount != null ? report.ordersCount : (Array.isArray(shift.orders) ? shift.orders.length : 0);
      const openedLabel = shift.openedAt ? formatDateTime(shift.openedAt, lang, { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';
      const closedLabel = shift.closedAt ? formatDateTime(shift.closedAt, lang, { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';
      const chipsSection = (()=>{
        const items = [];
        if(current){
          items.push({ id: current.id, label:`${t.ui.shift_current}`, attrs:{ gkey:'pos:shift:view', 'data-shift-id':current.id } });
        }
        history.forEach(item=>{
          const label = item.openedAt ? formatDateTime(item.openedAt, lang, { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : item.id;
          items.push({ id:item.id, label, attrs:{ gkey:'pos:shift:view', 'data-shift-id':item.id } });
        });
        if(!items.length) return null;
        const labelText = viewingCurrent ? t.ui.shift_current : t.ui.shift_select_history;
        return D.Containers.Div({ attrs:{ class: tw`space-y-1` }}, [
          D.Text.Span({ attrs:{ class: tw`text-sm font-medium` }}, [labelText]),
          UI.ChipGroup({ items, activeId: shift.id })
        ]);
      })();
      const renderTypeRow = (typeId, labelText)=>{
        const amount = round(totalsByType[typeId] || 0);
        const count = countsByType[typeId] || 0;
        return UI.HStack({ attrs:{ class: tw`${token('split')} text-sm` }}, [
          D.Containers.Div({ attrs:{ class: tw`flex items-center gap-2` }}, [
            D.Text.Span({}, [labelText]),
            count ? UI.Badge({ text:String(count), variant:'badge/ghost', attrs:{ class: tw`text-[0.65rem]` } }) : null
          ].filter(Boolean)),
          UI.PriceText({ amount, currency:getCurrency(db), locale:getLocale(db) })
        ]);
      };
      const baseTypeRows = [
        renderTypeRow('dine_in', t.ui.shift_total_dine_in),
        renderTypeRow('takeaway', t.ui.shift_total_takeaway),
        renderTypeRow('delivery', t.ui.shift_total_delivery)
      ];
      const extraTypeRows = Object.keys(totalsByType)
        .filter(key=> !['dine_in','takeaway','delivery'].includes(key))
        .sort()
        .map(typeId=>{
          const config = ORDER_TYPES.find(type=> type.id === typeId);
          const label = config ? localize(config.label, lang) : typeId;
          return renderTypeRow(typeId, label);
        });
      const totalsCard = UI.Card({
        variant:'card/soft-1',
        title:t.ui.shift_total_sales,
        content: D.Containers.Div({ attrs:{ class: tw`space-y-2` }}, [
          ...baseTypeRows,
          ...extraTypeRows,
          UI.Divider(),
          UI.HStack({ attrs:{ class: tw`${token('split')} text-base font-semibold` }}, [D.Text.Span({}, [t.ui.shift_total_sales]), UI.PriceText({ amount:totalSales, currency:getCurrency(db), locale:getLocale(db) })])
        ])
      });
      const paymentsCard = UI.Card({
        variant:'card/soft-1',
        title:t.ui.shift_payments,
        content: D.Containers.Div({ attrs:{ class: tw`space-y-2` }}, paymentRows)
      });
      const cashCard = UI.Card({
        variant:'card/soft-2',
        title:t.ui.shift_cash_summary,
        content: D.Containers.Div({ attrs:{ class: tw`space-y-2 text-sm` }}, [
          UI.HStack({ attrs:{ class: tw`${token('split')}` }}, [D.Text.Span({}, [t.ui.shift_cash_start]), UI.PriceText({ amount:openingFloat, currency:getCurrency(db), locale:getLocale(db) })]),
          UI.HStack({ attrs:{ class: tw`${token('split')}` }}, [D.Text.Span({}, [t.ui.shift_cash_collected]), UI.PriceText({ amount:cashCollected, currency:getCurrency(db), locale:getLocale(db) })]),
          UI.Divider(),
          UI.HStack({ attrs:{ class: tw`${token('split')} font-semibold` }}, [D.Text.Span({}, [t.ui.shift_cash_end]), UI.PriceText({ amount:closingCash, currency:getCurrency(db), locale:getLocale(db) })])
        ])
      });
      const metaRow = UI.Card({
        variant:'card/soft-2',
        content: D.Containers.Div({ attrs:{ class: tw`space-y-2 text-xs ${token('muted')}` }}, [
          D.Text.Span({}, [`POS: ${shift.posLabel || POS_INFO.label}`]),
          D.Text.Span({}, [`POS ID: ${shift.posId || POS_INFO.id}`]),
          D.Text.Span({}, [`${t.ui.shift}: ${shift.id}`]),
          D.Text.Span({}, [`${t.ui.cashier}: ${shift.cashierName || '—'}`]),
          D.Text.Span({}, [`${t.ui.shift_orders_count}: ${ordersCount}`]),
          D.Text.Span({}, [`${openedLabel} → ${closedLabel}`])
        ])
      });
      const summaryContent = D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [
        chipsSection,
        totalsCard,
        paymentsCard,
        cashCard,
        metaRow
      ].filter(Boolean));
      const ordersTable = report.orders?.length
        ? UI.Table({
            columns:[
              { key:'id', label:t.ui.order_id },
              { key:'type', label:t.ui.orders_type },
              { key:'total', label:t.ui.orders_total },
              { key:'savedAt', label:t.ui.orders_updated }
            ],
            rows: report.orders.map(entry=>({
              id: entry.id,
              type: localize(getOrderTypeConfig(entry.type || 'dine_in').label, lang),
              total: new Intl.NumberFormat(getLocale(db), { style:'currency', currency:getCurrency(db) }).format(entry.total || 0),
              savedAt: formatDateTime(entry.savedAt, lang, { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
            }))
          })
        : UI.EmptyState({ icon:'🧾', title:t.ui.orders_no_results, description:t.ui.orders_queue_hint });
      const paymentsTable = report.payments?.length
        ? UI.Table({
            columns:[
              { key:'orderId', label:t.ui.order_id },
              { key:'method', label:t.ui.payments },
              { key:'amount', label:t.ui.amount },
              { key:'capturedAt', label:t.ui.orders_updated }
            ],
            rows: report.payments.map(entry=>({
              orderId: entry.orderId,
              method: entry.method,
              amount: new Intl.NumberFormat(getLocale(db), { style:'currency', currency:getCurrency(db) }).format(entry.amount || 0),
              capturedAt: formatDateTime(entry.capturedAt, lang, { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
            }))
          })
        : UI.EmptyState({ icon:'💳', title:t.ui.payments, description:t.ui.orders_no_results });
      const refundsContent = report.refunds?.length
        ? UI.List({ children: report.refunds.map(ref=> UI.ListItem({
              leading:'↩️',
              content:[
                D.Text.Strong({}, [ref.id || '—']),
                D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [`${t.ui.order_id}: ${ref.orderId || '—'}`])
              ],
              trailing: D.Text.Span({}, [new Intl.NumberFormat(getLocale(db), { style:'currency', currency:getCurrency(db) }).format(ref.amount || 0)])
            })) })
        : UI.EmptyState({ icon:'↩️', title:t.ui.refunds, description:t.ui.orders_no_results });
      const returnsContent = report.returns?.length
        ? UI.List({ children: report.returns.map(ret=> UI.ListItem({
              leading:'🛒',
              content:[
                D.Text.Strong({}, [ret.id || '—']),
                D.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [`${t.ui.order_id}: ${ret.orderId || '—'}`])
              ],
              trailing: D.Text.Span({}, [new Intl.NumberFormat(getLocale(db), { style:'currency', currency:getCurrency(db) }).format(ret.amount || 0)])
            })) })
        : UI.EmptyState({ icon:'🛒', title:t.ui.returns, description:t.ui.orders_no_results });
      const tabs = UI.Tabs({
        gkey:'pos:shift:tab',
        items:[
          { id:'summary', label:t.ui.shift_summary, content: summaryContent },
          { id:'orders', label:t.ui.orders, content: ordersTable },
          { id:'payments', label:t.ui.payments, content: paymentsTable },
          { id:'refunds', label:t.ui.refunds, content: refundsContent },
          { id:'returns', label:t.ui.returns, content: returnsContent }
        ],
        activeId: shiftUI.activeTab || 'summary'
      });
      const content = D.Containers.Div({ attrs:{ class: tw`space-y-4` }}, [tabs]);
      const actions = [
        viewingCurrent ? UI.Button({ attrs:{ gkey:'pos:shift:close', class: tw`w-full` }, variant:'solid', size:'sm' }, [t.ui.shift_close_confirm]) : null,
        UI.Button({ attrs:{ gkey:'pos:shift:summary:close', class: tw`w-full` }, variant:'ghost', size:'sm' }, [t.ui.close])
      ].filter(Boolean);
      return UI.Modal({
        open:true,
        size: db.ui?.modalSizes?.['shift-summary'] || 'full',
        sizeKey:'shift-summary',
        closeGkey:'pos:shift:summary:close',
        title:t.ui.shift_summary,
        description:viewingCurrent ? t.ui.shift_current : t.ui.shift_history,
        content,
        actions
      });
    }

    Mishkah.app.setBody(function(db){
      return UI.AppRoot({
        shell: D.Containers.Div({ attrs:{ class: tw`pos-shell flex h-full min-h-0 flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]` }}, [
          Header(db),
          D.Containers.Main({ attrs:{ class: tw`flex-1 min-h-0 w-full grid gap-4 px-4 pb-3 pt-3 lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)] overflow-hidden` }}, [
            MenuColumn(db),
            OrderColumn(db)
          ]),
          FooterBar(db)
        ]),
        overlays:[
          SettingsDrawer(db),
          CustomersModal(db),
          ShiftPinDialog(db),
          ShiftSummaryModal(db),
          TablesModal(db),
          ReservationsModal(db),
          PrintModal(db),
          LineModifiersModal(db),
          PaymentsSheet(db),
          ReportsDrawer(db),
          OrdersQueueModal(db),
          db.ui?.toasts ? UI.ToastHost({ toasts: db.ui.toasts }) : null
        ].filter(Boolean)
      });
    });

    const app = M.app.createApp(posState, {});
    appRef = app;
    const POS_DEV_TOOLS = {
      async resetIndexedDB(){
        if(!posDB.available || typeof posDB.resetAll !== 'function'){
          console.info('[Mishkah][POS] IndexedDB is not available in this environment.');
          return false;
        }
        await posDB.resetAll();
        invoiceSequence = 0;
        await refreshPersistentSnapshot({ focusCurrent:false, syncOrders:true });
        console.info('[Mishkah][POS] Local IndexedDB cleared.');
        return true;
      },
      async refresh(){
        return refreshPersistentSnapshot({ focusCurrent:true, syncOrders:true });
      },
      schema:{
        registry: POS_SCHEMA_REGISTRY,
        toJSON(){ return POS_SCHEMA_REGISTRY.toJSON(); },
        generateSQL(options){ return POS_SCHEMA_REGISTRY.generateSQL(options || {}); }
      }
    };
    Object.defineProperty(window, '__MishkahPOSDev__', {
      value: POS_DEV_TOOLS,
      configurable:true,
      enumerable:false,
      writable:false
    });
    console.info('%c[Mishkah POS] Developer helpers ready → use __MishkahPOSDev__.resetIndexedDB() to wipe local data.', 'color:#fbbf24;font-weight:bold;');
    const auto = U.twcss.auto(posState, app, { pageScaffold:true });

    function closeActiveModals(ctx){
      const state = ctx.getState();
      const modalsState = state.ui?.modals || {};
      const anyOpen = Object.values(modalsState).some(Boolean) || !!state.ui?.modalOpen;
      if(!anyOpen) return false;
      ctx.setState(s=>{
        const current = { ...(s.ui?.modals || {}) };
        Object.keys(current).forEach(key=>{
          current[key] = false;
        });
        return {
          ...s,
          ui:{ ...(s.ui || {}), modalOpen:false, modals: current }
        };
      });
      return true;
    }

    const posOrders = {
      'ui.modal.close':{
        on:['click'],
        gkeys:['ui:modal:close'],
        handler:(e,ctx)=>{
          e.preventDefault();
          e.stopPropagation();
          closeActiveModals(ctx);
        }
      },
      'ui.modal.size':{
        on:['click'],
        gkeys:['ui:modal:size'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-modal-size-key]');
          if(!btn) return;
          const key = btn.getAttribute('data-modal-size-key');
          const value = btn.getAttribute('data-modal-size');
          if(!key || !value) return;
          ctx.setState(s=>{
            const current = s.ui?.modalSizes || {};
            const next = { ...current, [key]: value };
            if(preferencesStore){
              try { preferencesStore.set('modalSizes', next); } catch(err){ console.warn('[Mishkah][POS] modal size persist failed', err); }
            }
            return {
              ...s,
              ui:{ ...(s.ui || {}), modalSizes: next }
            };
          });
        }
      },
      'pos.shift.tab':{
        on:['click'],
        gkeys:['pos:shift:tab'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-tab-id]');
          if(!btn) return;
          const tabId = btn.getAttribute('data-tab-id');
          if(!tabId) return;
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), shift:{ ...(s.ui?.shift || {}), activeTab: tabId } }
          }));
        }
      },
      'pos.settings.open':{
        on:['click'],
        gkeys:['pos:settings:open'],
        handler:(e,ctx)=>{
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), settings:{ ...(s.ui?.settings || {}), open:true, activeTheme:(s.ui?.settings?.activeTheme || s.env?.theme || 'dark') } }
          }));
        }
      },
      'pos.settings.close':{
        on:['click'],
        gkeys:['pos:settings:close','ui:drawer:close'],
        handler:(e,ctx)=>{
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), settings:{ ...(s.ui?.settings || {}), open:false } }
          }));
        }
      },
      'pos.settings.theme':{
        on:['click'],
        gkeys:['pos:settings:theme'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-theme]');
          if(!btn) return;
          const theme = btn.getAttribute('data-theme');
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), settings:{ ...(s.ui?.settings || {}), activeTheme: theme || 'light', open:true } }
          }));
        }
      },
      'pos.settings.color':{
        on:['input','change'],
        gkeys:['pos:settings:color'],
        handler:(e,ctx)=>{
          const input = e.target;
          const cssVar = input.getAttribute('data-css-var');
          const value = input.value;
          if(!cssVar) return;
          const state = ctx.getState();
          const themeKey = state.ui?.settings?.activeTheme || state.env?.theme || 'dark';
          ctx.setState(s=>{
            const prefs = { ...(s.data.themePrefs || {}) };
            const entry = { colors:{ ...(prefs[themeKey]?.colors || {}) }, fonts:{ ...(prefs[themeKey]?.fonts || {}) } };
            entry.colors[cssVar] = value;
            prefs[themeKey] = entry;
            if(preferencesStore){
              try { preferencesStore.set('themePrefs', prefs); } catch(err){ console.warn('[Mishkah][POS] theme prefs persist failed', err); }
            }
            return { ...s, data:{ ...(s.data || {}), themePrefs: prefs } };
          });
          applyThemePreferenceStyles(ctx.getState().data.themePrefs);
        }
      },
      'pos.settings.font':{
        on:['input','change'],
        gkeys:['pos:settings:font'],
        handler:(e,ctx)=>{
          const value = parseFloat(e.target.value);
          if(!Number.isFinite(value)) return;
          const state = ctx.getState();
          const themeKey = state.ui?.settings?.activeTheme || state.env?.theme || 'dark';
          ctx.setState(s=>{
            const prefs = { ...(s.data.themePrefs || {}) };
            const entry = { colors:{ ...(prefs[themeKey]?.colors || {}) }, fonts:{ ...(prefs[themeKey]?.fonts || {}) } };
            entry.fonts.base = `${value}px`;
            prefs[themeKey] = entry;
            if(preferencesStore){
              try { preferencesStore.set('themePrefs', prefs); } catch(err){ console.warn('[Mishkah][POS] theme prefs persist failed', err); }
            }
            return { ...s, data:{ ...(s.data || {}), themePrefs: prefs } };
          });
          applyThemePreferenceStyles(ctx.getState().data.themePrefs);
        }
      },
      'pos.settings.reset':{
        on:['click'],
        gkeys:['pos:settings:reset'],
        handler:(e,ctx)=>{
          const state = ctx.getState();
          const themeKey = state.ui?.settings?.activeTheme || state.env?.theme || 'dark';
          ctx.setState(s=>{
            const prefs = { ...(s.data.themePrefs || {}) };
            delete prefs[themeKey];
            if(preferencesStore){
              try { preferencesStore.set('themePrefs', prefs); } catch(err){ console.warn('[Mishkah][POS] theme prefs persist failed', err); }
            }
            return { ...s, data:{ ...(s.data || {}), themePrefs: prefs } };
          });
          applyThemePreferenceStyles(ctx.getState().data.themePrefs);
        }
      },
      'ui.modal.escape':{
        on:['keydown'],
        handler:(e,ctx)=>{
          if(e.key !== 'Escape') return;
          const closed = closeActiveModals(ctx);
          if(closed){
            e.preventDefault();
            e.stopPropagation();
          }
        }
      },
      'pos.menu.search':{
        on:['input','change'],
        gkeys:['pos:menu:search'],
        handler:(e,ctx)=>{
          const value = e.target.value || '';
          ctx.setState(s=>({
            ...s,
            data:{
              ...s.data,
              menu:{ ...(s.data.menu || {}), search:value }
            }
          }));
        }
      },
      'pos.menu.category':{
        on:['click'],
        gkeys:['pos:menu:category'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-category-id]');
          if(!btn) return;
          const id = btn.getAttribute('data-category-id') || 'all';
          ctx.setState(s=>({
            ...s,
            data:{
              ...s.data,
              menu:{ ...(s.data.menu || {}), category:id }
            }
          }));
        }
      },
      'pos.menu:add':{
        on:['click','keydown'],
        gkeys:['pos:menu:add'],
        handler:(e,ctx)=>{
          if(e.type === 'keydown' && !['Enter',' '].includes(e.key)) return;
          const card = e.target.closest('[data-item-id]');
          if(!card) return;
          const itemId = card.getAttribute('data-item-id');
          const state = ctx.getState();
          const item = (state.data.menu.items || []).find(it=> String(it.id) === String(itemId));
          if(!item) return;
          const t = getTexts(state);
          ctx.setState(s=>{
            const data = s.data || {};
            const order = data.order || {};
            const typeConfig = getOrderTypeConfig(order.type || 'dine_in');
            const isPersisted = !!order.isPersisted;
            const allowAdditions = order.allowAdditions !== undefined ? order.allowAdditions : !!typeConfig.allowsLineAdditions;
            if(isPersisted && !allowAdditions){
              UI.pushToast(ctx, { title:t.toast.order_additions_blocked, icon:'🚫' });
              return s;
            }
            const lines = (order.lines || []).map(line=> ({ ...line }));
            const canMerge = !isPersisted;
            const idx = canMerge ? lines.findIndex(line=> String(line.itemId) === String(item.id)) : -1;
            if(idx >= 0){
              const existing = lines[idx];
              lines[idx] = updateLineWithPricing(existing, { qty: (existing.qty || 0) + 1, updatedAt: Date.now() });
            } else {
              lines.push(createOrderLine(item, 1, { kitchenSection: item.kitchenSection }));
            }
            const totals = calculateTotals(lines, data.settings || {}, order.type);
            return {
              ...s,
              data:{
                ...data,
                order:{
                  ...order,
                  lines,
                  totals,
                  updatedAt: Date.now(),
                  allowAdditions: allowAdditions
                }
              }
            };
          });
          UI.pushToast(ctx, { title:t.toast.item_added, icon:'✅' });
        }
      },
      'pos.menu.favorite':{
        on:['click'],
        gkeys:['pos:menu:favorite'],
        handler:(e,ctx)=>{
          e.preventDefault();
          e.stopPropagation();
          const btn = e.target.closest('[data-item-id]');
          if(!btn) return;
          const itemId = String(btn.getAttribute('data-item-id'));
          ctx.setState(s=>{
            const menu = s.data.menu || {};
            const favorites = new Set((menu.favorites || []).map(String));
            if(favorites.has(itemId)) favorites.delete(itemId); else favorites.add(itemId);
            return {
              ...s,
              data:{
                ...s.data,
                menu:{ ...menu, favorites:Array.from(favorites) }
              }
            };
          });
        }
      },
      'pos.menu.favorites-only':{
        on:['click'],
        gkeys:['pos:menu:favorites-only'],
        handler:(e,ctx)=>{
          ctx.setState(s=>({
            ...s,
            data:{
              ...s.data,
              menu:{ ...(s.data.menu || {}), showFavoritesOnly: !s.data.menu?.showFavoritesOnly }
            }
          }));
        }
      },
      'pos.menu.load-more':{
        on:['click'],
        gkeys:['pos:menu:load-more'],
        handler:(e,ctx)=>{
          const t = getTexts(ctx.getState());
          UI.pushToast(ctx, { title:t.toast.load_more_stub, icon:'ℹ️' });
        }
      },
      'pos.order.line.inc':{
        on:['click'],
        gkeys:['pos:order:line:inc'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-line-id]');
          if(!btn) return;
          const lineId = btn.getAttribute('data-line-id');
          ctx.setState(s=>{
            const data = s.data || {};
            const order = data.order || {};
            const line = (order.lines || []).find(l=> l.id === lineId);
            if(!line){
              return s;
            }
            if(line.locked || (order.isPersisted && order.lockLineEdits) || (line.status && line.status !== 'draft')){
              UI.pushToast(ctx, { title:getTexts(s).toast.line_locked, icon:'🔒' });
              return s;
            }
            const lines = (order.lines || []).map(l=>{
              if(l.id !== lineId) return l;
              return updateLineWithPricing(l, { qty: (l.qty || 0) + 1, updatedAt: Date.now() });
            });
            const totals = calculateTotals(lines, data.settings || {}, order.type);
            return {
              ...s,
              data:{
                ...data,
                order:{ ...order, lines, totals, updatedAt: Date.now() }
              }
            };
          });
        }
      },
      'pos.order.line.dec':{
        on:['click'],
        gkeys:['pos:order:line:dec'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-line-id]');
          if(!btn) return;
          const lineId = btn.getAttribute('data-line-id');
          ctx.setState(s=>{
            const data = s.data || {};
            const order = data.order || {};
            const target = (order.lines || []).find(l=> l.id === lineId);
            if(!target){
              return s;
            }
            if(target.locked || (order.isPersisted && order.lockLineEdits) || (target.status && target.status !== 'draft')){
              UI.pushToast(ctx, { title:getTexts(s).toast.line_locked, icon:'🔒' });
              return s;
            }
            const lines = [];
            for(const line of (order.lines || [])){
              if(line.id !== lineId){
                lines.push(line);
                continue;
              }
              if(line.qty <= 1) continue;
              lines.push(updateLineWithPricing(line, { qty: line.qty - 1, updatedAt: Date.now() }));
            }
            const totals = calculateTotals(lines, data.settings || {}, order.type);
            return {
              ...s,
              data:{
                ...data,
                order:{ ...order, lines, totals, updatedAt: Date.now() }
              }
            };
          });
        }
      },
      'pos.order.line.qty':{
        on:['click'],
        gkeys:['pos:order:line:qty'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-line-id]');
          if(!btn) return;
          const lineId = btn.getAttribute('data-line-id');
          const state = ctx.getState();
          const t = getTexts(state);
          const current = (state.data.order.lines || []).find(line=> line.id === lineId);
          if(current && (current.locked || (state.data.order.isPersisted && state.data.order.lockLineEdits) || (current.status && current.status !== 'draft'))){
            UI.pushToast(ctx, { title:t.toast.line_locked, icon:'🔒' });
            return;
          }
          const nextValue = window.prompt(t.toast.set_qty, current ? current.qty : 1);
          if(nextValue == null) return;
          const qty = Math.max(1, parseInt(nextValue, 10) || 1);
          ctx.setState(s=>{
            const data = s.data || {};
            const order = data.order || {};
            const lines = (order.lines || []).map(line=>{
              if(line.id !== lineId) return line;
              return updateLineWithPricing(line, { qty, updatedAt: Date.now() });
            });
            const totals = calculateTotals(lines, data.settings || {}, order.type);
            return {
              ...s,
              data:{
                ...data,
                order:{ ...order, lines, totals, updatedAt: Date.now() }
              }
            };
          });
        }
      },
      'pos.order.line.modifiers':{
        on:['click'],
        gkeys:['pos:order:line:modifiers'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-line-id]');
          if(!btn) return;
          const lineId = btn.getAttribute('data-line-id');
          if(!lineId) return;
          const state = ctx.getState();
          const t = getTexts(state);
          const order = state.data.order || {};
          const line = (order.lines || []).find(entry=> entry.id === lineId);
          if(!line){
            UI.pushToast(ctx, { title:t.toast.order_nav_not_found, icon:'❓' });
            return;
          }
          if(line.locked || (order.isPersisted && order.lockLineEdits) || (line.status && line.status !== 'draft')){
            UI.pushToast(ctx, { title:t.toast.line_locked, icon:'🔒' });
            return;
          }
          const selectedAddOns = (Array.isArray(line.modifiers) ? line.modifiers : []).filter(mod=> mod.type === 'add_on').map(mod=> String(mod.id));
          const selectedRemovals = (Array.isArray(line.modifiers) ? line.modifiers : []).filter(mod=> mod.type === 'removal').map(mod=> String(mod.id));
          ctx.setState(s=>({
            ...s,
            ui:{
              ...(s.ui || {}),
              modals:{ ...(s.ui?.modals || {}), modifiers:true },
              lineModifiers:{ lineId, addOns:selectedAddOns, removals:selectedRemovals }
            }
          }));
        }
      },
      'pos.order.line.modifiers.toggle':{
        on:['click'],
        gkeys:['pos:order:line:modifiers.toggle'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-mod-id]');
          if(!btn) return;
          const lineId = btn.getAttribute('data-line-id');
          const modId = btn.getAttribute('data-mod-id');
          const modType = btn.getAttribute('data-mod-type');
          if(!lineId || !modId) return;
          ctx.setState(s=>{
            const current = s.ui?.lineModifiers || {};
            if(current.lineId !== lineId){
              return {
                ...s,
                ui:{
                  ...(s.ui || {}),
                  lineModifiers:{ lineId, addOns: modType === 'removal' ? [] : [modId], removals: modType === 'removal' ? [modId] : [] }
                }
              };
            }
            const key = modType === 'removal' ? 'removals' : 'addOns';
            const existing = new Set((current[key] || []).map(String));
            if(existing.has(modId)) existing.delete(modId); else existing.add(modId);
            return {
              ...s,
              ui:{
                ...(s.ui || {}),
                lineModifiers:{
                  ...current,
                  lineId,
                  [key]: Array.from(existing)
                }
              }
            };
          });
        }
      },
      'pos.order.line.modifiers.apply':{
        on:['click'],
        gkeys:['pos:order:line:modifiers.apply'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-line-id]');
          if(!btn) return;
          const lineId = btn.getAttribute('data-line-id');
          if(!lineId) return;
          const state = ctx.getState();
          const t = getTexts(state);
          const order = state.data.order || {};
          const line = (order.lines || []).find(entry=> entry.id === lineId);
          if(!line){
            UI.pushToast(ctx, { title:t.toast.order_nav_not_found, icon:'❓' });
            return;
          }
          if(line.locked || (order.isPersisted && order.lockLineEdits) || (line.status && line.status !== 'draft')){
            UI.pushToast(ctx, { title:t.toast.line_locked, icon:'🔒' });
            return;
          }
          const catalog = state.data.modifiers || { addOns:[], removals:[] };
          const draft = state.ui?.lineModifiers || {};
          const addOnIds = new Set((draft.addOns || []).map(String));
          const removalIds = new Set((draft.removals || []).map(String));
          const mapModifier = (entry)=> entry ? { id:String(entry.id), type: entry.type, label: entry.label, priceChange: Number(entry.priceChange || 0) } : null;
          const nextModifiers = [
            ...((catalog.addOns || []).filter(entry=> addOnIds.has(String(entry.id))).map(mapModifier)),
            ...((catalog.removals || []).filter(entry=> removalIds.has(String(entry.id))).map(mapModifier))
          ].filter(Boolean);
          const lines = (order.lines || []).map(item=>{
            if(item.id !== lineId) return item;
            return updateLineWithPricing(item, { modifiers: nextModifiers, updatedAt: Date.now() });
          });
          const totals = calculateTotals(lines, state.data.settings || {}, order.type);
          ctx.setState(s=>({
            ...s,
            data:{
              ...s.data,
              order:{ ...order, lines, totals, updatedAt: Date.now() }
            },
            ui:{
              ...(s.ui || {}),
              modals:{ ...(s.ui?.modals || {}), modifiers:false },
              lineModifiers:{ lineId:null, addOns:[], removals:[] }
            }
          }));
          UI.pushToast(ctx, { title:t.toast.line_modifiers_applied, icon:'✨' });
        }
      },
      'pos.order.line.modifiers.close':{
        on:['click'],
        gkeys:['pos:order:line:modifiers.close'],
        handler:(e,ctx)=>{
          ctx.setState(s=>({
            ...s,
            ui:{
              ...(s.ui || {}),
              modals:{ ...(s.ui?.modals || {}), modifiers:false },
              lineModifiers:{ lineId:null, addOns:[], removals:[] }
            }
          }));
        }
      },
      'pos.order.clear':{
        on:['click'],
        gkeys:['pos:order:clear'],
        handler:(e,ctx)=>{
          const t = getTexts(ctx.getState());
          if(!window.confirm(t.toast.confirm_clear)) return;
            ctx.setState(s=>{
              const data = s.data || {};
              const order = data.order || {};
              const typeConfig = getOrderTypeConfig(order.type || 'dine_in');
              const totals = calculateTotals([], data.settings || {}, order.type);
              return {
                ...s,
                data:{
                  ...data,
                order:{ ...order, lines:[], totals }
              }
            };
          });
          UI.pushToast(ctx, { title:t.toast.cart_cleared, icon:'🧺' });
        }
      },
      'pos.order.new':{
        on:['click'],
        gkeys:['pos:order:new'],
        handler: async (e,ctx)=>{
          const trigger = e.target.closest('[data-save-mode]');
          const mode = trigger?.getAttribute('data-save-mode') || 'save-only';
          const state = ctx.getState();
          const t = getTexts(state);
          const newId = await generateOrderId();
          ctx.setState(s=>{
            const data = s.data || {};
            const order = data.order || {};
            const type = order.type || 'dine_in';
            const typeConfig = getOrderTypeConfig(type);
            const totals = calculateTotals([], data.settings || {}, type);
            return {
              ...s,
              data:{
                ...data,
                order:{
                  ...order,
                  id: newId,
                  status:'open',
                  fulfillmentStage:'new',
                  paymentState:'unpaid',
                  type,
                  lines:[],
                  notes:[],
                  totals,
                  tableIds:[],
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  allowAdditions: !!typeConfig.allowsLineAdditions,
                  lockLineEdits:false,
                  isPersisted:false,
                  shiftId: data.shift?.current?.id || null,
                  posId: data.pos?.id || POS_INFO.id,
                  posLabel: data.pos?.label || POS_INFO.label,
                  posNumber: Number.isFinite(Number(data.pos?.number)) ? Number(data.pos.number) : POS_INFO.number,
                  payments:[],
                  customerId:null,
                  customerAddressId:null,
                  customerName:'',
                  customerPhone:'',
                  customerAddress:'',
                  customerAreaId:null
                },
                payments:{ ...(data.payments || {}), split:[] },
                tableLocks:(data.tableLocks || []).map(lock=> lock.orderId === order.id ? { ...lock, active:false } : lock)
              }
            };
          });
          UI.pushToast(ctx, { title:t.toast.new_order, icon:'🆕' });
        }
      },
      'pos.order.discount':{
        on:['click'],
        gkeys:['pos:order:discount'],
        handler:(e,ctx)=>{
          const t = getTexts(ctx.getState());
          UI.pushToast(ctx, { title:t.toast.discount_stub, icon:'💡' });
        }
      },
      'pos.order.table.remove':{
        on:['click'],
        gkeys:['pos:order:table:remove'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-table-id]');
          if(!btn) return;
          const tableId = btn.getAttribute('data-table-id');
          const state = ctx.getState();
          const t = getTexts(state);
          const order = state.data.order || {};
          if(!window.confirm(t.ui.table_confirm_release)) return;
          ctx.setState(s=>({
            ...s,
            data:{
              ...s.data,
              order:{ ...(s.data.order || {}), tableIds:(s.data.order?.tableIds || []).filter(id=> id !== tableId), updatedAt: Date.now() },
              tableLocks:(s.data.tableLocks || []).map(lock=> lock.tableId === tableId && lock.orderId === order.id ? { ...lock, active:false } : lock)
            }
          }));
          UI.pushToast(ctx, { title:t.toast.table_unlocked, icon:'🔓' });
        }
      },
      'pos.order.note':{
        on:['click'],
        gkeys:['pos:order:note'],
        handler:(e,ctx)=>{
          const state = ctx.getState();
          const t = getTexts(state);
          const note = window.prompt(t.toast.add_note);
          if(note == null) return;
          const trimmed = note.trim();
          if(!trimmed){
            return;
          }
          const now = Date.now();
          const user = state.data.user || {};
          const noteEntry = {
            id: `note-${now.toString(36)}`,
            message: trimmed,
            authorId: user.id || user.role || 'pos',
            authorName: user.name || '',
            createdAt: now
          };
          ctx.setState(s=>{
            const data = s.data || {};
            const order = data.order || {};
            const lines = (order.lines || []).map(line=> ({
              ...line,
              notes: Array.isArray(line.notes) ? line.notes.concat([noteEntry]) : line.notes ? [line.notes, noteEntry] : [noteEntry],
              updatedAt: now
            }));
            return {
              ...s,
              data:{
                ...data,
                order:{
                  ...order,
                  notes: Array.isArray(order.notes) ? order.notes.concat([noteEntry]) : [noteEntry],
                  lines,
                  updatedAt: now
                }
              }
            };
          });
          UI.pushToast(ctx, { title:t.toast.notes_updated, icon:'📝' });
        }
      },
      'pos.order.type':{
        on:['click'],
        gkeys:['pos:order:type'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-order-type]');
          if(!btn) return;
          const type = btn.getAttribute('data-order-type');
          const state = ctx.getState();
          const t = getTexts(state);
          ctx.setState(s=>{
            const data = s.data || {};
            const order = data.order || {};
            const lines = order.lines || [];
            let tablesState = data.tables || [];
            const nextOrder = { ...order, type };
            if(type !== 'dine_in' && order.tableId){
              const orderId = order.id;
              const tableId = order.tableId;
              tablesState = (tablesState || []).map(tbl=>{
                if(tbl.id !== tableId) return tbl;
                const nextSessions = (tbl.sessions || []).filter(id=> id !== orderId);
                const wasLockedByOrder = tbl.lockedBy === orderId;
                const nextStatus = nextSessions.length ? tbl.status : (tbl.status === 'occupied' ? 'available' : tbl.status);
                return {
                  ...tbl,
                  sessions: nextSessions,
                  locked: wasLockedByOrder ? false : tbl.locked,
                  lockedBy: wasLockedByOrder ? null : tbl.lockedBy,
                  status: nextStatus
                };
              });
              nextOrder.tableId = null;
              nextOrder.table = null;
            }
            if(type === 'dine_in' && !nextOrder.tableId){
              nextOrder.table = null;
            }
            nextOrder.totals = calculateTotals(lines, data.settings || {}, type);
            return {
              ...s,
              data:{
                ...data,
                tables: tablesState,
                order: nextOrder
              }
            };
          });
          UI.pushToast(ctx, { title:t.toast.order_type_changed, icon:'🔄' });
        }
      },
      'pos.order.save':{
        on:['click'],
        gkeys:['pos:order:save'],
        handler: async (e,ctx)=>{
          const state = ctx.getState();
          const t = getTexts(state);
          const trigger = e.target.closest('[data-save-mode]');
          const mode = trigger?.getAttribute('data-save-mode') || 'save-only';
          if(!posDB.available){
            UI.pushToast(ctx, { title:t.toast.indexeddb_missing, icon:'⚠️' });
            return;
          }
          const currentShift = state.data.shift?.current;
          if(!currentShift){
            UI.pushToast(ctx, { title:t.toast.shift_required, icon:'🔒' });
            ctx.setState(s=>({
              ...s,
              ui:{ ...(s.ui || {}), shift:{ ...(s.ui?.shift || {}), showPin:true, pin:'' } }
            }));
            return;
          }
          const order = state.data.order || {};
          const now = Date.now();
          const safeLines = (order.lines || []).map(line=>({
            ...line,
            locked:true,
            status: line.status || 'draft',
            notes: Array.isArray(line.notes) ? line.notes : (line.notes ? [line.notes] : []),
            updatedAt: now
          }));
          const totals = calculateTotals(safeLines, state.data.settings || {}, order.type || 'dine_in');
          const paymentSplit = Array.isArray(state.data.payments?.split) ? state.data.payments.split : [];
          const dueAmount = round(Number(totals?.due || 0));
          const paidAmount = round(paymentSplit.reduce((sum, entry)=> sum + (Number(entry.amount) || 0), 0));
          const outstanding = Math.max(0, round(dueAmount - paidAmount));
          if(mode === 'save-print' && outstanding > 0){
            ctx.setState(s=>({
              ...s,
              ui:{
                ...(s.ui || {}),
                modals:{ ...(s.ui?.modals || {}), payments:true },
                paymentDraft:{ ...(s.ui?.paymentDraft || {}), amount: outstanding ? String(outstanding) : '' }
              }
            }));
            UI.pushToast(ctx, { title:t.ui.payments, message:t.ui.balance_due, icon:'💳' });
            return;
          }
          const normalizedPayments = paymentSplit.map(entry=>({
            id: entry.id || `pm-${Math.random().toString(36).slice(2,8)}`,
            method: entry.method || entry.id || state.data.payments?.activeMethod || 'cash',
            amount: round(Number(entry.amount) || 0)
          })).filter(entry=> entry.amount > 0);
          const effectivePayments = normalizedPayments.length ? normalizedPayments : [{
            id:`pm-${now.toString(36)}`,
            method: state.data.payments?.activeMethod || 'cash',
            amount: round(Number(totals?.due || 0))
          }];
          const orderPayload = {
            ...order,
            lines: safeLines,
            notes: Array.isArray(order.notes) ? order.notes : (order.notes ? [order.notes] : []),
            updatedAt: now,
            savedAt: now,
            totals,
            payments: effectivePayments,
            shiftId: currentShift.id,
            posId: order.posId || POS_INFO.id,
            posLabel: order.posLabel || POS_INFO.label,
            posNumber: Number.isFinite(Number(order.posNumber)) ? Number(order.posNumber) : POS_INFO.number,
            isPersisted:true
          };
          try{
            await posDB.saveOrder(orderPayload);
            await posDB.markSync();
            const latestOrders = await posDB.listOrders({ onlyActive:true });
            const typeConfig = getOrderTypeConfig(order.type || 'dine_in');
            ctx.setState(s=>{
              const data = s.data || {};
              const history = Array.isArray(data.ordersHistory) ? data.ordersHistory.slice() : [];
              const historyIndex = history.findIndex(entry=> entry.id === orderPayload.id);
              const seq = historyIndex >= 0 ? (history[historyIndex].seq || historyIndex + 1) : history.length + 1;
              const historyEntry = { ...orderPayload, seq, payments: orderPayload.payments.map(pay=> ({ ...pay })) };
              if(historyIndex >= 0){
                history[historyIndex] = historyEntry;
              } else {
                history.push(historyEntry);
              }
              let nextShift = data.shift?.current ? { ...data.shift.current } : null;
              if(nextShift){
                const summary = summarizeShiftOrders(history, { ...nextShift, orders: Array.isArray(nextShift.orders) ? nextShift.orders.slice() : [] });
                nextShift = {
                  ...nextShift,
                  totalsByType: summary.totalsByType,
                  paymentsByMethod: summary.paymentsByMethod,
                  totalSales: summary.totalSales,
                  orders: summary.orders,
                  countsByType: summary.countsByType,
                  ordersCount: summary.ordersCount,
                  closingCash: round((nextShift.openingFloat || 0) + (summary.paymentsByMethod.cash || 0))
                };
              }
              return {
                ...s,
                data:{
                  ...data,
                  order:{
                    ...orderPayload,
                    allowAdditions: !!typeConfig.allowsLineAdditions,
                    lockLineEdits:true
                  },
                  ordersQueue: latestOrders,
                  ordersHistory: history,
                  payments:{ ...(data.payments || {}), split:[] },
                  shift:{ ...(data.shift || {}), current: nextShift },
                  status:{
                    ...data.status,
                    indexeddb:{ state:'online', lastSync: now }
                  }
                },
                ui:{
                  ...(s.ui || {}),
                  paymentDraft:{ ...(s.ui?.paymentDraft || {}), amount:'' }
                }
              };
            });
            await refreshPersistentSnapshot({ focusCurrent:true, syncOrders:true });
            if(mode === 'save-print'){
              ctx.setState(s=>({
                ...s,
                ui:{
                  ...(s.ui || {}),
                  modals:{ ...(s.ui?.modals || {}), print:true },
                  print:{ ...(s.ui?.print || {}), docType:s.data.print?.docType || 'customer', size:s.data.print?.size || 'thermal_80' }
                }
              }));
            }
            UI.pushToast(ctx, { title:t.toast.order_saved, icon:'💾' });
          } catch(error){
            UI.pushToast(ctx, { title:t.toast.indexeddb_error, message:String(error), icon:'🛑' });
            ctx.setState(s=>({
              ...s,
              data:{
                ...s.data,
                status:{
                  ...s.data.status,
                  indexeddb:{ state:'offline', lastSync: s.data.status?.indexeddb?.lastSync || null }
                }
              }
            }));
          }
        }
      },
      'pos.shift.open':{
        on:['click'],
        gkeys:['pos:shift:open'],
        handler:(e,ctx)=>{
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), shift:{ ...(s.ui?.shift || {}), showPin:true, pin:'', openingFloat: s.ui?.shift?.openingFloat ?? s.data?.shift?.config?.openingFloat ?? SHIFT_OPEN_FLOAT_DEFAULT } }
          }));
        }
      },
      'pos.shift.pin':{
        on:['input','change'],
        gkeys:['pos:shift:pin'],
        handler:(e,ctx)=>{
          const raw = e.target.value || '';
          const state = ctx.getState();
          const maxLength = state.data.shift?.config?.pinLength || SHIFT_PIN_LENGTH;
          const digitsOnly = raw.replace(/\D/g,'');
          const value = maxLength ? digitsOnly.slice(0, maxLength) : digitsOnly;
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), shift:{ ...(s.ui?.shift || {}), pin:value } }
          }));
        }
      },
      'pos.shift.opening-float':{
        on:['input','change'],
        gkeys:['pos:shift:opening-float'],
        handler:(e,ctx)=>{
          const value = parseFloat(e.target.value);
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), shift:{ ...(s.ui?.shift || {}), openingFloat: Number.isFinite(value) ? value : 0 } }
          }));
        }
      },
      'pos.shift.pin.confirm':{
        on:['click'],
        gkeys:['pos:shift:pin:confirm'],
        handler: async (e,ctx)=>{
          const state = ctx.getState();
          const t = getTexts(state);
          const config = state.data.shift?.config || {};
          const rawPin = String(state.ui?.shift?.pin || '').trim();
          const sanitizedPin = rawPin.replace(/\D/g,'');
          if(!sanitizedPin){
            UI.pushToast(ctx, { title:t.toast.shift_pin_invalid, icon:'⚠️' });
            return;
          }
          const employees = Array.isArray(state.data.employees) ? state.data.employees : [];
          const matchedEmployee = employees.find(emp=> emp.pin === sanitizedPin);
          if(!matchedEmployee){
            UI.pushToast(ctx, { title:t.toast.shift_pin_invalid, icon:'⚠️' });
            return;
          }
          const now = Date.now();
          const openingFloat = Number(state.ui?.shift?.openingFloat ?? config.openingFloat ?? 0);
          const totalsTemplate = ORDER_TYPES.reduce((acc,type)=>{ acc[type.id] = 0; return acc; }, {});
          const paymentsTemplate = (state.data.payments?.methods || PAYMENT_METHODS).reduce((acc, method)=>{
            acc[method.id] = 0;
            return acc;
          }, {});
          let persistedShift = null;
          try{
            const baseShiftInput = {
              id: `${POS_INFO.id}-S${now.toString(36).toUpperCase()}`,
              posId: POS_INFO.id,
              posLabel: POS_INFO.label,
              posNumber: POS_INFO.number,
              openedAt: now,
              openingFloat: round(openingFloat),
              totalsByType: totalsTemplate,
              paymentsByMethod: paymentsTemplate,
              totalSales:0,
              orders:[],
              countsByType:{},
              ordersCount:0,
              cashierId: matchedEmployee.id,
              cashierName: matchedEmployee.name,
              employeeId: matchedEmployee.id,
              cashierRole: matchedEmployee.role,
              status:'open',
              closingCash:null,
              isClosed:false
            };
            const validatedShift = SHIFT_TABLE.createRecord(baseShiftInput);
            persistedShift = posDB.available
              ? await posDB.openShiftRecord(validatedShift)
              : validatedShift;
          } catch(error){
            console.warn('[Mishkah][POS] shift open failed', error);
            UI.pushToast(ctx, { title:t.toast.indexeddb_error, icon:'🛑' });
            return;
          }
          if(!persistedShift){
            UI.pushToast(ctx, { title:t.toast.shift_pin_invalid, icon:'⚠️' });
            return;
          }
          const normalizedShift = SHIFT_TABLE.createRecord({
            ...persistedShift,
            totalsByType: persistedShift.totalsByType || {},
            paymentsByMethod: persistedShift.paymentsByMethod || {},
            countsByType: persistedShift.countsByType || {},
            orders: Array.isArray(persistedShift.orders) ? persistedShift.orders : []
          });
          ctx.setState(s=>({
            ...s,
            data:{
              ...s.data,
              user:{
                ...(s.data.user || {}),
                id: matchedEmployee.id,
                name: matchedEmployee.name,
                role: matchedEmployee.role,
                allowedDiscountRate: matchedEmployee.allowedDiscountRate ?? s.data.user?.allowedDiscountRate,
                shift:normalizedShift.id
              },
              order:{ ...(s.data.order || {}), shiftId:normalizedShift.id },
              shift:{ ...(s.data.shift || {}), current:normalizedShift }
            },
            ui:{ ...(s.ui || {}), shift:{ ...(s.ui?.shift || {}), showPin:false, pin:'', showSummary:false, viewShiftId:normalizedShift.id } }
          }));
          await refreshPersistentSnapshot({ focusCurrent:true });
          UI.pushToast(ctx, { title:t.toast.shift_open_success, icon:'✅' });
        }
      },
      'pos.shift.pin.cancel':{
        on:['click'],
        gkeys:['pos:shift:pin:cancel'],
        handler:(e,ctx)=>{
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), shift:{ ...(s.ui?.shift || {}), showPin:false, pin:'' } }
          }));
        }
      },
      'pos.shift.summary':{
        on:['click'],
        gkeys:['pos:shift:summary'],
        handler: async (e,ctx)=>{
          await refreshPersistentSnapshot({ focusCurrent:true, syncOrders:true });
          const state = ctx.getState();
          const current = state.data.shift?.current;
          const history = state.data.shift?.history || [];
          const defaultId = current?.id || (history.length ? history[history.length-1].id : null);
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), shift:{ ...(s.ui?.shift || {}), showSummary:true, viewShiftId: s.ui?.shift?.viewShiftId || defaultId, activeTab:'summary' } }
          }));
        }
      },
      'pos.shift.summary.close':{
        on:['click'],
        gkeys:['pos:shift:summary:close'],
        handler:(e,ctx)=>{
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), shift:{ ...(s.ui?.shift || {}), showSummary:false } }
          }));
        }
      },
      'pos.shift.view':{
        on:['click'],
        gkeys:['pos:shift:view'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-shift-id]');
          if(!btn) return;
          const shiftId = btn.getAttribute('data-shift-id');
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), shift:{ ...(s.ui?.shift || {}), viewShiftId:shiftId } }
          }));
        }
      },
      'pos.shift.close':{
        on:['click'],
        gkeys:['pos:shift:close'],
        handler: async (e,ctx)=>{
          const state = ctx.getState();
          const t = getTexts(state);
          const currentShift = state.data.shift?.current;
          if(!currentShift){
            ctx.setState(s=>({
              ...s,
              ui:{ ...(s.ui || {}), shift:{ ...(s.ui?.shift || {}), showSummary:false } }
            }));
            return;
          }
          const sanitizedCurrent = SHIFT_TABLE.createRecord({
            ...currentShift,
            totalsByType: currentShift.totalsByType || {},
            paymentsByMethod: currentShift.paymentsByMethod || {},
            countsByType: currentShift.countsByType || {},
            orders: Array.isArray(currentShift.orders) ? currentShift.orders : []
          });
          const summary = summarizeShiftOrders(state.data.ordersHistory, sanitizedCurrent);
          const paymentsByMethod = summary.paymentsByMethod || {};
          const closingCash = currentShift.closingCash != null ? round(currentShift.closingCash) : round((sanitizedCurrent.openingFloat || 0) + (paymentsByMethod.cash || 0));
          const baseClosed = {
            ...sanitizedCurrent,
            totalsByType: summary.totalsByType,
            paymentsByMethod,
            orders: summary.orders,
            countsByType: summary.countsByType,
            ordersCount: summary.ordersCount,
            totalSales: summary.totalSales,
            closingCash,
            closedAt: Date.now(),
            status:'closed',
            isClosed:true
          };
          let closedShift = baseClosed;
          if(posDB.available){
            try{
              closedShift = await posDB.closeShiftRecord(currentShift.id, baseClosed);
            } catch(error){
              console.warn('[Mishkah][POS] shift close failed', error);
              UI.pushToast(ctx, { title:t.toast.indexeddb_error, icon:'🛑' });
              return;
            }
          }
          const normalizedClosed = SHIFT_TABLE.createRecord({
            ...closedShift,
            totalsByType: closedShift.totalsByType || summary.totalsByType,
            paymentsByMethod: closedShift.paymentsByMethod || paymentsByMethod,
            countsByType: closedShift.countsByType || summary.countsByType,
            orders: Array.isArray(closedShift.orders) ? closedShift.orders : summary.orders
          });
          ctx.setState(s=>({
            ...s,
            data:{
              ...s.data,
              user:{ ...(s.data.user || {}), shift:'—' },
              order:{ ...(s.data.order || {}), shiftId:null },
              shift:{
                ...(s.data.shift || {}),
                current:null,
                history:[ ...(s.data.shift?.history || []), normalizedClosed ]
              }
            },
            ui:{ ...(s.ui || {}), shift:{ ...(s.ui?.shift || {}), showSummary:true, viewShiftId:normalizedClosed.id } }
          }));
          await refreshPersistentSnapshot({ focusCurrent:false, syncOrders:true });
          UI.pushToast(ctx, { title:t.toast.shift_close_success, icon:'✅' });
        }
      },
      'pos.customer.open':{
        on:['click'],
        gkeys:['pos:customer:open'],
        handler:(e,ctx)=>{
          ctx.setState(s=>{
            const current = s.ui?.customer || {};
            const order = s.data.order || {};
            const customers = Array.isArray(s.data.customers) ? s.data.customers : [];
            const fallbackCustomerId = current.selectedCustomerId || order.customerId || customers[0]?.id || null;
            const fallbackCustomer = findCustomer(customers, fallbackCustomerId);
            const fallbackAddressId = current.selectedAddressId || order.customerAddressId || fallbackCustomer?.addresses?.[0]?.id || null;
            return {
              ...s,
              ui:{
                ...(s.ui || {}),
                customer:{
                  ...current,
                  open:true,
                  mode:'search',
                  keypad:'',
                  selectedCustomerId: fallbackCustomerId,
                  selectedAddressId: fallbackAddressId
                }
              }
            };
          });
        }
      },
      'pos.customer.close':{
        on:['click'],
        gkeys:['pos:customer:close'],
        handler:(e,ctx)=>{
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), customer:{ ...(s.ui?.customer || {}), open:false } }
          }));
        }
      },
      'pos.customer.mode':{
        on:['click'],
        gkeys:['pos:customer:mode'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-mode]');
          if(!btn) return;
          const mode = btn.getAttribute('data-mode') || 'search';
          ctx.setState(s=>{
            const current = s.ui?.customer || {};
            let nextForm = current.form || createEmptyCustomerForm();
            if(mode === 'create' && (!nextForm || typeof nextForm !== 'object')){
              nextForm = createEmptyCustomerForm();
            }
            return {
              ...s,
              ui:{
                ...(s.ui || {}),
                customer:{
                  ...current,
                  mode,
                  keypad:'',
                  form: nextForm
                }
              }
            };
          });
        }
      },
      'pos.customer.search':{
        on:['input','change'],
        gkeys:['pos:customer:search'],
        handler:(e,ctx)=>{
          const value = e.target.value || '';
          ctx.setState(s=>{
            const current = s.ui?.customer || {};
            const customers = Array.isArray(s.data.customers) ? s.data.customers : [];
            const normalized = value.trim().toLowerCase();
            let selectedId = current.selectedCustomerId || s.data.order?.customerId || null;
            if(normalized){
              const matches = customers.filter(customer=>{
                const name = (customer.name || '').toLowerCase();
                const phoneMatch = (customer.phones || []).some(phone=> String(phone).includes(normalized));
                return name.includes(normalized) || phoneMatch;
              }).map(customer=> customer.id);
              if(matches.length){
                if(!matches.includes(selectedId)){
                  selectedId = matches[0];
                }
              } else {
                selectedId = null;
              }
            }
            let selectedAddressId = current.selectedAddressId;
            if(selectedId){
              const selectedCustomer = findCustomer(customers, selectedId);
              if(!selectedCustomer){
                selectedAddressId = null;
              } else if(!selectedAddressId || !(selectedCustomer.addresses || []).some(address=> address.id === selectedAddressId)){
                selectedAddressId = selectedCustomer.addresses?.[0]?.id || null;
              }
            } else {
              selectedAddressId = null;
            }
            return {
              ...s,
              ui:{
                ...(s.ui || {}),
                customer:{
                  ...current,
                  search:value,
                  selectedCustomerId:selectedId,
                  selectedAddressId
                }
              }
            };
          });
        }
      },
      'pos.customer.keypad':{
        on:['input','change'],
        gkeys:['pos:customer:keypad'],
        handler:(e,ctx)=>{
          const digits = (e.target.value || '').replace(/[^0-9+]/g,'');
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), customer:{ ...(s.ui?.customer || {}), keypad:digits } }
          }));
        }
      },
      'pos.customer.keypad.confirm':{
        on:['click'],
        gkeys:['pos:customer:keypad:confirm'],
        handler:(e,ctx)=>{
          ctx.setState(s=>{
            const current = s.ui?.customer || {};
            const keypad = (current.keypad || '').trim();
            const customers = Array.isArray(s.data.customers) ? s.data.customers : [];
            let selectedId = current.selectedCustomerId || s.data.order?.customerId || null;
            if(keypad){
              const matches = customers.filter(customer=>{
                const name = (customer.name || '').toLowerCase();
                const phoneMatch = (customer.phones || []).some(phone=> String(phone).includes(keypad));
                return name.includes(keypad.toLowerCase()) || phoneMatch;
              }).map(customer=> customer.id);
              if(matches.length){
                if(!matches.includes(selectedId)){
                  selectedId = matches[0];
                }
              } else {
                selectedId = null;
              }
            }
            let selectedAddressId = current.selectedAddressId;
            if(selectedId){
              const selectedCustomer = findCustomer(customers, selectedId);
              if(!selectedCustomer){
                selectedAddressId = null;
              } else if(!selectedAddressId || !(selectedCustomer.addresses || []).some(address=> address.id === selectedAddressId)){
                selectedAddressId = selectedCustomer.addresses?.[0]?.id || null;
              }
            } else {
              selectedAddressId = null;
            }
            return {
              ...s,
              ui:{
                ...(s.ui || {}),
                customer:{
                  ...current,
                  search: keypad,
                  keypad:'',
                  selectedCustomerId:selectedId,
                  selectedAddressId
                }
              }
            };
          });
        }
      },
      'pos.customer.select':{
        on:['click'],
        gkeys:['pos:customer:select'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-customer-id]');
          if(!btn) return;
          const id = btn.getAttribute('data-customer-id');
          ctx.setState(s=>{
            const customers = s.data.customers || [];
            const customer = findCustomer(customers, id);
            const firstAddress = customer?.addresses?.[0]?.id || null;
            return {
              ...s,
              ui:{
                ...(s.ui || {}),
                customer:{
                  ...(s.ui?.customer || {}),
                  selectedCustomerId:id,
                  selectedAddressId: firstAddress || s.ui?.customer?.selectedAddressId || null
                }
              }
            };
          });
        }
      },
      'pos.customer.address.select':{
        on:['click'],
        gkeys:['pos:customer:address:select'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-address-id]');
          if(!btn) return;
          const id = btn.getAttribute('data-address-id');
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), customer:{ ...(s.ui?.customer || {}), selectedAddressId:id } }
          }));
        }
      },
      'pos.customer.attach':{
        on:['click'],
        gkeys:['pos:customer:attach'],
        handler:(e,ctx)=>{
          const state = ctx.getState();
          const t = getTexts(state);
          const customers = state.data.customers || [];
          const customerId = state.ui?.customer?.selectedCustomerId || state.data.order?.customerId;
          const customer = findCustomer(customers, customerId);
          if(!customer){
            UI.pushToast(ctx, { title:t.toast.customer_missing_selection, icon:'⚠️' });
            return;
          }
          const addressId = state.ui?.customer?.selectedAddressId || state.data.order?.customerAddressId || null;
          const address = addressId ? findCustomerAddress(customer, addressId) : null;
          if(state.data.order?.type === 'delivery' && !address){
            UI.pushToast(ctx, { title:t.toast.customer_missing_address, icon:'⚠️' });
            return;
          }
          ctx.setState(s=>{
            const order = s.data.order || {};
            return {
              ...s,
              data:{
                ...s.data,
                order:{
                  ...order,
                  customerId: customer.id,
                  customerAddressId: address?.id || null,
                  customerName: customer.name,
                  customerPhone: customer.phones?.[0] || '',
                  customerAddress: address?.line || address?.title || '',
                  customerAreaId: address?.areaId || null
                }
              },
              ui:{
                ...(s.ui || {}),
                customer:{ ...(s.ui?.customer || {}), open:false }
              }
            };
          });
          UI.pushToast(ctx, { title:t.toast.customer_attach_success, icon:'✅' });
        }
      },
      'pos.customer.edit':{
        on:['click'],
        gkeys:['pos:customer:edit'],
        handler:(e,ctx)=>{
          const state = ctx.getState();
          const customers = state.data.customers || [];
          const customerId = state.ui?.customer?.selectedCustomerId || state.data.order?.customerId;
          const customer = findCustomer(customers, customerId);
          if(!customer) return;
          ctx.setState(s=>({
            ...s,
            ui:{
              ...(s.ui || {}),
              customer:{
                ...(s.ui?.customer || {}),
                mode:'create',
                keypad:'',
                form:{
                  id: customer.id,
                  name: customer.name,
                  phones: (customer.phones || []).slice(),
                  addresses: (customer.addresses || []).map(address=> ({ ...address }))
                }
              }
            }
          }));
        }
      },
      'pos.customer.form.reset':{
        on:['click'],
        gkeys:['pos:customer:form:reset'],
        handler:(e,ctx)=>{
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), customer:{ ...(s.ui?.customer || {}), form:createEmptyCustomerForm(), keypad:'' } }
          }));
        }
      },
      'pos.customer.form.name':{
        on:['input','change'],
        gkeys:['pos:customer:form:name'],
        handler:(e,ctx)=>{
          const value = e.target.value || '';
          ctx.setState(s=>{
            const current = s.ui?.customer || {};
            const form = current.form ? { ...current.form } : createEmptyCustomerForm();
            form.name = value;
            return {
              ...s,
              ui:{ ...(s.ui || {}), customer:{ ...current, form } }
            };
          });
        }
      },
      'pos.customer.form.phone':{
        on:['input','change'],
        gkeys:['pos:customer:form:phone'],
        handler:(e,ctx)=>{
          const index = Number(e.target.getAttribute('data-index')||0);
          const value = (e.target.value || '').replace(/[^0-9+]/g,'');
          ctx.setState(s=>{
            const current = s.ui?.customer || {};
            const form = current.form ? { ...current.form } : createEmptyCustomerForm();
            const phones = Array.isArray(form.phones) ? form.phones.slice() : [];
            while(phones.length <= index) phones.push('');
            phones[index] = value;
            form.phones = phones;
            return {
              ...s,
              ui:{ ...(s.ui || {}), customer:{ ...current, form } }
            };
          });
        }
      },
      'pos.customer.form.phone.add':{
        on:['click'],
        gkeys:['pos:customer:form:phone:add'],
        handler:(e,ctx)=>{
          ctx.setState(s=>{
            const current = s.ui?.customer || {};
            const form = current.form ? { ...current.form } : createEmptyCustomerForm();
            const phones = Array.isArray(form.phones) ? form.phones.slice() : [];
            phones.push('');
            form.phones = phones;
            return {
              ...s,
              ui:{ ...(s.ui || {}), customer:{ ...current, form } }
            };
          });
        }
      },
      'pos.customer.form.phone.remove':{
        on:['click'],
        gkeys:['pos:customer:form:phone:remove'],
        handler:(e,ctx)=>{
          const index = Number(e.target.getAttribute('data-index')||0);
          ctx.setState(s=>{
            const current = s.ui?.customer || {};
            const form = current.form ? { ...current.form } : createEmptyCustomerForm();
            let phones = Array.isArray(form.phones) ? form.phones.slice() : [];
            if(phones.length <= 1) return s;
            phones = phones.filter((_,i)=> i !== index);
            form.phones = phones.length ? phones : [''];
            return {
              ...s,
              ui:{ ...(s.ui || {}), customer:{ ...current, form } }
            };
          });
        }
      },
      'pos.customer.form.address.add':{
        on:['click'],
        gkeys:['pos:customer:form:address:add'],
        handler:(e,ctx)=>{
          ctx.setState(s=>{
            const current = s.ui?.customer || {};
            const form = current.form ? { ...current.form } : createEmptyCustomerForm();
            const addresses = Array.isArray(form.addresses) ? form.addresses.slice() : [];
            addresses.push({ id:null, title:'', areaId: CAIRO_DISTRICTS[0]?.id || '', line:'', notes:'' });
            form.addresses = addresses;
            return {
              ...s,
              ui:{ ...(s.ui || {}), customer:{ ...current, form } }
            };
          });
        }
      },
      'pos.customer.form.address.remove':{
        on:['click'],
        gkeys:['pos:customer:form:address:remove'],
        handler:(e,ctx)=>{
          const index = Number(e.target.getAttribute('data-index')||0);
          ctx.setState(s=>{
            const current = s.ui?.customer || {};
            const form = current.form ? { ...current.form } : createEmptyCustomerForm();
            let addresses = Array.isArray(form.addresses) ? form.addresses.slice() : [];
            if(addresses.length <= 1) return s;
            addresses = addresses.filter((_,i)=> i !== index);
            form.addresses = addresses.length ? addresses : [{ id:null, title:'', areaId: CAIRO_DISTRICTS[0]?.id || '', line:'', notes:'' }];
            return {
              ...s,
              ui:{ ...(s.ui || {}), customer:{ ...current, form } }
            };
          });
        }
      },
      'pos.customer.form.address:title':{
        on:['input','change'],
        gkeys:['pos:customer:form:address:title'],
        handler:(e,ctx)=>{
          const index = Number(e.target.getAttribute('data-index')||0);
          const value = e.target.value || '';
          ctx.setState(s=>{
            const current = s.ui?.customer || {};
            const form = current.form ? { ...current.form } : createEmptyCustomerForm();
            const addresses = Array.isArray(form.addresses) ? form.addresses.slice() : [];
            while(addresses.length <= index) addresses.push({ id:null, title:'', areaId: CAIRO_DISTRICTS[0]?.id || '', line:'', notes:'' });
            addresses[index] = { ...(addresses[index] || {}), title:value };
            form.addresses = addresses;
            return {
              ...s,
              ui:{ ...(s.ui || {}), customer:{ ...current, form } }
            };
          });
        }
      },
      'pos.customer.form.address:area':{
        on:['change'],
        gkeys:['pos:customer:form:address:area'],
        handler:(e,ctx)=>{
          const index = Number(e.target.getAttribute('data-index')||0);
          const value = e.target.value || '';
          ctx.setState(s=>{
            const current = s.ui?.customer || {};
            const form = current.form ? { ...current.form } : createEmptyCustomerForm();
            const addresses = Array.isArray(form.addresses) ? form.addresses.slice() : [];
            while(addresses.length <= index) addresses.push({ id:null, title:'', areaId: CAIRO_DISTRICTS[0]?.id || '', line:'', notes:'' });
            addresses[index] = { ...(addresses[index] || {}), areaId:value };
            form.addresses = addresses;
            return {
              ...s,
              ui:{ ...(s.ui || {}), customer:{ ...current, form } }
            };
          });
        }
      },
      'pos.customer.form.address:line':{
        on:['input','change'],
        gkeys:['pos:customer:form:address:line'],
        handler:(e,ctx)=>{
          const index = Number(e.target.getAttribute('data-index')||0);
          const value = e.target.value || '';
          ctx.setState(s=>{
            const current = s.ui?.customer || {};
            const form = current.form ? { ...current.form } : createEmptyCustomerForm();
            const addresses = Array.isArray(form.addresses) ? form.addresses.slice() : [];
            while(addresses.length <= index) addresses.push({ id:null, title:'', areaId: CAIRO_DISTRICTS[0]?.id || '', line:'', notes:'' });
            addresses[index] = { ...(addresses[index] || {}), line:value };
            form.addresses = addresses;
            return {
              ...s,
              ui:{ ...(s.ui || {}), customer:{ ...current, form } }
            };
          });
        }
      },
      'pos.customer.form.address:notes':{
        on:['input','change'],
        gkeys:['pos:customer:form:address:notes'],
        handler:(e,ctx)=>{
          const index = Number(e.target.getAttribute('data-index')||0);
          const value = e.target.value || '';
          ctx.setState(s=>{
            const current = s.ui?.customer || {};
            const form = current.form ? { ...current.form } : createEmptyCustomerForm();
            const addresses = Array.isArray(form.addresses) ? form.addresses.slice() : [];
            while(addresses.length <= index) addresses.push({ id:null, title:'', areaId: CAIRO_DISTRICTS[0]?.id || '', line:'', notes:'' });
            addresses[index] = { ...(addresses[index] || {}), notes:value };
            form.addresses = addresses;
            return {
              ...s,
              ui:{ ...(s.ui || {}), customer:{ ...current, form } }
            };
          });
        }
      },
      'pos.customer.form.keypad.confirm':{
        on:['click'],
        gkeys:['pos:customer:form:keypad:confirm'],
        handler:(e,ctx)=>{
          ctx.setState(s=>{
            const current = s.ui?.customer || {};
            const digits = (current.keypad || '').trim();
            if(!digits) return s;
            const form = current.form ? { ...current.form } : createEmptyCustomerForm();
            const phones = Array.isArray(form.phones) ? form.phones.slice() : [];
            if(phones.length && !phones[phones.length - 1]){
              phones[phones.length - 1] = digits;
            } else {
              phones.push(digits);
            }
            form.phones = phones;
            return {
              ...s,
              ui:{ ...(s.ui || {}), customer:{ ...current, form, keypad:'' } }
            };
          });
        }
      },
      'pos.customer.save':{
        on:['click'],
        gkeys:['pos:customer:save'],
        handler:(e,ctx)=>{
          const state = ctx.getState();
          const t = getTexts(state);
          const form = state.ui?.customer?.form || createEmptyCustomerForm();
          const name = (form.name || '').trim();
          const phones = (form.phones || []).map(phone=> String(phone || '').trim()).filter(Boolean);
          if(!name || !phones.length){
            UI.pushToast(ctx, { title:t.toast.customer_form_invalid, icon:'⚠️' });
            return;
          }
          const addresses = (form.addresses || []).map((address, idx)=>({
            id: address.id || `ADDR-${Date.now().toString(36)}-${idx}`,
            title: address.title || '',
            areaId: address.areaId || CAIRO_DISTRICTS[0]?.id || '',
            line: address.line || '',
            notes: address.notes || ''
          }));
          const customerId = form.id || `CUST-${Date.now().toString(36).toUpperCase()}`;
          ctx.setState(s=>{
            const customers = Array.isArray(s.data.customers) ? s.data.customers.slice() : [];
            const index = customers.findIndex(customer=> customer.id === customerId);
            const payload = { id: customerId, name, phones, addresses };
            if(index >= 0){
              customers[index] = payload;
            } else {
              customers.push(payload);
            }
            const currentOrder = s.data.order || {};
            let nextOrder = currentOrder;
            if(currentOrder.customerId && currentOrder.customerId === payload.id){
              const attachedAddress = payload.addresses.find(address=> address.id === currentOrder.customerAddressId) || payload.addresses[0] || null;
              nextOrder = {
                ...currentOrder,
                customerName: payload.name,
                customerPhone: payload.phones[0] || '',
                customerAddressId: attachedAddress?.id || null,
                customerAddress: attachedAddress?.line || attachedAddress?.title || '',
                customerAreaId: attachedAddress?.areaId || null
              };
            }
            return {
              ...s,
              data:{ ...(s.data || {}), customers, order: nextOrder },
              ui:{
                ...(s.ui || {}),
                customer:{
                  ...(s.ui?.customer || {}),
                  mode:'search',
                  form:createEmptyCustomerForm(),
                  keypad:'',
                  selectedCustomerId: payload.id,
                  selectedAddressId: nextOrder.customerAddressId || payload.addresses?.[0]?.id || null
                }
              }
            };
          });
          UI.pushToast(ctx, { title:t.toast.customer_saved, icon:'💾' });
        }
      },
      'pos.order.nav.prev':{
        on:['click'],
        gkeys:['pos:order:nav:prev'],
        handler:(e,ctx)=>{
          const state = ctx.getState();
          const history = state.data.ordersHistory || [];
          if(!history.length) return;
          const currentId = state.data.order?.id;
          const index = history.findIndex(entry=> entry.id === currentId);
          if(index <= 0) return;
          const target = history[index - 1];
          if(target) activateOrder(ctx, target, { hideOrderNavPad:true, resetOrderNavValue:true });
        }
      },
      'pos.order.nav.next':{
        on:['click'],
        gkeys:['pos:order:nav:next'],
        handler:(e,ctx)=>{
          const state = ctx.getState();
          const history = state.data.ordersHistory || [];
          if(!history.length) return;
          const currentId = state.data.order?.id;
          const index = history.findIndex(entry=> entry.id === currentId);
          if(index < 0 || index >= history.length - 1) return;
          const target = history[index + 1];
          if(target) activateOrder(ctx, target, { hideOrderNavPad:true, resetOrderNavValue:true });
        }
      },
      'pos.order.nav.pad':{
        on:['click'],
        gkeys:['pos:order:nav:pad'],
        handler:(e,ctx)=>{
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), orderNav:{ ...(s.ui?.orderNav || {}), showPad:true } }
          }));
        }
      },
      'pos.order.nav.close':{
        on:['click'],
        gkeys:['pos:order:nav:close'],
        handler:(e,ctx)=>{
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), orderNav:{ ...(s.ui?.orderNav || {}), showPad:false } }
          }));
        }
      },
      'pos.order.nav.input':{
        on:['input','change'],
        gkeys:['pos:order:nav:input'],
        handler:(e,ctx)=>{
          const value = e.target.value || '';
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), orderNav:{ ...(s.ui?.orderNav || {}), value } }
          }));
        }
      },
      'pos.order.nav.confirm':{
        on:['click'],
        gkeys:['pos:order:nav:confirm'],
        handler:(e,ctx)=>{
          const state = ctx.getState();
          const t = getTexts(state);
          const value = (state.ui?.orderNav?.value || '').trim();
          const history = state.data.ordersHistory || [];
          if(!value){
            ctx.setState(s=>({
              ...s,
              ui:{ ...(s.ui || {}), orderNav:{ ...(s.ui?.orderNav || {}), showPad:false } }
            }));
            return;
          }
          const normalized = value.toLowerCase();
          let target = history.find(entry=> String(entry.id).toLowerCase() === normalized);
          if(!target && value.includes('-')){
            const lastSegment = value.split('-').pop();
            const numericPart = parseInt(lastSegment, 10);
            if(!Number.isNaN(numericPart)){
              target = history.find(entry=>{
                const parts = String(entry.id).split('-');
                const entrySegment = parts[parts.length-1];
                const entryNumber = parseInt(entrySegment, 10);
                return entryNumber === numericPart;
              });
            }
          }
          if(!target){
            const seq = parseInt(value, 10);
            if(!Number.isNaN(seq)){
              target = history.find(entry=> (entry.seq || history.indexOf(entry) + 1) === seq);
            }
          }
          if(!target){
            UI.pushToast(ctx, { title:t.toast.order_nav_not_found, icon:'❓' });
            return;
          }
          activateOrder(ctx, target, { hideOrderNavPad:true, resetOrderNavValue:true });
        }
      },
      'pos.order.print':{
        on:['click'],
        gkeys:['pos:order:print'],
        handler:(e,ctx)=>{
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), modals:{ ...(s.ui?.modals || {}), print:true }, print:{ ...(s.ui?.print || {}), docType:s.data.print?.docType || 'customer', size:s.data.print?.size || 'thermal_80' } }
          }));
        }
      },
      'pos.order.export':{
        on:['click'],
        gkeys:['pos:order:export'],
        handler:(e,ctx)=>{
          const state = ctx.getState();
          const t = getTexts(state);
          const docType = state.ui?.print?.docType || state.data.print?.docType || 'customer';
          const profile = state.data.print?.profiles?.[docType] || {};
          const size = state.ui?.print?.size || profile.size || state.data.print?.size || 'thermal_80';
          if(typeof window === 'undefined'){
            UI.pushToast(ctx, { title:t.toast.pdf_exported, icon:'📄' });
            return;
          }
          const html = renderPrintableHTML(state, docType, size);
          const popup = window.open('', '_blank', 'width=900,height=1200');
          if(!popup){
            UI.pushToast(ctx, { title:t.toast.browser_popup_blocked, icon:'⚠️' });
            return;
          }
          try{
            popup.document.open();
            popup.document.write(html);
            popup.document.close();
            if(typeof popup.focus === 'function') popup.focus();
          } catch(err){
            console.error('PDF export failed', err);
          }
          UI.pushToast(ctx, { title:t.toast.pdf_exported, icon:'📄' });
        }
      },
      'pos.print.size':{
        on:['click'],
        gkeys:['pos:print:size'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-print-size]');
          if(!btn) return;
          const size = btn.getAttribute('data-print-size') || 'thermal_80';
          const state = ctx.getState();
          const docType = state.ui?.print?.docType || state.data.print?.docType || 'customer';
          ctx.setState(s=>({
            ...s,
            data:{
              ...s.data,
              print:(()=>{
                const current = { ...(s.data.print || {}) };
                current.size = size;
                const profiles = { ...(current.profiles || {}) };
                const profile = { ...(profiles[docType] || {}) };
                profile.size = size;
                profiles[docType] = profile;
                current.profiles = profiles;
                return current;
              })()
            },
            ui:{ ...(s.ui || {}), print:{ ...(s.ui?.print || {}), size } }
          }));
          const t = getTexts(ctx.getState());
          UI.pushToast(ctx, { title:t.toast.print_size_switched, icon:'🖨️' });
        }
      },
      'pos.print.doc':{
        on:['click'],
        gkeys:['pos:print:doc'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-doc-type]');
          if(!btn) return;
          const doc = btn.getAttribute('data-doc-type') || 'customer';
          ctx.setState(s=>({
            ...s,
            data:{ ...(s.data || {}), print:{ ...(s.data.print || {}), docType:doc } },
            ui:{ ...(s.ui || {}), print:{ ...(s.ui?.print || {}), docType:doc } }
          }));
        }
      },
      'pos.print.printer-select':{
        on:['change'],
        gkeys:['pos:print:printer-select'],
        handler:(e,ctx)=>{
          const select = e.target.closest('select');
          if(!select) return;
          const field = select.getAttribute('data-print-field');
          if(!field) return;
          const value = select.value || '';
          const state = ctx.getState();
          const docType = state.ui?.print?.docType || state.data.print?.docType || 'customer';
          ctx.setState(s=>{
            const printState = { ...(s.data.print || {}) };
            const profiles = { ...(printState.profiles || {}) };
            const profile = { ...(profiles[docType] || {}) };
            profile[field] = value;
            profiles[docType] = profile;
            printState.profiles = profiles;
            return {
              ...s,
              data:{ ...(s.data || {}), print: printState }
            };
          });
        }
      },
      'pos.print.advanced-toggle':{
        on:['click'],
        gkeys:['pos:print:advanced-toggle'],
        handler:(e,ctx)=>{
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), print:{ ...(s.ui?.print || {}), showAdvanced: !s.ui?.print?.showAdvanced } }
          }));
        }
      },
      'pos.print.manage-toggle':{
        on:['click'],
        gkeys:['pos:print:manage-toggle'],
        handler:(e,ctx)=>{
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), print:{ ...(s.ui?.print || {}), managePrinters: !s.ui?.print?.managePrinters } }
          }));
        }
      },
      'pos.print.preview-expand':{
        on:['click'],
        gkeys:['pos:print:preview-expand'],
        handler:(e,ctx)=>{
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), print:{ ...(s.ui?.print || {}), previewExpanded: !s.ui?.print?.previewExpanded } }
          }));
        }
      },
      'pos.print.manage-input':{
        on:['input','change'],
        gkeys:['pos:print:manage-input'],
        handler:(e,ctx)=>{
          const value = e.target.value || '';
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), print:{ ...(s.ui?.print || {}), newPrinterName:value } }
          }));
        }
      },
      'pos.print.manage-add':{
        on:['click'],
        gkeys:['pos:print:manage-add'],
        handler:(e,ctx)=>{
          const state = ctx.getState();
          const t = getTexts(state);
          const rawName = (state.ui?.print?.newPrinterName || '').trim();
          if(!rawName){
            UI.pushToast(ctx, { title:t.toast.printer_name_required, icon:'⚠️' });
            return;
          }
          const existing = Array.isArray(state.data.print?.availablePrinters) ? state.data.print.availablePrinters : [];
          const normalized = rawName.toLowerCase();
          if(existing.some(item=> (item.label || item.id || '').toLowerCase() === normalized)){
            UI.pushToast(ctx, { title:t.toast.printer_exists, icon:'ℹ️' });
            return;
          }
          const sanitizedIdBase = rawName.replace(/\s+/g, '-').replace(/[^\w\-]/g, '');
          let id = sanitizedIdBase ? sanitizedIdBase.slice(0, 64) : `printer-${Date.now()}`;
          if(existing.some(item=> item.id === id)){
            id = `${id}-${Date.now()}`;
          }
          ctx.setState(s=>{
            const printers = Array.isArray(s.data.print?.availablePrinters) ? s.data.print.availablePrinters.slice() : [];
            printers.push({ id, label: rawName });
            const printState = { ...(s.data.print || {}), availablePrinters: printers };
            return {
              ...s,
              data:{ ...(s.data || {}), print: printState },
              ui:{ ...(s.ui || {}), print:{ ...(s.ui?.print || {}), newPrinterName:'' } }
            };
          });
          UI.pushToast(ctx, { title:t.toast.printer_added, icon:'🖨️' });
        }
      },
      'pos.print.manage-remove':{
        on:['click'],
        gkeys:['pos:print:manage-remove'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-printer-id]');
          if(!btn) return;
          const printerId = btn.getAttribute('data-printer-id');
          ctx.setState(s=>{
            const current = { ...(s.data.print || {}) };
            const printers = Array.isArray(current.availablePrinters) ? current.availablePrinters.filter(item=> item.id !== printerId) : [];
            const profiles = { ...(current.profiles || {}) };
            Object.keys(profiles).forEach(key=>{
              const profile = { ...(profiles[key] || {}) };
              ['defaultPrinter','insidePrinter','outsidePrinter'].forEach(field=>{
                if(profile[field] === printerId) profile[field] = '';
              });
              profiles[key] = profile;
            });
            current.availablePrinters = printers;
            current.profiles = profiles;
            return {
              ...s,
              data:{ ...(s.data || {}), print: current }
            };
          });
          const t = getTexts(ctx.getState());
          UI.pushToast(ctx, { title:t.toast.printer_removed, icon:'🗑️' });
        }
      },
      'pos.print.profile-field':{
        on:['input','change'],
        gkeys:['pos:print:profile-field'],
        handler:(e,ctx)=>{
          const field = e.target.getAttribute('data-print-field');
          if(!field) return;
          const rawValue = e.target.value || '';
          const state = ctx.getState();
          const docType = state.ui?.print?.docType || state.data.print?.docType || 'customer';
          ctx.setState(s=>{
            const profiles = { ...(s.data.print?.profiles || {}) };
            const profile = { ...(profiles[docType] || {}) };
            if(field === 'copies'){
              const numeric = parseInt(rawValue, 10);
              profile[field] = Math.max(1, Number.isFinite(numeric) ? numeric : 1);
            } else {
              profile[field] = rawValue;
            }
            profiles[docType] = profile;
            return {
              ...s,
              data:{ ...(s.data || {}), print:{ ...(s.data.print || {}), profiles } }
            };
          });
        }
      },
      'pos.print.toggle':{
        on:['click'],
        gkeys:['pos:print:toggle'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-print-toggle]');
          if(!btn) return;
          const key = btn.getAttribute('data-print-toggle');
          const state = ctx.getState();
          const docType = state.ui?.print?.docType || state.data.print?.docType || 'customer';
          ctx.setState(s=>{
            const profiles = { ...(s.data.print?.profiles || {}) };
            const profile = { ...(profiles[docType] || {}) };
            profile[key] = !profile[key];
            profiles[docType] = profile;
            return {
              ...s,
              data:{ ...(s.data || {}), print:{ ...(s.data.print || {}), profiles } }
            };
          });
        }
      },
      'pos.print.save':{
        on:['click'],
        gkeys:['pos:print:save'],
        handler:(e,ctx)=>{
          const t = getTexts(ctx.getState());
          UI.pushToast(ctx, { title:t.toast.print_profile_saved, icon:'💾' });
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), modals:{ ...(s.ui?.modals || {}), print:false } }
          }));
        }
      },
      'pos.print.send':{
        on:['click'],
        gkeys:['pos:print:send'],
        handler:(e,ctx)=>{
          const t = getTexts(ctx.getState());
          UI.pushToast(ctx, { title:t.toast.print_sent, icon:'🖨️' });
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), modals:{ ...(s.ui?.modals || {}), print:false } }
          }));
        }
      },
      'pos.print.browser':{
        on:['click'],
        gkeys:['pos:print:browser'],
        handler:(e,ctx)=>{
          const state = ctx.getState();
          const t = getTexts(state);
          if(typeof window === 'undefined') return;
          const docType = state.ui?.print?.docType || state.data.print?.docType || 'customer';
          const profile = state.data.print?.profiles?.[docType] || {};
          const size = state.ui?.print?.size || profile.size || state.data.print?.size || 'thermal_80';
          const html = renderPrintableHTML(state, docType, size);
          const popup = window.open('', '_blank', 'width=960,height=1200');
          if(!popup){
            UI.pushToast(ctx, { title:t.toast.browser_popup_blocked, icon:'⚠️' });
            return;
          }
          try{
            popup.document.open();
            popup.document.write(html);
            popup.document.close();
            if(typeof popup.focus === 'function') popup.focus();
          } catch(err){
            console.error('Browser print failed', err);
          }
          UI.pushToast(ctx, { title:t.toast.browser_print_opened, icon:'🖨️' });
        }
      },
      'pos.reservations.open':{
        on:['click'],
        gkeys:['pos:reservations:open'],
        handler:(e,ctx)=>{
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), reservations:{ ...(s.ui?.reservations || {}), editing:null, form:null }, modals:{ ...(s.ui?.modals || {}), reservations:true } }
          }));
        }
      },
      'pos.reservations.new':{
        on:['click'],
        gkeys:['pos:reservations:new'],
        handler:(e,ctx)=>{
          ctx.setState(s=>({
            ...s,
            ui:{
              ...(s.ui || {}),
              reservations:{
                ...(s.ui?.reservations || {}),
                editing:'new',
                form:{ id:null, customerName:'', phone:'', partySize:2, scheduledAt:Date.now(), holdUntil:Date.now()+3600000, tableIds:[], note:'' }
              }
            }
          }));
        }
      },
      'pos.reservations.range':{
        on:['click'],
        gkeys:['pos:reservations:range'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-reservation-range]');
          if(!btn) return;
          const range = btn.getAttribute('data-reservation-range') || 'today';
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), reservations:{ ...(s.ui?.reservations || {}), filter:range } }
          }));
        }
      },
      'pos.reservations.status':{
        on:['click'],
        gkeys:['pos:reservations:status'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-reservation-status]');
          if(!btn) return;
          const status = btn.getAttribute('data-reservation-status') || 'all';
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), reservations:{ ...(s.ui?.reservations || {}), status } }
          }));
        }
      },
      'pos.reservations.form':{
        on:['input','change'],
        gkeys:['pos:reservations:form'],
        handler:(e,ctx)=>{
          const field = e.target.getAttribute('data-field');
          if(!field) return;
          const valueRaw = e.target.value;
          ctx.setState(s=>{
            const form = { ...(s.ui?.reservations?.form || {}) };
            let value = valueRaw;
            if(field === 'partySize') value = parseInt(valueRaw || '0', 10) || 0;
            if(field === 'scheduledAt' || field === 'holdUntil') value = valueRaw ? new Date(valueRaw).getTime() : null;
            form[field] = value;
            return { ...s, ui:{ ...(s.ui || {}), reservations:{ ...(s.ui?.reservations || {}), form } } };
          });
        }
      },
      'pos.reservations.form:table':{
        on:['click'],
        gkeys:['pos:reservations:form:table'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-table-id]');
          if(!btn) return;
          const tableId = btn.getAttribute('data-table-id');
          ctx.setState(s=>{
            const form = { ...(s.ui?.reservations?.form || { tableIds:[] }) };
            const set = new Set(form.tableIds || []);
            if(set.has(tableId)) set.delete(tableId); else set.add(tableId);
            form.tableIds = Array.from(set);
            return { ...s, ui:{ ...(s.ui || {}), reservations:{ ...(s.ui?.reservations || {}), form } } };
          });
        }
      },
      'pos.reservations.cancel-edit':{
        on:['click'],
        gkeys:['pos:reservations:cancel-edit'],
        handler:(e,ctx)=>{
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), reservations:{ ...(s.ui?.reservations || {}), editing:null, form:null } }
          }));
        }
      },
      'pos.reservations.save':{
        on:['click'],
        gkeys:['pos:reservations:save'],
        handler:(e,ctx)=>{
          const state = ctx.getState();
          const t = getTexts(state);
          const form = state.ui?.reservations?.form;
          if(!form) return;
          if(!form.tableIds || !form.tableIds.length){
            UI.pushToast(ctx, { title:t.toast.table_name_required, message:t.ui.reservations_tables_required, icon:'⚠️' });
            return;
          }
          const tables = state.data.tables || [];
          for(const id of form.tableIds){
            const table = tables.find(tbl=> tbl.id === id);
            if(table && table.state === 'maintenance'){
              UI.pushToast(ctx, { title:t.toast.table_state_updated, message:t.ui.reservations_conflict_maintenance, icon:'🛠️' });
              return;
            }
          }
          const reservations = state.data.reservations || [];
          const windowMs = 90 * 60 * 1000;
          const conflicts = reservations.some(res=>{
            if(res.id === form.id) return false;
            if(['cancelled','completed','no-show'].includes(res.status)) return false;
            if(!res.tableIds?.some(id=> form.tableIds.includes(id))) return false;
            return Math.abs((res.scheduledAt || 0) - (form.scheduledAt || Date.now())) < windowMs;
          });
          if(conflicts){
            UI.pushToast(ctx, { title:t.toast.table_locked_other, message:t.ui.reservations_conflict, icon:'⚠️' });
            return;
          }
          const tableLocks = state.data.tableLocks || [];
          const lockConflict = tableLocks.some(lock=> lock.active && form.tableIds.includes(lock.tableId) && lock.orderId && lock.orderId !== state.data.order?.id);
          if(lockConflict){
            UI.pushToast(ctx, { title:t.toast.table_locked_other, message:t.ui.reservations_conflict_lock, icon:'⚠️' });
            return;
          }
          ctx.setState(s=>{
            const reservations = s.data.reservations || [];
            const isEdit = !!form.id;
            const reservationId = form.id || `res-${Date.now().toString(36)}`;
            const payload = { id:reservationId, customerName:form.customerName, phone:form.phone, partySize:form.partySize, scheduledAt:form.scheduledAt || Date.now(), holdUntil:form.holdUntil || null, tableIds:form.tableIds.slice(), status: form.status || 'booked', note:form.note || '', createdAt: form.createdAt || Date.now() };
            const nextReservations = isEdit ? reservations.map(res=> res.id === reservationId ? payload : res) : reservations.concat(payload);
            return {
              ...s,
              data:{ ...(s.data || {}), reservations: nextReservations },
              ui:{ ...(s.ui || {}), reservations:{ ...(s.ui?.reservations || {}), editing:null, form:null } }
            };
          });
          UI.pushToast(ctx, { title: form.id ? t.toast.reservation_updated : t.toast.reservation_created, icon:'📅' });
        }
      },
      'pos.reservations.edit':{
        on:['click'],
        gkeys:['pos:reservations:edit'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-reservation-id]');
          if(!btn) return;
          const resId = btn.getAttribute('data-reservation-id');
          const state = ctx.getState();
          const reservation = (state.data.reservations || []).find(res=> res.id === resId);
          if(!reservation) return;
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), reservations:{ ...(s.ui?.reservations || {}), editing:resId, form:{ ...reservation } } }
          }));
        }
      },
      'pos.reservations.convert':{
        on:['click'],
        gkeys:['pos:reservations:convert'],
        handler: async (e,ctx)=>{
          const btn = e.target.closest('[data-reservation-id]');
          if(!btn) return;
          const resId = btn.getAttribute('data-reservation-id');
          const state = ctx.getState();
          const t = getTexts(state);
          const reservation = (state.data.reservations || []).find(res=> res.id === resId);
          if(!reservation) return;
          const totals = calculateTotals([], state.data.settings || {}, 'dine_in');
          const dineInConfig = getOrderTypeConfig('dine_in');
          const newId = await generateOrderId();
          const newOrder = {
            id: newId,
            status:'open',
            fulfillmentStage:'new',
            paymentState:'unpaid',
            type:'dine_in',
            tableIds: reservation.tableIds.slice(),
            guests: reservation.partySize,
            lines:[],
            notes:[],
            totals,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            allowAdditions: !!dineInConfig.allowsLineAdditions,
            lockLineEdits:false,
            isPersisted:false,
            shiftId: state.data.shift?.current?.id || null,
            posId: state.data.pos?.id || POS_INFO.id,
            posLabel: state.data.pos?.label || POS_INFO.label,
            posNumber: Number.isFinite(Number(state.data.pos?.number)) ? Number(state.data.pos.number) : POS_INFO.number
          };
          ctx.setState(s=>({
            ...s,
            data:{
              ...s.data,
              ordersQueue:[ newOrder, ...(s.data.ordersQueue || []) ],
              reservations:(s.data.reservations || []).map(res=> res.id === resId ? { ...res, status:'seated' } : res),
              tableLocks:[...(s.data.tableLocks || []), ...reservation.tableIds.map(id=> ({ id:`lock-${Date.now().toString(36)}-${id}`, tableId:id, orderId:newOrder.id, lockedBy:s.data.user?.id || 'pos-user', lockedAt:Date.now(), source:'reservation-convert', active:true }))]
            }
          }));
          UI.pushToast(ctx, { title:t.toast.reservation_converted, icon:'🍽️' });
        }
      },
      'pos.reservations.noshow':{
        on:['click'],
        gkeys:['pos:reservations:noshow'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-reservation-id]');
          if(!btn) return;
          const resId = btn.getAttribute('data-reservation-id');
          const state = ctx.getState();
          const t = getTexts(state);
          ctx.setState(s=>({
            ...s,
            data:{ ...(s.data || {}), reservations:(s.data.reservations || []).map(res=> res.id === resId ? { ...res, status:'no-show' } : res) }
          }));
          UI.pushToast(ctx, { title:t.toast.reservation_no_show, icon:'⏰' });
        }
      },
      'pos.reservations.cancel':{
        on:['click'],
        gkeys:['pos:reservations:cancel'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-reservation-id]');
          if(!btn) return;
          const resId = btn.getAttribute('data-reservation-id');
          const state = ctx.getState();
          const t = getTexts(state);
          ctx.setState(s=>({
            ...s,
            data:{ ...(s.data || {}), reservations:(s.data.reservations || []).map(res=> res.id === resId ? { ...res, status:'cancelled' } : res) }
          }));
          UI.pushToast(ctx, { title:t.toast.reservation_cancelled, icon:'🚫' });
        }
      },
      'pos.orders.open':{
        on:['click'],
        gkeys:['pos:orders:open'],
        handler: async (e,ctx)=>{
          const state = ctx.getState();
          const t = getTexts(state);
          const defaultOrdersUi = { tab:'all', search:'', sort:{ field:'updatedAt', direction:'desc' } };
          if(posDB.available){
            try{
              const orders = await posDB.listOrders({ onlyActive:true });
              ctx.setState(s=>({
                ...s,
                data:{ ...(s.data || {}), ordersQueue: orders },
                ui:{ ...(s.ui || {}), orders: defaultOrdersUi, modals:{ ...(s.ui?.modals || {}), orders:true } }
              }));
              UI.pushToast(ctx, { title:t.toast.orders_loaded, icon:'📥' });
              return;
            } catch(error){
              UI.pushToast(ctx, { title:t.toast.orders_failed, message:String(error), icon:'🛑' });
            }
          } else {
            UI.pushToast(ctx, { title:t.toast.indexeddb_missing, icon:'⚠️' });
          }
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), orders: defaultOrdersUi, modals:{ ...(s.ui?.modals || {}), orders:true } }
          }));
        }
      },
      'pos.orders.toggle':{
        on:['click'],
        gkeys:['pos:orders:toggle'],
        handler:(e,ctx)=>{
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), modals:{ ...(s.ui?.modals || {}), orders:false } }
          }));
        }
      },
      'pos.orders.tab':{
        on:['click'],
        gkeys:['pos:orders:tab'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-tab-id]');
          if(!btn) return;
          const tabId = btn.getAttribute('data-tab-id');
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), orders:{ ...(s.ui?.orders || {}), tab: tabId }, modals:{ ...(s.ui?.modals || {}), orders:true } }
          }));
        }
      },
      'pos.orders.search':{
        on:['input'],
        gkeys:['pos:orders:search'],
        handler:(e,ctx)=>{
          const value = e.target.value || '';
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), orders:{ ...(s.ui?.orders || {}), search:value }, modals:{ ...(s.ui?.modals || {}), orders:true } }
          }));
        }
      },
      'pos.orders.sort':{
        on:['click'],
        gkeys:['pos:orders:sort'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-sort-field]');
          if(!btn) return;
          const field = btn.getAttribute('data-sort-field') || 'updatedAt';
          ctx.setState(s=>{
            const current = (s.ui?.orders?.sort) || { field:'updatedAt', direction:'desc' };
            const direction = current.field === field && current.direction === 'desc' ? 'asc' : 'desc';
            return {
              ...s,
              ui:{ ...(s.ui || {}), orders:{ ...(s.ui?.orders || {}), sort:{ field, direction } }, modals:{ ...(s.ui?.modals || {}), orders:true } }
            };
          });
        }
      },
      'pos.orders.refresh':{
        on:['click'],
        gkeys:['pos:orders:refresh'],
        handler: async (e,ctx)=>{
          const state = ctx.getState();
          const t = getTexts(state);
          if(!posDB.available){
            UI.pushToast(ctx, { title:t.toast.indexeddb_missing, icon:'⚠️' });
            return;
          }
          try{
            const orders = await posDB.listOrders({ onlyActive:true });
            ctx.setState(s=>({
              ...s,
              data:{ ...(s.data || {}), ordersQueue: orders }
            }));
            UI.pushToast(ctx, { title:t.toast.orders_loaded, icon:'📥' });
          } catch(error){
            UI.pushToast(ctx, { title:t.toast.orders_failed, message:String(error), icon:'🛑' });
          }
        }
      },
      'pos.orders.open-order':{
        on:['click'],
        gkeys:['pos:orders:open-order'],
        handler: async (e,ctx)=>{
          const btn = e.target.closest('[data-order-id]');
          if(!btn) return;
          const orderId = btn.getAttribute('data-order-id');
          const state = ctx.getState();
          const t = getTexts(state);
          let order = null;
          if(posDB.available){
            try{
              order = await posDB.getOrder(orderId);
            } catch(error){
              UI.pushToast(ctx, { title:t.toast.orders_failed, message:String(error), icon:'🛑' });
            }
          }
          if(!order){
            order = [state.data.order, ...(state.data.ordersQueue || [])].find(ord=> ord && ord.id === orderId);
          }
          if(!order) return;
          activateOrder(ctx, order, { closeOrdersModal:true, resetOrderNavValue:true });
        }
      },
      'pos.tables.open':{
        on:['click'],
        gkeys:['pos:tables:open'],
        handler:(e,ctx)=>{
          ctx.setState(s=>({
            ...s,
            ui:{
              ...(s.ui || {}),
              tables:{ view:'assign', filter:'all', search:'', details:null },
              modals:{ ...(s.ui?.modals || {}), tables:true }
            }
          }));
        }
      },
      'pos.tables.view':{
        on:['click'],
        gkeys:['pos:tables:view'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-tables-view]');
          if(!btn) return;
          const view = btn.getAttribute('data-tables-view') || 'assign';
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), tables:{ ...(s.ui?.tables || {}), view } }
          }));
        }
      },
      'pos.tables.filter':{
        on:['click'],
        gkeys:['pos:tables:filter'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-tables-filter]');
          if(!btn) return;
          const filter = btn.getAttribute('data-tables-filter') || 'all';
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), tables:{ ...(s.ui?.tables || {}), filter } }
          }));
        }
      },
      'pos.tables.search':{
        on:['input','change'],
        gkeys:['pos:tables:search'],
        handler:(e,ctx)=>{
          const value = e.target.value || '';
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), tables:{ ...(s.ui?.tables || {}), search:value } }
          }));
        }
      },
      'pos.tables.details':{
        on:['click'],
        gkeys:['pos:tables:details'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-table-id]');
          if(!btn) return;
          const tableId = btn.getAttribute('data-table-id');
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), tables:{ ...(s.ui?.tables || {}), details:tableId } }
          }));
        }
      },
      'pos.tables.details-close':{
        on:['click'],
        gkeys:['pos:tables:details-close'],
        handler:(e,ctx)=>{
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), tables:{ ...(s.ui?.tables || {}), details:null } }
          }));
        }
      },
      'pos.tables.card.tap':{
        on:['click'],
        gkeys:['pos:tables:card:tap'],
        handler:(e,ctx)=>{
          if(e.target.closest('[data-prevent-select="true"]')) return;
          const btn = e.target.closest('[data-table-id]');
          if(!btn) return;
          const tableId = btn.getAttribute('data-table-id');
          const state = ctx.getState();
          const t = getTexts(state);
          const runtimeTables = computeTableRuntime(state);
          const runtime = runtimeTables.find(tbl=> tbl.id === tableId);
          if(!runtime) return;
          if(runtime.state === 'maintenance'){
            UI.pushToast(ctx, { title:t.toast.table_locked_other, message:t.ui.table_status_maintenance, icon:'🛠️' });
            return;
          }
          if(runtime.state === 'disactive'){
            UI.pushToast(ctx, { title:t.toast.table_inactive_assign, icon:'🚫' });
            return;
          }
          const order = state.data.order || {};
          if(order.type !== 'dine_in'){
            UI.pushToast(ctx, { title:t.toast.table_assigned, message:t.ui.service_type, icon:'ℹ️' });
            return;
          }
          const currentTables = new Set(order.tableIds || []);
          const isAssigned = currentTables.has(tableId);
          if(isAssigned){
            if(!window.confirm(t.ui.table_confirm_release)) return;
            ctx.setState(s=>({
              ...s,
              data:{
                ...s.data,
                tableLocks:(s.data.tableLocks || []).map(lock=> lock.tableId === tableId && lock.orderId === order.id ? { ...lock, active:false } : lock),
                order:{ ...(s.data.order || {}), tableIds:(s.data.order?.tableIds || []).filter(id=> id !== tableId), updatedAt: Date.now() }
              }
            }));
            UI.pushToast(ctx, { title:t.toast.table_unlocked, icon:'🔓' });
            return;
          }
          if(runtime.lockState !== 'free' && !runtime.isCurrentOrder){
            if(!window.confirm(t.toast.table_locked_other)) return;
          }
          if(currentTables.size && !window.confirm(t.ui.table_multi_orders)) return;
          ctx.setState(s=>({
            ...s,
            data:{
              ...s.data,
              tableLocks:[...(s.data.tableLocks || []), { id:`lock-${Date.now().toString(36)}`, tableId, orderId: order.id, lockedBy: s.data.user?.id || 'pos-user', lockedAt: Date.now(), source:'pos', active:true }],
              order:{ ...(s.data.order || {}), tableIds:Array.from(new Set([...(s.data.order?.tableIds || []), tableId])), updatedAt: Date.now() }
            }
          }));
          UI.pushToast(ctx, { title:t.toast.table_locked_now, icon:'🔒' });
        }
      },
      'pos.tables.unlock-order':{
        on:['click'],
        gkeys:['pos:tables:unlock-order'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-table-id]');
          if(!btn) return;
          const tableId = btn.getAttribute('data-table-id');
          const orderId = btn.getAttribute('data-order-id');
          const state = ctx.getState();
          const t = getTexts(state);
          ctx.setState(s=>({
            ...s,
            data:{
              ...s.data,
              tableLocks:(s.data.tableLocks || []).map(lock=> lock.tableId === tableId && lock.orderId === orderId ? { ...lock, active:false } : lock)
            }
          }));
          UI.pushToast(ctx, { title:t.toast.table_unlock_partial, icon:'🔓' });
        }
      },
      'pos.tables.unlock-all':{
        on:['click'],
        gkeys:['pos:tables:unlock-all'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-table-id]');
          if(!btn) return;
          const tableId = btn.getAttribute('data-table-id');
          ctx.setState(s=>({
            ...s,
            data:{
              ...s.data,
              tableLocks:(s.data.tableLocks || []).map(lock=> lock.tableId === tableId ? { ...lock, active:false } : lock)
            }
          }));
        }
      },
      'pos.tables.add':{
        on:['click'],
        gkeys:['pos:tables:add'],
        handler:(e,ctx)=>{
          const state = ctx.getState();
          const t = getTexts(state);
          const nextIndex = (state.data.tables || []).length + 1;
          const defaultName = `${t.ui.tables} ${nextIndex}`;
          const name = window.prompt(t.ui.table_add, defaultName);
          if(!name){
            UI.pushToast(ctx, { title:t.toast.table_name_required, icon:'⚠️' });
            return;
          }
          ctx.setState(s=>({
            ...s,
            data:{
              ...s.data,
              tables:[...(s.data.tables || []), { id:`T${Date.now().toString(36)}`, name, capacity:4, zone:'', state:'active', displayOrder: nextIndex, note:'' }]
            }
          }));
          UI.pushToast(ctx, { title:t.toast.table_added, icon:'➕' });
        }
      },
      'pos.tables.rename':{
        on:['click'],
        gkeys:['pos:tables:rename'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-table-id]');
          if(!btn) return;
          const tableId = btn.getAttribute('data-table-id');
          const state = ctx.getState();
          const t = getTexts(state);
          const table = (state.data.tables || []).find(tbl=> tbl.id === tableId);
          if(!table) return;
          const nextName = window.prompt(t.ui.table_rename, table.name || table.id);
          if(!nextName){
            UI.pushToast(ctx, { title:t.toast.table_name_required, icon:'⚠️' });
            return;
          }
          ctx.setState(s=>({
            ...s,
            data:{
              ...s.data,
              tables:(s.data.tables || []).map(tbl=> tbl.id === tableId ? { ...tbl, name: nextName } : tbl),
              auditTrail:[...(s.data.auditTrail || []), { id:`audit-${Date.now().toString(36)}`, userId:s.data.user?.id || 'pos-user', action:'table.rename', refType:'table', refId:tableId, at:Date.now(), meta:{ name:nextName } }]
            }
          }));
          UI.pushToast(ctx, { title:t.toast.table_updated, icon:'✏️' });
        }
      },
      'pos.tables.capacity':{
        on:['click'],
        gkeys:['pos:tables:capacity'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-table-id]');
          if(!btn) return;
          const tableId = btn.getAttribute('data-table-id');
          const state = ctx.getState();
          const t = getTexts(state);
          const table = (state.data.tables || []).find(tbl=> tbl.id === tableId);
          if(!table) return;
          const input = window.prompt(t.ui.tables_capacity, String(table.capacity || 4));
          if(input == null) return;
          const capacity = parseInt(input, 10);
          if(!Number.isFinite(capacity) || capacity <= 0){
            UI.pushToast(ctx, { title:t.toast.table_invalid_seats, icon:'⚠️' });
            return;
          }
          ctx.setState(s=>({
            ...s,
            data:{
              ...s.data,
              tables:(s.data.tables || []).map(tbl=> tbl.id === tableId ? { ...tbl, capacity } : tbl)
            }
          }));
          UI.pushToast(ctx, { title:t.toast.table_updated, icon:'👥' });
        }
      },
      'pos.tables.zone':{
        on:['click'],
        gkeys:['pos:tables:zone'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-table-id]');
          if(!btn) return;
          const tableId = btn.getAttribute('data-table-id');
          const state = ctx.getState();
          const table = (state.data.tables || []).find(tbl=> tbl.id === tableId);
          if(!table) return;
          const zone = window.prompt('Zone', table.zone || '');
          if(zone == null) return;
          ctx.setState(s=>({
            ...s,
            data:{
              ...s.data,
              tables:(s.data.tables || []).map(tbl=> tbl.id === tableId ? { ...tbl, zone } : tbl)
            }
          }));
        }
      },
      'pos.tables.state':{
        on:['click'],
        gkeys:['pos:tables:state'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-table-id]');
          if(!btn) return;
          const tableId = btn.getAttribute('data-table-id');
          const state = ctx.getState();
          const t = getTexts(state);
          const orderLocks = (state.data.tableLocks || []).filter(lock=> lock.tableId === tableId && lock.active);
          ctx.setState(s=>({
            ...s,
            data:{
              ...s.data,
              tables:(s.data.tables || []).map(tbl=>{
                if(tbl.id !== tableId) return tbl;
                const cycle = ['active','maintenance','disactive'];
                const currentIndex = cycle.indexOf(tbl.state || 'active');
                const nextState = cycle[(currentIndex + 1) % cycle.length];
                if(nextState !== 'active' && orderLocks.length){
                  return tbl;
                }
                return { ...tbl, state: nextState };
              })
            }
          }));
          UI.pushToast(ctx, { title:t.toast.table_state_updated, icon:'♻️' });
        }
      },
      'pos.tables.remove':{
        on:['click'],
        gkeys:['pos:tables:remove'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-table-id]');
          if(!btn) return;
          const tableId = btn.getAttribute('data-table-id');
          const state = ctx.getState();
          const t = getTexts(state);
          const locks = (state.data.tableLocks || []).filter(lock=> lock.tableId === tableId && lock.active);
          if(locks.length){
            UI.pushToast(ctx, { title:t.toast.table_has_sessions, icon:'⚠️' });
            return;
          }
          if(!window.confirm(t.ui.table_confirm_remove)) return;
          ctx.setState(s=>({
            ...s,
            data:{
              ...s.data,
              tables:(s.data.tables || []).filter(tbl=> tbl.id !== tableId)
            }
          }));
          UI.pushToast(ctx, { title:t.toast.table_removed, icon:'🗑️' });
        }
      },
      'pos.tables.bulk':{
        on:['click'],
        gkeys:['pos:tables:bulk'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-bulk-action]');
          if(!btn) return;
          const action = btn.getAttribute('data-bulk-action');
          ctx.setState(s=>{
            const tables = (s.data.tables || []).map(tbl=>{
              if(action === 'activate') return { ...tbl, state:'active' };
              if(action === 'maintenance') return { ...tbl, state:'maintenance' };
              return tbl;
            });
            return { ...s, data:{ ...(s.data || {}), tables } };
          });
        }
      },
      'ui.numpad.decimal.key':{
        on:['click'],
        gkeys:['ui:numpad:decimal:key'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-numpad-key]');
          if(!btn || btn.disabled) return;
          const key = btn.getAttribute('data-numpad-key');
          if(!key) return;
          const container = btn.closest('[data-numpad-root]');
          if(!container) return;
          if(key === '.' && container.hasAttribute('data-numpad-no-decimal')) return;
          const input = container.querySelector('[data-numpad-input]');
          if(!input) return;
          let value = input.value || '';
          if(key === '.' && value.includes('.')) return;
          if(value === '' && key === '.') value = '0.';
          else if(value === '0' && key !== '.') value = key;
          else value = `${value}${key}`;
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles:true }));
          input.dispatchEvent(new Event('change', { bubbles:true }));
        }
      },
      'ui.numpad.decimal.clear':{
        on:['click'],
        gkeys:['ui:numpad:decimal:clear'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-numpad-clear]');
          if(!btn) return;
          const container = btn.closest('[data-numpad-root]');
          if(!container) return;
          const input = container.querySelector('[data-numpad-input]');
          if(!input) return;
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles:true }));
          input.dispatchEvent(new Event('change', { bubbles:true }));
        }
      },
      'ui.numpad.decimal.backspace':{
        on:['click'],
        gkeys:['ui:numpad:decimal:backspace'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-numpad-backspace]');
          if(!btn) return;
          const container = btn.closest('[data-numpad-root]');
          if(!container) return;
          const input = container.querySelector('[data-numpad-input]');
          if(!input) return;
          const value = input.value || '';
          input.value = value.length ? value.slice(0, -1) : '';
          input.dispatchEvent(new Event('input', { bubbles:true }));
          input.dispatchEvent(new Event('change', { bubbles:true }));
        }
      },
      'ui.numpad.decimal.confirm':{
        on:['click'],
        gkeys:['ui:numpad:decimal:confirm'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-numpad-confirm]');
          if(!btn) return;
          const container = btn.closest('[data-numpad-root]');
          if(!container) return;
          const input = container.querySelector('[data-numpad-input]');
          if(input){
            input.dispatchEvent(new Event('change', { bubbles:true }));
          }

        }
      },
      'pos.payments.open':{
        on:['click'],
        gkeys:['pos:payments:open'],
        handler:(e,ctx)=>{
          ctx.setState(s=>({
            ...s,
            ui:{
              ...(s.ui || {}),
              modals:{ ...(s.ui?.modals || {}), payments:true },
              paymentDraft:{ amount:'', method: s.data.payments?.activeMethod || 'cash' }
            }
          }));
        }
      },
      'pos.payments.close':{
        on:['click'],
        gkeys:['pos:payments:close','ui:drawer:close'],
        handler:(e,ctx)=>{
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), modals:{ ...(s.ui?.modals || {}), payments:false } }
          }));
        }
      },
      'pos.payments.method':{
        on:['click'],
        gkeys:['pos:payments:method'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-method-id]');
          if(!btn) return;
          const method = btn.getAttribute('data-method-id');
          ctx.setState(s=>({
            ...s,
            data:{ ...(s.data || {}), payments:{ ...(s.data.payments || {}), activeMethod: method } },
            ui:{ ...(s.ui || {}), paymentDraft:{ ...(s.ui?.paymentDraft || {}), method } }
          }));
        }
      },
      'pos.payments.amount':{
        on:['input','change'],
        gkeys:['pos:payments:amount'],
        handler:(e,ctx)=>{
          const value = e.target.value;
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), paymentDraft:{ ...(s.ui?.paymentDraft || {}), amount:value } }
          }));
        }
      },
      'pos.payments.capture':{
        on:['click'],
        gkeys:['pos:payments:capture'],
        handler:(e,ctx)=>{
          const state = ctx.getState();
          const t = getTexts(state);
          const amount = parseFloat(state.ui?.paymentDraft?.amount);
          if(!amount || amount <= 0){
            UI.pushToast(ctx, { title:t.toast.amount_required, icon:'⚠️' });
            return;
          }
          const method = state.data.payments.activeMethod || 'cash';
          ctx.setState(s=>({
            ...s,
            data:{
              ...s.data,
              payments:{
                ...(s.data.payments || {}),
                split:(s.data.payments?.split || []).concat([{ id:`pm-${Date.now()}`, method, amount: round(amount) }])
              }
            },
            ui:{ ...(s.ui || {}), modals:{ ...(s.ui?.modals || {}), payments:false }, paymentDraft:{ amount:'' } }
          }));
          UI.pushToast(ctx, { title:t.toast.payment_recorded, icon:'💰' });
        }
      },
      'pos.payments.split':{
        on:['click'],
        gkeys:['pos:payments:split'],
        handler:(e,ctx)=>{
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), modals:{ ...(s.ui?.modals || {}), payments:true } }
          }));
        }
      },
      'pos.reports.toggle':{
        on:['click'],
        gkeys:['pos:reports:toggle'],
        handler:(e,ctx)=>{
          ctx.setState(s=>({
            ...s,
            ui:{ ...(s.ui || {}), modals:{ ...(s.ui?.modals || {}), reports: !s.ui?.modals?.reports } }
          }));
        }
      },
      'pos.indexeddb.sync':{
        on:['click'],
        gkeys:['pos:indexeddb:sync'],
        handler: async (e,ctx)=>{
          const state = ctx.getState();
          const t = getTexts(state);
          if(!posDB.available){
            UI.pushToast(ctx, { title:t.toast.indexeddb_missing, icon:'⚠️' });
            return;
          }
          try{
            UI.pushToast(ctx, { title:t.toast.indexeddb_syncing, icon:'🔄' });
            const orders = await posDB.listOrders();
            await posDB.markSync();
            ctx.setState(s=>({
              ...s,
              data:{
                ...s.data,
                status:{ ...s.data.status, indexeddb:{ state:'online', lastSync: Date.now() } },
                reports:{ ...(s.data.reports || {}), ordersCount: orders.length }
              }
            }));
            UI.pushToast(ctx, { title:t.toast.sync_complete, icon:'✅' });
          } catch(error){
            UI.pushToast(ctx, { title:t.toast.indexeddb_error, message:String(error), icon:'🛑' });
            ctx.setState(s=>({
              ...s,
              data:{
                ...s.data,
                status:{ ...s.data.status, indexeddb:{ state:'offline', lastSync: s.data.status?.indexeddb?.lastSync || null } }
              }
            }));
          }
        }
      },
      'pos.kds.connect':{
        on:['click'],
        gkeys:['pos:kds:connect'],
        handler:(e,ctx)=>{
          kdsBridge.connect(ctx);
        }
      },
      'pos.theme.toggle':{
        on:['click'],
        gkeys:['pos:theme:toggle'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-theme]');
          if(!btn) return;
          const theme = btn.getAttribute('data-theme');
          ctx.setState(s=>({
            ...s,
            env:{ ...(s.env || {}), theme },
            ui:{ ...(s.ui || {}), settings:{ ...(s.ui?.settings || {}), activeTheme: theme } }
          }));
          const t = getTexts(ctx.getState());
          UI.pushToast(ctx, { title:t.toast.theme_switched, icon: theme === 'dark' ? '🌙' : '☀️' });
        }
      },
      'pos.lang.switch':{
        on:['click'],
        gkeys:['pos:lang:switch'],
        handler:(e,ctx)=>{
          const btn = e.target.closest('[data-lang]');
          if(!btn) return;
          const lang = btn.getAttribute('data-lang');
          ctx.setState(s=>({
            ...s,
            env:{ ...(s.env || {}), lang, dir: lang === 'ar' ? 'rtl' : 'ltr' }
          }));
          const t = getTexts(ctx.getState());
          UI.pushToast(ctx, { title:t.toast.lang_switched, icon:'🌐' });
        }
      },
      'pos.session.logout':{
        on:['click'],
        gkeys:['pos:session:logout'],
        handler:(e,ctx)=>{
          const t = getTexts(ctx.getState());
          UI.pushToast(ctx, { title:t.toast.logout_stub, icon:'👋' });
        }
      }
    };

    app.setOrders(Object.assign({}, UI.orders, auto.orders, posOrders));
    app.mount('#app');
    if(posDB.available){
      await refreshPersistentSnapshot({ focusCurrent:true, syncOrders:true });
    }
  })();

