import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import { App } from './app/App';

// Apply the last-used theme before first paint so dark mode doesn't flash light.
try {
  const theme = localStorage.getItem('curio-theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch {
  /* storage unavailable */
}

createRoot(document.getElementById('root')!).render(<App />);
