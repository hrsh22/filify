import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { toast } from 'sonner'

type ToastType = 'success' | 'error' | 'info'

export interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const value = useMemo<ToastContextValue>(
    () => ({
      showToast(message, type = 'info') {
        switch (type) {
          case 'success':
            toast.success(message)
            break
          case 'error':
            toast.error(message)
            break
          default:
            toast(message)
            break
        }
      },
    }),
    []
  )

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}


