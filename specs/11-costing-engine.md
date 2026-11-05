# 11 — محرك التكلفة الشهري للمخزون (Monthly Costing Engine — الأهم)

> **إلى الذكاء الاصطناعي المنفِّذ:** هذا هو **أهم ملف في النظام بأكمله**. في ورقة `الأصناف` في Excel توجد 972 عموداً (`M001_AVG` إلى `M036_COST_CHECK`) تحسب متوسط التكلفة المرجح الشهري وقيمة المخزون. لقد استخرجنا كل معادلة منها وحولناها هنا إلى خوارزمية TypeScript نقية تعمل لأي عدد من الأشهر. **انسخ هذه المعادلات حرفياً بدون أي اجتهاد أو تبسيط.**

---

## 1. لماذا يوجد مساران في المحرك (خام `RAW` مقابل بضاعة/منتج تام)؟

في الشهر الواحد $m$:
- **المنتج التام (`FINISHED`)** يستمد تكلفة إنتاجه (`MV`) من تكلفة **المواد الخام (`RAW`)** المستهلكة في دفعات التصنيع خلال نفس الشهر $m$.
- لذلك، داخل كل شهر $m$ (من الشهر `1` بالتتابع حتى آخر شهر مطلوب $M$):
  1. **الخطوة أ (حساب الخامات أولاً):** نحسب أوعية ومتوسطات التكلفة الشهرية (`RAVG`) والكميات والقيم الختامية (`RQ`, `RV`) لجميع الأصناف (وخصوصاً ذات الدور `RAW`).
  2. **الخطوة ب (حساب دفعات التصنيع في الشهر $m$):** نضرب الكميات المستهلكة من المواد الخام في `RAVG` للشهر $m$ لنحصل على `تكلفة المكونات` (`MV`) لكل دفعة تصنيع أُكملت في الشهر $m$.
  3. **الخطوة ج (حساب البضاعة والمنتجات التامة):** نحسب وعاء التكلفة (`POOL_Q`, `POOL_V`) ومتوسط التكلفة (`AVG`) والكمية والقيمة الختامية (`EQ`, `EV`) لبقية الأصناف في الشهر $m$.

هذا الترتيب (شهر بشهر $m = 1 \dots M$، وداخل كل شهر: الخامات $\leftarrow$ التصنيع $\leftarrow$ المنتجات التامة/البضاعة) يمنع أي اعتماد دائري (Circular Reference) ويعطي تطابقاً `100%` مع Excel.

---

## 2. تعريف المتغيرات الـ 27 لكل صنف $i$ في الشهر $m \ge 1$

لتكن $m = (\text{YEAR}(d) - \text{startYear}) \times 12 + \text{MONTH}(d)$ هي رقم الشهر التسلسلي (حيث يناير من `startYear` هو $m = 1$):

### 2.1 تدفقات الشهر $m$ للصنف $i$ (من الحركات المعتمدة `status = POSTED`):
1. **`PQ(i, m)` (كمية المشتريات):** مجموع `PurchaseLine.qty` للصنف $i$ في الفواتير التي شهرها $= m$.
2. **`PV(i, m)` (قيمة المشتريات):** مجموع `PurchaseLine.lineTotalCost` للصنف $i$ في الفواتير التي شهرها $= m$.
3. **`PRS_Q(i, m)` (كمية مرتجع شراء من نفس الشهر):** مجموع `ReturnLine.SameMonthPurchaseQty` للصنف $i$ حيث `ReturnMonth == m` (أي `SourceMonth == m` و`ReturnMonth == m`).
4. **`PRS_V(i, m)` (قيمة مرتجع شراء من نفس الشهر):** مجموع `ReturnLine.SameMonthPurchaseValue` للصنف $i$ حيث `ReturnMonth == m` (بتكلفة الشراء الأصلية).
5. **`PRP_Q(i, m)` (كمية مرتجع شراء من شهر سابق):** مجموع `ReturnLine.PriorPurchaseQty` للصنف $i$ حيث `ReturnMonth == m` و`SourceMonth < m`.
6. **`SQ(i, m)` (كمية المبيعات):** مجموع `SaleLine.qty` (بما فيها `SALE` و`DRIVER_GIFT`) للصنف $i$ في الفواتير التي شهرها $= m$.
7. **`CQ(i, m)` (كمية الخام المستهلكة في التصنيع):** مجموع `BatchMaterial.consumedQty` للصنف $i$ في الدفعات المكتملة في الشهر $m$.
8. **`ISSUE_Q(i, m)` (كمية صرف المخزون):** مجموع `StockIssue.qty` للصنف $i$ في الشهر $m$.
9. **`SR_SAME_Q(i, m)` (كمية مرتجع بيع صالح من نفس الشهر):**
   مجموع `ReturnLine.GoodSalesQty` للصنف $i$ حيث `ReturnMonth == m` و`SourceMonth == m`.
10. **`SR_PRIOR_Q(i, m)` (كمية مرتجع بيع صالح من أشهر سابقة):**
    مجموع `ReturnLine.GoodSalesQty` للصنف $i$ حيث `ReturnMonth == m` و`SourceMonth < m`.
