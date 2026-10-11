import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';

// Apply the last-used theme before first paint so dark mode doesn't flash light.
try {
  const theme = localStorage.getItem('curio-theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch {
  /* storage unavailable */
}

createRoot(document.getElementById('root')!).render(<App />);

// Offline app shell + phone share target. Not in dev, where it would cache stale code.
if (import.meta.env.PROD && 'serviceWorker' in navigator) registerSW({ immediate: true });
