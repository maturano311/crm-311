@echo off
set "GIT=C:\Program Files\Git\bin\git.exe"
"%GIT%" add .
"%GIT%" commit -m "fix: exclui scripts do build TypeScript"
"%GIT%" push origin main
