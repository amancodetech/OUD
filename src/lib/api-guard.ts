import { NextRequest, NextResponse } from 'next/server';
import { getSession, SessionUser } from './auth';
import type { PermissionKey } from './permissions';
import { withLedgerTransaction } from './db';
import { localizeApiError } from './api-errors';
import crypto from 'node:crypto';
import { prisma } from './db';
import { workerRuntime } from './request-runtime.mjs';
import { checkWriteVersion } from './write-precondition';

class RejectedOperation extends Error {
  constructor(readonly response: Response) { super('Operation rejected'); }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
const lookups: PermissionKey[] = ['items_manage', 'inventory_view', 'sales_manage', 'purchases_manage', 'returns_manage', 'manufacturing_manage', 'stock_issues_manage', 'drivers_manage'];

export function apiPermissions(method: string, route: string): PermissionKey[] | 'admin' | 'session' | 'public' {
  if (route === '/api/auth/login') return 'public';
  if (route.startsWith('/api/auth/')) return 'session';
  if (route === '/api/settings/branding' && method === 'GET') return 'session';
  if (route.startsWith('/api/jobs')) return 'admin';
  if (route.startsWith('/api/users') || route === '/api/backup' || route.startsWith('/api/settings')) return 'admin';
  if (route === '/api/notifications') return 'session';
  if (route.startsWith('/api/categories-units')) return method === 'GET' ? lookups : ['items_manage'];
  if (route.startsWith('/api/items')) return method === 'GET' ? lookups : ['items_manage'];
  if (route.includes('/statement')) return ['debts_view'];
  if (route.startsWith('/api/parties')) return method === 'GET'
    ? [...lookups, 'parties_manage', 'cash_customer', 'cash_full', 'debts_view', 'partners_view'] : ['parties_manage'];
  if (route.startsWith('/api/fixed-assets')) return method === 'GET' ? ['partners_view', 'cash_full'] : ['partners_view'];
  if (route.startsWith('/api/partners-summary')) return ['partners_view'];
  if (route.startsWith('/api/debts')) return ['debts_view'];
  if (route.startsWith('/api/reports')) return ['dashboard_view', 'cash_full'];
  if (route.startsWith('/api/inventory')) return ['inventory_view'];
  if (route.startsWith('/api/drivers/policies')) return method === 'GET' ? ['drivers_manage', 'gift_policies_manage'] : ['gift_policies_manage'];
  if (route.startsWith('/api/drivers')) return ['drivers_manage'];
  if (route === '/api/sales/stock-check') return lookups;
  if (route === '/api/sales/driver-gift') return ['drivers_manage'];
  if (route.startsWith('/api/sales')) return ['sales_manage'];
  if (route.startsWith('/api/purchases')) return ['purchases_manage'];
  if (route.startsWith('/api/returns')) return ['returns_manage'];
  if (route.startsWith('/api/manufacturing')) return ['manufacturing_manage'];
  if (route.startsWith('/api/stock-issues')) return ['stock_issues_manage'];
  if (route.startsWith('/api/cash')) return method === 'POST' && !route.endsWith('/void') ? ['cash_customer', 'cash_full', 'drivers_manage'] : ['cash_customer', 'cash_full'];
  // Unknown endpoints are denied until explicitly assigned a policy.
  return 'admin';
}

function has(user: SessionUser, ...keys: PermissionKey[]) {
  return user.role === 'ADMIN' || keys.some(key => user.permissions?.includes(key));
}

function canUseCashType(user: SessionUser, type: string): boolean {
  return has(user, 'cash_full') ||
    (has(user, 'cash_customer') && ['CUSTOMER_COLLECTION', 'CUSTOMER_REFUND'].includes(type)) ||
    (has(user, 'drivers_manage') && ['DRIVER_AMOUNT', 'DRIVER_CASH_GIFT'].includes(type));
}

function redact(value: unknown, removed: Set<string>): unknown {
  if (Array.isArray(value)) return value.map(item => redact(item, removed));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !removed.has(key)).map(([key, child]) => [key, redact(child, removed)]));
}

