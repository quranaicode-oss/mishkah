----

### **الوثيقة الفنية الشاملة: نظام نقاط البيع للمطاعم (POS) v1.1**

**الغرض:** هذا المستند هو المصدر الرسمي والوحيد للحقيقة (Single Source of Truth) لتصميم وتطوير شاشة POS. إنه يحدد المتطلبات الوظيفية وغير الوظيفية، ونماذج البيانات، وتدفقات العمل، والهندسة المعمارية للنظام بشكل مفصل.

-----

### **الجزء الأول: التوصيف العام للمشروع (Framework-Agnostic)**

#### **1. الرؤية والأهداف**

بناء نظام نقاط بيع (POS) للمطاعم من الجيل التالي، يتميز بالسرعة الفائقة، والموثوقية العالية (يعمل دون اتصال)، والمرونة التشغيلية القصوى. النظام مصمم لبيئات العمل سريعة الخطى، ويوفر تجربة مستخدم بديهية على الأجهزة اللوحية التي تعمل باللمس، مع الالتزام بالمعايير العالمية لأنظمة إدارة المطاعم (RMS).

#### **2. المتطلبات الوظيفية المفصلة**

##### **2.1 الواجهة الرئيسية والتخطيط العام**

  * **تخطيط ثابت (100vh/100vw):** تشغل الواجهة كامل الشاشة بدون أي شريط تمرير رئيسي.
  * **تقسيم الشاشة:**
      * **منطقة القائمة (Menu Area) - (≈65-70%):** على اليمين (في LTR) أو اليسار (في RTL). تحتوي على شريط بحث وفلترة بالتصنيفات، وشبكة عرض للأصناف.
      * **منطقة الطلب (Order/Cart Area) - (≈30-35%):** على اليسار (في LTR) أو اليمين (في RTL). تحتوي على تفاصيل الطلب الحالي، الإجماليات، وأزرار الإجراءات.
  * **شريط الإجراءات السفلي (Footer Action Bar):** شريط ثابت أسفل منطقة الطلب يحتوي على الأزرار النهائية (حفظ، دفع، طباعة).
  * **الشريط العلوي (Top Bar):** يعرض معلومات الوردية، اسم الموظف، وزر لتسجيل الخروج أو الوصول للإعدادات.

##### **2.2 إدارة الطلبات (Core Order Management)**

  * **إضافة الأصناف:** الضغط على بطاقة الصنف في القائمة يضيفه للطلب. الضغط المتكرر يزيد الكمية بمقدار 1.
  * **تعديل الكمية:** كل سطر في الطلب يحتوي على أزرار `+` و `-`. الضغط على رقم الكمية يفتح لوحة أرقام **Numpad** لإدخال كمية دقيقة.
  * **إجراءات سطر الطلب (Line Item Actions):** بجانب كل سطر، يوجد زر (مثل "...") يفتح قائمة إجراءات سريعة:
      * **المُعدِّلات (Modifiers):** فتح شاشة لإضافة/إزالة "الإضافات" (Add-ons) و"المنزوعات" (Removals). لكل صنف ملف مُعدِّلات خاص به، مع إمكانية تسعير الإضافات.
      * **الملاحظات (Notes):** إضافة نص حر يُرسل للمطبخ.
      * **خصم البند (Item Discount):** تطبيق خصم (نسبة أو قيمة) على هذا السطر فقط (يتطلب PIN).
      * **حذف البند (Delete Item):** إزالة السطر من الطلب (يتطلب PIN).

