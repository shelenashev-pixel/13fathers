# iOS Safari Top & Bottom Bars (Mobile Edge-to-Edge)

When styling full-screen map, canvas, or overlay layouts for mobile iOS Safari (`@media (max-width: 760px)` with `viewport-fit=cover`):

1. **Avoid `<meta name="theme-color">` When Top and Bottom Bars Need Different Treatments**:
   - Do not use a static `<meta name="theme-color">` tag if the top status bar needs a tint (`--surface-soft` `#f5f2eb`) while the bottom Safari toolbar should remain translucent over the map or menu.
   - Instead, place a `position: fixed; inset: 0 0 auto;` strip at the top edge (e.g. `.app-header::after` with `height: max(4px, env(safe-area-inset-top, 0px))` and solid `background-color: var(--surface-soft)`) so WebKit's `PageColorSampler` tints only the top status bar, followed by a `68px` linear gradient (`.app-header::before`) from `var(--surface-soft)` to transparent.

2. **Stretch Full-Screen Map & Overlays Past `100lvh` into the Bottom Safe Area**:
   - In iOS Safari, `100lvh` excludes the `34px` bottom home-indicator safe area (`env(safe-area-inset-bottom)`), and `env(safe-area-inset-bottom)` can report `0px` while the floating toolbar is expanded—leaving a `34px` gap at the bottom if elements use `height: 100lvh`.
   - Set `body` to `min-height: 100dvh; height: calc(100lvh + max(34px, env(safe-area-inset-bottom, 0px))) !important;` (with `html { height: 100%; }`), and stretch `#map` and `.monks-panel` using `position: absolute; top: 0; right: 0; bottom: 0; left: 0; height: auto;` rather than `position: fixed` or a strict `height: 100lvh`.

3. **Keep Root & Map Backgrounds Transparent on Map View; Extend Surface in Menu State**:
   - On the map view, keep `html, body, #map { background-color: transparent; }` and use an absolute bottom blur overlay (`body::after` with `background: transparent`, `backdrop-filter: blur(12px)`, and a vertical alpha `mask-image`) so the map extends and blurs naturally underneath the Safari address bar.
   - In the menu state (`body.mobile-list-open`), set `body.mobile-list-open, html:has(body.mobile-list-open) { background-color: var(--surface-base); }` and pad `.monks-panel` into `max(34px, env(safe-area-inset-bottom, 0px))` with `.monks-panel::after` providing the progressive bottom blur.
