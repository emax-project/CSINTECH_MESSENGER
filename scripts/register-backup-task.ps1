<#
  backup-db.ps1 을 매일 새벽에 실행하는 작업 스케줄러 등록 (관리자 PowerShell에서 1회 실행)
  사용: .\register-backup-task.ps1 [-Time 03:30] [-Dir D:\backup\messenger] [-KeepDays 7]
  SYSTEM 계정으로 등록하므로 로그인하지 않아도 실행된다. 해제: schtasks /Delete /TN MessengerDbBackup /F
#>
param(
  [string]$Time = '03:30',
  [string]$Dir = 'D:\backup\messenger',
  [int]$KeepDays = 7
)

$script = Join-Path $PSScriptRoot 'backup-db.ps1'
if (-not (Test-Path $script)) { throw "backup-db.ps1 을 찾을 수 없습니다: $script" }

$cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$script`" -Dir `"$Dir`" -KeepDays $KeepDays"
schtasks /Create /TN MessengerDbBackup /TR $cmd /SC DAILY /ST $Time /RU SYSTEM /RL HIGHEST /F
if ($LASTEXITCODE -ne 0) { throw '작업 스케줄러 등록 실패 (관리자 권한으로 실행했는지 확인)' }

Write-Host "등록 완료: 매일 $Time 에 $Dir 로 백업, ${KeepDays}일 보관"
Write-Host "지금 한 번 실행해 확인: schtasks /Run /TN MessengerDbBackup  → $Dir\backup.log 확인"
