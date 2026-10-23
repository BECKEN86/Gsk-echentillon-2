import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ToastViewport } from './components/ToastViewport';
import './index.css';

// Safe fallbacks for iframe runtime where window.alert or window.open may throw
if (typeof window !== 'undefined') {
  const origAlert = window.alert?.bind(window);
  window.alert = (msg?: any) => {
    try {
      if (origAlert) origAlert(msg);
      else console.log('[Alert]', msg);
    } catch {
      console.warn('[Alert blocked in iframe]', msg);
    }
  };

  const origOpen = window.open?.bind(window);
  window.open = (...args: Parameters<typeof window.open>) => {
    try {
      if (origOpen) return origOpen(...args);
      return null;
    } catch {
      console.warn('[window.open blocked in iframe]', args[0]);
      return null;
    }
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <ToastViewport />
  </StrictMode>,
);
