import { prisma } from '@/lib/db';
import { stockQuantitiesAt } from './stock-integrity';
import { todayInStore } from '@/domain/period';
import type { PartyType } from '@prisma/client';

export async function itemLookup(asOfDate = todayInStore()) {
  const [items, quantities] = await Promise.all([
    prisma.item.findMany({ where: { isActive: true }, orderBy: { code: 'asc' }, select: {
      id: true, code: true, customCode: true, name: true, nameId: true, nameEn: true, role: true,
      defaultSalePrice: true, categoryId: true, unitId: true, category: true, unit: true,
    } }), stockQuantitiesAt(asOfDate),
  ]);
  return items.map(item => ({ ...item, displayCode: item.customCode || `${item.category.prefix}-${item.code.replace(/^[A-Za-z_-]+/, '')}`,
    availableQty: quantities.get(item.id)?.toString() ?? '0' }));
}

export function partyLookup(type?: PartyType) {
  return prisma.party.findMany({ where: { type, isActive: true }, orderBy: { code: 'asc' }, select: {
    id: true, version: true, code: true, name: true, nameEn: true, nameId: true, type: true, phone: true, country: true,
    address: true, supplierCategory: true, supplierCategoryEn: true, carNumber: true,
    isDriverGiftEnabled: true, isActive: true,
  } });
}