function validateInput(value: unknown, depth = 0) {
  if (depth > 30) throw new Error('INPUT_INVALID');
  if (Array.isArray(value)) {
    if (value.length > 20000) throw new Error('INPUT_INVALID');
    value.forEach(child => validateInput(child, depth + 1));
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('INPUT_INVALID');
      if (/(?:Date|ThroughDate)$/.test(key) && child !== null && child !== undefined && child !== '') {
        if (typeof child !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(child) ||
            !Number.isFinite(Date.parse(child)) || new Date(child).toISOString().slice(0, 10) !== child) throw new Error('INPUT_INVALID');
      }
      validateInput(child, depth + 1);
    }
  } else if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('INPUT_INVALID');
}

export function withApiGuard(method: Method, route: string, handler: (...args: any[]) => Promise<Response>) {
  return async (request: NextRequest, context: { params: Promise<any> }): Promise<Response> => {
    const started = performance.now();
    const requestId = crypto.randomUUID();
    const run = async (): Promise<Response> => {
    try {
      const policy = apiPermissions(method, route);
      let user = policy === 'public' ? null : await getSession();
      if (policy !== 'public' && !user) return NextResponse.json({ ok: false, error: 'غير مصرح', code: 'UNAUTHORIZED' }, { status: 401 });
      if (request.url.length > 8192) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
      for (const [key, value] of request.nextUrl.searchParams) {
        if (/date$/i.test(key) && value && (!/^20\d\d-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) return NextResponse.json({ error: 'تاريخ غير صالح' }, { status: 400 });
        if (key === 'year' && (!/^20\d\d$/.test(value))) return NextResponse.json({ error: 'سنة غير صالحة' }, { status: 400 });
        if (key === 'search' && value.length > 200) return NextResponse.json({ error: 'عبارة البحث طويلة جدًا' }, { status: 400 });
      }
      const setupStatus = route === '/api/settings' && method === 'GET' && request.nextUrl.searchParams.get('status') === 'true';
      if (user && !setupStatus && ((policy === 'admin' && user.role !== 'ADMIN') ||
          (Array.isArray(policy) && !has(user, ...policy)))) {
        return NextResponse.json({ ok: false, error: 'ليس لديك صلاحية لهذه العملية', code: 'FORBIDDEN' }, { status: 403 });
      }
      if (user && route.endsWith('/void') && !has(user, 'void_documents')) {
        return NextResponse.json({ ok: false, error: 'ليس لديك صلاحية إلغاء المستندات', code: 'FORBIDDEN' }, { status: 403 });
      }
      const forwardedUrl = new URL(request.url);
      if (user && route.startsWith('/api/returns') && method === 'GET' && !has(user, 'purchases_manage', 'cash_full')) {
        if (request.nextUrl.searchParams.get('type') === 'PURCHASE_RETURN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
        forwardedUrl.searchParams.set('type', 'SALE_RETURN');
      }
      let req = request;
      let requestHash = crypto.createHash('sha256').update(request.url).digest('hex');
      let input: any;
      if (!['GET', 'HEAD'].includes(method)) {
        const origin = request.headers.get('origin');
        const expected = new URL(process.env.APP_URL || request.url).origin;
        if (origin && origin !== expected) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
        const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
        if (route === '/api/settings/import') {
          if (contentType !== 'multipart/form-data') return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 415 });
          const chunks: Uint8Array[] = [];
          const reader = request.body?.getReader();
          let size = 0;
          if (reader) for (;;) {
            const part = await reader.read(); if (part.done) break;
            size += part.value.byteLength;
            if (size > 11 * 1024 * 1024) { await reader.cancel(); return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 413 }); }
            chunks.push(part.value);
          }
          const body = Buffer.concat(chunks);
          req = new NextRequest(request.url, { method, headers: request.headers, body });
          // Node imports are transactional but should use the file hash, not a multipart boundary.
          const form = await req.clone().formData();
          const file = form.get('file');
          requestHash = crypto.createHash('sha256').update(file instanceof File ? Buffer.from(await file.arrayBuffer()) : '').update(String(form.get('mode'))).update(String(form.get('fileHash'))).digest('hex');
        } else if (request.body !== null || (method !== 'DELETE' && route !== '/api/auth/logout')) {
          if (contentType !== 'application/json') return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 415 });
          const limit = route === '/api/backup' ? 32 * 1024 * 1024 : 2 * 1024 * 1024;
          const chunks: Uint8Array[] = [];
          const reader = request.body?.getReader();
          let size = 0;
          if (reader) for (;;) {
            const part = await reader.read();
            if (part.done) break;
            size += part.value.byteLength;
            if (size > limit) { await reader.cancel(); return NextResponse.json({ error: 'الطلب أكبر من الحد المسموح' }, { status: 413 }); }
            chunks.push(part.value);
          }
          const body = Buffer.concat(chunks).toString('utf8');
          requestHash = crypto.createHash('sha256').update(request.url).update(body).digest('hex');
          const json = JSON.parse(body);
          input = json;
          if (!json || typeof json !== 'object' || Array.isArray(json)) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
          // Backup records include timestamp fields in addition to calendar dates.
          if (route !== '/api/backup') validateInput(json);
          if (user && route === '/api/cash' && !canUseCashType(user, json.type)) {
            return NextResponse.json({ error: 'ليس لديك صلاحية هذه الحركة النقدية' }, { status: 403 });
          }
          if (user && ((route === '/api/returns' && json.refundCashNow) || (route === '/api/sales' && Number(json.paidNow) > 0)) && !has(user, 'cash_customer', 'cash_full')) return NextResponse.json({ error: 'صلاحية التحصيل أو رد النقد مطلوبة' }, { status: 403 });
          if (user && ((route === '/api/returns' && json.type === 'PURCHASE_RETURN') || (route === '/api/purchases' && Number(json.paidNow) > 0)) && !has(user, ...(route === '/api/returns' ? ['purchases_manage' as PermissionKey] : ['cash_full' as PermissionKey]))) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
          req = new NextRequest(request.url, { method: request.method, headers: request.headers, body });
        }
      }
      if (user && route === '/api/cash' && method === 'GET' && !has(user, 'cash_full')) {
        if (req.nextUrl.searchParams.get('summary') === 'true') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
        forwardedUrl.searchParams.set('customerOnly', 'true');
      }
      // nextUrl is a separate URL object; handlers read req.url. Forward the enforced URL.
      if (forwardedUrl.href !== req.url) req = new NextRequest(forwardedUrl, req);
      // Resolve route params once for the handler and target authorization.
      const params = context ? await context.params : undefined;
      const invoke = () => handler(req, context ? { ...context, params } : undefined);
      const mutates = method !== 'GET' && policy !== 'public' && !route.startsWith('/api/auth/') && !(route === '/api/backup' && workerRuntime()) && !(route === '/api/settings/import' && workerRuntime());
      const response = mutates ? await withLedgerTransaction(async () => {
        const currentUser = await getSession();
        if (!currentUser || JSON.stringify([currentUser.id, currentUser.role, currentUser.permissions]) !== JSON.stringify([user?.id, user?.role, user?.permissions])) {
          throw new RejectedOperation(NextResponse.json({ code: 'SESSION_CHANGED', error: 'تغيرت الجلسة أو الصلاحيات؛ أعد تحميل الصفحة' }, { status: 401 }));
        }
        user = currentUser;
        // Check the stored target inside the same transaction as cancellation, including replays.
        if (user && route === '/api/cash/[id]/void') {
          const target = await prisma.cashTransaction.findUnique({ where: { id: params?.id }, select: { type: true } });
          if (!target) throw new RejectedOperation(NextResponse.json({ error: 'INVALID_INPUT' }, { status: 404 }));
          if (!canUseCashType(user, target.type)) throw new RejectedOperation(NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }));
        }
        if (user && route === '/api/returns/[id]/void') {
          const target = await prisma.returnLine.findUnique({ where: { id: params?.id }, select: { type: true } });
          if (!target) throw new RejectedOperation(NextResponse.json({ error: 'INVALID_INPUT' }, { status: 404 }));
          if (target.type === 'PURCHASE_RETURN' && !has(user, 'purchases_manage')) throw new RejectedOperation(NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }));
        }
        const key = request.headers.get('idempotency-key');
        if (key && (!/^[A-Za-z0-9_-]{8,128}$/.test(key) || !requestHash)) throw new RejectedOperation(NextResponse.json({ error: 'مفتاح طلب غير صالح' }, { status: 400 }));
        const receiptKey = key ? crypto.createHash('sha256').update(`${user!.id}:${method}:${route}:${key}`).digest('hex') : undefined;
        if (receiptKey) {
          const receipt = await prisma.operationReceipt.findUnique({ where: { id: receiptKey } });
          if (receipt) {
            const cached = receipt;
            if (cached.hash !== requestHash) throw new RejectedOperation(NextResponse.json({ error: 'مفتاح الطلب مستخدم لعملية مختلفة' }, { status: 409 }));
            return NextResponse.json(cached.data, { status: cached.status });
          }
        }
        const conflict = await checkWriteVersion(route, method, params?.id, input, request.headers.get('if-match'));
        if (conflict) throw new RejectedOperation(conflict);
        const result = await invoke();
        if (!result.ok) throw new RejectedOperation(result);
        if (receiptKey && result.headers.get('content-type')?.includes('application/json')) {
          await prisma.operationReceipt.create({ data: { id: receiptKey, userId: user!.id, hash: requestHash, status: result.status, data: await result.clone().json() } });
        }
        return result;
      }, route !== '/api/backup' && !route.startsWith('/api/users') && !route.startsWith('/api/categories-units')) : await invoke();
      if (!user || !response.ok || !response.headers.get('content-type')?.includes('application/json')) return response;
      let data = await response.json();
      if (!has(user, 'inventory_view', 'purchases_manage', 'cash_full', 'dashboard_view')) {
        data = redact(data, new Set(['openingValue', 'returnCost', 'damagedExpense', 'lineTotalCost', 'unitCost', 'totalCost', 'rawUnitCost', 'consumedCost', 'totalMaterialsCost', 'finishedUnitCost', 'lineCOGS', 'cogs', 'grossProfit', 'cost', 'costValue', 'monthlyAvgCost', 'availableValue', 'inventoryOutCost', 'purchaseVariance']));
      }
      if (route === '/api/cash' && method === 'GET' && !has(user, 'cash_full')) {
        data = redact(data, new Set(['runningCash', 'runningBank', 'cashRunning', 'bankRunning', 'runningBalance', 'cashBalance', 'bankBalance', 'cashAndBankTotal', 'runningTotal']));
      }
      if (route === '/api/items' && method === 'GET' && !has(user, 'inventory_view', 'items_manage', 'purchases_manage', 'cash_full', 'dashboard_view')) {
        data = redact(data, new Set(['openingValue', 'monthlyAvgCost', 'availableValue', 'unitCost', 'lineTotalCost', 'value', 'costCheck']));
      }
      if (route === '/api/parties' && method === 'GET' && !has(user, 'debts_view', 'cash_full', 'dashboard_view', 'partners_view')) {
        data = redact(data, new Set(['openingInvoice', 'openingPaid', 'openingBalance', 'openingCapital', 'profitShareRatio', 'balance', 'signedBalance', 'signedAsOf', 'debt', 'credit', 'invoiceDebt', 'invoiceCredit', 'totalDebt', 'totalCredit', 'netBalance', 'debtAsOf', 'creditAsOf', 'uncoveredAsOf', 'coverageAsOf']));
      }
      if (route === '/api/notifications') {
        const allowed: Record<string, boolean> = { INVENTORY: has(user, 'inventory_view'), DEBTS: has(user, 'debts_view'), DRIVERS: has(user, 'drivers_manage'), FINANCIAL: has(user, 'cash_full', 'dashboard_view'), SETUP: user.role === 'ADMIN' };
        const summary = data.data;
        if (summary?.notifications) {
          summary.notifications = summary.notifications.filter((n: { category: string }) => allowed[n.category]);
          summary.counts = { total: summary.notifications.length, critical: summary.notifications.filter((n: any) => n.severity === 'CRITICAL').length, warning: summary.notifications.filter((n: any) => n.severity === 'WARNING').length, info: summary.notifications.filter((n: any) => n.severity === 'INFO').length, byCategory: Object.fromEntries(Object.keys(allowed).map(key => [key, summary.notifications.filter((n: any) => n.category === key).length])) };
        }
      }
      return NextResponse.json(data, { status: response.status, headers: response.headers });
    } catch (error) {
      if (error instanceof RejectedOperation) return error.response;
      console.error('API request failed', route, error instanceof Error ? error.name : 'Error');
      const invalid = error instanceof SyntaxError || (error instanceof Error && error.message === 'INPUT_INVALID');
      return NextResponse.json({ ok: false, error: 'تعذر تنفيذ الطلب', code: invalid ? 'INVALID_INPUT' : 'REQUEST_FAILED' }, { status: invalid ? 400 : 503 });
    }
    };
    const response = await localizeApiError(await run(), request);
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('CDN-Cache-Control', 'no-store');
    response.headers.set('X-Request-Id', requestId);
    response.headers.set('Server-Timing', `app;dur=${(performance.now() - started).toFixed(1)}`);
    response.headers.append('Vary', 'Cookie');
    return response;
  };
}
