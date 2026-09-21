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

### 1-3. 조직도 트리 (GET /org/tree) — ✅ 개선됨 (단계별 로딩)

**위치:** `packages/server/src/routes/org.js`, `packages/client/src/pages/Main.tsx`, `OrgTree.tsx`, `utils/orgTree.ts`

**적용된 개선:**
- `GET /org/tree?shallow=1` 신설: 회사·부서 구조 + 인원수(`userCount`)만 반환, `users`는 비움.
  직속(`departmentId`) + 세컨더리 소속(`UserAffiliation`)을 사용자 id 기준으로 중복 제거해 정확히 센다.
- `GET /org/departments/:id/users` 신설: 부서 하나(하위 부서 제외)의 사용자 목록만 지연 로드.
- 클라이언트(`Main.tsx`): 기본은 `shallow` 트리만 받고, **실제로 펼쳐져 보이는 부서**(`visibleOpenDepartmentIds`
  — 조상까지 전부 열려 있어야 대상)의 사용자만 `useQueries`로 병렬 지연 로드해 가벼운 트리에 덧씌운다.
- 조직 전체를 훑어야 하는 경우(검색어 입력 중, 즐겨찾기 탭에 즐겨찾기한 친구가 있는 경우)엔 기존 전체
  `GET /org/tree`로 자동 전환 — 검색·즐겨찾기 정확도는 그대로 유지(react-query 캐시로 한 번만 받으면 재사용).
- `queryClient.invalidateQueries({queryKey:['org']})`가 prefix 매치라 기존 무효화 로직 변경 없이
  `shallow`/`department-users` 쿼리도 함께 갱신됨.
- 조직도 로딩과 무관하게 항상 필요한 "내 상태 초기화"(로그인 시 온라인 표시 등)는 조직도 트리에서
  "나"를 찾던 방식에서 `GET /auth/me` 직접 호출로 변경 — 지연 로딩된 트리에 내 부서가 아직 안 실려도
  깨지지 않도록 분리함 (`/auth/me` 응답에 `statusNote` 필드 추가).

**모바일(`packages/mobile`)도 동일 적용:** `OrgTreeScreen`이 데스크톱과 같은 `shallow`/부서별
엔드포인트를 그대로 재사용해 같은 방식으로 지연 로딩됨.
- 부서 구조는 가벼운 트리로, 실제로 펼친(회사도 펼쳐져 있어야) 부서의 사용자만 지연 로드.
- 부서 인원수 표시는 `userCount`로 항상 정확, 접속중 인원은 로드 전까진 `…/N`으로 표시(로드 후 갱신).
- "내 소속 부서 이름"(프로필 영역 표시용)은 조직도 트리 대신 `GET /users/me/affiliations`로 따로
  가져와 트리 로딩 상태와 무관하게 항상 정확.
- 덤으로 발견한 기존 버그도 수정: `UserDetailScreen`의 프로필/아바타 수정 후
  `invalidateQueries({queryKey:['org']})` 호출이 실제 쿼리 키(`'org-tree'`/`'org-department-users'`,
  하이픈 포함 문자열)와 안 맞아 조직도 캐시가 전혀 무효화되지 않고 있었음 — 각각 명시적으로 무효화하도록 수정.

**남은 것:**
- InviteModal/MemoComposeModal/UserManageSection/BulkUserRegisterSection(선택·일괄등록 UI)은 원래부터
  전체 인원이 필요해 기존 `GET /org/tree`(전체)를 그대로 씀 — 대상 아님.

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

### 1-6. 프로젝트/칸반 (GET /projects/room/:roomId) — ✅ 개선됨

**위치:** `packages/server/src/routes/projects.js`, `packages/client/src/components/KanbanBoard.tsx`/`GanttChart.tsx`, 모바일 `KanbanScreen.tsx`

**적용된 개선:**
- 방당 프로젝트 조회에 `take: 50` 상한 적용 (기존).
- `GET /projects/room/:roomId`가 더 이상 모든 프로젝트의 태스크를 한 번에 안 내려줌 — `tasks: []` +
  정확한 `taskCount`(그룹화 집계)만 반환. 칸반/간트/모바일 칸반 화면 모두 항상 프로젝트 하나
  (선택된 탭)의 태스크만 화면에 그리므로, 안 보는 프로젝트의 태스크까지 매번 로드하던 비용을 없앰.
- `GET /projects/:id/tasks` 신설 — 선택된 프로젝트 하나의 태스크 전체(모든 보드 통틀어)만 따로
  가져옴. 클라이언트 쿼리 키를 `['projects', roomId, projectId, 'tasks']`로 둬서 기존
  `invalidateQueries({queryKey:['projects', roomId]})` 호출들이 prefix 매치로 그대로 함께
  무효화되게 함(태스크 생성·수정·삭제·이동 핸들러 변경 불필요).