11. **`RAW_SR_PRIOR_V(i, m)` (قيمة مرتجع بيع صالح من أشهر سابقة على مسار الخام):**
    - إذا كان $m == 1$: تساوي $0$.
    - إذا كان $m > 1$:
      $$\text{RAW\_SR\_PRIOR\_V}(i, m) = \sum_{s = 1}^{m - 1} \left( \text{GoodSalesReturnQty}(i, \text{returnMonth}=m, \text{sourceMonth}=s) \times \text{RAVG}(i, s) \right)$$
12. **`SR_PRIOR_V(i, m)` (قيمة مرتجع بيع صالح من أشهر سابقة على المسار العام):**
    - إذا كان $m == 1$: تساوي $0$.
    - إذا كان $m > 1$:
      $$\text{SR\_PRIOR\_V}(i, m) = \sum_{s = 1}^{m - 1} \left( \text{GoodSalesReturnQty}(i, \text{returnMonth}=m, \text{sourceMonth}=s) \times \text{AVG}(i, s) \right)$$

---

### 2.2 معادلات المرحلة (أ): مسار المواد الخام (`RAW_POOL`, `RAVG`, `RQ`, `RV`)

تُحسَب لكل صنف $i$ في الشهر $m$:

1. **وعاء كمية الخام (`RAW_POOL_Q`):**
   $$\text{RAW\_POOL\_Q}(i, m) = \begin{cases} \text{openingQty}_i + \text{PQ}(i, 1) - \text{PRS\_Q}(i, 1) + \text{SR\_PRIOR\_Q}(i, 1) & \text{if } m = 1 \\ \text{RQ}(i, m-1) + \text{PQ}(i, m) - \text{PRS\_Q}(i, m) + \text{SR\_PRIOR\_Q}(i, m) & \text{if } m > 1 \end{cases}$$

2. **وعاء قيمة الخام (`RAW_POOL_V`):**
   $$\text{RAW\_POOL\_V}(i, m) = \begin{cases} \text{openingValue}_i + \text{PV}(i, 1) - \text{PRS\_V}(i, 1) + \text{RAW\_SR\_PRIOR\_V}(i, 1) & \text{if } m = 1 \\ \text{RV}(i, m-1) + \text{PV}(i, m) - \text{PRS\_V}(i, m) + \text{RAW\_SR\_PRIOR\_V}(i, m) & \text{if } m > 1 \end{cases}$$

3. **متوسط تكلفة الخام للشهر (`RAVG`):**
   $$\text{RAVG}(i, m) = \begin{cases} 0 & \text{if } \text{RAW\_POOL\_Q}(i, m) == 0 \\ \frac{\text{RAW\_POOL\_V}(i, m)}{\text{RAW\_POOL\_Q}(i, m)} & \text{otherwise} \end{cases}$$

4. **الكمية الختامية على مسار الخام (`RQ`):**
   $$\text{RQ}(i, m) = \text{RAW\_POOL\_Q}(i, m) - \text{SQ}(i, m) + \text{SR\_SAME\_Q}(i, m) - \text{CQ}(i, m) - \text{PRP\_Q}(i, m) - \text{ISSUE\_Q}(i, m)$$

5. **القيمة الختامية على مسار الخام (`RV`):**
   $$\text{RV}(i, m) = \text{RQ}(i, m) \times \text{RAVG}(i, m)$$

---

### 2.3 معادلات المرحلة (ب): تكلفة التصنيع في الشهر $m$ (`MQ`, `MV`)

بعد معرفة `RAVG(rawItem, m)` لكل المواد الخام في الشهر $m$:
- لكل دفعة تصنيع $b$ مكتملة وصالحة في الشهر $m$:
  $$\text{BatchCost}(b) = \sum_{k \in \text{materials}(b)} \left( \text{consumedQty}_k \times \text{RAVG}(\text{rawItem}_k, m) \right)$$
- ولكل صنف $i$:
  - **`MQ(i, m)` (كمية الإنتاج التام المضافة):** مجموع `producedQty` للدفعات المكتملة في الشهر $m$ التي منتجها الناتج هو $i$.
  - **`MV(i, m)` (قيمة الإنتاج التام المضافة):** مجموع `BatchCost(b)` للدفعات المكتملة في الشهر $m$ التي منتجها الناتج هو $i$.

---

### 2.4 معادلات المرحلة (ج): المسار العام للبضاعة والمنتج التام (`OQ`, `OV`, `POOL_Q`, `POOL_V`, `AVG`, `EQ`, `EV`)

1. **افتتاح الشهر (`OQ` و`OV`):**
   $$\text{OQ}(i, m) = \begin{cases} \text{openingQty}_i & \text{if } m = 1 \\ \text{EQ}(i, m-1) & \text{if } m > 1 \end{cases}$$
   $$\text{OV}(i, m) = \begin{cases} \text{openingValue}_i & \text{if } m = 1 \\ \text{EV}(i, m-1) & \text{if } m > 1 \end{cases}$$

