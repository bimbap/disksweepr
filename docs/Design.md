# Visual Design System
## Project: DiskSweepr (Official Name: DiskSweepr, Codename: Cleaner)

---

## 1. Aesthetic Direction: Sleek Minimalist & Utilitarian

The design philosophy draws direct inspiration from high-craft developer tools like **Linear**, **Raycast**, and **Vercel**:
* **Intentional Minimalism**: No cluttered gimmicks, no loud gradients, no cartoonish mascots.
* **Tactile Precision**: 1px subtle translucent borders, micro-interactions with snappy 150–200ms ease-out transitions, and generous breathing room.
* **Information Density**: Clean data tables with tabular figures (`tabular-nums`) so file sizes, file counts, and percentages align flawlessly without jittering.
* **Modern Windows Integration**: Custom frameless dark window with native-feel titlebar controls and rounded modern edges.

---

## 2. Color Palette & Semantic Tokens

```css
:root {
  /* Surfaces */
  --bg-app: #0c0e12;             /* Deep obsidian canvas */
  --bg-surface: #13171f;         /* Card / Container surface */
  --bg-surface-hover: #1a202c;   /* Interactive hover state */
  --bg-surface-active: #222938;  /* Pressed state */
  --bg-overlay: rgba(12, 14, 18, 0.85); /* Modal backdrop with blur */

  /* Borders & Dividers */
  --border-subtle: rgba(255, 255, 255, 0.07);
  --border-hover: rgba(255, 255, 255, 0.15);
  --border-active: rgba(255, 255, 255, 0.25);

  /* Typography */
  --text-primary: #f1f5f9;       /* Slate 100 */
  --text-secondary: #94a3b8;     /* Slate 400 */
  --text-muted: #64748b;         /* Slate 500 */
  --text-disabled: #475569;      /* Slate 600 */

  /* Accents & Status Indicators */
  --accent-primary: #10b981;     /* Emerald 500 - Primary Clean / Safe Action */
  --accent-hover: #059669;       /* Emerald 600 */
  --accent-glow: rgba(16, 185, 129, 0.2);
  
  --status-safe: #10b981;        /* Emerald - Safe to purge */
  --status-recommended: #06b6d4; /* Cyan - Recommended */
  --status-caution: #f59e0b;     /* Amber - Requires attention */
  --status-danger: #ef4444;      /* Rose - Dangerous */

  /* Storage Meter */
  --meter-used: #3b82f6;         /* Blue 500 */
  --meter-reclaimable: #10b981;  /* Emerald 500 (striped animation) */
  --meter-free: #1e293b;         /* Slate 800 */
}
```

---

