import { UserRole } from '@prisma/client';

export type PermissionKey =
  | 'dashboard_view'
  | 'inventory_view'
  | 'debts_view'
  | 'sales_manage'
  | 'cash_customer'
  | 'cash_full'
  | 'purchases_manage'
  | 'returns_manage'
  | 'stock_issues_manage'
  | 'manufacturing_manage'
  | 'drivers_manage'
  | 'items_manage'
  | 'parties_manage'
  | 'partners_view'
  | 'gift_policies_manage'
  | 'void_documents'
  | 'settings_manage';

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description: string;
  group: string;
  routePrefix?: string;
}

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  // 1. الريسبشن والعمليات اليومية
  {
    key: 'drivers_manage',
    label: 'عملاء وهدايا السائقين (الريسبشن)',
    description: 'تسجيل زيارات عملاء السائقين ومتابعة عداد الهدايا وتسويتها',
    group: 'الاستقبال (الريسبشن) والمبيعات',
    routePrefix: '/drivers',
  },
  {
    key: 'parties_manage',
    label: 'الأسماء وبيانات الاتصال (العملاء والسائقون)',
    description: 'إضافة وتعديل بيانات العملاء والسائقين والموردين',
    group: 'الاستقبال (الريسبشن) والمبيعات',
    routePrefix: '/parties',
  },
  {
    key: 'stock_issues_manage',
    label: 'صرف المخزون (تستر / عينات)',
    description: 'تسجيل صرف التستر والعينات للضيوف والعملاء في المعرض',
    group: 'الاستقبال (الريسبشن) والمبيعات',
    routePrefix: '/stock-issues',
  },
  {
    key: 'sales_manage',
    label: 'المبيعات وفواتير العملاء',
    description: 'إنشاء وعرض وطباعة فواتير البيع للعملاء',
    group: 'الاستقبال (الريسبشن) والمبيعات',
    routePrefix: '/sales',
  },
  {
    key: 'cash_customer',
    label: 'تحصيل العملاء ورد المبالغ',
    description: 'تسجيل سندات قبض العملاء أو رد مبالغ المرتجعات',
    group: 'الاستقبال (الريسبشن) والمبيعات',
    routePrefix: '/cash',
  },
  {
    key: 'returns_manage',
    label: 'المرتجعات',
    description: 'تسجيل مرتجعات المبيعات أو المشتريات',
    group: 'الاستقبال (الريسبشن) والمبيعات',
    routePrefix: '/returns',
  },

  // 2. المخزون والمشتريات والتصنيع
  {
    key: 'inventory_view',
    label: 'المخزون وكارت الصنف',
    description: 'الاطلاع على أرصدة الأصناف الحالية وحركة كارت الصنف',
    group: 'المخزون والمشتريات والتصنيع',
    routePrefix: '/inventory',
  },
  {
    key: 'items_manage',
    label: 'تعريف الأصناف',
    description: 'إضافة وتعديل أصناف العود ودهن العود والعطور والخامات',
    group: 'المخزون والمشتريات والتصنيع',
    routePrefix: '/items',
  },
  {
    key: 'purchases_manage',
    label: 'المشتريات وفواتير الموردين',
    description: 'إدخال فواتير الشراء والاطلاع على تكاليف الموردين',
    group: 'المخزون والمشتريات والتصنيع',
    routePrefix: '/purchases',
  },
  {
    key: 'manufacturing_manage',
    label: 'التصنيع والتركيبات',
    description: 'إنشاء دفعات التصنيع وتحويل الخامات إلى منتجات تامة',
    group: 'المخزون والمشتريات والتصنيع',
    routePrefix: '/manufacturing',
  },

  // 3. المحاسبة والتقارير والإدارة
  {
    key: 'dashboard_view',
    label: 'الرئيسية والتقارير المالية',
    description: 'الاطلاع على قائمة الدخل الـ 14 والربح التشغيلي والمقارنة الشهرية',
    group: 'المحاسبة والتقارير والإدارة',
    routePrefix: '/',
  },
  {
    key: 'debts_view',
    label: 'المديونية وكشوف الحساب',
    description: 'متابعة أعمار الديون وكشوف حسابات العملاء والموردين',
    group: 'المحاسبة والتقارير والإدارة',
    routePrefix: '/debts',
  },
  {
    key: 'cash_full',
    label: 'الحسابات والمدفوعات الكاملة (مصروفات/موردين/شركاء)',
    description: 'إدارة كافة الحركات النقدية والبنكية والمصروفات وسداد الموردين',
    group: 'المحاسبة والتقارير والإدارة',
  },
  {
    key: 'partners_view',
    label: 'الشركاء والأصول وحقوق الملكية',
    description: 'الاطلاع على حصص الشركاء وتوزيع الأرباح والأصول الثابتة',
    group: 'المحاسبة والتقارير والإدارة',
    routePrefix: '/partners',
  },
  {
    key: 'gift_policies_manage',
    label: 'سياسة هدايا السائقين',
    description: 'تعديل عدد الزيارات المطلوبة وقيمة هدية السائق',
    group: 'المحاسبة والتقارير والإدارة',
    routePrefix: '/drivers/policies',
  },
  {
    key: 'void_documents',
    label: 'إلغاء المستندات المعتمدة (VOID)',
    description: 'صلاحية إلغاء الفواتير أو السندات مع تسجيل السبب في التدقيق',
    group: 'المحاسبة والتقارير والإدارة',
  },
  {
    key: 'settings_manage',
    label: 'الإعدادات والمستخدمون وقفل الفترة',
    description: 'إدارة إعدادات النظام، حسابات الموظفين، النسخ الاحتياطي، ومعالج التهيئة',
    group: 'المحاسبة والتقارير والإدارة',
    routePrefix: '/settings',
  },
];

