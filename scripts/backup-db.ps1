<#
  메신저 DB 일일 백업 (Windows 서버 + WSL2 Docker 환경)
  - db 컨테이너 안에서 pg_dump | gzip 으로 만들어 호스트로 복사한다(PowerShell 리다이렉트는 바이너리를 깨뜨리므로 컨테이너 안에서 압축).
  - 덤프가 끝까지 만들어졌는지("dump complete" 표시)와 gzip 무결성을 확인한 뒤에만 저장하고, 오래된 파일을 지운다.
  - 실패하면 종료 코드 1 + 로그에 사유를 남긴다(작업 스케줄러 '마지막 실행 결과'로 확인).
  사용: powershell -NoProfile -ExecutionPolicy Bypass -File backup-db.ps1 [-Dir D:\backup\messenger] [-KeepDays 7]
#>
param(
  [string]$Container = 'csintech_messenger-db-1',
  [string]$Dir = 'D:\backup\messenger',
  [int]$KeepDays = 7
)

$ErrorActionPreference = 'Stop'
$env:Path += ';C:\docker-cli'
if (-not $env:DOCKER_HOST) { $env:DOCKER_HOST = 'tcp://localhost:2375' }

New-Item -ItemType Directory -Force -Path $Dir | Out-Null
$log = Join-Path $Dir 'backup.log'
function Log([string]$msg) { Add-Content -Path $log -Value ("{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg) }

$name = 'messenger_{0}.sql.gz' -f (Get-Date -Format 'yyyyMMdd_HHmm')
$tmp = "/tmp/$name"
$dest = Join-Path $Dir $name

try {
  # 1) 컨테이너 안에서 덤프 + 압축
  docker exec $Container sh -c "pg_dump -U message -d message --no-owner --clean --if-exists | gzip > $tmp"
  if ($LASTEXITCODE -ne 0) { throw 'pg_dump/gzip 실행 실패' }

  # 2) 끝까지 만들어졌는지(pg_dump 완료 표시) + gzip 무결성 확인
  docker exec $Container sh -c "gzip -t $tmp && gzip -dc $tmp | tail -n 5 | grep -q 'PostgreSQL database dump complete'"
  if ($LASTEXITCODE -ne 0) { throw '덤프가 완전하지 않음(완료 표시 없음 또는 gzip 손상)' }

  # 3) 호스트로 복사 후 컨테이너 임시 파일 삭제
  docker cp "${Container}:$tmp" $dest
  if ($LASTEXITCODE -ne 0) { throw 'docker cp 실패' }
  docker exec $Container rm -f $tmp | Out-Null

  $size = (Get-Item $dest).Length
  if ($size -lt 1024) { throw "백업 파일이 너무 작음($size bytes)" }
  Log ("OK  {0}  {1:N1} KB" -f $name, ($size / 1KB))

  # 4) 오래된 백업 정리 (이번 파일은 방금 만들었으므로 남는다)
  Get-ChildItem -Path $Dir -Filter 'messenger_*.sql.gz' |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
    ForEach-Object { Remove-Item $_.FullName -Force; Log ("삭제(보관기간 초과): " + $_.Name) }
}
catch {
  Log ("FAIL  " + $_.Exception.Message)
  if (Test-Path $dest) { Remove-Item $dest -Force -ErrorAction SilentlyContinue }
  exit 1
}
