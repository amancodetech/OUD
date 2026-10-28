import { cookies } from 'next/headers';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from './db';
import { UserRole } from '@prisma/client';
import { PermissionKey, resolveUserPermissions } from './permissions';

const SESSION_COOKIE_NAME = 'auth_session';
function sessionSecret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32 || /change.this|replace.with|production.ready/i.test(value) || (/test.only/i.test(value) && process.env.NODE_ENV === 'production')) {
    throw new Error('SESSION_SECRET must be an explicitly configured random value of at least 32 characters');
  }
  return value;
}
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  permissions?: PermissionKey[];
}

interface SessionPayload extends SessionUser {
  exp: number;
  version: number;
  generation: string;
}

function signPayload(payload: SessionPayload): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString('base64url');
  const signature = crypto
    .createHmac('sha256', sessionSecret())
    .update(b64)
    .digest('base64url');
  return `${b64}.${signature}`;
}

function verifyPayload(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2 || token.length > 12000) return null;
  const [b64, signature] = parts;
  if (!b64 || !signature) return null;

  const expectedSignature = crypto
    .createHmac('sha256', sessionSecret())
    .update(b64)
    .digest('base64url');
  const received = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;

  try {
    const json = Buffer.from(b64, 'base64url').toString('utf8');
    const payload = JSON.parse(json) as SessionPayload;
    if (typeof payload.id !== 'string' || !Number.isFinite(payload.exp) ||
        payload.exp <= Date.now() || !Number.isInteger(payload.version) || typeof payload.generation !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createSession(user: SessionUser) {
  const current = await prisma.user.findUnique({ where: { id: user.id } });
  if (!current?.isActive) throw new Error('UNAUTHORIZED');
  const payload: SessionPayload = {
    id: current.id,
    username: current.username,
    displayName: current.displayName,
    role: current.role,
    exp: Date.now() + SESSION_DURATION_MS,
    version: current.sessionVersion,
    generation: current.sessionGeneration,
  };
  const token = signPayload(payload);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
    path: '/',
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!cookie?.value) return null;

  const payload = verifyPayload(cookie.value);
  if (!payload) return null;

  const current = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!current?.isActive || current.sessionVersion !== payload.version || current.sessionGeneration !== payload.generation) return null;

  return {
    id: current.id,
    username: current.username,
    displayName: current.displayName,
    role: current.role,
    permissions: resolveUserPermissions(current.role, current.permissions),
  };
}

export const getCurrentUser = getSession;

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { username },
  });
  if (!user || !user.isActive) return null;

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) return null;

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    permissions: resolveUserPermissions(user.role, user.permissions),
  };
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }
  return session;
}

export async function requireRole(allowedRoles: UserRole[]): Promise<SessionUser> {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) {
    throw new Error('FORBIDDEN');
  }
  return user;
}
