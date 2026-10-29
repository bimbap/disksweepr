!ifndef BUILD_UNINSTALLER
  Var /GLOBAL OptDesktopShortcut
  Var /GLOBAL OptStartMenuShortcut
  Var /GLOBAL OptContextMenu
  Var /GLOBAL ChkDesktopCtrl
  Var /GLOBAL ChkStartMenuCtrl
  Var /GLOBAL ChkContextMenuCtrl

  !macro customInit
    StrCpy $OptDesktopShortcut "1"
    StrCpy $OptStartMenuShortcut "1"
    StrCpy $OptContextMenu "1"
  !macroend

  !macro customPageAfterChangeDir
    Page custom ShortcutOptionsPageCreate ShortcutOptionsPageLeave

    Function ShortcutOptionsPageCreate
      ${if} ${isUpdated}
        Abort
      ${endif}
      !insertmacro MUI_HEADER_TEXT "Additional Tasks & Shortcuts" "Select the shortcuts and Windows Explorer integrations to configure for DiskSweepr."
      nsDialogs::Create 1018
      Pop $0
      ${If} $0 == error
        Abort
      ${EndIf}

      ${NSD_CreateLabel} 0u 0u 300u 16u "Select the additional tasks you would like Setup to perform while installing DiskSweepr, then click Install:"
      Pop $0

      ${NSD_CreateCheckBox} 12u 26u 280u 14u "Create a &Desktop shortcut"
      Pop $ChkDesktopCtrl
      ${If} $OptDesktopShortcut == "1"
        ${NSD_Check} $ChkDesktopCtrl
      ${EndIf}

      ${NSD_CreateCheckBox} 12u 46u 280u 14u "Create a &Start Menu shortcut"
      Pop $ChkStartMenuCtrl
      ${If} $OptStartMenuShortcut == "1"
        ${NSD_Check} $ChkStartMenuCtrl
      ${EndIf}

      ${NSD_CreateCheckBox} 12u 66u 280u 14u 'Add "Scan with DiskSweepr" to Windows &Explorer right-click menu'
      Pop $ChkContextMenuCtrl
      ${If} $OptContextMenu == "1"
        ${NSD_Check} $ChkContextMenuCtrl
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
  ${If} $OptDesktopShortcut == "0"
    Delete "$newDesktopLink"
  ${EndIf}

  ${If} $OptStartMenuShortcut == "0"
    Delete "$newStartMenuLink"
  ${EndIf}

  ${If} $OptContextMenu == "1"
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
!macroend

!macro customUnInstall
  ; Remove "Scan with DiskSweepr" from Windows Explorer context menu on uninstall
  DeleteRegKey HKCU "Software\Classes\Directory\shell\DiskSweepr"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\DiskSweepr"
  DeleteRegKey HKCU "Software\Classes\Drive\shell\DiskSweepr"
!macroend
