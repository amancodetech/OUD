import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock('next/headers', () => ({ cookies: () => ({ get: (k: string) => jar.has(k) ? { value: jar.get(k) } : undefined, set: (k: string, v: string) => jar.set(k, v), delete: (k: string) => jar.delete(k) }) }));
import { prisma } from '../src/lib/db';
import { assertTestDatabase } from '../src/lib/test-database';
import { createSession } from '../src/lib/auth';
import { createSaleInvoice, getSaleInvoiceById } from '../src/services/sale.service';
import { createCashTransaction } from '../src/services/cash.service';
import { createPurchaseInvoice } from '../src/services/purchase.service';
import { exportDatabase, restoreDatabase } from '../src/services/backup.service';
import { nextCashCode } from '../src/services/code-generator';
import { createStockIssue } from '../src/services/stock-issue.service';
import { createProductionBatch } from '../src/services/batch.service';
import { createDriverReferral } from '../src/services/referral.service';
import { GET as statementGET } from '../src/app/api/parties/[id]/statement/route';
import { POST as salesPOST } from '../src/app/api/sales/route';
import { POST as purchasesPOST } from '../src/app/api/purchases/route';
import { updateSystemSetting } from '../src/services/settings.service';
import { createItem } from '../src/services/master.service';
const prefix = 'ACCEPT-' + Date.now();
let client: any, supplier: any, item: any, admin: any;
const statement = (id: string, start: string, end: string) => statementGET(new NextRequest(`http://localhost/api/parties/${id}/statement?startDate=${start}&endDate=${end}`), { params: Promise.resolve({ id }) });

