import { describe, it, expect } from 'vitest';
import { prisma } from '../src/lib/db';
import { nextPartyCode, nextItemCode, nextAssetCode } from '../src/services/code-generator';
import { createParty, createItem, createGiftPolicy, canModifyGiftPolicy } from '../src/services/master.service';
import { getSetupStatus } from '../src/services/settings.service';
import { authenticateUser } from '../src/lib/auth';
import { logAudit, getAuditLogs } from '../src/services/audit.service';
import { loadCostingEngine, loadBalancesEngine } from '../src/services/ledger-loader';

describe('Phase 2: Master Services, Codes, Auth, and Setup Status Tests', () => {
  it('Verifies code generator produces formatted sequential codes', async () => {
    const nextClient = await nextPartyCode('CLIENT');
    expect(nextClient).toMatch(/^C\d{3}$/);

    const nextSupplier = await nextPartyCode('SUPPLIER');
    expect(nextSupplier).toMatch(/^SUP\d{3}$/);

    const nextDriver = await nextPartyCode('DRIVER');
    expect(nextDriver).toMatch(/^D\d{3}$/);

    const nextItem = await nextItemCode();
    expect(nextItem).toMatch(/^P\d{3}$/);

    const nextAsset = await nextAssetCode();
    expect(nextAsset).toMatch(/^FA\d{3}$/);
  });

  it('Verifies admin authentication works with initial seed credentials', async () => {
    const admin = await authenticateUser('admin', 'admin123');
    expect(admin).not.toBeNull();
    expect(admin?.username).toBe('admin');
    expect(admin?.role).toBe('ADMIN');

    const wrongPass = await authenticateUser('admin', 'wrong-pass');
    expect(wrongPass).toBeNull();
  });

  it('Verifies partner profit share ratio validation <= 100%', async () => {
    // Attempting to create a partner with ratio > 1.0 (100%) should throw
    await expect(
      createParty({
        name: 'شريك نسبة زائدة',
        type: 'PARTNER',
        profitShareRatio: 1.5,
      })
    ).rejects.toThrow('نسبة ربح الشريك يجب أن تكون بين 0% و 100%');
  });

  it('Verifies opening balance restriction for DRIVER and PARTNER', async () => {
    await expect(
      createParty({
        name: 'سائق برصيد افتتاح غير مسموح',
        type: 'DRIVER',
        openingBalance: 500000,
      })
    ).rejects.toThrow('رصيد أول المدة مخصص للعميل والمورد والممول فقط');
  });

  it('Verifies item opening qty and value constraint', async () => {
    const categories = await prisma.itemCategory.findMany();
    const units = await prisma.unitOption.findMany();
    expect(categories.length).toBeGreaterThan(0);
    expect(units.length).toBeGreaterThan(0);

    // If openingQty is 0, openingValue > 0 must be rejected
    await expect(
      createItem({
        name: 'صنف فحص القيمة بدون كمية',
        categoryId: categories[0].id,
        unitId: units[0].id,
        openingQty: 0,
        openingValue: 50000,
      })
    ).rejects.toThrow('لا يمكن إدخال قيمة أول مدة بدون كمية أول مدة');
  });

  it('Verifies setup status evaluation', async () => {
    const status = await getSetupStatus();
    expect(typeof status.isComplete).toBe('boolean');
    expect(status.currencyOk).toBe(true);
    expect(Array.isArray(status.missingItems)).toBe(true);
  });

  it('Verifies audit log recording and retrieval', async () => {
    const testCode = 'AUDIT_TEST_001';
    await logAudit({
      action: 'TEST_ACTION',
      entityType: 'TEST_ENTITY',
      entityCode: testCode,
      reason: 'فحص تجريبي لسجل التدقيق',
      beforeJson: { val: 1 },
      afterJson: { val: 2 },
    });

    const res = await getAuditLogs({ entityCode: testCode });
    expect(res.logs.length).toBeGreaterThan(0);
    expect(res.logs[0].entityCode).toBe(testCode);
    expect(res.logs[0].reason).toBe('فحص تجريبي لسجل التدقيق');
  });

  it('Verifies ledger loader runs costing and balances without crashing', async () => {
    const costing = await loadCostingEngine();
    expect(costing).toBeDefined();
    expect(costing.itemStates).toBeDefined();
    expect(typeof costing.getItemMonthlyAvgCost).toBe('function');

    const balances = await loadBalancesEngine('2026-10-31');
    expect(balances).toBeDefined();
    expect(balances.partySummaries).toBeDefined();
    expect(balances.invoiceItems).toBeDefined();
    expect(balances.cashBalance).toBeDefined();
    expect(balances.bankBalance).toBeDefined();
  });
});
