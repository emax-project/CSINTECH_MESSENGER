# 설치 · 유지보수 가이드 (관리자용)

> 대상: 서버를 설치·운영하거나 클라이언트 앱을 빌드/배포하는 담당자.
> 이 문서는 초안입니다 — 실제 배포 환경(사내 EMAX망 / 거래처망 등)에 맞춰 세부값을 채워 넣어 주세요.
> 사용자 화면 기능(조직 관리·사용자 관리 메뉴 등)에 대한 상세 조작법은 [`user-guide.md`](./user-guide.md) §13을 참고하세요.

## 1. 구성 요소

| 구성 | 설명 |
|------|------|
| **클라이언트** (`packages/client`) | Electron + Vite. 데스크톱 앱(.dmg/.exe)으로 빌드해 배포 |
| **API 서버** (`packages/server`) | Node.js + Express + Prisma. 로그인/채팅/조직도/공지 등 처리 |
| **DB** | PostgreSQL (Docker 컨테이너 또는 별도 서버) |
| **선택 연동** | Synology LDAP(사내 계정 인증), 거래처 MSSQL 조직도 동기화 |

거래처(파트너)에 배포하는 빌드는 앱 이름·ID·기본 API 주소가 다르게 설정될 수 있습니다. 현재 브랜치가 어떤 배포 대상인지는 `packages/client/package.json`의 `productName`과 `docs/partner-network-migration.md`를 먼저 확인하세요.

## 2. 사전 요구사항

- Node.js (LTS), npm
- Docker + Docker Compose (DB, 또는 전체 스택 컨테이너 실행 시)
- macOS(빌드 담당 PC): Mac 설치 파일(.dmg) 빌드는 macOS에서만 가능
- 배포 대상 서버가 `github.com`으로 아웃바운드 접속 가능해야 자동 업데이트 동작

## 3. 최초 설치 — 서버

### 3-1. 전체를 Docker로 실행

```bash
cd MESSAGE
cp .env.example .env      # 최초 1회, JWT_SECRET 등 값 확인/수정
docker compose up -d --build
docker compose logs -f
```

- PostgreSQL: 호스트 포트 `5433`
- API 서버: `http://localhost:3001` (`/health` 로 동작 확인)

### 3-2. DB만 Docker, 서버는 로컬 실행 (개발/디버깅용)

```bash
docker compose up -d db
cd packages/server
cp .env.example .env
# DATABASE_URL="postgresql://message:message@localhost:5433/message"
npm install
npm run db:push          # 스키마를 DB에 반영
npm run dev
```

### 3-3. 환경 변수 (`packages/server/.env`)

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | PostgreSQL 접속 문자열 |
| `JWT_SECRET` | 로그인 토큰 서명 키. **운영 환경에서는 반드시 변경** (`openssl rand -base64 32`) |
| `ADMIN_EMAIL` | 공지 등록 등 관리자 권한을 가질 이메일(쉼표로 다중 지정 가능) |
| `PARTNER_ORG_SOURCE` | `off`(기본) / `mock`(로컬 검증용) / `mssql`(실제 거래처 DB) |
| `PARTNER_MSSQL_*` | 거래처 조직도 MSSQL 접속 정보. 자세한 내용: [`partner-org-sync.md`](../packages/server/docs/partner-org-sync.md) |
| `PARTNER_DEFAULT_PASSWORD` | 조직 동기화로 계정 자동 생성 시 초기 비밀번호(필수 지정, 최초 로그인 시 변경 강제) |
| `LDAP_ENABLED` 이하 `LDAP_*` | Synology LDAP 연동(그룹웨어와 계정 통합). 자세한 내용: [`ldap.md`](../packages/server/docs/ldap.md) |

전체 예시는 `packages/server/.env.example`, 거래처망 배포용 예시는 `.env.partner.example` 참고.

## 4. 최초 설치 — 클라이언트(데스크톱 앱) 빌드/배포

### 4-1. 빌드

