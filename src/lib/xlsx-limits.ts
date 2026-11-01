// Inspect ZIP metadata before SheetJS allocates expanded XML. XLSX uploads may
// not use ZIP64, excessive entries, or more than 64 MB of uncompressed content.
export function assertWorkbookExpansion(buffer: Buffer) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50 && i + 22 + buffer.readUInt16LE(i + 20) === buffer.length) { eocd = i; break; }
  }
  const fail = () => { throw new Error('ملف Excel غير مدعوم أو يتجاوز حدود المعالجة'); };
  if (eocd < 0) return fail();
  const entries = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16), total = 0;
  if (entries > 2000 || !entries || offset >= eocd || buffer.readUInt16LE(eocd + 4) !== 0) return fail();
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > eocd || buffer.readUInt32LE(offset) !== 0x02014b50) return fail();
    const size = buffer.readUInt32LE(offset + 24);
    const compressed = buffer.readUInt32LE(offset + 20);
    total += size;
    if (size === 0xffffffff || compressed === 0xffffffff || total > 64 * 1024 * 1024) return fail();
    offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
  if (offset > eocd) return fail();
}