describe('acceptance boundaries independent of test order', () => {
  beforeAll(async () => {
    await assertTestDatabase(prisma);
    await prisma.systemSetting.update({ where: { id: 1 }, data: { lockedThroughDate: null, allowNegativeStock: false } });
    admin = await prisma.user.findUniqueOrThrow({ where: { username: 'admin' } });
    await createSession(admin);
    client = await prisma.party.create({ data: { code: prefix + 'C', name: prefix + 'C', type: 'CLIENT', openingBalance: 25 } });
    supplier = await prisma.party.create({ data: { code: prefix + 'S', name: prefix + 'S', type: 'SUPPLIER', openingBalance: 25 } });
    item = await prisma.item.create({ data: { code: prefix, name: prefix, categoryId: (await prisma.itemCategory.findFirstOrThrow()).id, unitId: (await prisma.unitOption.findFirstOrThrow()).id, openingQty: 100, openingValue: 1000 } });
    await createSaleInvoice({ invoiceDate: '2026-10-02', invoiceNo: prefix, customerId: client.id, lines: [{ itemId: item.id, qty: 2, unitPrice: 50 }] });
    await createCashTransaction({ txDate: '2026-10-03', type: 'CUSTOMER_COLLECTION', account: 'CASH', amount: 20, partyId: client.id, invoiceKey: '2026 | ' + prefix });
    await createCashTransaction({ txDate: '2026-11-01', type: 'CUSTOMER_COLLECTION', account: 'CASH', amount: 30, partyId: client.id, invoiceKey: '2026 | ' + prefix });
    await createPurchaseInvoice({ invoiceDate: '2026-10-02', invoiceNo: prefix, supplierId: supplier.id, lines: [{ itemId: item.id, qty: 2, unitCost: 50 }] });
    await createCashTransaction({ txDate: '2026-10-03', type: 'SUPPLIER_PAYMENT', account: 'BANK', amount: 20, partyId: supplier.id, invoiceKey: '2026 | ' + prefix });
    await createCashTransaction({ txDate: '2026-11-01', type: 'SUPPLIER_PAYMENT', account: 'BANK', amount: 30, partyId: supplier.id, invoiceKey: '2026 | ' + prefix });
  });
  afterAll(() => prisma.$disconnect());
  it.each(['client', 'supplier'])('limits %s statement to the cutoff and carries prior debt with the proper sign', async kind => {
    const target = kind === 'client' ? client : supplier;
    const response = await statement(target.id, '2026-10-03', '2026-10-31');
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.openingBalance).toBe(125);
    expect(data.finalBalance).toBe(105);
    expect(data.statementLines).toHaveLength(2);
    expect(data.statementLines.every((line: any) => line.date >= '2026-10-03' && line.date <= '2026-10-31')).toBe(true);
    expect(data.statementLines[0][kind === 'client' ? 'debit' : 'credit']).toBe(125);
    expect(data.statementLines[1].runningBalance).toBe(105);
    const next = await (await statement(target.id, '2026-11-01', '2026-11-30')).json();
    expect(next.openingBalance).toBe(105);
    expect(next.finalBalance).toBe(75);
  });
  it('rejects reversed and pre-installation statement ranges', async () => {
    expect((await statement(client.id, '2026-11-01', '2026-10-01')).status).toBe(400);
    expect((await statement(client.id, '2025-01-01', '2026-10-01')).status).toBe(400);
  });
  it('reserves twenty distinct concurrent document numbers', async () => {
    const codes = await Promise.all(Array.from({ length: 20 }, () => nextCashCode()));
    expect(new Set(codes).size).toBe(20);
  });
  it('rejects purchases and stock issues for an inactive item', async () => {
    await prisma.item.update({ where: { id: item.id }, data: { isActive: false } });
    try {
      await expect(createPurchaseInvoice({ invoiceDate: '2026-10-20', invoiceNo: prefix+'inactive', supplierId: supplier.id, lines: [{ itemId: item.id, qty: 1, unitCost: 1 }] })).rejects.toThrow();
      await expect(createStockIssue({ issueDate: '2026-10-20', type: 'SAMPLE', itemId: item.id, qty: 1, reason: 'Inactive item' })).rejects.toThrow();
    } finally { await prisma.item.update({ where: { id: item.id }, data: { isActive: true } }); }
  });
  it('rejects cash documents for inactive counterparties', async () => {
    await prisma.party.update({ where: { id: client.id }, data: { isActive: false } });
    try { await expect(createCashTransaction({ txDate: '2026-10-20', type: 'CUSTOMER_COLLECTION', account: 'CASH', amount: 1, partyId: client.id, invoiceKey: '2026 | '+prefix })).rejects.toThrow(); }
    finally { await prisma.party.update({ where: { id: client.id }, data: { isActive: true } }); }
  });
  it('rejects an inactive raw material or finished product in manufacturing', async () => {
    const raw = await prisma.item.create({ data: { code: prefix+'RAW', name: prefix+'RAW', categoryId: item.categoryId, unitId: item.unitId, role: 'RAW', openingQty: 10, openingValue: 10, isActive: false } });
    const finished = await prisma.item.create({ data: { code: prefix+'FIN', name: prefix+'FIN', categoryId: item.categoryId, unitId: item.unitId, role: 'FINISHED' } });
    const body = { completionDate: '2026-10-20', finishedItemId: finished.id, producedQty: 1, materials: [{ rawItemId: raw.id, consumedQty: 1 }] };
    await expect(createProductionBatch(body)).rejects.toThrow();
    await prisma.item.update({ where: { id: raw.id }, data: { isActive: true } });
    await prisma.item.update({ where: { id: finished.id }, data: { isActive: false } });
    await expect(createProductionBatch(body)).rejects.toThrow();
    await prisma.item.deleteMany({ where: { id: { in: [raw.id, finished.id] } } });
  });
  it('rejects new visits for an inactive driver', async () => {
    const driver = await prisma.party.create({ data: { code: prefix+'DR', name: prefix+'DR', type: 'DRIVER', isDriverGiftEnabled: true, isActive: false } });
    await expect(createDriverReferral({ visitDate: '2026-10-20', driverId: driver.id, visitorUniqueKey: prefix+'VIS', visitorName: 'Inactive driver visit' })).rejects.toThrow();
    await prisma.party.delete({ where: { id: driver.id } });
  });
  it('preserves four-decimal fractional quantities and landed-cost arithmetic', async () => {
    const invoice = await createPurchaseInvoice({ invoiceDate: '2026-10-20', invoiceNo: prefix+'fraction', supplierId: supplier.id, lines: [{ itemId: item.id, qty: '2.5000', unitCost: '0.2000', landedCost: '0.0300', discount: '0.0100' }] });
    const line = await prisma.purchaseLine.findFirstOrThrow({ where: { invoiceId: invoice.id } });
    expect(line.qty.toString()).toBe('2.5');
    expect(line.lineTotalCost.toString()).toBe('0.52');
    const tiny = await createPurchaseInvoice({ invoiceDate: '2026-10-20', invoiceNo: prefix+'four-decimal', supplierId: supplier.id, lines: [{ itemId: item.id, qty: '0.0001', unitCost: '10000' }] });
    const tinyLine = await prisma.purchaseLine.findFirstOrThrow({ where: { invoiceId: tiny.id } });
    expect(tinyLine.qty.toString()).toBe('0.0001');
    expect(tinyLine.lineTotalCost.toString()).toBe('1');
  });
  it.each(['sale','purchase'])('rejects sub-storage precision on %s HTTP without a document, counter, cash or audit', async type => {
    await createSession(admin);
    const before = { sales: await prisma.saleInvoice.count(), purchases: await prisma.purchaseInvoice.count(), cash: await prisma.cashTransaction.count(), audits: await prisma.auditLog.count(), counters: await prisma.documentCounter.findMany({orderBy:{name:'asc'}}) };
    const body = { invoiceDate:'2026-10-20', invoiceNo:prefix+'precision-'+type, customerId:client.id, supplierId:supplier.id, lines:[{itemId:item.id,qty:'0.00001',unitPrice:100000,unitCost:100000}] };
    const response = await (type === 'sale' ? salesPOST : purchasesPOST)(new NextRequest('http://localhost/api/'+(type === 'sale'?'sales':'purchases'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),{params:Promise.resolve({})});
    expect(response.status).toBe(400);
    expect({ sales: await prisma.saleInvoice.count(), purchases: await prisma.purchaseInvoice.count(), cash: await prisma.cashTransaction.count(), audits: await prisma.auditLog.count(), counters: await prisma.documentCounter.findMany({orderBy:{name:'asc'}}) }).toEqual(before);
  });
  it('rejects sub-precision cash, stock, opening data and settings at service boundaries', async () => {
    await expect(createCashTransaction({txDate:'2026-10-20',type:'CASH_EXPENSE',account:'CASH',amount:'0.00001'})).rejects.toThrow();
    await expect(createStockIssue({issueDate:'2026-10-20',type:'SAMPLE',itemId:item.id,qty:'0.00001',reason:'Precision boundary'})).rejects.toThrow();
    await expect(updateSystemSetting({openingCash:'0.00001'})).rejects.toThrow();
    await expect(createItem({name:prefix+'precision',categoryId:item.categoryId,unitId:item.unitId,role:'MERCHANDISE',openingQty:'0.00001',openingValue:1})).rejects.toThrow();
  });
  it('uses the sum of rounded line amounts for a fully paid fractional document', async () => {
    const lines = [1,2].map(() => ({itemId:item.id,qty:'2.5',unitPrice:'0.3333'}));
    const sale = await createSaleInvoice({invoiceDate:'2026-10-20',invoiceNo:prefix+'rounded-sale',customerId:client.id,lines,paidNow:'1.6666',collectionAccount:'CASH'});
    const rows = await prisma.saleLine.findMany({where:{invoiceId:sale.id}});
    expect(rows.map(row=>row.netSaleAmount.toString())).toEqual(['0.8333','0.8333']);
    expect((await prisma.cashTransaction.findFirstOrThrow({where:{invoiceKey:sale.invoiceKey,partyId:client.id}})).amount.toString()).toBe('1.6666');
    const purchase = await createPurchaseInvoice({invoiceDate:'2026-10-20',invoiceNo:prefix+'rounded-purchase',supplierId:supplier.id,lines:lines.map(line=>({...line,unitCost:line.unitPrice})),paidNow:'1.6666',paymentAccount:'CASH'});
    expect((await prisma.purchaseLine.findMany({where:{invoiceId:purchase.id}})).map(row=>row.lineTotalCost.toString())).toEqual(['0.8333','0.8333']);
    const tenths = await createSaleInvoice({invoiceDate:'2026-10-20',invoiceNo:prefix+'tenths',customerId:client.id,lines:[{itemId:item.id,qty:1,unitPrice:'0.1'},{itemId:item.id,qty:1,unitPrice:'0.2'}],paidNow:'0.3',collectionAccount:'CASH'});
    expect((await getSaleInvoiceById(tenths.id))?.invoiceTotal).toBe(0.3);
  });
  it('rolls back the invoice, line, cash, counter and audit when the database fails during a save', async () => {
    const before = { invoices: await prisma.saleInvoice.count(), lines: await prisma.saleLine.count(), cash: await prisma.cashTransaction.count(), audits: await prisma.auditLog.count(), counters: await prisma.documentCounter.findMany({ orderBy: { name: 'asc' } }) };
    await prisma.$executeRawUnsafe(`CREATE FUNCTION acceptance_reject_line() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."unitPrice" = 9876 THEN RAISE EXCEPTION 'acceptance injected failure'; END IF; RETURN NEW; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER acceptance_reject_line BEFORE INSERT ON "SaleLine" FOR EACH ROW EXECUTE FUNCTION acceptance_reject_line()`);
    try { await expect(createSaleInvoice({ invoiceDate: '2026-10-20', invoiceNo: prefix+'fault', customerId: client.id, paidNow: 10, collectionAccount: 'CASH', lines: [{ itemId: item.id, qty: 1, unitPrice: 9876 }] })).rejects.toThrow(); }
    finally { await prisma.$executeRawUnsafe(`DROP TRIGGER acceptance_reject_line ON "SaleLine"`); await prisma.$executeRawUnsafe(`DROP FUNCTION acceptance_reject_line()`); }
    expect({ invoices: await prisma.saleInvoice.count(), lines: await prisma.saleLine.count(), cash: await prisma.cashTransaction.count(), audits: await prisma.auditLog.count(), counters: await prisma.documentCounter.findMany({ orderBy: { name: 'asc' } }) }).toEqual(before);
  });
  it('restores complete JSON table content and rolls back invalid references completely', async () => {
    const backup = await exportDatabase();
    const later = await prisma.party.create({ data: { code: prefix + 'LATER', name: prefix + 'LATER', type: 'CLIENT' } });
    await restoreDatabase(backup, 'Acceptance full content restore');
    expect(await prisma.party.findUnique({ where: { id: later.id } })).toBeNull();
    const after = await exportDatabase();
    const normalized = (rows: any[]) => rows.map(row => { const out = { ...row }; delete out.sessionGeneration; delete out.sessionVersion; return out; }).sort((a,b) => String(a.id ?? a.name).localeCompare(String(b.id ?? b.name)));
    for (const [table, rows] of Object.entries(backup.data)) {
      const actual = table === 'auditLog' ? after.data[table].filter(row => rows.some(original => original.id === row.id)) : after.data[table];
      expect(normalized(actual), table).toEqual(normalized(rows));
    }
    expect(after.data.auditLog.length).toBe(backup.data.auditLog.length + 1);
    const invalid = structuredClone(backup);
    invalid.data.cashTransaction[0].partyId = 'missing-acceptance-party';
    await expect(restoreDatabase(invalid, 'Acceptance invalid foreign key')).rejects.toThrow();
    const unsupported = structuredClone(backup);
    unsupported.data.saleLine[0].qty = '0.00001';
    await expect(restoreDatabase(unsupported, 'Acceptance invalid numeric precision')).rejects.toThrow();
    const rollback = await exportDatabase();
    const sort = (rows: any[]) => rows.sort((a,b) => String(a.id ?? a.name).localeCompare(String(b.id ?? b.name)));
    for (const [table, rows] of Object.entries(after.data)) expect(sort(rollback.data[table]), table).toEqual(sort(rows));
  });
});
