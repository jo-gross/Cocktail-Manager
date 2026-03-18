-- BetterAuth Migration
-- This migration updates the authentication schema from NextAuth to BetterAuth
-- while preserving existing user data

-- ============================================
-- Step 1: Rename tables to new BetterAuth names
-- ============================================

-- Rename User table
ALTER TABLE "User" RENAME TO "user";

-- Rename Account table  
ALTER TABLE "Account" RENAME TO "account";

-- Rename Session table
ALTER TABLE "Session" RENAME TO "session";

-- ============================================
-- Step 2: Update User table
-- ============================================

-- Add new columns for BetterAuth
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Convert emailVerified from DateTime to Boolean
-- First, add new boolean column
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;

-- Migrate data: if emailVerified has a date, set to true
UPDATE "user" SET "email_verified" = true WHERE "emailVerified" IS NOT NULL;

-- Drop old column
ALTER TABLE "user" DROP COLUMN IF EXISTS "emailVerified";

-- ============================================
-- Step 3: Update Account table
-- ============================================

-- Rename columns to BetterAuth format
ALTER TABLE "account" RENAME COLUMN "provider" TO "provider_id";
ALTER TABLE "account" RENAME COLUMN "provider_account_id" TO "account_id";

-- Rename token columns
ALTER TABLE "account" RENAME COLUMN "access_token" TO "access_token_old";
ALTER TABLE "account" ADD COLUMN "access_token" TEXT;
UPDATE "account" SET "access_token" = "access_token_old";
ALTER TABLE "account" DROP COLUMN "access_token_old";

ALTER TABLE "account" RENAME COLUMN "refresh_token" TO "refresh_token_old";
ALTER TABLE "account" ADD COLUMN "refresh_token" TEXT;
UPDATE "account" SET "refresh_token" = "refresh_token_old";
ALTER TABLE "account" DROP COLUMN "refresh_token_old";

ALTER TABLE "account" RENAME COLUMN "id_token" TO "id_token_old";
ALTER TABLE "account" ADD COLUMN "id_token" TEXT;
UPDATE "account" SET "id_token" = "id_token_old";
ALTER TABLE "account" DROP COLUMN "id_token_old";

-- Add new BetterAuth columns
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "access_token_expires_at" TIMESTAMP(3);
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "refresh_token_expires_at" TIMESTAMP(3);
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "password" TEXT;
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Migrate expires_at (was integer seconds) to DateTime
UPDATE "account" SET "access_token_expires_at" = to_timestamp("expires_at") WHERE "expires_at" IS NOT NULL;

-- Drop old columns that BetterAuth doesn't use
ALTER TABLE "account" DROP COLUMN IF EXISTS "type";
ALTER TABLE "account" DROP COLUMN IF EXISTS "expires_at";
ALTER TABLE "account" DROP COLUMN IF EXISTS "token_type";
ALTER TABLE "account" DROP COLUMN IF EXISTS "session_state";
ALTER TABLE "account" DROP COLUMN IF EXISTS "oauth_token_secret";
ALTER TABLE "account" DROP COLUMN IF EXISTS "oauth_token";

-- Update unique constraint
ALTER TABLE "account" DROP CONSTRAINT IF EXISTS "Account_provider_providerAccountId_key";
ALTER TABLE "account" ADD CONSTRAINT "account_provider_id_account_id_key" UNIQUE ("provider_id", "account_id");

-- Add index on userId
CREATE INDEX IF NOT EXISTS "account_user_id_idx" ON "account"("user_id");

-- ============================================
-- Step 4: Update Session table
-- ============================================

-- Rename columns
ALTER TABLE "session" RENAME COLUMN "session_token" TO "token";
ALTER TABLE "session" RENAME COLUMN "expires" TO "expires_at";

-- Add new BetterAuth columns
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "ip_address" TEXT;
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "user_agent" TEXT;

-- Add index on userId
CREATE INDEX IF NOT EXISTS "session_user_id_idx" ON "session"("user_id");

-- ============================================
-- Step 5: Replace VerificationToken with Verification
-- ============================================

-- Drop old verification table
DROP TABLE IF EXISTS "VerificationToken";

-- Create new verification table for BetterAuth
CREATE TABLE IF NOT EXISTS "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification"("identifier");

-- ============================================
-- Step 6: Update foreign key references
-- ============================================

-- The foreign keys should still work since we only renamed tables
-- but let's make sure the constraints are properly named

-- Account foreign key
ALTER TABLE "account" DROP CONSTRAINT IF EXISTS "Account_user_id_fkey";
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Session foreign key
ALTER TABLE "session" DROP CONSTRAINT IF EXISTS "Session_user_id_fkey";
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
