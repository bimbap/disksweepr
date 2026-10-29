@echo off
cd /d "%~dp0"
set CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe
set OUT=..\release\DiskSweepr-Web-Setup.exe
set ICON=..\build\icon.ico
set PNG=..\build\icon.png
set MANIFEST=app.manifest

echo [*] Compiling DiskSweepr-Web-Setup.exe with embedded AppIcon and Admin Manifest...
%CSC% /target:winexe /optimize /out:%OUT% /win32icon:%ICON% /win32manifest:%MANIFEST% /resource:%PNG%,AppIcon Program.cs

if %ERRORLEVEL% EQU 0 (
    echo [+] Successfully built %OUT%!
) else (
    echo [-] Build failed!
)