```bash
# 프로젝트 루트에서
npm run build:app          # 현재 OS 대상
npm run build:app:mac      # macOS만 (.dmg) — macOS에서만 가능
npm run build:app:win      # Windows만 (.exe) — Mac에서도 크로스 빌드 가능
```

결과물: `packages/client/release/` (`*.dmg`, `*.exe`, `latest.yml`, `latest-mac.yml`)

빌드 전에 반드시:
1. `packages/client/package.json`의 `version`을 올린다 (예: `1.2.57` → `1.2.58`).
2. 접속할 서버 주소가 바뀌었다면 `packages/client/.env`에 `VITE_API_URL=https://서버주소:포트` 설정.

### 4-2. 배포 (GitHub Releases)

1. https://github.com/emax-project/MESSAGE/releases 에서 새 릴리스 생성
2. 태그를 `package.json` 버전과 동일하게 (`v1.2.58`)
3. `release/` 폴더의 설치 파일 **+ `latest.yml` + `latest-mac.yml`** 을 모두 첨부 (누락 시 자동 업데이트 동작 안 함)
4. Publish

사용자 안내 링크: `https://github.com/emax-project/MESSAGE/releases/latest`

자세한 절차·문구 예시·직접 서버/S3 배포(방법 B)는 [`DEPLOY.md`](../DEPLOY.md) 참고.

### 4-3. 자동 업데이트

- 설치된 앱은 실행 시 GitHub Releases를 확인하고, 새 버전이 있으면 백그라운드 다운로드 → **앱 재시작 시** 적용
- 수동 확인: 앱 메뉴 **도움말 → 업데이트 확인**
- 비공개 저장소라 404가 나는 경우: Generic 업데이트 서버(공개 URL) 사용 필요 → `DEPLOY.md`의 "GitHub이 404일 때" 참고
- macOS 코드사인/공증은 **당분간 미적용** — Gatekeeper가 "손상됨"으로 표시하면 아래 8-1 참고

## 5. 운영 서버 DB 반영 (코드만 pull한 경우)

`git pull`은 코드만 갱신하고 DB는 그대로입니다. 서버 PC에서 한 번 더 실행:

```bash
cd packages/server
npm install
npm run db:push              # 마이그레이션 파일 없이 스키마 바로 반영
# 또는
npm run db:migrate:deploy    # prisma/migrations 사용 시
```

Docker 배포라면 서버 컨테이너 기동 시 `prisma db push`가 자동 실행되도록 되어 있음(compose CMD 확인).

## 6. 배포 자동화 (Self-hosted Runner)

`main` push → 서버 PC의 Docker가 자동 갱신되는 구조(서버 → GitHub 아웃바운드 연결만 필요, 인바운드/공인 IP 불필요).

- 1회 설정: 서버 PC에 Docker 설치 → 사용자 `docker` 그룹 추가 → GitHub **Settings → Actions → Runners**에서 러너 등록(Label에 `server` 포함) → 서비스로 등록
- `JWT_SECRET`은 GitHub **Settings → Secrets and variables → Actions**에 등록해 두면 배포 시 자동 전달(미등록 시 기본값 `change-me-in-production` 사용 — 운영 환경 금지)
- 전체 단계별 명령어는 [`DEPLOY.md`](../DEPLOY.md) "GitHub Actions로 서버 PC Docker 자동 배포" 절 참고

## 7. 거래처(파트너) 배포 특이사항

거래처망에 별도로 설치하는 빌드(예: CSIN-Tech)는 다음이 사내 배포와 다릅니다. 자세한 배경·결정 이력은 [`partner-network-migration.md`](../docs/partner-network-migration.md) 참고.

- 앱 표시 이름 / 앱 ID가 다름 (`productName`, `appId`)
- 클라이언트 기본 API 주소가 거래처 서버 URL로 빌드에 박힘
- 조직도는 거래처 MSSQL(`PARTNER_ORG_SOURCE=mssql`)에서 동기화 — `npm run partner:org:sync` (부서만) / `npm run partner:org:sync:users` (계정도 생성)
- 로그인은 거래처 Synology LDAP 연동 가능(`LDAP_ENABLED=true`) — 켜져 있으면 로컬 초기 비밀번호 대신 LDAP `uid`로 인증
- `.env.partner.example` → `.env` 복사 후 `./scripts/deploy-partner-server.sh` (Windows: `.ps1`)로 배포

