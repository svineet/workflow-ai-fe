import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import TopNav from './components/TopNav'
import Landing from './pages/Landing'
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

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <div className="app-root">
          <TopNav />
          <div className="page-outlet">
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/ide" element={<IDE />} />
              <Route path="/ide/:workflowId" element={<IDE />} />
              <Route path="/runs" element={<RunsList />} />
              <Route path="/runs/:runId" element={<RunDetail />} />
              <Route path="/workflows" element={<WorkflowsList />} />
              <Route path="/workflows/:workflowId" element={<WorkflowDetail />} />
              <Route path="/blocks" element={<Blocks />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/integrations" element={<Integrations />} />
              <Route path="/integrations/success" element={<IntegrationsSuccess />} />
              <Route path="/settings" element={<Settings />} />
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
