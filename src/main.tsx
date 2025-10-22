import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ModalProvider } from './context/ModalContext'
import ModalHost from './components/ModalHost'

// Add environment marker to title when not in production
if (!import.meta.env.PROD) {
  const mode = (import.meta.env.MODE || 'dev').toUpperCase()
  document.title = `[${mode}] ${document.title}`
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModalProvider>
    <App />
      <ModalHost />
    </ModalProvider>
  </StrictMode>,
)
