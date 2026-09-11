-- 거래처 자동계정 등 공용 초기비밀번호로 생성된 계정에 최초 로그인 시
-- 비밀번호 변경을 강제하기 위한 플래그
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
