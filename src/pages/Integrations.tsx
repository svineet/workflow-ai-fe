import { useCallback, useEffect, useMemo, useState } from 'react'
import { useModal } from '../context/ModalContext'
import { FaGoogle, FaGlobe, FaRobot, FaKey, FaTrash, FaPlug, FaSlack, FaGithub } from 'react-icons/fa'
import { apiClient } from '../api/client'
import type { IntegrationsResponse } from '../api/types'

function Integrations() {
  const { open } = useModal()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<IntegrationsResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await apiClient.listIntegrations()
      setData(resp)
    } catch (e: any) {
      setError(e?.message || 'Failed to load integrations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.pathname.startsWith('/integrations/success')) {
      open({ title: 'Integration connected', body: 'Authorization successful.', primaryLabel: 'OK', onPrimary: () => {} })
      window.history.replaceState({}, '', '/integrations')
      load()
    }
  }, [open, load])

  const handleAuthorize = useCallback(async (toolkit: string) => {
    try {
      const { redirect_url } = await apiClient.authorizeComposio(toolkit)
      window.location.href = redirect_url
    } catch (e: any) {
      open({ title: 'Authorization failed', body: e?.message || 'Unknown error', primaryLabel: 'Close' })
    }
  }, [open])

  const handleDisconnect = useCallback((accountId: number, toolkit: string) => {
    open({
      title: 'Disconnect account',
      body: 'Are you sure you want to disconnect this account? You may need to re-authorize later to use the toolkit again.',
      primaryLabel: 'Disconnect',
      secondaryLabel: 'Cancel',
      onPrimary: async () => {
        if (!data) return
        // Optimistic update
        const prev = JSON.parse(JSON.stringify(data)) as IntegrationsResponse
        try {
          setData((curr) => {
            if (!curr) return curr
            const next = { ...curr }
            next.integrations = curr.integrations.map((it) => {
              if (it.toolkit !== toolkit) return it
              return { ...it, accounts: (it.accounts || []).filter((a) => a.id !== accountId), connected: ((it.accounts || []).filter((a) => a.id !== accountId)).length > 0 }
            })
            return next
          })
          await apiClient.deleteComposioAccount(accountId)
        } catch (e: any) {
          // Restore
          setData(prev)
          open({ title: 'Disconnect failed', body: e?.message || 'Unknown error', primaryLabel: 'Close' })
        }
      }
    })
  }, [open, data])

  const iconFor = (toolkit: string) => {
    const k = toolkit.toUpperCase()
    if (k.includes('SLACK')) return <FaSlack />
    if (k.includes('GITHUB')) return <FaGithub />
    if (k.includes('GMAIL') || k.includes('GOOGLE')) return <FaGoogle />
    if (k.includes('HTTP')) return <FaGlobe />
    return <FaPlug />
  }

  return (
    <main className="neo-container">
      <div className="main-wrap">
        <div className="header-row" style={{gap:8}}>
          <h2>Integrations</h2>
          <button className="neo-button" onClick={load}>Reload</button>
        </div>
        {loading && <div className="neo-card" style={{marginBottom:12}}>Loading…</div>}
        {error && <div className="neo-card" style={{color:'#b00020', marginBottom:12}}>Error: {error}</div>}

        {(data?.integrations || []).length === 0 && !loading && (
          <div className="neo-card" style={{ marginBottom: 12 }}>
            <div className="section-title">No integrations yet</div>
            <div className="muted" style={{ marginBottom: 8 }}>Authorize a toolkit to get started.</div>
            <div className="card-actions">
              <button className="neo-button" onClick={() => handleAuthorize('SLACK')}>Authorize Slack</button>
            </div>
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:12 }}>
          {(data?.integrations || []).map((i) => (
            <div key={`${i.provider}:${i.toolkit}`} className="neo-card" style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                <div className="card-title" style={{display:'flex', alignItems:'center', gap:8}}>{iconFor(i.toolkit)} {i.toolkit}</div>
                <div className="card-actions" style={{ display:'flex', gap:8 }}>
                  <button className="neo-button" onClick={() => handleAuthorize(i.toolkit)}><FaKey /> {i.connected ? 'Re-authorize' : 'Authorize'}</button>
                </div>
              </div>
              <div style={{ borderTop:'3px solid #000' }} />
              {(i.accounts && i.accounts.length > 0) ? (
                <div role="list" aria-label={`${i.toolkit} accounts`}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 180px 120px 100px', fontWeight:800, fontSize:12, marginBottom:4 }}>
                    <div>Connected Account</div>
                    <div>Created</div>
                    <div>Status</div>
                    <div style={{ textAlign:'right' }}>Actions</div>
                  </div>
                  {(i.accounts || []).map((a) => (
                    <div key={a.id} style={{ display:'grid', gridTemplateColumns:'1fr 180px 120px 100px', alignItems:'center', padding:'6px 0', borderTop:'2px solid #000' }}>
                      <div style={{ fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', wordBreak:'break-all' }}>{a.connected_account_id}</div>
                      <div style={{ fontSize:12 }}>{new Date(a.created_at).toLocaleString()}</div>
                      <div style={{ fontSize:12 }}>{a.status}</div>
                      <div style={{ display:'flex', justifyContent:'flex-end' }}>
                        <button className="neo-button danger" aria-label={`Disconnect ${a.connected_account_id}`} onClick={() => handleDisconnect(a.id as number, i.toolkit)} style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <FaTrash /> Disconnect
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="muted" style={{ fontSize:12 }}>No accounts connected.</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

export default Integrations 