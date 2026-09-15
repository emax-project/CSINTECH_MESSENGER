-- 개인 메모장 (본인만 조회 가능, 자동저장)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notepad" TEXT;
