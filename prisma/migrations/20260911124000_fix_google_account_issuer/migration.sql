-- Better Auth 1.7.2 looks up Google accounts by the real OIDC issuer.
-- The initial 1.7 backfill used synthetic local:oauth:* namespaces, which
-- made returning Google sign-ins try to insert a duplicate (provider, accountId).

UPDATE "Account"
SET "issuer" = 'https://accounts.google.com'
WHERE "provider" = 'google'
  AND "issuer" = 'local:oauth:google';
