import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const localesDir = join(process.cwd(), 'locales');
const baseLocale = 'de';
const compareLocale = 'en';

function flatten(obj, prefix = '') {
  const result = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result.push(...flatten(value, path));
    } else {
      result.push(path);
    }
  }
  return result;
}

function loadNamespace(locale, namespace) {
  const filePath = join(localesDir, locale, `${namespace}.json`);
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

const namespaces = readdirSync(join(localesDir, baseLocale))
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.replace(/\.json$/, ''));

let hasError = false;

for (const namespace of namespaces) {
  const baseKeys = new Set(flatten(loadNamespace(baseLocale, namespace)));
  const compareKeys = new Set(flatten(loadNamespace(compareLocale, namespace)));

  const missingInCompare = [...baseKeys].filter((key) => !compareKeys.has(key));
  const extraInCompare = [...compareKeys].filter((key) => !baseKeys.has(key));

  if (missingInCompare.length > 0) {
    hasError = true;
    console.error(`[${namespace}] Missing in ${compareLocale}:`);
    for (const key of missingInCompare) console.error(`  - ${key}`);
  }
  if (extraInCompare.length > 0) {
    hasError = true;
    console.error(`[${namespace}] Extra in ${compareLocale} (not in ${baseLocale}):`);
    for (const key of extraInCompare) console.error(`  - ${key}`);
  }
}

if (hasError) {
  process.exit(1);
}

console.log(`i18n key check passed: ${compareLocale} keys match ${baseLocale} for ${namespaces.length} namespaces.`);
