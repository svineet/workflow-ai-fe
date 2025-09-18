import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ModalProvider } from './context/ModalContext'
import ModalHost from './components/ModalHost'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModalProvider>
      <App />
      <ModalHost />
    </ModalProvider>
  </StrictMode>,
)
