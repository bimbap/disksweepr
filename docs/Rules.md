# Engineering Rules & Safety Guardrails
## Project: DiskSweepr (Official Name: DiskSweepr, Codename: Cleaner)

---

## 1. Safety & Data Protection Invariants (CRITICAL)

The integrity of the user's operating system and personal data takes absolute priority over all other considerations. Every line of code that touches the filesystem must adhere to these rules:

1. **Strict Allowed Boundaries**:
   * The cleaner must ONLY target predetermined cache, temp, and dump directories.
   * Personal user folders (`Documents`, `Desktop`, `Pictures`, `Music`, `Videos`, `Downloads`) are strictly FORBIDDEN from bulk deletion.
   * System binary roots (`C:\Windows\System32`, `C:\Windows\SysWOW64`, `C:\Program Files`, `C:\Program Files (x86)`) must NEVER be targets of recursive unlinking.

2. **Containment Verification**:
   * Before unlinking any file or directory, the target path must be canonicalized (`path.resolve()`) and verified to strictly reside within an authorized root target:
     ```typescript
     function isSafeTarget(targetFile: string, allowedRoot: string): boolean {
       const resolvedTarget = path.resolve(targetFile);
       const resolvedRoot = path.resolve(allowedRoot);
       return resolvedTarget.startsWith(resolvedRoot) && resolvedTarget !== resolvedRoot;
     }
     ```
   * Never delete the target container directory itself if it is a system folder (e.g. `C:\Windows\Temp` must not be deleted, only its *contents*).

3. **No Symbolic Link Traversals**:
   * If a scanned directory entry is a symlink or junction (`dirent.isSymbolicLink()`), do NOT recurse into it. Only unlink the link itself or skip it.

4. **Resilient Error Trapping**:
   * Files actively in use by Windows or open applications will throw `EBUSY` or `EPERM`.
   * **Rule**: Catch these errors gracefully. Never crash the process or abort the rest of the queue. Increment `skippedFilesCount` and append to the execution audit log.

5. **No Registry Modifications in Phase 1**:
   * Registry cleaning provides negligible space recovery and carries severe risk. Registry writes or deletes are banned in this phase.

---

## 2. Code Quality & Architecture Standards

1. **TypeScript Strict Mode**:
   * `noImplicitAny: true`, `strictNullChecks: true`.
   * IPC channels must be typed via shared interface definitions in `src/shared/types.ts`.
2. **Context Isolation**:
   * Electron `contextIsolation: true` and `nodeIntegration: false` must always remain enabled.
   * Only communicate through `cleanerApi` in preload.
3. **No UI Freezing**:
   * Long-running I/O operations (scanning 100k files) must run asynchronously in non-blocking batches.
   * Progress events must be throttled/batched (e.g. emitting UI events every 50ms) to prevent IPC channel flooding.
4. **No Placeholder Data**:
   * File sizes, paths, and drive metrics must always query live Windows APIs. Never use mock numbers in production code.

---

## 3. Windows Shell Specifics

1. **Recycle Bin Handling**:
   * Use native PowerShell `Clear-RecycleBin -Force -ErrorAction SilentlyContinue` or Windows Shell API for emptying the trash bin across all drives.
2. **UAC / Administrator Rights**:
   * Identify which folders require elevation (`C:\Windows\Temp`, `SoftwareDistribution\Download`).
   * If elevation is required, request user permission explicitly or skip gracefully with a clear badge.

---

## 4. UI/UX Consistency & Anti-Scratch Development Invariants

To avoid UI anomalies and stop re-implementing visual components from scratch, every new feature MUST follow these established blueprints:

1. **Mandatory Reuse of Data Table Architecture**:
   * Any file or item list MUST use the standard `fast-search-table` with `table-layout: fixed`.
   * Column headers MUST use `SortableTh` with bidirectional sorting (ascending/descending/neutral arrows).
   * Text cells MUST enforce `min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`.
   * Fixed column widths MUST be used for checkboxes, sizes, dates, and actions to prevent jitter or layout squeezing.
   * NEVER invent ad-hoc CSS Grid or block-flow tables for scalable data lists.

2. **Mandatory Pagination for Scalable Lists**:
   * Any view that can render >50 items MUST integrate `PaginationBar` with `PAGE_SIZE = 50`.
   * When search filters or sort orders change, the active page MUST automatically reset to page 1.

3. **Mandatory Quad-Way Modal Dismissal & Frosted Glass Backdrop**:
   * All confirmation modals MUST support 4 independent ways to dismiss:
     1. Outside click on `.modal-backdrop`.
     2. Keyboard `Escape` key listener.
     3. Top-right close button (`.modal-close-btn` with `<X size={16} />`).
     4. Footer cancel button (`btn-ghost`).
   * Backdrops MUST use frosted glass (`rgba(8, 12, 20, 0.50)` + `backdrop-filter: blur(16px)`). Never use pitch-black opaque overlays.
   * Action descriptions MUST display both item count AND total affected bytes (e.g. `Total: 190.4 MB`).

4. **Selection State Completeness**:
   * Sticky bottom bars (`.module-bottom-bar`) MUST display:
     `{count} items selected • {formatBytes(totalSelectedBytes)}`
   * Never show only item count when byte size is available.
   * Action buttons in bottom bars MUST have a minimum gap of `12px` to prevent cramped click targets.

5. **Header & Sub-Tab Separation**:
   * Never squeeze segmented tab switchers (`.segmented-tab-nav`) into the module title row.
   * The sub-tab navigation MUST sit in a dedicated row (`.recovery-tabs-row` or equivalent) below the header title and description.

6. **Pure Utility Extraction & Unit Testing**:
   * Business logic for sorting, date parsing, path decomposition, and filtering MUST NOT be inlined inside React components.
   * Extract them as pure functions into `src/shared/` and write automated regression unit tests in `tests/`.

7. **Zero Fake Clean States**:
   * If an item list is empty because an active search/filter yielded 0 matches, display a dedicated search-empty card with a 1-click `"Reset Filter"` button.
   * Never display `"System is clean"` or `"Recycle bin is clean"` when items actually exist but are filtered out by a search query.

8. **Custom Dark Scrollbar Compatibility**:
   * Never apply CSS standard `scrollbar-width: thin` or `scrollbar-color` on scrollable containers, as Chromium disables `::-webkit-scrollbar` pseudo-elements when standard properties are present and falls back to native light OS scrollbars. Always rely on `::-webkit-scrollbar` rules.

9. **Installer UI & Wizard Invariants (CRITICAL)**:
   * **Web Installer (`web-installer/Program.cs`)**:
     * NEVER add marketing feature badges (`Instant Scan`, `Risk Rated`, `Privacy First`) or Unicode emojis (`⚡`, `🛡️`, `🔒`) to the WinForms GDI+ canvas.
     * ALWAYS assign `this.Text = "DiskSweepr Setup"` and `this.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath)` on `ModernWebInstaller` so Windows Taskbar and `Alt+Tab` render the official app icon and window title.
   * **Offline NSIS Setup (`electron-builder.json` & `build/installer.nsh`)**:
     * NEVER set `"perMachine": true` in `electron-builder.json` (which suppresses the NSIS user-mode page). Always keep `"perMachine": false`, `"selectPerMachineByDefault": true`, and `"allowElevation": true` so the user can choose between All Users and Current User.
     * ALWAYS preserve the `customPageAfterChangeDir` `nsDialogs` page in `build/installer.nsh` so the user can explicitly check/uncheck Desktop shortcut, Start Menu shortcut, and Windows Explorer context menu integration during setup.
