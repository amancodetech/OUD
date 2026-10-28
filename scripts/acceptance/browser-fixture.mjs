import { db, fixture, save } from './common.mjs';
try {
  const f = await fixture();
  const raw = await db.item.create({ data: { code: 'AC-RAW', name: 'Acceptance raw', role: 'RAW', categoryId: f.category.id, unitId: f.unit.id } });
  const finished = await db.item.create({ data: { code: 'AC-FIN', name: 'Acceptance finished', role: 'FINISHED', categoryId: f.category.id, unitId: f.unit.id } });
  await db.giftPolicy.create({ data: { effectiveDate: new Date('2026-01-01'), customersPerGift: 10, giftValue: 100 } });
  await db.user.create({ data: { username: 'accept_operator', displayName: 'Acceptance operator', role: 'ACCOUNTANT', permissions: ['dashboard_view','inventory_view','debts_view','sales_manage','purchases_manage','cash_customer','cash_full','returns_manage','manufacturing_manage','stock_issues_manage','void_documents'], passwordHash: f.user.passwordHash } });
  await save('browser-fixture', { customerId:f.customer.id,supplierId:f.supplier.id,itemId:f.item.id,rawId:raw.id,finishedId:finished.id,expectedOpeningCash:1000,expectedOpeningBank:2000,expectedOpeningInventory:100 });
} finally { await db.$disconnect(); }
