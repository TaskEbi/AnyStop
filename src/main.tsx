import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/palettes.css';
import './styles/base.css';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { applyAppearance } from './app/useTheme';
import { PALETTES, type Palette, type Theme } from './data/types';

// Apply the last-used lighting and colours before first paint so nothing flashes.
let theme: Theme = 'system';
let palette: Palette = 'kraft';
try {
  const t = localStorage.getItem('curio-theme');
  const p = localStorage.getItem('curio-palette');
  if (t === 'light' || t === 'dark') theme = t;
  if ((PALETTES as readonly string[]).includes(p ?? '')) palette = p as Palette;
} catch {
  /* storage unavailable */
}
applyAppearance(theme, palette);

createRoot(document.getElementById('root')!).render(<App />);

// Offline app shell + phone share target. Not in dev, where it would cache stale code.
if (import.meta.env.PROD && 'serviceWorker' in navigator) registerSW({ immediate: true });

if (import.meta.env.DEV) void import('./app/devTools');
