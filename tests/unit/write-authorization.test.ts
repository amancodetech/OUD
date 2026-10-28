import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const state = vi.hoisted(() => ({ user: null as any, cashType: 'CUSTOMER_COLLECTION', returnType: 'SALE_RETURN' }));
vi.mock('@/lib/auth', () => ({ getSession: async () => state.user }));
vi.mock('@/lib/db', () => ({ withLedgerTransaction: async (fn: () => unknown) => fn(), prisma: {
  cashTransaction: { findUnique: async () => ({ type: state.cashType }) },
  returnLine: { findUnique: async () => ({ type: state.returnType }) },
} }));
import { withApiGuard } from '@/lib/api-guard';
// Independently declared feature policy. New write endpoints fail the inventory
// assertion until their expected permission is deliberately reviewed here.
const policy: Record<string, string[]> = {
  'POST /api/auth/login': ['public'], 'POST /api/auth/logout': ['session'],
  'POST /api/backup': ['admin'], 'POST /api/settings': ['admin'], 'POST /api/settings/import': ['admin'],
  'POST /api/users': ['admin'], 'PATCH /api/users/[id]': ['admin'],
  'POST /api/categories-units': ['items_manage'], 'PUT /api/categories-units': ['items_manage'], 'DELETE /api/categories-units': ['items_manage'],
  'POST /api/items': ['items_manage'], 'PUT /api/items/[id]': ['items_manage'], 'DELETE /api/items/[id]': ['items_manage'],
  'POST /api/parties': ['parties_manage'], 'PUT /api/parties/[id]': ['parties_manage'], 'DELETE /api/parties/[id]': ['parties_manage'],
  'POST /api/fixed-assets': ['partners_view'], 'PUT /api/fixed-assets/[id]': ['partners_view'], 'DELETE /api/fixed-assets/[id]': ['partners_view'],
  'POST /api/drivers/policies': ['gift_policies_manage'], 'PUT /api/drivers/policies/[id]': ['gift_policies_manage'], 'DELETE /api/drivers/policies/[id]': ['gift_policies_manage'],
  'POST /api/drivers/referrals': ['drivers_manage'], 'POST /api/drivers/referrals/[id]/void': ['drivers_manage'],
  'POST /api/sales': ['sales_manage'], 'POST /api/sales/driver-gift': ['drivers_manage'], 'POST /api/sales/[id]/void': ['sales_manage'],
  'POST /api/purchases': ['purchases_manage'], 'POST /api/purchases/[id]/void': ['purchases_manage'],
  'POST /api/returns': ['returns_manage'], 'POST /api/returns/[id]/void': ['returns_manage'],
  'POST /api/stock-issues': ['stock_issues_manage'], 'POST /api/stock-issues/[id]/void': ['stock_issues_manage'],
  'POST /api/manufacturing': ['manufacturing_manage'], 'POST /api/manufacturing/[id]/void': ['manufacturing_manage'],
  'POST /api/cash': ['cash_customer', 'cash_full'], 'POST /api/cash/[id]/void': ['cash_customer', 'cash_full'],
};
const permissions = ['dashboard_view','inventory_view','debts_view','sales_manage','cash_customer','cash_full','purchases_manage','returns_manage','stock_issues_manage','manufacturing_manage','drivers_manage','items_manage','parties_manage','partners_view','gift_policies_manage','void_documents','settings_manage'];
beforeEach(() => { state.cashType='CUSTOMER_COLLECTION'; state.returnType='SALE_RETURN'; });
async function invoke(method: string, route: string, body: object = { type: 'CUSTOMER_COLLECTION' }) {
  const handler = vi.fn(async () => NextResponse.json({ ok: true }));
  const headers = { 'Content-Type': route === '/api/settings/import' ? 'multipart/form-data; boundary=unit' : 'application/json' };
  const req = new NextRequest('http://localhost'+route.replace('[id]','target'), { method, headers, body: JSON.stringify(body) });
  const response = await withApiGuard(method as any, route, handler)(req, { params: Promise.resolve({ id: 'target' }) });
  return { status: response.status, calls: handler.mock.calls.length };
}
describe('complete write endpoint authorization matrix', () => {
  it('covers every exported write method, including physical deletions and admin actions', () => {
    const inventory: string[] = [];
    const scan = (dir: string) => { for (const entry of readdirSync(dir,{withFileTypes:true})) {
      const file=join(dir,entry.name);if(entry.isDirectory())scan(file);
      else if(entry.name==='route.ts') for(const match of readFileSync(file,'utf8').matchAll(/export const (POST|PUT|PATCH|DELETE)\b/g)) inventory.push(`${match[1]} ${file.replace('src/app','').replace('/route.ts','')}`);
    } };scan('src/app/api');expect(inventory.sort()).toEqual(Object.keys(policy).sort());
  });
  const accounts = [null, [], ...permissions.map(p=>[p]), ...permissions.filter(p=>p!=='void_documents').map(p=>[p,'void_documents']), ['ALL'], ['ADMIN']];
  for(const [endpoint, allowed] of Object.entries(policy)) for(const grants of accounts) {
    it(`${grants?.join('+') ?? 'anonymous'} → ${endpoint}`, async () => {
      const admin=grants?.[0]==='ADMIN';
      state.user=grants===null?null:{id:'test',role:admin?'ADMIN':'CASHIER',permissions:grants[0]==='ALL'?permissions:grants};
      const [method,route]=endpoint.split(' ');
      const can=allowed.includes('public') || (grants!==null && (admin || allowed.includes('session') || (!allowed.includes('admin') && allowed.some(p=>state.user.permissions.includes(p)) && (!route.endsWith('/void') || state.user.permissions.includes('void_documents')))));
      expect(await invoke(method,route)).toEqual({status:can?200:grants===null?401:403,calls:can?1:0});
    });
  }
  it.each(['SUPPLIER_PAYMENT','CASH_EXPENSE','PARTNER_DRAWING','LOAN_REPAYMENT','ASSET_PURCHASE'])('customer permission cannot create or cancel %s', async type => {
    state.user={id:'test',role:'CASHIER',permissions:['cash_customer','void_documents']};state.cashType=type;
    expect((await invoke('POST','/api/cash',{type})).status).toBe(403);
    expect((await invoke('POST','/api/cash/[id]/void')).status).toBe(403);
  });
  it('requires supplier permission for both purchase return creation and cancellation', async () => {
    state.user={id:'test',role:'CASHIER',permissions:['returns_manage','void_documents']};state.returnType='PURCHASE_RETURN';
    expect((await invoke('POST','/api/returns',{type:'PURCHASE_RETURN'})).status).toBe(403);
    expect((await invoke('POST','/api/returns/[id]/void')).status).toBe(403);
    state.user.permissions.push('purchases_manage');
    expect((await invoke('POST','/api/returns',{type:'PURCHASE_RETURN'})).status).toBe(200);
    expect((await invoke('POST','/api/returns/[id]/void')).status).toBe(200);
  });
  it.each([['/api/sales',{paidNow:1},'sales_manage','cash_customer'],['/api/purchases',{paidNow:1},'purchases_manage','cash_full'],['/api/returns',{refundCashNow:true},'returns_manage','cash_customer']] as const)('checks additional cash permission for %s', async (route,body,main,cash) => {
    state.user={id:'test',role:'CASHIER',permissions:[main]};expect((await invoke('POST',route,body)).status).toBe(403);
    state.user.permissions.push(cash);expect((await invoke('POST',route,body)).status).toBe(200);
  });
  it('permits driver-only cash types and refuses supplier/expense types', async () => {
    state.user={id:'test',role:'CASHIER',permissions:['drivers_manage']};
    for(const type of ['DRIVER_AMOUNT','DRIVER_CASH_GIFT'])expect((await invoke('POST','/api/cash',{type})).status).toBe(200);
    for(const type of ['CUSTOMER_COLLECTION','SUPPLIER_PAYMENT','CASH_EXPENSE'])expect((await invoke('POST','/api/cash',{type})).status).toBe(403);
  });
});