##### **2.3 إدارة الطاولات والحجوزات (Dine-in Flow)**

  * **خريطة الطاولات (Table Map):** عند اختيار نوع الطلب "صالة"، تظهر نافذة Modal تعرض خريطة للطاولات مع حالاتها مرمزة بصريًا:
      * 🟢 **فارغة (Available):** قابلة للاختيار.
      * 🟠 **مشغولة (Occupied):** عليها طلب واحد أو أكثر.
      * 🔵 **محجوزة (Reserved):** مرتبطة بحجز مستقبلي.
      * ⚫ **صيانة (Out of Service):** غير متاحة.
  * **عرض الطلبات المعلقة:** الضغط على طاولة **مشغولة** يعرض قائمة بالطلبات المفتوحة ("المعلقة") عليها. يمكن للمستخدم اختيار طلب من هذه القائمة لتحميله في سلة الطلب الحالية بهدف تعديله أو تسويته (دفعه).
  * **علاقات مرنة (Many-to-Many):**
      * **الطلب الواحد يمكن أن يشغل عدة طاولات:** (مثل العزومات الكبيرة).
      * **الطاولة الواحدة يمكن أن يكون عليها عدة طلبات:** (مثل مجموعة أصدقاء يدفع كل منهم فاتورته). يتم هذا عبر ميزة **Unlock Table** التي تسمح ببدء طلب جديد على طاولة مشغولة.
  * **نظام الحجوزات (Reservations):**
      * **إنشاء حجز:** يمكن إنشاء حجز غير مرتبط بطلب، يحتوي على (اسم العميل، رقم الهاتف، عدد الأفراد، تاريخ ووقت البدء، الطاولات المختارة، ملاحظات).
      * **قفل تلقائي:** الحجز يقوم بقفل الطاولات المرتبطة به وتغيير حالتها إلى "محجوزة" خلال فترة الحجز.
      * **إدارة الحجوزات:** وجود واجهة لاستعراض الحجوزات القادمة، تعديلها، أو إلغائها.

##### **2.4 إدارة المرتجعات (Returns Module) - (عملية عميقة)**

  * **الشروط:** لا يمكن عمل مرتجع إلا على فاتورة **مدفوعة (Paid)** ومغلقة. الوصول للوظيفة يتطلب PIN.
  * **آلية العمل:**
    1.  يتم استدعاء الفاتورة الأصلية.
    2.  الضغط على زر "مرتجع" يفتح شاشة جديدة تشبه سلة الطلب.
    3.  هذه الشاشة تعرض **فقط أصناف الفاتورة الأصلية**، مع عرض الكمية **المتبقية القابلة للإرجاع** (الكمية الأصلية - الكميات المرتجعة سابقًا).
    4.  يقوم المستخدم بالضغط على الأصناف لإضافتها إلى "سلة المرتجعات". لا يمكن تجاوز الكمية القابلة للإرجاع.
    5.  **لا توجد خصومات أو تعديلات:** المرتجع هو عملية عكسية بالسعر الأصلي المدفوع.
    6.  عند الحفظ، يتم إنشاء **فاتورة مرتجع** جديدة بسريال خاص بها، وترتبط برقم الفاتورة الأصلية.
  * **تعدد المرتجعات:** يمكن عمل **أكثر من عملية مرتجع** على نفس الفاتورة الأصلية، وفي كل مرة يتم تحديث الكميات القابلة للإرجاع.
  * **الاستعراض:** يجب أن توفر الواجهة طريقة لاستعراض كل فواتير المرتجعات المرتبطة بطلب معين، مع إمكانية طباعة أو حذف (بـ PIN) أي منها.

##### **2.5 إدارة المدفوعات ومردوداتها (Payments & Refunds)**

  * **الدفع المقسم (Split Payments):** يمكن للعميل دفع الفاتورة باستخدام أكثر من وسيلة دفع (جزء نقدي، جزء فيزا، ...). الواجهة تعرض المبلغ المتبقي بعد كل دفعة.
  * **مردودات المدفوعات (Payment Refunds):**
      * هي عملية مالية مستقلة عن مرتجع الأصناف.
      * تسمح بعكس عملية دفع تمت على طلب.
      * **الآلية:** يمكن للمستخدم اختيار **ربط المردود بعملية دفع أصلية** (مثلاً: عكس عملية فيزا بقيمة 50 جنيه)، أو عمل **مردود غير مرتبط** (مثلاً: إرجاع 50 جنيه نقدًا كتعويض للعميل بغض النظر عن طريقة الدفع الأصلية).

##### **2.6 التقارير (Reports Module)**

  * يجب توفير واجهة تقارير داخلية تسحب بياناتها مباشرة من IndexedDB للسرعة.
  * **أنواع التقارير المطلوبة:**
      * **تقرير الوردية (Shift Report):** يعرض ملخص الوردية الحالية أو أي وردية سابقة (الرصيد الافتتاحي، إجمالي المبيعات، تفصيل المبيعات حسب وسيلة الدفع، الخصومات، المرتجعات، صافي النقدية).
      * **تقرير المبيعات (Sales Report):** يمكن فلترته حسب التاريخ. يعرض المبيعات مجمعة حسب الصنف أو التصنيف.
      * **تقرير الطلبات (Orders Report):** قائمة بجميع الطلبات يمكن فلترتها حسب (الحالة، النوع، الموظف، الطاولة)، مع إمكانية فتح أي طلب لعرض تفاصيله أو إعادة طباعته.

