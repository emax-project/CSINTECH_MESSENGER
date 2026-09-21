# 거래처 망 메신저 이관 체크리스트

확정 방향: **이맥스 서버에 거래처 데이터를 두지 않고**, 거래처 GW/ERP 서버에 메신저를 배포한다.  
이맥스 환경은 기능 완성·검증용으로만 쓰고, 완성 후 이관·검증한다.

## 대상 서버

| 항목 | 값 | 비고 |
|------|-----|------|
| 앱 이름 | **CSIN-Tech** | 설치명·트레이·알림 |
| 앱 ID | `com.csintech.message` | |
| 외부 진입 (RDP) | `121.143.3.163:9210` | WEB RDP (메신저 포트 아님) |
| 외부 진입 (**메신저 API**) | `121.143.3.163:3030` | UTM 1442: `3030 → 192.168.123.210:3001` (공인 3001은 구서버와 충돌) |
| 내부 호스트 | `192.168.123.210` | GW/ERP + 메신저 설치 |
| MS-SQL (조직) | 내부 `192.168.123.211:1433` | 외부로는 `9213` |
| GW DB | `CSI_GW` | 조직 sync 소스 |
| 클라이언트 기본 URL | `http://121.143.3.163:3030` | 사외용 (exe에 박힘) |

> `9210`으로 RDP(`gw_admin`) 접속 후 Docker/Node로 API+DB를 올린다.  
> 사외 API는 **`3030`** (내부 서버 포트는 3001 유지). 구 공인 3001은 다른 서버(1220)와 충돌.

---

## 0. 사전 확정 (이관 전)

- [x] **앱 표시 이름** — `CSIN-Tech`
- [x] **앱 ID** — `com.csintech.message`
- [x] **기본 API URL** — `http://121.143.3.163:3030` (사외, UTM 1442)
- [x] **UTM 포워딩** — `3001 → 210:3001` (대장·TCP OPEN 확인, 앱 응답은 서버 기동 후)
- [x] **관리자 이메일** (`ADMIN_EMAIL`) — 배포 시 RDP 접속해서 `.env`에 직접 입력 (2026-09-21 결정)
- [x] 업데이트 배포 방식 — **GitHub Releases 유지** (2026-09-21 결정). `package.json`의
      `build.publish[0].provider: "github"`가 이미 이 설정이라 추가 코드 변경 불필요.
      거래처 PC가 `github.com`으로 나갈 수 있어야 자동업데이트가 동작함 — 막혀 있으면
      §4의 "자동업데이트 base URL 변경"을 다시 검토.
- [ ] **RDP로 210 배포** — 계정 `gw_admin` (비밀번호는 채팅으로만, 저장소 금지)
      배포 스크립트(`scripts/deploy-partner-server.sh`/`.ps1`)·env 템플릿(`.env.partner.example`)
      준비 완료 확인함(2026-09-21) — RDP 접속 후 `cp .env.partner.example .env`로 값 채우고
      스크립트만 실행하면 됨. `JWT_SECRET`도 비밀번호와 같은 취급 — 새 값은 채팅으로만 전달,
      이 문서(저장소)엔 남기지 않음.

---

## 1. 이맥스 측 준비 (이관 직전)

- [ ] 이맥스 Docker/DB **백업** (혹시 이관 중 롤백용)
  ```bash
  docker compose exec -T db pg_dump -U message message > emax-message-backup-$(date +%Y%m%d).sql
  ```
- [ ] 거래처용으로 쓸 **깨끗한 DB**로 갈지, 이맥스에서 만든 CSIN 계정·조직을 덤프해 가져갈지 결정
  - 권장: 거래처 서버에서 **신규 DB** + `partner:org:sync:users`로 재생성 (이맥스 PG에 섞인 데이터 최소화)
- [ ] 조직 sync·로그인·채팅이 이맥스에서 최종 통과했는지 확인

---

## 2. 거래처 서버 설치 (192.168.123.210)

### 2.1 런타임

- [ ] Docker + Docker Compose 설치 (또는 Node 20+ / PostgreSQL 16)
- [ ] 방화벽: 호스트에서 `3001`(API), 필요 시 `5433`(DB 외부 노출은 **비권장**) 허용
- [ ] 디스크: `uploads` 볼륨 여유 확인

### 2.2 배포