/**
 * قوالب الصلاحيات الجاهزة لتسهيل الإنشاء (بما فيها قالب موظف الريسبشن)
 */
export const PERMISSION_PRESETS: Record<
  'RECEPTION' | 'CASHIER' | 'ACCOUNTANT' | 'ADMIN',
  { label: string; role: UserRole; permissions: PermissionKey[] }
> = {
  RECEPTION: {
    label: 'موظف ريسبشن (استقبال وزوار السائقين وعينات)',
    role: 'CASHIER',
    permissions: [
      'drivers_manage',
      'parties_manage',
      'stock_issues_manage',
      'sales_manage',
    ],
  },
  CASHIER: {
    label: 'كاشير / بائع معرض',
    role: 'CASHIER',
    permissions: [
      'drivers_manage',
      'parties_manage',
      'stock_issues_manage',
      'sales_manage',
      'cash_customer',
      'returns_manage',
      'inventory_view',
    ],
  },
  ACCOUNTANT: {
    label: 'محاسب',
    role: 'ACCOUNTANT',
    permissions: [
      'dashboard_view',
      'inventory_view',
      'debts_view',
      'sales_manage',
      'cash_customer',
      'cash_full',
      'purchases_manage',
      'returns_manage',
      'stock_issues_manage',
      'manufacturing_manage',
      'drivers_manage',
      'items_manage',
      'parties_manage',
      'partners_view',
      'gift_policies_manage',
      'void_documents',
    ],
  },
  ADMIN: {
    label: 'مدير النظام (صلاحية كاملة)',
    role: 'ADMIN',
    permissions: ALL_PERMISSIONS.map((p) => p.key),
  },
};

export function getDefaultPermissionsForRole(role: UserRole): PermissionKey[] {
  if (role === 'ADMIN') return PERMISSION_PRESETS.ADMIN.permissions;
  if (role === 'ACCOUNTANT') return PERMISSION_PRESETS.ACCOUNTANT.permissions;
  return PERMISSION_PRESETS.CASHIER.permissions;
}

export function resolveUserPermissions(
  role: UserRole,
  customPermissions?: unknown
): PermissionKey[] {
  if (role === 'ADMIN') {
    return PERMISSION_PRESETS.ADMIN.permissions;
  }
  if (Array.isArray(customPermissions)) {
    const known = new Set(ALL_PERMISSIONS.map(p => p.key));
    if (customPermissions.some(p => typeof p !== 'string' || !known.has(p as PermissionKey))) {
      throw new Error('صلاحية غير معروفة');
    }
    return [...new Set(customPermissions)] as PermissionKey[];
  }
  return getDefaultPermissionsForRole(role);
}

/**
 * التحقق مما إذا كان المستخدم يملك صلاحية الوصول إلى مسار معين في القائمة الجانبية
 */
export function canAccessHref(href: string, permissions: PermissionKey[]): boolean {
  if (/^\/parties\/[^/]+\/statement\/?$/.test(href)) return permissions.includes('debts_view');
  const map: Record<string, PermissionKey[]> = {
    '/': ['dashboard_view'],
    '/inventory': ['inventory_view'],
    '/debts': ['debts_view'],
    '/sales': ['sales_manage'],
    '/sales/driver-gift': ['drivers_manage'],
    '/cash': ['cash_customer', 'cash_full'],
    '/purchases': ['purchases_manage'],
    '/returns': ['returns_manage'],
    '/stock-issues': ['stock_issues_manage'],
    '/manufacturing': ['manufacturing_manage'],
    '/drivers': ['drivers_manage'],
    '/items': ['items_manage'],
    '/parties': ['parties_manage'],
    '/partners': ['partners_view'],
    '/drivers/policies': ['gift_policies_manage'],
    '/settings': ['settings_manage'],
    '/settings/users': ['settings_manage'],
    '/setup': ['settings_manage'],
  };

  const prefix = Object.keys(map).sort((a, b) => b.length - a.length).find(key => key === href || key !== '/' && href.startsWith(key + '/'));
  const required = prefix ? map[prefix] : undefined;
  if (!required) return false;
  return required.some((reqKey) => permissions.includes(reqKey));
}
