!include "getProcessInfo.nsh"
Var /GLOBAL pid

!macro customHeader
  !ifndef BUILD_UNINSTALLER
    ShowInstDetails show
  !else
    ShowUninstDetails show
  !endif
!macroend

!macro customCheckAppRunning
  SetDetailsPrint both
  DetailPrint "Checking if DiskSweepr is currently running..."
  !insertmacro IS_POWERSHELL_AVAILABLE
  !insertmacro _CHECK_APP_RUNNING
  !ifndef BUILD_UNINSTALLER
    DetailPrint "Preparing destination directory: $INSTDIR"
    DetailPrint "Extracting DiskSweepr v${VERSION} package and installing files (please wait)..."
  !else
    DetailPrint "Removing installed DiskSweepr files..."
  !endif
!macroend

!ifndef BUILD_UNINSTALLER
  Var /GLOBAL OptDesktopShortcut
  Var /GLOBAL OptStartMenuShortcut
  Var /GLOBAL OptContextMenu
  Var /GLOBAL ChkDesktopCtrl
  Var /GLOBAL ChkStartMenuCtrl
  Var /GLOBAL ChkContextMenuCtrl
  Var /GLOBAL IsUpdateDetected
  Var /GLOBAL DetectedInstallDir
  Var /GLOBAL DetectedOldVersion

  !macro RENDER_TASK_CHECKBOXES Y1 Y2 Y3
    ${NSD_CreateCheckBox} 12u ${Y1} 280u 14u "Create a &Desktop shortcut"
    Pop $ChkDesktopCtrl
    ${If} $OptDesktopShortcut == "1"
      ${NSD_Check} $ChkDesktopCtrl
    ${EndIf}

    ${NSD_CreateCheckBox} 12u ${Y2} 280u 14u "Create a &Start Menu shortcut"
    Pop $ChkStartMenuCtrl
    ${If} $OptStartMenuShortcut == "1"
      ${NSD_Check} $ChkStartMenuCtrl
    ${EndIf}

    ${NSD_CreateCheckBox} 12u ${Y3} 280u 14u 'Add "Scan with DiskSweepr" to Windows &Explorer right-click menu'
    Pop $ChkContextMenuCtrl
    ${If} $OptContextMenu == "1"
      ${NSD_Check} $ChkContextMenuCtrl
    ${EndIf}
  !macroend

  !macro customInit
    StrCpy $OptDesktopShortcut "1"
    StrCpy $OptStartMenuShortcut "1"
    StrCpy $OptContextMenu "1"
    StrCpy $IsUpdateDetected "0"
    StrCpy $DetectedInstallDir ""
    StrCpy $DetectedOldVersion ""

    ; Silently detect an existing installation (INSTALL_REGISTRY_KEY first,
    ; UNINSTALL_REGISTRY_KEY fallback) so the wizard window presents upgrade
    ; details cleanly without an abrupt pre-window MessageBox popup.
    ReadRegStr $0 HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
    ${if} $0 != ""
      ReadRegStr $DetectedOldVersion HKCU "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
    ${else}
      ReadRegStr $0 HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation"
      ${if} $0 != ""
        ReadRegStr $DetectedOldVersion HKLM "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
      ${endif}
    ${endif}

    ${if} $0 == ""
      ReadRegStr $0 HKCU "${UNINSTALL_REGISTRY_KEY}" "InstallLocation"
      ${if} $0 != ""
        ReadRegStr $DetectedOldVersion HKCU "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
      ${else}
        ReadRegStr $0 HKLM "${UNINSTALL_REGISTRY_KEY}" "InstallLocation"
        ${if} $0 != ""
          ReadRegStr $DetectedOldVersion HKLM "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
        ${endif}
      ${endif}
    ${endif}

    ${if} $0 != ""
      ${if} ${FileExists} "$0\DiskSweepr.exe"
        StrCpy $IsUpdateDetected "1"
        StrCpy $DetectedInstallDir $0
        StrCpy $INSTDIR $0
      ${endif}
    ${endif}
  !macroend

  !macro customPageAfterChangeDir
    Page custom ShortcutOptionsPageCreate ShortcutOptionsPageLeave

    Function ShortcutOptionsPageCreate
      ${If} ${FileExists} "$INSTDIR\DiskSweepr.exe"
        !insertmacro MUI_HEADER_TEXT "Update Existing DiskSweepr Installation" "Setup detected an existing installation and will upgrade it to v${VERSION}."
      ${Else}
        !insertmacro MUI_HEADER_TEXT "Additional Tasks & Shortcuts" "Select the shortcuts and Windows Explorer integrations to configure for DiskSweepr."
      ${EndIf}

      nsDialogs::Create 1018
      Pop $0
      ${If} $0 == error
        Abort
      ${EndIf}

      ${If} ${FileExists} "$INSTDIR\DiskSweepr.exe"
        ${NSD_CreateLabel} 0u 0u 300u 20u "Existing installation folder: $INSTDIR"
        Pop $0

        ${If} $DetectedOldVersion != ""
        ${AndIf} $INSTDIR == $DetectedInstallDir
          ${NSD_CreateLabel} 0u 22u 300u 12u "Upgrade path: v$DetectedOldVersion -> v${VERSION} (settings and history preserved)"
        ${Else}
          ${NSD_CreateLabel} 0u 22u 300u 12u "Target version: v${VERSION} (existing settings and history preserved)"
        ${EndIf}
        Pop $0

        ${NSD_CreateLabel} 0u 40u 300u 12u "Confirm shortcuts and Windows Explorer options, then click Install to update:"
        Pop $0

        !insertmacro RENDER_TASK_CHECKBOXES 56u 74u 92u
      ${Else}
        ${NSD_CreateLabel} 0u 0u 300u 18u "Select the additional tasks you would like Setup to perform while installing DiskSweepr, then click Install:"
        Pop $0

        !insertmacro RENDER_TASK_CHECKBOXES 26u 46u 66u
      ${EndIf}

      nsDialogs::Show
    FunctionEnd

    Function ShortcutOptionsPageLeave
      ${NSD_GetState} $ChkDesktopCtrl $R0
      ${If} $R0 == ${BST_CHECKED}
        StrCpy $OptDesktopShortcut "1"
      ${Else}
        StrCpy $OptDesktopShortcut "0"
      ${EndIf}

      ${NSD_GetState} $ChkStartMenuCtrl $R0
      ${If} $R0 == ${BST_CHECKED}
        StrCpy $OptStartMenuShortcut "1"
      ${Else}
        StrCpy $OptStartMenuShortcut "0"
      ${EndIf}

      ${NSD_GetState} $ChkContextMenuCtrl $R0
      ${If} $R0 == ${BST_CHECKED}
        StrCpy $OptContextMenu "1"
      ${Else}
        StrCpy $OptContextMenu "0"
      ${EndIf}
    FunctionEnd
  !macroend