## 3. Typography Scale & Layout Foundations

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif;
font-feature-settings: "cv02", "cv03", "cv04", "cv11";
```

### Scale
* **Display / Hero Metric**: `32px` / `bold` / `tracking: -0.02em` (e.g. `12.4 GB to reclaim`)
* **Heading 1**: `20px` / `semibold` / `tracking: -0.01em`
* **Heading 2**: `15px` / `medium`
* **Body Regular**: `13px` / `regular` / `line-height: 1.5`
* **Caption / Meta**: `11px` / `medium` / `letter-spacing: 0.02em`
* **Mono / Figures**: `12px` / `ui-monospace, monospace` / `font-variant-numeric: tabular-nums`

---

## 4. Key UI Components

### 4.1 Frameless Modern Header (`TitleBar`)
* Custom window drag region (`-webkit-app-region: drag`).
* Minimalist window controls (Minimize, Maximize, Close) with subtle hover effects.
* App logo and title.

### 4.2 Ultra-Slim Left Nav Rail (`NavRail`) — EaseUS CleanGenius Inspired
* Fixed width of `72px` positioned on the left edge, vertically scrollable (`overflow-y: auto; min-height: 0;`) on compact windows (`minWidth: 680, minHeight: 400`) using the global dark custom `::-webkit-scrollbar` (never `scrollbar-width: thin`).
* Module items stacked vertically:
  * 🧹 **Cleanup (`system`)**: System junk and cache cleaner (default landing module).
  * 🔍 **Fast Search (`fast_search`)**: Instant filesystem search across drives.
  * 🐋 **Large Files (`large_files`)**: Deep drive scan for hefty files (>100MB to >5GB).
  * 📑 **Duplicates (`duplicates`)**: Hash-based duplicate file scanner across drives.
  * ⚡ **Dev Repos (`dev_projects`)**: Node modules & build artifact hunter.
  * 🛠️ **Power Tools (`tools`)**: Windows system tools (WSL2/Docker VHDX Shrinker, Empty Folders Sweeper, DISM Component Store).
  * 🔄 **File Recovery (`recovery`)**: Recycle Bin manager & Deep file undelete scraper.
  * 📜 **History (`history`)**: Historical audit log of reclaimed storage.
* Interactive active indicator with left accent bar and cyan/emerald icon glow.

### 4.3 Progressive Step-by-Step Cleanup Canvas (`SystemCleanupView`)
* **Stage 1 (Hero Setup)**:
  * Welcoming hero headline & concise subtext.
  * Active drive selector dropdown + live storage visual usage bar.
  * Scan mode segmented pills (`Quick`, `Full`, `Custom`).
  * Big, prominent **"Scan Drive X"** CTA button.
  * Collapsible *"Customize Targets"* drawer for granular category and extension toggle options.
  * Right-hand clean graphic illustration with monitor & cleaner motif.
* **Stage 2 (Scanning)**:
  * Animated progress bar and path tracker showing current files being scanned.
* **Stage 3 (Audit Review & Expandable Tree)**:
  * Top summary banner displaying total reclaimable space and selected file count.
  * Grouped category cards (`ScannedResultTree`) with domain-specific Lucide icons (`Globe`, `Code2`, `Flame`, `Film`, etc.), risk pills, and checkboxes (with indeterminate `<Minus />` state when partially selected).
  * Expandable drawer showing individual files with per-file checkboxes (`onToggleFile`), Explorer reveal buttons, bidirectional sorting (`name`, `size`), and standard pagination (`20` files per page, zero nested scrollbars).
  * "Clean" CTA button opening `ConfirmCleanModal`.
* **Stage 4 (Purging)**:
  * Real-time file deletion tracker with smooth completion percentage.
* **Stage 5 (Summary Celebration)**:
  * Clean completion graphic, freed space tally, duration, and one-click "Done" button returning to setup.

### 4.4 Standard Data Table Component Pattern (`fast-search-table`)
Every data list or audit view in DiskSweepr (e.g. Fast Search, Recovery & Undelete, Large Files, Duplicates) MUST adhere to the standard table architecture:
* **HTML Element**: Standard `<table>` with `table-layout: fixed; width: 100%; border-collapse: separate; border-spacing: 0;`.
* **Sticky Sortable Header**:
  * `position: sticky; top: 0; z-index: 10; background: var(--bg-surface);`.
  * Header cells implement `SortableTh` with bidirectional arrows (`ArrowUp` for asc, `ArrowDown` for desc, `ArrowUpDown` for neutral).
  * Hover feedback with `var(--bg-surface-hover)` and `var(--accent-hover)`.
* **Text Truncation & Ellipsis Invariant**:
  * All variable-length text cells (`.file-name-title`, `.file-dir-link`) MUST use `min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`.
  * Fixed-width columns (`checkbox`: 62px, `size`: 100-110px, `date`: 125-140px, `actions`: 60-120px) guarantee zero column jumping or layout squeezing.
* **Row Interactions**:
  * Subtle hover transition: `background: var(--bg-surface-hover)`.
  * Selected row styling: `background: var(--accent-subtle)`.
  * Click on row toggles selection; click on path reveals in Windows Explorer via `onOpenExplorer(parentDir)`.
* **Responsive Horizontal Scroll**:
  * On viewports narrower than table min-width (`< 1000px`), tables preserve all essential columns (name, path, status, date, size, action) and enable smooth horizontal scrolling (`overflow-x: auto`) rather than truncating or hiding columns.

### 4.5 Standard Pagination Pattern (`table-pagination-bar`)
For any view displaying scalable items (Fast Search, Duplicate Hunter, File Recovery):
* **Page Size**: Standardized to `PAGE_SIZE = 50` items per page.
* **Layout**:
  * Bottom sticky bar: `display: flex; justify-content: space-between; align-items: center; padding: 10px 18px; border-top: 1px solid var(--border-subtle);`.
  * Left: `pagination-info` stating `Showing X - Y of Z results`.
  * Right: `pagination-controls` with Previous button (`ChevronLeft`), active page pill `X / Y`, and Next button (`ChevronRight`).
* **Auto-Reset Invariant**: Whenever search query, active filters, or sort column/direction change, the current page MUST automatically reset to page 1 via `useEffect`.

### 4.6 Standard Module Toolbar & Search Pattern (`recovery-toolbar` / `module-toolbar`)
* **Flexible Container**: `display: flex; align-items: center; flex-wrap: wrap; gap: 10px 12px; padding: 12px 28px; background: var(--bg-surface);`.
* **Search Box**:
  * Flex-grow with safe bounds: `flex: 1 1 220px; min-width: 160px; max-width: 420px;`.
  * Includes magnifying glass icon at left, clear cross button (`chip-remove-btn`) at right when populated.
* **Stat Indicators**:
  * Inline counter: `.recovery-toolbar-stat` formatted as `{count} items • {formatBytes(totalBytes)}` with muted separator dot.
* **Search State Differentiation**:
  * Clean / Empty module: displays green checkmark illustration (`empty-state-card clean`).
  * Empty search query match: displays search magnifying glass illustration with `"No results match '{query}'"` and a 1-click `"Reset Filter"` button. Never show "Module is clean" when search filter has 0 matches!

### 4.7 Standard Modal Dialogs with Frosted Glass (`.modal-backdrop` & `.modal-card`)
All confirmation modals (System Clean, Empty Recycle Bin, Permanent Purge, Restore, DISM Clean) must follow these strict rules:
* **Frosted Glass Backdrop**:
  * `background: var(--bg-overlay);` where `--bg-overlay: rgba(8, 12, 20, 0.50);` (translucent dark glass).
  * `backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);`.
  * Never use pitch-black or opaque overlays that mask the blur effect.
* **Quad-Way Dismissal**:
  1. Click outside modal card (`onClick={() => closeModal()}` on `.modal-backdrop`, `e.stopPropagation()` on `.modal-card`).
  2. Keyboard `Escape` key global event listener.
  3. Top-right close button (`.modal-close-btn` with `<X size={16} />`).
  4. Footer cancel button (`btn-ghost`).
* **Header Structure**:
  * `.modal-header`: `display: flex; justify-content: space-between; align-items: center; padding: 14px 20px;`.
  * `.modal-header-left`: Icon badge (danger/warning/safe) + Title.
  * `.modal-close-btn`: Top-right close button.
* **Payload Preview in Description**:
  * Warning modals MUST show both item count AND total affected bytes (e.g., `Total: 190.4 MB`).

### 4.8 Standard Segmented Sub-Tab Navigation (`segmented-tab-nav`)
* **Header Independence**: The sub-tab navigation MUST live in its own row below the module header title (`.recovery-tabs-row`), NEVER squeezed into the title row.
* **Visual Pill Style**:
  * Container: `.segmented-tab-nav` with `background: var(--bg-surface-elevated)` and `padding: 3px;`.
  * Tab buttons: `.tab-nav-btn` with icon, title, and optional badge count (`.tab-count-badge`).
  * Active state: `.tab-nav-btn.active` with `background: var(--bg-surface)` and accent color.

### 4.9 Standard Sticky Bottom Action Bar (`module-bottom-bar`)
* **Presence**: Renders whenever 1 or more items are selected in the active view.
* **Content**:
  * Left (`.bar-info`): `.badge-count` with number of items + `{count} items selected • {formatBytes(totalBytes)}`.
  * Right (`.bar-actions`): Primary action button (`btn-primary`), secondary/danger button (`btn-danger-outline`).
  * Spacing: Minimum `gap: 12px` between action buttons to prevent cramped touch/click targets.
