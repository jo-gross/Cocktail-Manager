-- Better Auth 1.7 scopes account identity by issuer + accountId.
-- Existing 1.6 rows used provider-scoped identity, so backfill the
-- matching provider-id namespaces before making issuer required.

ALTER TABLE "Account" ADD COLUMN "issuer" TEXT;

UPDATE "Account"
SET "issuer" = CASE
  WHEN "provider" IN ('credential', 'email') THEN 'local:credential'
  ELSE 'local:oauth:' || "provider"
END
WHERE "issuer" IS NULL;

ALTER TABLE "Account" ALTER COLUMN "issuer" SET NOT NULL;

CREATE UNIQUE INDEX "Account_issuer_accountId_key" ON "Account"("issuer", "provider_account_id");
