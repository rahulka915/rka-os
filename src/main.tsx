import { StrictMode, Component } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider'

async function resetDevPwaState() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;

  const isLocalPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (!isLocalPreview) return;

  const serviceWorker = navigator.serviceWorker;
  if (serviceWorker) {
    const registrations = await serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
  }

  if ('caches' in window) {
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map(cacheKey => caches.delete(cacheKey)));
  }
}

class ErrorBoundary extends Component<{children: ReactNode}, {error: unknown}> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{color: 'red', padding: '20px', background: 'black', height: '100vh'}}>
          <h2>Something went wrong.</h2>
          <pre style={{whiteSpace: 'pre-wrap'}}>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

void resetDevPwaState().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
})
