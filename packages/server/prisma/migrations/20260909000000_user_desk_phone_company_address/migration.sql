-- 프로필 상세 항목 추가: 자리 전화번호(User), 회사 주소(Company)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deskPhone" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "address" TEXT;
