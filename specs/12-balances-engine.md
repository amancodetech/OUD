# 12 — محرك الأرصدة والمديونية وأعمار الديون (Balances & Aging Engine)

> **إلى الذكاء الاصطناعي المنفِّذ:** يغطي هذا الملف المعادلات الدقيقة لأرصدة الفواتير، أرصدة العملاء والموردين، الأرصدة الافتتاحية، أعمار الديون (`Aging`)، والتسويات غير المربوطة، كما في أوراق `المديونية`، `المبيعات`، `المشتريات`، و`الأسماء وبيانات الاتصال`.

---

## 1. المعامل الزمني الموحّد (`asOfDate`)

جميع دوال محرك الأرصدة تقبل تاريخ قطع `asOfDate: string` (وهو نهاية فترة التقرير `reportEndDate`، مثلاً `2026-10-31` أو `2026-12-31`).
أي حركة تاريخها `<= asOfDate` وحالتها `POSTED` تدخل في الحساب.

---

## 2. حساب رصيد كل فاتورة (أو الرصيد الافتتاحي) حتى `asOfDate`

لكل طرف `P` (`CLIENT` أو `SUPPLIER`)، توجد "عناصر ذمم" (`Receivable/Payable Items`) تتكون من:
1. **بند الرصيد الافتتاحي (`invoiceKey = "افتتاحي"`):** إذا كان `Party.openingBalance != 0` أو وُجدت حركات نقدية مربوطة بـ `"افتتاحي"`.
2. **فواتير الطرف (`SaleInvoice` للعميل أو `PurchaseInvoice` للمورد):**

### 2.1 معادلات البند الواحد `(partyId, invoiceKey)` حتى `asOfDate`:

1. **القيمة الأصلية حتى القطع (`OriginalAsOf`):**
   - إذا كان `"افتتاحي"`: `Party.openingBalance` (موجب أو سالب).
   - إذا كانت فاتورة بيع/شراء:
     - إذا كان `invoiceDate <= asOfDate`: مجموع `PostedAmount` لسطور الفاتورة.
     - إذا كان `invoiceDate > asOfDate`: `0` *(قد توجد دفعة مقدمة مسجلة قبل تاريخ الفاتورة، فتظهر كـ `"مقدم على فاتورة لاحقة"` كما في العمود `AV` في المبيعات)*.

2. **إشعارات المرتجع (`ReturnsAsOf`):**
   - إذا كان `"افتتاحي"`: `0`.
   - للعميل: مجموع `Returns.SalesCredit` لنفس `(partyId, invoiceKey)` حيث `returnDate <= asOfDate`.
   - للمورد: مجموع `Returns.PurchaseCredit` لنفس `(partyId, invoiceKey)` حيث `returnDate <= asOfDate`.

3. **القبض / السداد (`SettlementAsOf`):**
   - للعميل: مجموع `Cash.AllocationAmount` لنفس `(partyId, invoiceKey)` بنوع `CUSTOMER_COLLECTION` حيث `txDate <= asOfDate`.
   - للمورد: مجموع `Cash.AllocationAmount` لنفس `(partyId, invoiceKey)` بنوع `SUPPLIER_PAYMENT` حيث `txDate <= asOfDate`.

4. **الرد النقدي (`RefundAsOf`):**
   - للعميل: مجموع `Cash.AllocationAmount` لنفس `(partyId, invoiceKey)` بنوع `CUSTOMER_REFUND` حيث `txDate <= asOfDate`.
   - للمورد: مجموع `Cash.AllocationAmount` لنفس `(partyId, invoiceKey)` بنوع `SUPPLIER_REFUND` حيث `txDate <= asOfDate`.

5. **الرصيد الصافي الموقّع (`SignedAsOf`):**
   $$\text{SignedAsOf} = \text{OriginalAsOf} - \text{ReturnsAsOf} - \text{SettlementAsOf} + \text{RefundAsOf}$$

6. **المستحق (`DebtAsOf`) والرصيد الدائن (`CreditAsOf`) على مستوى الفاتورة:**
   $$\text{InvoiceDebt} = \begin{cases} \text{SignedAsOf} & \text{if } \text{SignedAsOf} > 0.01 \\ 0 & \text{otherwise} \end{cases}$$
   $$\text{InvoiceCredit} = \begin{cases} -\text{SignedAsOf} & \text{if } \text{SignedAsOf} < -0.01 \\ 0 & \text{otherwise} \end{cases}$$

---

## 3. معادلة أيام التأخير وعمر الدين (`DaysOverdue` & `Aging`)

مطابقة تماماً للأعمدة `AS` و`AT` في `المبيعات` و`AL` و`AM` في `المشتريات`:

1. **أيام التأخير (`DaysOverdue`):**
   - إذا كان `InvoiceDebt > 0.01` وكان `dueDate` موجوداً:
     $$\text{DaysOverdue} = \max\left(0, \text{diffInDays}(\text{asOfDate}, \text{dueDate})\right)$$
   - وإلا: `0`.

