import { describe, it, expect } from 'vitest';
import { testDatabaseUrl } from '../../src/lib/test-database';
import { todayInStore, parseDateParts } from '../../src/domain/period';
import { toDecimal } from '../../src/domain/decimal';
import { resolveUserPermissions, canAccessHref } from '../../src/lib/permissions';
import { tLocalizedName } from '../../src/i18n/translate-domain';
import { readValidatedWorkbook } from '../../src/services/excel-validation';
import * as xlsx from 'xlsx';

describe('safety and localization boundaries', () => {
  it.each([undefined, 'postgresql://u:p@localhost:5432/oud_erp', 'postgresql://u:p@remote/oud_test_1', 'postgresql://u:p@localhost/test'])('rejects non-test targets (%s)', value => {
    expect(() => testDatabaseUrl(value ?? '')).toThrow();
  });
  it('accepts an explicitly named disposable local database', () => expect(testDatabaseUrl('postgresql://u:p@127.0.0.1:5555/oud_test_run1')).toContain('/oud_test_run1'));
  it('uses the store day around midnight regardless of host timezone', () => expect(todayInStore(new Date('2026-10-25T17:00:00Z'))).toBe('2026-10-26'));
  it.each(['2026-02-30', '2026-13-01', '2026-00-01'])('rejects invalid calendar dates %s', date => expect(() => parseDateParts(date)).toThrow());
  it.each(['NaN','Infinity','-Infinity'])('rejects non-finite numeric input %s', value => expect(() => toDecimal(value)).toThrow());
  it('honors empty permissions and validates keys', () => {
    expect(resolveUserPermissions('CASHIER', [])).toEqual([]);
    expect(() => resolveUserPermissions('CASHIER', ['not-a-permission'])).toThrow();
    expect(canAccessHref('/sales/new', [])).toBe(false);
    expect(canAccessHref('/sales/new', ['sales_manage'])).toBe(true);
  });
  it('grants statements through debts_view without granting party management', () => {
    expect(canAccessHref('/parties/client-1/statement', ['debts_view'])).toBe(true);
    expect(canAccessHref('/parties/client-1/statement', ['parties_manage'])).toBe(false);
    expect(canAccessHref('/parties/client-1', ['debts_view'])).toBe(false);
    expect(canAccessHref('/parties/client-1/statement/extra', ['debts_view'])).toBe(false);
  });
  it('selects the Indonesian name', () => expect(tLocalizedName({name:'عربي',nameEn:'English',nameId:'Indonesia'},'id')).toBe('Indonesia'));
  it('rejects an unrelated workbook before any database lookup', () => {
    const w=xlsx.utils.book_new();xlsx.utils.book_append_sheet(w,xlsx.utils.aoa_to_sheet([['unrelated']]),'unrelated');
    expect(()=>readValidatedWorkbook(xlsx.write(w,{type:'buffer',bookType:'xlsx'}))).toThrow();
  });
});
