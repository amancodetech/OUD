# OUD ERP

Multilingual inventory, sales, purchasing and accounting application built with Next.js and PostgreSQL.

## Setup

1. Install Node.js 22 and Docker.
2. Run `npm ci` and `npx prisma generate`.
3. Copy `.env.example` to `.env` and set private database credentials, a random session secret, and the application URL.
4. Follow [Operations](docs/OPERATIONS.md) for migrations and first administrator setup.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
```

Integration tests create isolated PostgreSQL containers; Docker is required.

See [Backup scheduling](docs/BACKUP-SCHEDULE.md) and [Write permission policy](docs/WRITE-PERMISSION-POLICY.md). Private acceptance reports, production data, credentials, backups and the historical business-data initializer are intentionally excluded from this repository. Links to local acceptance reports in operational notes refer to private records. Publishing this code does not deploy it or certify production acceptance.
