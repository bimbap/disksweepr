!macro customInstall
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
!macroend

!macro customUnInstall
  ; Remove "Scan with DiskSweepr" from Windows Explorer context menu on uninstall
  DeleteRegKey HKCU "Software\Classes\Directory\shell\DiskSweepr"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\DiskSweepr"
  DeleteRegKey HKCU "Software\Classes\Drive\shell\DiskSweepr"
!macroend

