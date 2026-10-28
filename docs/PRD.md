# Product Requirements Document (PRD)
## Project: Windows System Cleaner (Codename: Cleaner)

---

## 1. Executive Summary
**Cleaner** is a sleek, modern, and safety-first Windows disk utility designed to reclaim significant storage space by scanning and purging accumulated junk files, obsolete caches, crash dumps, and temporary installation data. 

Unlike bloated legacy utilities, Cleaner operates transparently: it provides instant visual feedback, granular risk-rated categorization, detailed file previews, and a zero-nonsense dark minimalist UI inspired by modern developer tools (Linear, Raycast).

---

## 2. Target Audience & Problem Statement
* **Primary User**: Windows power users, developers, and everyday users facing constrained system drive storage (e.g., C: drive running out of space).
* **Core Problem**: Windows and modern applications quietly accumulate gigabytes of disposable cache, package manager caches, update leftovers, and temporary files that standard Windows Disk Cleanup (`cleanmgr`) either overlooks or buries under outdated legacy interfaces.
* **Core Solution**: A fast, transparent, and aesthetically refined desktop application that safely audits disposable data, gives the user full control, and safely purges target items without risking OS stability.

---

## 3. Scope & Target Categories

### 3.1 Core Target Categories
| Category | Typical Location | Risk Rating | Default Action |
|---|---|---|---|
| **User Temporary Files** | `%TEMP%` (`C:\Users\<User>\AppData\Local\Temp`) | Safe | Selected |
| **Windows System Temp** | `C:\Windows\Temp` (requires elevation) | Safe | Selected |
| **Windows Update Download Cache** | `C:\Windows\SoftwareDistribution\Download` | Safe | Selected |
| **Crash Dumps & Error Reports** | `%LOCALAPPDATA%\CrashDumps`, `C:\ProgramData\Microsoft\Windows\WER` | Safe | Selected |
| **Thumbnail & Icon Cache** | `%LOCALAPPDATA%\Microsoft\Windows\Explorer\thumbcache_*.db` | Safe (rebuilt automatically) | Selected |
| **Recycle Bin** | `$Recycle.Bin` (all mounted drives) | Recommended | Selected |
| **Browser Caches** | Chrome, Edge, Brave, Firefox (`Cache`, `Code Cache`, `GPUCache`) | Safe (preserves cookies/logins) | Selected |
| **Developer & Tool Caches** | `.npm/_cacache`, `pip\cache`, VS Code `Cache`/`CachedData` | Safe (rebuildable) | Optional / Unselected |
| **App Caches** | Discord, Slack, Spotify cache directories | Safe (rebuildable) | Selected |
| **Windows Delivery Optimization** | Windows update P2P cache | Safe | Selected |

### 3.2 Multi-Drive Support (Secondary Partitions e.g. D:, M:, F:, G:)
When targeting non-system drives, Cleaner dynamically shifts its rule registry to drive-specific hygiene targets:
* **Recycle Bin**: Targeted emptying of the selected volume's `$Recycle.Bin`.
* **Abandoned Incomplete Downloads**: Detects incomplete or broken web browser and downloader temp files located at drive roots (`*.crdownload`, `*.part`, `*.download`, `*.temp`).
* **Temporary & Backup Residue**: Leftover installer dumps and backup files (`*.tmp`, `*.bak`, `*.old`).
* **Disk Check Lost Clusters**: Broken cluster fragments recovered by Windows chkdsk scans (`found.000`, `*.chk`).
* **Desktop & Folder Databases**: Windows thumbnail and folder view caches (`Thumbs.db`, `.db`).
* **Tool & Build Caches**: Android (`.android/cache`), Gradle (`.gradle/caches`), and developer workspaces hosted on the partition.

### 3.3 Explicit Non-Goals (v1)
* **No Registry Cleaning**: Registry keys take negligible disk space (<50KB) while carrying catastrophic risk of system corruption.
* **No System File Deletion**: Protected operating system binaries (`System32`, `WinSxS` hard links) are strictly out of bounds.
* **No Recursive Root Scanning**: To protect user personal folders (`SteamLibrary/`, `Videos/`, `Kuliah/`), secondary drive root scans strictly audit depth-1 files directly at the drive root and never traverse non-target personal subdirectories.
* **No Background Spying/Telemetry**: 100% local execution with zero analytics beacons.

