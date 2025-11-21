import { StrictMode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import App from './app'
import { FilecoinPinProvider } from './context/filecoin-pin-provider'
import { AuthProvider } from './context/auth-context'
import { ToastProvider } from './context/toast-context'
import { ErrorBoundary } from './components/error-boundary'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element not found')
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <FilecoinPinProvider>
        <AuthProvider>
          <ToastProvider>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
            <Toaster position="bottom-right" richColors />
          </ToastProvider>
        </AuthProvider>
      </FilecoinPinProvider>
    </BrowserRouter>
  </StrictMode>
)
