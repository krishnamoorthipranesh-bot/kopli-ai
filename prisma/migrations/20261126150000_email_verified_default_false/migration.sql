-- New accounts must remain unverified until the owner proves email control.
-- Existing users are intentionally not modified.
ALTER TABLE "public"."User" ALTER COLUMN "emailVerified" SET DEFAULT false;
