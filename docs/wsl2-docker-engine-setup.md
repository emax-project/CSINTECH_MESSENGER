# WSL2 + Docker Engine 직접 설치 (Docker Desktop 제거)

## 왜 바꾸나

Docker Desktop은 직원 250명 이상 또는 연매출 1,000만 달러 초과 기업이 상업적으로
쓸 경우 유료 구독(Pro/Team/Business)이 필요하다. **Docker *Engine*(데몬) 자체는
Apache-2.0 오픈소스라 기업 규모와 무관하게 완전 무료**다 — 제한은 Docker Desktop이라는
GUI 앱 제품에만 걸려 있다. 그래서 Docker Desktop을 지우고, WSL2 안에 Docker Engine을
직접 설치해 GUI 없이(데몬만) 운영한다.

`docker compose` 명령 자체는 똑같이 동작한다. 달라지는 건 데몬이 "Docker Desktop
앱"이 아니라 "WSL2 안의 리눅스 프로세스"라는 것, 그리고 Windows 쪽에서 그 데몬에
접속하려면 CLI와 `DOCKER_HOST`가 필요하다는 것뿐이다.

`.github/workflows/deploy.yml`은 이미 이 구조(`DOCKER_HOST=tcp://localhost:2375`,
CLI는 `C:\docker-cli`)에 맞춰 반영해 뒀다 — 아래 서버 쪽 설정만 끝내면 재배포가
바로 된다.

---

## 1. Docker Desktop 제거

PowerShell(관리자 권한):
```powershell
winget uninstall Docker.DockerDesktop
```
(또는 설정 > 앱 > Docker Desktop > 제거)

## 2. WSL2 + 배포판 확인/설치

```powershell
wsl --list --verbose
```
Docker Desktop이 만든 `docker-desktop`/`docker-desktop-data` 배포판은 제거 과정에서
같이 지워진다. 범용 배포판이 따로 없으면 새로 설치:
```powershell
wsl --install -d Ubuntu-22.04
```
처음 실행하면 유닉스 사용자명/비밀번호를 설정하라고 뜬다 — 한 번 대화형으로 설정해 둔다.

> 아래 전부 이 Ubuntu 배포판 안(`wsl` 또는 `wsl -d Ubuntu-22.04`로 들어간 bash 셸)에서
> 실행하는 명령이다. 배포판 이름이 다르면 이 문서의 `Ubuntu-22.04`를 전부 그 이름으로 바꿔서 읽는다.

## 3. Docker Engine 설치 (WSL2 안)

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

## 4. systemd 활성화 (WSL2 부팅 시 서비스 자동 기동용)

`/etc/wsl.conf` 생성/수정:
```ini
[boot]
systemd=true
```
PowerShell에서:
```powershell
wsl --shutdown
```
다시 `wsl -d Ubuntu-22.04`로 들어가면 systemd가 켜진 상태로 재시작된다. Docker 서비스 등록:
```bash
sudo systemctl enable docker
sudo systemctl start docker
docker version   # 정상 출력되는지 확인
```

## 5. Windows에서 접속할 수 있도록 TCP 소켓 열기

패키지 업데이트로 설정이 날아가지 않도록 systemd 드롭인으로 추가한다:
```bash
sudo mkdir -p /etc/systemd/system/docker.service.d
sudo tee /etc/systemd/system/docker.service.d/override.conf > /dev/null <<'EOF'
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd -H unix:///var/run/docker.sock -H tcp://127.0.0.1:2375
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
```

⚠️ **보안**: `127.0.0.1`에만 바인딩해야 한다(인증 없는 포트라 외부에 열리면 위험).
WSL2는 기본적으로 NAT라 외부에서 직접 안 보이지만, 혹시 모르니 Windows 방화벽에서
2375 포트 인바운드를 막아 두는 걸 권장한다(아래는 예시):
```powershell
New-NetFirewallRule -DisplayName "Block Docker 2375 Inbound" -Direction Inbound -LocalPort 2375 -Protocol TCP -Action Block -RemoteAddress Internet
```

## 6. 로그인 없이 WSL2 자동 기동 (서버 재부팅 대응)

WSL2는 기본적으로 로그인해야 켜지는 사용자 단위 기능이다. 아무도 로그인 안 해도
부팅과 동시에 켜지도록 작업 스케줄러에 등록한다. PowerShell(관리자):
```powershell
$action = New-ScheduledTaskAction -Execute "wsl.exe" -Argument "-d Ubuntu-22.04 -u root -- /bin/true"
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "WSL2-Docker-AutoStart" -Action $action -Trigger $trigger -Principal $principal
```
(작업 스케줄러 GUI로 할 거면: 트리거 "시스템 시작 시", "사용자 로그온 여부와 관계없이
실행" + "가장 높은 수준의 권한으로 실행" 체크, 동작은 `wsl.exe` 인수
`-d Ubuntu-22.04 -u root -- /bin/true`)

이 작업이 `wsl.exe`를 호출하는 순간 WSL2 배포판이 부팅되고, systemd가 docker 서비스를
같이 띄운다. 컨테이너 자체는 `docker compose`의 `restart: unless-stopped` 정책 덕분에
데몬이 뜨면 자동으로 다시 올라온다 — 별도 `docker compose up` 재실행은 필요 없다.

## 7. Windows용 Docker CLI 설치 (Desktop 아님, CLI만)

GitHub Actions 러너(Windows 서비스)가 `docker`/`docker compose` 명령을 쓰려면
Windows 쪽에도 CLI 실행파일이 있어야 한다 — Desktop 없이 CLI만 받는다.

```powershell
New-Item -ItemType Directory -Force -Path C:\docker-cli

# 최신 버전 확인: https://download.docker.com/win/static/stable/x86_64/ 에서 파일명 확인 후 아래 버전 교체
$ver = "<최신 버전으로 교체>"
Invoke-WebRequest -Uri "https://download.docker.com/win/static/stable/x86_64/docker-$ver.zip" -OutFile docker.zip
Expand-Archive docker.zip -DestinationPath C:\ -Force
Move-Item C:\docker\* C:\docker-cli\ -Force

# docker compose v2 플러그인
New-Item -ItemType Directory -Force -Path "C:\docker-cli\cli-plugins"
Invoke-WebRequest -Uri "https://github.com/docker/compose/releases/latest/download/docker-compose-windows-x86_64.exe" -OutFile "C:\docker-cli\cli-plugins\docker-compose.exe"
```

## 8. 확인

```powershell
$env:DOCKER_HOST = "tcp://localhost:2375"
docker version
docker compose version
```
둘 다 정상 출력되면 끝. `deploy.yml`이 이미 `C:\docker-cli`를 PATH에 추가하고
`DOCKER_HOST=tcp://localhost:2375`를 쓰도록 돼 있으니, GitHub Actions에서
Deploy 워크플로를 다시 실행하면 그대로 붙는다.

## 롤백

문제가 생기면 Docker Desktop을 다시 설치하고, `deploy.yml`의
`$dockerBin`을 `C:\Users\gw_admin\AppData\Local\Programs\DockerDesktop\resources\bin`로,
job-level `DOCKER_HOST`를 제거하면 원래 구조로 되돌아간다(git에서 이전 커밋 참고).
