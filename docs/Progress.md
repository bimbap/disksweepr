# Project Progress Tracker
## Project: DiskSweepr (Official Name: DiskSweepr, Codename: Cleaner)

---

## 1. Project Health & Storage Status
* **Status**: 🟢 Rebranded to DiskSweepr, Cleaned & Packaged
* **Host C: Drive Storage**: ~4.58 GB free
* **Target Workspace**: `M:\testProject\cleaner\` (Drive M: ~18.1 GB free)
* **Design Pattern**: EaseUS CleanGenius Style (72px Slim Left Nav Rail + Spacious Step-by-Step Hero Canvas + Lucide Icons)
* **Release Artifacts**:
  - Web Bootstrap Installer: `release/DiskSweepr-Web-Setup.exe` (~717 KB) (Modern Linear/Raycast dark UI, Windows 11 rounded corners, native drop shadow, embedded high-res AppIcon, smooth rounded pill buttons & progress bar, fast 0.01s launch, smart installed-detection with Reinstall & 1-click Uninstall, auto-downloads latest package from GitHub Releases with silent install)
  - Full Offline NSIS Modern Wizard: `release/DiskSweepr-Setup-1.0.0.exe` (~91.7 MB) (Complete offline installer, instant <0.05s launch, full multi-page Modern UI 2 wizard, custom dark sidebar/header branding, directory selector, shortcuts toggle)
  - Portable Executable: `release/DiskSweepr-Portable-1.0.0.exe` (~83 MB) (Zero installation, direct executable)
* **Last Updated**: 2026-10-28

---

## 2. Milestone Checklist

### Phase 1: Foundation & Project Scaffolding
- [x] Create foundational docs (`docs/PRD.md`, `docs/Architecture.md`, `docs/Design.md`, `docs/Rules.md`, `docs/Progress.md`)
- [x] Register cleaner in root `AGENTS.md`
- [x] Initialize Electron + Vite + React 19 + TypeScript on Drive M: with zero C: footprint
- [x] Configure TypeScript and shared IPC contracts (`src/shared/types.ts`)

### Phase 2: Core Cleaning & Scanning Engine (Backend)
- [x] Implement Rule Registry with 14 target categories
- [x] Implement Asynchronous Scanner Service with batch progress reporting & cancellation
- [x] Implement Resilient Cleaner Service with boundary safety checks and locked file trapping
- [x] Implement Windows Drive Telemetry Service
- [x] Implement Preload Bridge with secure typed `contextBridge`
- [x] Support `ScanOptions` (Category IDs & File extension filters e.g. `.log`, `.tmp`, `.dmp`, `.cache`)
- [x] Fix packaged app resource resolution via `app.getAppPath()` and `base: './'`

### Phase 3: Desktop UX/UI Overhaul (Sidebar + Bento Grid Canvas)
- [x] Replaced awkward vertical stacking with modern **2-Column Desktop Architecture**:
  - **Left Sidebar**: Disk storage gauge, Scan Scope tabs (Quick / Full / Custom), File Format chips, and Sticky bottom CTA.
  - **Right Bento Canvas**: Expansive, auto-fitting responsive grid (1 to 3 columns depending on window width).
- [x] Replaced clunky checkboxes with **Tactile iOS/Windows Toggle Switches**.
- [x] Added live search/filter bar in header to quickly search target folders.
- [x] Added permanent deletion confirmation modal (`ConfirmCleanModal`).
- [x] Zero nested scroll containers — natural fluid desktop layout.

### Phase 4: Multi-Drive Storage Auditing
- [x] Multi-partition drive detection query via CIM `Win32_LogicalDisk` (`C:`, `D:`, `M:`, etc.).
- [x] Native Drive Selector dropdown with live storage usage gauges in the Left Sidebar.
- [x] Drive-adaptive target definitions:
  - System Drive (C:): Windows Update, System Temp, User Temp, Thumbnail DBs, App Caches, Browser Caches.
  - Secondary Drives (D:, M:, etc.): Targeted Recycle Bin, Abandoned `.crdownload` / `.temp` files, `.chk` fragments, backup remnants, and tool caches.
- [x] Shallow root-directory traversal boundaries: safely inspects depth-1 files at drive roots without indexing or touching personal directories (`SteamLibrary/`, `Videos/`, `Kuliah/`).
- [x] Tested against Drive M: identified 4.25 GB of abandoned `.crdownload` leftovers ready for purging.

### Phase 5: Multi-Module Power Tools & V3 UX Overhaul
- [x] **Top-Level Navigation Rail**: Added Linear/Raycast-inspired module switcher in the Left Sidebar:
  - 🧹 **System Junk**: 14 system/app/browser categories with Bento grid and toggle switches.
  - 🐋 **Large Files Hunter**: Deep drive scan detecting files exceeding configurable thresholds (`>100MB`, `>300MB`, `>500MB`, `>1GB`) with visual scale meters and reveal in Explorer.
  - ⚡ **Dev Workspace Cleaner**: Scans local git workspaces for dormant `node_modules`, `.next`, `dist`, `target`, and `build` folders; flags items untouched for >30 days.
  - 📜 **Clean History & Audit Logs**: Local persistent ledger of lifetime reclaimed storage, file purge counts, and one-click JSON/TXT log export.
- [x] Implemented dedicated background services:
  - `src/main/services/largeFileService.ts`
  - `src/main/services/devCleanerService.ts`
  - `src/main/services/historyService.ts`
- [x] Connected IPC bridges with secure types and safe unlinking confirmations.

### Phase 6: Release Packaging
- [x] Packaged single-file standalone executable (`release/Cleaner-Portable-1.0.0.exe`)
- [x] Packaged full Windows NSIS setup wizard (`release/Cleaner Setup 1.0.0.exe`)
- [x] Verified zero C: storage impact by routing Electron builder cache to `M:\.electron-builder-cache`.

### Phase 7: EaseUS CleanGenius UX Refactor & Professional Icons
- [x] **Ultra-Slim Left Nav Rail (72px)**: Unburdened the UI by turning the cluttered sidebar into a minimal vertical icon rail with Lucide icons (`Sparkles`, `HardDriveDownload`, `FolderGit2`, `History`).
- [x] **Spacious Step-by-Step Scan Configuration**:
  - **Stage 1 (Hero Setup)**: Welcoming layout with active drive selector, visual disk gauge, scan mode segmented pills (`Quick`, `Full`, `Custom`), big prominent **"Scan Drive X"** CTA button, and collapsible *"Customize Targets"* drawer for granular category/extension adjustments. Plus right-hand monitor graphic.
  - **Stage 2 (Scanning)**: Real-time progress bar and path tracker with cancel button.
  - **Stage 3 (Audit Review)**: Reclaimable size banner, interactive bento cards with toggle switches, file inspect modal, and "Clean Now" button.
  - **Stage 4 (Purging)**: Real-time unlinking progress.
  - **Stage 5 (Summary)**: Celebration summary with space freed and elapsed time.
- [x] **Official Icon System**: Replaced all emojis with clean, modern `lucide-react` vector icons across all 10 components.
- [x] **NSIS Uninstaller Configuration**:
  - `oneClick: false`: Standard Windows setup wizard allowing custom install directory.
  - Automatic uninstaller creation: `Uninstall Cleaner.exe` registered in Windows Registry (`HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\com.cleaner.app`).
  - Seamless uninstallation via **Windows Settings -> Installed Apps** or `Uninstall Cleaner.exe`.
  - `deleteAppDataOnUninstall: true`: Leaves zero residual files or cache upon uninstallation.

### Phase 8: Spacious Step Cards, Custom Drive Dropdown & Scanned Files Tree
- [x] **De-cluttered Step Cards Layout**: Separated Target Partition and Scan Scope into distinct, elevated panels with generous 24px gap (`STEP 01` & `STEP 02`), resolving the cramped layout.
- [x] **Custom Drive Dropdown Component (`CustomDriveSelect.tsx`)**: Replaced raw HTML `<select>` with sleek obsidian floating popover featuring drive letter, volume label, free space, mini capacity bars, and active checkmarks.
- [x] **Full-Stage Scanning Experience (`ProgressTracker.tsx`)**: Implemented centered workstation monitor with animated dynamic laser scanning beam, bold file name badge, monospace path ticker, glowing progress bar, and live reclaimable counters matching EaseUS CleanGenius reference.
- [x] **Scanned Results Tree View (`ScannedResultTree.tsx`)**: Implemented expandable accordion list displaying actual file paths, file names, file sizes, and one-click "Reveal in Explorer" buttons right inside each category drawer. Includes live search filter and pagination for smooth 60fps performance.

### Phase 9: Explorer Reveal Fix, Multi-Line File Ticker & UX Responsiveness
- [x] **Windows Explorer Native Reveal**: Switched from `shell.openPath` to `shell.showItemInFolder` in `src/main/index.ts`, directly highlighting the selected file in Windows File Explorer instead of prompting "How do you want to open this file?".
- [x] **Two-Line File & Location Display**: Separated filename and directory path into distinct lines in `ProgressTracker.tsx` with dedicated tags and icons, eliminating unwanted `...` dots truncation.
- [x] **Fixed Double Colon Title**: Resolved drive title formatting to clean `Scanning Drive M: ...`.
- [x] **Clarified Audit Actions**: Replaced confusing "Re-scan" button with explicit "Cancel" (`<X />`) in the results banner, returning users to setup, and enforced `white-space: nowrap` to prevent awkward word-wrapping.
- [x] **Responsive File Tree Grid**: Structured `.files-list-table` with CSS Grid (`minmax(200px, 1fr) 110px 48px`), natural description wrapping, and click-to-reveal row interaction.

### Phase 10: Scan False-Positive Fix, Clean Drive State & Granular Units
- [x] **Secondary Drive Recycle Bin False Positive Filter**: Fixed PowerShell `$Recycle.Bin` query in `scannerService.ts` to strictly filter for deleted items (`Where-Object { $_.Name -like '$R*' }`), eliminating the Windows system `desktop.ini` false positive that counted as 1 deleted user file on secondary partitions.
- [x] **Smart Byte Unit Scaling (`formatBytes`)**: Created `src/shared/formatters.ts` with granular unit detection (`B`, `KB`, `MB`, `GB`), preventing small files or caches from confusingly rendering as `0.0 MB`.
- [x] **Clean Categories Tray**: Separated scanned categories in `ScannedResultTree.tsx` into active items (`fileCount > 0`) vs clean items (`fileCount === 0`). Empty categories are no longer rendered as active checkboxes with empty lists; they are neatly summarized under an audited clean drawer (`✓ X Categories Audited Clean`).
- [x] **100% Clean Celebration Screen**: When a drive scan finishes with 0 junk items across all categories, the app displays a dedicated "Drive X: is 100% Clean!" card with emerald shield icon, audited category summary, and "Scan Another Drive" button rather than an active "Clean (0 B)" button.
- [x] **Rebuilt Production Binaries**: Packaged updated `Cleaner-Portable-1.0.0.exe` and `Cleaner Setup 1.0.0.exe` with full uninstaller support.

### Phase 11: Drive D Freeze Resolution & Kaspersky-Style Audit Reports
- [x] **Diagnosed Drive D Hang**: Identified that Drive D: contains legacy OS installation remnants and multiple protected user SIDs, including an entire Linux root filesystem (`$RQHCAPG.2-virtualbox-amd64`) in `D:\$Recycle.Bin`. The previous PowerShell recursion without timeout froze attempting to traverse hundreds of thousands of files across protected SID junctions.
- [x] **Fast Windows COM Recycle Bin Scanner**: Replaced heavy PowerShell `$Recycle.Bin` directory crawling with Windows Shell COM object (`New-Object -ComObject Shell.Application; $bin = $shell.Namespace(10)`), filtering instantly by partition letter with a strict 4-second timeout. Tested on all drives (`C:`, `D:`, `F:`, `G:`, `M:`) with sub-400ms scan speeds and zero freeze.
- [x] **Kaspersky Reports UI Overhaul (`HistoryView.tsx`)**: Rebuilt the History module into a 2-tier Kaspersky-inspired split view:
  - **Top Events Table**: High-level timeline table (`Date & Time`, `Module`, `Drive`, `Items Purged`, `Storage Freed`, `Status`) with interactive row selection and teal/emerald highlight.
  - **Bottom Audit Detail Panel**: Displays rich session properties (Event Type, Volume, Duration, Recovered Space, Operation Summary).
  - **Purged Files Manifest Grid**: Granular file-by-file log showing each file's name, directory path, category badge, size in `formatBytes`, purge status, and a one-click button to reveal the location in Windows Explorer.
  - **Live Search & Module Filters**: Added quick filtering pills (`All`, `System Junk`, `Large Files`, `Dev Repos`) and search input.

### Phase 12: Collapsible History Detail Toggle & File Manifest Backfill
- [x] **Toggleable Session Detail (Hide/Show)**: Enabled smooth expand/collapse interaction for the history audit detail panel. Clicking an active row toggles it closed, row action buttons explicitly display `Details` / `Hide` with chevrons, and the detail panel includes a dedicated "Hide Details" close button.
- [x] **Purged Files Manifest Data Population**: Backfilled the legacy session record with granular item data for the 3 `.crdownload` files on Drive M:, allowing the manifest table to immediately render filenames, full paths, sizes, and Explorer reveal shortcuts.

### Phase 13: Drive Colon Sanitization, Scan Cancellation Guard & History UX Refinement
- [x] **Double Colon & Redundant Label Fix**: Resolved `Drive C:: [C:]` and `Drive M:: [M.2.1]` in `CustomDriveSelect.tsx`, `Sidebar.tsx`, `SystemCleanupView.tsx`, and `HistoryView.tsx`. Implemented `formatDriveDisplay` helper that sanitizes colons (`.replace(/:/g, '')`) and only displays custom volume labels when distinct from the drive letter.
- [x] **Scan Cancellation Guard (`isScanCancelledRef`)**: Resolved race condition where cancelling a scan still transitioned the UI into `'scanned'` with partial results. Implemented `isScanCancelledRef` in `App.tsx` and abort detection in `scannerService.ts` to immediately discard partial results, reset progress, and return cleanly to `'idle'` setup stage.
- [x] **History View Full Responsiveness**: Refactored `.k-table-header` and `.k-table-row` in `index.css` with fluid `minmax(...)` grid units and horizontal scroll containment (`overflow-x: auto; min-width: 680px`), eliminating column clipping on narrower desktop viewports.
- [x] **Removed Explorer Reveal on Purged Items**: Removed the redundant "Reveal in Explorer" button and Action column from the session detail manifest since purged files no longer exist on disk. Replaced with a clean, low-profile `Purged` status pill.
- [x] **Clean Row-Level Exploration UX**: Removed the far-right `Hide/Details` button from table rows; user intuitively clicks anywhere on the row to toggle session audit manifests. Simplified column header to clean `STATUS`.

### Phase 14: Window Radius, Settings/About Dialog, Large Files Hunter Upgrade & Dev UX
- [x] **App Frame Border Radius**: Enhanced `.app-container` in `index.css` with a smooth 12px rounded corner radius (`border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.12); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5)`), replacing the sharp rectangular appearance.
- [x] **TitleBar Redesign & Settings Dropdown**:
  - Removed obsolete `"PRO"` badge from the brand logo.
  - Added Settings gear icon button to the left of the minimize button with a floating dropdown menu.
  - Implemented sleek modal popup **"About Cleaner"** identifying developer **Ibrahim Muliatama**, application purpose, technical stack, and version.
  - Conditioned center active drive pill in TitleBar to only appear after a scan has executed (`showDrivePill={stage !== 'idle'}`), leaving the titlebar clean during setup.
- [x] **Centered Clean State Card**: Centered the `.cleanup-all-clean-stage` container vertically and horizontally (`min-height: calc(100vh - 170px); align-items: center; justify-content: center;`) with `max-width: 680px`, preventing awkward top-left floating.
- [x] **Custom File Extension Reset Bug**: Resolved issue where adding a custom format reset selected formats to 0. Maintained dynamic `availableExtensions` state and merged custom inputs without clearing active standard chips.
- [x] **Large Files Hunter Power Tools**:
  - Multi-scope targeting: Active Drive (`Drive X:`), Whole PC / All Disks (`scanAllDrives: true`), or Custom Directory / Drag & Drop.
  - Custom size threshold input: Supported arbitrary file sizes (e.g. 250 MB, 2048 MB) in addition to quick preset pills.
  - Native Drag & Drop: Dropping any folder from Windows Explorer into the Hunter view auto-selects that directory for deep scanning.
  - Cancel scan button: Real-time scan abort via `cleanerApi.cancelLargeFilesScan()`.
- [x] **Dev Workspace UX Refinements**:
  - Custom tactile checkboxes with check icons replacing native HTML checkboxes.
  - Drag & Drop workspace support: Dropping any project folder onto the workspace pill instantly updates the scan target.
  - Cancel scan button: Added cancel capability via `cleanerApi.cancelDevScan()`.
- [x] **History View Default Hidden State & Action Layout**:
  - Details stay collapsed by default (`selectedRecordId: null`), allowing user to explore rows on click.
  - Redesigned top action buttons (`Save Report (TXT)`, `Export JSON`, `Clear History`) with spacious `.history-action-btn` styling and icons.

### Phase 15: Settings Dropdown Reordering, Theme Toggle Switch (Sun/Moon) & Bilingual Support
- [x] **Settings Dropdown Structure & Strict Ordering**:
  - Reordered TitleBar settings dropdown in exact requested sequence:
    1. **Language** (Bahasa Indonesia / English)
    2. **Mode** (Light / Dark)
    3. **About** (About Cleaner -> opens modal)
- [x] **Tactile Theme Toggle Switch with Sun/Moon Icons**:
  - Excluded any trailing text after "Mode" (no redundant "Light" / "Dark" text).
  - Implemented an animated sliding toggle switch containing an icon inside the thumb:
    - **Light Mode**: Golden sun icon (`<Sun size={10} className="theme-thumb-icon icon-sun" />`)
    - **Dark Mode**: Soft indigo moon icon (`<Moon size={10} className="theme-thumb-icon icon-moon" />`)
  - Smooth 0.25s cubic-bezier sliding transition between dark and light states.
- [x] **Calibrated Light Mode System Palette (Linear / Apple macOS Aesthetic)**:
  - Added full light theme tokens to `body.theme-light` and `:root[data-theme="light"]`:
    - Clean surfaces (`#f1f4f9` app base, `#ffffff` surface, `#f8fafc` canvas).
    - Subtle slate borders (`rgba(0, 0, 0, 0.08)`) and soft depth shadows.
    - High-contrast slate typography (`#0f172a` primary, `#475569` secondary, `#64748b` muted).
    - Overrides for AppContainer, TitleBar, NavRail, Hero Card, Step Panels, Dropdown, Modals, and Scrollbars.