----# 📦 الوثيقة الفنية الشاملة — POS للمطاعم v1.1 (Framework‑Agnostic) + ملحق Mishkah v5

> **الغرض العام:** صياغة مرجع تنفيذي مفصّل لبناء شاشة POS للمطاعم بمستوى عالمي. يبدأ المستند بتوصيف **غير مرتبط بإطار عمل** يحدد المكوّنات العامة القابلة لإعادة الاستخدام في أي تطبيق ويب، ثم **ملحق تطبيقي** يربطها مباشرة بمكتبة Mishkah v5 (Truth/Commands/Regions/DSL).
> **النتيجة المتوقعة:** كتالوج مكوّنات عامة صغيرة (Atoms/Molecules/Overlays/Utilities) + ربط تركيبي لمكوّنات POS المتخصصة + خطة ملفات: `pos.html`, `pos-comp.js`, `pos.js`.

---

## 0) صورة عامة سريعة

* شاشة ملء كامل 100vh/100vw بلا تمرير رئيسي؛ التمرير رأسي محصور في لوح **القائمة** ولوح **الطلب**.
* واجهة لمس أولًا (Touch‑First) + دعم لوحة مفاتيح واختصارات + وصولية (A11y).
* ثيم Light/Dark، دعم RTL/LTR، I18n كامل.
* تخزين محلي IndexedDB + مزامنة WebSocket (KDS/Delivery)؛ طباعة حرارية 58/80mm.

---

## 1) المكوّنات العامة (Framework‑Agnostic Catalog)

> هذه **لبنات جنيريك** تصلح لأي تطبيق. سنستخدمها لبناء مكوّنات POS المتخصصة. لكل مكوّن نذكر: الهدف، أهم الخصائص (Props)، الأحداث (Events)، الوصولية/الأداء، وملاحظات الثيم.

### 1.1 Atoms (أساسيات واجهة)

1. **IconEmoji**

   * الهدف: أيقونة خفيفة عبر Unicode/Emoji.
   * Props: `{ char:string, label?:string, size?:'sm'|'md'|'lg' }`
   * A11y: `aria-label` عند وجود `label`.

2. **Button**

   * الهدف: زر عام بمتغيرات تصميمية.
   * Props: `{ intent:'primary'|'success'|'warning'|'danger'|'neutral', variant:'solid'|'outline'|'ghost', size:'sm'|'md'|'lg', loading?:boolean, disabled?:boolean, leftIcon?:string, rightIcon?:string }`
   * Events: `data-onclick` (يُربط بأوامر).
   * A11y: دور `button`, دعم `aria-busy`.

3. **Badge / Chip**

   * الهدف: شارات/كبسولات حالة أو فلاتر.
   * Props: `{ tone:'info'|'success'|'warning'|'danger'|'neutral', size, dismissible? }`.

4. **Input / NumberInput / DecimalInput / Textarea / SelectBase / Switch / Checkbox / Radio**

   * الهدف: مدخلات قياسية بتركيز مرئي.
   * Props مشتركة: `{ value, placeholder, disabled, invalid, helperText?, onInput, onChange }`.

5. **Divider / Separator**

   * الهدف: فاصل بصري رفيع.

6. **PriceText**

   * الهدف: عرض عملة منسّقة حسب اللغة/الثيم.
   * Props: `{ value:number, currency?:string, compact?:boolean }`.

7. **QtyStepper**

   * الهدف: تحكم بسيط `+ / −` مع عرض كمية.
   * Props: `{ value:number, min?:number, max?:number }`;  Events: `data-oninc`, `data-ondec`, `data-onpressqty` (لفتح Numpad).

8. **Avatar / StatusDot** *(اختياريان)*

   * الهدف: هوية المستخدم + مؤشر حالة.

### 1.2 Layout (تخطيطات خفيفة)

9. **Card / Surface / Panel**

   * مناطق `header/body/footer`, ظلال ناعمة، حواف 2xl.

10. **Stack / HStack / VStack / Grid / ResponsiveGrid**

    * الهدف: تركيبات متكررة لتسريع البناء المرئي.

11. **Toolbar / Segmented**

    * الهدف: شريط إجراءات أو تبويب مقطعي بسيط (لنوع الخدمة مثلاً).

12. **ScrollArea**

    * الهدف: تمرير داخلي بعرض/ارتفاع ثابتين مع ظلال داخلية عند الحواف.

