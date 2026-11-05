# 09 — المرتجعات: مرتجع البيع ومرتجع الشراء (Returns Module)

> **إلى الذكاء الاصطناعي المنفِّذ:** يغطي هذا الملف ورقة `المرتجعات` كاملة (الشرائح `19`، `20`، `22–24`، `31`، `58`).

---

## 1. المفهوم الأساسي للمرتجعات في النظام

في هذا النظام، كل سطر مرتجع (`ReturnLine`) يجب أن يرتبط بـ **سطر فاتورة أصلي محدد (`sourceSaleLineId` أو `sourcePurchaseLineId`)**:
- **لماذا الربط بسطر المصدر وليس برقم الفاتورة فقط؟**
  لأن الفاتورة الواحدة قد تضم عدة أصناف أو نفس الصنف بسعرين، وسطر المصدر (`S000001` أو `P000001`) هو الذي يحدد بدقة:
  1. `الصنف` (`ItemID`) و`الوحدة`.
  2. `الكمية الأصلية` (`OriginalQty`) لمنع إرجاع كمية أكبر مما بيع أو اشتُري.
  3. `صافي سعر الوحدة الأصلي` (`OriginalNetUnitPrice = SourceNetAmount / OriginalQty`).
  4. `شهر الفاتورة الأصلية` (`SourceMonth`) لحساب تكلفة المرتجع بدقة حتى لو حدث المرتجع في شهر أو عام لاحق.

---

## 2. حقول الإدخال وقواعد التحقق (`ReturnLine`)

### 2.1 خطوات الإدخال التسلسلية السهلة في الواجهة (`/returns/new`)
1. `type` (نوع المرتجع - إلزامي): `مرتجع بيع (SALE_RETURN)` أو `مرتجع شراء (PURCHASE_RETURN)`.
2. `returnDate` (تاريخ المرتجع - إلزامي): تاريخ تقويمي `>= DATE(startYear, 1, 1)` و`>= تاريخ الفاتورة الأصلية` (`sourceDate`).
3. `returnDocNo` (رقم مستند المرتجع - إلزامي): يُقترح تلقائياً (`RT-001`, `RT-002`...) مع إمكانية تعديله.
4. `partyId` (الطرف - إلزامي):
   - إذا كان `SALE_RETURN`: قائمة العملاء الذين لديهم فواتير بيع.
   - إذا كان `PURCHASE_RETURN`: قائمة الموردين الذين لديهم فواتير شراء.
5. `invoiceKey` (رقم الفاتورة الأصلية - إلزامي): قائمة فواتير الطرف المختار مع سنتها (مثل `2026 | S-1001`).
   - *لا يُسمح باختيار هدايا السائقين العينية (`DRIVER_GIFT`) كمصدر لمرتجع بيع (`SourceEligible = 0`).*
6. `sourceLine` (سطر المصدر - إلزامي): قائمة سطور الفاتورة المختارة، وتعرض للمستخدم بوضوح:
   `S000001 — عود طبيعي إندونيسي | الكمية الأصلية: 40 جرام | المتبقي القابل للإرجاع: 30 جرام | صافي سعر الوحدة: 25,000`
7. `qty` (الكمية المرتجعة - إلزامي): رقم عشري `> 0`.
   - **شرط السقف التراكمي (`CumulativeCandidateQty <= OriginalQty`):**
     مجموع الكميات المرتجعة المعتمدة سابقاً لنفس السطر الأصلي + الكمية الحالية **يجب ألا يتجاوز `الكمية الأصلية`** (مع هامش `1e-9`).
     - رسالة الخطأ عند التجاوز: `"إجمالي الكمية المرتجعة لهذا السطر يتجاوز الكمية الأصلية في الفاتورة (المتبقي القابل للإرجاع: X وحدة)"`.
8. **حقول خاصة بـ `مرتجع بيع` فقط:**
   - `saleReturnCondition` (حالة مرتجع البيع - إلزامي):
     - `GOOD` (`صالح`): البضاعة سليمة وتعود إلى المخزون القابل للبيع.
     - `DAMAGED` (`تالف`): البضاعة تالفة؛ **لا تعود للمخزون القابل للبيع** وتُحمَّل تكلفتها كمصروف تلف مرتجع (`DamagedReturnExpense`).
   - يُمنع إدخال `supplierCreditNote` في مرتجع البيع (`null` دائماً).
9. **حقول خاصة بـ `مرتجع شراء` فقط:**
   - `saleReturnCondition` فارغ (`null` دائماً).
   - `supplierCreditNote` (إشعار المورد الفعلي - اختياري):
     - إذا تُرك فارغاً: يحسب النظام قيمة إشعار المورد تلقائياً بتكلفة الشراء الأصلية (`qty * OriginalPurchaseUnitCost`).
     - إذا أُدخِل رقم `>= 0`: يعتمد النظام هذا الرقم كقيمة تخفيض دين المورد (`PurchaseCredit`)، والفرق بينه وبين تكلفة خروج المخزون يظهر في `PurchaseVariance` (`فروق مرتجع الشراء`).