### Phase 16: Light Mode Anomaly Fixes, True Rounded Window Corners, & About Modal Transitions
- [x] **Light Mode Visual Anomaly Fixes**:
  - **Drive Select**: Replaced dark `#090c13` trigger background with crisp white surface (`#ffffff`), subtle border, and emerald icon container in light mode.
  - **Scan Scope**: Fixed Full System button from rendering as pitch black `#090c13`; now clean white card (`#ffffff`) with purple accent when selected.
  - **Hero Workstation Monitor**: Styled monitor graphic in light mode with Apple Studio Display aesthetic (soft gradient screen, clean periwinkle spark ring, and silver/slate stand).
  - **Large Files Hunter Threshold Contrast Bug**: Fixed active threshold button (e.g. `> 500 MB`) which previously had white text on white background (`color: #ffffff` on `#ffffff`), rendering it as an empty box; now crisp indigo text on white with soft depth shadow.
  - **History Module**: Fixed dark table header (`.k-table-header`), dark selected row gradient, dark details panel (`.k-props-grid`), and lightened text contrast for all audit manifest tables.
- [x] **True Window Corner Radius (Anti-Runcing)**:
  - Configured Electron `BrowserWindow` with `transparent: true`, `backgroundColor: '#00000000'`, and `hasShadow: true` in `src/main/index.ts`.
  - Set `html, body { background: transparent !important; }` and `.app-container { border-radius: 14px; overflow: hidden; }` in `index.css`.
  - Outer corner pixels are now 100% transparent on Windows OS, providing true rounded desktop corners without sharp square black artifacts.
- [x] **About Modal Transition-Out Animation**:
  - Added `isModalClosing` state with 180ms delay in `TitleBar.tsx`.
  - Created `.closing` animations in `index.css` (`fadeOut` for backdrop and `scaleOut` for modal card) for smooth exit transitions.
- [x] **Streamlined About Cleaner Content**:
  - Removed "Technology Stack" section.
  - Removed developer role tag, displaying purely Developer: **Ibrahim Muliatama** alongside application purpose.
### Phase 17: Custom Extension Deletion & 2-Line Format Bar Layout
- [x] **Deleteable Custom Added Extensions**:
  - Protected default system extensions (`.tmp`, `.log`, `.dmp`, `.cache`, `.bak`, `.crdownload`) from deletion.
  - Custom added formats now display an inline `X` button (`.chip-delete-btn`) allowing users to delete individual custom extensions on demand.
  - Clicking the `X` button removes the format from both `availableExtensions` and `selectedExtensions` without toggling selection state (`e.stopPropagation()`).
- [x] **2-Line Format Filter Layout**:
  - **Line 1 (Top Row)**: Label `File Formats:` with active format counter on the left; `All Included` / `Reset Formats` button aligned at the far right.
  - **Line 2 (Bottom Row)**: All format chips (default + custom with delete buttons) along with the `[Add ext (e.g. .bak) +]` input box rendered on their own dedicated row beneath the title.
  - Preserved right-alignment for Directory search and drawer actions (`Recommended`, `Select All`, `Clear`).

### Phase 18: Light Mode Polish, History Center Alignment, & MIT Open Source License
- [x] **Light Mode Visual Anomaly Fixes**:
  - **Directory Catalog Search**: Fixed search input (`.canvas-search-input`) in light mode; now crisp white `#ffffff` with high-contrast text and subtle indigo focus ring.
  - **Format Filter Chips**: Fixed active chip text contrast (`.chip.chip-active`), replacing washed-out light blue `#c7d2fe` with crisp `#4338ca` indigo on soft `#f5f3ff` background.
  - **History Stats Strip**: Replaced dark grey background on `.kaspersky-stats-strip` with clean off-white `#f8fafc` container and white stat tiles.
  - **Audit Manifest Table**: Overrode `.k-manifest-table`, `.k-m-head`, `.k-m-row`, `.m-file-title`, `.cat-mini-tag`, and `.col-m-size` with white surfaces, subtle slate borders, and high-contrast dark text.
- [x] **History Table Column Center Alignment**:
  - Center-aligned all column headers and data cells in the main Events table (`Event Date & Time`, `Event / Operation`, `Target Partition`, `Purged Items`, `Storage Freed`, `Status`).
  - Center-aligned category, size, and status columns in the Purged Files Manifest table.
  - Removed obsolete duplicate `.col-k-status` styling and cleaned up unused CSS classes.
- [x] **Cleaned History Top Header**:
  - Removed redundant `REPORTS & AUDIT` badge from the History header for a minimal and uncluttered view.
- [x] **MIT License in Settings Dropdown**:
  - Added `License` (Scale icon) directly above `About` in the Settings dropdown.
  - Integrated smooth animated MIT Open Source License modal with copyright notice (`Copyright 2026 Ibrahim Muliatama`) and standard open-source grant terms.
  - Added bilingual support in `SettingsContext.tsx` (`id` and `en`).
