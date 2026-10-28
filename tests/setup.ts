import { testDatabaseUrl } from '../src/lib/test-database';

if (process.env.OUD_INTEGRATION === '1') {
  process.env.DATABASE_URL = testDatabaseUrl();
  process.env.SESSION_SECRET = 'test-only-oud-session-key-abcdefghijklmnopqrstuvwxyz';
}
