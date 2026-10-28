import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock('next/headers', () => ({ cookies: () => ({
  get: (key: string) => jar.has(key) ? { value: jar.get(key) } : undefined,
  set: (key: string, value: string) => jar.set(key, value),
  delete: (key: string) => jar.delete(key),
}) }));
import { prisma } from '../src/lib/db';
import { assertTestDatabase } from '../src/lib/test-database';
import { createSession, getSession } from '../src/lib/auth';
import { createSaleInvoice } from '../src/services/sale.service';
import { createPurchaseInvoice } from '../src/services/purchase.service';
import { createReturnLine } from '../src/services/return.service';
import { deleteParty } from '../src/services/master.service';
import { exportDatabase, restoreDatabase } from '../src/services/backup.service';
import { GET as cashGET, POST as cashPOST } from '../src/app/api/cash/route';
import { POST as cashVoid } from '../src/app/api/cash/[id]/void/route';
import { GET as returnsGET, POST as returnsPOST } from '../src/app/api/returns/route';
import { POST as returnsVoid } from '../src/app/api/returns/[id]/void/route';
import { GET as salesGET } from '../src/app/api/sales/route';
import { GET as saleGET } from '../src/app/api/sales/[id]/route';
import { GET as sourceInvoicesGET } from '../src/app/api/returns/source-invoices/route';
import { GET as sourceLinesGET } from '../src/app/api/returns/source-lines/route';
import { GET as brandingGET } from '../src/app/api/settings/branding/route';
import { GET as dashboardGET } from '../src/app/api/reports/dashboard/route';
import { GET as settingsGET } from '../src/app/api/settings/route';
import type { PermissionKey } from '../src/lib/permissions';

const prefix = 'REV-' + Date.now();
let sequence = 0;
const code = () => prefix + '-' + (++sequence);
const context = (id?: string) => ({ params: Promise.resolve(id ? { id } : {}) });
const request = (path: string, body?: unknown, contentType = 'application/json') => new NextRequest('http://localhost' + path,
  body === undefined ? undefined : { method: 'POST', headers: contentType ? { 'Content-Type': contentType } : {}, body: JSON.stringify(body) });
let admin: any, customer: any, otherCustomer: any, supplier: any, stock: any, invoice: any, purchase: any;
let saleReturn: any, purchaseReturn: any, customerCash: any, expense: any, supplierCash: any, partnerCash: any;
async function staff(permissions: PermissionKey[]) {
  const user = await prisma.user.create({ data: { username: code(), displayName: 'Review', passwordHash: admin.passwordHash, role: 'CASHIER', permissions } });
  await createSession({ ...user, permissions });
  return user;
}
async function sourceSale() {
  return createSaleInvoice({ invoiceDate: '2026-10-20', invoiceNo: code(), customerId: customer.id,
    lines: [{ itemId: stock.id, qty: 2, unitPrice: 100 }] });
}
async function cash(type: 'CUSTOMER_COLLECTION' | 'SUPPLIER_PAYMENT' | 'CASH_EXPENSE' | 'PARTNER_CONTRIBUTION', partyId?: string, invoiceKey?: string) {
  return prisma.cashTransaction.create({ data: { code: code(), txDate: new Date('2026-10-20'), type, account: 'CASH', amount: 10, partyId, invoiceKey } });
}