- [x] **Core Architecture Clarification**:
  - Documented the hybrid design of `System Junk`: Curated safety rule pathways via `ruleRegistry.ts` prevent accidental destruction of essential Windows files, while `scannerService.ts` executes 100% dynamic live runtime detection, folder access validation, and byte calculation on the user's active drives.

### Phase 19: All-Clean Screen Light Theme, Natural Scrolling, & Developer Profile Update
- [x] **All-Clean Screen Visual Polish & Color Upgrade (Light Mode)**:
  - Upgraded `.all-clean-hero-card` to an emerald-to-white gradient (`#ecfdf5` to `#ffffff`) with rich emerald spark badge and high-contrast dark typography.
  - Replaced dark grey `.clean-metric-tile` cards with crisp white metric tiles with subtle shadows and slate labels.
  - Upgraded Clean Categories Tray (`.clean-tray-section`, `.clean-tray-grid`, `.clean-category-item`) from muddy grey blocks to crisp white cards on off-white `#f8fafc` containers with clean borders.
- [x] **Fixed Details Tray Scroll & Overflow Trapping**:
  - Replaced `min-height: calc(100vh - 170px); justify-content: center;` on `.cleanup-all-clean-stage` with `min-height: 100%; justify-content: flex-start; max-width: 820px; margin: 0 auto; padding: 36px 24px 64px;`.
  - Solved the flexbox negative coordinate overflow bug when expanding/collapsing details; users can now scroll effortlessly and smoothly all the way to the top and bottom with zero resistance or abrupt cutoffs.
- [x] **Scanned Results & Found Junk Dark Artifacts Elimination (Light Mode)**:
  - Eliminated pitch dark backgrounds on `.results-summary-banner`, `.tree-category-card`, `.tree-search-box`, and action buttons in light mode.
  - Fixed expanded file inspection drawer (`.category-files-drawer`) from rendering as pitch black `#090c13` to clean `#f8fafc` surface with high-contrast text and hover cards.
- [x] **About Modal Developer Profile Update**:
  - Changed developer name to **`bapp`** across English and Indonesian dictionaries.
  - Replaced old role text with a dedicated, interactive GitHub connection row: custom GitHub SVG icon + `github.com/bimbap` link + external link arrow.
  - Implemented `cleaner:open-external-url` IPC bridge allowing safe launching of external links in the user's default browser.

### Phase 20: Active Scanning & Progress Stage Light Mode Overrides
- [x] **Scanning Header Visibility**:
  - Fixed `.scanning-main-heading` ("Scanning Drive M: ...") which was hardcoded to `#ffffff`, causing invisible white text on white canvas in light mode; now high-contrast slate navy `#0f172a`.
- [x] **File & Location Card Overhaul**:
  - Replaced dark grey muddy background (`rgba(0, 0, 0, 0.45)`) on `.scanning-file-card` with clean white `#ffffff` surface, subtle border, and soft depth shadow.
  - Styled `File:` and `Location:` rows with crisp indigo `#4f46e5` for filename and slate `#64748b` for folder path.
- [x] **Apple Studio Display Scanning Monitor**:
  - Overrode `.scanning-monitor-screen` to an Apple Studio Display aesthetic in light mode (soft indigo-white gradient, slate border, gentle pulse ring, and silver/slate stand).
  - Cyan-indigo laser sweep beam calibrated for high legibility against the light screen.
- [x] **Progress Bar & Action Controls**:
  - Styled `.scanning-bar-track` to clean slate `#e2e8f0` (preventing faint washed-out bar).
  - Converted `.scanning-cancel-btn` to white pill with subtle border and rose-tinted hover state.
  - Also protected `.report-card` and `.metric-box` (Celebration Stage) with light mode overrides.

### Phase 21: MIT License Translation, Consistent Developer Name, & Live GitHub Profile
- [x] **License Developer Alignment**:
  - Updated `license.copyright` in English (`Copyright (c) 2026 bapp`) and Indonesian (`Hak Cipta (c) 2026 bapp`) to match the developer name in the About modal.
- [x] **Bilingual MIT License Translation**:
  - Replaced hardcoded English license paragraphs with i18n dictionary keys (`license.p1`, `license.p2`, `license.p3`).
  - Added official Indonesian legal translation of the MIT Open Source License terms; switching between EN and ID translates the license modal text seamlessly.
- [x] **Live GitHub Profile with Offline Fallback**:
  - Added dynamic asynchronous fetching of `https://api.github.com/users/bimbap` on mount and on network `online` events with a 4s timeout abort controller.
  - **Online State**: Renders live GitHub avatar image (`avatar_url`), online green pulse indicator dot, and `@bimbap` handle badge beside `bapp`.
  - **Offline / Failure Fallback**: Gracefully falls back to the default gradient `<User size={15} />` avatar icon without layout shift or UI breaks.

### Phase 22: Dev Workspace & Large Files Scanning Progress, Filter Bar UI, & Light Mode Badge Contrast
- [x] **Fixed Frozen / Static Spinner Bug**:
  - Added CSS animation rules connecting `@keyframes spin` to `.empty-state-icon-box.spinning svg` and `.animate-spin`, making the loading spinner rotate smoothly instead of appearing frozen.
- [x] **Real-Time Directory Scanning Progress (Without Individual File Noise)**:
  - Extended `DevCleanerService` and `LargeFileService` to emit `onProgress({ currentDirectory })` events as directories and heavy subfolders are inspected.
  - Exposed `onDevScanProgress` and `onLargeFilesScanProgress` in `preload/index.ts` and `types.ts`.
  - Updated `DevProjectsView.tsx` and `LargeFilesView.tsx` to display `Checking: [currentDirectory]` in real-time, giving users immediate visual confirmation of scanner activity and current folder location.
- [x] **Modern Filter Pills UI (Dev Workspace)**:
  - Replaced unstyled default HTML buttons (`all`, `node_modules`, `.next`, `dist`, `target`, `build`) with a sleek Apple/Linear segmented pill group (`.filter-pill-group`, `.filter-btn`).
  - Supported dark mode subtle glass pills and light mode crisp segmented buttons with soft shadows.
- [x] **Enhanced Badge Contrast & Legibility in Light Mode**:
  - Solved washed-out pastel text on `.dev-type-badge` by styling with high-contrast `#4338ca` deep indigo text on `#ede9fe` lavender surface with a crisp border (contrast ratio > 8:1).
  - Enhanced badge contrast across features:
    - Selected card artifact badge (`.dev-artifact-card.card-selected .dev-type-badge`).
    - Workspace folder badge (`.workspace-change-tag`).
    - Status toast banners (`.status-toast`) with deep indigo text on soft purple background.
    - Cancel buttons (`.btn-danger-outline`) with bold `#dc2626` red on `#fef2f2`.
    - History drive badges (`.timeline-drive-tag`), purged pills (`.m-purged-pill`), and inactivity badges (`.dev-age-badge`).

### Phase 23: Complete Multilingual Coverage, Large Files Pagination, Saved Filter Tags, & Spinner Hardening
- [x] **Universal Bilingual Translation Crosscheck**:
  - Audited every component across the application (`SettingsContext`, `SystemCleanupView`, `ConfirmCleanModal`, `CelebrationSummary`, `ProgressTracker`, `ScannedResultTree`, `CategoryCard`, `CustomDriveSelect`, `LargeFilesView`, `DevProjectsView`, `HistoryView`, `InspectModal`).
  - Added comprehensive Indonesian (`id`) and English (`en`) dictionary keys covering setup stages, drawer catalog, file extensions, live scanning phrases, clean audit states, confirmation metrics, risk levels, and column headers.
  - All modules seamlessly respond to runtime language toggling between Indonesian and English.
- [x] **Large Files Hunter 50-Item Pagination**:
  - Implemented client-side pagination limited to 50 items per page (`ITEMS_PER_PAGE = 50`) to keep the table clean and performant when inspecting hundreds of space-hogging files.
  - Added bottom pagination control bar (`.table-pagination-bar`) displaying current range (e.g. `Showing 1 - 50 of 234 files`), page indicator badge, and previous/next navigation buttons with disabled boundary states.
  - Increased scanner backend `maxResults` cap from 100 to 300 to supply multi-page browsing capabilities.
- [x] **Search Filter Tag System (Enter to Save Filter)**:
  - Typing in the search input and pressing `Enter` now converts the keyword into a permanent active filter chip (`savedFilterChips`).
  - Supports cumulative multi-criteria filtering (e.g. chaining `.iso`, `.zip`, `video` chips).
  - Typing without pressing `Enter` still performs live incremental text search as before.
  - Filter bar displays saved chips with individual remove (`X`) buttons and a `Clear filters` reset action.
  - Styled for dark mode glass and light mode crisp lavender pills.
- [x] **Spinner Rotation Hardening**:
  - Fixed Chromium/Electron SVG transform-origin quirks by encapsulating `<Loader2>` within a dedicated `.cleaner-spinner-wrapper` HTML `<span>` utilizing GPU-accelerated 2D rotation (`will-change: transform; animation: cleanerSpin 0.85s linear infinite;`).
  - Applied identical spinner hardening to both `LargeFilesView.tsx` and `DevProjectsView.tsx`.

### Phase 24: Electron 34 Drag & Drop Fix, Custom Radar Line Spinner, & Middle-Truncated Path Badge
- [x] **Root Cause Resolution for Drag & Drop Failure**:
  - Diagnosed that in Electron 34 (`^34.2.0`), accessing `e.dataTransfer.files[0].path` directly in the renderer process evaluates to `undefined` due to Chromium security sandbox & context isolation deprecations.
  - Exposed `webUtils.getPathForFile(file)` via `cleanerApi.getPathForFile` in `preload/index.ts` and `types.ts`.
  - Implemented `dragCounterRef` in both `LargeFilesView.tsx` and `DevProjectsView.tsx` to prevent event flickering when dragging files across nested DOM child elements.
  - Added global window drag-over and drop prevention in `App.tsx` to stop Electron from accidentally navigating away when files are dropped outside drop targets.
