# Product Requirements Document (PRD)
## Project: DiskSweepr (Official Name: DiskSweepr, Codename: Cleaner)

---

## 1. Executive Summary
**DiskSweepr** is a sleek, modern, and safety-first Windows disk utility designed to reclaim significant storage space by scanning and purging accumulated junk files, obsolete caches, crash dumps, and temporary installation data. 

Unlike bloated legacy utilities, DiskSweepr operates transparently: it provides instant visual feedback, granular risk-rated categorization, per-file exclusion controls, detailed file previews, and a zero-nonsense dark minimalist UI inspired by modern developer tools (Linear, Raycast).

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
4. **Inspectable Item Previews & Per-File Selection**:
   * Expandable category drawer showing actual file paths, individual sizes, and pagination (`20` items/page) without nested scrollbars.
   * Per-file checkboxes allowing users to include or exclude specific files inside any category before committing to deletion.
   * "Reveal in Explorer" button to inspect file location natively.
5. **Resilient & Safe Purge Engine**:
   * Graceful skipping of locked files (`EBUSY`, `EPERM`) and user-excluded files (`excludedFilePaths`) with clear post-clean summary.
   * Whitelist / exclusion rules for user-specified paths or file extensions.
   * Native Windows Recycle Bin emptying API integration (`Clear-RecycleBin -DriveLetter`).
   * Safe empty directory pruning that strictly preserves root drive boundaries.
6. **Real-Time Storage Telemetry**:
   * Visual gauge showing selected drive capacity, current used space, and projected free space post-cleanup.
   * Post-cleanup completion screen showing total space recovered and elapsed processing time.
7. **Modular Suite Navigation & 8 Core Modules**:
   * Ultra-slim EaseUS CleanGenius inspired navigation rail (72px) with obsidian frosted styling and dynamic window titles (`DiskSweepr - <Feature Name>`).
   * **Module 1: System Junk & Cache Cleaner**: Step-by-step setup hero -> live scan -> expandable audit tree with per-item checkboxes & pagination -> clean confirmation.
   * **Module 2: Hefty Large Files Hunter**: Deep scan detecting files exceeding thresholds (`>100MB`, `>300MB`, `>500MB`, `>1GB`) with scale meters, batch delete, and Windows Explorer right-click integration (`Scan with DiskSweepr`).
   * **Module 3: Fast Search**: Blazing-fast whole-drive directory crawler with entity filters (`all`, `files`, `folders`) and instant name matching.
   * **Module 4: Duplicate Hunter**: Multi-drive hash-verified file comparison with quick action retention ("Keep Oldest", "Keep Newest").
   * **Module 5: Dormant Dev Workspaces Cleaner**: Audits local git projects for dormant build artifacts (`node_modules`, `.next`, `dist`, `target`).
   * **Module 6: Power Tools**: Prunes truly empty directory trees, compacts WSL2/Docker `.vhdx` virtual disks, and runs DISM Windows Component Store cleanup.
   * **Module 7: Audit History Ledger**: Lifetime space reclaimed statistics, file purge tallies, category filter pills, and JSON/TXT log export.
   * **Module 8: File Recovery & Undelete**:
     * *Tab 1: Windows Recycle Bin Manager*: Native COM `Shell.Application` integration displaying deleted items, original paths, and deletion timestamps, with single/batch restoration and permanent purge.
     * *Tab 2: Deep Recovery Engine*: Audits unlinked/orphaned file remnants on target partitions across categories (`images`, `documents`, `media`, `archives`) with sortable Last Modified timestamps and destination folder extraction.
8. **Enterprise-Grade Installer, Portable & Web Bootstrap**:
   * Web Bootstrap Installer (`DiskSweepr-Web-Setup.exe`) with instant launch (`0.01s`), Raycast dark UI, and automated download/silent install from GitHub Releases.
   * NSIS Installer Wizard (`DiskSweepr-Setup-1.1.0.exe`) with custom installation directory choice and official Windows Uninstaller.
   * Standalone Portable Binary (`DiskSweepr-Portable-1.1.0.exe`) with persistent runtime cache (`unpackDirName: "DiskSweepr-Runtime"`) and route-level code-splitting for instant warm startup.

---

## 5. Non-Functional Requirements
* **Startup Time**: App launch in under 1.5 seconds (and <0.5s warm launch on Portable).
* **Scan Latency**: Quick scan completes within 3–8 seconds on standard NVMe SSDs.
* **Memory Footprint**: Strict memory ceiling < 120MB during peak scan.
* **Safety & Data Integrity**: Zero automatic deletion of user personal folders (`Documents`, `Desktop`, `Downloads`, `Pictures`). Strict boundary sanitization.
* **UX/Aesthetic**: EaseUS CleanGenius layout with Linear/Raycast dark minimalism, English default language (`EN` / `ID` toggle), Lucide vector icons, and responsive tables.

---

## 6. Release Milestones & Artifacts
* **Web Bootstrap Release**: `release/DiskSweepr-Web-Setup.exe` (~540 KB online installer).
* **Setup Installer**: `release/DiskSweepr-Setup-1.1.0.exe` (~91.8 MB NSIS Wizard with registered uninstaller).
* **Portable Release**: `release/DiskSweepr-Portable-1.1.0.exe` (~82.9 MB single-file zero-install executable).