describe('review regressions on disposable PostgreSQL', () => {
  beforeAll(async () => {
    await assertTestDatabase(prisma);
    await prisma.systemSetting.update({ where: { id: 1 }, data: { lockedThroughDate: null } });
    admin = await prisma.user.findUniqueOrThrow({ where: { username: 'admin' } });
    const category = await prisma.itemCategory.findFirstOrThrow();
    const unit = await prisma.unitOption.findFirstOrThrow();
    customer = await prisma.party.create({ data: { code: code(), name: code(), type: 'CLIENT' } });
    otherCustomer = await prisma.party.create({ data: { code: code(), name: code(), type: 'CLIENT' } });
    supplier = await prisma.party.create({ data: { code: code(), name: code(), type: 'SUPPLIER' } });
    const partner = await prisma.party.create({ data: { code: code(), name: code(), type: 'PARTNER' } });
    stock = await prisma.item.create({ data: { code: code(), name: code(), categoryId: category.id, unitId: unit.id, role: 'MERCHANDISE', openingQty: 100, openingValue: 1000 } });
    invoice = await sourceSale();
    purchase = await createPurchaseInvoice({ invoiceDate: '2026-10-20', invoiceNo: code(), supplierId: supplier.id, lines: [{ itemId: stock.id, qty: 10, unitCost: 10 }] });
    const saleLine = await prisma.saleLine.findFirstOrThrow({ where: { invoiceId: invoice.id } });
    const purchaseLine = await prisma.purchaseLine.findFirstOrThrow({ where: { invoiceId: purchase.id } });
    saleReturn = await createReturnLine({ type: 'SALE_RETURN', returnDate: '2026-10-21', returnDocNo: code(), partyId: customer.id, invoiceKey: invoice.invoiceKey, sourceSaleLineId: saleLine.id, qty: 1, saleReturnCondition: 'DAMAGED', reason: 'Review fixture' });
    purchaseReturn = await createReturnLine({ type: 'PURCHASE_RETURN', returnDate: '2026-10-21', returnDocNo: code(), partyId: supplier.id, invoiceKey: purchase.invoiceKey, sourcePurchaseLineId: purchaseLine.id, qty: 1, reason: 'Review fixture' });
    customerCash = await cash('CUSTOMER_COLLECTION', customer.id, invoice.invoiceKey);
    supplierCash = await cash('SUPPLIER_PAYMENT', supplier.id, purchase.invoiceKey);
    expense = await cash('CASH_EXPENSE');
    partnerCash = await cash('PARTNER_CONTRIBUTION', partner.id);
  });
  beforeEach(async () => {
    jar.clear();
    await prisma.systemSetting.update({ where: { id: 1 }, data: { lockedThroughDate: null } });
  });
  afterAll(() => prisma.$disconnect());

  it.each(['application/json', 'text/plain', 'application/octet-stream', ''])('cannot bypass cash type authorization with content type %s', async contentType => {
    await staff(['cash_customer']);
    const count = await prisma.cashTransaction.count();
    for (const type of ['CASH_EXPENSE', 'SUPPLIER_PAYMENT', 'PARTNER_CONTRIBUTION']) {
      const response = await cashPOST(request('/api/cash', { txDate: '2026-10-22', type, account: 'CASH', amount: 5, partyId: supplier.id, invoiceKey: purchase.invoiceKey }, contentType), context());
      expect(response.status).toBe(contentType === 'application/json' ? 403 : 415);
    }
    expect(await prisma.cashTransaction.count()).toBe(count);
  });
  it('accepts JSON with charset for an authorized customer collection', async () => {
    await staff(['cash_customer']);
    const response = await cashPOST(request('/api/cash', { txDate: '2026-10-22', type: 'CUSTOMER_COLLECTION', account: 'CASH', amount: 5, partyId: customer.id, invoiceKey: invoice.invoiceKey }, 'Application/JSON; charset=utf-8'), context());
    expect(response.status).toBe(201);
  });
  it('filters the URL consumed by cash handlers and strips aggregate balances', async () => {
    await staff(['cash_customer']);
    const response = await cashGET(request('/api/cash?customerOnly=false'), context());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.some((row: any) => row.id === customerCash.id)).toBe(true);
    expect(data.every((row: any) => ['CUSTOMER_COLLECTION', 'CUSTOMER_REFUND'].includes(row.type))).toBe(true);
    expect(data.every((row: any) => row.runningCash === undefined && row.runningBank === undefined)).toBe(true);
    expect(await (await cashGET(request('/api/cash?type=SUPPLIER_PAYMENT'), context())).json()).toEqual([]);
    expect((await cashGET(request('/api/cash?summary=true'), context())).status).toBe(403);
  });
  it('filters purchase returns from restricted reads, including source-line lookups', async () => {
    await staff(['returns_manage']);
    const response = await returnsGET(request('/api/returns'), context());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.some((row: any) => row.id === saleReturn.id)).toBe(true);
    expect(data.every((row: any) => row.type === 'SALE_RETURN')).toBe(true);
    expect((await returnsGET(request('/api/returns?type=PURCHASE_RETURN'), context())).status).toBe(403);
    expect((await sourceLinesGET(request('/api/returns/source-lines?type=PURCHASE_RETURN&invoiceKey=' + encodeURIComponent(purchase.invoiceKey)), context())).status).toBe(403);
  });
  it('authorizes the actual cash document before cancellation and preserves denied targets', async () => {
    await staff(['cash_customer', 'void_documents']);
    for (const target of [supplierCash, expense, partnerCash]) {
      const before = await prisma.auditLog.count();
      expect((await cashVoid(request('/api/cash/' + target.id + '/void', { reason: 'Review cancellation', type: 'CUSTOMER_COLLECTION' }), context(target.id))).status).toBe(403);
      expect((await prisma.cashTransaction.findUniqueOrThrow({ where: { id: target.id } })).status).toBe('POSTED');
      expect(await prisma.auditLog.count()).toBe(before);
    }
    expect((await cashVoid(request('/api/cash/' + customerCash.id + '/void', { reason: 'Review cancellation' }), context(customerCash.id))).status).toBe(200);
  });
  it('requires purchase permission to cancel a purchase return', async () => {
    await staff(['returns_manage', 'void_documents']);
    expect((await returnsVoid(request('/api/returns/' + purchaseReturn.id + '/void', { reason: 'Review cancellation' }), context(purchaseReturn.id))).status).toBe(403);
    expect((await prisma.returnLine.findUniqueOrThrow({ where: { id: purchaseReturn.id } })).status).toBe('POSTED');
    await staff(['returns_manage', 'purchases_manage', 'void_documents']);
    expect((await returnsVoid(request('/api/returns/' + purchaseReturn.id + '/void', { reason: 'Review cancellation' }), context(purchaseReturn.id))).status).toBe(200);
  });
  it('honors explicit purchase-return permissions for a custom cashier account', async () => {
    const line = await prisma.purchaseLine.findFirstOrThrow({ where: { invoiceId: purchase.id } });
    const body = { type: 'PURCHASE_RETURN', returnDate: '2026-10-22', returnDocNo: code(), partyId: supplier.id, invoiceKey: purchase.invoiceKey, sourcePurchaseLineId: line.id, qty: 1, reason: 'Custom permitted return' };
    await staff(['returns_manage']);
    expect((await returnsPOST(request('/api/returns', body), context())).status).toBe(403);
    await staff(['returns_manage', 'purchases_manage']);
    expect((await returnsPOST(request('/api/returns', body), context())).status).toBe(201);
  });
  it('retains full cash access and the generic cancellation permission', async () => {
    await staff(['cash_full']);
    const rows = await (await cashGET(request('/api/cash'), context())).json();
    expect(rows.some((row: any) => row.id === expense.id)).toBe(true);
    expect((await cashVoid(request('/api/cash/' + expense.id + '/void', { reason: 'Review cancellation' }), context(expense.id))).status).toBe(403);
    await staff(['cash_full', 'void_documents']);
    expect((await cashVoid(request('/api/cash/' + expense.id + '/void', { reason: 'Review cancellation' }), context(expense.id))).status).toBe(200);
  });
  it('redacts nested item costs and derived return costs across document responses', async () => {
    await staff(['sales_manage', 'returns_manage']);
    const detail = await (await saleGET(request('/api/sales/' + invoice.id), context(invoice.id))).json();
    expect(detail.lines[0].item.openingValue).toBeUndefined();
    const rows = await (await returnsGET(request('/api/returns'), context())).json();
    const row = rows.find((value: any) => value.id === saleReturn.id);
    expect(row.returnCost).toBeUndefined();
    expect(row.damagedExpense).toBeUndefined();
    expect(row.sourceSaleLine.item.openingValue).toBeUndefined();
    await staff(['sales_manage', 'returns_manage', 'inventory_view']);
    const privileged = await (await saleGET(request('/api/sales/' + invoice.id), context(invoice.id))).json();
    expect(Number(privileged.lines[0].item.openingValue)).toBe(1000);
    const privilegedRows = await (await returnsGET(request('/api/returns'), context())).json();
    expect(privilegedRows.find((value: any) => value.id === saleReturn.id).damagedExpense).toBeGreaterThan(0);
  });
  it('allows a return-only operator to complete source lookup and return creation', async () => {
    const source = await sourceSale();
    const voided = await sourceSale();
    await prisma.saleInvoice.update({ where: { id: voided.id }, data: { status: 'VOID' } });
    await staff(['returns_manage']);
    expect((await salesGET(request('/api/sales?customerId=' + customer.id), context())).status).toBe(403);
    const response = await sourceInvoicesGET(request('/api/returns/source-invoices?type=SALE_RETURN&partyId=' + customer.id), context());
    expect(response.status).toBe(200);
    const rows = await response.json();
    expect(rows.some((row: any) => row.id === source.id && row.netTotal === 200)).toBe(true);
    expect(rows.some((row: any) => row.id === voided.id)).toBe(false);
    expect(Object.keys(rows[0]).sort()).toEqual(['id', 'invoiceDate', 'invoiceKey', 'invoiceNo', 'netTotal']);
    expect(await (await sourceInvoicesGET(request('/api/returns/source-invoices?type=SALE_RETURN&partyId=' + otherCustomer.id), context())).json()).toEqual([]);
    expect((await sourceInvoicesGET(request('/api/returns/source-invoices?type=PURCHASE_RETURN&partyId=' + supplier.id), context())).status).toBe(403);
    expect((await sourceInvoicesGET(request('/api/returns/source-invoices?type=SALE_RETURN'), context())).status).toBe(400);
    const lines = await (await sourceLinesGET(request('/api/returns/source-lines?type=SALE_RETURN&invoiceKey=' + encodeURIComponent(source.invoiceKey) + '&partyId=' + customer.id), context())).json();
    expect(lines.length).toBeGreaterThan(0);
    expect((await returnsPOST(request('/api/returns', { type: 'SALE_RETURN', returnDate: '2026-10-22', returnDocNo: code(), partyId: customer.id, invoiceKey: source.invoiceKey, sourceSaleLineId: lines[0].id, qty: 1, saleReturnCondition: 'GOOD', reason: 'Permitted workflow' }), context())).status).toBe(201);
  });
  it('permits purchase source lookup only with the additional purchase permission', async () => {
    await staff(['returns_manage', 'purchases_manage']);
    const response = await sourceInvoicesGET(request('/api/returns/source-invoices?type=PURCHASE_RETURN&partyId=' + supplier.id), context());
    expect(response.status).toBe(200);
    const rows = await response.json();
    expect(rows.some((row: any) => row.id === purchase.id && row.netTotal === 100)).toBe(true);
    expect(Object.keys(rows[0]).sort()).toEqual(['id', 'invoiceDate', 'invoiceKey', 'invoiceNo', 'netTotal']);
  });
  it('permits a sales-return cancellation for an operator with void permission', async () => {
    const source = await sourceSale();
    const line = await prisma.saleLine.findFirstOrThrow({ where: { invoiceId: source.id } });
    const returned = await createReturnLine({ type: 'SALE_RETURN', returnDate: '2026-10-22', returnDocNo: code(), partyId: customer.id, invoiceKey: source.invoiceKey, sourceSaleLineId: line.id, qty: 1, saleReturnCondition: 'GOOD', reason: 'Review cancellation fixture' });
    await staff(['returns_manage', 'void_documents']);
    expect((await returnsVoid(request('/api/returns/' + returned.id + '/void', { reason: 'Review allowed cancellation' }), context(returned.id))).status).toBe(200);
    expect((await prisma.returnLine.findUniqueOrThrow({ where: { id: returned.id } })).status).toBe('VOID');
  });
  it('exposes only store branding to authenticated invoice consumers', async () => {
    expect((await brandingGET(request('/api/settings/branding'), context())).status).toBe(401);
    await staff(['sales_manage']);
    const setting = await prisma.systemSetting.findUniqueOrThrow({ where: { id: 1 } });
    expect(await (await brandingGET(request('/api/settings/branding'), context())).json()).toEqual({ ok: true, data: { storeName: setting.storeName } });
    expect((await settingsGET(request('/api/settings'), context())).status).toBe(403);
  });
  it.each(['openingBalance', 'openingInvoice', 'openingPaid', 'openingCapital'] as const)('protects %s on party deletion, including locked periods', async field => {
    for (const amount of [25, -25]) {
      const target = await prisma.party.create({ data: { code: code(), name: code(), type: field === 'openingCapital' ? 'PARTNER' : 'CLIENT', [field]: amount } });
      await expect(deleteParty(target.id)).rejects.toThrow();
      await prisma.systemSetting.update({ where: { id: 1 }, data: { lockedThroughDate: new Date('2026-10-25') } });
      await expect(deleteParty(target.id)).rejects.toThrow();
      expect(Number((await prisma.party.findUniqueOrThrow({ where: { id: target.id } }))[field])).toBe(amount);
    }
  });
  it('allows removal of unused parties with no opening financial amounts', async () => {
    const target = await prisma.party.create({ data: { code: code(), name: code(), type: 'SUPPLIER' } });
    await deleteParty(target.id);
    expect(await prisma.party.findUnique({ where: { id: target.id } })).toBeNull();
  });
  it('applies report dates to cards and chart rows and rejects reversed or pre-installation ranges', async () => {
    await createSession(admin);
    const response = await dashboardGET(request('/api/reports/dashboard?startDate=2026-10-20&endDate=2026-10-21'), context());
    expect(response.status).toBe(200);
    const report = await response.json();
    expect(report.startDate).toBe('2026-10-20');
    expect(report.endDate).toBe('2026-10-21');
    expect(report.monthlyComparison).toHaveLength(1);
    expect(report.monthlyComparison[0].netSales).toBeCloseTo(report.cards.netSales, 4);
    expect(report.monthlyComparison[0].endingInventoryValue).toBeCloseTo(report.cards.inventoryValue, 4);
    expect((await dashboardGET(request('/api/reports/dashboard?startDate=2026-10-21&endDate=2026-10-20'), context())).status).toBe(400);
    expect((await dashboardGET(request('/api/reports/dashboard?startDate=2025-01-01&endDate=2026-10-20'), context())).status).toBe(400);
  });
  it('revokes actual sessions on every repeated or older restore, including version-2 files without generations', async () => {
    const backup = await exportDatabase();
    // This also covers a previously revoked, higher sessionVersion and older backup format.
    for (const row of backup.data.user) delete row.sessionGeneration;
    await prisma.user.update({ where: { id: admin.id }, data: { sessionVersion: 100 } });
    await createSession(admin);
    const tokens = [jar.get('auth_session')!];
    for (let restore = 0; restore < 3; restore++) {
      await restoreDatabase(backup, 'Review repeated restore');
      for (const token of tokens) {
        jar.set('auth_session', token);
        expect(await getSession()).toBeNull();
      }
      await createSession(admin);
      expect(await getSession()).not.toBeNull();
      tokens.push(jar.get('auth_session')!);
    }
    expect(new Set(tokens).size).toBe(tokens.length);
  });
});