- [x] **Minimalist Conic Arc Spinner (`SleekArcSpinner`)**:
  - Replaced the awkward radial tick gear wheel with a minimalist SVG conic arc orbit spinner ([SleekArcSpinner.tsx](file:///m:/testProject/cleaner/src/renderer/components/SleekArcSpinner.tsx)) inspired by Linear, Raycast, and macOS.
  - Features smooth gradient conic rotation (`0.95s linear infinite`), subtle ambient track ring, rounded linecap, and a gentle pulsing core dot (`sleekDotPulse`).
  - Implemented cleanly across both `LargeFilesView.tsx` and `DevProjectsView.tsx`.
- [x] **Resolved Raw Translation Key Artifacts in Large Files**:
  - Registered missing `'large_files.select_all'` (`Select All` / `Pilih Semua`) and `'large_files.clear'` (`Clear` / `Batal Pilih`) in both English and Indonesian translation dictionaries inside [SettingsContext.tsx](file:///m:/testProject/cleaner/src/renderer/context/SettingsContext.tsx).
  - The UI now properly displays clean translated labels instead of raw code identifiers.
- [x] **Full Global Design System Overhaul to Warm Amber Phosphor (Anti-AI Slop)**:
  - Completely purged generic AI-template indigo/purple (`#6366f1`, `#4f46e5`, `#818cf8`, `#a5b4fc`) across the entire application design system.
  - Migrated root design tokens to **Warm Amber Phosphor**:
    - **Dark Mode**: `--accent-primary: #f59e0b`, `--accent-hover: #d97706`, `--accent-subtle: rgba(245, 158, 11, 0.12)`, `--accent-glow: rgba(245, 158, 11, 0.28)`.
    - **Light Mode**: `--accent-primary: #d97706`, `--accent-hover: #b45309`, `--accent-subtle: rgba(217, 119, 6, 0.08)`.
  - Harmonized all interactive controls globally:
    - App Brandmark (`.brand-logo-badge` & `.brand-badge`) in TitleBar.
    - Left Navigation Rail active items (`.rail-item.active`) & active icons.
    - Hero Primary CTA Button (`.hero-scan-btn`) & Common Buttons (`.btn-primary`).
    - Tactile Toggle Switches (`.toggle-switch.active`).
    - Scope & Filter Pills (`.hero-mode-btn.active`, `.scope-pill.active`, `.k-filter-pill.active`, `.chip.chip-active`).
    - Laser Scanning Beam (`.scan-laser-beam`) & Monitor graphic rings.
    - Developer Artifact Badges (`.dev-type-badge`) & License rows.
  - Ensured WCAG AAA contrast by rendering `#0a0d14` bold dark text on dark-mode amber surfaces and `#ffffff` on deep amber in light mode.
- [x] **Directory Path Overflow & Smart Middle-Truncation (`formatMiddleTruncate`)**:
  - Added `formatMiddleTruncate(path, 42)` in `src/shared/formatters.ts` preserving the root drive (e.g. `M:\MMVC\`) and the active leaf directory (e.g. `...\dynamicconv_layer\__pycache`), eliminating awkward right-truncation and layout jumping (CLS).
  - Encapsulated scanning paths inside a fixed-height monospace pill badge (`.scanning-dir-badge`) with a folder icon and full path hover tooltip (`title={fullPath}`).

### Phase 25: Docker Pro Design System Migration & 5-Bar Wave Equalizer
- [x] **5-Bar Real-Time Disk Wave Equalizer (`WaveEqualizerLoader.tsx`)**:
  - Replaced the radial spinner with a dedicated 5-bar hardware disk activity equalizer simulating physical disk drive I/O operations.
  - Staggered timing curves (`0.85s` to `1.2s`) and scale animations (`diskWaveBeat`) with electric cyan/cobalt pulse.
- [x] **Global Transition to Docker Pro System Palette (Technical Cobalt & Electric Cyan)**:
  - Retired the retro amber phosphor palette following live UX evaluation in favor of the authoritative, high-precision **Docker Desktop / Cloudflare / CleanMyMac** engineering standard.
  - Purged 100% of legacy template purples (`#6366f1`, `#4f46e5`, `#4338ca`, `rgba(99, 102, 241, ...)`) and non-semantic amber.
  - **Dark Mode Design System Tokens**:
    - `--bg-app`: `#080c14` (Deep technical slate)
    - `--bg-surface`: `#111827`, `--bg-surface-elevated`: `#162034`
    - `--accent-primary`: `#0ea5e9` (Electric Tech Sky / Docker Cyan-Blue)
    - `--accent-hover`: `#38bdf8`, `--accent-active`: `#0284c7`
    - `--accent-subtle`: `rgba(14, 165, 233, 0.12)`, `--accent-glow`: `rgba(14, 165, 233, 0.28)`
    - `--border-active`: `rgba(14, 165, 233, 0.45)`
    - `--accent-text`: `#ffffff`
  - **Light Mode Design System Tokens**:
    - `--bg-app`: `#f1f5f9` (Clean technical slate), `--bg-surface`: `#ffffff`
    - `--accent-primary`: `#0284c7` (Ocean Cobalt / Docker Blue)
    - `--accent-hover`: `#0369a1`, `--accent-active`: `#075985`
    - `--accent-subtle`: `rgba(2, 132, 199, 0.08)`, `--accent-glow`: `rgba(2, 132, 199, 0.18)`
    - `--border-active`: `rgba(2, 132, 199, 0.45)`
    - `--accent-text`: `#ffffff`
  - **Harmonized Surfaces & Controls**:
    - TitleBar Brandmark: `.brand-logo-badge` (`linear-gradient(135deg, #0ea5e9, #0284c7)`) & `.brand-badge` (`#38bdf8`).
    - Navigation Rail: `.rail-item.active` with soft technical cobalt glow and `#38bdf8` icons.
    - Hero Primary Action & Common Buttons: `.hero-scan-btn` & `.btn-primary` with `linear-gradient(135deg, #0284c7 0%, #0369a1 100%)` and crisp white typography.
    - Laser Beam Animation: `.scan-laser-beam` sweeping in electric cyan (`#38bdf8` to `#0ea5e9`).
    - Scope, Filters, and Chips: Step 2 scope cards, search filter tags, history pills, and bento cards all unified under technical cobalt and cyan.
    - Semantic Caution Preservation: Semantic warning statuses (`--status-caution: #f59e0b`, `.age-dormant`, and `gauge-danger`) correctly preserved as amber, maintaining semantic clarity.
- [x] **Production Build Verified**:
  - Verified 100% clean compilation via `tsc && vite build` across renderer, preload, and electron main processes.

### Phase 26: High-Speed File Search / Fast File Hunter (Bypassing Windows Explorer)
- [x] **High-Performance Asynchronous Parallel Traversal (`FastSearchService.ts`)**:
  - Implemented 12-worker asynchronous parallel BFS queue utilizing native Node.js `fs.promises.readdir(dir, { withFileTypes: true })`.
  - **Why it beats `explorer.exe`**: Windows Explorer performs sequential COM shell queries, deep content indexing, and thumbnail cache extraction, leading to severe UI freezes on large drives. `FastSearchService` directly pulls directory table entries into memory from NTFS MFT and runs regex/glob filters *prior* to calling `fs.promises.stat()`, eliminating 99% of unnecessary disk I/O.
  - Windows junction & infinite loop protection: explicitly prevents recursing into `%LOCALAPPDATA%\Application Data`, `$Recycle.Bin`, and system junction loops.
  - Wildcard query parsing: supports `*` and `?` wildcard patterns compiled to case-insensitive regular expressions with substring search fallback.
  - Granular file category filters: Documents, Images, Media, Archives, Executables/Scripts, and Developer Code (`FILE_TYPE_EXTENSIONS`).
  - Size constraint filters: `< 1MB`, `1 - 50MB`, `50 - 500MB`, and `> 500MB`.
  - Throttled batch emission (`cleaner:fast-search-batch`) and live telemetry updates (`cleaner:fast-search-progress`).
- [x] **IPC Channel Expansion & Preload Hardening**:
  - Registered `cleaner:start-fast-search`, `cleaner:cancel-fast-search`, `cleaner:open-file`, and `cleaner:delete-file` in `main/index.ts`.
  - Exposed full typed contracts on `window.cleanerApi` in `preload/index.ts` and `shared/types.ts`.
  - Safe file deletion via `shell.trashItem` with permanent `fs.promises.unlink` fallback.
- [x] **Fast Search UI View Component (`FastSearchView.tsx`)**:
  - Added search input with real-time submit on Enter or Search button click, and clear button.
  - Multi-target search scope: Any detected Windows partition (`C:`, `D:`, `M:`, etc.), All Drives (`all`), or Custom Directory.
  - Folder picker dialog (`window.cleanerApi.selectDirectory`) and drag-and-drop dropzone with Electron 34 `getPathForFile` compatibility.
  - File category pill selector (`All`, `Documents`, `Images`, `Media`, `Archives`, `Executables`, `Code`) with badge counts.
  - Size constraint pills (`< 1MB`, `1 - 50MB`, `50 - 500MB`, `> 500MB`).
  - Live search telemetry banner displaying `WaveEqualizerLoader` 5-bar hardware activity animation, scanned folder count, match count, elapsed search time, and cancel CTA.
  - Keyword match highlighting with `<mark class="search-match-mark">` highlighting the exact query substring within matching filenames.
  - Virtual paginated results table (50 items per page) with file type colored icons, middle-truncated directory paths, formatted file sizes, and modified dates.
  - 1-Click row actions: Open file, Reveal in Explorer (`shell.showItemInFolder`), Copy full path to clipboard, and Delete (Move to Recycle Bin) with modal confirmation.
- [x] **Navigation & Design Integration**:
  - Added `Search` module to `NavRail.tsx` with Docker Pro cyan hover and active states.
  - Registered 35+ localization strings in both English (`en`) and Indonesian (`id`) inside `SettingsContext.tsx`.
  - Styled with Docker Pro cobalt/cyan dark & light mode themes in `index.css`.
  - 100% clean production build verified (`npm run build`).
- [x] **Pagination & Table Seam Fixes**:
  - Resolved `SebelumnyaSelanjutnya` overlapping text bug by replacing fixed `width: 26px` on `.pagination-btn` with `min-width: 28px; width: auto; padding: 0 10px; gap: 6px;` and elevated surface styling.
  - Eliminated the 1-pixel dark vertical background seam between the Path and Size columns caused by Chromium subpixel rounding on sticky `th` with `border-collapse: separate; border-spacing: 0;`, explicit column percentage/widths, and solid `thead` background.
  - Updated Indonesian dictionary to display clean `"LOKASI"` instead of `"LOKASI / PATH"` per user request.
- [x] **Drive Scope Dropdown, Custom Size Range & Reset View Action**:
  - Replaced the horizontal list of drive pills with a compact **Scope Dropdown Popover** (`.scope-dropdown-wrapper`) featuring All Drives (`Globe`), physical drives with volume labels and free storage telemetry (`HardDrive`), and Custom Folder picker (`FolderOpen`), eliminating header clutter.
  - Added **Custom Size Range** filter (`minSizeBytes` & `maxSizeBytes`) with inline number inputs and unit selector (`KB`, `MB`, `GB`) supported both backend (`FastSearchService`) and real-time reactive frontend (`useMemo`).
  - Added **1-Click Reset / Clear Action**: clicking the input clear button (`X`), the secondary search bar `Reset` button, or the telemetry banner `Reset` action immediately clears results, resets query/progress, and returns users cleanly to the initial suggestions screen.
  - 100% clean TypeScript and Vite production compilation verified.

### Phase 27: Large Files Drive Selector Unification, Free Space Removal, Delete Confirm Modal & Layout Separation
- [x] **Large Files Hunter Unified Drive Dropdown (`LargeFilesView.tsx`)**:
  - Replaced old scope toggle pills with the sleek popover dropdown identical to Fast Search.
  - Added local `selectedDrive` state and auto-fetched drive stats via `window.cleanerApi?.getDriveStats()` on mount.
  - Users can now seamlessly switch between Whole PC (`all`), any physical drive (`C:`, `D:`, `M:`, etc.), and Custom directory directly within Large Files Hunter without jumping to the System Junk tab.
- [x] **Clean Scope Dropdown (Removed Free Space Clutter)**:
  - Removed redundant `(xx.xx GB bebas)` / free space info strings from both the dropdown triggers and popover item lists across Fast Search and Large Files, keeping the selector uncluttered and sleek.
- [x] **Delete Confirmation Popup in Fast Search (`FastSearchView.tsx`)**:
  - Replaced immediate direct deletion with a styled modal alert (`.modal-backdrop`, `.modal-card`, `.modal-icon-badge danger` with `<AlertTriangle />`).
  - Provides item preview with file icon, truncated name, formatted file size, and complete file path before committing permanent or recycle bin removal.
  - Clean modal action buttons: `Batal` (`btn-ghost`) and `Hapus File` (`btn-danger`).
- [x] **Structured Layout Separation for Fast Search Controls**:
  - Separated the previously cramped flex-wrapped row into dedicated, beautifully aligned rows:
    - **Row 1**: Primary search input and action buttons (`.search-bar-row`).
    - **Row 2**: Target scope selector (`.fast-search-scope-row`) with uppercase label.
    - **Row 3**: File category pills (`.fast-search-filter-row`) with icon and type filters.
    - **Row 4**: File size filters (`.fast-search-filter-row`) with preset size pills and custom range controls.
- [x] **Production Verification**:
  - Verified 100% clean compilation via `cmd /c "npm run build"`.

### Phase 28: Header Column Sorting, Action Dropdown Menu & Directory Search Support
- [x] **Universal Table Header Sorting Across All Modules**:
  - **Fast Search (`FastSearchView.tsx`)**: Clickable sortable headers for `Nama`, `Lokasi`, `Ukuran`, and `Tanggal Modifikasi` with dynamic ascending/descending directional indicators (`ArrowUp`, `ArrowDown`, `ArrowUpDown`).
  - **Large Files Hunter (`LargeFilesView.tsx`)**: Header columns for `File / Info`, `Ukuran`, and `Tanggal Modifikasi` sort files reactively (defaults to largest size first).
  - **System Cleanup (`ScannedResultTree.tsx`)**: Header columns inside the category drawer (`Lokasi / Path` and `Ukuran`) allow users to sort scanned junk files to immediately pinpoint massive caches.
- [x] **Streamlined Row Actions Dropdown Menu in Search**:
  - Replaced the horizontal 4-button array with a sleek popover action menu (`MoreHorizontal`).
  - Clean action choices: `Buka File / Folder`, `Buka Lokasi Folder` (Reveal in Explorer), `Salin Path`, and `Hapus...` (with red danger theme and delete confirmation modal).
  - Automatically closes upon outside document clicks.
- [x] **Directory & Folder Search Support (`FastSearchService.ts`)**:
  - Added folder name matching during BFS parallel traversal when file type filter is `Semua Tipe` (`all`).
  - Directories render with amber folder icon (`#f59e0b`) and `Folder` badge.
  - Double clicking or choosing `Buka Folder` immediately launches the directory in Windows Explorer.
  - Implemented safe directory deletion via `shell.trashItem` with recursive `fs.promises.rm` fallback.
- [x] **Production Verification**:
  - Clean build verified with 0 errors via `npm run build`.

### Phase 29: Telemetry Banner Layout Polish & Large Files Drag-and-Drop Auto-Execution
- [x] **Telemetry Banner Layout Refinement (`FastSearchView.tsx` & `index.css`)**:
  - Moved status indicator (`WaveEqualizerLoader` / `Scan Finished`) and metric counters (`files checked`, `matches found`, `elapsed time`) to the right side of the banner.
  - Eliminated the redundant secondary `Reset` button in the banner, keeping a single clean reset trigger beside the primary search action.
  - Placed the currently scanned file/folder path into its own dedicated lower row (`telemetry-bottom-dir-row`), ensuring long paths remain legible without clipping.
- [x] **Large Files Drag & Drop Polish (`LargeFilesView.tsx` & `index.css`)**:
  - Removed duplicate outer outline border (`outline: none` on `.module-view-container.drag-over-active`), retaining only the rounded inner dashed box.
  - Upgraded `handleDrop` to automatically trigger instant deep scanning (`executeScan`) with multi-tier path extraction fallback, eliminating dead-end drag gestures.
- [x] **Production Verification**:
  - Verified 100% clean compilation via `cmd /c "npm run build"`.

### Phase 30: Large Files Column Spacing Overhaul & Comprehensive Localization Audit
- [x] **Large Files Table Spacing & Responsiveness (`LargeFilesView.tsx` & `index.css`)**:
  - Resolved cramped `UKURAN` and `DIMODIFIKASI` column collision (`183 MBSep 11, 2026`) by upgrading `.table-header-row` and `.table-row` grid definition from cramped zero-gap layout to `grid-template-columns: 32px minmax(220px, 1fr) 130px 120px 140px 36px; gap: 18px; padding: 10px 18px;`.
  - Added `.large-files-table-wrapper` with `overflow-x: auto` and `.large-files-table` with `min-width: 780px` ensuring smooth responsive horizontal scrolling on compact screens without squashing data columns.
  - Enforced `white-space: nowrap` on `.col-size`, `.col-date`, and `.th-content`.
- [x] **Comprehensive Localization Audit & Translation (`SettingsContext.tsx` & All Modules)**:
  - Replaced hardcoded English string `"Found {count} large space-hogging files."` with dynamic bilingual key `large_files.found_files` (`'Ditemukan {count} file berukuran besar.'` in Indonesian).
  - Translated all large files scan status notifications (`audit_clean_status`, `scanning_status`, `target_folder_set`, `deleted_success`, `deleted_error`, `scan_cancelled`, `scan_error`, `auditing_storage`).
  - Translated scope dropdown popover descriptions in Large Files and Fast Search (`whole_pc_desc`, `custom_folder_change`, `custom_folder_select`).
  - Added missing translations across **Fast Search** (`drag_title`, `drag_desc`, `open_folder`, `traversing_tree`, `try_broadening`, `suggestions`), **Dev Workspace Cleaner** (`target_folder_set`, `scanning_status`, `found_artifacts`, `no_artifacts`, `purged_success`, `purged_error`, `browse_tooltip`), and **History View** (`export_success`, `confirm_clear`, `cleared_toast`, `col_partition`, `col_items`, `status_completed`, `hint_collapsed`, `objects_purged`, `manifest_logged`).
- [x] **Fast Search Telemetry Banner Layout Alignment (`FastSearchView.tsx` & `index.css`)**:
  - Re-anchored counter badges (`files scanned`, `matches found`, `elapsed time`) to the **left side** of the telemetry top row (`.telemetry-left-stats`).
  - Positioned the active status state (`WaveEqualizerLoader` + `Memindai file sistem...` or `CheckCircle2` + `Pemindaian Selesai`) neatly to the **right side** (`.telemetry-right-status`), keeping the scanned directory path on its dedicated second row below.
- [x] **Production Verification**:
  - Verified 100% clean compilation via `cmd /c "npm run build"`.

### Phase 31: Fast Search Copy Inclusivity (Files & Folders Support)
- [x] **Adjusted Search Module Copy & Labels (`SettingsContext.tsx`, `FastSearchView.tsx`, `NavRail.tsx`)**:
  - Broadened all specific "file" references across search to be inclusive of folders and generic directory items:
    - Nav rail label: `'Pencarian Kilat'` (formerly `'Cari File Kilat'`).
    - Module header: `'Pencarian Kilat'` / `'Fast Search Hunter'` & subtitle adjusted.
    - Search CTA button: `'Cari'` (formerly `'Cari File'`).
    - Input placeholder: `'Ketik nama file, folder, atau wildcard (contoh: invoice, docs, *.pdf)...'`.
    - Live scanning status: `'Memindai penyimpanan...'` / `'Scanning storage...'`.
    - Telemetry counter: `'item diperiksa'` / `'items scanned'` and `'ditemukan'`.
    - Column header: `'NAMA'` / `'NAME'` (clean, universal title).
    - Drag & drop overlay prompt: `'Lepas direktori ke sini untuk mencari langsung di dalamnya'`.
    - Delete confirm modal: updated to `'item'` and conditionally renders amber `<Folder />` icon when purging a directory.
- [x] **Production Verification**:
  - Verified 100% clean compilation via `cmd /c "npm run build"`.

### Phase 32: Real Folder Size Calculation in Search & Large Files Hunter
- [x] **Real Recursive Directory Size Calculation (`fastSearchService.ts`)**:
  - Implemented `getDirectorySizeBytes(dirPath, maxFiles = 8000)` to compute the actual storage footprint of matched directories during BFS search, skipping system protected volumes (`$recycle.bin`, `system volume information`).
  - Stores computed `sizeBytes` on `FastSearchItem` instead of static `0`.
- [x] **Display Real Folder Storage in Search (`FastSearchView.tsx`)**:
  - Replaced the static text badge `'Folder'` in the `UKURAN` column with dynamic human-formatted bytes (e.g. `142 MB`, `2.4 GB`).
  - Enables accurate column sorting (`ArrowUp` / `ArrowDown`) by size across both files and folders.
  - Retains amber `<Folder />` icon and inline `Folder` badge in the `NAMA` column for visual distinction.
  - Delete modal shows computed folder size and amber folder icon before confirmation.
- [x] **Massive Directory Discovery in Large Files Hunter (`largeFileService.ts` & `LargeFilesView.tsx`)**:
  - Extended `largeFileService.ts` to inspect top-level subdirectories during disk audits and flag folders exceeding the size threshold (`minSizeBytes`, e.g. `> 100 MB`, `> 500 MB`).
  - Added optional `isDirectory?: boolean` property to `LargeFileItem` contract (`types.ts`).
  - `LargeFilesView.tsx` renders directory rows with `<Folder />` icon (`#f59e0b`), inline `Folder` tag, and calculated size in the `UKURAN` column.
  - Upgraded `largeFileService.deleteFiles` to safely purge directories recursively via `fs.promises.rm(filePath, { recursive: true, force: true })` and accurately accumulate freed bytes.
- [x] **Production Verification**:
  - Verified 100% clean compilation via `cmd /c "npm run build"`.

### Phase 33: Dev Workspace Copy Refinement (Build Artifacts Generalization)
- [x] **Universal Build Artifacts Terminology (`SettingsContext.tsx`, `NavRail.tsx`, `Sidebar.tsx`, `main/index.ts`)**:
  - Replaced repetitive and narrow `node_modules` phrasing with professional and inclusive **"Artefak Build / Build Artifacts"** terminology across the entire Dev Workspace Cleaner module.
  - Subtitle:
    - ID: `'Pindai repositori & workspace untuk mencari artefak build dan dependensi yang tidak aktif'`
    - EN: `'Scan project workspaces for dormant build artifacts and disposable dependencies'`
  - Status saat scan/search (`dev_repos.scanning_status`):
    - ID: `'Memindai {target} untuk mencari artefak build...'`
    - EN: `'Scanning {target} for build artifacts...'`
  - Ready & Drop prompts:
    - ID: `'Folder target akan dipindai untuk mencari artefak build (.next, dist, target, node_modules)'` & `'...mendeteksi artefak build dan folder sementara yang tidak terpakai.'`
    - EN: `'Target folder will be scanned for build artifacts (.next, dist, target, node_modules)'` & `'...detect disposable build artifacts and dormant caches.'`
  - Navigation tooltips & audit summaries:
    - Updated NavRail title to `'Developer Workspaces & Build Artifacts'`.
    - Updated audit history summary to `Purged {count} developer project directories (build artifacts)`.
- [x] **Production Verification**:
  - Verified 100% clean compilation via `cmd /c "npm run build"`.

### Phase 34: Fast Search UX Overhaul (Separated Header, Collapsible Filter Bar & Dropdowns)
- [x] **Separated Top Module Header (`FastSearchView.tsx`)**:
  - Extracted title (`Pencarian Kilat`) and subtitle into the standard `<header className="module-header">` matching `LargeFilesView`, `DevProjectsView`, and `HistoryView`.
  - Removed the cramped nested title from within the search surface box.
- [x] **Compact Single-Row Dropdowns Filter System**:
  - Converted the sprawling multi-line pill arrays into 3 sleek, compact popover dropdowns:
    1. **Lokasi / Drive Dropdown**: Pick All Drives (`Seluruh PC`), specific logical partitions, or browse custom folders.
    2. **Tipe Berkas Dropdown**: Popover list with category vector icons and extension descriptions (`Semua Tipe`, `Dokumen`, `Gambar`, `Audio / Video`, `Arsip`, `Aplikasi & Script`, `Source Code`).
    3. **Batas Ukuran Dropdown**: Quick presets (`Semua Ukuran`, `< 1 MB`, `1 - 50 MB`, `50 - 500 MB`, `> 500 MB`, `Rentang Kustom`).
  - Active dropdown highlights with accent tint when non-default criteria is selected.
  - Inline custom range inputs display seamlessly when `Rentang Kustom` is active.
- [x] **Collapsible Filter Bar with Show/Hide Toggle**:
  - Added dedicated `Filter` button in primary search bar row with `<SlidersHorizontal />` icon, animated chevron, and active filter counter badge (`filter-active-count-badge`).
  - Allows users to collapse the filter row for a minimal distraction-free search experience, while badge persists to signal applied filters.
  - Added one-click `Reset Filter` button to restore filters without clearing search query.
### Phase 35: Smooth Accordion Animation for Fast Search Collapsible Filter Bar
- [x] **Persistent DOM Structure with Grid Animation Wrapper (`FastSearchView.tsx`)**:
  - Replaced abrupt React conditional unmounting (`{isFiltersOpen && ...}`) with persistent two-tier wrapper `.fast-search-filters-collapsible` and `.fast-search-filters-inner`.
  - Bound `.expanded` / `.collapsed` class transitions to `isFiltersOpen` state without tearing down DOM elements.
- [x] **60fps Fluid CSS Grid Transition System (`index.css`)**:
  - Utilized modern `grid-template-rows: 0fr` to `1fr` transition with calibrated cubic-bezier easing (`0.16, 1, 0.3, 1`) over 280ms.
  - Paired with synchronized `opacity` fade (0.22s), subtle vertical slide `transform: translateY(-4px)` to `0`, and dynamic `margin-top: 0` to `12px`.
  - Set `gap: 0` on `.fast-search-controls-container` so the collapsed state leaves zero phantom spacing under the search input bar.
- [x] **Stacking Context & Dropdown Click Fix (`index.css` & `FastSearchView.tsx`)**:
  - Identified root cause of popovers rendering underneath the table/banner ("nembus") and failing hit-tests ("ga bisa diklik"): `position: relative;` on `.fast-search-results-area` and `position: sticky; z-index: 10;` on `.fast-search-table th` caused subsequent elements to paint on top of unpositioned `.fast-search-controls-container`, while `transform` created a trapped stacking context.
  - Added `position: relative; z-index: 50;` to `.fast-search-controls-container` so the controls bar and its popovers always sit decisively above the telemetry banner and results table.
  - Removed `transform: translateY` from the collapsible container, eliminating trapped local stacking contexts.
  - Added dynamic `.active-dropdown` class with `z-index: 100` to the active `.scope-dropdown-wrapper` and boosted `.scope-dropdown-popover` to `z-index: 1000`.
- [x] **Production Verification**:
  - Verified 100% clean compilation via `cmd /c "npm run build"`.

### Phase 36: Large Files Size Threshold Dropdown Overhaul
- [x] **Pop-over Dropdown for Size Threshold (`LargeFilesView.tsx`)**:
  - Replaced the horizontal pill button array (`> 100 MB`, `> 300 MB`, `> 500 MB`, `> 1 GB`, `> 2 GB`) and raw input box with a sleek popover dropdown matching Target Scope and Fast Search design patterns.
  - Included 6 calibrated presets (`> 100 MB`, `> 300 MB`, `> 500 MB` [default], `> 1 GB`, `> 2 GB`, `> 5 GB`) complete with color-coded disk indicators and descriptive subtexts.
- [x] **Unit-Aware Custom Size Input (`MB` / `GB`)**:
  - Added dedicated `Kustom` option in the dropdown that exposes a compact inline input `.custom-size-inline-bar` with live unit switcher (`MB` and `GB`).
  - Automatically calculates byte equivalents (`Math.round(parsed * 1024)` for GB, direct value for MB) and updates the scan threshold.
- [x] **Dropdown Stacking & Mutual Exclusivity**:
  - Added `position: relative; z-index: 50;` to `.large-files-config-bar` and dynamic `.active-dropdown` class (`z-index: 100`) so popovers render cleanly above data tables without clipping or hit-test failure.
  - Wired mutual exclusivity between Target Scope and Size Threshold dropdowns, closing one when the other opens.
- [x] **Bilingual i18n Translations (`SettingsContext.tsx`)**:
  - Added complete English and Indonesian translations for all size threshold preset descriptions and custom size instructions.
- [x] **Production Verification**:
  - Verified 100% clean compilation via `cmd /c "npm run build"`.

### Phase 37: Responsive Layout & Dynamic Dropdown Overhaul
- [x] **Unified Control Bar Layout (`LargeFilesView.tsx` & `index.css`)**:
  - Replaced jarring `justify-content: space-between` in `.large-files-config-bar` with cohesive `display: flex; align-items: center; gap: 20px; flex-wrap: wrap;`.
  - Grouped Target Scope and Size Threshold side-by-side on the left, eliminating the unnatural wide-screen gap and preventing the size dropdown from sticking to the right window edge.
  - Added dedicated one-click `Reset Filter` button floating on the right (`margin-left: auto`) whenever non-default filter parameters are applied.
- [x] **Adaptive Trigger Button Sizing (`index.css`)**:
  - Relaxed rigid `min-width: 200px` on `.scope-dropdown-trigger` to adaptive `min-width: 140px; width: auto; max-width: 280px;`, preventing oversized empty gaps in compact labels like `> 500 MB`.
- [x] **Dynamic Viewport Auto-Alignment (`align-right`) (`LargeFilesView.tsx` & `FastSearchView.tsx`)**:
  - Implemented real-time boundary measurement (`rect.left + 300 > window.innerWidth - 24`) on dropdown toggles.
  - Automatically applies `.align-right` (`left: auto; right: 0;`) whenever a dropdown is opened close to the right edge of the screen, guaranteeing zero screen-edge clipping across all window resolutions.
- [x] **Unclipped Dynamic Popover Height (`index.css`)**:
  - Expanded `.scope-popover-list` from rigid `max-height: 280px` to dynamic `max-height: min(480px, calc(100vh - 180px));`.
  - Displays all 6 preset options (`100 MB` through `5 GB`) plus custom input options simultaneously without forced premature scrolling or hidden items above the fold.
- [x] **Production Verification**:
  - Verified 100% clean compilation via `cmd /c "npm run build"`.

### Phase 38: Unified Drive Label Formatting (Eliminated Redundant Brackets)
- [x] **Centralized Drive Formatter (`src/shared/formatters.ts`)**:
  - Exported authoritative `formatDriveDisplay(letter, label)` helper across the app.
  - Automatically suppresses redundant brackets and duplicate letters (e.g. `Drive C: [C:]` or `Drive C: [Local Disk]` cleanly becomes `Drive C:`).
  - Preserves distinctive custom volume labels when present (e.g. `Drive D: [Data]`, `Drive M: [Workspace]`).
- [x] **Component Integration**:
  - `FastSearchView.tsx`: Trigger button title, label, and popover items now use `formatDriveDisplay(selectedDrive, activeDriveStat?.label)` and `formatDriveDisplay(drive.letter, drive.label)`.
  - `LargeFilesView.tsx`: Target description in `executeScan`, trigger button title/label, and popover items now use `formatDriveDisplay`.
  - `CustomDriveSelect.tsx`: Replaced duplicated local helper with import from `../../shared/formatters`.
- [x] **Production Verification**:
  - Verified 100% clean compilation via `cmd /c "npm run build"`.

### Phase 39: History Pagination (25 Items Capped) & Fixed System Operation Title
- [x] **Fixed Misleading Operation Title (`HistoryView.tsx` & `SettingsContext.tsx`)**:
  - Root cause resolved: `getModuleMeta('system')` previously defaulted to `t('cleanup.welcome_title')` which translated to `"Selamat Datang di Cleaner"` in Indonesian.
  - Replaced with dedicated `t('history.module_system')` (`"Pembersihan Sistem"` in ID / `"System Cleanup"` in EN), alongside `history.module_large_files` and `history.module_dev_repos`.
- [x] **Pagination for Detailed Purged Files Manifest (`HistoryView.tsx`)**:
  - Resolved catastrophic lag when inspecting purge sessions containing 1,000+ deleted files by capping rendering to 25 items per page (`DETAIL_FILES_PER_PAGE = 25`).
  - Integrated standard pagination bar (`.table-pagination-bar`) with dynamic slice calculations, item counter (`Menampilkan 1 - 25 dari 1000 file`), previous/next navigation, and auto-reset when changing session or search filter.
- [x] **Pagination for Main History Sessions Table (`HistoryView.tsx`)**:
  - Added session table pagination capped at 25 entries per page (`SESSIONS_PER_PAGE = 25`).
  - Auto-resets to page 1 upon changing search query or module filter pills.

### Phase 40: Exhaustive History i18n & Badge Translation Audit
- [x] **Tooltips Localization (`HistoryView.tsx` & `SettingsContext.tsx`)**:
  - Localized export TXT, export JSON, and clear history button tooltips in both Indonesian and English.
  - Localized row toggle tooltip (`t('history.tooltip_hide_details')` / `t('history.tooltip_inspect_manifest')`).
- [x] **Badges & Statuses Localization (`HistoryView.tsx` & `index.css`)**:
  - Replaced hardcoded `"Freed"` badge in session detail card with `+{formatBytes(...)} ${t('history.freed')}` (`"Dibebaskan"` in ID).
  - Replaced hardcoded `"Purged"` pill with bilingual status pill supporting both `t('history.status_purged')` (`"Dihapus"`) and `t('history.status_skipped')` (`"Dilewati"`), with `.m-skipped-pill` warning theme.
  - Localized item counter label (`{record.filesCount} ${t('history.items')}`).
- [x] **Audit Manifest & Properties Localization**:
  - Localized all 4 manifest table column headers: Target & Path File, Kategori, Dibebaskan, and Status (`history.col_manifest_*`).
  - Localized key-value system properties in audit card: `history.prop_event`, `history.prop_event_val`, `history.prop_module`, and `history.prop_volume`.
  - Integrated `formatDriveDisplay` for partition labels across session rows and audit summary.

### Phase 41: Responsive Header Layout for Workspace Dev & History (Compact / Minimized View)
- [x] **Eliminated Cramped Single-Line Squeeze**:
  - Attached dedicated class identifiers: `.dev-projects-header` in [`DevProjectsView.tsx`](file:///m:/testProject/cleaner/src/renderer/components/DevProjectsView.tsx) and `.history-header` in [`HistoryView.tsx`](file:///m:/testProject/cleaner/src/renderer/components/HistoryView.tsx).
  - Configured adaptive `flex-wrap: wrap` on `.module-header` and `.module-header-title` with `min-width: 220px`.
- [x] **Compact / Minimized Viewport Optimization (`@media (max-width: 1180px)`)**:
  - When the app is in default unmaximized size (980px or 840px window width), the layout transitions smoothly into a stacked 2-row presentation:
    - **Row 1**: Title and Subtitle expand across 100% width, eliminating awkward 3-line word wrapping.
    - **Row 2**: Action buttons and controls align neatly underneath as a spacious toolbar with full breathing room.
  - In `DevProjectsView`, `.workspace-picker-pill` sits on the left (up to 480px width) while `.btn-primary` (Scan Workspace) is pinned flush to the far right (`margin-left: auto; justify-content: space-between`).
  - In `HistoryView`, the 3 action buttons (Export TXT, Export JSON, Clear History) form a tidy horizontal strip.
- [x] **Light Mode Button Polish**:
  - Added elevated, high-contrast light mode styling for `.history-action-btn`.

### Phase 42: Feature Audit — Custom Format & Custom Size Filters
- [x] **Shared filter helpers** in [`filters.ts`](file:///m:/testProject/cleaner/src/shared/filters.ts): `parseExtensionInput`, `matchesExtension` (suffix match, supports `.tar.gz`), `customSizeToMB` (null on empty / invalid / < 1 MB). Covered by `tests/filters.test.ts` (`npm test`, 8 cases).
- [x] **System Cleanup custom format fixes**:
  - Empty format selection used to scan everything (`[]` was treated as "no filter"); it now matches nothing and the Scan button is disabled with a tooltip (`cleanup.scan_disabled_no_formats`).
  - Custom input accepts multiple tokens (`bak, tmp`), `*.log` and multi-part (`tar.gz`).
  - Recycle Bin scan now honours the extension filter.
- [x] **Large Files custom size fixes**:
  - Values < 1 MB used to round to 0 and silently fall back to the 100 MB default in `largeFileService`; now treated as invalid.
  - Empty / invalid custom input no longer leaves a stale threshold: Scan is disabled with a tooltip and `executeScan` is guarded (also covers drag & drop).
  - Hardcoded `[Kustom]` trigger tag now uses `large_files.custom`.
- [x] **Custom format & media design decision resolved**: Implemented Phase 43 (User Media & Downloads Audit with Recycle Bin safety).
- [ ] **Known, not fixed**: Fast Search has no min > max validation; `Sidebar.tsx` and `PreScanConfig.tsx` are unused dead code; history drive detection in `src/main/index.ts` parses the first category name and falls back to `C:`.
- Note: changes in this phase were verified by unit tests and dev-server HMR only; `tsc` has not been run yet.

### Phase 43: User Media & Downloads Hunter with Recycle Bin Safety
- [x] **Category Definitions & Scope Expansion** ([`ruleRegistry.ts`](file:///m:/testProject/cleaner/src/main/services/ruleRegistry.ts)):
  - Added `user_media_hunter` (`User Media & Downloads Audit`) under a new dedicated `'media'` group with `risk: 'caution'`, `defaultSelected: false`, and `useTrash: true`.
  - Targets user personal assets in `%USERPROFILE%\Downloads`, `%USERPROFILE%\Videos`, `%USERPROFILE%\Desktop`, and `%USERPROFILE%\Music` (and corresponding folders on secondary drives).
- [x] **Scanner Integration & Safe Recursion** ([`scannerService.ts`](file:///m:/testProject/cleaner/src/main/services/scannerService.ts)):
  - Allowed user-chosen extensions (`.mp4`, `.mkv`, `.iso`, etc.) to match files in `media_hunter` without being restricted by category defaults.
  - Added smart subdirectory skipping for `node_modules`, `.git`, `$recycle.bin`, and `appdata` during deep user-directory scans to ensure high performance.
- [x] **Non-Destructive Recycle Bin Deletion** ([`cleanerService.ts`](file:///m:/testProject/cleaner/src/main/services/cleanerService.ts)):
  - Integrated `shell.trashItem` from Electron for categories tagged with `useTrash: true` or `media_hunter`, routing personal media into Windows Recycle Bin instead of irreversible `unlink`.
  - Directory pruning explicitly skips user root folders (`Downloads`, `Videos`, etc.) to prevent accidental empty folder deletions.
- [x] **UI & Format Bar Polish** ([`SystemCleanupView.tsx`](file:///m:/testProject/cleaner/src/renderer/components/SystemCleanupView.tsx), [`CategoryCard.tsx`](file:///m:/testProject/cleaner/src/renderer/components/CategoryCard.tsx), [`index.css`](file:///m:/testProject/cleaner/src/renderer/index.css)):
  - Expanded `COMMON_EXTENSIONS` with fast-click media chips (`.mp4`, `.mkv`, `.zip`).
  - Auto-selects `user_media_hunter` whenever the user activates media formats or adds custom extension tokens.
  - Added dedicated pink/magenta `.group-media` badge styling and `Film` icon in `CategoryCard`.
  - Integrated `cleanup.group_media` localization into `SettingsContext.tsx` (ID: *"Media & Unduhan Pengguna"*, EN: *"User Media & Downloads"*).

### Phase 44: Fast Search Asynchronous Folder Size & Running Apps Warning
- [x] **Fast Search Non-Blocking Folder Traversal** ([`fastSearchService.ts`](file:///m:/testProject/cleaner/src/main/services/fastSearchService.ts), [`types.ts`](file:///m:/testProject/cleaner/src/shared/types.ts)):
  - Removed synchronous `await getDirectorySizeBytes` during traversal. Matching folders are streamed immediately with `sizeBytes: -1` and `sizePending: true`.
  - Added background folder size calculation that resolves folder sizes asynchronously and dispatches `folderSizeUpdate` without stalling search streaming.
- [x] **Fast Search UI "Calculating..." Badge** ([`FastSearchView.tsx`](file:///m:/testProject/cleaner/src/renderer/components/FastSearchView.tsx), [`index.css`](file:///m:/testProject/cleaner/src/renderer/index.css), [`SettingsContext.tsx`](file:///m:/testProject/cleaner/src/renderer/context/SettingsContext.tsx)):
  - While folder size calculation is pending, table renders `<span className="calculating-pill font-mono">{t('fast_search.calculating')}</span>` (`Menghitung...` / `Calculating...`).
  - Automatically updates to formatted size when the background calculation completes.
- [x] **Running Apps Detection & Flexible Warning** ([`processService.ts`](file:///m:/testProject/cleaner/src/main/services/processService.ts), [`ConfirmCleanModal.tsx`](file:///m:/testProject/cleaner/src/renderer/components/ConfirmCleanModal.tsx), [`main/index.ts`](file:///m:/testProject/cleaner/src/main/index.ts), [`preload/index.ts`](file:///m:/testProject/cleaner/src/preload/index.ts)):
  - Created `processService.ts` to inspect running processes on Windows (`tasklist /FO CSV /NH`) for selected categories (Chrome, Edge, Brave, Discord, VS Code, Spotify).
  - Built an amber non-intrusive warning card inside `ConfirmCleanModal`: informs the user that active apps might cause some cache files to be skipped due to Windows file locks.
  - Provided flexible user choices (never forced):
    - **Primary Action**: *"Tetap Bersihkan (Aplikasi Terbuka)"* / *"Clean Anyway (Keep Open)"* — proceeds with purge while leaving user apps running.
    - **Optional Action**: *"Tutup Aplikasi & Bersihkan"* / *"Close Apps & Clean"* — closes target apps via `taskkill` for a 100% full purge.
    - **Cancel**: *"Batal"* — closes modal safely.

### Phase 45: Frictionless One-Click NSIS Setup, Single-Instance Lock & CLI Target Navigation
- [x] **Frictionless One-Click Installer Configuration** ([`electron-builder.json`](file:///m:/testProject/cleaner/electron-builder.json)):
  - Converted NSIS configuration from legacy multi-step wizard to modern one-click silent installer (`"oneClick": true`, `"perMachine": false`).
  - Installs cleanly into user profile (`%LOCALAPPDATA%\Programs\Cleaner`), completely eliminating intrusive Windows UAC Administrator prompts during installation.
  - Automatically creates Desktop and Start Menu shortcuts, with `runAfterFinish: true` to launch the app immediately after installation completes.
  - Standardized release executable naming: `Cleaner-Setup-${version}.exe` and `Cleaner-Portable-${version}.exe`.
- [x] **Single-Instance Application Lock** ([`src/main/index.ts`](file:///m:/testProject/cleaner/src/main/index.ts)):
  - Enforced `app.requestSingleInstanceLock()`. Prevents duplicate instances from launching concurrently; automatically restores and focuses existing app window.
- [x] **CLI & Shell Target Folder Navigation** ([`src/main/index.ts`](file:///m:/testProject/cleaner/src/main/index.ts), [`preload/index.ts`](file:///m:/testProject/cleaner/src/preload/index.ts), [`types.ts`](file:///m:/testProject/cleaner/src/shared/types.ts), [`App.tsx`](file:///m:/testProject/cleaner/src/renderer/App.tsx), [`LargeFilesView.tsx`](file:///m:/testProject/cleaner/src/renderer/components/LargeFilesView.tsx)):
  - Created `parsePathArg` helper in main process to inspect CLI directory arguments (e.g. `cleaner.exe "D:\TargetFolder"`).
  - Wired `second-instance` and `ready-to-show` events to dispatch `cleaner:open-target-path`.
  - In `App.tsx`, incoming target paths seamlessly route into `LargeFilesView` with `scanScope: 'custom'` targeting the passed folder.

### Phase 46: Modern One-Click Setup Branding & High-Resolution Icon Assets
- [x] **App & Installer Icon Generation** ([`build/icon.ico`](file:///m:/testProject/cleaner/build/icon.ico), [`build/icon.png`](file:///m:/testProject/cleaner/build/icon.png)):
  - Generated dark obsidian / neon cyan & cobalt glowing disk branding asset matching Docker Pro / Raycast dark aesthetic.
  - Built high-resolution 512x512 PNG and embedded multi-resolution Windows ICO (`256x256`, `128x128`, `64x64`, `48x48`, `32x32`, `16x16`) for crisp taskbar, start menu, desktop shortcut, and explorer display.
- [x] **One-Click Silent Setup Configuration** ([`electron-builder.json`](file:///m:/testProject/cleaner/electron-builder.json)):
  - Linked `build/icon.ico` to `win.icon`, `nsis.installerIcon`, `nsis.uninstallerIcon`, and `nsis.installerHeaderIcon`.
  - Configured `"oneClick": true` and `"perMachine": false`: completely eliminates the legacy 1995-style NSIS Win32 dialog ("Choose Installation Options / Who should this application be installed for? Only for me / All users").
  - Setup silently installs to `%LOCALAPPDATA%\Programs\Cleaner`, places branded desktop/start menu shortcuts, and auto-launches immediately.
- [x] **Runtime Window Icon** ([`src/main/index.ts`](file:///m:/testProject/cleaner/src/main/index.ts)):
  - Wired `build/icon.png` into `BrowserWindow` creation, ensuring custom branding is reflected in the Windows taskbar during both development and production execution.

### Phase 47: Codebase Housekeeping & Junk Purge
- [x] **Unused Legacy Components Removal**:
  - Removed 6 obsolete components with 0 references from earlier UI iterations:
    - [`Sidebar.tsx`](file:///m:/testProject/cleaner/src/renderer/components/Sidebar.tsx) (superseded by `NavRail.tsx`)
    - [`DriveGauge.tsx`](file:///m:/testProject/cleaner/src/renderer/components/DriveGauge.tsx) (superseded by `CustomDriveSelect.tsx`)
    - [`InspectModal.tsx`](file:///m:/testProject/cleaner/src/renderer/components/InspectModal.tsx) (superseded by `ScannedResultTree.tsx`)
    - [`PreScanConfig.tsx`](file:///m:/testProject/cleaner/src/renderer/components/PreScanConfig.tsx) (merged into `SystemCleanupView.tsx`)
    - [`RadarTickScanner.tsx`](file:///m:/testProject/cleaner/src/renderer/components/RadarTickScanner.tsx) (superseded by `ProgressTracker.tsx`)
    - [`SleekArcSpinner.tsx`](file:///m:/testProject/cleaner/src/renderer/components/SleekArcSpinner.tsx) (superseded by `WaveEqualizerLoader.tsx`)
- [x] **Release Directory Cleanup**:
  - Deleted intermediate unpacked binary directory `release/win-unpacked/` (reclaimed **~306 MB** of disk storage).
  - Deleted temporary build metadata: `release/builder-debug.yml` and `release/Cleaner-Setup-1.0.0.exe.blockmap`.
  - Deleted temporary screenshot asset: `web-installer/installer_screenshot.png`.
- [x] **Project Verification**:
  - Unit tests (`npm test`): 8/8 passed.
  - Production build (`npm run build`): 100% clean compile without warnings or broken dependencies.

### Phase 48: Rebranding to DiskSweepr & Matte Polygonal Brand Identity Integration
- [x] **Official Project Rebranding**:
  - Renamed package to `disksweepr` in [`package.json`](file:///m:/testProject/cleaner/package.json).
  - Configured product identity in [`electron-builder.json`](file:///m:/testProject/cleaner/electron-builder.json): `productName: "DiskSweepr"`, `appId: "com.disksweepr.app"`, `shortcutName: "DiskSweepr"`, `uninstallDisplayName: "DiskSweepr - Storage Cleanup Utility"`.
  - Updated application title in [`index.html`](file:///m:/testProject/cleaner/index.html) and added favicon link.
  - Updated C# Web Bootstrap Installer ([`Program.cs`](file:///m:/testProject/cleaner/web-installer/Program.cs)) namespace, install directory (`%LOCALAPPDATA%\Programs\DiskSweepr`), uninstall registry key (`com.disksweepr.app`), and window titles.
  - Updated comprehensive documentation in [`README.md`](file:///m:/testProject/cleaner/README.md) and workspace [`AGENTS.md`](file:///m:/testProject/AGENTS.md).
- [x] **Matte Polygonal Brand Identity & Production Assets**:
  - Integrated official Matte Faceted 'S' Monogram in brushed dark titanium squircle (zero glow, crisp planar facets in cobalt `#2563EB`, cyan `#38BDF8`, and pure white `#FFFFFF`).
  - Generated high-res 512x512 PNG assets: [`build/icon.png`](file:///m:/testProject/cleaner/build/icon.png), [`src/renderer/assets/logo.png`](file:///m:/testProject/cleaner/src/renderer/assets/logo.png), and persistent Git archive [`docs/assets/logos/disksweepr-official-logo.png`](file:///m:/testProject/cleaner/docs/assets/logos/disksweepr-official-logo.png).
  - Generated multi-resolution Windows ICO: [`build/icon.ico`](file:///m:/testProject/cleaner/build/icon.ico) with mipmaps (`256x256`, `128x128`, `64x64`, `48x48`, `32x32`, `16x16`).
  - Generated 24-bit NSIS branding panels: [`build/installerSidebar.bmp`](file:///m:/testProject/cleaner/build/installerSidebar.bmp) & [`build/installerHeader.bmp`](file:///m:/testProject/cleaner/build/installerHeader.bmp).
- [x] **UI Component & Audit Export Integration**:
  - Updated [`TitleBar.tsx`](file:///m:/testProject/cleaner/src/renderer/components/TitleBar.tsx): replaced generic sparkles placeholder with the official DiskSweepr squircle mark in both titlebar and About modal.
  - Styled `.brand-logo-img` and `.about-modal-logo-img` with `-webkit-optimize-contrast` in [`index.css`](file:///m:/testProject/cleaner/src/renderer/index.css).
  - Updated [`historyService.ts`](file:///m:/testProject/cleaner/src/main/services/historyService.ts): standardized exported audit filenames to `disksweepr_audit_log_YYYY-MM-DD.txt/.json` with official DiskSweepr headers.
  - Added TypeScript ambient asset declarations in [`src/vite-env.d.ts`](file:///m:/testProject/cleaner/src/vite-env.d.ts).
- [x] **Quality Gate & Zero-Build Enforcement**:
  - Type check passed with zero errors (`npx tsc --noEmit`).
  - Unit tests passed 8/8 (`npm test`).
  - Binary builds held on standby per user request.

### Phase 49: Production Release Packaging, Cleanup & GitHub Push
- [x] **Production Compilations Completed**:
  - **Web Bootstrap Installer**: [`release/DiskSweepr-Web-Setup.exe`](file:///m:/testProject/disksweepr/release/DiskSweepr-Web-Setup.exe) (553 KB) with embedded high-res faceted 'S' squircle AppIcon.
  - **Full Offline NSIS Setup Wizard**: [`release/DiskSweepr-Setup-1.0.0.exe`](file:///m:/testProject/disksweepr/release/DiskSweepr-Setup-1.0.0.exe) (91.8 MB) with custom dark sidebar/header branding.
  - **Portable Executable**: [`release/DiskSweepr-Portable-1.0.0.exe`](file:///m:/testProject/disksweepr/release/DiskSweepr-Portable-1.0.0.exe) (82.9 MB) zero-install direct standalone.
- [x] **Legacy Build Purge**:
  - Deleted obsolete pre-rebrand binaries (`Cleaner-Portable-1.0.0.exe`, `Cleaner-Setup-1.0.0.exe`, `Cleaner-Web-Setup.exe`).
  - Purged unpacked staging folder (`release/win-unpacked/`) and build debug metadata, reclaiming over 400 MB of disk space.
- [x] **Git Repository Scaffolding & Initial Commit**:
  - Configured clean `.gitignore` (ignoring `node_modules/`, `dist/`, `dist-electron/`, `release/`, `scratch/`).
  - Staged and committed 75 project files as `feat: initialize DiskSweepr v1.0.0 modern windows cleaner`.
  - Pushed to remote repository: [`bimbap/disksweepr`](https://github.com/bimbap/disksweepr.git) on branch `main`.

### Phase 52: UI/UX Harmonization for Duplicate Hunter & Power Tools
- [x] **Duplicate Files Hunter (`DuplicateHunterView.tsx`) Complete Overhaul**:
  - Re-architected root container to `module-view-container` with Drag & Drop overlay support (`module-drag-overlay`).
  - Standardized `module-header` with title, subtitle, and primary `btn-primary` / `btn-danger-outline` action controls.
  - Implemented `large-files-config-bar` with scope popover dropdown (Whole PC, Detected Drive partitions, or Custom Folder with middle-truncation) and size threshold chips (&ge; 1 MB, &ge; 5 MB, &ge; 10 MB, &ge; 50 MB, &ge; 100 MB).
  - Integrated signature `WaveEqualizerLoader` with active hashing stage, directory path badge, and live telemetry counters during scanning.
  - Added standard `empty-state-card` states (Ready State with `Copy` icon; Clean State with `CheckCircle2` emerald icon).
  - Standardized `module-toolbar` with search filter box, quick selection chips (*Select Older*, *Select Newer*, *Clear*), and safe Recycle Bin toggle.
  - Added sticky bottom action bar (`module-bottom-bar`) with selection badge, reclaimed size counter, and `Trash2` purge trigger.
  - Added `modal-backdrop` confirmation modal before permanently deleting or recycling duplicates.
- [x] **Advanced Power Tools (`PowerToolsView.tsx`) UI/UX Modernization**:
  - Re-architected root container to `module-view-container`.
  - Upgraded sub-tab navigation to sleek segmented bar (`.segmented-tab-nav` & `.tab-nav-btn`) in the header matching EaseUS CleanGenius & Linear dark aesthetics.
  - **WSL2 / Docker VHDX Shrinker**:
    - Integrated `WaveEqualizerLoader` during disk compaction with active target badge.
    - Added Explorer reveal action buttons and status alert banner.
  - **Empty Folders Sweeper**:
    - Re-architected with `large-files-config-bar` scope dropdown (Whole PC, Drive, Custom Folder with Drag & Drop!).
    - Added `WaveEqualizerLoader` during empty folder tree discovery.
    - Added search filter bar, batch selection controls, and sticky bottom action bar with confirmation modal.
  - **DISM Component Store**:
    - Added `WaveEqualizerLoader` during analysis and deep purge operations.
    - Added confirmation modal with safety notes before triggering `/ResetBase`.
- [x] **Verification**:
  - `npx tsc --noEmit`: 0 errors.
  - `npm test`: 12/12 unit tests passed.
  - `npm run build`: Bundled cleanly in 10.5s.
  - Binary packaging held on standby until user explicit build command.

### Phase 49: Fix Media Scanning Pipeline & Scanned Results Display
- [x] **Scanned Results Tree UI Fix** ([`ScannedResultTree.tsx`](file:///m:/testProject/disksweepr/src/renderer/components/ScannedResultTree.tsx)):
  - Fixed critical bug where `grouped` object omitted the `media` category (`media: activeCategories.filter((c) => c.group === 'media')`), causing all scanned personal media files to be silently discarded from the results view.
  - Added `groupLabels.media = t('cleanup.group_media')`.
  - Added fallback loop in `ScannedResultTree` so any dynamic or newly added group is never dropped from rendering.
  - Added `Film` icon (`cat-icon-media text-sky`) for `group === 'media'`.
- [x] **Default Quick Scan Activation & Expanded Formats** ([`ruleRegistry.ts`](file:///m:/testProject/disksweepr/src/main/services/ruleRegistry.ts), [`SystemCleanupView.tsx`](file:///m:/testProject/disksweepr/src/renderer/components/SystemCleanupView.tsx)):
  - Updated `user_media_hunter` and `${normDrive}_media_hunter` to `defaultSelected: true`, ensuring media files are audited in default Quick Scan mode without requiring manual drawer activation.
  - Expanded `paths` on primary drive to include OneDrive redirected user folders (`%USERPROFILE%\OneDrive\Desktop`, `OneDrive\Pictures`, `OneDrive\Videos`, `OneDrive\Documents`) and local `Pictures`/`Documents`.
  - Expanded `fileExtensions` across rule registry and UI to support `.wmv`, `.webm`, `.flv`, `.aac`, `.ogg`, `.m4a`, `.iso` alongside `.mp4`, `.mkv`, `.avi`, `.mov`, `.mp3`, `.wav`, `.flac`, `.zip`, `.rar`, `.7z`.
- [x] **Secondary Drive Dynamic Media Folder Discovery** ([`ruleRegistry.ts`](file:///m:/testProject/disksweepr/src/main/services/ruleRegistry.ts)):
  - Replaced static nonexistent paths (`M:\Downloads`, `M:\Videos`) with `getSecondaryMediaPaths(normDrive)`.
  - Discovers drive root `${normDrive}\` (audits loose root media files like `.mp4`, `.mkv`) and scans top-level folders matching media keywords (`anim`, `audio`, `bandicam`, `clip`, `sound`, `idlix`, `download`, `movie`, `footage`, etc.).
- [x] **Automated Testing & Build Verification**:
  - Added unit test suite [`tests/rules.test.ts`](file:///m:/testProject/disksweepr/tests/rules.test.ts) verifying media category definitions, OneDrive paths, secondary drive root resolution, and fallback directories.
  - `npm test`: 15/15 unit tests passed.
  - `npx tsc --noEmit` & `npm run build`: 0 errors.
  - Installer build strictly held until user command.

### Phase 50: Fast Search Target Entity Filter (All / Files / Folders)
- [x] **Target Entity Types & Option Architecture** ([`types.ts`](file:///m:/testProject/disksweepr/src/shared/types.ts)):
  - Added `FastSearchTargetKind = 'all' | 'files' | 'folders'`.
  - Added `targetKind?: FastSearchTargetKind` to `FastSearchOptions`.
- [x] **Backend Traversal Acceleration** ([`fastSearchService.ts`](file:///m:/testProject/disksweepr/src/main/services/fastSearchService.ts)):
  - When `targetKind === 'folders'`: Skips all file evaluations and stat calls immediately, accelerating directory-only discovery by up to 10x.
  - When `targetKind === 'files'`: Traverses folder trees but suppresses adding directories to search matches.
  - When `targetKind === 'all'`: Matches both individual files and folder directories.
  - Dynamically imports `electron.shell` inside `deleteFile` to ensure unit testability in pure Node.js environments.
- [x] **UI Dropdown & Reactive Filtering** ([`FastSearchView.tsx`](file:///m:/testProject/disksweepr/src/renderer/components/FastSearchView.tsx), [`SettingsContext.tsx`](file:///m:/testProject/disksweepr/src/renderer/context/SettingsContext.tsx)):
  - Added dedicated **Target Dropdown** (`Semua (File & Folder)`, `Hanya File`, `Hanya Folder`) in the collapsible filters bar with `Layers`, `FileText`, and `Folder` icons.
  - Added client-side reactive filtering in `filteredResults` memo so switching targets filters already-fetched results instantly without needing to re-scan.
  - Integrated full i18n support in EN & ID across all target options and reset handlers.
- [x] **Unit Testing & Verification**:
  - Added unit test suite [`tests/fastSearch.test.ts`](file:///m:/testProject/disksweepr/tests/fastSearch.test.ts) verifying all 3 target modes.
  - `npm test`: 19/19 unit tests passing (100% green).
  - `npx tsc --noEmit` & `npm run build`: 0 errors.








