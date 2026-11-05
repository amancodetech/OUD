# 23 — البرومبتات الاحترافية لتنفيذ تعدد اللغات (العربية 🇸🇦 + الإندونيسية 🇮🇩 + الإنجليزية 🇬🇧) بواسطة Gemini Flash

> **كيف تستخدم هذا الملف مع Gemini Flash؟**
> لأن Gemini Flash نموذج سريع ولكنه قد يختصر الكود إذا طُلب منه تعديل 25 ملفاً دفعة واحدة، فقد قسّمنا إضافة اللغتين **الإندونيسية (`id`)** و**الإنجليزية (`en`)** بجانب **العربية (`ar`)** إلى **3 مراحل متتالية فقط**.
> - انسخ **برومبت المرحلة 1** وأرسله لـ Flash، وانتظر حتى ينتهي ويشغل `npx tsc --noEmit`.
> - ثم انسخ **برومبت المرحلة 2** وأرسله لـ Flash.
> - ثم انسخ **برومبت المرحلة 3** وأرسله لـ Flash.

---

## المرحلة الأولى (Phase I18N-1): تأسيس محرك اللغات (`src/i18n/`) + القوائم + اتجاه RTL/LTR + شاشة الدخول

انسخ النص التالي بالكامل وأرسله إلى **Gemini Flash**:

```markdown
أنت مهندس برمجيات خبير في Next.js 14 (App Router) وTypeScript وTailwind CSS.
مهمتك الآن هي تنفيذ **المرحلة الأولى (Phase I18N-1)** من خطة تعدد اللغات (العربية `ar`، الإندونيسية `id`، الإنجليزية `en`) لنظام **مؤسسة سدرة العود (Sidrat Al-Oud ERP)**.

### ⚠️ قواعد صارمة لا يجوز مخالفتها إطلاقاً:
1. **اقرأ أولاً ملفات المواصفات المرجعية بالكامل:**
   - `specs/21-i18n-architecture-rtl-ltr.md`
   - `specs/22-i18n-complete-glossary-ar-id-en.md`
2. **يمنع منعاً باتاً تغيير مسارات الصفحات (Routes):** لا تنقل أي ملف إلى `[locale]`. جميع المسارات (`/sales`, `/inventory`, `/debts`, إلخ) تبقى في مكانها الحالي.
3. **يمنع منعاً باتاً لمس منطق الحسابات أو قيم قاعدة البيانات:** لا تغير أي كود في `src/lib/calculations/` أو `prisma/schema.prisma`. مفتاح الرصيد الافتتاحي في الحسابات يبقى `'افتتاحي'` ويُترجم في العرض فقط عبر `tInvoiceKey()`.
4. **يمنع الاختصار أو كتابة `// TODO`:** اكتب جميع مفاتيح القواميس الثلاثة (`ar.ts`، `id.ts`، `en.ts`) بالكامل حرفياً كما وردت في `specs/22-i18n-complete-glossary-ar-id-en.md`.

### المطلوب تنفيذه في هذه المرحلة (ملفاً تلو الآخر):
1. إنشاء `src/i18n/types.ts` (تعريف `Locale = 'ar' | 'id' | 'en'` وواجهة `Dictionary` الكاملة من `specs/22-i18n-complete-glossary-ar-id-en.md`).
2. إنشاء القواميس الثلاثة الكاملة والمتطابقة 100% في المفاتيح:
   - `src/i18n/dictionaries/ar.ts`
   - `src/i18n/dictionaries/id.ts`
   - `src/i18n/dictionaries/en.ts`
3. إنشاء `src/i18n/translate-domain.ts` (دوال `tCategory`, `tUnit`, `tItemRole`, `tPartyType`, `tCashType`, `tAging`, `tInvoiceKey`).
4. إنشاء `src/i18n/LanguageContext.tsx` (`LanguageProvider` + `useI18n` hook الذي يحفظ اللغة في `localStorage` والكوكي `oud_locale` ويحدث `document.documentElement.dir` و`lang` فوراً).
5. إنشاء مكون مبدل اللغة `src/components/layout/LanguageSwitcher.tsx` (أزرار أنيقة: `🇸🇦 العربية` | `🇮🇩 Indonesia` | `🇬🇧 English`).
6. تحديث `src/app/layout.tsx`:
   - تغليف التطبيق بـ `<LanguageProvider>` بحيث يدعم تبديل الاتجاه (`RTL` للعربية و`LTR` للإندونيسية والإنجليزية) بسلاسة.
