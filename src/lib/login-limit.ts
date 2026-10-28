import crypto from 'node:crypto';
import { prisma } from './db';

export async function consumeLoginAttempt(username: string): Promise<boolean> {
  const key = crypto.createHash('sha256').update(username.trim().toLowerCase()).digest('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + 15 * 60 * 1000);
  // Atomic and shared by every application process; successful login does not
  // erase the limit, so parallel requests cannot reset each other's counter.
  const result = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "LoginAttempt" ("key", "count", "expiresAt") VALUES (${key}, 1, ${expires})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "LoginAttempt"."expiresAt" < ${now} THEN 1 ELSE "LoginAttempt"."count" + 1 END,
      "expiresAt" = CASE WHEN "LoginAttempt"."expiresAt" < ${now} THEN ${expires} ELSE "LoginAttempt"."expiresAt" END
    RETURNING "count"`;
  return result[0].count <= 10;
}
