import { describe, it, expect, beforeAll } from 'vitest';
import { fixtureWorkbook } from './fixtures/workbook';
import * as xlsx from 'xlsx';
import { prisma } from '../src/lib/db';
import { importExcelWorkbook } from '../src/services/excel-import.service';
import { exportDatabase } from '../src/services/backup.service';

describe('Phase 7: Excel Migration, Export, and Verification', () => {
  const template = fixtureWorkbook();
  let templateItemCodes: string[] = [];

  it('should find the standard Excel template file on disk', () => {
    expect(template.length).toBeGreaterThan(0);
  });

  it('should successfully parse and import all sheets in correct order and run reconciliation', async () => {
    const fileBuffer = template;
    expect(fileBuffer.length).toBeGreaterThan(0);

    const result = await importExcelWorkbook(fileBuffer);
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    templateItemCodes = xlsx.utils.sheet_to_json<unknown[]>(workbook.Sheets['الأصناف'], { header: 1 })
      .slice(5).filter(row => row[0] && row[1]).map(row => String(row[0]).trim());

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    // Verify imported counts from template
    expect(result.counts.categories).toBeGreaterThan(0);
    expect(result.counts.units).toBeGreaterThan(0);
    expect(result.counts.parties).toBeGreaterThanOrEqual(1); // F001 أخ المالك
    expect(result.counts.items).toBeGreaterThanOrEqual(0);

    // Verify reconciliation structure
    expect(result.reconciliation).toBeDefined();
    expect(Array.isArray(result.reconciliation.items)).toBe(true);
    expect(result.reconciliation.items.length).toBe(9);

    for (const item of result.reconciliation.items) {
      expect(item.key).toBeDefined();
      expect(item.label).toBeDefined();
      expect(item.cellRef).toBeDefined();
      expect(typeof item.excelValue).toBe('number');
      expect(typeof item.systemValue).toBe('number');
      expect(typeof item.diff).toBe('number');
      expect(typeof item.matched).toBe('boolean');
    }
  });

  it('should verify that all master data entities were created in PostgreSQL correctly', async () => {
    const categoriesCount = await prisma.itemCategory.count();
    const unitsCount = await prisma.unitOption.count();
    const partiesCount = await prisma.party.count();

    expect(categoriesCount).toBeGreaterThanOrEqual(12);
    expect(unitsCount).toBeGreaterThanOrEqual(1);
    expect(partiesCount).toBeGreaterThanOrEqual(1);
    // The distributed template can contain no items. Verify its own records,
    // rather than requiring a fixture left behind by another test file.
    const items = await prisma.item.findMany({ where: { code: { in: templateItemCodes } }, select: { code: true } });
    expect(items.map(item => item.code).sort()).toEqual([...new Set(templateItemCodes)].sort());
  });

  it('should import items and transactions from a filled Excel workbook buffer', async () => {
    const fileBuffer = template;
    const wb = xlsx.read(fileBuffer, { type: 'buffer' });

    // Populate sheet الأسماء وبيانات الاتصال with a supplier
    const peopleWs = wb.Sheets['الأسماء وبيانات الاتصال'];
    xlsx.utils.sheet_add_aoa(
      peopleWs,
      [['SUP001', 'مورد نوسانتارا', 'مورد', '050111222', 'إندونيسيا', 'جاكرتا', 'جملة', '', 0, 0]],
      { origin: 'A7' }
    );

    // Populate sheet الأصناف with an item in row 6
    const itemsWs = wb.Sheets['الأصناف'];
    xlsx.utils.sheet_add_aoa(
      itemsWs,
      [['P088', 'صنف إكسل اختباري 88', 'عود طبيعي', 'جرام', 'بضاعة', 5, 20, 200000]],
      { origin: 'A6' }
    );

    // Populate sheet المشتريات with a purchase line in row 6
    const purchWs = wb.Sheets['المشتريات'];
    xlsx.utils.sheet_add_aoa(
      purchWs,
      [['2026-03-01', 'P-EX-01', 'SUP001', 'P088', 10, 10000, 0, 0, '2026-03-15', 'P000888']],
      { origin: 'A6' }
    );

    const filledBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const importRes = await importExcelWorkbook(filledBuffer);

    expect(importRes.success).toBe(true);
    expect(importRes.counts.items).toBeGreaterThanOrEqual(1);
    expect(importRes.counts.purchases).toBeGreaterThanOrEqual(1);

    const importedItem = await prisma.item.findUnique({ where: { code: 'P088' } });
    expect(importedItem).toBeDefined();
    expect(importedItem?.name).toBe('صنف إكسل اختباري 88');
  });
  it.each(['purchase-unit','purchase-landed','purchase-discount','purchase-total','sale-price','sale-discount','sale-total'])('rejects %s atomically during Excel import', async kind => {
    const wb=xlsx.read(template,{type:'buffer'});
    xlsx.utils.sheet_add_aoa(wb.Sheets['الأسماء وبيانات الاتصال'],[['SUP001','مورد نوسانتارا','مورد'],['C088','عميل إكسل للدقة','عميل']],{origin:'A7'});
    xlsx.utils.sheet_add_aoa(wb.Sheets['الأصناف'],[['P088','صنف إكسل اختباري 88','عود طبيعي','جرام','بضاعة',0,20,200000]],{origin:'A6'});
    if(kind.startsWith('purchase'))xlsx.utils.sheet_add_aoa(wb.Sheets['المشتريات'],[['2026-03-01','P-SIGN','SUP001','P088',1,kind==='purchase-unit'?-1:1,kind==='purchase-landed'?-1:0,kind==='purchase-discount'?-1:kind==='purchase-total'?2:0,'2026-03-15','P-SIGN-L']],{origin:'A6'});
    else xlsx.utils.sheet_add_aoa(wb.Sheets['المبيعات'],[['2026-03-01','S-SIGN','C088','P088',1,kind==='sale-price'?-1:1,kind==='sale-discount'?-1:2,'2026-03-15','بيع','','','S-SIGN-L']],{origin:'A6'});
    const normalize=(data:Record<string,Array<Record<string,unknown>>>)=>Object.fromEntries(Object.entries(data).map(([table,rows])=>[table,rows.sort((a,b)=>String(a.id??a.name).localeCompare(String(b.id??b.name)))]));
    const before=normalize((await exportDatabase()).data);
    await expect(importExcelWorkbook(xlsx.write(wb,{type:'buffer',bookType:'xlsx'}))).rejects.toThrow();
    expect(normalize((await exportDatabase()).data)).toEqual(before);
  });
});