## 8. 정기 유지보수 작업

| 작업 | 명령 |
|------|------|
| 관리자 계정 생성 | `npm run admin:create` (server) |
| LDAP 연동 점검 | `npm run ldap:check` / `npm run ldap:check -- --uid <아이디>` |
| 조직도 동기화(드라이런) | `npm run partner:org:sync:dry` |
| 조직도 동기화(실행) | `npm run partner:org:sync` |
| DB 덤프(백업) | `./scripts/dump-db.sh` (프로젝트 루트, 실행 권한 필요: `chmod +x`) |
| DB 복원 | 덤프 파일을 서버로 복사 후 `cat dump_*.sql \| docker compose exec -T db psql -U message -d message` |
| 테스트 계정 시딩 | `npm run db:seed` (server) → `test1@test.com` / `test2@test.com`, 비밀번호 `123456` |

## 9. 트러블슈팅

### 9-1. macOS에서 "손상되었기 때문에 열 수 없습니다"

무서명 빌드라 발생. 사용자 안내 문구:

```bash
xattr -cr /Applications/<앱 이름>.app
```

근본 해결은 Apple Developer 계정으로 코드사인·공증이 필요(현재 미적용, 추후 검토).

### 9-2. 배포 후 웹/앱에서 흰 화면만 보일 때

1. `http://서버주소:3001/debug-client` → `{"ok":true,"clientServed":true,"hasAssets":true}` 확인. `clientServed:false`면 이미지에 client-dist 누락 → Dockerfile/배포 워크플로 확인
2. `http://서버주소:3001/` 접속 시 "로딩 중..." 후 "페이지를 불러오지 못했습니다"로 바뀌면 JS 리소스 요청 실패 → 리버스 프록시 경로/HTTPS-HTTP 혼용/방화벽 확인
3. `/health` → `{"ok":true}` 이면 API 서버 자체는 정상

### 9-3. 채팅 목록에 "목록을 불러올 수 없습니다"

DB(PostgreSQL)가 떠 있지 않거나 접속 정보가 잘못된 경우 발생. `docker compose ps`로 `db` 컨테이너 상태, `DATABASE_URL` 값 확인.

### 9-4. macOS에서 알림이 안 보임

시스템 설정 → 알림 → **Electron**(개발 실행 시) 또는 앱 표시 이름(빌드 앱) → 알림 허용. 앱 내 "알림 테스트" 버튼으로 동작 확인.

### 9-5. 자동 업데이트가 동작하지 않음

- GitHub Releases에 `latest.yml`/`latest-mac.yml`이 첨부됐는지 확인
- 비공개 저장소 404 → Generic 업데이트 서버 방식으로 전환 필요(§4-3)
- 사용자 PC가 `github.com`(또는 지정한 업데이트 서버)으로 아웃바운드 가능한지 확인

## 10. 참고 문서

- [`README.md`](../README.md) — 로컬 개발 빠른 시작
- [`DEPLOY.md`](../DEPLOY.md) — 빌드/배포 전체 절차, GitHub Actions 자동 배포
- [`packages/server/docs/ldap.md`](../packages/server/docs/ldap.md) — LDAP 연동
- [`packages/server/docs/partner-org-sync.md`](../packages/server/docs/partner-org-sync.md) — 거래처 조직도 동기화
- [`docs/partner-network-migration.md`](./partner-network-migration.md) — 거래처망 이관 체크리스트/결정 기록
- [`docs/PERFORMANCE-CONSIDERATIONS.md`](./PERFORMANCE-CONSIDERATIONS.md) — 성능 관련 고려사항

---
*이 문서는 초안입니다. 실제 운영 환경(서버 IP, 포트, 거래처명 등) 확정 후 구체값으로 업데이트해 주세요.*
