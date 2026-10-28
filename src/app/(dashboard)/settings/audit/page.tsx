import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { History, ArrowRight } from 'lucide-react';

export default async function AuditLogPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  const perms = (session.permissions ?? []) as string[];
  if (session.role !== 'ADMIN' && !perms.includes('settings_manage')) {
    redirect('/');
  }

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      user: {
        select: { displayName: true, username: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <History className="h-5 w-5 text-amber-600" />
            سجل تدقيق العمليات (Audit Log)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            سجل زمني لعمليات الإنشاء والتعديل والإلغاء المالي والإداري
          </p>
        </div>

        <Link
          href="/settings"
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <span>العودة للإعدادات</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
              <tr>
                <th className="py-3 px-4">التاريخ والوقت</th>
                <th className="py-3 px-4">المستخدم</th>
                <th className="py-3 px-4">نوع العملية</th>
                <th className="py-3 px-4">الكيان</th>
                <th className="py-3 px-4">الكود المرجعي</th>
                <th className="py-3 px-4">السبب / البيان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    لا توجد عمليات مسجلة في سجل التدقيق حتى الآن
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                      {new Date(log.createdAt).toLocaleString('ar-SA')}
                    </td>
                    <td className="py-2.5 px-4 font-semibold">
                      {log.user?.displayName || log.user?.username || 'النظام'}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          log.action === 'CREATE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.action === 'VOID'
                            ? 'bg-rose-100 text-rose-800'
                            : log.action === 'UPDATE'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-600">{log.entityType}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-amber-800">{log.entityCode}</td>
                    <td className="py-2.5 px-4 text-slate-600">{log.reason || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
