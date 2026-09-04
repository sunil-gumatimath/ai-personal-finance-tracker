import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import App from './App.tsx'
import { ErrorBoundary } from '../components/system/ErrorBoundary'

// Automatically reload the page when a new deployment invalidates stale chunks.
// Timestamp-guarded so a persistently stale entry HTML can never reload-loop.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  try {
    const last = Number(sessionStorage.getItem('pft-preload-reloaded') ?? 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem('pft-preload-reloaded', String(Date.now()));
  } catch {
    // Storage unavailable — reload once anyway.
  }
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)