13. **PageHeader**

    * الهدف: عنوان + منطقة إجراءات.

### 1.3 Overlays (تراكبات)

14. **Modal**

    * Props: `{ open:boolean, title?:string, size?:'sm'|'md'|'lg'|'xl'|'full', closeOnEsc?:true, closeOnOutside?:true }`
    * A11y: `role=dialog`, `aria-modal`, Trap فوكس، إغلاق بـ ESC/خارج.

15. **Sheet (Drawer)**

    * المواضع: `right|left|bottom`.
    * الاستخدام: مدفوعات/مُعدِّلات/مرتجعات/تفاصيل طاولة.

16. **Popover / Tooltip / ContextMenu**

    * منبثقات سريعة مرتبطة بمرساة.

17. **ConfirmDialog**

    * تأكيد إجراء حساس (حذف/خصم/قفل…)، أزرار `Confirm/Cancel`.

18. **Toast / ToastStack**

    * رسائل عابرة بمستويات متعددة ومواضع مختلفة.

### 1.4 إدخال متقدّم وبحث

19. **SearchBar** *(جديد)*

    * Props: `{ value, placeholder, onSearch, chips?:Array<{id,label,icon?,removable?}> }`
    * يدعم اختصارات (`/` للتركيز)، وحذف كبسولات.

20. **AsyncSelect / Combobox**

    * تحميل متأخر + حالة Loading/Empty/Error + Debounce.

21. **NumpadInteger / NumpadDecimal** *(جديدان)*

    * شبكة 3×4 + مفاتيح: `C`, `⌫`, `OK`.
    * Props: `{ value, min?, max?, title?, confirmLabel? }`.
    * أحداث: `data-onconfirm`, `data-onclose`.

22. **PinPrompt** *(جديد)*

    * مبني على Modal + Numpad؛ للتحقق من PIN قبل أفعال حساسة.

23. **OtpInput** *(اختياري)*

    * إدخال أكواد قصيرة من عدة خانات.

### 1.5 قوائم وجداول

24. **List / ListItem** *(جديدان)*

    * صف عام مع `leading|content|trailing` + قائمة إجراءات (⋯).

25. **VirtualList / VirtualGrid** *(جديدان)*

    * افتراضية للعناصر > 100 لخفض تكلفة DOM.

26. **DataTable / DataTablePro (تحسين)**

    * فرز/تصفية/تجميع/ترقيم صفحات + تحميل من مصدر غير متزامن + Empty/Loading/Error + تحديد صفوف + أعمدة قابلة للإخفاء.

### 1.6 Utilities (مرافق)

27. **CurrencyUtil**: تنسيق/تحليل العملات.
28. **Hotkeys**: تسجيل اختصارات عالمية.
29. **PortalRoot / FocusTrap**: لوجستيات التراكبات.
30. **Exporter**: طباعة/تصدير HTML/CSV.
31. **PrintPreview** *(جديد)*: معاينة طباعة حرارية 58/80mm مع خطوط ثابتة العرض.
32. **LoadingOverlay / Skeleton / Spinner**.
33. **EmptyState** *(جديد)*: حالة لا نتائج بأيقونة ورسالة وإجراء.
34. **FormHint / FieldError**: رسائل مساعدة وأخطاء نماذج.
35. **KeymapHelp** *(جديد)*: نافذة مساعدة اختصارات.

> **حالة التوافر:** بعض هذه المكوّنات موجود وجاهز، وبعضها يحتاج **تحسين**، وأخرى **جديدة** سنضيفها. الترتيب الزمني للإضافة في §6.

---

## 2) مكوّنات POS المتخصصة (مبنية فوق العامة)

> تُحفظ في `pos-comp.js`، **ممنوع** وضع مكوّن عام فيها.

* **TopBar.POS**: شعار/ثيم/لغة/حالة ورديّة/تسجيل دخول.
  *يبنى من*: PageHeader + Button + Badge + IconEmoji.

* **OrderHeader.POS**: اختيار نوع الخدمة (صالة/دليفري/تيك أواي) + زر **TableMap** أو **CustomerPicker**.
  *يبنى من*: Segmented + Button + SearchBar/AsyncSelect.

* **MenuGrid.POS**: شبكة أصناف ببحث وتصنيفات؛ Lazy + VirtualGrid؛ نقرة تضيف سطرًا.
  *يبنى من*: SearchBar + Chip + Card + VirtualGrid + EmptyState.