10. `reason` (السبب - **إلزامي** في النوعين كما في صيغة `CandidateValid` في Excel).
11. `notes` (ملاحظة - اختياري).

### 2.2 ميزة التسهيل في الويب: "هل تم رد المال نقداً الآن؟"
عند حفظ مرتجع بيع على فاتورة مسددة (مثل مثال سالم باحسن في الشريحة `22`)، يظهر خيار اختياري في أسفل شاشة المرتجع:
- **`[ ] تسجيل رد المبلغ نقداً للعميل الآن`** (مع اختيار الحساب: `خزينة` أو `بنك`).
- إذا فعّله المستخدم، ينشئ النظام داخل نفس الـ `Transaction`:
  1. سطر المرتجع (`ReturnLine` مثل `R000002` بقيمة `100,000`) — وهذا يرفع الرصيد الدائن للفاتورة.
  2. حركة المدفوعات (`CashTransaction` بنوع `CUSTOMER_REFUND` مثل `C000005` بقيمة `100,000` على نفس `invoiceKey`) — وهذا يخرج النقد ويقفل الرصيد الدائن فوراً بخطوة واحدة!

---

## 3. المعادلات المحاسبية للمرتجع (مطابقة للأعمدة `O` إلى `AR` في ورقة `المرتجعات`)

لكل سطر مرتجع معتمد (`status = POSTED`):

1. **بيانات السطر الأصلي المستردة:**
   - `OriginalQty`: الكمية الأساسية في سطر البيع أو الشراء الأصلي.
   - `SourceAmount`: `netSaleAmount` (في البيع) أو `lineTotalCost` (في الشراء).
   - `OriginalNetUnitPrice` (`صافي سعر الوحدة الأصلي`): $\frac{\text{SourceAmount}}{\text{OriginalQty}}$.
   - `SourceMonth`: $\text{monthIndex}(\text{sourceInvoiceDate})$.
   - `ReturnMonth`: $\text{monthIndex}(\text{returnDate})$.

2. **الأثر المالي على مديونية الطرف:**
   - في **مرتجع البيع (`SALE_RETURN`):**
     $$\text{SalesCredit} = \text{qty} \times \text{OriginalNetUnitPrice}$$
   - في **مرتجع الشراء (`PURCHASE_RETURN`):**
     $$\text{PurchaseCredit} = \begin{cases} \text{qty} \times \text{OriginalNetUnitPrice} & \text{if supplierCreditNote is null} \\ \text{supplierCreditNote} & \text{otherwise} \end{cases}$$

3. **تقسيم كميات المرتجع لأغراض محرك المخزون والتكلفة:**
   - `GoodSalesQty` = `qty` إذا كان `SALE_RETURN` وحالته `GOOD`، وإلا `0`.
   - `DamagedSalesQty` = `qty` إذا كان `SALE_RETURN` وحالته `DAMAGED`، وإلا `0`.
   - `SameMonthPurchaseQty` = `qty` إذا كان `PURCHASE_RETURN` وكان `SourceMonth == ReturnMonth`، وإلا `0`.
   - `SameMonthPurchaseValue` = `SameMonthPurchaseQty * OriginalNetUnitPrice`.
   - `PriorPurchaseQty` = `qty` إذا كان `PURCHASE_RETURN` وكان `SourceMonth < ReturnMonth`، وإلا `0`.

4. **تكلفة المرتجع وفروقه في قائمة الدخل:**
   - **عكس تكلفة البيع (`ReturnSalesCost` — العمود `AO`):**
     $$\text{ReturnSalesCost} = \begin{cases} \text{qty} \times \text{ItemMonthlyAvgCost}(\text{itemId}, \text{SourceMonth}) & \text{if SALE\_RETURN} \\ 0 & \text{otherwise} \end{cases}$$
     *(لاحظ أنه يضرب في متوسط تكلفة **شهر البيع الأصلي `SourceMonth`** وليس شهر المرتجع!).*
   - **مصروف المرتجع التالف (`DamagedReturnExpense` — العمود `AR`):**
     $$\text{DamagedReturnExpense} = \begin{cases} \text{ReturnSalesCost} & \text{if saleReturnCondition} == \text{DAMAGED} \\ 0 & \text{otherwise} \end{cases}$$
   - **تكلفة المخزون الخارج بمرتجع الشراء (`InventoryOutCost` — العمود `AP`):**
     $$\text{InventoryOutCost} = \text{SameMonthPurchaseValue} + \text{PriorPurchaseQty} \times \text{ItemMonthlyAvgCost}(\text{itemId}, \text{ReturnMonth})$$
   - **فروق مرتجع الشراء (`PurchaseVariance` — العمود `AQ`):**
     $$\text{PurchaseVariance} = \text{PurchaseCredit} - \text{InventoryOutCost}$$
