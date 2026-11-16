/**
 * Checks the tour registry (lib/tours/definitions/*.ts):
 * - every step target / announce highlight is set as an anchor somewhere in components/ or pages/
 *   (`tourTarget('id')` or a `tourTarget="id"` prop)
 * - every tour text key (title, body, description) exists in locales/de/tours.json and locales/en/tours.json
 *
 * Usage: node scripts/check-tour-targets.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TARGET_PATTERN = /\b(?:target|highlight)\s*:\s*['"]([^'"]+)['"]/g;
const TEXT_KEY_PATTERN = /\b(?:title|body|description)\s*:\s*['"]([^'"]+)['"]/g;
const ANCHOR_PATTERNS = [/\btourTarget\(\s*['"]([^'"]+)['"]\s*\)/g, /\btourTarget=\{?\s*['"]([^'"]+)['"]\s*\}?/g];

function lineOf(content, index) {
  return content.slice(0, index).split('\n').length;
}

/** Targets and text keys referenced by tour definitions. */
export function collectRegistryRefs(sources) {
  const targets = [];
  const textKeys = [];
  for (const { file, content } of sources) {
    for (const match of content.matchAll(TARGET_PATTERN)) targets.push({ id: match[1], file, line: lineOf(content, match.index) });
    for (const match of content.matchAll(TEXT_KEY_PATTERN)) textKeys.push({ key: match[1], file, line: lineOf(content, match.index) });
  }
  return { targets, textKeys };
}

/** Anchor ids set in components/pages. */
export function collectAnchors(sources) {
  const anchors = new Set();
  for (const { content } of sources) {
    for (const pattern of ANCHOR_PATTERNS) {
      for (const match of content.matchAll(pattern)) anchors.add(match[1]);
    }
  }
  return anchors;
}

export function flattenKeys(object, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(object)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) keys.push(...flattenKeys(value, path));
    else keys.push(path);
  }
  return keys;
}

/**
 * @param {{ targets: {id: string, file: string, line: number}[], textKeys: {key: string, file: string, line: number}[] }} registry
 * @param {Set<string>} anchors
 * @param {Record<string, Set<string>>} localeKeys keys of the `tours` namespace per locale
 * @returns {string[]} error messages
 */
export function checkTours(registry, anchors, localeKeys) {
  const errors = [];
  for (const target of registry.targets) {
    if (!anchors.has(target.id)) {
      errors.push(`${target.file}:${target.line}  target "${target.id}" is not set anywhere (tourTarget('${target.id}') in components/ or pages/)`);
    }
  }
  for (const textKey of registry.textKeys) {
    for (const [locale, keys] of Object.entries(localeKeys)) {
      if (!keys.has(textKey.key)) errors.push(`${textKey.file}:${textKey.line}  text "tours:${textKey.key}" is missing in locales/${locale}/tours.json`);
    }
  }
  return errors;
}

function listFiles(directory, extensions) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    if (entry === 'node_modules' || entry === '__tests__' || entry.startsWith('.')) continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) files.push(...listFiles(path, extensions));
    else if (extensions.some((extension) => entry.endsWith(extension)) && !/\.test\.tsx?$/.test(entry)) files.push(path);
  }
  return files;
}

function main() {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
  const read = (file) => ({ file: relative(root, file), content: readFileSync(file, 'utf8') });

  const definitions = listFiles(join(root, 'lib/tours/definitions'), ['.ts']).map(read);
  const ui = [...listFiles(join(root, 'components'), ['.ts', '.tsx']), ...listFiles(join(root, 'pages'), ['.ts', '.tsx'])].map(read);
  const localeKeys = Object.fromEntries(
    ['de', 'en'].map((locale) => [locale, new Set(flattenKeys(JSON.parse(readFileSync(join(root, 'locales', locale, 'tours.json'), 'utf8'))))]),
  );

  const registry = collectRegistryRefs(definitions);
  const errors = checkTours(registry, collectAnchors(ui), localeKeys);

  if (errors.length > 0) {
    console.error(`Tour check failed: ${errors.length} problem(s).\n`);
    for (const error of errors) console.error(error);
    process.exit(1);
  }
  console.log(
    `Tour check passed: ${definitions.length} definition file(s), ${new Set(registry.targets.map((target) => target.id)).size} target(s), ${registry.textKeys.length} text key(s).`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
