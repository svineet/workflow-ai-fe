import { NavLink, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiClient } from '../api/client'
import type { WorkflowResponse, Graph } from '../api/types'
import { useModal } from '../context/ModalContext'
import { FaPlus, FaTrash, FaWrench } from 'react-icons/fa'

function WorkflowsList() {
  const navigate = useNavigate()
  const { open } = useModal()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [workflows, setWorkflows] = useState<Array<Pick<WorkflowResponse, 'id' | 'name' | 'description' | 'webhook_slug' | 'created_at'>> | null>(null)
  const [query, setQuery] = useState('')

  const loadList = useCallback(() => {
    setError(null)
    setLoading(true)
    apiClient.listWorkflows()
      .then((rows) => setWorkflows(rows))
      .catch((e) => setError(e?.message || 'Failed to load workflows'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadList()
  }, [loadList])

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

  const confirmDelete = useCallback((id: number, name: string) => {
    open({
      title: 'Delete workflow',
      body: `Are you sure you want to delete “${name}”? This cannot be undone.`,
      primaryLabel: 'Delete',
      secondaryLabel: 'Cancel',
      onPrimary: async () => {
        try {
          setLoading(true)
          await apiClient.deleteWorkflow(id)
          loadList()
        } catch (e: any) {
          open({ title: 'Failed to delete workflow', body: e?.message || 'Unknown error', primaryLabel: 'Close' })
        } finally {
          setLoading(false)
        }
      },
    })
  }, [open, loadList])

  const cards = useMemo(() => {
    const list = workflows && workflows.length > 0
      ? workflows.map((wf) => ({ id: Number(wf.id), name: wf.name, slug: wf.webhook_slug || '', desc: (wf.description as any as string) || '', updatedAt: Date.parse(wf.created_at) }))
      : []
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((w) => w.name.toLowerCase().includes(q) || w.slug.toLowerCase().includes(q) || w.desc.toLowerCase().includes(q))
  }, [workflows, query])

  return (
    <main className="neo-container">
      <div className="main-wrap">
        <div className="header-row" style={{gap: 8, flexWrap: 'wrap'}}>
          <h2>Workflows</h2>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <input className="neo-input" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button className="neo-button primary" onClick={handleNewWorkflow} disabled={loading}><FaPlus /> New</button>
          </div>
        </div>
        {loading && <div className="neo-card" style={{marginBottom:12}}>Loading…</div>}
        {error && <div className="neo-card" style={{color:'#b00020', marginBottom:12}}>Error: {error}</div>}
        <div className="grid">
          {cards.map((w) => (
            <div key={w.id} className="neo-card" style={{ display:'flex', flexDirection:'column', justifyContent:'space-between', minHeight: 180 }}>
              <div>
                <div className="card-title link"><NavLink to={`/ide/${w.id}`}>{w.name}</NavLink></div>
                <div style={{ borderTop: '3px solid #000', margin: '6px 0' }} />
                {w.desc && <div style={{ whiteSpace:'pre-wrap' }}>{w.desc}</div>}
                <div className="muted desc-min" style={{ marginTop: 6 }}>Updated {new Date(w.updatedAt).toLocaleString()}</div>
              </div>
              <div className="card-actions" style={{ marginTop: 8 }}>
                <NavLink to={`/ide/${w.id}`} className="neo-button success" style={{flex:1, display:'flex', alignItems:'center', gap:8}}><FaWrench /> Edit in IDE</NavLink>
                {typeof w.id === 'number' && (
                  <button className="neo-button danger" style={{width:44, display:'grid', placeItems:'center'}} onClick={() => confirmDelete(w.id as number, w.name)}><FaTrash /></button>
                )}
              </div>
            </div>
          ))}
          {!loading && !error && cards.length === 0 && (
            <div className="neo-card" style={{gridColumn:'1/-1', textAlign:'center'}}>
              <div className="card-title" style={{marginBottom:6}}>No workflows yet</div>
              <div className="muted" style={{marginBottom:12}}>Create a workflow to get started.</div>
              <div><button className="neo-button primary" onClick={handleNewWorkflow}><FaPlus /> New Workflow</button></div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

export default WorkflowsList 