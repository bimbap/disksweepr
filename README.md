# DiskSweepr

> High-performance, safety-first desktop disk cleaning utility for Windows.

DiskSweepr is a modern, lightweight system storage optimizer built with Electron, React 19, TypeScript, and Vite. Designed with an obsidian Linear/Raycast-inspired interface, it helps you audit drive capacity, identify junk files across partitions, hunt gigantic dormant files, and reclaim gigabytes of storage safely.

---

## Downloads

| Package | Size | Description |
|---|---|---|
| [**DiskSweepr-Web-Setup.exe**](https://github.com/bimbap/disksweepr/releases/latest/download/DiskSweepr-Web-Setup.exe) | **~717 KB** | **Recommended**. Ultra-lightweight bootstrap installer. Launches in 0.01s, features a modern Raycast dark UI, and downloads the latest release automatically. |
| [**DiskSweepr-Setup-1.0.0.exe**](https://github.com/bimbap/disksweepr/releases/latest/download/DiskSweepr-Setup-1.0.0.exe) | ~91.7 MB | **Offline Installer**. Full standalone setup wizard with custom directory selector, start menu/desktop shortcuts, and official Windows uninstaller. |
| [**DiskSweepr-Portable-1.0.0.exe**](https://github.com/bimbap/disksweepr/releases/latest/download/DiskSweepr-Portable-1.0.0.exe) | ~83.0 MB | **Portable**. Zero installation required. Runs directly from any folder or USB drive. |

---

## Key Features

- **System Junk Cleaner**: Granular risk-rated purging across 14 categories including Windows Update cache, temp directories, delivery optimization remnants, crash dumps, and browser caches (Chrome, Edge, Brave).
- **Multi-Drive Telemetry**: Dynamic drive partition selector (C:, D:, M:) with live capacity meters and partition-aware rules.
- **Large Files Hunter**: Deep drive scan detecting space hogs exceeding 100MB, 300MB, 500MB, or 1GB with interactive size gauges and one-click "Reveal in Explorer".
- **Developer Workspace Cleaner**: Scans local Git workspaces for dormant `node_modules`, `.next`, `dist`, and `build` folders untouched for over 30 days.
- **Running Apps Guard**: Non-intrusive process inspection detecting open browsers or tools (Chrome, Discord, VS Code) to prevent file-lock conflicts, with options to purge safely or close targets.
- **Persistent Audit Ledger**: Local history tracker logging lifetime reclaimed disk space, purge timestamps, and exportable JSON/TXT reports.
- **Windows Integration**: Native Windows uninstaller registered in Windows Settings, Windows 11 rounded corners, and single-instance process locking.

---

## Architecture & Tech Stack

- **Runtime**: Electron 34 + Node.js 22
- **Frontend**: React 19, TypeScript 5.7, Vite 6, Tailwind-inspired CSS
- **Icons**: Lucide React
- **Installer Tooling**: NSIS Modern UI 2 + Native C# Bootstrap Launcher (.NET 4.0/4.8 compatible)

---

## Development

```bash
# Clone the repository
git clone https://github.com/bimbap/disksweepr.git
cd disksweepr

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run unit tests
npm test

# Build production binaries
npm run build
npm run dist
```

---

## License

MIT License. Designed and built by **Ibrahim Muliatama**.