* **OrderLinesList.POS**: أسطر الطلب مع **QtyBadge** و**LineQuickActions** (⋯: Notes/Removals/Add‑ons/Discount/Delete/Return).
  *يبنى من*: List/ListItem + QtyStepper + Popover/Sheet + ConfirmDialog + PinPrompt.

* **ModifiersSheet.POS**: مجموعات (addon/removal/sub/size) مع قواعد min/max وتسعير فوري.
  *يبنى من*: Sheet + Tabs + List + Checkbox/Radio + Badge.

* **TablesModule.POS**:

  1. **TableMap**: خريطة سريعة بحالات 🟢🟠🔵⚫ + Merge/Split/Move/Lock.
  2. **TableList**: بحث/فرز/سعة/موقع.
  3. **TableDetails**: **Orders المعلقة على الطاولة** (فتح/استئناف/تحصيل)، **Reservations** (إنشاء/تعديل/إلغاء/تفعيل)، **Guests**، Lock/Unlock.
     *يبنى من*: DataTablePro + Sheet/Modal + Toolbar + Badge + IconEmoji + Button + List/ListItem + DescriptionList.

* **CustomerPicker.POS**: بحث بالهاتف/الاسم + إنشاء عميل/عنوان جديد (Select قابل للبحث) + عرض مختصر بيانات العميل.
  *يبنى من*: AsyncSelect/Combobox + Modal/Sheet + Form primitives.

* **PaymentsSheet.POS**: وسائل `cash|card|wallet|online|coupon` مع **Split** (byAmount/byItems/byGuests)، متبقي حيّ، وإقفال.
  *يبنى من*: Sheet + NumpadDecimal + Segmented + List + InlineAlert + DescriptionList + PrintPreview.

* **PaymentRefundSheet.POS**: عكس مدفوعات (مقيد بعملية أصلية أو حرّ).
  *يبنى من*: Sheet + DataTable + NumpadDecimal + ConfirmDialog + PinPrompt.

* **ReturnsSheet.POS**: مرتجعات **عميقة** بعد الدفع فقط؛ تظهر **العناصر القابلة للإرجاع** وكمياتها المتبقية؛ لا خصومات/تعديلات؛ تُنشئ سندات مرتجع متعددة مرتبطة بالفاتورة الأصلية؛ طباعة/حذف بـ PIN.
  *يبنى من*: Sheet + List/ListItem + NumpadInteger + DescriptionList + DataTable + PinPrompt + ConfirmDialog + PrintPreview.

* **ReportsPanel.POS**: تقارير (Shift / Sales / Orders) مع فلاتر حيّة ومصادر IndexedDB، وفتح الطلب من النتائج.
  *يبنى من*: DataTablePro + DateRange + AsyncSelect + Exporter + Toolbar + EmptyState.

* **PrintPreviewSheet.POS**: معاينة حرارية 58/80mm (Kitchen/Customer) + أمر فتح درج الكاش.
  *يبنى من*: Modal/Sheet + PrintPreview + Button.

* **FooterActionBar.POS**: شريط ثابت: Save, Park/Resume, Print, Settle.
  *يبنى من*: Toolbar + Button + IconEmoji.

---

## 3) نماذج بيانات موجزة (كيانات رئيسية)

* **Item**: `id, category, translations{ar,en}, price, image?, modifiers_profile_id?, tax_group?`
* **ModifiersProfile**: `groups[{ id, label{ar,en}, type(addon|removal|sub|size), selection(single|multi), min?, max?, items[{id,label{ar,en},priceDelta?,defaultIncluded?}] }]`
* **Table**: `id, name, section?, seats, status('free'|'occupied'|'cleaning'|'locked'), locked_by?`
* **Reservation**: `id, customer{name,phone}, table_ids[], headcount, time{start,end}, status('pending'|'active'|'canceled'|'done')`
* **Customer**: `id, name, phone, notes?, addresses[{id,label,line1,area,city,geo?}]`
* **Order**: `id, type('dine_in'|'takeaway'|'delivery'), table_ids?, customer?, status('new'|'in_preparation'|'prepared'|'delivered'|'paid'), lines[], discount_total, service, delivery_fee, vat, grand_total, shift_id?, cashier?, created_at, updated_at`
* **OrderLine**: `id, item_id, title, qty, price, mods{addons[],removals[],subs?,size?}, modDelta, discount?, notes?`
* **Payment**: `id, order_id, method('cash'|'card'|'wallet'|'online'|'coupon'), amount, currency, split_id?, guest_name?`
* **Return**: `id, base_order_id, lines[{order_line_id, qty}], total, created_at`
* **PaymentRefund**: `id, order_id, amount, method, original_payment_id?`
* **Shift / Employee**: كما هو متعارف.

