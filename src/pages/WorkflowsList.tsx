import { NavLink, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiClient } from '../api/client'
import type { WorkflowResponse, Graph } from '../api/types'
import Modal from '../components/Modal'
import { useToast } from '../components/ToastProvider'

const mockWorkflows = [
  { id: 'wf-hello-world', name: 'Hello World', updatedAt: Date.now() - 86400000 },
  { id: 'wf-http-to-llm', name: 'HTTP → LLM', updatedAt: Date.now() - 43200000 },
]

function WorkflowsList() {
  const navigate = useNavigate()
  const { show } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [workflows, setWorkflows] = useState<Array<Pick<WorkflowResponse, 'id' | 'name' | 'webhook_slug' | 'created_at'>> | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')

  useEffect(() => {
    setError(null)
    setLoading(true)
    apiClient.listWorkflows()
      .then((rows) => setWorkflows(rows))
      .catch((e) => setError(e?.message || 'Failed to load workflows'))
      .finally(() => setLoading(false))
  }, [])

  const handleOpenModal = useCallback(() => {
    setName('')
    setDesc('')
    setModalOpen(true)
  }, [])

  const handleCreate = useCallback(async () => {
    try {
      setLoading(true)
      const graph: Graph = { nodes: [{ id: 'start-1', type: 'start', params: {} }], edges: [] }
      const created = await apiClient.createWorkflow({ name: name || 'New Workflow', webhook_slug: null, graph })
      show('success', 'Workflow created')
      setModalOpen(false)
      navigate(`/workflows/${created.id}`)
    } catch (e: any) {
      show('error', e?.message || 'Failed to create workflow')
    } finally {
      setLoading(false)
    }
  }, [name, navigate, show])

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
          <button className="neo-button primary" onClick={handleOpenModal} disabled={loading}>New Workflow</button>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="section-title">New Workflow</div>
        <div className="form-row">
          <label>Name</label>
          <input className="neo-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Workflow" />
        </div>
        <div className="form-row">
          <label>Description</label>
          <input className="neo-input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional" />
        </div>
        <div style={{display:'flex', gap:8, marginTop:8}}>
          <button className="neo-button" onClick={() => setModalOpen(false)}>Cancel</button>
          <button className="neo-button primary" onClick={handleCreate} disabled={loading || !name.trim()}>Create</button>
        </div>
      </Modal>
    </main>
  )
}

export default WorkflowsList 