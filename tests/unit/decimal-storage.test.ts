import { describe, expect, it } from 'vitest';
import { formatInvoiceNumber, roundMoney, toDecimal, toStorageDecimal } from '../../src/domain/decimal';
import { localizeApiError } from '../../src/lib/api-errors';
import { NextRequest } from 'next/server';

describe('document storage precision policy', () => {
  it.each(['0.00001', '1.23456', '-0.00001', '100000000000000', 'NaN', 'Infinity'])('rejects unsupported stored value %s', value => {
    expect(() => toStorageDecimal(value)).toThrow();
  });
  it.each(['0', '0.0001', '1.2345', '1.23000', '99999999999999.9999'])('preserves representable stored value %s', value => {
    expect(toStorageDecimal(value).eq(toDecimal(value))).toBe(true);
  });
  it('rounds each line commercially before summing the invoice', () => {
    const line = roundMoney(toDecimal('2.5').times('0.3333'));
    expect(line.toString()).toBe('0.8333');
    expect(line.plus(line).toString()).toBe('1.6666');
  });
  it.each(['ar','en','id'])('preserves the smallest supported quantity in %s print formatting', locale => {
    const formatted = formatInvoiceNumber('0.0001', locale);
    expect(formatted).toBe(locale === 'id' ? '0,0001' : '0.0001');
    expect(formatInvoiceNumber('0.1234', locale)).toContain('1234');
  });
  it.each(['ar','en','id'])('explains the precision constraint in %s', async locale => {
    const response=await localizeApiError(Response.json({error:'القيم والكميات تقبل أربع منازل عشرية كحد أقصى'},{status:400}),new NextRequest('http://localhost/api/sales',{headers:{Cookie:'oud_locale='+locale}}));
    const data=await response.json();expect(data.code).toBe('NUMERIC_PRECISION');expect(data.error).toMatch(/أربع|four|empat/);
  });
});
