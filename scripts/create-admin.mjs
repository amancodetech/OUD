import { PrismaClient } from '../src/lib/prisma-client.mjs';
import bcrypt from 'bcryptjs';
const url = process.env.SETUP_DATABASE_URL;
const password = process.env.INITIAL_ADMIN_PASSWORD;
if (!url || !password || password.length < 12) throw new Error('Explicit SETUP_DATABASE_URL and INITIAL_ADMIN_PASSWORD (12+ characters) are required');
const db = new PrismaClient({ datasources: { db: { url } } });
try {
 await db.$transaction(async tx => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(1597463001)`;
  if (await tx.user.count()) throw new Error('An account already exists; initial setup refused');
  await tx.systemSetting.upsert({where:{id:1},update:{},create:{id:1}});
  await tx.user.create({data:{username:'admin',displayName:'مدير النظام',role:'ADMIN',passwordHash:await bcrypt.hash(password,12)}});
 });
 console.log('Initial administrator created');
} finally { await db.$disconnect(); }
