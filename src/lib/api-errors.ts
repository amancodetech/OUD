import { NextRequest, NextResponse } from 'next/server';

const messages = {
  UNAUTHORIZED: ['يلزم تسجيل الدخول', 'Please sign in', 'Silakan masuk'],
  FORBIDDEN: ['ليس لديك صلاحية هذه العملية', 'You do not have permission for this operation', 'Anda tidak memiliki izin untuk operasi ini'],
  BAD_CREDENTIALS: ['اسم المستخدم أو كلمة المرور غير صحيحة', 'Incorrect username or password', 'Nama pengguna atau kata sandi salah'],
  PERIOD_LOCKED: ['الفترة المحاسبية مقفلة', 'The accounting period is locked', 'Periode akuntansi dikunci'],
  INSUFFICIENT_STOCK: ['العملية تتجاوز المخزون المتاح', 'The operation exceeds available stock', 'Operasi melebihi stok tersedia'],
  INSUFFICIENT_CREDIT: ['لا يوجد رصيد دائن كافٍ لرد المبلغ', 'Insufficient customer credit for this refund', 'Saldo kredit pelanggan tidak cukup untuk pengembalian dana'],
  SOURCE_MISMATCH: ['المصدر لا يطابق الطرف والفاتورة المعتمدة', 'The source does not match the posted invoice and party', 'Sumber tidak cocok dengan faktur dan pihak yang sah'],
  DUPLICATE: ['يوجد سجل بنفس المعرف أو البيانات', 'A record with these identifiers already exists', 'Data dengan pengenal ini sudah ada'],
  RATE_LIMITED: ['محاولات كثيرة؛ حاول لاحقًا', 'Too many attempts; try again later', 'Terlalu banyak percobaan; coba lagi nanti'],
  NUMERIC_PRECISION: ['القيم والكميات تقبل أربع منازل عشرية كحد أقصى', 'Values and quantities support up to four decimal places', 'Nilai dan jumlah mendukung maksimal empat angka desimal'],
  NUMERIC_RANGE: ['القيمة تتجاوز الحد المسموح للتخزين', 'The value exceeds the supported numeric range', 'Nilai melebihi rentang angka yang didukung'],
  INVALID_INPUT: ['راجع الحقول المطلوبة والقيم المدخلة', 'Check the required fields and entered values', 'Periksa kolom wajib dan nilai yang dimasukkan'],
  REQUEST_FAILED: ['تعذر تنفيذ الطلب؛ راجع البيانات وحاول مجددًا', 'The request could not be completed; check the data and try again', 'Permintaan tidak dapat diselesaikan; periksa data dan coba lagi'],
};

export async function localizeApiError(response: Response, request: NextRequest): Promise<Response> {
  if (response.ok || !response.headers.get('content-type')?.includes('application/json')) return response;
  const body = await response.clone().json().catch(() => null);
  if (!body || typeof body.error !== 'string') return response;
  const text = body.error;
  let code: keyof typeof messages = body.code in messages ? body.code : 'REQUEST_FAILED';
  if (response.status === 401) code = request.nextUrl.pathname === '/api/auth/login' ? 'BAD_CREDENTIALS' : 'UNAUTHORIZED';
  else if (response.status === 403) code = 'FORBIDDEN';
  else if (response.status === 429) code = 'RATE_LIMITED';
  else if (/أربع منازل عشرية/.test(text)) code = 'NUMERIC_PRECISION';
  else if (/تتجاوز الحد المسموح للتخزين/.test(text)) code = 'NUMERIC_RANGE';
  else if (/دائن|credit/i.test(text)) code = 'INSUFFICIENT_CREDIT';
  else if (/مقفلة|مغلقة|locked/i.test(text)) code = 'PERIOD_LOCKED';
  else if (/مخزون|المادة الخام|available stock/i.test(text)) code = 'INSUFFICIENT_STOCK';
  else if (/لا يطابق|الأصلي.*ملغ|source.*match/i.test(text)) code = 'SOURCE_MISMATCH';
  else if (/مكرر|موجود مسبق|unique constraint/i.test(text)) code = 'DUPLICATE';
  else if (response.status === 400) code = 'INVALID_INPUT';
  const locale = request.cookies.get('oud_locale')?.value;
  const index = locale === 'en' ? 1 : locale === 'id' ? 2 : 0;
  const internal = /Prisma|Invalid `|SQLSTATE|invocation|database server|connect ECONN|constraint|node_modules/i.test(text);
  return NextResponse.json({ ...body, code, error: index === 0 && !internal && /[\u0600-\u06ff]/.test(text) ? text : messages[code][index] }, { status: response.status, headers: response.headers });
}
