@echo off
title Capri Agent Bridge
cd /d "%~dp0\.."
echo Starting Capri Agent Bridge...
set FORCE_ENABLE_BRIDGE=true
node scripts/agent-bridge.js %*
pause
