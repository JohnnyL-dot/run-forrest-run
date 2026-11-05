/*
 * RUN-FORREST-RUN – tools/sync-version.mjs
 * Filversion: 1.1.1
 * Ändringsnotering:
 *  1.1.1 – Nytt hjälpverktyg. js/version.js är enda källan för versionen. Verktyget skriver samma värde till
 *          cachenamnet i sw.js och versionsfältet i manifest.webmanifest, eller kontrollerar att de stämmer (--check).
 *          Verktyget ingår inte i appen. Användning: node tools/sync-version.mjs [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const read = (f) => readFileSync(join(root, f), 'utf8');

const version = /export const VERSION = '(v\d+\.\d+\.\d+)'/.exec(read('js/version.js'))?.[1];
if (!version) { console.error('Hittar inte VERSION i js/version.js'); process.exit(2); }

const targets = [
  { file: 'sw.js', re: /const CACHE = 'rfr-v\d+\.\d+\.\d+';/, to: `const CACHE = 'rfr-${version}';` },
  { file: 'manifest.webmanifest', re: /"version": "v\d+\.\d+\.\d+"/, to: `"version": "${version}"` },
];

let bad = 0;
for (const t of targets) {
  const text = read(t.file);
  if (!t.re.test(text)) { console.error(`Mönster saknas i ${t.file}`); bad++; continue; }
  if (text.match(t.re)[0] === t.to) { console.log(`OK    ${t.file} = ${version}`); continue; }
  if (check) { console.error(`AVVIKER ${t.file} (väntade ${t.to})`); bad++; }
  else { writeFileSync(join(root, t.file), text.replace(t.re, t.to)); console.log(`SKREV ${t.file} = ${version}`); }
}
process.exit(bad ? 1 : 0);
