# Visual Design System
## Project: Windows System Cleaner (Codename: Cleaner)

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
* Fixed width of `72px` positioned on the left edge.
* Module items stacked vertically:
  * 🧹 **Cleanup**: System junk and cache cleaner.
  * 🐋 **Large Files**: Deep drive scan for hefty files (>100MB to >1GB).
  * ⚡ **Dev Repos**: Node modules & build artifact hunter.
  * 📜 **History**: Historical audit log of reclaimed storage.
* Interactive active indicator with left accent bar and emerald icon glow.

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
* **Stage 3 (Audit Review & Bento Grid)**:
  * Top summary banner displaying total reclaimable space.
  * Responsive bento cards with domain-specific Lucide icons (`Globe`, `Code2`, `Flame`, etc.), risk pills, and tactile toggle switches.
  * "Inspect" button to preview individual queued files.
  * "Clean Selected" CTA button.
* **Stage 4 (Purging)**:
  * Real-time file deletion tracker with smooth completion percentage.
* **Stage 5 (Summary Celebration)**:
  * Clean completion graphic, freed space tally, duration, and one-click "Done" button returning to setup.

### 4.4 Inspect File Modal (`InspectModal`)
* Pop-up dialog displaying the full list of files queued for deletion.
* Search filter to search by file name or extension.
* Shows path, size, and a "Reveal in Explorer" button.

### 4.5 Permanent Deletion Safety Modal (`ConfirmCleanModal`)
* Explicit warning detailing the non-recoverable nature of the permanent file purge.
* Lists selected category count and aggregate byte payload before user gives final execution approval.
