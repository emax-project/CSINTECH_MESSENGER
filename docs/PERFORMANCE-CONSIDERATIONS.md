# 사용자/DB 증가 시 성능 고려 사항

사용자 수나 DB 데이터가 많아질 때 느려질 수 있는 부분과 개선 방향을 정리했습니다.

---

## 1. 백엔드 (서버)

### 1-1. 채팅방 목록 (GET /rooms) — ✅ 개선됨

**위치:** `packages/server/src/routes/rooms.js` (roomsRouter.get('/'))

**적용된 개선:**
- 방마다 따로 조회하던 `unreadMessages` 쿼리(N+1)를 `$queryRaw` 단일 집계 쿼리로 변경, `unreadMap`으로 매핑.

---

### 1-2. 사용자 목록 (GET /users) — ✅ 개선됨

**위치:** `packages/server/src/routes/users.js` (usersRouter.get('/'))

**적용된 개선:**
- `take: 200` 기본 제한 (최대 500, `?limit=` 쿼리로 조정).
- `?search=` 쿼리로 이름·이메일 검색 지원.

---

### 1-3. 조직도 트리 (GET /org/tree) — 전체 로드

**위치:** `packages/server/src/routes/org.js` (orgRouter.get('/tree'))

**문제:**
- 회사·부서·사용자를 **한 번에 전부** 가져옵니다.
- 회사/부서/사용자 수가 크면 메모리·응답 시간 모두 증가.

**개선:**
- 트리 단계별 로딩: 최상위만 먼저, 부서/사용자는 펼칠 때 요청.
- 또는 회사/부서별 페이지네이션 + 필요 시 사용자 목록도 제한.

---

### 1-4. 일정 목록 (GET /events) — ✅ 개선됨

**위치:** `packages/server/src/routes/events.js` (eventsRouter.get('/'))

**적용된 개선:**
- `?startAt=`/`?endAt=` (ISO) 쿼리로 기간 필터 지원 (선택, 하위 호환 — 기존 호출부는 그대로 동작).
- 기간 미지정 시에도 무제한 조회를 막기 위해 `take: 1000` 상한 적용.
- `(userId, startAt)`, `(userId, endAt)` 복합 인덱스 추가 (`prisma/migrations/20260921000000_event_period_indexes`).

**참고:**
- 클라이언트(`Main.tsx` 캘린더, `EventCard` 중복 체크, 모바일 `ScheduleScreen`)는 아직 전체 목록을 쓰고 있어 기간 필터는 opt-in 상태. 캘린더가 월 단위로 필요 구간만 요청하도록 바꾸면 추가로 가벼워질 수 있음.

---

### 1-5. 소켓 — ✅ 개선됨

**위치:** `packages/server/src/socket.js`, `packages/server/src/routes/rooms.js`

**적용된 개선:**
- 연결 시 `socket.join('user:' + userId)`로 유저별 룸 사용.
- 멘션 알림: `io.to('user:' + userId).emit()`로 해당 유저 소켓만 타겟.
- 방 생성/초대/참가 시: `io.in('user:' + uid).fetchSockets()`로 해당 유저 소켓만 조회 후 `join`.

---

### 1-6. 프로젝트/칸반 (GET /projects/room/:roomId) — 🟡 부분 개선됨

**위치:** `packages/server/src/routes/projects.js`

**적용된 개선:**
- 방당 프로젝트 조회에 `take: 50` 상한 적용.

**남은 문제:**
- 칸반 보드/간트 차트는 프로젝트별 보드·태스크 **전체**가 있어야 드래그앤드롭 등이 동작하므로, 태스크 자체는 여전히 상한 없이 전부 로드됨. 프로젝트 하나에 태스크가 아주 많아지는 경우엔 별도 페이지네이션 API가 필요.

---

### 1-7. 방 읽음 처리 (POST /rooms/:id/read) — ✅ 개선됨

**위치:** `packages/server/src/routes/rooms.js`

**적용된 개선:**
- N개 메시지마다 `readReceipt.upsert` 루프 → `readReceipt.createMany({ skipDuplicates: true })` 단일 쿼리로 변경.

---

## 2. 프론트엔드 (클라이언트)

### 2-1. 채팅 메시지 — ✅ 개선됨 (위로 더 불러오기)

