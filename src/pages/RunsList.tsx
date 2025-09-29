import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { getLogsForRun } from '../mocks/logs.ts'
import { apiClient } from '../api/client'
import type { LogEntry, RunResponse } from '../api/types'
import { useModal } from '../context/ModalContext'

function RunsList() {
  const { open } = useModal()
  const [loading, setLoading] = useState(false)
  type RunPick = Pick<RunResponse, 'id' | 'workflow_id' | 'status' | 'started_at' | 'finished_at'>
  type Page = { items: RunPick[]; nextCursor: number | null }
  const [pages, setPages] = useState<Page[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const fetchPage = (before_id?: number) => {
    return apiClient.listRunsPage({ limit: 5, before_id })
  }

  const ensurePage = async (index: number): Promise<boolean> => {
    if (index < pages.length) { setCurrentPage(index); return true }
    if (index !== pages.length) return false
    const prev = pages[index - 1]
    let cursor = index === 0 ? undefined : (prev?.nextCursor ?? undefined)
    if (index > 0 && cursor == null && prev && prev.items && prev.items.length > 0) {
      cursor = Math.min(...prev.items.map((it) => Number(it.id)))
    }
    if (index > 0 && cursor == null) return false
    setLoading(true)
    try {
      const page = await fetchPage(cursor)
      setPages((prevPages) => {
        const next = [...prevPages, { items: page.items, nextCursor: page.next_cursor ?? null }]
        return next
      })
      setHasMore(!!page.has_more)
      // Defer setting current page until after pages state queues
      setTimeout(() => setCurrentPage(index), 0)
      return true
    } catch (e: any) {
      open({ title: 'Failed to load runs', body: e?.message || 'Unknown error', primaryLabel: 'Retry', onPrimary: () => ensurePage(index) })
      return false
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPages([])
    setCurrentPage(0)
    setHasMore(false)
    ensurePage(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rows = useMemo(() => {
    const pg = pages[currentPage]
    if (pg && pg.items.length > 0) {
      return pg.items
        .map((r) => ({
          id: String(r.id),
          status: r.status,
          startedAt: r.started_at ? new Date(r.started_at).getTime() : 0,
          durationSeconds: r.finished_at && r.started_at ? Math.max(0, Math.round((Date.parse(r.finished_at) - Date.parse(r.started_at)) / 1000)) : 0,
        }))
    }
    return []
  }, [pages, currentPage])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const logs = apiLogs ? apiLogs.map((l) => `${l.ts} [${l.level}] ${l.message}`) : (selectedId ? getLogsForRun(selectedId) : [])

  useEffect(() => {
    if (!rows.length) { setSelectedId(null); return }
    setSelectedId(rows[0].id)
  }, [rows])

  const showEmpty = !loading && pages.length > 0 && pages[0].items.length === 0

  const goPrev = () => {
    if (loading) return
    if (currentPage > 0) setCurrentPage((p) => p - 1)
  }
  const goNext = async () => {
    if (loading) return
    const nextIndex = currentPage + 1
    if (nextIndex < pages.length) {
      setCurrentPage(nextIndex)
      return
    }
    if (hasMore) {
      await ensurePage(nextIndex)
    }
  }
  const goPage = async (idx: number) => {
    if (loading) return
    if (idx < pages.length) { setCurrentPage(idx); return }
    if (idx === pages.length && hasMore) {
      await ensurePage(idx)
    }
  }

  return (
    <main className="neo-container">
      <div className="main-wrap">
        <h2>Runs</h2>
        {loading && pages.length === 0 && <div className="neo-card" style={{marginBottom:12}}>Loading…</div>}

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
                      <button className="neo-button" onClick={() => setSelectedId(r.id)} disabled={loading}>Logs</button>
                      <NavLink to={`/runs/${r.id}`} className="neo-button">Open</NavLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Pagination controls */}
            <div style={{display:'flex', gap:8, justifyContent:'center', alignItems:'center', padding:'12px 0'}}>
              <button className="neo-button" onClick={goPrev} disabled={currentPage === 0 || loading}>Prev</button>
              {pages.map((_, idx) => (
                <button
                  key={idx}
                  className="neo-button"
                  style={idx === currentPage ? { background: 'var(--accent)', color: '#000' } : undefined}
                  onClick={() => goPage(idx)}
                  disabled={loading}
                >{idx + 1}</button>
              ))}
              {hasMore && (
                <button className="neo-button" onClick={goNext} disabled={loading}>Next</button>
              )}
              {loading && pages.length > 0 && <span className="muted" style={{marginLeft:8}}>Loading…</span>}
            </div>
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