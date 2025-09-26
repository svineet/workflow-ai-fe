import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { getLogsForRun } from '../mocks/logs.ts'
import { apiClient } from '../api/client'
import type { LogEntry, RunResponse } from '../api/types'
import { useModal } from '../context/ModalContext'

function RunsList() {
  const { open } = useModal()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Array<Pick<RunResponse, 'id' | 'workflow_id' | 'status' | 'started_at' | 'finished_at'>>>([])
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const loadPage = (cursor?: number | null) => {
    setLoading(true)
    apiClient.listRunsPage({ limit: 10, before_id: cursor ?? undefined })
      .then((page) => {
        setItems((prev) => [...prev, ...page.items])
        setNextCursor(page.next_cursor ?? null)
        setHasMore(!!page.has_more)
      })
      .catch((e) => open({ title: 'Failed to load runs', body: e?.message || 'Unknown error', primaryLabel: 'Retry', onPrimary: () => loadPage(cursor) }))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setItems([])
    setNextCursor(null)
    setHasMore(false)
    loadPage()
  }, [])

  const rows = useMemo(() => {
    if (items.length > 0) {
      return [...items]
        .sort((a, b) => (Date.parse(b.started_at || '0') - Date.parse(a.started_at || '0')))
        .slice(0, 5)
        .map((r) => ({
          id: String(r.id),
          status: r.status,
          startedAt: r.started_at ? new Date(r.started_at).getTime() : 0,
          durationSeconds: r.finished_at && r.started_at ? Math.max(0, Math.round((Date.parse(r.finished_at) - Date.parse(r.started_at)) / 1000)) : 0,
        }))
    }
    return []
  }, [items])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [apiLogs, setApiLogs] = useState<LogEntry[] | null>(null)

  const fetchLogs = (runIdNumeric: number) => {
    apiClient.getRunLogs(runIdNumeric)
      .then(setApiLogs)
      .catch((e) => open({ title: 'Failed to load logs', body: e?.message || 'Unknown error', primaryLabel: 'Retry', onPrimary: () => fetchLogs(runIdNumeric) }))
  }

  useEffect(() => {
    if (!selectedId) { setApiLogs(null); return }
    const numericId = Number(String(selectedId).replace(/[^0-9]/g, ''))
    if (!Number.isFinite(numericId)) { setApiLogs(null); return }
    fetchLogs(numericId)
  }, [selectedId])

  const logs = apiLogs ? apiLogs.map((l) => `${l.ts} [${l.level}] ${l.message}`) : (selectedId ? getLogsForRun(selectedId) : [])

  useEffect(() => {
    if (!rows.length) { setSelectedId(null); return }
    setSelectedId(rows[0].id)
  }, [rows])

  const showEmpty = !loading && items.length === 0

  return (
    <main className="neo-container">
      <div className="main-wrap">
        <h2>Runs</h2>
        {loading && <div className="neo-card" style={{marginBottom:12}}>Loading…</div>}

        {!showEmpty && (
          <div className="table-wrap neo-card">
            <table className="neo-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><code>{r.id}</code></td>
                    <td>{r.status}</td>
                    <td>{r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'}</td>
                    <td>{r.durationSeconds}s</td>
                    <td style={{display:'flex',gap:8}}>
                      <button className="neo-button" onClick={() => setSelectedId(r.id)}>Logs</button>
                      <NavLink to={`/runs/${r.id}`} className="neo-button">Open</NavLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hasMore && (
              <div style={{display:'flex', justifyContent:'center', padding:'12px 0'}}>
                <button className="neo-button" onClick={() => loadPage(nextCursor || undefined)}>Load more</button>
              </div>
            )}
          </div>
        )}

        {showEmpty && (
          <div className="neo-card" style={{textAlign:'center', padding:'24px', marginTop:12}}>
            <div style={{fontSize:48, marginBottom:8}}>▶️</div>
            <div className="card-title" style={{marginBottom:6}}>No runs yet</div>
            <div className="muted" style={{marginBottom:12}}>Start a run from a workflow to see it here.</div>
            <div style={{display:'flex', gap:8, justifyContent:'center'}}>
              <NavLink to="/workflows" className="neo-button">Open Workflows</NavLink>
              <NavLink to="/ide" className="neo-button primary">Open IDE</NavLink>
            </div>
          </div>
        )}

        {!showEmpty && (
          <div className="neo-card" style={{marginTop:12}}>
            <div className="section-title">Logs {selectedId && (<code>({selectedId})</code>)}</div>
            <div className="log-view">
              {logs.map((l, i) => (
                <div key={i} className="log-line">{l}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default RunsList 