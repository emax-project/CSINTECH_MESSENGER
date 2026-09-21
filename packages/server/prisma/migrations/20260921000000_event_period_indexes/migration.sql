-- 일정 기간 필터(GET /events?startAt=&endAt=) 조회 성능을 위한 복합 인덱스
CREATE INDEX IF NOT EXISTS "Event_userId_startAt_idx" ON "Event" ("userId", "startAt");
CREATE INDEX IF NOT EXISTS "Event_userId_endAt_idx" ON "Event" ("userId", "endAt");