!endif

!macro customInstall
  SetDetailsPrint both
  DetailPrint "Applying shortcut preferences and Windows integrations..."

  ${If} $OptDesktopShortcut == "0"
    Delete "$newDesktopLink"
    DetailPrint "Skipped Desktop shortcut per user preference."
  ${Else}
    DetailPrint "Configured Desktop shortcut."
  ${EndIf}

  ${If} $OptStartMenuShortcut == "0"
    Delete "$newStartMenuLink"
    DetailPrint "Skipped Start Menu shortcut per user preference."
  ${Else}
    DetailPrint "Configured Start Menu shortcut."
  ${EndIf}

  ${If} $OptContextMenu == "1"
    DetailPrint 'Registering "Scan with DiskSweepr" in Windows Explorer context menu...'
    ; Register "Scan with DiskSweepr" in Windows Explorer context menu for Folders, Folder Backgrounds, and Drives
    WriteRegStr HKCU "Software\Classes\Directory\shell\DiskSweepr" "" "Scan with DiskSweepr"
    WriteRegStr HKCU "Software\Classes\Directory\shell\DiskSweepr" "Icon" "$INSTDIR\DiskSweepr.exe"
    WriteRegStr HKCU "Software\Classes\Directory\shell\DiskSweepr\command" "" '"$INSTDIR\DiskSweepr.exe" "%V"'

    WriteRegStr HKCU "Software\Classes\Directory\Background\shell\DiskSweepr" "" "Scan with DiskSweepr"
    WriteRegStr HKCU "Software\Classes\Directory\Background\shell\DiskSweepr" "Icon" "$INSTDIR\DiskSweepr.exe"
    WriteRegStr HKCU "Software\Classes\Directory\Background\shell\DiskSweepr\command" "" '"$INSTDIR\DiskSweepr.exe" "%V"'

    WriteRegStr HKCU "Software\Classes\Drive\shell\DiskSweepr" "" "Scan with DiskSweepr"
    WriteRegStr HKCU "Software\Classes\Drive\shell\DiskSweepr" "Icon" "$INSTDIR\DiskSweepr.exe"
    WriteRegStr HKCU "Software\Classes\Drive\shell\DiskSweepr\command" "" '"$INSTDIR\DiskSweepr.exe" "%V"'
  ${Else}
    DeleteRegKey HKCU "Software\Classes\Directory\shell\DiskSweepr"
    DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\DiskSweepr"
    DeleteRegKey HKCU "Software\Classes\Drive\shell\DiskSweepr"
  ${EndIf}

  DetailPrint "DiskSweepr v${VERSION} installation complete!"
!macroend

!macro customUnInstall
  SetDetailsPrint both
  DetailPrint "Removing Windows Explorer context menu entries..."
  ; Remove "Scan with DiskSweepr" from Windows Explorer context menu on uninstall
  DeleteRegKey HKCU "Software\Classes\Directory\shell\DiskSweepr"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\DiskSweepr"
  DeleteRegKey HKCU "Software\Classes\Drive\shell\DiskSweepr"
  DetailPrint "DiskSweepr uninstall cleanup complete."
!macroend
