# DiskSweepr

> High-performance, safety-first desktop disk cleaning and storage optimization suite for Windows.

DiskSweepr audits drive capacity, dynamically discovers disposable multi-app and system caches, purges installer and driver extract leftovers, hunts space-hogging or duplicate files, cleans dormant developer workspaces, and recovers deleted files — wrapped in a fluid, distraction-free obsidian interface.

---

## Downloads (v1.2.0)

| Package | Size | Description |
|---|---|---|
| [**DiskSweepr-Setup-1.2.0.exe**](https://github.com/bimbap/disksweepr/releases/latest/download/DiskSweepr-Setup-1.2.0.exe) | **~92 MB** | **Recommended**. Full offline Windows installer with modern wizard, Start Menu & Desktop shortcuts, and official Windows uninstaller. |
| [**DiskSweepr-Portable-1.2.0.exe**](https://github.com/bimbap/disksweepr/releases/latest/download/DiskSweepr-Portable-1.2.0.exe) | **~83 MB** | **Standalone Portable**. Zero installation required. Runs directly from USB flash drives or any directory with persistent cached runtime. |
| [**DiskSweepr-Web-Setup-1.2.0.exe**](https://github.com/bimbap/disksweepr/releases/latest/download/DiskSweepr-Web-Setup-1.2.0.exe) | **~1.1 MB** | **Web Bootstrap Setup**. Ultra-lightweight installer that automatically fetches and verifies runtime payload packages during setup. |

> [!NOTE]
> For users downloading the Web Bootstrap setup, ensure the companion archive [`disksweepr-1.2.0-x64.nsis.7z`](https://github.com/bimbap/disksweepr/releases/latest/download/disksweepr-1.2.0-x64.nsis.7z) remains accessible via release assets.

---

## Key Features

### 🧹 System Junk & Universal Cache Hunter
- **Universal Multi-App & UWP Discovery**: Dynamic discovery engine auditing over **500+ UWP package caches** (`%LOCALAPPDATA%\Packages\*\LocalCache`, `AC\INetCache`, `AC\Temp`) and desktop applications across `%APPDATA%` and `%LOCALAPPDATA%` (Discord, Slack, Spotify, Telegram, Chromium, Electron, VS Code, and JetBrains IDEs).
- **Comprehensive Temp Resolution**: Complete coverage of `%TEMP%`, `%LOCALAPPDATA%\Temp`, and `%USERPROFILE%\AppData\LocalLow\Temp` with non-skipping directory traversal and zero-duplicate path accounting.
- **Installer Staging Residue Purge**: Safely audits and purges dormant installer caches (`SquirrelTemp`, NuGet, pip, npm).
- **Hardware Driver & OS Upgrade Cleaners**: Cleans extracted setup directories from NVIDIA, AMD, and Intel display drivers, alongside residual Windows upgrade staging folders (`$GetCurrent`, `Windows.old\~bt`).
- **Core Windows Caches**: Risk-rated cleanup covering Windows Update downloads (`SoftwareDistribution`), thumbnail caches, error memory dumps, and browser caches (Chrome, Edge, Brave, Firefox) with granular per-file selection.

### ⚡ Storage Optimization & Power Tools
- **Fast Search**: Instant file and directory search across individual partitions or mounted storage volumes with category, extension, and entity filters.
- **Large Files Hunter**: Deep scan for storage-hogging files (`>100 MB` up to `>5 GB` or custom thresholds) with visual capacity meters, batch purge, and Windows Explorer right-click integration (*"Scan with DiskSweepr"*).
- **Duplicate Files Hunter**: Multi-drive, hash-verified duplicate detection with one-click *"Keep Newest"* or *"Keep Oldest"* smart selection and accidental deletion safeguards.
- **Developer Workspace Cleaner**: Scans local workspaces for dormant build artifacts and dependency folders (`node_modules`, `.next`, `dist`, `build`, `target`, `.venv`, `.terraform`) with inactivity indicators.
- **WSL2 & Docker VHDX Shrinker**: Compacts bloated virtual disk images (`.vhdx`) to reclaim gigabytes of unused host storage.
- **Empty Folders Sweeper**: Identifies and prunes empty directory hierarchies without touching root volumes.
- **DISM Component Store Analyzer**: Audits and reclaims superseded Windows Update component packages (`WinSxS`).

### 🛡️ File Recovery & Forensic Undelete
- **Recycle Bin Manager**: Inspect, filter, restore, or permanently purge items across all drives with original path tracking and deletion timestamps.
- **Deep Recovery (NTFS $MFT Forensic Engine)**: High-speed forensic inspection scanning up to 1,000,000 NTFS `$MFT` records to recover deleted file remnants across documents, images, archives, and media without risking in-place disk overwrite.

### ⚙️ System Tray & Background Automation
- **Notification Tray & Ghost-Free Lifecycle**: Minimizes cleanly to the Windows taskbar tray with quick status toggles, single-instance enforcement, and instant update checks.
- **Periodic Hygiene Reminders**: Optional scheduled reminders (3, 7, 14, or 30 days) alerting users when disposable system storage exceeds healthy thresholds.

---

## Safety & Protection Architecture

DiskSweepr is engineered with a strict **Safety-First** principle to guarantee that critical operating system files, user documents, and system stability are never compromised:

- **Unified OS Shield (`isProtectedSystemPath`)**: Enforces non-negotiable deletion blocks against volume roots (`C:\`, `D:\`), essential Windows directories (`System32`, `SysWOW64`, `WinSxS`), user profile roots, and registry hives (`NTUSER.DAT*`, `UsrClass.dat`, `bootmgr`, `pagefile.sys`).
- **Process Guard (`PROTECTED_SYSTEM_PROCESSES`)**: Prevents forced termination of critical operating system subsystems (such as `explorer.exe`, `svchost.exe`, `csrss.exe`, and `winlogon.exe`).
- **Diskpart Injection Sanitizer**: Rigorous path sanitization (`!/[\r\n"\0]/`) and `.vhdx` extension validation before passing any virtual disk commands to Windows disk utilities.
- **Non-Destructive Recycling**: Risky categories (such as stale user downloads) default to Windows Recycle Bin recycling (`useTrash: true`) rather than permanent unlinking.

---

## System Requirements

- **Operating System**: Windows 10 or Windows 11 (64-bit)
- **Privileges**: Standard user permissions (Administrator elevation recommended for Windows Update caches, DISM cleanup, and VHDX compaction)
- **Architecture**: x64

---

## Building from Source

To compile DiskSweepr locally:

```bash
# Clone the repository
git clone https://github.com/bimbap/disksweepr.git
cd disksweepr

# Install dependencies
npm install

# Run automated tests (47 unit and security test suites)
npm test

# Start local development server
npm run dev

# Package production distributions (NSIS offline, Web setup, Portable)
npm run dist:all
```

---

## License

MIT License. Designed and crafted by **Ibrahim Muliatama**.
