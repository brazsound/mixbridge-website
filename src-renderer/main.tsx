import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ToastProvider } from './contexts/ToastContext';
import { LicenseProvider } from './contexts/LicenseContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { logError } from './utils/logger';
import './index.css';

window.onerror = (message, source, lineno, colno, error) => {
  logError(error ?? new Error(String(message)), { source, lineno, colno });
};

window.onunhandledrejection = (event) => {
  logError(event.reason, { type: 'unhandledrejection' });
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <LicenseProvider>
          <App />
        </LicenseProvider>
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
