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
      // Clean up the URL
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
        <div className="grid">
          {(data?.integrations || []).map((i) => (
            <div key={`${i.provider}:${i.toolkit}`} className="neo-card">
              <div className="card-title" style={{display:'flex', alignItems:'center', gap:8}}>{iconFor(i.toolkit)} {i.toolkit}</div>
              <div className="muted" style={{marginBottom:8}}>Provider: {i.provider} · {i.connected ? 'Connected' : 'Not connected'}</div>
              {i.accounts && i.accounts.length > 0 && (
                <div className="muted" style={{fontSize:12, marginBottom:8}}>
                  Accounts:
                  <ul style={{margin: '6px 0 0 18px'}}>
                    {i.accounts.map((a) => (
                      <li key={a.id} style={{wordBreak:'break-all'}}>#{a.id} · {a.connected_account_id} · {a.status}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="card-actions">
                {!i.connected ? (
                  <button className="neo-button" onClick={() => handleAuthorize(i.toolkit)}><FaKey /> Authorize</button>
                ) : (
                  <button className="neo-button" onClick={() => handleAuthorize(i.toolkit)}><FaKey /> Re-authorize</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

export default Integrations 