2. **تصنيف العمر (`Aging`):**
   - إذا كان `SignedAsOf < -0.01` $\leftarrow$ `"رصيد دائن"`
   - وإلا إذا كان `InvoiceDebt <= 0.01` $\leftarrow$ `"مسدد"`
   - وإلا إذا كان `dueDate` فارغاً (أو في بند `"افتتاحي"`) $\leftarrow$ `"استحقاق غير محدد"`
   - وإلا إذا كان `dueDate >= asOfDate` (`DaysOverdue == 0`) $\leftarrow$ `"غير مستحق"`
   - وإلا إذا كان `DaysOverdue <= 30` $\leftarrow$ `"1–30"`
   - وإلا إذا كان `DaysOverdue <= 60` $\leftarrow$ `"31–60"`
   - وإلا إذا كان `DaysOverdue <= 90` $\leftarrow$ `"61–90"`
   - وإلا (`DaysOverdue > 90`) $\leftarrow$ `"أكثر من90"`

3. **نوع السطر في التقرير (`ReportClass`):**
   - إذا كان `"افتتاحي"` $\leftarrow$ `"رصيد افتتاحي"`
   - وإلا إذا كان `invoiceDate > asOfDate` (أي سُجلت دفعة قبل تاريخ الفاتورة) $\leftarrow$ `"مقدم على فاتورة لاحقة"`
   - وإلا $\leftarrow$ `"فاتورة"`

---

## 4. ملخص الطرف المجمع (`PartySummary` — الأعمدة `R5:AB35` في ورقة `المديونية` و`AO:AV` في `الأسماء`)

> **انتبه لهذه القاعدة المحاسبية المهمة (الشريحة 42 و43):**
> في هذا النظام، **الرصيد الدائن على فاتورة لا يخصم تلقائياً من فاتورة أخرى مستحقة لنفس العميل** في عمودَي `مستحق الفواتير` و`رصيد دائن للفواتير`، بل يظهر كلٌّ منهما منفصلاً، ثم يظهر بجانبهما `مستحق غير مغطى` و`التغطية`!

لكل طرف `P` (`CLIENT` أو `SUPPLIER`):
1. **`مستحق الفواتير` (`DebtAsOf` — العمود `AO` في الأسماء و`U` في المديونية):**
   $$\text{PartyDebtAsOf} = \text{OpeningDebtAsOf} + \sum_{k \in \text{invoices}(P)} \text{InvoiceDebt}_k$$
2. **`رصيد دائن للفواتير` (`CreditAsOf` — العمود `AP` في الأسماء و`V` في المديونية):**
   $$\text{PartyCreditAsOf} = \text{OpeningCreditAsOf} + \sum_{k \in \text{invoices}(P)} \text{InvoiceCredit}_k$$
3. **`صافي الرصيد` (`SignedAsOf` — العمود `AQ` في الأسماء و`W` في المديونية):**
   $$\text{PartySignedAsOf} = \text{PartyDebtAsOf} - \text{PartyCreditAsOf}$$
4. **`مستحق غير مغطى` (`UncoveredAsOf` — العمود `AR` في الأسماء و`X` في المديونية):**
   $$\text{UncoveredAsOf} = \max\left(0, \text{PartyDebtAsOf} - \text{PartyCreditAsOf}\right)$$
5. **`حالة التغطية` (`CoverageAsOf` — العمود `AS` في الأسماء و`Y` في المديونية):**
   - إذا كان `PartyDebtAsOf <= 0.01` و`PartyCreditAsOf <= 0.01` $\leftarrow$ `"متوازن"`
   - وإلا إذا كان `PartyDebtAsOf > 0.01` و`PartyCreditAsOf > 0.01` $\leftarrow$ `"مستحق يقابله دائن"`
   - وإلا إذا كان `PartyDebtAsOf > 0.01` $\leftarrow$ `"مستحق"`
   - وإلا $\leftarrow$ `"رصيد دائن"`
6. **`مقدم على فواتير لاحقة` (`PrepaymentAsOf` — العمود `AT` في الأسماء و`Z` في المديونية):**
   مجموع `SettlementAsOf - RefundAsOf` للفواتير التي تاريخها `> asOfDate`.
7. **`نقد غير موزع` (`UnallocatedAsOf` — العمود `AU` في الأسماء و`AA` في المديونية):**
   مجموع `Cash.UnallocatedAmount` لهذا الطرف حتى `asOfDate` (في الويب يساوي `0` دائماً لأن النظام يلزم بربط الفاتورة عند الحفظ).
8. **`فرق المطابقة` (`ReconciliationAsOf` — العمود `AV` في الأسماء و`AB` في المديونية):**
   `0` عندما تكون جميع الحركات مربوطة بفواتير صالحة.