**남은 것:**
- 프로젝트 하나 안의 태스크 자체는 여전히 상한 없이 전부 로드(칸반 드래그앤드롭이 보드 전체
  상태를 필요로 해서). 프로젝트 하나에 태스크가 아주 많아지는 극단적 케이스는 별도 페이지네이션이
  필요하지만, 우선순위는 낮음.

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

### 2-2. 대화방 목록 — ✅ 개선됨 (가상 스크롤)

**위치:** `packages/client/src/pages/main/components/RoomSections.tsx`

**적용된 개선:**
- 아젠다 헤더·폴더 헤더·미분류·방·공개 채널·채팅 헤더·방을 전부 하나의 평탄화된 행 배열로
  만들고 `react-virtuoso`의 `Virtuoso`로 렌더링 — 실제로 화면에 보이는 만큼만 DOM에 마운트됨.
  방이 수백~수천 개인 극단적인 경우에도 스크롤·펼침/접힘이 가벼움.
- 행마다 실제 렌더링 높이가 달라서(헤더 vs 방 vs 공개채널 행) `react-window`처럼 픽셀 높이를
  직접 지정해야 하는 방식 대신 `react-virtuoso`를 선택 — 각 행의 높이를 자동으로 측정해서
  헤더·방 컴포넌트(`RoomListItem` 등)를 전혀 안 건드리고 그대로 재사용할 수 있었음.
- 테스트: `RoomSections.test.tsx`에서 `Virtuoso`를 "전부 그리는" 컴포넌트로 모킹해서 평탄화·
  펼침/접힘·빈 상태·에러 상태·공개 채널 필터링·토글 콜백을 검증(가상 스크롤 자체는 라이브러리
  책임이라 테스트 대상에서 제외).

**참고:**
- 조직도(`Main.tsx`의 `orgTree` 트리)는 이미 1-3에서 지연 로딩으로 처리돼 있어(펼친 부서만
  로드) 렌더링 자체도 대부분의 경우 이미 가벼움 — 별도 가상 스크롤 적용 안 함.
- 폴더 안 방 목록의 좌측 들여쓰기가 기존보다 약 4px 덜할 수 있다고 예상했었는데(평탄화 과정에서
  wrapper의 여백이 빠짐), 실제 앱을 띄워 스크린샷으로 확인한 결과 오히려 채팅 섹션 방들과 깔끔하게
  정렬돼 더 일관돼 보임 — 추가 조정 불필요(2026-09-21 확인).

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

| # | 구분 | 위치 | 상태 | 우선순위 |
|---|------|------|------|----------|
| 1-1 | 서버 | GET /rooms | ✅ 개선됨 (unread 집계 쿼리 1회) | - |
| 1-2 | 서버 | GET /users | ✅ 개선됨 (take 상한 + search) | - |
| 1-3 | 서버 | GET /org/tree (모바일 포함) | ✅ 개선됨 (shallow + 부서별 지연 로드) | - |
| 1-4 | 서버 | GET /events | ✅ 개선됨 (기간 필터 + take 상한 + 인덱스) | - |
| 1-5 | 서버 | socket (멘션) | ✅ 개선됨 (유저별 룸 타겟) | - |
| 1-6 | 서버 | GET /projects/room/:roomId | ✅ 개선됨 (태스크는 선택된 프로젝트만 지연 로드) | - |
| 1-7 | 서버 | POST /rooms/:id/read | ✅ 개선됨 (createMany 단일 쿼리) | - |
| 2-1 | 클라이언트 | 채팅 메시지 로딩 | ✅ 개선됨 (무한 스크롤로 이전 메시지 로드) | - |
| 2-2 | 클라이언트 | 대화방 목록 | ✅ 개선됨 (react-virtuoso 가상 스크롤) | - |
| 2-3 | 클라이언트 | 채팅 메시지 DOM 누적 | 무한 스크롤 도입으로 긴 방일수록 DOM 누적 — 미해결 | 데이터 많을 때 |

---

**정리:**  
GET /rooms·GET /users·소켓 멘션·방 읽음 처리·GET /events·GET /org/tree(모바일 포함)·GET /projects/room/:roomId, 그리고 클라이언트 대화방 목록 가상 스크롤까지 개선을 마쳤습니다. 다음으로 점검할 것은 **채팅 메시지 목록**입니다 — 높이가 제각각인 메시지 말풍선(파일·투표·일정 카드·리액션·답장·컨텍스트메뉴 등)을 가상 스크롤로 감싸면서 스크롤 위치 유지·위로 무한 로드·읽지 않음 자동 스크롤을 깨뜨리지 않아야 해서 난이도가 높고, 지금은 실측 데이터 없이 "누적되면 그럴 수 있다"는 추정 단계입니다.