---

## 4. Key Functional Features

1. **Multi-Drive Volume Selector**:
   * Dropdown selector in the sidebar displaying all mounted Windows volumes (`C:`, `D:`, `M:`, etc.) with their real-time free/total capacity.
   * Switching drives instantly recalibrates target categories and storage telemetry gauges.
2. **Non-Blocking Dual Scan Modes**:
   * **Quick Scan**: Rapid audit of top high-yield targets (`%TEMP%`, browser caches, recycle bin, update download cache).
   * **Full System Scan**: Comprehensive crawl including application caches, crash dumps, and developer artifacts.
   * **Custom Scan**: Granular toggle selection per directory and custom file extension filters.
3. **Granular Category Breakdown**:
   * Clear tree/card view grouped by domain (System, Browsers, Applications, Developer).
   * Live size counters formatted in human-readable units (MB, GB) and total file counts.
   * Safety badge indicator (`Safe`, `Recommended`, `Caution`).
4. **Inspectable Item Previews**:
   * Drill-down modal showing actual file paths, individual sizes, and last modified dates before committing to deletion.
   * "Open in Explorer" button to inspect file location natively.
5. **Resilient & Safe Purge Engine**:
   * Graceful skipping of locked files (`EBUSY`, `EPERM`) with clear post-clean summary.
   * Whitelist / exclusion rules for user-specified paths or file extensions.
   * Native Windows Recycle Bin emptying API integration (`Clear-RecycleBin -DriveLetter`).
   * Safe empty directory pruning that strictly preserves root drive boundaries.
6. **Real-Time Storage Telemetry**:
   * Visual gauge showing selected drive capacity, current used space, and projected free space post-cleanup.
   * Post-cleanup completion screen showing total space recovered and elapsed processing time.
7. **Modular Power Tools Navigation**:
   * Ultra-slim EaseUS CleanGenius inspired navigation rail (72px).
   * Module 1: System Junk & Cache Cleaner (Step-by-step setup hero -> live scan -> bento audit -> clean).
   * Module 2: Hefty Large Files Hunter (>100MB to >1GB thresholds).
   * Module 3: Dormant Dev Workspaces Cleaner (`node_modules`, `.next`, `dist`, `target`).
   * Module 4: Audit History Ledger & Log Export.
8. **Enterprise-Grade Installer & Uninstaller**:
   * NSIS Installer Wizard (`Cleaner Setup 1.0.0.exe`) with custom installation directory choice.
   * Registered Windows Uninstaller (`Uninstall Cleaner.exe`) accessible via Windows Settings -> Installed Apps.
   * Full AppData & temporary cache purge upon uninstallation (`deleteAppDataOnUninstall: true`).
   * Standalone Portable Binary (`Cleaner-Portable-1.0.0.exe`) with zero registry footprint.

---

## 5. Non-Functional Requirements
* **Startup Time**: App launch in under 1.5 seconds.
* **Scan Latency**: Quick scan completes within 3–8 seconds on standard NVMe SSDs.
* **Memory Footprint**: Strict memory ceiling < 120MB during peak scan.
* **Safety & Data Integrity**: Zero deletion of user personal files (`Documents`, `Desktop`, `Downloads`, `Pictures`). Strict boundary sanitization.
* **UX/Aesthetic**: EaseUS CleanGenius layout with Linear/Raycast dark minimalism. Lucide vector icons, tactile toggle switches, responsive bento grid.

---

## 6. Release Milestones & Artifacts
* **Portable Release**: `release/Cleaner-Portable-1.0.0.exe` (Single-file zero-install executable).
* **Setup Installer**: `release/Cleaner Setup 1.0.0.exe` (NSIS Wizard with registered uninstaller and AppData cleaner).
* **Unpacked Build**: `release/win-unpacked/Cleaner.exe` for instant local execution and testing.
