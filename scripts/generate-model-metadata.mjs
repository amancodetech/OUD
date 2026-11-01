import { Prisma } from '@prisma/client';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
const schema = await readFile('prisma/schema.prisma', 'utf8');
const models = Prisma.dmmf.datamodel.models.map(({ name, dbName, fields }) => {
  const block = schema.match(new RegExp('model\\s+' + name + '\\s*\\{([\\s\\S]*?)\\n\\}'))?.[1];
  if (!block) throw new Error('Missing model definition: ' + name);
  return { name, dbName, fields: fields.filter(f => f.kind !== 'object').map(field => {
    const typeToken = block.match(new RegExp('^\\s*' + field.name + '\\s+([^\\s]+)', 'm'))?.[1];
    if (!typeToken) throw new Error('Missing field definition: ' + name + '.' + field.name);
    return { name: field.name, dbName: field.dbName ?? null, type: field.type, kind: field.kind, isRequired: !typeToken.endsWith('?') };
  }) };
});
await mkdir('src/generated', { recursive: true });
await writeFile('src/generated/model-metadata.json', JSON.stringify(models, null, 2) + '\n');
console.log('Generated scalar model metadata for Workers (no runtime DMMF dependency).');
