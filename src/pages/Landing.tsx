import { NavLink, useNavigate } from 'react-router-dom'
import { useRef, useState, useEffect } from 'react'
import { apiClient } from '../api/client'
import { API_BASE_URL } from '../api/config'
import { getSession } from '../lib/auth'

function Landing() {
  const navigate = useNavigate()
  const [text, setText] = useState<string>('')
  const [building, setBuilding] = useState<boolean>(false)
  const [streaming, setStreaming] = useState<boolean>(false)
  const [streamLines, setStreamLines] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const suggestions: Array<{ title: string; prompt: string }> = [
    {
      title: 'AI News Digest → Gmail + Slack',
      prompt:
        "Research today’s top 5 AI news using web search. Produce concise bullets with source links. Email the digest to me at saivineet89@gmail.com and also post a short summary to Slack channel #general.",
    },
    {
      title: 'Coffee Spots → Websearch + Slack',
      prompt:
        "Find 3 great coffee shops near downtown SF using web search. Include address, hours, and a one‑line reason for each. Post the recommendations to Slack #general with a friendly tone.",
    },
    {
      title: 'Today’s Calendar Summary → Gmail',
      prompt:
        "Summarize all meetings on my Google Calendar for today (primary calendar). Include times in 12‑hour format with am/pm, attendees, and links if available. Email the recap to saivineet89@gmail.com with the subject ‘Today’s Meetings Overview’.",
    },
    {
      title: 'API Health Check → HTTP + Slack',
      prompt:
        "Call https://api.github.com/rate_limit using an HTTP request. Summarize the remaining core and search rate limits, and post a short health report to Slack #devops.",
    },
    {
      title: 'Create Meeting → Calendar + Email',
      prompt:
        "Schedule a 45‑minute ‘Project Kickoff’ meeting next Friday at 3:00 pm in my primary Google Calendar. Include agenda bullets and a short description. Invite alice@example.com and bob@example.com. After creating the event, email a confirmation to saivineet89@gmail.com with the event details.",
    },
    {
      title: 'GitHub Repo Snapshot → Email',
      prompt:
        "Fetch repository metadata for https://api.github.com/repos/openai/openai-python using an HTTP request. Summarize stars, forks, open issues, and a one‑sentence overview. Email the snapshot to saivineet89@gmail.com with subject ‘OpenAI Python Repo Snapshot’.",
    },
  ]

  const handleBuild = async () => {
    if (building) return
    setBuilding(true)
    setStreaming(true)
    setStreamLines([])
    // Auth gate: if not authed, redirect to /login carrying next and prompt
    try {
      const session = await getSession()
      if (!session) {
        try { sessionStorage.setItem('landing_prompt', text || '') } catch {}
        const next = encodeURIComponent('/')
        const promptParam = encodeURIComponent(text || '')
        navigate(`/login?next=${next}&prompt=${promptParam}`)
        setBuilding(false)
        setStreaming(false)
        return
      }
    } catch {}
    // Prefer streaming endpoint; fallback to non-stream if it fails
    try {
      const { getAccessToken } = await import('../lib/auth')
      const token = await getAccessToken()
      const controller = new AbortController()
      abortRef.current = controller
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const resp = await fetch(`${API_BASE_URL}/assistant/new/stream`, {
        method: 'POST',
        headers,
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

  // Prefill from URL ?prompt or sessionStorage
  useEffect(() => {
    try {
      const usp = new URLSearchParams(window.location.search)
      const p = usp.get('prompt')
      if (p && p.length) { setText(p); return }
      const cached = sessionStorage.getItem('landing_prompt')
      if (cached && cached.length) {
        setText(cached)
        sessionStorage.removeItem('landing_prompt')
      }
    } catch {}
  }, [])

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

        {/* Assistant status/streaming */}
        <div style={{ marginTop: 16 }}>
          <div className="neo-card" style={{ marginBottom: 8, background: '#fff' }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Streaming is not enabled yet due to organisation verification. Builds still work but may take 1–2 minutes to complete.
            </div>
          </div>
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

        {/* Suggestions (secondary) */}
        <div style={{ marginTop: 16 }}>
          <div className="section-title" style={{ fontSize: 14, opacity: 0.85 }}>Suggestions</div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {suggestions.map((s, idx) => (
              <div key={idx} className="neo-card" style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ fontWeight: 800 }}>{s.title}</div>
                <div style={{ borderTop: '3px solid #000' }} />
                <div className="muted" style={{ fontSize: 12, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{s.prompt}</div>
                <div className="card-actions" style={{ marginTop: 'auto' }}>
                  <button className="neo-button" onClick={() => setText(s.prompt)}>Use</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="cta-row" style={{marginTop: 16}}>
          <NavLink to="/ide" className="neo-button primary">Open IDE</NavLink>
          <NavLink to="/workflows" className="neo-button">View Workflows</NavLink>
        </div>
      </div>
    </main>
  )
}

export default Landing 