---

## 4) تدفّقات رئيسية (Flows)

### 4.1 إضافة صنف + معدِّلات

* نقرة على بطاقة الصنف → إنشاء OrderLine افتراضي. إن كان `modifiers_profile_id` موجودًا، فتح **ModifiersSheet.POS**. عند الحفظ: حساب `modDelta` وتحديث الإجماليات.

### 4.2 تعديل الكمية السريع

* النقر على شارة الكمية أو القيمة → **NumpadInteger** → تأكيد → تحديث السطر ثم `computeTotals()`.

### 4.3 شريط إجراءات السطر (⋯)

* **Notes**: نص حر للمطبخ.
* **Removals/Add‑ons**: فتح **ModifiersSheet.POS**.
* **Discount**: خصم بند (نسبة/قيمة) يتطلب **PinPrompt** حسب صلاحيات المستخدم.
* **Delete**: حذف بند مع **ConfirmDialog + PinPrompt**.
* **Return**: (للسندات المدفوعة فقط) ينقل للسياق **ReturnsSheet.POS** مع قيد الكميات المتبقية.

### 4.4 الطاولات والحجوزات (Dine‑in)

* **TableMap**: حالات 🟢 مشفّرة لونيًا، **Occupied** تعرض عدد الطلبات المعلقة. النقر يظهر **TableDetails** بقائمة **Orders على الطاولة** (فتح/استئناف/تحصيل)، و**Reservations** (إنشاء/تعديل/إلغاء).
* **Many‑to‑Many**:

  * طلب واحد ⇢ عدة طاولات (عزومات).
  * طاولة واحدة ⇢ عدة طلبات (أصدقاء كلٌ بسند منفصل) عبر **Unlock** المؤقت ثم **Lock** بعد الإسناد.

### 4.5 المدفوعات والتقسيم

* **PaymentsSheet.POS**: إضافة دفعات متعددة بوسائل مختلفة؛ **Split** حسب المبلغ/العناصر/الضيوف؛ متابعة المتبقي حيًا؛ عند `finalize` تغيّر الحالة إلى `paid` ثم طباعة وإرسال أمر فتح درج الكاش.

### 4.6 المرتجعات العميقة (Returns)

* متاحة فقط للأوامر **Paid**.
* الشاشة تعرض فقط **أسطر الفاتورة الأصلية** بكميات **قابلة للإرجاع** (الأصل − ما أُرجِع سابقًا).
* لا خصومات/تعديلات؛ السعر بحسب الأصل.
* حفظ ⟶ إنشاء سند مرتجع جديد **مرتبط** بالأصل، ويمكن وجود **عدة سندات** للأصل ذاته، مع طباعة/حذف (PIN).

### 4.7 مردودات المدفوعات (Payment Refunds)

* عكس مالي مستقل يمكن **ربطه** بعملية دفع أصلية (رد إلى بطاقة/محفظة) أو **غير مرتبط** (نقد/تعويض).
* يتطلب صلاحيات + **PinPrompt**؛ يسجّل في دفتر المدفوعات.

### 4.8 التقارير (Reports)

* **Shift Report**: رصيد افتتاحي/إجمالي مبيعات/تفصيل وسائل الدفع/خصومات/مرتجعات/صافي نقدية.
* **Sales Report**: تجميع حسب الصنف/التصنيف ضمن مدى تاريخ.
* **Orders Report**: فلترة حسب (الحالة/النوع/الوردية/الموظف/الطاولة)، فتح الطلب/إعادة الطباعة من النتيجة.

### 4.9 الطباعة الحرارية 58/80mm

* قوالب **Kitchen** و**Customer**؛ أسطر بتنسيق:
  `• Big Mac`
  `  + Extra Cheese x2  +7.00`
  `  − No Onion`
* أسعار **شاملة الضريبة**؛ محاذاة إجماليات يمين؛ لغتان واتجاهان.

---

## 5) الوصولية والأداء والاختصارات

* **A11y**: ESC للإغلاق، Trap فوكس، `aria-*` منظمة، تركيز مرئي واضح.
* **الأداء**: ≤16ms/Frame في المناطق الساخنة؛ افتراضية القوائم >50 عنصرًا؛ Lazy Images؛ دفعات تحديث truth.
* **Hotkeys**: `F1` مساعدة، `F2` لغة، `F3` بحث، `Alt+Q` Numpad، `Alt+P` طباعة، `Alt+S` تحصيل.

