# 17 — التشغيل، النشر، والنسخ الاحتياطي (Deployment & Operations)

> **إلى الذكاء الاصطناعي المنفِّذ:** يغطي هذا الملف تشغيل النظام بملف `docker-compose.yml` واحد، والنسخ الاحتياطي التلقائي واليدوي لقاعدة البيانات، وقائمة المراجعة اليومية قبل الإغلاق.

---

## 1. تشغيل النظام بـ Docker Compose (`docker-compose.yml`)

يجب أن يعمل النظام بالكامل محلياً على جهاز المحل أو على خادم سحابي صغير (VPS) بأمر واحد `docker compose up -d`:

```yaml
version: '3.9'

services:
  db:
    image: postgres:16-alpine
    container_name: oud_erp_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: oud_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-oud_secret_2026}
      POSTGRES_DB: oud_erp
    volumes:
      - oud_pgdata:/var/lib/postgresql/data
      - ./backups:/backups
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U oud_user -d oud_erp"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: oud_erp_app
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://oud_user:${POSTGRES_PASSWORD:-oud_secret_2026}@db:5432/oud_erp?schema=public
      SESSION_SECRET: ${SESSION_SECRET:-change_this_secret_in_production_32chars_min}
      NODE_ENV: production
    ports:
      - "3000:3000"

volumes:
  oud_pgdata:
```

---

## 2. النسخ الاحتياطي واستعادة البيانات (`/settings/backup`)

لأن هذا نظام محاسبي لمحل فعلي، يجب توفير وسيلتين للنسخ الاحتياطي من داخل الواجهة (`/settings/backup` للمدير `ADMIN`):
1. **تنزيل نسخة احتياطية كاملة بضغطة زر (`Download Backup`):**
   - خيار 1: تنزيل ملف JSON/ZIP مشفر يحتوي على كامل جداول قاعدة البيانات.
   - خيار 2: تنزيل نسخة `Excel (.xlsx)` كاملة على نفس هيكل الأوراق الـ 18 بحيث يمكن فتحها في Excel في أي وقت!
2. **نسخ احتياطي يومي تلقائي:**
   - مهمة مجدولة تحفظ نسخة يومية في مجلد `./backups/oud-backup-YYYY-MM-DD.json.gz` مع الاحتفاظ بآخر 30 نسخة.

---

## 3. نافذة «المراجعة اليومية قبل الإغلاق» (Daily Closing Checklist — الشريحة 54)

ترجمةً للشريحة `54` من عرض التدريب (`المراجعة اليومية قبل الإغلاق`)، يوجد زر في الشريط العلوي اسمه **`مراجعة نهاية اليوم`** يعرض للمحاسب أو المالك بطاقة فحص تفاعلية من 6 بنود:
1. **المبيعات والمشتريات المسجلة اليوم:** عدد الفواتير وإجماليها.
2. **مطابقة الخزينة والبنك:** يعرض الرصيد الدفتري للخزينة (`CASH`) والبنك (`BANK`)، مع حقل اختياري يكتب فيه الكاشير "النقد الفعلي المعدود في الدرج" ليحسب النظام الفرق فوراً (`مطابق ✅` أو `عجز/زيادة ⚠️`).
3. **المرتجعات المسجلة اليوم:** التأكد من حالتها (`صالح` / `تالف`) وهل تم رد نقديتها أم بقيت رصيداً دائناً.
4. **صرف المخزون والتصنيع اليوم:** مراجعة التستر والعينات والدفعات المصنعة.
5. **المديونية المستحقة والمتأخرة:** عرض الفواتير التي حلّ تاريخ استحقاقها اليوم أو تأخرت.
6. **حالة التنبيهات وسلامة التكلفة (`COST_CHECK`):** التأكد من أن عدد التنبيهات = `0`.
