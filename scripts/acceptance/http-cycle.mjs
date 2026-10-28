import assert from 'node:assert/strict';
import { db, fixture, login, request, check, checks, save } from './common.mjs';

try {
  const f = await fixture();
  const cookie = await login();
  let purchase, sale, firstReturn, secondReturn;
  const expected = [
    [10,100,1000,2000,0,0,0], [30,300,1000,2000,0,200,0],
    [30,300,1000,1880,0,80,0], [25,250,1100,1880,50,80,100],
    [26,260,1100,1880,20,80,80], [26,260,1120,1880,0,80,80],
    [27,270,1090,1880,0,80,60], [26,260,1120,1880,0,80,80],
    [24,240,1120,1880,0,60,80], [24,240,1105,1880,0,60,65],
  ];
  const snapshots = [];
  const get = async path => (await request(path, { cookie })).data;
  const post = async (path, body, status = 201, headers) => (await request(path, { method: 'POST', body, cookie, status, headers })).data;
  async function snapshot(step) {
    const date = step ? `2026-10-${String(Math.min(step, 9)).padStart(2, '0')}` : '2026-09-30';
    const cards = (await get(`/api/reports/dashboard?startDate=2026-01-01&endDate=${date}`)).cards;
    const inv = await get(`/api/inventory?asOfDate=${date}`);
    const customer = await get(`/api/parties/${f.customer.id}/statement?endDate=${date}`);
    const supplier = await get(`/api/parties/${f.supplier.id}/statement?endDate=${date}`);
    const actual = [inv.items.find(i => i.id === f.item.id).availableQty, cards.inventoryValue, cards.cashBalance, cards.bankBalance, customer.finalBalance, supplier.finalBalance, cards.operatingProfit];
    check(`independent financial cycle step ${step}`, actual, expected[step]);
    check(`opening difference at step ${step}`, cards.openingEquityDiff, 0);
    assert.equal(cards.clientDebtTotal, expected[step][4]);
    assert.equal(cards.supplierDebtTotal, expected[step][5]);
    snapshots.push({ step, date, expected: expected[step], actual, cards });
  }
  await snapshot(0);
  purchase = await post('/api/purchases', { invoiceDate: '2026-10-01', invoiceNo: 'AC-BUY', supplierId: f.supplier.id, lines: [{ itemId: f.item.id, qty: 20, unitCost: 10 }] });
  await snapshot(1);
  await post('/api/cash', { txDate: '2026-10-02', type: 'SUPPLIER_PAYMENT', account: 'BANK', amount: 120, partyId: f.supplier.id, invoiceKey: purchase.invoiceKey });
  await snapshot(2);
  sale = await post('/api/sales', { invoiceDate: '2026-10-03', invoiceNo: 'AC-SALE', customerId: f.customer.id, paidNow: 100, collectionAccount: 'CASH', lines: [{ itemId: f.item.id, qty: 5, unitPrice: 30 }] });
  await snapshot(3);
  const saleLine = await db.saleLine.findFirstOrThrow({ where: { invoiceId: sale.id } });
  const ret = (date, doc, refundCashNow = false) => ({ type: 'SALE_RETURN', returnDate: date, returnDocNo: doc, partyId: f.customer.id, invoiceKey: sale.invoiceKey, sourceSaleLineId: saleLine.id, qty: 1, saleReturnCondition: 'GOOD', reason: 'Acceptance return', refundCashNow, refundAccount: 'CASH' });
  firstReturn = await post('/api/returns', ret('2026-10-04', 'AC-RET-1'));
  await snapshot(4);
  await post('/api/cash', { txDate: '2026-10-05', type: 'CUSTOMER_COLLECTION', account: 'CASH', amount: 20, partyId: f.customer.id, invoiceKey: sale.invoiceKey });
  await snapshot(5);
  secondReturn = await post('/api/returns', ret('2026-10-06', 'AC-RET-2', true));
  await snapshot(6);
  await post(`/api/returns/${secondReturn.id}/void`, { reason: 'Acceptance reversal' }, 200);
  check('linked refund reversed', (await db.cashTransaction.findUniqueOrThrow({ where: { sourceReturnId: secondReturn.id } })).status, 'VOID');
  await snapshot(7);
  const purchaseLine = await db.purchaseLine.findFirstOrThrow({ where: { invoiceId: purchase.id } });
  await post('/api/returns', { type: 'PURCHASE_RETURN', returnDate: '2026-10-08', returnDocNo: 'AC-PRET', partyId: f.supplier.id, invoiceKey: purchase.invoiceKey, sourcePurchaseLineId: purchaseLine.id, qty: 2, reason: 'Acceptance supplier return' });
  await snapshot(8);
  await post('/api/cash', { txDate: '2026-10-09', type: 'CASH_EXPENSE', account: 'CASH', amount: 15, description: 'Acceptance expense' });
  await snapshot(9);
  const cards = snapshots.at(-1).cards;
  check('final independent income totals', [cards.netSales, cards.netCOGS, cards.grossProfit, cards.cashOperatingExpenses, cards.operatingProfit], [120,40,80,15,65]);
  check('independent equity identity', cards.cashAndBankTotal + cards.inventoryValue - cards.supplierDebtTotal, 3100 + cards.operatingProfit);
  // Window end must exclude later posted documents; start keeps the carried balance.
  const early = await get(`/api/parties/${f.customer.id}/statement?startDate=2026-10-04&endDate=2026-10-04`);
  check('statement date end excludes later collection', early.finalBalance, 20);
  check('statement contains only requested period', early.statementLines.every(line => line.date >= '2026-10-04' && line.date <= '2026-10-04'), true);
  check('statement carries prior balance', early.openingBalance, 50);
  await request(`/api/parties/${f.customer.id}/statement?startDate=2026-10-05&endDate=2026-10-04`, { cookie, status: 400 });
  await save('http-cycle', { checks, snapshots, fixtureIds: { ...f, user: undefined } });
  console.log(`PASS ${checks.length} independent HTTP checks`);
} catch (error) {
  await save('http-cycle', { checks, failure: error.message });
  throw error;
} finally { await db.$disconnect(); }