---

## 6) خطة تنفيذ المكوّنات العامة (أولوية الإضافة/التحسين)

1. **Modal, Sheet, ConfirmDialog, Toast** (تثبيت المعايير والوصولية).
2. **NumpadInteger, NumpadDecimal, PinPrompt**.
3. **SearchBar, Tabs, List/ListItem, EmptyState**.
4. **VirtualList/VirtualGrid** (أداء القوائم).
5. **DataTablePro (تحسين التحميل غير المتزامن + Empty/Loading/Error + انتقاء أعمدة)**.
6. **PrintPreview (58/80mm)** + Exporter hooks.
7. **KeymapHelp, ScrollArea, QtyStepper, PriceText**.

> **بعد اكتمال (1→3)** يمكن تركيب أول دفعة من مكوّنات POS: LineQuickActions, ModifiersSheet, ReturnsSheet الأساسية.

---

## 7) هيكل الملفات والمسؤوليات (بلا كود)

* **pos.html**: تحميل Tailwind/ثيم + ملفات Mishkah + حاوية `#app`؛ لا منطق.
* **pos-comp.js**: جميع مكوّنات POS **المتخصصة** المبنية على Comp العامة (لا Atoms إلا للضرورة القصوى).
* **pos.js**: تهيئة التطبيق (Core.createApp)، تعريف `initial truth`, `commands`, `regions`, i18n dictionaries, Mock‑Data، ربط IndexedDB/WebSocket، وحسابات الإجماليات.

---

# 📎 ملحق Mishkah v5 — ربط المواصفات بالتنفيذ

## A) مبادئ Mishkah v5

* **الحقيقة الواحدة**: `app.truth` هو المصدر الوحيد للحالة. التعديل حصريًا داخل **أوامر** (commands) مع `truth.set()` و`truth.batch()`.
* **الكيانات المسجّلة**: أي مكوّن يُستدعى مع `uniqueKey` يُخاطَب مباشرة ويُعلَّم بالـ `data-m-k`; مجموعات عبر `groupKey` بـ `data-m-g`.
* **التحديث الجراحي**: بعد كل أمر، علّم أصغر Region متأثر: `truth.mark('menu-panel')`, `truth.mark('order-panel')`, …؛ استخدام `truth.rebuild()` عند تغيير جذري، و`truth.rebuildAll({ except })` للّغة/الثيم.
* **تفويض الأحداث**: اربط التفاعلات بسمات `data-on*` فقط.
* **البيئة**: `env.toggleTheme()`, `env.setLocale()`, `env.toggleDir()`؛ كل التنسيقات عبر خاصية `tw` المتوافقة مع RTL/Dark.

## B) خريطة المناطق (وبودجت الأداء)

* `pos-header` — 8ms
* `menu-panel` — 12ms
* `order-panel` — 12ms
* `footer-bar` — 6ms
* `modals-root` — 8ms
* `toasts-root` — 4ms

## C) واجهات المكوّنات العامة (شكل DSL مختصر)

> **مثال — NumpadInteger**

* Props: `{ value, min=1, max?, title?, confirmLabel?='OK' }`
* Events: `data-onconfirm="pos.numConfirm"`, `data-onclose="ui.closeSheet"`
* أوامر متوقعة: `numKey`, `numSync`, `numConfirm(lineId,value)` → تحدّث `order.lines[idx].qty` ثم `computeTotals()` ثم `truth.mark('order-panel')`.

> **مثال — PinPrompt**

* Props: `{ reason:'delete_line'|'bill_discount'|'returns'|'refund'|..., attempts?:3 }`
* Events: `data-onverify="sec.verifyPin"` → نجاح: متابعة الإجراء؛ فشل: Toast تحذيري؛ تسجيل المحاولة في `audit`.

> **مثال — ListItem**

* Slots: `leading|content|trailing`;
* Events: `data-onclick`, `data-onmore` (لفتح Popover بالإجراءات).
* استخدام في **OrderLinesList.POS** و**ReturnsSheet.POS** و**ReportsPanel.POS**.

## D) ربط POS ⇆ Comp (خرائط تركيب)

