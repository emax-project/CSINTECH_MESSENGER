# 새 메일 팝업 알림

메일 서버(MailCarrier)가 쌓는 **메일 알림 목록**(`MC7.dbo.WpuMailNotifyList`)을 주기적으로 읽어, 메신저에 **접속 중인** 수신자에게 우측 하단 팝업을 띄운다.
메일 서버 설정은 바꾸지 않는다. 기본은 꺼짐(`MAIL_WATCH_ENABLED=false`)이라 켜지 않은 서버에는 영향이 없다.

## 동작

1. 메신저 서버가 `MAIL_WATCH_INTERVAL_SEC`(기본 15초)마다 `WpuMailNotifyList`에서 **마지막으로 처리한 번호(`mn_id`) 이후**의 행을 조회한다.
   - 이 표는 받는 사람(`du_id`)마다 한 행이 생기므로, 여러 명에게 간 메일도 사람별로 정확히 한 번 알린다.
   - 읽는 컬럼: `mn_id`, `mm_id`, `mn_from`(보낸 사람), `mn_subject`(제목), `mn_rstime`(오래된 알림 제외용), 그리고 `McDomainUser`의 `du_id`, `du_userId`(수신자 아이디)
2. `du_userId`를 메신저 사용자 이메일의 **@ 앞부분**과 맞춰 수신자를 찾는다(대소문자 무시).
3. 접속 중인 수신자에게 `mail` 소켓 이벤트를 보내고, 클라이언트가 팝업을 띄운다. 오프라인 사용자는 건너뛴다.
4. 마지막 처리 번호는 메신저 DB(`AppSetting.mail_watch_cursor`)에 저장한다. 처음 켤 때는 현재까지의 알림을 보내지 않고 그 이후부터 보낸다. 저장된 번호가 표의 현재 최대 번호보다 크면(표 초기화) 현재 최대 번호로 보정한다.
5. 서버를 오래 껐다 켜도 `MAIL_WATCH_MAX_AGE_SEC`(기본 600초)보다 오래된 알림은 보내지 않는다. 메일 서버는 알림 시각을 **UTC**로 저장하므로 기본 비교 기준은 UTC이며(`MAIL_WATCH_DB_TIME=utc`), 로컬 시각으로 저장하는 환경이면 `local`로 바꾼다.

## 적용 전 확인 (서버마다 다를 수 있음)

이 기능은 MailCarrier 7(`MC7`) DB 구조(`WpuMailNotifyList`, `McDomainUser`)를 기준으로 만들었다.
**메일 서버가 MailCarrier가 아니거나 DB 이름·구조가 다르면 동작하지 않는다.** 켜기 전에 해당 서버에서 아래를 확인한다.

```sql
USE MC7;   -- 메일 DB 이름
SELECT COUNT(*) AS cnt, MAX(mn_id) AS max_id, MAX(mn_rstime) AS newest, GETUTCDATE() AS utc_now
FROM dbo.WpuMailNotifyList;
```

`newest`가 `utc_now`에 가까우면(최근) 지금도 쌓이는 표이다. 표가 없거나 비어 있으면 이 방식은 쓸 수 없다.

## 개인정보

- 메일 본문은 읽지 않는다. 제목·보낸 사람은 수신자 본인에게 소켓으로만 보내며, 메신저 DB와 로그에 저장하지 않는다.
- 제목을 보여주고 싶지 않으면 `MAIL_WATCH_SHOW_SUBJECT=false` (보낸 사람만 표시).
- `McDomainUser`에는 비밀번호 컬럼(`du_pwd`)이 있다. 읽기 전용 계정은 **필요한 컬럼만** 허용해 비밀번호를 읽을 수 없게 한다(아래).

## 켜는 방법

1. 메일 DB(`MC7`)에 읽기 전용 계정을 만든다. 아래 권한만 준다(계정·비밀번호는 담당자가 직접 만들고 관리한다).

   ```sql
   USE MC7;
   -- 로그인/사용자는 직접 생성한 뒤, 사용자 이름을 아래 <mailwatch_user> 에 넣는다
   GRANT SELECT ON dbo.WpuMailNotifyList TO <mailwatch_user>;
   GRANT SELECT (du_id, du_userId) ON dbo.McDomainUser TO <mailwatch_user>;   -- 비밀번호 컬럼 제외
   ```

2. 서버 환경 변수를 설정한다(`.env.partner.example` 참고). GitHub Actions 배포라면 Secrets에 `MAIL_WATCH_ENABLED`, `MAIL_MSSQL_USER`, `MAIL_MSSQL_PASSWORD` 등을 등록하고 deploy 워크플로의 환경 변수 전달에 추가한다.
3. 서버를 재시작하고 로그에서 `[startup] mail watch: enabled` 를 확인한다.
4. 이 서버 사용자에게 테스트 메일을 1통 보내 팝업이 뜨는지 확인한다. 알림은 메신저 설정의 "알림 팝업" 스위치와 방해 금지(스누즈) 설정을 따른다.

## 한계 / 다음 단계

- 팝업을 눌러도 메일 화면으로 이동하지 않는다(앱만 앞으로 나온다). 메일 바로가기는 2단계 작업이다(`mm_id`를 이미 받고 있다).
- 수신자 매칭은 메일 아이디(`du_userId`)와 메신저 이메일의 @ 앞부분이 같다는 가정이다. 다른 사용자는 알림을 받지 못한다.
- `WpuMailNotifyList`는 메일 서버가 오래된 행을 정리하는 표다. 서버를 며칠 이상 끄면 그동안의 알림은 사라질 수 있다(어차피 오래된 알림은 보내지 않는다).
