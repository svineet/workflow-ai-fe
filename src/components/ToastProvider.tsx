import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react'

export type ToastKind = 'info' | 'success' | 'error'
export type Toast = { id: number; kind: ToastKind; message: string }

type ToastContextValue = {
  toasts: Toast[]
  show: (kind: ToastKind, message: string, timeoutMs?: number) => void
  remove: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback((kind: ToastKind, message: string, timeoutMs: number = 3000) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    const t: Toast = { id, kind, message }
    setToasts((prev) => [...prev, t])
    if (timeoutMs > 0) {
      window.setTimeout(() => remove(id), timeoutMs)
    }
  }, [remove])

  const value = useMemo(() => ({ toasts, show, remove }), [toasts, show, remove])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span className="toast-message">{t.message}</span>
            <button className="toast-close" onClick={() => remove(t.id)} aria-label="Close">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
} 