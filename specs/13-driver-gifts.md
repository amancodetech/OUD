# 13 — محرك هدايا السائقين (Driver Referrals & Gifts Engine)

> **إلى الذكاء الاصطناعي المنفِّذ:** يغطي هذا الملف الأوراق الثلاث الخاصة بالسائقين: `سياسة الهدايا`، `عملاء السائقين`، و`هدايا السائقين` (الشرائح `32–37`). انتبه جيداً لطريقة حساب العداد المستمر عند تغير سياسة الهدايا عبر الزمن.

---

## 1. كيف يعمل نظام هدايا السائقين؟

1. يُسجَّل السائق في `الأسماء وبيانات الاتصال` بنوع `سائق` (`DRIVER`) مع إمكانية تحديد `عملاء مرحلون دون هدية` (`carryoverReferrals >= 0`) عند بدء النظام فقط.
2. في `سياسة الهدايا` (`GiftPolicy`)، يحدد المالك من تاريخ معين (`effectiveDate`):
   - `customersPerGift`: كم عميلاً مؤهلاً يلزم لاستحقاق هدية واحدة (مثلاً `10` عملاء).
   - `giftValue`: قيمة الهدية الواحدة بالعملة (مثلاً `100,000` IDR).
3. في كل مرة يحضر فيها السائق عميلاً (زائراً) جديداً للمحل، يُسجَّل الزائر في `عملاء السائقين` (`DriverReferral`) برقم هاتفه أو كوده الفريد (`visitorUniqueKey`).
4. **قواعد العد التراكمي المستمر (الشرائح `33–35`):**
   - كل زائر فريد يُحتسب مرة واحدة فقط في تاريخ زيارته الأولى (`COUNTIF(visitorUniqueKey) == 1`).
   - العداد **لا يصفر في نهاية السنة**؛ إذا وصل السائق إلى `9` عملاء في ديسمبر `2026`، ثم أحضر عميلاً واحداً في يناير `2027`، يكتمل العشرة في يناير ويستحق الهدية دون أي ترحيل يدوي!
   - إذا أحضر `12` عميلاً والحد `10`، يستحق `هدية واحدة` ويبقى له `عميلان (2)` محسوبان للمجموعة التالية (أي يحتاج `8` عملاء إضافيين للهدية التالية).

---

## 2. الخوارزمية الدقيقة لحساب الزيارات والهدايا (`src/domain/driver-gifts.ts`)

هذه الخوارزمية تطابق حرفياً الأعمدة `F` إلى `AC` في ورقة `عملاء السائقين` والأعمدة `C` إلى `M` في ورقة `هدايا السائقين`:

### الخطوة 1: ترتيب الزيارات الصالحة للسائق الواحد
لكل سائق $d$، نأخذ جميع الزيارات الصالحة (`status = POSTED` وتاريخها `visitDate >= startYear-01-01`) ونرتبها تصاعدياً حسب:
$$\text{Sort Key: } (\text{visitDate ASC}, \text{code ASC})$$

### الخطوة 2: حساب كل زيارة بالتتابع ($k = 1, 2, \dots, n$)
نبدأ بعداد متبقٍ قبل أول زيارة:
$$\text{remainderBefore}_1 = \text{driver.carryoverReferrals}$$
ولكل زيارة رقم $k$ للسائق $d$ بتاريخ `visitDate`:

1. **إيجاد السياسة السارية في تاريخ الزيارة (`ActivePolicy`):**
   نبحث في جدول `GiftPolicy` عن السياسة التي لها **أكبر `effectiveDate` بحيث `effectiveDate <= visitDate`** (مكافئ `_xlfn.MAXIFS` في العمود `N`).
   - ليكن `threshold = ActivePolicy.customersPerGift` و`giftValue = ActivePolicy.giftValue`.
2. **الرصيد قبل الزيارة (`CalcBefore` — العمود `W`):**
   $$\text{CalcBefore}_k = \text{remainderBefore}_k$$
3. **عدد الهدايا المكتسبة في هذه الزيارة (`CalcGifts` — العمود `X` والعمود `G` `هدايا هذه الزيارة`):**
   $$\text{giftsEarned}_k = \left\lfloor \frac{\text{CalcBefore}_k + 1}{\text{threshold}} \right\rfloor$$
   *(لاحظ: باستخدام القسمة الصحيحة `Math.floor`، إذا كان `carryoverReferrals = 0` والحد `10`، فإن الزيارات 1 إلى 9 تعطي `0`، والزيارة 10 تعطي `floor(10/10) = 1`!).*
4. **العملاء المستهلكون في الهدايا المكتسبة (`CalcConsumed` — العمود `AA`):**
   $$\text{consumed}_k = \text{giftsEarned}_k \times \text{threshold}$$
