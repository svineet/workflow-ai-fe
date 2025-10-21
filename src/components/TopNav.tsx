import { NavLink, useNavigate } from 'react-router-dom'
import HealthBadge from './HealthBadge'
import { useModal } from '../context/ModalContext'
import { apiClient } from '../api/client'
import type { Graph } from '../api/types'
import { FaPlus, FaSignOutAlt } from 'react-icons/fa'
import { useCallback, useState, useEffect } from 'react'
import { getUser, logout } from '../lib/auth'
import { supabase } from '../lib/supabase'

function TopNav() {
  const isDev = import.meta.env.MODE !== 'production'
  const { open } = useModal()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const loadUser = async () => {
      const u = await getUser()
      setUser(u)
    }
    loadUser()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })

    return () => {
      subscription.unsubscribe()
    }
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
  }, [open, navigate])

  const handleLogout = useCallback(async () => {
    try {
      await logout()
      navigate('/login')
    } catch (e: any) {
      console.error('Logout failed', e)
    }
  }, [navigate])

  return (
    <header className="top-nav">
      <div className="brand">
        <NavLink to="/" className="brand-link">workflow-ai</NavLink>
      </div>
      <nav className="nav-links">
        {user && (
          <>
            <NavLink to="/workflows" className="nav-link">Workflows</NavLink>
            <NavLink to="/integrations" className="nav-link">Integrations</NavLink>
            <NavLink to="/runs" className="nav-link">Runs</NavLink>
            <button className="neo-button primary" onClick={handleNewWorkflow} disabled={loading} style={{marginLeft:8, display:'flex', alignItems:'center', gap:6}}><FaPlus /> New Workflow</button>
          </>
        )}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
            <span className="muted" style={{ fontSize: 12 }}>{user.email}</span>
            <button className="neo-button" onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FaSignOutAlt size={12} /> Logout
            </button>
          </div>
        ) : (
          <NavLink to="/login" className="neo-button primary" style={{ marginLeft: 8 }}>Login</NavLink>
        )}
        {isDev && <HealthBadge />}
      </nav>
    </header>
  )
}

export default TopNav 