import { expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { databaseModels } from '@/lib/model-metadata';
import { assertWorkbookExpansion } from '@/lib/xlsx-limits';
import { fixtureWorkbook } from '../fixtures/workbook';
it('Workers metadata has every scalar field of the installed Prisma schema', () => {
  for (const model of Prisma.dmmf.datamodel.models) {
    expect(databaseModels.find(m => m.name === model.name)?.fields.map(f => [f.name, f.type])).toEqual(model.fields.filter(f => f.kind !== 'object').map(f => [f.name, f.type]));
  }
});
it('accepts a synthetic XLSX and rejects oversized ZIP expansion before parsing XML', () => {
  const workbook = fixtureWorkbook(); expect(() => assertWorkbookExpansion(workbook)).not.toThrow();
  const expanded = Buffer.from(workbook); const central = expanded.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));
  expanded.writeUInt32LE(70 * 1024 * 1024, central + 24);
  expect(() => assertWorkbookExpansion(expanded)).toThrow();
  expect(() => assertWorkbookExpansion(Buffer.from('invalid'))).toThrow();
});
