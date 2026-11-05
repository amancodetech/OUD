# Supabase PostgreSQL

OUD connects to Supabase through Prisma and PostgreSQL. Supabase Auth and the REST API are not used for application authentication or accounting operations. Keep the existing application session secret and administrator credentials.

Store the PostgreSQL connection in the ignored `.env` as `DATABASE_URL`, with a URL-encoded password and `sslmode=require`. API publishable and secret keys are not PostgreSQL passwords and are not needed by this application. Never put database credentials in a `NEXT_PUBLIC_` variable.

The direct database endpoint requires IPv6 unless the project has the IPv4 add-on. The supplied Linux Compose configuration uses host networking and binds the application to localhost. An IPv4-only deployment must use the project's session pooler connection on port 5432, as provided by Supabase Connect.

```sh
docker compose -f docker-compose.supabase.yml up -d --build
```

This configuration starts only the application. The original `docker-compose.yml` remains the local PostgreSQL configuration; do not use it to start the Supabase deployment.

Docker Compose must be installed to use that command. The current local installation was started with the equivalent `docker run` configuration, using the tested image, a private runtime environment file and the container name `oud_erp_supabase`. It restarts automatically unless stopped. Use `docker restart oud_erp_supabase` to restart that existing installation. Stop and remove that container before adopting Compose; removing the application container does not delete the Supabase database.

Before moving existing data, back up the source and environment, verify the destination is empty, restore within one transaction, and compare every table. Apply pending Prisma migrations and compare business content again before changing the active connection. Keep API roles (`anon`, `authenticated`, `service_role`, and `PUBLIC`) denied access to application tables and enable RLS on those tables. The application uses its server-side PostgreSQL connection and its existing permission checks. Reapply these restrictions when adding new tables.

Migration evidence, full database dumps, original connection settings and credentials belong in ignored private backups. Do not publish them. After the new database receives business transactions, reverting to an old local copy requires reconciling those transactions first.

Supabase hosting does not replace a separately configured and tested external backup policy.