5. **باقي العملاء بعد الزيارة (`CalcAfter` — العمود `Y` والعمود `I` `باقي العملاء`):**
   $$\text{remainderAfter}_k = (\text{CalcBefore}_k + 1) - \text{consumed}_k$$
   ويصبح هذا الرقم هو $\text{remainderBefore}_{k+1}$ للزيارة التالية!
6. **القيمة المستحقة لهذه الزيارة (`CalcAmount` — العمود `Z` والعمود `H` `قيمة مستحقة`):**
   $$\text{amountEarned}_k = \text{giftsEarned}_k \times \text{giftValue}$$

---

## 3. ملخص السائق في كشف `هدايا السائقين` حتى تاريخ التقرير (`asOfDate`)

لكل سائق $d$ مفعّل في كشف الهدايا، نحسب حتى `asOfDate` (الأعمدة `C` إلى `H` في `هدايا السائقين`):

1. **`عملاء مرحلون دون هدية`:** `driver.carryoverReferrals`.
2. **`عملاء مسجلون` (`registeredClients` — العمود `C`):**
   عدد الزيارات الصالحة للسائق التي `visitDate <= asOfDate`.
3. **`عدد الهدايا` (`totalGiftsEarned` — العمود `D`):**
   $$\sum_{k: \text{visitDate}_k \le \text{asOfDate}} \text{giftsEarned}_k$$
4. **`إجمالي الاستحقاق` (`totalAccruedAmount` — العمود `E`):**
   $$\sum_{k: \text{visitDate}_k \le \text{asOfDate}} \text{amountEarned}_k$$
5. **`ما استلمه` (`totalReceivedAmount` — العمود `F`):**
   مجموع نوعين من التسليمات حتى `asOfDate`:
   $$\text{totalReceivedAmount} = \sum_{\substack{\text{Cash}: \text{type} = \text{DRIVER\_CASH\_GIFT} \\ \text{partyId} = d, \text{txDate} \le \text{asOfDate}}} \text{CashAmount} + \sum_{\substack{\text{Sales}: \text{lineType} = \text{DRIVER\_GIFT} \\ \text{driverId} = d, \text{invoiceDate} \le \text{asOfDate}}} \text{driverGiftSettlementValue}$$
   *(انتبه: حركات `مبلغ سائق` `DRIVER_AMOUNT` لا تدخل هنا، بل تدخل فقط `هدية نقدية لسائق` + `هدية سائق` العينية من المبيعات).*
6. **`الرصيد المتبقي` (`remainingBalance` — العمود `G`):**
   $$\text{remainingBalance} = \text{totalAccruedAmount} - \text{totalReceivedAmount}$$
7. **`الباقي الأخير من العملاء` (`lastRemainder` — العمود `L`):**
   - إذا كان `registeredClients == 0`: يساوي `driver.carryoverReferrals`.
   - وإلا: يساوي `remainderAfter` لآخر زيارة للسائق تاريخها `<= asOfDate`.
8. **`عملاء للهدية التالية` (`clientsNeededForNextGift` — العمود `H`):**
   باستخدام `CurrentThreshold` (حد العملاء في السياسة السارية عند `asOfDate`):
   $$\text{clientsNeededForNextGift} = \max\left(0, \text{CurrentThreshold} - \text{lastRemainder}\right)$$

---

## 4. تصميم شاشة السائقين في الويب (`/drivers`)

تجمع صفحة `/drivers` كل ما يخص السائقين في مكان واحد واضح بثلاثة أقسام:
1. **شريط تسجيل سريع في الأعلى (`+ تسجيل عميل سائق جديد`):**
   - يطلب فقط: `التاريخ` (افتراضياً اليوم)، `السائق` (قائمة منسدلة بالاسم ورقم السيارة)، `هاتف العميل أو كوده الفريد`، و`اسم العميل`.
   - بمجرد الحفظ يعرض إشعاراً فورياً بحالة عداد السائق، مثلاً:
     - *"تم تسجيل العميل بنجاح (8 / 10 — بقي عميلان لاستحقاق الهدية التالية)"*، أو
     - *"🎉 اكتملت مجموعة العشرة للسائق يوسف! استحق هدية جديدة بقيمة 100,000 IDR"*.
2. **جدول خلاصة هدايا السائقين (`هدايا السائقين`):**
   - يعرض لكل سائق شريط تقدم مرئي (`Progress Bar` مثلاً `8/10`)، عدد الهدايا المستحقة، إجمالي الاستحقاق، ما استلمه، والرصيد المتبقي.
   - بجانب كل سائق لديه رصيد متبقٍ `> 0` زران مباشران:
     - **`صرف هدية نقدية`** (ينشئ حركة `DRIVER_CASH_GIFT` بالمبلغ المتبقي بضغطة واحدة).
     - **`تسليم هدية بضاعة`** (يفتح نافذة تسليم صنف من المخزون بنوع `DRIVER_GIFT`).
3. **جدول سجل الزيارات (`عملاء السائقين`) + تبويب `سياسة الهدايا`.**
