export function validateRuntime() {
 const secret=process.env.SESSION_SECRET;
 if (!secret || secret.length<32 || /change.this|replace.with|production.ready|test.only/i.test(secret)) throw new Error('A private random SESSION_SECRET of at least 32 characters is required');
 if (!process.env.DATABASE_URL) throw new Error('Explicit DATABASE_URL is required');
 if (!process.env.APP_URL || !['http:','https:'].includes(new URL(process.env.APP_URL).protocol)) throw new Error('A canonical APP_URL is required');
}
