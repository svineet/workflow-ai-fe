import { NavLink, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiClient } from '../api/client'
import type { WorkflowResponse, Graph } from '../api/types'
import { useModal } from '../context/ModalContext'

const mockWorkflows = [
  { id: 'wf-hello-world', name: 'Hello World', updatedAt: Date.now() - 86400000 },
  { id: 'wf-http-to-llm', name: 'HTTP → LLM', updatedAt: Date.now() - 43200000 },
]

function WorkflowsList() {
  const navigate = useNavigate()
  const { open } = useModal()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [workflows, setWorkflows] = useState<Array<Pick<WorkflowResponse, 'id' | 'name' | 'webhook_slug' | 'created_at'>> | null>(null)

  useEffect(() => {
    setError(null)
    setLoading(true)
    apiClient.listWorkflows()
      .then((rows) => setWorkflows(rows))
      .catch((e) => setError(e?.message || 'Failed to load workflows'))
      .finally(() => setLoading(false))
  }, [])

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
  }, [navigate, open])

  const cards = useMemo(() => {
    if (workflows && workflows.length > 0) {
      return workflows.map((wf) => ({ id: String(wf.id), name: wf.name, updatedAt: Date.parse(wf.created_at) }))
    }
    return mockWorkflows
  }, [workflows])

  return (
    <main className="neo-container">
      <div className="main-wrap">
        <div className="header-row">
          <h2>Workflows</h2>
          <button className="neo-button primary" onClick={handleNewWorkflow} disabled={loading}>New Workflow</button>
        </div>
        {loading && <div className="neo-card" style={{marginBottom:12}}>Loading…</div>}
        {error && <div className="neo-card" style={{color:'#b00020', marginBottom:12}}>Error: {error}</div>}
        <div className="grid">
          {cards.map((w) => (
            <div key={w.id} className="neo-card">
              <div className="card-title">{w.name}</div>
              <div className="muted">Updated {new Date(w.updatedAt).toLocaleString()}</div>
              <div className="card-actions">
                <NavLink to={`/workflows/${w.id}`} className="neo-button">Open</NavLink>
                <NavLink to={`/ide/${w.id}`} className="neo-button">Edit in IDE</NavLink>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

export default WorkflowsList 