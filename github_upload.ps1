Write-Host "GitHub 업로드를 시작합니다..." -ForegroundColor Cyan

# Git 초기화 (폴더가 없으면 초기화)
if (-not (Test-Path ".git")) { git init }

# 파일 추가 및 커밋
git add .
git commit -m "Initial commit: 천자문 암기 연습 웹페이지 제작 완료 (번호 추가 및 효과음 적용)"

# 원격 저장소 연결 (기본 origin 제거 시도 후 추가)
git remote remove origin 2>$null
git remote add origin https://github.com/iloveadi/1000test.git

# 메인 브랜치 설정 및 푸시
git branch -M main
Write-Host "푸시를 시작합니다. 로그인 창이 뜨면 확인해 주세요..." -ForegroundColor Yellow
git push -u origin main

Write-Host "업로드가 완료되었습니다!" -ForegroundColor Green
pause
