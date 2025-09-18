import { createContext, useCallback, useContext, useMemo, useState } from 'react'

export type ModalOptions = {
  title: string
  body?: string
  content?: React.ReactNode
  primaryLabel?: string
  onPrimary?: () => void
  secondaryLabel?: string
  onSecondary?: () => void
}

type ModalState = ModalOptions & { isOpen: boolean }

type ModalContextType = {
  modal: ModalState
  open: (opts: ModalOptions) => void
  close: () => void
}

const ModalContext = createContext<ModalContextType | null>(null)

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalState>({ isOpen: false, title: '', body: '' })

  const open = useCallback((opts: ModalOptions) => {
    setModal({ isOpen: true, ...opts })
  }, [])

  const close = useCallback(() => {
    setModal((m) => ({ ...m, isOpen: false }))
  }, [])

  const value = useMemo(() => ({ modal, open, close }), [modal, open, close])

  return (
    <ModalContext.Provider value={value}>{children}</ModalContext.Provider>
  )
}

export function useModal() {
  const ctx = useContext(ModalContext)
  if (!ctx) throw new Error('useModal must be used within ModalProvider')
  return ctx
} 