**위치:** `packages/client/src/pages/ChatWindow.tsx`, `api.ts`

**적용된 개선:**
- `useInfiniteQuery` + `nextCursor`/`hasMore`로 스크롤이 위로 올라가면 이전 메시지를 이어붙여 로드.

**참고:**
- 아래 2-3(긴 방일 때 DOM 개수)은 이 개선으로 오히려 더 실질적인 리스크가 됨 — 오래 스크롤하면 DOM에 메시지가 계속 누적됨.

---

### 2-2. 채팅방 목록 / 친구(조직도) — 한 번에 전부 렌더

**위치:** `packages/client/src/pages/Main.tsx`

**문제:**
- 방 목록·조직 트리를 **전부** 한 번에 DOM으로 렌더링합니다.
- 방/사용자 수가 매우 많으면 DOM 노드 수가 늘어나 스크롤·탭 전환 등이 무거워질 수 있습니다.

**개선:**
- 가상 스크롤(react-window, react-virtuoso 등): 보이는 구간만 렌더링.
- 또는 “접기/펼치기”로 트리 깊이를 제한하고, 펼친 노드만 로드/렌더.

---

### 2-3. 채팅 메시지 목록 — 긴 방일 때 DOM 개수

**위치:** `packages/client/src/pages/ChatWindow.tsx`

**현재:**
- 한 번에 50개만 오므로 당장은 큰 문제는 아닐 수 있음.
- “위로 더 불러오기”를 구현하면 50+50+… 으로 수백 개가 쌓일 수 있음.

**개선:**
- 위로 스크롤 로딩을 넣을 경우, **역방향 가상 스크롤** 또는 “윈도우” 밖 메시지는 DOM에서 제거/재사용하는 방식 고려.

---

## 3. DB 인덱스 (현재 상태)

**위치:** `packages/server/prisma/schema.prisma`

- `Message`: `roomId`, `senderId`, `(roomId, createdAt)`, `fileExpiresAt` 인덱스 있음 → 메시지 조회/페이징에 유리.
- `RoomMember`: `userId`, `roomId` 인덱스 있음.
- `User`: `departmentId` 인덱스 있음.

데이터가 많아지면 다음도 점검하는 것이 좋습니다.

- `Event`: `(userId, startAt)`, `(userId, endAt)` 복합 인덱스 추가 완료 (기간 검색용).
- `ReadReceipt`, `Reaction` 등 메시지별 조회가 잦으면 `messageId` 인덱스 유지.

---

## 4. 요약 표

| 구분 | 위치 | 상태 | 우선순위 |
|------|------|------|----------|
| 서버 | GET /rooms | ✅ 개선됨 (unread 집계 쿼리 1회) | - |
| 서버 | GET /users | ✅ 개선됨 (take 상한 + search) | - |
| 서버 | socket (멘션) | ✅ 개선됨 (유저별 룸 타겟) | - |
| 서버 | POST /rooms/:id/read | ✅ 개선됨 (createMany 단일 쿼리) | - |
| 서버 | GET /events | ✅ 개선됨 (기간 필터 + take 상한 + 인덱스) | - |
| 서버 | GET /projects/room/:roomId | 🟡 부분 개선됨 (프로젝트 take: 50, 태스크는 여전히 무제한) | 중간 |
| 서버 | GET /org/tree | 조직 전체 한 번에 로드 | 중간 |
| 클라이언트 | 채팅 | ✅ 개선됨 (무한 스크롤로 이전 메시지 로드) | - |
| 클라이언트 | Main | 방/조직 목록 전부 렌더 (가상 스크롤 없음) | 데이터 많을 때 |
| 클라이언트 | 채팅 (DOM 누적) | 무한 스크롤 도입으로 긴 방일수록 DOM 누적 (2-1 참고) | 데이터 많을 때 |

---

**정리:**  
GET /rooms·GET /users·소켓 멘션·방 읽음 처리·GET /events는 개선을 마쳤습니다. 다음으로 점검할 것은 **GET /org/tree**(전체 트리 로드)와 **GET /projects/room/:roomId**의 태스크 전체 로드, 그리고 클라이언트의 **가상 스크롤 부재**(Main 목록, 채팅 메시지 DOM 누적)입니다.
