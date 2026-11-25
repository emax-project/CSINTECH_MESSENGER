# 그룹웨어 → 메신저 겸직 동기화 규격

CS 요청: 겸직으로 같은 부서에 근무하는 타 법인 사용자도 메신저 조직도에 표시.
그룹웨어(결재자 선택)가 아는 **사람별 소속(발령) 전체**를 메신저에 보내면, 메신저가 그 부서마다 그 사람을 보여 줍니다.
(지금 `messengerSync`는 최신 발령 1건의 부서명만 보내서 한 곳에만 보입니다.)

## 공통

- 메신저 주소: `MESSENGER_API_URL` (기존 동기화와 같음). 경로는 `/internal/...`
- 인증: 헤더 `x-internal-secret: <INTEGRATION_SHARED_SECRET>` — 기존 `messengerSync`와 같은 방식.
  메신저 서버에도 같은 값을 `INTEGRATION_SHARED_SECRET`으로 넣어야 하며, 비어 있으면 503으로 꺼져 있습니다.
- 값 만들기: `openssl rand -hex 32` (메신저·그룹웨어 양쪽에 똑같이 입력, 평문 메신저 전송 금지)

## POST /internal/users/affiliations

사용자별 겸직 목록을 맞춥니다. 한 번에 최대 500명, 사용자당 최대 20개.

```json
{
  "users": [
    {
      "email": "gildong@csin.kr",
      "affiliations": [
        { "companyName": "씨에스인", "departmentName": "경영지원부" },
        { "companyName": "예시컴퍼니", "departmentName": "영업본부 > 영업1팀" }
      ]
    }
  ],
  "replace": true,
  "createMissing": false
}
```

| 필드 | 설명 |
|---|---|
| `email` | 메신저 로그인 이메일(그룹웨어 `comm_user.email` 또는 `hr_employee_info.email`). 이 이메일로 사용자를 찾는다 |
| `affiliations[]` | 그 사람의 **모든** 소속(직속 포함 가능). `companyName` = 법인, `departmentName` = 부서 이름 또는 `본부 > 팀` 경로 |
| `replace` (기본 true) | true면 이번에 보내지 않은 겸직은 메신저에서 지운다. false면 추가만 한다 |
| `createMissing` (기본 false) | 메신저에 없는 법인·부서를 새로 만들지 여부 |

동작 규칙

- 법인·부서는 **이름(대소문자 무시)** 으로 찾습니다. 부서 이름만 오면 그 법인 안에서 이름이 하나뿐일 때만 맞춥니다(같은 이름이 둘이면 건너뛰고 `DEPARTMENT_AMBIGUOUS`).
- 직속 부서(메신저에서 그 사람의 기본 부서)는 `replace`여도 지우지 않습니다.
- 보낸 소속 중 하나라도 메신저에서 못 찾으면 그 사용자는 **삭제를 건너뛰고** 추가만 합니다(이름 불일치로 기존 겸직이 통째로 지워지는 사고 방지). 못 찾은 항목은 응답 `unresolved`에 나옵니다.
- 같은 요청을 여러 번 보내도 결과는 같습니다(멱등).

응답 (200)

```json
{
  "ok": true,
  "updated": 12,
  "unchanged": 30,
  "added": 15,
  "removed": 2,
  "notFound": ["nobody@csin.kr"],
  "unresolved": [
    { "email": "gildong@csin.kr", "companyName": "예시컴퍼니", "departmentName": "영업본부 > 영업1팀", "reason": "DEPARTMENT_NOT_FOUND" }
  ],
  "invalid": [{ "index": 3, "reason": "INVALID_EMAIL" }]
}
```

- `notFound`: 메신저에 그 이메일 계정이 없음(먼저 계정이 만들어져 있어야 함)
- `unresolved.reason`: `COMPANY_NOT_FOUND` / `DEPARTMENT_NOT_FOUND` / `DEPARTMENT_AMBIGUOUS`
- 오류 응답: 400 `USERS_REQUIRED`·`TOO_MANY_USERS`, 401 시크릿 불일치, 503 연동 꺼짐, 429 호출 과다(분당 600회)

## 그룹웨어에서 할 일

1. 사용자의 **유효한 발령(소속) 전체**를 `{ companyName, departmentName }` 목록으로 만든다. 법인 이름·부서 이름은 메신저 조직도에 있는 이름과 같아야 한다.
2. 위 API로 보낸다. 시점은 (a) 발령·겸직 저장 때(기존 사용자 동기화 훅 옆), (b) 처음 한 번 전체 백필, (c) 주기 재동기화(reconcile) 중 편한 것을 쓰면 된다.
3. 처음에는 `replace:false`로 소량을 보내 `unresolved`·`notFound`를 확인하고 이름을 맞춘 뒤 `replace:true`로 간다.
