# 새 메일 팝업 알림

메일 서버(MailCarrier 7)의 **받은편지함**(`MC7.dbo.McMailboxMsg`)에서 최근 도착한 메일을 주기적으로 읽어, 메신저에 **접속 중인** 수신자에게 우측 하단 팝업을 띄운다.
메일 서버 설정은 바꾸지 않는다. 기본은 꺼짐(`MAIL_WATCH_ENABLED=false`)이라 켜지 않은 서버에는 영향이 없다.

> 씨에스인테크 메일 서버는 `WpuMailNotifyList`(알림 목록)가 비어 있어, 메일 본체 표인 `McMailboxMsg`를 직접 읽는 방식을 쓴다.

## 동작

1. 메신저 서버가 `MAIL_WATCH_INTERVAL_SEC`(기본 15초)마다 아래 경로로 **최근 `MAIL_WATCH_MAX_AGE_SEC`(기본 600초) 이내에 받은편지함에 들어온 메일**을 조회한다.
   - `McMailboxMsg`(메일, `md_id`) → `McMailboxFolder`(`md_name = 'mcInbox'`, `mb_id`) → `McRsMailBox`(`mb_id`, `mb_owner_id`) → `McDomainUser`(`du_id`, `du_userId`)
   - 메일은 받는 사람 사서함마다 한 행이므로, 여러 명에게 간 메일도 사람별로 정확히 한 번 알린다.
   - 읽는 컬럼: `mm_id`, `mm_fromName`, `mm_fromAddr`, `mm_subject`, `mm_rsTime`, `du_userId`. 본문과 비밀번호 컬럼은 읽지 않는다.
2. `du_userId`를 메신저 사용자 이메일의 **@ 앞부분**과 맞춰 수신자를 찾는다(대소문자 무시).
3. 접속 중인 수신자에게 `mail` 소켓 이벤트를 보내고, 클라이언트가 팝업을 띄운다. 오프라인 사용자는 건너뛴다.
4. 이미 알린 메일 번호(`mm_id`)는 서버 메모리에 기억해 중복 알림을 막는다. **서버를 켠 직후 첫 조회는 알리지 않고 기록만 한다**(재시작할 때 같은 메일이 다시 뜨지 않도록). 그래서 서버가 꺼져 있던 동안 도착한 메일은 알리지 않는다.
5. 메일 서버는 받은 시각(`mm_rsTime`)을 **UTC**로 저장하므로 기본 비교 기준은 UTC이다(`MAIL_WATCH_DB_TIME=utc`). 로컬 시각으로 저장하는 환경이면 `local`로 바꾼다.

## 적용 전 확인 (서버마다 다를 수 있음)

**메일 서버가 MailCarrier 7이 아니거나 DB 이름·구조가 다르면 동작하지 않는다.** 켜기 전에 해당 서버에서 아래를 확인한다(건수만 조회).

```sql
USE MC7;   -- 메일 DB 이름
SELECT
  (SELECT COUNT(*) FROM dbo.McMailboxFolder f
     JOIN dbo.McRsMailBox m ON m.mb_id = f.mb_id
     JOIN dbo.McDomainUser u ON u.du_id = m.mb_owner_id
   WHERE f.md_name = 'mcInbox') AS inbox_user_folders,
  (SELECT MAX(g.mm_rsTime) FROM dbo.McMailboxMsg g
     JOIN dbo.McMailboxFolder f ON f.md_id = g.md_id
   WHERE f.md_name = 'mcInbox') AS inbox_newest,
  GETUTCDATE() AS utc_now;
```

`inbox_user_folders`가 사용자 수와 같고, `inbox_newest`가 `utc_now`에 가까우면(최근 메일이 있으면) 동작한다.

## 개인정보

- 메일 본문은 읽지 않는다. 제목·보낸 사람은 수신자 본인에게 소켓으로만 보내며, 메신저 DB와 로그에 저장하지 않는다.
- 제목을 보여주고 싶지 않으면 `MAIL_WATCH_SHOW_SUBJECT=false` (보낸 사람만 표시).
- `McDomainUser`에는 비밀번호 컬럼(`du_pwd`)이 있다. 읽기 전용 계정은 **필요한 컬럼만** 허용해 비밀번호를 읽을 수 없게 한다(아래).

## 켜는 방법

1. 메일 DB(`MC7`)에 읽기 전용 계정을 만든다. 아래 권한만 준다(계정·비밀번호는 담당자가 직접 만들고 관리한다. 메일 서버 관리자 계정은 쓰지 않는다).

   ```sql
   USE MC7;
   -- 로그인/사용자는 직접 생성한 뒤, 사용자 이름을 아래 <mailwatch_user> 에 넣는다
   GRANT SELECT (mm_id, md_id, mm_fromName, mm_fromAddr, mm_subject, mm_rsTime) ON dbo.McMailboxMsg TO <mailwatch_user>;
   GRANT SELECT (md_id, mb_id, md_name) ON dbo.McMailboxFolder TO <mailwatch_user>;
   GRANT SELECT (mb_id, mb_owner_id) ON dbo.McRsMailBox TO <mailwatch_user>;
   GRANT SELECT (du_id, du_userId) ON dbo.McDomainUser TO <mailwatch_user>;   -- 비밀번호 컬럼 제외
   ```

2. 서버 환경 변수를 설정한다(`.env.partner.example` 참고). GitHub Actions 배포라면 Secrets에 `MAIL_WATCH_ENABLED`, `MAIL_MSSQL_SERVER`, `MAIL_MSSQL_PORT`, `MAIL_MSSQL_USER`, `MAIL_MSSQL_PASSWORD` 등을 등록하고 deploy 워크플로의 환경 변수 전달에 추가한다.
3. 서버를 재시작하고 로그에서 `[startup] mail watch: enabled` 를 확인한다.
4. 이 서버 사용자에게 테스트 메일을 1통 보내 팝업이 뜨는지 확인한다. 알림은 메신저 설정의 "알림 팝업" 스위치와 방해 금지(스누즈) 설정을 따른다.

## 한계 / 다음 단계

- 팝업을 눌러도 메일 화면으로 이동하지 않는다(앱만 앞으로 나온다). 메일 바로가기는 2단계 작업이다(`mm_id`를 이미 받고 있다).
- 수신자 매칭은 메일 아이디(`du_userId`)와 메신저 이메일의 @ 앞부분이 같다는 가정이다. 다른 사용자는 알림을 받지 못한다.
- 조회 구간(기본 10분)보다 조회 주기·배치 크기가 커지면 누락될 수 있다. 한 번에 `MAIL_WATCH_BATCH`(기본 500)건까지 본다.
- 받은편지함에 들어온 메일 기준이므로, 규칙으로 다른 폴더로 분류되는 메일은 알리지 않는다. 읽음 상태(`mm_new`)는 쓰지 않는다.
