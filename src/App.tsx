import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import TopNav from './components/TopNav'
import Landing from './pages/Landing'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import IDE from './pages/IDE'
import RunsList from './pages/RunsList'
import RunDetail from './pages/RunDetail'
import WorkflowsList from './pages/WorkflowsList'
import WorkflowDetail from './pages/WorkflowDetail'
import Blocks from './pages/Blocks'
import Templates from './pages/Templates'
import Integrations from './pages/Integrations'
import IntegrationsSuccess from './pages/IntegrationsSuccess'
import Settings from './pages/Settings'
import Docs from './pages/Docs'
import NotFound from './pages/NotFound'
import { ToastProvider } from './components/ToastProvider'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <div className="app-root">
          <TopNav />
          <div className="page-outlet">
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/ide" element={<ProtectedRoute><IDE /></ProtectedRoute>} />
              <Route path="/ide/:workflowId" element={<ProtectedRoute><IDE /></ProtectedRoute>} />
              <Route path="/runs" element={<ProtectedRoute><RunsList /></ProtectedRoute>} />
              <Route path="/runs/:runId" element={<ProtectedRoute><RunDetail /></ProtectedRoute>} />
              <Route path="/workflows" element={<ProtectedRoute><WorkflowsList /></ProtectedRoute>} />
              <Route path="/workflows/:workflowId" element={<ProtectedRoute><WorkflowDetail /></ProtectedRoute>} />
              <Route path="/blocks" element={<Blocks />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
              <Route path="/integrations/success" element={<ProtectedRoute><IntegrationsSuccess /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/404" element={<NotFound />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
          </div>
        </div>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