2. **وعاء الكمية (`POOL_Q`) ووعاء القيمة (`POOL_V`):**
   - إذا كان `item.role == RAW`:
     $$\text{POOL\_Q}(i, m) = \text{RAW\_POOL\_Q}(i, m), \quad \text{POOL\_V}(i, m) = \text{RAW\_POOL\_V}(i, m)$$
   - إذا كان `item.role != RAW` (`MERCHANDISE` أو `FINISHED`):
     $$\text{POOL\_Q}(i, m) = \text{OQ}(i, m) + \text{PQ}(i, m) - \text{PRS\_Q}(i, m) + \text{MQ}(i, m) + \text{SR\_PRIOR\_Q}(i, m)$$
     $$\text{POOL\_V}(i, m) = \text{OV}(i, m) + \text{PV}(i, m) - \text{PRS\_V}(i, m) + \text{MV}(i, m) + \text{SR\_PRIOR\_V}(i, m)$$

3. **متوسط التكلفة المعتمد للشهر (`AVG`):**
   $$\text{AVG}(i, m) = \begin{cases} \text{RAVG}(i, m) & \text{if } \text{role} == \text{RAW} \\ 0 & \text{if } \text{role} \ne \text{RAW} \land \text{POOL\_Q}(i, m) == 0 \\ \frac{\text{POOL\_V}(i, m)}{\text{POOL\_Q}(i, m)} & \text{otherwise} \end{cases}$$

4. **الكمية الختامية المتاحة في نهاية الشهر (`EQ`):**
   $$\text{EQ}(i, m) = \begin{cases} \text{RQ}(i, m) & \text{if } \text{role} == \text{RAW} \\ \text{POOL\_Q}(i, m) - \text{SQ}(i, m) + \text{SR\_SAME\_Q}(i, m) - \text{CQ}(i, m) - \text{PRP\_Q}(i, m) - \text{ISSUE\_Q}(i, m) & \text{otherwise} \end{cases}$$

5. **قيمة المخزون الختامية في نهاية الشهر (`EV`):**
   $$\text{EV}(i, m) = \begin{cases} \text{RV}(i, m) & \text{if } \text{role} == \text{RAW} \\ \text{EQ}(i, m) \times \text{AVG}(i, m) & \text{otherwise} \end{cases}$$

6. **فحص سلامة التكلفة (`COST_CHECK`):**
   - إذا كان $\text{POOL\_Q}(i, m) < -10^{-9}$ أو $\text{POOL\_V}(i, m) < -0.01$ $\leftarrow$ `"وعاء تكلفة سالب"`.
   - وإلا إذا كان $|\text{POOL\_Q}(i, m)| \le 10^{-9}$ و$|\text{POOL\_V}(i, m)| > 0.01$ $\leftarrow$ `"وعاء صفري بغير قيمة صفرية"`.
   - وإلا إذا كان $\text{EQ}(i, m) < -10^{-9}$ $\leftarrow$ `"مخزون سالب"`.
   - وإلا $\leftarrow$ `""` (سليم).

---

## 3. لماذا هذه المعادلات عبقرية ويجب عدم تغييرها؟

لاحظ كيف تعالج المعادلات الحالات المحاسبية الدقيقة في المثال التدريبي (أكتوبر 2026، $m = 10$):
- **العود الطبيعي (`P001`, `MERCHANDISE`):**
  - أول المدة (`m=1` حتى `m=9` بلا حركة): `OQ = 100` جرام، `OV = 1,000,000`.
  - في أكتوبر (`m = 10`):
    - شراء `PQ = 200` جرام بـ `PV = 2,000,000`.
    - مرتجع شراء من نفس الشهر `PRS_Q = 20` جرام بـ `PRS_V = 200,000`.
    - إذن وعاء التكلفة في أكتوبر:
      $$\text{POOL\_Q} = 100 + 200 - 20 = 280 \text{ g}, \quad \text{POOL\_V} = 1,000,000 + 2,000,000 - 200,000 = 2,800,000$$
    - متوسط التكلفة `AVG(P001, 10)` = $\frac{2,800,000}{280} = 10,000$ للجرام.
    - المبيعات في أكتوبر: `SQ = 40 + 20 = 60` جرام.
    - مرتجع بيع صالح من نفس الشهر: `SR_SAME_Q = 10 + 4 = 14` جرام *(لاحظ أن الـ 2 جرام المرتجع التالف لا يدخل في `SR_SAME_Q` فلا يعود للمخزون!)*.
    - صرف مخزون (تستر 3 + عينة 2 + تالف 1): `ISSUE_Q = 6` جرام.
    - الكمية الختامية `EQ(P001, 10)`:
      $$\text{EQ} = 280 - 60 + 14 - 0 - 0 - 6 = 228 \text{ g}$$
    - القيمة الختامية `EV(P001, 10)` = $228 \times 10,000 = 2,280,000$ IDR. **(مطابق للشريحة 44 بالروبية الواحدة!)**
