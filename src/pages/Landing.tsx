import { NavLink, useNavigate } from 'react-router-dom'
import { useRef, useState } from 'react'
import { apiClient } from '../api/client'
import { API_BASE_URL } from '../api/config'

function Landing() {
  const navigate = useNavigate()
  const [text, setText] = useState<string>('')
  const [building, setBuilding] = useState<boolean>(false)
  const [streaming, setStreaming] = useState<boolean>(false)
  const [streamLines, setStreamLines] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const handleBuild = async () => {
    if (building) return
    setBuilding(true)
    setStreaming(true)
    setStreamLines([])
    // Prefer streaming endpoint; fallback to non-stream if it fails
    try {
      const controller = new AbortController()
      abortRef.current = controller
      const resp = await fetch(`${API_BASE_URL}/assistant/new/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text || 'New workflow from assistant' }),
        signal: controller.signal,
      })
      if (!resp.ok || !resp.body) throw new Error('stream init failed')
      const reader = resp.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      // Read SSE frames
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        // Split by event separator \n\n
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''
        for (const frame of parts) {
          if (!frame.trim().startsWith('data:')) continue
          const jsonStr = frame.slice(frame.indexOf('data:') + 5).trim()
          if (!jsonStr) continue
          try {
            const evt = JSON.parse(jsonStr)
            if (!evt || typeof evt !== 'object' || !evt.type) continue
            switch (evt.type) {
              case 'status':
                if (evt.stage) setStreamLines((prev) => [...prev, `[status] ${evt.stage}`])
                break
              case 'agent_event':
                if (evt.preview) setStreamLines((prev) => [...prev, evt.preview])
                break
              case 'final_graph':
                setStreamLines((prev) => [...prev, `[final_graph] Graph received`])
                break
              case 'workflow_created':
                if (typeof evt.id === 'number') {
                  setStreamLines((prev) => [...prev, `[workflow_created] ID: ${evt.id}`])
                  setStreaming(false)
                  setBuilding(false)
                  navigate(`/ide/${evt.id}`)
                  return
                }
                break
              case 'error':
                if (evt.message) setStreamLines((prev) => [...prev, `[error] ${evt.message}`])
                break
              default:
                // Unknown event, append as-is
                setStreamLines((prev) => [...prev, JSON.stringify(evt)])
            }
          } catch (e) {
            // Parse failure, display raw
            setStreamLines((prev) => [...prev, jsonStr])
          }
        }
      }
      // Stream ended without workflow_created; fallback
      try {
        const res = await apiClient.assistantNew(text || 'New workflow from assistant')
        const id = res?.id
        if (typeof id === 'number' && Number.isFinite(id)) {
          navigate(`/ide/${id}`)
        } else {
          navigate('/ide')
        }
      } catch {
        navigate('/ide')
      }
    } catch (e) {
      // Fallback immediately to non-stream
      try {
        const res = await apiClient.assistantNew(text || 'New workflow from assistant')
        const id = res?.id
        if (typeof id === 'number' && Number.isFinite(id)) {
          navigate(`/ide/${id}`)
        } else {
          navigate('/ide')
        }
      } catch {
        navigate('/ide')
      }
    } finally {
      setBuilding(false)
      setStreaming(false)
    }
  }

  return (
    <main className="landing neo-container" style={{padding: '24px 16px'}}>
      <div className="main-wrap" style={{maxWidth: 960, margin: '0 auto'}}>
        <h1 className="hero-title">Workflow Engine</h1>
        <p className="hero-sub">Compose, run, and observe workflows. Minimal. Neobrutalist.</p>

        <div className="builder-wrap">
          <textarea
            className="neo-input builder-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Describe your workflow goals or paste a spec..."
            rows={10}
            aria-label="Workflow description"
          />
          <button
            className="neo-button builder-button"
            onClick={handleBuild}
            disabled={building}
            aria-label="Build workflow"
          >
            {building ? <span className="spinner" aria-hidden /> : 'Build'}
          </button>
        </div>

        {(streaming || streamLines.length > 0) && (
          <div className="builder-stream" role="region" aria-live="polite">
            <div className="builder-stream-title">Assistant</div>
            <div className="builder-stream-lines">
              {streamLines.length === 0 ? (
                <div className="muted">Connecting…</div>
              ) : (
                streamLines.map((l, i) => (
                  <div key={i} className="builder-stream-line">{l}</div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="cta-row" style={{marginTop: 16}}>
          <NavLink to="/ide" className="neo-button primary">Open IDE</NavLink>
          <NavLink to="/workflows" className="neo-button">View Workflows</NavLink>
        </div>
      </div>
    </main>
  )
}

export default Landing 