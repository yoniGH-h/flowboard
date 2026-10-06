import { readFile } from 'node:fs/promises';

const files = ['backend-express/src/utils/permissions.js', 'frontend/src/lib/permissions.js'];
const maps = await Promise.all(files.map(async (file) => {
  const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  return Object.fromEntries([...source.matchAll(/(EMPLOYEE|PROJECT_MANAGER|ORG_ADMIN|SYSTEM_ADMIN)\s*:\s*(\d+)/g)].map((match) => [match[1], Number(match[2])]));
}));

if (JSON.stringify(maps[0]) !== JSON.stringify(maps[1])) {
  console.error('Role levels differ between backend and frontend', maps);
  process.exit(1);
}
console.log('Role levels are synchronized:', maps[0]);
