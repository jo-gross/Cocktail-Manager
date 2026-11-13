/**
 * Generates openapi/openapi.json from the ResourceApiDocs declared in
 * lib/schemas/*.ts. Runs prisma-free (schemas use type-only enum imports), so
 * it works without `prisma generate` and is safe as a CI drift guard.
 *
 *   pnpm openapi:generate
 */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildOpenApiDocument } from '@lib/openapi/buildDocument';
import { isResourceApiDoc } from '@lib/openapi/types';
import type { ResourceApiDoc } from '@lib/openapi/types';

/**
 * Emitted specs. `openapi.json` is the download + drift-guard target; `v1.json`
 * is the same document under the name the Docusaurus site references.
 */
const OUTPUTS = ['openapi/openapi.json', 'openapi/v1.json'];

const SCHEMAS_DIR = 'lib/schemas';

export async function collectResourceApiDocs(): Promise<ResourceApiDoc[]> {
  // Portable directory listing (avoids fs.globSync, which requires Node >= 22).
  const files = readdirSync(SCHEMAS_DIR)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => join(SCHEMAS_DIR, name))
    .sort();
  const resources: ResourceApiDoc[] = [];

  for (const file of files) {
    const mod: Record<string, unknown> = await import(pathToFileURL(resolve(file)).href);
    for (const value of Object.values(mod)) {
      if (isResourceApiDoc(value)) resources.push(value);
    }
  }

  return resources.sort((a, b) => a.basePath.localeCompare(b.basePath));
}

export async function generateOpenApiJson(): Promise<string> {
  const resources = await collectResourceApiDocs();
  const doc = buildOpenApiDocument(resources);
  return JSON.stringify(doc, null, 2) + '\n';
}

async function main() {
  mkdirSync('openapi', { recursive: true });
  const json = await generateOpenApiJson();
  const doc = JSON.parse(json);
  for (const file of OUTPUTS) {
    writeFileSync(file, json);
    console.log(`Wrote ${file}: ${Object.keys(doc.paths ?? {}).length} paths, ${Object.keys(doc.components?.schemas ?? {}).length} component schemas.`);
  }
}

// Run only when invoked directly (not when imported by tests).
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
