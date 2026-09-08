-- 겸직 소속 (표시 법인/부서 전환용)
CREATE TABLE IF NOT EXISTS "UserAffiliation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserAffiliation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserAffiliation_userId_departmentId_key" ON "UserAffiliation"("userId", "departmentId");
CREATE INDEX IF NOT EXISTS "UserAffiliation_userId_idx" ON "UserAffiliation"("userId");
CREATE INDEX IF NOT EXISTS "UserAffiliation_departmentId_idx" ON "UserAffiliation"("departmentId");

ALTER TABLE "UserAffiliation" DROP CONSTRAINT IF EXISTS "UserAffiliation_userId_fkey";
ALTER TABLE "UserAffiliation" ADD CONSTRAINT "UserAffiliation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserAffiliation" DROP CONSTRAINT IF EXISTS "UserAffiliation_departmentId_fkey";
ALTER TABLE "UserAffiliation" ADD CONSTRAINT "UserAffiliation_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "UserAffiliation" ("id", "userId", "departmentId", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || u.id),
  u.id,
  u."departmentId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
WHERE u."departmentId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "UserAffiliation" a
    WHERE a."userId" = u.id AND a."departmentId" = u."departmentId"
  );
