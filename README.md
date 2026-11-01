# OUD ERP

نظام إدارة المتجر والمخزون والمحاسبة باستخدام Next.js وPostgreSQL.

- [خطة البيانات والأداء](docs/CLOUDFLARE-DATA-ARCHITECTURE-PLAN.md)
- [سياسة كاش المتصفح طوال جلسة الدخول](docs/BROWSER-SESSION-CACHE.md)
- [دليل نشر Cloudflare Workers وSupabase](docs/CLOUDFLARE-DEPLOYMENT.md)
- [نتيجة التنفيذ والاختبارات](docs/CLOUDFLARE-IMPLEMENTATION-REPORT.md)

## التطوير

استخدم Node.js 22 وPostgreSQL. انسخ `.env.example` إلى ملف بيئة محلي واضبط أسرارك الخاصة، ثم:

```sh
npm ci
npm run db:generate
npm run db:migrate
npm run dev
```

لا تشغّل seed على قاعدة العمل. جهّز حساب المدير بأداة `scripts/create-admin.mjs` وفق مدخلاتها، ولا تضع بيانات الدخول في Git.

## التحقق

```sh
npm run typecheck
npm run lint
npm run cf:build
npm run cf:dry-run
OUD_WORKER_SMOKE=1 npm run test:integration
```

تحتاج اختبارات التكامل إلى Docker؛ تُنشئ قاعدة مؤقتة معزولة. اقرأ دليل النشر قبل تفعيل الموارد أو الترحيلات على الإنتاج. لا يُعتبر نجاح البناء نشرًا للتطبيق.