* **MenuGrid.POS** ⇢ SearchBar + Chip + Card + VirtualGrid + EmptyState.
* **OrderLinesList.POS** ⇢ List/ListItem + QtyStepper + Popover/Sheet + PinPrompt + ConfirmDialog.
* **ModifiersSheet.POS** ⇢ Sheet + Tabs + Checkbox/Radio + List + Badge.
* **TablesModule.POS** ⇢ DataTablePro + Toolbar + List + Modal/Sheet + DescriptionList + IconEmoji.
* **PaymentsSheet.POS** ⇢ Sheet + Segmented + NumpadDecimal + DescriptionList + InlineAlert + PrintPreview.
* **PaymentRefundSheet.POS** ⇢ Sheet + DataTable + NumpadDecimal + PinPrompt + ConfirmDialog.
* **ReturnsSheet.POS** ⇢ Sheet + List/ListItem + NumpadInteger + DescriptionList + DataTable + PinPrompt + PrintPreview.
* **ReportsPanel.POS** ⇢ DataTablePro + DateRange + AsyncSelect + Exporter + Toolbar + EmptyState.
* **FooterActionBar.POS** ⇢ Toolbar + Button + IconEmoji.

## E) قواميس I18n — مفاتيح أساسية

```
ui: {
  shift, active, inactive, dark, light, search, dine_in, takeaway, delivery,
  select, table, customer, guest, subtotal, service, delivery_fee, vat, total,
  save_order, print, settle_pay_print, no_items, discount, confirm, cancel,
  return, notes, removals, addons, override_price, close, qty,
  reports, status, type, cashier, shift_no, prepared, delivered, paid,
}
```

## F) خطة التنفيذ المرحلية

1. **المكتبة العامة أولًا**: Modal/Sheet/Confirm + Numpad(s) + PinPrompt + SearchBar + Tabs + List/ListItem + EmptyState.
2. **POS الدفعة 1**: MenuGrid.POS + OrderLinesList.POS + LineQuickActions + ModifiersSheet.POS (أساسي).
3. **POS الدفعة 2**: TablesModule.POS (Map/List/Details) مع عرض **الطلبات المعلقة لكل طاولة** + Reservations CRUD + Lock/Unlock/Merge/Split/Move.
4. **POS الدفعة 3**: PaymentsSheet.POS + Split + PrintPreviewSheet.POS + أمر فتح درج الكاش.
5. **POS الدفعة 4**: ReturnsSheet.POS (مرتجعات متعددة للأصل) + PaymentRefundSheet.POS (مقيد/غير مقيد).
6. **POS الدفعة 5**: ReportsPanel.POS + تكامل IndexedDB/WebSocket.
7. **POS الدفعة 6**: FooterActionBar.POS + TopBar.POS المتقدّم (Shift/Reports/Close Shift).

## G) معايير القبول الخاصة بالتفاصيل المنسية (تأكيد)

* **الحجوزات**: إنشاء/تعديل/إلغاء، قفل زمني للطاولات، تحقق سعة ≥ headcount، تنشيط تلقائي عند بدء الموعد.
* **الطلبات المعلقة على الطاولات**: تظهر في **TableDetails** مع إجراءات: فتح/استئناف/تحصيل/نقل.
* **المرتجعات العميقة**: لا تتجاوز الصافي، تمنع تجاوز الكميات، سيريال مستقل، ربط بالأصل، استعراض/طباعة/حذف (PIN)، تعدد السندات للأصل.
* **مردودات المدفوعات**: عكس مقيد/غير مقيد، يسجّل بدفتر مستقل، يتطلب PIN، يظهر في تقارير الوردية.
* **التقارير التفصيلية**: سريعة من IndexedDB، فلاتر حية، فتح الطلب من النتائج، تصدير CSV/طباعة.
* **الأداء**: افتراضية القوائم، Lazy Images، ≤16ms/Frame، لا Rebuild شامل إلا عند الضرورة.

---

> **خلاصة تنفيذية:** قبل لمس `pos-comp.js` نُكمّل المكوّنات العامة الناقصة (SearchBar, Tabs, NumpadInteger/Decimal, PinPrompt, List/ListItem, EmptyState, VirtualList/Grid, PrintPreview، وتحسين DataTablePro). عندها يصبح تركيب موديولات POS (الحجوزات، الطلبات المعلقة، المرتجعات العميقة، مردودات المدفوعات، التقارير) مباشرًا وقياسيًا، مع التزام صارم بفصل الحالة (Truth) عن المنطق (Commands) عن العرض (Comp/Atoms) وتحديث جراحي للمناطق.-

