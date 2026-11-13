# Testing

| Layer | Command | Runs |
| --- | --- | --- |
| Unit | `pnpm test` | every PR |
| API integration (Vitest + Postgres) | `pnpm test:integration` | every PR, with the coverage gate |

## Integration tests

Integration tests call the real `/api/v1` handlers against a real Postgres database
(`.env.test`, default `cocktail_recipe_test`). Tables are truncated before each test.

```bash
docker compose up -d postgres
pnpm test:integration                                   # all
pnpm test:integration lib/__tests__/api/v1/glasses.integration.test.ts
```

Parallel runs against different databases: `SKIP_PRISMA_GENERATE=1 DATABASE_URL=… pnpm test:integration …`.

Helpers: `test/helpers/scenario.ts` (`seedTenantPair`, `callAs`, `roleUser`, `dataOf`, `errorCodeOf`),
`test/helpers/dbFixtures.ts`, per-area fixtures in `test/helpers/fixtures/`.

### Generic suites

- **Tenant isolation** (`tenantIsolation.integration.test.ts`): calls every documented operation as tenant A
  (owner session and master key) with tenant B's ids. Expects 400/404, no B data in the response and an unchanged
  database fingerprint. New operations are covered automatically; request bodies are generated from the zod schema
  (`test/helpers/sampleFromSchema.ts`) and can be overridden in the suite when a schema needs special values.
- **Auth matrix** (`authMatrix.integration.test.ts`): every operation — 401 without credentials, 403 for the role below
  the minimum, 403 for an API key without the required permission, session-only operations reject keys.
- **Operation coverage gate**: with `API_COVERAGE_ENFORCE=1` (set in CI) every documented operation must answer 2xx in at
  least one test, otherwise the run fails and lists the operations. Exceptions live in `test/api-coverage-allowlist.json`
  (currently the three PDF exports, which need the Chromium service). `operationCoverage.integration.test.ts` holds
  happy-path calls for operations no resource suite exercises through its handler.

### What a new or changed endpoint needs

Happy path, cross-tenant access in path **and** body (404/400, foreign row unchanged), role/API-key denial when the
permission is non-trivial, atomicity for multi-write operations, and a concurrency test where a lock was added.
See the checklist in [`BACKEND-CONVENTIONS.md`](BACKEND-CONVENTIONS.md).
