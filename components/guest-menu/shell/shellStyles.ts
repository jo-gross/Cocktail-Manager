/**
 * CSS for the guest shell chrome (search, chips, sheets). Uses only the theme
 * variables (`--gm-*`) – never the app theme – and is scoped to `.gm-shell`.
 */
export const SHELL_CSS = `
.gm-shell { position: relative; min-height: 100vh; min-height: 100dvh; background: var(--gm-bg); color: var(--gm-text); }
.gm-shell[data-contained="true"] { min-height: 100%; overflow: hidden; }
.gm-shell *:focus-visible { outline: 2px solid var(--gm-accent); outline-offset: 2px; }
.gm-shell button { font: inherit; color: inherit; }
.gm-shell-banner { background: var(--gm-accent); color: var(--gm-accent-contrast); text-align: center; font-size: 0.85rem; padding: 0.4rem 1rem; }
.gm-shell-notice { margin: var(--gm-space); padding: var(--gm-space); border-radius: var(--gm-radius); background: var(--gm-surface); border-left: 3px solid var(--gm-accent); display: grid; gap: 0.6rem; }
.gm-shell-notice a { font-weight: 600; }

.gm-shell-bar {
  position: sticky; top: 0; z-index: 20; display: grid; gap: 0.5rem;
  padding: 0.5rem var(--gm-space, 1rem);
  background: color-mix(in srgb, var(--gm-bg) 92%, transparent);
  -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
  border-bottom: 1px solid color-mix(in srgb, var(--gm-muted) 22%, transparent);
}
.gm-shell[data-contained="true"] .gm-shell-bar { position: sticky; }
.gm-shell-row { display: flex; gap: 0.5rem; align-items: center; min-width: 0; }
.gm-shell-search { position: relative; flex: 1; min-width: 0; }
.gm-shell-search input {
  width: 100%; min-height: 44px; border-radius: 999px; font: inherit; font-size: 1rem;
  border: 1px solid color-mix(in srgb, var(--gm-muted) 40%, transparent);
  background: var(--gm-surface); color: var(--gm-text); padding: 0 2.75rem 0 2.5rem;
  -webkit-appearance: none; appearance: none;
}
.gm-shell-search input::placeholder { color: var(--gm-muted); }
.gm-shell-search-icon { position: absolute; left: 0.95rem; top: 50%; transform: translateY(-50%); color: var(--gm-muted); pointer-events: none; display: flex; }
.gm-shell-search .gm-shell-icon-btn { position: absolute; right: 0; top: 50%; transform: translateY(-50%); }

.gm-shell-btn, .gm-shell-chip, .gm-shell-icon-btn {
  min-height: 44px; min-width: 44px; border-radius: 999px; cursor: pointer; white-space: nowrap;
  display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem;
  border: 1px solid color-mix(in srgb, var(--gm-muted) 35%, transparent); background: var(--gm-surface);
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;
}
.gm-shell-btn { padding: 0 1rem; }
.gm-shell-chip { padding: 0 0.95rem; font-size: 0.9rem; flex: none; }
.gm-shell-icon-btn { border-color: transparent; background: transparent; padding: 0; }
.gm-shell-btn[aria-pressed="true"], .gm-shell-chip[aria-pressed="true"], .gm-shell-btn--primary {
  background: var(--gm-accent); color: var(--gm-accent-contrast); border-color: var(--gm-accent);
}
.gm-shell-chip:disabled { opacity: 0.4; cursor: not-allowed; }
.gm-shell-count { font-size: 0.75rem; opacity: 0.75; font-variant-numeric: tabular-nums; }
.gm-shell-badge {
  min-width: 1.25rem; height: 1.25rem; border-radius: 999px; font-size: 0.72rem; display: inline-grid; place-items: center;
  background: var(--gm-accent); color: var(--gm-accent-contrast); padding: 0 0.3rem;
}
.gm-shell-chips { display: flex; gap: 0.4rem; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; margin-inline: calc(var(--gm-space, 1rem) * -1); padding-inline: var(--gm-space, 1rem); }
.gm-shell-chips::-webkit-scrollbar { display: none; }
.gm-shell-nav .gm-shell-chip { border-color: transparent; background: transparent; }
.gm-shell-nav .gm-shell-chip[aria-current="true"] { background: var(--gm-surface); border-color: var(--gm-accent); color: var(--gm-accent); }
.gm-shell-lang select {
  min-height: 44px; border-radius: 999px; font: inherit; font-size: 0.9rem; padding: 0 0.8rem;
  border: 1px solid color-mix(in srgb, var(--gm-muted) 35%, transparent); background: var(--gm-surface); color: var(--gm-text);
}

.gm-shell-main { max-width: 1200px; margin: 0 auto; padding-bottom: 3rem; }
.gm-shell-meta { padding: 0.75rem var(--gm-space, 1rem) 0; color: var(--gm-muted); font-size: 0.9rem; }
.gm-shell-results { padding: var(--gm-space, 1rem); }
.gm-shell-results-title { font-family: var(--gm-font-heading); font-size: 1.2rem; margin: 1.5rem 0 0.75rem; }
.gm-shell-reason { font-size: 0.78rem; color: var(--gm-muted); margin-top: 0.2rem; }
.gm-shell-empty { text-align: center; padding: 3rem var(--gm-space, 1rem); color: var(--gm-muted); display: grid; gap: 0.5rem; }
.gm-shell-page { min-height: 70vh; display: grid; place-content: center; text-align: center; gap: 1rem; padding: 2rem; }
.gm-shell-page h1 { font-size: 1.8rem; }

.gm-shell-layer { position: fixed; inset: 0; z-index: 50; display: flex; align-items: flex-end; justify-content: center; }
.gm-shell[data-contained="true"] .gm-shell-layer { position: absolute; }
.gm-shell-backdrop { position: absolute; inset: 0; background: rgb(0 0 0 / 0.45); }
.gm-shell-sheet {
  position: relative; width: 100%; max-width: 680px; max-height: 88vh; max-height: 88dvh; overflow-y: auto; overscroll-behavior: contain;
  background: var(--gm-bg); color: var(--gm-text); box-shadow: 0 -8px 32px rgb(0 0 0 / 0.25);
  border-radius: calc(var(--gm-radius, 12px) + 8px) calc(var(--gm-radius, 12px) + 8px) 0 0;
  padding: 0 var(--gm-space, 1rem) calc(1rem + env(safe-area-inset-bottom));
}
.gm-shell-sheet-head { position: sticky; top: 0; z-index: 1; background: var(--gm-bg); display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.5rem 0; }
.gm-shell-sheet-head h2 { font-size: 1.15rem; }
.gm-shell-handle { width: 2.5rem; height: 4px; border-radius: 999px; background: var(--gm-muted); opacity: 0.4; margin: 0.5rem auto 0; }
.gm-shell-sheet-foot { position: sticky; bottom: calc(-1rem - env(safe-area-inset-bottom)); background: var(--gm-bg); display: flex; gap: 0.5rem; justify-content: space-between; padding: 0.75rem 0; }
.gm-shell-group { display: grid; gap: 0.5rem; padding: 0.75rem 0; border-top: 1px solid color-mix(in srgb, var(--gm-muted) 20%, transparent); }
.gm-shell-group h3 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--gm-muted); font-family: var(--gm-font-body); }
.gm-shell-group-hint { font-size: 0.8rem; color: var(--gm-muted); }
.gm-shell-wrap { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.gm-shell-range { display: grid; gap: 0.35rem; }
.gm-shell-range input { width: 100%; accent-color: var(--gm-accent); min-height: 44px; }
.gm-shell-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

@media (min-width: 720px) {
  .gm-shell-layer { align-items: center; padding: 2rem; }
  .gm-shell-sheet { border-radius: calc(var(--gm-radius, 12px) + 8px); max-height: 85vh; }
  .gm-shell-handle { display: none; }
}
@container gm (min-width: 900px) {
  .gm-shell-bar { padding-inline: calc(var(--gm-space, 1rem) * 2); }
}
@media (prefers-reduced-motion: reduce) {
  .gm-shell-btn, .gm-shell-chip { transition: none; }
}
`;
