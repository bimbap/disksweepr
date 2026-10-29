# DiskSweepr

> High-performance, safety-first desktop disk cleaning and storage optimization suite for Windows.

DiskSweepr helps you audit drive capacity, purge disposable system and browser caches, hunt down massive or duplicate files, clean dormant developer build artifacts, and recover deleted files — all wrapped in a fast, distraction-free dark interface.

---

## Downloads (v1.1.0)

| Package | Size | Description |
|---|---|---|
| [**DiskSweepr-Web-Setup.exe**](https://github.com/bimbap/disksweepr/releases/latest/download/DiskSweepr-Web-Setup.exe) | **~540 KB** | **Recommended**. Ultra-lightweight online bootstrap installer. Opens instantly (`0.01s`) and automatically downloads and installs the latest release. |
| [**DiskSweepr-Setup-1.1.0.exe**](https://github.com/bimbap/disksweepr/releases/latest/download/DiskSweepr-Setup-1.1.0.exe) | ~91.8 MB | **Offline Installer**. Full standalone setup wizard with custom directory selection, desktop/start menu shortcuts, and official Windows uninstaller. |
| [**DiskSweepr-Portable-1.1.0.exe**](https://github.com/bimbap/disksweepr/releases/latest/download/DiskSweepr-Portable-1.1.0.exe) | ~82.9 MB | **Portable**. Zero installation required. Runs directly from any folder or USB drive with cached runtime for fast launch. |

---

## Key Features

- **System Junk & Cache Cleaner**: Risk-rated cleanup across 14 categories including Windows Update cache, temporary directories, crash dumps, thumbnail databases, and web browser caches (Chrome, Edge, Brave, Firefox) with granular per-file selection.
- **Fast Search**: Instant file and folder search across individual partitions or your entire PC with size, category, and entity filters.
- **Large Files Hunter**: Deep scan for space-hogging files (`>100 MB` up to `>5 GB` or custom thresholds) with visual size bars, batch deletion, and Windows Explorer right-click integration (*"Scan with DiskSweepr"*).
- **Duplicate Files Hunter**: Multi-drive, hash-verified duplicate detection with one-click *"Keep Newest"* or *"Keep Oldest"* selection helpers and accidental deletion safeguards.
- **Developer Workspace Cleaner**: Scans project directories for dormant build artifacts and dependencies (`node_modules`, `.next`, `dist`, `build`, `target`, `.turbo`) with inactivity indicators.
- **System Power Tools**:
  - **WSL2 & Docker VHDX Shrinker**: Compacts bloated virtual disk images (`.vhdx`) to reclaim unused host storage.
  - **Empty Folders Sweeper**: Detects and prunes empty directory trees while protecting system and user root folders.
  - **DISM Component Store Analyzer**: Audits and cleans superseded Windows Update packages (`WinSxS`).
- **File Recovery & Undelete**:
  - **Recycle Bin Manager**: Inspect, filter, restore, or permanently purge items across all mounted drives with original path and deletion date tracking.
  - **Deep Recovery**: Scans drives for orphaned or unlinked file remnants across documents, images, media, and archives.
- **Audit History & Telemetry**: Tracks lifetime reclaimed storage and cleaned file counts with detailed session logs exportable to `.TXT` or `.JSON`.
- **Bilingual & Customizable**: Supports English (`EN`) and Bahasa Indonesia (`ID`), dark/light themes, Running Apps lock detection, and Windows Explorer context menu integration.

---

## System Requirements

- **OS**: Windows 10 or Windows 11 (64-bit)
- **Privileges**: Standard user (Administrator elevation recommended for Windows Update cache, DISM cleanup, and VHDX compaction)

---

## License

MIT License. Designed and built by **Ibrahim Muliatama**.