7. تحديث `src/app/(dashboard)/layout.tsx`:
   - إزالة `dir="rtl"` الثابت من الـ `div` الرئيسي أو ربطه بـ `dir` الديناميكي من `useI18n()`.
   - إضافة `<LanguageSwitcher />` في الهيدر العلوي بجانب `<GlobalPeriodSelector />` وزر الإقفال اليومي، وترجمة نص زر الإقفال اليومي (`t.header.dailyClosingBtn`).
8. تحديث المكونات المشتركة لتعمل بـ `useI18n()` وتدعم `RTL` و`LTR`:
   - `src/components/layout/Sidebar.tsx` (ترجمة جميع المجموعات والروابط وعنوان المحل وزر الخروج، وتعديل الحدود `isRtl ? 'border-l' : 'border-r'` وموضع الـ Tooltip واتجاه أيقونة الطي).
   - `src/components/layout/GlobalPeriodSelector.tsx` (ترجمة كلمة الفترة، السنة كاملة، طوال الفترة، وأسماء الأشهر الـ 12 من `t.header`).
   - `src/components/layout/SetupStatusBanner.tsx` (ترجمة نصوص حالة التأسيس وعكس أيقونة السهم حسب `isRtl`).
   - `src/app/login/page.tsx` (إضافة `<LanguageSwitcher />` في أعلى شاشة الدخول وترجمة جميع حقول الدخول والرسائل من `t.auth`).

### ✅ التحقق الإلزامي قبل إنهاء المرحلة:
شغل الأمر التالي وتأكد من عدم وجود أي خطأ:
```bash
npx tsc --noEmit
```
إذا ظهر أي خطأ في TypeScript، قم بإصلاحه فوراً قبل التوقف.
```

---

## المرحلة الثانية (Phase I18N-2): ترجمة شاشات البيانات الأساسية والعمليات اليومية (المبيعات، المشتريات، الصندوق، الطباعة)

بعد انتهاء المرحلة الأولى بنجاح، انسخ النص التالي وأرسله إلى **Gemini Flash**:

```markdown
أحسنت في المرحلة الأولى. الآن نفذ **المرحلة الثانية (Phase I18N-2)** لربط شاشات البيانات الأساسية والعمليات المالية اليومية بنظام اللغات الثلاث (`ar` / `id` / `en`) عبر `useI18n()` من `@/i18n/LanguageContext`.

### ⚠️ قواعد صارمة:
1. راجع `specs/21-i18n-architecture-rtl-ltr.md` و`specs/22-i18n-complete-glossary-ar-id-en.md`.
2. في كل صفحة من الصفحات أدناه، استدعِ `const { t, locale, isRtl, tCategory, tUnit, tItemRole, tPartyType, tCashType, tInvoiceKey } = useI18n();`.
3. إذا احتجت أي مفتاح نصي إضافي غير موجود في `Dictionary`، أضفه أولاً في `src/i18n/types.ts` وفي القواميس الثلاثة (`ar.ts`، `id.ts`، `en.ts`) معاً لكي يظل `npx tsc --noEmit` ناجحاً 100%.
4. حافظ على جميع العمليات الحسابية واستدعاءات الـ API (`fetch`) كما هي تماماً بدون أي تغيير في منطق الأعمال.
5. استخدم `tCategory(cat.name)` عند عرض أسماء التصنيفات، و`tUnit(unit.name)` عند عرض الوحدات، و`tItemRole(item.role)` عند عرض دور الصنف، و`tPartyType(party.type)` عند عرض نوع العميل/المورد، و`tCashType(tx.type)` عند عرض نوع حركة الصندوق.

### الصفحات المطلوب ترجمتها بالكامل في هذه المرحلة:
1. **العملاء والموردين:** `src/app/(dashboard)/parties/page.tsx`
2. **دليل الأصناف:** `src/app/(dashboard)/items/page.tsx`
3. **الشركاء والأصول الثابتة:** `src/app/(dashboard)/partners/page.tsx`
4. **معالج التأسيس الأولي:** `src/app/(dashboard)/setup/page.tsx`
5. **الإعدادات والنسخ الاحتياطي:** `src/app/(dashboard)/settings/page.tsx`
6. **المبيعات والفواتير:** `src/app/(dashboard)/sales/page.tsx`
7. **طباعة فاتورة المبيعات:** `src/app/(dashboard)/sales/[id]/print/page.tsx`
   - أضف `<LanguageSwitcher />` داخل شريط أزرار الطباعة العلوي (`no-print`) لكي يتمكن الكاشير من تبديل لغة الفاتورة المطبوعة (عربي / إندونيسي / إنجليزي) بضغطة زر قبل طباعتها للعميل!
