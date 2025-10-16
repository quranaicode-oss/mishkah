# Page Height & Scroll Guidelines for Mishkah HTMLx Layouts

## Why avoid forcing `100vh`
- Mobile browsers adjust the visual viewport when chrome (URL bar, bottom controls) shows or hides. Setting `height: 100vh` can produce awkward extra space or cause content to be hidden beneath overlays.
- On iOS Safari and many Android browsers, `100vh` ignores the safe areas caused by notches and dynamic bars. This can break touch targets or cause double scrollbars.
- Desktop monitors with very wide or tall viewports benefit from natural document flow so that long content can extend vertically without being artificially constrained.

## Recommended approach
1. **Let the document flow drive height**
   - Keep the root `html`/`body` elements at `min-height: 100%` and allow sections to grow based on their content.
   - Only constrain a component when the UI truly needs an internal scroll area (e.g., chat threads, side panels, tables).
2. **Use internal scroll containers sparingly**
   - Wrap sections that must stay fixed (like dashboards or split panes) in a flex container and apply `overflow-y: auto` to the specific panel.
   - Ensure the parent uses `min-height: 100vh` or `min-h-screen` (Tailwind) so the layout fills the screen without forcing an absolute cap.
3. **Account for safe areas on mobile**
   - When a fixed header or footer is needed, apply padding using CSS environment variables such as `env(safe-area-inset-top)`.
   - Prefer `min-height: 100dvh` (dynamic viewport height) where supported; include fallbacks for older browsers (`min-height: 100vh`).
4. **Desktop & tablet considerations**
   - Desktop users often multitask with resizable windows; internal scroll areas ensure important panels remain accessible but avoid trapping the mouse wheel inside small containers.
   - Tablets share mobile browser constraints but typically display split-screen apps, so rely on flexible layouts rather than fixed viewport locks.

## Implementation tips in Mishkah projects
- Combine Tailwind utility classes (`min-h-screen`, `overflow-y-auto`) with CSS custom properties to adapt spacing across themes.
- When using Mishkah components inside HTMLx templates, ensure the parent scope sets layout utilities (`class="flex flex-col min-h-screen"`) and let children expand with `flex-1`.
- Test with Chrome/Android, Safari/iOS, and desktop resizing to confirm there are no double scrollbars or clipped footers.

Following these guidelines improves the UX consistency across mobile, tablet, and desktop experiences while respecting Mishkah's component philosophy.
