import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export interface LogAuditParams {
  userId?: string | null;
  action: string;
  entityType: string;
  entityCode: string;
  reason?: string | null;
  beforeJson?: unknown;
  afterJson?: unknown;
  beforeState?: unknown;
  afterState?: unknown;
}

export async function logAudit(params: LogAuditParams) {
  const { userId, action, entityType, entityCode, reason, beforeJson, afterJson, beforeState, afterState } = params;
  return prisma.auditLog.create({
    data: {
      userId: userId ?? null,
      action,
      entityType,
      entityCode,
      reason: reason ?? null,
      beforeJson: (beforeJson ?? beforeState) as Prisma.InputJsonValue,
      afterJson: (afterJson ?? afterState) as Prisma.InputJsonValue,
    },
  });
}

export async function getAuditLogs(options?: {
  entityType?: string;
  entityCode?: string;
  limit?: number;
  skip?: number;
}) {
  const where: Prisma.AuditLogWhereInput = {};
  if (options?.entityType) where.entityType = options.entityType;
  if (options?.entityCode) where.entityCode = options.entityCode;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.skip ?? 0,
      include: {
        user: {
          select: { id: true, username: true, displayName: true },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total };
}