8. **المشتريات:** `src/app/(dashboard)/purchases/page.tsx`
9. **الصندوق والمدفوعات:** `src/app/(dashboard)/cash/page.tsx`

### ✅ التحقق الإلزامي قبل إنهاء المرحلة:
شغل الأمر التالي وتأكد من نجاحه بالكامل بدون أي خطأ:
```bash
npx tsc --noEmit
```
```

---

## المرحلة الثالثة (Phase I18N-3): ترجمة شاشات المستودع، التصنيع، السائقين، التقارير، ولوحة التحكم + التحقق النهائي الشامل

بعد انتهاء المرحلة الثانية بنجاح، انسخ النص التالي وأرسله إلى **Gemini Flash**:

```markdown
أحسنت في المرحلة الثانية. الآن نفذ **المرحلة الثالثة والأخيرة (Phase I18N-3)** لاستكمال ترجمة جميع شاشات المستودع، التصنيع، السائقين، لوحة التحكم، المخزون، الديون، وكشف الحساب إلى اللغات الثلاث (`ar` / `id` / `en`).

### ⚠️ قواعد صارمة:
1. استخدم `useI18n()` من `@/i18n/LanguageContext` في جميع الملفات أدناه.
2. استخدم دوال ترجمة البيانات (`tCategory`, `tUnit`, `tItemRole`, `tPartyType`, `tCashType`, `tAging`, `tInvoiceKey`) لعرض التصنيفات، الوحدات، فترات تعمير الديون (`0-30 يوم` $\rightarrow$ `Lancar (0-30 Hari)` / `Current (0-30 Days)`)، ومفتاح `'افتتاحي'` (`Saldo Awal` / `Opening Balance`) باللغة المختارة دون تغيير القيم المحاسبية الداخلية.
3. إذا احتجت أي مفتاح نصي إضافي، أضفه في `src/i18n/types.ts` وفي `ar.ts` و`id.ts` و`en.ts` معاً.

### الصفحات والمكونات المطلوب ترجمتها بالكامل في هذه المرحلة:
1. **المرتجعات:** `src/app/(dashboard)/returns/page.tsx`
2. **صرف المخزون والعينات والتالف:** `src/app/(dashboard)/stock-issues/page.tsx`
3. **التصنيع والتركيب والتعبئة:** `src/app/(dashboard)/manufacturing/page.tsx`
4. **ترشيحات وهدايا السائقين والمرشدين:** `src/app/(dashboard)/drivers/page.tsx`
5. **لوحة التحكم الرئيسية والرسوم البيانية:** `src/app/(dashboard)/page.tsx`
6. **المخزون وبطاقة الصنف التفصيلية:** `src/app/(dashboard)/inventory/page.tsx`
7. **الديون وأعمار الذمم ومتابعة الفواتير:** `src/app/(dashboard)/debts/page.tsx`
8. **طباعة كشف حساب عميل/مورد:** `src/app/(dashboard)/parties/[id]/statement/page.tsx`
   - أضف أيضاً `<LanguageSwitcher />` في شريط أزرار الطباعة (`no-print`) ليتمكن المحاسب من طباعة كشف الحساب بالعربية أو الإندونيسية أو الإنجليزية.
9. **نافذة الإقفال اليومي ومطابقة الصندوق:** `src/components/modals/DailyClosingChecklistModal.tsx`

### ✅ التحقق النهائي الشامل (إلزامي قبل إعلان الانتهاء):
شغل الأوامر الثلاثة التالية بالترتيب وتأكد من نجاحها جميعاً 100%:
```bash
npx tsc --noEmit
npx vitest run
npm run build
```
إذا ظهر أي خطأ في أي أمر منها، قم بإصلاحه فوراً وأعد تشغيل الأوامر الثلاثة حتى تنجح بالكامل.
```
