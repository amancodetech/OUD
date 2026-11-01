import { prisma } from './db';

// Compare inside the ledger transaction. Database triggers increment versions even
// for internal service writes, imports and commands from another server instance.
export async function checkWriteVersion(route: string, method: string, id: string | undefined, body: any, header: string | null): Promise<Response | undefined> {
  let model: 'item' | 'party' | 'fixedAsset' | 'giftPolicy' | 'systemSetting' | 'itemCategory' | 'unitOption' | 'user' | undefined;
  let key: string | number | undefined = id;
  if (['PUT', 'PATCH', 'DELETE'].includes(method)) {
    model = ({ '/api/items/[id]': 'item', '/api/parties/[id]': 'party', '/api/fixed-assets/[id]': 'fixedAsset', '/api/drivers/policies/[id]': 'giftPolicy', '/api/users/[id]': 'user' } as const)[route as '/api/items/[id]'];
    if (route === '/api/categories-units') { model = body?.type === 'CATEGORY' ? 'itemCategory' : body?.type === 'UNIT' ? 'unitOption' : undefined; key = body?.id; }
  }
  if (route === '/api/settings' && method === 'POST') { model = 'systemSetting'; key = 1; }
  if (!model) return;
  const fail = (status: number, code: string, error: string) => Response.json({ ok: false, code, error }, { status });
  if (!header || !/^"\d+"$/.test(header)) return fail(428, 'VERSION_REQUIRED', 'أعد تحميل السجل قبل تعديله');
  const record = await (prisma[model] as any).findUnique({ where: { id: key }, select: { version: true } });
  if (!record) return fail(404, 'NOT_FOUND', 'السجل غير موجود');
  if (`"${record.version}"` !== header) return fail(409, 'VERSION_CONFLICT', 'عدّل مستخدم آخر هذا السجل. أعد تحميله وراجع التغييرات قبل الحفظ');
}
