import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { apiClient } from '../api/client'
import type { LogEntry, RunResponse } from '../api/types'

function RunDetail() {
  const { runId } = useParams()
  const [apiRun, setApiRun] = useState<RunResponse | null>(null)
  const [apiLogs, setApiLogs] = useState<LogEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!runId) return
    const numericId = Number(runId)
    if (Number.isNaN(numericId)) {
      setApiRun(null)
      setApiLogs(null)
      return
    }
    setLoading(true)
    setError(null)
    Promise.all([apiClient.getRun(numericId), apiClient.getRunLogs(numericId)])
      .then(([run, logs]) => {
        setApiRun(run)
        setApiLogs(logs)
      })
      .catch((e) => {
        setError(e?.message || 'Failed to fetch run')
        setApiRun(null)
        setApiLogs(null)
      })
      .finally(() => setLoading(false))
  }, [runId])

  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.scrollTop = containerRef.current.scrollHeight
  }, [apiLogs])

  const logs = apiLogs ? apiLogs.map((l) => `${l.ts} [${l.level}] ${l.message}`) : null

  return (
    <main className="neo-container">
      <div className="main-wrap">
        <h2>Run <code>{runId}</code></h2>
        {apiRun && (
          <div className="neo-card" style={{marginBottom: 12}}>
            <div><strong>Status:</strong> {apiRun.status}</div>
            <div><strong>Workflow:</strong> {apiRun.workflow_id}</div>
            <div className="muted"><strong>Started:</strong> {apiRun.started_at || '—'} | <strong>Finished:</strong> {apiRun.finished_at || '—'}</div>
          </div>
        )}
        {loading && <div className="neo-card">Loading…</div>}
        {error && <div className="neo-card" style={{color:'#b00020'}}>Error: {error}</div>}
        <div className="neo-card">
          <div className="log-view" ref={containerRef}>
            {logs ? (
              logs.map((l, i) => (
                <div key={i} className="log-line">{l}</div>
              ))
            ) : (
              <div className="log-line muted">{loading ? 'Loading logs…' : 'No logs yet'}</div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

export default RunDetail 