```bash
# 저장소 clone 또는 배포 패키지 복사 후
cp .env.example .env   # 루트 JWT_SECRET 등
# packages/server/.env 또는 compose environment 에 PARTNER_* 설정

docker compose up -d --build
docker compose logs -f server
curl -s http://127.0.0.1:3001/health   # 또는 루트 HTML 응답 확인
```

### 2.3 환경 변수 (거래처 망 기준)

`docker-compose.yml`의 `server.environment` 또는 `.env`에 반영:

| 변수 | 거래처 망 권장 값 | 비고 |
|------|-------------------|------|
| `DATABASE_URL` | compose 내부 `postgresql://message:message@db:5432/message` | |
| `JWT_SECRET` | **신규 강한 값** | 이맥스와 공유 금지 |
| `ADMIN_EMAIL` | 거래처 관리자 | |
| `PARTNER_ORG_SOURCE` | `mssql` | |
| `PARTNER_COMPANY_NAME` | `CSIN` (확정명) | |
| `PARTNER_COMPANY_EXTERNAL_CODE` | `CSIN` | |
| `PARTNER_MSSQL_SERVER` | `192.168.123.211` | **내부 IP** (외부 9213 불필요) |
| `PARTNER_MSSQL_PORT` | `1433` | |
| `PARTNER_MSSQL_DATABASE` | `CSI_GW` | |
| `PARTNER_MSSQL_USER` / `PASSWORD` | 거래처 제공 계정 | `#` 포함 시 따옴표 |
| `PARTNER_DEFAULT_PASSWORD` | 초기 비번 (배포 후 변경 안내) | LDAP 켜면 로그인에 쓰이지 않음 |
| `LDAP_ENABLED` | `true` (거래처 망) | Synology LDAP. 상세 [`ldap.md`](../packages/server/docs/ldap.md) |
| `LDAP_URL` | `ldaps://ldap.csin.kr:636` | hosts에 `ldap.csin.kr → 192.168.123.247` |
| `LDAP_BIND_DN` / `LDAP_BIND_PASSWORD` | 거래처 제공 Bind 계정 | 첨부 LDAP 연동정보 |
| `LDAP_LOCAL_EXCEPTIONS` | 비상/외부 계정 | `ADMIN_EMAIL`은 자동 예외 |

상세 조인/CLI: [`packages/server/docs/partner-org-sync.md`](../packages/server/docs/partner-org-sync.md)

### 2.4 조직·계정 sync

```bash
docker compose exec server npm run partner:org:sync        # 부서 + 기존 매핑
docker compose exec server npm run partner:org:sync:users  # 계정 생성 포함 시
```

- [ ] `/org` 트리에 CSIN만 노출되는지
- [ ] 샘플 계정 로그인 (이메일 또는 uid + LDAP 비밀번호)
- [ ] `GET /health/ldap` → `{ "ok": true, "enabled": true, "bound": true }`

---

## 3. 네트워크 / 클라이언트 접속

- [ ] **사내 PC** → `http://192.168.123.210:3001` 접속 확인
- [x] **사외** → UTM `3030 → 210:3001` 후 `http://121.143.3.163:3030/health` → `{"ok":true}` (2026-08-31 확인)
  - TCP 타임아웃이면 exe는 조직도 「로딩 중...」에 고정됨
- [ ] 이맥스 `203.254.98.92:3001`을 가리키는 **구 exe는 폐기**하고, CSIN-Tech 설치본만 배포

---

## 4. 이름·브랜딩 변경 (빌드 전)

반영됨 (`CSIN-Tech` / `com.csintech.message` / 기본 API `http://121.143.3.163:3030`):

| 구분 | 위치 |
|------|------|
| 설치 제품명 / 아티팩트 | `packages/client/package.json` |
| 타이틀바·트레이·알림 | Electron + Login/Main 등 |
| 기본 API | `api.ts`, Login, CI `VITE_API_URL`, `.env.example` |
| 서버 HTML | `packages/server/src/index.js` |

- [ ] UTM `3001` 오픈 확인 후 `VITE_API_URL`로 Windows/Mac 빌드 (또는 태그 릴리즈)
- [ ] 설치·실행 후 트레이/창 제목/로그인 기본 서버 주소 확인
- [ ] (선택) 자동업데이트 base URL을 거래처 배포 경로로 변경

---

## 5. 이관 후 검증

