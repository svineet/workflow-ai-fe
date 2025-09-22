import { NavLink, useNavigate } from 'react-router-dom'
import HealthBadge from './HealthBadge'
import { useModal } from '../context/ModalContext'
import { apiClient } from '../api/client'
import type { Graph } from '../api/types'
import { FaPlus } from 'react-icons/fa'
import { useCallback, useState } from 'react'

function TopNav() {
  const env: any = (import.meta as any)?.env || {}
  const isDev = env.MODE !== 'production'
  const { open } = useModal()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const handleNewWorkflow = useCallback(async () => {
    let name = ''
    let desc = ''
    let slug = ''

    open({
      title: 'Create new workflow',
      content: (
        <div>
          <div className="form-row">
            <label>Name</label>
            <input className="neo-input" placeholder="My Workflow" onChange={(e) => { name = e.target.value }} />
          </div>
          <div className="form-row">
            <label>Description</label>
            <input className="neo-input" placeholder="Optional" onChange={(e) => { desc = e.target.value }} />
          </div>
          <div className="form-row">
            <label>Webhook Slug</label>
            <input className="neo-input" placeholder="optional-slug" onChange={(e) => { slug = e.target.value }} />
          </div>
        </div>
      ),
      primaryLabel: 'Create',
      secondaryLabel: 'Cancel',
      onPrimary: async () => {
        try {
          setLoading(true)
          const graph: Graph = {
            nodes: [
              { id: 'start-1', type: 'start', params: { description: desc || null } },
            ],
            edges: [],
          }
          const payload = { name: (name || 'New Workflow'), description: desc || null, webhook_slug: (slug ? slug.trim() : null), graph }
          const created = await apiClient.createWorkflow(payload)
          navigate(`/workflows/${created.id}`)
        } catch (e: any) {
          open({ title: 'Failed to create workflow', body: e?.message || 'Unknown error', primaryLabel: 'Close' })
        } finally {
          setLoading(false)
        }
      },
    })
  }, [open, navigate])

  return (
    <header className="top-nav">
      <div className="brand">
        <NavLink to="/" className="brand-link">workflow-ai</NavLink>
      </div>
      <nav className="nav-links">
        <NavLink to="/workflows" className="nav-link">Workflows</NavLink>
        {/* Removed IDE link */}
        <NavLink to="/integrations" className="nav-link">Integrations</NavLink>
        <NavLink to="/runs" className="nav-link">Runs</NavLink>
        <button className="neo-button primary" onClick={handleNewWorkflow} disabled={loading} style={{marginLeft:8, display:'flex', alignItems:'center', gap:6}}><FaPlus /> New Workflow</button>
        {isDev && <HealthBadge />}
      </nav>
    </header>
  )
}

export default TopNav 