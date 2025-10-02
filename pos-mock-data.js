/**
 * بسم الله الرحمن الرحيم
 * FILE: mock-data.js
 * * الفلسفة:
 * هذا الملف يمثل قاعدة بيانات محاكاة (mock) للتطبيق. في مرحلة التطوير،
 * يعمل هذا الملف كمصدر الحقيقة الثابت للبيانات (مثل قائمة الأصناف، الموظفين، إلخ).
 * هذا يسمح لنا ببناء وتجربة الواجهات الأمامية بشكل كامل ومنعزل عن
 * الواجهات الخلفية (Backend)، مما يسرع عملية التطوير ويضمن التركيز.
 * في التطبيق الحقيقي، سيتم استبدال هذا الملف باستدعاءات AJAX لجلب البيانات
 * من خادم حقيقي.
 */

const database = {
    // --- الإعدادات العامة للنظام ---
    settings: {
        tax_rate: 0.14,
        service_charge_rate: 0.12,
        default_delivery_fee: 30.00,
        currency: {
            ar: 'ج.م',
            en: 'EGP'
        }
    },

    // --- بيانات الموظفين والصلاحيات ---
    employees: [
        { "id": "e7a8f0b4", "pin_code": "1122", "full_name": "أحمد محمود", "role": "cashier", "allowed_discount_rate": 0.10 },
        { "id": "f3c9d8e1", "pin_code": "3344", "full_name": "سارة علي", "role": "cashier", "allowed_discount_rate": 0.10 },
        { "id": "a1b2c3d4", "pin_code": "9999", "full_name": "خالد إبراهيم", "role": "manager", "allowed_discount_rate": 0.25 },
        { "id": "b5c6d7e8", "pin_code": "5566", "full_name": "فاطمة حسن", "role": "kitchen_staff", "allowed_discount_rate": 0.00 },
        { "id": "c9d0e1f2", "pin_code": "7788", "full_name": "يوسف كريم", "role": "delivery_driver", "allowed_discount_rate": 0.00 }
    ],

    // --- بيانات الطاولات في المطعم (الإضافة الجديدة) ---
    tables: [
        { "id": "T1", "name": "طاولة 1", "seats": 4, "status": "available" },
        { "id": "T2", "name": "طاولة 2", "seats": 4, "status": "occupied", "sessions": ["ord-1678886400000"], "locked": true, "lockedBy": "ord-1678886400000" },
        { "id": "T3", "name": "طاولة 3", "seats": 2, "status": "available" },
        { "id": "T4", "name": "طاولة 4", "seats": 6, "status": "maintenance" },
        { "id": "T5", "name": "طاولة 5", "seats": 2, "status": "reserved" },
        { "id": "T6", "name": "طاولة 6", "seats": 8, "status": "occupied", "sessions": ["ord-1678886500000", "ord-1678886600000"] },
        { "id": "T7", "name": "طاولة 7", "seats": 4, "status": "available" },
        { "id": "T8", "name": "طاولة 8", "seats": 4, "status": "available" },
        { "id": "T9", "name": "طاولة 9", "seats": 6, "status": "available" },
        { "id": "T10", "name": "طاولة 10", "seats": 6, "status": "reserved" },
        { "id": "T11", "name": "طاولة 11", "seats": 2, "status": "available" },
        { "id": "T12", "name": "طاولة 12", "seats": 4, "status": "available" },
        { "id": "T13", "name": "طاولة 13", "seats": 8, "status": "occupied", "sessions": ["ord-1678886700000"], "locked": true, "lockedBy": "ord-1678886700000" },
        { "id": "T14", "name": "طاولة 14", "seats": 4, "status": "maintenance" },
        { "id": "T15", "name": "طاولة 15", "seats": 2, "status": "available" },
        { "id": "T16", "name": "طاولة 16", "seats": 10, "status": "reserved" },
        { "id": "T17", "name": "طاولة 17", "seats": 4, "status": "available" },
        { "id": "T18", "name": "طاولة 18", "seats": 4, "status": "available" },
        { "id": "T19", "name": "طاولة 19", "seats": 6, "status": "inactive" },
        { "id": "T20", "name": "طاولة 20", "seats": 6, "status": "available" }
    ],

    // --- بيانات سائقي التوصيل ---
    drivers: [
        { "id": 1, "name": "محمود عبد العزيز", "phone": "01012345678", "vehicle_id": "موتوسيكل - أ ب ج 123" },
        { "id": 2, "name": "كريم السيد", "phone": "01198765432", "vehicle_id": "موتوسيكل - س ص ع 456" },
        { "id": 3, "name": "علي حسن", "phone": "01234567890", "vehicle_id": "سيارة - ف ق ل 789" }
    ],
    
    // --- تصنيفات قائمة الطعام ---
    categories: [
        { "id": "all", "translations": { "en": "All", "ar": "الكل" } },
        { "id": "appetizers", "translations": { "en": "Appetizers", "ar": "المقبلات" } },
        { "id": "sandwiches", "translations": { "en": "Sandwiches", "ar": "السندويتشات" } },
        { "id": "hawawshi", "translations": { "en": "Hawawshi", "ar": "الحواوشي" } },
        { "id": "combo_meals", "translations": { "en": "Combo Meals", "ar": "وجبات الكومبو" } },
        { "id": "kilo_grills", "translations": { "en": "Grills by Kilo", "ar": "مشويات بالكيلو" } },
        { "id": "side_items", "translations": { "en": "Side Items", "ar": "الأصناف الجانبية" } }
    ],

    // --- قائمة الطعام الرئيسية ---
    items: [
        { "id": 1, "category": "appetizers", "price": 53.00, "image": "https://images.deliveryhero.io/image/talabat/Menuitems/blob_637388278140512938", "translations": { "ar": { "name": "سلطة خضراء", "description": "مزيج منعش من الخس، الطماطم، والخيار." }, "en": { "name": "Green Salad", "description": "A refreshing mix of lettuce, tomatoes, and cucumbers." } } },
        { "id": 2, "category": "appetizers", "price": 49.00, "image": "https://images.deliveryhero.io/image/talabat/Menuitems/blob_637388277511975892", "translations": { "ar": { "name": "سلطة طحينة", "description": "طحينة كريمية بالليمون والثوم." }, "en": { "name": "Tahini Salad", "description": "Creamy tahini with lemon and garlic." } } },
        { "id": 3, "category": "appetizers", "price": 51.00, "image": "https://images.deliveryhero.io/image/talabat/Menuitems/Pickled_Eggplants_637469394727509300.jpg", "translations": { "ar": { "name": "باذنجان مخلل", "description": "باذنجان محشو بالثوم والفلفل." }, "en": { "name": "Pickled Eggplant", "description": "Eggplant stuffed with garlic and peppers." } } },
        { "id": 5, "category": "sandwiches", "price": 100.00, "image": "https://images.deliveryhero.io/image/talabat/Menuitems/20190429_Talabat_UAE_637472695437572843.jpg", "translations": { "ar": { "name": "سندويتش كفتة ضاني", "description": "كفتة ضأن مشوية مع طحينة وبقدونس." }, "en": { "name": "Mutton Kofta Sandwich", "description": "Grilled mutton kofta with tahini and parsley." } } },
        { "id": 6, "category": "sandwiches", "price": 100.00, "image": "https://images.deliveryhero.io/image/talabat/Menuitems/20190623_Talabat_Qat_637472695443152020.jpg", "translations": { "ar": { "name": "سندويتش كفتة كندوز", "description": "كفتة كندوز مصرية أصيلة." }, "en": { "name": "Kandouz Kofta Sandwich", "description": "Authentic Egyptian kandouz kofta." } } },
        { "id": 9, "category": "sandwiches", "price": 55.00, "image": "https://images.deliveryhero.io/image/talabat/Menuitems/20210103_Talabat_UAE_637468330976710699.jpg", "translations": { "ar": { "name": "سندويتش كبدة", "description": "كبدة اسكندراني بالفلفل الحار." }, "en": { "name": "Liver Sandwich", "description": "Alexandrian liver with hot peppers." } } },
        { "id": 10, "category": "hawawshi", "price": 120.00, "image": "https://images.deliveryhero.io/image/talabat/Menuitems/20191225_Talabat_UAE_637472695462881782.jpg", "translations": { "ar": { "name": "حواوشي درويش", "description": "حواوشي خاص بمزيجنا السري." }, "en": { "name": "Darwish Hawawshi", "description": "Special Hawawshi with our secret blend." } } },
        { "id": 13, "category": "hawawshi", "price": 120.00, "image": "https://images.deliveryhero.io/image/talabat/Menuitems/20191225_Talabat_UAE_637472695479175846.jpg", "translations": { "ar": { "name": "حواوشي عادي", "description": "خبز بلدي محشو باللحم المفروم المتبل." }, "en": { "name": "Regular Hawawshi", "description": "Baladi bread stuffed with seasoned minced meat." } } },
        { "id": 14, "category": "combo_meals", "price": 149.00, "image": "https://images.deliveryhero.io/image/talabat/Menuitems/2020-03-08_Talabat_J_637472695484901335.jpg", "translations": { "ar": { "name": "وجبة ربع دجاجة", "description": "تقدم مع سلطة، شوربة، أرز وخبز." }, "en": { "name": "Quarter Chicken Meal", "description": "Served with salad, soup, rice and bread." } } },
        { "id": 15, "category": "combo_meals", "price": 205.00, "image": "https://images.deliveryhero.io/image/talabat/Menuitems/20200914_Talabat_UAE_637472695491197375.jpg", "translations": { "ar": { "name": "وجبة ربع كيلو كفتة", "description": "تقدم مع سلطة، شوربة، أرز وخبز." }, "en": { "name": "1/4 Kilo Kofta Meal", "description": "Served with salad, soup, rice and bread." } } },
        { "id": 24, "category": "kilo_grills", "price": 525.00, "image": "https://images.deliveryhero.io/image/talabat/Menuitems/blob_637409251309078955", "translations": { "ar": { "name": "كيلو كفتة كندوز", "description": "كيلو من كفتة لحم الكندوز المشوية." }, "en": { "name": "Kilo Kandouz Kofta", "description": "One kilo of grilled Kandouz beef kofta." } } },
        { "id": 25, "category": "kilo_grills", "price": 325.00, "image": "https://images.deliveryhero.io/image/talabat/Menuitems/blob_637409249062827138", "translations": { "ar": { "name": "كيلو شيش دجاج", "description": "كيلو من شيش طاووق المشوي." }, "en": { "name": "Kilo Shish Chicken", "description": "One kilo of grilled shish tawook." } } },
        { "id": 26, "category": "side_items", "price": 68.00, "image": "https://images.deliveryhero.io/image/talabat/Menuitems/blob_637388275970177367", "translations": { "ar": { "name": "أرز بالشعرية", "description": "أرز بسمتي مع شعيرية محمصة." }, "en": { "name": "Vermicelli Rice", "description": "Basmati rice with toasted vermicelli." } } },
        { "id": 27, "category": "side_items", "price": 67.00, "image": "https://images.deliveryhero.io/image/talabat/Menuitems/blob_637388276443789280", "translations": { "ar": { "name": "شوربة لسان عصفور", "description": "شوربة دافئة بمرق صافي." }, "en": { "name": "Orzo Soup", "description": "Warm soup with a clear broth." } } }
    ],

    // --- الإضافات والمنزوعات (التخصيصات) ---
    modifiers: {
        "add-ons": [
            { "id": 101, "name": { "en": "Extra Mozzarella", "ar": "جبنة موتزاريلا زيادة" }, "price_change": 15.00 },
            { "id": 102, "name": { "en": "Extra Tahini Sauce", "ar": "صوص طحينة إضافي" }, "price_change": 8.00 },
            { "id": 103, "name": { "en": "Extra Roumy Cheese", "ar": "جبنة رومي زيادة" }, "price_change": 12.00 },
            { "id": 104, "name": { "en": "Extra Rice", "ar": "أرز إضافي" }, "price_change": 25.00 }
        ],
        "removals": [
            { "id": 201, "name": { "en": "Without Pickles", "ar": "بدون مخلل" }, "price_change": 0.00 },
            { "id": 202, "name": { "en": "Without Onions", "ar": "بدون بصل" }, "price_change": 0.00 },
            { "id": 203, "name": { "en": "Without Tomatoes", "ar": "بدون طماطم" }, "price_change": 0.00 }
        ]
    }
};

if (typeof window !== 'undefined') {
    window.database = database;
} else if (typeof global !== 'undefined') {
    global.database = database;
}