- [ ] 로그인 / 로그아웃
- [ ] 조직도 로드·검색·즐겨찾기
- [ ] 1:1·그룹 채팅, 파일 첨부·다운로드 경로
- [ ] 상태(온라인/자리비움 등)·항상 위
- [ ] 관리자: 공지, partner-sync status
- [ ] MSSQL 인사 변경 후 sync 재실행 → 부서 반영
- [ ] 앱 재시작·업데이트 경로 (해당 시)
- [ ] 이맥스 서버 API를 끄거나 방화벽으로 막아도 클라이언트가 정상인지 (의존 제거 확인)

---

## 6. 이관 시 자주 나는 문제

| 증상 | 원인 | 조치 |
|------|------|------|
| 조직도 무한 로딩 | API 포트 미오픈 / 잘못된 `VITE_API_URL` | 포트포워딩·빌드 URL 확인 |
| MSSQL 연결 실패 | 외부 9213을 서버 안에서 씀 | 내부 `211:1433` 사용 |
| 조직에 이맥스 회사 혼재 | `PARTNER_*` 미설정 | compose에 partner env 추가 후 재기동 |
| 로그인 불가 | sync 미실행 / 이메일 불일치 | `partner:org:sync:users` + 이메일 확인 |
| 구 exe가 이맥스 접속 | 기본 URL이 이맥스 | 거래처 URL로 재빌드·재배포 |

---

## 7. 일정 제안

1. **지금** — 이맥스에서 기능 마무리 + 본 체크리스트 항목 0 확정  
2. **이관일** — §2 서버 설치 → §2.4 sync → §3 네트워크  
3. **같은 주** — §4 이름 변경 빌드 → §5 검증 → 구 exe 폐기  

문의·포트 합의는 거래처 인프라(방화벽/UTM) 담당과 맞춰 `API 외부 포트`를 문서에 숫자로 박아 둔다.

---

## 점검 로그 (2026-08-27)

| 항목 | 결과 |
|------|------|
| 로컬 Docker API `:3001` | OK (200), 브랜딩 **CSIN-Tech** |
| PARTNER env in container | OK (`mssql` / CSIN / 9213) |
| partner sync dry-run | OK — 부서 72, 직원 143 매칭 |
| 사외 `121.143.3.163:3001` | TCP **OPEN** / HTTP 무응답 → 210에 메신저 미기동 |
| `9213` MS-SQL / `9210` RDP | OPEN |
| RDP CLI(`gw_admin`) | FreeRDP auth 실패(GUI RDP로 수동 접속 필요) |
| 이맥스 공인 `203.254.98.92:3001` | 미오픈 (이관 후 불필요) |
| 210 서버 실배포 | **보류** — Windows RDP 후 `deploy-partner-server.ps1` |

## 점검 로그 (2026-09-21)

이맥스 로컬 저장소 기준 배포 준비 상태를 코드로 재확인 (RDP 접속은 이 세션에서 불가 — 192.168.123.x는
사설망이라 여기서 네트워크 경로 자체가 없음).

| 항목 | 결과 |
|------|------|
| `scripts/deploy-partner-server.sh` / `.ps1` | 존재, 로직 확인 완료 (compose up → health 대기 → partner sync) |
| `.env.partner.example` | 존재, `PARTNER_MSSQL_SERVER=192.168.123.211` 등 거래처 망 기본값 정확 |
| `docker-compose.yml` | `PARTNER_*`/`LDAP_*`/`ADMIN_EMAIL`/`JWT_SECRET` 전부 `.env`에서 올바르게 연결됨 |
| 브랜딩(§4) | `package.json`(appId/productName)·`api.ts`(기본 API)·서버 HTML 타이틀 모두 실제 반영 확인 |
| `GET /health/ldap` | 구현 확인 (`packages/server/src/index.js`) |
| `ADMIN_EMAIL` | 결정: 배포 시 RDP 접속해서 `.env`에 직접 입력 |
| 업데이트 배포 방식 | 결정: GitHub Releases 유지 — `package.json`의 `publish.provider: github`가 이미 이 설정 |
| 새 `JWT_SECRET` | 생성해서 채팅으로 전달함 (저장소엔 미기록) |

**결론:** §0(사전 확정)은 RDP 실배포 항목 하나만 남고 전부 정리됨. 코드 쪽은 추가 변경 없이 그대로
배포 가능한 상태 — 다음 단계는 `gw_admin`으로 RDP(121.143.3.163:9210) 접속해서 스크립트 실행.
